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

const TARGET_HEIGHT_M = 1.8

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

function resolveUrl(character: FleetCharacter): string {
  if (character.model3d) {
    if (character.model3d.startsWith('http')) return character.model3d
    return `${FLEET.assets}/${character.model3d.replace(/^\//, '')}`
  }
  return raceCdnUrl(character.raceId)
}

/**
 * Load avatar root group (feet on origin).
 */
export async function loadGrudgeAvatar(character: FleetCharacter): Promise<THREE.Group> {
  const url = resolveUrl(character)
  const loader = makeLoader()
  const gltf = await loader.loadAsync(url)
  const root = new THREE.Group()
  root.name = `grudge_avatar_${character.id}`
  root.userData.characterId = character.id
  root.userData.raceId = character.raceId
  root.add(gltf.scene)
  // grudge6 art-forward often +X; face +Z for Notblox camera
  gltf.scene.rotation.y = Math.PI / 2
  fitHeight(root, TARGET_HEIGHT_M)
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  return root
}

/**
 * Swap visuals under an existing player mesh container (keeps transform parent).
 */
export async function applyAvatarToMesh(
  meshRoot: THREE.Object3D,
  character: FleetCharacter,
): Promise<boolean> {
  try {
    const avatar = await loadGrudgeAvatar(character)
    // Clear children except helpers
    const keep: THREE.Object3D[] = []
    meshRoot.children.forEach((c) => {
      if (c.name.startsWith('__keep')) keep.push(c)
      else meshRoot.remove(c)
    })
    keep.forEach((c) => meshRoot.add(c))
    meshRoot.add(avatar)
    meshRoot.userData.grudgeAvatar = true
    meshRoot.userData.characterId = character.id
    return true
  } catch (e) {
    console.warn('[grudgeAvatar] load failed', e)
    return false
  }
}
