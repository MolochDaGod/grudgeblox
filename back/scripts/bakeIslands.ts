#!/usr/bin/env tsx
/**
 * Bake Island Terrain World Engine maps into GrudgeBlox catalog JSON.
 *
 * Usage:
 *   pnpm --filter @notblox/back exec tsx scripts/bakeIslands.ts
 *   ISLAND_ENGINE_ROOT=/path/to/Island-Terrain-World-Engine pnpm --filter @notblox/back exec tsx scripts/bakeIslands.ts
 *   SUPER_TERRAIN_ROOT=/path/to/super-terrain-export pnpm --filter @notblox/back exec tsx scripts/bakeIslands.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ISLAND_CATALOG } from '@shared/maps/islandBake.js'
import { generateIsland } from '@shared/maps/generateIsland.js'
import { loadIslandsFromEngineRoot } from '@shared/maps/loadIsland.js'
import { fitBakeToPlayScale } from '@shared/maps/playScale.js'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '../../shared/maps/baked')
const publicDir = join(here, '../../front/public/maps/islands')
mkdirSync(outDir, { recursive: true })
mkdirSync(publicDir, { recursive: true })

const engineRoot =
  process.env.ISLAND_ENGINE_ROOT ||
  process.env.ISLAND_TERRAIN_ENGINE ||
  process.env.SUPER_TERRAIN_ROOT ||
  process.env.SUPER_TERRAIN_ENGINE ||
  ''
const imported = engineRoot ? loadIslandsFromEngineRoot(engineRoot) : []
const byId = new Map(imported.map((bake) => [bake.id, bake]))

const written: string[] = []
for (const entry of ISLAND_CATALOG) {
  const bake = fitBakeToPlayScale(
    byId.get(entry.id) ||
    generateIsland({
      id: entry.id,
      kind: entry.kind,
      seed: entry.seed,
      engine: imported.length
        ? entry.source === 'super-terrain'
          ? 'super-terrain (catalog fill-in)'
          : 'Island-Terrain-World-Engine (catalog fill-in)'
        : entry.source === 'super-terrain'
          ? 'super-terrain (generated bake)'
          : 'Island-Terrain-World-Engine (generated bake)',
    })
  )
  const path = join(outDir, `${entry.id}.json`)
  writeFileSync(path, `${JSON.stringify(bake)}\n`)
  writeFileSync(join(publicDir, `${entry.id}.json`), `${JSON.stringify(bake)}\n`)
  written.push(path)
}

for (const bake of imported) {
  if (ISLAND_CATALOG.some((entry) => entry.id === bake.id)) continue
  const scaled = fitBakeToPlayScale(bake)
  const path = join(outDir, `${scaled.id}.json`)
  writeFileSync(path, `${JSON.stringify(scaled)}\n`)
  writeFileSync(join(publicDir, `${scaled.id}.json`), `${JSON.stringify(scaled)}\n`)
  written.push(path)
}

console.log(`Baked ${written.length} island map(s):`)
for (const path of written) console.log(`  ${path}`)
