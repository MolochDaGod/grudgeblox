import * as T from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { World, Point } from '@shared/shire/model'
import { height, clear } from '@shared/shire/terrain'
import { waterAt } from '@shared/shire/atlas'

type Entry={key:string;name:string;model:string;spawn:boolean;habitat:string;length_m:number;clips:string[];animation_status:string;preferred_clip?:string;role?:string}
type Actor={root:T.Group;model:T.Object3D;mixer:T.AnimationMixer;entry:Entry;origin:T.Vector3;direction:T.Vector3}
/** Independent ambient population; original models and every source clip remain in the library. */
export class WorkbenchLibrary {
  entries:Entry[]=[];actors:Actor[]=[];private cache=new Map<string,Promise<T.Object3D>>();private disposed=false;private timer=0;private loading=false
  private revision='';private epoch=0;private refreshing=false;private polling:ReturnType<typeof setInterval>
  constructor(private scene:T.Scene){void this.refresh();this.polling=setInterval(()=>void this.refresh(),2000)}
  async refresh(){if(this.disposed||this.refreshing)return;this.refreshing=true;try{const response=await fetch('/workbench/library.json',{cache:'no-store'});if(!response.ok)return;const text=await response.text(),data=JSON.parse(text);if(!Array.isArray(data.assets)||this.disposed)return
    if(text!==this.revision){this.epoch++;for(const actor of this.actors){actor.mixer.stopAllAction();actor.mixer.uncacheRoot(actor.model);this.scene.remove(actor.root)}this.actors=[];this.releaseCache();this.entries=data.assets;this.revision=text;this.timer=0}
    void fetch('/api/workbench',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entries:this.entries.length,actors:this.actors.length,updated:data.updated||'',live_updates:true})}).catch(()=>{})
  }catch(error){console.warn('Workbench library refresh',error)}finally{this.refreshing=false}}
  async instantiate(key:string){const entry=this.entries.find(e=>e.key===key);if(!entry)throw Error('Workbench asset missing')
    let promise=this.cache.get(key);if(!promise){promise=new GLTFLoader().loadAsync('/workbench/'+entry.model).then(g=>{g.scene.animations=g.animations;return g.scene});this.cache.set(key,promise)}
    const source=await promise,model=clone(source);model.animations=source.animations;model.userData.workbench=entry;return model
  }
  private permitted(world:World,x:number,z:number,habitat:string){const floor=height(x,z,world),water=waterAt(x,z,world);return habitat==='water'?Number.isFinite(water)&&water-floor>.5:habitat==='air'||(!Number.isFinite(water)||floor>=water)&&clear({x,y:floor+.15,z},world)}
  update(dt:number,world:World,player:Point){if(this.disposed||dt<=0)return
    for(const a of [...this.actors]){a.root.visible=!world.life?.interior;if(Math.hypot(a.root.position.x-player.x,a.root.position.z-player.z)>100){a.mixer.stopAllAction();this.scene.remove(a.root);this.actors.splice(this.actors.indexOf(a),1);continue}if(world.life?.interior)continue
      if(!a.entry.role||['creature','character'].includes(a.entry.role)){const next=a.root.position.clone().addScaledVector(a.direction,dt*.6);if(next.distanceTo(a.origin)>6||!this.permitted(world,next.x,next.z,a.entry.habitat))a.direction.applyAxisAngle(T.Object3D.DEFAULT_UP,1.7);else{next.y=a.entry.habitat==='water'?waterAt(next.x,next.z,world)-.3:height(next.x,next.z,world)+(a.entry.habitat==='air'?4:0);a.root.position.copy(next);a.root.rotation.y=Math.atan2(-a.direction.x,-a.direction.z)}}a.mixer.update(dt)
    }
    this.timer-=dt;if(this.timer>0||this.loading||this.actors.length>=12||world.life?.interior)return;this.timer=1
    const candidates=this.entries.filter(e=>e.spawn);if(!candidates.length)return;const entry=candidates[Math.floor(Math.random()*candidates.length)]
    for(let i=0;i<8;i++){const x=player.x+(Math.random()-.5)*70,z=player.z+(Math.random()-.5)*70;if(!this.permitted(world,x,z,entry.habitat))continue
      const origin=new T.Vector3(x,entry.habitat==='water'?waterAt(x,z,world)-.3:height(x,z,world)+(entry.habitat==='air'?4:0),z);this.loading=true
      const epoch=this.epoch;void this.instantiate(entry.key).then(model=>{if(this.disposed||epoch!==this.epoch||Math.hypot(x-player.x,z-player.z)>100)return;const box=new T.Box3().setFromObject(model),size=box.getSize(new T.Vector3()),factor=entry.length_m/Math.max(.001,size.x,size.y,size.z);model.scale.multiplyScalar(factor);model.position.copy(box.getCenter(new T.Vector3())).multiplyScalar(-factor);if(entry.habitat==='land')model.position.y=-box.min.y*factor
        const root=new T.Group();root.name=entry.name;root.userData.workbench=entry;root.add(model);root.position.copy(origin);this.scene.add(root);const mixer=new T.AnimationMixer(model),pattern=entry.habitat==='water'?/swim|walk/i:entry.habitat==='air'?/fly|flight|walk/i:/walk|run/i,clip=model.animations.find(c=>entry.preferred_clip?c.name===entry.preferred_clip:pattern.test(c.name));if(clip)mixer.clipAction(clip).play();this.actors.push({root,model,mixer,entry,origin,direction:new T.Vector3(Math.sin(x),0,Math.cos(x))})
      }).catch(error=>console.warn('Workbench model could not load',entry.name,error)).finally(()=>this.loading=false);break
    }
  }
  private releaseCache(){for(const promise of this.cache.values())void promise.then(root=>root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const v of Object.values(m))if(v instanceof T.Texture)v.dispose();m.dispose()}}})).catch(()=>{});this.cache.clear()}
  dispose(){this.disposed=true;clearInterval(this.polling);for(const a of this.actors){a.mixer.stopAllAction();a.mixer.uncacheRoot(a.model);this.scene.remove(a.root)}this.actors=[];this.releaseCache()}
}
