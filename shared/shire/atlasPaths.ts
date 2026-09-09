import { ATLAS_ROADS, ATLAS_TOWNS, AtlasTown, TownPlot, townPlots, projection, riverAt, bridgeAt, ATLAS_BRIDGES } from './atlas'

export type PathLine={id:string;points:number[][];width:number;kind:'road'|'lane'|'door';town?:string;entrance?:string}
type Segment={a:number[];b:number[];path:PathLine}
const index=new Map<string,Segment[]>(),localCache=new Map<string,PathLine[]>(),gates=new Map<string,number[][]>()
export const REGIONAL_PATHS:PathLine[]=[]
const zones=[...ATLAS_TOWNS.map(t=>({id:t.id,x:t.x,z:t.z,r:260})),{id:'brandywine-bridge',x:70400,z:3700,r:180}]
function add(path:PathLine){
  for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i],s={a,b,path},pad=36
    for(let x=Math.floor((Math.min(a[0],b[0])-pad)/500);x<=Math.floor((Math.max(a[0],b[0])+pad)/500);x++)for(let z=Math.floor((Math.min(a[1],b[1])-pad)/500);z<=Math.floor((Math.max(a[1],b[1])+pad)/500);z++){const key=`${x}:${z}`,list=index.get(key)||[];list.push(s);index.set(key,list)}
  }
}
// Preserve the atlas between towns. Its coarse polylines hand over at explicit
// gateways to the same local route network used by entrances and scenery.
for(const road of ATLAS_ROADS)for(let i=1;i<road.points.length;i++){
  const a=road.points[i-1],b=road.points[i],dx=b[0]-a[0],dz=b[1]-a[1],len2=dx*dx+dz*dz,ts=[0,1]
  if(!len2)continue
  for(const z of zones){const ax=a[0]-z.x,az=a[1]-z.z,B=2*(ax*dx+az*dz),C=ax*ax+az*az-z.r*z.r,disc=B*B-4*len2*C;if(disc<0)continue;for(const t of [(-B-Math.sqrt(disc))/(2*len2),(-B+Math.sqrt(disc))/(2*len2)])if(t>0&&t<1)ts.push(t)}
  ts.sort((a,b)=>a-b)
  for(let j=1;j<ts.length;j++){const lo=ts[j-1],hi=ts[j];if(hi-lo<1e-8)continue;const at=(t:number)=>[a[0]+dx*t,a[1]+dz*t],mid=at((lo+hi)/2),zone=zones.find(z=>Math.hypot(mid[0]-z.x,mid[1]-z.z)<z.r-0.01)
    if(zone){for(const t of [lo,hi]){const p=at(t);if(Math.abs(Math.hypot(p[0]-zone.x,p[1]-zone.z)-zone.r)<0.1){const list=gates.get(zone.id)||[];if(!list.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<0.2))list.push(p);gates.set(zone.id,list)}}}
    else {const path:PathLine={id:`${road.id}-${i}-${j}`,points:[at(lo),at(hi)],width:road.id==='east-road'?4.6:3.6,kind:'road'};REGIONAL_PATHS.push(path);add(path)}
  }
}
for(const b of ATLAS_BRIDGES.filter(b=>b.id==='brandywine-bridge')){
  const ends=[-1,1].map(sign=>[b.x+sign*(b.length/2+24),b.z])
  const bridge:PathLine={id:'stonebows-alignment',points:ends,width:4.6,kind:'road'};REGIONAL_PATHS.push(bridge);add(bridge)
  for(const [i,g]of(gates.get(b.id)||[]).entries()){const end=ends[g[0]<b.x?0:1],path:PathLine={id:`stonebows-approach-${i}`,points:[g,end],width:4.6,kind:'road'};REGIONAL_PATHS.push(path);add(path)}
}
export function plotContains(x:number,z:number,p:TownPlot,pad=0){const dx=x-p.x,dz=z-p.z,c=Math.cos(p.yaw),sn=Math.sin(p.yaw),lx=dx*c-dz*sn,lz=dx*sn+dz*c;return Math.abs(lx)<(p.kind==='hall'?14.6:p.kind==='smial'?5.8:5)*p.scale+pad&&lz>-(p.kind==='smial'||p.kind==='hall'?8.8:6.8)*p.scale-pad&&lz<1.1*p.scale+pad}
export function entrancePoint(p:TownPlot,distance=1.1*p.scale){return [p.x+Math.sin(p.yaw)*distance,p.z+Math.cos(p.yaw)*distance]}
class Heap{
  items:Array<{k:number;f:number}>=[]
  push(v:{k:number;f:number}){const a=this.items;a.push(v);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].f<=v.f)break;a[i]=a[p];i=p}a[i]=v}
  pop(){const a=this.items,first=a[0],last=a.pop()!;if(a.length){let i=0;while(i*2+1<a.length){let child=i*2+1;if(child+1<a.length&&a[child+1].f<a[child].f)child++;if(a[child].f>=last.f)break;a[i]=a[child];i=child}a[i]=last}return first}
}
function router(town:AtlasTown){const plots=townPlots(town),step=2,bound=170,size=bound*2+1,cache=new Map<string,boolean>()
  const free=(x:number,z:number,pad:number)=>{const key=`${x}:${z}:${pad}`;let ok=cache.get(key);if(ok!==undefined)return ok
    const r=riverAt(x,z),bridge=bridgeAt(x,z,25),onBridge=bridge&&Math.abs(bridge.turn?x-bridge.x:z-bridge.z)<bridge.width/2-pad
    ok=!plots.some(p=>plotContains(x,z,p,pad))&&(!r||r.width<5||town.id==='budgeford'||r.distance>r.width/2+0.6||!!onBridge);cache.set(key,ok);return ok}
  const line=(a:number[],b:number[],pad:number)=>{const n=Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/1.5));for(let i=0;i<=n;i++)if(!free(a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n,pad))return false;return true}
  return (start:number[],end:number[],width:number)=>{
    const pad=width/2+0.12
    if(line(start,end,pad))return [start,end]
    const ix=(x:number)=>Math.max(0,Math.min(size-1,Math.round((x-town.x)/step)+bound)),iz=(z:number)=>Math.max(0,Math.min(size-1,Math.round((z-town.z)/step)+bound))
    const point=(k:number)=>[town.x+(k%size-bound)*step,town.z+(Math.floor(k/size)-bound)*step],key=(p:number[])=>iz(p[1])*size+ix(p[0]),startKey=key(start),endKey=key(end),dist=new Map<number,number>([[startKey,0]]),came=new Map<number,number>(),closed=new Set<number>(),heap=new Heap()
    heap.push({k:startKey,f:0});let found=false
    while(heap.items.length&&closed.size<50000){const {k}=heap.pop();if(closed.has(k))continue;closed.add(k);if(k===endKey){found=true;break}const a=point(k)
      for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const x=k%size+dx,z=Math.floor(k/size)+dz;if(x<0||z<0||x>=size||z>=size)continue;const next=z*size+x;if(closed.has(next))continue;const b=point(next);if(!free(b[0],b[1],pad)||dx&&dz&&(!free(a[0],b[1],pad)||!free(b[0],a[1],pad)))continue;const cost=dist.get(k)!+Math.hypot(dx,dz);if(cost>=(dist.get(next)??Infinity))continue;dist.set(next,cost);came.set(next,k);heap.push({k:next,f:cost+Math.hypot(b[0]-end[0],b[1]-end[1])/step})}
    }
    if(!found)throw new Error(`No clear path in ${town.name}: ${start.join(',')} to ${end.join(',')}`)
    const raw:number[][]=[end];for(let k=endKey;k!==startKey;k=came.get(k)!)raw.push(point(k));raw.push(start);raw.reverse()
    const out=[start];for(let i=0;i<raw.length-1;){let j=raw.length-1;while(j>i+1&&!line(raw[i],raw[j],pad))j--;out.push(raw[j]);i=j}return out
  }
}
export function townPaths(town:AtlasTown){const cached=localCache.get(town.id);if(cached)return cached
  const centerRiver=riverAt(town.x,town.z),wetCenter=centerRiver&&centerRiver.distance<centerRiver.width/2
  const paths:PathLine[]=[],route=router(town),hub=[town.x,town.z+(town.id==='hobbiton'?-45:town.style==='woodland'||wetCenter?105:0)],laneWidth=town.style==='woodland'?1.8:town.id==='hobbiton'?2.6:3.4
  const push=(id:string,points:number[][],width:number,kind:PathLine['kind']='lane',entrance?:string)=>{const p={id,points,width,kind,town:town.id,entrance};paths.push(p);return p}
  if(town.style!=='woodland')for(const [i,p]of [[town.x-155,hub[1]],[town.x+155,hub[1]],[town.x,town.z-175],[town.x,town.z+175]].entries()){try{push(`${town.id}-lane-${i}`,route(hub,p,laneWidth),laneWidth)}catch{/* An optional street arm ends on this bank rather than crossing an unbridged wide river. */}}
  for(const [i,p]of (gates.get(town.id)||[]).entries())push(`${town.id}-gateway-${i}`,route(hub,p,laneWidth),laneWidth)
  for(const plot of townPlots(town)){
    const threshold=entrancePoint(plot),lead=entrancePoint(plot,1.1*plot.scale+4),candidates:Array<{point:number[];distance:number}>=[{point:hub,distance:Math.hypot(lead[0]-hub[0],lead[1]-hub[1])}]
    for(const p of paths.filter(p=>p.kind!=='door'))for(let i=1;i<p.points.length;i++){const a=p.points[i-1],b=p.points[i],q=projection(lead[0],lead[1],a,b);candidates.push({point:[a[0]+(b[0]-a[0])*q.t,a[1]+(b[1]-a[1])*q.t],distance:q.d})}
    candidates.sort((a,b)=>a.distance-b.distance);let connected:number[][]|undefined
    for(const candidate of candidates.slice(0,8)){try{connected=route(lead,candidate.point,1.6);break}catch{}}
    if(!connected)throw new Error(`Entrance has no route: ${plot.id}`)
    push(`${plot.id}-entrance`,[threshold,...connected],1.6,'door',plot.id)
  }
  localCache.set(town.id,paths);for(const p of paths)add(p);return paths
}
export function pathsNear(x:number,z:number,radius:number){for(const town of ATLAS_TOWNS)if(Math.hypot(x-town.x,z-town.z)<radius+400)townPaths(town)
  const found=new Set<PathLine>();for(let ix=Math.floor((x-radius)/500);ix<=Math.floor((x+radius)/500);ix++)for(let iz=Math.floor((z-radius)/500);iz<=Math.floor((z+radius)/500);iz++)for(const s of index.get(`${ix}:${iz}`)||[])if(projection(x,z,s.a,s.b).d<radius)found.add(s.path);return [...found]
}
export function pathClearance(x:number,z:number){let d=Infinity;for(const s of index.get(`${Math.floor(x/500)}:${Math.floor(z/500)}`)||[])d=Math.min(d,projection(x,z,s.a,s.b).d-s.path.width/2);return d}
