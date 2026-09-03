import type { IncomingMessage } from 'node:http'
import type { WebSocket as NodeWebSocket } from 'ws'
import type { WebSocket } from 'uWebSockets.js'
import { randomUUID } from 'node:crypto'
import type { Player } from '../../entity/Player.js'

export type NodePlayerData = { player?: Player; rateKey: string }

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
    send(data: ArrayBuffer | Uint8Array | Buffer, compress?: boolean) {
      if (socket.readyState !== socket.OPEN) return 2
      socket.send(data, { binary: true, compress: Boolean(compress) })
      return 1
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
