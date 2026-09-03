/**
 * Public /health and WebSockets stay on the main Node event loop at $PORT.
 * Rapier and the game tick run in a worker thread and talk over MessagePort.
 *
 * Extra listens 502 on Railway. In-process Node ws+Rapier hung /health (#24/#28).
 * A second Node process OOMed the replica (#26). worker_threads keeps one RSS
 * while isolating Rapier from the public socket.
 */
import { existsSync } from 'node:fs'
import http, { type IncomingMessage } from 'node:http'
import type { Socket } from 'node:net'
import { connect } from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import { WebSocket, WebSocketServer } from 'ws'
import {
  buildHealthPayload,
  isWebSocketOriginAllowed,
  onRailwayRuntime,
  readBoundedInteger,
  resolveAllowedOrigins,
  resolveGameSocketPath,
} from './ecs/system/network/serverPolicy.js'
import { MAX_CLIENT_MESSAGE_BYTES } from './ecs/system/network/clientMessageValidation.js'
import { bytesFromThreadData, isWorkerToMain } from './ecs/system/network/threadIo.js'

const WORKER_CONNECT_MS = 5000
const WORKER_RETRY_MS = 50
const STARTING_BODY = 'Game server starting\n'
const UPGRADE_WAIT_MS = 20000
const MAX_PENDING_UPGRADES = 8

export function internalPortFor(publicPort: number): number {
  const configured = process.env.GAME_INTERNAL_PORT
  if (configured) return readBoundedInteger(configured, 18001, 1024, 65535)
  const candidate = publicPort < 55000 ? publicPort + 10000 : publicPort - 10000
  return candidate === publicPort ? 18001 : candidate
}

export function workerSocketPath(): string | undefined {
  return resolveGameSocketPath()
}

export function workerScript(): string {
  const candidates = [
    fileURLToPath(new URL('./sandbox.ts', import.meta.url)),
    resolve(process.cwd(), 'src/sandbox.ts'),
    resolve(process.cwd(), 'back/src/sandbox.ts'),
  ]
  return candidates.find((path) => existsSync(path)) || candidates[0]
}

export function workerNodeArgs(
  script: string,
  execArgv: readonly string[] = process.execArgv
): string[] {
  const hasTsx = execArgv.some((arg) => arg.includes('tsx'))
  return hasTsx ? [...execArgv, script] : ['--import', 'tsx/esm', ...execArgv, script]
}

export function shouldSupervise(): boolean {
  if (process.env.GAME_WORKER === '1') return false
  if (process.env.GAME_SUPERVISOR === '0') return false
  return process.env.GAME_SUPERVISOR === '1' || onRailwayRuntime()
}

function workerConnectOptions(port: number) {
  return { host: '127.0.0.1', port, family: 4 as const }
}

export function connectWorkerPort(
  port: number,
  timeoutMs = WORKER_CONNECT_MS,
  retryMs = WORKER_RETRY_MS
): Promise<Socket> {
  return connectWorker(() => connect(workerConnectOptions(port)), `tcp ${port}`, timeoutMs, retryMs)
}

export function connectWorkerSocket(
  path: string,
  timeoutMs = WORKER_CONNECT_MS,
  retryMs = WORKER_RETRY_MS
): Promise<Socket> {
  return connectWorker(() => connect({ path }), path, timeoutMs, retryMs)
}

function connectWorker(
  open: () => Socket,
  label: string,
  timeoutMs: number,
  retryMs: number
): Promise<Socket> {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = open()
      const fail = () => {
        socket.destroy()
        if (Date.now() >= deadline) {
          reject(new Error(`worker ${label} not accepting connections`))
          return
        }
        setTimeout(attempt, retryMs)
      }
      socket.once('connect', () => {
        socket.removeListener('error', fail)
        resolve(socket)
      })
      socket.once('error', fail)
    }
    attempt()
  })
}

function writeUpgradeError(socket: Socket, status: number, reason: string, body: string) {
  if (socket.destroyed) return
  const payload = Buffer.from(body)
  socket.end(
    `HTTP/1.1 ${status} ${reason}\r\nContent-Type: text/plain\r\nContent-Length: ${payload.length}\r\nConnection: close\r\n\r\n${body}`
  )
}

export async function runGameSupervisor(): Promise<void> {
  const publicPort = readBoundedInteger(process.env.PORT ?? process.env.GAME_PORT, 8001, 1, 65535)
  const listenHost = process.env.LISTEN_HOST || '0.0.0.0'
  const isProduction = process.env.NODE_ENV === 'production' || onRailwayRuntime()
  const allowedOrigins = resolveAllowedOrigins(isProduction)
  const script = workerScript()

  const server = http.createServer((req, res) => {
    const path = req.url?.split('?')[0] || '/'
    if ((req.method === 'GET' || req.method === 'HEAD') && path === '/health') {
      const body = JSON.stringify(
        buildHealthPayload(
          true,
          process.env.GAME_SCRIPT || 'gtaLobbyScript.ts',
          20,
          process.uptime(),
          process.env.ISLAND_MAP || 'live-hub'
        )
      )
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Content-Length': Buffer.byteLength(body),
      })
      if (req.method === 'HEAD') res.end()
      else res.end(body)
      return
    }
    res.writeHead(404).end()
  })
  server.on('error', (error) => {
    console.error(`[supervisor] http error: ${error.message}`)
  })
  server.on('connection', (socket) => {
    socket.on('error', () => undefined)
  })

  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_CLIENT_MESSAGE_BYTES,
    perMessageDeflate: false,
  })
  sockets.on('error', (error) => {
    console.error(`[supervisor] ws error: ${error.message}`)
  })

  const clients = new Map<string, WebSocket>()
  let worker: Worker | undefined
  let workerListening = false
  let restarting = false
  let nextId = 0

  type PendingUpgrade = {
    req: IncomingMessage
    socket: Socket
    head: Buffer
    timer: NodeJS.Timeout
  }
  const pending: PendingUpgrade[] = []

  const dropPending = (socket: Socket) => {
    const index = pending.findIndex((item) => item.socket === socket)
    if (index < 0) return
    clearTimeout(pending[index].timer)
    pending.splice(index, 1)
  }

  const attachClient = (id: string, ws: WebSocket, req: IncomingMessage) => {
    clients.set(id, ws)
    ws.on('error', (error) => {
      console.error('WebSocket error', error)
    })
    ws.on('message', (data) => {
      if (!worker) return
      const bytes = Buffer.isBuffer(data)
        ? new Uint8Array(data)
        : data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(Array.isArray(data) ? Buffer.concat(data) : Buffer.from(String(data)))
      worker.postMessage({ t: 'message', id, data: bytes })
    })
    ws.on('close', () => {
      clients.delete(id)
      worker?.postMessage({ t: 'close', id })
    })
    worker?.postMessage({
      t: 'open',
      id,
      remote: req.socket.remoteAddress || '0.0.0.0',
    })
  }

  const acceptUpgrade = (req: IncomingMessage, socket: Socket, head: Buffer) => {
    if (!workerListening || !worker) return false
    const id = `c${++nextId}`
    sockets.handleUpgrade(req, socket, head, (ws) => {
      attachClient(id, ws, req)
    })
    return true
  }

  const flushPending = () => {
    while (pending.length > 0 && workerListening && worker) {
      const item = pending.shift()
      if (!item) break
      clearTimeout(item.timer)
      if (item.socket.destroyed) continue
      if (!acceptUpgrade(item.req, item.socket, item.head)) {
        writeUpgradeError(item.socket, 502, 'Bad Gateway', STARTING_BODY)
      }
    }
  }

  const onWorkerMessage = (raw: unknown) => {
    if (!isWorkerToMain(raw)) return
    if (raw.t === 'listening') {
      workerListening = true
      console.log('[supervisor] game worker listening')
      flushPending()
      return
    }
    if (raw.t === 'send') {
      const ws = clients.get(raw.id)
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      try {
        ws.send(bytesFromThreadData(raw.data), { binary: true })
      } catch (error) {
        console.error('WebSocket send failed', error)
      }
      return
    }
    const ws = clients.get(raw.id)
    if (!ws) return
    clients.delete(raw.id)
    try {
      ws.close(raw.code, raw.reason)
    } catch {
      ws.terminate()
    }
  }

  const spawnGameWorker = () => {
    workerListening = false
    worker = new Worker(script, {
      name: 'grudgeblox-game',
      execArgv: workerNodeArgs(script).slice(0, -1),
      env: {
        ...process.env,
        GAME_WORKER: '1',
        GAME_NO_LISTEN: '1',
      },
    })
    console.log(`[supervisor] game worker thread ${script}`)
    worker.on('message', onWorkerMessage)
    worker.on('error', (error) => {
      console.error(`[supervisor] worker error: ${error.message}`)
    })
    worker.on('exit', (code) => {
      console.error(`[supervisor] worker exited code=${code}`)
      workerListening = false
      worker = undefined
      for (const [id, ws] of clients) {
        clients.delete(id)
        if (ws.readyState === WebSocket.OPEN) ws.close(1011, 'worker restart')
      }
      if (restarting) return
      restarting = true
      setTimeout(() => {
        restarting = false
        spawnGameWorker()
      }, 3000)
    })
  }

  server.on('upgrade', (req, socket, head) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : ''
    const client = socket as Socket
    client.on('error', () => dropPending(client))
    if (!isWebSocketOriginAllowed(origin, isProduction, allowedOrigins)) {
      writeUpgradeError(client, 403, 'Forbidden', 'Forbidden\n')
      return
    }
    if (acceptUpgrade(req, client, head)) return
    if (pending.length >= MAX_PENDING_UPGRADES) {
      writeUpgradeError(client, 502, 'Bad Gateway', STARTING_BODY)
      return
    }
    const timer = setTimeout(() => {
      dropPending(client)
      writeUpgradeError(client, 502, 'Bad Gateway', STARTING_BODY)
    }, UPGRADE_WAIT_MS)
    pending.push({ req, socket: client, head, timer })
    client.once('close', () => dropPending(client))
  })

  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception (public server stays up):', error)
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(publicPort, listenHost, () => {
      console.log(`[supervisor] Node http ${listenHost}:${publicPort} (health + websocket)`)
      resolve()
    })
  })

  spawnGameWorker()
}