import * as T from 'three'
import { World, Point } from '@shared/shire/model'
import { CombatActor } from '@shared/shire/combatTypes'
import { actorHeight, actorEnabled } from '@shared/shire/combat'
import { hostileDefinition } from '@shared/shire/hostiles'
import { height } from '@shared/shire/terrain'
import { LoadManager } from '../LoadManager'

type Visual={root:T.Group;model:T.Object3D;mixer:T.AnimationMixer;actions:Map<string,T.AnimationAction>;current?:T.AnimationAction;state:string;serial:number;generation:number;bar:T.Sprite;ring:T.Mesh;texture:T.CanvasTexture;canvas:HTMLCanvasElement;health:string;hit:number;flashUntil:number}
export class WorldCombatView {
  private visuals=new Map<string,Visual>()
  private pending=new Set<string>()
  private failures=new Map<string,string>()
  private disposed=false
  private elapsed=0
  private arrows=new Map<number,T.Group>()
  private observedTime=-1
  private observedAt=0
  private lastEvent:number|undefined
  constructor(private scene:T.Scene,private message:(text:string)=>void){}
  get roots(){return [...this.visuals.values()].map(v=>v.root)}
  get diagnostics(){return {loaded:[...this.visuals.entries()].map(([id,v])=>({id,clip:v.current?.getClip().name,actions:[...v.actions.keys()],position:v.root.position.toArray(),visible:v.root.visible,meshes:(()=>{let n=0;v.model.traverse(o=>{if(o instanceof T.Mesh)n++});return n})()})),loading:[...this.pending],failures:Object.fromEntries(this.failures)}}
  retry(){this.failures.clear()}
  private async load(a:CombatActor,url:string){
    this.pending.add(a.id)
    try{
      const model=await LoadManager.glTFLoad(url)
      if(this.disposed){LoadManager.releaseClone(model);return}
      const d=hostileDefinition(a.species)!,names=[d.idle,d.locomotion,d.attack,...(d.death?[d.death,d.hit]:[])]
      for(const name of names)if(!model.animations.some(c=>c.name===name)){LoadManager.releaseClone(model);throw Error(`Missing animation: ${name}`)}
      const root=new T.Group();root.position.copy(a.position);root.rotation.y=a.yaw;root.userData={id:a.id,kind:'enemy',label:a.name};root.add(model)
      // Authored roster GLBs already use metres. Only the older Cinderlord needs fitting.
      if(a.species==='cinderlord'){const bounds=new T.Box3().setFromObject(model),scale=d.height/Math.max(.01,bounds.max.y-bounds.min.y);model.scale.setScalar(scale);model.position.y=-bounds.min.y*scale}
      model.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false}})
      const mixer=new T.AnimationMixer(model),actions=new Map<string,T.AnimationAction>()
      for(const clip of model.animations){const action=mixer.clipAction(clip);if([d.attack,d.hit,d.death].includes(clip.name)){action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true}actions.set(clip.name,action)}
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=80;const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace
      const bar=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:true,transparent:true}));bar.position.y=d.height+.5;bar.scale.set(Math.max(2.8,d.radius*2),.55,1);root.add(bar)
      const ring=new T.Mesh(new T.RingGeometry(d.reach-.10,d.reach,48),new T.MeshBasicMaterial({color:0xf7ae45,transparent:true,opacity:.65,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.08;root.add(ring);ring.visible=false
      this.scene.add(root);this.visuals.set(a.id,{root,model,mixer,actions,state:'',serial:-1,generation:a.generation,bar,ring,texture,canvas,health:'',hit:a.hitSerial,flashUntil:0})
    }catch(e){this.failures.set(a.id,(e as Error).message);this.message(`${a.name} could not load: ${(e as Error).message}`)}finally{this.pending.delete(a.id)}
  }
  update(dt:number,w:World,player:Point,assets:Map<string,string>){
    this.elapsed+=dt;this.projectiles(w)
    this.lastEvent??=w.combat?.events.at(-1)?.seq||0
    for(const a of w.combat?.actors||[]){
      if(a.kind!=='hostile')continue
      if(!actorEnabled(w,a)||w.life?.interior){if(this.visuals.has(a.id))this.remove(a.id);continue}
      const distance=Math.hypot(a.position.x-player.x,a.position.z-player.z),d=hostileDefinition(a.species)!,v=this.visuals.get(a.id)
      if(!v){const url=assets.get(d.assetId);if(url&&distance<190&&!this.pending.has(a.id)&&!this.failures.has(a.id))void this.load(a,url);continue}
      if(distance>320){this.remove(a.id);continue}
      v.root.visible=distance<240
      v.root.position.lerp(new T.Vector3(a.position.x,a.position.y,a.position.z),1-Math.exp(-dt*12));v.root.rotation.y=a.yaw
      if(a.generation!==v.generation){v.generation=a.generation;v.model.rotation.z=0;v.state='';v.current=undefined;v.mixer.stopAllAction()}
      const dead=a.vitality.hp===0,attacking=a.phase==='windup'||a.phase==='recover'
      let name=dead?d.death:attacking?d.attack:['chase','patrol','return'].includes(a.phase)?d.locomotion:d.idle
      if(!dead&&a.phase==='patrol'&&d.movement==='ground'&&v.actions.has('walk'))name='walk'
      if(a.hitSerial!==v.hit){v.hit=a.hitSerial;v.flashUntil=this.elapsed+.22;if(!dead&&!attacking)name=d.hit}
      if(this.elapsed<v.flashUntil&&!dead&&!attacking)name=d.hit
      const action=v.actions.get(name)
      if(action&&(name!==v.state||(attacking&&a.attackSerial!==v.serial))){v.current?.fadeOut(.12);action.reset().fadeIn(.12).play();v.current=action;v.state=name;v.serial=a.attackSerial
        if(attacking){action.timeScale=action.getClip().duration/(d.windup+d.recovery)}else action.timeScale=1
      }
      if(dead&&!d.death){v.mixer.timeScale=0;v.model.rotation.z=T.MathUtils.damp(v.model.rotation.z,Math.PI*.46,3,dt)}else{v.mixer.timeScale=1;v.mixer.update(dt)}
      if(dead&&d.movement==='air')v.root.position.y=T.MathUtils.damp(v.root.position.y,height(a.position.x,a.position.z,w),5,dt)
      const status=`${Math.ceil(a.vitality.hp)}/${a.vitality.maxHp}`,label=`${a.name} · ${dead?'defeated':status}`;v.root.userData.label=label
      const healthKey=`${label}:${a.phase}`
      if(v.health!==healthKey){v.health=healthKey;const ctx=v.canvas.getContext('2d')!;ctx.clearRect(0,0,512,80);ctx.fillStyle='rgba(15,24,20,.85)';ctx.fillRect(0,0,512,80);ctx.font='bold 25px sans-serif';ctx.fillStyle='#fff0d2';ctx.textAlign='center';ctx.fillText(label,256,29);ctx.fillStyle='#542627';ctx.fillRect(14,45,484,17);ctx.fillStyle=a.phase==='windup'?'#ffbd5c':'#b9ce7b';ctx.fillRect(14,45,484*a.vitality.hp/a.vitality.maxHp,17);v.texture.needsUpdate=true}
      const barWidth=Math.min(Math.max(2.8,d.radius*2),Math.max(.4,distance*.28));v.bar.scale.set(barWidth,barWidth*.16,1)
      v.bar.visible=distance<55;v.ring.visible=a.phase==='windup'&&!dead;v.ring.material instanceof T.MeshBasicMaterial&&(v.ring.material.opacity=w.life?.settings.reducedMotion?.6:.35+.3*Math.sin(this.elapsed*10)**2)
      v.model.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial){m.userData.baseEmission??=m.emissive.clone();m.emissive.copy(m.userData.baseEmission);if(this.elapsed<v.flashUntil&&!w.life?.settings.reducedMotion)m.emissive.add(new T.Color(.5,.08,.015))}})
    }
    for(const e of w.combat?.events||[])if(e.seq>this.lastEvent){this.lastEvent=e.seq;if(e.target==='player'&&e.type==='damage')this.message(`You took ${e.amount} ${e.damageType} damage.`);if(e.target==='player'&&e.type==='death')this.message('You are defeated. Recover at home to continue.');if(e.type==='blocked'&&e.target==='player')this.message('Blocked! Your guard reduced the blow.')}
  }
  private projectiles(w:World){
    if(w.time!==this.observedTime){this.observedTime=w.time;this.observedAt=this.elapsed}
    const shots=w.combat?.projectiles||[],ids=new Set(shots.map(s=>s.id))
    for(const [id,root]of this.arrows)if(!ids.has(id)){this.scene.remove(root);root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(o.material as T.Material).dispose()}});this.arrows.delete(id)}
    for(const shot of shots){let root=this.arrows.get(shot.id);if(!root){root=new T.Group();const arrow=shot.source==='player';const mesh=new T.Mesh(arrow?new T.CylinderGeometry(.015,.015,.75,5):new T.IcosahedronGeometry(.12,0),new T.MeshStandardMaterial({color:arrow?0x927449:0x777c76}));if(arrow)mesh.rotation.x=Math.PI/2;root.add(mesh);if(arrow){const head=new T.Mesh(new T.ConeGeometry(.055,.16,4),new T.MeshStandardMaterial({color:0xc6cbcb}));head.rotation.x=Math.PI/2;head.position.z=.43;root.add(head)}this.arrows.set(shot.id,root);this.scene.add(root)}
      const t=T.MathUtils.clamp((w.time+this.elapsed-this.observedAt-shot.launched)/(shot.arrives-shot.launched),0,1),p=new T.Vector3().lerpVectors(new T.Vector3().copy(shot.start),new T.Vector3().copy(shot.end),t);p.y+=Math.sin(t*Math.PI)*(shot.source==='player'?.15:1);root.position.copy(p);root.lookAt(shot.end.x,shot.end.y,shot.end.z);root.visible=!w.life?.interior&&t<1
    }
  }
  private remove(id:string){const v=this.visuals.get(id);if(!v)return;v.mixer.stopAllAction();v.mixer.uncacheRoot(v.model);LoadManager.releaseClone(v.model);v.bar.material.dispose();v.texture.dispose();v.ring.geometry.dispose();(v.ring.material as T.Material).dispose();this.scene.remove(v.root);this.visuals.delete(id)}
  dispose(){this.disposed=true;for(const arrow of this.arrows.values()){this.scene.remove(arrow);arrow.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(o.material as T.Material).dispose()}})}this.arrows.clear();for(const id of this.visuals.keys())this.remove(id)}
}
