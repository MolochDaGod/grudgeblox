import { meshChunk } from '@shared/shire/terrain'
import type {TerrainWork,TerrainResult} from './terrainWork'
self.onmessage=(event:MessageEvent<TerrainWork>)=>{
  const {key,cx,cz,seed,edits,revision}=event.data
  const stamp=edits.map(e=>e.id).join(':')
  try{const mesh=meshChunk(cx,cz,seed,edits,0.5);self.postMessage({key,revision,stamp,...mesh} satisfies TerrainResult,{transfer:[mesh.positions.buffer,mesh.normals.buffer,mesh.colors.buffer]})}
  catch(e){self.postMessage({key,revision,stamp,error:(e as Error).message} satisfies TerrainResult)}
}
