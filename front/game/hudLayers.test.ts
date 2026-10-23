import assert from 'node:assert/strict'
import { test } from 'node:test'
import { HUD_Z, hudLayerVisible, hudModeLabel, nextHudMode } from './hudLayers'

test('z-order climbs from world labels to overlays', () => {
  assert.ok(HUD_Z.WORLD_LABELS < HUD_Z.PANELS)
  assert.ok(HUD_Z.PANELS < HUD_Z.CROSSHAIR)
  assert.ok(HUD_Z.CROSSHAIR < HUD_Z.SKILLBAR)
  assert.ok(HUD_Z.SKILLBAR < HUD_Z.MOBILE_CONTROLS)
  assert.ok(HUD_Z.FEED < HUD_Z.NOTIFICATIONS)
  assert.ok(HUD_Z.SCOREBOARD < HUD_Z.OVERLAY)
})

test('modes cycle full -> minimal -> hidden -> full', () => {
  assert.equal(nextHudMode('full'), 'minimal')
  assert.equal(nextHudMode('minimal'), 'hidden')
  assert.equal(nextHudMode('hidden'), 'full')
  assert.equal(hudModeLabel('minimal'), 'HUD minimal')
})

test('minimal keeps combat, hidden keeps only safety layers', () => {
  assert.equal(hudLayerVisible('PANELS', 'full'), true)
  assert.equal(hudLayerVisible('PANELS', 'minimal'), false)
  assert.equal(hudLayerVisible('CROSSHAIR', 'minimal'), true)
  assert.equal(hudLayerVisible('SKILLBAR', 'minimal'), true)
  assert.equal(hudLayerVisible('LOOK_HINT', 'minimal'), false)
  assert.equal(hudLayerVisible('CROSSHAIR', 'hidden'), false)
  assert.equal(hudLayerVisible('SKILLBAR', 'hidden'), false)
  // Touch players must always be able to move; errors must always surface.
  assert.equal(hudLayerVisible('MOBILE_CONTROLS', 'hidden'), true)
  assert.equal(hudLayerVisible('OVERLAY', 'hidden'), true)
  assert.equal(hudLayerVisible('NOTIFICATIONS', 'hidden'), true)
})
