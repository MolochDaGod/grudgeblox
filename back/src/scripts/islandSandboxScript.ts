/**
 * Island sandbox — baked Island Terrain World Engine maps, all-era play.
 *
 * GAME_SCRIPT=islandSandboxScript.ts
 * ISLAND_MAP=harbor-atoll|volcanic-ridge|frozen-fjord|alpine-mesh|granite-csg|spline-forest|tunnel-cavern
 * ISLAND_ENGINE_ROOT=/path/to/Island-Terrain-World-Engine  (optional live export)
 * SUPER_TERRAIN_ROOT=/path/to/super-terrain export (meshterrain-world.json)
 */
import { EntityManager } from '@shared/system/EntityManager.js'
import { EventSystem } from '@shared/system/EventSystem.js'
import { PlayerComponent } from '@shared/component/PlayerComponent.js'
import { PositionComponent } from '@shared/component/PositionComponent.js'
import { TextComponent } from '@shared/component/TextComponent.js'
import { SerializedMessageType } from '@shared/network/server/serialized.js'
import { ComponentAddedEvent } from '@shared/component/events/ComponentAddedEvent.js'
import { MessageEvent } from '../ecs/component/events/MessageEvent.js'
import { SpawnPositionComponent } from '../ecs/component/SpawnPositionComponent.js'
import { DynamicRigidBodyComponent } from '../ecs/component/physics/DynamicRigidBodyComponent.js'
import { ChatComponent } from '../ecs/component/tag/TagChatComponent.js'
import { ScriptableSystem } from '../ecs/system/ScriptableSystem.js'
import { Cube } from '../ecs/entity/Cube.js'
import { IslandMapWorld } from '../ecs/entity/IslandMapWorld.js'
import { resolveIslandBake } from '@shared/maps/loadIsland.js'

const bake = resolveIslandBake(process.env.ISLAND_MAP)
const world = new IslandMapWorld(bake)
const spawn = bake.spawns[0] || { x: 0, y: bake.maxHeight * 0.4 + 4, z: 0 }

console.log(
  `[island] loaded ${bake.id} seed=${bake.seed} size=${bake.size} spawn=${spawn.x.toFixed(1)},${spawn.y.toFixed(1)},${spawn.z.toFixed(1)} engine=${bake.engine}`
)

const pad = new Cube({
  position: { x: spawn.x, y: Math.max(0.4, spawn.y - 2.4), z: spawn.z },
  size: { width: 8, height: 1, depth: 8 },
  color: '#e8c46a',
})
pad.entity.addNetworkComponent(
  new TextComponent(pad.entity.id, `🏝️ ${bake.title}`, 0, 5, 0, 36)
)

for (const poi of bake.pois) {
  const marker = new Cube({
    position: { x: poi.x, y: poi.y, z: poi.z },
    size: { width: 2.4, height: 2.4, depth: 2.4 },
    color: poi.color || '#7dd3a0',
  })
  marker.entity.addNetworkComponent(
    new TextComponent(marker.entity.id, poi.label || poi.kind, 0, 3, 0, 22)
  )
}

function chatEntityId(): number | null {
  const chat = EntityManager.getFirstEntityWithComponent(
    EntityManager.getInstance().getAllEntities(),
    ChatComponent
  )
  return chat?.id ?? null
}

function sendTargeted(author: string, message: string, playerId: number) {
  const chatId = chatEntityId()
  if (chatId == null) return
  EventSystem.addEvent(
    new MessageEvent(chatId, author, message, SerializedMessageType.TARGETED_CHAT, [playerId])
  )
}

ScriptableSystem.update = (_dt, entities) => {
  const playerAddedEvents = EventSystem.getEventsWrapped(ComponentAddedEvent, PlayerComponent)
  for (const event of playerAddedEvents) {
    const playerEntity = EntityManager.getEntityById(entities, event.entityId)
    if (!playerEntity) continue
    const position = playerEntity.getComponent(PositionComponent)
    if (position) {
      position.x = spawn.x
      position.y = spawn.y
      position.z = spawn.z
      position.updated = true
    }
    playerEntity.addComponent(
      new SpawnPositionComponent(playerEntity.id, spawn.x, spawn.y, spawn.z)
    )
    const body = playerEntity.getComponent(DynamicRigidBodyComponent)?.body
    if (body) {
      body.setTranslation({ x: spawn.x, y: spawn.y, z: spawn.z }, true)
    }
    const name = playerEntity.getComponent(PlayerComponent)?.name ?? 'Player'
    const era = playerEntity.getComponent(PlayerComponent)?.gameEra ?? 'any era'
    sendTargeted(
      '🏝️ Island Sandbox',
      `Welcome ${name}. ${bake.title} is an all-era sandbox — ${era} heroes play here. Seed ${bake.seed}.`,
      playerEntity.id
    )
  }
}

void world
