import type { World, Point } from './model'
import { isAtlas, ATLAS_TOWNS, townPlots, atlasHeight, waterAt, riverAt, HIGH_HAY, projection, ATLAS_PLACES } from './atlas'
import { woodlandPoint, WOODLAND_CELL } from './atlasScenery'
import { pathClearance, townPaths } from './atlasPaths'

export function fenceSegments(x:number,z:number,length:number,yaw:number){
  const out:Array<{x:number;z:number;length:number;yaw:number}>=[]
  for(let i=-length/2;i<length/2;i+=2.5){const len=Math.min(2.5,length/2-i),xx=x+Math.cos(yaw)*(i+len/2),zz=z-Math.sin(yaw)*(i+len/2);if(pathClearance(xx,zz)>=len/2+.7)out.push({x:xx,z:zz,length:len,yaw})}
  return out
}
type Obstacle={x:number;z:number;width:number;depth:number;height:number;yaw:number}
const townCache=new Map<string,Obstacle[]>()
function townObstacles(t:typeof ATLAS_TOWNS[number]){
  let out=townCache.get(t.id);if(out)return out
  townPaths(t);out=[]
  const box=(x:number,z:number,width:number,depth:number,height:number,yaw=0)=>out!.push({x,z,width,depth,height,yaw})
  const fence=(x:number,z:number,len:number,yaw=0)=>fenceSegments(x,z,len,yaw).forEach(s=>box(s.x,s.z,s.length,.16,1.04,s.yaw))
  const dry=(x:number,z:number,buffer=3)=>{const r=riverAt(x,z);return atlasHeight(x,z)>waterAt(x,z,{generator:'shire-atlas-1',seed:42})+.4&&(!r||r.distance>r.width/2+buffer)}
  for(const p of townPlots(t))if(!p.label){const front=p.yaw===0?1:-1;fence(p.x,p.z+front*8,10);for(const side of [-1,1]){const x=p.x+side*4.8,z=p.z+front*5;if(pathClearance(x,z)>=2.7)box(x,z,1.8,3,.4)}}
  if(t.style!=='woodland'){
    if(t.homes>8){if(pathClearance(t.x+12,t.z+7)>2.5)box(t.x+12,t.z+7,2.6,2.6,.85);const stalls=t.style==='market'||t.style==='bree'?6:2;for(let i=0;i<stalls;i++){const x=t.x-42+i*15,z=t.z+65;if(pathClearance(x,z)>=4)box(x,z,4,2,1)}}
    for(let i=0;i<16;i++){const x=t.x-160-(i%4)*12,z=t.z-60+Math.floor(i/4)*15;if(pathClearance(x,z)>5&&dry(x,z))box(x,z,.42,.42,3.6)}
    for(let i=0;i<4;i++)fence(t.x+175+(i%2)*48,t.z-50+Math.floor(i/2)*70,44)
    for(let i=0;i<12;i++){const a=i*Math.PI/6,x=t.x+Math.sin(a)*145,z=t.z+Math.cos(a)*145;if(pathClearance(x,z)>6&&dry(x,z,5))box(x,z,.7*(.8+i%3*.15),.7*(.8+i%3*.15),5)}
    if(t.id==='hobbiton')box(t.x-18,t.z-42,1.19,1.19,10)
    if(t.id==='bamfurlong')for(const dx of [-30,30])fence(t.x+dx,t.z,100,Math.PI/2)
  }
  townCache.set(t.id,out);return out
}
export function sceneryBlocked(p:Point,w:World){
  if(!isAtlas(w))return false
  if(Math.abs(p.x-83900)<9&&Math.abs(p.z-12900)<10){const open=w.life?.gates?.['hay-gate'],ground=atlasHeight(83900,12900);if(p.y<ground+2.7&&p.y+1.55>ground){if(!open&&Math.abs(p.x-83900)<4&&Math.abs(p.z-12900)<.4)return true;if(open&&Math.abs(p.x-83896)<.4&&p.z>12899.7&&p.z<12907.8)return true}}
  if(Math.hypot(p.x-83900,p.z-12900)>8)for(let i=1;i<HIGH_HAY.length;i++){const q=projection(p.x,p.z,HIGH_HAY[i-1],HIGH_HAY[i]);if(q.d<4.8&&pathClearance(p.x,p.z)>=5&&p.y<atlasHeight(p.x,p.z)+4.5)return true}
  for(const landmark of ATLAS_PLACES)if(landmark.id==='old-man-willow'&&Math.hypot(p.x-landmark.x,p.z-landmark.z)<1.31&&p.y<atlasHeight(landmark.x,landmark.z)+18)return true
  // Initialising only the nearby towns keeps the collision map aligned with path clearance.
  for(const t of ATLAS_TOWNS)if(Math.hypot(p.x-t.x,p.z-t.z)<400)for(const o of townObstacles(t)){
    if(Math.abs(p.x-o.x)>o.width+2||Math.abs(p.z-o.z)>o.depth+2)continue
    const y=atlasHeight(o.x,o.z);if(p.y>=y+o.height||p.y+1.55<=y)continue
    const dx=p.x-o.x,dz=p.z-o.z,c=Math.cos(o.yaw),s=Math.sin(o.yaw);if(Math.abs(dx*c-dz*s)<o.width/2+.26&&Math.abs(dx*s+dz*c)<o.depth/2+.26)return true
  }
  const ix=Math.floor(p.x/WOODLAND_CELL),iz=Math.floor(p.z/WOODLAND_CELL)
  for(let x=ix-1;x<=ix+1;x++)for(let z=iz-1;z<=iz+1;z++){const t=woodlandPoint(x,z,w.seed);if(!t||Math.hypot(p.x-t.x,p.z-t.z)>.26+(t.kind==='birch'?.2:t.kind==='hazel'?.22:.47)*t.scale)continue;const ground=atlasHeight(t.x,t.z);if(p.y<ground+(t.kind==='hazel'?4.5:t.kind==='beech'?10:t.kind==='birch'?10.5:8.5)*t.scale&&p.y+1.55>ground)return true}
  return false
}
