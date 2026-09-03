/**
 * Public /health stays on a light Node http.Server at $PORT.
 * The game worker is a forked child that never binds a port.
 *
 * Railway cannot reach a second listen (TCP or Unix). Loading Rapier on the
 * public event loop hung the only reachable process (#24). Upgrades are handed
 * to the child with child.send(msg, socket) so WebSockets share $PORT without
 * importing the game into the parent.
 */
import { existsSync } from 'node:fs'
import http, { type IncomingMessage } from 'node:http'
import { connect, type Socket } from 'node:net'
import { spawn, type ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handOffUpgrade, isReadyMessage } from './gameIpc.js'
import {
  buildHealthPayload,
  isWebSocketOriginAllowed,
  onRailwayRuntime,
  readBoundedInteger,
  resolveAllowedOrigins,
  resolveGameSocketPath,
} from './ecs/system/network/serverPolicy.js'

const WORKER_CONNECT_MS = 5000
const WORKER_RETRY_MS = 50
const UPGRADE_WAIT_MS = 15000
const STARTING_BODY = 'Game server starting\n'

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
  // Railway: public /health on Node http so probes stay up while the
  // child loads Rapier. GAME_SUPERVISOR=0 opts out.
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

function healthBody(): string {
  return JSON.stringify(
    buildHealthPayload(
      true,
      process.env.GAME_SCRIPT || 'gtaLobbyScript.ts',
      20,
      process.uptime(),
      process.env.ISLAND_MAP || 'live-hub'
    )
  )
}

function writeUpgradeError(socket: Socket, status: number, reason: string, body: string) {
  if (socket.destroyed) return
  const payload = Buffer.from(body)
  socket.write(
    `HTTP/1.1 ${status} ${reason}\r\nContent-Type: text/plain\r\nContent-Length: ${payload.length}\r\nConnection: close\r\n\r\n`
  )
  socket.write(payload)
  socket.destroy()
}

export async function runGameSupervisor(): Promise<void> {
  const publicPort = readBoundedInteger(process.env.PORT ?? process.env.GAME_PORT, 8001, 1, 65535)
  const listenHost = process.env.LISTEN_HOST || '0.0.0.0'
  const isProduction = process.env.NODE_ENV === 'production' || onRailwayRuntime()
  const allowedOrigins = resolveAllowedOrigins(isProduction)
  const script = workerScript()
  let child: ChildProcess | undefined
  let restarting = false
  let workerReady = false

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

  const dispatchUpgrade = (req: IncomingMessage, socket: Socket, head: Buffer): boolean => {
    if (!child || !workerReady) return false
    return handOffUpgrade(child, req, socket, head)
  }

  const flushPending = () => {
    while (pending.length > 0 && workerReady && child) {
      const item = pending.shift()
      if (!item) break
      clearTimeout(item.timer)
      if (item.socket.destroyed) continue
      if (!dispatchUpgrade(item.req, item.socket, item.head)) {
        writeUpgradeError(item.socket, 502, 'Bad Gateway', STARTING_BODY)
      }
    }
  }

  const queueUpgrade = (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const timer = setTimeout(() => {
      dropPending(socket)
      writeUpgradeError(socket, 502, 'Bad Gateway', STARTING_BODY)
    }, UPGRADE_WAIT_MS)
    pending.push({ req, socket, head, timer })
    socket.once('close', () => dropPending(socket))
    socket.once('error', () => dropPending(socket))
  }

  const spawnWorker = () => {
    workerReady = false
    const env: NodeJS.ProcessEnv = { ...process.env, GAME_WORKER: '1', GAME_NO_LISTEN: '1' }
    delete env.GAME_SOCKET
    child = spawn(process.execPath, workerNodeArgs(script), {
      cwd: process.cwd(),
      env,
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    })
    console.log(`[supervisor] worker pid=${child.pid} ${script} ipc`)
    child.on('error', (error) => {
      console.error(`[supervisor] spawn error: ${error.message}`)
    })
    child.on('message', (value) => {
      if (!isReadyMessage(value)) return
      workerReady = true
      console.log('[supervisor] worker ready for websocket handoff')
      flushPending()
    })
    child.on('exit', (code, signal) => {
      console.error(`[supervisor] worker exited code=${code} signal=${signal}`)
      workerReady = false
      child = undefined
      if (restarting) return
      restarting = true
      setTimeout(() => {
        restarting = false
        spawnWorker()
      }, 3000)
    })
  }

  const shutdown = (signal: NodeJS.Signals) => {
    restarting = true
    child?.kill(signal)
    process.exit(0)
  }
  process.once('SIGTERM', () => shutdown('SIGTERM'))
  process.once('SIGINT', () => shutdown('SIGINT'))

  const server = http.createServer((req, res) => {
    const path = req.url?.split('?')[0] || '/'
    if ((req.method === 'GET' || req.method === 'HEAD') && path === '/health') {
      const body = healthBody()
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

  server.on('upgrade', (req, socket, head) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : ''
    if (!isWebSocketOriginAllowed(origin, isProduction, allowedOrigins)) {
      writeUpgradeError(socket as Socket, 403, 'Forbidden', 'Forbidden\n')
      return
    }
    const client = socket as Socket
    if (dispatchUpgrade(req, client, head)) return
    queueUpgrade(req, client, head)
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(publicPort, listenHost, () => {
      console.log(`[supervisor] public ${listenHost}:${publicPort} (health + websocket handoff)`)
      resolve()
    })
  })

  spawnWorker()
}
