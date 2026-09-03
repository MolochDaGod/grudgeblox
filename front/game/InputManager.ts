import { ClientMessageType } from '@shared/network/client/base'
import { InputMessage } from '@shared/network/client/inputMessage'
import { IJoystickUpdateEvent } from 'react-joystick-component/build/lib/Joystick'
import { OrbitCameraFollowSystem } from './ecs/system'
import { WebSocketManager } from './WebsocketManager'
import { ProximityPromptSystem } from './ecs/system/ProximityPromptSystem'
import { Entity } from '@shared/entity/Entity'
import {
  emptyGamepadFrame,
  movementFromStick,
  pollFirstGamepad,
  skillSlotEdge,
  type GamepadFrame,
} from './gamepad'

export type PlayHudState = {
  pointerLocked: boolean
  gamepadConnected: boolean
  prompt: string | null
}

export class InputManager {
  pcUser: boolean = true
  gamepadConnected = false
  nearestPrompt: string | null = null
  inputState: InputMessage = {
    t: ClientMessageType.INPUT,
    u: false,
    d: false,
    l: false,
    r: false,
    s: false,
    y: 0,
    i: false,
  }
  proximityPromptSystem = new ProximityPromptSystem()

  private cameraFollowSystem: OrbitCameraFollowSystem
  private keys = { u: false, d: false, l: false, r: false, s: false, i: false }
  private lastSkillHeld: number | null = null
  private pendingSkill: number | null = null

  constructor(
    private webSocketManager: WebSocketManager,
    cameraFollowSystem: OrbitCameraFollowSystem
  ) {
    this.cameraFollowSystem = cameraFollowSystem
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
  }

  private isGameFocused(event: KeyboardEvent) {
    const target = event.target
    if (!(target instanceof HTMLElement)) return true
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false
    return target === document.body || Boolean(document.pointerLockElement)
  }

  public handleJoystickMove(joystick: IJoystickUpdateEvent) {
    if (this.pcUser) this.pcUser = false
    const joystickAngleRad = Math.atan2(joystick.x!, joystick.y!)
    const adjustedJoystickAngleRad = joystickAngleRad + this.cameraFollowSystem.y
    this.inputState.y = adjustedJoystickAngleRad
    this.inputState.u = true
  }

  update(entities: Entity[], dt: number) {
    const pad = this.readGamepad()
    this.gamepadConnected = pad.connected
    this.cameraFollowSystem.applyGamepadLook(pad.rightX, pad.rightY, Math.max(0, dt) / 1000)

    if (
      pad.connected &&
      (pad.leftX || pad.leftY || pad.rightX || pad.rightY || pad.buttons.south || pad.buttons.west)
    ) {
      this.pcUser = true
    }

    const stick = movementFromStick(pad.leftX, pad.leftY)
    const jump = this.keys.s || pad.buttons.south
    const interact = this.keys.i || pad.buttons.west

    if (this.pcUser) {
      this.inputState.u = this.keys.u || stick.u
      this.inputState.d = this.keys.d || stick.d
      this.inputState.l = this.keys.l || stick.l
      this.inputState.r = this.keys.r || stick.r
      this.inputState.y = this.cameraFollowSystem.y
    }
    this.inputState.s = jump
    this.inputState.i = interact

    const skill = skillSlotEdge(this.lastSkillHeld, pad.skillSlot)
    this.lastSkillHeld = pad.skillSlot
    if (skill != null) this.pendingSkill = skill

    this.nearestPrompt = this.proximityPromptSystem.getPromptText(entities)
    this.proximityPromptSystem.update(entities, dt)
  }

  consumeSkillSlot(): number | null {
    const slot = this.pendingSkill
    this.pendingSkill = null
    return slot
  }

  hudState(): PlayHudState {
    return {
      pointerLocked: this.cameraFollowSystem.pointerLocked,
      gamepadConnected: this.gamepadConnected,
      prompt: this.nearestPrompt,
    }
  }

  public handleJoystickStop(_joystick: IJoystickUpdateEvent) {
    this.inputState.u = false
  }

  setJump(on: boolean) {
    this.keys.s = on
    this.inputState.s = on
  }

  setInteract(on: boolean) {
    this.keys.i = on
    this.inputState.i = on
  }

  private readGamepad(): GamepadFrame {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return emptyGamepadFrame()
    }
    try {
      return pollFirstGamepad(navigator.getGamepads())
    } catch {
      return emptyGamepadFrame()
    }
  }

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (!this.pcUser) this.pcUser = true
    if (!this.isGameFocused(event)) return
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.u = true
        break
      case 'KeyS':
      case 'ArrowDown':
        this.keys.d = true
        break
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.l = true
        break
      case 'KeyD':
      case 'ArrowRight':
        this.keys.r = true
        break
      case 'Space':
        this.keys.s = true
        event.preventDefault()
        break
      case 'KeyE':
        this.keys.i = true
        break
    }
  }

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.u = false
        break
      case 'KeyS':
      case 'ArrowDown':
        this.keys.d = false
        break
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.l = false
        break
      case 'KeyD':
      case 'ArrowRight':
        this.keys.r = false
        break
      case 'Space':
        this.keys.s = false
        break
      case 'KeyE':
        this.keys.i = false
        break
    }
  }

  private previousInputState: InputMessage | null = null

  sendInput(entities: Entity[]) {
    if (
      !this.previousInputState ||
      !this.areInputStatesEqual(this.inputState, this.previousInputState)
    ) {
      this.webSocketManager.send(this.inputState)
      this.previousInputState = { ...this.inputState }

      if (this.inputState.i) {
        const message = this.proximityPromptSystem.getMessage(entities)
        if (message) this.webSocketManager.send(message)
      }
    }
  }

  private areInputStatesEqual(state1: InputMessage, state2: InputMessage): boolean {
    return (
      state1.u === state2.u &&
      state1.d === state2.d &&
      state1.l === state2.l &&
      state1.r === state2.r &&
      state1.s === state2.s &&
      state1.i === state2.i &&
      state1.y === state2.y
    )
  }
}
