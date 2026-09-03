import {
  ISLAND_BAKE_FORMAT,
  type IslandBake,
  type IslandKind,
  type IslandPoi,
  type IslandSpawn,
  vertexWorldPosition,
} from './islandBake.js'

function hash2(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 19.19) * 43758.5453123
  return n - Math.floor(n)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

function valueNoise(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x)
  const z0 = Math.floor(z)
  const fx = smooth(x - x0)
  const fz = smooth(z - z0)
  const a = hash2(x0, z0, seed)
  const b = hash2(x0 + 1, z0, seed)
  const c = hash2(x0, z0 + 1, seed)
  const d = hash2(x0 + 1, z0 + 1, seed)
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz)
}

function fbm(x: number, z: number, seed: number, octaves = 5): number {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, z * freq, seed + i * 17)
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / (norm || 1)
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

type KindProfile = {
  title: string
  seaLevel: number
  maxHeight: number
  ridge: number
  lagoon: number
  snowStart: number
  warp: number
}

const PROFILES: Record<IslandKind, KindProfile> = {
  'harbor-atoll': {
    title: 'Harbor Atoll',
    seaLevel: 0.2,
    maxHeight: 22,
    ridge: 0.35,
    lagoon: 0.55,
    snowStart: 1.2,
    warp: 0.35,
  },
  'volcanic-ridge': {
    title: 'Volcanic Ridge',
    seaLevel: 0.16,
    maxHeight: 38,
    ridge: 0.85,
    lagoon: 0.12,
    snowStart: 0.78,
    warp: 0.55,
  },
  'frozen-fjord': {
    title: 'Frozen Fjord',
    seaLevel: 0.18,
    maxHeight: 32,
    ridge: 0.62,
    lagoon: 0.2,
    snowStart: 0.58,
    warp: 0.42,
  },
  'alpine-mesh': {
    title: 'Alpine Mesh',
    seaLevel: 0.12,
    maxHeight: 48,
    ridge: 0.92,
    lagoon: 0.08,
    snowStart: 0.52,
    warp: 0.48,
  },
  'granite-csg': {
    title: 'Granite CSG',
    seaLevel: 0.1,
    maxHeight: 36,
    ridge: 0.78,
    lagoon: 0.05,
    snowStart: 0.94,
    warp: 0.62,
  },
  'spline-forest': {
    title: 'Spline Forest',
    seaLevel: 0.14,
    maxHeight: 26,
    ridge: 0.28,
    lagoon: 0.18,
    snowStart: 1.1,
    warp: 0.4,
  },
  'tunnel-cavern': {
    title: 'Tunnel Cavern',
    seaLevel: 0.08,
    maxHeight: 34,
    ridge: 0.7,
    lagoon: 0,
    snowStart: 0.9,
    warp: 0.3,
  },
}

function profileFor(kind: string): KindProfile {
  if (kind in PROFILES) return PROFILES[kind as IslandKind]
  return PROFILES['harbor-atoll']
}

export type GenerateIslandOptions = {
  id?: string
  kind?: IslandKind | string
  seed?: number
  size?: number
  cellSize?: number
  engine?: string
}

export function generateIsland(options: GenerateIslandOptions = {}): IslandBake {
  const kind = (options.kind || options.id || 'harbor-atoll') as string
  const profile = profileFor(kind)
  const seed = options.seed ?? 1847291
  const size = Math.max(16, Math.min(128, options.size ?? 64))
  const cellSize = options.cellSize ?? 4
  const heights: number[] = []
  const biomes: number[] = []

  for (let iz = 0; iz < size; iz++) {
    for (let ix = 0; ix < size; ix++) {
      const nx = ix / Math.max(1, size - 1)
      const nz = iz / Math.max(1, size - 1)
      const cx = nx * 2 - 1
      const cz = nz * 2 - 1
      const warpX = fbm(nx * 3, nz * 3, seed + 3, 3) * profile.warp
      const warpZ = fbm(nx * 3 + 8, nz * 3, seed + 9, 3) * profile.warp
      const px = cx + (warpX - 0.5 * profile.warp)
      const pz = cz + (warpZ - 0.5 * profile.warp)
      const r = Math.sqrt(px * px + pz * pz)
      const radial = clamp01(1 - Math.pow(Math.min(1.15, r) / 0.92, 2.15))
      const n = fbm(nx * 4.2, nz * 4.2, seed, 5)
      const ridgeNoise = Math.abs(fbm(nx * 2.4, nz * 2.4, seed + 21, 4) * 2 - 1)
      const ridge = Math.pow(1 - Math.min(1, Math.abs(px * 0.35 + pz)), 2) * profile.ridge * ridgeNoise
      let lagoon = 0
      if (profile.lagoon > 0) {
        const ring = 1 - Math.abs(r - 0.38) * 3.4
        lagoon = clamp01(ring) * profile.lagoon * (1 - n * 0.35)
      }
      let h = radial * (0.28 + n * 0.72) + ridge * 0.55 - lagoon * 0.28
      if (kind === 'frozen-fjord') {
        const inlet = clamp01(1 - Math.abs(px) * 2.8) * clamp01(pz + 0.15)
        h -= inlet * 0.42
      }
      if (kind === 'alpine-mesh') {
        const valley = clamp01(1 - Math.abs(px) * 2.2) * clamp01(pz + 0.35)
        h = h * 0.7 + ridgeNoise * 0.45 - valley * 0.38
      }
      if (kind === 'granite-csg') {
        const blocks = Math.abs(fbm(nx * 8, nz * 8, seed + 41, 2) * 2 - 1)
        h = clamp01(h * 0.55 + ridge * 0.5 + blocks * 0.35)
      }
      if (kind === 'spline-forest') {
        const stands = fbm(nx * 5.5, nz * 5.5, seed + 13, 4)
        h = radial * (0.34 + stands * 0.5) + ridge * 0.18
      }
      if (kind === 'tunnel-cavern') {
        const mouth = clamp01(1 - r / 0.28)
        const rim = clamp01(1 - Math.abs(r - 0.38) * 4)
        h = rim * 0.72 + ridge * 0.25 + n * 0.12 - mouth * 0.55
      }
      h = clamp01(h * (kind === 'tunnel-cavern' ? 1 : radial))
      const q = Math.round(h * 255)
      heights.push(q)
      const t = q / 255
      let biome = 3
      if (t < profile.seaLevel) biome = 0
      else if (t < profile.seaLevel + 0.035) biome = 1
      else if (t < profile.seaLevel + 0.09) biome = 2
      else if (t < 0.42) biome = 3
      else if (t < 0.68) biome = 4
      else if (t < profile.snowStart) biome = 5
      else biome = 6
      if (kind === 'volcanic-ridge' && t > 0.72 && ridgeNoise > 0.55) biome = 7
      if (kind === 'granite-csg') {
        if (t < profile.seaLevel) biome = 0
        else if (t < 0.22) biome = 2
        else biome = t > 0.84 ? 6 : 5
      }
      if (kind === 'spline-forest' && t >= profile.seaLevel + 0.09 && t < 0.78) biome = 4
      if (kind === 'tunnel-cavern' && r < 0.32) biome = t < 0.28 ? 5 : 5
      if (kind === 'alpine-mesh' && t > profile.snowStart) biome = 6
      biomes.push(biome)
    }
  }

  const bakeBase = {
    size,
    cellSize,
    maxHeight: profile.maxHeight,
    heights,
  }
  const landSpawns: IslandSpawn[] = []
  const step = Math.max(1, Math.floor(size / 8))
  for (let iz = step; iz < size - step; iz += step) {
    for (let ix = step; ix < size - step; ix += step) {
      const idx = iz * size + ix
      const t = heights[idx] / 255
      if (t > profile.seaLevel + 0.08 && t < 0.72) {
        const p = vertexWorldPosition(
          { ...bakeBase, format: ISLAND_BAKE_FORMAT, engine: '', id: '', title: '', seed, seaLevel: profile.seaLevel, biomes, spawns: [], pois: [] },
          ix,
          iz
        )
        landSpawns.push({ ...p, y: p.y + 3, label: 'landing' })
      }
    }
  }
  landSpawns.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))
  const spawn = landSpawns[0] || { x: 0, y: profile.maxHeight * 0.4 + 4, z: 0, label: 'landing' }

  const pois: IslandPoi[] = []
  const extra = landSpawns.slice(1, 6)
  const poiKinds =
    kind === 'volcanic-ridge'
      ? ['lookout', 'crater', 'ruin']
      : kind === 'frozen-fjord'
        ? ['camp', 'ice-cave', 'ruin']
        : kind === 'alpine-mesh'
          ? ['scout', 'saddle', 'ruin']
          : kind === 'granite-csg'
            ? ['outcrop', 'quarry', 'ruin']
            : kind === 'spline-forest'
              ? ['grove', 'stand', 'ruin']
              : kind === 'tunnel-cavern'
                ? ['mouth', 'shaft', 'ruin']
                : ['dock', 'grove', 'ruin']
  extra.forEach((p, i) => {
    pois.push({
      kind: poiKinds[i % poiKinds.length],
      x: p.x,
      y: p.y + 1,
      z: p.z,
      label: poiKinds[i % poiKinds.length],
      color:
        poiKinds[i % poiKinds.length] === 'dock'
          ? '#d4a84b'
          : poiKinds[i % poiKinds.length] === 'crater'
            ? '#e0553a'
            : '#7dd3a0',
    })
  })

  return {
    format: ISLAND_BAKE_FORMAT,
    engine:
      options.engine ||
      (kind === 'alpine-mesh' ||
      kind === 'granite-csg' ||
      kind === 'spline-forest' ||
      kind === 'tunnel-cavern'
        ? 'super-terrain (generated bake)'
        : 'Island-Terrain-World-Engine (generated)'),
    id: options.id || kind,
    title: profile.title,
    seed,
    size,
    cellSize,
    seaLevel: profile.seaLevel,
    maxHeight: profile.maxHeight,
    heights,
    biomes,
    spawns: [spawn],
    pois,
  }
}
