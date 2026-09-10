import type { Point, World, Species, Furnishing } from './model'

export type PlayStyle = 'homestead' | 'adventure' | 'creative'
export type Profession = 'innkeeper' | 'gardener' | 'carpenter' | 'farmer' | 'smith' | 'ranger'
export type Skill = 'gardening' | 'cooking' | 'craft' | 'care' | 'exploration' | 'combat'
export type ItemId = 'wood' | 'stone' | 'clay' | 'iron' | 'herb' | 'apple' | 'berry' | 'mushroom' | 'honey' | 'flax' | 'fish' | 'egg' | 'milk' | 'wool' | 'flour' | 'bread' | 'stew' | 'pie' | 'tea' | 'cheese' | 'plank' | 'cloth' | 'rope' | 'arrow' | 'sword' | 'bow' | 'shield' | 'axe' | 'lantern' | 'saddle' | 'barley' | 'carrot' | 'barleySeed' | 'carrotSeed' | 'feed'
export type InputAction = 'forward' | 'back' | 'left' | 'right' | 'run' | 'jump' | 'interact' | 'apply' | 'guard' | 'heal' | 'dodge' | 'dive'
export interface LifeSettings {
  sensitivity: number; fov: number; invertY: boolean; uiScale: number; contrast: boolean;
  reducedMotion: boolean; subtitles: boolean; masterVolume: number; musicVolume: number;
  effectsVolume: number; quality: 'low' | 'medium' | 'high'; autoPause: boolean;
  camera: 'first' | 'third'; clickToMove?: boolean; bindings: Record<InputAction, string>
}
export interface ResidentLife {
  id: string; name: string; town: string; role: Profession; homeBuilding: string; workBuilding: string;
  friendship: number; conversations: number; lastGiftDay: number; destination: Point;
  activity: 'sleeping' | 'working' | 'walking' | 'at the inn' | 'at the market' | 'at the festival';
  dialogue: string; female: boolean; insideBuilding?: string
}
export interface QuestProgress { state: 'available' | 'active' | 'ready' | 'complete'; acceptedAt?: number; completedAt?: number }
export interface AnimalLife { owner: boolean; following: boolean; affinity: number; lastProduct: number; region: string }
export interface InteriorState { id: string; label: string; kind: string; origin: Point; exit: World['player']; width: number; depth: number; keeper?: string }
export interface LifeEvent { id: number; time: number; text: string; kind: 'quest' | 'discovery' | 'care' | 'trade' | 'combat' | 'world' }
export interface LifeState {
  version: 1; style: PlayStyle; paused: boolean; settings: LifeSettings;
  inventory: Partial<Record<ItemId, number>>; coins: number; skills: Record<Skill, number>;
  residents: ResidentLife[]; quests: Record<string, QuestProgress>; discoveries: string[];
  animals: Record<string, AnimalLife>; regions: Record<string, { populated: boolean; lastVisit: number }>;
  containers: Record<string, Partial<Record<ItemId, number>>>;
  harvested: Record<string, number>; resourcesRemoved: string[]; defeated: string[];
  garden: Array<{ id: string; crop: 'apple' | 'herb' | 'flax'; position: Point; planted: number; harvested: number }>;
  stats: Record<string, number>; events: LifeEvent[]; nextEvent: number;
  equipment: { weapon: 'hand' | 'sword' | 'bow'; shield: boolean };
  waypoint?: { id: string; label: string; position: Point };
  interior?: InteriorState; riding?: string; seated?: string;
  homeName: string; comfort: number; mealUntil: number; restedUntil: number;
  dodgeUntil: number; dodgeCooldown: number; transport?: { kind: 'ferry'; start: Point; end: Point; started: number; duration: number };
  furnishingUndo: Array<{ before?: Furnishing; after?: Furnishing }>;
  archived: boolean; avatar: { name: string; kind: 'hobbit' | 'human'; female: boolean; colour: number };
  weather: { kind: 'clear' | 'cloudy' | 'rain' | 'mist' | 'snow'; nextChange: number };
  gates?: Record<string,boolean>;
}
export type LifeAction =
  | { kind: 'pause'; value: boolean }
  | { kind: 'settings'; values: Partial<LifeSettings> }
  | { kind: 'style'; style: PlayStyle }
  | { kind: 'avatar'; name: string; avatarKind: 'hobbit' | 'human'; female: boolean; colour: number }
  | { kind: 'talk' | 'gift'; id: string; item?: ItemId }
  | { kind: 'quest-accept' | 'quest-complete'; id: string }
  | { kind: 'gather'; id: string }
  | { kind: 'craft'; id: string; count?: number }
  | { kind: 'eat'; item: ItemId }
  | { kind: 'trade'; npc: string; item: ItemId; count: number; buying: boolean }
  | { kind: 'enter'; id: string }
  | { kind: 'exit' | 'dodge' | 'dismount' | 'ferry' | 'festival' | 'fish' | 'furniture-undo' | 'stand' }
  | { kind: 'service'; id: 'rest' | 'meal' | 'lesson' | 'news'; npc?: string }
  | { kind: 'equip'; weapon?: 'hand' | 'sword' | 'bow'; shield?: boolean }
  | { kind: 'animal-adopt' | 'animal-follow' | 'animal-home' | 'animal-product' | 'ride'; id: string }
  | { kind: 'animal-name'; id: string; name: string }
  | { kind: 'waypoint'; id?: string; label?: string; position?: Point }
  | { kind: 'home-name'; name: string }
  | { kind: 'blueprint'; id: 'starter-smial' | 'garden' | 'paddock' }
  | { kind: 'transfer'; chest: string; item: ItemId; count: number; withdraw: boolean }
  | { kind: 'move-furniture' | 'copy-furniture'; id: string; position: Point; yaw: number }
  | { kind: 'use-place'; id: string }
  | { kind: 'sit'; id: string }
  | { kind: 'plant-special'; crop: 'apple' | 'herb' | 'flax'; position: Point }
  | { kind: 'harvest-special'; id: string }
  | { kind: 'slot'; name?: string; archived?: boolean }
  | { kind: 'barrow-rune'; rune: 'leaf' | 'river' | 'star' }
  | { kind: 'gate' | 'landmark'; id: string }

export interface ResourceNode { id: string; kind: ItemId; label: string; position: Point; amount: number; renew: number; tree?: boolean }
export interface ItemDefinition { name: string; icon: string; value: number; description: string; food?: number; skill?: Skill }
export interface Recipe { id: string; name: string; input: Partial<Record<ItemId, number>>; output: ItemId; count: number; skill: Skill; level: number; station: 'any' | 'kitchen' | 'mill' | 'bench' | 'smithy' }
export interface QuestDefinition { id: string; name: string; description: string; town: string; role: Profession; previous?: string; goal: string; count: number; delivery?: Partial<Record<ItemId, number>>; reward: { coins: number; items?: Partial<Record<ItemId, number>>; skill: Skill; xp: number }; adventure?: boolean }
export interface LifePlace { id: string; label: string; kind: string; town: string; position: Point; door: Point; yaw: number; width: number; depth: number; public: boolean }
export interface FaunaSite { id: string; position: Point; species: Species[] }
