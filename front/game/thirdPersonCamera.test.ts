import assert from 'node:assert/strict'
import test from 'node:test'
import {
  THIRD_PERSON,
  applyMouseLook,
  applyStickLook,
  chaseOffset,
  clampPitch,
  clampZoom,
  lookingYAngle,
  pullAlongRay,
  pullCameraDistance,
} from './thirdPersonCamera'

test('default chase offset sits behind the player on +Z', () => {
  const offset = chaseOffset(THIRD_PERSON.defaultYaw, 0, 4)
  assert.ok(Math.abs(offset.z - 4) < 0.5, `expected behind on +Z, got ${offset.z}`)
  assert.ok(Math.abs(offset.y) < 0.01)
})

test('lookingYAngle matches Notblox camera-behind convention', () => {
  const angle = lookingYAngle(0, 15, 0, 0)
  assert.ok(Math.abs(angle - Math.PI / 2) < 1e-9)
})

test('mouse look yaws left when the cursor moves right', () => {
  const next = applyMouseLook(0, 0, 100, 0, 0.01)
  assert.ok(next.yaw < 0)
  assert.equal(next.pitch, 0)
})

test('mouse look pitch is clamped', () => {
  const up = applyMouseLook(0, THIRD_PERSON.maxPitch, 0, 400)
  assert.equal(up.pitch, THIRD_PERSON.maxPitch)
  const down = applyMouseLook(0, THIRD_PERSON.minPitch, 0, -400)
  assert.equal(down.pitch, THIRD_PERSON.minPitch)
})

test('stick look scales with dt', () => {
  const a = applyStickLook(0, 0, 1, 0, 0.016)
  const b = applyStickLook(0, 0, 1, 0, 0.032)
  assert.ok(Math.abs(b.yaw) > Math.abs(a.yaw))
})

test('wall hit pulls the camera in without passing through', () => {
  assert.equal(pullCameraDistance(4.6, null), 4.6)
  const pulled = pullCameraDistance(4.6, 1.2)
  assert.ok(pulled < 4.6)
  assert.ok(pulled >= THIRD_PERSON.minDistance)
})

test('wall pull stays on the look-to-camera ray', () => {
  const origin = { x: 0, y: 1.5, z: 0 }
  const desired = { x: 2, y: 2.5, z: 4 }
  const pulled = pullAlongRay(origin, desired, 1)
  const ox = pulled.x - origin.x
  const oy = pulled.y - origin.y
  const oz = pulled.z - origin.z
  const dx = desired.x - origin.x
  const dy = desired.y - origin.y
  const dz = desired.z - origin.z
  const cross = Math.hypot(oy * dz - oz * dy, oz * dx - ox * dz, ox * dy - oy * dx)
  assert.ok(cross < 1e-9, `left the ray: ${cross}`)
  assert.ok(Math.hypot(ox, oy, oz) < Math.hypot(dx, dy, dz))
})

test('zoom stays in the chase range', () => {
  assert.equal(clampZoom(0.1), THIRD_PERSON.minZoom)
  assert.equal(clampZoom(99), THIRD_PERSON.maxZoom)
  assert.equal(clampPitch(2), THIRD_PERSON.maxPitch)
})
