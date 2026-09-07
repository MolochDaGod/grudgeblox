import assert from 'node:assert/strict'
import { test } from 'node:test'
import { InputTransmission } from './InputTransmission'
import { ClientMessageType } from '@shared/network/client/base'
import type { InputMessage } from '@shared/network/client/inputMessage'

const neutral = (): InputMessage => ({ t: ClientMessageType.INPUT, u: false, d: false, l: false, r: false, s: false, i: false, y: 0 })
for (const fps of [60, 120, 144]) test(`${fps} Hz rendering respects the 20 Hz input cadence for 30 seconds`, () => {
  const policy = new InputTransmission()
  let count = 0
  for (let frame = 0; frame < fps * 30; frame++) {
    const input = { ...neutral(), y: frame * 0.01 }
    const now = frame * 1000 / fps
    if (policy.shouldSend(input, now, 20, 1)) { policy.didSend(input, now, 1); count++ }
  }
  assert.ok(count <= 601 && count >= 450, `sent ${count} inputs`)
})
test('failed sends stay pending, reconnect resends, key edges bypass yaw cadence', () => {
  const policy = new InputTransmission(), input = neutral()
  assert.equal(policy.shouldSend(input, 0, 20, 0), true)
  assert.equal(policy.shouldSend(input, 1, 20, 0), true)
  policy.didSend(input, 1, 0)
  assert.equal(policy.shouldSend({ ...input, y: 0.1 }, 2, 20, 0), false)
  for (const key of ['u', 'd', 'l', 'r', 's', 'i'] as const) assert.equal(policy.shouldSend({ ...input, [key]: true }, 2, 20, 0), true)
  assert.equal(policy.shouldSend(input, 2, 20, 1), true)
  assert.equal(policy.shouldSend({ ...input, y: 2 * Math.PI + 0.0001 }, 100, 20, 0), false)
})
