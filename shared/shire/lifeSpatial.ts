import { World, Point, id, Species, SPECIES } from './model'
import { height, clear } from './terrain'
import { isAtlas, inBounds, publicGround, waterAt, riverAt, ATLAS_PLACES, ATLAS_TOWNS, nearbyRiverSegments, projection } from './atlas'
import { sceneryHash } from './atlasScenery'
import { pathClearance, pathsNear } from './atlasPaths'
import type { ResourceNode, ItemId, LifePlace } from './lifeTypes'

const resources: ItemId[]=['wood','stone','clay','herb','berry','mushroom','flax','apple','iron']
export function resourceNodes(w:World,center:Point=w.player,radius=65):ResourceNode[]{
  if(w.life?.interior)return []
  if(isAtlas(w))pathsNear(center.x,center.z,radius)
  const nodes:ResourceNode[]=[],cell=20
  for(let ix=Math.floor((center.x-radius)/cell);ix<=Math.floor((center.x+radius)/cell);ix++)for(let iz=Math.floor((center.z-radius)/cell);iz<=Math.floor((center.z+radius)/cell);iz++){
    const h=sceneryHash(ix,iz,w.seed),x=ix*cell+4+h*12,z=iz*cell+4+sceneryHash(ix+13,iz-9,w.seed)*12
    if(Math.hypot(x-center.x,z-center.z)>radius||!inBounds(x,z,w)||(isAtlas(w)&&pathClearance(x,z)<1.8))continue
    const position={x,y:height(x,z,w)+.08,z}
    if(position.y<waterAt(x,z,w)+.5||!clear(position,w))continue
    const kind=resources[Math.floor(h*resources.length)%resources.length],key=`resource:${ix}:${iz}`
    if(w.life?.resourcesRemoved.includes(key))continue
    const renew=kind==='iron'?1200:kind==='wood'||kind==='stone'?600:300,last=w.life?.harvested[key]
    if(last!==undefined&&w.time-last<renew)continue
    nodes.push({id:key,kind,label:kind==='wood'?'Fallen timber':kind==='iron'?'Iron outcrop':kind==='apple'?'Wild apple tree':`${kind[0].toUpperCase()+kind.slice(1)} patch`,position,amount:kind==='wood'||kind==='stone'?4:3,renew,tree:kind==='apple'})
  }
  return nodes
}
export function requireOwnedLand(w:World,p:Point){
  if(w.life?.interior)throw Error('Use the furnished village rooms as a guest. Build at your own home outdoors.')
  if(publicGround(p.x,p.z,w))throw Error('Public homes, gardens and lanes are protected. Choose your own land.')
  if(w.life&&w.life.style!=='creative'&&(!w.home||Math.hypot(p.x-w.home.x,p.z-w.home.z)>85))throw Error('Build and plant within 85 metres of your home marker. Mark a free hillside as home first.')
}
export function suggestedHome(w:World):Point {
  const p=isAtlas(w)?{x:-230,z:-200}:{x:-85,z:-50}
  for(let n=0;n<30;n++){const x=p.x-n*3,z=p.z-n*2,point={x,y:height(x,z,w)+.08,z};if(!publicGround(x,z,w)&&clear(point,w)&&point.y>waterAt(x,z,w)+2)return point}
  return {...p,y:height(p.x,p.z,w)+.08}
}
export function storyPlaces(w:World):LifePlace[]{
  if(!isAtlas(w))return []
  const p=ATLAS_PLACES.find(p=>p.id==='barrow-encounter')!
  const x=p.x,z=p.z+18,y=height(x,z,w)
  return [{id:'story:barrow',label:'The chamber of three seasons',kind:'barrow',town:'barrow-downs',position:{x,y,z},door:{x,y,z:z+5},yaw:0,width:12,depth:18,public:true}]
}
export function ferryCrossing(w:World){
  const p=ATLAS_PLACES.find(p=>p.id==='bucklebury-ferry')!
  if(!isAtlas(w))return undefined
  const segment=nearbyRiverSegments(p.x,p.z,500).filter(r=>r.id==='brandywine').sort((a,b)=>projection(p.x,p.z,a.a,a.b).d-projection(p.x,p.z,b.a,b.b).d)[0]
  if(!segment)return undefined
  const q=projection(p.x,p.z,segment.a,segment.b),x=segment.a[0]+(segment.b[0]-segment.a[0])*q.t,z=segment.a[1]+(segment.b[1]-segment.a[1])*q.t
  const dx=segment.b[0]-segment.a[0],dz=segment.b[1]-segment.a[1],len=Math.hypot(dx,dz),r=segment.width/2+4
  return [-1,1].map(sign=>{const px=x+sign*dz/len*r,pz=z-sign*dx/len*r;return{x:px,y:height(px,pz,w)+.08,z:pz}})
}
/** Populate on first visit, retaining individuals and families in the saved world. */
export function populateRegion(w:World){
  const l=w.life;if(!l||!isAtlas(w)||l.interior||w.animals.length>1100)return
  const town=isAtlas(w)?ATLAS_TOWNS.find(t=>Math.hypot(w.player.x-t.x,w.player.z-t.z)<650):undefined
  const region=town?.id||`country:${Math.floor(w.player.x/2000)}:${Math.floor(w.player.z/2000)}`
  if(l.regions[region]){l.regions[region].lastVisit=w.time;return}
  l.regions[region]={populated:true,lastVisit:w.time}
  // The original starting herd remains itself; additional birds and river life fill its missing habitats.
  const kinds:Species[]=region==='hobbiton'?['fish','frog']:town?['sheep','chicken','rabbit','cattle','pig','horse','bird','fish','frog']:['rabbit','bird','frog']
  if(l.style==='creative'&&town?.id==='bree')kinds.push('llama')
  for(const [i,species] of kinds.entries())for(let k=0;k<2;k++){
    const spec=SPECIES[species],origin=town||w.player;let point:Point|undefined
    for(let n=0;n<36;n++){
      const a=(i*2+k)*2.399+n*.23,r=town?90+n*4:35+n*3,x=origin.x+Math.cos(a)*r,z=origin.z+Math.sin(a)*r
      if(!inBounds(x,z,w))continue
      const ground=height(x,z,w),water=waterAt(x,z,w),nearRiver=riverAt(x,z)
      if(spec.habitat==='water'){
        const segments=nearbyRiverSegments(origin.x,origin.z,800);if(!segments.length)break
        const s=segments[n%segments.length],t=.2+.6*((i+k+n)%9)/9,px=s.a[0]+(s.b[0]-s.a[0])*t,pz=s.a[1]+(s.b[1]-s.a[1])*t,wy=waterAt(px,pz,w)
        if(Math.hypot(px-w.player.x,pz-w.player.z)>900||!Number.isFinite(wy)||height(px,pz,w)>wy-.6)continue
        point={x:px,y:wy-.5,z:pz};break
      }
      if(ground<water+.2||!clear({x,y:ground+.1,z},w)||spec.habitat==='bank'&&(!nearRiver||nearRiver.distance>nearRiver.width/2+14))continue
      point={x,y:ground+(spec.habitat==='air'?3:.02),z};break
    }
    if(!point)continue
    const aid=id();w.animals.push({id:aid,name:`${town?.name||'Wild'} ${spec.label.toLowerCase()} ${k+1}`,species,sex:k?'male':'female',age:spec.maturity+1,home:{...point},position:{...point},fedUntil:w.time+180,cooldownUntil:0,mood:'grazing',tint:sceneryHash(i,k,w.seed)})
    l.animals[aid]={owner:false,following:false,affinity:0,lastProduct:w.time,region}
  }
}
