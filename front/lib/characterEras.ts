/**
 * Multi-era character policy for GrudgeBlox — same fleet SSOT as Mine-Loader.
 * One account · 4 slots per era · Railway `/api/characters?era=`.
 * Sandbox worlds union every era so Warlords, Voxel, Nexus, Armada, and Game
 * heroes can play on the same island.
 * @see Mine-Loader docs/CHARACTER_ERAS.md
 */

export type FleetEraId = 'warlords' | 'voxel' | 'nexus' | 'armada' | 'game'

export type EraCharacterPolicy = {
  id: FleetEraId
  label: string
  slotCount: number
  apiEra: FleetEraId
  shareFrom: FleetEraId[]
  createPath: string
  playHosts: string[]
}

export const CHARACTER_ERA_POLICIES: Record<FleetEraId, EraCharacterPolicy> = {
  voxel: {
    id: 'voxel',
    label: 'Voxel / Realms',
    slotCount: 4,
    apiEra: 'voxel',
    shareFrom: ['voxel'],
    createPath: '/foundry?era=voxel&mode=create',
    playHosts: [
      'https://blox.grudge-studio.com',
      'https://grudgeblox.vercel.app',
      'https://mine.grudge-studio.com',
      'https://mineloader.grudge-studio.com',
      'https://grudox.grudge-studio.com',
    ],
  },
  warlords: {
    id: 'warlords',
    label: 'Warlords',
    slotCount: 4,
    apiEra: 'warlords',
    shareFrom: ['warlords'],
    createPath: '/foundry?era=warlords&mode=create',
    playHosts: ['https://grudgewarlords.com', 'https://client.grudge-studio.com'],
  },
  nexus: {
    id: 'nexus',
    label: 'Nexus',
    slotCount: 4,
    apiEra: 'nexus',
    shareFrom: ['nexus'],
    createPath: '/foundry?era=nexus&mode=create',
    playHosts: ['https://open.grudge-studio.com'],
  },
  armada: {
    id: 'armada',
    label: 'Armada',
    slotCount: 4,
    apiEra: 'armada',
    shareFrom: ['armada'],
    createPath: '/foundry?era=armada&mode=create',
    playHosts: ['https://open.grudge-studio.com'],
  },
  game: {
    id: 'game',
    label: 'Game',
    slotCount: 4,
    apiEra: 'game',
    shareFrom: ['game'],
    createPath: '/foundry?era=game&mode=create',
    playHosts: ['https://open.grudge-studio.com'],
  },
}

export const VOXEL_ERA: FleetEraId = 'voxel'
export const APP_CHARACTER_SYSTEM: FleetEraId = 'voxel'
export const ALL_FLEET_ERAS: FleetEraId[] = ['voxel', 'warlords', 'nexus', 'armada', 'game']

export type EraGeneration = {
  id: FleetEraId
  generation: number
  label: string
  tagline: string
  blurb: string
  playSlug: string
  accent: string
}

/** Ordered generations of era — every generation plays the Super Terrain islands. */
export const ERA_GENERATIONS: EraGeneration[] = [
  {
    id: 'voxel',
    generation: 1,
    label: 'Voxel / Realms',
    tagline: 'First generation',
    blurb: 'Mine-Loader Realms kits. Four slots. Mixamo races land on Harbor Atoll and every later island.',
    playSlug: 'island-harbor-atoll',
    accent: '#38bdf8',
  },
  {
    id: 'warlords',
    generation: 2,
    label: 'Warlords',
    tagline: 'Second generation',
    blurb: 'grudge6 production heroes. Same account, four Warlords slots, Volcanic Ridge as the home island.',
    playSlug: 'island-volcanic-ridge',
    accent: '#f59e0b',
  },
  {
    id: 'nexus',
    generation: 3,
    label: 'Nexus',
    tagline: 'Third generation',
    blurb: 'Open-studio Nexus characters. Alpine Mesh is the Super Terrain high-relief home world.',
    playSlug: 'island-alpine-mesh',
    accent: '#a78bfa',
  },
  {
    id: 'armada',
    generation: 4,
    label: 'Armada',
    tagline: 'Fourth generation',
    blurb: 'Fleet Armada captains. Spline Forest grows Super Terrain stands around the landing.',
    playSlug: 'island-spline-forest',
    accent: '#34d399',
  },
  {
    id: 'game',
    generation: 5,
    label: 'Game',
    tagline: 'Fifth generation',
    blurb: 'Game-era heroes. Granite CSG outcrops from the Super Terrain rock lab.',
    playSlug: 'island-granite-csg',
    accent: '#fb7185',
  },
]

export function eraGeneration(id?: string): EraGeneration {
  const key = (id || VOXEL_ERA).toLowerCase()
  return ERA_GENERATIONS.find((era) => era.id === key) || ERA_GENERATIONS[0]
}

export type RosterMode = 'world-era' | 'all-eras'

export function isFleetEra(id: string): id is FleetEraId {
  return id === 'warlords' || id === 'voxel' || id === 'nexus' || id === 'armada' || id === 'game'
}

export function getEraPolicy(id?: string): EraCharacterPolicy {
  const key = (id || VOXEL_ERA).toLowerCase()
  if (isFleetEra(key)) return CHARACTER_ERA_POLICIES[key]
  return CHARACTER_ERA_POLICIES.voxel
}

/**
 * Sandbox worlds (`rosterMode=all-eras`) load every fleet era.
 * Dedicated worlds still use that world's shareFrom list.
 */
export function rosterErasForWorld(era?: string, rosterMode?: RosterMode | string): FleetEraId[] {
  if (rosterMode === 'all-eras') return [...ALL_FLEET_ERAS]
  const key = (era || VOXEL_ERA).toLowerCase()
  if (key === 'all' || key === 'sandbox') return [...ALL_FLEET_ERAS]
  return getEraPolicy(era).shareFrom
}

export function characterListPathsForEra(era: FleetEraId): string[] {
  return [
    `/api/characters?era=${encodeURIComponent(era)}`,
    `/api/characters?gameEra=${encodeURIComponent(era)}`,
  ]
}
