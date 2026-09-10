import type { World } from '@shared/shire/model'
import type { InputAction } from '@shared/shire/lifeTypes'
import { DEFAULT_LIFE_SETTINGS } from '@shared/shire/lifeContent'

export function keyLabel(world: World, action: InputAction) {
  return (world.life?.settings || DEFAULT_LIFE_SETTINGS).bindings[action]
    .replace(/^Key|^Digit/, '').replace(/^Shift(Left|Right)$/, 'Shift')
    .replace(/^Control(Left|Right)$/, 'Ctrl').replace(/^Alt(Left|Right)$/, 'Alt')
    .replace(/^Arrow/, '')
}
