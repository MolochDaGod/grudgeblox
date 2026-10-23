import type { GameInfo } from '@/types'
import gameData from '../public/gameData.json'
import { ISLAND_CATALOG } from '@shared/maps/islandBake'
import { ISLAND_ROOMS, MAP_ROOMS, SUPER_TERRAIN_GITHUB } from '@shared/maps/sandboxRooms'

export { SUPER_TERRAIN_GITHUB }

export function allGames(): GameInfo[] {
  return gameData as GameInfo[]
}

export function gamesBySlug(): Map<string, GameInfo> {
  return new Map(allGames().map((game) => [game.slug, game]))
}

export function islandGames(): GameInfo[] {
  return allGames().filter((game) => game.section === 'islands' && game.slug !== 'island')
}

export function mapGames(): GameInfo[] {
  return allGames().filter((game) => game.section === 'maps')
}

export function islandMeta(mapId?: string) {
  return ISLAND_CATALOG.find((entry) => entry.id === mapId)
}

export { ISLAND_CATALOG, ISLAND_ROOMS, MAP_ROOMS }
