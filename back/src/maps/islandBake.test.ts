import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  coerceEngineBake,
  ISLAND_BAKE_FORMAT,
  ISLAND_CATALOG,
  parseIslandMeshUrl,
  worldSizeMeters,
} from '@shared/maps/islandBake.js'
import { generateIsland } from '@shared/maps/generateIsland.js'
import { buildIslandMeshData, heightfieldSamples } from '@shared/maps/islandMesh.js'

describe('island bake generation', () => {
  it('is deterministic for a catalog seed', () => {
    const a = generateIsland({ id: 'harbor-atoll', kind: 'harbor-atoll', seed: 1847291 })
    const b = generateIsland({ id: 'harbor-atoll', kind: 'harbor-atoll', seed: 1847291 })
    assert.equal(a.format, ISLAND_BAKE_FORMAT)
    assert.equal(a.heights.length, a.size * a.size)
    assert.deepEqual(a.heights, b.heights)
    assert.ok(a.spawns.length >= 1)
    assert.ok(a.spawns[0].y > 0)
  })

  it('builds mesh and heightfield data that match the grid', () => {
    const bake = generateIsland({ kind: 'volcanic-ridge', seed: 9021744, size: 32 })
    const mesh = buildIslandMeshData(bake)
    assert.equal(mesh.positions.length, bake.size * bake.size * 3)
    assert.equal(mesh.indices.length, (bake.size - 1) * (bake.size - 1) * 6)
    const field = heightfieldSamples(bake)
    assert.equal(field.heights.length, (field.nrows + 1) * (field.ncols + 1))
    assert.equal(field.scale.x, worldSizeMeters(bake))
  })

  it('downsamples physics heightfields for the live server', () => {
    const bake = generateIsland({ kind: 'alpine-mesh', seed: 4000128, size: 64 })
    const field = heightfieldSamples(bake, 17)
    assert.equal(field.nrows, 16)
    assert.equal(field.ncols, 16)
    assert.equal(field.heights.length, 17 * 17)
    assert.equal(field.scale.x, worldSizeMeters(bake))
  })

  it('coerces Island Terrain World Engine JSON and nested heightmaps', () => {
    const nested = coerceEngineBake({
      format: ISLAND_BAKE_FORMAT,
      id: 'engine-export',
      title: 'Engine Atoll',
      seed: 7,
      size: 4,
      cellSize: 2,
      seaLevel: 0.2,
      maxHeight: 10,
      heights: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 255],
      biomes: new Array(16).fill(3),
      spawns: [{ x: 1, y: 4, z: -1, label: 'beach' }],
      pois: [],
    })
    assert.ok(nested)
    assert.equal(nested.id, 'engine-export')
    assert.equal(nested.heights.length, 16)

    const grid = coerceEngineBake({
      terrain: {
        id: 'grid-island',
        width: 2,
        heightmap: [
          [0, 1],
          [1, 0.5],
        ],
        maxHeight: 12,
      },
    })
    assert.ok(grid)
    assert.equal(grid.size, 2)
    assert.equal(grid.heights.length, 4)
  })

  it('parses island mesh URLs used by MapWorld', () => {
    assert.equal(parseIslandMeshUrl('island:harbor-atoll'), 'harbor-atoll')
    assert.equal(parseIslandMeshUrl('/maps/islands/frozen-fjord.json'), 'frozen-fjord')
    assert.equal(parseIslandMeshUrl('https://example/world.glb'), null)
    assert.equal(ISLAND_CATALOG.length, 7)
    assert.ok(ISLAND_CATALOG.some((entry) => entry.source === 'super-terrain'))
  })

  it('loads catalog bakes from JSON on disk', async () => {
    const { loadIslandFromCatalog } = await import('@shared/maps/loadIsland.js')
    const bake = loadIslandFromCatalog('alpine-mesh')
    assert.equal(bake.id, 'alpine-mesh')
    assert.equal(bake.size, 96)
    assert.ok(bake.play)
    assert.equal(bake.play?.characterHeightM, 1.8)
    assert.match(bake.engine, /super-terrain/)
  })
})
