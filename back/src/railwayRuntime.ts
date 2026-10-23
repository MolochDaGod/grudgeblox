/**
 * Railway city runtime without THREE/GLTF. index.ts pulls Animation, Zombie,
 * Vehicle, Trimesh, and ConvexHull — that graph OOMs the replica after listen.
 */
import { EntityManager } from '@shared/system/EntityManager.js'
import { config } from '@shared/network/config.js'
import { EventSystem } from '@shared/system/EventSystem.js'
import { PlayerComponent } from '@shared/component/PlayerComponent.js'

import { Chat } from './ecs/entity/Chat.js'
import { MovementSystem } from './ecs/system/MovementSystem.js'
import { RandomizeSystem } from './ecs/system/RandomizeSystem.js'
import { MessageEventSystem } from './ecs/system/events/MessageEventSystem.js'
import { ColorEventSystem } from './ecs/system/events/ColorEventSystem.js'
import { DestroyEventSystem } from './ecs/system/events/DestroyEventSystem.js'
import { SingleSizeEventSystem } from './ecs/system/events/SingleSizeEventSystem.js'
import { SizeEventSystem } from './ecs/system/events/SizeEventSystem.js'
import { NetworkSystem } from './ecs/system/network/NetworkSystem.js'
import { BoundaryCheckSystem } from './ecs/system/physics/BoundaryCheckSystem.js'
import { BoxColliderSystem } from './ecs/system/physics/BoxColliderSystem.js'
import { CapsuleColliderSystem } from './ecs/system/physics/CapsuleColliderSystem.js'
import { DynamicRigidBodySystem } from './ecs/system/physics/DynamicRigidBodySystem.js'
import { GroundedCheckSystem } from './ecs/system/physics/GroundedCheckSystem.js'
import { KinematicRigidBodySystem } from './ecs/system/physics/KinematicRigidBodySystem.js'
import { LockRotationSystem } from './ecs/system/physics/LockRotationSystem.js'
import { PhysicsSystem } from './ecs/system/physics/PhysicsSystem.js'
import { SleepCheckSystem } from './ecs/system/physics/SleepCheckSystem.js'
import { SphereColliderSystem } from './ecs/system/physics/SphereColliderSystem.js'
import { SyncPositionSystem } from './ecs/system/physics/SyncPositionSystem.js'
import { SyncRotationSystem } from './ecs/system/physics/SyncRotationSystem.js'
import { ScriptableSystem } from './ecs/system/ScriptableSystem.js'

const eventSystem = EventSystem.getInstance()
const entities = EntityManager.getInstance().getAllEntities()

const kinematicPhysicsBodySystem = new KinematicRigidBodySystem()
const rigidPhysicsBodySystem = new DynamicRigidBodySystem()
const boxColliderSystem = new BoxColliderSystem()
const capsuleColliderSystem = new CapsuleColliderSystem()
const sphereColliderSystem = new SphereColliderSystem()
const physicsSystem = PhysicsSystem.getInstance()
const groundedCheckSystem = new GroundedCheckSystem()
const lockedRotationSystem = new LockRotationSystem()
const colorEventSystem = new ColorEventSystem()
const singleSizeEventSystem = new SingleSizeEventSystem()
const sizeEventSystem = new SizeEventSystem()
const syncPositionSystem = new SyncPositionSystem()
const syncRotationSystem = new SyncRotationSystem()
const messageEventSystem = new MessageEventSystem()
const destroyEventSystem = new DestroyEventSystem()
const movementSystem = new MovementSystem()
const sleepCheckSystem = new SleepCheckSystem()
const randomizeSystem = new RandomizeSystem()
const boundaryCheckSystem = new BoundaryCheckSystem()

new Chat()

const fixedTimestep = 1000 / config.SERVER_TICKRATE
let networkSystem: NetworkSystem | undefined
let lastFrameTime = Date.now()
let accumulator = 0

function hasPlayers() {
  return EntityManager.getFirstEntityWithComponent(entities, PlayerComponent) !== undefined
}

async function updateGameState(dt: number) {
  destroyEventSystem.update(entities)
  physicsSystem.update(entities)
  boundaryCheckSystem.update(entities)
  ScriptableSystem.update(dt, entities)

  kinematicPhysicsBodySystem.update(entities, physicsSystem.world)
  rigidPhysicsBodySystem.update(entities, physicsSystem.world)
  boxColliderSystem.update(entities, physicsSystem.world)
  capsuleColliderSystem.update(entities, physicsSystem.world)
  sphereColliderSystem.update(entities, physicsSystem.world)

  randomizeSystem.update(entities)
  sizeEventSystem.update(entities)
  singleSizeEventSystem.update(entities)
  colorEventSystem.update(entities)

  groundedCheckSystem.update(entities, physicsSystem.world)
  movementSystem.update(dt, entities)
  syncRotationSystem.update(entities)
  syncPositionSystem.update(entities)

  messageEventSystem.update(entities)
  lockedRotationSystem.update(entities)
  if (!networkSystem) throw new Error('Network system is not initialized')
  networkSystem.update(entities)
  sleepCheckSystem.update(entities)

  destroyEventSystem.afterUpdate(entities)
  eventSystem.afterUpdate(entities)
}

async function gameLoop() {
  const now = Date.now()
  const deltaTime = now - lastFrameTime
  lastFrameTime = now
  accumulator += deltaTime

  if (!hasPlayers()) {
    setTimeout(gameLoop, 1000)
    accumulator = 0
    return
  }

  try {
    while (accumulator >= fixedTimestep) {
      await updateGameState(fixedTimestep)
      accumulator -= fixedTimestep
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[gameLoop] tick failed; continuing: ${message}`)
    accumulator = 0
  }

  setTimeout(gameLoop, config.SERVER_TICKRATE / 2)
}

export async function startRailwayRuntime(existing: NetworkSystem) {
  if (networkSystem) throw new Error('Game runtime has already been started')
  networkSystem = existing
  console.log('[railway] slim runtime: Rapier + boxes, no THREE/GLTF')
  lastFrameTime = Date.now()
  gameLoop()
}
