import type { DamageType } from './combatTypes'

export interface HostileDefinition {
  id:string; name:string; description:string; assetId:string; height:number; radius:number;
  hp:number; armour:number; damage:number; damageType:DamageType; speed:number;
  reach:number; aggro:number; windup:number; recovery:number; respawn:number;
  locomotion:string; attack:string; idle:string; death:string; hit:string;
  movement:'ground'|'air'|'water'; resistance:Partial<Record<DamageType,number>>;
}
function creature(id:string,name:string,description:string,overrides:Partial<HostileDefinition>={}):HostileDefinition {
  return {id,name,description,assetId:`hostile-${id}`,height:1.8,radius:.48,hp:80,armour:8,damage:14,damageType:'physical',speed:2.4,reach:2.4,aggro:17,windup:.8,recovery:1.2,respawn:120,locomotion:'run',attack:'attack',idle:'idle',death:'death',hit:'hit',movement:'ground',resistance:{},...overrides}
}
/** Encounter representatives; human entries are factions, not inherently evil peoples. */
export const HOSTILES:HostileDefinition[]=[
  creature('01-orc','Orc Scout','A small, aggressive scout with a quick blade.',{height:1.65,hp:60,armour:5}),
  creature('02-uruk-hai','Uruk-hai Soldier','A heavily equipped Orc soldier with greater reach and endurance.',{height:1.96,hp:110,armour:24,damage:18}),
  creature('03-half-orc','Half-orc Enforcer','A human-sized enforcer with an Orc-like face and scavenged equipment.',{height:1.87,hp:90,armour:12}),
  creature('04-troll','Cave Troll','A hulking cave creature that signals its powerful blows.',{height:3.7,radius:1.35,hp:280,armour:30,damage:30,reach:4.1,windup:1.25,recovery:2,speed:1.9}),
  creature('05-olog-hai','Olog-hai','An armoured great troll, slow to turn and difficult to wound.',{height:4.1,radius:1.5,hp:360,armour:50,damage:35,reach:4.5,windup:1.3,recovery:2,speed:2}),
  creature('06-dragon','Northern Fire-drake','A winged fire-breather with ground movement, flight and a long tail.',{height:4.2,radius:2.4,hp:600,armour:45,damage:32,damageType:'fire',speed:3.5,reach:8,aggro:27,windup:1.5,recovery:2.5,attack:'breath',resistance:{fire:0,poison:.5},respawn:240}),
  creature('07-great-spider','Great Spider','An eight-legged ambush predator with a poisonous bite.',{height:1.25,radius:1,hp:75,armour:5,damage:12,damageType:'poison',speed:3.1,reach:2.9,locomotion:'walk',resistance:{poison:0}}),
  creature('08-warg','Warg','A swift wolf-like pack hunter with a snapping bite.',{height:1.35,radius:.75,hp:85,armour:5,damage:16,speed:4.4,reach:2.7}),
  creature('09-werewolf','Werewolf of Tol-in-Gaurhoth','A larger spirit wolf with a threatening howl and powerful jaws.',{height:1.9,radius:.95,hp:145,armour:12,damage:22,damageType:'spirit',speed:3.7,reach:3.2,resistance:{poison:.5,spirit:.5}}),
  creature('10-vampire','Vampire Messenger','A bat-shaped creature that hovers, swoops and bites.',{height:1.65,radius:.7,hp:75,armour:3,damage:13,speed:3.6,reach:3.2,movement:'air',locomotion:'fly',idle:'hover'}),
  creature('11-balrog','Balrog','A towering being of flame, adapted from the retained Cinderlord model.',{height:6.5,radius:2,hp:700,armour:50,damage:38,damageType:'fire',speed:2.3,reach:6.5,aggro:27,windup:1.5,recovery:2.5,respawn:240,resistance:{fire:0,poison:0,spirit:.5}}),
  creature('12-fell-beast','Fell Beast','A large winged mount with hind talons, a long neck and rider attachment.',{height:3.1,radius:1.8,hp:300,armour:20,damage:28,speed:3.5,reach:5,movement:'air',locomotion:'fly',idle:'glide',windup:1.1}),
  creature('13-easterling','Easterling Warrior','An eastern warrior represented by bronze armour and a conical helmet.',{hp:100,armour:22,damage:16}),
  creature('14-wainrider','Wainrider Raider','A raider with earth-coloured clothing and a wheel insignia; this model fights on foot.',{height:1.76,hp:85,armour:12,speed:2.7}),
  creature('15-balchoth','Balchoth Spearman','A spear fighter with reinforced leather equipment and long thrusts.',{height:1.79,hp:90,armour:15,reach:3.4,attack:'spear_thrust',windup:1}),
  creature('16-haradrim','Haradrim Warrior','A southern warrior in crimson wraps, carrying a curved sword.',{height:1.83,hp:90,armour:10,speed:2.7}),
  creature('17-variag','Variag of Khand','A warrior with a horsehair crest and teal and iron equipment.',{height:1.77,hp:100,armour:18,damage:17}),
  creature('18-black-numenorean','Black Numenorean','A tall, dark-armoured warrior with a long mantle and crested helmet.',{height:1.99,hp:140,armour:30,damage:22}),
  creature('19-corsair','Corsair of Umbar','A seaborne raider represented on foot, with a blue headscarf and curved cutlass.',{height:1.82,hp:80,armour:7,speed:2.8}),
  creature('20-dunlending','Dunlending Axeman','A hill-country fighter with a fur collar and a heavy axe.',{height:1.81,hp:95,armour:12,damage:21,windup:1}),
  creature('21-rhudaur-hillman','Rhudaur Hillman','A hooded hillman with earth-coloured clothing and a short mantle.',{height:1.74,hp:85,armour:10}),
  creature('22-nazgul','Nazgul','A faceless Ringwraith in black robes, bearing a sword.',{height:1.96,hp:220,armour:25,damage:24,damageType:'spirit',resistance:{poison:0,spirit:.4,fire:1.4},respawn:180}),
  creature('23-barrow-wight','Barrow-wight','A crowned undead guardian with a burial mantle and cold green eyes.',{height:1.83,hp:125,armour:18,damage:19,damageType:'spirit',resistance:{poison:0,fire:1.3}}),
  creature('24-watcher','Watcher in the Water','An interpreted water monster with ten grasping arms and a beaked mouth.',{height:2.8,radius:2.5,hp:380,armour:22,damage:28,speed:1.4,reach:5.5,aggro:15,windup:1.4,recovery:2,movement:'water',locomotion:'swim',attack:'grab'}),
  creature('25-nameless-thing','Nameless Thing','An imagined eyeless deep creature with six tendrils and a plated, elongated body.',{height:2.1,radius:1.7,hp:260,armour:35,damage:26,speed:1.9,reach:4,locomotion:'crawl',attack:'grab',resistance:{poison:0,spirit:.5}}),
]
export const CINDERLORD_DEFINITION=creature('cinderlord','Cinderlord','The original magma guardian at Ashen Hollow.',{assetId:'enemy-cinderlord',height:6.5,radius:2,hp:320,armour:35,damage:32,damageType:'fire',reach:6,aggro:24,windup:33/24,recovery:2.3,respawn:120,locomotion:'Walk',idle:'Idle',attack:'GroundSmash',hit:'Yell',death:'',resistance:{fire:0,poison:0}})
export function hostileDefinition(id:string){return id==='cinderlord'?CINDERLORD_DEFINITION:HOSTILES.find(d=>d.id===id)}
