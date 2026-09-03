import assert from 'node:assert/strict'
import test from 'node:test'
import { rosterErasForWorld, ALL_FLEET_ERAS } from './characterEras'

test('sandbox worlds union every fleet era', () => {
  assert.deepEqual(rosterErasForWorld('voxel', 'all-eras'), ALL_FLEET_ERAS)
  assert.deepEqual(rosterErasForWorld('sandbox'), ALL_FLEET_ERAS)
  assert.deepEqual(rosterErasForWorld('voxel'), ['voxel'])
  assert.deepEqual(rosterErasForWorld('warlords'), ['warlords'])
})
