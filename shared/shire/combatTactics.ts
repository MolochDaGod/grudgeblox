import type { World, Point } from './model'
import type { CombatActor } from './combatTypes'

export type CombatTactic='pursuit'|'ambush'|'flank'|'guard'|'sling'|'ward'|'smash'|'swoop'
export function combatTactic(w:World,a:CombatActor):CombatTactic{
  if(!w.life||a.kind!=='hostile')return 'pursuit'
  if(a.species==='07-great-spider')return 'ambush'
  if(['08-warg','09-werewolf'].includes(a.species))return 'flank'
  if(['02-uruk-hai','03-half-orc','18-black-numenorean'].includes(a.species))return 'guard'
  if(a.species==='21-rhudaur-hillman')return 'sling'
  if(a.species==='23-barrow-wight')return 'ward'
  if(['04-troll','05-olog-hai','cinderlord'].includes(a.species))return 'smash'
  if(['10-vampire','12-fell-beast'].includes(a.species))return 'swoop'
  return 'pursuit'
}
export const TACTIC_HELP:Record<CombatTactic,string>={pursuit:'Pursues within its territory. Guard or dodge the marked strike.',ambush:'Waits close to its lair, then rushes with a poisonous bite. Keep your distance.',flank:'Circles your approach and withdraws between bites. Turn to face it.',guard:'Raises a guard between attacks. Strike during its windup or after its guard falls.',sling:'Throws a stone from a distance. Move sideways after the throw to evade it.',ward:'Defends a small barrow territory. Its close strike drains stamina.',smash:'Signals a broad ground strike affecting everyone inside the ring.',swoop:'Swoops low to attack and gains height during recovery.'}
export function flankingPoint(a:CombatActor,target:Point,retreat=false):Point{
  const dx=a.position.x-target.x,dz=a.position.z-target.z,length=Math.hypot(dx,dz)||1,side=a.attackSerial%2?1:-1
  return {x:target.x+dx/length*(retreat?6:2.2)+dz/length*side*(retreat?1:3),y:target.y,z:target.z+dz/length*(retreat?6:2.2)-dx/length*side*(retreat?1:3)}
}
