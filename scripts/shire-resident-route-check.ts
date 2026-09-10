import assert from 'node:assert/strict'
import {createWorld,advanceWorld} from '../shared/shire/simulation'
import {ensureLife} from '../shared/shire/life'
import {combatActor} from '../shared/shire/combat'
import {clear,surfaceAt,height} from '../shared/shire/terrain'
import {bridgeDeck,ATLAS_BRIDGES} from '../shared/shire/atlas'
const w=createWorld('Resident route checks',42,'shire-atlas-1');w.time=200;ensureLife(w,'homestead')
const initial=w.life!.residents.slice(0,6).map(r=>({id:r.id,position:{...combatActor(w,r.id)!.position}}))
for(let i=0;i<180;i++)advanceWorld(w,1)
const results=w.life!.residents.slice(0,6).map(r=>({id:r.id,name:r.name,activity:r.activity,inside:r.insideBuilding,fromStart:Math.hypot(combatActor(w,r.id)!.position.x-initial.find(a=>a.id===r.id)!.position.x,combatActor(w,r.id)!.position.z-initial.find(a=>a.id===r.id)!.position.z),remaining:Math.hypot(combatActor(w,r.id)!.position.x-r.destination.x,combatActor(w,r.id)!.position.z-r.destination.z),position:combatActor(w,r.id)!.position,destination:r.destination}))
console.log(JSON.stringify(results,null,2))
if(process.argv.includes('--assert')){
  assert(results.filter(r=>r.remaining<2||r.inside).length>=4,'Most working neighbours must reach their actual destination within three minutes')
  const bridge=ATLAS_BRIDGES[0],y=surfaceAt(bridge.x,bridge.z,w,bridgeDeck(bridge)+2)
  assert(Math.abs(y-bridgeDeck(bridge))<.05,'NPC navigation must use the rendered bridge deck')
  assert(clear({x:bridge.x,y:y+.08,z:bridge.z},w),'The centre of a bridge is walkable')
  console.log('PASS resident work destinations and bridge support')
}
