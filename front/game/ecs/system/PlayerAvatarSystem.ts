/**
 * Apply 4character skins / clips / VFX to every networked player mesh.
 * Physics body stays Notblox ECS; this only swaps the visual.
 */
import * as THREE from 'three'
import { Entity } from '@shared/entity/Entity'
import { PlayerComponent } from '@shared/component/PlayerComponent'
import { MeshComponent } from '../component/MeshComponent'
import { AnimationComponent } from '../component/AnimationComponent'
import { applyAvatarToMesh } from '@/lib/grudgeAvatar'
import {
  avatarAppearanceSig,
  clipNameForAttack,
  clipNameForFx,
  fxForClass,
  kitVfxUrl,
  normalizeKitClass,
  normalizeKitRace,
} from '@/lib/fourCharacterKit'
import type { FleetCharacter } from '@/lib/fleetCharacters'
import { LoadManager } from '@/game/LoadManager'
import { EntityManager } from '@shared/system/EntityManager'
import { captureAvatarTransformContract } from '@/lib/avatarTransformContract'
import { RENDER_LAYER, assignLayerTree } from '@/game/renderLayers'

const vfxCache = new Map<string, THREE.Object3D>()

function appearanceSig(p: PlayerComponent): string {
  return avatarAppearanceSig({
    raceId: p.raceId,
    classId: p.classId,
    model3d: p.model3d,
    characterId: p.characterId,
    gameEra: p.gameEra,
  })
}

function toFleetCharacter(p: PlayerComponent): FleetCharacter {
  const kitRace = normalizeKitRace(p.raceId)
  const model3d = p.model3d?.startsWith('races/')
    ? `/kit/4character/${p.model3d}`
    : p.model3d
  return {
    id: p.characterId || `net-${p.entityId}`,
    name: p.name,
    raceId: p.raceId || kitRace,
    classId: p.classId || normalizeKitClass(p.classId),
    model3d,
    gameEra: p.gameEra,
  }
}

async function spawnFx(mesh: THREE.Object3D, fxId: string) {
  const url = kitVfxUrl(fxId)
  let proto = vfxCache.get(url)
  if (!proto) {
    try {
      proto = await LoadManager.glTFLoad(url)
      vfxCache.set(url, proto)
    } catch {
      return
    }
  }
  const clone = proto.clone(true)
  clone.scale.setScalar(fxId === 'slash' || fxId === 'slashes' ? 1.2 : 0.8)
  clone.position.set(0, 1.1, 0.4)
  assignLayerTree(clone, RENDER_LAYER.FX)
  mesh.add(clone)
  window.setTimeout(() => {
    mesh.remove(clone)
    clone.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.geometry?.dispose?.()
      }
    })
  }, 900)
}

export class PlayerAvatarSystem {
  private applying = new Set<number>()

  update(entities: Entity[], worldSlug?: string) {
    for (const entity of EntityManager.getInstance().getAllEntities()) {
      const player = entity.getComponent(PlayerComponent)
      const meshC = entity.getComponent(MeshComponent)
      if (!player || !meshC?.mesh) continue

      const sig = appearanceSig(player)
      const mesh = meshC.mesh
      if (mesh.userData.kitSig !== sig && !this.applying.has(entity.id)) {
        this.applying.add(entity.id)
        const character = toFleetCharacter(player)
        void applyAvatarToMesh(mesh, character, { worldSlug })
          .then((loaded) => {
            mesh.userData.kitSig = sig
            mesh.userData.lastFxSeq = player.fxSeq || 0
            if (loaded) {
              mesh.userData.loadedAvatar = loaded
              assignLayerTree(mesh, RENDER_LAYER.PLAYER)
              const transformContract = captureAvatarTransformContract(
                mesh,
                loaded.root,
                loaded.mixer.getRoot() as THREE.Object3D,
              )
              mesh.userData.avatarTransformContract = transformContract
              if (
                typeof window !== 'undefined' &&
                ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(
                  window.location.hostname.toLowerCase(),
                )
              ) {
                console.info(
                  '[avatarTransform] bound canonical contract',
                  JSON.stringify({
                    raceId: character.raceId,
                    rootScale: transformContract.meshScale,
                    worldHeight: transformContract.canonicalWorldHeight,
                    contactY: transformContract.presentationPosition[1],
                  }),
                )
              }
              const clips = loaded.clips
              let anim = entity.getComponent(AnimationComponent)
              if (anim) {
                anim.bind(loaded.mixer, clips)
              } else {
                anim = new AnimationComponent(entity.id, meshC.mesh, clips)
                anim.bind(loaded.mixer, clips)
                entity.addComponent(anim)
              }
            }
          })
          .catch(() => {
            /* keep capsule */
          })
          .finally(() => {
            this.applying.delete(entity.id)
          })
      }

      if (player.fxSeq && player.fxSeq !== mesh.userData.lastFxSeq) {
        mesh.userData.lastFxSeq = player.fxSeq
        const fx = player.fx || fxForClass(player.classId)
        void spawnFx(mesh, fx)
        entity
          .getComponent(AnimationComponent)
          ?.animator.playOneShot(player.fx ? clipNameForFx(player.fx) : clipNameForAttack(player.classId))
      }
    }
    void entities
  }
}
