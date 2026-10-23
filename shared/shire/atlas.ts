import type { Point, World, Settlement } from './model'
import { SETTLEMENTS } from './model'
import { ATLAS_PLACES, ATLAS_RIVERS, ATLAS_ROADS, HEIGHT_BASE64, COVER_BASE64 } from './atlasData'
export { ATLAS_PLACES, ATLAS_RIVERS, ATLAS_ROADS, ATLAS_SOURCE_SHA256 } from './atlasData'

export const ATLAS_GENERATOR = 'shire-atlas-1' as const
export type TerrainContext = number | {seed:number;generator?:World['generator']}
export const isAtlas = (w:TerrainContext) => typeof w !== 'number' && w.generator === ATLAS_GENERATOR
export type AtlasTown = Settlement & {id:string;kind:string;style:'smial'|'farm'|'market'|'bree'|'woodland';radius:number}
const farmNames = ['stock','rushey','deephallow','willowbottom','bamfurlong','longbottom']
export const ATLAS_TOWNS:AtlasTown[] = ATLAS_PLACES.filter(p=>['village','town','hall','farm','house'].includes(p.kind)).map(p=>({
  ...p, x:p.x+(p.id==='haysend'?140:0), homes:p.kind==='town'?32:p.kind==='house'?1:p.kind==='farm'?4:p.kind==='hall'?8:18,
  style: ['bree','staddle','combe','archet'].includes(p.id)?'bree':farmNames.includes(p.id)?'farm':p.id==='michel-delving'?'market':p.id==='tom-bombadil'?'woodland':'smial', radius:p.kind==='town'?200:145,
}))
export const ATLAS_DESTINATIONS:AtlasTown[]=[...ATLAS_TOWNS,...ATLAS_PLACES.filter(p=>['brandywine-bridge','bucklebury-ferry','hay-gate','old-man-willow','barrow-encounter','scary-quarry'].includes(p.id)).map(p=>({...p,style:'woodland' as const,homes:0,radius:50}))]
export function settlements(w:TerrainContext):Settlement[]{return isAtlas(w)?ATLAS_DESTINATIONS:SETTLEMENTS}
export function inBounds(x:number,z:number,w:TerrainContext){return isAtlas(w)?x>=-145000&&x<=165000&&z>=-115000&&z<=155000:Math.abs(x)<=2000&&Math.abs(z)<=2000}
export function fallFloor(w:TerrainContext){return isAtlas(w)?-120:-35}
export function nearestTown(x:number,z:number){return ATLAS_TOWNS.reduce((a,b)=>Math.hypot(x-a.x,z-a.z)<Math.hypot(x-b.x,z-b.z)?a:b)}
export function nearestDestination(x:number,z:number){return ATLAS_DESTINATIONS.reduce((a,b)=>Math.hypot(x-a.x,z-a.z)<Math.hypot(x-b.x,z-b.z)?a:b)}
export function regionAt(x:number,z:number){const s=nearestDestination(x,z);if(Math.hypot(x-s.x,z-s.z)<900)return s.name;const c=landcover(x,z);return c===3?'The Old Forest':c===10?'The Barrow-downs':c===5?'The Marish':x>127000?'Bree-land':x>77500&&x<85000&&z>7000&&z<38000?'Buckland':c===2?'Woodland':c===6?'Green Hill Country':'The Shire countryside'}

let elevations:DataView|undefined,cover:Uint8Array|undefined
function bytes(b64:string){const s=atob(b64),out=new Uint8Array(s.length);for(let i=0;i<s.length;i++)out[i]=s.charCodeAt(i);return out}
function cell(x:number,z:number){return {u:Math.max(0,Math.min(1239.99999,(x+145000)/250)),v:Math.max(0,Math.min(1079.99999,(z+115000)/250))}}
export function regionalHeight(x:number,z:number){
  elevations??=new DataView(bytes(HEIGHT_BASE64).buffer);const {u,v}=cell(x,z),ix=Math.floor(u),iz=Math.floor(v),tx=u-ix,tz=v-iz
  const h=(a:number,b:number)=>elevations!.getUint16((b*1241+a)*2,true)/64-64
  return (h(ix,iz)*(1-tx)+h(ix+1,iz)*tx)*(1-tz)+(h(ix,iz+1)*(1-tx)+h(ix+1,iz+1)*tx)*tz
}
const barrowBoundary=[[112000,13000],[125000,8000],[136000,13000],[138000,43000],[127000,59000],[112000,49000],[105000,39000],[115000,28000]]
function inPolygon(x:number,z:number,points:number[][]){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
export function landcover(x:number,z:number){if(x>105000&&x<138000&&z>8000&&z<59000&&inPolygon(x,z,barrowBoundary))return 10;cover??=bytes(COVER_BASE64);const {u,v}=cell(x,z);return cover[Math.round(v)*1241+Math.round(u)]}
export type RiverSegment = {a:number[];b:number[];width:number;depth:number;id:string}
const riverIndex=new Map<string,RiverSegment[]>(),roadIndex=new Map<string,{a:number[];b:number[];id:string}[]>()
function indexSegment<T extends {a:number[];b:number[]}>(map:Map<string,T[]>,s:T,pad:number){
  for(let x=Math.floor((Math.min(s.a[0],s.b[0])-pad)/1000);x<=Math.floor((Math.max(s.a[0],s.b[0])+pad)/1000);x++)for(let z=Math.floor((Math.min(s.a[1],s.b[1])-pad)/1000);z<=Math.floor((Math.max(s.a[1],s.b[1])+pad)/1000);z++){const key=`${x}:${z}`,list=map.get(key)||[];list.push(s);map.set(key,list)}
}
for(const r of ATLAS_RIVERS)for(let i=1;i<r.points.length;i++)indexSegment(riverIndex,{a:r.points[i-1],b:r.points[i],width:r.width,depth:r.depth,id:r.id},800)
for(const r of ATLAS_ROADS)for(let i=1;i<r.points.length;i++)indexSegment(roadIndex,{a:r.points[i-1],b:r.points[i],id:r.id},20)
export function projection(x:number,z:number,a:number[],b:number[]){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return {t,d:Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)}}
export function riversAt(x:number,z:number){const channels=new Map<string,{distance:number;stage:number;width:number;depth:number;id:string}>()
  for(const s of riverIndex.get(`${Math.floor(x/1000)}:${Math.floor(z/1000)}`)||[]){const {d,t}=projection(x,z,s.a,s.b),previous=channels.get(s.id);if(!previous||d<previous.distance)channels.set(s.id,{distance:d,stage:s.a[2]+(s.b[2]-s.a[2])*t,width:s.width,depth:s.depth,id:s.id})}
  return [...channels.values()]
}
export function riverAt(x:number,z:number){return riversAt(x,z).sort((a,b)=>(a.distance-a.width/2)-(b.distance-b.width/2))[0]}
export function roadDistance(x:number,z:number){let d=Infinity;for(const s of roadIndex.get(`${Math.floor(x/1000)}:${Math.floor(z/1000)}`)||[])d=Math.min(d,projection(x,z,s.a,s.b).d);return d}
export function nearbyRiverSegments(x:number,z:number,radius:number){const unique=new Set<RiverSegment>();for(let i=Math.floor((x-radius)/1000);i<=Math.floor((x+radius)/1000);i++)for(let j=Math.floor((z-radius)/1000);j<=Math.floor((z+radius)/1000);j++)for(const s of riverIndex.get(`${i}:${j}`)||[])unique.add(s);return [...unique]}
const pool={x:6500,z:2600,rx:650,rz:240,stage:90.5}
export function waterAt(x:number,z:number,w:TerrainContext){if(!isAtlas(w))return 2.5;const channels=riversAt(x,z).filter(r=>r.distance<r.width/2);if(channels.length)return Math.max(...channels.map(r=>r.stage));if(Math.hypot((x-pool.x)/pool.rx,(z-pool.z)/pool.rz)<1)return pool.stage;return -Infinity}
export const BYWATER_POOL=pool
export type AtlasBridge={id:string;x:number;z:number;length:number;width:number;turn:boolean;wooden?:boolean}
const tomCrossing=Array.from({length:141},(_,i)=>({z:32000+i,r:riverAt(109000,32000+i)})).filter(p=>p.r?.id==='withywindle').sort((a,b)=>a.r!.distance-b.r!.distance)[0]
export const ATLAS_BRIDGES:AtlasBridge[]=[{id:'hobbiton',x:0,z:0,length:30,width:3.4,turn:true},{id:'brandywine-bridge',x:70400,z:3700,length:110,width:6,turn:false},...(tomCrossing?[{id:'tom-footbridge',x:109000,z:tomCrossing.z,length:28,width:2.8,turn:true,wooden:true}]:[])]
export function bridgeAt(x:number,z:number,pad=0){return ATLAS_BRIDGES.find(b=>Math.abs(b.turn?z-b.z:x-b.x)<=b.length/2+pad&&Math.abs(b.turn?x-b.x:z-b.z)<=b.width/2)}
export function bridgeDeck(b:AtlasBridge){return riverAt(b.x,b.z)!.stage+1.3}
export const HIGH_HAY=[[72000,4400],[75900,5500],[80000,8200],[83400,11300],[83900,12900],[83300,17900],[83400,24500],[83300,30800],[83500,37700]]
const smooth=(n:number)=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t)}
const localTownIndex=new Map<string,AtlasTown[]>()
function localTowns(x:number,z:number){const key=`${Math.floor(x/1000)}:${Math.floor(z/1000)}`;let list=localTownIndex.get(key);if(!list){const cx=Math.floor(x/1000)*1000+500,cz=Math.floor(z/1000)*1000+500;list=ATLAS_TOWNS.filter(s=>Math.hypot(cx-s.x,cz-s.z)<1200);localTownIndex.set(key,list)}return list}
function conditionedRegional(x:number,z:number){const y=regionalHeight(x,z),r=riverAt(x,z);if(!r||r.distance>700)return y;const raised=Math.max(y,r.stage+2+Math.min(r.distance,150)*0.01);return y+(raised-y)*(1-smooth((r.distance-300)/400))}
export function atlasHeight(x:number,z:number){
  let y=conditionedRegional(x,z),local=0
  for(const town of localTowns(x,z)){const d=Math.hypot(x-town.x,z-town.z),weight=1-smooth((d-180)/220);if(weight>local){local=weight;const center=conditionedRegional(town.x,town.z);y=y*(1-local)+(center+0.8*Math.sin((x-town.x)/75)*Math.cos((z-town.z)/85))*local}}
  // Authored local relief is deliberately blended into the atlas; no surveyed local elevations exist.
  if(Math.abs(x)<500&&Math.abs(z)<500)y+=14*Math.exp(-((x+55)**2/4600+(z+95)**2/4000))
  if(Math.abs(x-135000)<700&&Math.abs(z+5000)<700)y+=32*Math.exp(-((x-135200)**2/60000+(z+5150)**2/65000))
  y+=0.28*Math.sin(x/21)*Math.cos(z/29)*(1-local)
  // Combine channel cuts at confluences. Switching only to the closest centreline
  // leaves an artificial wall where a narrow tributary meets a wide river.
  const uncarved=y
  for(const river of riversAt(x,z)){const half=river.width/2,blend=1-smooth((river.distance-half)/Math.max(12,half));if(blend>0){const bed=river.stage-river.depth*(1-smooth(river.distance/half));y=Math.min(y,uncarved*(1-blend)+(bed+0.35*smooth((river.distance-half)/half))*blend)}}
  const pd=Math.hypot((x-pool.x)/pool.rx,(z-pool.z)/pool.rz);if(pd<2.5)y+=(Math.max(y,pool.stage+1.5)-y)*(1-smooth((pd-1.2)/1.3));if(pd<1.15){const mix=1-smooth((pd-0.9)/0.25);y=y*(1-mix)+(pool.stage-2.2*(1-smooth(pd)))*mix}
  for(const b of ATLAS_BRIDGES){const along=Math.abs(b.turn?z-b.z:x-b.x)-b.length/2,across=Math.abs(b.turn?x-b.x:z-b.z);if(along<0&&across<b.width/2+.4)y=Math.min(y,bridgeDeck(b)-.4*smooth(-along/1.5));if(along>=0&&along<24&&across<b.width/2+4){const blend=(1-smooth(along/24))*(1-smooth((across-b.width/2)/4));y=y*(1-blend)+bridgeDeck(b)*blend}}
  return y
}

export type BuildingKind='smial'|'cottage'|'inn'|'barn'|'mill'|'hall'|'market'|'smithy'
export type TownPlot={id:string;x:number;z:number;yaw:number;kind:BuildingKind;label?:string;scale:number}
const plotCache=new Map<string,TownPlot[]>()
export function townPlots(s:AtlasTown):TownPlot[]{if(!s.homes)return [];const cached=plotCache.get(s.id);if(cached)return cached;const plots:TownPlot[]=[]
  const originZ=s.id==='hobbiton'?-45:0
  for(let i=0;i<s.homes;i++){
    const row=Math.floor(i/8),column=i%8,dx=(column-3.5)*24+(row%2)*8,dz=(row%2===0?-1:1)*(21+Math.floor(row/2)*38)+originZ
    const kind:BuildingKind=s.style==='bree'?'cottage':s.style==='farm'?(i%4===0?'barn':'cottage'):s.style==='woodland'?'cottage':i%4===0?'cottage':'smial'
    plots.push({id:`${s.id}-${i}`,x:s.x+dx+(s.style==='bree'?Math.sin(i*3.7)*3:Math.sin(i*2.1)*1.5),z:s.z+dz+(s.style==='bree'?Math.cos(i*1.9)*3:0),yaw:dz-originZ<0?0:Math.PI,kind,scale:s.style==='bree'?1.2:1})
  }
  const add=(id:string,dx:number,dz:number,kind:BuildingKind,label:string,scale=1,yaw=0)=>plots.push({id,x:s.x+dx,z:s.z+dz,yaw,kind,label,scale})
  if(s.id==='hobbiton'){for(const p of plots)if(p.z>s.z-45)p.yaw=0;add('bag-end',-55,-87,'smial','Bag End',1.5);add('old-mill',35,-9,'mill','The Old Mill',1.05,Math.PI);add('ivy-bush',-85,-20,'inn','The Ivy Bush',0.8,Math.PI)}
  else if(s.id==='bywater')add('green-dragon',0,-23,'inn','The Green Dragon',1.15)
  else if(s.id==='tuckborough')add('great-smials',0,-110,'hall','The Great Smials',2)
  else if(s.id==='brandy-hall')add('brandy-hall-main',0,-90,'hall','Brandy Hall',1.8)
  else if(s.id==='bree')add('prancing-pony',0,-108,'inn','The Prancing Pony',1.8)
  else if(s.id==='michel-delving')add('town-house',0,-107,'hall','The Town Hole',1.8)
  else if(s.id==='tom-bombadil'){plots.length=0;add('tom-house',0,-18,'cottage',"Tom Bombadil’s House",1.15)}
  else if(s.id==='bamfurlong')add('maggot-house',0,-45,'cottage','Bamfurlong',1.4)
  if(s.homes>8){add(`${s.id}-smithy`,112,20,'smithy','',0.8,Math.PI);add(`${s.id}-barn`,-110,-70,'barn','',1.2)}
  // Resolve footprint overlaps and wet plots deterministically. Landmark positions take priority.
  const ordered=[...plots.filter(p=>p.label),...plots.filter(p=>!p.label)],accepted:TownPlot[]=[]
  for(const p of ordered){if(!p.label&&(Math.abs(p.x-s.x)<9||accepted.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<p.scale*8+q.scale*(q.kind==='hall'?13:8))))continue;const r=riverAt(p.x,p.z);if(!p.label&&r&&r.distance<r.width/2+12)continue;accepted.push(p)}
  plotCache.set(s.id,accepted);return accepted
}
export function publicGround(x:number,z:number,w:TerrainContext){return isAtlas(w)?ATLAS_TOWNS.some(s=>Math.hypot(x-s.x,z-s.z)<s.radius):SETTLEMENTS.some(s=>Math.hypot(x-s.x,z-s.z)<28)}
export function buildingBlocked(p:Point,w:TerrainContext){if(!isAtlas(w))return false;const s=nearestTown(p.x,p.z);if(Math.hypot(p.x-s.x,p.z-s.z)>230)return false
  return townPlots(s).some(b=>{const dx=p.x-b.x,dz=p.z-b.z,c=Math.cos(b.yaw),sn=Math.sin(b.yaw),x=dx*c-dz*sn,z=dx*sn+dz*c;return Math.abs(x)<(b.kind==='hall'?12.6:4.8)*b.scale+0.26&&z>-6.8*b.scale-0.26&&z<1.1*b.scale+0.26&&p.y<atlasHeight(b.x,b.z)+7*b.scale&&p.y+1.55>atlasHeight(b.x,b.z)})
}
export function bridgeBlocked(p:Point,w:TerrainContext){if(!isAtlas(w))return false;for(const site of ATLAS_BRIDGES){const dx=p.x-site.x,dz=p.z-site.z,along=site.turn?dz:dx,across=site.turn?dx:dz;if(Math.abs(along)>site.length/2+0.26||Math.abs(across)>site.width/2+0.26)continue;const deck=bridgeDeck(site);if(p.y<deck&&p.y+1.55>deck-0.4)return true;if(Math.abs(across)>site.width/2-0.6&&p.y<deck+0.85&&p.y+1.55>deck)return true}return false}
export function arrival(s:Settlement,w:TerrainContext){if(isAtlas(w)&&s.name==='Hay Gate')return {x:83900,y:0,z:12894,yaw:Math.PI,pitch:0};return isAtlas(w)?{x:s.x,y:0,z:s.z+(s.name==='Hobbiton'?-45:105),yaw:0,pitch:0}:{x:s.x-32,y:0,z:s.z,yaw:-Math.PI/2,pitch:0}}
