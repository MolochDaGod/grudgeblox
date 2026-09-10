import * as T from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { height } from '@shared/shire/terrain'
import type { World } from '@shared/shire/model'
import { WOODLAND_CELL, woodlandPoint, WoodlandPoint, TreeKind } from '@shared/shire/atlasScenery'
import { pathClearance } from '@shared/shire/atlasPaths'

type Instance={x:number;y:number;z:number;scale:number;yaw:number;tint:number}
const species:TreeKind[]=['oak','beech','birch','willow','alder','hazel']
function model(kind:TreeKind| 'understory',low:boolean){const pieces:T.BufferGeometry[]=[]
  const part=(geometry:T.BufferGeometry,x:number,y:number,z:number,sx:number,sy:number,sz:number,color:number,rotation=0)=>{geometry.rotateZ(rotation);geometry.scale(sx,sy,sz);geometry.translate(x,y,z);const c=new T.Color(color),colors=new Float32Array(geometry.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b}geometry.setAttribute('color',new T.BufferAttribute(colors,3));geometry.deleteAttribute('uv');pieces.push(geometry.index?geometry.toNonIndexed():geometry.clone());geometry.dispose()}
  const crown=(x:number,y:number,z:number,rx:number,ry:number,rz:number,color:number)=>part(new T.SphereGeometry(1,low?7:8,low?5:6),x,y,z,rx,ry,rz,color)
  const trunk=(x:number,y:number,z:number,h:number,r:number,color:number,angle=0)=>part(new T.CylinderGeometry(0.7,1,1,low?5:7),x,y,z,r,h,r,color,angle)
  if(kind==='understory'){
    crown(0,0.55,0,1.3,0.65,1.1,0x587343);crown(0.7,0.4,0.5,0.8,0.5,0.7,0x76804b)
    for(let i=0;i<5;i++){const a=i*2.4;part(new T.ConeGeometry(1,1,3),Math.cos(a)*1.7,0.35,Math.sin(a)*1.7,0.35,0.8,0.13,0x79925a,0.35*Math.sin(a))}
  }else{
    const birch=kind==='birch',willow=kind==='willow',hazel=kind==='hazel',beech=kind==='beech',h=hazel?4.5:beech?10:birch?10.5:8.5,r=birch?0.2:hazel?0.22:0.47,bark=birch?0xc6c5ad:beech?0x929180:0x66523a
    trunk(0,h/2,0,h,r,bark)
    if(!low){for(let i=0;i<3;i++){const a=i*2.2;trunk(Math.cos(a)*0.6,h*0.64+i*0.4,Math.sin(a)*0.5,h*0.43,r*0.48,bark,(i%2?-1:1)*0.6)}if(birch)for(let i=0;i<7;i++)part(new T.BoxGeometry(1,1,1),0,h*i/8,0.19,0.25,0.085,0.05,0x555c4d)}
    const leaf=willow?0x769553:birch?0x85a056:beech?0x557443:hazel?0x6c873d:kind==='alder'?0x466c43:0x587f3b
    if(low){crown(0,h+0.5,0,birch?2.2:4,beech||birch?4.6:3.2,birch?2.1:3.8,leaf);crown(1.5,h-1.5,0.8,birch?1.6:3.4,2.6,3,leaf)}
    else for(let i=0;i<7;i++){const a=i*2.4,ring=i===0?0:willow?2.9:birch?1.5:2.2;crown(Math.cos(a)*ring,h+Math.sin(i*1.9)*1.3,Math.sin(a)*ring,birch?1.8:willow?2.2:2.7,beech||birch?3.6:willow?3.9:2.5,birch?1.7:2.7,leaf+(i%2?0x070806:0))}
    if(willow&&!low)for(let i=0;i<8;i++){const a=i*Math.PI/4;crown(Math.cos(a)*4.1,h-2.5,Math.sin(a)*4.1,0.72,3.2,0.7,0x74924f)}
  }
  const merged=mergeGeometries(pieces,false)!;pieces.forEach(p=>p.dispose());return merged
}
function instances(root:T.Group,kind:TreeKind|'understory',low:boolean,list:Instance[]){if(!list.length)return
  const mesh=new T.InstancedMesh(model(kind,low),new T.MeshStandardMaterial({vertexColors:true,roughness:1}),list.length),dummy=new T.Object3D(),color=new T.Color()
  list.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.set(p.scale,p.scale*(0.92+0.12*Math.sin(p.yaw)),p.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,color.setRGB(p.tint,p.tint,p.tint))})
  mesh.castShadow=!low;mesh.receiveShadow=true;mesh.computeBoundingSphere();mesh.userData.atlasVegetation=true;root.add(mesh)
}
/** Six tree silhouettes, two detail levels and instanced undergrowth. */
export function addWoodland(root:T.Group,ax:number,az:number,w:World,prepared?:WoodlandPoint[]){const buckets=new Map<string,Instance[]>();let trees=0,understory=0
  const put=(key:string,p:WoodlandPoint,y:number,scale=p.scale)=>{const list=buckets.get(key)||[];list.push({x:p.x-ax,y,z:p.z-az,scale,yaw:p.yaw,tint:p.tint});buckets.set(key,list)}
  const candidates=prepared||(()=>{const list:WoodlandPoint[]=[];for(let ix=Math.floor((ax-1300)/WOODLAND_CELL);ix<=Math.floor((ax+1300)/WOODLAND_CELL);ix++)for(let iz=Math.floor((az-1300)/WOODLAND_CELL);iz<=Math.floor((az+1300)/WOODLAND_CELL);iz++){const p=woodlandPoint(ix,iz,w.seed);if(p)list.push(p)}return list})()
  for(const p of candidates){const d=Math.hypot(p.x-ax,p.z-az);if(d>1300)continue
    const low=d>260,y=height(p.x,p.z,w);put(`${p.kind}-${low?'low':'high'}`,p,y);trees++
    if(d<450&&p.wooded&&p.understory<0.42&&pathClearance(p.x+2,p.z+2)>2){put('understory-high',{...p,x:p.x+2,z:p.z+2},height(p.x+2,p.z+2,w),0.6+p.understory*1.7);understory++}
  }
  for(const kind of [...species,'understory'] as const)for(const low of [false,true])instances(root,kind,low,buckets.get(`${kind}-${low?'low':'high'}`)||[])
  root.userData.woodlandCounts={trees,understory}
}
