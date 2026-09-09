import { ATLAS_GENERATOR, isAtlas, inBounds, fallFloor, publicGround, settlements, arrival, waterAt } from './atlas'
import { World, WorldAction, Point, SPECIES, Species, SETTLEMENTS, FURNITURE, Furnishing, WORLD_LIMIT, FALL_RECOVERY_Y, ANIMAL_ACTIVITIES, id, distance, finitePoint } from './model'
import { clear, density, height, surfaceAt, WATER_LEVEL, terrainClear, hasOutdoorExit } from './terrain'
import { breedingIssue } from './animalCare'
import { entrancePlan, fitDoor } from './building'
import { advanceWildlife } from './wildlife'
import { cinderlordSite } from './cinderlord'
import { ensureCombat, advanceCombat, validateCombat, combatActor, living, playerStrike, playerGuard, playerHeal, playerRespawn, encounterTravel, observePlayer, resetPlayerTracking, heal } from './combat'

export function createWorld(name='A home in the Shire',seed=42,generator:World['generator']='shire-1'):World {
  const context={seed,generator},spawn=isAtlas(context)?{x:0,z:-45,yaw:0}: {x:-56,z:22,yaw:-0.7},player={...spawn,y:height(spawn.x,spawn.z,context)+0.08,pitch:0}
  const w:World={version:1,generator,id:id(),name:name.trim().slice(0,60)||'A home in the Shire',seed,revision:0,createdAt:new Date().toISOString(),savedAt:new Date().toISOString(),time:0,player,edits:[],redo:[],furniture:[],crops:[],animals:[],supplies:{barleySeed:40,carrotSeed:40,barley:0,carrot:0,feed:80},storage:{barley:0,carrot:0}}
  const kinds=Object.keys(SPECIES) as Species[]
  kinds.forEach((species,i)=>{
    if(isAtlas(w)&&['llama','fish','frog'].includes(species))return
    const habitat=SPECIES[species].habitat
    const x=habitat==='water'?25:habitat==='bank'?2:habitat==='air'?12:5+(i%4)*8
    const z=habitat==='water'?114:habitat==='bank'?100:habitat==='air'?73:52+Math.floor(i/4)*12
    for(let k=0;k<2;k++){const home={x:x+k*2.2,y:height(x+k*2.2,z,context),z};if(habitat==='water')home.y=WATER_LEVEL-0.7;if(habitat==='air')home.y+=3
      w.animals.push({id:id(),name:`${SPECIES[species].label} ${k?'Ram / male':'Ewe / female'}`.replace(/Ram \/ male/,species==='sheep'?'ram':'male').replace(/Ewe \/ female/,species==='sheep'?'ewe':'female'),species,sex:k?'male':'female',age:SPECIES[species].maturity+1,home,position:{...home},fedUntil:180,cooldownUntil:0,mood:'grazing',tint:((i*31+k*13)%100)/100})}
  })
  ensureCombat(w);return w
}
function requireNear(w:World,p:Point,range=9){if(!finitePoint(p)||distance(w.player,p)>range)throw Error('Move closer to that place first.')}
function requireGround(w:World,p:Point){if(!finitePoint(p)||!inBounds(p.x,p.z,w)||Math.abs(p.y)>(isAtlas(w)?600:100))throw Error('Choose a place inside the world.');if(density(p.x,p.y-0.18,p.z,w,w.edits)<-0.25)throw Error('Place it on a supported floor or ground.')}
function isPublic(p:Point,w:World){return publicGround(p.x,p.z,w)}
function animal(w:World,aid:string){const a=w.animals.find(a=>a.id===aid);if(!a)throw Error('That animal is no longer here.');if(!living(combatActor(w,aid)))throw Error('That animal is defeated and cannot be cared for yet.');return a}
function safeOutdoorDestination(w:World,point:Point):Point {
  for(let ring=0;ring<=16;ring++)for(let i=0;i<(ring?16:1);i++){
    const angle=i*Math.PI/8,x=point.x+Math.cos(angle)*ring*0.75,z=point.z+Math.sin(angle)*ring*0.75
    if(!inBounds(x,z,w))continue
    const edits=w.edits.filter(e=>Math.abs(x-e.center.x)<=Math.hypot(e.size.x,e.size.z)+1&&Math.abs(z-e.center.z)<=Math.hypot(e.size.x,e.size.z)+1)
    const local={...w,edits},from=Math.max(height(x,z,w)+1,...edits.filter(e=>e.kind==='fill').map(e=>e.center.y+e.size.y+1)),p={x,y:surfaceAt(x,z,local,from)+0.08,z}
    // Recovery returns to supported outdoor ground, never the bottom of a deep excavated shaft.
    if(p.y<=fallFloor(w)+0.2||p.y<height(x,z,w)-0.5||density(x,p.y-0.4,z,w,edits)<=0)continue
    if(clear(p,local))return p
  }
  throw Error('There is no clear ground near this destination. Choose another map destination and clear some space first.')
}
export function advanceWorld(w:World,seconds:number){
  if(!Number.isFinite(seconds))throw Error('Invalid world time step.')
  ensureCombat(w);const dt=Math.max(0,Math.min(seconds,120));w.time+=dt
  advanceCombat(w,dt)
  advanceWildlife(w,dt)
  for(const a of [...w.animals]) {
    if(!living(combatActor(w,a.id)))continue
    a.age+=dt;const spec=SPECIES[a.species]
    if(a.pregnant&&a.pregnant.due<=w.time&&w.animals.length<100){
      const sire=a.pregnant.sire;w.animals.push({id:id(),name:`${spec.label} ${w.animals.filter(b=>b.species===a.species).length+1}`,species:a.species,sex:(w.animals.length%2)?'male':'female',age:0,home:{x:a.home.x+1,y:a.home.y,z:a.home.z+1},position:{...a.position},fedUntil:w.time+300,parents:[a.id,sire],cooldownUntil:0,mood:'resting',tint:a.tint})
      a.pregnant=undefined;a.cooldownUntil=w.time+120
    }
  }
  ensureCombat(w)
}
export function applyAction(w:World,a:WorldAction):string {
  ensureCombat(w)
  if(!living(combatActor(w,'player'))&&!['respawn','save','checkpoint'].includes(a.type))throw Error('You are defeated. Recover at home before acting.')
  let message='Saved.'
  switch(a.type){
    case 'checkpoint': {observePlayer(w,a.player);break}
    case 'strike':message=playerStrike(w,a.id);break
    case 'guard':message=playerGuard(w);break
    case 'heal':message=playerHeal(w);break
    case 'respawn':message=playerRespawn(w);break
    case 'travel-encounter':message=encounterTravel(w,a.id);break
    case 'claim': {requireNear(w,a.position);if(isPublic(a.position,w))throw Error('This is a public settlement. Choose a free hill beyond the homes.');if(height(a.position.x,a.position.z,w)<waterAt(a.position.x,a.position.z,w)+2)throw Error('Choose a dry hillside above the water.');w.home={...a.position};message='Your home marker is set. Dig into the hill, then connect rooms inside.';break}
    case 'entrance': {
      requireNear(w,a.origin,3)
      if(!Number.isFinite(a.yaw)||![a.width,a.height].every(n=>Number.isFinite(n)&&n>=2&&n<=6)||Math.abs(a.origin.y-w.player.y)>0.3)throw Error('Entry must begin at your feet, with a usable width and height.')
      const plan=entrancePlan(w,a),batch=id()
      if(w.edits.length+plan.edits.length>1500)throw Error('There is no excavation budget left for a complete entrance.')
      for(const e of plan.edits){const radius=Math.hypot(e.size.x,e.size.z)/2;for(let x=-radius;x<=radius;x+=1)for(let z=-radius;z<=radius;z+=1)if(isPublic({x:e.center.x+x,y:0,z:e.center.z+z},w))throw Error('Move away from public homes before tunnelling.')}
      w.edits.push(...plan.edits.map(e=>({...e,id:id(),batch})));w.redo=[]
      message=`Entry dug ${plan.length} m into the hill and ${plan.drop.toFixed(1)} m down, ending in a level chamber. Walk down the slope to reach it.`;break
    }
    case 'excavate': {
      const e=a.edit;requireNear(w,e.center,11)
      if(!finitePoint(e.size)||!Number.isFinite(e.yaw)||!['dig','fill'].includes(e.kind)||!['sphere','box','cylinder'].includes(e.shape)||![e.size.x,e.size.y,e.size.z].every(v=>v>=0.2&&v<=8)||Math.abs(e.center.y)>(isAtlas(w)?600:60)||e.batch!==undefined||e.slope!==undefined)throw Error('Choose a supported brush size between 0.2 and 8 metres.')
      if(w.edits.length>=1500)throw Error('This world has reached its current excavation budget. Export a backup before expanding further.')
      if(isPublic(e.center,w))throw Error('Public homes and paths are protected. Build on a free hillside.')
      if(e.kind==='dig'&&!e.entrance&&e.shape==='box'){
        const nx=Math.ceil(e.size.x/0.35),nz=Math.ceil(e.size.z/0.35),c=Math.cos(e.yaw),s=Math.sin(e.yaw),top=e.center.y+e.size.y/2
        for(let ix=0;ix<=nx;ix++)for(let iz=0;iz<=nz;iz++){
          const dx=e.size.x*(ix/nx-0.5),dz=e.size.z*(iz/nz-0.5),x=e.center.x+dx*c+dz*s,z=e.center.z-dx*s+dz*c
          for(const dy of [0.1,0.35,0.65])if(density(x,top+dy,z,w,w.edits)<0.03)throw Error('Too little earth above part of this room. Move deeper into the hill, narrow the room or lower the ceiling.')
        }
      }
      const edit={...e,id:id()};w.edits.push(edit)
      if(!terrainClear(w.player,w)){w.edits.pop();throw Error('That change would bury you. Step back before adding earth.')}
      w.redo=[];message=e.kind==='dig'?'Earth removed. The room and its roof are part of the same hill.':'Earth added.';break
    }
    case 'undo': {const e=w.edits.at(-1);if(!e)throw Error('There is no terrain edit to undo.');let count=1;while(e.batch&&w.edits.at(-count-1)?.batch===e.batch)count++;const removed=w.edits.splice(-count);if(!terrainClear(w.player,w)){w.edits.push(...removed);throw Error('Step outside this excavation before undoing it.')}w.redo.push(...removed.reverse());message='Terrain edit undone.';break}
    case 'redo': {const e=w.redo.at(-1);if(!e)throw Error('There is no terrain edit to redo.');let count=1;while(e.batch&&w.redo.at(-count-1)?.batch===e.batch)count++;const restored=w.redo.splice(-count).reverse();w.edits.push(...restored);if(!terrainClear(w.player,w)){w.edits.splice(-count);w.redo.push(...restored.reverse());throw Error('Step clear before restoring that edit.')}message='Terrain edit restored.';break}
    case 'furnish': {
      requireNear(w,a.position);requireGround(w,a.position);if(!Object.hasOwn(FURNITURE,a.kind)||!Number.isFinite(a.yaw))throw Error('Choose a furnishing from the list.')
      if(isPublic(a.position,w))throw Error('Furnish your own home or land outside the public settlement.')
      if(w.furniture.length>=1000)throw Error('This world has reached its current furnishing budget.')
      const f:Furnishing={id:id(),kind:a.kind,position:{...a.position},yaw:a.yaw,open:['perch','burrow'].includes(a.kind)},sz=FURNITURE[a.kind].size
      if(a.kind==='door'){const fitted=fitDoor(w,a.position,a.yaw);f.position=fitted.position;f.fit=fitted.fit}
      else for(const dy of [0.1,sz.y])for(const dx of [-sz.x/2,sz.x/2])for(const dz of [-sz.z/2,sz.z/2]){const c=Math.cos(a.yaw),s=Math.sin(a.yaw);if(density(a.position.x+dx*c+dz*s,a.position.y+dy,a.position.z-dx*s+dz*c,w,w.edits)>0.12)throw Error('The furnishing overlaps earth. Dig more space first.')}
      if(['feeder','perch','burrow'].includes(a.kind)&&height(f.position.x,f.position.z,w)-f.position.y>0.5)throw Error('Wildlife habitats belong outdoors.')
      if(a.kind==='feeder')f.stock=0
      if(w.furniture.some(b=>distance(b.position,f.position)<0.55))throw Error('That place is already occupied.')
      const inside=height(w.player.x,w.player.z,w)>w.player.y+2,hadExit=inside&&hasOutdoorExit(w.player,w)
      w.furniture.push(f);if(!clear(w.player,w)){w.furniture.pop();throw Error('That furnishing would block you. Place it farther away.')}
      if(hadExit&&!hasOutdoorExit(w.player,w)){w.furniture.pop();throw Error('That furnishing would block the route outdoors. Keep the passage clear.')}
      message=`${FURNITURE[a.kind].label} placed.`;break
    }
    case 'remove-furniture': {const f=w.furniture.find(f=>f.id===a.id);if(!f)throw Error('Choose a furnishing.');requireNear(w,f.position);w.furniture=w.furniture.filter(f=>f.id!==a.id);message='Furnishing returned to the catalogue.';break}
    case 'use-furniture': {const f=w.furniture.find(f=>f.id===a.id);if(!f)throw Error('Choose a furnishing.');requireNear(w,f.position,4);if(f.kind==='door'){f.open=!f.open;if(!clear(w.player,w)){f.open=!f.open;throw Error('Step clear of the doorway.')}message=f.open?'Door opened.':'Door closed.'}else if(f.kind==='bed'){advanceWorld(w,60);message='You rested for 60 seconds of world time.'}else if(f.kind==='chest'){message='Household storage is open. Use Store produce or Take produce.'}else if(f.kind==='feeder'){const added=Math.min(12-(f.stock||0),w.supplies.feed);if(added<=0)throw Error((f.stock||0)>=12?'This feeder is full.':'Harvest crops for more feed.');w.supplies.feed-=added;f.stock=(f.stock||0)+added;message=`Added ${added} feed. Hungry wildlife can approach and eat.`}else if(f.kind==='perch'||f.kind==='burrow'){f.open=!f.open;message=f.open?`${FURNITURE[f.kind].label} is open to wildlife.`:`${FURNITURE[f.kind].label} is closed to wildlife.`}else if(f.kind==='lamp'){f.open=!f.open;message=f.open?'Lantern switched off.':'Lantern lit.'}else message=`${FURNITURE[f.kind].label} is part of your home.`;break}
    case 'plant': {requireNear(w,a.position);requireGround(w,a.position);if(!['barley','carrot'].includes(a.kind))throw Error('Choose barley or carrots.');if(a.position.y<waterAt(a.position.x,a.position.z,w))throw Error('This soil is waterlogged.');if(height(a.position.x,a.position.z,w)-a.position.y>0.5)throw Error('Crops need daylight. Choose outdoor soil.');if(w.crops.some(c=>!c.harvested&&distance(c.position,a.position)<1))throw Error('Leave a little space between crops.');if(w.crops.filter(c=>!c.harvested).length>=500)throw Error('The current farm is full.');const key=a.kind==='barley'?'barleySeed':'carrotSeed';if(w.supplies[key]<1)throw Error('No seeds left. Harvest a ripe crop to collect more.');w.supplies[key]--;w.crops=w.crops.filter(c=>!c.harvested);w.crops.push({id:id(),kind:a.kind,position:{...a.position},planted:w.time,watered:false,harvested:false});message='Soil tilled and seed planted. Water it to start growth.';break}
    case 'water': {const c=w.crops.find(c=>c.id===a.id&&!c.harvested);if(!c)throw Error('Choose a planted crop.');requireNear(w,c.position);if(!c.watered)c.planted=w.time;c.watered=true;message='Crop watered. It will ripen in 60 seconds of play.';break}
    case 'harvest': {const c=w.crops.find(c=>c.id===a.id&&!c.harvested);if(!c)throw Error('That crop has already been harvested.');requireNear(w,c.position);if(!c.watered||w.time-c.planted<60)throw Error('This crop is not ripe yet. Water it and give it time.');c.harvested=true;w.supplies[c.kind]+=3;w.supplies[c.kind==='barley'?'barleySeed':'carrotSeed']+=2;w.supplies.feed+=4;message='Harvested 3 produce, 2 seeds and 4 animal feed.';break}
    case 'feed': {const b=animal(w,a.id);requireNear(w,b.position,7);if(w.supplies.feed<1)throw Error('Harvest crops for more feed.');w.supplies.feed--;b.fedUntil=w.time+300;b.calmUntil=w.time+60;b.startledUntil=0;message=`${b.name} is fed, calm and cared for.`;break}
    case 'calm': {const b=animal(w,a.id);requireNear(w,b.position,7);b.calmUntil=w.time+45;b.startledUntil=0;b.activity='watching';message=`You wait quietly. ${b.name} relaxes around you for 45 seconds.`;break}
    case 'startle': {const b=animal(w,a.id);requireNear(w,b.position,9);b.startledUntil=w.time+8;b.calmUntil=0;b.activity='fleeing';message=`${b.name} reacts to your call and moves to safety.`;break}
    case 'breed': {
      const issue=breedingIssue(w,a.dam,a.sire);if(issue)throw Error(issue)
      const dam=animal(w,a.dam),sire=animal(w,a.sire),species=SPECIES[dam.species]
      dam.pregnant={sire:sire.id,due:w.time+species.gestation};sire.cooldownUntil=w.time+species.gestation+120
      message=['chicken','bird','fish','frog'].includes(dam.species)?`A fertilised clutch is developing. Young are due in ${species.gestation} seconds.`:`Breeding succeeded. Offspring due in ${species.gestation} seconds of play.`;break
    }
    case 'store':case 'withdraw': {const chest=w.furniture.find(f=>f.kind==='chest'&&distance(f.position,w.player)<4);if(!chest)throw Error('Stand beside your household chest.');for(const key of ['barley','carrot'] as const){const from=a.type==='store'?w.supplies:w.storage,to=a.type==='store'?w.storage:w.supplies;to[key]+=from[key];from[key]=0}message=a.type==='store'?'Produce stored in your household chest.':'Produce taken from storage.';break}
    case 'travel-cinderlord': {if(isAtlas(w))throw Error('Ashen Hollow belongs to the original creative world.');const site=cinderlordSite(w);w.player={...safeOutdoorDestination(w,{x:site.x,y:0,z:site.z+32}),yaw:0,pitch:0.08};message='Ashen Hollow overlook. Cinderlord is hostile: approach to challenge it, or return home from the map.';break}
    case 'travel': {const s=settlements(w)[a.settlement];if(!s)throw Error('Choose a destination.');const target=arrival(s,w);w.player={...target,...safeOutdoorDestination(w,target)};message=`Arrived at ${s.name}. Travel is a game-design shortcut; you can also walk the continuous countryside.`;break}
    case 'return-home': {w.player={...safeOutdoorDestination(w,w.home||(isAtlas(w)?{x:0,y:0,z:-45}:{x:-56,y:0,z:22})),yaw:-0.7,pitch:0};message='Returned to clear ground beside your home marker.';break}
    case 'save':break
    default:throw Error('That action is not supported.')
  }
  if(['travel','travel-cinderlord','return-home'].includes(a.type))resetPlayerTracking(w)
  if(a.type==='feed'){const b=combatActor(w,a.id);if(b)heal(w,b,12,'feed')}
  if(a.type==='use-furniture'&&w.furniture.find(f=>f.id===a.id)?.kind==='bed'){
    const p=combatActor(w,'player')!;if(living(p)){heal(w,p,p.vitality.maxHp,'rest');p.vitality.effects=[];p.vitality.stamina=100;w.combat!.healingDraughts=3;message='Rested, restored health and replenished three healing draughts.'}
  }
  w.revision++;return message
}

export function validateWorld(value:unknown): asserts value is World {
  const w=value as World
  const validId=(s:unknown)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s)
  const point=(p:unknown)=>finitePoint(p)&&!(!w||!inBounds(p.x,p.z,w))&&p.y>=(isAtlas(w)?-125:-40)&&p.y<=(isAtlas(w)?600:100)
  const nonnegative=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0
  if(!w||w.version!==1||!['shire-1',ATLAS_GENERATOR].includes(w.generator)||!validId(w.id)||typeof w.name!=='string'||!w.name.trim()||w.name.length>72||!Number.isSafeInteger(w.seed)||!nonnegative(w.time)||!Number.isSafeInteger(w.revision)||w.revision<0||!point(w.player)||!Number.isFinite(w.player.yaw)||!Number.isFinite(w.player.pitch)||!Number.isFinite(Date.parse(w.createdAt))||!Number.isFinite(Date.parse(w.savedAt))||(w.home&&!point(w.home)))throw Error('This save has an unsupported format or invalid world header.')
  for(const [key,max] of [['edits',1500],['redo',1500],['furniture',1000],['crops',500],['animals',100]] as const)if(!Array.isArray(w[key])||w[key].length>max)throw Error(`Invalid ${key} in save.`)
  const records=[...w.edits,...w.redo,...w.furniture,...w.crops,...w.animals]
  if(records.some(r=>!r||!validId(r.id))||new Set(records.map(r=>r.id)).size!==records.length)throw Error('Invalid or duplicate object identity in save.')
  for(const e of [...w.edits,...w.redo])if(!point(e.center)||!finitePoint(e.size)||![e.size.x,e.size.y,e.size.z].every(v=>Number.isFinite(v)&&v>=0.2&&v<=(e.shape==='ramp'?24:8))||!Number.isFinite(e.yaw)||typeof e.entrance!=='boolean'||!['dig','fill'].includes(e.kind)||!['box','sphere','cylinder','ramp'].includes(e.shape)||(e.batch!==undefined&&!validId(e.batch))||(e.shape==='ramp'?e.kind!=='dig'||!Number.isFinite(e.slope)||Math.abs(e.slope!)>0.3:e.slope!==undefined))throw Error('Invalid terrain data in save.')
  for(const f of w.furniture){if(!Object.hasOwn(FURNITURE,f.kind)||!point(f.position)||!Number.isFinite(f.yaw)||typeof f.open!=='boolean'||(f.stock!==undefined&&(f.kind!=='feeder'||!Number.isInteger(f.stock)||f.stock<0||f.stock>12)))throw Error('Invalid furnishing in save.');if(f.fit&&(f.kind!=='door'||![f.fit.width,f.fit.height,f.fit.openingWidth,f.fit.openingHeight].every(n=>Number.isFinite(n)&&n>0&&n<=10)||f.fit.openingWidth>f.fit.width||f.fit.openingHeight>f.fit.height))throw Error('Invalid doorway fit in save.')}
  for(const c of w.crops)if(!point(c.position)||!['barley','carrot'].includes(c.kind)||!nonnegative(c.planted)||c.planted>w.time||typeof c.watered!=='boolean'||typeof c.harvested!=='boolean')throw Error('Invalid crop in save.')
  for(const a of w.animals){
    if(!Object.hasOwn(SPECIES,a.species)||typeof a.name!=='string'||a.name.length>100||!point(a.position)||!point(a.home)||![a.age,a.fedUntil,a.cooldownUntil,a.tint].every(nonnegative)||a.tint>1||!['male','female'].includes(a.sex)||!['grazing','walking','resting','hungry'].includes(a.mood)||(a.activity!==undefined&&!ANIMAL_ACTIVITIES.includes(a.activity))||(a.startledUntil!==undefined&&!nonnegative(a.startledUntil))||(a.calmUntil!==undefined&&!nonnegative(a.calmUntil)))throw Error('Invalid animal in save.')
    const pair=(mother:string,father:string)=>{const dam=w.animals.find(b=>b.id===mother),sire=w.animals.find(b=>b.id===father);return dam&&sire&&mother!==father&&a.id!==father&&dam.species===a.species&&sire.species===a.species&&dam.sex==='female'&&sire.sex==='male'}
    if(a.parents&&(!Array.isArray(a.parents)||a.parents.length!==2||a.id===a.parents[0]||!pair(...a.parents)))throw Error('Invalid parent lineage in save.')
    if(a.pregnant&&(a.sex!=='female'||!nonnegative(a.pregnant.due)||!pair(a.id,a.pregnant.sire)))throw Error('Invalid developing offspring in save.')
  }
  for(const [obj,keys] of [[w.supplies,['barleySeed','carrotSeed','barley','carrot','feed']],[w.storage,['barley','carrot']]] as const)if(!obj||keys.some(k=>!Object.hasOwn(obj,k))||Object.values(obj).some(v=>!Number.isSafeInteger(v)||v<0||v>1e7))throw Error('Invalid household supplies in save.')
  validateCombat(w)
}
