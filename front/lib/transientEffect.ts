import * as THREE from 'three'

/** An effect owns its cloned geometry/materials; textures stay with the cache. */
export function createTransientEffect(prototype: THREE.Object3D) {
  const root = prototype.clone(true)
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry = object.geometry.clone()
    geometries.add(object.geometry)
    const own = (material: THREE.Material) => {
      const copy = material.clone()
      materials.add(copy)
      return copy
    }
    object.material = Array.isArray(object.material) ? object.material.map(own) : own(object.material)
  })
  let disposed = false
  return { root, dispose: () => {
    if (disposed) return
    disposed = true
    root.removeFromParent()
    geometries.forEach((geometry) => geometry.dispose())
    materials.forEach((material) => material.dispose())
  } }
}
