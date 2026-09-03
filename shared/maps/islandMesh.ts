import {
  ISLAND_BIOMES,
  heightAt,
  vertexWorldPosition,
  worldSizeMeters,
  type IslandBake,
} from './islandBake.js'

export const ISLAND_BIOME_COLORS: Record<(typeof ISLAND_BIOMES)[number], [number, number, number]> =
  {
    ocean: [0.08, 0.28, 0.42],
    shore: [0.78, 0.7, 0.48],
    sand: [0.82, 0.74, 0.52],
    grass: [0.28, 0.5, 0.24],
    forest: [0.16, 0.36, 0.16],
    rock: [0.42, 0.4, 0.38],
    snow: [0.9, 0.93, 0.96],
    lava: [0.55, 0.18, 0.1],
  }

export type IslandMeshData = {
  positions: Float32Array
  normals: Float32Array
  colors: Float32Array
  indices: Uint32Array
  worldSize: number
}

export function buildIslandMeshData(bake: IslandBake): IslandMeshData {
  const n = bake.size
  const vertCount = n * n
  const positions = new Float32Array(vertCount * 3)
  const colors = new Float32Array(vertCount * 3)
  const normals = new Float32Array(vertCount * 3)

  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const i = iz * n + ix
      const p = vertexWorldPosition(bake, ix, iz)
      positions[i * 3] = p.x
      positions[i * 3 + 1] = p.y
      positions[i * 3 + 2] = p.z
      const biome = ISLAND_BIOMES[bake.biomes[i] ?? 3] || 'grass'
      const c = ISLAND_BIOME_COLORS[biome]
      colors[i * 3] = c[0]
      colors[i * 3 + 1] = c[1]
      colors[i * 3 + 2] = c[2]
    }
  }

  const indices = new Uint32Array((n - 1) * (n - 1) * 6)
  let t = 0
  for (let iz = 0; iz < n - 1; iz++) {
    for (let ix = 0; ix < n - 1; ix++) {
      const a = iz * n + ix
      const b = a + 1
      const c = a + n
      const d = c + 1
      indices[t++] = a
      indices[t++] = c
      indices[t++] = b
      indices[t++] = b
      indices[t++] = c
      indices[t++] = d
    }
  }

  for (let i = 0; i < vertCount; i++) {
    normals[i * 3 + 1] = 1
  }
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i] * 3
    const i1 = indices[i + 1] * 3
    const i2 = indices[i + 2] * 3
    const ax = positions[i1] - positions[i0]
    const ay = positions[i1 + 1] - positions[i0 + 1]
    const az = positions[i1 + 2] - positions[i0 + 2]
    const bx = positions[i2] - positions[i0]
    const by = positions[i2 + 1] - positions[i0 + 1]
    const bz = positions[i2 + 2] - positions[i0 + 2]
    const nx = ay * bz - az * by
    const ny = az * bx - ax * bz
    const nz = ax * by - ay * bx
    normals[i0] += nx
    normals[i0 + 1] += ny
    normals[i0 + 2] += nz
    normals[i1] += nx
    normals[i1 + 1] += ny
    normals[i1 + 2] += nz
    normals[i2] += nx
    normals[i2 + 1] += ny
    normals[i2 + 2] += nz
  }
  for (let i = 0; i < vertCount; i++) {
    const x = normals[i * 3]
    const y = normals[i * 3 + 1]
    const z = normals[i * 3 + 2]
    const len = Math.hypot(x, y, z) || 1
    normals[i * 3] = x / len
    normals[i * 3 + 1] = y / len
    normals[i * 3 + 2] = z / len
  }

  return {
    positions,
    normals,
    colors,
    indices,
    worldSize: worldSizeMeters(bake),
  }
}

export function heightfieldSamples(bake: IslandBake): {
  nrows: number
  ncols: number
  heights: number[]
  scale: { x: number; y: number; z: number }
} {
  const n = bake.size
  const heights: number[] = []
  // Rapier stores column-major: index = col * (nrows + 1) + row
  for (let ix = 0; ix < n; ix++) {
    for (let iz = 0; iz < n; iz++) {
      heights.push(heightAt(bake, iz * n + ix))
    }
  }
  const extent = worldSizeMeters(bake)
  return {
    nrows: n - 1,
    ncols: n - 1,
    heights,
    scale: { x: extent, y: 1, z: extent },
  }
}
