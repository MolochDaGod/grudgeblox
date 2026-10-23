import type { Point } from './model'

export const DAMAGE_TYPES = ['physical', 'fire', 'poison', 'spirit', 'fall', 'drowning'] as const
export type DamageType = typeof DAMAGE_TYPES[number]
export type ActorKind = 'player' | 'hostile' | 'resident' | 'animal'
export type CombatPhase = 'idle' | 'patrol' | 'chase' | 'windup' | 'recover' | 'return' | 'dead'
export interface Affliction { kind:'burn'|'poison'; source:string; remaining:number; nextTick:number; damage:number }
export interface Vitality {
  hp:number; maxHp:number; armour:number; stamina:number; breath:number;
  lastDamage:number; invulnerableUntil:number; cooldownUntil:number; blockingUntil:number;
  diedAt:number|null; respawnAt:number|null; effects:Affliction[];
}
export interface CombatActor {
  id:string; kind:ActorKind; species:string; name:string; home:Point; position:Point; yaw:number;
  vitality:Vitality; phase:CombatPhase; phaseAt:number; targetId?:string; strikeAt?:number;
  attackSerial:number; hitSerial:number; generation:number;
}
export interface CombatEvent {
  seq:number; time:number; type:'damage'|'blocked'|'heal'|'death'|'respawn'|'attack'|'miss';
  source:string; target:string; amount:number; damageType?:DamageType;
}
export interface CombatState {
  projectiles?: Array<{ id:number; source:string; target:string; start:Point; end:Point; launched:number; arrives:number; damage:number }>;
  version:1; actors:CombatActor[]; events:CombatEvent[]; nextEvent:number;
  healingDraughts:number; peakY:number; lastPlayerY:number; grounded:boolean;
}
