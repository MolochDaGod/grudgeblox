import { unpack, pack } from 'msgpackr'
import { ServerMessage, ServerMessageType } from '@shared/network/server/base'
import { SnapshotMessage } from '@shared/network/server/serialized'
import { Game } from './Game'
import { ConnectionMessage } from '@shared/network/server/connection'
import { ClientMessage } from '@shared/network/client/base'
import pako from 'pako'
import { config } from '@shared/network/config'
import { resolveWebSocketServerUrl } from './serverUrl'
import { FLEET } from '@/lib/fleetConfig'

const CONNECTION_TIMEOUT_MS = 8000

type MessageHandler = (message: ServerMessage) => void

export class WebSocketManager {
  private websocket: WebSocket | null = null
  private messageHandlers: Map<ServerMessageType, MessageHandler> = new Map()
  private serverUrl: string
  private openedConnections = 0

  get connectionEpoch(): number { return this.openedConnections }

  timeSinceLastServerUpdate: number = 0
  constructor(game: Game, port: number = 8001, roomUrl?: string) {
    // Production: NEXT_PUBLIC_SERVER_URL=wss://grudgeblox-production.up.railway.app (no extra port)
    // Local: ws://127.0.0.1 → world port. Per-room websocketUrl always wins.
    this.serverUrl = resolveWebSocketServerUrl(
      process.env.NEXT_PUBLIC_SERVER_URL || FLEET.ws,
      port,
      roomUrl,
    )

    this.addMessageHandler(ServerMessageType.FIRST_CONNECTION, (message) => {
      const connectionMessage = message as ConnectionMessage
      game.currentPlayerEntityId = connectionMessage.id
      config.SERVER_TICKRATE = connectionMessage.tickRate
      console.log(
        `Connected to server with player ID: ${game.currentPlayerEntityId}, server tick rate: ${connectionMessage.tickRate}`
      )
    })

    this.addMessageHandler(ServerMessageType.SNAPSHOT, (message) => {
      this.timeSinceLastServerUpdate = 0
      game.syncComponentSystem.addSnapshotMessage(message as SnapshotMessage)
    })
  }

  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.isConnected()) {
        this.disconnect()
        const websocket = new WebSocket(this.serverUrl)
        websocket.binaryType = 'arraybuffer'
        this.websocket = websocket
        console.log('[blox-ws] connecting', this.serverUrl)
        let settled = false

        const rejectConnection = (message: string) => {
          if (settled) return
          settled = true
          window.clearTimeout(timeout)
          if (this.websocket === websocket) this.websocket = null
          websocket.close()
          reject(new Error(message))
        }

        const timeout = window.setTimeout(() => {
          rejectConnection('The game server did not respond in time.')
        }, CONNECTION_TIMEOUT_MS)

        websocket.addEventListener('open', (event) => {
          if (settled) return
          settled = true
          this.openedConnections++
          window.clearTimeout(timeout)
          console.log('WebSocket connection opened:', event)
          resolve()
        })
        websocket.addEventListener('message', this.onMessage.bind(this))
        websocket.addEventListener('error', () => {
          console.error('WebSocket connection failed')
          rejectConnection('Could not reach the game server.')
        })
        websocket.addEventListener('close', (closeEvent) => {
          if (!settled) {
            rejectConnection('The game server closed the connection before startup completed.')
            return
          }
          if (closeEvent.wasClean) {
            console.log(
              `WebSocket connection closed cleanly, code=${closeEvent.code}, reason=${closeEvent.reason}`
            )
          } else {
            console.error('WebSocket connection abruptly closed')
          }
        })
      } else {
        resolve()
      }
    })
  }
  disconnect() {
    if (this.websocket) {
      this.websocket.close()
      this.websocket = null
    }
  }

  addMessageHandler(type: ServerMessageType, handler: MessageHandler) {
    this.messageHandlers.set(type, handler)
  }

  removeMessageHandler(type: ServerMessageType) {
    this.messageHandlers.delete(type)
  }

  private onOpen(event: Event) {
    console.log('WebSocket connection opened:', event)
  }

  send(message: ClientMessage): boolean {
    if (!this.isConnected() || !this.websocket) return false

    try {
      // Compress with msgpackr
      const packed = pack(message)
      this.websocket.send(packed)
      return true
    } catch (error) {
      // Input retries on the next writable frame; avoid per-frame console floods.
      return false
    }
  }
  private isConnected(): boolean {
    return this.websocket != null && this.websocket.readyState === WebSocket.OPEN
  }

  private async onMessage(event: MessageEvent) {
    if (event.currentTarget !== this.websocket) return
    const source = this.websocket
    const raw = event.data
    const bytes =
      raw instanceof ArrayBuffer
        ? new Uint8Array(raw)
        : raw instanceof Blob
          ? new Uint8Array(await raw.arrayBuffer())
          : new Uint8Array(raw as Uint8Array)
    if (source !== this.websocket) return
    const decompressed = pako.inflate(bytes)
    // Then decompress the msgpackr
    const message: ServerMessage = unpack(decompressed)

    const handler = this.messageHandlers.get(message.t)
    if (handler) {
      handler(message)
    }
  }
}
