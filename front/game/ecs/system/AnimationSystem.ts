import * as THREE from 'three'
import { Entity } from '@shared/entity/Entity'
import { AnimationComponent } from '../component/AnimationComponent'
import { StateComponent } from '@shared/component/StateComponent'
import { MeshComponent } from '../component/MeshComponent'
import { clipNameForState, findClip } from '@/lib/fourCharacterKit'
import type { LoadedAvatar } from '@/lib/grudgeAvatar'
import {
  enforceAvatarTransformContract,
  type AvatarTransformContract,
} from '@/lib/avatarTransformContract'

export class AnimationSystem {
  update(dt: number, entities: Entity[]) {
    for (const entity of entities) {
      const animationComponent = entity.getComponent(AnimationComponent)
      const meshComponent = entity.getComponent(MeshComponent)
      const stateComponent = entity.getComponent(StateComponent)

      if (animationComponent && stateComponent && meshComponent) {
        const mesh = meshComponent.mesh
        const loaded = mesh.userData.loadedAvatar as LoadedAvatar | undefined
        const transformContract = mesh.userData
          .avatarTransformContract as AvatarTransformContract | undefined
        const enforceTransform = () => {
          if (!loaded || !transformContract) return
          const violations = enforceAvatarTransformContract(
            transformContract,
            mesh,
            loaded.root,
            loaded.mixer.getRoot() as THREE.Object3D,
          )
          if (violations.length > 0 && !mesh.userData.avatarTransformViolationReported) {
            mesh.userData.avatarTransformViolationReported = true
            console.error(
              `[avatarTransform] restored invariant after drift: ${violations.join(', ')}`,
            )
          } else if (violations.length === 0) {
            mesh.userData.avatarTransformViolationReported = false
          }
        }
        enforceTransform()
        const animations: THREE.AnimationClip[] =
          animationComponent.animations?.length > 0
            ? animationComponent.animations
            : mesh.animations || []

        const isNotPlaying = animationComponent.mixer.time === 0

        if ((stateComponent.updated || isNotPlaying) && animations.length > 0) {
          const match = findClip(animations, clipNameForState(String(stateComponent.state)))
          const matchName = match?.name

          for (const clip of animations) {
            const action = animationComponent.mixer.clipAction(clip)
            if (!matchName || clip.name !== matchName) {
              action.fadeOut(0.2)
            } else {
              action.reset()
              action.setLoop(THREE.LoopRepeat, Infinity)
              action.fadeIn(0.1)
              action.play()
            }
          }
        }

        animationComponent.mixer.update(dt / 1000)
        enforceTransform()
      }
    }
  }
}
