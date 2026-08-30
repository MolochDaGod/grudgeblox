/**
 * Load Grudge fleet avatar GLB for local player visual (metaverse deploy).
 * Physics / network body stays Notblox ECS; we only replace the Three mesh look.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
// three@0.183: examples/jsm path is supported via package exports
import { raceCdnUrl, FLEET } from './fleetConfig'
import type { FleetCharacter } from './fleetCharacters'
import {
  getAvatarSourceOrientation,
  getAvatarVisualCorrection,
} from './avatarVisualProfile'
import { avatarAppearanceSig, isKitUrl, kitRaceUrl, kitWeaponUrl } from './fourCharacterKit'
import {
  attachAvatarHitboxes,
  attachWeaponColliderToHand,
  createWeaponCollider,
} from './avatarCombat'
import { FootIkLite } from './footIkLite'

const TARGET_HEIGHT_M = 1.8

export type AvatarLoadContext = {
  worldSlug?: string
}

export type AvatarTransformBounds = {
  before: { minY: number; maxY: number; height: number }
  after: { minY: number; maxY: number; height: number }
  heightRatio: number
  topDelta: number
  bottomDelta: number
  intendedGroundY: number
  worldTranslationY: number
  yawRadians: number
  effectiveVisualYawRadians: number
  visualScale: [number, number, number]
}

function makeLoader(): GLTFLoader {
  const loader = new GLTFLoader()
  const draco = new DRACOLoader()
  draco.setDecoderPath('/draco/gltf/')
  loader.setDRACOLoader(draco)
  return loader
}

function fitHeight(root: THREE.Object3D, targetH = TARGET_HEIGHT_M) {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  const size = box.getSize(new THREE.Vector3())
  if (size.y < 1e-4) return
  const s = targetH / size.y
  root.scale.multiplyScalar(s)
  root.updateMatrixWorld(true)
  const box2 = new THREE.Box3().setFromObject(root)
  root.position.y -= box2.min.y
}

export function resolveAvatarUrl(character: FleetCharacter): string {
  if (character.model3d) {
    if (character.model3d.startsWith('http')) return character.model3d
    if (character.model3d.startsWith('/kit/')) return character.model3d
    if (character.model3d.startsWith('races/')) return `/kit/4character/${character.model3d}`
    if (character.model3d.startsWith('/')) return character.model3d
    return `${FLEET.assets}/${character.model3d.replace(/^\//, '')}`
  }
  return kitRaceUrl(character.raceId) || raceCdnUrl(character.raceId)
}

function resolveUrl(character: FleetCharacter): string {
  return resolveAvatarUrl(character)
}

function findBone(root: THREE.Object3D, names: string[]): THREE.Object3D | null {
  const want = names.map((n) => n.toLowerCase())
  let found: THREE.Object3D | null = null
  root.traverse((o) => {
    if (found) return
    const n = (o.name || '').toLowerCase()
    if (want.some((w) => n === w || n.endsWith(w))) found = o
  })
  return found
}

function applySourceOrientation(
  scene: THREE.Object3D,
  clips: THREE.AnimationClip[],
  modelUrl: string,
) {
  const profile = getAvatarSourceOrientation(modelUrl)
  if (!profile) return

  const roots: THREE.Object3D[] = []
  scene.traverse((object) => {
    if (object.name === profile.rootNodeName) roots.push(object)
  })
  if (roots.length !== 1) {
    throw new Error(`${profile.sourceId} expected one ${profile.rootNodeName}; found ${roots.length}`)
  }

  const sourceRoot = roots[0]
  if (
    clips.some((clip) =>
      clip.tracks.some((track) => track.name.split('.')[0] === sourceRoot.name)
    )
  ) {
    throw new Error(`${profile.rootNodeName} is animated and cannot be the orientation seam`)
  }

  // Root_normalized already parents the original skeleton and skinned meshes.
  // Rotate this stable source adapter before binding the unchanged mixer.
  sourceRoot.rotation.y += profile.yawRadians
  sourceRoot.userData.sourceOrientation = profile
}

function yBounds(root: THREE.Object3D) {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  return {
    minY: box.min.y,
    maxY: box.max.y,
    height: box.max.y - box.min.y,
    center: box.getCenter(new THREE.Vector3()),
  }
}

function applyTopAnchoredVisualCorrection(
  root: THREE.Group,
  visual: THREE.Object3D,
  correction: ReturnType<typeof getAvatarVisualCorrection>,
): AvatarTransformBounds | undefined {
  if (correction.verticalScale === 1 && correction.yawRadians === 0) return undefined

  const before = yBounds(root)
  if (!Number.isFinite(before.height) || before.height < 1e-4) {
    throw new Error('Cannot correct avatar visual with empty bounds')
  }

  const pivot = new THREE.Group()
  pivot.name = 'lobby_guest_visual_correction'
  const centerInRoot = root.worldToLocal(before.center.clone())
  pivot.position.copy(centerInRoot)
  root.add(pivot)
  pivot.updateMatrixWorld(true)
  pivot.attach(visual)

  pivot.rotation.y = correction.yawRadians
  pivot.scale.set(1, correction.verticalScale, 1)
  const scaled = yBounds(root)

  let worldTranslationY = 0
  if (correction.preserveTop) {
    worldTranslationY = before.maxY - scaled.maxY
    const rootWorldScaleY = root.getWorldScale(new THREE.Vector3()).y
    if (Math.abs(rootWorldScaleY) < 1e-6) {
      throw new Error('Cannot top-anchor avatar visual under zero vertical scale')
    }
    pivot.position.y += worldTranslationY / rootWorldScaleY
  }

  const after = yBounds(root)
  const expectedHeight = before.height * correction.verticalScale
  const intendedGroundY = before.minY - before.height
  const tolerance = Math.max(1e-4, before.height * 1e-4)
  if (
    Math.abs(after.height - expectedHeight) > tolerance ||
    Math.abs(after.maxY - before.maxY) > tolerance ||
    Math.abs(after.minY - intendedGroundY) > tolerance
  ) {
    throw new Error('Avatar visual correction failed its bounds invariant')
  }

  return {
    before: { minY: before.minY, maxY: before.maxY, height: before.height },
    after: { minY: after.minY, maxY: after.maxY, height: after.height },
    heightRatio: after.height / before.height,
    topDelta: after.maxY - before.maxY,
    bottomDelta: after.minY - before.minY,
    intendedGroundY,
    worldTranslationY,
    yawRadians: correction.yawRadians,
    effectiveVisualYawRadians: pivot.rotation.y + visual.rotation.y,
    visualScale: [1, correction.verticalScale, 1],
  }
}

export type LoadedAvatar = {
  root: THREE.Group
  weaponCollider: THREE.Mesh
  footIk: FootIkLite
  hitboxCount: number
  transformBounds?: AvatarTransformBounds
  clips: THREE.AnimationClip[]
  mixer: THREE.AnimationMixer
}

/**
 * Load avatar root group (feet on origin) + hitboxes + weapon collider + foot IK.
 */
export async function loadGrudgeAvatar(
  character: FleetCharacter,
  context: AvatarLoadContext = {},
): Promise<LoadedAvatar> {
  const url = resolveUrl(character)
  const loader = makeLoader()
  const gltf = await loader.loadAsync(url)
  const root = new THREE.Group()
  root.name = `grudge_avatar_${character.id}`
  root.userData.characterId = character.id
  root.userData.raceId = character.raceId
  root.userData.kitUrl = url
  root.add(gltf.scene)
  const clips = gltf.animations?.length ? gltf.animations : []
  applySourceOrientation(gltf.scene, clips, url)
  // Bundled race yaw is handled by its source profile above. Legacy grudge6
  // Toon assets keep their existing +π/2 rule.
  if (!isKitUrl(url)) {
    gltf.scene.rotation.y = Math.PI / 2
  }
  fitHeight(root, TARGET_HEIGHT_M)

  const mixer = new THREE.AnimationMixer(gltf.scene)

  try {
    const weaponUrl = kitWeaponUrl(character.classId)
    const weaponGltf = await loader.loadAsync(weaponUrl)
    const hand = findBone(root, [
      'mixamorigRightHand',
      'mixamorig_righthand',
      'righthand',
      'hand_r',
    ])
    if (hand) {
      weaponGltf.scene.scale.setScalar(1)
      hand.add(weaponGltf.scene)
    }
  } catch {
    /* weapon optional */
  }
  const transformBounds = applyTopAnchoredVisualCorrection(
    root,
    gltf.scene,
    getAvatarVisualCorrection({
      worldSlug: context.worldSlug,
      characterId: character.id,
      modelUrl: url,
    }),
  )
  if (
    transformBounds &&
    typeof window !== 'undefined' &&
    ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(window.location.hostname.toLowerCase())
  ) {
    console.info('[grudgeAvatar] lobby guest bounds', JSON.stringify(transformBounds))
  }
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })

  // multiplayer-gltf: per-bone hitboxes for PvP / weapon rays
  const boxes = attachAvatarHitboxes(root, { playerId: character.id, debug: false })
  const weaponCollider = createWeaponCollider(0.3)
  attachWeaponColliderToHand(root, weaponCollider)
  const footIk = new FootIkLite(root, { weight: 0.85, maxStep: 0.32 })

  root.userData.hitboxCount = boxes.length
  root.userData.weaponCollider = weaponCollider
  root.userData.footIk = footIk
  root.userData.clips = clips
  root.userData.mixer = mixer

  root.userData.avatarTransformBounds = transformBounds
  return {
    root,
    weaponCollider,
    footIk,
    hitboxCount: boxes.length,
    transformBounds,
    clips,
    mixer,
  }
}

/**
 * Swap visuals under an existing player mesh container (keeps transform parent).
 */
export async function applyAvatarToMesh(
  meshRoot: THREE.Object3D,
  character: FleetCharacter,
  context: AvatarLoadContext = {},
): Promise<LoadedAvatar | null> {
  try {
    const loaded = await loadGrudgeAvatar(character, context)
    // Clear children except helpers
    const keep: THREE.Object3D[] = []
    meshRoot.children.forEach((c) => {
      if (c.name.startsWith('__keep')) keep.push(c)
      else meshRoot.remove(c)
    })
    keep.forEach((c) => meshRoot.add(c))
    meshRoot.add(loaded.root)
    meshRoot.userData.grudgeAvatar = true
    meshRoot.userData.characterId = character.id
    meshRoot.userData.raceId = character.raceId
    meshRoot.userData.classId = character.classId
    meshRoot.userData.kitSig = avatarAppearanceSig(character)
    meshRoot.userData.weaponCollider = loaded.weaponCollider
    meshRoot.userData.footIk = loaded.footIk
    meshRoot.userData.mixer = loaded.mixer
    ;(meshRoot as THREE.Object3D & { animations?: THREE.AnimationClip[] }).animations = loaded.clips
    return loaded
  } catch (e) {
    console.warn('[grudgeAvatar] load failed', e)
    return null
  }
}
