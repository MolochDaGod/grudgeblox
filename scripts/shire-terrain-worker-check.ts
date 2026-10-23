import assert from 'node:assert/strict'
import type {TerrainResult,TerrainWork} from '../front/game/shire/terrainWork'
async function main(){
  let reply:TerrainResult|undefined
  const host={onmessage:undefined as undefined|((event:{data:TerrainWork})=>void),postMessage:(message:TerrainResult)=>{reply=message}}
  Object.assign(globalThis,{self:host})
  await import('../front/game/shire/terrain.worker')
  const started=performance.now()
  host.onmessage!({data:{key:'0:-3',cx:0,cz:-3,seed:{generator:'shire-atlas-1',seed:42},edits:[],revision:17}})
  assert(reply&&'positions' in reply,JSON.stringify(reply));assert.equal(reply.revision,17);assert.equal(reply.stamp,'');assert(reply.positions.length>0);assert.equal(reply.positions.length,reply.normals.length);assert.equal(reply.positions.length,reply.colors.length)
  console.log(JSON.stringify({passed:true,key:reply.key,revision:reply.revision,stamp:reply.stamp,vertices:reply.positions.length/3,ms:performance.now()-started}))
}
main().catch(e=>{console.error(e);process.exitCode=1})
