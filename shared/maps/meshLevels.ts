import { heightAt, worldSizeMeters, type IslandBake } from './islandBake.js'

export const PLAY_WALKABLE_NORMAL_Y = 0.72
export const PLAY_LEVEL_BIN_M = 0.5
export const PLAY_SPAWN_CLEARANCE_M = 0.1
const PLAY_CHARACTER_STEP = 0.9

export type MeshLevel = {
  y: number
  samples: number
}

export type MeshLevelReport = {
  walkable: Uint8Array
  levels: MeshLevel[]
  primaryLevelY: number
  walkableCount: number
}

function seaY(bake: IslandBake): number {
  return bake.seaLevel * bake.maxHeight
}

/**
 * Classify heightfield triangles that a 1.8 m character can stand on.
 * Walkable faces face mostly up and sit above the water plane.
 */
export function detectMeshLevels(bake: IslandBake): MeshLevelReport {
  const n = bake.size
  const walkable = new Uint8Array(n * n)
  const extent = worldSizeMeters(bake)
  const cell = extent / Math.max(1, n - 1)
  const water = seaY(bake) + 0.15

  for (let iz = 0; iz < n - 1; iz++) {
    for (let ix = 0; ix < n - 1; ix++) {
      const i00 = iz * n + ix
      const i10 = i00 + 1
      const i01 = i00 + n
      const y00 = heightAt(bake, i00)
      const y10 = heightAt(bake, i10)
      const y01 = heightAt(bake, i01)
      const y11 = heightAt(bake, i01 + 1)
      const x0 = ix * cell
      const z0 = iz * cell
      const x1 = x0 + cell
      const z1 = z0 + cell
      markIfWalkable(walkable, i00, i10, i01, x0, y00, z0, x1, y10, z0, x0, y01, z1, water)
      markIfWalkable(walkable, i10, i01 + 1, i01, x1, y10, z0, x1, y11, z1, x0, y01, z1, water)
    }
  }

  const bins = new Map<number, number>()
  let walkableCount = 0
  for (let i = 0; i < walkable.length; i++) {
    if (!walkable[i]) continue
    walkableCount += 1
    const key = Math.round(heightAt(bake, i) / PLAY_LEVEL_BIN_M)
    bins.set(key, (bins.get(key) || 0) + 1)
  }

  const levels = [...bins.entries()]
    .map(([bin, samples]) => ({ y: bin * PLAY_LEVEL_BIN_M, samples }))
    .sort((a, b) => b.samples - a.samples)

  return {
    walkable,
    levels,
    primaryLevelY: levels[0]?.y ?? water + PLAY_CHARACTER_STEP,
    walkableCount,
  }
}

function markIfWalkable(
  walkable: Uint8Array,
  a: number,
  b: number,
  c: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  water: number
) {
  if (ay < water && by < water && cy < water) return
  const e1x = bx - ax
  const e1y = by - ay
  const e1z = bz - az
  const e2x = cx - ax
  const e2y = cy - ay
  const e2z = cz - az
  let nx = e1y * e2z - e1z * e2y
  let ny = e1z * e2x - e1x * e2z
  let nz = e1x * e2y - e1y * e2x
  if (ny < 0) {
    nx = -nx
    ny = -ny
    nz = -nz
  }
  const len = Math.hypot(nx, ny, nz) || 1
  if (ny / len < PLAY_WALKABLE_NORMAL_Y) return
  walkable[a] = 1
  walkable[b] = 1
  walkable[c] = 1
}

export function snapToWalkableMesh(
  bake: IslandBake,
  x: number,
  z: number,
  report = detectMeshLevels(bake)
): { x: number; y: number; z: number } | null {
  const n = bake.size
  const extent = worldSizeMeters(bake)
  if (report.walkableCount === 0) return null
  const level = report.primaryLevelY
  let best = -1
  let bestScore = Infinity
  for (let i = 0; i < report.walkable.length; i++) {
    if (!report.walkable[i]) continue
    const iz = Math.floor(i / n)
    const ix = i - iz * n
    const wx = (ix / Math.max(1, n - 1) - 0.5) * extent
    const wz = (iz / Math.max(1, n - 1) - 0.5) * extent
    const y = heightAt(bake, i)
    const levelPenalty = Math.abs(y - level) * 4
    const score = Math.hypot(wx - x, wz - z) + levelPenalty
    if (score < bestScore) {
      bestScore = score
      best = i
    }
  }
  if (best < 0) return null
  const iz = Math.floor(best / n)
  const ix = best - iz * n
  return {
    x: (ix / Math.max(1, n - 1) - 0.5) * extent,
    y: heightAt(bake, best) + PLAY_SPAWN_CLEARANCE_M,
    z: (iz / Math.max(1, n - 1) - 0.5) * extent,
  }
}
