import * as T from 'three'
import type { World, Point, WorldAction } from '@shared/shire/model'
import { places, dayAt, hourAt, seasonAt, PROFESSIONS } from '@shared/shire/lifeContent'
import { resourceNodes, ferryCrossing, storyPlaces } from '@shared/shire/lifeSpatial'
import { roomObjects } from '@shared/shire/interiors'
import { height, clear } from '@shared/shire/terrain'
import { isAtlas, waterAt, ATLAS_PLACES } from '@shared/shire/atlas'
import { box, post, mat, sign, disposeObject } from './visuals'
import { LoadManager } from '../LoadManager'

export type LifeTarget='entrance'|'resource'|'room-service'|'special-crop'|'ferry'|'rune'|'gate'|'landmark'
export class LifeScene {
  readonly root=new T.Group()
  private objects:T.Object3D[]=[]
  private stamp=''
  private roomLight=new T.PointLight(0xffd39a,15,26,1.3)
  private roomAmbient=new T.AmbientLight(0xe0c29b,.8)
  private keeper?:T.Object3D
  private keeperMixer?:T.AnimationMixer
  private loadingKeeper=''
  private disposed=false
  private rain:T.Points
  private rainPositions:Float32Array
  private rainGeo=new T.BufferGeometry()
  private marker=new T.Group()
  private ship=new T.Group()
  private elapsed=0
  constructor(private scene:T.Scene){
    this.root.name='Village activities';scene.add(this.root,this.roomLight,this.roomAmbient,this.marker,this.ship)
    this.roomLight.visible=false;this.roomAmbient.visible=false
    this.rainPositions=new Float32Array(1200*3);for(let i=0;i<1200;i++){this.rainPositions[i*3]=(Math.random()-.5)*45;this.rainPositions[i*3+1]=Math.random()*25;this.rainPositions[i*3+2]=(Math.random()-.5)*45}
    this.rainGeo.setAttribute('position',new T.BufferAttribute(this.rainPositions,3));this.rain=new T.Points(this.rainGeo,new T.PointsMaterial({color:0xcddfdc,size:.05,transparent:true,opacity:.55,depthWrite:false}));scene.add(this.rain)
    const ring=new T.Mesh(new T.RingGeometry(.7,.76,40),new T.MeshBasicMaterial({color:0xe8d390,transparent:true,opacity:.75,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.08;this.marker.add(ring);post(this.marker,0,1.3,0,.035,2.6,0xc5aa62)
    box(this.ship,0,-.18,0,3.8,.35,5,0x6a4931);for(const side of [-1,1]){box(this.ship,side*1.7,.6,0,.08,.1,4.6,0x8c6b40);for(const z of [-2,2])post(this.ship,side*1.7,.3,z,.07,.8,0x765431)}this.ship.visible=false
  }
  get interactables(){return [...this.objects,...(this.keeper?[this.keeper]:[])]}
  action(kind:LifeTarget,id:string):WorldAction{
    if(kind==='gate'||kind==='landmark')return {type:'life',action:{kind,id}}
    if(kind==='entrance')return {type:'life',action:id==='interior-exit'?{kind:'exit'}:{kind:'enter',id}}
    if(kind==='resource')return {type:'life',action:{kind:'gather',id}}
    if(kind==='special-crop')return {type:'life',action:{kind:'harvest-special',id}}
    if(kind==='ferry')return {type:'life',action:{kind:'ferry'}}
    if(kind==='rune')return {type:'life',action:{kind:'barrow-rune',rune:id as 'leaf'|'river'|'star'}}
    if(id==='chair')return {type:'life',action:{kind:'sit',id}}
    return {type:'life',action:{kind:'service',id:id==='bed'?'rest':'news'}}
  }
  private interact(root:T.Object3D,kind:LifeTarget,id:string,label:string){root.userData={id,kind,label};this.objects.push(root);this.root.add(root)}
  private clear(){disposeObject(this.root);this.root.clear();this.objects=[];if(this.keeper){this.keeperMixer?.stopAllAction();LoadManager.releaseClone(this.keeper);this.keeper.removeFromParent();this.keeper=undefined;this.keeperMixer=undefined}this.loadingKeeper=''}
  private room(w:World){
    const r=w.life!.interior!,g=new T.Group(),o=r.origin;g.position.set(o.x,o.y,o.z);this.root.add(g)
    const barrow=r.kind==='barrow',plaster=barrow?0x626a64:0xc4b58e,timber=barrow?0x424d48:0x73563b;box(g,0,-.14,0,r.width,.28,r.depth,barrow?0x535c54:0x8e6c45)
    if(barrow){for(let x=-r.width/2;x<r.width/2;x+=1.5)for(let z=-r.depth/2;z<r.depth/2;z+=1.5)box(g,x+.73,.009,z+.73,1.44,.014,1.44,((Math.floor(x+z)%3)+3)%3===0?0x657066:0x5b635a)}else for(let x=-r.width/2;x<r.width/2;x+=.65)box(g,x+.32,.006,0,.012,.014,r.depth,0x503b2c)
    for(const side of [-1,1]){box(g,side*(r.width/2+.15),2,0,.3,4,r.depth+.6,plaster);box(g,0,2,side*(r.depth/2+.15),r.width,.3+3.7,.3,plaster);for(let z=-r.depth/2;z<=r.depth/2;z+=3)box(g,side*(r.width/2-.08),2,z,.16,4,.22,timber)}
    box(g,0,4.1,0,r.width,.2,r.depth,barrow?0x46534a:0xb2a384);for(let z=-r.depth/2+1;z<r.depth/2;z+=3)box(g,0,3.9,z,r.width,.2,.22,timber)
    const carpet=new T.Mesh(new T.PlaneGeometry(Math.min(6,r.width-4),Math.min(9,r.depth-4)),mat(r.kind==='barrow'?0x686e54:0x667f66));carpet.rotation.x=-Math.PI/2;carpet.position.set(0,.025,1);g.add(carpet)
    for(const object of roomObjects(r)){
      const p=new T.Group();p.position.set(o.x+object.x,o.y,o.z+object.z)
      const {w:wide,d:deep,h}=object
      if(object.kind==='table'||object.kind==='bench'){box(p,0,h-.06,0,wide,.12,deep,timber);for(const x of [-wide/2+.15,wide/2-.15])for(const z of [-deep/2+.15,deep/2-.15])post(p,x,h/2,z,.065,h,timber);if(object.id==='table'){const bowl=new T.Mesh(new T.SphereGeometry(.24,18,12,0,Math.PI*2,0,Math.PI/2),mat(0xb27742));bowl.rotation.x=Math.PI;bowl.position.set(0,h+.18,0);p.add(bowl);for(let i=0;i<3;i++)box(p,-.7+i*.6,h+.04,.25,.24,.03,.2,0xe3d2a1)}}
      else if(object.kind==='bed'){box(p,0,.18,0,wide,.35,deep,timber);box(p,0,.42,0,wide-.15,.25,deep-.1,0xd6c6a3);box(p,0,.56,.3,wide-.18,.08,deep-1,0x638070);box(p,0,.62,-deep/2+.45,wide*.65,.18,.55,0xeee2c5);box(p,0,.58,-deep/2,wide,1.1,.12,timber)}
      else if(object.kind==='shelf'){for(const z of [-deep/2,deep/2])box(p,0,h/2,z,wide,h,.14,timber);for(let y=.2;y<h;y+=.48){box(p,0,y,0,wide,.08,deep,timber);for(let i=0;i<5;i++)box(p,0,y+.16,-deep/2+.4+i*(deep-.8)/5,wide*.5,.24,.18,[0x768451,0x9b7043,0x55797a][i%3])}}
      else if(object.kind==='chair'){box(p,0,.47,0,wide,.12,deep,timber);box(p,0,.8,deep/2,wide,.6,.1,timber);for(const x of [-.24,.24])for(const z of [-.24,.24])post(p,x,.23,z,.04,.46,timber)}
      else if(object.kind==='hearth'){box(p,0,.9,0,wide,1.8,deep,0x877c67);box(p,0,.42,deep/2+.03,wide*.7,.7,.05,0x272b25);for(let i=0;i<3;i++){const flame=new T.Mesh(new T.ConeGeometry(.12,.42,7),new T.MeshStandardMaterial({color:0xfab849,emissive:0xec8323,emissiveIntensity:1.5}));flame.position.set(-.3+i*.3,.27,deep/2+.08);p.add(flame)}post(p,0,1.95,0,.35,.7,0x796b59)}
      else if(object.kind==='millstone'){post(p,0,.5,0,wide/2,.45,0x807e70);post(p,0,.82,0,.08,.8,timber);box(p,.7,1.15,0,1.5,.12,.12,timber)}
      else if(object.kind==='anvil'){box(p,0,.25,0,.6,.5,.6,timber);box(p,0,.65,0,.55,.45,.6,0x3e4944);box(p,0,.91,0,1.3,.18,.7,0x56615b)}
      else if(object.kind==='rune'){post(p,0,.6,0,.5,1.2,0x687467);const lit=!!w.life?.stats.barrowToken||['leaf','river','star'].indexOf(object.id)<(w.life?.stats.barrowSequence||0);const plaque=sign(object.id.toUpperCase(),1);plaque.position.set(0,1.25,.12);p.add(plaque);const glow=new T.Mesh(new T.TorusGeometry(.32,.026,6,24),new T.MeshStandardMaterial({color:lit?0xc6e4a4:0x89a090,emissive:0x89c077,emissiveIntensity:lit?1.5:.08}));glow.position.set(0,.65,.47);p.add(glow)}
      else{box(p,0,h/2,0,wide,h,deep,timber);box(p,0,h*.6,deep/2+.01,.18,.2,.035,0xb39a59)}
      const label=object.id==='hearth'?'Kitchen · open Satchel to cook':object.id==='bench'?'Workbench · open Satchel to craft':object.id==='millstone'?'Mill · open Satchel for flour':object.id==='anvil'?'Smithy · open Satchel to forge':object.label
      this.interact(p,object.kind==='rune'?'rune':'room-service',object.id,label)
    }
    const exit=new T.Group();exit.position.set(o.x,o.y,o.z+r.depth/2-.2);const door=new T.Mesh(new T.CircleGeometry(1.2,40),mat(0x476641));door.position.y=1.2;door.rotation.y=Math.PI;exit.add(door);const board=sign('Out to the lane',2);board.position.set(0,2.7,-.03);board.rotation.y=Math.PI;exit.add(board);this.interact(exit,'entrance','interior-exit','Step outside')
    this.roomLight.position.set(o.x,o.y+3,o.z);this.roomLight.color.setHex(barrow?0xb5cdaa:0xffd39a);this.roomLight.intensity=barrow?10:15;this.roomAmbient.color.setHex(barrow?0x9eafa3:0xe0c29b);this.roomAmbient.intensity=barrow?.55:.8;this.roomAmbient.visible=true;this.roomLight.visible=true
  }
  private outdoors(w:World,p:Point){
    if(isAtlas(w)){
      if(Math.hypot(p.x-83900,p.z-12900)<200){const g=new T.Group(),y=height(83900,12900,w);g.position.set(83896,y,12900);if(w.life?.gates?.['hay-gate'])g.rotation.y=-Math.PI/2;for(const h of [1.2,2.5])box(g,3.75,h,0,7.5,.2,.2,0x665039);for(const x of [.15,7.35])post(g,x,1.4,0,.1,2.6,0x665039);this.interact(g,'gate','hay-gate',w.life?.gates?.['hay-gate']?'Close the Hay Gate':'Open the Hay Gate')}
      for(const landmark of ATLAS_PLACES.filter(p=>['old-man-willow','three-farthing-stone','scary-quarry'].includes(p.id)))if(Math.hypot(p.x-landmark.x,p.z-landmark.z)<200){const g=new T.Group();g.position.set(landmark.x+3,height(landmark.x+3,landmark.z+5,w),landmark.z+5);post(g,0,.7,0,.05,1.4,0x7f6844);const board=sign(landmark.name+'\nUse to investigate',3.5);board.position.y=1.5;g.add(board);this.interact(g,'landmark',landmark.id,`Investigate ${landmark.name}`)}
    }
    for(const place of [...places(w),...storyPlaces(w)])if(Math.hypot(place.door.x-p.x,place.door.z-p.z)<100){const g=new T.Group(),door=place.door;g.position.set(door.x,height(door.x,door.z,w),door.z);g.rotation.y=place.yaw;post(g,.9,.8,0,.035,1.6,0x6c573b);const lantern=new T.Mesh(new T.OctahedronGeometry(.15),new T.MeshStandardMaterial({color:0xf8df96,emissive:0xd4ad5c,emissiveIntensity:.4}));lantern.position.set(.9,1.55,0);g.add(lantern);const plaque=sign(place.kind==='barrow'?'Chamber of three seasons':place.label,Math.min(3.8,place.label.length*.11+1));plaque.position.set(0,2,0);g.add(plaque);this.interact(g,'entrance',place.id,`Enter ${place.label}`)}
    for(const n of resourceNodes(w,p,58)){
      const g=new T.Group();g.position.set(n.position.x,n.position.y,n.position.z)
      if(n.kind==='wood'){for(let i=0;i<3;i++){const log=new T.Mesh(new T.CylinderGeometry(.08,.12,.85,10),mat(i%2?0x735135:0x92724e));log.rotation.z=Math.PI/2;log.rotation.y=i*.35;log.position.set(0,.1+i*.07,(i-1)*.13);g.add(log)}}
      else if(['stone','iron','clay'].includes(n.kind)){for(let i=0;i<3;i++){const rock=new T.Mesh(new T.DodecahedronGeometry(.25+i*.055),mat(n.kind==='clay'?0xa78562:n.kind==='iron'?0x77715f:0x8e9480));rock.position.set((i-1)*.3,.15,Math.sin(i)*.15);rock.scale.y=.6;g.add(rock)}}
      else if(n.kind==='apple'){post(g,0,1.5,0,.1,3,0x725639);const crown=new T.Mesh(new T.SphereGeometry(1.25,14,10),mat(0x668144));crown.position.y=2.8;g.add(crown);for(let i=0;i<9;i++){const fruit=new T.Mesh(new T.SphereGeometry(.095,10,8),mat(0xaf5a38));fruit.position.set(Math.sin(i*2.4),2.65+Math.sin(i)*.6,Math.cos(i*2.4)*.7);g.add(fruit)}}
      else{for(let i=0;i<5;i++){post(g,(i%3-1)*.16,.15,Math.floor(i/3)*.2,.022,.3,0x687846);const plant=new T.Mesh(n.kind==='mushroom'?new T.SphereGeometry(.12,12,8,0,Math.PI*2,0,Math.PI/2):new T.IcosahedronGeometry(.16,1),mat(n.kind==='berry'?0x6c4456:n.kind==='mushroom'?0xc39b6b:0x7d9455));plant.position.set((i%3-1)*.16,.32,Math.floor(i/3)*.2);g.add(plant)}}
      this.interact(g,'resource',n.id,`${n.label} · gather`)
    }
    for(const crop of w.life?.garden||[])if(Math.hypot(crop.position.x-p.x,crop.position.z-p.z)<100){const g=new T.Group();g.position.copy(crop.position);post(g,0,.45,0,.035,.9,0x6e7448);const crown=new T.Mesh(new T.IcosahedronGeometry(crop.crop==='apple'?1:.25,1),mat(crop.crop==='flax'?0x899c61:0x668343));crown.position.y=crop.crop==='apple'?1.8:.5;g.add(crown);this.interact(g,'special-crop',crop.id,`${crop.crop} · ${w.time-crop.harvested>=(crop.crop==='apple'?300:120)?'ready to harvest':'growing'}`)}
    const ends=ferryCrossing(w);if(ends)for(const [i,end]of ends.entries())if(Math.hypot(end.x-p.x,end.z-p.z)<200){const g=new T.Group();g.position.copy(end);box(g,0,-.1,0,5,.2,5,0x876946);const side=i===0?-3.7:3.7;post(g,side,.85,0,.08,1.7,0x765431);const board=sign('Bucklebury Ferry\nUse to cross',2.8);board.position.set(side,1.8,0);g.add(board);this.interact(g,'ferry',`ferry:${i}`,'Board the Brandywine ferry')}
  }
  update(w:World,p:Point,dt:number,assets:Map<string,string>){
    this.elapsed+=dt;const room=w.life?.interior,stamp=room?`room:${room.id}:${room.keeper||""}:${w.life?.stats.barrowSequence||0}:${w.life?.stats.barrowToken||0}`:`out:${Math.floor(p.x/32)}:${Math.floor(p.z/32)}:${Object.keys(w.life?.harvested||{}).length}:${w.life?.garden.map(c=>c.id+Math.floor((w.time-c.harvested)/120)).join(',')}:${Math.floor(w.time/30)}:${JSON.stringify(w.life?.gates)}`
    if(stamp!==this.stamp){this.stamp=stamp;this.clear();this.roomLight.visible=false;this.roomAmbient.visible=false;if(room)this.room(w);else this.outdoors(w,p)}
    this.rain.visible=!!w.life&&!room&&['rain','snow'].includes(w.life.weather.kind)&&!w.life.settings.reducedMotion
    if(this.rain.visible){this.rain.position.set(p.x,p.y,p.z);const snow=w.life!.weather.kind==='snow';for(let i=0;i<1200;i++){this.rainPositions[i*3+1]-=dt*(snow?1.4:13);if(this.rainPositions[i*3+1]<-2)this.rainPositions[i*3+1]=23}this.rainGeo.attributes.position.needsUpdate=true;(this.rain.material as T.PointsMaterial).size=snow?.12:.045}
    this.marker.visible=!!w.life?.waypoint&&!room;if(w.life?.waypoint)this.marker.position.set(w.life.waypoint.position.x,height(w.life.waypoint.position.x,w.life.waypoint.position.z,w)+.1,w.life.waypoint.position.z)
    this.ship.visible=!!w.life?.transport;if(this.ship.visible){this.ship.position.set(p.x,p.y-.08,p.z);const trip=w.life!.transport!;this.ship.rotation.y=Math.atan2(trip.end.x-trip.start.x,trip.end.z-trip.start.z)}
    if(room?.keeper&&!this.keeper&&!this.loadingKeeper){const npc=w.life!.residents.find(r=>r.id===room.keeper),asset=npc&&['bree','staddle','combe','archet'].includes(npc.town)?'resident-human':npc?.female?'resident-hobbit-female':'resident-hobbit-male',url=assets.get(asset);if(url){const requested=`${room.id}:${room.keeper||""}`;this.loadingKeeper=requested;void LoadManager.glTFLoad(url).then(model=>{if(this.disposed||this.stamp!==`room:${requested}`){LoadManager.releaseClone(model);return}const bounds=new T.Box3().setFromObject(model),scale=(asset==='resident-human'?1.7:1.1)/(bounds.max.y-bounds.min.y||1);model.scale.setScalar(scale);const offset=-bounds.min.y*scale;model.position.set(room.origin.x+2,room.origin.y+offset,room.origin.z-2);model.rotation.y=Math.PI;model.userData={id:room.keeper,kind:'resident',label:`${npc!.name} · ${PROFESSIONS[npc!.role].label}`};this.scene.add(model);this.keeper=model;this.keeperMixer=new T.AnimationMixer(model);const clip=model.animations.find(c=>c.name===(npc?.activity==='sleeping'?'rest':'idle'))||model.animations[0];if(clip)this.keeperMixer.clipAction(clip).play()}).finally(()=>this.loadingKeeper='')}}
    this.keeperMixer?.update(dt)
  }
  dispose(){this.disposed=true;this.clear();this.scene.remove(this.root,this.roomLight,this.roomAmbient,this.rain,this.marker,this.ship);this.rainGeo.dispose();(this.rain.material as T.Material).dispose();disposeObject(this.marker);disposeObject(this.ship)}
}
