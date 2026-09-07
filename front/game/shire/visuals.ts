import * as T from 'three'
import { Animal, FURNITURE, Furnishing, Species, SPECIES } from '@shared/shire/model'

export const palette={wood:0x785138,darkWood:0x493525,cream:0xe4d5ae,green:0x526d30,stone:0x8b8876,metal:0x3c423d}
const materials=new Map<number,T.MeshStandardMaterial>()
export function mat(color:number){if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:0.9}));return materials.get(color)!}
export function box(group:T.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,color:number){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m}
export function ball(group:T.Object3D,x:number,y:number,z:number,rx:number,ry:number,rz:number,color:number){const m=new T.Mesh(new T.SphereGeometry(1,12,8),mat(color));m.scale.set(rx,ry,rz);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m}
export function post(group:T.Object3D,x:number,y:number,z:number,r:number,h:number,color:number){const m=new T.Mesh(new T.CylinderGeometry(r,r,h,10),mat(color));m.position.set(x,y,z);m.castShadow=true;group.add(m);return m}
export function sign(text:string,width=4){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=192;const c=canvas.getContext('2d')!;c.fillStyle='#ece2c3';c.fillRect(0,0,512,192);c.strokeStyle='#756242';c.lineWidth=12;c.strokeRect(6,6,500,180);c.fillStyle='#344331';c.textAlign='center';c.textBaseline='middle';c.font='bold 38px Georgia';const lines=text.split('\n');lines.forEach((line,i)=>c.fillText(line,256,96+(i-(lines.length-1)/2)*48,460));const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(width,width*192/512),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));return m}
export function home(color=0x597349){const g=new T.Group();ball(g,0,1.2,-1.8,4,2.6,3.4,0x536c31);const front=new T.Mesh(new T.CircleGeometry(2.1,24),mat(palette.cream));front.position.set(0,1.25,0.84);g.add(front);const ring=new T.Mesh(new T.TorusGeometry(0.95,0.15,8,32),mat(palette.wood));ring.position.set(0,1.15,0.9);g.add(ring);const door=new T.Mesh(new T.CircleGeometry(0.91,32),mat(color));door.position.set(0,1.15,0.96);g.add(door);ball(g,0.26,1.15,1.0,0.06,0.06,0.04,0xc3a14f);for(const x of [-1.5,1.5]){const win=new T.Mesh(new T.CircleGeometry(0.36,16),mat(0xe7b86d));win.position.set(x,1.4,0.95);g.add(win);box(g,x,0.9,1.02,0.9,0.14,0.45,palette.wood);for(let i=0;i<4;i++)ball(g,x-0.3+i*0.2,1.04,1.08,0.12,0.15,0.12,i%2?0xc89484:0xd9bd78)}post(g,1.8,3,-2,0.38,2.6,palette.stone);return g}
export function furnitureVisual(f:Pick<Furnishing,'kind'|'open'|'fit'|'stock'>){const g=new T.Group(),wood=palette.wood,dark=palette.darkWood
  switch(f.kind){
    case 'table':box(g,0,0.74,0,1.5,0.1,0.9,wood);for(const x of [-0.6,0.6])for(const z of [-0.32,0.32])box(g,x,0.36,z,0.09,0.72,0.09,dark);break
    case 'chair':box(g,0,0.43,0,0.55,0.1,0.55,wood);box(g,0,0.73,-0.22,0.55,0.48,0.07,wood);for(const x of [-0.2,0.2])for(const z of [-0.2,0.2])box(g,x,0.22,z,0.08,0.44,0.08,dark);break
    case 'bed':box(g,0,0.2,0,1.2,0.28,2,wood);box(g,0,0.42,0,1.14,0.18,1.95,0xcecfab);box(g,0,0.56,-0.72,0.8,0.16,0.43,palette.cream);box(g,0,0.55,0.35,1.16,0.09,1.2,0x596e62);break
    case 'shelf':for(const x of [-0.55,0.55])box(g,x,0.8,0,0.1,1.6,0.4,dark);for(const y of [0.08,0.55,1.05,1.55])box(g,0,y,0,1.2,0.08,0.4,wood);for(let i=0;i<8;i++)box(g,-0.4+i*0.11,0.78,0,0.08,0.35,0.23,[0x82554a,0x668073,0xb29969][i%3]);break
    case 'chest':box(g,0,0.3,0,1,0.6,0.6,wood);box(g,0,0.64,0,1.04,0.09,0.64,dark);box(g,0,0.42,0.31,0.16,0.2,0.035,0xc1a157);break
    case 'door':{
      const fit=f.fit,rx=fit?fit.openingWidth/2:0.82,ry=fit?fit.openingHeight/2:0.82,center=fit?ry-0.15:1
      if(fit){const shape=new T.Shape();shape.moveTo(-fit.width/2,-0.3);shape.lineTo(fit.width/2,-0.3);shape.lineTo(fit.width/2,fit.height);shape.lineTo(-fit.width/2,fit.height);shape.closePath();const opening=new T.Path();opening.absellipse(0,center,rx,ry,0,Math.PI*2,true);shape.holes.push(opening);const surround=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:0.25,bevelEnabled:false,curveSegments:32}),mat(palette.cream));surround.position.z=-0.125;surround.castShadow=true;g.add(surround)}
      const ring=new T.Mesh(new T.TorusGeometry(1,0.065,8,48),mat(wood));ring.scale.set(rx,ry,1);ring.position.set(0,center,0.02);g.add(ring)
      const pivot=new T.Group();pivot.position.set(-rx,center,0.1);pivot.rotation.y=f.open?-Math.PI/2:0;const d=new T.Mesh(new T.CircleGeometry(1,48),new T.MeshStandardMaterial({color:0x46634c,side:T.DoubleSide,roughness:0.9}));d.scale.set(rx,ry,1);d.position.x=rx;pivot.add(d);ball(pivot,rx*1.6,0,0.045,0.055,0.055,0.045,0xd0ab57);g.add(pivot);break}
    case 'lamp':post(g,0,0.25,0,0.03,0.5,dark);const bulb=ball(g,0,0.4,0,0.14,0.2,0.14,0xe8ba6b);bulb.material=new T.MeshStandardMaterial({color:f.open?0x786a52:0xfad794,emissive:0xffb858,emissiveIntensity:f.open?0:1.5});if(!f.open){const light=new T.PointLight(0xffd29a,2.5,8,1.7);light.position.y=0.6;g.add(light)}break
    case 'fence':for(const x of [-0.95,0.95])box(g,x,0.5,0,0.12,1.05,0.12,dark);for(const y of [0.38,0.82])box(g,0,y,0,2,0.12,0.08,wood);break
    case 'feeder':box(g,0,0.2,0,1.4,0.12,0.8,dark);for(const x of [-0.65,0.65])box(g,x,0.38,0,0.1,0.34,0.8,wood);for(const z of [-0.35,0.35])box(g,0,0.38,z,1.4,0.34,0.1,wood);if((f.stock||0)>0)box(g,0,0.24+(f.stock||0)/120,0,1.18,0.08+(f.stock||0)/120,0.57,0xc5aa66);break
    case 'perch':for(const x of [-0.55,0.55])post(g,x,0.82,0,0.06,1.64,dark);box(g,0,1.66,0,1.5,0.08,0.3,wood);if(!f.open)for(const x of [-0.6,-0.3,0,0.3,0.6])box(g,x,1.8,0,0.06,0.22,0.32,0xb37855);break
    case 'burrow':ball(g,0,0.24,0,0.65,0.44,0.6,0x6a7941);const hole=new T.Mesh(new T.CircleGeometry(0.25,24),mat(f.open?0x25271c:wood));hole.position.set(0,0.24,0.57);g.add(hole);if(!f.open)for(const x of [-0.16,0,0.16])box(g,x,0.24,0.6,0.035,0.38,0.035,dark);break
  }
  return g
}
/** Clearly identified development representations; replaced only by admitted asset packages. */
export function animalVisual(a:Animal){const g=new T.Group(),s=SPECIES[a.species],color=s.color,legs:T.Object3D[]=[]
  if(a.species==='fish'){ball(g,0,0,0,0.5,0.2,0.17,color);const tail=new T.Mesh(new T.ConeGeometry(0.25,0.35,3),mat(color));tail.rotation.z=Math.PI/2;tail.position.x=-0.55;g.add(tail);ball(g,0.33,0.08,0.14,0.025,0.025,0.025,0x18221a);legs.push(tail)}
  else if(a.species==='bird'||a.species==='chicken'){ball(g,0,0.45,0,0.27,0.3,0.38,color);ball(g,0,0.82,0.22,0.18,0.2,0.18,color);const beak=new T.Mesh(new T.ConeGeometry(0.07,0.22,4),mat(0xc69748));beak.rotation.x=Math.PI/2;beak.position.set(0,0.81,0.44);g.add(beak);for(const x of [-0.3,0.3]){const wing=ball(g,x,0.5,0,0.11,0.18,0.32,color);legs.push(wing)}if(a.species==='chicken')ball(g,0,1.02,0.18,0.07,0.12,0.14,0xa44b38);for(const x of [-0.12,0.12])post(g,x,0.16,0,0.025,0.32,0xb28b40)}
  else if(a.species==='frog'){ball(g,0,0.16,0,0.4,0.18,0.38,color);for(const x of [-0.28,0.28]){ball(g,x,0.15,-0.2,0.25,0.12,0.23,color);ball(g,x*0.7,0.34,0.24,0.08,0.1,0.08,0xc6c18c);ball(g,x*0.7,0.37,0.3,0.038,0.04,0.028,0x18221a)}}
  else {const longNeck=a.species==='llama'||a.species==='horse';ball(g,0,0.67,0,0.38,0.4,0.66,color);if(a.species==='sheep')for(let i=0;i<9;i++)ball(g,Math.cos(i*2.4)*0.26,0.72+Math.sin(i*1.7)*0.16,(i/9-0.5)*0.9,0.26,0.3,0.25,color)
    if(longNeck)ball(g,0,1.06,0.4,0.18,0.58,0.22,color)
    const headY=longNeck?1.6:0.9;ball(g,0,headY,0.64,0.23,0.25,0.35,a.species==='sheep'?0x655c4d:color)
    for(const x of [-0.15,0.15]){const ear=ball(g,x,headY+(a.species==='rabbit'?0.4:0.2),0.6,0.07,a.species==='rabbit'?0.34:0.15,0.06,color);ear.rotation.z=x<0?0.2:-0.2;ball(g,x*1.4,headY+0.04,0.79,0.03,0.034,0.025,0x1e251c)}
    if(a.species==='pig')ball(g,0,headY-0.06,0.95,0.15,0.1,0.05,0xa75f62)
    for(const x of [-0.24,0.24])for(const z of [-0.4,0.4]){const leg=new T.Group();leg.position.set(x,0.51,z);post(leg,0,-0.22,0,0.07,0.46,a.species==='sheep'?0x625448:color);g.add(leg);legs.push(leg)}
    ball(g,0,0.78,-0.69,0.11,0.12,0.18,color)
  }
  g.scale.setScalar(s.scale*(a.age<s.maturity?0.55:1));g.userData.legs=legs;g.userData.developmentVisual=true;return g
}
export function cropVisual(kind:'barley'|'carrot',progress:number,watered:boolean){const g=new T.Group();box(g,0,0.015,0,0.86,0.04,0.86,watered?0x453928:0x715638);const growth=0.1+Math.min(1,progress)*0.6;for(let i=0;i<5;i++){const x=(i%3-1)*0.21,z=(Math.floor(i/3)-0.5)*0.29;post(g,x,growth/2,z,0.016,growth,kind==='barley'&&progress>=1?0xc5a65a:0x5a7832);if(kind==='barley')ball(g,x,growth,z,0.045,0.15,0.04,progress>=1?0xd2b468:0x73933b);else{const leaf=ball(g,x,growth*0.6,z,0.08,0.15,0.06,0x638431);leaf.rotation.z=(i-2)*0.22}}return g}
export function disposeObject(root:T.Object3D){root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){if([...materials.values()].includes(m))continue;const map=(m as T.MeshStandardMaterial).map;map?.dispose();m.dispose()}}})}
