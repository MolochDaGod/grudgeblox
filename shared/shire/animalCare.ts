import { Point, SPECIES, World, distance } from './model'

/** Shared by the care panel and the authoritative action service. */
export function breedingIssue(w:World,damId:string,sireId:string,observer:Point=w.player):string|null {
  const dam=w.animals.find(a=>a.id===damId),sire=w.animals.find(a=>a.id===sireId)
  if(!dam||!sire)return 'Choose a female and a male from your animal list.'
  if(dam.id===sire.id||dam.species!==sire.species||dam.sex!=='female'||sire.sex!=='male')return 'Select a female and a male of the same species.'
  const species=SPECIES[dam.species]
  if(dam.age<species.maturity||sire.age<species.maturity)return 'Young animals must grow into adults first.'
  if(distance(observer,dam.position)>9||distance(observer,sire.position)>12)return 'Move closer to both selected parents first.'
  if(dam.fedUntil<w.time||sire.fedUntil<w.time)return 'Feed both parents first.'
  if(dam.pregnant)return `These parents need time: young are due in ${Math.max(0,Math.ceil(dam.pregnant.due-w.time))} seconds.`
  const remaining=Math.ceil(Math.max(dam.cooldownUntil,sire.cooldownUntil)-w.time)
  if(remaining>0)return `These parents need time to recover: ${remaining} seconds remaining.`
  if(w.animals.length+w.animals.filter(a=>a.pregnant).length>=100)return 'Your current animal population is full.'
  return null
}
