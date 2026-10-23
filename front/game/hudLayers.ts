/**
 * HUD layer stack for production play.
 *
 * One z-order table so React HUD pieces stop fighting over arbitrary z-[..]
 * classes, and one visibility policy so players can drop to a minimal HUD
 * (combat only) or hide it for clean screenshots. DOM-free for tests.
 */

export const HUD_Z = {
  /** CSS2D world labels (names, prompts in world space). */
  WORLD_LABELS: 40,
  /** Avatar loading chip, top-left panels, chat, links. */
  PANELS: 50,
  /** Look hint under the crosshair. */
  LOOK_HINT: 55,
  /** Center crosshair. */
  CROSSHAIR: 60,
  /** Weapon skill bar 1–5. */
  SKILLBAR: 62,
  /** Mobile joystick, Jump, E. */
  MOBILE_CONTROLS: 65,
  /** Kill feed and nearby prompt. */
  FEED: 70,
  /** Server notifications. */
  NOTIFICATIONS: 75,
  /** Tab scoreboard. */
  SCOREBOARD: 80,
  /** Loading / connection overlays. */
  OVERLAY: 90,
} as const

export type HudLayerId = keyof typeof HUD_Z

export type HudMode = 'full' | 'minimal' | 'hidden'

export const HUD_MODES: readonly HudMode[] = ['full', 'minimal', 'hidden']

export function nextHudMode(mode: HudMode): HudMode {
  const index = HUD_MODES.indexOf(mode)
  return HUD_MODES[(index + 1) % HUD_MODES.length]
}

/**
 * What each mode shows. Overlays and the world labels are never gated here:
 * connection errors must always surface and CSS2D labels belong to the scene.
 */
const MINIMAL_LAYERS: ReadonlySet<HudLayerId> = new Set<HudLayerId>([
  'WORLD_LABELS',
  'CROSSHAIR',
  'SKILLBAR',
  'MOBILE_CONTROLS',
  'FEED',
  'NOTIFICATIONS',
  'SCOREBOARD',
  'OVERLAY',
])

const HIDDEN_LAYERS: ReadonlySet<HudLayerId> = new Set<HudLayerId>([
  'WORLD_LABELS',
  'MOBILE_CONTROLS',
  'NOTIFICATIONS',
  'SCOREBOARD',
  'OVERLAY',
])

export function hudLayerVisible(layer: HudLayerId, mode: HudMode): boolean {
  if (mode === 'full') return true
  if (mode === 'minimal') return MINIMAL_LAYERS.has(layer)
  return HIDDEN_LAYERS.has(layer)
}

export function hudModeLabel(mode: HudMode): string {
  if (mode === 'full') return 'HUD full'
  if (mode === 'minimal') return 'HUD minimal'
  return 'HUD hidden'
}
