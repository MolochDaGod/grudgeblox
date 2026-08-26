/**
 * Dope Budz Streets — GrudgeBlox GTA lobby script.
 * Set GAME_SCRIPT=dopebudzStreets.ts on the live server (port 8001).
 */
import Rapier from '../physics/rapier.js'
import { EventSystem } from '@shared/system/EventSystem.js'
import { ColorComponent } from '@shared/component/ColorComponent.js'
import { PlayerComponent } from '@shared/component/PlayerComponent.js'
import { ProximityPromptComponent } from '@shared/component/ProximityPromptComponent.js'
import { TextComponent } from '@shared/component/TextComponent.js'
import { ColorEvent } from '../ecs/component/events/ColorEvent.js'
import { DynamicRigidBodyComponent } from '../ecs/component/physics/DynamicRigidBodyComponent.js'
import { SpawnPositionComponent } from '../ecs/component/SpawnPositionComponent.js'
import { ZombieComponent } from '../ecs/component/ZombieComponent.js'
import { Car } from '../ecs/entity/Car.js'
import { Cube } from '../ecs/entity/Cube.js'
import { MapWorld } from '../ecs/entity/MapWorld.js'
import { Mesh } from '../ecs/entity/Mesh.js'
import { TriggerCube } from '../ecs/entity/TriggerCube.js'

const ASSETS = 'https://notbloxo.fra1.cdn.digitaloceanspaces.com/Notblox-Assets'

new MapWorld(`${ASSETS}/world/FlatMap.glb`)

const DISTRICTS = [
  { name: 'GROVE CITY · HQ', x: 0, z: 0, color: '#9db59a' },
  { name: 'HARBOR HEIGHTS', x: 0, z: -80, color: '#78b5ff' },
  { name: 'NEON STRIP', x: 80, z: 0, color: '#ff6ad5' },
  { name: 'MESA FLATS', x: -80, z: 0, color: '#c4a15a' },
  { name: 'FOGTOWN', x: 0, z: 80, color: '#a78bfa' },
  { name: 'LITTLE BEACH', x: 80, z: 80, color: '#e8c46a' },
]

for (const d of DISTRICTS) {
  const pad = new Cube({
    position: { x: d.x, y: 0.5, z: d.z },
    size: { width: 10, height: 1, depth: 10 },
    color: d.color,
  })
  pad.entity.addNetworkComponent(new TextComponent(pad.entity.id, d.name, 0, 4, 0, 40))
}

for (let i = 0; i < 16; i++) {
  const col = i % 4
  const row = Math.floor(i / 4)
  const x = 28 + col * 8
  const z = 28 + row * 8
  const sol = i % 3 === 0
  const lot = new Cube({
    position: { x, y: 0.2, z },
    size: { width: 6, height: 0.4, depth: 6 },
    color: sol ? '#c4a15a' : '#3a5a32',
  })
  const price = sol ? `${(0.35 + col * 0.08).toFixed(2)} SOL` : `${180 + i * 25} BUDZ`
  lot.entity.addNetworkComponent(
    new ProximityPromptComponent(lot.entity.id, {
      text: `E · Deed ${i + 1} · ${price}`,
      onInteract: () => {
        EventSystem.addEvent(new ColorEvent(lot.entity.id, '#2f5a32'))
      },
      maxInteractDistance: 8,
      interactionCooldown: 400,
      holdDuration: 0,
    }),
  )
  lot.entity.addNetworkComponent(new TextComponent(lot.entity.id, `LOT ${i + 1}`, 0, 2.2, 0, 22))
}

for (let i = 0; i < 6; i++) {
  const bench = new Cube({
    position: { x: -48 + (i % 3) * 5, y: 1, z: -4 + Math.floor(i / 3) * 8 },
    size: { width: 2, height: 1.2, depth: 2 },
    color: '#3d4a38',
  })
  bench.entity.addNetworkComponent(
    new ProximityPromptComponent(bench.entity.id, {
      text: 'E · Plant / water / harvest',
      onInteract: () => EventSystem.addEvent(new ColorEvent(bench.entity.id, '#6fbf63')),
      maxInteractDistance: 7,
      interactionCooldown: 300,
      holdDuration: 0,
    }),
  )
}

const TERMS = [
  { title: 'Alley Drop', x: -16, z: -16, color: '#c4a15a' },
  { title: 'Corner Sale', x: 16, z: -16, color: '#6dce5a' },
  { title: 'Stash Job', x: 8, z: 88, color: '#e0553a' },
  { title: 'Dock Courier', x: 0, z: -96, color: '#78b5ff' },
]
for (const t of TERMS) {
  const k = new Cube({
    position: { x: t.x, y: 1.4, z: t.z },
    size: { width: 1.4, height: 2.4, depth: 1.4 },
    color: t.color,
  })
  k.entity.addNetworkComponent(
    new ProximityPromptComponent(k.entity.id, {
      text: `E · ${t.title}`,
      onInteract: () => EventSystem.addEvent(new ColorEvent(k.entity.id, '#e8c46a')),
      maxInteractDistance: 8,
      interactionCooldown: 500,
      holdDuration: 0,
    }),
  )
  k.entity.addNetworkComponent(new TextComponent(k.entity.id, t.title, 0, 2.6, 0, 24))
}

const carSpawns = [
  { x: -70, z: 30, name: 'City Cruiser', color: '#9db59a' },
  { x: -80, z: 40, name: 'Night Runner', color: '#222222' },
  { x: -90, z: 50, name: 'Taxi', color: '#f0c000' },
  { x: -100, z: 35, name: 'Muscle', color: '#e0553a' },
  { x: -75, z: 55, name: 'Brawler Van', color: '#4a5568' },
  { x: -85, z: 25, name: 'Lowrider', color: '#a78bfa' },
]
for (const c of carSpawns) {
  const car = new Car({
    position: { x: c.x, y: 4, z: c.z },
    name: c.name,
    meshUrl: `${ASSETS}/vehicle/EzCar.glb`,
    color: c.color,
  })
  car.entity.addComponent(new SpawnPositionComponent(car.entity.id, c.x, 4, c.z))
  car.entity.addNetworkComponent(new TextComponent(car.entity.id, `DRIVE ${c.name}`, 0, 2.2, 0, 22))
}

for (let i = 0; i < 5; i++) {
  const thug = new Mesh({
    position: { x: 70 + (i % 2) * 12, y: 8, z: -50 + Math.floor(i / 2) * 14 },
    meshUrl: `${ASSETS}/character/MiniCharacter.glb`,
    physicsProperties: { mass: 1, angularDamping: 0.5, enableCcd: true },
    colliderProperties: { restitution: 0.4 },
  })
  thug.entity.addNetworkComponent(new ColorComponent(thug.entity.id, i % 2 ? '#6a4032' : '#4a3a48'))
  thug.entity.addComponent(new ZombieComponent(thug.entity.id))
  thug.entity.addNetworkComponent(new TextComponent(thug.entity.id, `Street crew ${i + 1}`, 0, 2, 0))
}

const tramp = new TriggerCube(
  0,
  -2,
  12,
  10,
  4,
  10,
  (entity) => {
    if (entity.getComponent(PlayerComponent)) {
      entity.getComponent(DynamicRigidBodyComponent)!.body!.applyImpulse(new Rapier.Vector3(0, 7000, 0), true)
    }
  },
  () => {},
  false,
)
tramp.entity.addNetworkComponent(new TextComponent(tramp.entity.id, 'Grove jump pad', 0, 2, 0, 24))

const gate = new Cube({
  position: { x: 0, y: 3, z: -20 },
  size: { width: 14, height: 6, depth: 1 },
  color: '#1a1a2e',
})
gate.entity.addNetworkComponent(
  new TextComponent(gate.entity.id, 'DOPE BUDZ STREETS · F cars · E deeds · 1-4 kits', 0, 5, 0, 48),
)

console.log('[dopebudzStreets] Grove / Harbor / Neon / Mesa / Fogtown / Little Beach ready')
