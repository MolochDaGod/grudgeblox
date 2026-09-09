/** Local world state. These IDs are world-local, never fleet account or bag IDs. */
import type { CombatState } from './combatTypes'
export type Point = { x: number; y: number; z: number }
export type Species = 'sheep' | 'chicken' | 'rabbit' | 'cattle' | 'pig' | 'horse' | 'fish' | 'llama' | 'bird' | 'frog'
export type FurnitureKind = 'table' | 'chair' | 'bed' | 'shelf' | 'chest' | 'door' | 'lamp' | 'fence' | 'feeder' | 'perch' | 'burrow'
export type Tool = 'explore' | 'room' | 'passage' | 'dig' | 'fill' | 'floor' | 'ceiling' | 'entrance' | 'furnish' | 'farm'
export interface Excavation { id: string; kind: 'dig' | 'fill'; shape: 'box' | 'sphere' | 'cylinder' | 'ramp'; center: Point; size: Point; yaw: number; entrance: boolean; slope?: number; batch?: string }
export interface DoorFit { width:number; height:number; openingWidth:number; openingHeight:number }
export interface Furnishing { id: string; kind: FurnitureKind; position: Point; yaw: number; open: boolean; fit?:DoorFit; stock?:number }
export interface Crop { id: string; kind: 'barley' | 'carrot'; position: Point; planted: number; watered: boolean; harvested: boolean }
export const ANIMAL_ACTIVITIES = ['grazing','pecking','hopping','rooting','cantering','browsing','schooling','circling','basking','resting','fleeing','following mother','approaching feed','feeding','perching','sheltering','watching'] as const
export type AnimalActivity = typeof ANIMAL_ACTIVITIES[number]
export interface Animal { id: string; name: string; species: Species; sex: 'female' | 'male'; age: number; home: Point; position: Point; fedUntil: number; parents?: [string,string]; pregnant?: { sire: string; due: number }; cooldownUntil: number; mood: 'grazing' | 'walking' | 'resting' | 'hungry'; tint: number; activity?:AnimalActivity; startledUntil?:number; calmUntil?:number }
export interface World {
  combat?: CombatState;
  version: 1; generator: 'shire-1'|'shire-atlas-1'; id: string; name: string; seed: number; revision: number; createdAt: string; savedAt: string; time: number;
  player: Point & { yaw: number; pitch: number }; home?: Point; edits: Excavation[]; redo: Excavation[]; furniture: Furnishing[]; crops: Crop[]; animals: Animal[];
  supplies: { barleySeed: number; carrotSeed: number; barley: number; carrot: number; feed: number }; storage: { barley: number; carrot: number };
}
export interface WorldSummary { id: string; name: string; savedAt: string; revision: number }
export interface Settlement { name: string; x: number; z: number; homes: number; elves?: boolean }
export const SETTLEMENTS: Settlement[] = [
  { name: 'Millbrook', x: 55, z: 30, homes: 16 }, { name: 'Greenbank', x: -710, z: -390, homes: 14 },
  { name: 'Willow End', x: 620, z: 610, homes: 14 }, { name: 'Fangorn clearing', x: 1550, z: 1450, homes: 8, elves: true },
]
export const SPECIES: Record<Species, { label: string; habitat: 'pasture' | 'water' | 'air' | 'bank'; maturity: number; gestation: number; speed: number; scale: number; color: number }> = {
  sheep: { label: 'Sheep', habitat: 'pasture', maturity: 480, gestation: 90, speed: 0.5, scale: 1, color: 0xe6dfc8 },
  chicken: { label: 'Chicken', habitat: 'pasture', maturity: 240, gestation: 65, speed: 0.7, scale: 0.48, color: 0xc58a54 },
  rabbit: { label: 'Rabbit', habitat: 'pasture', maturity: 180, gestation: 60, speed: 0.9, scale: 0.48, color: 0xbca286 },
  cattle: { label: 'Cattle', habitat: 'pasture', maturity: 720, gestation: 180, speed: 0.35, scale: 1.5, color: 0x7b5540 },
  pig: { label: 'Pig', habitat: 'pasture', maturity: 360, gestation: 100, speed: 0.5, scale: 0.9, color: 0xc78d85 },
  horse: { label: 'Horse', habitat: 'pasture', maturity: 720, gestation: 180, speed: 0.75, scale: 1.5, color: 0x876046 },
  fish: { label: 'Fish', habitat: 'water', maturity: 120, gestation: 60, speed: 0.7, scale: 0.35, color: 0xc5a857 },
  llama: { label: 'Llama', habitat: 'pasture', maturity: 480, gestation: 150, speed: 0.45, scale: 1.25, color: 0xd5ba98 },
  bird: { label: 'Bird', habitat: 'air', maturity: 180, gestation: 65, speed: 1.4, scale: 0.3, color: 0x536f79 },
  frog: { label: 'Frog', habitat: 'bank', maturity: 120, gestation: 60, speed: 0.35, scale: 0.3, color: 0x708844 },
}
export type WorldAction =
  | { type:'strike'; id:string }
  | { type:'guard'|'heal'|'respawn' }
  | { type:'travel-encounter'; id:string }
  | { type: 'checkpoint'; player: World['player'] }
  | { type: 'excavate'; edit: Omit<Excavation,'id'> }
  | { type: 'entrance'; origin:Point; yaw:number; width:number; height:number }
  | { type: 'undo' | 'redo' | 'save' | 'return-home' | 'travel-cinderlord' }
  | { type: 'claim'; position: Point }
  | { type: 'furnish'; kind: FurnitureKind; position: Point; yaw: number }
  | { type: 'remove-furniture' | 'use-furniture'; id: string }
  | { type: 'plant'; position: Point; kind: Crop['kind'] }
  | { type: 'water' | 'harvest' | 'feed'; id: string }
  | { type: 'calm' | 'startle'; id:string }
  | { type: 'breed'; dam: string; sire: string }
  | { type: 'travel'; settlement: number }
  | { type: 'store' | 'withdraw' };
export const FURNITURE: Record<FurnitureKind, { label: string; size: Point }> = {
  table: { label: 'Table', size: {x:1.5,y:0.78,z:0.9} }, chair:{label:'Chair',size:{x:0.55,y:0.95,z:0.55}},
  bed:{label:'Bed',size:{x:1.2,y:0.6,z:2}},shelf:{label:'Shelves',size:{x:1.2,y:1.6,z:0.4}},
  chest:{label:'Household chest',size:{x:1,y:0.65,z:0.6}},door:{label:'Round door',size:{x:1.5,y:2,z:0.16}},
  lamp:{label:'Lantern',size:{x:0.28,y:0.6,z:0.28}},fence:{label:'Fence',size:{x:2,y:1.05,z:0.18}},
  feeder:{label:'Wildlife feeder',size:{x:1.4,y:0.55,z:0.8}},perch:{label:'Bird perch',size:{x:1.5,y:1.7,z:0.5}},burrow:{label:'Rabbit shelter',size:{x:1.3,y:0.65,z:1.2}},
}
export const WORLD_LIMIT = 2000
export const PLAYER_HEIGHT = 1.55
export const PLAYER_RADIUS = 0.26
export const FALL_RECOVERY_Y = -35
export function distance(a: Point,b: Point) { return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z) }
export function finitePoint(p: unknown): p is Point { const q=p as Point; return !!q && [q.x,q.y,q.z].every(Number.isFinite) }
export function id() { return globalThis.crypto.randomUUID() }
