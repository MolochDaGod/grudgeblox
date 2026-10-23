import { EntityManager } from '@shared/system/EntityManager.js'
import { Entity } from '@shared/entity/Entity.js'
import { SerializedEntityType } from '@shared/network/server/serialized.js'
import { KinematicRigidBodyComponent } from '@back/ecs/component/physics/KinematicRigidBodyComponent.js'
import { PositionComponent } from '@shared/component/PositionComponent.js'
import { SizeComponent } from '@shared/component/SizeComponent.js'
import { ServerMeshComponent } from '@shared/component/ServerMeshComponent.js'
import { NetworkDataComponent } from '@shared/network/NetworkDataComponent.js'
import { PhysicsPropertiesComponent } from '@back/ecs/component/physics/PhysicsPropertiesComponent.js'
import { ColliderPropertiesComponent } from '@back/ecs/component/physics/ColliderPropertiesComponent.js'
import { BoxColliderComponent } from '@back/ecs/component/physics/BoxColliderComponent.js'
import { HeightfieldColliderComponent } from '@back/ecs/component/physics/HeightfieldColliderComponent.js'
import {
  islandMeshUrl,
  worldSizeMeters,
  type IslandBake,
} from '@shared/maps/islandBake.js'
import { heightfieldSamples } from '@shared/maps/islandMesh.js'

function useHeightfieldCollider(): boolean {
  if (process.env.ISLAND_HEIGHTFIELDS === '1') return true
  if (process.env.ISLAND_HEIGHTFIELDS === '0') return false
  const map = (process.env.ISLAND_MAP || '').trim()
  return map !== '' && map !== 'all' && map !== 'live-hub'
}

export class IslandMapWorld {
  entity: Entity
  bake: IslandBake
  origin: { x: number; y: number; z: number }

  constructor(bake: IslandBake, origin: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }) {
    this.bake = bake
    this.origin = origin
    this.entity = EntityManager.createEntity(SerializedEntityType.WORLD)

    const serverMeshComponent = new ServerMeshComponent(this.entity.id, islandMeshUrl(bake.id))
    const positionComponent = new PositionComponent(
      this.entity.id,
      origin.x,
      origin.y,
      origin.z
    )
    this.entity.addComponent(serverMeshComponent)
    this.entity.addComponent(positionComponent)
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

    // Seven Rapier heightfields OOMed the Railway replica. The live hub keeps the
    // client mesh and uses a walkable plate; dedicated island rooms keep heightfields.
    if (useHeightfieldCollider()) {
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
    } else {
      const extent = worldSizeMeters(bake)
      this.entity.addComponent(new SizeComponent(this.entity.id, extent, 2, extent))
      this.entity.addComponent(new BoxColliderComponent(this.entity.id))
    }
    this.entity.addComponent(
      new NetworkDataComponent(this.entity.id, this.entity.type, [
        serverMeshComponent,
        positionComponent,
      ])
    )
  }
}
