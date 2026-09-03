import type { IncomingMessage } from 'node:http'
import type { Socket } from 'node:net'
import { WebSocket as NodeWebSocket, WebSocketServer } from 'ws'
import type { WebSocket } from 'uWebSockets.js'
import { randomUUID } from 'node:crypto'
import type { Player } from '../../entity/Player.js'
import { MAX_CLIENT_MESSAGE_BYTES } from './clientMessageValidation.js'
import { decodeUpgradeHead, isUpgradeMessage } from '../../../gameIpc.js'

export type NodePlayerData = { player?: Player; rateKey: string }

const MAX_BACKPRESSURE_BYTES = 64 * 1024

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

export function installIpcUpgradeReceiver(
  accept: (socket: NodeWebSocket, req: IncomingMessage) => void
): () => void {
  const server = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_CLIENT_MESSAGE_BYTES,
    perMessageDeflate: false,
  })

  const onMessage = (value: unknown, socket?: Socket) => {
    if (!isUpgradeMessage(value) || !socket) return
    if (typeof socket.resume === 'function') socket.resume()
    const req = {
      headers: value.headers,
      method: value.method || 'GET',
      url: value.url || '/',
      httpVersion: value.httpVersion || '1.1',
      socket,
    } as IncomingMessage
    try {
      server.handleUpgrade(req, socket, decodeUpgradeHead(value), (ws) => {
        accept(ws, req)
      })
    } catch (error) {
      console.error('[worker] handleUpgrade failed', error)
      socket.destroy()
    }
  }

  process.on('message', onMessage)
  process.send?.({ type: 'ready' })
  return () => process.off('message', onMessage)
}
