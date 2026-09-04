import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import {
  AvatarAnimator,
  CROSSFADE_S,
  crossfadeSeconds,
  normalizeLocomotionState,
  planLocomotion,
  resolveLocomotionClip,
} from './avatarAnimator'

const KIT_CLIPS = ['idle', 'walk', 'run', 'jump', 'sword_attack_a', 'dodge']

test('normalizes Notblox state strings', () => {
  assert.equal(normalizeLocomotionState('Walk'), 'Walk')
  assert.equal(normalizeLocomotionState('run'), 'Run')
  assert.equal(normalizeLocomotionState(undefined), 'Idle')
  assert.equal(normalizeLocomotionState('Sprint'), 'Idle')
})

test('resolves locomotion clips from what the GLB shipped', () => {
  assert.equal(resolveLocomotionClip(KIT_CLIPS, 'Walk'), 'walk')
  assert.equal(resolveLocomotionClip(KIT_CLIPS, 'Fall'), 'jump')
  assert.equal(resolveLocomotionClip(['gs_idle', 'gs_run'], 'Run'), 'gs_run')
  assert.equal(resolveLocomotionClip(['gs_idle', 'gs_run'], 'Walk'), 'gs_idle')
})

test('never T-poses into an attack when a rig lacks a jump clip', () => {
  assert.equal(resolveLocomotionClip(['idle', 'sword_attack_a'], 'Jump'), null)
  const plan = planLocomotion(['idle', 'sword_attack_a'], { state: 'Run', clip: 'idle' }, 'Jump')
  assert.deepEqual(plan, { kind: 'hold' })
})

test('landing eases longer than a grounded blend and air snaps', () => {
  assert.equal(crossfadeSeconds(null, 'Idle'), 0)
  assert.equal(crossfadeSeconds('Idle', 'Jump'), CROSSFADE_S.Jump)
  assert.equal(crossfadeSeconds('Fall', 'Idle'), CROSSFADE_S.Idle + 0.06)
  assert.equal(crossfadeSeconds('Walk', 'Run'), CROSSFADE_S.Run)
})

test('plans a play only when the state or clip actually changes', () => {
  const idle = planLocomotion(KIT_CLIPS, null, 'Idle')
  assert.equal(idle.kind, 'play')
  assert.deepEqual(planLocomotion(KIT_CLIPS, { state: 'Idle', clip: 'idle' }, 'Idle'), { kind: 'noop' })
  const run = planLocomotion(KIT_CLIPS, { state: 'Walk', clip: 'walk' }, 'Run')
  assert.equal(run.kind, 'play')
  if (run.kind === 'play') {
    assert.equal(run.clip, 'run')
    assert.equal(run.loop, 'repeat')
    assert.equal(run.timeScale, 1.05)
  }
  const death = planLocomotion(KIT_CLIPS, { state: 'Run', clip: 'run' }, 'Death')
  if (death.kind === 'play') assert.equal(death.loop, 'once')
})

function rig() {
  const root = new THREE.Object3D()
  root.name = 'rig'
  const clips = KIT_CLIPS.map(
    (name) =>
      new THREE.AnimationClip(name, 0.5, [
        new THREE.NumberKeyframeTrack('rig.position[x]', [0, 0.5], [0, 1]),
      ])
  )
  const mixer = new THREE.AnimationMixer(root)
  return { root, clips, mixer }
}

test('AvatarAnimator crossfades locomotion and returns from a one-shot', () => {
  const { clips, mixer } = rig()
  const animator = new AvatarAnimator(mixer, clips)
  animator.setState('Idle')
  assert.equal(animator.state, 'Idle')
  assert.equal(animator.currentClipName, 'idle')

  animator.setState('Run')
  assert.equal(animator.state, 'Run')
  animator.update(0.3)
  const runAction = mixer.clipAction(clips.find((c) => c.name === 'run')!)
  assert.ok(runAction.isRunning())

  assert.equal(animator.playOneShot(['sword_attack_a']), true)
  assert.equal(animator.oneShotActive, true)
  const attack = mixer.clipAction(clips.find((c) => c.name === 'sword_attack_a')!)
  assert.ok(attack.isRunning())
  // Attack clip is 0.5 s; step past it so the mixer emits finished.
  animator.update(0.4)
  animator.update(0.4)
  assert.equal(animator.oneShotActive, false)
  assert.equal(animator.state, 'Run')
  assert.ok(runAction.isRunning())

  assert.equal(animator.playOneShot(['no_such_clip']), false)
  animator.dispose()
})
