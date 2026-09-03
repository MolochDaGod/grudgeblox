import assert from 'node:assert/strict'
import test from 'node:test'
import { formatNearbyPrompt } from './playHud'

test('does not prefix prompts that already name the key', () => {
  assert.equal(formatNearbyPrompt('E · Plant crop', false), 'E · Plant crop')
  assert.equal(formatNearbyPrompt('E Kick / Interact', true), 'E Kick / Interact')
})

test('adds a key when the world text is bare', () => {
  assert.equal(formatNearbyPrompt('Interact', false), 'E · Interact')
  assert.equal(formatNearbyPrompt('Drive', true), '✕ / E · Drive')
})
