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
import { randomUUID } from 'node:crypto'
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
import { decodeClientMessage, MAX_CLIENT_MESSAGE_BYTES } from './clientMessageValidation.js'
import {
  buildHealthPayload,
  isAdminAuthorized,
  isWebSocketOriginAllowed,
  readBoundedInteger,
  resolveAllowedOrigins,
} from './serverPolicy.js'

type PlayerData = { player?: Player; rateKey: string }
type MessageHandler = (ws: WebSocket<PlayerData>, message: ClientMessage) => void

export class WebsocketSystem {
  private port: number
  private players: Player[] = []
  private messageHandlers: Map<ClientMessageType, MessageHandler> = new Map()
  private inputProcessingSystem: InputProcessingSystem = new InputProcessingSystem()
  private connectionLimiter = new RateLimiterMemory({
    points: 10, // Max 10 points per second
    duration: 1, // Each point expires after 1 second
  })
  private messageLimiter: RateLimiterMemory
  private applicationReady = false
  private resolveListening!: () => void
  private rejectListening!: (reason?: unknown) => void
  public readonly listening: Promise<void>

  constructor() {
    this.port = readBoundedInteger(process.env.PORT ?? process.env.GAME_PORT, 8001, 1, 65535)
    this.messageLimiter = new RateLimiterMemory({
      points: readBoundedInteger(process.env.MAX_MESSAGES_PER_SECOND, 80, 10, 1000),
      duration: 1,
    })
    this.listening = new Promise<void>((resolve, reject) => {
      this.resolveListening = resolve
      this.rejectListening = reject
    })
    this.initializeMessageHandlers()
    this.initializeServer()
  }

  markReady() {
    this.applicationReady = true
  }

  private async isConnectionRateLimited(ip: string): Promise<boolean> {
    try {
      await this.connectionLimiter.consume(ip)
      return false // Not rate limited
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_rejRes) {
      return true // Rate limited
    }
  }

  private initializeServer() {
    const isProduction = process.env.NODE_ENV === 'production'
    const listenHost = process.env.LISTEN_HOST || (isProduction ? '0.0.0.0' : '127.0.0.1')
    const allowedOrigins = resolveAllowedOrigins(isProduction)
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

    console.log('WebSocket origins: only accepting', [...allowedOrigins].join(', '))

    const app = useTls
      ? SSLApp({
          key_file_name: sslKeyFile,
          cert_file_name: sslCertFile,
        })
      : App()

    // Health is deliberately operational-only: no player names, chat, notifications, or target IDs.
    app.get('/health', (res) => {
      const healthData = buildHealthPayload(
        this.applicationReady,
        process.env.GAME_SCRIPT || 'Unknown',
        config.SERVER_TICKRATE
      )
      res.writeStatus(this.applicationReady ? '200 OK' : '503 Service Unavailable')
      res.writeHeader('Content-Type', 'application/json')
      res.writeHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(healthData))
    })

    // Optional in-memory moderation view. It is unavailable until an admin token is configured.
    app.get('/admin/events', (res, req) => {
      const adminToken = process.env.ADMIN_API_TOKEN
      if (!adminToken) {
        res.writeStatus('404 Not Found').end()
        return
      }
      if (!isAdminAuthorized(req.getHeader('authorization'), adminToken)) {
        res.writeStatus('401 Unauthorized')
        res.writeHeader('WWW-Authenticate', 'Bearer')
        res.writeHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify({ error: 'unauthorized' }))
        return
      }

      const chatEntity = EntityManager.getFirstEntityWithComponent(
        EntityManager.getInstance().getAllEntities(),
        ChatComponent
      )
      const messages = chatEntity?.getComponent(MessageListComponent)?.list ?? []
      res.writeHeader('Content-Type', 'application/json')
      res.writeHeader('Cache-Control', 'no-store')
      res.end(
        JSON.stringify({
          retention: {
            storage: 'memory',
            maxMessages: config.MAX_RETAINED_MESSAGES,
            resetsOnRestart: true,
          },
          events: messages.map((message) => message.serialize()),
        })
      )
    })

    app.ws<PlayerData>('/*', {
      idleTimeout: 32,
      maxBackpressure: 1024,
      maxPayloadLength: MAX_CLIENT_MESSAGE_BYTES,
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
    allowedOrigins: ReadonlySet<string>,
    res: HttpResponse,
    req: HttpRequest,
    context: us_socket_context_t
  ) {
    const origin = req.getHeader('origin')
    if (!isWebSocketOriginAllowed(origin, isProduction, allowedOrigins)) {
      res.writeStatus('403 Forbidden').end()
      return
    }

    res.upgrade<PlayerData>(
      { rateKey: randomUUID() },
      req.getHeader('sec-websocket-key'),
      req.getHeader('sec-websocket-protocol'),
      req.getHeader('sec-websocket-extensions'),
      context
    )
  }

  private listenHandler(listenSocket: us_listen_socket, listenHost: string) {
    if (listenSocket) {
      console.log(`WebSocket server listening on ${listenHost}:${this.port}`)
      this.resolveListening()
    } else {
      const error = new Error(`Failed to listen on ${listenHost}:${this.port}`)
      console.error(error.message)
      this.rejectListening(error)
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
    void this.processMessage(ws, message)
  }

  private async processMessage(ws: WebSocket<PlayerData>, payload: ArrayBuffer) {
    try {
      await this.messageLimiter.consume(ws.getUserData().rateKey)
    } catch {
      console.warn('Closing WebSocket connection after per-message rate limit exceeded')
      ws.end(1008, 'Message rate limit exceeded')
      return
    }

    const decoded = decodeClientMessage(payload)
    if (!decoded.ok) {
      console.warn(`Closing WebSocket connection after rejected client message: ${decoded.reason}`)
      ws.end(1008, 'Invalid client message')
      return
    }

    const handler = this.messageHandlers.get(decoded.message.t)
    if (!handler) {
      ws.end(1008, 'Unsupported client message')
      return
    }

    try {
      handler(ws, decoded.message)
    } catch (error) {
      console.error('Client message handler failed', error)
      ws.end(1011, 'Message handler failed')
    }
  }

  // TODO: Create EventOnPlayerConnect and EventOnPlayerDisconnect to respects ECS
  // Might be useful to query the chat and send a message to all players when a player connects or disconnects
  // Also could append scriptable events to be triggered on connect/disconnect depending on the game
  private async onConnect(ws: WebSocket<PlayerData>) {
    const ipBuffer = ws.getRemoteAddressAsText() as ArrayBuffer
    const ip = Buffer.from(ipBuffer).toString()
    if (await this.isConnectionRateLimited(ip)) {
      // Respond to the client indicating that the connection is rate limited
      return ws.end(1008, 'Connection rate limit exceeded')
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
      !Number.isFinite(angleY) ||
      typeof interact !== 'boolean'
    ) {
      console.error('Invalid input message', message)
      return
    }

    this.inputProcessingSystem.receiveInputPacket(player.entity, message)
  }

  private handleChatMessage(ws: WebSocket<PlayerData>, message: ChatMessage) {
    const player = ws.getUserData().player
    if (!player) {
      console.error(`Player with WS ${ws} not found.`)
      return
    }

    const { content } = message
    if (
      !content ||
      typeof content !== 'string' ||
      content.trim().length === 0 ||
      content.length > config.MAX_MESSAGE_CONTENT_LENGTH
    ) {
      console.error(`Invalid chat message from player ${player.entity.id}`)
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
    if (!Number.isSafeInteger(eId) || eId <= 0) {
      console.error(`Invalid proximity entity ID from player ${player.entity.id}`)
      return
    }
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
    if (!name || typeof name !== 'string' || name.length > 64) {
      console.error(`Invalid player name message, sent from ${player.entity.id}`)
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
