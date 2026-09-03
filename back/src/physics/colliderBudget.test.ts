import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { serverLoadsGltfColliders } from './colliderBudget.js'

describe('collider budget', () => {
  it('skips server-side GLB colliders on Railway unless forced on', () => {
    const keys = [
      'CITY_GLTF_COLLIDERS',
      'RAILWAY_SERVICE_ID',
      'RAILWAY_ENVIRONMENT_ID',
      'RAILWAY_ENVIRONMENT_NAME',
    ]
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
    try {
      for (const key of keys) delete process.env[key]
      assert.equal(serverLoadsGltfColliders(), true)
      process.env.RAILWAY_SERVICE_ID = 'prod'
      assert.equal(serverLoadsGltfColliders(), false)
      process.env.CITY_GLTF_COLLIDERS = '1'
      assert.equal(serverLoadsGltfColliders(), true)
      process.env.CITY_GLTF_COLLIDERS = '0'
      delete process.env.RAILWAY_SERVICE_ID
      assert.equal(serverLoadsGltfColliders(), false)
    } finally {
      for (const key of keys) {
        if (previous[key] === undefined) delete process.env[key]
        else process.env[key] = previous[key]
      }
    }
  })
})
