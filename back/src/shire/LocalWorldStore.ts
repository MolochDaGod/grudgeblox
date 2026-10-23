import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { World, WorldAction, WorldSummary } from '../../../shared/shire/model'
import { createWorld, applyAction, advanceWorld, validateWorld } from '../../../shared/shire/simulation'
import { ensureCombat, observePlayer } from '../../../shared/shire/combat'
import { ensureLife } from '../../../shared/shire/life'
import type { PlayStyle } from '../../../shared/shire/lifeTypes'

const digest=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex')
const safeId=(id:string)=>{if(!/^[0-9a-f-]{36}$/.test(id))throw Error('Invalid local world ID.');return id}
type Head={revision:number;file:string;sha256:string}
export class LocalWorldStore {
  private queue:Promise<unknown>=Promise.resolve()
  private active=new Map<string,{world:World;last:number;persistedTime:number}>()
  readonly session=randomUUID()
  constructor(readonly root:string){if(!path.isAbsolute(root))throw Error('The local storage root must be an absolute path.')}
  private async serial<T>(fn:()=>Promise<T>):Promise<T>{const result=this.queue.then(fn);this.queue=result.catch(()=>{});return result}
  private async preflight(){await fs.mkdir(path.join(this.root,'saves'),{recursive:true});const stat=await fs.statfs(this.root);if(Number(stat.bavail)*Number(stat.bsize)<128*1024*1024)throw Error(`Not enough free space at ${this.root}. Free space on E: before saving.`)}
  private directory(id:string){return path.join(this.root,'saves',safeId(id))}
  private async atomic(file:string,data:string){const tmp=`${file}.${randomUUID()}.tmp`;const handle=await fs.open(tmp,'wx');try{await handle.writeFile(data);await handle.sync()}finally{await handle.close()}try{await fs.rename(tmp,file)}catch(e){await fs.rm(tmp,{force:true});throw e}}
  private async persist(w:World){
    await this.preflight();validateWorld(w);const dir=this.directory(w.id);await fs.mkdir(dir,{recursive:true});w.savedAt=new Date().toISOString()
    const bytes=JSON.stringify(w),file=`revision-${w.revision}-${randomUUID()}.json`,head:Head={revision:w.revision,file,sha256:digest(bytes)}
    await this.atomic(path.join(dir,file),bytes)
    const current=path.join(dir,'current.json');try{const old=await fs.readFile(current,'utf8');await this.atomic(path.join(dir,'previous.json'),old)}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}
    await this.atomic(current,JSON.stringify(head));this.active.get(w.id)!.persistedTime=w.time
    // Keep revision history bounded. Only obsolete revision files in this exact world directory are candidates.
    // Cleanup cannot turn a committed action into a reported failure. Both heads remain protected.
    try {
      const previous=JSON.parse(await fs.readFile(path.join(dir,'previous.json'),'utf8')) as Head
      const files=(await fs.readdir(dir,{withFileTypes:true})).filter(f=>f.isFile()&&/^revision-\d+-[0-9a-f-]+\.json$/.test(f.name))
      if(files.length>12){const ranked=await Promise.all(files.map(async f=>({name:f.name,time:(await fs.stat(path.join(dir,f.name))).mtimeMs})));ranked.sort((a,b)=>b.time-a.time);for(const f of ranked.slice(12))if(f.name!==file&&f.name!==previous.file)await fs.unlink(path.join(dir,f.name))}
    } catch { /* Retaining extra revisions is safe; the next save retries cleanup. */ }
  }
  private async fromHead(id:string,name:string){const dir=this.directory(id),head=JSON.parse(await fs.readFile(path.join(dir,name),'utf8')) as Head;if(!/^revision-\d+-[0-9a-f-]+\.json$/.test(head.file))throw Error('Invalid save revision path.');const bytes=await fs.readFile(path.join(dir,head.file),'utf8');if(digest(bytes)!==head.sha256)throw Error('The save checksum does not match.');const w:unknown=JSON.parse(bytes);validateWorld(w);if(w.id!==id||w.revision!==head.revision)throw Error('The saved world identity does not match.');return w}
  private async load(id:string){safeId(id);const cached=this.active.get(id);if(cached)return cached
    const world=await this.fromHead(id,'current.json').catch(e=>{throw Error(`Cannot open this world: ${(e as Error).message} Use Recover previous save; the original is preserved.`)})
    ensureCombat(world);ensureLife(world);const entry={world,last:Date.now(),persistedTime:world.time};this.active.set(id,entry);return entry
  }
  async list():Promise<WorldSummary[]>{return this.serial(async()=>{await this.preflight();const dirs=await fs.readdir(path.join(this.root,'saves'),{withFileTypes:true});const out:WorldSummary[]=[];for(const d of dirs){if(!d.isDirectory()||!/^[0-9a-f-]{36}$/.test(d.name))continue;try{const w=await this.fromHead(d.name,'current.json');out.push({id:w.id,name:w.name,savedAt:w.savedAt,revision:w.revision,style:w.life?.style,archived:w.life?.archived,generator:w.generator,seed:w.seed})}catch{out.push({id:d.name,name:'World needs recovery',savedAt:'',revision:-1})}}return out.sort((a,b)=>b.savedAt.localeCompare(a.savedAt))})}
  async create(name:string,seed:number,style:PlayStyle='homestead',generator:World['generator']='shire-atlas-1'){return this.serial(async()=>{const w=createWorld(name,seed,generator);w.time=200;ensureLife(w,style);this.active.set(w.id,{world:w,last:Date.now(),persistedTime:0});await this.persist(w);return structuredClone(w)})}
  async read(id:string,player?:World['player']){return this.serial(async()=>{const entry=await this.load(id),now=Date.now(),elapsed=(now-entry.last)/1000;const copy=structuredClone(entry.world);if(player!==undefined)observePlayer(copy,player);if(elapsed<4)advanceWorld(copy,elapsed);if(copy.time-entry.persistedTime>=10){copy.revision++;await this.persist(copy)}entry.last=now;entry.world=copy;return structuredClone(copy)})}
  async act(id:string,revision:number,action:WorldAction){return this.serial(async()=>{const entry=await this.load(id);if(entry.world.revision!==revision)throw Error('The world changed while this action was queued. Your view has refreshed; try again.');const copy=structuredClone(entry.world),now=Date.now(),elapsed=(now-entry.last)/1000;if(elapsed<4)advanceWorld(copy,elapsed);const message=applyAction(copy,action);validateWorld(copy);const old=entry.world;entry.world=copy;try{await this.persist(copy)}catch(e){entry.world=old;throw e}entry.last=now;return {world:structuredClone(copy),message}})}
  async recover(id:string){return this.serial(async()=>{const previous=await this.fromHead(id,'previous.json');const recovered=structuredClone(previous);recovered.id=randomUUID();recovered.name=`${previous.name.slice(0,48)} (recovered)`;recovered.revision=0;ensureCombat(recovered);ensureLife(recovered);this.active.set(recovered.id,{world:recovered,last:Date.now(),persistedTime:0});await this.persist(recovered);return structuredClone(recovered)})}
  async import(value:unknown){return this.serial(async()=>{validateWorld(value);const w=structuredClone(value);w.id=randomUUID();w.name=`${w.name} (imported)`.slice(0,60);w.revision=0;ensureCombat(w);ensureLife(w);this.active.set(w.id,{world:w,last:Date.now(),persistedTime:0});await this.persist(w);return structuredClone(w)})}
  async export(id:string){return this.serial(async()=>{const entry=await this.load(id);await this.persist(entry.world);const dir=path.join(this.root,'saves','backups');await fs.mkdir(dir,{recursive:true});const backupPath=path.join(dir,`${id}-r${entry.world.revision}-${Date.now()}.json`);await this.atomic(backupPath,JSON.stringify(entry.world,null,2));return {world:structuredClone(entry.world),backupPath}})}
}
