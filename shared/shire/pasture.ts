import type { Point, World } from './model'
import { clear, height } from './terrain'
import { waterAt, inBounds } from './atlas'

export interface PasturePatch { id:string; position:Point; amount:number }
export interface GrazingRecord { amount:number; at:number }
const hash=(x:number,z:number,seed:number)=>{let n=Math.imul(x,73856093)^Math.imul(z,19349663)^seed;n=Math.imul(n^(n>>>13),1274126177);return (n>>>0)/4294967296}
/** The renderer and simulation use the same bounded, seeded pasture resources. */
export function pasturePatch(w:World,x:number,z:number,time=w.time):PasturePatch|undefined {
  const px=x*4+1+hash(x,z,w.seed)*2,pz=z*4+1+hash(z,x,w.seed+17)*2
  if(!inBounds(px,pz,w))return
  const y=height(px,pz,w),position={x:px,y,z:pz}
  if(y<=waterAt(px,pz,w)+.2||!clear({...position,y:y+.08},w))return
  if(w.edits.some(e=>Math.hypot(px-e.center.x,pz-e.center.z)<Math.hypot(e.size.x,e.size.z)/2+1)||w.crops.some(c=>!c.harvested&&Math.hypot(px-c.position.x,pz-c.position.z)<1.6))return
  const id=`${x}:${z}`,record=w.grazing?.[id],amount=record?Math.min(1,record.amount+Math.max(0,time-record.at)/300):1
  return {id,position,amount}
}
export function pasturePatches(w:World,center:Point,radius=16,time=w.time):PasturePatch[]{
  const result:PasturePatch[]=[]
  for(let z=Math.floor((center.z-radius)/4);z<=Math.floor((center.z+radius)/4);z++)for(let x=Math.floor((center.x-radius)/4);x<=Math.floor((center.x+radius)/4);x++){
    const patch=pasturePatch(w,x,z,time)
    if(patch&&Math.hypot(patch.position.x-center.x,patch.position.z-center.z)<=radius)result.push(patch)
  }
  return result
}
export function patchById(w:World,id:string,time=w.time){const parts=id.split(':').map(Number);if(parts.length!==2||parts.some(n=>!Number.isInteger(n)))return;return pasturePatch(w,parts[0],parts[1],time)}
export function consumePasture(w:World,id:string,amount:number,time=w.time):number{
  const patch=patchById(w,id,time);if(!patch||patch.amount<=.08)return 0
  const records=w.grazing??={}
  if(!records[id]&&Object.keys(records).length>=4096){for(const [key,r]of Object.entries(records))if(r.amount+(time-r.at)/300>=1)delete records[key];if(Object.keys(records).length>=4096)return 0}
  const eaten=Math.max(0,Math.min(patch.amount,amount));records[id]={amount:patch.amount-eaten,at:time};return eaten
}
