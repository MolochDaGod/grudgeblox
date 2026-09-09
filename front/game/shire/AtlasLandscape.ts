import * as T from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { World, Point } from '@shared/shire/model'
import { height } from '@shared/shire/terrain'
import { ATLAS_TOWNS, ATLAS_PLACES, HIGH_HAY, AtlasTown, TownPlot, townPlots, landcover, riverAt, nearbyRiverSegments, projection, BYWATER_POOL, ATLAS_BRIDGES, bridgeAt, bridgeDeck, atlasHeight } from '@shared/shire/atlas'
import { pathsNear, pathClearance, PathLine } from '@shared/shire/atlasPaths'
import { addWoodland } from './AtlasWoodland'
import { box, ball, post, sign, mat, disposeObject } from './visuals'

const wood=0x665039,cream=0xe5d6b0,stone=0x938d74,grass=0x738647
function dryScenery(x:number,z:number,pad=3){const r=riverAt(x,z);return (!r||r.distance>r.width/2+pad)&&Math.hypot((x-BYWATER_POOL.x)/BYWATER_POOL.rx,(z-BYWATER_POOL.z)/BYWATER_POOL.rz)>1.02}
function windowRound(g:T.Group,x:number,y:number,z:number,r=0.43){
  const rim=new T.Mesh(new T.TorusGeometry(r,0.065,6,20),mat(wood));rim.position.set(x,y,z);g.add(rim)
  const pane=new T.Mesh(new T.CircleGeometry(r,20),new T.MeshStandardMaterial({color:0xf6d998,emissive:0xcdaa62,emissiveIntensity:0.18,roughness:0.45}));pane.position.set(x,y,z-0.025);g.add(pane);box(g,x,y,z+0.03,r*2,0.055,0.06,wood);box(g,x,y,z+0.03,0.055,r*2,0.06,wood)
}
function door(g:T.Group,color:number){
  const frame=new T.Mesh(new T.TorusGeometry(1.02,0.12,8,32),mat(wood));frame.position.set(0,1.1,1.03);g.add(frame)
  const leaf=new T.Mesh(new T.CircleGeometry(0.98,32),mat(color));leaf.position.set(0,1.1,1.05);g.add(leaf)
  for(let i=-3;i<=3;i++){const x=i*0.24,h=Math.sqrt(0.96**2-x*x)*2;box(g,x,1.1,1.065,0.012,h,0.015,0x3c5033)}
  ball(g,0.32,1.1,1.11,0.065,0.065,0.045,0xc9ad51);box(g,0,0.07,1.4,2.4,0.14,1,stone)
}
function roof(g:T.Group,width:number,depth:number,base:number,color:number){
  const shape=new T.Shape();shape.moveTo(-width/2,base);shape.lineTo(0,base+2);shape.lineTo(width/2,base);shape.closePath()
  const geo=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false});const m=new T.Mesh(geo,mat(color));m.position.z=1.6-depth;m.castShadow=true;m.receiveShadow=true;g.add(m)
  for(const x of [-width/2,width/2]){const b=box(g,x/2,base+1,1.62,Math.hypot(width/2,2),0.18,0.22,wood);b.rotation.z=x<0?Math.atan2(2,width/2):-Math.atan2(2,width/2)}
  box(g,0,base+2.05,1.6-depth/2,0.25,0.16,depth+0.3,0x8a7955)
}
function windowSquare(g:T.Group,x:number,y:number){box(g,x,y,1.02,0.85,1.1,0.13,0xe2c788);for(const dx of [-0.49,0,0.49])box(g,x+dx,y,1.13,0.08,1.25,0.08,wood);for(const dy of [-0.6,0,0.6])box(g,x,y+dy,1.13,1.08,0.07,0.08,wood);for(const side of [-1,1])box(g,x+side*0.77,y,1.06,0.38,1.2,0.13,0x687663)}
function building(p:TownPlot,index:number,human=false){const g=new T.Group(),smial=p.kind==='smial'||p.kind==='hall',color=[0x496849,0x8b553b,0x57768a,0xa78b43][index%4]
  if(smial){
    const mound=ball(g,0,0.55,-3.5,5.8,3.8,5.2,grass),vertices=mound.geometry.attributes.position;for(let i=0;i<vertices.count;i++)vertices.setZ(i,Math.min(vertices.getZ(i),4.32/5.2));mound.geometry.computeVertexNormals();box(g,0,1.3,-0.08,8.4,2.7,2.1,cream);door(g,color)
    for(const x of [-2.6,2.6]){windowRound(g,x,1.6,1.04,0.49);box(g,x,0.94,1.28,1.55,0.16,0.6,wood);for(let i=0;i<6;i++)ball(g,x-0.55+i*0.22,1.12,1.35,0.13,0.16,0.13,[0xc48c81,0xe9ce87,0x8a9a61][i%3])}
    box(g,3.3,3.6,-3,0.64,3.1,0.64,stone);box(g,3.3,5.2,-3,0.84,0.22,0.84,0x6e695a)
    for(const x of [-4.2,4.2])box(g,x,1.1,0.96,0.35,2.3,0.42,stone)
    if(p.kind==='hall')for(const side of [-1,1]){const wing=new T.Group();wing.position.x=side*8.2;const roof=ball(wing,0,0.55,-3.5,6.3,3.8,5.2,grass),a=roof.geometry.attributes.position;for(let i=0;i<a.count;i++)a.setZ(i,Math.min(a.getZ(i),4.32/5.2));roof.geometry.computeVertexNormals();box(wing,0,1.3,-0.08,8.4,2.7,2.1,cream);door(wing,color);for(const x of [-2.6,2.6])windowRound(wing,x,1.6,1.05,0.46);box(wing,side*2,3.3,-3,0.65,2.5,0.65,stone);g.add(wing)}
  }else{
    const two=p.kind==='inn'||human&&index%4===0,h=two?5.3:2.9,w=p.kind==='barn'?9:8.6
    box(g,0,-0.05,-2.8,w+0.35,0.4,7.7,stone);box(g,0,h/2,-2.8,w,h,7.3,p.kind==='barn'?0x917454:human?0xcec9b9:cream)
    roof(g,w+1,8.2,h,p.kind==='inn'?0x665e55:human&&index%3?0x737773:p.kind==='barn'?0x8b7250:0xb39c66)
    for(const x of [-w/2,-w/4,0,w/4,w/2])box(g,x,h/2,0.91,0.16,h,0.18,wood)
    for(const y of [0.2,2.7,...(two?[5.15]:[])])box(g,0,y,0.96,w,0.2,0.22,wood)
    if(p.kind==='barn'){box(g,0,1.3,1.02,2.8,2.6,0.14,0x604b36);for(const x of [-1.3,1.3]){const b=box(g,x/2,1.3,1.13,2.85,0.1,0.1,0xbaa16b);b.rotation.z=x<0?0.72:-0.72}}
    else if(human){box(g,0,1.1,1.07,1.3,2.2,0.16,color);for(const x of [-0.75,0.75])box(g,x,1.15,1.12,0.16,2.3,0.18,wood);box(g,0,2.35,1.12,1.65,0.2,0.18,wood);ball(g,0.45,1.05,1.18,0.045,0.045,0.045,0xc6ab61);for(const x of [-2.8,2.8])windowSquare(g,x,1.6);if(two)for(const x of [-2.8,0,2.8])windowSquare(g,x,4)}
    else{door(g,color);for(const x of [-2.8,2.8])windowRound(g,x,1.6,1.06,0.46);if(two)for(const x of [-2.8,0,2.8])windowRound(g,x,4,1.06,0.5)}
    box(g,2.8,h+1.1,-4,0.8,3.5,0.8,stone);box(g,2.8,h+2.9,-4,1,0.22,1,0x6c6456)
    if(p.kind==='inn'){const canopy=box(g,0,2.5,2.5,5.7,0.17,3.2,0x8a9a67);canopy.rotation.x=-0.1;for(const x of [-2.7,2.7])post(g,x,1.2,3.8,0.09,2.4,wood)}
  }
  if(p.kind==='mill'){
    const wheel=new T.Group();const hoop=new T.Mesh(new T.TorusGeometry(2.5,0.15,6,32),mat(wood));wheel.add(hoop)
    for(let i=0;i<12;i++){const a=i*Math.PI/6,b=box(wheel,Math.sin(a)*1.3,Math.cos(a)*1.3,0,0.15,2.65,0.5,wood);b.rotation.z=-a;const paddle=box(wheel,Math.sin(a)*2.55,Math.cos(a)*2.55,0,0.65,0.28,1.1,0x887052);paddle.rotation.z=-a}
    wheel.rotation.y=Math.PI/2;wheel.position.set(4.8,1.8,-2.6);g.add(wheel)
  }
  if(p.label){const board=sign(p.label,Math.min(5,p.label.length*0.25+1));board.position.set(0,p.kind==='inn'?3:2.9,1.35);g.add(board)}
  g.scale.setScalar(p.scale);g.rotation.y=p.yaw;return g
}
function fence(g:T.Group,x:number,z:number,length:number,yaw:number,_y:number){
  for(let i=-length/2;i<length/2;i+=2.5){const len=Math.min(2.5,length/2-i),xx=x+Math.cos(yaw)*(i+len/2),zz=z-Math.sin(yaw)*(i+len/2),gx=xx+g.position.x,gz=zz+g.position.z
    if(pathClearance(gx,gz)<len/2+0.7)continue
    const f=new T.Group(),y=atlasHeight(gx,gz);for(const side of [-1,1])post(f,side*len/2,0.52,0,0.065,1.04,wood);for(const h of [0.38,0.78])box(f,0,h,0,len,0.1,0.1,wood);f.position.set(xx,y,zz);f.rotation.y=yaw;g.add(f)
  }
}
function tree(g:T.Group,x:number,y:number,z:number,scale:number,willow=false){post(g,x,y+3*scale,z,0.35*scale,6*scale,0x6e6047);const colors=willow?[0x647b46,0x738851,0x556f43]:[0x546e3a,0x718348,0x637b3e];for(let i=0;i<4;i++)ball(g,x+Math.cos(i*2.2)*2*scale,y+(5+i%2)*scale,z+Math.sin(i*2.2)*2*scale,(willow?3.2:2.6)*scale,(willow?4:2.5)*scale,2.7*scale,colors[i%3])}

/** Stream scenery and distant terrain around the full-size atlas coordinate, with local mesh vertices. */
export class AtlasLandscape {
  private root=new T.Group()
  private anchor=''
  private center={value:new T.Vector2()}
  private townKey=''
  private townRoot=new T.Group()
  constructor(private scene:T.Scene,private w:World){scene.add(this.root,this.townRoot)}
  update(player:Point){this.center.value.set(player.x,player.z);const ax=Math.round(player.x/384)*384,az=Math.round(player.z/384)*384,key=`${ax}:${az}`
    if(key!==this.anchor){this.anchor=key;this.rebuildGround(ax,az)}
    const towns=ATLAS_TOWNS.filter(s=>Math.hypot(player.x-s.x,player.z-s.z)<1100),tk=towns.map(s=>s.id).join(':')
    if(tk!==this.townKey){this.townKey=tk;this.scene.remove(this.townRoot);disposeObject(this.townRoot);this.townRoot=new T.Group();this.townRoot.position.set(ax,0,az);this.scene.add(this.townRoot);for(const s of towns)this.town(s,ax,az);this.batch(this.townRoot)}
  }
  private ribbon(root:T.Group,points:number[][],width:number,ax:number,az:number,color:number,water=false){const vertices:number[]=[],h=(x:number,z:number,v:number)=>water?v:height(x,z,this.w)+0.045
    for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(!len)continue;const nx=-dz/len*width/2,nz=dx/len*width/2
      for(const [p,side] of [[a,-1],[b,-1],[b,1],[a,-1],[b,1],[a,1]] as [number[],number][]){const x=p[0]+nx*side,z=p[1]+nz*side;vertices.push(x-ax,h(x,z,p[2]||0)+ (water?0.025:0),z-az)}}
    if(!vertices.length)return;const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();const mesh=new T.Mesh(geo,new T.MeshStandardMaterial({color,roughness:water?0.25:1,metalness:water?0.22:0,side:T.DoubleSide}));mesh.receiveShadow=true;root.add(mesh)
  }
  private pathRibbon(path:PathLine,ax:number,az:number){const points:number[][]=[]
    for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i],q=projection(ax,az,a,b);if(q.d>1750)continue;const len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<0.001)continue;const lo=Math.max(0,q.t-1800/len),hi=Math.min(1,q.t+1800/len),n=Math.max(1,Math.ceil((hi-lo)*len/1.5));for(let j=0;j<=n;j++){const t=lo+(hi-lo)*j/n,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];if(!points.length||Math.hypot(p[0]-points.at(-1)![0],p[1]-points.at(-1)![1])>0.001)points.push(p)}}
    if(points.length<2)return
    // Match the actual two-metre terrain triangles instead of sampling a smooth
    // height below their surface. Adjacent strip sections share mitered corners.
    const surface=(x:number,z:number)=>{const bridge=bridgeAt(x,z);if(bridge)return bridgeDeck(bridge)+0.045;const x0=Math.floor(x/2)*2,z0=Math.floor(z/2)*2,u=(x-x0)/2,v=(z-z0)/2,a=height(x0,z0,this.w),b=height(x0+2,z0,this.w),c=height(x0+2,z0+2,this.w),d=height(x0,z0+2,this.w);return (u>=v?a+u*(b-a)+v*(c-b):a+v*(d-a)+u*(c-d))+0.085}
    const pairs=points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1,half=path.width/2;return [[p[0]-dz/len*half,p[1]+dx/len*half],[p[0]+dz/len*half,p[1]-dx/len*half]]})
    const vertices:number[]=[];for(let i=1;i<pairs.length;i++)for(const p of [pairs[i-1][0],pairs[i][0],pairs[i][1],pairs[i-1][0],pairs[i][1],pairs[i-1][1]])vertices.push(p[0]-ax,surface(p[0],p[1]),p[1]-az)
    // Round shared endpoints so differently angled streets meet without wedges.
    for(const end of [0,points.length-1]){if(end===0&&path.kind==='door')continue;const p=points[end];for(let i=0;i<12;i++){const a=i*Math.PI/6,b=(i+1)*Math.PI/6;for(const q of [p,[p[0]+Math.cos(a)*path.width/2,p[1]+Math.sin(a)*path.width/2],[p[0]+Math.cos(b)*path.width/2,p[1]+Math.sin(b)*path.width/2]])vertices.push(q[0]-ax,surface(q[0],q[1]),q[1]-az)}}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();const material=new T.MeshStandardMaterial({color:0xbba879,roughness:1,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),mesh=new T.Mesh(geo,material);mesh.receiveShadow=true;this.root.add(mesh)
  }
  private ground(ax:number,az:number,size:number,segments:number,hole:number){
    const positions:number[]=[],colors:number[]=[],cache=new Map<string,{y:number;color:number[]}>(),step=size/segments
    const vertex=(x:number,z:number)=>{const key=`${x}:${z}`;let v=cache.get(key);if(!v){const gx=x+ax,gz=z+az,c=landcover(gx,gz),shade=0.96+0.04*Math.sin(gx/57)*Math.cos(gz/69),color=new T.Color(c===10?0x99966b:c===3?0x526641:c===4||c===5?0x6f8256:c===8?0xa2a073:0x879855).multiplyScalar(shade);v={y:height(gx,gz,this.w),color:[color.r,color.g,color.b]};cache.set(key,v)}positions.push(x,v.y,z);colors.push(...v.color)}
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
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals()
    const material=new T.MeshStandardMaterial({vertexColors:true,roughness:1});material.customProgramCacheKey=()=>`atlas-ground-${ax}-${az}-${hole}`
    material.onBeforeCompile=shader=>{shader.uniforms.atlasCenter=this.center;shader.vertexShader='varying vec2 atlasXZ;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\natlasXZ = position.xz + vec2(${ax.toFixed(1)},${az.toFixed(1)});`);shader.fragmentShader='varying vec2 atlasXZ;uniform vec2 atlasCenter;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',hole<1000?`#include <clipping_planes_fragment>\nif(distance(atlasXZ,atlasCenter)<118.0) discard;`:`#include <clipping_planes_fragment>\nif(abs(atlasXZ.x-(${ax.toFixed(1)}))<1599.9 && abs(atlasXZ.y-(${az.toFixed(1)}))<1599.9) discard;`)}
    const mesh=new T.Mesh(geo,material);mesh.receiveShadow=true;this.root.add(mesh)
  }
  private rebuildGround(ax:number,az:number){this.scene.remove(this.root);this.root.traverse(o=>{if(o instanceof T.InstancedMesh)o.dispose()});disposeObject(this.root);this.root=new T.Group();this.root.position.set(ax,0,az);this.scene.add(this.root);const paths=pathsNear(ax,az,1900);this.ground(ax,az,3200,160,118);this.ground(ax,az,16000,120,1350)
    for(const r of nearbyRiverSegments(ax,az,1800))this.ribbon(this.root,[r.a,r.b],r.width,ax,az,0x71999a,true)
    if(Math.hypot(ax-BYWATER_POOL.x,az-BYWATER_POOL.z)<2500){const lake=new T.Mesh(new T.CircleGeometry(1,80),new T.MeshStandardMaterial({color:0x71999a,roughness:0.23,metalness:0.2}));lake.rotation.x=-Math.PI/2;lake.scale.set(BYWATER_POOL.rx,BYWATER_POOL.rz,1);lake.position.set(BYWATER_POOL.x-ax,BYWATER_POOL.stage+0.03,BYWATER_POOL.z-az);this.root.add(lake)}
    for(const p of paths)this.pathRibbon(p,ax,az)
    const vegetation=new T.Group();this.root.add(vegetation)
    addWoodland(this.root,ax,az,this.w)
    for(let i=1;i<HIGH_HAY.length;i++){const a=HIGH_HAY[i-1],b=HIGH_HAY[i],p=projection(ax,az,a,b);if(p.d>1600)continue;const len=Math.hypot(b[0]-a[0],b[1]-a[1]),lo=Math.max(0,p.t-1700/len),hi=Math.min(1,p.t+1700/len);for(let t=lo;t<=hi;t+=8/len){const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;if(Math.hypot(x-83900,z-12900)<8||!dryScenery(x,z,5)||pathClearance(x,z)<5)continue;ball(vegetation,x-ax,height(x,z,this.w)+2,z-az,4.8,3,4.8,0x4f683b)}}
    const nearest=ATLAS_PLACES.filter(p=>Math.hypot(p.x-ax,p.z-az)<1700)
    for(const p of nearest){const x=p.x-ax,z=p.z-az,y=height(p.x,p.z,this.w)
      if(p.id==='old-man-willow')tree(vegetation,x,y,z,3,true)
      if(p.kind==='barrow'){for(let i=0;i<7;i++){const dx=(i-3)*24,dz=Math.sin(i*2)*32,yy=height(p.x+dx,p.z+dz,this.w);ball(vegetation,x+dx,yy,z+dz,9,4,7,0x92976b);for(const side of [-1,1])box(vegetation,x+dx+side*1.2,yy+1,z+dz+6,0.75,2.4,0.75,0x868674);box(vegetation,x+dx,yy+2.1,z+dz+6,3.1,0.7,0.9,0x868674)}}
      if(p.id==='bucklebury-ferry'){const r=riverAt(p.x,p.z);if(r){const deck=box(vegetation,x,r.stage+0.45,z,6,0.3,3.4,wood);for(const end of [-1,1])post(vegetation,x+end*(r.width/2+2),r.stage+1.3,z,0.15,2.6,wood);box(vegetation,x,r.stage+1.7,z+1.2,r.width+5,0.025,0.025,0xb8a787);deck.rotation.y=0.25}}
      if(p.id==='three-farthing-stone')box(vegetation,x,y+0.8,z,0.8,1.6,0.7,stone)
      if(p.id==='scary-quarry'){for(let i=0;i<24;i++){const dx=Math.sin(i*3.8)*(20+i*2),dz=Math.cos(i*3.8)*(20+i*2),yy=height(p.x+dx,p.z+dz,this.w);box(vegetation,x+dx,yy+1.1,z+dz,2+i%4,2.2+i%3,2.8,0x9e9c87)}}
      if(p.id==='hay-gate'){const gateX=83900-ax;for(const side of [-1,1])post(vegetation,gateX+side*4,y+2,z,0.32,4,wood);box(vegetation,gateX,y+1.2,z,7.5,0.2,0.2,wood);box(vegetation,gateX,y+2.5,z,7.5,0.2,0.2,wood)}
    }
    for(const b of ATLAS_BRIDGES)if(Math.hypot(b.x-ax,b.z-az)<1700)this.bridge(vegetation,b.x,b.z,ax,az,b.length,b.width,b.turn?Math.PI/2:0,b.wooden)
    this.batch(vegetation)
  }
  private bridge(g:T.Group,x:number,z:number,ax:number,az:number,length:number,width:number,yaw=0,wooden=false){const r=riverAt(x,z);if(!r)return;const bridge=new T.Group(),color=wooden?wood:stone;bridge.position.set(x-ax,r.stage+1.1,z-az);bridge.rotation.y=yaw;box(bridge,0,0,0,length,0.4,width,color);for(const side of [-1,1]){box(bridge,0,0.6,side*(width/2-0.15),length,wooden?0.15:0.9,0.3,color);for(let t=-length/2;t<=length/2;t+=wooden?3:8)box(bridge,t,wooden?-0.5:-1.6,side*width/3,wooden?0.2:1.6,wooden?3:3.2,wooden?0.2:1.2,color)}g.add(bridge)}
  private town(s:AtlasTown,ax:number,az:number){const plots=townPlots(s),g=this.townRoot
    for(const [i,p]of plots.entries()){const home=building(p,i,s.style==='bree'||s.style==='woodland'),y=height(p.x,p.z,this.w);home.position.set(p.x-ax,y,p.z-az);g.add(home)
      const front=p.yaw===0?1:-1
      if(!p.label){const gx=p.x-ax,gz=p.z-az+front*8;fence(g,gx,gz,10,0,height(p.x,p.z+front*8,this.w));for(const side of [-1,1]){const xx=p.x+side*4.8,zz=p.z+front*5;if(pathClearance(xx,zz)<2.7)continue;box(g,xx-ax,height(xx,zz,this.w)+0.23,zz-az,1.8,0.4,3,0x6c773e);for(let k=0;k<4;k++)ball(g,xx-ax,height(xx,zz,this.w)+0.55,zz-az-1+k*0.65,0.18,0.2,0.18,k%2?0xc69283:0xcdbc70)}}
    }
    const title=sign(s.name.toUpperCase(),7);title.position.set(s.x-ax-9,height(s.x-9,s.z+99,this.w)+2.8,s.z+99-az);g.add(title);post(g,title.position.x,title.position.y-1.3,title.position.z,0.12,2.6,wood)
    if(s.style==='woodland'){for(let i=0;i<7;i++){const x=s.x+14,z=s.z-10+i*2;this.ribbon(g,[[x,z],[x+12,z]],1,ax,az,0x829b50)}return}
    if(s.homes>8){
      if(pathClearance(s.x+12,s.z+7)>2.5){const well=new T.Group();for(let i=0;i<14;i++){const a=i*Math.PI/7;box(well,Math.sin(a)*1.1,0.4,Math.cos(a)*1.1,0.5,0.8,0.4,stone)}for(const x of [-1.1,1.1])post(well,x,1.4,0,0.09,2.8,wood);box(well,0,2.7,0,2.6,0.15,0.25,wood);well.position.set(s.x-ax+12,height(s.x+12,s.z+7,this.w),s.z+7-az);g.add(well)}
      const stalls=s.style==='market'||s.style==='bree'?6:2
      for(let i=0;i<stalls;i++){const x=s.x-42+i*15,z=s.z+65,y=height(x,z,this.w);if(pathClearance(x,z)<4)continue;box(g,x-ax,y+0.8,z-az,4,0.2,2,wood);for(const dx of [-1.8,1.8])for(const dz of [-0.8,0.8])post(g,x-ax+dx,y+1.4,z-az+dz,0.06,2.8,wood);box(g,x-ax,y+2.8,z-az,4.5,0.14,2.5,i%2?0xa16d4b:0x899b60);for(let k=0;k<7;k++)ball(g,x-ax-1.4+k*0.45,y+1.04,z-az,0.21,0.2,0.2,k%2?0xb7934f:0x9b5943)}
    }
    // Orchard, field boundaries and crop strips are placed outside the protected village plots.
    for(let i=0;i<16;i++){const x=s.x-160-(i%4)*12,z=s.z-60+Math.floor(i/4)*15;if(pathClearance(x,z)>5&&dryScenery(x,z))tree(g,x-ax,height(x,z,this.w),z-az,0.6)}
    for(let i=0;i<4;i++){const x=s.x+175+(i%2)*48,z=s.z-80+Math.floor(i/2)*70;for(let row=0;row<9;row++)this.ribbon(g,[[x-18,z-24+row*6],[x+18,z-24+row*6]],3.6,ax,az,i%2?0x969a4f:0xb4a15b);fence(g,x-ax,z-az+30,44,0,height(x,z+30,this.w))}
    for(let i=0;i<12;i++){const angle=i*Math.PI/6,x=s.x+Math.sin(angle)*145,z=s.z+Math.cos(angle)*145;if(pathClearance(x,z)>6&&dryScenery(x,z,5))tree(g,x-ax,height(x,z,this.w),z-az,0.8+(i%3)*0.15)}
    if(s.id==='hobbiton'){tree(g,s.x-ax-18,height(s.x-18,s.z-42,this.w),s.z-az-42,1.7);const party=sign('The Party Field',3);party.position.set(s.x-ax-12,height(s.x-12,s.z-39,this.w)+1.1,s.z-az-39);g.add(party)}
    if(s.id==='bamfurlong')for(const dx of [-30,30])fence(g,s.x+dx-ax,s.z-az,100,Math.PI/2,height(s.x+dx,s.z,this.w))
  }
  private batch(g:T.Group){g.updateMatrixWorld(true);const inverse=new T.Matrix4().copy(g.matrixWorld).invert(),groups=new Map<T.Material,T.BufferGeometry[]>(),remove:T.Mesh[]=[]
    g.traverse(o=>{if(!(o instanceof T.Mesh)||Array.isArray(o.material)||!o.geometry.attributes.normal||o.material.map)return;const geometry=o.geometry.clone();geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));geometry.deleteAttribute('uv');const list=groups.get(o.material)||[];list.push(geometry.index?geometry.toNonIndexed():geometry);groups.set(o.material,list);remove.push(o)})
    for(const [material,geometries]of groups){const merged=mergeGeometries(geometries,false);geometries.forEach(x=>x.dispose());if(merged){const mesh=new T.Mesh(merged,material);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh)}}
    for(const o of remove){o.removeFromParent();o.geometry.dispose()}
  }
  dispose(){this.scene.remove(this.root,this.townRoot);this.root.traverse(o=>{if(o instanceof T.InstancedMesh)o.dispose()});disposeObject(this.root);disposeObject(this.townRoot)}
}
