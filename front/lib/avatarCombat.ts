/**
 * Avatar combat — patterns from hh-hang/three-player-controller multiplayer-gltf + shooting:
 *  - Per-bone hitboxes (head/torso/arms/legs) with damage multipliers
 *  - Ray projectiles (camera/muzzle → impact) not mesh-only balls
 *  - Melee weapon colliders active only during skill active frames
 *  - Soft aim / hard fire separation-ready hooks
 *
 * Fleet: grudge6 Bip001 bones preferred; Mixamo names as fallback.
 */
import * as THREE from 'three'

export type HitPart = 'head' | 'torso' | 'arm' | 'leg' | 'body'

export interface HitboxDef {
  /** Preferred bone names (first found wins) */
  bones: string[]
  w: number
  h: number
  d: number
  /** Local Y offset on bone */
  oy: number
  part: HitPart
  dmg: number
}

/** Multiplayer-gltf HITBOX_DEFS scaled to SI human (~1.8 m) */
export const AVATAR_HITBOX_DEFS: HitboxDef[] = [
  {
    bones: ['Bip001 Head', 'mixamorigHead', 'Head'],
    w: 0.22,
    h: 0.24,
    d: 0.22,
    oy: 0.08,
    part: 'head',
    dmg: 2.0,
  },
  {
    bones: ['Bip001 Spine2', 'Bip001 Spine1', 'mixamorigSpine2', 'Spine2', 'spine'],
    w: 0.38,
    h: 0.45,
    d: 0.24,
    oy: -0.05,
    part: 'torso',
    dmg: 1.0,
  },
  {
    bones: ['Bip001 L UpperArm', 'mixamorigLeftArm', 'LeftArm'],
    w: 0.12,
    h: 0.35,
    d: 0.12,
    oy: 0.15,
    part: 'arm',
    dmg: 0.75,
  },
  {
    bones: ['Bip001 R UpperArm', 'mixamorigRightArm', 'RightArm'],
    w: 0.12,
    h: 0.35,
    d: 0.12,
    oy: 0.15,
    part: 'arm',
    dmg: 0.75,
  },
  {
    bones: ['Bip001 L Thigh', 'mixamorigLeftUpLeg', 'LeftUpLeg'],
    w: 0.14,
    h: 0.4,
    d: 0.14,
    oy: 0.18,
    part: 'leg',
    dmg: 0.75,
  },
  {
    bones: ['Bip001 R Thigh', 'mixamorigRightUpLeg', 'RightUpLeg'],
    w: 0.14,
    h: 0.4,
    d: 0.14,
    oy: 0.18,
    part: 'leg',
    dmg: 0.75,
  },
]

export const HITBOX_LAYER = 2

function findBone(root: THREE.Object3D, names: string[]): THREE.Object3D | null {
  for (const n of names) {
    const b = root.getObjectByName(n)
    if (b) return b
  }
  return null
}

export interface AttachedHitbox {
  mesh: THREE.Mesh
  part: HitPart
  dmg: number
}

/**
 * Attach invisible hitbox meshes to skeleton bones (multiplayer-gltf pattern).
 * Enable layer 2 for weapon raycasts.
 */
export function attachAvatarHitboxes(
  avatarRoot: THREE.Object3D,
  opts?: { debug?: boolean; playerId?: string },
): AttachedHitbox[] {
  const out: AttachedHitbox[] = []
  const mat = opts?.debug
    ? new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true })
    : new THREE.MeshBasicMaterial({
        colorWrite: false,
        depthWrite: false,
        transparent: true,
        opacity: 0,
      })

  for (const def of AVATAR_HITBOX_DEFS) {
    const bone = findBone(avatarRoot, def.bones)
    if (!bone) continue
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(def.w, def.h, def.d), mat.clone())
    mesh.position.set(0, def.oy, 0)
    mesh.userData.hitPart = def.part
    mesh.userData.dmgMult = def.dmg
    mesh.userData.playerId = opts?.playerId ?? 'local'
    mesh.userData.isHitbox = true
    mesh.layers.set(0)
    mesh.layers.enable(HITBOX_LAYER)
    mesh.visible = !!opts?.debug
    bone.add(mesh)
    out.push({ mesh, part: def.part, dmg: def.dmg })
  }
  return out
}

/** Melee weapon collider — sphere at hand bone, only while skill active */
export function createWeaponCollider(radius = 0.28): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 8, 8),
    new THREE.MeshBasicMaterial({
      color: 0xff4444,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  )
  mesh.name = 'weapon_collider'
  mesh.visible = false
  mesh.userData.isWeaponCollider = true
  return mesh
}

export function attachWeaponColliderToHand(
  avatarRoot: THREE.Object3D,
  collider: THREE.Mesh,
): boolean {
  const hand =
    findBone(avatarRoot, [
      'R_hand_container',
      'Bip001 R Hand',
      'mixamorigRightHand',
      'RightHand',
    ]) || null
  if (!hand) return false
  hand.add(collider)
  collider.position.set(0, 0.05, 0.15)
  return true
}

export interface RayHitResult {
  point: THREE.Vector3
  normal: THREE.Vector3
  distance: number
  object: THREE.Object3D
  part?: HitPart
  dmgMult: number
  playerId?: string
  isAvatar: boolean
}

/**
 * Fire a hitscan/ray projectile from origin along direction.
 * Checks layer 0 solids + layer 2 hitboxes (multiplayer-gltf WeaponController style).
 */
export function raycastProjectile(
  raycaster: THREE.Raycaster,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  targets: THREE.Object3D[],
  maxDist = 40,
): RayHitResult | null {
  raycaster.set(origin, direction.clone().normalize())
  raycaster.far = maxDist
  raycaster.near = 0.05
  // Include all layers for mixed solids + hitboxes
  raycaster.layers.enableAll()

  const hits = raycaster.intersectObjects(targets, true)
  for (const h of hits) {
    if (!h.object.visible && !h.object.userData.isHitbox) continue
    if (h.object.userData.isWeaponCollider) continue
    return {
      point: h.point.clone(),
      normal: (h.face?.normal?.clone() ?? new THREE.Vector3(0, 1, 0)).transformDirection(
        h.object.matrixWorld,
      ),
      distance: h.distance,
      object: h.object,
      part: h.object.userData.hitPart as HitPart | undefined,
      dmgMult: typeof h.object.userData.dmgMult === 'number' ? h.object.userData.dmgMult : 1,
      playerId: h.object.userData.playerId as string | undefined,
      isAvatar: !!h.object.userData.isHitbox,
    }
  }
  return null
}

/** Visual projectile that flies then ray-checks near end (hybrid for feel) */
export class FlyingProjectile {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  life: number
  maxLife: number
  damage: number
  color: string
  from: THREE.Vector3
  done = false

  constructor(opts: {
    from: THREE.Vector3
    dir: THREE.Vector3
    speed: number
    color: string
    damage: number
    maxLife?: number
  }) {
    this.from = opts.from.clone()
    this.velocity = opts.dir.clone().normalize().multiplyScalar(opts.speed)
    this.damage = opts.damage
    this.color = opts.color
    this.maxLife = opts.maxLife ?? 1.2
    this.life = 0
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: opts.color }),
    )
    this.mesh.position.copy(opts.from)
  }

  update(dt: number, raycaster: THREE.Raycaster, targets: THREE.Object3D[]): RayHitResult | null {
    if (this.done) return null
    const prev = this.mesh.position.clone()
    this.mesh.position.addScaledVector(this.velocity, dt)
    this.life += dt
    const step = this.mesh.position.clone().sub(prev)
    const dist = step.length()
    if (dist > 1e-4) {
      const hit = raycastProjectile(raycaster, prev, step, targets, dist + 0.05)
      if (hit) {
        this.done = true
        return hit
      }
    }
    if (this.life >= this.maxLife) this.done = true
    return null
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}

export function baseDamageForSkill(skillId: string): number {
  switch (skillId) {
    case 'slash':
      return 18
    case 'smash':
      return 32
    case 'bolt':
      return 22
    case 'shot':
      return 16
    case 'guard':
      return 0
    default:
      return 12
  }
}
