/**
 * Grudge Studio metaverse DNS + API SSOT for GrudgeBlox (Notblox fork).
 *
 * Play surface: blox.grudge-studio.com (or vercel alias)
 * Character SSOT: Railway via GrudgeBuilder / fleet game-data
 * Voxel peers: mine.grudge-studio.com · grudox.grudge-studio.com (GRUDOX = voxel)
 */

export const FLEET = {
  /** Public product host (metaverse DNS) */
  blox: 'https://blox.grudge-studio.com',
  /** Vercel production alias */
  bloxVercel: 'https://grudgeblox.vercel.app',
  /** Live Rapier/uWS room (Railway TLS on 443 — no :8001) */
  ws: 'wss://grudgeblox-production.up.railway.app',
  /** Optional custom WS host after Cloudflare grey-cloud CNAME */
  wsCustom: 'wss://blox-game.grudge-studio.com',
  /** Auth */
  id: 'https://id.grudge-studio.com',
  /** Characters / account (Builder Railway via any fleet SPA rewrite) */
  client: 'https://client.grudge-studio.com',
  warlords: 'https://grudgewarlords.com',
  /** Game data Railway (characters when SPA has no rewrite) */
  gameApi: 'https://grudge-api-production-0d46.up.railway.app',
  /** Assets CDN */
  assets: 'https://assets.grudge-studio.com',
  /** UI kit */
  ui: 'https://ui.grudge-studio.com',
  /** Voxel lobby / Mine-Loader */
  mine: 'https://mine.grudge-studio.com',
  mineLobby: 'https://mine.grudge-studio.com/#/lobby',
  minePlay: 'https://mine.grudge-studio.com/#/play',
  /** Creative Sandbox Voxel Studio (Mine-Loader monorepo artifact) */
  mineStudio: 'https://mine.grudge-studio.com/studio/',
  /** GRUDOX multiplayer hub */
  grudox: 'https://grudox.grudge-studio.com',
  /** Voxel Studio tool surface on GRUDOX (BASE_PATH=/studio/) */
  grudoxStudio: 'https://grudox.grudge-studio.com/studio/',
  /** Foundry create */
  foundry: 'https://character.grudge-studio.com',
  /** Production play lab (Warlords) */
  productionLab: 'https://client.grudge-studio.com/production',
} as const

export const GRUDGE6_CDN = {
  human: `${FLEET.assets}/models/grudge6/races/WK_Characters.glb`,
  barbarian: `${FLEET.assets}/models/grudge6/races/BRB_Characters.glb`,
  dwarf: `${FLEET.assets}/models/grudge6/races/DWF_Characters.glb`,
  elf: `${FLEET.assets}/models/grudge6/races/ELF_Characters.glb`,
  orc: `${FLEET.assets}/models/grudge6/races/ORC_Characters.glb`,
  undead: `${FLEET.assets}/models/grudge6/races/UD_Characters.glb`,
} as const

export type RaceKey = keyof typeof GRUDGE6_CDN

export function raceCdnUrl(raceId?: string): string {
  const k = normalizeRace(raceId)
  return GRUDGE6_CDN[k] || GRUDGE6_CDN.human
}

export function normalizeRace(raceId?: string): RaceKey {
  const r = (raceId || 'human').toLowerCase()
  if (r.includes('barb') || r === 'brb') return 'barbarian'
  if (r.includes('dwarf') || r === 'dwf') return 'dwarf'
  if (r.includes('elf')) return 'elf'
  if (r.includes('orc')) return 'orc'
  if (r.includes('undead') || r === 'ud') return 'undead'
  return 'human'
}

/** Storage keys — align with fleet */
export const STORAGE = {
  playerName: 'grudge_blox_player_name',
  characterId: 'grudge_active_character',
  characterIdAlt: 'grudge.activeCharId',
  token: 'grudge_auth_token',
  tokenAlt: 'grudge.token',
  era: 'grudge_blox_era',
} as const

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return (
      localStorage.getItem(STORAGE.token) ||
      localStorage.getItem(STORAGE.tokenAlt) ||
      localStorage.getItem('grudge_session_token') ||
      null
    )
  } catch {
    return null
  }
}

export function buildLoginUrl(returnPath = '/play/test'): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : FLEET.blox
  const redirect = encodeURIComponent(`${origin}${returnPath}`)
  return `${FLEET.id}/login?redirect_uri=${redirect}`
}

export function buildFoundryCreateUrl(
  returnPath = '/play/test',
  era = 'voxel',
): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : FLEET.blox
  const returnTo = encodeURIComponent(`${origin}${returnPath}`)
  const e = (era || 'voxel').toLowerCase()
  return `${FLEET.foundry}/foundry?era=${encodeURIComponent(e)}&mode=create&returnTo=${returnTo}`
}
