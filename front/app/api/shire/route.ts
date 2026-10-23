import { guardLocal,json } from '@/lib/shireServer'
import type { WorldAction } from '@shared/shire/model'
import { observation } from '@shared/shire/observation'
import { PLAY_STYLES } from '@shared/shire/lifeContent'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(request:Request){try{const store=guardLocal(request),url=new URL(request.url),id=url.searchParams.get('world');if(id)return json({world:await store.read(id)});return json({session:store.session,worlds:await store.list(),storage:store.root})}catch(e){return json({error:(e as Error).message},400)}}
export async function POST(request:Request){try{const store=guardLocal(request,true);const declared=Number(request.headers.get('content-length')||0);if(declared>4*1024*1024)throw Error('The imported world is too large.');const reader=request.body?.getReader();if(!reader)throw Error('Missing request.');const chunks:Uint8Array[]=[];let size=0;while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>4*1024*1024){await reader.cancel();throw Error('The request exceeds the local world limit.')}chunks.push(next.value)}const data=JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if(data.type==='new'){if(typeof data.name!=='string'||!Number.isSafeInteger(data.seed)||data.style!==undefined&&!Object.hasOwn(PLAY_STYLES,data.style)||data.generator!==undefined&&!['shire-1','shire-atlas-1'].includes(data.generator))throw Error('Choose a world name, play style and whole-number seed.');return json({world:await store.create(data.name,data.seed,data.style,data.generator),message:'Your local world is ready.'})}
  if(data.type==='import')return json({world:await store.import(data.world),message:'Backup imported into a new save slot.'})
  if(data.type==='recover')return json({world:await store.recover(data.worldId),message:'The previous revision was recovered into a separate save slot.'})
  if(data.type==='export')return json(await store.export(data.worldId))
  if(data.type==='observe'){if(typeof data.worldId!=='string'||!data.player||size>4096)throw Error('Invalid wildlife observation.');const world=await store.read(data.worldId,data.player);return json(data.revision===world.revision?{observation:observation(world)}:{world})}
  if(data.type!=='action'||typeof data.worldId!=='string'||!Number.isSafeInteger(data.revision)||!data.action||size>4096)throw Error('Invalid world action.')
  return json(await store.act(data.worldId,data.revision,data.action as WorldAction))
}catch(e){return json({error:(e as Error).message},400)}}
