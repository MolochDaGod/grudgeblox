import { existsSync } from 'node:fs'
import {
  App,
  DEDICATED_COMPRESSOR_3KB,
  HttpRequest,
  HttpResponse,
  SSLApp,
  WebSocket,
  us_listen_socket,
  us_socket_context_t,
} from 'uWebSockets.js'
import { unpack } from 'msgpackr'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import { config } from '@shared/network/config.js'

import { EntityDestroyedEvent } from '@shared/component/events/EntityDestroyedEvent.js'
import {
  ChatMessage,
  InputMessage,
  ProximityPromptInteractMessage,
  SetPlayerNameMessage,
  WorldActionMessage,
  ClientMessageType,
  ClientMessage,
} from '@shared/network/client/index.js'
import {
  ConnectionMessage,
  SerializedMessageType,
  ServerMessageType,
} from '@shared/network/server/index.js'
import { EventSystem } from '@shared/system/EventSystem.js'

import { MessageEvent } from '../../component/events/MessageEvent.js'
import { Player } from '../../entity/Player.js'
import { InputProcessingSystem } from '../InputProcessingSystem.js'
import { NetworkSystem } from './NetworkSystem.js'
import { ProximityPromptInteractEvent } from '../../component/events/ProximityPromptInteractEvent.js'
import { TextComponent } from '@shared/component/TextComponent.js'
import { PlayerComponent } from '@shared/component/PlayerComponent.js'
import { ServerMeshComponent } from '@shared/component/ServerMeshComponent.js'
import { EntityManager } from '@shared/system/EntityManager.js'
import { MessageListComponent } from '@shared/component/MessageComponent.js'
import { ChatComponent } from '../../component/tag/TagChatComponent.js'
import { WebSocketComponent } from '../../component/WebsocketComponent.js'
import { WorldActionEvent } from '../../component/events/WorldActionEvent.js'

type PlayerData = { player?: Player }
type MessageHandler = (ws: WebSocket<PlayerData>, message: ClientMessage) => void

function allowedOriginsFromEnv(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function originAllowed(origin: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true
  if (allowed.includes('*')) return true
  if (allowed.includes(origin)) return true
  return allowed.some((rule) => {
    if (!rule.includes('*')) return false
    const escaped = rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')
    return new RegExp(`^${escaped}$`).test(origin)
  })
}

export class WebsocketSystem {
  private port: number = Number(process.env.PORT || process.env.GAME_PORT || 8001)
  private players: Player[] = []
  private messageHandlers: Map<ClientMessageType, MessageHandler> = new Map()
  private inputProcessingSystem: InputProcessingSystem = new InputProcessingSystem()
  private limiter = new RateLimiterMemory({
    points: 10, // Max 10 points per second
    duration: 1, // Each point expires after 1 second
  })

  constructor() {
    const configuredPort = Number(process.env.GAME_PORT)
    if (Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort <= 65535) {
      this.port = configuredPort
    }
    this.initializeServer()
    this.initializeMessageHandlers()
  }
  private async isRateLimited(ip: string): Promise<boolean> {
    try {
      await this.limiter.consume(ip) // Use a unique identifier for each WebSocket connection
      return false // Not rate limited
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_rejRes) {
      return true // Rate limited
    }
  }

  private initializeServer() {
    const isProduction = process.env.NODE_ENV === 'production'
    const listenHost = process.env.LISTEN_HOST || (isProduction ? '0.0.0.0' : '127.0.0.1')
    const allowedOrigins = allowedOriginsFromEnv(process.env.FRONTEND_URL)
    const sslKeyFile = process.env.SSL_KEY_FILE || ''
    const sslCertFile = process.env.SSL_CERT_FILE || ''
    const isRailway = Boolean(
      process.env.RAILWAY_ENVIRONMENT_NAME ||
        process.env.RAILWAY_ENVIRONMENT_ID ||
        process.env.RAILWAY_SERVICE_ID,
    )
    // Railway / Vercel terminate TLS. Only bind SSLApp when cert files exist and we are not on Railway.
    const useTls =
      !isRailway &&
      Boolean(sslKeyFile && sslCertFile && existsSync(sslKeyFile) && existsSync(sslCertFile))

    if (isRailway) {
      console.log('RAILWAY : plain HTTP behind proxy')
    } else if (isProduction) {
      console.log('NODE_ENV : production')
    } else {
      console.log('NODE_ENV : development')
    }
    console.log(`TLS in-process: ${useTls ? 'on' : 'off (edge proxy)'}`)
    console.log(`PORT : Listening on ${listenHost}:${this.port}`)

    if (allowedOrigins.length) {
      console.log('FRONTEND_URL : accepting origins:', allowedOrigins.join(', '))
    }

    const app = useTls
      ? SSLApp({
          key_file_name: sslKeyFile,
          cert_file_name: sslCertFile,
        })
      : App()

    // Add health check endpoint
    app.get('/health', (res) => {
      // Get connected players count
      const connectedPlayers = this.players.map(
        (player) => player.entity.getComponent(PlayerComponent)?.name
      )

      // Get message list from MessageListComponent if available
      const chatEntity = EntityManager.getFirstEntityWithComponent(
        EntityManager.getInstance().getAllEntities(),
        ChatComponent
      )
      const messageListComponent = chatEntity?.getComponent(MessageListComponent)
      const messages = messageListComponent?.list

      const healthData = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        game: {
          script: process.env.GAME_SCRIPT || 'Unknown',
          tickrate: config.SERVER_TICKRATE,
        },
        players: connectedPlayers,
        messages: {
          globalChat: messages?.filter(
            ({ messageType }) => messageType === SerializedMessageType.GLOBAL_CHAT
          ),
          targetedChat: messages?.filter(
            ({ messageType }) => messageType === SerializedMessageType.TARGETED_CHAT
          ),
          globalNotification: messages?.filter(
            ({ messageType }) => messageType === SerializedMessageType.GLOBAL_NOTIFICATION
          ),
          targetedNotification: messages?.filter(
            ({ messageType }) => messageType === SerializedMessageType.TARGETED_NOTIFICATION
          ),
        },
      }

      res.writeHeader('Content-Type', 'application/json')
      res.writeHeader('Access-Control-Allow-Origin', '*')
      res.end(JSON.stringify(healthData))
    })

    app.ws<PlayerData>('/*', {
      idleTimeout: 32,
      maxBackpressure: 1024,
      maxPayloadLength: 512,
      compression: DEDICATED_COMPRESSOR_3KB,
      message: this.onMessage.bind(this),
      open: this.onConnect.bind(this),
      drain: this.onDrain.bind(this),
      close: this.onClose.bind(this),
      upgrade: this.upgradeHandler.bind(this, isProduction, allowedOrigins),
    })

    app.listen(listenHost, this.port, (listenSocket) =>
      this.listenHandler(listenSocket, listenHost)
    )
  }
  private upgradeHandler(
    isProduction: boolean,
    allowedOrigins: string[],
    res: HttpResponse,
    req: HttpRequest,
    context: us_socket_context_t
  ) {
    const origin = req.getHeader('origin')
    if (isProduction && allowedOrigins.length > 0 && origin && !originAllowed(origin, allowedOrigins)) {
      res.writeStatus('403 Forbidden').end()
      return
    }

    res.upgrade<PlayerData>(
      {},
      req.getHeader('sec-websocket-key'),
      req.getHeader('sec-websocket-protocol'),
      req.getHeader('sec-websocket-extensions'),
      context
    )
  }

  private listenHandler(listenSocket: us_listen_socket, listenHost: string) {
    if (listenSocket) {
      console.log(`WebSocket server listening on ${listenHost}:${this.port}`)
    } else {
      console.error(`Failed to listen on ${listenHost}:${this.port}`)
    }
  }

  private initializeMessageHandlers() {
    this.addMessageHandler(
      ClientMessageType.INPUT,
      this.handleInputMessage.bind(this) as MessageHandler
    )
    this.addMessageHandler(
      ClientMessageType.CHAT_MESSAGE,
      this.handleChatMessage.bind(this) as MessageHandler
    )
    this.addMessageHandler(
      ClientMessageType.PROXIMITY_PROMPT_INTERACT,
      this.handleProximityPromptInteractMessage.bind(this) as MessageHandler
    )
    this.addMessageHandler(
      ClientMessageType.SET_PLAYER_NAME,
      this.handleSetPlayerNameMessage.bind(this) as MessageHandler
    )
    this.addMessageHandler(
      ClientMessageType.WORLD_ACTION,
      this.handleWorldActionMessage.bind(this) as MessageHandler
    )
  }

  private addMessageHandler(type: ClientMessageType, handler: MessageHandler) {
    this.messageHandlers.set(type, handler)
  }

  private removeMessageHandler(type: ClientMessageType) {
    this.messageHandlers.delete(type)
  }

  private onMessage(ws: WebSocket<PlayerData>, message: ArrayBuffer) {
    const clientMessage: ClientMessage = unpack(Buffer.from(message))
    const handler = this.messageHandlers.get(clientMessage.t)
    if (handler) {
      handler(ws, clientMessage)
    }
  }

  // TODO: Create EventOnPlayerConnect and EventOnPlayerDisconnect to respects ECS
  // Might be useful to query the chat and send a message to all players when a player connects or disconnects
  // Also could append scriptable events to be triggered on connect/disconnect depending on the game
  private async onConnect(ws: WebSocket<PlayerData>) {
    const ipBuffer = ws.getRemoteAddressAsText() as ArrayBuffer
    const ip = Buffer.from(ipBuffer).toString()
    if (await this.isRateLimited(ip)) {
      // Respond to the client indicating that the connection is rate limited
      return ws.close()
    }
    const player = new Player(ws, Math.random() * 5, 5, Math.random() * 5)
    const connectionMessage: ConnectionMessage = {
      t: ServerMessageType.FIRST_CONNECTION,
      id: player.entity.id,
      tickRate: config.SERVER_TICKRATE,
    }
    // player.entity.addComponent(new RandomizeComponent(player.entity.id))
    ws.getUserData().player = player
    ws.send(NetworkSystem.compress(connectionMessage), true)

    EventSystem.addEvent(
      new MessageEvent(
        player.entity.id,
        '🖥️ [SERVER]',
        `New player joined at ${new Date().toLocaleString()}`
      )
    )
    this.players.push(player)
  }

  private onDrain(ws: WebSocket<PlayerData>) {
    console.log('WebSocket backpressure: ' + ws.getBufferedAmount())
  }

  private onClose(ws: WebSocket<PlayerData>) {
    const disconnectedPlayer = ws.getUserData().player
    if (!disconnectedPlayer) {
      console.error('Disconnect: Player not found?', ws)
      return
    }

    console.log('Disconnect: Player found!')
    const entity = disconnectedPlayer.entity
    const entityId = entity.id

    EventSystem.addNetworkEvent(new EntityDestroyedEvent(entityId))

    // Remove player from players array
    this.players = this.players.filter((player) => player !== disconnectedPlayer)

    // Remove the WebsocketComponent directly to avoid sending messages to the client
    entity.removeComponent(WebSocketComponent)
  }

  private handleInputMessage(ws: WebSocket<PlayerData>, message: InputMessage) {
    const player = ws.getUserData().player
    if (!player) {
      console.error(`Player with WS ${ws} not found.`)
      return
    }
    const { u: up, d: down, l: left, r: right, s: space, y: angleY, i: interact } = message
    if (
      typeof up !== 'boolean' ||
      typeof down !== 'boolean' ||
      typeof left !== 'boolean' ||
      typeof right !== 'boolean' ||
      typeof space !== 'boolean' ||
      typeof angleY !== 'number' ||
      typeof interact !== 'boolean'
    ) {
      console.error('Invalid input message', message)
      return
    }

    this.inputProcessingSystem.receiveInputPacket(player.entity, message)
  }

  private handleChatMessage(ws: WebSocket<PlayerData>, message: ChatMessage) {
    console.log('Chat message received', message)
    const player = ws.getUserData().player
    if (!player) {
      console.error(`Player with WS ${ws} not found.`)
      return
    }

    const { content } = message
    if (!content || typeof content !== 'string' || content.length === 0) {
      console.error(`Invalid chat message, sent from ${player}`, message)
      return
    }

    const playerName = player.entity.getComponent(PlayerComponent)?.name
    if (!playerName) {
      console.error(`Player name not found for player ${player.entity.id}`)
      return
    }

    EventSystem.addEvent(new MessageEvent(player.entity.id, playerName, content))
  }
  private handleProximityPromptInteractMessage(
    ws: WebSocket<PlayerData>,
    message: ProximityPromptInteractMessage
  ) {
    const player = ws.getUserData().player
    if (!player) {
      console.error(`Player with WS ${ws} not found.`)
      return
    }
    const { eId } = message
    EventSystem.addEvent(new ProximityPromptInteractEvent(player.entity.id, eId))
  }

  private applyPlayerAppearance(
    playerComponent: PlayerComponent,
    message: SetPlayerNameMessage,
    serverMesh?: { filePath: string; updated: boolean }
  ) {
    const allowedRace = new Set(['human', 'barbarian', 'dwarf', 'high_elf', 'orc', 'undead'])
    const allowedClass = new Set(['warrior', 'ranger', 'mage', 'adventurer'])
    let race = typeof message.raceId === 'string' ? message.raceId.toLowerCase().trim() : ''
    if (race.includes('elf')) race = 'high_elf'
    else if (race.includes('barb')) race = 'barbarian'
    else if (race.includes('dwarf')) race = 'dwarf'
    else if (race.includes('orc')) race = 'orc'
    else if (race.includes('undead')) race = 'undead'
    else if (race.includes('human') || race === 'wk') race = 'human'
    if (!allowedRace.has(race)) race = playerComponent.raceId || 'human'

    let klass = typeof message.classId === 'string' ? message.classId.toLowerCase().trim() : ''
    if (klass.includes('war') || klass.includes('sword')) klass = 'warrior'
    else if (klass.includes('range') || klass.includes('bow')) klass = 'ranger'
    else if (klass.includes('mage') || klass.includes('magic') || klass.includes('wiz')) klass = 'mage'
    else if (klass.includes('advent')) klass = 'adventurer'
    if (!allowedClass.has(klass)) klass = playerComponent.classId || 'adventurer'

    let characterId = typeof message.characterId === 'string' ? message.characterId.trim() : ''
    characterId = characterId.replace(/[^\w-]/g, '').substring(0, 64)

    let model3d = typeof message.model3d === 'string' ? message.model3d.replace(/\\/g, '/') : ''
    const modelMatch = model3d.match(/races\/(human|barbarian|dwarf|high_elf|orc|undead)\.glb$/i)
    model3d = modelMatch ? `races/${modelMatch[1].toLowerCase()}.glb` : `races/${race}.glb`

    playerComponent.raceId = race
    playerComponent.classId = klass
    playerComponent.characterId = characterId
    playerComponent.model3d = model3d
    playerComponent.updated = true

    if (serverMesh) {
      serverMesh.filePath = `/kit/4character/${model3d}`
      serverMesh.updated = true
    }
  }

  private handleSetPlayerNameMessage(ws: WebSocket<PlayerData>, message: SetPlayerNameMessage) {
    const player = ws.getUserData().player
    if (!player) {
      console.error(`Player with WS ${ws} not found.`)
      return
    }

    const playerComponent = player.entity.getComponent(PlayerComponent)
    const serverMesh = player.entity.getComponent(ServerMeshComponent)
    if (playerComponent) {
      this.applyPlayerAppearance(playerComponent, message, serverMesh)
    }

    const { name } = message
    if (!name || typeof name !== 'string') {
      return
    }

    // Check if player already has a custom name (not the default "Player" name)
    if (playerComponent && !playerComponent.name.startsWith('Player')) {
      return
    }

    // Sanitize player name to prevent abuse
    let sanitizedName = name.trim().substring(0, 20)
    // Remove any HTML tags or potentially harmful characters
    sanitizedName = sanitizedName.replace(/<[^>]*>|[<>]/g, '')
    // Remove all spaces from the name
    sanitizedName = sanitizedName.replace(/\s+/g, '')
    // Default to "Player" if name is empty after sanitization
    if (!sanitizedName) sanitizedName = `Player ${player.entity.id}`

    // Check for duplicate names
    const isDuplicateName = this.players.some(
      (p) =>
        p.entity.id !== player.entity.id &&
        p.entity.getComponent(PlayerComponent)?.name === sanitizedName
    )
    if (isDuplicateName) {
      console.log(`Player ${player.entity.id} attempted to use duplicate name: ${sanitizedName}`)
      sanitizedName += `${player.entity.id}`
    }

    // The player component holds the name, but the TextComponent could be altered by game scripts
    // Like : [New Player] - iErcan (10)
    // To not lose the name of the player, store it in the PlayerComponent
    // TODO: Make it more abstract by using a NameComponent.
    // Find the PlayerComponent on the player entity and update it
    if (playerComponent) {
      playerComponent.name = sanitizedName
      playerComponent.updated = true
    } else {
      console.error(`PlayerComponent not found for player ${player.entity.id}`)
    }

    // Find the TextComponent on the player entity and update it
    // Visual update of the name, could be changed in the future because games will alter this
    // This resets the styling of the name
    const textComponent = player.entity.getComponent(TextComponent)
    if (textComponent) {
      textComponent.text = sanitizedName
      // Updated it gets broadcasted + re-rendered
      textComponent.updated = true
      console.log(`Player ${player.entity.id} set name to: ${sanitizedName}`)
    } else {
      console.error(`TextComponent not found for player ${player.entity.id}`)
    }
  }

  private handleWorldActionMessage(ws: WebSocket<PlayerData>, message: WorldActionMessage) {
    const player = ws.getUserData().player
    if (!player) {
      console.error(`Player with WS ${ws} not found.`)
      return
    }

    const action = typeof message.action === 'string' ? message.action.trim().toLowerCase() : ''
    if (!/^[a-z0-9:_-]{1,40}$/.test(action)) {
      console.error(`Invalid world action from player ${player.entity.id}`)
      return
    }

    if (action.startsWith('fx:')) {
      const playerComponent = player.entity.getComponent(PlayerComponent)
      if (playerComponent) {
        const fx = action.slice(3).substring(0, 16)
        playerComponent.fx = fx
        playerComponent.fxSeq = (playerComponent.fxSeq || 0) + 1
        playerComponent.updated = true
      }
    }

    EventSystem.addEvent(new WorldActionEvent(player.entity.id, action))
  }
}
