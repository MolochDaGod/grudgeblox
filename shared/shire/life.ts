import { World, WorldAction, Point, Furnishing, FurnitureKind, FURNITURE, SPECIES, id, distance, finitePoint } from './model'
import type { LifeAction, LifeState, ItemId, PlayStyle, Skill, LifeSettings, ResidentLife, QuestDefinition } from './lifeTypes'
import { PLAY_STYLES, DEFAULT_LIFE_SETTINGS, ITEMS, RECIPES, PROFESSIONS, QUESTS, places, placeById, residentDetails, hourAt, dayAt, seasonAt, calendarEvent, skillLevel } from './lifeContent'
import { resourceNodes, requireOwnedLand, suggestedHome, storyPlaces, ferryCrossing, populateRegion } from './lifeSpatial'
import { isAtlas, ATLAS_DESTINATIONS, ATLAS_TOWNS, ATLAS_PLACES, settlements, inBounds, publicGround, waterAt, riverAt, arrival } from './atlas'
import { height, surfaceAt, clear, density, terrainClear, hasOutdoorExit } from './terrain'
import { entrancePlan } from './building'
import { combatActor, ensureCombat, heal, living, resetPlayerTracking, safeCombatGround, configureLifeEncounters } from './combat'
import { roomObjects, roomServicePosition } from './interiors'
import { sceneryHash } from './atlasScenery'

const supplyItems=new Set<ItemId>(['barley','carrot','barleySeed','carrotSeed','feed'])
const flat=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z)
function ferryLanding(w:World){return ferryCrossing(w)?.slice().sort((a,b)=>flat(a,w.player)-flat(b,w.player))[0]}
function arriveAtFerry(w:World){
  const p=ferryLanding(w);if(!p)return
  w.player={...w.player,...safeCombatGround(w,p)}
  w.life!.waypoint={id:'bucklebury-ferry',label:'Bucklebury Ferry landing',position:{...p}}
  resetPlayerTracking(w)
}
const safeKey=(key:string)=>typeof key==='string'&&key.length<=140&&!['__proto__','constructor','prototype'].includes(key)
function near(w:World,p:Point,range=8){if(!finitePoint(p)||distance(w.player,p)>range)throw Error('Move closer to use that.')}
function cleanName(value:string,max=60){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(`Use a name from 1 to ${max} characters.`);return value.trim().replace(/[\u0000-\u001f<>]/g,'')}
function itemKnown(item:ItemId){if(!Object.hasOwn(ITEMS,item))throw Error('Choose an item from the inventory.')}
function quantity(count:number,max=999){if(!Number.isSafeInteger(count)||count<1||count>max)throw Error(`Choose a whole quantity from 1 to ${max}.`)}
export function itemCount(w:World,item:ItemId){return supplyItems.has(item)?w.supplies[item as keyof World['supplies']]:(w.life?.inventory[item]||0)}
export function addItem(w:World,item:ItemId,count:number){itemKnown(item);const next=itemCount(w,item)+count;if(!Number.isSafeInteger(next)||next<0||next>1e7)throw Error('There is not enough of that item, or no room for more.');if(supplyItems.has(item))w.supplies[item as keyof World['supplies']]=next;else w.life!.inventory[item]=next}
export function canPay(w:World,cost:Partial<Record<ItemId,number>>,multiple=1){return Object.entries(cost).every(([key,n])=>itemCount(w,key as ItemId)>=n!*multiple)}
export function pay(w:World,cost:Partial<Record<ItemId,number>>,multiple=1){if(w.life?.style==='creative')return;if(!canPay(w,cost,multiple))throw Error(`You need ${Object.entries(cost).map(([key,n])=>`${n!*multiple} ${ITEMS[key as ItemId].name.toLowerCase()}`).join(', ')}.`);for(const [key,n]of Object.entries(cost))addItem(w,key as ItemId,-n!*multiple)}
export function lifeEvent(w:World,text:string,kind:LifeState['events'][number]['kind']='world'){const l=w.life;if(!l)return;l.events.push({id:l.nextEvent++,time:w.time,text,kind});if(l.events.length>80)l.events.splice(0,l.events.length-80)}
export function gain(w:World,skill:Skill,xp:number){w.life!.skills[skill]=Math.min(1e7,w.life!.skills[skill]+xp)}
export function countStat(w:World,key:string,n=1){if(w.life&&safeKey(key))w.life.stats[key]=Math.min(1e7,(w.life.stats[key]||0)+n)}

/** Only opened worlds migrate; existing objects, identities and progression survive. */
export function ensureLife(w:World,style:PlayStyle='creative'):LifeState{
  if(w.life)return w.life
  ensureCombat(w)
  w.life={version:1,style,paused:false,settings:structuredClone(DEFAULT_LIFE_SETTINGS),inventory:{wood:12,stone:8,herb:3,bread:2},coins:30,skills:{gardening:0,cooking:0,craft:0,care:0,exploration:0,combat:0},residents:residentDetails(w),quests:{welcome:{state:'active',acceptedAt:w.time}},discoveries:isAtlas(w)?['hobbiton']:['legacy-0'],animals:{},regions:{},containers:{},harvested:{},resourcesRemoved:[],defeated:[],garden:[],stats:{},events:[],nextEvent:1,equipment:{weapon:'hand',shield:false},homeName:'My hillside home',comfort:0,mealUntil:0,restedUntil:0,dodgeUntil:0,dodgeCooldown:0,furnishingUndo:[],archived:false,avatar:{name:'A new neighbour',kind:'hobbit',female:false,colour:0x58733d},weather:{kind:'clear',nextChange:w.time+180}}
  const l=w.life
  for(const a of w.animals)l.animals[a.id]={owner:false,following:false,affinity:0,lastProduct:w.time,region:isAtlas(w)?'hobbiton':'legacy-0'}
  for(const r of l.residents){const a=combatActor(w,r.id);if(a)a.name=r.name}
  if(w.home){l.waypoint={id:'home',label:l.homeName,position:{...w.home}};countStat(w,'home')}
  else l.waypoint={id:'suggested-home',label:'Suggested free hillside',position:suggestedHome(w)}
  if(style==='creative')for(const key of Object.keys(ITEMS) as ItemId[])if(!supplyItems.has(key))l.inventory[key]=['sword','bow','shield','axe','lantern','saddle'].includes(key)?1:50
  lifeEvent(w,'Welcome to the Shire. Meet your neighbours at the inn, or follow the journal to make a home.','quest')
  configureLifeEncounters(w);updateQuestStates(w);return l
}
export function questProgress(w:World,q:QuestDefinition){
  const l=w.life!;if(q.delivery)return canPay(w,q.delivery)?q.count:0
  if(q.id==='welcome')return l.residents.some(r=>r.role==='innkeeper'&&r.town===(isAtlas(w)?'hobbiton':'legacy-0')&&r.conversations>0)?1:0
  if(q.goal==='home')return w.home?1:0
  if(q.goal==='edits')return w.edits.length
  if(q.goal==='comfort')return new Set(w.furniture.filter(f=>w.home&&flat(f.position,w.home)<85&&['bed','chest'].includes(f.kind)).map(f=>f.kind)).size
  if(q.goal==='discoveries')return l.discoveries.length
  if(q.goal==='defeats')return l.defeated.length
  return l.stats[q.goal]||0
}
export function questAvailable(w:World,q:QuestDefinition){return (!q.adventure||w.life!.style!=='homestead')&&(!q.previous||w.life!.quests[q.previous]?.state==='complete')}
export function updateQuestStates(w:World){const l=w.life;if(!l)return;for(const q of QUESTS){if(!questAvailable(w,q))continue;const progress=l.quests[q.id]??={state:'available'};if(progress.state==='active'||progress.state==='ready')progress.state=questProgress(w,q)>=q.count?'ready':'active'}l.comfort=new Set(w.furniture.filter(f=>w.home&&flat(f.position,w.home)<85).map(f=>f.kind)).size}
export function residentInRoom(w:World,r:ResidentLife){const room=w.life?.interior;return !!room&&(room.keeper===r.id||room.id===r.insideBuilding||room.id===r.workBuilding||room.id===r.homeBuilding)}
function residentNear(w:World,id:string):ResidentLife{
  const l=w.life!,r=l.residents.find(r=>r.id===id),a=r&&combatActor(w,r.id)
  if(!r||!a||!living(a))throw Error('Choose a neighbour who is here.')
  if(r.insideBuilding&&!residentInRoom(w,r))throw Error('Enter this neighbour’s building to visit them.');if(!residentInRoom(w,r))near(w,a.position,9)
  if(r.friendship<=-40)throw Error('This neighbour needs time and an apology gift before trading again.')
  return r
}
export function questHost(w:World,q:QuestDefinition){
  const town=isAtlas(w)?q.town:'legacy-0',l=w.life!
  return l.residents.find(r=>r.town===town&&r.role===q.role&&(residentInRoom(w,r)||!l.interior&&!r.insideBuilding&&living(combatActor(w,r.id))&&distance(combatActor(w,r.id)!.position,w.player)<12)) || l.residents.find(r=>r.town===town&&l.interior?.keeper===r.id&& !l.residents.some(n=>n.town===town&&n.role===q.role))
}
export function stationsAvailable(w:World):string[]{
  const l=w.life!,room=l.interior,stations=['any']
  if(room){if(room.kind!=='barrow')stations.push('kitchen','bench');if(room.kind==='mill')stations.push('mill');if(room.kind==='smithy')stations.push('smithy')}
  if(w.home&&flat(w.home,w.player)<85){if(w.furniture.some(f=>f.kind==='table'&&distance(f.position,w.player)<6))stations.push('bench');if(w.furniture.some(f=>f.kind==='lamp'&&distance(f.position,w.player)<6)&&w.furniture.some(f=>f.kind==='table'&&distance(f.position,w.player)<6))stations.push('kitchen')}
  return stations
}
export const FURNITURE_COST:Record<FurnitureKind,Partial<Record<ItemId,number>>>= {
  table:{wood:4},chair:{wood:2},bed:{wood:4,cloth:1},shelf:{wood:3},chest:{wood:4},door:{wood:4,iron:1},lamp:{lantern:1},fence:{wood:1},feeder:{wood:3},perch:{wood:2},burrow:{wood:3}
}
function rememberFurniture(w:World,before?:Furnishing,after?:Furnishing){const stack=w.life!.furnishingUndo;stack.push({before:before&&structuredClone(before),after:after&&structuredClone(after)});if(stack.length>30)stack.shift()}

/** Shared authorisation before ordinary terrain/farm actions. Payments commit only after the action succeeds. */
export function beforeLifeAction(w:World,a:WorldAction){
  const l=w.life;if(!l)return
  if(l.paused&&a.type!=='life'&&!['save','checkpoint'].includes(a.type))throw Error('Resume the game before acting.')
  if(l.transport&&a.type!=='life'&&!['save','checkpoint'].includes(a.type))throw Error('Wait for the ferry to dock.')
  if(['entrance','excavate','furnish','plant'].includes(a.type)){
    const point=a.type==='entrance'?a.origin:a.type==='excavate'?a.edit.center:'position' in a?a.position:undefined
    if(point)requireOwnedLand(w,point)
    if(a.type==='furnish'&&Object.hasOwn(FURNITURE_COST,a.kind)&&l.style!=='creative'&&!canPay(w,FURNITURE_COST[a.kind]))throw Error(`Making a ${FURNITURE[a.kind].label.toLowerCase()} needs ${Object.entries(FURNITURE_COST[a.kind]).map(([k,n])=>`${n} ${ITEMS[k as ItemId].name.toLowerCase()}`).join(', ')}.`)
  }
  if(['travel','return-home','travel-cinderlord','travel-encounter'].includes(a.type)){l.interior=undefined;l.riding=undefined;l.seated=undefined;l.transport=undefined}
  if(a.type==='travel'&&l.style!=='creative'){
    const dest=isAtlas(w)?ATLAS_DESTINATIONS[a.settlement]?.id:`legacy-${a.settlement}`
    if(!dest||!l.discoveries.includes(dest))throw Error('Discover this destination on the road first, or book passage with a village host.')
  }
  if(a.type==='travel-encounter'&&l.style!=='creative')throw Error('Follow the encounter waypoint in Adventure mode. Direct encounter travel is available in Creative.')
  if(a.type==='claim'&&w.home&&w.furniture.length&&flat(a.position,w.home)>85&&l.style!=='creative')throw Error('Your household is established here. Move its furnishings or switch to Creative before relocating the home marker.')
  if(a.type==='remove-furniture'){const f=w.furniture.find(f=>f.id===a.id);if(f?.kind==='chest'&&(Object.values(l.containers[f.id]||{}).some(n=>n!>0)||w.storage.barley+w.storage.carrot>0))throw Error('Empty household storage before removing a chest.');if(f)rememberFurniture(w,f)}
}
export function afterLifeAction(w:World,a:WorldAction){
  const l=w.life;if(!l)return
  if(a.type==='travel'&&isAtlas(w)&&ATLAS_DESTINATIONS[a.settlement]?.id==='bucklebury-ferry')arriveAtFerry(w)
  if(a.type==='furnish'){lifeEvent(w,'Crafted a '+FURNITURE[a.kind].label.toLowerCase()+'.');pay(w,FURNITURE_COST[a.kind]);rememberFurniture(w,undefined,w.furniture.at(-1))}
  if(a.type==='remove-furniture'){const before=l.furnishingUndo.at(-1)?.before;if(before&&l.style!=='creative')for(const [key,n]of Object.entries(FURNITURE_COST[before.kind]))addItem(w,key as ItemId,n!)}
  if(a.type==='claim'){l.waypoint={id:'home',label:l.homeName,position:{...w.home!}};countStat(w,'home')}
  if(a.type==='harvest'){countStat(w,'harvests');gain(w,'gardening',12)}
  if(a.type==='feed'||a.type==='calm'){const aLife=l.animals[a.id];if(aLife)aLife.affinity=Math.min(100,aLife.affinity+(a.type==='feed'?12:3));gain(w,'care',a.type==='feed'?3:1)}
  if(a.type==='use-furniture'&&w.furniture.find(f=>f.id===a.id)?.kind==='bed')l.restedUntil=w.time+300+30*l.comfort
  if(['travel','travel-cinderlord','travel-encounter','return-home','respawn'].includes(a.type)){l.interior=undefined;l.riding=undefined;l.seated=undefined;l.transport=undefined}
  discoverNearby(w);updateQuestStates(w)
}

export function applyLifeAction(w:World,a:LifeAction):string{
  const l=ensureLife(w),player=combatActor(w,'player')!
  if(!a||typeof a.kind!=='string')throw Error('Choose a game action.')
  if(l.paused&&!['pause','settings','slot','avatar','style','waypoint','home-name'].includes(a.kind))throw Error('Resume the game before acting.')
  let message='Done.'
  switch(a.kind){
    case 'pause': if(typeof a.value!=='boolean')throw Error('Invalid pause state.');l.paused=a.value;message=a.value?'Game paused.':'Welcome back.';break
    case 'settings': l.settings=validatedSettings({...l.settings,...a.values,bindings:{...l.settings.bindings,...a.values.bindings}});message='Settings saved.';break
    case 'style': if(!Object.hasOwn(PLAY_STYLES,a.style))throw Error('Choose a play style.');l.style=a.style;for(const c of w.combat!.actors){c.targetId=undefined;if(c.vitality.hp)c.phase='idle'}configureLifeEncounters(w);message=`${PLAY_STYLES[a.style].name} play is active.`;break
    case 'slot': if(a.name!==undefined)w.name=cleanName(a.name,72);if(a.archived!==undefined){if(typeof a.archived!=='boolean')throw Error('Invalid archive setting.');l.archived=a.archived}message='World details saved.';break
    case 'avatar': if(!['hobbit','human'].includes(a.avatarKind)||typeof a.female!=='boolean'||!Number.isInteger(a.colour)||a.colour<0||a.colour>0xffffff)throw Error('Choose a character from the available options.');l.avatar={name:cleanName(a.name,40),kind:a.avatarKind,female:a.female,colour:a.colour};player.name=l.avatar.name;message='Your character is ready.';break
    case 'home-name':l.homeName=cleanName(a.name);message=`Your home is now called ${l.homeName}.`;break
    case 'talk':{
      const r=residentNear(w,a.id);if(l.interior)l.interior.keeper=r.id;r.conversations++;if(l.stats[`talk:${r.id}`]!==dayAt(w.time)){r.friendship=Math.min(100,r.friendship+1);l.stats[`talk:${r.id}`]=dayAt(w.time)}countStat(w,'talked')
      const active=QUESTS.find(q=>q.town===r.town&&q.role===r.role&&questAvailable(w,q)&&l.quests[q.id]?.state!=='complete')
      r.dialogue=`${r.name}: ${r.conversations===1?'Welcome, '+l.avatar.name+'. ':r.friendship>25?'It is good to see an old friend. ':''}${PROFESSIONS[r.role].greeting} ${active?active.description:calendarEvent(w.time)+'. '+(r.activity==='sleeping'?'It is late; I will be at work in the morning.':'I am '+r.activity+' today.')}`
      if(active&&!l.quests[active.id])l.quests[active.id]={state:'available'}
      message=r.dialogue;break
    }
    case 'gift':{
      const r=l.residents.find(r=>r.id===a.id);if(!r||!living(combatActor(w,r.id)))throw Error('Choose a healthy neighbour.');if(r.insideBuilding&&!residentInRoom(w,r))throw Error('Enter this neighbour’s building to give them a gift.');if(!residentInRoom(w,r))near(w,combatActor(w,r.id)!.position,9)
      const item=a.item||'bread';itemKnown(item);if(r.lastGiftDay===dayAt(w.time))throw Error('You have already shared a gift with this neighbour today.')
      if(!itemCount(w,item))throw Error('You do not have that gift.');addItem(w,item,-1);r.friendship=Math.min(100,r.friendship+Math.min(15,4+ITEMS[item].value));r.lastGiftDay=dayAt(w.time);message=`${r.name} thanks you for the ${ITEMS[item].name.toLowerCase()}.`;gain(w,'care',5);break
    }
    case 'quest-accept':case 'quest-complete':{
      const q=QUESTS.find(q=>q.id===a.id);if(!q||!questAvailable(w,q))throw Error('This request is not available yet.')
      const p=l.quests[q.id]??={state:'available'};if(p.state==='complete')throw Error('You have already completed this request.')
      if(a.kind==='quest-accept'){if(p.state!=='available')throw Error('This request is already in your journal.');p.state='active';p.acceptedAt=w.time;message=`Added to your journal: ${q.name}.`;if(q.id==='home')l.waypoint={id:'suggested-home',label:'Suggested free hillside',position:suggestedHome(w)}}
      else{if(p.state==='available'||questProgress(w,q)<q.count)throw Error('Finish the request before collecting its reward.');const host=questHost(w,q);if(!host)throw Error('Return to the neighbour named in this request to finish it.');if(q.delivery){if(!canPay(w,q.delivery))throw Error('Bring the requested items.');for(const [key,n]of Object.entries(q.delivery))addItem(w,key as ItemId,-n!)}p.state='complete';p.completedAt=w.time;l.coins+=q.reward.coins;for(const [key,n]of Object.entries(q.reward.items||{}))addItem(w,key as ItemId,n!);gain(w,q.reward.skill,q.reward.xp);host.friendship=Math.min(100,host.friendship+10);message=`Completed: ${q.name}. Received ${q.reward.coins} coins and ${q.reward.xp} ${q.reward.skill} experience.`;lifeEvent(w,message,'quest')}
      break
    }
    case 'gather':{const node=resourceNodes(w).find(n=>n.id===a.id);if(!node)throw Error('This gathering spot is resting or out of reach.');near(w,node.position,6);l.harvested[node.id]=w.time;addItem(w,node.kind,node.amount);gain(w,node.kind==='herb'||node.kind==='apple'?'gardening':'craft',3);message=`Collected ${node.amount} ${ITEMS[node.kind].name.toLowerCase()}.`;break}
    case 'craft':{
      const r=RECIPES.find(r=>r.id===a.id),count=a.count??1;quantity(count,20);if(!r)throw Error('Choose a recipe.')
      if(l.style!=='creative'&&skillLevel(l.skills[r.skill])<r.level)throw Error(`Practise ${r.skill} to reach level ${r.level}.`)
      if(!stationsAvailable(w).includes(r.station))throw Error(`Use a ${r.station} to make this. Find one in a village building or furnish your home.`)
      pay(w,r.input,count);addItem(w,r.output,r.count*count);gain(w,r.skill,12*count);countStat(w,`crafted:${r.id}`,count);message=`Made ${r.count*count} ${ITEMS[r.output].name.toLowerCase()}.`;break
    }
    case 'eat':{itemKnown(a.item);const food=ITEMS[a.item];if(!food.food)throw Error('That item is not a prepared food or edible ingredient.');if(!itemCount(w,a.item))throw Error('You have none of that food.');addItem(w,a.item,-1);heal(w,player,food.food,'meal');player.vitality.stamina=Math.min(100,player.vitality.stamina+food.food);if(a.item==='tea')player.vitality.effects=[];l.mealUntil=w.time+food.food*8;message=`Enjoyed ${food.name.toLowerCase()}. Your well-fed bonus lasts ${food.food*8} seconds.`;break}
    case 'trade':{
      const r=residentNear(w,a.npc);itemKnown(a.item);quantity(a.count,99);if(typeof a.buying!=='boolean')throw Error('Choose buy or sell.')
      if(a.buying&&!PROFESSIONS[r.role].stock.includes(a.item))throw Error('This neighbour does not stock that item.')
      const unit=a.buying?Math.max(1,Math.ceil(ITEMS[a.item].value*(r.friendship>=30?.9:1))):Math.max(1,Math.floor(ITEMS[a.item].value*.55)),price=unit*a.count
      if(a.buying){if(l.coins<price)throw Error('You need more coins. Sell produce or help a neighbour.');l.coins-=price;addItem(w,a.item,a.count)}else{if(itemCount(w,a.item)<a.count)throw Error('You do not have enough to sell.');addItem(w,a.item,-a.count);l.coins+=price}
      message=`${a.buying?'Bought':'Sold'} ${a.count} ${ITEMS[a.item].name.toLowerCase()} for ${price} coins.`;lifeEvent(w,message,'trade');break
    }
    case 'enter':{
      if(l.interior)throw Error('Leave this room first.');if(l.riding||l.transport)throw Error('Dismount before going inside.')
      const place=placeById(w,a.id)||storyPlaces(w).find(p=>p.id===a.id);if(!place)throw Error('Choose a building entrance.');const door={...place.door,y:height(place.door.x,place.door.z,w)};near(w,door,8)
      const keeper=l.residents.find(r=>r.workBuilding===place.id)||l.residents.find(r=>r.homeBuilding===place.id)||l.residents.find(r=>r.town===place.town)
      l.interior={id:place.id,label:place.label,kind:place.kind,origin:{x:place.position.x,y:Math.max(-100,place.position.y-28),z:place.position.z},exit:{...w.player},width:place.width,depth:place.depth,keeper:keeper?.id}
      w.player={x:place.position.x,y:l.interior.origin.y,z:place.position.z+place.depth/2-2,yaw:0,pitch:0};resetPlayerTracking(w)
      message=place.kind==='barrow'?'Three stones remember the way: first the growing leaf, then the running river, and last the guiding star.':`Entered ${place.label}. Use the hearth, workbench and household services.`;break
    }
    case 'exit':{if(!l.interior)throw Error('You are already outdoors.');w.player={...l.interior.exit};l.interior=undefined;l.seated=undefined;resetPlayerTracking(w);message='Stepped outside.';break}
    case 'service':{
      const r=a.npc?residentNear(w,a.npc):l.interior?.keeper?residentNear(w,l.interior.keeper):undefined
      if(!r||!l.interior)throw Error('Enter a village building and speak with its host.')
      if(a.id==='news'){message=`${calendarEvent(w.time)} · ${seasonAt(w.time)}, day ${dayAt(w.time)}. ${QUESTS.filter(q=>q.town===r.town&&questAvailable(w,q)&&l.quests[q.id]?.state!=='complete').map(q=>q.name).join(' · ')||'The neighbours have no outstanding requests.'}`;break}
      const cost=a.id==='rest'?5:a.id==='meal'?8:15;if(l.coins<cost&&l.style!=='creative')throw Error(`This service costs ${cost} coins.`)
      if(a.id==='rest'&&l.stats.lastInnRest!==undefined&&w.time-l.stats.lastInnRest<30)throw Error('You have just rested. Enjoy the village before resting again.')
      if(a.id==='rest'){heal(w,player,player.vitality.maxHp,'inn');player.vitality.effects=[];player.vitality.stamina=100;l.restedUntil=w.time+600;l.stats.lastInnRest=w.time;w.combat!.healingDraughts=3;message='Rested at the inn. Health, stamina and healing draughts are restored.'}
      else if(a.id==='meal'){heal(w,player,40,'inn meal');l.mealUntil=w.time+400;message='Enjoyed a hot meal. You feel ready for the road.'}
      else if(a.id==='lesson'){const skill:Skill=r.role==='gardener'?'gardening':r.role==='innkeeper'?'cooking':r.role==='farmer'?'care':r.role==='ranger'?'exploration':'craft';const key=`lesson:${r.id}`;if(l.stats[key]===dayAt(w.time))throw Error('Come back tomorrow for another lesson.');l.stats[key]=dayAt(w.time);gain(w,skill,25);message=`Learned from ${r.name}: 25 ${skill} experience.`}
      else throw Error('Choose a service.')
      if(l.style!=='creative')l.coins-=cost;break
    }
    case 'equip':{if(a.weapon!==undefined){if(!['hand','sword','bow'].includes(a.weapon))throw Error('Choose a weapon.');if(a.weapon!=='hand'&&!itemCount(w,a.weapon))throw Error('Craft or buy that equipment first.');l.equipment.weapon=a.weapon}if(a.shield!==undefined){if(typeof a.shield!=='boolean'||a.shield&&!itemCount(w,'shield'))throw Error('Craft or buy a shield first.');l.equipment.shield=a.shield}message='Equipment updated.';break}
    case 'dodge':{if(l.dodgeCooldown>w.time||player.vitality.stamina<22)throw Error('Recover your balance and stamina first.');if(l.riding||l.interior?.kind==='barrow'&&l.seated)throw Error('Stand on your feet first.');l.dodgeUntil=w.time+.5;l.dodgeCooldown=w.time+1.8;player.vitality.invulnerableUntil=w.time+.5;player.vitality.stamina-=22;message='Dodged. Brief protection, followed by recovery.';break}
    case 'animal-adopt':case 'animal-follow':case 'animal-home':case 'animal-product':case 'ride':case 'animal-name':{
      const b=w.animals.find(b=>b.id===a.id);if(!b||!living(combatActor(w,b.id)))throw Error('Choose a healthy animal.');near(w,b.position,7)
      const info=l.animals[b.id]??={owner:false,following:false,affinity:0,lastProduct:w.time,region:'household'}
      if(a.kind==='animal-adopt'){if(!['pasture'].includes(SPECIES[b.species].habitat))throw Error('Watch wild river and bird life in their natural habitat.');if(info.owner)throw Error('This animal already belongs to your household.');if(info.affinity<12&&l.style!=='creative')throw Error('Feed the animal and let it get to know you first.');pay(w,{feed:3});info.owner=true;info.affinity=Math.max(20,info.affinity);message=`${b.name} has joined your household.`;gain(w,'care',15)}
      else{if(!info.owner)throw Error('Adopt this animal first.');if(a.kind==='animal-name'){b.name=cleanName(a.name,60);combatActor(w,b.id)!.name=b.name;message=`Named ${b.name}.`}
        else if(a.kind==='animal-follow'){info.following=!info.following;b.calmUntil=w.time+600;message=info.following?`${b.name} will follow you. Walk steadily and keep a clear route.`:`${b.name} is staying near its home.`}
        else if(a.kind==='animal-home'){if(!w.home||flat(w.player,w.home)>85)throw Error('Lead the animal to your home land first.');if(!clear({...b.position,y:b.position.y+.1},w))throw Error('Choose a clear paddock.');b.home={...b.position};info.following=false;combatActor(w,b.id)!.home={...b.home};countStat(w,'animalsHome');message=`${b.name} is settled at ${l.homeName}.`;lifeEvent(w,message,'care')}
        else if(a.kind==='animal-product'){const product=b.species==='chicken'&&b.sex==='female'?'egg':b.species==='cattle'&&b.sex==='female'?'milk':['sheep','llama'].includes(b.species)?'wool':undefined;if(!product)throw Error('This animal does not produce eggs, milk or wool.');if(b.age<SPECIES[b.species].maturity||b.fedUntil<=w.time)throw Error('A mature, well-fed animal is needed.');if(w.time-info.lastProduct<120)throw Error(`Ready in ${Math.ceil(120-w.time+info.lastProduct)} seconds of play.`);info.lastProduct=w.time;addItem(w,product,2);gain(w,'care',10);message=`Collected two ${ITEMS[product].name.toLowerCase()}.`}
        else if(a.kind==='ride'){if(b.species!=='horse'||b.age<SPECIES.horse.maturity)throw Error('Choose an adult pony.');if(!itemCount(w,'saddle'))throw Error('Craft or buy a saddle first.');if(l.interior)throw Error('Ride outdoors.');l.riding=b.id;info.following=false;b.calmUntil=w.time+600;message=`Mounted ${b.name}. Walk, trot or gallop; dismount before entering a building.`}}
      break
    }
    case 'dismount':{if(!l.riding)throw Error('You are already on foot.');const b=w.animals.find(b=>b.id===l.riding)!;let p:Point|undefined;for(const dx of [1.7,-1.7,2.5,-2.5]){const candidate={x:w.player.x+dx,y:surfaceAt(w.player.x+dx,w.player.z,w,w.player.y+1)+.08,z:w.player.z};if(clear(candidate,w)){p=candidate;break}}if(!p)throw Error('Move the pony to open ground before dismounting.');b.position={...w.player};w.player={...w.player,...p};l.riding=undefined;resetPlayerTracking(w);message='Dismounted safely.';break}
    case 'waypoint':{
      if(!a.id&&!a.position){l.waypoint=undefined;message='Waypoint cleared.';break}
      if(a.id==='bucklebury-ferry'&&isAtlas(w)){const p=ferryLanding(w);if(!p)throw Error('The ferry landing is unavailable.');l.waypoint={id:a.id,label:'Bucklebury Ferry landing',position:{...p}};message='Following directions to the nearest ferry landing.';break}
      if(a.id==='hay-gate'&&isAtlas(w)){l.waypoint={id:a.id,label:'Hay Gate crossing',position:{x:83900,y:height(83900,12900,w),z:12900}};message='Following directions to the gate in the High Hay.';break}
      if(a.position){if(!finitePoint(a.position)||!inBounds(a.position.x,a.position.z,w))throw Error('Choose a point inside the atlas.');l.waypoint={id:'custom',label:a.label?cleanName(a.label):'Map marker',position:{...a.position}}}
      else{const p=(isAtlas(w)?ATLAS_DESTINATIONS:[]).find(p=>p.id===a.id),building=placeById(w,a.id!)||storyPlaces(w).find(p=>p.id===a.id);const home=a.id==='home'?w.home:a.id==='suggested-home'?suggestedHome(w):undefined;if(p)l.waypoint={id:p.id,label:p.name,position:{x:p.x,y:height(p.x,p.z,w),z:p.z}};else if(building)l.waypoint={id:building.id,label:building.label,position:{...building.door}};else if(home)l.waypoint={id:a.id!,label:a.id==='home'?l.homeName:'Suggested free hillside',position:{...home}};else throw Error('Choose a known place.')}
      message=`Following directions to ${l.waypoint.label}.`;break
    }
    case 'use-place':{
      // Local hosts arrange long journeys on this regional atlas; discovered destinations remain free shortcuts.
      if(!l.interior?.keeper)throw Error('Book a journey with a village host inside their building.');residentNear(w,l.interior.keeper)
      const target=ATLAS_DESTINATIONS.find(p=>p.id===a.id);if(!isAtlas(w)||!target)throw Error('Choose an atlas destination.')
      const cost=l.discoveries.includes(target.id)?0:5;if(l.coins<cost&&l.style!=='creative')throw Error('Passage costs five coins.');if(l.style!=='creative')l.coins-=cost
      l.interior=undefined;l.seated=undefined;const p=arrival(target,w);w.player={...p,...safeCombatGround(w,p)};if(target.id==='bucklebury-ferry')arriveAtFerry(w);resetPlayerTracking(w);message=`The host arranged passage to ${target.name}.`;break
    }
    case 'ferry':{
      if(l.transport||l.riding||l.interior)throw Error('Come to the ferry landing on foot.');const ends=ferryCrossing(w);if(!ends)throw Error('The ferry serves the atlas Brandywine crossing.')
      const start=ends.reduce((a,b)=>flat(a,w.player)<flat(b,w.player)?a:b),end=ends.find(p=>p!==start)!;near(w,start,12);l.transport={kind:'ferry',start:{...start},end:{...end},started:w.time,duration:18};w.player={...w.player,...start,yaw:Math.atan2(start.x-end.x,start.z-end.z),pitch:0};message='The rope ferry is crossing. Enjoy the river until it docks.';break
    }
    case 'fish':{
      if(l.interior||l.riding)throw Error('Stand on the riverbank to fish.');const r=riverAt(w.player.x,w.player.z),pool=isAtlas(w)&&Math.hypot((w.player.x-6500)/650,(w.player.z-2600)/240)<1.1
      if(isAtlas(w)?!pool&&(!r||r.distance>r.width/2+8):Math.hypot(w.player.x-25,w.player.z-112)>24)throw Error('Find an accessible riverbank or pond edge.')
      if(w.time-(l.stats.lastCatch??-60)<12)throw Error('Give the water a little time before casting again.');l.stats.lastCatch=w.time;addItem(w,'fish',1);gain(w,'care',5);message='A patient cast brings a river fish to the basket.';break
    }
    case 'festival':{
      const s=settlements(w).find(s=>flat({x:s.x,y:0,z:s.z},w.player)<170),day=dayAt(w.time)
      if(!l.interior&&!s)throw Error('Join a gathering at an inn or on a village green.');if(l.stats.lastFestival===day)throw Error('You have already joined today’s gathering.')
      const food=(['pie','stew','bread','cheese'] as ItemId[]).find(k=>itemCount(w,k)>0);if(!food)throw Error('Bring a cooked meal or bread to share.');addItem(w,food,-1);l.stats.lastFestival=day;countStat(w,'festivals');gain(w,'care',day%7===0?30:15);l.coins+=day%7===0?20:5;for(const r of l.residents)if(r.town===(l.interior&&placeById(w,l.interior.id)?.town)||(s&&r.town===ATLAS_TOWNS.find(t=>t.name===s.name)?.id))r.friendship=Math.min(100,r.friendship+5);message=`Shared ${ITEMS[food].name.toLowerCase()} at the ${day%7===0?'seasonal festival':'neighbours’ table'}.`;lifeEvent(w,message,'world');break
    }
    case 'blueprint':{
      if(!w.home)throw Error('Mark a free hill as your home first.');near(w,w.home,20);requireOwnedLand(w,w.player)
      if(a.id==='starter-smial'){
        if(w.edits.length>1480)throw Error('There is no room for another complete entrance.');const plan=entrancePlan(w,{type:'entrance',origin:w.player,yaw:w.player.yaw,width:3,height:2.5});for(const e of plan.edits)requireOwnedLand(w,e.center);const batch=id();w.edits.push(...plan.edits.map(e=>({...e,id:id(),batch})));w.redo=[];message='A complete covered entrance and chamber are ready. Follow the passage into your hill.'
      }else if(a.id==='garden'){
        if(height(w.player.x,w.player.z,w)-w.player.y>.7)throw Error('Step outside before planting the garden.');if(w.crops.length>488)throw Error('The garden is full.');const points=Array.from({length:12},(_,i)=>({x:w.player.x+Math.cos(w.player.yaw)*(i%4-1.5)*1.5-Math.sin(w.player.yaw)*(4+Math.floor(i/4)*1.5),y:0,z:w.player.z-Math.sin(w.player.yaw)*(i%4-1.5)*1.5-Math.cos(w.player.yaw)*(4+Math.floor(i/4)*1.5)})).map(p=>({...p,y:height(p.x,p.z,w)}));for(const p of points){requireOwnedLand(w,p);if(density(p.x,p.y-.15,p.z,w,w.edits)<.03||!clear({...p,y:p.y+.1},w)||p.y<waterAt(p.x,p.z,w)||w.crops.some(c=>!c.harvested&&distance(c.position,p)<1))throw Error('Stand beside a clear patch of soil for the garden blueprint.')}pay(w,{carrotSeed:6,barleySeed:6});for(const [i,p]of points.entries())w.crops.push({id:id(),kind:i%2?'barley':'carrot',position:p,planted:w.time,watered:true,harvested:false});message='Planted and watered a twelve-plot kitchen garden.'
      }else if(a.id==='paddock'){
        if(height(w.player.x,w.player.z,w)-w.player.y>.7)throw Error('Step outside before building the paddock.');if(w.furniture.length>976)throw Error('There is no room for the paddock.');const frames:Furnishing[]=[],cx=w.player.x,cz=w.player.z-10;for(let i=-3;i<=3;i++){for(const side of [-1,1]){if(side===1&&i===0)continue;frames.push({id:id(),kind:'fence',position:{x:cx+i*2,y:height(cx+i*2,cz+side*7,w),z:cz+side*7},yaw:0,open:false})}if(Math.abs(i)<3)for(const side of [-1,1])frames.push({id:id(),kind:'fence',position:{x:cx+side*7,y:height(cx+side*7,cz+i*2,w),z:cz+i*2},yaw:Math.PI/2,open:false})}
        for(const f of frames){const dx=f.position.x-w.player.x,dz=f.position.z-w.player.z;f.position.x=w.player.x+dx*Math.cos(w.player.yaw)+dz*Math.sin(w.player.yaw);f.position.z=w.player.z-dx*Math.sin(w.player.yaw)+dz*Math.cos(w.player.yaw);f.position.y=height(f.position.x,f.position.z,w);f.yaw+=w.player.yaw;requireOwnedLand(w,f.position);if(density(f.position.x,f.position.y-.15,f.position.z,w,w.edits)<.03||!clear({...f.position,y:f.position.y+.1},w))throw Error('The paddock needs a clear area ahead of you.')}
        pay(w,{wood:frames.length});w.furniture.push(...frames);message='A paddock with an open entrance is ready. Lead your animals inside and settle them there.'
      }else throw Error('Choose a blueprint.');break
    }
    case 'transfer':{
      itemKnown(a.item);quantity(a.count);const chest=w.furniture.find(f=>f.id===a.chest&&f.kind==='chest');if(!chest)throw Error('Choose a household chest.');near(w,chest.position,4);const items=l.containers[chest.id]??={}
      if(a.withdraw){if((items[a.item]||0)<a.count)throw Error('The chest does not hold that much.');items[a.item]!-=a.count;addItem(w,a.item,a.count)}else{if(itemCount(w,a.item)<a.count)throw Error('You do not have that much.');addItem(w,a.item,-a.count);items[a.item]=(items[a.item]||0)+a.count}message='Household chest updated.';break
    }
    case 'move-furniture':case 'copy-furniture':{
      const f=w.furniture.find(f=>f.id===a.id);if(!f)throw Error('Choose a furnishing.');near(w,f.position);near(w,a.position);requireOwnedLand(w,a.position);if(!Number.isFinite(a.yaw))throw Error('Choose a valid rotation.');if(f.kind==='door')throw Error('Fit doors with the doorway tool so the opening matches the earth.');if(w.furniture.length>=1000&&a.kind==='copy-furniture')throw Error('This world’s furnishing budget is full.')
      const before=structuredClone(f),next={...f,id:a.kind==='copy-furniture'?id():f.id,position:{...a.position},yaw:a.yaw},size=FURNITURE[f.kind].size
      if(density(next.position.x,next.position.y-.18,next.position.z,w,w.edits)<-.25)throw Error('Place furniture on supported ground.')
      for(const dy of [.1,size.y])for(const dx of [-size.x/2,size.x/2])for(const dz of [-size.z/2,size.z/2])if(density(a.position.x+dx*Math.cos(a.yaw)+dz*Math.sin(a.yaw),a.position.y+dy,a.position.z-dx*Math.sin(a.yaw)+dz*Math.cos(a.yaw),w,w.edits)>.12)throw Error('That furnishing overlaps the earth.')
      if(w.furniture.some(other=>other.id!==f.id&&distance(other.position,next.position)<.6))throw Error('That place is occupied.')
      const original=w.furniture,inside=height(w.player.x,w.player.z,w)>w.player.y+2,exit=inside&&hasOutdoorExit(w.player,w);w.furniture=a.kind==='copy-furniture'?[...original,next]:original.map(o=>o.id===f.id?next:o)
      if(!clear(w.player,w)||exit&&!hasOutdoorExit(w.player,w)){w.furniture=original;throw Error('Keep your movement and exit route clear.')}
      if(a.kind==='copy-furniture')pay(w,FURNITURE_COST[f.kind]);rememberFurniture(w,a.kind==='copy-furniture'?undefined:before,next);message=a.kind==='copy-furniture'?'Made and placed another furnishing.':'Furnishing moved.';break
    }
    case 'furniture-undo':{
      const entry=l.furnishingUndo.at(-1);if(!entry)throw Error('There is no furnishing edit to undo.');near(w,(entry.after||entry.before)!.position);const current=w.furniture
      if(entry.after?.kind==='chest'&&!entry.before&&(Object.values(l.containers[entry.after.id]||{}).some(n=>n!>0)||w.storage.barley+w.storage.carrot>0))throw Error('Empty household storage before undoing the chest placement.')
      if(entry.before&&!entry.after)pay(w,FURNITURE_COST[entry.before.kind])
      w.furniture=w.furniture.filter(f=>f.id!==(entry.after||entry.before)!.id);if(entry.before)w.furniture.push(structuredClone(entry.before));if(!clear(w.player,w)){w.furniture=current;throw Error('Step away before undoing this furnishing edit.')}if(entry.after&&!entry.before&&l.style!=='creative')for(const [key,n]of Object.entries(FURNITURE_COST[entry.after.kind]))addItem(w,key as ItemId,n!);l.furnishingUndo.pop();message='Furnishing edit undone.';break
    }
    case 'sit':{const f=w.furniture.find(f=>f.id===a.id&&f.kind==='chair'),p=f?.position||roomServicePosition(w,a.id);if(!p)throw Error('Choose a chair.');near(w,p,3);l.seated=a.id;message='You sit for a quiet moment. Stand to move again.';break}
    case 'stand':l.seated=undefined;message='Stood up.';break
    case 'plant-special':{if(!['apple','herb','flax'].includes(a.crop))throw Error('Choose a garden plant.');near(w,a.position);requireOwnedLand(w,a.position);if(l.garden.length>=200)throw Error('This garden is full.');if(density(a.position.x,a.position.y-.15,a.position.z,w,w.edits)<.03||Math.abs(a.position.y-height(a.position.x,a.position.z,w))>.4||a.position.y<waterAt(a.position.x,a.position.z,w)||!clear({...a.position,y:a.position.y+.1},w))throw Error('Choose clear outdoor soil.');if(l.garden.some(p=>distance(p.position,a.position)<(a.crop==='apple'?3:1)))throw Error('Leave room for the plant to grow.');pay(w,{[a.crop]:1});l.garden.push({id:id(),crop:a.crop,position:{...a.position},planted:w.time,harvested:w.time});message=`Planted ${ITEMS[a.crop].name.toLowerCase()}. It will produce a harvest in ${a.crop==='apple'?300:120} seconds.`;break}
    case 'harvest-special':{const p=l.garden.find(p=>p.id===a.id);if(!p)throw Error('Choose a garden plant.');near(w,p.position,6);if(w.time-p.harvested<(p.crop==='apple'?300:120))throw Error('The plant needs more time.');p.harvested=w.time;addItem(w,p.crop,3);gain(w,'gardening',12);countStat(w,'harvests');message=`Harvested three ${ITEMS[p.crop].name.toLowerCase()}.`;break}
    case 'barrow-rune':{
      if(l.interior?.kind!=='barrow')throw Error('Find the chamber beneath the barrow.');const p=roomServicePosition(w,a.rune);if(!p)throw Error('Choose a rune stone.');near(w,p,4)
      const sequence=['leaf','river','star'],index=l.stats.barrowSequence||0;if(a.rune===sequence[index]){l.stats.barrowSequence=index+1;message='The stone glows softly.'}else{l.stats.barrowSequence=0;message='The light fades. Remember the order: growing leaf, running river, guiding star.'}
      if(l.stats.barrowSequence===3){l.stats.barrowSequence=0;if(!l.stats.barrowToken){l.stats.barrowToken=1;addItem(w,'iron',4);gain(w,'exploration',30);message='The chamber opens its secret: a lost wayfarer’s token and four pieces of old iron. Return the token to the Bree ranger.';lifeEvent(w,message,'discovery')}else message='The three stones glow in remembrance of the wayfarer.'}break
    }
    case 'gate':{if(!isAtlas(w)||a.id!=='hay-gate')throw Error('Choose a gate.');near(w,{x:83900,y:height(83900,12900,w),z:12900},9);l.gates??={};const old=!!l.gates[a.id];l.gates[a.id]=!old;if(!clear(w.player,w)){l.gates[a.id]=old;throw Error('Step away from the gate before moving it.')}message=old?'The Hay Gate is closed.':'The Hay Gate swings open toward the Old Forest.';lifeEvent(w,message);break}
    case 'landmark':{
      const p=ATLAS_PLACES.find(p=>p.id===a.id);if(!isAtlas(w)||!p||!['old-man-willow','three-farthing-stone','scary-quarry'].includes(p.id))throw Error('Choose an interactive landmark.');near(w,{x:p.x,y:height(p.x,p.z,w),z:p.z},18)
      const key=`landmark:${p.id}`
      if(p.id==='old-man-willow'){message='Under the old willow, the leaves seem to whisper of a path east, a friendly house beside the water, and three stones that remember leaf, river and star.';if(!l.stats[key]){gain(w,'exploration',25);addItem(w,'herb',3)}}
      if(p.id==='three-farthing-stone'){message='The Three-Farthing Stone marks a meeting of Shire districts. Your journal now remembers the neighbouring roads.';if(!l.stats[key]){gain(w,'exploration',25);l.coins+=10}}
      if(p.id==='scary-quarry'){if(l.stats[key]!==undefined&&w.time-l.stats[key]<300)throw Error('The worked face needs time before more material is ready.');addItem(w,'stone',8);addItem(w,'iron',3);gain(w,'craft',15);message='Collected eight stone and three iron from the marked quarry stockpile.'}
      l.stats[key]=w.time;lifeEvent(w,message,'discovery');break
    }
    default:throw Error('That activity is not available.')
  }
  if(['gather','craft','harvest-special','blueprint','trade','gift'].includes(a.kind))lifeEvent(w,message,a.kind==='trade'?'trade':'world');discoverNearby(w);updateQuestStates(w);return message
}

function discoverNearby(w:World){
  const l=w.life;if(!l||l.interior)return
  for(const [i,s]of settlements(w).entries())if(Math.hypot(s.x-w.player.x,s.z-w.player.z)<240){const key=isAtlas(w)?ATLAS_DESTINATIONS[i].id:`legacy-${i}`;if(!l.discoveries.includes(key)){l.discoveries.push(key);gain(w,'exploration',20);lifeEvent(w,`Discovered ${s.name}. You can return here from the map.`,'discovery')}}
}
export function advanceLife(w:World,dt:number){
  const l=w.life;if(!l||l.paused)return
  if(l.transport){const t=l.transport,f=Math.min(1,(w.time-t.started)/t.duration),x=t.start.x+(t.end.x-t.start.x)*f,z=t.start.z+(t.end.z-t.start.z)*f,water=waterAt(x,z,w);w.player={...w.player,x,z,y:Number.isFinite(water)?Math.max(height(x,z,w),water)+.15:height(x,z,w)+.08};resetPlayerTracking(w);if(f>=1){l.transport=undefined;if(l.waypoint?.id==='bucklebury-ferry')l.waypoint.position={...t.end};countStat(w,'ferryTrips');lifeEvent(w,'The ferry has docked. Welcome to the other bank.','discovery')}}
  if(l.weather.nextChange<=w.time){const n=sceneryHash(Math.floor(w.time/180),dayAt(w.time),w.seed),season=seasonAt(w.time);l.weather={kind:n<.4?'clear':n<.65?'cloudy':n<.85?(season==='Winter'?'snow':'rain'):'mist',nextChange:w.time+180};lifeEvent(w,`The weather turns ${l.weather.kind}.`)}
  if(l.weather.kind==='rain')for(const c of w.crops)if(!c.watered&&!c.harvested){c.watered=true;c.planted=w.time}
  const hour=hourAt(w.time),social=hour>=17&&hour<21,market=dayAt(w.time)%3===0&&hour>=9&&hour<15,festival=dayAt(w.time)%7===0&&hour>=15&&hour<22
  for(const r of l.residents){
    const a=combatActor(w,r.id);if(!a||!living(a))continue
    const home=placeById(w,r.homeBuilding),work=placeById(w,r.workBuilding),inn=places(w).find(p=>p.town===r.town&&p.kind==='inn'),night=hour<6||hour>=22
    r.activity=night?'sleeping':festival?'at the festival':market?'at the market':social?'at the inn':'working'
    const dest=night?home:festival||market||social?(inn||work):work
    if(dest)r.destination={...dest.door,y:height(dest.door.x,dest.door.z,w)+.08}
    const outsideWork=!night&&!festival&&!market&&!social&&['gardener','farmer','ranger'].includes(r.role)
    if(outsideWork&&dest){
      // Gardeners and farmers tend outdoor plots; wayfarers make a daily round of the lanes.
      const town=ATLAS_TOWNS.find(t=>t.id===r.town),slot=r.role==='ranger'?Math.floor(w.time/60)%4:0
      const x=r.role==='ranger'?(town?.x||dest.position.x)+[-55,55,65,-45][slot]:dest.door.x+(r.role==='farmer'?24:-12)
      const z=r.role==='ranger'?(town?.z||dest.position.z)+[-35,-35,45,45][slot]:dest.door.z+12
      const proposed={x,y:height(x,z,w)+.08,z}
      if(clear(proposed,w)&&proposed.y>waterAt(x,z,w)+.15)r.destination=proposed
    }
    if(flat(a.position,r.destination)>1.8){r.activity='walking';r.insideBuilding=undefined}else r.insideBuilding=(night||!outsideWork&&!festival&&!market&&!social)&&dest?dest.id:undefined
  }
  for(const b of w.animals){const info=l.animals[b.id]??={owner:false,following:false,affinity:0,lastProduct:w.time,region:'household'};if(l.riding===b.id){b.position={x:w.player.x,y:surfaceAt(w.player.x,w.player.z,w,w.player.y+1),z:w.player.z};b.calmUntil=w.time+10;const a=combatActor(w,b.id);if(a)a.position={...b.position}}}
  const p=combatActor(w,'player');if(p&&living(p)&&w.time-p.vitality.lastDamage>12){if(l.mealUntil>w.time)p.vitality.hp=Math.min(p.vitality.maxHp,p.vitality.hp+dt*.3);if(l.restedUntil>w.time)p.vitality.stamina=Math.min(100,p.vitality.stamina+dt*5)}
  for(const a of w.combat!.actors)if(a.kind==='hostile'&&!living(a)&&!l.defeated.includes(a.id)&&w.combat!.events.some(e=>e.type==='death'&&e.target===a.id&&e.source==='player')){l.defeated.push(a.id);l.coins+=12;addItem(w,'iron',2);gain(w,'combat',30);lifeEvent(w,`${a.name} defeated. Recovered 12 coins and two iron.`,'combat')}
  populateRegion(w);ensureCombat(w);discoverNearby(w);updateQuestStates(w)
}

export function validatedSettings(value:LifeSettings):LifeSettings{
  if(value.clickToMove!==undefined&&typeof value.clickToMove!=='boolean')throw Error('Invalid click-to-move setting.')
  const ranges:Record<string,[number,number]>={sensitivity:[.15,3],fov:[45,100],uiScale:[.8,1.5],masterVolume:[0,1],musicVolume:[0,1],effectsVolume:[0,1]}
  for(const [k,[min,max]]of Object.entries(ranges)){const n=value[k as keyof LifeSettings];if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw Error(`Invalid ${k} setting.`)}
  for(const key of ['invertY','contrast','reducedMotion','subtitles','autoPause'] as const)if(typeof value[key]!=='boolean')throw Error('Invalid accessibility setting.')
  if(!['low','medium','high'].includes(value.quality)||!['first','third'].includes(value.camera))throw Error('Choose a supported camera and quality setting.')
  const bindings=value.bindings,keys=Object.keys(DEFAULT_LIFE_SETTINGS.bindings);if(!bindings||keys.some(k=>typeof bindings[k as keyof typeof bindings]!=='string'||! /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right))$/.test(bindings[k as keyof typeof bindings]))||new Set(keys.map(k=>bindings[k as keyof typeof bindings])).size!==keys.length)throw Error('Each control needs a unique supported key.')
  return structuredClone(value)
}
export function validateLife(w:World){
  const l=w.life;if(l===undefined)return
  const number=(n:unknown,min=0,max=1e10)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max
  const text=(v:unknown,max=140)=>typeof v==='string'&&v.length<=max
  const point=(p:unknown)=>finitePoint(p)&&inBounds(p.x,p.z,w)&&number(p.y,-125,600)
  const object=(o:unknown)=>!!o&&typeof o==='object'&&!Array.isArray(o)
  const bag=(o:unknown)=>object(o)&&Object.entries(o!).every(([k,n])=>Object.hasOwn(ITEMS,k)&&Number.isSafeInteger(n)&&number(n,0,1e7))
  const record=(o:unknown)=>object(o)&&Object.entries(o!).every(([k,n])=>safeKey(k)&&number(n,0,1e10))
  if(!l||l.version!==1||!Object.hasOwn(PLAY_STYLES,l.style)||typeof l.paused!=='boolean'||!bag(l.inventory)||!Number.isSafeInteger(l.coins)||!number(l.coins,0,1e9)||!l.skills||['gardening','cooking','craft','care','exploration','combat'].some(k=>!number(l.skills[k as Skill],0,1e7))||!text(l.homeName,60)||!number(l.comfort,0,1000)||![l.mealUntil,l.restedUntil,l.dodgeUntil,l.dodgeCooldown].every(n=>number(n))||typeof l.archived!=='boolean')throw Error('Invalid village-life state in save.')
  validatedSettings(l.settings)
  if(!Array.isArray(l.residents)||l.residents.length>250||new Set(l.residents.map(r=>r.id)).size!==l.residents.length)throw Error('Invalid residents in save.')
  for(const r of l.residents)if(!r||!w.combat?.actors.some(a=>a.id===r.id&&a.kind==='resident')||!text(r.name,100)||!text(r.town)||!Object.hasOwn(PROFESSIONS,r.role)||!text(r.homeBuilding)||!text(r.workBuilding)||!number(r.friendship,-100,100)||!number(r.conversations)||!number(r.lastGiftDay,-1)||!point(r.destination)||!['sleeping','working','walking','at the inn','at the market','at the festival'].includes(r.activity)||!text(r.dialogue,2000)||typeof r.female!=='boolean'||r.insideBuilding!==undefined&&(!text(r.insideBuilding)||!placeById(w,r.insideBuilding)))throw Error('Invalid resident history in save.')
  if(!object(l.quests)||Object.entries(l.quests).some(([k,p])=>!QUESTS.some(q=>q.id===k)||!p||!['available','active','ready','complete'].includes(p.state)||p.acceptedAt!==undefined&&!number(p.acceptedAt,0,w.time)||p.completedAt!==undefined&&!number(p.completedAt,0,w.time)))throw Error('Invalid quest history in save.')
  for(const [key,max]of [['discoveries',100],['resourcesRemoved',5000],['defeated',100]] as const)if(!Array.isArray(l[key])||l[key].length>max||l[key].some(s=>!text(s))||new Set(l[key]).size!==l[key].length)throw Error('Invalid discovery history in save.')
  if(!record(l.harvested)||!record(l.stats)||Object.keys(l.harvested).length>20000||!object(l.regions)||Object.entries(l.regions).some(([k,r])=>!safeKey(k)||!r||typeof r.populated!=='boolean'||!number(r.lastVisit,0,w.time))||!object(l.containers)||Object.entries(l.containers).some(([k,b])=>!safeKey(k)||!bag(b)))throw Error('Invalid household storage or resource history.')
  if(!object(l.animals)||Object.entries(l.animals).some(([k,a])=>!w.animals.some(b=>b.id===k)||!a||typeof a.owner!=='boolean'||typeof a.following!=='boolean'||!number(a.affinity,0,100)||!number(a.lastProduct,0,w.time)||!text(a.region)))throw Error('Invalid animal household records.')
  if(!Array.isArray(l.garden)||l.garden.length>200||l.garden.some(p=>!p||!text(p.id)||!['apple','herb','flax'].includes(p.crop)||!point(p.position)||!number(p.planted,0,w.time)||!number(p.harvested,0,w.time)))throw Error('Invalid orchard and herb garden.')
  if(!Array.isArray(l.events)||l.events.length>80||!Number.isSafeInteger(l.nextEvent)||l.nextEvent<1||l.events.some(e=>!e||!Number.isSafeInteger(e.id)||e.id<1||e.id>=l.nextEvent||!number(e.time,0,w.time)||!text(e.text,2000)||!['quest','discovery','care','trade','combat','world'].includes(e.kind)))throw Error('Invalid village event history.')
  if(!l.equipment||!['hand','sword','bow'].includes(l.equipment.weapon)||typeof l.equipment.shield!=='boolean'||!l.avatar||!text(l.avatar.name,40)||!['hobbit','human'].includes(l.avatar.kind)||typeof l.avatar.female!=='boolean'||!Number.isInteger(l.avatar.colour)||!number(l.avatar.colour,0,0xffffff)||!l.weather||!['clear','cloudy','rain','mist','snow'].includes(l.weather.kind)||!number(l.weather.nextChange))throw Error('Invalid character or weather settings.')
  if(l.waypoint&&(!text(l.waypoint.id)||!text(l.waypoint.label)||!point(l.waypoint.position)))throw Error('Invalid waypoint.')
  if(l.interior){const r=l.interior;if(!text(r.id)||!text(r.label)||!text(r.kind)||!point(r.origin)||!point(r.exit)||!number(r.exit.yaw,-1e10)||!number(r.exit.pitch,-Math.PI,Math.PI)||!number(r.width,6,30)||!number(r.depth,6,30)||r.keeper!==undefined&&!l.residents.some(n=>n.id===r.keeper))throw Error('Invalid interior.')}
  if(l.riding&&!w.animals.some(a=>a.id===l.riding&&a.species==='horse')||l.seated!==undefined&&!text(l.seated))throw Error('Invalid movement state.')
  if(l.transport&&(!point(l.transport.start)||!point(l.transport.end)||l.transport.kind!=='ferry'||!number(l.transport.started,0,w.time)||!number(l.transport.duration,1,60)))throw Error('Invalid ferry journey.')
  if(l.gates!==undefined&&(!object(l.gates)||Object.entries(l.gates).some(([key,open])=>key!=='hay-gate'||typeof open!=='boolean')))throw Error('Invalid gate state.')
  if(!Array.isArray(l.furnishingUndo)||l.furnishingUndo.length>30||l.furnishingUndo.some(e=>!e||!e.before&&!e.after||[e.before,e.after].some(f=>f&&(!text(f.id)||!Object.hasOwn(FURNITURE,f.kind)||!point(f.position)||!number(f.yaw,-1e10)||typeof f.open!=='boolean'))))throw Error('Invalid furnishing history.')
}
