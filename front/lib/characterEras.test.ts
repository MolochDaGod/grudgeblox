import assert from 'node:assert/strict'
import test from 'node:test'
import {
  rosterErasForWorld,
  ALL_FLEET_ERAS,
  ERA_GENERATIONS,
  eraGeneration,
} from './characterEras'

test('sandbox worlds union every fleet era', () => {
  assert.deepEqual(rosterErasForWorld('voxel', 'all-eras'), ALL_FLEET_ERAS)
  assert.deepEqual(rosterErasForWorld('sandbox'), ALL_FLEET_ERAS)
  assert.deepEqual(rosterErasForWorld('voxel'), ['voxel'])
  assert.deepEqual(rosterErasForWorld('warlords'), ['warlords'])
})

test('era generations are five numbered fleet eras', () => {
  assert.equal(ERA_GENERATIONS.length, 5)
  assert.deepEqual(
    ERA_GENERATIONS.map((era) => era.generation),
    [1, 2, 3, 4, 5]
  )
  assert.equal(eraGeneration('nexus').playSlug, 'island-alpine-mesh')
  assert.ok(ERA_GENERATIONS.every((era) => ALL_FLEET_ERAS.includes(era.id)))
})
