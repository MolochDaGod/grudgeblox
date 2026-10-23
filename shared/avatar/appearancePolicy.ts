/**
 * Multi-era avatar appearance for sandbox worlds.
 * Kit Mixamo races stay valid; Warlords / Nexus / Armada / Game CDN models
 * are allowed when they point at studio hosts.
 */

export const FLEET_ERAS = ['voxel', 'warlords', 'nexus', 'armada', 'game'] as const
export type FleetEraId = (typeof FLEET_ERAS)[number]

export const KIT_RACES = ['human', 'barbarian', 'dwarf', 'high_elf', 'orc', 'undead'] as const
export const KIT_CLASSES = ['warrior', 'ranger', 'mage', 'adventurer'] as const

const AVATAR_HOSTS = new Set([
  'assets.grudge-studio.com',
  'cdn.grudge-studio.com',
  'ui.grudge-studio.com',
  'client.grudge-studio.com',
  'grudgewarlords.com',
  'www.grudgewarlords.com',
  'mine.grudge-studio.com',
  'grudox.grudge-studio.com',
  'blox.grudge-studio.com',
  'character.grudge-studio.com',
  'open.grudge-studio.com',
])

export function isFleetEraId(id?: string): id is FleetEraId {
  return !!id && (FLEET_ERAS as readonly string[]).includes(id.toLowerCase())
}

export function sanitizeGameEra(raw?: string): FleetEraId {
  const key = (raw || 'voxel').toLowerCase().trim()
  return isFleetEraId(key) ? key : 'voxel'
}

export function normalizeKitRace(raceId?: string): (typeof KIT_RACES)[number] {
  const r = (raceId || 'human').toLowerCase().replace(/[\s-]+/g, '_')
  if (r.includes('barb') || r === 'brb') return 'barbarian'
  if (r.includes('dwarf') || r === 'dwf') return 'dwarf'
  if (r.includes('elf')) return 'high_elf'
  if (r.includes('orc')) return 'orc'
  if (r.includes('undead') || r === 'ud') return 'undead'
  if ((KIT_RACES as readonly string[]).includes(r)) return r as (typeof KIT_RACES)[number]
  return 'human'
}

export function sanitizeRaceId(raw?: string): string {
  const value = (raw || '').toLowerCase().trim()
  if (!value) return 'human'
  const kit = normalizeKitRace(value)
  if (
    value.includes('barb') ||
    value.includes('dwarf') ||
    value.includes('elf') ||
    value.includes('orc') ||
    value.includes('undead') ||
    value.includes('human') ||
    value === 'wk' ||
    (KIT_RACES as readonly string[]).includes(value)
  ) {
    return kit
  }
  if (/^[a-z0-9_-]{1,32}$/.test(value)) return value
  return kit
}

export function sanitizeClassId(raw?: string): string {
  const c = (raw || '').toLowerCase().trim()
  if (!c) return 'adventurer'
  if (c.includes('war') || c.includes('sword') || c === 'fighter') return 'warrior'
  if (c.includes('range') || c.includes('bow') || c.includes('hunt')) return 'ranger'
  if (c.includes('mage') || c.includes('magic') || c.includes('wiz') || c.includes('staff'))
    return 'mage'
  if (c.includes('advent')) return 'adventurer'
  if ((KIT_CLASSES as readonly string[]).includes(c)) return c
  if (/^[a-z0-9_-]{1,32}$/.test(c)) return c
  return 'adventurer'
}

export function sanitizeCharacterId(raw?: string): string {
  return (raw || '').trim().replace(/[^\w-]/g, '').substring(0, 64)
}

export function isAllowedAvatarUrl(url: string): boolean {
  const cleaned = url.trim()
  if (!cleaned) return false
  if (cleaned.startsWith('/kit/')) return true
  if (cleaned.startsWith('races/') && cleaned.endsWith('.glb')) return true
  if (!/^https:\/\//i.test(cleaned)) return false
  try {
    const parsed = new URL(cleaned)
    if (parsed.protocol !== 'https:') return false
    if (parsed.username || parsed.password) return false
    return AVATAR_HOSTS.has(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}

export function kitModelKey(raceId?: string): string {
  return `races/${normalizeKitRace(raceId)}.glb`
}

export function sanitizeModel3d(raw?: string, raceId?: string): string {
  if (!raw) return kitModelKey(raceId)
  const cleaned = raw.trim().replace(/\\/g, '/')
  if (cleaned.length > 256) return kitModelKey(raceId)
  const kitMatch = cleaned.match(/races\/(human|barbarian|dwarf|high_elf|orc|undead)\.glb$/i)
  if (kitMatch) return `races/${kitMatch[1].toLowerCase()}.glb`
  if (isAllowedAvatarUrl(cleaned)) return cleaned
  return kitModelKey(raceId)
}

export function serverMeshPathForModel(model3d: string): string {
  if (model3d.startsWith('races/')) return `/kit/4character/${model3d}`
  return model3d
}

export type AppearanceInput = {
  raceId?: string
  classId?: string
  characterId?: string
  model3d?: string
  gameEra?: string
}

export type SanitizedAppearance = {
  raceId: string
  classId: string
  characterId: string
  model3d: string
  gameEra: FleetEraId
  serverMeshPath: string
}

export function sanitizeAppearance(input: AppearanceInput): SanitizedAppearance {
  const raceId = sanitizeRaceId(input.raceId)
  const classId = sanitizeClassId(input.classId)
  const characterId = sanitizeCharacterId(input.characterId)
  const gameEra = sanitizeGameEra(input.gameEra)
  const model3d = sanitizeModel3d(input.model3d, raceId)
  return {
    raceId,
    classId,
    characterId,
    model3d,
    gameEra,
    serverMeshPath: serverMeshPathForModel(model3d),
  }
}
