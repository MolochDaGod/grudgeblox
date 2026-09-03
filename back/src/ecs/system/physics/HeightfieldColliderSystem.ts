import { ComponentAddedEvent } from '../../../../../shared/component/events/ComponentAddedEvent.js'
import { Entity } from '../../../../../shared/entity/Entity.js'
import { EntityManager } from '../../../../../shared/system/EntityManager.js'
import { EventSystem } from '../../../../../shared/system/EventSystem.js'
import Rapier from '../../../physics/rapier.js'
import { HeightfieldColliderComponent } from '../../component/physics/HeightfieldColliderComponent.js'
import { ColliderPropertiesComponent } from '../../component/physics/ColliderPropertiesComponent.js'
import { DynamicRigidBodyComponent } from '../../component/physics/DynamicRigidBodyComponent.js'
import { KinematicRigidBodyComponent } from '../../component/physics/KinematicRigidBodyComponent.js'
import { PositionComponent } from '../../../../../shared/component/PositionComponent.js'

export class HeightfieldColliderSystem {
  update(entities: Entity[], world: Rapier.World) {
    const createEvents = EventSystem.getEventsWrapped(
      ComponentAddedEvent,
      HeightfieldColliderComponent
    )
    for (const event of createEvents) {
      const entity = EntityManager.getEntityById(entities, event.entityId)
      if (!entity) {
        console.error('HeightfieldColliderSystem: Entity not found')
        continue
      }
      this.onComponentAdded(entity, event, world)
    }
  }

  onComponentAdded(
    entity: Entity,
    event: ComponentAddedEvent<HeightfieldColliderComponent>,
    world: Rapier.World
  ) {
    const field = event.component
    const rigidBodyComponent =
      entity.getComponent(DynamicRigidBodyComponent) ||
      entity.getComponent(KinematicRigidBodyComponent)
    if (!rigidBodyComponent?.body) {
      console.error('HeightfieldColliderSystem: Rigid body missing')
      return
    }

    const expected = (field.nrows + 1) * (field.ncols + 1)
    if (field.heights.length !== expected) {
      console.error(
        `HeightfieldColliderSystem: expected ${expected} heights, got ${field.heights.length}`
      )
      return
    }

    const colliderDesc = Rapier.ColliderDesc.heightfield(
      field.nrows,
      field.ncols,
      new Float32Array(field.heights),
      new Rapier.Vector3(field.scale.x, field.scale.y, field.scale.z)
    )

    const colliderProperties = entity.getComponent(ColliderPropertiesComponent)
    if (colliderProperties) {
      if (colliderProperties.data.friction !== undefined) {
        colliderDesc.setFriction(colliderProperties.data.friction)
      }
      if (colliderProperties.data.restitution !== undefined) {
        colliderDesc.setRestitution(colliderProperties.data.restitution)
      }
      if (colliderProperties.data.isSensor !== undefined) {
        colliderDesc.setSensor(colliderProperties.data.isSensor)
      }
    }

    field.collider = world.createCollider(colliderDesc, rigidBodyComponent.body)

    const positionComponent = entity.getComponent(PositionComponent)
    if (positionComponent) {
      rigidBodyComponent.body.setTranslation(
        new Rapier.Vector3(positionComponent.x, positionComponent.y, positionComponent.z),
        true
      )
    }
  }
}
