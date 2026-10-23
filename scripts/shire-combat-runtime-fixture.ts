/** Creates a separate playable QA save. Damage itself is exercised through the game. */
import { createWorld, validateWorld } from '../shared/shire/simulation'
import { resetPlayerTracking, combatActor } from '../shared/shire/combat'
import { height } from '../shared/shire/terrain'
import { LocalWorldStore } from '../back/src/shire/LocalWorldStore'
import { writeFile } from 'node:fs/promises'

async function main(){
  const w=createWorld('Original world combat verification',42,'shire-1')
  const resident=w.combat!.actors.find(a=>a.kind==='resident')!
  w.player={...resident.home,z:resident.home.z+3,y:height(resident.home.x,resident.home.z+3,w)+8,yaw:0,pitch:0}
  resetPlayerTracking(w)
  // An eight-metre fall at entry exercises actual client gravity and server landing damage.
  validateWorld(w)
  const saved=await new LocalWorldStore('E:/GrudgeBloxData/TheMiddleEarth').import(w)
  const result={id:saved.id,name:saved.name,player:saved.player,resident:resident.id,health:combatActor(saved,'player')!.vitality.hp}
  await writeFile('E:/GrudgeBloxData/TheMiddleEarth/evidence/hostile-combat-20260908/original-runtime-fixture.json',JSON.stringify(result,null,2))
  console.log(result)
}
void main()
