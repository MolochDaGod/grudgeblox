import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { generateIsland } from '@shared/maps/generateIsland.js'
import { ISLAND_CATALOG } from '@shared/maps/islandBake.js'
import {
  coerceSuperTerrainBake,
  rasterizeMeshToHeightfield,
  SUPER_TERRAIN_SOURCE_FORMAT,
} from '@shared/maps/superTerrainBake.js'
import { ISLAND_ROOMS, MAP_ROOMS, SANDBOX_ROOMS, roomForSlug } from '@shared/maps/sandboxRooms.js'

describe('super terrain bake adapter', () => {
  it('rasterizes mesh vertices onto a height grid', () => {
    const positions = [0, 10, 0, 8, 4, 0, -8, 2, 8]
    const result = rasterizeMeshToHeightfield(positions, 4, 16)
    assert.ok(result)
    assert.equal(result.heights.length, 16)
    assert.equal(result.maxHeight, 10)
    assert.ok(result.heights.some((h) => h === 255))
  })

  it('fills a Super Terrain Godot source document from the catalog', () => {
    const bake = coerceSuperTerrainBake({
      format: SUPER_TERRAIN_SOURCE_FORMAT,
      id: 'alpine-mesh',
      config: { worldSize: 4000, worldProfile: 'alpine', sectionSize: 128, seed: 4000128 },
      patches: [{ x: 0, z: 0, lod: 1, vertices: 12, triangles: 8 }],
    })
    assert.ok(bake)
    assert.equal(bake.id, 'alpine-mesh')
    assert.equal(bake.engine.includes('super-terrain'), true)
    assert.equal(bake.heights.length, bake.size * bake.size)
  })

  it('generates every catalog island deterministically', () => {
    for (const entry of ISLAND_CATALOG) {
      const a = generateIsland({ id: entry.id, kind: entry.kind, seed: entry.seed })
      const b = generateIsland({ id: entry.id, kind: entry.kind, seed: entry.seed })
      assert.deepEqual(a.heights, b.heights)
      assert.ok(a.spawns.length >= 1)
    }
  })
})

describe('sandbox rooms', () => {
  it('gives every island its own live port and script', () => {
    assert.equal(ISLAND_ROOMS.length, ISLAND_CATALOG.length)
    const ports = new Set(ISLAND_ROOMS.map((room) => room.port))
    assert.equal(ports.size, ISLAND_ROOMS.length)
    assert.ok(ISLAND_ROOMS.every((room) => room.script === 'islandSandboxScript.ts'))
    assert.ok(roomForSlug('island-harbor-atoll'))
    assert.equal(roomForSlug('island')?.islandMap, 'harbor-atoll')
    assert.equal(MAP_ROOMS.length, 5)
    assert.ok(SANDBOX_ROOMS.some((room) => room.slug === 'streets' && room.port === 8005))
  })
})
