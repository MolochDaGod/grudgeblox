/**
 * 4character pack — GrudgeBlox play kit (unzipped from D:\Games\Models\4character.zip).
 * Same-origin /kit/4character/* served by the SPA. Mixamo races, not Warlords Toon loadRaceKit.
 */
export const KIT_BASE = '/kit/4character'

export const KIT_RACES = [
  { id: 'human', label: 'Human', glb: 'races/human.glb' },
  { id: 'barbarian', label: 'Barbarian', glb: 'races/barbarian.glb' },
  { id: 'dwarf', label: 'Dwarf', glb: 'races/dwarf.glb' },
  { id: 'high_elf', label: 'High Elf', glb: 'races/high_elf.glb' },
  { id: 'orc', label: 'Orc', glb: 'races/orc.glb' },
  { id: 'undead', label: 'Undead', glb: 'races/undead.glb' },
] as const

export type KitRaceId = (typeof KIT_RACES)[number]['id']

export const KIT_CLASSES = [
  { id: 'warrior', label: 'Warrior', weapon: 'sword', fx: 'slash' },
  { id: 'ranger', label: 'Ranger', weapon: 'bow', fx: 'orb' },
  { id: 'mage', label: 'Mage', weapon: 'staff', fx: 'bolt' },
  { id: 'adventurer', label: 'Adventurer', weapon: 'dagger', fx: 'slash' },
] as const

export type KitClassId = (typeof KIT_CLASSES)[number]['id']

export const KIT_VFX = {
  slash: 'vfx/light-of-slash.glb',
  slashes: 'vfx/attack-slashes.glb',
  bolt: 'vfx/lightning.glb',
  orb: 'vfx/explosive-orb.glb',
  warn: 'vfx/aoe-warning.glb',
  ring: 'vfx/ring-red.glb',
} as const

export type KitFxId = keyof typeof KIT_VFX

const RACE_IDS = new Set<string>(KIT_RACES.map((r) => r.id))
const CLASS_IDS = new Set<string>(KIT_CLASSES.map((c) => c.id))

export function normalizeKitRace(raceId?: string): KitRaceId {
  const r = (raceId || 'human').toLowerCase().replace(/[\s-]+/g, '_')
  if (r.includes('barb') || r === 'brb') return 'barbarian'
  if (r.includes('dwarf') || r === 'dwf') return 'dwarf'
  if (r.includes('elf')) return 'high_elf'
  if (r.includes('orc')) return 'orc'
  if (r.includes('undead') || r === 'ud') return 'undead'
  if (RACE_IDS.has(r)) return r as KitRaceId
  return 'human'
}

export function normalizeKitClass(classId?: string): KitClassId {
  const c = (classId || 'adventurer').toLowerCase()
  if (c.includes('war') || c.includes('sword') || c === 'fighter') return 'warrior'
  if (c.includes('range') || c.includes('bow') || c.includes('hunt')) return 'ranger'
  if (c.includes('mage') || c.includes('magic') || c.includes('wiz') || c.includes('staff'))
    return 'mage'
  if (CLASS_IDS.has(c)) return c as KitClassId
  return 'adventurer'
}

export function kitRaceUrl(raceId?: string): string {
  const race = KIT_RACES.find((r) => r.id === normalizeKitRace(raceId)) || KIT_RACES[0]
  return `${KIT_BASE}/${race.glb}`
}

export function kitModelKey(raceId?: string): string {
  const race = KIT_RACES.find((r) => r.id === normalizeKitRace(raceId)) || KIT_RACES[0]
  return race.glb
}

export function kitWeaponUrl(classId?: string): string {
  const cls = KIT_CLASSES.find((c) => c.id === normalizeKitClass(classId)) || KIT_CLASSES[3]
  return `${KIT_BASE}/weapons/${cls.weapon}.glb`
}

export function kitVfxUrl(fxId?: string): string {
  const key = (fxId || 'slash') as KitFxId
  const path = KIT_VFX[key] || KIT_VFX.slash
  return `${KIT_BASE}/${path}`
}

export function fxForClass(classId?: string): KitFxId {
  const cls = KIT_CLASSES.find((c) => c.id === normalizeKitClass(classId)) || KIT_CLASSES[3]
  return cls.fx
}

export function fxForSkillStyle(style?: string, projectile?: boolean): KitFxId {
  if (style === 'magic') return 'bolt'
  if (style === 'ranged' || projectile) return 'orb'
  return 'slash'
}

export function isKitUrl(url?: string): boolean {
  return !!url && (url.includes('/kit/4character/') || url.startsWith('races/'))
}

/** Map Notblox SerializedStateType → 4character race GLB clip names. */
export function clipNameForState(state: string): string[] {
  const s = (state || 'Idle').toLowerCase()
  if (s === 'idle') return ['idle', 'gs_idle', 'crouch_idle']
  if (s === 'walk') return ['walk', 'gs_walk', 'strafe_left_walk']
  if (s === 'run') return ['run', 'sprint', 'gs_run']
  if (s === 'jump') return ['jump', 'front_flip']
  if (s === 'fall') return ['jump', 'aerial_evade', 'front_flip']
  if (s === 'death') return ['dodge', 'idle']
  return [s, 'idle']
}

export function clipNameForAttack(classId?: string): string[] {
  const c = normalizeKitClass(classId)
  if (c === 'warrior') return ['sword_attack_a', 'attack', 'sword_combo_finisher']
  if (c === 'ranger') return ['attack', 'sword_attack_a']
  if (c === 'mage') return ['attack', 'unarmed_uppercut']
  return ['attack', 'unarmed_uppercut', 'sword_attack_a']
}

export function findClip(
  clips: { name: string }[],
  wanted: string[],
): { name: string } | undefined {
  const lower = clips.map((c) => ({ clip: c, n: c.name.toLowerCase() }))
  for (const w of wanted) {
    const exact = lower.find((c) => c.n === w.toLowerCase())
    if (exact) return exact.clip
  }
  for (const w of wanted) {
    const part = lower.find((c) => c.n.includes(w.toLowerCase()))
    if (part) return part.clip
  }
  return clips[0]
}

export function avatarAppearanceSig(input: {
  raceId?: string
  classId?: string
  model3d?: string
  id?: string
  characterId?: string
}): string {
  const race = normalizeKitRace(input.raceId)
  const klass = normalizeKitClass(input.classId)
  const model = sanitizeKitModel3d(input.model3d, race)
  const id = input.characterId || input.id || ''
  return `${race}|${klass}|${model}|${id}`
}

export function sanitizeKitModel3d(raw?: string, raceId?: string): string {
  if (!raw) return kitModelKey(raceId)
  const cleaned = raw.trim().replace(/\\/g, '/')
  const m = cleaned.match(/races\/(human|barbarian|dwarf|high_elf|orc|undead)\.glb$/i)
  if (m) return `races/${m[1].toLowerCase()}.glb`
  return kitModelKey(raceId)
}
