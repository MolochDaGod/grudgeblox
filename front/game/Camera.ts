import * as THREE from 'three'
import { OrbitCameraFollowSystem } from './ecs/system/OrbitCameraFollowSystem'
import { Entity } from '@shared/entity/Entity'
import { InputMessage } from '@shared/network/client/inputMessage'
import { CAMERA_LAYERS, setLayers } from './renderLayers'

export class Camera extends THREE.PerspectiveCamera {
  defaultOffset = new THREE.Vector3(0, 1.65, 4.6)
  controlSystem: OrbitCameraFollowSystem

  constructor(renderer: THREE.WebGLRenderer) {
    super(70, window.innerWidth / window.innerHeight)
    this.position.copy(this.defaultOffset)
    setLayers(this, CAMERA_LAYERS)
    this.controlSystem = new OrbitCameraFollowSystem(this, renderer)
  }

  update(dt: number, entities: Entity[], inputMessage: InputMessage) {
    this.controlSystem.update(dt, entities, inputMessage)
  }
}
