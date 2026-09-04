import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { generateIsland } from '@shared/maps/generateIsland.js'
import { worldSizeMeters } from '@shared/maps/islandBake.js'
import { detectMeshLevels, snapToWalkableMesh } from '@shared/maps/meshLevels.js'
import {
  PLAY_CHARACTER_HEIGHT_M,
  PLAY_ISLAND_EXTENT_M,
  PLAY_MAX_RELIEF_M,
  fitBakeToPlayScale,
} from '@shared/maps/playScale.js'

describe('play-scale island bakes', () => {
  it('sizes catalog islands for 1.8 m characters', () => {
    const bake = generateIsland({ id: 'harbor-atoll', kind: 'harbor-atoll', seed: 1847291 })
    assert.equal(bake.size, 96)
    assert.ok(Math.abs(worldSizeMeters(bake) - PLAY_ISLAND_EXTENT_M) < 0.01)
    assert.ok(bake.maxHeight <= PLAY_MAX_RELIEF_M)
    assert.equal(bake.play?.characterHeightM, PLAY_CHARACTER_HEIGHT_M)
    assert.ok((bake.play?.walkableCount || 0) > 200)
  })

  it('detects a walkable mesh level and snaps spawn onto it', () => {
    const bake = generateIsland({ id: 'alpine-mesh', kind: 'alpine-mesh', seed: 4000128 })
    const report = detectMeshLevels(bake)
    assert.ok(report.walkableCount > 0)
    assert.ok(report.primaryLevelY > bake.seaLevel * bake.maxHeight)
    const snapped = snapToWalkableMesh(bake, 0, 0, report)
    assert.ok(snapped)
    assert.ok(snapped.y >= report.primaryLevelY - 2)
    assert.ok(Math.abs(snapped.x) <= PLAY_ISLAND_EXTENT_M / 2)
  })

  it('fits a 4 km Super Terrain dump onto the play footprint', () => {
    const raw = generateIsland({
      id: 'alpine-mesh',
      kind: 'alpine-mesh',
      seed: 4000128,
      size: 32,
      cellSize: 125,
    })
    raw.play = undefined
    const fitted = fitBakeToPlayScale(raw)
    assert.ok(Math.abs(worldSizeMeters(fitted) - PLAY_ISLAND_EXTENT_M) < 0.2)
    assert.ok(fitted.maxHeight <= PLAY_MAX_RELIEF_M)
    assert.ok((fitted.play?.walkableCount || 0) > 0)
  })
})
