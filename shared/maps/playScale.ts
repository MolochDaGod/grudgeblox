import { CANONICAL_CHARACTER_HEIGHT_M } from '../avatar/characterTransformContract.js'
import { worldSizeMeters, type IslandBake } from './islandBake.js'
import { detectMeshLevels, snapToWalkableMesh } from './meshLevels.js'

/** Play-scale contract: terrain features sized for 1.8 m fleet avatars and studio assets. */
export const PLAY_CHARACTER_HEIGHT_M = CANONICAL_CHARACTER_HEIGHT_M
export const PLAY_ISLAND_GRID = 96
export const PLAY_ISLAND_CELL_M = 1.25
export const PLAY_ISLAND_EXTENT_M = (PLAY_ISLAND_GRID - 1) * PLAY_ISLAND_CELL_M
export const PLAY_MAX_RELIEF_M = 16
export const PLAY_MIN_RELIEF_M = 8
export const PLAY_ISLAND_HUB_SPACING_M = 200

export type IslandPlayScale = {
  characterHeightM: number
  extentM: number
  primaryLevelY: number
  walkableCount: number
}

export function annotatePlayBake(bake: IslandBake): IslandBake {
  const report = detectMeshLevels(bake)
  const snappedSpawns = bake.spawns.map((spawn) => {
    const snapped = snapToWalkableMesh(bake, spawn.x, spawn.z, report)
    return snapped
      ? { ...spawn, x: snapped.x, y: snapped.y, z: snapped.z }
      : spawn
  })
  const snappedPois = bake.pois.map((poi) => {
    const snapped = snapToWalkableMesh(bake, poi.x, poi.z, report)
    return snapped ? { ...poi, x: snapped.x, y: snapped.y, z: snapped.z } : poi
  })
  return {
    ...bake,
    play: {
      characterHeightM: PLAY_CHARACTER_HEIGHT_M,
      extentM: worldSizeMeters(bake),
      primaryLevelY: report.primaryLevelY,
      walkableCount: report.walkableCount,
    },
    spawns: snappedSpawns,
    pois: snappedPois,
  }
}

/** Shrink or stretch an imported engine bake onto the play-scale footprint. */
export function fitBakeToPlayScale(bake: IslandBake): IslandBake {
  const extent = worldSizeMeters(bake)
  const cellSize = PLAY_ISLAND_EXTENT_M / Math.max(1, bake.size - 1)
  const heightScale = PLAY_ISLAND_EXTENT_M / Math.max(extent, 1)
  const maxHeight = Math.min(
    PLAY_MAX_RELIEF_M,
    Math.max(PLAY_MIN_RELIEF_M, bake.maxHeight * heightScale)
  )
  const scaled: IslandBake = {
    ...bake,
    cellSize,
    maxHeight,
    spawns: bake.spawns.map((spawn) => ({
      ...spawn,
      x: spawn.x * (cellSize / Math.max(bake.cellSize, 1e-6)),
      y: spawn.y * (maxHeight / Math.max(bake.maxHeight, 1e-6)),
      z: spawn.z * (cellSize / Math.max(bake.cellSize, 1e-6)),
    })),
    pois: bake.pois.map((poi) => ({
      ...poi,
      x: poi.x * (cellSize / Math.max(bake.cellSize, 1e-6)),
      y: poi.y * (maxHeight / Math.max(bake.maxHeight, 1e-6)),
      z: poi.z * (cellSize / Math.max(bake.cellSize, 1e-6)),
    })),
  }
  return annotatePlayBake(scaled)
}
