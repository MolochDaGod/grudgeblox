/**
 * Live multiplayer sandbox rooms — one WebSocket process per room.
 *
 * Super Terrain islands, Island Engine maps, and GrudgeBlox worlds each get a
 * compose/Railway service. The Next lobby sections (Eras / Islands / Maps)
 * deep-link into these rooms.
 */
import { ISLAND_CATALOG, islandPlaySlug, type IslandKind } from './islandBake.js'

export const SUPER_TERRAIN_GITHUB = 'https://github.com/vibe-stack/super-terrain'

export type LobbySectionId = 'eras' | 'islands' | 'maps'

export type SandboxRoom = {
  slug: string
  title: string
  section: Exclude<LobbySectionId, 'eras'>
  script: string
  islandMap?: IslandKind | string
  port: number
  composeService: string
  description: string
  /** Optional dedicated WSS host after a per-room Railway/VPS deploy. */
  websocketUrl?: string
}

export const MAP_ROOMS: SandboxRoom[] = [
  {
    slug: 'test',
    title: 'GrudgeBlox Test World',
    section: 'maps',
    script: 'gtaLobbyScript.ts',
    port: 8001,
    composeService: 'game_test_world',
    description: 'All-era sandbox lobby — cars, districts, weapon skills.',
  },
  {
    slug: 'combat',
    title: 'Combat Arena',
    section: 'maps',
    script: 'parkourScript.ts',
    port: 8002,
    composeService: 'game_combat_arena',
    description: 'Weapon-skill sandbox. Every fleet era can enter.',
  },
  {
    slug: 'lobby',
    title: 'Voxel Lobby Bridge',
    section: 'maps',
    script: 'gtaLobbyScript.ts',
    port: 8003,
    composeService: 'game_lobby_bridge',
    description: 'All-era handoff toward Mine-Loader and GRUDOX.',
  },
  {
    slug: 'grudox',
    title: 'GRUDOX Sandbox',
    section: 'maps',
    script: 'gtaLobbyScript.ts',
    port: 8004,
    composeService: 'game_grudox_sandbox',
    description: 'GRUDOX sandbox room — same physics, era meshes.',
  },
  {
    slug: 'streets',
    title: 'Dope Budz Streets',
    section: 'maps',
    script: 'dopebudzStreets.ts',
    port: 8005,
    composeService: 'game_dopebudz_streets',
    description: 'Six-district live Streets sandbox.',
  },
]

const ISLAND_PORTS: Record<string, number> = {
  'harbor-atoll': 8006,
  'volcanic-ridge': 8007,
  'frozen-fjord': 8008,
  'alpine-mesh': 8009,
  'granite-csg': 8010,
  'spline-forest': 8011,
  'tunnel-cavern': 8012,
}

export const ISLAND_ROOMS: SandboxRoom[] = ISLAND_CATALOG.map((entry) => ({
  slug: islandPlaySlug(entry.id),
  title: entry.title,
  section: 'islands' as const,
  script: 'islandSandboxScript.ts',
  islandMap: entry.id,
  port: ISLAND_PORTS[entry.id] ?? 8006,
  composeService: `game_island_${entry.id.replace(/-/g, '_')}`,
  description: entry.description,
}))

/** Same live room as Harbor Atoll — keeps /play/island working. */
export const ISLAND_HUB_ROOM: SandboxRoom = {
  ...ISLAND_ROOMS[0],
  slug: 'island',
  title: 'Island Sandbox',
  composeService: ISLAND_ROOMS[0].composeService,
}

export const SANDBOX_ROOMS: SandboxRoom[] = [...MAP_ROOMS, ISLAND_HUB_ROOM, ...ISLAND_ROOMS]

export function roomForSlug(slug: string): SandboxRoom | undefined {
  return SANDBOX_ROOMS.find((room) => room.slug === slug)
}

export function roomsForSection(section: Exclude<LobbySectionId, 'eras'>): SandboxRoom[] {
  if (section === 'islands') return ISLAND_ROOMS
  return MAP_ROOMS
}
