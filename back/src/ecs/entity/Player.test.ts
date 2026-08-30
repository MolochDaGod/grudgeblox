import assert from 'node:assert/strict'
import test from 'node:test'
import type { WebSocket } from 'uWebSockets.js'
import { SingleSizeComponent } from '@shared/component/SingleSizeComponent.js'
import { CANONICAL_CHARACTER_ROOT_SCALE } from '@shared/avatar/characterTransformContract.js'
import { EntityManager } from '@shared/system/EntityManager.js'
import { Player } from './Player.js'

test('new and replicated players use the canonical unit root scale', () => {
  const player = new Player({} as WebSocket<unknown>, 0, 5, 0)
  try {
    const size = player.entity.getComponent(SingleSizeComponent)
    assert.ok(size)
    assert.equal(size.size, CANONICAL_CHARACTER_ROOT_SCALE)
    assert.equal(size.serialize().size, CANONICAL_CHARACTER_ROOT_SCALE)
  } finally {
    EntityManager.removeEntity(player.entity)
  }
})
