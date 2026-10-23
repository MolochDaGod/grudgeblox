import assert from 'node:assert/strict'
import test from 'node:test'
import { createWorld, advanceWorld, validateWorld } from '../shared/shire/simulation'
import { height, clear } from '../shared/shire/terrain'
import { pasturePatches, consumePasture, patchById } from '../shared/shire/pasture'
import { observation, mergeObservation } from '../shared/shire/observation'
import { combatActor } from '../shared/shire/combat'
import { ensureLife, advanceLife } from '../shared/shire/life'
import { placeById } from '../shared/shire/lifeContent'

function scenario(){
  const w=createWorld('NPC goal verification'),cow=w.animals.find(a=>a.species==='cattle')!
  w.animals=[cow];w.combat!.actors=w.combat!.actors.filter(a=>a.kind==='player'||a.id===cow.id)
  cow.home=cow.position={x:-60,y:height(-60,22,w),z:22};cow.fedUntil=0;cow.calmUntil=1e6
  w.player={x:-56,y:height(-56,22,w),z:22,yaw:0,pitch:0}
  const actor=combatActor(w,cow.id)!;actor.position={...cow.position};actor.home={...cow.home}
  return {w,cow}
}
test('native world simulation travels to grass, consumes it, completes grazing and chooses rest',()=>{
  const {w,cow}=scenario(),start={...cow.position};let grazing=false,travelled=false,rested=false
  for(let i=0;i<160;i++){advanceWorld(w,.5);travelled||=Math.hypot(cow.position.x-start.x,cow.position.z-start.z)>.5;grazing||=cow.activity==='grazing';rested||=!!cow.goal?.completed&&cow.goal.kind==='rest'}
  assert.ok(travelled);assert.ok(grazing);assert.ok(rested);assert.ok(cow.fedUntil>w.time);assert.ok(Object.values(w.grazing!).some(r=>r.amount<.6));validateWorld(w)
})
test('depleted grass is skipped and an unreachable goal is cooled down without teleporting',()=>{
  const {w,cow}=scenario(),patch=pasturePatches(w,cow.position).sort((a,b)=>Math.hypot(a.position.x-cow.position.x,a.position.z-cow.position.z)-Math.hypot(b.position.x-cow.position.x,b.position.z-cow.position.z))[0]
  consumePasture(w,patch.id,1);advanceWorld(w,.5);assert.notEqual(cow.goal!.target,`patch:${patch.id}`)
  const start={...cow.position},g=cow.goal!;g.target='patch:10:10';g.destination={x:40,y:height(40,40,w),z:40};g.progressAt=0;g.last={...start}
  // An enclosing fence blocks actual terrain navigation; no mocked selector.
  for(const [dx,dz,yaw]of [[0,1,0],[0,-1,0],[1,0,Math.PI/2],[-1,0,Math.PI/2]])w.furniture.push({id:crypto.randomUUID(),kind:'fence',position:{x:start.x+dx,y:start.y,z:start.z+dz},yaw,open:false})
  for(let i=0;i<16;i++)advanceWorld(w,.5)
  assert.ok(cow.goal!.blocked.some(b=>b.id==='patch:10:10'));assert.ok(Math.hypot(cow.position.x-start.x,cow.position.z-start.z)<1.5);assert.ok(cow.fedUntil<=w.time);validateWorld(w)
})
test('startle interrupts grazing, stock feeds once, save reload and observations retain resource state',()=>{
  const {w,cow}=scenario();for(let i=0;i<50&&cow.activity!=='grazing';i++)advanceWorld(w,.5)
  const original=cow.goal!.target;cow.startledUntil=w.time+2;cow.calmUntil=0;w.player={...cow.position,yaw:0,pitch:0};advanceWorld(w,.5);assert.equal(cow.activity,'fleeing');assert.equal(cow.goal!.target,'')
  cow.calmUntil=1e6;cow.startledUntil=0;const p={x:cow.position.x+2,y:cow.position.y,z:cow.position.z};w.furniture=[];w.furniture.push({id:crypto.randomUUID(),kind:'feeder',position:p,yaw:0,open:true,stock:2});cow.fedUntil=0
  for(let i=0;i<40;i++)advanceWorld(w,.5)
  assert.equal(w.furniture[0].stock,1);assert.ok(cow.fedUntil>w.time)
  const restored=JSON.parse(JSON.stringify(w));validateWorld(restored);assert.deepEqual(restored.grazing,w.grazing);assert.ok(original.startsWith('patch:'))
  const stale=structuredClone(w);stale.grazing={};assert.deepEqual(mergeObservation(stale,observation(w)).grazing,w.grazing)
})
test('pasture regrows by world time and invalid resource or need values fail save validation',()=>{
  const {w,cow}=scenario(),p=pasturePatches(w,cow.position)[0];consumePasture(w,p.id,.7);assert.ok(patchById(w,p.id)!.amount<.31);w.time=300;assert.equal(patchById(w,p.id)!.amount,1)
  w.grazing![p.id].amount=NaN;assert.throws(()=>validateWorld(w),/pasture/)
})
test('pig roots and chicken pecks actual pasture while a bird seeks its open perch',()=>{
  for(const species of ['pig','chicken','bird'] as const){const w=createWorld(),a=w.animals.find(a=>a.species===species)!;w.animals=[a];w.combat!.actors=w.combat!.actors.filter(b=>b.kind==='player'||b.id===a.id);a.home=a.position={x:-60,y:height(-60,22,w)+(species==='bird'?3:0),z:22};a.fedUntil=0;a.calmUntil=1e6;w.player={x:-56,y:height(-56,22,w),z:22,yaw:0,pitch:0};if(species==='bird')w.furniture.push({id:crypto.randomUUID(),kind:'perch',position:{x:-58,y:height(-58,22,w),z:22},yaw:0,open:true});let acted=false;for(let i=0;i<80;i++){advanceWorld(w,.5);acted||=a.activity===(species==='pig'?'rooting':species==='chicken'?'pecking':'perching')}assert.ok(acted,species);assert.equal(a.goal!.kind,species==='bird'?'perch':'rest');validateWorld(w)}
})
test('a resident completes real crop care after arrival; a ranger advances only after surveying',()=>{
  const w=createWorld();ensureLife(w,'homestead');w.time=180;const farmer=w.life!.residents.find(r=>r.role==='farmer')!,a=combatActor(w,farmer.id)!,work=placeById(w,farmer.workBuilding)!
  w.life!.weather={kind:'clear',nextChange:10000};const p=Array.from({length:16},(_,i)=>{const x=work.door.x+Math.cos(i)*6,z=work.door.z+Math.sin(i)*6;return {x,y:height(x,z,w)+.08,z}}).find(p=>clear(p,w))!;assert.ok(p);w.crops=[{id:crypto.randomUUID(),kind:'carrot',position:p,planted:0,watered:false,harvested:false}];a.position={...p};a.targetId=undefined
  for(let i=0;i<7;i++){w.time++;advanceLife(w,1)}assert.equal(w.crops[0].watered,true);assert.ok(w.life!.stats[`npc-work:${farmer.id}`]>0);validateWorld(w)
  const ranger=w.life!.residents.find(r=>r.role==='ranger')!,actor=combatActor(w,ranger.id)!;ranger.workIndex=0;w.time+=50;advanceLife(w,1);assert.equal(ranger.workIndex,0);actor.position={...ranger.destination};actor.targetId=undefined;for(let i=0;i<7;i++){w.time++;advanceLife(w,1)}assert.equal(ranger.workIndex,1)
})
