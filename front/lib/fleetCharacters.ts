/**
 * Fleet character roster for GrudgeBlox lobby / character select.
 * Same Railway SSOT as Mine-Loader. Blox / Mine / GRUDOX = voxel characters.
 */
import { FLEET, STORAGE, getAuthToken } from './fleetConfig'
import {
  kitRaceUrl,
  normalizeKitClass,
  normalizeKitRace,
  type KitClassId,
  type KitRaceId,
} from './fourCharacterKit'
import { characterListPathsForEra, rosterErasForWorld, VOXEL_ERA, type FleetEraId } from './characterEras'

const GUEST_SLOTS_KEY = 'grudge_blox_guest_slots'
const MAX_SLOTS = 4

export type FleetCharacter = {
  id: string
  name: string
  raceId?: string
  classId?: string
  level?: number
  gameEra?: string
  model3d?: string
}

const API_BASES = [
  // same-origin rewrite if deployed with fleet proxy
  '',
  FLEET.client,
  FLEET.warlords,
  FLEET.gameApi,
]

export function getStoredCharacterId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return (
      localStorage.getItem(STORAGE.characterId) ||
      localStorage.getItem(STORAGE.characterIdAlt) ||
      null
    )
  } catch {
    return null
  }
}

export function setStoredCharacterId(id: string) {
  try {
    localStorage.setItem(STORAGE.characterId, id)
    localStorage.setItem(STORAGE.characterIdAlt, id)
  } catch {
    /* private */
  }
}

function mapChar(c: Record<string, unknown>): FleetCharacter | null {
  const id = String(c.id || c.uuid || c.characterId || '')
  if (!id) return null
  const raceId = c.raceId ? String(c.raceId) : c.race ? String(c.race) : 'human'
  const classId = c.classId ? String(c.classId) : c.class ? String(c.class) : 'adventurer'
  const model3d = c.model3d
    ? String(c.model3d)
    : c.model_3d
      ? String(c.model_3d)
      : kitRaceUrl(raceId)
  return {
    id,
    name: String(c.name || c.displayName || 'Hero'),
    raceId,
    classId,
    level: typeof c.level === 'number' ? c.level : undefined,
    gameEra: c.gameEra ? String(c.gameEra) : c.game_era ? String(c.game_era) : undefined,
    model3d,
  }
}

async function fetchEra(base: string, era: string, token: string | null): Promise<FleetCharacter[]> {
  const paths = characterListPathsForEra(era as FleetEraId)
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  for (const path of paths) {
    const url = `${base.replace(/\/$/, '')}${path}`
    try {
      const r = await fetch(url, { headers, credentials: base ? 'omit' : 'include' })
      if (!r.ok) continue
      const data = await r.json()
      const list = Array.isArray(data) ? data : data.characters || data.items || []
      const mapped = list.map(mapChar).filter(Boolean) as FleetCharacter[]
      if (mapped.length) return mapped
    } catch {
      /* next path / base */
    }
  }
  return []
}

/**
 * Load roster for one world era. Voxel maps stay era=voxel (Mine-Loader law).
 */
export async function loadFleetRoster(worldEra: string = VOXEL_ERA): Promise<{
  characters: FleetCharacter[]
  status: 'ok' | 'guest' | 'unauthorized' | 'error'
}> {
  const token = getAuthToken()
  if (!token) {
    const guests = readGuestSlots()
    return {
      characters: guests.length ? guests : [guestExplorer()],
      status: 'guest',
    }
  }

  const eras = rosterErasForWorld(worldEra)
  const out: FleetCharacter[] = []
  const seen = new Set<string>()

  for (const base of API_BASES) {
    for (const era of eras) {
      const rows = await fetchEra(base, era, token)
      for (const c of rows) {
        if (seen.has(c.id)) continue
        seen.add(c.id)
        if (!c.gameEra) c.gameEra = era
        out.push(c)
      }
    }
    if (out.length) break
  }

  if (!out.length) {
    const guests = readGuestSlots()
    return {
      characters: guests.length ? guests : [guestExplorer()],
      status: token ? 'ok' : 'unauthorized',
    }
  }
  return { characters: out, status: 'ok' }
}

export function guestExplorer(): FleetCharacter {
  return {
    id: 'guest-explorer',
    name: 'Explorer',
    raceId: 'human',
    classId: 'adventurer',
    level: 1,
    gameEra: 'voxel',
    model3d: kitRaceUrl('human'),
  }
}

function readGuestSlots(): FleetCharacter[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(GUEST_SLOTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((c) => mapChar(c as Record<string, unknown>))
      .filter(Boolean) as FleetCharacter[]
  } catch {
    return []
  }
}

function writeGuestSlots(slots: FleetCharacter[]) {
  try {
    localStorage.setItem(GUEST_SLOTS_KEY, JSON.stringify(slots.slice(0, MAX_SLOTS)))
  } catch {
    /* private */
  }
}

export function loadGuestSlots(): FleetCharacter[] {
  return readGuestSlots()
}

export type CreateHeroInput = {
  name: string
  raceId: KitRaceId | string
  classId: KitClassId | string
  gameEra?: string
}

/**
 * Create a voxel-era hero. Signed-in → Railway /api/characters.
 * Guest → local 4-slot looks for this lobby only (not bag/roster SSOT).
 */
export async function createBloxHero(input: CreateHeroInput): Promise<{
  character: FleetCharacter
  stored: 'railway' | 'guest'
  error?: string
}> {
  const raceId = normalizeKitRace(input.raceId)
  const classId = normalizeKitClass(input.classId)
  const name = (input.name || 'Hero').trim().slice(0, 20) || 'Hero'
  const model3d = kitRaceUrl(raceId)
  const gameEra = (input.gameEra || VOXEL_ERA).toLowerCase()
  const token = getAuthToken()

  if (token) {
    const body = {
      name,
      raceId,
      classId,
      gameEra,
      model3d,
    }
    for (const base of API_BASES) {
      const url = `${base.replace(/\/$/, '')}/api/characters`
      if (!url.startsWith('http') && !base) {
        /* same-origin rewrite */
      }
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      }
      try {
        const r = await fetch(url || '/api/characters', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          credentials: base ? 'omit' : 'include',
        })
        if (!r.ok) continue
        const data = await r.json()
        const row = (data.character || data.item || data) as Record<string, unknown>
        const mapped = mapChar(row)
        if (mapped) {
          mapped.raceId = mapped.raceId || raceId
          mapped.classId = mapped.classId || classId
          mapped.model3d = mapped.model3d || model3d
          mapped.gameEra = mapped.gameEra || gameEra
          setStoredCharacterId(mapped.id)
          return { character: mapped, stored: 'railway' }
        }
      } catch {
        /* try next base */
      }
    }
  }

  const slots = readGuestSlots()
  if (slots.length >= MAX_SLOTS) {
    return {
      character: slots[0],
      stored: 'guest',
      error: 'Four guest looks already filled. Sign in to save on Railway.',
    }
  }
  const guest: FleetCharacter = {
    id: `guest-${Date.now().toString(36)}`,
    name,
    raceId,
    classId,
    level: 1,
    gameEra,
    model3d,
  }
  slots.push(guest)
  writeGuestSlots(slots)
  setStoredCharacterId(guest.id)
  return { character: guest, stored: 'guest' }
}
