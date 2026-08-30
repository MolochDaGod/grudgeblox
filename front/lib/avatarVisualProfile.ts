import { GRUDGE6_CDN } from './fleetConfig'

export type AvatarSourceOrientation = {
  sourceId: '4character-races'
  rootNodeName: 'Root_normalized'
  sourceForwardAxis: '+X'
  worldForwardAxis: '+Z'
  yawRadians: number
}

const FOUR_CHARACTER_RACE_ORIENTATION: AvatarSourceOrientation = {
  sourceId: '4character-races',
  rootNodeName: 'Root_normalized',
  sourceForwardAxis: '+X',
  worldForwardAxis: '+Z',
  yawRadians: -Math.PI / 2,
}

const FOUR_CHARACTER_RACE_URL =
  /^\/kit\/4character\/races\/(human|barbarian|dwarf|high_elf|orc|undead)\.glb$/i

/** Source-specific model yaw. Movement/entity yaw remains canonical. */
export function getAvatarSourceOrientation(modelUrl: string): AvatarSourceOrientation | null {
  return FOUR_CHARACTER_RACE_URL.test(modelUrl) ? FOUR_CHARACTER_RACE_ORIENTATION : null
}

export type AvatarVisualCorrection = {
  yawRadians: number
  verticalScale: number
  preserveTop: boolean
}

const NO_CORRECTION: AvatarVisualCorrection = {
  yawRadians: 0,
  verticalScale: 1,
  preserveTop: false,
}

const LOBBY_GUEST_CORRECTION: AvatarVisualCorrection = {
  yawRadians: -Math.PI / 2,
  verticalScale: 2,
  preserveTop: true,
}

/**
 * The armored long-neck model is the lobby's built-in guest only. Requiring
 * route, character id, and resolved asset URL prevents the correction from
 * leaking to another world, another guest implementation, or another human.
 */
export function getAvatarVisualCorrection(input: {
  worldSlug?: string
  characterId: string
  modelUrl: string
}): AvatarVisualCorrection {
  if (
    input.worldSlug === 'lobby' &&
    input.characterId === 'guest-explorer' &&
    input.modelUrl === GRUDGE6_CDN.human
  ) {
    return LOBBY_GUEST_CORRECTION
  }
  return NO_CORRECTION
}
