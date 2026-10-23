import * as T from 'three'
import { height } from '@shared/shire/terrain'
import { landcover, riverAt } from '@shared/shire/atlas'
import { pathsNear, pathClearance } from '@shared/shire/atlasPaths'
import { woodlandPoint, WOODLAND_CELL } from '@shared/shire/atlasScenery'
function ground(ax:number,az:number,size:number,segments:number,hole:number,context:{seed:number;generator:'shire-atlas-1'}){
    const positions:number[]=[],colors:number[]=[],cache=new Map<string,{y:number;color:number[]}>(),step=size/segments
    const vertex=(x:number,z:number)=>{const key=`${x}:${z}`;let v=cache.get(key);if(!v){const gx=x+ax,gz=z+az,c=landcover(gx,gz),shade=0.96+0.04*Math.sin(gx/57)*Math.cos(gz/69),color=new T.Color(c===10?0x99966b:c===3?0x526641:c===4||c===5?0x6f8256:c===8?0xa2a073:0x879855).multiplyScalar(shade);v={y:height(gx,gz,context),color:[color.r,color.g,color.b]};cache.set(key,v)}positions.push(x,v.y,z);colors.push(...v.color)}
    const refinement=new Uint8Array(segments*segments),fine=Math.ceil(step/2)
    if(hole<1000)for(let ix=0;ix<segments;ix++)for(let iz=0;iz<segments;iz++){
      const river=riverAt(ax-size/2+(ix+0.5)*step,az-size/2+(iz+0.5)*step)
      if(river&&river.distance<river.width/2+step*1.5||pathClearance(ax-size/2+(ix+0.5)*step,az-size/2+(iz+0.5)*step)<step*1.5)refinement[ix*segments+iz]=1
    }
    const refined=(ix:number,iz:number)=>ix>=0&&iz>=0&&ix<segments&&iz<segments&&refinement[ix*segments+iz]===1
    for(let ix=0;ix<segments;ix++)for(let iz=0;iz<segments;iz++){
      const x=-size/2+ix*step,z=-size/2+iz*step,divisions=refined(ix,iz)?fine:1,d=step/divisions
      // Coarse neighbours share every fine riverbank edge vertex. A centre fan
      // prevents T-junction cracks without flattening the carved river profile.
      const edges=[refined(ix-1,iz),refined(ix,iz+1),refined(ix+1,iz),refined(ix,iz-1)]
      if(divisions===1&&edges.some(Boolean)){
        const corners=[[x,z],[x,z+step],[x+step,z+step],[x+step,z]]
        for(let edge=0;edge<4;edge++){
          const a=corners[edge],b=corners[(edge+1)%4],n=edges[edge]?fine:1
          for(let k=0;k<n;k++){vertex(x+step/2,z+step/2);vertex(a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n);vertex(a[0]+(b[0]-a[0])*(k+1)/n,a[1]+(b[1]-a[1])*(k+1)/n)}
        }
      }else for(let a=0;a<divisions;a++)for(let b=0;b<divisions;b++){const xx=x+a*d,zz=z+b*d;for(const [dx,dz]of [[0,0],[d,d],[d,0],[0,0],[0,d],[d,d]])vertex(xx+dx,zz+dz)}
    }

return {positions:new Float32Array(positions),colors:new Float32Array(colors)}
}
self.onmessage=(event:MessageEvent<{ax:number;az:number;seed:number}>)=>{const {ax,az,seed}=event.data;try{const context={seed,generator:'shire-atlas-1' as const};pathsNear(ax,az,1900);const near=ground(ax,az,3200,160,118,context),far=ground(ax,az,16000,120,1350,context),woodland=[];for(let ix=Math.floor((ax-1300)/WOODLAND_CELL);ix<=Math.floor((ax+1300)/WOODLAND_CELL);ix++)for(let iz=Math.floor((az-1300)/WOODLAND_CELL);iz<=Math.floor((az+1300)/WOODLAND_CELL);iz++){const p=woodlandPoint(ix,iz,seed);if(p&&Math.hypot(p.x-ax,p.z-az)<=1300)woodland.push(p)}self.postMessage({ax,az,near,far,woodland},{transfer:[near.positions.buffer,near.colors.buffer,far.positions.buffer,far.colors.buffer]})}catch(error){self.postMessage({ax,az,error:(error as Error).message})}}
