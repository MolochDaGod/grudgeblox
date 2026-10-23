import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import {
  CAMERA_LAYERS,
  RENDER_LAYER,
  assignLayerTree,
  collectLayerMeshes,
  layerMask,
  raycastLayersFor,
  setLayers,
} from './renderLayers'

test('camera renders world, players, and fx but never hitboxes', () => {
  const camera = new THREE.PerspectiveCamera()
  setLayers(camera, CAMERA_LAYERS)
  const hitbox = new THREE.Layers()
  hitbox.set(RENDER_LAYER.HITBOX)
  const player = new THREE.Layers()
  player.set(RENDER_LAYER.PLAYER)
  assert.equal(camera.layers.test(hitbox), false)
  assert.equal(camera.layers.test(player), true)
  assert.equal(layerMask([0, 3]), 0b1001)
})

test('camera collision and foot ik only see the world layer', () => {
  assert.deepEqual([...raycastLayersFor('camera-collision')], [RENDER_LAYER.WORLD])
  assert.deepEqual([...raycastLayersFor('foot-ik')], [RENDER_LAYER.WORLD])
  assert.deepEqual([...raycastLayersFor('projectile')], [RENDER_LAYER.WORLD, RENDER_LAYER.HITBOX])
  assert.deepEqual([...raycastLayersFor('melee')], [RENDER_LAYER.HITBOX])
})

test('assignLayerTree moves an avatar off world but keeps hitboxes on the hitbox layer', () => {
  const avatar = new THREE.Group()
  const skin = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
  hitbox.userData.isHitbox = true
  hitbox.visible = false
  avatar.add(skin, hitbox)
  assignLayerTree(avatar, RENDER_LAYER.PLAYER)

  const world = new THREE.Layers()
  world.set(RENDER_LAYER.WORLD)
  assert.equal(skin.layers.test(world), false)
  const hitboxLayer = new THREE.Layers()
  hitboxLayer.set(RENDER_LAYER.HITBOX)
  assert.equal(hitbox.layers.test(hitboxLayer), true)

  const scene = new THREE.Scene()
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial())
  scene.add(ground, avatar)

  const cameraTargets = collectLayerMeshes(scene, raycastLayersFor('camera-collision'), {
    visibleOnly: true,
  })
  assert.deepEqual(cameraTargets, [ground])

  const projectileTargets = collectLayerMeshes(scene, raycastLayersFor('projectile'), {
    visibleOnly: true,
  })
  assert.equal(projectileTargets.includes(ground), true)
  assert.equal(projectileTargets.includes(hitbox), true)
  assert.equal(projectileTargets.includes(skin), false)
})
