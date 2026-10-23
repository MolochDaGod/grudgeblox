import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import {
  avatarTransformContractViolations,
  captureAvatarTransformContract,
  enforceAvatarTransformContract,
} from './avatarTransformContract'

function fixture() {
  const meshRoot = new THREE.Group()
  const presentationRoot = new THREE.Group()
  const rigRoot = new THREE.Group()
  meshRoot.add(presentationRoot)
  presentationRoot.add(rigRoot)
  presentationRoot.scale.setScalar(0.1)
  presentationRoot.position.y = -1.638
  rigRoot.scale.setScalar(0.9)
  meshRoot.updateMatrixWorld(true)
  return { meshRoot, presentationRoot, rigRoot }
}

test('action 1 cannot persistently replace the canonical player scale', () => {
  const { meshRoot, presentationRoot, rigRoot } = fixture()
  const contract = captureAvatarTransformContract(meshRoot, presentationRoot, rigRoot)
  assert.equal(contract.canonicalWorldHeight, 1.8)

  meshRoot.scale.setScalar(0.5)
  assert.deepEqual(
    avatarTransformContractViolations(contract, meshRoot, presentationRoot, rigRoot),
    ['mesh scale', 'canonical world height'],
  )
  enforceAvatarTransformContract(contract, meshRoot, presentationRoot, rigRoot)
  assert.deepEqual(
    avatarTransformContractViolations(contract, meshRoot, presentationRoot, rigRoot),
    [],
  )
})

test('all five action slots, fades, and idle preserve scale and contact position', () => {
  for (let slot = 1; slot <= 5; slot += 1) {
    const { meshRoot, presentationRoot, rigRoot } = fixture()
    const contract = captureAvatarTransformContract(meshRoot, presentationRoot, rigRoot)
    const clip = new THREE.AnimationClip(`slot_${slot}`, 1, [
      new THREE.VectorKeyframeTrack(
        '.scale',
        [0, 0.5, 1],
        [0.9, 0.9, 0.9, 0.45, 0.45, 0.45, 0.9, 0.9, 0.9],
      ),
    ])
    const mixer = new THREE.AnimationMixer(rigRoot)
    const action = mixer.clipAction(clip)
    action.play()

    for (const dt of [0.25, 0.25, 0.25, 0.25]) {
      mixer.update(dt)
      enforceAvatarTransformContract(contract, meshRoot, presentationRoot, rigRoot)
      assert.deepEqual(
        avatarTransformContractViolations(contract, meshRoot, presentationRoot, rigRoot),
        [],
        `slot ${slot} preserves its canonical transform`,
      )
    }

    action.fadeOut(0.1)
    mixer.update(0.2)
    mixer.stopAllAction()
    presentationRoot.position.y += 0.25
    enforceAvatarTransformContract(contract, meshRoot, presentationRoot, rigRoot)
    assert.deepEqual(
      avatarTransformContractViolations(contract, meshRoot, presentationRoot, rigRoot),
      [],
      `slot ${slot} returns to idle at the same contact plane`,
    )
  }
})
