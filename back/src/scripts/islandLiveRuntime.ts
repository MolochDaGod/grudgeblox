/**
 * Live island layer: Super Terrain heightfields, generative events, NPCs, AI, chat bots.
 *
 * Used by islandSandboxScript (dedicated room) and gtaLobbyScript (production live server).
 */
import { EntityManager } from '@shared/system/EntityManager.js'
import { EventSystem } from '@shared/system/EventSystem.js'
import { PlayerComponent } from '@shared/component/PlayerComponent.js'
import { PositionComponent } from '@shared/component/PositionComponent.js'
import { ProximityPromptComponent } from '@shared/component/ProximityPromptComponent.js'
import { TextComponent } from '@shared/component/TextComponent.js'
import { SerializedMessageType } from '@shared/network/server/serialized.js'
import { ComponentRemovedEvent } from '@shared/component/events/ComponentRemovedEvent.js'
import { ISLAND_CATALOG, type IslandBake } from '@shared/maps/islandBake.js'
import { resolveIslandBake } from '@shared/maps/loadIsland.js'
import {
  chatbotReply,
  generateNpcCast,
  islandHubOrigin,
  nextIslandEvent,
  parseIslandMapId,
  type IslandEventSpec,
  type IslandNpcSpec,
  type Vec3,
} from '@shared/maps/islandLive.js'
import { MessageEvent } from '../ecs/component/events/MessageEvent.js'
import { WorldActionEvent } from '../ecs/component/events/WorldActionEvent.js'
import { SpawnPositionComponent } from '../ecs/component/SpawnPositionComponent.js'
import { ZombieComponent } from '../ecs/component/ZombieComponent.js'
import { IslandNpcComponent } from '../ecs/component/IslandNpcComponent.js'
import { DynamicRigidBodyComponent } from '../ecs/component/physics/DynamicRigidBodyComponent.js'
import { ChatComponent } from '../ecs/component/tag/TagChatComponent.js'
import { ScriptableSystem } from '../ecs/system/ScriptableSystem.js'
import { Cube } from '../ecs/entity/Cube.js'
import { IslandMapWorld } from '../ecs/entity/IslandMapWorld.js'
import { Entity } from '@shared/entity/Entity.js'

const ASSETS = 'https://notbloxo.fra1.cdn.digitaloceanspaces.com/Notblox-Assets'

export type LiveIslandSlot = {
  bake: IslandBake
  origin: Vec3
  spawn: Vec3
  npcs: IslandNpcSpec[]
  world: IslandMapWorld
}

export type IslandLiveOptions = {
  /** `all` loads the full catalog. A catalog id loads one island at the origin. */
  map?: string
  /** Shift islands east of the GTA city plate. */
  besideCity?: boolean
  defaultSpawn?: Vec3
}

function chatEntityId(): number | null {
  const chat = EntityManager.getFirstEntityWithComponent(
    EntityManager.getInstance().getAllEntities(),
    ChatComponent
  )
  return chat?.id ?? null
}

function sendChat(
  author: string,
  message: string,
  type: SerializedMessageType = SerializedMessageType.GLOBAL_CHAT,
  targets: number[] = []
) {
  const chatId = chatEntityId()
  if (chatId == null) return
  EventSystem.addEvent(new MessageEvent(chatId, author, message, type, targets))
}

function teleport(entity: Entity, dest: Vec3) {
  const position = entity.getComponent(PositionComponent)
  if (position) {
    position.x = dest.x
    position.y = dest.y
    position.z = dest.z
    position.updated = true
  }
  entity.removeComponent(SpawnPositionComponent, false)
  entity.addComponent(new SpawnPositionComponent(entity.id, dest.x, dest.y, dest.z))
  const body = entity.getComponent(DynamicRigidBodyComponent)?.body
  if (body) {
    body.setTranslation({ x: dest.x, y: dest.y, z: dest.z }, true)
  }
}

function landPoints(bake: IslandBake, origin: Vec3): Vec3[] {
  const points: Vec3[] = []
  for (const spawn of bake.spawns) {
    points.push({ x: spawn.x + origin.x, y: spawn.y + origin.y, z: spawn.z + origin.z })
  }
  for (const poi of bake.pois) {
    points.push({ x: poi.x + origin.x, y: poi.y + origin.y + 1, z: poi.z + origin.z })
  }
  if (points.length === 0) {
    points.push({ x: origin.x, y: origin.y + bake.maxHeight * 0.4 + 4, z: origin.z })
  }
  return points
}

function spawnNpc(spec: IslandNpcSpec) {
  // Box collider on the server (no convex-hull GLB fetch). Client still draws MiniCharacter.
  const npc = new Cube({
    position: { x: spec.x, y: spec.y, z: spec.z },
    size: { width: 1.1, height: 2.2, depth: 1.1 },
    color: spec.color,
    meshUrl: `${ASSETS}/character/MiniCharacter.glb`,
    physicsProperties: { mass: 1, angularDamping: 0.7, enableCcd: true },
    colliderProperties: { restitution: 0.2 },
  })
  npc.entity.addNetworkComponent(
    new TextComponent(npc.entity.id, spec.name, 0, 2.2, 0, 28)
  )
  npc.entity.addComponent(
    new IslandNpcComponent(
      npc.entity.id,
      spec.role,
      spec.behavior,
      spec.islandId,
      spec.name,
      spec.lines,
      spec.waypoints
    )
  )
  if (spec.behavior === 'hunt') {
    npc.entity.addComponent(new ZombieComponent(npc.entity.id))
  }
  npc.entity.addNetworkComponent(
    new ProximityPromptComponent(npc.entity.id, {
      text: `Talk · ${spec.name}`,
      maxInteractDistance: 8,
      interactionCooldown: 2500,
      onInteract: (player) => {
        const line = spec.lines[Math.floor(Math.random() * spec.lines.length)]
        const playerId = player.getComponent(PlayerComponent) ? player.id : 0
        if (playerId) {
          sendChat(spec.name, line, SerializedMessageType.TARGETED_CHAT, [playerId])
        }
      },
    })
  )
  return npc
}

export function startIslandLiveRuntime(options: IslandLiveOptions = {}): LiveIslandSlot[] {
  const requested = (options.map || process.env.ISLAND_MAP || 'all').trim()
  const single = parseIslandMapId(requested)
  const catalog = single
    ? ISLAND_CATALOG.filter((entry) => entry.id === single)
    : ISLAND_CATALOG
  const besideCity = options.besideCity === true
  const slots: LiveIslandSlot[] = []

  if (besideCity && !process.env.ISLAND_MAP) {
    process.env.ISLAND_MAP = 'live-hub'
  }

  catalog.forEach((entry, index) => {
    const bake = resolveIslandBake(entry.id)
    const origin = single ? { x: 0, y: 0, z: 0 } : islandHubOrigin(index, besideCity)
    const world = new IslandMapWorld(bake, origin)
    const points = landPoints(bake, origin)
    const spawn = points[0]
    const pad = new Cube({
      position: { x: spawn.x, y: Math.max(origin.y + 0.4, spawn.y - 2.4), z: spawn.z },
      size: { width: 8, height: 1, depth: 8 },
      color: '#e8c46a',
    })
    pad.entity.addNetworkComponent(
      new TextComponent(pad.entity.id, `🏝️ ${bake.title}`, 0, 5, 0, 32)
    )
    for (const poi of bake.pois) {
      const marker = new Cube({
        position: { x: poi.x + origin.x, y: poi.y + origin.y, z: poi.z + origin.z },
        size: { width: 2.2, height: 2.2, depth: 2.2 },
        color: poi.color || '#7dd3a0',
      })
      marker.entity.addNetworkComponent(
        new TextComponent(marker.entity.id, poi.label || poi.kind, 0, 3, 0, 20)
      )
    }
    const npcs = generateNpcCast(bake.id, bake.seed, origin, points)
    for (const npc of npcs) spawnNpc(npc)
    slots.push({ bake, origin, spawn, npcs, world })
    console.log(
      `[island-live] ${bake.id} origin=${origin.x},${origin.z} spawn=${spawn.x.toFixed(1)},${spawn.y.toFixed(1)},${spawn.z.toFixed(1)} npcs=${npcs.length} engine=${bake.engine}`
    )
  })

  const defaultSpawn = options.defaultSpawn || slots[0]?.spawn || { x: 0, y: 8, z: 0 }
  const seated = new Map<number, string>()
  let elapsed = 0
  // First generative event ~8s after a player is in the room, then on each event period.
  let eventTimer = 40
  let currentEvent: IslandEventSpec | undefined
  let supplyDrops = 0
  const seed = slots[0]?.bake.seed || 1

  function slotForMap(mapId?: string): LiveIslandSlot | undefined {
    const id = parseIslandMapId(mapId)
    if (!id) return undefined
    return slots.find((slot) => slot.bake.id === id)
  }

  function seatPlayer(entity: Entity, mapId?: string) {
    const slot = slotForMap(mapId) || (options.defaultSpawn ? undefined : slots[0])
    const dest = slot?.spawn || defaultSpawn
    teleport(entity, dest)
    const player = entity.getComponent(PlayerComponent)
    if (player) {
      player.mapId = slot?.bake.id || mapId || ''
      seated.set(entity.id, player.mapId)
    }
    return slot
  }

  ScriptableSystem.update = (dt, entities) => {
    elapsed += dt
    eventTimer += dt

    for (const event of EventSystem.getEventsWrapped(ComponentRemovedEvent, PlayerComponent)) {
      seated.delete(event.entityId)
    }

    for (const action of EventSystem.getEvents(WorldActionEvent)) {
      if (action.action === 'island:status') {
        const slot = slotForMap(
          EntityManager.getEntityById(entities, action.entityId)?.getComponent(PlayerComponent)
            ?.mapId
        )
        sendChat(
          '🏝️ Island Guide',
          `${slot?.bake.title || 'Live hub'} · event ${currentEvent?.title || 'warming'} · NPCs ${slot?.npcs.length ?? 0}.`,
          SerializedMessageType.TARGETED_CHAT,
          [action.entityId]
        )
      }
      const join = parseIslandMapId(action.action.replace(/^island:/, ''))
      if (join) {
        const playerEntity = EntityManager.getEntityById(entities, action.entityId)
        const player = playerEntity?.getComponent(PlayerComponent)
        if (player) player.mapId = join
      }
    }

    for (const entity of entities) {
      const player = entity.getComponent(PlayerComponent)
      if (!player) continue
      const wanted = parseIslandMapId(player.mapId)
      if (!seated.has(entity.id)) {
        const slot = seatPlayer(entity, player.mapId)
        const title = slot?.bake.title || 'GrudgeBlox live sandbox'
        sendChat(
          '🏝️ Island Guide',
          `Welcome ${player.name || 'Player'}. ${title} is live — ${player.gameEra || 'any era'} heroes, NPCs, events, and a guide bot. Say /help.`,
          SerializedMessageType.TARGETED_CHAT,
          [entity.id]
        )
        continue
      }
      if (wanted && wanted !== seated.get(entity.id)) {
        const slot = seatPlayer(entity, wanted)
        sendChat(
          '🏝️ Island Guide',
          `Heading ${slot?.bake.title || wanted}. Watch for raiders off the pad.`,
          SerializedMessageType.TARGETED_CHAT,
          [entity.id]
        )
      }
    }

    for (const message of EventSystem.getEvents(MessageEvent)) {
      if (message.sender.startsWith('🏝️') || message.sender.includes('the ')) continue
      const playerEntity = EntityManager.getEntityById(entities, message.entityId)
      const player = playerEntity?.getComponent(PlayerComponent)
      if (!player) continue
      const slot = slotForMap(player.mapId) || slots[0]
      const reply = chatbotReply(message.content, {
        islandTitle: slot?.bake.title || 'Live sandbox',
        era: player.gameEra,
        eventTitle: currentEvent?.title,
        npcNames: (slot?.npcs || []).map((npc) => npc.name),
      })
      if (reply) {
        sendChat('🏝️ Island Guide', reply, SerializedMessageType.TARGETED_CHAT, [playerEntity!.id])
      }
    }

    const period = currentEvent?.periodSec || 48
    if (eventTimer >= period) {
      eventTimer = 0
      currentEvent = nextIslandEvent(seed, elapsed)
      const slot = slots[Math.floor(Math.random() * slots.length)] || slots[0]
      if (slot) {
        if (currentEvent.kind === 'supply-drop' && supplyDrops < 8) {
          supplyDrops += 1
          const drop = slot.spawn
          const crate = new Cube({
            position: { x: drop.x + 4, y: drop.y + 2, z: drop.z + 2 },
            size: { width: 2, height: 2, depth: 2 },
            color: '#f5c542',
          })
          crate.entity.addNetworkComponent(
            new TextComponent(crate.entity.id, currentEvent.title, 0, 3, 0, 22)
          )
        }
        sendChat(
          '🛰️ Live event',
          `${currentEvent.title} on ${slot.bake.title}. ${currentEvent.line}`,
          SerializedMessageType.GLOBAL_CHAT
        )
      }
    }

    for (const entity of entities) {
      const npc = entity.getComponent(IslandNpcComponent)
      const body = entity.getComponent(DynamicRigidBodyComponent)?.body
      const position = entity.getComponent(PositionComponent)
      if (!npc || !body || !position) continue
      npc.talkCooldown = Math.max(0, npc.talkCooldown - dt)
      if (npc.behavior !== 'patrol' || npc.waypoints.length < 2) continue
      const target = npc.waypoints[npc.waypointIndex % npc.waypoints.length]
      const dx = target.x - position.x
      const dz = target.z - position.z
      const dist = Math.hypot(dx, dz)
      if (dist < 1.6) {
        npc.waypointIndex = (npc.waypointIndex + 1) % npc.waypoints.length
        continue
      }
      const speed = 3.2
      const vx = (dx / dist) * speed
      const vz = (dz / dist) * speed
      const vel = body.linvel()
      body.setLinvel({ x: vx, y: vel.y, z: vz }, true)
    }
  }

  sendChat(
    '🖥️ [SERVER]',
    `Live sandbox online · ${slots.length} island(s) · NPCs, generative events, guide bot.`
  )
  return slots
}
