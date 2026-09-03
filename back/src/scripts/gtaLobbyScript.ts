/**
 * GTA-like voxel world lobby — cars, districts, interactables, trampolines.
 * Production default for GrudgeBlox metaverse test world (port 8001 / GAME_SCRIPT).
 */
import Rapier from '../physics/rapier.js'
import { EventSystem } from '@shared/system/EventSystem.js'
import { ColorComponent } from '@shared/component/ColorComponent.js'
import { PlayerComponent } from '@shared/component/PlayerComponent.js'
import { ProximityPromptComponent } from '@shared/component/ProximityPromptComponent.js'
import { TextComponent } from '@shared/component/TextComponent.js'
import { ColorEvent } from '../ecs/component/events/ColorEvent.js'
import { OnCollisionEnterEvent } from '../ecs/component/events/OnCollisionEnterEvent.js'
import { DynamicRigidBodyComponent } from '../ecs/component/physics/DynamicRigidBodyComponent.js'
import { SpawnPositionComponent } from '../ecs/component/SpawnPositionComponent.js'
import { ZombieComponent } from '../ecs/component/ZombieComponent.js'
import { Car } from '../ecs/entity/Car.js'
import { Cube } from '../ecs/entity/Cube.js'
import { MapWorld } from '../ecs/entity/MapWorld.js'
import { Mesh } from '../ecs/entity/Mesh.js'
import { Sphere } from '../ecs/entity/Sphere.js'
import { TriggerCube } from '../ecs/entity/TriggerCube.js'

function randomHexColor() {
  const hex = Math.floor(Math.random() * 16777215).toString(16)
  return '#' + '0'.repeat(6 - hex.length) + hex
}

const ASSETS = 'https://notbloxo.fra1.cdn.digitaloceanspaces.com/Notblox-Assets'
const CDN = process.env.GRUDGE_ASSETS_CDN || 'https://assets.grudge-studio.com'

// Flat city plate (Notblox flat map) — GTA sandbox ground
new MapWorld(`${ASSETS}/world/FlatMap.glb`)

// ── District markers (billboard text) ───────────────────────────────────────

const DISTRICTS: Array<{ name: string; x: number; z: number; color: string }> = [
  { name: '🏁 SPAWN PLAZA', x: 0, z: 0, color: '#e8c46a' },
  { name: '🚗 MOTOR ROW', x: -80, z: 40, color: '#78b5ff' },
  { name: '⚔️ COMBAT YARD', x: 80, z: -40, color: '#e0553a' },
  { name: '🏪 MARKET STRIP', x: 40, z: 80, color: '#6dce5a' },
  { name: '🏚️ BACK ALLEY', x: -60, z: -90, color: '#a78bfa' },
]

for (const d of DISTRICTS) {
  const pad = new Cube({
    position: { x: d.x, y: 0.5, z: d.z },
    size: { width: 8, height: 1, depth: 8 },
    color: d.color,
  })
  pad.entity.addNetworkComponent(
    new TextComponent(pad.entity.id, d.name, 0, 4, 0, 40),
  )
}

// ── Spawn trampoline (soft landing for new players) ─────────────────────────

const tramp = new TriggerCube(
  0,
  -2,
  12,
  10,
  4,
  10,
  (entity) => {
    if (entity.getComponent(PlayerComponent)) {
      entity
        .getComponent(DynamicRigidBodyComponent)!
        .body!.applyImpulse(new Rapier.Vector3(0, 7000, 0), true)
    }
  },
  () => {},
  false,
)
tramp.entity.addNetworkComponent(
  new TextComponent(tramp.entity.id, '⬆ Jump pad', 0, 2, 0, 24),
)

// ── Street furniture / crates (GTA clutter + physics toys) ──────────────────

for (let i = 0; i < 12; i++) {
  const angle = (i / 12) * Math.PI * 2
  const r = 25 + (i % 3) * 8
  const crate = new Cube({
    position: {
      x: Math.sin(angle) * r,
      y: 2,
      z: Math.cos(angle) * r,
    },
    size: { width: 1.5 + (i % 3) * 0.5, height: 1.5, depth: 1.5 },
    physicsProperties: { enableCcd: true, mass: 2 },
    color: randomHexColor(),
  })
  crate.entity.addComponent(
    new OnCollisionEnterEvent(crate.entity.id, (other) => {
      if (other.getComponent(PlayerComponent)) {
        EventSystem.addEvent(new ColorEvent(crate.entity.id, randomHexColor()))
      }
    }),
  )
}

// ── Interact: change outfit / pulse (E prompt) ──────────────────────────────

const outfitCube = new Cube({
  position: { x: 12, y: 2, z: 8 },
  size: { width: 2, height: 2, depth: 2 },
  color: '#e8c46a',
  physicsProperties: { enableCcd: true },
})
outfitCube.entity.addNetworkComponent(
  new ProximityPromptComponent(outfitCube.entity.id, {
    text: 'E · Street style pulse',
    onInteract: () => {
      EventSystem.addEvent(new ColorEvent(outfitCube.entity.id, randomHexColor()))
      const rb = outfitCube.entity.getComponent(DynamicRigidBodyComponent)
      rb?.body?.applyImpulse(new Rapier.Vector3(0, 4000, 0), true)
    },
    maxInteractDistance: 8,
    interactionCooldown: 300,
    holdDuration: 0,
  }),
)
outfitCube.entity.addNetworkComponent(
  new TextComponent(outfitCube.entity.id, '🎨 Style station', 0, 2.5, 0, 28),
)

// ── Motor row — fleet of cars (GTA sandbox) ─────────────────────────────────

const carSpawns: Array<{ x: number; z: number; name: string; mesh?: string; color?: string }> = [
  { x: -70, z: 30, name: 'City Cruiser', mesh: `${ASSETS}/vehicle/EzCar.glb` },
  { x: -80, z: 40, name: 'Night Runner', mesh: `${ASSETS}/vehicle/EzCar.glb`, color: '#222222' },
  { x: -90, z: 50, name: 'Taxi', mesh: `${ASSETS}/vehicle/CarNoWheel.glb`, color: '#f0c000' },
  { x: -100, z: 35, name: 'Muscle', mesh: `${ASSETS}/vehicle/EzCar.glb`, color: '#e0553a' },
  { x: -75, z: 55, name: 'Brawler Van', mesh: `${ASSETS}/vehicle/CarNoWheel.glb`, color: '#4a5568' },
  { x: -85, z: 25, name: 'Lowrider', mesh: `${ASSETS}/vehicle/EzCar.glb`, color: '#a78bfa' },
]

for (const c of carSpawns) {
  const car = new Car({
    position: { x: c.x, y: 4, z: c.z },
    name: c.name,
    meshUrl: c.mesh,
    color: c.color,
  })
  car.entity.addComponent(new SpawnPositionComponent(car.entity.id, c.x, 4, c.z))
  car.entity.addNetworkComponent(
    new TextComponent(car.entity.id, `🚗 ${c.name}`, 0, 2.2, 0, 22),
  )
}

// Flying novelty car (fun GTA easter egg)
new Car({
  position: { x: 0, y: 25, z: -40 },
  physicsProperties: { gravityScale: 0.08, enableCcd: true },
  name: 'Sky Hopper',
  color: '#78b5ff',
})

// ── Combat yard NPCs (zombies as street thugs) ──────────────────────────────

for (let i = 0; i < 4; i++) {
  const thug = new Mesh({
    position: {
      x: 70 + (i % 2) * 12,
      y: 8,
      z: -50 + Math.floor(i / 2) * 14,
    },
    meshUrl: `${ASSETS}/character/MiniCharacter.glb`,
    physicsProperties: {
      mass: 1,
      angularDamping: 0.5,
      enableCcd: true,
    },
    colliderProperties: { restitution: 0.4 },
  })
  thug.entity.addNetworkComponent(new ColorComponent(thug.entity.id, randomHexColor()))
  thug.entity.addComponent(new ZombieComponent(thug.entity.id))
  thug.entity.addNetworkComponent(
    new TextComponent(thug.entity.id, `👊 Street thug ${i + 1}`, 0, 2, 0),
  )
}

// ── Market balls / loot props ───────────────────────────────────────────────

for (let i = 0; i < 6; i++) {
  new Sphere({
    position: { x: 30 + i * 4, y: 6, z: 70 + (i % 2) * 5 },
    radius: 1.2,
    color: randomHexColor(),
    physicsProperties: { mass: 0.8, enableCcd: true, angularDamping: 0.3 },
    meshUrl: `${ASSETS}/base/Ball.glb`,
  })
}

// ── Back alley bounce pads ──────────────────────────────────────────────────

for (const [x, z] of [
  [-50, -80],
  [-70, -100],
  [-40, -110],
] as const) {
  new TriggerCube(
    x,
    -2,
    z,
    6,
    3,
    6,
    (entity) => {
      if (entity.getComponent(PlayerComponent)) {
        entity
          .getComponent(DynamicRigidBodyComponent)!
          .body!.applyImpulse(new Rapier.Vector3((Math.random() - 0.5) * 2000, 9000, (Math.random() - 0.5) * 2000), true)
      }
    },
    () => {},
    false,
  )
}

// ── Welcome gate near origin ────────────────────────────────────────────────

const gate = new Cube({
  position: { x: 0, y: 3, z: -20 },
  size: { width: 12, height: 6, depth: 1 },
  color: '#1a1a2e',
})
gate.entity.addNetworkComponent(
  new TextComponent(gate.entity.id, '🌆 GRUDGEBLOX CITY · E cars · 1-5 skills', 0, 5, 0, 48),
)

const islandSign = new Cube({
  position: { x: 42, y: 3, z: 0 },
  size: { width: 1, height: 6, depth: 10 },
  color: '#e8c46a',
})
islandSign.entity.addNetworkComponent(
  new TextComponent(islandSign.entity.id, '🏝️ Super Terrain islands → east', 0, 5, 0, 32),
)

console.log('[gtaLobby] GrudgeBlox GTA-like lobby world ready')
console.log(`[gtaLobby] CDN hint ${CDN} (avatars client-side)`)

const onRailway = Boolean(
  process.env.RAILWAY_SERVICE_ID ||
    process.env.RAILWAY_ENVIRONMENT_ID ||
    process.env.RAILWAY_ENVIRONMENT_NAME
)
const liveIslands =
  process.env.ISLAND_LIVE === '1' || (!onRailway && process.env.ISLAND_LIVE !== '0')

if (!liveIslands) {
  console.log('[gtaLobby] island layer off (set ISLAND_LIVE=1 after raising replica memory)')
} else {
  setImmediate(() => {
    void import('./islandLiveRuntime.js')
      .then(({ startIslandLiveRuntime }) => {
        startIslandLiveRuntime({
          map: 'all',
          besideCity: true,
          defaultSpawn: { x: 0, y: 8, z: 0 },
        })
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[gtaLobby] island live layer failed to start: ${message}`)
      })
  })
}
