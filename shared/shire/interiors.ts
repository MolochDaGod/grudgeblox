import type { World, Point } from './model'
import type { InteriorState } from './lifeTypes'

/** Room layout is shared by collision, service checks and the rendered room. */
export interface RoomObject { id: string; kind: 'table' | 'bench' | 'bed' | 'shelf' | 'hearth' | 'anvil' | 'millstone' | 'chest' | 'chair' | 'rune'; x: number; z: number; w: number; d: number; h: number; solid: boolean; label: string }
export function roomObjects(room: InteriorState): RoomObject[] {
  const wall = room.width / 2, back = room.depth / 2
  const object = (id: string, kind: RoomObject['kind'], x: number, z: number, w: number, d: number, h: number, label: string): RoomObject => ({id,kind,x,z,w,d,h,solid:true,label})
  if(room.kind==='barrow') return [object('leaf','rune',-3,-3,1,1,1.2,'Leaf rune'),object('river','rune',0,-4,1,1,1.2,'River rune'),object('star','rune',3,-3,1,1,1.2,'Star rune'),object('barrow-chest','chest',0,-back+2,2,1,1,'Ancient chest')]
  const objects=[object('shelf','shelf',-wall+1,-back+3,1,4,2.2,'Cupboard'),object('table','table',0,-1,2.5,1.4,.8,'Shared table'),object('chair','chair',0,.5,.65,.65,1,'Chair'),object('hearth','hearth',wall-1.2,-back+2,1.6,2,2.1,'Kitchen hearth'),object('bench','bench',-wall+1.5,1,1.6,2.5,.9,'Crafting bench')]
  if(room.kind==='smithy')objects.push(object('anvil','anvil',wall-3,-2,1.3,1,.9,'Smithy'))
  if(room.kind==='mill')objects.push(object('millstone','millstone',wall-3,-2,2,2,1.1,'Mill'))
  if(['inn','smial','cottage','hall'].includes(room.kind)) objects.push(object('bed','bed',wall-2,back-3,1.6,2.8,.6,'Guest bed'))
  if(room.kind==='inn')objects.push(object('counter','bench',0,-back+3,4,1,.95,'Inn counter'))
  return objects
}
export function interiorClear(p: Point, w: World): boolean | undefined {
  const r=w.life?.interior;if(!r)return undefined
  const x=p.x-r.origin.x,z=p.z-r.origin.z,y=p.y-r.origin.y
  if(Math.abs(x)>r.width/2-.35||Math.abs(z)>r.depth/2-.35||y<-.02||y>2.5)return false
  return !roomObjects(r).some(o=>o.solid&&y<o.h&&Math.abs(x-o.x)<o.w/2+.26&&Math.abs(z-o.z)<o.d/2+.26)
}
export function roomServicePosition(w:World,id:string):Point|undefined {const r=w.life?.interior,o=r&&roomObjects(r).find(o=>o.id===id);return r&&o?{x:r.origin.x+o.x,y:r.origin.y,z:r.origin.z+o.z}:undefined}
