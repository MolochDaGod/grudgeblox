import type { IncomingMessage } from 'node:http'
import { WebSocket as NodeWebSocket } from 'ws'
import type { WebSocket } from 'uWebSockets.js'
import { randomUUID } from 'node:crypto'
import type { Player } from '../../entity/Player.js'

export type NodePlayerData = { player?: Player; rateKey: string }

const MAX_BACKPRESSURE_BYTES = 64 * 1024

let gameWebsocketSystem: { acceptNodeWebSocket(ws: NodeWebSocket, req: IncomingMessage): void } | undefined

export function setGameWebsocketSystem(
  system: { acceptNodeWebSocket(ws: NodeWebSocket, req: IncomingMessage): void } | undefined
) {
  gameWebsocketSystem = system
}

export function getGameWebsocketSystem() {
  return gameWebsocketSystem
}

export function wrapNodeWebSocket(
  socket: NodeWebSocket,
  req: IncomingMessage,
  userData: NodePlayerData = { rateKey: randomUUID() }
): WebSocket<NodePlayerData> {
  socket.binaryType = 'arraybuffer'
  const remote = Buffer.from(req.socket.remoteAddress || '0.0.0.0')
  const wrapped = {
    send(data: ArrayBuffer | Uint8Array | Buffer) {
      if (socket.readyState !== NodeWebSocket.OPEN) return 2
      if (socket.bufferedAmount > MAX_BACKPRESSURE_BYTES) return 0
      try {
        socket.send(data, { binary: true })
        return 1
      } catch {
        return 2
      }
    },
    end(code?: number, reason?: string) {
      socket.close(code, reason)
    },
    close() {
      socket.close()
    },
    getUserData() {
      return userData
    },
    getRemoteAddressAsText() {
      return remote.buffer.slice(remote.byteOffset, remote.byteOffset + remote.byteLength)
    },
    getBufferedAmount() {
      return socket.bufferedAmount
    },
  }
  return wrapped as unknown as WebSocket<NodePlayerData>
}

export function toArrayBuffer(data: Buffer | ArrayBuffer | Buffer[] | string): ArrayBuffer {
  const buffer = Array.isArray(data)
    ? Buffer.concat(data)
    : Buffer.isBuffer(data)
      ? data
      : Buffer.from(data instanceof ArrayBuffer ? new Uint8Array(data) : data)
  const copy = new Uint8Array(buffer.byteLength)
  copy.set(buffer)
  return copy.buffer
}
