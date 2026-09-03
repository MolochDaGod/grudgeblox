import type { IncomingHttpHeaders, IncomingMessage } from 'node:http'
import type { Socket } from 'node:net'
import { WebSocket as NodeWebSocket, WebSocketServer } from 'ws'
import type { WebSocket } from 'uWebSockets.js'
import { randomUUID } from 'node:crypto'
import type { Player } from '../../entity/Player.js'
import { MAX_CLIENT_MESSAGE_BYTES } from './clientMessageValidation.js'
import { isWebSocketOriginAllowed } from './serverPolicy.js'

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

export function parseHttpHead(chunk: Buffer): {
  method: string
  url: string
  httpVersion: string
  headers: IncomingHttpHeaders
  leftover: Buffer
} | undefined {
  const separator = chunk.indexOf('\r\n\r\n')
  if (separator < 0) return undefined
  const text = chunk.subarray(0, separator).toString('utf8')
  const lines = text.split('\r\n')
  const requestLine = lines.shift() || ''
  const match = /^(GET)\s+(\S+)\s+HTTP\/(\d\.\d)$/i.exec(requestLine)
  if (!match) return undefined
  const headers: IncomingHttpHeaders = {}
  for (const line of lines) {
    const index = line.indexOf(':')
    if (index < 0) continue
    const name = line.slice(0, index).trim().toLowerCase()
    const value = line.slice(index + 1).trim()
    const previous = headers[name]
    if (typeof previous === 'string') headers[name] = [previous, value]
    else if (Array.isArray(previous)) previous.push(value)
    else headers[name] = value
  }
  return {
    method: match[1].toUpperCase(),
    url: match[2],
    httpVersion: match[3],
    headers,
    leftover: chunk.subarray(separator + 4),
  }
}

function writePlain(socket: Socket, status: number, reason: string, body: string) {
  if (socket.destroyed) return
  const payload = Buffer.from(body)
  socket.end(
    `HTTP/1.1 ${status} ${reason}\r\nContent-Type: text/plain\r\nContent-Length: ${payload.length}\r\nConnection: close\r\n\r\n${body}`
  )
}

export function createNetUpgradeHandler(
  accept: (socket: NodeWebSocket, req: IncomingMessage) => void,
  isProduction: boolean,
  allowedOrigins: ReadonlySet<string>
): (socket: Socket, chunk: Buffer) => boolean {
  const server = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_CLIENT_MESSAGE_BYTES,
    perMessageDeflate: false,
  })

  return (socket, chunk) => {
    const parsed = parseHttpHead(chunk)
    if (!parsed) return false
    const connection = String(parsed.headers.connection || '')
    const upgrade = String(parsed.headers.upgrade || '')
    if (!/upgrade/i.test(connection) || !/^websocket$/i.test(upgrade)) return false

    const origin = typeof parsed.headers.origin === 'string' ? parsed.headers.origin : ''
    if (!isWebSocketOriginAllowed(origin, isProduction, allowedOrigins)) {
      writePlain(socket, 403, 'Forbidden', 'Forbidden\n')
      return true
    }

    const req = {
      headers: parsed.headers,
      method: parsed.method,
      url: parsed.url,
      httpVersion: parsed.httpVersion,
      socket,
    } as IncomingMessage
    try {
      server.handleUpgrade(req, socket, parsed.leftover, (ws) => {
        accept(ws, req)
      })
    } catch (error) {
      console.error('[supervisor] handleUpgrade failed', error)
      socket.destroy()
    }
    return true
  }
}
