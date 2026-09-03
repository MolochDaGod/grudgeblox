import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { generateIsland } from '@shared/maps/generateIsland.js'
import {
  chatbotReply,
  generateNpcCast,
  islandHubOrigin,
  nextIslandEvent,
  parseIslandMapId,
} from '@shared/maps/islandLive.js'

describe('live island generative layer', () => {
  it('parses island ids from play slugs', () => {
    assert.equal(parseIslandMapId('island-alpine-mesh'), 'alpine-mesh')
    assert.equal(parseIslandMapId('harbor-atoll'), 'harbor-atoll')
    assert.equal(parseIslandMapId('test'), null)
    assert.equal(parseIslandMapId('all'), null)
  })

  it('seats islands beside the city without overlapping origin', () => {
    const a = islandHubOrigin(0, true)
    const b = islandHubOrigin(1, true)
    assert.ok(a.x >= 560)
    assert.ok(b.x > a.x)
  })

  it('casts four NPC roles with hunt raiders', () => {
    const bake = generateIsland({ id: 'alpine-mesh', kind: 'alpine-mesh', seed: 4000128 })
    const origin = { x: 560, y: 0, z: 0 }
    const points = bake.spawns.map((spawn) => ({
      x: spawn.x + origin.x,
      y: spawn.y,
      z: spawn.z + origin.z,
    }))
    const npcs = generateNpcCast(bake.id, bake.seed, origin, points)
    assert.equal(npcs.length, 4)
    assert.ok(npcs.some((npc) => npc.behavior === 'hunt'))
    assert.ok(npcs.some((npc) => npc.role === 'guide'))
  })

  it('replies to guide-bot commands and ignores small talk', () => {
    const ctx = {
      islandTitle: 'Alpine Mesh',
      era: 'nexus',
      eventTitle: 'Storm front',
      npcNames: ['Kesh the guide'],
    }
    assert.match(chatbotReply('/help', ctx) || '', /Commands/)
    assert.match(chatbotReply('where am i', ctx) || '', /Alpine Mesh/)
    assert.match(chatbotReply('/event', ctx) || '', /Storm front/)
    assert.equal(chatbotReply('lol nice jump', ctx), null)
  })

  it('picks deterministic events for a seed and clock', () => {
    assert.equal(nextIslandEvent(4000128, 24).kind, nextIslandEvent(4000128, 24).kind)
  })
})
