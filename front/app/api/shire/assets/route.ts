import { guardLocal,json } from '@/lib/shireServer'
import { promises as fs } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
export const runtime='nodejs'
export const dynamic='force-dynamic'
type Asset={id:string;file:string;sha256:string;status:string;byteSize:number}
const verified=new Map<string,{mtime:number;size:number}>()
export async function GET(request:Request){try{
  const store=guardLocal(request),dir=path.join(store.root,'assets')
  const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8')) as {assets:Asset[];missingProductionSpecies:string[]}
  const id=new URL(request.url).searchParams.get('id')
  if(!id)return json({assets:manifest.assets.map(a=>({id:a.id,status:a.status,url:`/api/shire/assets?id=${encodeURIComponent(a.id)}&sha=${a.sha256}`})),missingProductionSpecies:manifest.missingProductionSpecies})
  const asset=manifest.assets.find(a=>a.id===id);if(!asset||!/^[a-z0-9-]+\.glb$/.test(asset.file))return json({error:'This local asset is unavailable.'},404)
  const file=path.join(dir,asset.file),stat=await fs.stat(file),prior=verified.get(file),bytes=await fs.readFile(file)
  if(!prior||prior.mtime!==stat.mtimeMs||prior.size!==stat.size){if(bytes.length!==asset.byteSize||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error('The local asset has changed since verification. Its original file is preserved.');verified.set(file,{mtime:stat.mtimeMs,size:stat.size})}
  return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'model/gltf-binary','Content-Length':String(bytes.length),'Cache-Control':'private, max-age=3600','ETag':`"${asset.sha256}"`}})
}catch(e){return json({error:(e as Error).message},400)}}
