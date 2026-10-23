import * as THREE from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'

export class LoadManager {
  private static instance: LoadManager
  private cache = new Map<string, THREE.Mesh>()
  private pending = new Map<string, Promise<THREE.Mesh>>()
  dracoLoader = new DRACOLoader()
  gltfLoader = new GLTFLoader()

  private constructor() {
    this.dracoLoader.setDecoderPath('/draco/') // Replace with the actual path to the Draco decoder
    this.gltfLoader.setDRACOLoader(this.dracoLoader)
  }

  static getInstance(): LoadManager {
    if (!LoadManager.instance) {
      LoadManager.instance = new LoadManager()
    }
    return LoadManager.instance
  }

  static glTFLoad(path: string): Promise<THREE.Mesh> {
    const instance = LoadManager.getInstance()

    // // Check if the mesh is already in the cache
    if (instance.cache.has(path)) {
      const cachedMesh = instance.cache.get(path)!
      const clonedMesh = instance.cloneMesh(cachedMesh)
      return Promise.resolve(clonedMesh)
    }

    const pending = instance.pending.get(path)
    if (pending) return pending.then((mesh) => instance.cloneMesh(mesh))

    // Share one source load when a herd or household requests the same asset together.
    const loading = new Promise<THREE.Mesh>((resolve, reject) => {
      instance.gltfLoader.load(
        path,
        (gltf) => {
          // Extract the first mesh from the loaded model
          const mesh = instance.extractMesh(gltf)
          if (mesh) {
            // Cache the original mesh
            instance.cache.set(path, mesh)
            resolve(mesh)
          } else {
            reject(new Error('No mesh found in the GLTF model'))
          }
        },
        // called as loading progresses
        (xhr) => {
          console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
        },
        // called when loading has errors
        (error) => {
          console.error('An error happened', error)
          reject(error)
        }
      )
    }).finally(() => instance.pending.delete(path))
    instance.pending.set(path, loading)
    return loading.then((mesh) => instance.cloneMesh(mesh))
  }

  private cloneMesh(mesh: THREE.Mesh): THREE.Mesh {
    const clonedMesh = SkeletonUtils.clone(mesh)
    clonedMesh.animations = mesh.animations
    // Clone materials to avoid sharing the same material instance
    clonedMesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = child.material
        if (Array.isArray(material)) {
          child.material = material.map((m) => m.clone())
        } else {
          child.material = material.clone()
        }
      }
    })
    return clonedMesh as THREE.Mesh
  }

  static releaseClone(mesh: THREE.Object3D) {
    const materials = new Set<THREE.Material>()
    const skeletons = new Set<THREE.Skeleton>()
    mesh.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton)
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
    })
    // SkeletonUtils gives each clone its own bone texture; shared source geometry stays cached.
    skeletons.forEach((skeleton) => skeleton.dispose())
    materials.forEach((material) => material.dispose())
  }

  private extractMesh(gltf: any): THREE.Mesh | null {
    let mesh: THREE.Mesh = new THREE.Mesh()
    mesh.add(gltf.scene)
    mesh.animations = gltf.animations
    return mesh
  }
}
