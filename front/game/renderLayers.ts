/**
 * Render/raycast layer contract for production play.
 *
 * Every Object3D carries a 32-bit layer mask. The camera renders what it can
 * see; each raycast picks only the layers it cares about, so camera wall
 * pull-in stops hitting avatars, foot IK stops planting on other players, and
 * projectiles hit world + hitboxes but not VFX.
 */
import * as THREE from 'three'

export const RENDER_LAYER = {
  /** Terrain, city plate, props, vehicles — anything the camera and feet collide with. */
  WORLD: 0,
  /** Avatar visuals (skinned meshes, weapons). Rendered, ignored by camera/IK rays. */
  PLAYER: 1,
  /** Invisible per-bone hitboxes. Never rendered; only projectile/melee rays. */
  HITBOX: 2,
  /** Skill VFX, impact flashes, flying projectiles. Rendered, never raycast. */
  FX: 3,
} as const

export type RenderLayerId = (typeof RENDER_LAYER)[keyof typeof RENDER_LAYER]

/** Layers the main camera must render. */
export const CAMERA_LAYERS: readonly RenderLayerId[] = [
  RENDER_LAYER.WORLD,
  RENDER_LAYER.PLAYER,
  RENDER_LAYER.FX,
]

export type RaycastPurpose = 'camera-collision' | 'foot-ik' | 'projectile' | 'melee'

export function raycastLayersFor(purpose: RaycastPurpose): readonly RenderLayerId[] {
  switch (purpose) {
    case 'camera-collision':
    case 'foot-ik':
      return [RENDER_LAYER.WORLD]
    case 'projectile':
      return [RENDER_LAYER.WORLD, RENDER_LAYER.HITBOX]
    case 'melee':
      return [RENDER_LAYER.HITBOX]
  }
}

export function layerMask(layers: readonly number[]): number {
  let mask = 0
  for (const layer of layers) mask |= 1 << layer
  return mask
}

export function setLayers(target: { layers: THREE.Layers }, layers: readonly number[]): void {
  target.layers.mask = layerMask(layers)
}

/**
 * Put an object tree on one layer. Hitboxes keep their HITBOX layer so
 * re-tagging an avatar after load does not hide them from weapon rays.
 */
export function assignLayerTree(root: THREE.Object3D, layer: RenderLayerId): void {
  root.traverse((object) => {
    if (object.userData.isHitbox) {
      object.layers.set(RENDER_LAYER.HITBOX)
      return
    }
    object.layers.set(layer)
  })
}

/** Meshes in `scene` that intersect any of `layers`. Cheap enough to cache per few frames. */
export function collectLayerMeshes(
  scene: THREE.Object3D,
  layers: readonly number[],
  options: { visibleOnly?: boolean; skip?: ReadonlySet<THREE.Object3D> } = {}
): THREE.Object3D[] {
  const probe = new THREE.Layers()
  probe.mask = layerMask(layers)
  const out: THREE.Object3D[] = []
  scene.traverse((object) => {
    if (!(object as THREE.Mesh).isMesh) return
    if (options.visibleOnly && !object.visible && !object.userData.isHitbox) return
    if (options.skip?.has(object)) return
    if (!object.layers.test(probe)) return
    out.push(object)
  })
  return out
}
