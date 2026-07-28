/**
 * Fleet character roster for GrudgeBlox lobby / character select.
 * Same Railway SSOT as Mine-Loader / Warlords (era=voxel | warlords | nexus).
 */
import { FLEET, STORAGE, getAuthToken } from './fleetConfig'

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
  return {
    id,
    name: String(c.name || c.displayName || 'Hero'),
    raceId: c.raceId ? String(c.raceId) : c.race ? String(c.race) : undefined,
    classId: c.classId ? String(c.classId) : c.class ? String(c.class) : undefined,
    level: typeof c.level === 'number' ? c.level : undefined,
    gameEra: c.gameEra ? String(c.gameEra) : c.game_era ? String(c.game_era) : undefined,
    model3d: c.model3d ? String(c.model3d) : c.model_3d ? String(c.model_3d) : undefined,
  }
}

async function fetchEra(base: string, era: string, token: string | null): Promise<FleetCharacter[]> {
  const url = `${base.replace(/\/$/, '')}/api/characters?era=${encodeURIComponent(era)}`
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    const r = await fetch(url, { headers, credentials: base ? 'omit' : 'include' })
    if (!r.ok) return []
    const data = await r.json()
    const list = Array.isArray(data) ? data : data.characters || data.items || []
    return list.map(mapChar).filter(Boolean) as FleetCharacter[]
  } catch {
    return []
  }
}

/**
 * Load voxel + warlords + nexus rosters (Mine-Loader style multi-era lobby).
 */
export async function loadFleetRoster(): Promise<{
  characters: FleetCharacter[]
  status: 'ok' | 'guest' | 'unauthorized' | 'error'
}> {
  const token = getAuthToken()
  if (!token) {
    return { characters: [guestExplorer()], status: 'guest' }
  }

  const eras = ['voxel', 'warlords', 'nexus']
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
    // token present but empty / blocked
    return { characters: [guestExplorer()], status: token ? 'ok' : 'unauthorized' }
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
  }
}
