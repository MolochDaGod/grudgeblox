import * as T from 'three'
import { World, Point } from '@shared/shire/model'
import { clear, height, surfaceAt } from '@shared/shire/terrain'
import { CINDERLORD, CinderlordBrain, cinderlordSite, outsideHome } from '@shared/shire/cinderlord'
import { LoadManager } from '../LoadManager'
import { disposeObject, sign } from './visuals'

export class CinderlordEnemy {
  readonly root=new T.Group()
  readonly brain=new CinderlordBrain()
  readonly site:Point
  private model?:T.Object3D
  private mixer?:T.AnimationMixer
  private actions=new Map<string,T.AnimationAction>()
  private current?:T.AnimationAction
  private loading=false
  private attempted=false
  private disposed=false
  private elapsed=0
  private shockTime=1
  private ring:T.Mesh<T.RingGeometry,T.MeshBasicMaterial>
  private light=new T.PointLight(0xff6418,85,15,2)
  private scenery=new T.Group()
  constructor(private scene:T.Scene,w:World,private message:(text:string)=>void){
    this.site=cinderlordSite(w);this.root.position.set(this.site.x,this.site.y,this.site.z)
    this.root.userData={id:'cinderlord',kind:'enemy',label:'Cinderlord · magma guardian'}
    this.light.position.y=2.8;this.root.add(this.light);scene.add(this.root,this.scenery)
    const ground=new T.CircleGeometry(18,64);ground.rotateX(-Math.PI/2)
    const vertices=ground.attributes.position
    for(let i=0;i<vertices.count;i++)vertices.setY(i,height(this.site.x+vertices.getX(i),this.site.z+vertices.getZ(i),w)-this.site.y+0.035)
    ground.computeVertexNormals()
    const scar=new T.Mesh(ground,new T.MeshStandardMaterial({color:0x302a25,roughness:1,polygonOffset:true,polygonOffsetFactor:-1}));scar.position.set(this.site.x,this.site.y,this.site.z);scar.receiveShadow=true;this.scenery.add(scar)
    const board=sign('ASHEN HOLLOW\nCINDERLORD · KEEP YOUR DISTANCE',6);board.position.set(this.site.x+9,height(this.site.x+9,this.site.z+31,w)+2.2,this.site.z+31);this.scenery.add(board)
    this.ring=new T.Mesh(new T.RingGeometry(0.88,1,80),new T.MeshBasicMaterial({color:0xff5f13,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}));this.ring.rotation.x=-Math.PI/2;this.scenery.add(this.ring)
  }
  get loaded(){return !!this.model}
  get status(){return this.model?`${CINDERLORD.name} · ${this.brain.phase==='defeated'?'defeated':`${this.brain.health}/${CINDERLORD.health} · ${this.brain.phase}`}`:'Cinderlord · loading model'}
  load(url:string|undefined,player:Point){
    if(!url||this.attempted||this.loading||Math.hypot(player.x-this.site.x,player.z-this.site.z)>180)return
    this.loading=true;this.attempted=true
    void LoadManager.glTFLoad(url).then(model=>{
      if(this.disposed){LoadManager.releaseClone(model);return}
      const names=['Idle','Walk','GroundSmash','Yell']
      if(names.some(name=>!model.animations.some(c=>c.name===name))){LoadManager.releaseClone(model);throw Error('Missing Cinderlord animation')}
      const bounds=new T.Box3().setFromObject(model),scale=CINDERLORD.height/Math.max(0.01,bounds.max.y-bounds.min.y)
      model.scale.setScalar(scale);model.position.y=-bounds.min.y*scale
      model.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false}})
      this.model=model;this.root.add(model);this.mixer=new T.AnimationMixer(model)
      for(const clip of model.animations){const action=this.mixer.clipAction(clip);if(clip.name==='GroundSmash'||clip.name==='Yell'){action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true}this.actions.set(clip.name,action)}
      this.play('Idle');this.message('Cinderlord prowls Ashen Hollow. Dodge the orange smash ring. E strikes within reach.')
    }).catch(()=>{if(!this.disposed)this.message('Cinderlord could not load. Save and reopen the world to retry the local model.')}).finally(()=>{this.loading=false})
  }
  private play(name:string){const next=this.actions.get(name);if(!next||next===this.current)return;next.reset().fadeIn(0.18).play();this.current?.fadeOut(0.18);this.current=next}
  strike(player:Point,w:World){
    if(!this.loaded)return
    const distance=Math.hypot(player.x-this.root.position.x,player.z-this.root.position.z)
    if(this.brain.strike(distance,outsideHome(w,player)&&outsideHome(w,this.site)&&Math.abs(player.y-this.root.position.y)<3))this.message(this.brain.health?`Your strike cracks the crust. Cinderlord: ${this.brain.health}/${CINDERLORD.health}.`:'Cinderlord collapses. The furnace will rekindle in 45 seconds.')
    else if(distance>CINDERLORD.strikeRange)this.message('Move within 5.5 metres to strike, then dodge the ground smash.')
  }
  update(dt:number,player:World['player'],w:World){
    if(!this.model||!this.mixer)return false
    this.elapsed+=dt;const pos=this.root.position,dx=player.x-pos.x,dz=player.z-pos.z,distance=Math.hypot(dx,dz),homeDistance=Math.hypot(pos.x-this.site.x,pos.z-this.site.z)
    const active=outsideHome(w,player)&&outsideHome(w,this.site)&&Math.abs(player.y-pos.y)<4
    const impact=this.brain.tick(dt,distance,homeDistance,active),phase=this.brain.phase
    this.root.userData.label=this.status
    if(phase==='defeated'){
      this.mixer.timeScale=0;this.model.rotation.z=T.MathUtils.damp(this.model.rotation.z,Math.PI*.46,2,dt);this.light.intensity=3;return false
    }
    this.model.rotation.z=T.MathUtils.damp(this.model.rotation.z,0,5,dt);this.mixer.timeScale=1
    let tx=pos.x,tz=pos.z,speed=0
    if(phase==='patrol'){tx=this.site.x+Math.sin(this.elapsed*.17)*5;tz=this.site.z+Math.cos(this.elapsed*.17)*5;speed=1.1}
    if(phase==='return'){tx=this.site.x;tz=this.site.z;speed=2.2}
    if(phase==='chase'){tx=player.x;tz=player.z;speed=2.8}
    if(speed){const mx=tx-pos.x,mz=tz-pos.z,length=Math.hypot(mx,mz);if(length>.1){const step=Math.min(length,speed*dt),nx=pos.x+mx/length*step,nz=pos.z+mz/length*step,ny=surfaceAt(nx,nz,w,height(nx,nz,w)+4);if(Math.abs(ny-pos.y)<.5&&clear({x:nx,y:ny+.08,z:nz},w)){pos.set(nx,ny,nz);this.root.rotation.y=Math.atan2(mx,mz)}}}
    else if(phase==='yell'||phase==='smash')this.root.rotation.y=Math.atan2(dx,dz)
    this.play(phase==='smash'?'GroundSmash':phase==='yell'?'Yell':speed?'Walk':'Idle')
    this.mixer.update(dt);this.light.intensity=75+Math.sin(this.elapsed*8)*12
    this.shockTime+=dt
    if(phase==='smash'&&this.brain.time<CINDERLORD.impactTime){this.ring.position.set(pos.x,pos.y+.07,pos.z);this.ring.scale.setScalar(CINDERLORD.impactRange);this.ring.material.opacity=.13+.15*Math.sin(this.elapsed*14)**2}
    else if(this.shockTime<.65){this.ring.scale.setScalar(.7+this.shockTime/.65*CINDERLORD.impactRange);this.ring.material.opacity=(1-this.shockTime/.65)*.85}
    else this.ring.material.opacity=0
    if(impact){this.shockTime=0;this.ring.position.set(pos.x,pos.y+.09,pos.z)}
    // Sweep knockback in small collision-checked steps; walls and earth stop it.
    if(impact&&active&&distance<CINDERLORD.impactRange&&Math.abs(player.y-pos.y)<2.6){
      const nx=distance>.01?dx/distance:0,nz=distance>.01?dz/distance:1
      for(let i=0;i<40;i++){const x=player.x+nx*.16,z=player.z+nz*.16,y=Math.max(player.y,surfaceAt(x,z,w,player.y+.4)+.08);if(y-player.y>.38||!clear({x,y,z},w))break;player.x=x;player.y=y;player.z=z}
      this.message('The ground smash throws you back. Step beyond the orange ring before impact.');return true
    }
    if(distance<1.65&&distance>.01&&active){const p={x:pos.x+dx/distance*1.7,y:player.y,z:pos.z+dz/distance*1.7};if(clear(p,w)){player.x=p.x;player.z=p.z}}
    return false
  }
  dispose(){this.disposed=true;this.mixer?.stopAllAction();if(this.model){this.mixer?.uncacheRoot(this.model);LoadManager.releaseClone(this.model)}this.scene.remove(this.root,this.scenery);disposeObject(this.scenery);this.light.dispose()}
}
