import { Entity } from '@shared/entity/Entity'
import * as THREE from 'three'

import { WheelComponent } from '@shared/component/WheelComponent'
import { MeshComponent } from '../component/MeshComponent'
import { VehicleComponent } from '@shared/component/VehicleComponent'
import { ComponentAddedEvent } from '@shared/component/events/ComponentAddedEvent'
import { EntityManager } from '@shared/system/EntityManager'
import { EventSystem } from '@shared/system/EventSystem'
import { LoadManager } from '@/game/LoadManager'
export class VehicleSystem {
  private entityWheels: Map<number, THREE.Mesh[]> = new Map()
  private wheelModelUrl =
    'https://notbloxo.fra1.cdn.digitaloceanspaces.com/Notblox-Assets/vehicle/Wheel.glb'

  private sourceWheelRadius(wheelModel: THREE.Object3D): number {
    wheelModel.updateMatrixWorld(true)
    const size = new THREE.Box3()
      .setFromObject(wheelModel, true)
      .getSize(new THREE.Vector3())
    return Math.max(size.y, size.z) / 2
  }

  update(entities: Entity[]) {
    // Catch vehicle creation, add wheels to it.
    const addedVehicleEvents = EventSystem.getEventsWrapped(ComponentAddedEvent, VehicleComponent)
    for (const addedEvent of addedVehicleEvents) {
      const vehicleEntity = EntityManager.getEntityById(entities, addedEvent.entityId)
      if (!vehicleEntity) continue

      // Load wheel model
      LoadManager.glTFLoad(this.wheelModelUrl).then((wheelModel) => {
        const vehicleComponent: VehicleComponent = addedEvent.component
        const meshComponent = vehicleEntity.getComponent(MeshComponent)
        const wheelComponents: WheelComponent[] = vehicleComponent.wheels
        if (vehicleComponent && meshComponent) {
          const sourceRadius = this.sourceWheelRadius(wheelModel)
          const wheelMeshes: THREE.Mesh[] = []
          for (const wheel of wheelComponents) {
            const wheelMesh = wheelModel.clone()
            console.log('VehicleSystem: Adding wheel', wheel.radius)
            wheelMesh.position.set(
              wheel.positionComponent.x,
              wheel.positionComponent.y,
              wheel.positionComponent.z
            )
            wheelMesh.rotation.setFromQuaternion(
              new THREE.Quaternion(
                wheel.rotationComponent.x,
                wheel.rotationComponent.y,
                wheel.rotationComponent.z,
                wheel.rotationComponent.w
              )
            )
            const visualScale =
              sourceRadius > 1e-4 ? wheel.radius / sourceRadius : wheel.radius
            wheelMesh.scale.setScalar(visualScale)
            //Game.getInstance().renderer.scene.add(wheelMesh)
            meshComponent.mesh.add(wheelMesh)
            wheelMeshes.push(wheelMesh)
          }
          this.entityWheels.set(vehicleEntity.id, wheelMeshes)
        }
      })
    }

    // Update the wheels position and rotation
    for (const entity of entities) {
      const vehicleComponent = entity.getComponent(VehicleComponent)
      const meshComponent = entity.getComponent(MeshComponent)
      if (vehicleComponent && meshComponent) {
        const wheelMeshes = this.entityWheels.get(entity.id)
        if (wheelMeshes) {
          for (let i = 0; i < vehicleComponent.wheels.length; i++) {
            const wheel = vehicleComponent.wheels[i]
            const wheelMesh = wheelMeshes[i]
            wheelMesh.position.lerp(
              new THREE.Vector3(
                wheel.positionComponent.x,
                wheel.positionComponent.y,
                wheel.positionComponent.z
              ),
              0.1
            )
            const targetQuat = new THREE.Quaternion(
              wheel.rotationComponent.x,
              wheel.rotationComponent.y,
              wheel.rotationComponent.z,
              wheel.rotationComponent.w
            )
            wheelMesh.quaternion.slerp(targetQuat, 0.1)
          }
        }
      }
    }
  }
}
