import { Camera } from '@/game/Camera'
import { PositionComponent } from '@shared/component/PositionComponent'
import { Entity } from '@shared/entity/Entity'
import * as THREE from 'three'
import { CameraFollowComponent } from '../component/CameraFollowComponent'
import { InputMessage } from '@shared/network/client/inputMessage'
import { MeshComponent } from '../component/MeshComponent'
import {
  THIRD_PERSON,
  applyMouseLook,
  applyStickLook,
  chaseOffset,
  clampZoom,
  lookingYAngle,
  pullAlongRay,
} from '@/game/thirdPersonCamera'
import { requestBoundPointerLock } from '@/game/pointerLock'
import { collectLayerMeshes, layerMask, raycastLayersFor } from '@/game/renderLayers'

type SceneRenderer = THREE.WebGLRenderer & { scene?: THREE.Scene }

export class OrbitCameraFollowSystem {
  y: number = THIRD_PERSON.defaultYaw
  pointerLocked = false
  yaw: number = THIRD_PERSON.defaultYaw
  pitch: number = THIRD_PERSON.defaultPitch
  distance: number = THIRD_PERSON.distance

  private readonly camera: Camera
  private readonly canvas: HTMLCanvasElement
  private readonly renderer: SceneRenderer
  private readonly raycaster = new THREE.Raycaster()
  private colliderCache: THREE.Object3D[] = []
  private colliderCacheFrame = 0
  private readonly lookTarget = new THREE.Vector3()
  private readonly desired = new THREE.Vector3()
  private readonly hitPoint = new THREE.Vector3()
  private readonly skip = new Set<THREE.Object3D>()
  private dragging = false
  private lastX = 0
  private lastY = 0
  private snapped = false
  private lookHeight = THIRD_PERSON.lookHeight

  constructor(camera: Camera, renderer: THREE.WebGLRenderer) {
    this.camera = camera
    this.canvas = renderer.domElement
    this.renderer = renderer as SceneRenderer
    this.raycaster.layers.mask = layerMask(raycastLayersFor('camera-collision'))
    this.bindPointer()
  }

  private getScene(): THREE.Scene | undefined {
    return this.renderer.scene
  }

  applyLookDelta(movementX: number, movementY: number): void {
    const next = applyMouseLook(this.yaw, this.pitch, movementX, movementY)
    this.yaw = next.yaw
    this.pitch = next.pitch
  }

  applyGamepadLook(stickX: number, stickY: number, dtSeconds: number): void {
    const next = applyStickLook(this.yaw, this.pitch, stickX, stickY, dtSeconds)
    this.yaw = next.yaw
    this.pitch = next.pitch
  }

  getCameraAzimuthAngle(): number {
    return this.yaw
  }

  update(dt: number, entities: Entity[], _input: InputMessage): void {
    this.pointerLocked = document.pointerLockElement === this.canvas
    const dtSeconds = Math.min(0.05, Math.max(0, dt) / 1000)

    for (const entity of entities) {
      const followComponent = entity.getComponent(CameraFollowComponent)
      if (!followComponent) continue

      const target = this.getTargetPosition(entity)
      if (!target) continue

      this.lookTarget.copy(target)
      const offset = chaseOffset(this.yaw, this.pitch, this.distance)
      this.desired.set(
        this.lookTarget.x + offset.x,
        this.lookTarget.y + offset.y,
        this.lookTarget.z + offset.z
      )

      const blocked = this.obstructionDistance(entity)
      const pulled = pullAlongRay(this.lookTarget, this.desired, blocked)
      this.desired.set(pulled.x, pulled.y, pulled.z)

      if (!this.snapped) {
        this.camera.position.copy(this.desired)
        this.snapped = true
      } else {
        const alpha = 1 - Math.exp(-14 * dtSeconds)
        this.camera.position.lerp(this.desired, alpha)
      }
      this.camera.lookAt(this.lookTarget)
      this.y = lookingYAngle(
        this.camera.position.x,
        this.camera.position.z,
        this.lookTarget.x,
        this.lookTarget.z
      )
    }
  }

  private getTargetPosition(entity: Entity): THREE.Vector3 | null {
    const meshComponent = entity.getComponent(MeshComponent)
    if (meshComponent) {
      return new THREE.Vector3(
        meshComponent.mesh.position.x,
        meshComponent.mesh.position.y + this.lookHeight,
        meshComponent.mesh.position.z
      )
    }

    const positionComponent = entity.getComponent(PositionComponent)
    if (positionComponent) {
      return new THREE.Vector3(
        positionComponent.x,
        positionComponent.y + this.lookHeight,
        positionComponent.z
      )
    }

    return null
  }

  private obstructionDistance(entity: Entity): number | null {
    const scene = this.getScene()
    if (!scene) return null
    this.skip.clear()
    const meshComponent = entity.getComponent(MeshComponent)
    meshComponent?.mesh.traverse((object) => this.skip.add(object))

    this.colliderCacheFrame += 1
    if (this.colliderCacheFrame % 8 === 1) {
      this.colliderCache = collectLayerMeshes(scene, raycastLayersFor('camera-collision'), {
        visibleOnly: true,
      })
    }
    if (!this.colliderCache.length) return null

    this.hitPoint.copy(this.desired).sub(this.lookTarget)
    const span = this.hitPoint.length()
    if (span < 0.05) return null
    this.hitPoint.normalize()
    this.raycaster.set(this.lookTarget, this.hitPoint)
    this.raycaster.far = span
    const hits = this.raycaster.intersectObjects(this.colliderCache, false)
    const hit = hits.find((entry) => !this.skip.has(entry.object))
    return hit?.distance ?? null
  }

  private bindPointer(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    document.addEventListener('pointerlockchange', this.onPointerLockChange)
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    if (event.button === 2) return
    this.dragging = true
    this.lastX = event.clientX
    this.lastY = event.clientY
    try {
      this.canvas.setPointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
    if (event.pointerType === 'mouse' && event.button === 0) {
      this.requestPointerLock()
    }
  }

  private readonly onPointerMove = (event: PointerEvent) => {
    if (document.pointerLockElement === this.canvas) {
      this.applyLookDelta(event.movementX, event.movementY)
      return
    }
    if (!this.dragging) return
    this.applyLookDelta(event.clientX - this.lastX, event.clientY - this.lastY)
    this.lastX = event.clientX
    this.lastY = event.clientY
  }

  private readonly onPointerUp = (event: PointerEvent) => {
    this.dragging = false
    try {
      this.canvas.releasePointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
  }

  private readonly onWheel = (event: WheelEvent) => {
    event.preventDefault()
    const next = this.distance + Math.sign(event.deltaY) * THIRD_PERSON.wheelZoom
    this.distance = clampZoom(next)
  }

  private readonly onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas
  }

  private requestPointerLock(): void {
    if (typeof this.canvas.requestPointerLock !== 'function') return
    if (window.matchMedia?.('(pointer: coarse)').matches) return
    requestBoundPointerLock(this.canvas.requestPointerLock.bind(this.canvas))
  }
}
