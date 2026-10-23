import { ATLAS_TOWNS, landcover, riverAt, BYWATER_POOL, townPlots } from './atlas'
import { pathClearance, plotContains } from './atlasPaths'

export type TreeKind='oak'|'beech'|'birch'|'willow'|'alder'|'hazel'
export type WoodlandPoint={x:number;z:number;kind:TreeKind;scale:number;yaw:number;tint:number;wooded:boolean;understory:number}
export const WOODLAND_CELL=8
export function sceneryHash(x:number,z:number,seed:number,salt=0){let n=(Math.imul(x,374761393)^Math.imul(z,668265263)^Math.imul(seed,69069)^Math.imul(salt,1274126177))>>>0;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296}
const nearbyTowns=new Map<string,typeof ATLAS_TOWNS>()
function townsNear(x:number,z:number){const key=`${Math.floor(x/500)}:${Math.floor(z/500)}`;let towns=nearbyTowns.get(key);if(!towns){const cx=Math.floor(x/500)*500+250,cz=Math.floor(z/500)*500+250;towns=ATLAS_TOWNS.filter(t=>Math.hypot(t.x-cx,t.z-cz)<750);nearbyTowns.set(key,towns)}return towns}
/** World-cell hashes keep trees fixed across reloads and adjacent scenery tiles. */
export function woodlandPoint(ix:number,iz:number,seed:number):WoodlandPoint|undefined{
  const rand=(salt:number)=>sceneryHash(ix,iz,seed,salt),x=(ix+0.14+rand(1)*0.72)*WOODLAND_CELL,z=(iz+0.14+rand(2)*0.72)*WOODLAND_CELL,c=landcover(x,z),wooded=c===2||c===3
  if(c===10||c===8)return
  const patch=(Math.sin(x/127)*Math.cos(z/173)+Math.sin(x/311+z/227)*0.7)/1.7
  let chance=wooded?0.76+patch*0.16:patch>0.27?0.18+(patch-0.27)*0.8:0.004
  if(c===5||c===4)chance*=0.3
  const towns=townsNear(x,z)
  for(const t of towns){const dx=x-t.x,dz=z-t.z,dist=Math.hypot(dx,dz)
    if(t.style==='woodland'){if(dist<27)return}
    else{
      // Keep productive fields, orchards and the village green open. Copses have
      // irregular edges rather than an empty circular moat around every town.
      if(dx>148&&dx<264&&dz>-115&&dz<90||dx< -145&&dx> -210&&dz>-73&&dz<1)return
      if(dist<125)chance=Math.min(chance,0.028)
      else if(dist<350)chance=Math.max(chance,patch>0.08?0.45:0.025)
    }
    if(dist<350&&townPlots(t).some(p=>plotContains(x,z,p,6)))return
  }
  if(rand(3)>chance||pathClearance(x,z)<3)return
  const river=riverAt(x,z);if(river&&river.distance<river.width/2+3)return
  if(Math.hypot((x-BYWATER_POOL.x)/BYWATER_POOL.rx,(z-BYWATER_POOL.z)/BYWATER_POOL.rz)<1.05)return
  const wet=river&&river.distance<river.width/2+45,kind:TreeKind=wet?(rand(4)<0.55?'willow':'alder'):rand(4)<0.34?'oak':rand(4)<0.60?'beech':rand(4)<0.80?'birch':rand(4)<0.93?'hazel':'alder'
  return {x,z,kind,scale:0.65+rand(5)*0.75,yaw:rand(6)*Math.PI*2,tint:0.78+rand(7)*0.35,wooded,understory:rand(8)}
}
