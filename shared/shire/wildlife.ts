import { Animal, AnimalActivity, Furnishing, World, Point, SPECIES, distance } from './model'
import { clear, height, WATER_LEVEL } from './terrain'

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
  const habitat=SPECIES[a.species].habitat,ground=height(p.x,p.z,w.seed)
  if(habitat==='water')return ground<WATER_LEVEL-0.35&&p.y>ground+0.15&&p.y<WATER_LEVEL-0.2
  if(habitat==='air')return p.y>ground+0.2&&clear(p,w)
  if(habitat==='bank'&&ground<WATER_LEVEL-0.4)return false
  if(habitat==='pasture'&&ground<WATER_LEVEL+0.15)return false
  if(w.edits.some(e=>Math.hypot(p.x-e.center.x,p.z-e.center.z)<Math.hypot(e.size.x,e.size.z)/2+1))return false
  return clear({...p,y:p.y+0.05},w)
}

/** Bounded steps prevent a large rest advance from teleporting animals through fences or terrain. */
export function advanceWildlife(w:World,seconds:number){
  const steps=Math.max(1,Math.ceil(seconds/0.5)),dt=seconds/steps
  for(let step=0;step<steps;step++){
    const time=w.time-seconds+(step+1)*dt,previous=w.animals.map(a=>({id:a.id,species:a.species,position:{...a.position}}))
    for(const a of w.animals){
      const spec=SPECIES[a.species],rule=WILDLIFE[a.species],phase=phaseOf(a),cycle=(time+phase)%18,hungry=a.fedUntil<time
      const nearby=distance(w.player,a.position)<rule.fear,calm=(a.calmUntil||0)>time
      if(nearby&&!calm)a.startledUntil=Math.max(a.startledUntil||0,time+2)
      const scared=(a.startledUntil||0)>time
      const angle=time*0.11+phase,home=a.home
      let activity:AnimalActivity=rule.routine,speed=rule.pace,target:Point={x:home.x+Math.sin(angle)*rule.range,y:home.y,z:home.z+Math.cos(angle*0.83)*rule.range}
      const mother=a.parents&&previous.find(b=>b.id===a.parents![0])
      const feeder=w.furniture.filter(f=>f.kind==='feeder'&&(f.stock||0)>0&&Math.hypot(f.position.x-a.position.x,f.position.z-a.position.z)<14).sort((a0,b)=>distance(a.position,a0.position)-distance(a.position,b.position))[0]
      const shelter=w.furniture.find(f=>f.kind==='burrow'&&f.open&&distance(f.position,a.position)<12)
      const perch=w.furniture.find(f=>f.kind==='perch'&&f.open&&distance(f.position,a.position)<16)
      if(scared){
        let x=a.position.x-w.player.x,z=a.position.z-w.player.z,l=Math.hypot(x,z);if(l<0.01){x=Math.sin(phase);z=Math.cos(phase);l=1}
        target={x:a.position.x+x/l*3,y:a.position.y,z:a.position.z+z/l*3};activity='fleeing';speed*=2.2
        if(a.species==='rabbit'&&shelter){const approach=shelterApproach(a,shelter);target=approach.target;if(distance(a.position,approach.entrance)<0.6){activity='sheltering';speed=0}}
        if(a.species==='frog')target={x:25,y:WATER_LEVEL,z:112}
      }else if(mother&&a.age<spec.maturity&&distance(a.position,mother.position)>1.3){target={...mother.position};activity='following mother';speed*=1.4}
      else if(hungry&&feeder&&spec.habitat==='pasture'){
        const x=a.position.x-feeder.position.x,z=a.position.z-feeder.position.z,l=Math.hypot(x,z)||1
        target={x:feeder.position.x+x/l*1.25,y:feeder.position.y,z:feeder.position.z+z/l*1.25};activity='approaching feed'
        if(distance(a.position,target)<0.7){feeder.stock=(feeder.stock||0)-1;a.fedUntil=time+240;activity='feeding';speed=0}
      }else if(a.species==='bird'&&perch&&cycle>8){
        target={x:perch.position.x,y:perch.position.y+1.78,z:perch.position.z};activity='perching';if(distance(a.position,target)<0.15)speed=0
      }else if(cycle>10&&!['fish','bird'].includes(a.species)){
        speed=0;activity=a.species==='llama'?'watching':a.species==='chicken'?'pecking':a.species==='pig'?'rooting':a.species==='frog'?'basking':a.species==='sheep'||a.species==='cattle'?'grazing':'resting'
      }else if(a.species==='sheep'||a.species==='fish'){
        const group=previous.filter(b=>b.species===a.species),cx=group.reduce((n,b)=>n+b.position.x,0)/group.length,cz=group.reduce((n,b)=>n+b.position.z,0)/group.length
        target.x=(target.x+cx)/2;target.z=(target.z+cz)/2
      }
      if(speed>0){
        const dx=target.x-a.position.x,dz=target.z-a.position.z,l=Math.hypot(dx,dz),move=Math.min(l,speed*dt),p={x:a.position.x+(l?dx/l*move:0),y:a.position.y,z:a.position.z+(l?dz/l*move:0)}
        const ground=height(p.x,p.z,w.seed)
        if(spec.habitat==='water')p.y=Math.max(ground+0.2,Math.min(WATER_LEVEL-0.25,WATER_LEVEL-0.8+Math.sin(angle)*0.18))
        else if(spec.habitat==='air'){const desired=activity==='perching'?target.y:ground+(scared?5:3.1)+Math.sin(angle)*0.45;p.y+=Math.max(-speed*dt,Math.min(speed*dt,desired-p.y))}
        else p.y=spec.habitat==='bank'?Math.max(ground,WATER_LEVEL-0.05):ground
        if(allowed(w,a,p))a.position=p;else if(activity!=='perching')activity='watching'
      }
      a.activity=activity;a.mood=hungry&&activity!=='feeding'?'hungry':['resting','perching','sheltering','watching','basking'].includes(activity)?'resting':['grazing','pecking','rooting','browsing','feeding'].includes(activity)?'grazing':'walking'
    }
  }
}
