import * as THREE from 'three'
import { Entity } from '@shared/entity/Entity'
import { AnimationComponent } from '../component/AnimationComponent'
import { StateComponent } from '@shared/component/StateComponent'
import { MeshComponent } from '../component/MeshComponent'
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

      if (!animationComponent || !stateComponent || !meshComponent) continue

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

      const animator = animationComponent.animator
      // Server state drives the locomotion lane; the animator dedupes so this
      // is safe to call every frame and self-heals after a rig swap.
      animator.setState(stateComponent.state)
      animator.update(dt / 1000)
      enforceTransform()
    }
  }
}
