import { Excavation, Point, World, PLAYER_HEIGHT, PLAYER_RADIUS, FURNITURE, WORLD_LIMIT } from './model'
import { TerrainContext, isAtlas, atlasHeight, inBounds, buildingBlocked, bridgeBlocked, bridgeAt, bridgeDeck, fallFloor, landcover } from './atlas'
import { interiorClear } from './interiors'
import { sceneryBlocked } from './sceneryCollision'

export function height(x: number,z: number,context:TerrainContext=42) {
  if(isAtlas(context))return atlasHeight(x,z)
  const seed=typeof context==='number'?context:context.seed
  const s=(seed%199)*0.01
  const hills = 11*Math.exp(-((x+30)**2/540+(z+6)**2/790)) + 5*Math.exp(-((x-170)**2+(z-95)**2)/6500)
  const rolling=3.2*Math.sin(x/86+s)*Math.cos(z/130)+2.7*Math.sin(z/67+0.3)+1.5*Math.cos((x+z)/43)
  const pond=9*Math.exp(-((x-25)**2/850+(z-112)**2/1700))
  return 6+rolling+hills-pond
}
export const WATER_LEVEL = 2.5
export function shapeDistance(p: Point,e: Excavation) {
  const dx=p.x-e.center.x,dz=p.z-e.center.z,c=Math.cos(e.yaw),s=Math.sin(e.yaw)
  const x=dx*c-dz*s,z=dx*s+dz*c,y=p.y-e.center.y-(e.shape==='ramp'?(e.slope||0)*z:0)
  if(e.shape==='sphere') return (Math.hypot(x/e.size.x,y/e.size.y,z/e.size.z)-1)*Math.min(e.size.x,e.size.y,e.size.z)
  if(e.shape==='cylinder'){const radial=(Math.hypot(x/(e.size.x/2),z/(e.size.z/2))-1)*Math.min(e.size.x,e.size.z)/2,vertical=Math.abs(y)-e.size.y/2;return Math.min(Math.max(radial,vertical),0)+Math.hypot(Math.max(radial,0),Math.max(vertical,0))}
  const round=0.22,qx=Math.abs(x)-e.size.x/2+round,qy=Math.abs(y)-e.size.y/2+round,qz=Math.abs(z)-e.size.z/2+round
  return Math.hypot(Math.max(qx,0),Math.max(qy,0),Math.max(qz,0))+Math.min(Math.max(qx,qy,qz),0)-round
}
/** Positive is earth; subtracting a full 3D distance volume leaves actual roofs and walls. */
export function density(x:number,y:number,z:number,seed:TerrainContext,edits:Excavation[]) {
  const room=typeof seed==='object'?(seed as World).life?.interior:undefined
  if(room&&Math.abs(x-room.origin.x)<room.width/2+2&&Math.abs(z-room.origin.z)<room.depth/2+2&&Math.abs(y-room.origin.y)<6)return Math.max(room.origin.y-y,Math.abs(x-room.origin.x)-room.width/2,Math.abs(z-room.origin.z)-room.depth/2,y-room.origin.y-4)
  let d=height(x,z,seed)-y
  for(const e of edits) {
    const radius=Math.hypot(e.size.x,e.size.z)+(e.shape==='sphere'?1:0)
    if(Math.abs(x-e.center.x)>radius || Math.abs(z-e.center.z)>radius || Math.abs(y-e.center.y)>e.size.y+1+Math.abs(e.slope||0)*e.size.z/2)continue
    const sd=shapeDistance({x,y,z},e)
    d=e.kind==='dig'?Math.min(d,sd):Math.max(d,-sd)
  }
  return d
}
export function solid(p:Point,w:Pick<World,'seed'|'edits'>&Partial<Pick<World,'generator'>>) { return density(p.x,p.y,p.z,w,w.edits)>0.015 }
export function terrainClear(p:Point,w:Pick<World,'seed'|'edits'>&Partial<Pick<World,'generator'>>) {
  const room=(w as World).life?.interior
  const nearby=room||w.edits.some(e=>Math.abs(p.x-e.center.x)<Math.hypot(e.size.x,e.size.z)+1&&Math.abs(p.z-e.center.z)<Math.hypot(e.size.x,e.size.z)+1)
  if(!nearby)return [[0,0],[PLAYER_RADIUS,0],[-PLAYER_RADIUS,0],[0,PLAYER_RADIUS],[0,-PLAYER_RADIUS]].every(([dx,dz])=>height(p.x+dx,p.z+dz,w)-p.y-.09<=.015)
  for(const dy of [0.09,0.4,0.9,PLAYER_HEIGHT-0.08]) for(const [dx,dz] of [[0,0],[PLAYER_RADIUS,0],[-PLAYER_RADIUS,0],[0,PLAYER_RADIUS],[0,-PLAYER_RADIUS]]) {
    if(solid({x:p.x+dx,y:p.y+dy,z:p.z+dz},w))return false
  }
  return true
}
export function clear(p:Point,w:World) {
  const room=interiorClear(p,w);if(room!==undefined)return room
  if(!inBounds(p.x,p.z,w) || buildingBlocked(p,w) || bridgeBlocked(p,w) || sceneryBlocked(p,w) || !terrainClear(p,w))return false
  for(const f of w.furniture) {
    if(f.kind==='lamp')continue
    const sz=f.kind==='door'&&f.fit?{x:f.fit.width,y:f.fit.height,z:0.25}:FURNITURE[f.kind].size,dx=p.x-f.position.x,dz=p.z-f.position.z,c=Math.cos(f.yaw),s=Math.sin(f.yaw)
    if(f.kind==='door'&&f.open){
      if(!f.fit)continue
      if(Math.abs(dx*c-dz*s)>sz.x/2+PLAYER_RADIUS||Math.abs(dx*s+dz*c)>sz.z/2+PLAYER_RADIUS||p.y>=f.position.y+sz.y||p.y+PLAYER_HEIGHT<=f.position.y)continue
      const x=dx*c-dz*s,center=f.fit.openingHeight/2-0.15
      for(const ox of [-PLAYER_RADIUS,0,PLAYER_RADIUS])for(const oy of [0.09,0.7,PLAYER_HEIGHT-0.08]){
        if(((x+ox)/(f.fit.openingWidth/2))**2+((p.y-f.position.y+oy-center)/(f.fit.openingHeight/2))**2>=1)return false
      }
      continue
    }
    if(Math.abs(dx*c-dz*s)<sz.x/2+PLAYER_RADIUS && Math.abs(dx*s+dz*c)<sz.z/2+PLAYER_RADIUS && p.y<f.position.y+sz.y && p.y+PLAYER_HEIGHT>f.position.y+0.05)return false
  }
  return true
}
/** Small local flood search for an existing walkable exit; openable doors count as passages. */
export function hasOutdoorExit(start:Point,w:World):boolean {
  const openWorld={...w,furniture:w.furniture.map(f=>f.kind==='door'?{...f,open:true}:f)}
  const queue:Point[]=[start],seen=new Set<string>(),step=0.55
  for(let i=0;i<queue.length&&i<4000;i++){
    const p=queue[i]
    if(height(p.x,p.z,w)<p.y+0.5&&clear(p,openWorld))return true
    for(const [dx,dz] of [[step,0],[-step,0],[0,step],[0,-step]]){
      const q={x:p.x+dx,y:p.y,z:p.z+dz}
      if(Math.hypot(q.x-start.x,q.z-start.z)>24)continue
      let found=false
      for(const dy of [0,0.3,-0.3]){q.y=p.y+dy;if(clear(q,openWorld)){found=true;break}}
      if(!found)continue
      const key=`${Math.round((q.x-start.x)/step)}:${Math.round((q.y-start.y)/0.3)}:${Math.round((q.z-start.z)/step)}`
      if(!seen.has(key)){seen.add(key);queue.push({...q})}
    }
  }
  return false
}
export function surfaceAt(x:number,z:number,w:Pick<World,'seed'|'edits'>&Partial<Pick<World,'generator'>>,from=height(x,z,w)+1) {
  const bridge=isAtlas(w)?bridgeAt(x,z):undefined,deck=bridge&&bridgeDeck(bridge)
  // A bridge supports actors above its deck while preserving the river beneath it.
  if(deck!==undefined&&from>=deck)return Math.max(deck,height(x,z,w))
  const nearby=w.edits.some(e=>Math.abs(e.center.x-x)<Math.hypot(e.size.x,e.size.z)+1&&Math.abs(e.center.z-z)<Math.hypot(e.size.x,e.size.z)+1)
  if(!nearby&&!(w as World).life?.interior)return height(x,z,w)
  for(let y=from;y>fallFloor(w)-5;y-=0.2)if(density(x,y,z,w,w.edits)>0){
    let low=y,high=y+.2
    for(let i=0;i<7;i++){const mid=(low+high)/2;if(density(x,mid,z,w,w.edits)>0)low=mid;else high=mid}
    return high
  }
  return height(x,z,w)
}
export function rayTerrain(origin:Point,direction:Point,w:Pick<World,'seed'|'edits'>&Partial<Pick<World,'generator'>>,max=10) {
  for(let t=0.15;t<max;t+=0.08) {const p={x:origin.x+direction.x*t,y:origin.y+direction.y*t,z:origin.z+direction.z*t};if(solid(p,w))return {...p,distance:t}}
  return null
}

export interface TerrainMesh { positions: Float32Array; normals:Float32Array; colors:Float32Array }
const CORNERS=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]]
const TETS=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]]
/** Same field is used for character collision and both sides of chunk seams. */
export function meshChunk(cx:number,cz:number,seed:TerrainContext,allEdits:Excavation[],step=1):TerrainMesh {
  const size=16,x0=cx*size,z0=cz*size
  const edits=allEdits.filter(e=>{const r=Math.hypot(e.size.x,e.size.z)+2;return e.center.x+r>=x0&&e.center.x-r<=x0+size&&e.center.z+r>=z0&&e.center.z-r<=z0+size})
  const pos:number[]=[],norm:number[]=[],col:number[]=[]
  const paint=(x:number,y:number,z:number)=>{const grass=y>height(x,z,seed)-0.38;const v=0.95+0.05*Math.sin(x*1.8+z*1.2);if(isAtlas(seed)&&grass){const c=landcover(x,z),rgb=c===10?[0.319,0.305,0.147]:c===3?[0.084,0.133,0.053]:c===4||c===5?[0.159,0.223,0.093]:c===8?[0.361,0.352,0.171]:[0.242,0.314,0.091];return rgb.map(n=>n*(0.96+0.04*Math.sin(x/57)*Math.cos(z/69)))}return grass?[0.30*v,0.43*v,0.17*v]:[0.40*v,0.29*v,0.17*v]}
  const tri=(a:number[],b:number[],c:number[],out?:number[])=>{
    let ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2]
    let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx
    if(out&&nx*out[0]+ny*out[1]+nz*out[2]<0){[b,c]=[c,b];nx=-nx;ny=-ny;nz=-nz}
    const len=Math.hypot(nx,ny,nz)||1
    for(const v of [a,b,c]){pos.push(...v);norm.push(nx/len,ny/len,nz/len);col.push(...paint(v[0],v[1],v[2]))}
  }
  if(!edits.length) {
    for(let x=x0;x<x0+size;x+=2)for(let z=z0;z<z0+size;z+=2){const a=[x,height(x,z,seed),z],b=[x+2,height(x+2,z,seed),z],c=[x+2,height(x+2,z+2,seed),z+2],d=[x,height(x,z+2,seed),z+2];tri(a,c,b);tri(a,d,c)}
  } else {
    let maxY=-100,minY=100
    for(let x=x0;x<=x0+size;x+=4)for(let z=z0;z<=z0+size;z+=4){maxY=Math.max(maxY,height(x,z,seed));minY=Math.min(minY,height(x,z,seed))}
    minY=Math.floor(Math.min(minY,...edits.map(e=>e.center.y-e.size.y-Math.abs(e.slope||0)*e.size.z/2))-2);maxY=Math.ceil(Math.max(maxY,...edits.map(e=>e.center.y+e.size.y+Math.abs(e.slope||0)*e.size.z/2))+2)
    const n=Math.round(size/step),ny=Math.round((maxY-minY)/step),grid=new Float32Array((n+1)*(n+1)*(ny+1)),at=(x:number,y:number,z:number)=>(y*(n+1)+z)*(n+1)+x
    for(let y=0;y<=ny;y++)for(let z=0;z<=n;z++)for(let x=0;x<=n;x++)grid[at(x,y,z)]=density(x0+x*step,minY+y*step,z0+z*step,seed,edits)
    for(let yi=0;yi<ny;yi++)for(let zi=0;zi<n;zi++)for(let xi=0;xi<n;xi++) {
      const values=CORNERS.map(([x,y,z])=>grid[at(xi+x,yi+y,zi+z)])
      if(values.every(v=>v>=0)||values.every(v=>v<0))continue
      const pts=CORNERS.map(([x,y,z])=>[x0+(xi+x)*step,minY+(yi+y)*step,z0+(zi+z)*step])
      for(const tet of TETS) {
        const inside=tet.filter(i=>values[i]>=0),outside=tet.filter(i=>values[i]<0)
        if(!inside.length||!outside.length)continue
        const interp=(a:number,b:number)=>{const t=values[a]/(values[a]-values[b]);return pts[a].map((v,k)=>v+(pts[b][k]-v)*t)}
        const out=pts[outside[0]].map((v,k)=>v-pts[inside[0]][k])
        if(inside.length===1){const a=inside[0];tri(interp(a,outside[0]),interp(a,outside[1]),interp(a,outside[2]),out)}
        else if(outside.length===1){const a=outside[0];tri(interp(a,inside[0]),interp(a,inside[1]),interp(a,inside[2]),out)}
        else {const [a,b]=inside,[c,d]=outside,p=interp(a,c),q=interp(a,d),r=interp(b,c),s=interp(b,d);tri(p,q,r,out);tri(q,s,r,out)}
      }
    }
  }
  return {positions:new Float32Array(pos),normals:new Float32Array(norm),colors:new Float32Array(col)}
}
