import * as THREE from 'three'
import { Entity } from '@shared/entity/Entity'
import { EventSystem } from '@shared/system/EventSystem'
import { ComponentAddedEvent } from '@shared/component/events/ComponentAddedEvent'
import { ServerMeshComponent } from '@shared/component/ServerMeshComponent'
import { MeshComponent } from '../component/MeshComponent'
import { EntityManager } from '@shared/system/EntityManager'
import { parseIslandMeshUrl } from '@shared/maps/islandBake'
import { buildIslandMeshData } from '@shared/maps/islandMesh'
import { loadClientIslandBake } from '@/lib/islandBakes'
import type { IslandBake } from '@shared/maps/islandBake'
import { Renderer } from '@/game/Renderer'

const bakeCache = new Map<string, IslandBake>()

function bakeForId(id: string): IslandBake {
  const cached = bakeCache.get(id)
  if (cached) return cached
  const bake = loadClientIslandBake(id)
  bakeCache.set(id, bake)
  return bake
}

function buildMesh(bake: IslandBake): THREE.Mesh {
  const data = buildIslandMeshData(bake)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3))
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1))
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = `island:${bake.id}`
  mesh.receiveShadow = true
  mesh.castShadow = true
  mesh.userData.islandBakeId = bake.id

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(data.worldSize * 1.15, data.worldSize * 1.15),
    new THREE.MeshLambertMaterial({
      color: 0x1b6a88,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
  )
  water.rotation.x = -Math.PI / 2
  water.position.y = bake.seaLevel * bake.maxHeight
  water.name = `island-water:${bake.id}`
  water.receiveShadow = true
  mesh.add(water)
  return mesh
}

export class IslandTerrainSystem {
  update(entities: Entity[], _renderer: Renderer) {
    const createEvents = EventSystem.getEventsWrapped(ComponentAddedEvent, ServerMeshComponent)
    for (const event of createEvents) {
      const id = parseIslandMeshUrl(event.component.filePath)
      if (!id) continue
      const entity = EntityManager.getEntityById(entities, event.entityId)
      if (!entity) continue
      if (entity.getComponent(MeshComponent)) continue
      const mesh = buildMesh(bakeForId(id))
      entity.addComponent(new MeshComponent(entity.id, mesh))
    }
  }
}
