/**
 * Mine-Loader Codex + voxel asset URLs for GrudgeBlox.
 * Catalog/defs stay on Mine-Loader; this SPA ships portraits + UI icons
 * and resolves the rest from the live Codex host.
 */
import { FLEET } from './fleetConfig'
import { normalizeKitRace } from './fourCharacterKit'

export const CODEX = {
  host: FLEET.mine,
  defs: `${FLEET.mine}/#/defs`,
  lobby: FLEET.mineLobby,
  play: FLEET.minePlay,
  studio: FLEET.mineStudio,
  portraits: '/assets/models/avatarbaseraces',
  portraitsEdge: `${FLEET.mine}/assets/models/avatarbaseraces`,
  uiIcons: '/assets/ui-icons',
  uiIconsEdge: `${FLEET.mine}/assets/ui-icons`,
  tvsRoster: `${FLEET.assets}/models/voxels/tvs/unit-roster.json`,
  raceDefaults: '/assets/models/avatarbaseraces/voxel-race-defaults.json',
} as const

/** Codex / mine-loader icons for Danger Room skill ids (no emoji chrome). */
export const CODEX_SKILL_ICONS: Record<string, string> = {
  slash: 'attack',
  guard: 'defend',
  bolt: 'aoe-blast',
  shot: 'projectile-launcher',
  smash: 'charge',
  harvest: 'harvest',
  dodge: 'ambush',
  dash: 'charge',
}

export function voxelPortraitUrl(raceId?: string): string {
  const race = normalizeKitRace(raceId)
  const file = race === 'high_elf' ? 'elf' : race
  return `${CODEX.portraits}/${file}-portrait.png`
}

export function codexIconUrl(skillId?: string): string {
  const key = CODEX_SKILL_ICONS[(skillId || '').toLowerCase()] || 'skill-slot'
  return `${CODEX.uiIcons}/${key}.png`
}

export type CodexSystemsSnapshot = {
  ok: boolean
  races: number
  tvsUnits: number
  source: 'local' | 'edge' | 'none'
}

export async function probeCodexSystems(): Promise<CodexSystemsSnapshot> {
  let races = 0
  let tvsUnits = 0
  let source: CodexSystemsSnapshot['source'] = 'none'

  try {
    const local = await fetch(CODEX.raceDefaults, { cache: 'force-cache' })
    if (local.ok) {
      const data = await local.json()
      races = Array.isArray(data.races) ? data.races.length : 0
      source = 'local'
    }
  } catch {
    /* fall through */
  }

  if (!races) {
    try {
      const edge = await fetch(`${CODEX.portraitsEdge}/voxel-race-defaults.json`)
      if (edge.ok) {
        const data = await edge.json()
        races = Array.isArray(data.races) ? data.races.length : 0
        source = 'edge'
      }
    } catch {
      /* offline */
    }
  }

  try {
    const tvs = await fetch(CODEX.tvsRoster)
    if (tvs.ok) {
      const data = await tvs.json()
      const list = Array.isArray(data) ? data : data.units || data.items || []
      tvsUnits = list.length
    }
  } catch {
    /* optional CDN */
  }

  return { ok: races > 0, races, tvsUnits, source }
}
