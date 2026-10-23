/**
 * Production avatar animator on top of THREE.AnimationMixer.
 *
 * One locomotion action at a time (Idle / Walk / Run / Jump / Fall / Death)
 * with state-aware crossfades, plus a one-shot overlay lane for attacks that
 * hands control back to locomotion when the clip finishes. The planning
 * functions are pure so they can be unit-tested without WebGL.
 */
import * as THREE from 'three'
import { clipNameForState } from '../lib/fourCharacterKit'

export type LocomotionState = 'Idle' | 'Walk' | 'Run' | 'Jump' | 'Fall' | 'Death'

const LOCOMOTION_STATES: readonly LocomotionState[] = ['Idle', 'Walk', 'Run', 'Jump', 'Fall', 'Death']

/** Seconds to blend INTO a state. Airborne states snap, grounded ones ease. */
export const CROSSFADE_S: Record<LocomotionState, number> = {
  Idle: 0.24,
  Walk: 0.18,
  Run: 0.14,
  Jump: 0.08,
  Fall: 0.12,
  Death: 0.2,
}

export const ONE_SHOT_FADE_IN_S = 0.05
export const ONE_SHOT_FADE_OUT_S = 0.14

export function normalizeLocomotionState(raw: unknown): LocomotionState {
  const s = String(raw ?? 'Idle')
  const hit = LOCOMOTION_STATES.find((state) => state.toLowerCase() === s.toLowerCase())
  return hit ?? 'Idle'
}

export function crossfadeSeconds(from: LocomotionState | null, to: LocomotionState): number {
  if (from === null) return 0
  // Landing from air onto a grounded clip should settle a touch slower than the
  // grounded blend itself so the impact reads.
  const airborne = from === 'Jump' || from === 'Fall'
  const grounded = to === 'Idle' || to === 'Walk' || to === 'Run'
  return airborne && grounded ? CROSSFADE_S[to] + 0.06 : CROSSFADE_S[to]
}

export function loopModeFor(state: LocomotionState): 'repeat' | 'once' {
  return state === 'Death' ? 'once' : 'repeat'
}

export function timeScaleFor(state: LocomotionState): number {
  return state === 'Run' ? 1.05 : 1
}

/**
 * Pick the clip name for a state from what the GLB actually shipped. Never
 * falls back to an arbitrary first clip for airborne states: no jump clip
 * means we hold the current locomotion pose instead of T-posing into a random
 * attack animation.
 */
export function resolveLocomotionClip(
  clipNames: readonly string[],
  state: LocomotionState
): string | null {
  if (clipNames.length === 0) return null
  const lower = clipNames.map((name) => ({ name, n: name.toLowerCase() }))
  const wanted = clipNameForState(state).map((w) => w.toLowerCase())
  for (const w of wanted) {
    const exact = lower.find((c) => c.n === w)
    if (exact) return exact.name
  }
  for (const w of wanted) {
    const part = lower.find((c) => c.n.includes(w))
    if (part) return part.name
  }
  if (state === 'Jump' || state === 'Fall' || state === 'Death') return null
  const idle = lower.find((c) => c.n.includes('idle'))
  return idle?.name ?? clipNames[0]
}

export type LocomotionPlan =
  | { kind: 'noop' }
  | { kind: 'hold' }
  | { kind: 'play'; clip: string; fadeIn: number; fadeOutPrevious: number; loop: 'repeat' | 'once'; timeScale: number }

export function planLocomotion(
  clipNames: readonly string[],
  current: { state: LocomotionState; clip: string } | null,
  next: LocomotionState
): LocomotionPlan {
  const clip = resolveLocomotionClip(clipNames, next)
  if (!clip) return current ? { kind: 'hold' } : { kind: 'noop' }
  if (current && current.state === next && current.clip === clip) return { kind: 'noop' }
  const fade = crossfadeSeconds(current?.state ?? null, next)
  return {
    kind: 'play',
    clip,
    fadeIn: fade,
    fadeOutPrevious: current ? fade : 0,
    loop: loopModeFor(next),
    timeScale: timeScaleFor(next),
  }
}

type MixerFinishedEvent = { action: THREE.AnimationAction }

export class AvatarAnimator {
  readonly mixer: THREE.AnimationMixer
  private clips: THREE.AnimationClip[]
  private clipNames: string[]
  private current: { state: LocomotionState; clip: string; action: THREE.AnimationAction } | null = null
  private oneShot: THREE.AnimationAction | null = null
  private readonly onFinished = (event: unknown) => {
    const finished = (event as MixerFinishedEvent).action
    if (finished !== this.oneShot) return
    this.endOneShot()
  }

  constructor(mixer: THREE.AnimationMixer, clips: THREE.AnimationClip[]) {
    this.mixer = mixer
    this.clips = clips
    this.clipNames = clips.map((clip) => clip.name)
    this.mixer.addEventListener('finished', this.onFinished)
  }

  get state(): LocomotionState | null {
    return this.current?.state ?? null
  }

  get currentClipName(): string | null {
    return this.current?.clip ?? null
  }

  get oneShotActive(): boolean {
    return this.oneShot !== null
  }

  setClips(clips: THREE.AnimationClip[]): void {
    this.clips = clips
    this.clipNames = clips.map((clip) => clip.name)
  }

  setState(raw: unknown): void {
    const next = normalizeLocomotionState(raw)
    const plan = planLocomotion(
      this.clipNames,
      this.current ? { state: this.current.state, clip: this.current.clip } : null,
      next
    )
    if (plan.kind !== 'play') return
    const clip = this.clips.find((c) => c.name === plan.clip)
    if (!clip) return

    const action = this.mixer.clipAction(clip)
    action.enabled = true
    action.setEffectiveTimeScale(plan.timeScale)
    action.setEffectiveWeight(1)
    if (plan.loop === 'once') {
      action.setLoop(THREE.LoopOnce, 1)
      action.clampWhenFinished = true
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.clampWhenFinished = false
    }

    const previous = this.current?.action
    if (previous && previous !== action) {
      action.reset()
      action.play()
      previous.crossFadeTo(action, plan.fadeIn, true)
    } else {
      action.reset().fadeIn(plan.fadeIn).play()
    }
    // While an attack overlay is active the locomotion lane stays faded down.
    if (this.oneShot) action.setEffectiveWeight(0.35)
    this.current = { state: next, clip: plan.clip, action }
  }

  /** Attack / emote overlay. Returns false when none of the names exist on this rig. */
  playOneShot(wanted: readonly string[]): boolean {
    const lower = this.clipNames.map((name) => ({ name, n: name.toLowerCase() }))
    let name: string | null = null
    for (const w of wanted) {
      const hit = lower.find((c) => c.n === w.toLowerCase()) || lower.find((c) => c.n.includes(w.toLowerCase()))
      if (hit) {
        name = hit.name
        break
      }
    }
    if (!name) return false
    const clip = this.clips.find((c) => c.name === name)
    if (!clip) return false

    if (this.oneShot) {
      this.oneShot.fadeOut(ONE_SHOT_FADE_OUT_S)
    }
    const action = this.mixer.clipAction(clip)
    action.enabled = true
    action.setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = false
    action.setEffectiveTimeScale(1)
    action.setEffectiveWeight(1)
    action.reset().fadeIn(ONE_SHOT_FADE_IN_S).play()
    this.oneShot = action
    this.current?.action.setEffectiveWeight(0.35)
    return true
  }

  private endOneShot(): void {
    if (!this.oneShot) return
    this.oneShot.fadeOut(ONE_SHOT_FADE_OUT_S)
    this.oneShot = null
    if (this.current) {
      this.current.action.enabled = true
      this.current.action.setEffectiveWeight(1)
      if (this.current.action.getEffectiveWeight() < 0.99) {
        this.current.action.fadeIn(ONE_SHOT_FADE_OUT_S)
      }
    }
  }

  update(dtSeconds: number): void {
    this.mixer.update(Math.max(0, dtSeconds))
  }

  dispose(): void {
    this.mixer.removeEventListener('finished', this.onFinished)
    this.mixer.stopAllAction()
    this.current = null
    this.oneShot = null
  }
}
