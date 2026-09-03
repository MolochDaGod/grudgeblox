/**
 * Rapier trimesh/convex hulls from GLB files OOM small Railway replicas.
 * Clients still receive ServerMeshComponent URLs and load the GLBs themselves.
 */
export function serverLoadsGltfColliders(): boolean {
  if (process.env.CITY_GLTF_COLLIDERS === '1') return true
  if (process.env.CITY_GLTF_COLLIDERS === '0') return false
  return !(
    process.env.RAILWAY_SERVICE_ID ||
    process.env.RAILWAY_ENVIRONMENT_ID ||
    process.env.RAILWAY_ENVIRONMENT_NAME
  )
}
