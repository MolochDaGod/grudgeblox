import { Animal, AnimalActivity, Furnishing, World, Point, SPECIES, distance } from './model'
import { clear, height, surfaceAt, WATER_LEVEL } from './terrain'
import { waterAt, bridgeAt, bridgeDeck, isAtlas } from './atlas'
import { navigationTarget } from './navigation'
import { animalGoalIntent, interruptAnimalGoal } from './animalGoals'

export const WILDLIFE:Record<Animal['species'],{routine:AnimalActivity;range:number;fear:number;pace:number;description:string}>={
  sheep:{routine:'grazing',range:3,fear:2.1,pace:0.8,description:'Graze in a loose flock and move away together when startled.'},
  chicken:{routine:'pecking',range:3,fear:1.7,pace:1,description:'Peck between short walks, then scatter from sudden approaches.'},
  rabbit:{routine:'hopping',range:3.5,fear:2.8,pace:1.5,description:'Hop between pauses and retreat to an open rabbit shelter.'},
  cattle:{routine:'grazing',range:4,fear:1.6,pace:0.65,description:'Graze slowly, chew at rest and keep their calves nearby.'},
  pig:{routine:'rooting',range:3,fear:1.4,pace:0.85,description:'Snuffle and root, then investigate stocked feeders.'},
  horse:{routine:'cantering',range:6,fear:3,pace:2,description:'Canter around the pasture and shy away from close approaches.'},
  fish:{routine:'schooling',range:4,fear:2.5,pace:1.2,description:'Swim in a school beneath the pond surface and dart away from disturbance.'},
  llama:{routine:'browsing',range:3.5,fear:2.2,pace:0.75,description:'Browse, pause to watch visitors, and withdraw when startled.'},
  bird:{routine:'circling',range:6,fear:2.5,pace:2.2,description:'Circle overhead, settle on open perches, and take flight when disturbed.'},
  frog:{routine:'basking',range:2.5,fear:2,pace:1.1,description:'Bask on the bank and hop toward water when disturbed.'},
}
const phaseOf=(a:Animal)=>a.tint*31+(Number.parseInt(a.id.slice(0,4),16)%31)
function shelterApproach(a:Animal,shelter:Furnishing):{target:Point;entrance:Point}{
  const c=Math.cos(shelter.yaw),s=Math.sin(shelter.yaw),dx=a.position.x-shelter.position.x,dz=a.position.z-shelter.position.z,x=dx*c-dz*s,z=dx*s+dz*c
  const local=z<1.08?(Math.abs(x)<1.15?{x:(x<0?-1:1)*1.25,z}:{x,z:1.2}):{x:0,z:1.1}
  const world=(p:{x:number;z:number})=>({x:shelter.position.x+p.x*c+p.z*s,y:shelter.position.y,z:shelter.position.z-p.x*s+p.z*c})
  return {target:world(local),entrance:world({x:0,z:1.1})}
}

function allowed(w:World,a:Animal,p:Point){
  const habitat=SPECIES[a.species].habitat,ground=height(p.x,p.z,w),water=waterAt(p.x,p.z,w)
  if(habitat==='water')return ground<water-0.35&&p.y>ground+0.15&&p.y<water-0.2
  if(habitat==='air')return p.y>ground+0.2&&clear(p,w)
  if(habitat==='bank'&&ground<water-0.4)return false
  if(habitat==='pasture'&&p.y<water+0.15)return false
  if(w.edits.some(e=>Math.hypot(p.x-e.center.x,p.z-e.center.z)<Math.hypot(e.size.x,e.size.z)/2+1))return false
  return clear({...p,y:p.y+0.05},w)
}

/** Bounded steps prevent a large rest advance from teleporting animals through fences or terrain. */
export function advanceWildlife(w:World,seconds:number){
  const steps=Math.max(1,Math.ceil(seconds/0.5)),dt=seconds/steps
  for(let step=0;step<steps;step++){
    const time=w.time-seconds+(step+1)*dt,previous=w.animals.map(a=>({id:a.id,species:a.species,position:{...a.position}}))
    for(const a of w.animals){
      const support=isAtlas(w)&&SPECIES[a.species].habitat==='pasture'?bridgeAt(a.position.x,a.position.z):undefined
      if(support)a.position.y=Math.max(a.position.y,bridgeDeck(support))
      if(w.life&&(Math.hypot(a.position.x-w.player.x,a.position.z-w.player.z)>500||w.life.riding===a.id))continue
      if(w.combat?.actors.find(b=>b.id===a.id)?.vitality.hp===0)continue
      const spec=SPECIES[a.species],rule=WILDLIFE[a.species],phase=phaseOf(a),hungry=a.fedUntil<time
      const info=w.life?.animals[a.id],nearby=distance(w.player,a.position)<rule.fear,calm=(a.calmUntil||0)>time||!!info?.owner&&info.affinity>=20
      if(nearby&&!calm)a.startledUntil=Math.max(a.startledUntil||0,time+2)
      const scared=(a.startledUntil||0)>time
      const angle=time*0.11+phase
      let activity:AnimalActivity='watching',speed=0,target:Point={...a.position}
      const mother=a.parents&&previous.find(b=>b.id===a.parents![0])
      const shelter=w.furniture.find(f=>f.kind==='burrow'&&f.open&&distance(f.position,a.position)<12)
      if(info?.following){interruptAnimalGoal(a);target={...w.player};activity='watching';speed=distance(w.player,a.position)>2.5?3.5:0;if(speed)activity='approaching feed'}
      else if(scared){
        interruptAnimalGoal(a)
        let x=a.position.x-w.player.x,z=a.position.z-w.player.z,l=Math.hypot(x,z);if(l<0.01){x=Math.sin(phase);z=Math.cos(phase);l=1}
        target={x:a.position.x+x/l*3,y:a.position.y,z:a.position.z+z/l*3};activity='fleeing';speed=rule.pace*2.2
        if(a.species==='rabbit'&&shelter){const approach=shelterApproach(a,shelter);target=approach.target;if(distance(a.position,approach.entrance)<0.6){activity='sheltering';speed=0}}
        if(a.species==='frog')target=w.generator==='shire-1'?{x:25,y:WATER_LEVEL,z:112}:{...a.home}
      }else if(mother&&a.age<spec.maturity&&distance(a.position,mother.position)>1.3){interruptAnimalGoal(a);target={...mother.position};activity='following mother';speed=rule.pace*1.4}
      else{const intent=animalGoalIntent(w,a,time,dt);target=intent.target;activity=intent.activity;speed=intent.speed?rule.pace:0}
      if(speed>0&&spec.habitat==='pasture'&&(info?.following||scared||activity==='following mother'||activity==='sheltering')){const route=navigationTarget(w,a.id,a.position,target);if(route)target=route;else speed=0}
      if(speed>0){
        const dx=target.x-a.position.x,dz=target.z-a.position.z,l=Math.hypot(dx,dz),move=Math.min(l,speed*dt),p={x:a.position.x+(l?dx/l*move:0),y:a.position.y,z:a.position.z+(l?dz/l*move:0)}
        const bridge=isAtlas(w)?bridgeAt(p.x,p.z):undefined
        const ground=spec.habitat==='pasture'?surfaceAt(p.x,p.z,w,Math.max(height(p.x,p.z,w)+1,bridge?bridgeDeck(bridge)+1:-Infinity)):height(p.x,p.z,w)
        const water=waterAt(p.x,p.z,w)
        if(spec.habitat==='water')p.y=Math.max(ground+0.2,Math.min(water-0.25,water-0.8+Math.sin(angle)*0.18))
        else if(spec.habitat==='air'){const desired=!scared?target.y:ground+5;p.y+=Math.max(-speed*dt,Math.min(speed*dt,desired-p.y))}
        else p.y=spec.habitat==='bank'?Math.max(ground,water-0.05):ground
        if(allowed(w,a,p))a.position=p;else if(activity!=='perching')activity='watching'
      }
      a.activity=activity;a.mood=hungry&&activity!=='feeding'?'hungry':['resting','perching','sheltering','watching','basking'].includes(activity)?'resting':['grazing','pecking','rooting','browsing','feeding'].includes(activity)?'grazing':'walking'
    }
  }
}
