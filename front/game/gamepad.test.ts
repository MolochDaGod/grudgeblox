import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyDeadzone,
  emptyGamepadFrame,
  movementFromStick,
  pollFirstGamepad,
  readGamepad,
  skillSlotEdge,
} from './gamepad'

test('deadzone zeros noisy stick chatter', () => {
  assert.equal(applyDeadzone(0.1), 0)
  assert.ok(applyDeadzone(0.5) > 0)
  assert.equal(applyDeadzone(Number.NaN), 0)
})

test('readGamepad maps DualShock-style face buttons and sticks', () => {
  const frame = readGamepad({
    axes: [0.8, -0.9, 0.05, 0.6],
    buttons: [
      { pressed: true },
      { pressed: false },
      { pressed: true },
      { pressed: false },
      { pressed: false },
      { pressed: true },
    ],
  })
  assert.equal(frame.connected, true)
  assert.ok(frame.leftX > 0)
  assert.ok(frame.leftY < 0)
  assert.equal(frame.rightX, 0)
  assert.ok(frame.rightY > 0)
  assert.equal(frame.buttons.south, true)
  assert.equal(frame.buttons.west, true)
  assert.equal(frame.skillSlot, 2)
})

test('movementFromStick is camera-relative digital WASD', () => {
  assert.deepEqual(movementFromStick(0, -0.8), { u: true, d: false, l: false, r: false })
  assert.deepEqual(movementFromStick(-0.9, 0), { u: false, d: false, l: true, r: false })
  assert.deepEqual(movementFromStick(0, 0), { u: false, d: false, l: false, r: false })
})

test('pollFirstGamepad skips empty slots', () => {
  assert.equal(pollFirstGamepad([null, null]).connected, false)
  const frame = pollFirstGamepad([null, { axes: [0, 0, 0, 0], buttons: [] }])
  assert.equal(frame.connected, true)
})

test('skillSlotEdge fires once per hold', () => {
  assert.equal(skillSlotEdge(null, 1), 1)
  assert.equal(skillSlotEdge(1, 1), null)
  assert.equal(skillSlotEdge(1, null), null)
  assert.equal(skillSlotEdge(1, 3), 3)
})

test('empty frame is disconnected', () => {
  assert.equal(emptyGamepadFrame().connected, false)
  assert.equal(emptyGamepadFrame().skillSlot, null)
})
