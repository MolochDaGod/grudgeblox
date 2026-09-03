import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isAllowedAvatarUrl,
  sanitizeAppearance,
  sanitizeGameEra,
  sanitizeModel3d,
} from '@shared/avatar/appearancePolicy.js'

describe('sandbox appearance policy', () => {
  it('keeps kit races and allows era CDN meshes', () => {
    const kit = sanitizeAppearance({
      raceId: 'elf',
      classId: 'wizard',
      characterId: 'abc-1',
      model3d: 'races/high_elf.glb',
      gameEra: 'voxel',
    })
    assert.equal(kit.raceId, 'high_elf')
    assert.equal(kit.classId, 'mage')
    assert.equal(kit.model3d, 'races/high_elf.glb')
    assert.equal(kit.serverMeshPath, '/kit/4character/races/high_elf.glb')

    const warlord = sanitizeAppearance({
      raceId: 'WK_Characters',
      classId: 'paladin',
      characterId: 'hero_9',
      model3d: 'https://assets.grudge-studio.com/models/grudge6/races/WK_Characters.glb',
      gameEra: 'warlords',
    })
    assert.equal(warlord.gameEra, 'warlords')
    assert.equal(warlord.raceId, 'wk_characters')
    assert.equal(warlord.classId, 'paladin')
    assert.match(warlord.model3d, /WK_Characters\.glb$/)
  })

  it('rejects off-host avatar URLs', () => {
    assert.equal(isAllowedAvatarUrl('javascript:alert(1)'), false)
    assert.equal(isAllowedAvatarUrl('https://evil.example/mesh.glb'), false)
    assert.equal(
      sanitizeModel3d('https://evil.example/mesh.glb', 'human'),
      'races/human.glb'
    )
    assert.equal(sanitizeGameEra('not-an-era'), 'voxel')
    assert.equal(sanitizeGameEra('Nexus'), 'nexus')
  })
})
