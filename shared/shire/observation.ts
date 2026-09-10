import type { World } from './model'
import type { ResidentLife } from './lifeTypes'

export interface WorldObservation {
  worldId:string; revision:number; time:number; player:World['player'];
  animals:World['animals']; crops:World['crops']; combat:World['combat'];
  life?:Pick<NonNullable<World['life']>,'weather'|'transport'|'discoveries'|'events'|'nextEvent'|'quests'|'stats'|'skills'|'coins'|'inventory'|'animals'|'regions'> & {residents:Array<Pick<ResidentLife,'id'|'destination'|'activity'|'insideBuilding'>>}
}
/** Static terrain, buildings, family history and distant NPC records are sent on revision changes only. */
export function observation(w:World):WorldObservation{
  const active=(p:{x:number;z:number})=>Math.hypot(p.x-w.player.x,p.z-w.player.z)<750
  const l=w.life
  return {worldId:w.id,revision:w.revision,time:w.time,player:w.player,crops:w.crops,animals:w.animals.filter(a=>active(a.position)),combat:w.combat&&{...w.combat,actors:w.combat.actors.filter(a=>a.kind==='player'||active(a.position))},life:l&&{weather:l.weather,transport:l.transport,discoveries:l.discoveries,events:l.events,nextEvent:l.nextEvent,quests:l.quests,stats:l.stats,skills:l.skills,coins:l.coins,inventory:l.inventory,animals:l.animals,regions:l.regions,residents:l.residents.filter(r=>active(r.destination)).map(r=>({id:r.id,destination:r.destination,activity:r.activity,insideBuilding:r.insideBuilding}))}}
}
export function mergeObservation(w:World,o:WorldObservation):World{
  if(w.id!==o.worldId||w.revision!==o.revision)return w
  const merge=<T extends {id:string}>(original:T[],update:T[])=>{const next=new Map(update.map(a=>[a.id,a]));return [...original.map(a=>next.get(a.id)||a),...update.filter(a=>!original.some(b=>b.id===a.id))]}
  return {...w,time:o.time,player:o.player,crops:o.crops,animals:merge(w.animals,o.animals),combat:o.combat&&w.combat?{...o.combat,actors:merge(w.combat.actors,o.combat.actors)}:w.combat,life:w.life&&o.life?{...w.life,...o.life,residents:w.life.residents.map(r=>({...r,...o.life!.residents.find(p=>p.id===r.id)}))}:w.life}
}
