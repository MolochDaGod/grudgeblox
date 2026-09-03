import type { IslandBake } from '@shared/maps/islandBake'
import { generateIsland } from '@shared/maps/generateIsland'
import { ISLAND_CATALOG } from '@shared/maps/islandBake'
import harborAtoll from '../../shared/maps/baked/harbor-atoll.json'
import volcanicRidge from '../../shared/maps/baked/volcanic-ridge.json'
import frozenFjord from '../../shared/maps/baked/frozen-fjord.json'
import alpineMesh from '../../shared/maps/baked/alpine-mesh.json'
import graniteCsg from '../../shared/maps/baked/granite-csg.json'
import splineForest from '../../shared/maps/baked/spline-forest.json'
import tunnelCavern from '../../shared/maps/baked/tunnel-cavern.json'

const BAKES: Record<string, IslandBake> = {
  'harbor-atoll': harborAtoll as IslandBake,
  'volcanic-ridge': volcanicRidge as IslandBake,
  'frozen-fjord': frozenFjord as IslandBake,
  'alpine-mesh': alpineMesh as IslandBake,
  'granite-csg': graniteCsg as IslandBake,
  'spline-forest': splineForest as IslandBake,
  'tunnel-cavern': tunnelCavern as IslandBake,
}

export function loadClientIslandBake(id: string): IslandBake {
  if (BAKES[id]) return BAKES[id]
  const entry = ISLAND_CATALOG.find((item) => item.id === id)
  return generateIsland({
    id: entry?.id || id,
    kind: entry?.kind || id,
    seed: entry?.seed,
    engine:
      entry?.source === 'super-terrain'
        ? 'super-terrain (client fallback)'
        : 'Island-Terrain-World-Engine (client fallback)',
  })
}
