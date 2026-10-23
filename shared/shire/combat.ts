import { World, Point, Species, SPECIES, distance, finitePoint } from './model'
import { CombatActor, CombatEvent, CombatState, DamageType, Vitality, DAMAGE_TYPES } from './combatTypes'
import { HOSTILES, hostileDefinition, CINDERLORD_DEFINITION, HostileDefinition } from './hostiles'
import { height, clear, density, surfaceAt } from './terrain'
import { isAtlas, inBounds, settlements, waterAt, BYWATER_POOL, ATLAS_PLACES, buildingBlocked } from './atlas'
import { cinderlordSite } from './cinderlord'
import { navigationTarget } from './navigation'
import { combatTactic, flankingPoint } from './combatTactics'

/** These optional encounters are authored game fiction, not claims of book-attested inhabitants. */
export const ADVENTURE_SITES:Record<string,{place:string;dx:number;dz:number;description:string}>={
  '01-orc':{place:'bree',dx:780,dz:-420,description:'An isolated scout camp outside Bree.'},
  '03-half-orc':{place:'archet',dx:600,dz:350,description:'An enforcer threatening the eastern road.'},
  '07-great-spider':{place:'old-man-willow',dx:180,dz:260,description:'An optional spider ambush in the Old Forest.'},
  '08-warg':{place:'combe',dx:650,dz:300,description:'A wolf-like hunter on the distant hill tracks.'},
  '21-rhudaur-hillman':{place:'staddle',dx:800,dz:-280,description:'A road ambush outside the settled village.'},
  '23-barrow-wight':{place:'barrow-encounter',dx:35,dz:-60,description:'A restless guardian on the Barrow-downs.'},
}
export function actorEnabled(w:World,a:CombatActor){return a.kind!=='hostile'||!w.life||w.life.style==='creative'||w.life.style==='adventure'&&!!ADVENTURE_SITES[a.species]}
export function configureLifeEncounters(w:World){
  if(!w.life||!isAtlas(w)||w.life.style!=='adventure')return
  for(const a of w.combat!.actors){const site=ADVENTURE_SITES[a.species],p=site&&ATLAS_PLACES.find(p=>p.id===site.place);if(!p)continue;const expected={x:p.x+site.dx,y:0,z:p.z+site.dz};if(flatDistance(a.home,expected)<100)continue;const ground=safeCombatGround(w,expected,Math.min(actorRadius(a),1));a.home={...ground};a.position={...ground};a.targetId=undefined;if(living(a)){a.phase='idle';a.phaseAt=w.time}}
}

const animalHP:Record<Species,number>={sheep:45,chicken:18,rabbit:22,cattle:100,pig:60,horse:110,fish:12,llama:70,bird:14,frog:12}
const flatDistance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z)
export const living=(a:CombatActor|undefined)=>!!a&&a.vitality.hp>0
export const combatActor=(w:World,id:string)=>w.combat?.actors.find(a=>a.id===id)
export function vitality(hp:number,armour=0):Vitality{return {hp,maxHp:hp,armour,stamina:100,breath:15,lastDamage:0,invulnerableUntil:0,cooldownUntil:0,blockingUntil:0,diedAt:null,respawnAt:null,effects:[]}}
function actor(id:string,kind:CombatActor['kind'],species:string,name:string,p:Point,hp:number,armour=0):CombatActor {
  return {id,kind,species,name,home:{...p},position:{...p},yaw:0,vitality:vitality(hp,armour),phase:'idle',phaseAt:0,attackSerial:0,hitSerial:0,generation:0}
}
export function residentOrigin(w:World,j:number,i:number):Point {
  const s=settlements(w)[j],x=s.x+Math.sin(i)*8+12,z=s.z+Math.cos(i)*8+(s.name==='Hobbiton'?-40:4)
  return {x,y:height(x,z,w),z}
}
export function safeCombatGround(w:World,origin:Point,radius=.5):Point {
  for(let ring=0;ring<18;ring++)for(let i=0;i<(ring?16:1);i++){
    const angle=i*Math.PI/8,x=origin.x+Math.sin(angle)*ring*3,z=origin.z+Math.cos(angle)*ring*3
    if(!inBounds(x,z,w))continue
    const y=surfaceAt(x,z,w,height(x,z,w)+8)+.08,p={x,y,z}
    if(y<waterAt(x,z,w)+.15||Math.abs(y-height(x,z,w))>1)continue
    if([[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]].every(([dx,dz])=>Math.abs(height(x+dx,z+dz,w)-y)<.75&&clear({x:x+dx,y:y+.1,z:z+dz},w)))return p
  }
  throw Error('No clear ground near this encounter. Clear terrain or choose another destination.')
}
export function encounterSite(w:World,d:HostileDefinition,index:number):Point {
  if(d.id==='24-watcher'){
    const p=isAtlas(w)?{x:BYWATER_POOL.x,z:BYWATER_POOL.z}:{x:25,z:114}
    return {...p,y:waterAt(p.x,p.z,w)-.9}
  }
  if(d.id==='cinderlord'&&!isAtlas(w))return cinderlordSite(w)
  let x:number,z:number
  if(isAtlas(w)){
    const towns=settlements(w),s=towns[(index*7)%towns.length],a=index*2.3999632297
    x=s.x+Math.cos(a)*(470+index%3*100);z=s.z+Math.sin(a)*(470+index%3*100)
  }else{const a=index*2.3999632297,r=360+(index%5)*220;x=Math.cos(a)*r-50;z=Math.sin(a)*r}
  return safeCombatGround(w,{x,y:0,z},Math.min(d.radius,2))
}
/** Additive migration runs only on an opened/created world, never over unopened saves. */
export function ensureCombat(w:World):CombatState {
  if(!w.combat){
    const actors=[actor('player','player','player','You',w.player,100,12)]
    for(const [i,d]of [...HOSTILES,CINDERLORD_DEFINITION].entries())actors.push(actor(`hostile:${d.id}`,'hostile',d.id,d.name,encounterSite(w,d,i),d.hp,d.armour))
    for(const [j,s]of settlements(w).entries())for(let i=0;i<Math.min(6,s.homes);i++)actors.push(actor(`resident:${j}:${i}`,'resident',s.elves?'elf':'human',`${s.name} resident ${i+1}`,residentOrigin(w,j,i),s.elves?90:65,5))
    w.combat={version:1,actors,events:[],nextEvent:1,healingDraughts:3,peakY:w.player.y,lastPlayerY:w.player.y,grounded:true}
  }
  for(const a of w.animals)if(!combatActor(w,a.id))w.combat.actors.push(actor(a.id,'animal',a.species,a.name,a.position,animalHP[a.species],0))
  return w.combat
}
function emit(w:World,event:Omit<CombatEvent,'seq'|'time'>){const c=w.combat!;c.events.push({...event,seq:c.nextEvent++,time:w.time});if(c.events.length>64)c.events.splice(0,c.events.length-64)}
function phase(w:World,a:CombatActor,next:CombatActor['phase']){if(a.phase!==next){a.phase=next;a.phaseAt=w.time}if(next!=='windup')a.strikeAt=undefined}
export function actorRadius(a:CombatActor){return a.kind==='hostile'?hostileDefinition(a.species)!.radius:a.kind==='animal'?SPECIES[a.species as Species].scale*.4:.4}
export function actorHeight(a:CombatActor){return a.kind==='hostile'?hostileDefinition(a.species)!.height:a.kind==='animal'?SPECIES[a.species as Species].scale:1.6}
export function combatBlocks(w:World,p:Point,from:Point){if(w.life?.interior)return false;return !!w.combat?.actors.some(a=>a.kind!=='player'&&a.id!==w.life?.riding&&actorEnabled(w,a)&&living(a)&&Math.abs(a.position.y-p.y)<actorHeight(a)&&flatDistance(a.position,p)<actorRadius(a)+.22&&flatDistance(a.position,p)<flatDistance(a.position,from)-.001)}
export function attackClear(w:World,a:CombatActor,b:CombatActor):boolean {
  const y1=a.position.y+Math.min(actorHeight(a)*.6,2),y2=b.position.y+Math.min(actorHeight(b)*.6,2),length=distance({...a.position,y:y1},{...b.position,y:y2}),steps=Math.ceil(length/.25)
  for(let i=1;i<steps;i++){const t=i/steps,p={x:a.position.x+(b.position.x-a.position.x)*t,y:y1+(y2-y1)*t,z:a.position.z+(b.position.z-a.position.z)*t}
    if(density(p.x,p.y,p.z,w,w.edits)>.05||buildingBlocked(p,w))return false
    for(const f of w.furniture)if(f.kind==='door'&&!f.open){const dx=p.x-f.position.x,dz=p.z-f.position.z,c=Math.cos(f.yaw),s=Math.sin(f.yaw);if(Math.abs(dx*c-dz*s)<(f.fit?.width||1.5)/2&&Math.abs(dx*s+dz*c)<.2&&p.y>f.position.y&&p.y<f.position.y+(f.fit?.height||2))return false}
  }
  return true
}
function canReach(w:World,a:CombatActor,b:CombatActor,reach:number){return flatDistance(a.position,b.position)<=reach+actorRadius(b)&&Math.abs(a.position.y-b.position.y)<Math.max(2.5,actorHeight(b),actorHeight(a))&&attackClear(w,a,b)}
export function damage(w:World,target:CombatActor,amount:number,type:DamageType,source='environment',status=true):number {
  if(!actorEnabled(w,target)||(w.life?.style==='homestead'&&combatActor(w,source)?.kind==='hostile'))return 0
  if(!Number.isFinite(amount)||amount<=0||!DAMAGE_TYPES.includes(type)||!living(target)||w.time<target.vitality.invulnerableUntil)return 0
  const v=target.vitality,resistance=target.kind==='hostile'?(hostileDefinition(target.species)?.resistance[type]??1):1
  let actual=amount*resistance*(type==='physical'?100/(100+v.armour):1)
  if(actual<=0)return 0
  const attacker=combatActor(w,source),dx=(attacker?.position.x||0)-target.position.x,dz=(attacker?.position.z||0)-target.position.z
  const facing=target.kind!=='player'||(-Math.sin(target.yaw)*dx-Math.cos(target.yaw)*dz)/(Math.hypot(dx,dz)||1)>.25
  if(attacker&&v.blockingUntil>w.time&&v.stamina>=12&&facing&&!['fall','drowning'].includes(type)){actual*=target.kind==='player'&&w.life?.equipment.shield ? .1 : .25;v.stamina-=12;emit(w,{type:'blocked',source,target:target.id,amount:Math.round(actual),damageType:type})}
  actual=Math.min(v.hp,Math.max(1,Math.round(actual)));v.hp-=actual;v.lastDamage=w.time;target.hitSerial++
  if(source==='player'&&w.life&&(target.kind==='resident'||target.kind==='animal')){for(const r of w.life.residents)if(r.id===target.id||flatDistance(combatActor(w,r.id)!.position,target.position)<100)r.friendship=Math.max(-100,r.friendship-15);if(target.kind==='animal'&&w.life.animals[target.id])w.life.animals[target.id].affinity=Math.max(0,w.life.animals[target.id].affinity-25)}
  emit(w,{type:'damage',source,target:target.id,amount:actual,damageType:type})
  if(v.hp===0){v.diedAt=w.time;v.respawnAt=target.kind==='player'?null:w.time+(target.kind==='hostile'?hostileDefinition(target.species)!.respawn:target.kind==='animal'?300:180);v.effects=[];v.blockingUntil=0;target.targetId=undefined;phase(w,target,'dead');emit(w,{type:'death',source,target:target.id,amount:0});const animal=w.animals.find(a=>a.id===target.id);if(animal)animal.pregnant=undefined}
  else{
    if(attacker&&target.kind!=='animal'){target.targetId=attacker.id;if(target.phase==='idle'||target.phase==='patrol')phase(w,target,'chase')}
    const animal=w.animals.find(a=>a.id===target.id);if(animal){animal.startledUntil=w.time+12;animal.calmUntil=0}
    if(status&&(type==='fire'||type==='poison')){
      const kind=type==='fire'?'burn':'poison',old=v.effects.find(e=>e.kind===kind)
      if(old)old.remaining=Math.max(old.remaining,5)
      else v.effects.push({kind,source,remaining:5,nextTick:w.time+1,damage:3})
    }
  }
  return actual
}
export function heal(w:World,a:CombatActor,amount:number,source='care'){
  if(!living(a)||!Number.isFinite(amount)||amount<=0)return 0
  const actual=Math.min(amount,a.vitality.maxHp-a.vitality.hp);a.vitality.hp+=actual
  if(actual)emit(w,{type:'heal',source,target:a.id,amount:actual});return actual
}
export function playerStrike(w:World,targetId:string){
  ensureCombat(w);const a=combatActor(w,'player')!,b=combatActor(w,targetId)
  if(!living(a))throw Error('You are defeated. Recover at home before acting.')
  if(!b||b===a||!living(b))throw Error('Choose a living target.')
  if(!actorEnabled(w,b)||w.life?.style==='homestead')throw Error('Hostile combat is disabled in Homestead. Choose Adventure or Creative in play settings.')
  if(a.vitality.cooldownUntil>w.time)throw Error('Your next strike is not ready yet.')
  if(a.vitality.stamina<16)throw Error('Catch your breath before striking again.')
  a.position={...w.player};a.yaw=w.player.yaw
  const weapon=w.life?.equipment.weapon||'hand',bow=weapon==='bow',reach=bow?32:weapon==='sword'?3.1:2.7
  if(!canReach(w,a,b,reach))throw Error(bow?'Aim within 32 metres with a clear line to your target.':'Move closer with a clear line to your target.')
  if(bow&&!(w.life!.inventory.arrow||0))throw Error('Craft or buy more arrows.')
  a.vitality.cooldownUntil=w.time+(bow?1.1:.65);a.vitality.stamina-=16;a.vitality.blockingUntil=0;a.attackSerial++;emit(w,{type:'attack',source:a.id,target:b.id,amount:0})
  const strength=w.life?1+Math.min(.4,Math.sqrt(w.life.skills.combat/40)*.04):1
  if(bow){w.life!.inventory.arrow!--;(w.combat!.projectiles??=[]).push({id:w.combat!.nextEvent,source:a.id,target:b.id,start:{...a.position,y:a.position.y+1.1},end:{...b.position,y:b.position.y+Math.min(1,b.vitality.maxHp/100)},launched:w.time,arrives:w.time+flatDistance(a.position,b.position)/28,damage:Math.round(36*strength)});return 'Arrow released.'}
  const dealt=damage(w,b,(weapon==='sword'?42:28)*strength,'physical',a.id);return `${b.name}: ${Math.ceil(dealt)} damage · ${Math.ceil(b.vitality.hp)}/${b.vitality.maxHp} health.`
}
export function playerGuard(w:World){const a=combatActor(w,'player')!;if(!living(a)||a.vitality.stamina<12)throw Error('You need health and stamina to guard.');a.vitality.blockingUntil=w.time+2;return 'Guard raised for two seconds. Face the attacker; blocking consumes stamina.'}
export function playerHeal(w:World){const c=ensureCombat(w),a=combatActor(w,'player')!;if(!living(a))throw Error('Recover at home after defeat.');if(!c.healingDraughts)throw Error('No healing draughts left. Rest in a bed to replenish them.');if(a.vitality.hp===a.vitality.maxHp&&!a.vitality.effects.length)throw Error('You are already healthy.');c.healingDraughts--;a.vitality.effects=[];heal(w,a,45,'healing draught');return 'Restored up to 45 health and removed burning and poison.'}
function respawn(w:World,a:CombatActor,p:Point){a.vitality=vitality(a.vitality.maxHp,a.vitality.armour);a.vitality.invulnerableUntil=w.time+5;a.position={...p};a.generation++;a.targetId=undefined;phase(w,a,'idle');emit(w,{type:'respawn',source:a.id,target:a.id,amount:a.vitality.hp})}
export function playerRespawn(w:World){const c=ensureCombat(w),a=combatActor(w,'player')!;if(living(a))throw Error('You are still standing.');if(w.time-(a.vitality.diedAt||0)<3)throw Error('Recovery is available three seconds after defeat.');if(w.life){w.life.interior=undefined;w.life.transport=undefined;w.life.riding=undefined;w.life.seated=undefined}const p=safeCombatGround(w,w.home||a.home);respawn(w,a,p);w.player={...p,yaw:0,pitch:0};c.peakY=p.y;c.lastPlayerY=p.y;c.grounded=true;c.healingDraughts=Math.max(c.healingDraughts,1);return 'Recovered at home with full health and five seconds of protection.'}
export function encounterTravel(w:World,id:string){
  ensureCombat(w);const a=combatActor(w,id);if(!a||a.kind!=='hostile')throw Error('Choose a known encounter.')
  const d=hostileDefinition(a.species)!,offset=d.aggro+12,origin={x:a.home.x,y:0,z:a.home.z+offset}
  const water=waterAt(origin.x,origin.z,w),afloat={...origin,y:water-1.15}
  const p=d.movement==='water'&&Number.isFinite(water)&&clear(afloat,w)?afloat:safeCombatGround(w,origin)
  w.player={...p,yaw:Math.atan2(p.x-a.home.x,p.z-a.home.z),pitch:0};resetPlayerTracking(w)
  return `${a.name} ${d.movement==='water'?'water approach':'overlook'}. Approach to challenge it. F strikes; Q guards; H heals.`
}
export function resetPlayerTracking(w:World){const c=ensureCombat(w),a=combatActor(w,'player')!;a.position={...w.player};a.yaw=w.player.yaw;c.peakY=w.player.y;c.lastPlayerY=w.player.y;c.grounded=true}
export function observePlayer(w:World,p:World['player']){
  const c=ensureCombat(w),a=combatActor(w,'player')!
  if(!living(a)||w.life?.paused||w.life?.transport||w.life?.seated)return
  if(!finitePoint(p)||![p.yaw,p.pitch].every(Number.isFinite)||!clear(p,w))throw Error('Your observed position needs clear ground and headroom.')
  // Camera observations carry position only. Vitality is always server-owned.
  w.player={x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:p.pitch};a.position={...w.player};a.yaw=p.yaw
  if(p.y<waterAt(p.x,p.z,w)-.65){c.peakY=p.y;c.lastPlayerY=p.y;c.grounded=false;return}
  const grounded=!clear({...p,y:p.y-.18},w)
  c.peakY=Math.max(c.peakY,p.y)
  if(grounded&&!c.grounded){const fall=c.peakY-p.y;if(fall>3)damage(w,a,(fall-3)*9,'fall');c.peakY=p.y}
  if(grounded)c.peakY=p.y;c.grounded=grounded;c.lastPlayerY=p.y
}
function moveActor(w:World,a:CombatActor,target:Point,speed:number,dt:number){
  if(w.life&&hostileDefinition(a.species)?.movement!=='air'&&hostileDefinition(a.species)?.movement!=='water'){const routed=navigationTarget(w,a.id,a.position,target);if(!routed)return;target=routed}
  const d=hostileDefinition(a.species),dx=target.x-a.position.x,dz=target.z-a.position.z,length=Math.hypot(dx,dz);if(length<.1)return
  const step=Math.min(length,speed*dt),x=a.position.x+dx/length*step,z=a.position.z+dz/length*step,ground=surfaceAt(x,z,w,a.position.y+2)
  let y=ground+.08
  if(d?.movement==='water'){const water=waterAt(x,z,w);if(!Number.isFinite(water)||ground>water-.2)return;y=water-.9}
  else if(d?.movement==='air')y=height(x,z,w)+(a.phase==='chase'?1.1+Math.sin(w.time*2)*.3:3+Math.sin(w.time)*.7)
  else if(y<waterAt(x,z,w)+.1||Math.abs(y-a.position.y)>.65||!clear({x,y:y+.1,z},w))return
  if(d&&d.movement==='ground'){
    const radius=Math.min(d.radius,1.2)
    if([[radius,0],[-radius,0],[0,radius],[0,-radius]].some(([dx,dz])=>!clear({x:x+dx,y:y+.18,z:z+dz},w))||density(x,y+d.height*.8,z,w,w.edits)>.1)return
  }
  if(!inBounds(x,z,w))return
  a.position={x,y,z};a.yaw=Math.atan2(dx,dz)
}
/** Server simulation uses bounded steps so missed frames do not duplicate a strike. */
export function advanceCombat(w:World,seconds:number){
  if(seconds<=0)return
  const c=ensureCombat(w),finish=w.time,start=finish-seconds,steps=Math.max(1,Math.ceil(seconds/.1)),dt=seconds/steps
  for(let step=0;step<steps;step++){
    w.time=start+(step+1)*dt;const player=combatActor(w,'player')!
    player.position={...w.player};player.yaw=w.player.yaw
    if(c.projectiles){for(const shot of c.projectiles.filter(p=>p.arrives<=w.time)){const target=combatActor(w,shot.target),source=combatActor(w,shot.source);if(target&&source&&living(target)&&flatDistance(target.position,shot.end)<1.5+actorRadius(target)&&attackClear(w,source,target))damage(w,target,shot.damage,'physical',shot.source);else emit(w,{type:'miss',source:shot.source,target:shot.target,amount:0})}c.projectiles=c.projectiles.filter(p=>p.arrives>w.time)}
    for(const a of c.actors){
      if(!actorEnabled(w,a)||w.life?.interior&&a.kind!=='player')continue
      if(w.life&&a.kind!=='player'&&flatDistance(a.position,w.player)>600)continue
      const v=a.vitality
      if(!living(a)){
        if(v.respawnAt!==null&&v.respawnAt<=w.time){let p=a.home;try{if(a.kind!=='hostile'||hostileDefinition(a.species)!.movement!=='water')p=safeCombatGround(w,a.home)}catch{v.respawnAt=w.time+10;continue}respawn(w,a,p);const animal=w.animals.find(b=>b.id===a.id);if(animal)animal.position={...p}}
        continue
      }
      v.stamina=Math.min(100,v.stamina+(v.blockingUntil>w.time?2:16)*dt)
      for(const effect of [...v.effects]){effect.remaining-=dt;if(effect.nextTick<=w.time){effect.nextTick+=1;damage(w,a,effect.damage,effect.kind==='burn'?'fire':'poison',effect.source,false)}}
      v.effects=v.effects.filter(e=>e.remaining>0);if(!living(a))continue
      if(a.kind==='player'){
        const underwater=!w.life?.interior&&!w.life?.transport&&a.position.y+1.45<waterAt(a.position.x,a.position.z,w)
        if(underwater){v.breath=Math.max(0,v.breath-dt);if(!v.breath&&Math.floor(w.time)>Math.floor(w.time-dt))damage(w,a,10,'drowning')}
        else v.breath=Math.min(15,v.breath+4*dt)
        continue
      }
      if(a.kind==='animal'){const original=w.animals.find(b=>b.id===a.id);if(original){a.position={...original.position};if(original.fedUntil>w.time&&w.time-v.lastDamage>15)v.hp=Math.min(v.maxHp,v.hp+dt*.8)}continue}
      if(a.kind==='resident'&&!a.targetId){const r=w.life?.residents.find(r=>r.id===a.id);if(r?.insideBuilding)continue;if(r){moveActor(w,a,r.destination,r.activity==='walking'?1.3:.8,dt)}else{const i=Number(a.id.split(':')[2]),angle=w.time*.16+i;moveActor(w,a,{x:a.home.x+Math.sin(angle)*4,y:a.home.y,z:a.home.z+Math.cos(angle)*4},.75,dt)}continue}
      const tactic=combatTactic(w,a),d=a.kind==='hostile'?hostileDefinition(a.species)!:undefined,reach=tactic==='sling'?18:d?.reach||2.2,aggro=tactic==='ambush'?7:d?.aggro||0,near=flatDistance(a.position,player.position)<180
      if(!near&&a.phase!=='return')continue
      let target=a.targetId?combatActor(w,a.targetId):undefined
      if(!living(target)||target===a){a.targetId=undefined;target=undefined}
      if(!target&&d){target=c.actors.filter(b=>b.kind!=='hostile'&&living(b)&&flatDistance(a.position,b.position)<aggro&&(!w.home||flatDistance(b.position,w.home)>45)&&(b.kind==='player'||settlements(w).every(s=>Math.hypot(s.x-b.position.x,s.z-b.position.z)>130))).sort((b,e)=>flatDistance(a.position,b.position)-flatDistance(a.position,e.position)).find(b=>attackClear(w,a,b));if(target)a.targetId=target.id}
      if(target&&(flatDistance(target.position,a.home)>(tactic==='ward'?14:d?65:18)||flatDistance(a.position,a.home)>(d?65:18)||(w.home&&flatDistance(target.position,w.home)<45))){a.targetId=undefined;target=undefined;phase(w,a,'return')}
      if(a.phase==='windup'){
        if(w.time>=(a.strikeAt??Infinity)){
          if(target&&canReach(w,a,target,reach)){
            if(tactic==='sling'){(c.projectiles??=[]).push({id:c.nextEvent,source:a.id,target:target.id,start:{...a.position,y:a.position.y+1.3},end:{...target.position,y:target.position.y+.8},launched:w.time,arrives:w.time+flatDistance(a.position,target.position)/15,damage:12});emit(w,{type:'attack',source:a.id,target:target.id,amount:0})}
            else if(tactic==='smash'){for(const b of c.actors)if(b.kind!=='hostile'&&living(b)&&canReach(w,a,b,reach))damage(w,b,d!.damage,d!.damageType,a.id)}
            else {const hit=damage(w,target,d?.damage||9,d?.damageType||'physical',a.id);if(hit&&tactic==='ward')target.vitality.stamina=Math.max(0,target.vitality.stamina-25)}
          }
          else emit(w,{type:'miss',source:a.id,target:target?.id||'player',amount:0})
          phase(w,a,'recover');v.cooldownUntil=w.time+(tactic==='flank'?2.2:d?.recovery||1.5);if(tactic==='guard')v.blockingUntil=w.time+.8
        }
        continue
      }
      if(a.phase==='recover'&&v.cooldownUntil>w.time){if(target&&tactic==='flank')moveActor(w,a,flankingPoint(a,target.position,true),d!.speed*.65,dt);continue}
      if(target){
        a.yaw=Math.atan2(target.position.x-a.position.x,target.position.z-a.position.z)
        if(canReach(w,a,target,reach)){phase(w,a,'windup');a.strikeAt=w.time+(tactic==='sling'?1.25:d?.windup||.9);a.attackSerial++;emit(w,{type:'attack',source:a.id,target:target.id,amount:0})}
        else{phase(w,a,'chase');moveActor(w,a,tactic==='flank'&&flatDistance(a.position,target.position)<10?flankingPoint(a,target.position):target.position,(d?.speed||2.2)*(tactic==='ambush'?1.7:1),dt)}
      }else if(a.phase==='return'||flatDistance(a.position,a.home)>8){phase(w,a,'return');moveActor(w,a,a.home,d?.speed||2,dt);if(flatDistance(a.position,a.home)<1){phase(w,a,'idle');if(w.time-v.lastDamage>15)v.hp=Math.min(v.maxHp,v.hp+dt*5)}}
      else if(tactic==='ambush'||tactic==='ward'){phase(w,a,'idle')}else{phase(w,a,'patrol');const angle=w.time*.12+c.actors.indexOf(a),p={x:a.home.x+Math.sin(angle)*3,y:a.home.y,z:a.home.z+Math.cos(angle)*3};moveActor(w,a,p,(d?.speed||1)*.35,dt);if(w.time-v.lastDamage>20)v.hp=Math.min(v.maxHp,v.hp+dt)}
    }
  }
  w.time=finish
}

export function validateCombat(w:World){
  const c=w.combat;if(c===undefined)return
  const finite=(n:unknown,min=0,max=1e10)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max
  const point=(p:unknown)=>finitePoint(p)&&inBounds(p.x,p.z,w)&&finite(p.y,-125,600)
  if(!c||c.version!==1||!Array.isArray(c.actors)||c.actors.length>(w.life?1600:600)||!Array.isArray(c.events)||c.events.length>64||!Number.isSafeInteger(c.nextEvent)||c.nextEvent<1||!Number.isInteger(c.healingDraughts)||!finite(c.healingDraughts,0,3)||!finite(c.peakY,-125,600)||!finite(c.lastPlayerY,-125,600)||typeof c.grounded!=='boolean')throw Error('Invalid combat state in save.')
  const ids=new Set(c.actors.map(a=>a?.id));if(ids.size!==c.actors.length||!ids.has('player'))throw Error('Invalid combat identities.')
  if(c.projectiles!==undefined&&(!Array.isArray(c.projectiles)||c.projectiles.length>50||c.projectiles.some(p=>!p||!Number.isSafeInteger(p.id)||!ids.has(p.source)||!ids.has(p.target)||!point(p.start)||!point(p.end)||!finite(p.launched,0,w.time)||!finite(p.arrives,p.launched,p.launched+5)||!finite(p.damage,0,1000))))throw Error('Invalid projectile state.')
  for(const a of c.actors){
    const v=a?.vitality,kindValid=a?.kind==='player'?a.id==='player':a?.kind==='hostile'?a.id===`hostile:${a.species}`&&!!hostileDefinition(a.species):a?.kind==='resident'?/^resident:\d+:\d+$/.test(a.id):a?.kind==='animal'?w.animals.some(b=>b.id===a.id&&b.species===a.species):false
    if(!kindValid||typeof a.name!=='string'||a.name.length>100||!point(a.home)||!point(a.position)||!finite(a.yaw,-1e10)||!['idle','patrol','chase','windup','recover','return','dead'].includes(a.phase)||!finite(a.phaseAt,0,w.time)||[a.attackSerial,a.hitSerial,a.generation].some(n=>!Number.isSafeInteger(n)||n<0)||a.targetId!==undefined&&(!ids.has(a.targetId)||a.targetId===a.id)||a.strikeAt!==undefined&&!finite(a.strikeAt,0,w.time+10))throw Error('Invalid combat actor in save.')
    if(!v||!finite(v.maxHp,1,10000)||!finite(v.hp,0,v.maxHp)||!finite(v.armour,0,1000)||!finite(v.stamina,0,100)||!finite(v.breath,0,15)||![v.lastDamage,v.invulnerableUntil,v.cooldownUntil,v.blockingUntil].every(n=>finite(n))||!Array.isArray(v.effects)||v.effects.length>2||new Set(v.effects.map(e=>e.kind)).size!==v.effects.length||v.diedAt!==null&&!finite(v.diedAt,0,w.time)||v.respawnAt!==null&&!finite(v.respawnAt)||((v.hp===0)!==(a.phase==='dead'))||((v.hp===0)!==(v.diedAt!==null)))throw Error('Invalid health values in save.')
    for(const e of v.effects)if(!e||!['burn','poison'].includes(e.kind)||typeof e.source!=='string'||e.source.length>100||!finite(e.remaining,0,30)||!finite(e.nextTick)||!finite(e.damage,0,100))throw Error('Invalid status effect in save.')
  }
  let last=0;for(const e of c.events){if(!e||!Number.isSafeInteger(e.seq)||e.seq<=last||e.seq>=c.nextEvent||!finite(e.time,0,w.time)||!['damage','blocked','heal','death','respawn','attack','miss'].includes(e.type)||typeof e.source!=='string'||e.source.length>100||!ids.has(e.target)||!finite(e.amount,0,10000)||e.damageType!==undefined&&!DAMAGE_TYPES.includes(e.damageType))throw Error('Invalid combat event in save.');last=e.seq}
}
