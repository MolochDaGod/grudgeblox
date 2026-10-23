import { inBounds, fallFloor } from './atlas'
import { Excavation, Point, World, WorldAction, Tool, FurnitureKind, DoorFit, WORLD_LIMIT, FALL_RECOVERY_Y } from './model'
import { density, clear } from './terrain'

export interface ToolSettings { tool:Tool; width:number; height:number; depth:number; furniture:FurnitureKind; yaw:number; crop:'barley'|'carrot'; brushShape:'sphere'|'box'|'cylinder'; brushWidth:number; brushHeight:number; brushDepth:number }
export const DEFAULT_TOOLS:ToolSettings={tool:'explore',width:4,height:2.5,depth:4,furniture:'table',yaw:0,crop:'barley',brushShape:'sphere',brushWidth:2,brushHeight:2,brushDepth:2}
export type EntranceAction=Extract<WorldAction,{type:'entrance'}>

/** One shared plan drives the preview, excavation and walkability checks. */
export function entrancePlan(w:World,a:EntranceAction):{edits:Excavation[]; end:Point; length:number; drop:number} {
  const width=Math.max(2.2,Math.min(4,a.width)),tall=Math.max(2.4,Math.min(4,a.height)),slope=0.22
  const forward={x:-Math.sin(a.yaw),z:-Math.cos(a.yaw)},side={x:Math.cos(a.yaw),z:-Math.sin(a.yaw)}
  for(const length of [8,10,12,14,16,18,20]){
    const drop=length*slope,floor=a.origin.y-drop,roomWidth=Math.max(4.5,width+1),roomDepth=4.5
    if(floor<fallFloor(w)+3)continue
    const end={x:a.origin.x+forward.x*(length+1.5),y:floor+0.08,z:a.origin.z+forward.z*(length+1.5)}
    const room:Excavation={id:'preview-room',kind:'dig',shape:'box',center:{...end,y:floor+tall/2},size:{x:roomWidth,y:tall,z:roomDepth},yaw:a.yaw,entrance:false}
    let covered=true
    const nx=Math.ceil(roomWidth/0.3),nz=Math.ceil(roomDepth/0.3)
    for(let ix=0;ix<=nx;ix++)for(let iz=0;iz<=nz;iz++){
      const x=roomWidth*(ix/nx-0.5),z=roomDepth*(iz/nz-0.5)
      const px=end.x+side.x*x-forward.x*z,pz=end.z+side.z*x-forward.z*z
      if(!inBounds(px,pz,w)||[0.1,0.35,0.7].some(dy=>density(px,floor+tall+dy,pz,w,w.edits)<0.03))covered=false
    }
    if(!covered)continue
    // Begin slightly behind the mouth, so the ramp joins the existing walking surface.
    const ramp:Excavation={id:'preview-ramp',kind:'dig',shape:'ramp',center:{x:a.origin.x+forward.x*length/2,y:a.origin.y-drop/2+tall/2,z:a.origin.z+forward.z*length/2},size:{x:width,y:tall,z:length+1},yaw:a.yaw,entrance:true,slope}
    const candidate={...w,edits:[...w.edits,ramp,room]}
    if(!clear(w.player,candidate))continue
    let walkable=true
    for(let d=0;d<=length;d+=0.2){const p={x:a.origin.x+forward.x*d,y:a.origin.y-d*slope+0.08,z:a.origin.z+forward.z*d};if(!clear(p,candidate)||density(p.x,p.y-0.25,p.z,w,candidate.edits)<=0)walkable=false}
    if(!clear(end,candidate)||density(end.x,end.y-0.3,end.z,w,candidate.edits)<=0)walkable=false
    if(walkable)return {edits:[ramp,room],end,length,drop}
  }
  throw Error('Aim into a dry hillside from nearby ground. Entry needs enough earth for a descending tunnel and a covered, level chamber.')
}

/** Find the hall's actual walls and ceiling; the surround overlaps earth at its edges. */
export function fitDoor(w:World,position:Point,yaw:number):{position:Point;fit:DoorFit} {
  const c=Math.cos(yaw),s=Math.sin(yaw),at=(x:number,y:number)=>density(position.x+x*c,position.y+y,position.z-x*s,w,w.edits)
  const wall=(direction:number,y:number)=>{for(let x=0.15;x<=4.5;x+=0.1)if(at(x*direction,y)>0.03)return x;return null}
  let left=wall(-1,0.8),right=wall(1,0.8)
  if(left===null||right===null)throw Error('Aim at the floor of an enclosed hallway and turn the door across the passage. Both side walls must be within 4.5 m.')
  for(let y=0.3;y<=6&&at(0,y)<0.03;y+=0.15){const l=wall(-1,y),r=wall(1,y);if(l===null||r===null)throw Error('The hallway is too wide for a fitted doorway. Choose a narrower cross-section.');left=Math.max(left,l);right=Math.max(right,r)}
  const shift=(right-left)/2,width=left+right+0.25
  let ceiling=0
  for(let x=-left+0.25;x<right-0.2;x+=0.25){let top=0;for(let y=0.25;y<=6;y+=0.1){if(at(x,y)>0.03){top=y;break}}if(!top)throw Error('The doorway needs a ceiling above the hallway.');ceiling=Math.max(ceiling,top)}
  const openingWidth=Math.min(2.1,width-0.35),openingHeight=Math.min(2.35,ceiling-0.2)
  if(openingWidth<1.35||openingHeight<2.05)throw Error('Widen this hallway and raise its ceiling before fitting a walkable door.')
  const fitted={x:position.x+shift*c,y:position.y,z:position.z-shift*s}
  if(!clear({...fitted,y:fitted.y+0.06},w))throw Error('Clear the middle of this doorway from floor to head height first.')
  return {position:fitted,fit:{width,height:ceiling+0.18,openingWidth,openingHeight}}
}

export function toolAction(s:ToolSettings,hit:Point|null,player:World['player'],direction:Point):WorldAction|null {
  if(!hit)return null
  const p={x:hit.x,y:hit.y+0.04,z:hit.z},length=Math.hypot(direction.x,direction.z)||1,forward={x:direction.x/length,z:direction.z/length},yaw=Math.atan2(-forward.x,-forward.z)
  if(s.tool==='furnish')return {type:'furnish',kind:s.furniture,position:p,yaw:s.yaw}
  if(s.tool==='farm')return {type:'plant',kind:s.crop,position:p}
  if(s.tool==='dig'||s.tool==='fill'){
    const offset=s.tool==='dig'?0.4:-0.35,unit=s.brushShape==='sphere'?0.5:1
    return {type:'excavate',edit:{kind:s.tool==='dig'?'dig':'fill',shape:s.brushShape,center:{x:hit.x+direction.x*offset,y:hit.y+direction.y*offset,z:hit.z+direction.z*offset},size:{x:s.brushWidth*unit,y:s.brushHeight*unit,z:s.brushDepth*unit},yaw:s.yaw,entrance:true}}
  }
  if(s.tool==='entrance')return {type:'entrance',origin:{x:player.x+forward.x*0.6,y:player.y-0.08,z:player.z+forward.z*0.6},yaw,width:s.width,height:s.height}
  if(s.tool==='room'||s.tool==='passage')return {type:'excavate',edit:{kind:'dig',shape:'box',center:{x:hit.x+forward.x*(s.depth/2-0.2),y:player.y+s.height/2-0.05,z:hit.z+forward.z*(s.depth/2-0.2)},size:{x:s.tool==='room'?s.width:Math.min(s.width,2.2),y:s.height,z:s.depth},yaw,entrance:false}}
  if(s.tool==='floor'||s.tool==='ceiling')return {type:'excavate',edit:{kind:'dig',shape:'box',center:{x:hit.x,y:s.tool==='floor'?player.y-0.2:hit.y+0.2,z:hit.z},size:{x:s.width,y:0.5,z:s.depth},yaw:s.yaw,entrance:s.tool==='floor'}}
  return null
}
