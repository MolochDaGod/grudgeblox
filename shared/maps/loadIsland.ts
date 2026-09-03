import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ISLAND_CATALOG,
  assertIslandBake,
  coerceEngineBake,
  isIslandKind,
  type IslandBake,
  type IslandKind,
} from './islandBake.js'
import { generateIsland } from './generateIsland.js'
import { coerceSuperTerrainBake, isSuperTerrainDocument } from './superTerrainBake.js'

export function bakedIslandCandidates(id: string): string[] {
  const here = dirname(fileURLToPath(import.meta.url))
  return [
    join(here, 'baked', `${id}.json`),
    join(here, '../maps/baked', `${id}.json`),
    join(here, '../../maps/baked', `${id}.json`),
    join(process.cwd(), 'maps/baked', `${id}.json`),
    join(process.cwd(), '../shared/maps/baked', `${id}.json`),
    join(process.cwd(), 'shared/maps/baked', `${id}.json`),
  ]
}

export function bakedIslandPath(id: string, root = join(dirname(fileURLToPath(import.meta.url)), 'baked')): string {
  return bakedIslandCandidates(id).find((file) => existsSync(file)) || join(root, `${id}.json`)
}

export function loadBakedIslandJson(json: string, fallbackId: string): IslandBake {
  const parsed = JSON.parse(json) as unknown
  const bake = isSuperTerrainDocument(parsed)
    ? coerceSuperTerrainBake(parsed, isIslandKind(fallbackId) ? fallbackId : 'alpine-mesh')
    : coerceEngineBake(parsed, fallbackId) || coerceSuperTerrainBake(parsed)
  if (!bake) throw new Error(`Could not parse island bake ${fallbackId}`)
  assertIslandBake(bake)
  return bake
}

export function loadIslandFromCatalog(id: string = 'harbor-atoll'): IslandBake {
  const entry = ISLAND_CATALOG.find((item) => item.id === id) || ISLAND_CATALOG[0]
  const file = bakedIslandPath(entry.id)
  try {
    const json = readFileSync(file, 'utf8')
    return loadBakedIslandJson(json, entry.id)
  } catch {
    return generateIsland({
      id: entry.id,
      kind: entry.kind,
      seed: entry.seed,
      engine: 'Island-Terrain-World-Engine (generated fallback)',
    })
  }
}

function collectJsonFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      collectJsonFiles(full, out)
    } else if (/\.(json)$/i.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

/**
 * Import maps exported by Island Terrain World Engine or Super Terrain.
 * Looks for `grudge-island-bake/v1` JSON and `meshterrain-world.json`
 * under exports/, bakes/, out/, maps/, source/, dist/.
 */
export function loadIslandsFromEngineRoot(engineRoot: string): IslandBake[] {
  const search = ['exports', 'bakes', 'out', 'maps', 'source', 'dist', ''].map((part) =>
    part ? join(engineRoot, part) : engineRoot
  )
  const files = new Set<string>()
  for (const dir of search) {
    for (const file of collectJsonFiles(dir)) files.add(file)
  }
  const bakes: IslandBake[] = []
  for (const file of files) {
    try {
      const json = readFileSync(file, 'utf8')
      const parsed = JSON.parse(json) as unknown
      const rec = parsed as Record<string, unknown>
      const name = basename(file).toLowerCase()
      const looksLikeBake =
        rec &&
        (rec.format === 'grudge-island-bake/v1' ||
          rec.heights ||
          rec.heightmap ||
          rec.terrain ||
          isSuperTerrainDocument(parsed) ||
          name === 'meshterrain-world.json')
      if (!looksLikeBake) continue
      const fallbackId = rec.id ? String(rec.id) : name.replace(/\.json$/, '') || 'engine-island'
      const bake = isSuperTerrainDocument(parsed)
        ? coerceSuperTerrainBake(parsed, isIslandKind(fallbackId) ? fallbackId : 'alpine-mesh')
        : coerceEngineBake(parsed, fallbackId) || coerceSuperTerrainBake(parsed)
      if (bake) {
        assertIslandBake(bake)
        bakes.push(bake)
      }
    } catch {
      /* skip unrelated JSON */
    }
  }
  return bakes
}

export function resolveIslandBake(id?: string): IslandBake {
  const requested = (id || process.env.ISLAND_MAP || 'harbor-atoll').trim()
  const engineRoot =
    process.env.ISLAND_ENGINE_ROOT ||
    process.env.ISLAND_TERRAIN_ENGINE ||
    process.env.SUPER_TERRAIN_ROOT ||
    process.env.SUPER_TERRAIN_ENGINE ||
    ''
  if (engineRoot && existsSync(engineRoot)) {
    const imported = loadIslandsFromEngineRoot(engineRoot)
    const match =
      imported.find((bake) => bake.id === requested) ||
      imported[0]
    if (match) return match
  }
  if ((ISLAND_CATALOG as { id: string }[]).some((item) => item.id === requested)) {
    return loadIslandFromCatalog(requested as IslandKind)
  }
  return loadIslandFromCatalog('harbor-atoll')
}
