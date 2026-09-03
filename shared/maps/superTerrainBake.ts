/**
 * Super Terrain (https://github.com/vibe-stack/super-terrain) → GrudgeBlox bake.
 *
 * Super Terrain is a 4 km mesh-terrain editor (128 m sections, sculpt layers,
 * forest splines, granite CSG, tunnels). Authoritative runtime meshes include
 * overhangs that a heightfield cannot keep. GrudgeBlox live sandboxes play a
 * Rapier heightfield, so this adapter:
 *
 * 1. Accepts `grudge-island-bake/v1` or a height grid dumped from the editor
 * 2. Rasterizes mesh `positions` (x,y,z triples) onto a regular grid
 * 3. Reads `meshterrain-godot-source@1` (`source/meshterrain-world.json`) and
 *    either rasterizes patch vertices or fills a Super Terrain catalog island
 *
 * Do not vendor the WebGPU editor. Point `SUPER_TERRAIN_ROOT` at an export.
 */
import {
  ISLAND_BAKE_FORMAT,
  coerceEngineBake,
  type IslandBake,
  type IslandKind,
} from './islandBake.js'
import { generateIsland } from './generateIsland.js'

export const SUPER_TERRAIN_REPO = 'https://github.com/vibe-stack/super-terrain'
export const SUPER_TERRAIN_SOURCE_FORMAT = 'meshterrain-godot-source@1'
export const SUPER_TERRAIN_HEIGHTFIELD_FORMAT = 'meshterrain-heightfield@1'
export const SUPER_TERRAIN_WORLD_METERS = 4000
export const SUPER_TERRAIN_SECTION_METERS = 128

export const SUPER_TERRAIN_KINDS: IslandKind[] = [
  'alpine-mesh',
  'granite-csg',
  'spline-forest',
  'tunnel-cavern',
]

function asFiniteNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function hashSeed(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % 9000000
}

function looksLikeSuperTerrain(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  const rec = raw as Record<string, unknown>
  const format = typeof rec.format === 'string' ? rec.format : ''
  const engine = typeof rec.engine === 'string' ? rec.engine.toLowerCase() : ''
  return (
    format.startsWith('meshterrain') ||
    engine.includes('super-terrain') ||
    engine.includes('meshterrain') ||
    Array.isArray(rec.patches) ||
    (rec.config !== undefined && rec.modifiers !== undefined)
  )
}

/**
 * Sample mesh vertices onto a size×size height grid (max Y per cell).
 * Super Terrain Y is world elevation; X/Z are metres.
 */
export function rasterizeMeshToHeightfield(
  positions: ArrayLike<number>,
  size: number,
  worldSize: number
): { heights: number[]; maxHeight: number } | null {
  if (positions.length < 9 || positions.length % 3 !== 0) return null
  const n = Math.max(2, Math.min(256, Math.round(size)))
  const meters = Math.max(8, worldSize)
  const mins = new Array(n * n).fill(0)
  const filled = new Array(n * n).fill(0)
  let peak = 0.01
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]
    const y = positions[i + 1]
    const z = positions[i + 2]
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
    const ix = Math.round(((x / meters) + 0.5) * (n - 1))
    const iz = Math.round(((z / meters) + 0.5) * (n - 1))
    if (ix < 0 || iz < 0 || ix >= n || iz >= n) continue
    const idx = iz * n + ix
    peak = Math.max(peak, y)
    if (!filled[idx] || y > mins[idx]) {
      mins[idx] = y
      filled[idx] = 1
    }
  }
  if (!filled.some(Boolean)) return null
  const heights = mins.map((y, i) => {
    const sample = filled[i] ? y : 0
    return Math.round(Math.min(1, Math.max(0, sample / peak)) * 255)
  })
  return { heights, maxHeight: peak }
}

function collectPositionArrays(raw: unknown, out: number[] = []): number[] {
  if (!raw || typeof raw !== 'object') return out
  if (Array.isArray(raw)) {
    if (raw.length >= 9 && raw.every((v) => typeof v === 'number')) {
      out.push(...(raw as number[]))
      return out
    }
    for (const item of raw) collectPositionArrays(item, out)
    return out
  }
  const rec = raw as Record<string, unknown>
  if (rec.positions) collectPositionArrays(rec.positions, out)
  if (rec.vertices) collectPositionArrays(rec.vertices, out)
  if (rec.patches) collectPositionArrays(rec.patches, out)
  if (rec.meshes) collectPositionArrays(rec.meshes, out)
  return out
}

function catalogKindFromDocument(rec: Record<string, unknown>, fallback: IslandKind): IslandKind {
  const id = typeof rec.id === 'string' ? rec.id : ''
  if ((SUPER_TERRAIN_KINDS as string[]).includes(id)) return id as IslandKind
  const profile =
    typeof rec.worldProfile === 'string'
      ? rec.worldProfile
      : rec.config && typeof rec.config === 'object'
        ? String((rec.config as Record<string, unknown>).worldProfile || '')
        : ''
  const blob = `${id} ${profile} ${JSON.stringify(rec.config || {})}`.toLowerCase()
  if (blob.includes('forest') || blob.includes('tree')) return 'spline-forest'
  if (blob.includes('granite') || blob.includes('rock')) return 'granite-csg'
  if (blob.includes('tunnel') || blob.includes('cave')) return 'tunnel-cavern'
  if (blob.includes('alpine') || blob.includes('snow')) return 'alpine-mesh'
  return fallback
}

export function coerceSuperTerrainBake(
  raw: unknown,
  fallbackId: IslandKind = 'alpine-mesh'
): IslandBake | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const nested =
    rec.source && typeof rec.source === 'object'
      ? (rec.source as Record<string, unknown>)
      : rec

  const direct = coerceEngineBake(nested, fallbackId)
  if (direct && Array.isArray(nested.heights || nested.heightmap)) {
    return { ...direct, engine: direct.engine.includes('super-terrain') ? direct.engine : 'super-terrain' }
  }

  const config =
    nested.config && typeof nested.config === 'object'
      ? (nested.config as Record<string, unknown>)
      : nested
  const worldSize = asFiniteNumber(
    config.worldSize ?? nested.worldSize ?? SUPER_TERRAIN_WORLD_METERS,
    SUPER_TERRAIN_WORLD_METERS
  )
  const size = Math.max(
    16,
    Math.min(128, Math.round(asFiniteNumber(nested.size ?? nested.resolution, 64)))
  )
  const positions = collectPositionArrays(nested)
  const raster = positions.length >= 9 ? rasterizeMeshToHeightfield(positions, size, worldSize) : null
  if (raster) {
    const bake = coerceEngineBake(
      {
        format: ISLAND_BAKE_FORMAT,
        engine: 'super-terrain',
        id: typeof nested.id === 'string' ? nested.id : fallbackId,
        title: typeof nested.title === 'string' ? nested.title : fallbackId,
        seed: asFiniteNumber(nested.seed, hashSeed(JSON.stringify(config))),
        size,
        cellSize: worldSize / Math.max(1, size - 1),
        seaLevel: asFiniteNumber(nested.seaLevel, 0.12),
        maxHeight: raster.maxHeight,
        heights: raster.heights,
      },
      fallbackId
    )
    if (bake) return bake
  }

  if (!looksLikeSuperTerrain(nested) && !looksLikeSuperTerrain(rec)) return direct

  const kind = catalogKindFromDocument(nested, fallbackId)
  const seed = Math.round(
    asFiniteNumber(nested.seed ?? config.seed, hashSeed(JSON.stringify(config || nested)))
  )
  return generateIsland({
    id: typeof nested.id === 'string' && nested.id.trim() ? nested.id.trim() : kind,
    kind,
    seed,
    size,
    cellSize: 4,
    engine: 'super-terrain (godot source fill-in)',
  })
}

export function isSuperTerrainDocument(raw: unknown): boolean {
  return looksLikeSuperTerrain(raw)
}
