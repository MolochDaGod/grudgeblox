import type { Animal, AnimalActivity, Point, World } from './model'
import { SPECIES } from './model'
import { navigationTarget } from './navigation'
import { pasturePatches, patchById, consumePasture } from './pasture'

export interface AnimalGoal {
  kind:'graze'|'forage'|'feed'|'rest'|'perch'|'school'|'bask'; phase:'travel'|'act'; target:string; destination:Point;
  remaining:number; consumed:number; fatigue:number; progressAt:number; last:Point;
  blocked:Array<{id:string;until:number}>; completed:number; retryAt:number;
}
const flat=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z)
const grazers=['sheep','cattle','horse','llama','rabbit']
export function interruptAnimalGoal(a:Animal){if(a.goal){a.goal.target='';a.goal.remaining=0;a.goal.phase='travel';a.goal.retryAt=0}}
export function animalGoalIntent(w:World,a:Animal,time:number,dt:number):{target:Point;activity:AnimalActivity;speed:number}{
  const g=a.goal??={kind:'rest',phase:'travel',target:'',destination:{...a.home},remaining:0,consumed:0,fatigue:.15,progressAt:time,last:{...a.position},blocked:[],completed:0,retryAt:0}
  g.fatigue=Math.min(1,g.fatigue+dt/180);g.blocked=g.blocked.filter(b=>b.until>time)
  const fail=()=>{if(g.target)g.blocked.push({id:g.target,until:time+20});g.blocked=g.blocked.slice(-16);g.target='';g.retryAt=time+1;g.phase='travel';return {target:a.position,activity:'watching' as AnimalActivity,speed:0}}
  if(g.target.startsWith('patch:')){
    const patch=patchById(w,g.target.slice(6),time)
    if(!patch||patch.amount<=.08)return fail()
  }
  if(g.target.startsWith('feeder:')&&g.consumed<1&&!w.furniture.some(f=>f.id===g.target.slice(7)&&(f.stock||0)>0))return fail()
  if(!g.target&&time>=g.retryAt){
    const habitat=SPECIES[a.species].habitat,hungry=a.fedUntil<=time
    let choice:{id:string;position:Point;kind:AnimalGoal['kind']}|undefined
    if(habitat==='pasture'&&hungry&&g.fatigue<.85){
      for(const f of w.furniture.filter(f=>f.kind==='feeder'&&(f.stock||0)>0&&flat(a.position,f.position)<14&&!g.blocked.some(b=>b.id===`feeder:${f.id}`)).sort((p,q)=>flat(a.position,p.position)-flat(a.position,q.position))){
        const dx=a.position.x-f.position.x,dz=a.position.z-f.position.z,length=Math.hypot(dx,dz)||1
        const p={x:f.position.x+(length===1&&dx===0?1:dx/length)*1.25,y:f.position.y,z:f.position.z+dz/length*1.25}
        if(flat(a.position,p)<.85||navigationTarget(w,`${a.id}:feeder:${f.id}`,a.position,p)){choice={id:`feeder:${f.id}`,position:p,kind:'feed'};break}
      }
      const candidates=pasturePatches(w,a.position,16,time).filter(p=>p.amount>.15&&!g.blocked.some(b=>b.id===`patch:${p.id}`)).sort((p,q)=>flat(a.position,p.position)-flat(a.position,q.position))
      if(!choice)for(const p of candidates.slice(0,8))if(flat(a.position,p.position)<.85||navigationTarget(w,`${a.id}:${p.id}`,a.position,p.position)){choice={id:`patch:${p.id}`,position:p.position,kind:grazers.includes(a.species)?'graze':'forage'};break}
    }else if(a.species==='bird'&&g.fatigue<.65){
      const perch=w.furniture.filter(f=>f.kind==='perch'&&f.open&&!g.blocked.some(b=>b.id===f.id)&&flat(a.position,f.position)<24).sort((p,q)=>flat(a.position,p.position)-flat(a.position,q.position))[0]
      if(perch)choice={id:perch.id,position:{...perch.position,y:perch.position.y+1.78},kind:'perch'}
    }else if(a.species==='fish'&&g.fatigue<.65){
      const leader=w.animals.filter(b=>b.species==='fish'&&b.id!==a.id&&flat(a.position,b.position)<18).sort((p,q)=>p.id.localeCompare(q.id))[0]
      if(leader)choice={id:leader.id,position:{...leader.position,x:leader.position.x+1.2},kind:'school'}
    }
    choice??={id:'home',position:{...a.home},kind:a.species==='frog'?'bask':'rest'}
    g.kind=choice.kind;g.target=choice.id;g.destination=choice.position;g.phase='travel';g.remaining=g.kind==='graze'||g.kind==='forage'?8:12;g.consumed=0;g.progressAt=time;g.last={...a.position}
  }
  if(!g.target)return {target:a.position,activity:'watching',speed:0}
  if(g.kind==='perch'&&!w.furniture.some(f=>f.id===g.target&&f.open))return fail()
  const arrived=flat(a.position,g.destination)<.85&&(SPECIES[a.species].habitat!=='air'||Math.abs(a.position.y-g.destination.y)<.25)
  const activity:AnimalActivity=g.kind==='graze'?'grazing':g.kind==='forage'?(a.species==='pig'?'rooting':'pecking'):g.kind==='feed'?'feeding':g.kind==='perch'?'perching':g.kind==='school'?'schooling':g.kind==='bask'?'basking':'resting'
  if(arrived){
    g.phase='act';g.remaining-=dt
    if(g.kind==='graze'||g.kind==='forage'){
      const eaten=consumePasture(w,g.target.slice(6),dt*.1,time);g.consumed+=eaten
      if(eaten===0)return fail()
      // Food satisfaction requires time spent at the resource and real consumption.
      if(g.consumed>=.35)a.fedUntil=Math.max(a.fedUntil,time+120)
    }else if(g.kind==='feed'){
      if(g.remaining<=5&&g.consumed===0){const feeder=w.furniture.find(f=>f.id===g.target.slice(7)&&(f.stock||0)>0);if(!feeder)return fail();feeder.stock!--;g.consumed=1;a.fedUntil=time+240}
    }else g.fatigue=Math.max(0,g.fatigue-dt/18)
    if(g.remaining<=0){g.completed++;g.target='';g.retryAt=time+1;g.phase='travel'}
    return {target:a.position,activity,speed:0}
  }
  if(flat(a.position,g.last)>.15){g.progressAt=time;g.last={...a.position}}else if(time-g.progressAt>5)return fail()
  const route=SPECIES[a.species].habitat==='pasture'?navigationTarget(w,`${a.id}:goal:${g.target}`,a.position,g.destination):g.destination
  if(!route)return fail()
  return {target:route,activity:['graze','forage','feed'].includes(g.kind)?'approaching feed':g.kind==='perch'?'perching':g.kind==='school'?'schooling':a.species==='frog'?'hopping':'walking to rest',speed:0.8}
}
export function validAnimalGoal(g:AnimalGoal,time:number){
  const point=(p:Point)=>p&&[p.x,p.y,p.z].every(Number.isFinite),n=(v:number,min=0,max=1e12)=>Number.isFinite(v)&&v>=min&&v<=max
  return g&&['graze','forage','feed','rest','perch','school','bask'].includes(g.kind)&&['travel','act'].includes(g.phase)&&typeof g.target==='string'&&g.target.length<100&&point(g.destination)&&point(g.last)&&n(g.remaining,-1,12)&&n(g.consumed,0,1.1)&&n(g.fatigue,0,1)&&n(g.progressAt,0,time)&&n(g.retryAt,0,time+30)&&Number.isSafeInteger(g.completed)&&g.completed>=0&&Array.isArray(g.blocked)&&g.blocked.length<=16&&g.blocked.every(b=>typeof b.id==='string'&&b.id.length<100&&n(b.until,0,time+30))
}
