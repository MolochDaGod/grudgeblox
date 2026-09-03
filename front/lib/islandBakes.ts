import type { IslandBake } from '@shared/maps/islandBake'
import { generateIsland } from '@shared/maps/generateIsland'
import { ISLAND_CATALOG } from '@shared/maps/islandBake'
import harborAtoll from '../../shared/maps/baked/harbor-atoll.json'
import volcanicRidge from '../../shared/maps/baked/volcanic-ridge.json'
import frozenFjord from '../../shared/maps/baked/frozen-fjord.json'

const BAKES: Record<string, IslandBake> = {
  'harbor-atoll': harborAtoll as IslandBake,
  'volcanic-ridge': volcanicRidge as IslandBake,
  'frozen-fjord': frozenFjord as IslandBake,
}

export function loadClientIslandBake(id: string): IslandBake {
  if (BAKES[id]) return BAKES[id]
  const entry = ISLAND_CATALOG.find((item) => item.id === id)
  return generateIsland({
    id: entry?.id || id,
    kind: entry?.kind || id,
    seed: entry?.seed,
    engine: 'Island-Terrain-World-Engine (client fallback)',
  })
}
