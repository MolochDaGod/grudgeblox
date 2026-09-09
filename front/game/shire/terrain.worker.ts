import type { TerrainContext } from '@shared/shire/atlas'
import { meshChunk } from '@shared/shire/terrain'
import type { Excavation } from '@shared/shire/model'
self.onmessage=(event:MessageEvent<{key:string;cx:number;cz:number;seed:TerrainContext;edits:Excavation[];revision:number}>)=>{
  const {key,cx,cz,seed,edits,revision}=event.data
  try{const mesh=meshChunk(cx,cz,seed,edits,0.5);self.postMessage({key,revision,...mesh},{transfer:[mesh.positions.buffer,mesh.normals.buffer,mesh.colors.buffer]})}
  catch(e){self.postMessage({key,revision,error:(e as Error).message})}
}
