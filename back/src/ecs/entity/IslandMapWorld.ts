import { EntityManager } from '@shared/system/EntityManager.js'
import { Entity } from '@shared/entity/Entity.js'
import { SerializedEntityType } from '@shared/network/server/serialized.js'
import { KinematicRigidBodyComponent } from '@back/ecs/component/physics/KinematicRigidBodyComponent.js'
import { PositionComponent } from '@shared/component/PositionComponent.js'
import { ServerMeshComponent } from '@shared/component/ServerMeshComponent.js'
import { NetworkDataComponent } from '@shared/network/NetworkDataComponent.js'
import { PhysicsPropertiesComponent } from '@back/ecs/component/physics/PhysicsPropertiesComponent.js'
import { ColliderPropertiesComponent } from '@back/ecs/component/physics/ColliderPropertiesComponent.js'
import { HeightfieldColliderComponent } from '@back/ecs/component/physics/HeightfieldColliderComponent.js'
import {
  islandMeshUrl,
  type IslandBake,
} from '@shared/maps/islandBake.js'
import { heightfieldSamples } from '@shared/maps/islandMesh.js'

export class IslandMapWorld {
  entity: Entity
  bake: IslandBake

  constructor(bake: IslandBake) {
    this.bake = bake
    this.entity = EntityManager.createEntity(SerializedEntityType.WORLD)

    const serverMeshComponent = new ServerMeshComponent(this.entity.id, islandMeshUrl(bake.id))
    this.entity.addComponent(serverMeshComponent)
    this.entity.addComponent(new PositionComponent(this.entity.id, 0, 0, 0))
    this.entity.addComponent(
      new ColliderPropertiesComponent(this.entity.id, {
        friction: 0.9,
        restitution: 0.02,
      })
    )
    this.entity.addComponent(
      new PhysicsPropertiesComponent(this.entity.id, {
        enableCcd: true,
        angularDamping: 0.05,
        linearDamping: 0.05,
      })
    )
    this.entity.addComponent(new KinematicRigidBodyComponent(this.entity.id))

    const field = heightfieldSamples(bake)
    this.entity.addComponent(
      new HeightfieldColliderComponent(
        this.entity.id,
        field.nrows,
        field.ncols,
        field.heights,
        field.scale
      )
    )
    this.entity.addComponent(
      new NetworkDataComponent(this.entity.id, this.entity.type, [serverMeshComponent])
    )
  }
}
