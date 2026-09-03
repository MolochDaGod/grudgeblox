/** Standard W3C gamepad mapping. DOM-free so tests can feed stub pads. */

export const GAMEPAD_DEADZONE = 0.22

export type GamepadButtons = {
  south: boolean
  east: boolean
  west: boolean
  north: boolean
  leftBumper: boolean
  rightBumper: boolean
  leftTrigger: boolean
  rightTrigger: boolean
  dpadUp: boolean
  dpadDown: boolean
  dpadLeft: boolean
  dpadRight: boolean
}

export type GamepadFrame = {
  connected: boolean
  leftX: number
  leftY: number
  rightX: number
  rightY: number
  buttons: GamepadButtons
  /** Weapon skill 1–5, or null when none held. */
  skillSlot: number | null
}

export type GamepadLike = {
  axes?: ArrayLike<number>
  buttons?: ArrayLike<{ pressed?: boolean; value?: number } | number>
}

const EMPTY_BUTTONS: GamepadButtons = {
  south: false,
  east: false,
  west: false,
  north: false,
  leftBumper: false,
  rightBumper: false,
  leftTrigger: false,
  rightTrigger: false,
  dpadUp: false,
  dpadDown: false,
  dpadLeft: false,
  dpadRight: false,
}

export function emptyGamepadFrame(): GamepadFrame {
  return {
    connected: false,
    leftX: 0,
    leftY: 0,
    rightX: 0,
    rightY: 0,
    buttons: { ...EMPTY_BUTTONS },
    skillSlot: null,
  }
}

export function applyDeadzone(value: number, deadzone = GAMEPAD_DEADZONE): number {
  if (!Number.isFinite(value)) return 0
  return Math.abs(value) < deadzone ? 0 : value
}

function buttonPressed(
  buttons: ArrayLike<{ pressed?: boolean; value?: number } | number> | undefined,
  index: number
): boolean {
  if (!buttons || index >= buttons.length) return false
  const button = buttons[index]
  if (typeof button === 'number') return button > 0.5
  return Boolean(button?.pressed || (button?.value ?? 0) > 0.5)
}

export function readGamepad(pad: GamepadLike | null | undefined): GamepadFrame {
  if (!pad) return emptyGamepadFrame()

  const axes = pad.axes
  const leftX = applyDeadzone(axes && axes.length > 0 ? axes[0] : 0)
  const leftY = applyDeadzone(axes && axes.length > 1 ? axes[1] : 0)
  const rightX = applyDeadzone(axes && axes.length > 2 ? axes[2] : 0)
  const rightY = applyDeadzone(axes && axes.length > 3 ? axes[3] : 0)

  const buttons: GamepadButtons = {
    south: buttonPressed(pad.buttons, 0),
    east: buttonPressed(pad.buttons, 1),
    west: buttonPressed(pad.buttons, 2),
    north: buttonPressed(pad.buttons, 3),
    leftBumper: buttonPressed(pad.buttons, 4),
    rightBumper: buttonPressed(pad.buttons, 5),
    leftTrigger: buttonPressed(pad.buttons, 6),
    rightTrigger: buttonPressed(pad.buttons, 7),
    dpadUp: buttonPressed(pad.buttons, 12),
    dpadDown: buttonPressed(pad.buttons, 13),
    dpadLeft: buttonPressed(pad.buttons, 14),
    dpadRight: buttonPressed(pad.buttons, 15),
  }

  let skillSlot: number | null = null
  if (buttons.leftBumper) skillSlot = 1
  else if (buttons.rightBumper) skillSlot = 2
  else if (buttons.leftTrigger) skillSlot = 3
  else if (buttons.rightTrigger) skillSlot = 4
  else if (buttons.north) skillSlot = 5

  return {
    connected: true,
    leftX,
    leftY,
    rightX,
    rightY,
    buttons,
    skillSlot,
  }
}

export function movementFromStick(
  leftX: number,
  leftY: number,
  deadzone = GAMEPAD_DEADZONE
): { u: boolean; d: boolean; l: boolean; r: boolean } {
  return {
    u: leftY < -deadzone,
    d: leftY > deadzone,
    l: leftX < -deadzone,
    r: leftX > deadzone,
  }
}

export function pollFirstGamepad(
  pads: ArrayLike<GamepadLike | null> | null | undefined
): GamepadFrame {
  if (!pads) return emptyGamepadFrame()
  for (let i = 0; i < pads.length; i++) {
    const pad = pads[i]
    if (pad) return readGamepad(pad)
  }
  return emptyGamepadFrame()
}

/** Rising edge: fire once when a skill slot is newly held. */
export function skillSlotEdge(previous: number | null, next: number | null): number | null {
  if (next == null || next === previous) return null
  return next
}
