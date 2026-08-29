import { ColorComponent } from '@shared/component/ColorComponent'
import { Entity } from '@shared/entity/Entity'
import * as THREE from 'three'
import { MeshComponent } from '../component/MeshComponent'

export class SyncColorSystem {
  update(entities: Entity[]) {
    for (const entity of entities) {
      const colorComponent = entity.getComponent(ColorComponent)
      const meshComponent = entity.getComponent(MeshComponent)
      if (colorComponent && meshComponent && colorComponent.updated) {
        // "default" means preserve the material supplied by the model.
        if (colorComponent.color === 'default') continue

        // Iterate over all children of the mesh
        // and update the material color
        meshComponent.mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material.skinning = true
            child.material.color = new THREE.Color(colorComponent.color)
          }
        })
      }
    }
  }
}
