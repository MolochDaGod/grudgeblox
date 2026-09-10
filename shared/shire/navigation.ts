import type { World, Point } from './model'
import { clear, height, surfaceAt } from './terrain'
import { waterAt, isAtlas, ATLAS_TOWNS, ATLAS_BRIDGES, projection, bridgeAt, bridgeDeck } from './atlas'
import { townPaths } from './atlasPaths'

interface Route { goal:Point; points:Point[]; stamp:string; checked:number; last:Point; progressed:number }
const cache=new Map<string,Route>()
const flat=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z)
function ground(w:World,x:number,z:number):Point {if(w.life?.interior)return {x,y:w.life.interior.origin.y+.08,z};const bridge=isAtlas(w)?bridgeAt(x,z):undefined;return {x,y:surfaceAt(x,z,w,Math.max(height(x,z,w)+1,bridge?bridgeDeck(bridge)+1:-Infinity))+.08,z}}
function free(w:World,p:Point){return p.y>waterAt(p.x,p.z,w)+.1&&clear(p,w)}
function line(w:World,a:Point,b:Point){const n=Math.ceil(flat(a,b)/.65);let last=a;for(let i=1;i<=n;i++){const p=ground(w,a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n);if(Math.abs(p.y-last.y)>.8||!free(w,p))return false;last=p}return true}
/** Follow the existing door/lane network for longer village trips. */
function villagePath(w:World,start:Point,end:Point):Point[]|undefined{
  if(!isAtlas(w))return
  const town=ATLAS_TOWNS.find(t=>Math.hypot(start.x-t.x,start.z-t.z)<400&&Math.hypot(end.x-t.x,end.z-t.z)<400);if(!town)return
  const graph=new Map<string,{p:Point;links:Set<string>}>(),key=(p:number[])=>`${p[0].toFixed(1)}:${p[1].toFixed(1)}`
  const paths=townPaths(town)
  for(const path of paths)for(let i=0;i<path.points.length;i++){const p=path.points[i],k=key(p);if(!graph.has(k))graph.set(k,{p:ground(w,p[0],p[1]),links:new Set()});if(i){const prev=key(path.points[i-1]);graph.get(k)!.links.add(prev);graph.get(prev)!.links.add(k)}}
  // Door paths can join the middle of a lane. Connect coincident or very near nodes.
  const nodes=[...graph];for(const [a,va]of nodes)for(const [b,vb]of nodes)if(a!==b&&flat(va.p,vb.p)<4){va.links.add(b);vb.links.add(a)}
  for(const path of paths)for(let i=1;i<path.points.length;i++)for(const [k,v]of nodes){const a=path.points[i-1],b=path.points[i],q=projection(v.p.x,v.p.z,a,b);if(q.d<.2&&q.t>.001&&q.t<.999){v.links.add(key(a));v.links.add(key(b));graph.get(key(a))!.links.add(k);graph.get(key(b))!.links.add(k)}}
  // A home can sit beyond the final lane. Attach clear approaches to the same network
  // so a long following journey can choose a bridge before reaching the riverbank.
  const nearest=(p:Point)=>nodes.filter(([,v])=>flat(p,v.p)<400).sort((a,b)=>flat(a[1].p,p)-flat(b[1].p,p)).slice(0,16).find(([,v])=>line(w,p,v.p))?.[0]
  const first=nearest(start),last=nearest(end);if(!first||!last)return
  const open=[first],cost=new Map([[first,0]]),came=new Map<string,string>(),done=new Set<string>()
  while(open.length){open.sort((a,b)=>cost.get(a)!-cost.get(b)!);const k=open.shift()!;if(k===last){const route=[end];for(let next=k;next!==first;next=came.get(next)!)route.push(graph.get(next)!.p);route.push(graph.get(first)!.p);return route.reverse()}if(done.has(k))continue;done.add(k);const current=graph.get(k)!;for(const next of current.links){const c=cost.get(k)!+flat(current.p,graph.get(next)!.p);if(c>=(cost.get(next)??Infinity))continue;cost.set(next,c);came.set(next,k);open.push(next)}}
}
function localPath(w:World,start:Point,end:Point):Point[]{
  if(line(w,start,end))return [end]
  const step=1.5,bound=24,size=49,point=(k:number)=>ground(w,start.x+(k%size-bound)*step,start.z+(Math.floor(k/size)-bound)*step)
  const key=(p:Point)=>Math.max(0,Math.min(48,Math.round((p.z-start.z)/step)+bound))*size+Math.max(0,Math.min(48,Math.round((p.x-start.x)/step)+bound))
  const first=bound*size+bound,last=key(end),open=[first],cost=new Map([[first,0]]),came=new Map<number,number>(),closed=new Set<number>(),points=new Map<number,Point>([[first,start]]),score=(k:number)=>cost.get(k)!+flat(points.get(k)!,end)
  while(open.length&&closed.size<1600){open.sort((a,b)=>score(a)-score(b));const k=open.shift()!;if(closed.has(k))continue;closed.add(k);const p=points.get(k)!
    if(k===last||flat(p,end)<2&&line(w,p,end)){const route=[end];for(let at=k;at!==first;at=came.get(at)!)route.push(points.get(at)!);return route.reverse()}
    for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const x=k%size+dx,z=Math.floor(k/size)+dz;if(x<0||x>=size||z<0||z>=size)continue;const nk=z*size+x;if(closed.has(nk))continue;const np=points.get(nk)||point(nk);points.set(nk,np);if(!free(w,np)||Math.abs(np.y-p.y)>.7||!line(w,p,np))continue;const c=cost.get(k)!+Math.hypot(dx,dz)*step;if(c>=(cost.get(nk)??Infinity))continue;cost.set(nk,c);came.set(nk,k);open.push(nk)}
  }
  return []
}
function bridgePath(w:World,start:Point,end:Point):Point[]|undefined{
  if(!isAtlas(w))return
  for(const bridge of ATLAS_BRIDGES){
    const along=(p:Point)=>bridge.turn?p.z-bridge.z:p.x-bridge.x
    if(flat(start,{x:bridge.x,y:0,z:bridge.z})>120||along(start)*along(end)>=0)continue
    const side=along(start)<0?-1:1,offset=bridge.length/2+8
    const landing=(sign:number)=>ground(w,bridge.x+(bridge.turn?0:sign*offset),bridge.z+(bridge.turn?sign*offset:0))
    const near=landing(side),far=landing(-side)
    if(!line(w,near,far))continue
    const approach=line(w,start,near)?[near]:flat(start,near)<32?localPath(w,start,near):[]
    if(approach.length)return [...approach,far,end]
  }
}
/** Bounded, cached path planning. Never crosses a blocked edge as a fallback. */
export function navigationTarget(w:World,id:string,start:Point,end:Point):Point|undefined{
  if(flat(start,end)<.7)return end
  const key=`${w.id}:${id}`,stamp=`${w.edits.length}:${w.edits.at(-1)?.id}:${w.furniture.map(f=>`${f.id}:${f.position.x}:${f.position.z}:${f.yaw}:${f.open}`).join('|')}:${w.life?.gates?.['hay-gate']}`
  let route=cache.get(key)
  if(!route||flat(route.goal,end)>3||route.stamp!==stamp||!route.points.length&&w.time-route.checked>6){
    let points=flat(start,end)>35?villagePath(w,start,end):undefined
    if(!points)points=bridgePath(w,start,end)
    if(!points){const length=flat(start,end),limit=Math.min(1,30/length),short={x:start.x+(end.x-start.x)*limit,y:end.y,z:start.z+(end.z-start.z)*limit};points=localPath(w,start,short)}
    route={goal:{...end},points,stamp,checked:w.time,last:{...start},progressed:w.time};cache.set(key,route);if(cache.size>3000)cache.delete(cache.keys().next().value!)
  }
  const hadPoints=route.points.length>0
  while(route.points.length&&flat(start,route.points[0])<.8)route.points.shift()
  if(hadPoints&&!route.points.length&&flat(start,end)>=.8){cache.delete(key);return navigationTarget(w,id,start,end)}
  if(flat(start,route.last)>.2){route.last={...start};route.progressed=w.time}
  else if(route.points.length&&w.time-route.progressed>2){const target=route.points[0];route.points=localPath(w,start,target);route.checked=w.time;route.progressed=w.time}
  return route.points[0]
}
