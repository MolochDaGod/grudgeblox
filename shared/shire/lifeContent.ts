import type { ItemId, ItemDefinition, Recipe, QuestDefinition, LifeSettings, Profession, LifePlace, ResidentLife } from './lifeTypes'
import { ATLAS_TOWNS, townPlots, isAtlas, atlasHeight } from './atlas'
import { SETTLEMENTS } from './model'
import type { World } from './model'

export const PLAY_STYLES = {
  homestead: { name: 'Homestead', description: 'A peaceful life of neighbours, gardens, animals and discovery. Earn and craft improvements without hostile attacks.' },
  adventure: { name: 'Adventure', description: 'Build a home and help your neighbours, then explore dangerous country with equipment, rewards and regional stories.' },
  creative: { name: 'Creative', description: 'Free construction, open travel and the complete creative encounter catalogue. Change the world at your own pace.' },
} as const
export const DEFAULT_LIFE_SETTINGS: LifeSettings = {
  sensitivity: 1, fov: 70, invertY: false, uiScale: 1, contrast: false, reducedMotion: false,
  subtitles: true, masterVolume: .65, musicVolume: .3, effectsVolume: .75, quality: 'high',
  autoPause: true, camera: 'first', clickToMove: true, bindings: { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', run: 'ShiftLeft', jump: 'Space', interact: 'KeyE', apply: 'KeyF', guard: 'KeyQ', heal: 'KeyH', dodge: 'KeyR', dive: 'ControlLeft' },
}
export const ITEMS: Record<ItemId, ItemDefinition> = {
  wood: { name: 'Timber', icon: 'wood', value: 2, description: 'Fallen wood and sustainably collected timber for building.' },
  stone: { name: 'Stone', icon: 'stone', value: 2, description: 'Building stone from exposed outcrops.' },
  clay: { name: 'Clay', icon: 'clay', value: 2, description: 'Earth for plaster, hearths and garden work.' },
  iron: { name: 'Iron', icon: 'iron', value: 5, description: 'Metal for a smith to turn into useful equipment.' },
  herb: { name: 'Garden herbs', icon: 'herb', value: 2, description: 'Fragrant leaves for cooking and tea.' },
  apple: { name: 'Apples', icon: 'apple', value: 3, description: 'Orchard fruit, good fresh or baked.', food: 8 },
  berry: { name: 'Berries', icon: 'berry', value: 2, description: 'A handful of ripe hedgerow berries.', food: 5 },
  mushroom: { name: 'Field mushrooms', icon: 'mushroom', value: 3, description: 'The game’s clearly marked edible mushroom patch.', food: 5 },
  honey: { name: 'Honey', icon: 'honey', value: 6, description: 'A sweet ingredient supplied by local beekeepers.' },
  flax: { name: 'Flax', icon: 'flax', value: 3, description: 'Fibres for cloth and rope.' },
  fish: { name: 'River fish', icon: 'fish', value: 4, description: 'A catch for the kitchen.', food: 6 },
  egg: { name: 'Eggs', icon: 'egg', value: 3, description: 'Collected from a cared-for hen.' },
  milk: { name: 'Milk', icon: 'milk', value: 4, description: 'Collected from a cared-for cow.', food: 8 },
  wool: { name: 'Wool', icon: 'wool', value: 4, description: 'Soft wool from a cared-for sheep or llama.' },
  flour: { name: 'Flour', icon: 'flour', value: 4, description: 'Barley milled for the baker.' },
  bread: { name: 'Fresh bread', icon: 'bread', value: 9, description: 'A filling loaf baked in a kitchen.', food: 25, skill: 'cooking' },
  stew: { name: 'Garden stew', icon: 'stew', value: 12, description: 'Carrots and herbs, cooked slowly. Restores health and gives a well-fed bonus.', food: 40, skill: 'cooking' },
  pie: { name: 'Orchard pie', icon: 'pie', value: 20, description: 'A favourite at the village gathering.', food: 55, skill: 'cooking' },
  tea: { name: 'Herbal tea', icon: 'tea', value: 6, description: 'A warming cup that clears unpleasant effects.', food: 15, skill: 'cooking' },
  cheese: { name: 'Farmhouse cheese', icon: 'cheese', value: 12, description: 'Milk made into a useful travelling meal.', food: 30 },
  plank: { name: 'Planks', icon: 'plank', value: 4, description: 'Prepared timber for furniture and building.' },
  cloth: { name: 'Cloth', icon: 'cloth', value: 8, description: 'Woven fabric for bedding and equipment.' },
  rope: { name: 'Rope', icon: 'rope', value: 5, description: 'Useful for animal care and travelling equipment.' },
  arrow: { name: 'Arrows', icon: 'arrow', value: 2, description: 'Ammunition for a bow.' },
  sword: { name: 'Short sword', icon: 'sword', value: 38, description: 'A balanced blade for optional adventures.' },
  bow: { name: 'Ash bow', icon: 'bow', value: 32, description: 'A ranged weapon that consumes one arrow per shot.' },
  shield: { name: 'Round shield', icon: 'shield', value: 25, description: 'Improves a well-timed, correctly faced guard.' },
  axe: { name: 'Woodworker’s axe', icon: 'axe', value: 20, description: 'Allows careful harvesting of marked timber trees.' },
  lantern: { name: 'Crafted lantern', icon: 'lantern', value: 14, description: 'A handmade household item and a welcome gift.' },
  saddle: { name: 'Pony saddle', icon: 'saddle', value: 30, description: 'Ride an adopted adult pony after fitting a saddle.' },
  barley: { name: 'Barley', icon: 'barley', value: 2, description: 'Harvested grain for the mill.' },
  carrot: { name: 'Carrots', icon: 'carrot', value: 2, description: 'Freshly grown vegetables.', food: 5 },
  barleySeed: { name: 'Barley seed', icon: 'seed', value: 1, description: 'Plant in your outdoor garden.' },
  carrotSeed: { name: 'Carrot seed', icon: 'seed', value: 1, description: 'Plant in your outdoor garden.' },
  feed: { name: 'Animal feed', icon: 'feed', value: 1, description: 'A care ration for animals and feeders.' },
}
export const RECIPES: Recipe[] = [
  { id: 'planks', name: 'Saw timber into planks', input: { wood: 2 }, output: 'plank', count: 3, skill: 'craft', level: 0, station: 'bench' },
  { id: 'flour', name: 'Mill barley', input: { barley: 2 }, output: 'flour', count: 2, skill: 'cooking', level: 0, station: 'mill' },
  { id: 'stew', name: 'Garden stew', input: { carrot: 3, herb: 1 }, output: 'stew', count: 1, skill: 'cooking', level: 0, station: 'kitchen' },
  { id: 'tea', name: 'Herbal tea', input: { herb: 2 }, output: 'tea', count: 2, skill: 'cooking', level: 0, station: 'kitchen' },
  { id: 'bread', name: 'Bake fresh bread', input: { flour: 2 }, output: 'bread', count: 2, skill: 'cooking', level: 0, station: 'kitchen' },
  { id: 'pie', name: 'Bake orchard pie', input: { flour: 2, apple: 3, egg: 1 }, output: 'pie', count: 1, skill: 'cooking', level: 1, station: 'kitchen' },
  { id: 'cheese', name: 'Make farmhouse cheese', input: { milk: 3 }, output: 'cheese', count: 2, skill: 'cooking', level: 1, station: 'kitchen' },
  { id: 'cloth', name: 'Weave cloth', input: { wool: 2, flax: 1 }, output: 'cloth', count: 2, skill: 'craft', level: 0, station: 'bench' },
  { id: 'rope', name: 'Twist flax rope', input: { flax: 2 }, output: 'rope', count: 2, skill: 'craft', level: 0, station: 'bench' },
  { id: 'lantern', name: 'Make a lantern', input: { iron: 1, wood: 2 }, output: 'lantern', count: 1, skill: 'craft', level: 0, station: 'bench' },
  { id: 'axe', name: 'Make a woodworker’s axe', input: { iron: 2, plank: 1 }, output: 'axe', count: 1, skill: 'craft', level: 0, station: 'smithy' },
  { id: 'sword', name: 'Forge a short sword', input: { iron: 4, wood: 1 }, output: 'sword', count: 1, skill: 'craft', level: 1, station: 'smithy' },
  { id: 'bow', name: 'Shape an ash bow', input: { wood: 4, rope: 1 }, output: 'bow', count: 1, skill: 'craft', level: 1, station: 'bench' },
  { id: 'shield', name: 'Make a round shield', input: { plank: 3, iron: 1 }, output: 'shield', count: 1, skill: 'craft', level: 1, station: 'bench' },
  { id: 'arrows', name: 'Fletch six arrows', input: { wood: 2, iron: 1 }, output: 'arrow', count: 6, skill: 'craft', level: 0, station: 'any' },
  { id: 'saddle', name: 'Make a pony saddle', input: { cloth: 2, rope: 2, plank: 1 }, output: 'saddle', count: 1, skill: 'craft', level: 1, station: 'bench' },
]
export const PROFESSIONS: Record<Profession, { label: string; stock: ItemId[]; greeting: string }> = {
  innkeeper: { label: 'Innkeeper', stock: ['bread', 'stew', 'pie', 'tea', 'cheese', 'flour', 'honey'], greeting: 'There is always room at the table. Local produce keeps this kitchen going, and a good meal makes the road easier.' },
  gardener: { label: 'Gardener', stock: ['barleySeed', 'carrotSeed', 'herb', 'apple', 'berry', 'mushroom', 'flax'], greeting: 'A garden begins with a little care. Leave room between plants, water the soil, and bring something back to share.' },
  carpenter: { label: 'Carpenter', stock: ['wood', 'plank', 'rope', 'cloth', 'axe', 'lantern'], greeting: 'A sound home starts with a clear exit and good timber. You can use the workbench here to make your own improvements.' },
  farmer: { label: 'Farmer', stock: ['feed', 'egg', 'milk', 'wool', 'barley', 'carrot', 'saddle'], greeting: 'Animals remember patient care. Adopt a pair, lead them to a safe paddock, and keep their feeder stocked.' },
  smith: { label: 'Smith', stock: ['stone', 'clay', 'iron', 'sword', 'shield', 'bow', 'arrow', 'axe'], greeting: 'A well-made tool lasts a long time. The forge is ready if you have materials; I also keep equipment for travellers.' },
  ranger: { label: 'Wayfarer', stock: ['arrow', 'rope', 'tea', 'fish'], greeting: 'Follow the lanes, watch the weather, and learn the crossings. Dangerous places deserve preparation, not haste.' },
}
export function gamePlaces(w: Pick<World, 'generator' | 'seed'>): LifePlace[] {
  if (!isAtlas(w)) return SETTLEMENTS.flatMap((s,j) => Array.from({length:6},(_,i) => {
    const a=i*Math.PI/3,x=s.x+Math.sin(a)*20,z=s.z+Math.cos(a)*20
    return { id:`legacy:${j}:${i}`,label:`${s.name} ${['inn','garden house','workshop','farmhouse','smithy','hall'][i]}`,kind:['inn','cottage','barn','barn','smithy','hall'][i],town:`legacy-${j}`,position:{x,y:0,z},door:{x,y:0,z:z+4},yaw:0,width:12,depth:15,public:true }
  }))
  return ATLAS_TOWNS.flatMap(t => townPlots(t).map(p => {
    const y=atlasHeight(p.x,p.z),distance=2.5*p.scale
    return {id:p.id,label:p.label||`${t.name} ${p.kind}`,kind:p.kind,town:t.id,position:{x:p.x,y,z:p.z},door:{x:p.x+Math.sin(p.yaw)*distance,y,z:p.z+Math.cos(p.yaw)*distance},yaw:p.yaw,width:p.kind==='hall'?24:p.kind==='inn'?16:12,depth:p.kind==='inn'?22:16,public:true}
  }))
}
const placeCache=new Map<string,LifePlace[]>()
export function places(w:Pick<World,'generator'|'seed'>){let list=placeCache.get(w.generator);if(!list){list=gamePlaces(w);placeCache.set(w.generator,list)}return list}
export function placeById(w:Pick<World,'generator'|'seed'>,id:string){return places(w).find(p=>p.id===id)}
export const MAIN_QUESTS: QuestDefinition[] = [
  {id:'welcome',name:'A place at the table',description:'Introduce yourself to the innkeeper in Hobbiton. Find the Ivy Bush door or speak to the innkeeper nearby.',town:'hobbiton',role:'innkeeper',goal:'talked',count:1,reward:{coins:25,items:{wood:12,stone:8},skill:'exploration',xp:20}},
  {id:'home',name:'A hill to call home',description:'Follow the suggested home waypoint beyond the public village and mark a free hill as home.',town:'hobbiton',role:'carpenter',previous:'welcome',goal:'home',count:1,reward:{coins:15,items:{wood:12,cloth:2},skill:'craft',xp:20}},
  {id:'doorway',name:'Beneath the grass',description:'Dig a covered entrance and chamber. The starter-smial blueprint can help when you stand beside your home marker.',town:'hobbiton',role:'carpenter',previous:'home',goal:'edits',count:2,reward:{coins:15,items:{plank:12,iron:3},skill:'craft',xp:25}},
  {id:'comfort',name:'The comforts of home',description:'Place a bed and a household chest near your home. Keep the way outdoors clear.',town:'hobbiton',role:'carpenter',previous:'doorway',goal:'comfort',count:2,reward:{coins:20,items:{herb:3},skill:'craft',xp:25}},
  {id:'garden',name:'From soil to supper',description:'Plant and water carrots or barley on your own land, then harvest at least one crop.',town:'hobbiton',role:'gardener',previous:'comfort',goal:'harvests',count:1,reward:{coins:15,items:{herb:3,flour:2},skill:'gardening',xp:25}},
  {id:'supper',name:'Something good in the pot',description:'Use an inn kitchen or your home hearth to cook garden stew.',town:'hobbiton',role:'innkeeper',previous:'garden',goal:'crafted:stew',count:1,reward:{coins:20,items:{flour:2},skill:'cooking',xp:30}},
  {id:'neighbours',name:'A welcome in Bywater',description:'Bring a garden stew to the Green Dragon innkeeper in Bywater. It is a gift from your new home.',town:'bywater',role:'innkeeper',previous:'supper',goal:'delivery',count:1,delivery:{stew:1},reward:{coins:35,items:{rope:2,saddle:1},skill:'cooking',xp:35}},
  {id:'care',name:'A growing household',description:'Adopt an animal from the Household panel, lead it home, and settle it beside your home marker.',town:'hobbiton',role:'farmer',previous:'neighbours',goal:'animalsHome',count:1,reward:{coins:25,items:{feed:24,cloth:2},skill:'care',xp:35}},
  {id:'handmade',name:'A light in the window',description:'Craft a lantern at a carpenter’s bench or your home workbench.',town:'hobbiton',role:'carpenter',previous:'care',goal:'crafted:lantern',count:1,reward:{coins:30,items:{bread:3},skill:'craft',xp:35}},
  {id:'roads',name:'A wider world',description:'Visit three atlas destinations. Your discovered places remain in the journal.',town:'hobbiton',role:'ranger',previous:'handmade',goal:'discoveries',count:3,reward:{coins:35,items:{tea:3},skill:'exploration',xp:45}},
  {id:'celebration',name:'There and home again',description:'Return to a village gathering place and share a meal. The Festival action works at an inn or village green.',town:'hobbiton',role:'innkeeper',previous:'roads',goal:'festivals',count:1,reward:{coins:60,items:{pie:2,cloth:5},skill:'care',xp:50}},
]
const localNeeds:Partial<Record<string,{item:ItemId;title:string;story:string}>>={
  hobbiton:{item:'bread',title:'Loaves for the mill hands',story:'The mill workers need a good midday meal.'},
  bywater:{item:'apple',title:'Apples for the Green Dragon',story:'The inn is preparing a new batch of orchard pies.'},
  tuckborough:{item:'cloth',title:'Fresh cloth for the Great Smials',story:'Household linens are being mended before the gathering.'},
  'michel-delving':{item:'plank',title:'Repairs at the Town Hole',story:'The market keeper is replacing worn shelving.'},
  bree:{item:'cheese',title:'Provisions for the road',story:'Guests at the Prancing Pony need travelling food.'},
  stock:{item:'rope',title:'Along the riverbank',story:'The farmers need new rope for their waterside work.'},
  'tom-bombadil':{item:'herb',title:'A garden beside the forest',story:'Fresh garden herbs are welcome at the isolated house.'},
  bamfurlong:{item:'carrot',title:'The farmhouse pantry',story:'Help the household put aside vegetables for its next meal.'},
}
export const REGIONAL_QUESTS:QuestDefinition[]=ATLAS_TOWNS.map((t,i)=>{
  const need=localNeeds[t.id]||{item:(['bread','carrot','wool','plank','herb','apple'] as ItemId[])[i%6],title:`A neighbour’s request in ${t.name}`,story:`The ${t.style==='bree'?'roadside households':t.style==='farm'?'farm families':'neighbours'} of ${t.name} are preparing for their next market day.`}
  return {id:`request:${t.id}`,name:need.title,description:`${need.story} Bring three ${ITEMS[need.item].name.toLowerCase()} to the local innkeeper or household host.`,town:t.id,role:'innkeeper',goal:'delivery',count:1,delivery:{[need.item]:3},reward:{coins:24+ITEMS[need.item].value*3,skill:'care',xp:25}}
})
export const ADVENTURE_QUESTS:QuestDefinition[]=[
  {id:'barrow-story',name:'The unquiet stones',description:'Find the barrow entrance on the downs. Recover the lost wayfarer’s token from the chamber and return to the ranger.',town:'bree',role:'ranger',goal:'barrowToken',count:1,reward:{coins:70,items:{sword:1},skill:'exploration',xp:65}},
  {id:'watch-the-roads',name:'A safer road',description:'In Adventure mode, defeat three different regional threats. Your journal records each resolved encounter.',town:'bree',role:'ranger',goal:'defeats',count:3,adventure:true,reward:{coins:90,items:{shield:1,arrow:12},skill:'combat',xp:80}},
  {id:'crossing',name:'Across the Brandywine',description:'Take the working ferry across the Brandywine and discover Buckland.',town:'bucklebury',role:'ranger',goal:'ferryTrips',count:1,reward:{coins:30,items:{fish:3},skill:'exploration',xp:35}},
]
export const QUESTS=[...MAIN_QUESTS,...REGIONAL_QUESTS,...ADVENTURE_QUESTS]
export function skillLevel(xp:number){return Math.min(10,Math.floor(Math.sqrt(Math.max(0,xp)/40)))}
export function seasonAt(time:number){return ['Spring','Summer','Autumn','Winter'][Math.floor(time/600/7)%4]}
export function hourAt(time:number){return time%600/25}
export function dayAt(time:number){return Math.floor(time/600)+1}
export function calendarEvent(time:number){const day=dayAt(time),season=seasonAt(time);return day%7===0?`${season} village festival`:day%3===0?'Market day':'An ordinary Shire day'}
const firstMale=['Milo','Tobin','Rowan','Wilbur','Oswin','Perry','Bram','Teddy','Hugo','Robin','Clem','Jasper']
const firstFemale=['Ada','Nell','Mabel','Tilly','Willow','Hazel','Poppy','Lily','Dora','Ruby','Merry','Pearl']
const lastNames=['Goodbarrel','Briarfoot','Underbough','Hayward','Greenacre','Brushwood','Mossbank','Appleby','Fairmeadow','Willowbend','Reed','Bramble']
export function residentDetails(w:World):ResidentLife[]{
  const towns=isAtlas(w)?ATLAS_TOWNS:SETTLEMENTS.map((t,i)=>({...t,id:`legacy-${i}`})),all=places(w)
  return (w.combat?.actors||[]).filter(a=>a.kind==='resident').map((a,k)=>{
    const [,jText,iText]=a.id.split(':'),j=+jText,i=+iText,town=towns[j],female=(i+j)%2===0,role=(Object.keys(PROFESSIONS) as Profession[])[i%6],local=all.filter(p=>p.town===town?.id)
    const desired={innkeeper:'inn',gardener:'cottage',carpenter:'barn',farmer:'barn',smith:'smithy',ranger:'hall'}[role]
    const work=local.find(p=>p.kind===desired)||local[0],home=local.filter(p=>p.kind==='smial'||p.kind==='cottage')[i]||work
    return {id:a.id,name:`${(female?firstFemale:firstMale)[(k*3+i)%12]} ${lastNames[(j*3+i)%12]}`,town:town?.id||'hobbiton',role,homeBuilding:home?.id||'',workBuilding:work?.id||'',friendship:0,conversations:0,lastGiftDay:-1,destination:{...(work?.door||a.home)},activity:'working',dialogue:'',female}
  })
}
