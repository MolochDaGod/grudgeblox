/**
 * Foot IK lite — concepts from hh-hang/three-player-controller foot-ik plugin
 * + GrudgeBuilder CharacterIK two-bone solver.
 *
 * Plants feet on ground via raycast after locomotion FK.
 * Prefer Bip001 / Mixamo leg chains. Weight fades when airborne.
 */
import * as THREE from 'three'
import { layerMask, raycastLayersFor } from '@/game/renderLayers'

export type FootSide = 'left' | 'right'

export interface FootIkLiteOptions {
  enabled?: boolean
  /** Max foot raise/drop (m) */
  maxStep: number
  /** Blend weight 0–1 */
  weight: number
  rayOriginY: number
  rayFar: number
  /** Hip drop to help plant (m) */
  maxHipDrop: number
}

const DEFAULTS: FootIkLiteOptions = {
  enabled: true,
  maxStep: 0.35,
  weight: 1,
  rayOriginY: 1.2,
  rayFar: 2.2,
  maxHipDrop: 0.12,
}

const LEFT_CHAIN = {
  upper: ['Bip001 L Thigh', 'mixamorigLeftUpLeg', 'LeftUpLeg'],
  lower: ['Bip001 L Calf', 'mixamorigLeftLeg', 'LeftLeg'],
  foot: ['Bip001 L Foot', 'mixamorigLeftFoot', 'LeftFoot'],
}

const RIGHT_CHAIN = {
  upper: ['Bip001 R Thigh', 'mixamorigRightUpLeg', 'RightUpLeg'],
  lower: ['Bip001 R Calf', 'mixamorigRightLeg', 'RightLeg'],
  foot: ['Bip001 R Foot', 'mixamorigRightFoot', 'RightFoot'],
}

function find(root: THREE.Object3D, names: string[]): THREE.Bone | null {
  for (const n of names) {
    const o = root.getObjectByName(n)
    if (o && (o as THREE.Bone).isBone) return o as THREE.Bone
  }
  return null
}

/**
 * Geometric two-bone IK (cosine rule) — same approach as CharacterIK / foot-ik internal.
 */
export function solveTwoBoneIK(
  boneA: THREE.Bone,
  boneB: THREE.Bone,
  boneC: THREE.Bone,
  target: THREE.Vector3,
  pole: THREE.Vector3,
  weight = 1,
): void {
  if (weight <= 0) return
  const posA = new THREE.Vector3()
  const posB = new THREE.Vector3()
  const posC = new THREE.Vector3()
  boneA.getWorldPosition(posA)
  boneB.getWorldPosition(posB)
  boneC.getWorldPosition(posC)

  const lenAB = posA.distanceTo(posB)
  const lenBC = posB.distanceTo(posC)
  let lenAT = posA.distanceTo(target)
  const maxR = lenAB + lenBC - 0.001
  const minR = Math.abs(lenAB - lenBC) + 0.001
  lenAT = THREE.MathUtils.clamp(lenAT, minR, maxR)

  const cosA = (lenAB * lenAB + lenAT * lenAT - lenBC * lenBC) / (2 * lenAB * lenAT)
  const angleA = Math.acos(THREE.MathUtils.clamp(cosA, -1, 1))
  const cosB = (lenAB * lenAB + lenBC * lenBC - lenAT * lenAT) / (2 * lenAB * lenBC)
  const angleB = Math.acos(THREE.MathUtils.clamp(cosB, -1, 1))

  // Axis from pole
  const axis = new THREE.Vector3().subVectors(pole, posA).cross(new THREE.Vector3().subVectors(target, posA)).normalize()
  if (axis.lengthSq() < 1e-6) axis.set(0, 0, 1)

  const qA = new THREE.Quaternion().setFromAxisAngle(axis, angleA - Math.PI / 2)
  const qB = new THREE.Quaternion().setFromAxisAngle(axis, Math.PI - angleB)

  boneA.quaternion.slerp(boneA.quaternion.clone().multiply(qA), weight)
  boneB.quaternion.slerp(boneB.quaternion.clone().multiply(qB), weight)
  boneA.updateMatrixWorld(true)
  boneB.updateMatrixWorld(true)
}

export class FootIkLite {
  root: THREE.Object3D
  opts: FootIkLiteOptions
  private ray = new THREE.Raycaster()
  private grounded = true
  enabled: boolean

  constructor(avatarRoot: THREE.Object3D, opts?: Partial<FootIkLiteOptions>) {
    this.root = avatarRoot
    this.opts = { ...DEFAULTS, ...opts }
    this.enabled = this.opts.enabled !== false
    this.ray.layers.mask = layerMask(raycastLayersFor('foot-ik'))
  }

  setGrounded(on: boolean) {
    this.grounded = on
  }

  /**
   * Call AFTER animation mixer update each frame.
   * colliders = terrain / city meshes for sole raycast.
   */
  update(colliders: THREE.Object3D[], dt: number) {
    if (!this.enabled || !this.grounded || colliders.length === 0) return
    const w = this.opts.weight
    this.plant(LEFT_CHAIN, colliders, w)
    this.plant(RIGHT_CHAIN, colliders, w)
    void dt
  }

  private plant(
    chain: { upper: string[]; lower: string[]; foot: string[] },
    colliders: THREE.Object3D[],
    weight: number,
  ) {
    const upper = find(this.root, chain.upper)
    const lower = find(this.root, chain.lower)
    const foot = find(this.root, chain.foot)
    if (!upper || !lower || !foot) return

    const footPos = new THREE.Vector3()
    foot.getWorldPosition(footPos)
    const origin = footPos.clone()
    origin.y += this.opts.rayOriginY
    this.ray.set(origin, new THREE.Vector3(0, -1, 0))
    this.ray.far = this.opts.rayFar
    const hits = this.ray.intersectObjects(colliders, true)
    if (!hits.length) return

    const groundY = hits[0].point.y
    const delta = THREE.MathUtils.clamp(groundY - footPos.y, -this.opts.maxStep, this.opts.maxStep)
    if (Math.abs(delta) < 0.005) return

    const target = footPos.clone()
    target.y += delta
    const pole = footPos.clone().add(new THREE.Vector3(0, 0, chain === LEFT_CHAIN ? 0.3 : -0.3))
    // lightweight: offset foot bone local Y instead of full IK when chain incomplete
    try {
      solveTwoBoneIK(upper, lower, foot, target, pole, weight * 0.65)
    } catch {
      foot.position.y += delta * weight * 0.5
    }
  }
}
