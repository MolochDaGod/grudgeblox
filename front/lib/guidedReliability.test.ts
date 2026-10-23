import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { AvatarLoadAttempts } from './avatarLoadAttempts'
import { createTransientEffect } from './transientEffect'
import { buildFoundryCreateUrl, buildLoginUrl, FLEET } from './fleetConfig'
import { applyAvatarToMesh } from './grudgeAvatar'
import { EntityManager } from '@shared/system/EntityManager'
import { EventSystem } from '@shared/system/EventSystem'
import { ServerMeshComponent } from '@shared/component/ServerMeshComponent'
import { ComponentAddedEvent } from '@shared/component/events/ComponentAddedEvent'
import { SerializedEntityType } from '@shared/network/server/serialized'
import { resetClientSession } from '../game/resetClientSession'
import { ServerMeshSystem } from '../game/ecs/system/ServerMeshSystem'
import { MeshComponent } from '../game/ecs/component/MeshComponent'
import { LoadManager } from '../game/LoadManager'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import FleetCharacterSelect from '../components/FleetCharacterSelect'
import { OrbitCameraFollowSystem } from '../game/ecs/system/OrbitCameraFollowSystem'

test('failed avatar loads back off, retry the same appearance, and invalidate stale results', () => {
  const queue = new AvatarLoadAttempts(), mesh = {}
  const first = queue.begin(mesh, 'human', 0)!
  assert.ok(first.isCurrent())
  assert.equal(queue.begin(mesh, 'human', 1), null)
  first.finish(false, 10)
  assert.equal(queue.begin(mesh, 'human', 509), null)
  const retry = queue.begin(mesh, 'human', 510)!
  assert.ok(retry)
  assert.equal(queue.begin(mesh, 'orc', 511), null)
  assert.equal(retry.isCurrent(), false)
  retry.finish(false, 512)
  const changed = queue.begin(mesh, 'orc', 513)!
  assert.ok(changed)
  changed.finish(true, 514)
  for (let attempt = 0; attempt < 3; attempt++) {
    const failed = queue.begin(mesh, 'elf', 10000 + attempt * 10000)!
    assert.ok(failed)
    failed.finish(false, 10000 + attempt * 10000)
  }
  assert.equal(queue.begin(mesh, 'elf', 90000), null, 'three failures must not become a per-frame request loop')
})

test('overlapping effects own disposal and leave cached resources and sibling effects alive', () => {
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial()
  const prototype = new THREE.Mesh(geometry, material), scene = new THREE.Scene()
  const first = createTransientEffect(prototype), second = createTransientEffect(prototype)
  let sharedDisposals = 0, firstDisposals = 0, secondDisposals = 0
  geometry.addEventListener('dispose', () => sharedDisposals++)
  material.addEventListener('dispose', () => sharedDisposals++)
  ;(first.root as THREE.Mesh).geometry.addEventListener('dispose', () => firstDisposals++)
  ;(second.root as THREE.Mesh).geometry.addEventListener('dispose', () => secondDisposals++)
  scene.add(first.root, second.root)
  first.dispose(); first.dispose()
  assert.equal(sharedDisposals, 0)
  assert.equal(firstDisposals, 1)
  assert.equal(secondDisposals, 0)
  assert.equal(second.root.parent, scene)
  second.dispose()
  assert.equal(secondDisposals, 1)
  assert.equal(sharedDisposals, 0)
  geometry.dispose(); material.dispose()
})

test('login and Foundry return to every selected world with stable initial URLs', () => {
  for (const world of ['test', 'combat', 'lobby', 'grudox', 'streets']) {
    const path = `/play/${world}`
    assert.equal(new URL(buildLoginUrl(path)).searchParams.get('redirect_uri'), `${FLEET.blox}${path}`)
    assert.equal(new URL(buildFoundryCreateUrl(path)).searchParams.get('returnTo'), `${FLEET.blox}${path}`)
    const origin = 'http://127.0.0.1:4015'
    assert.equal(new URL(buildLoginUrl(path, origin)).searchParams.get('redirect_uri'), `${origin}${path}`)
    assert.equal(new URL(buildFoundryCreateUrl(path, 'voxel', origin)).searchParams.get('returnTo'), `${origin}${path}`)
  }
})

test('initial lobby markup is identical before hydration even with a stored login', () => {
  const props = { playerName: '', selected: null, onPlayerNameChange() {}, onSelect() {}, onPlay() {}, gameTitle: 'Streets', returnPath: '/play/streets' }
  const globals = globalThis as typeof globalThis & { window?: unknown; localStorage?: unknown }
  const originalWindow = Object.getOwnPropertyDescriptor(globals, 'window')
  const originalStorage = Object.getOwnPropertyDescriptor(globals, 'localStorage')
  const server = renderToString(createElement(FleetCharacterSelect, props))
  try {
    Object.defineProperty(globals, 'window', { configurable: true, value: { location: { origin: 'http://127.0.0.1:4015' } } })
    Object.defineProperty(globals, 'localStorage', { configurable: true, value: { getItem: () => 'stored-test-session' } })
    const firstClient = renderToString(createElement(FleetCharacterSelect, props))
    assert.equal(firstClient, server)
    assert.ok(server.includes(encodeURIComponent(`${FLEET.blox}/play/streets`)))
  } finally {
    if (originalWindow) Object.defineProperty(globals, 'window', originalWindow)
    else Reflect.deleteProperty(globals, 'window')
    if (originalStorage) Object.defineProperty(globals, 'localStorage', originalStorage)
    else Reflect.deleteProperty(globals, 'localStorage')
  }
})

test('actual avatar application keeps prior visuals on failure or a stale completion', async () => {
  const original = GLTFLoader.prototype.loadAsync
  const root = new THREE.Group(), oldA = new THREE.Group(), oldB = new THREE.Group()
  root.add(oldA, oldB)
  const character = { id: 'test-avatar', name: 'Test', raceId: 'human', classId: 'warrior', model3d: 'https://example.invalid/private-test.glb' }
  try {
    GLTFLoader.prototype.loadAsync = async () => { throw new Error('test load failure') }
    assert.equal(await applyAvatarToMesh(root, character), null)
    assert.deepEqual(root.children, [oldA, oldB])
    assert.equal(root.userData.kitSig, undefined)
    GLTFLoader.prototype.loadAsync = async () => ({ scene: new THREE.Group(), animations: [] } as never)
    assert.equal(await applyAvatarToMesh(root, character, { isCurrent: () => false }), null)
    assert.deepEqual(root.children, [oldA, oldB])
    const loaded = await applyAvatarToMesh(root, character, { isCurrent: () => true })
    assert.ok(loaded)
    assert.deepEqual(root.children, [loaded.root], 'successful retry replaces all old visuals exactly once')
    assert.ok(root.userData.kitSig)
  } finally { GLTFLoader.prototype.loadAsync = original }
})

test('session reset clears world entities/events and rejects late loads from the prior world', async () => {
  resetClientSession()
  const system = new ServerMeshSystem()
  const oldEntity = EntityManager.createEntity(SerializedEntityType.WORLD, 91001)
  const component = new ServerMeshComponent(oldEntity.id, 'fixture.glb')
  oldEntity.addComponent(component)
  const originalLoad = LoadManager.glTFLoad
  let resolveMesh!: (mesh: THREE.Mesh) => void
  LoadManager.glTFLoad = () => new Promise((resolve) => { resolveMesh = resolve })
  try {
    const pending = system.onServerMeshReceived(new ComponentAddedEvent(component), oldEntity)
    system.dispose()
    resetClientSession()
    assert.deepEqual(EntityManager.getInstance().getAllEntities(), [EventSystem.getInstance().eventQueue.entity])
    assert.equal(EventSystem.getEventsWrapped(ComponentAddedEvent, ServerMeshComponent).length, 0)
    const nextEntity = EntityManager.createEntity(SerializedEntityType.WORLD, 91001)
    nextEntity.addComponent(new ServerMeshComponent(nextEntity.id, 'fixture.glb'))
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
    let materialDisposed = 0, geometryDisposed = 0
    mesh.material.addEventListener('dispose', () => materialDisposed++)
    mesh.geometry.addEventListener('dispose', () => geometryDisposed++)
    resolveMesh(mesh)
    await pending
    assert.equal(nextEntity.getComponent(MeshComponent), undefined)
    assert.equal(oldEntity.getComponent(MeshComponent), undefined)
    assert.equal(materialDisposed, 1)
    assert.equal(geometryDisposed, 0, 'late clone cleanup must retain LoadManager-owned geometry')
    assert.equal(EventSystem.getEventsWrapped(ComponentAddedEvent, ServerMeshComponent).length, 1)
    mesh.geometry.dispose()
  } finally { LoadManager.glTFLoad = originalLoad; resetClientSession() }
})

test('leaving a world releases its camera input and preserves another canvas pointer lock', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const windowEvents = new EventTarget()
  let captures = 0, releases = 0, exits = 0
  const canvas = Object.assign(new EventTarget(), {
    setPointerCapture: (id: number) => { assert.equal(id, 7); captures++ },
    releasePointerCapture: (id: number) => { assert.equal(id, 7); releases++ },
  })
  const documentEvents = Object.assign(new EventTarget(), {
    pointerLockElement: canvas as EventTarget | null,
    exitPointerLock: () => { exits++; documentEvents.pointerLockElement = null },
  })
  const dispatch = (target: EventTarget, type: string, values = {}) => {
    target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), values))
  }
  try {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: windowEvents })
    Object.defineProperty(globalThis, 'document', { configurable: true, value: documentEvents })
    const controller = new OrbitCameraFollowSystem(new THREE.PerspectiveCamera() as never, { domElement: canvas } as never)
    dispatch(canvas, 'pointerdown', { button: 0, pointerId: 7, pointerType: 'touch', clientX: 0, clientY: 0 })
    dispatch(windowEvents, 'pointermove', { movementX: 20, movementY: 10 })
    dispatch(canvas, 'wheel', { deltaY: 1 })
    const yaw = controller.yaw, distance = controller.distance
    controller.dispose()
    controller.dispose()
    assert.equal(captures, 1)
    assert.equal(releases, 1)
    assert.equal(exits, 1)
    documentEvents.pointerLockElement = canvas
    dispatch(documentEvents, 'pointerlockchange')
    dispatch(canvas, 'pointerdown', { button: 0, pointerId: 7, pointerType: 'touch' })
    dispatch(windowEvents, 'pointermove', { movementX: 100, movementY: 100 })
    dispatch(windowEvents, 'pointerup', { pointerId: 7 })
    dispatch(canvas, 'wheel', { deltaY: 1 })
    assert.equal(controller.yaw, yaw)
    assert.equal(controller.distance, distance)
    assert.equal(controller.pointerLocked, false)
    assert.equal(captures, 1)
    assert.equal(releases, 1)
    documentEvents.pointerLockElement = new EventTarget()
    controller.dispose()
    assert.equal(exits, 1, 'another canvas owns its own pointer lock')
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else Reflect.deleteProperty(globalThis, 'window')
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
    else Reflect.deleteProperty(globalThis, 'document')
  }
})
