/**
 * Interchange format for Island Terrain World Engine → GrudgeBlox baked maps.
 *
 * The Windows engine at
 * `C:\Users\nugye\Documents\Island-Terrain-World-Engine2\Island-Terrain-World-Engine`
 * should export `grudge-island-bake/v1` JSON (see docs/ISLAND_SANDBOX.md).
 * Super Terrain (https://github.com/vibe-stack/super-terrain) Godot/source
 * exports are coerced through `superTerrainBake.ts` into this same schema.
 * GrudgeBlox also generates deterministic bakes from the same schema when the
 * engine folder is not mounted.
 */

export const ISLAND_BAKE_FORMAT = 'grudge-island-bake/v1' as const

export const ISLAND_BIOMES = [
  'ocean',
  'shore',
  'sand',
  'grass',
  'forest',
  'rock',
  'snow',
  'lava',
] as const

export type IslandBiomeId = (typeof ISLAND_BIOMES)[number]

export const ISLAND_KINDS = [
  'harbor-atoll',
  'volcanic-ridge',
  'frozen-fjord',
  'alpine-mesh',
  'granite-csg',
  'spline-forest',
  'tunnel-cavern',
] as const

export type IslandKind = (typeof ISLAND_KINDS)[number]

export type IslandTerrainSource = 'island-engine' | 'super-terrain'

export type IslandSpawn = {
  x: number
  y: number
  z: number
  label?: string
}

export type IslandPoi = {
  kind: string
  x: number
  y: number
  z: number
  label?: string
  color?: string
}

export type IslandBake = {
  format: typeof ISLAND_BAKE_FORMAT
  engine: string
  id: IslandKind | string
  title: string
  seed: number
  /** Vertex count per side (heights length must be size*size). */
  size: number
  /** World meters between adjacent vertices. */
  cellSize: number
  /** 0–1 of maxHeight used as the visual water plane. */
  seaLevel: number
  /** World Y of the highest height sample. */
  maxHeight: number
  /** Quantized 0–255 height samples, row-major (z major, then x). */
  heights: number[]
  /** Biome index per vertex, same order as heights. */
  biomes: number[]
  spawns: IslandSpawn[]
  pois: IslandPoi[]
}

export type IslandCatalogEntry = {
  id: IslandKind
  title: string
  seed: number
  kind: IslandKind
  description: string
  source: IslandTerrainSource
}

export const ISLAND_CATALOG: IslandCatalogEntry[] = [
  {
    id: 'harbor-atoll',
    title: 'Harbor Atoll',
    seed: 1847291,
    kind: 'harbor-atoll',
    source: 'island-engine',
    description: 'Tropical lagoon, sandy beaches, and a low green ridge.',
  },
  {
    id: 'volcanic-ridge',
    title: 'Volcanic Ridge',
    seed: 9021744,
    kind: 'volcanic-ridge',
    source: 'island-engine',
    description: 'Steep basalt spine, lava rock, and a high lookout.',
  },
  {
    id: 'frozen-fjord',
    title: 'Frozen Fjord',
    seed: 4410088,
    kind: 'frozen-fjord',
    source: 'island-engine',
    description: 'Deep inlet, snow terraces, and an ice-cut landing.',
  },
  {
    id: 'alpine-mesh',
    title: 'Alpine Mesh',
    seed: 4000128,
    kind: 'alpine-mesh',
    source: 'super-terrain',
    description:
      'Super Terrain alpine climate: high relief, a valley floor in front, snow terraces.',
  },
  {
    id: 'granite-csg',
    title: 'Granite CSG',
    seed: 7712390,
    kind: 'granite-csg',
    source: 'super-terrain',
    description: 'Fractured granite from the Super Terrain rock lab — steep CSG outcrops.',
  },
  {
    id: 'spline-forest',
    title: 'Spline Forest',
    seed: 2288144,
    kind: 'spline-forest',
    source: 'super-terrain',
    description: 'Forest fields grown from Super Terrain splines, needle duff fading into hillside.',
  },
  {
    id: 'tunnel-cavern',
    title: 'Tunnel Cavern',
    seed: 6155002,
    kind: 'tunnel-cavern',
    source: 'super-terrain',
    description: 'Cave mouth and tunnel sink — Super Terrain interiors flattened to a playable heightfield.',
  },
]

export function isIslandKind(id: string): id is IslandKind {
  return (ISLAND_KINDS as readonly string[]).includes(id)
}

export function islandPlaySlug(id: string): string {
  return `island-${id}`
}

export function islandMeshUrl(id: string): string {
  return `island:${id}`
}

export function parseIslandMeshUrl(url: string): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (trimmed.startsWith('island:')) return trimmed.slice('island:'.length)
  const json = trimmed.match(/\/maps\/islands\/([a-z0-9-]+)\.json$/i)
  if (json) return json[1]
  return null
}

export function isIslandMeshUrl(url?: string): boolean {
  return !!url && parseIslandMeshUrl(url) !== null
}

export function worldSizeMeters(bake: Pick<IslandBake, 'size' | 'cellSize'>): number {
  return Math.max(1, bake.size - 1) * bake.cellSize
}

export function heightAt(bake: IslandBake, index: number): number {
  const q = bake.heights[index] ?? 0
  return (q / 255) * bake.maxHeight
}

export function vertexWorldPosition(
  bake: IslandBake,
  ix: number,
  iz: number
): { x: number; y: number; z: number } {
  const extent = worldSizeMeters(bake)
  const x = (ix / Math.max(1, bake.size - 1) - 0.5) * extent
  const z = (iz / Math.max(1, bake.size - 1) - 0.5) * extent
  const y = heightAt(bake, iz * bake.size + ix)
  return { x, y, z }
}

function asFiniteNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function flattenHeightField(raw: unknown, size: number): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  if (Array.isArray(raw[0])) {
    const out: number[] = []
    for (const row of raw) {
      if (!Array.isArray(row)) return null
      for (const cell of row) out.push(asFiniteNumber(cell, 0))
    }
    return out.length === size * size ? out : null
  }
  if (raw.length === size * size) {
    return raw.map((cell) => asFiniteNumber(cell, 0))
  }
  return null
}

function quantizeHeights(values: number[], maxHeight: number): number[] {
  const peak = values.reduce((m, v) => Math.max(m, v), 0) || 1
  const scale = peak > 1.5 ? 1 / peak : maxHeight > 0 ? 1 / maxHeight : 1
  return values.map((v) => {
    const unit = Math.min(1, Math.max(0, v * scale))
    return Math.round(unit * 255)
  })
}

function biomeIndex(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(ISLAND_BIOMES.length - 1, Math.round(value)))
  }
  if (typeof value === 'string') {
    const i = ISLAND_BIOMES.indexOf(value.toLowerCase() as IslandBiomeId)
    return i >= 0 ? i : 3
  }
  return 3
}

/**
 * Accept the canonical bake plus a few engine-native shapes
 * (nested heightmap, terrain.heights, width/height grids).
 */
export function coerceEngineBake(raw: unknown, fallbackId = 'harbor-atoll'): IslandBake | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const nested =
    rec.bake && typeof rec.bake === 'object'
      ? (rec.bake as Record<string, unknown>)
      : rec.terrain && typeof rec.terrain === 'object'
        ? (rec.terrain as Record<string, unknown>)
        : rec
  const size = Math.max(
    2,
    Math.min(
      256,
      Math.round(
        asFiniteNumber(
          nested.size ?? nested.resolution ?? nested.width ?? nested.height,
          64
        )
      )
    )
  )
  const heightSource =
    nested.heights ?? nested.heightmap ?? nested.heightMap ?? nested.elevation
  const flat = flattenHeightField(heightSource, size)
  const cellSize = asFiniteNumber(nested.cellSize ?? nested.cell_size ?? nested.scale, 4)
  const maxHeight = asFiniteNumber(nested.maxHeight ?? nested.max_height ?? nested.peak, 28)
  const seaLevel = Math.min(
    0.9,
    Math.max(0.02, asFiniteNumber(nested.seaLevel ?? nested.sea_level, 0.2))
  )
  const heights = flat
    ? flat.every((v) => v >= 0 && v <= 255 && Number.isInteger(v))
      ? flat
      : quantizeHeights(flat, maxHeight)
    : null
  if (!heights) return null

  const biomeSource = nested.biomes ?? nested.biome ?? nested.splat
  let biomes: number[]
  if (Array.isArray(biomeSource) && biomeSource.length === size * size) {
    biomes = biomeSource.map(biomeIndex)
  } else {
    biomes = heights.map((h) => {
      const t = h / 255
      if (t < seaLevel) return 0
      if (t < seaLevel + 0.04) return 1
      if (t < seaLevel + 0.1) return 2
      if (t < 0.45) return 3
      if (t < 0.7) return 4
      if (t < 0.88) return 5
      return 6
    })
  }

  const spawnRaw = Array.isArray(nested.spawns) ? nested.spawns : []
  const spawns: IslandSpawn[] = spawnRaw
    .map((s) => {
      if (!s || typeof s !== 'object') return null
      const row = s as Record<string, unknown>
      return {
        x: asFiniteNumber(row.x, 0),
        y: asFiniteNumber(row.y, maxHeight * 0.4 + 2),
        z: asFiniteNumber(row.z, 0),
        label: typeof row.label === 'string' ? row.label : undefined,
      }
    })
    .filter(Boolean) as IslandSpawn[]

  const poiRaw = Array.isArray(nested.pois) ? nested.pois : []
  const pois: IslandPoi[] = poiRaw
    .map((p) => {
      if (!p || typeof p !== 'object') return null
      const row = p as Record<string, unknown>
      return {
        kind: typeof row.kind === 'string' ? row.kind : 'marker',
        x: asFiniteNumber(row.x, 0),
        y: asFiniteNumber(row.y, 2),
        z: asFiniteNumber(row.z, 0),
        label: typeof row.label === 'string' ? row.label : undefined,
        color: typeof row.color === 'string' ? row.color : undefined,
      }
    })
    .filter(Boolean) as IslandPoi[]

  const id =
    typeof nested.id === 'string' && nested.id.trim()
      ? nested.id.trim()
      : fallbackId

  return {
    format: ISLAND_BAKE_FORMAT,
    engine:
      typeof nested.engine === 'string'
        ? nested.engine
        : typeof rec.format === 'string' && String(rec.format).startsWith('meshterrain')
          ? 'super-terrain'
          : 'Island-Terrain-World-Engine',
    id,
    title: typeof nested.title === 'string' ? nested.title : id,
    seed: Math.round(asFiniteNumber(nested.seed, 1)),
    size,
    cellSize,
    seaLevel,
    maxHeight,
    heights,
    biomes,
    spawns,
    pois,
  }
}

export function assertIslandBake(bake: IslandBake): void {
  if (bake.format !== ISLAND_BAKE_FORMAT) {
    throw new Error(`Unsupported island bake format: ${bake.format}`)
  }
  const expected = bake.size * bake.size
  if (bake.heights.length !== expected || bake.biomes.length !== expected) {
    throw new Error(
      `Island bake ${bake.id} expected ${expected} samples, got heights=${bake.heights.length} biomes=${bake.biomes.length}`
    )
  }
}
