import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

export async function registerHostiles(root) {
  const dir=path.join(root,'assets'),source=path.join(dir,'hostile-races')
  const entries=(await fs.readdir(source,{withFileTypes:true})).filter(e=>e.isDirectory()&&/^\d{2}-[a-z-]+$/.test(e.name)).sort((a,b)=>a.name.localeCompare(b.name))
  if(entries.length!==25)throw Error('All 25 hostile entities are required before registration.')
  const manifestPath=path.join(dir,'manifest.json'),manifest=JSON.parse(await fs.readFile(manifestPath,'utf8')),additions=[]
  for(const entry of entries){
    const folder=path.join(source,entry.name),m=JSON.parse(await fs.readFile(path.join(folder,'manifest.json'),'utf8'))
    if(!['completed','complete-blender-validated-game-asset'].includes(m.status)||!m.originals_unchanged||!m.reimport_validation?.passed)throw Error(`Finish Blender validation first: ${entry.name}`)
    const bytes=await fs.readFile(path.join(folder,m.files.glb)),sha256=createHash('sha256').update(bytes).digest('hex'),id=`hostile-${entry.name}`,file=`${id}.glb`
    try {const existing=await fs.readFile(path.join(dir,file));if(createHash('sha256').update(existing).digest('hex')!==sha256)throw Error(`Preserved differing registered asset: ${file}`)}
    catch(e){if(e.code!=='ENOENT')throw e;await fs.writeFile(path.join(dir,file),bytes,{flag:'wx'})}
    additions.push({id,file,sha256,byteSize:bytes.length,status:'blender-validated',role:'hostile-encounter',sourcePath:path.join(folder,m.files.glb),animations:m.animations.map(a=>a.clip)})
  }
  manifest.assets=[...manifest.assets.filter(a=>!additions.some(b=>b.id===a.id)),...additions]
  const temporary=`${manifestPath}.hostiles.tmp`;await fs.writeFile(temporary,JSON.stringify(manifest,null,2));await fs.rename(temporary,manifestPath)
  return additions.map(({id,byteSize,sha256})=>({id,byteSize,sha256}))
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await registerHostiles(process.env.GRUDGE_SHIRE_DATA_ROOT||'E:\\GrudgeBloxData\\TheMiddleEarth'),null,2))
