import type { WebSocket } from 'uWebSockets.js'
import { randomUUID } from 'node:crypto'
import type { Player } from '../../entity/Player.js'

export type ThreadPlayerData = { player?: Player; rateKey: string; id?: string; closed?: boolean }

export type ThreadOpen = { t: 'open'; id: string; remote: string }
export type ThreadMessageIn = { t: 'message'; id: string; data: ArrayBuffer | Uint8Array }
export type ThreadClose = { t: 'close'; id: string }
export type ThreadListening = { t: 'listening' }
export type ThreadSend = { t: 'send'; id: string; data: ArrayBuffer | Uint8Array }
export type ThreadEnd = { t: 'end'; id: string; code?: number; reason?: string }

export type MainToWorker = ThreadOpen | ThreadMessageIn | ThreadClose
export type WorkerToMain = ThreadListening | ThreadSend | ThreadEnd

export type ThreadPort = {
  postMessage(message: unknown): void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isBinary(value: unknown): value is ArrayBuffer | Uint8Array {
  return value instanceof ArrayBuffer || value instanceof Uint8Array
}

export function isMainToWorker(value: unknown): value is MainToWorker {
  if (!isRecord(value) || typeof value.t !== 'string' || typeof value.id !== 'string') return false
  if (value.t === 'open') return typeof value.remote === 'string'
  if (value.t === 'close') return true
  return value.t === 'message' && isBinary(value.data)
}

export function isWorkerToMain(value: unknown): value is WorkerToMain {
  if (!isRecord(value) || typeof value.t !== 'string') return false
  if (value.t === 'listening') return true
  if (value.t === 'end') return typeof value.id === 'string'
  return value.t === 'send' && typeof value.id === 'string' && isBinary(value.data)
}

export function toArrayBuffer(data: ArrayBuffer | Uint8Array | Buffer | Buffer[] | string): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data
  const buffer = Array.isArray(data)
    ? Buffer.concat(data)
    : Buffer.isBuffer(data)
      ? data
      : Buffer.from(typeof data === 'string' ? data : data)
  const copy = new Uint8Array(buffer.byteLength)
  copy.set(buffer)
  return copy.buffer
}

export function bytesFromThreadData(data: ArrayBuffer | Uint8Array): Buffer {
  return Buffer.from(data instanceof Uint8Array ? data : new Uint8Array(data))
}

export function wrapThreadSocket(
  port: ThreadPort,
  remote: string,
  userData: ThreadPlayerData = { rateKey: randomUUID(), id: randomUUID() }
): WebSocket<ThreadPlayerData> {
  const remoteBytes = Buffer.from(remote || '0.0.0.0')
  const wrapped = {
    send(data: ArrayBuffer | Uint8Array | Buffer) {
      if (userData.closed) return 2
      const bytes = Buffer.isBuffer(data)
        ? data
        : data instanceof ArrayBuffer
          ? Buffer.from(data)
          : Buffer.from(data.buffer, data.byteOffset, data.byteLength)
      port.postMessage({ t: 'send', id: userData.id || 'unknown', data: new Uint8Array(bytes) })
      return 1
    },
    end(code?: number, reason?: string) {
      if (userData.closed) return
      userData.closed = true
      port.postMessage({ t: 'end', id: userData.id || 'unknown', code, reason })
    },
    close() {
      wrapped.end()
    },
    getUserData() {
      return userData
    },
    getRemoteAddressAsText() {
      return remoteBytes.buffer.slice(remoteBytes.byteOffset, remoteBytes.byteOffset + remoteBytes.byteLength)
    },
    getBufferedAmount() {
      return 0
    },
  }
  return wrapped as unknown as WebSocket<ThreadPlayerData>
}
