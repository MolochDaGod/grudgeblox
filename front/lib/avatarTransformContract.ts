import * as THREE from 'three'
import {
  CANONICAL_CHARACTER_HEIGHT_M,
  CHARACTER_TRANSFORM_TOLERANCE,
} from '@shared/avatar/characterTransformContract'

type Vector3Tuple = [number, number, number]

export type AvatarTransformContract = {
  meshScale: Vector3Tuple
  presentationScale: Vector3Tuple
  presentationPosition: Vector3Tuple
  rigScale: Vector3Tuple
  canonicalWorldHeight: number
}

function tuple(vector: THREE.Vector3): Vector3Tuple {
  return [vector.x, vector.y, vector.z]
}

function matches(actual: THREE.Vector3, expected: Vector3Tuple): boolean {
  return (
    Math.abs(actual.x - expected[0]) <= CHARACTER_TRANSFORM_TOLERANCE &&
    Math.abs(actual.y - expected[1]) <= CHARACTER_TRANSFORM_TOLERANCE &&
    Math.abs(actual.z - expected[2]) <= CHARACTER_TRANSFORM_TOLERANCE
  )
}

export function captureAvatarTransformContract(
  meshRoot: THREE.Object3D,
  presentationRoot: THREE.Object3D,
  rigRoot: THREE.Object3D,
): AvatarTransformContract {
  return {
    meshScale: tuple(meshRoot.scale),
    presentationScale: tuple(presentationRoot.scale),
    presentationPosition: tuple(presentationRoot.position),
    rigScale: tuple(rigRoot.scale),
    canonicalWorldHeight: CANONICAL_CHARACTER_HEIGHT_M * meshRoot.scale.y,
  }
}

export function avatarTransformContractViolations(
  contract: AvatarTransformContract,
  meshRoot: THREE.Object3D,
  presentationRoot: THREE.Object3D,
  rigRoot: THREE.Object3D,
): string[] {
  const violations: string[] = []
  if (!matches(meshRoot.scale, contract.meshScale)) violations.push('mesh scale')
  if (!matches(presentationRoot.scale, contract.presentationScale)) {
    violations.push('presentation scale')
  }
  if (!matches(presentationRoot.position, contract.presentationPosition)) {
    violations.push('presentation contact position')
  }
  if (!matches(rigRoot.scale, contract.rigScale)) violations.push('rig scale')
  const worldHeight = CANONICAL_CHARACTER_HEIGHT_M * meshRoot.scale.y
  if (Math.abs(worldHeight - contract.canonicalWorldHeight) > CHARACTER_TRANSFORM_TOLERANCE) {
    violations.push('canonical world height')
  }
  return violations
}

export function enforceAvatarTransformContract(
  contract: AvatarTransformContract,
  meshRoot: THREE.Object3D,
  presentationRoot: THREE.Object3D,
  rigRoot: THREE.Object3D,
): string[] {
  const violations = avatarTransformContractViolations(
    contract,
    meshRoot,
    presentationRoot,
    rigRoot,
  )
  if (violations.length === 0) return violations
  meshRoot.scale.fromArray(contract.meshScale)
  presentationRoot.scale.fromArray(contract.presentationScale)
  presentationRoot.position.fromArray(contract.presentationPosition)
  rigRoot.scale.fromArray(contract.rigScale)
  meshRoot.updateMatrixWorld(true)
  return violations
}
