/**
 * Public /health and WebSockets share one Node http.Server on $PORT.
 * Railway could reach that bind; every extra uWS listen 502'd.
 */
import { existsSync } from 'node:fs'
import http from 'node:http'
import { connect, type Socket } from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import {
  buildHealthPayload,
  isWebSocketOriginAllowed,
  onRailwayRuntime,
  readBoundedInteger,
  resolveAllowedOrigins,
  resolveGameSocketPath,
} from './ecs/system/network/serverPolicy.js'
import { getGameWebsocketSystem } from './ecs/system/network/nodeWebSocketTransport.js'

const WORKER_CONNECT_MS = 5000
const WORKER_RETRY_MS = 50

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

export async function runGameSupervisor(startGame?: () => Promise<void>): Promise<void> {
  const publicPort = readBoundedInteger(process.env.PORT ?? process.env.GAME_PORT, 8001, 1, 65535)
  const listenHost = process.env.LISTEN_HOST || '0.0.0.0'
  const isProduction = process.env.NODE_ENV === 'production' || onRailwayRuntime()
  const allowedOrigins = resolveAllowedOrigins(isProduction)

  process.env.GAME_WORKER = '1'
  process.env.GAME_NO_LISTEN = '1'
  delete process.env.GAME_SOCKET

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

  const sockets = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 })
  server.on('upgrade', (req, socket, head) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : ''
    if (!isWebSocketOriginAllowed(origin, isProduction, allowedOrigins)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    const system = getGameWebsocketSystem()
    if (!system) {
      socket.write('HTTP/1.1 502 Bad Gateway\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nGame server starting\n')
      socket.destroy()
      return
    }
    sockets.handleUpgrade(req, socket, head, (ws) => {
      system.acceptNodeWebSocket(ws, req)
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(publicPort, listenHost, () => {
      console.log(`[supervisor] Node http ${listenHost}:${publicPort} (health + websocket)`)
      resolve()
    })
  })

  if (!startGame) return
  console.log('[supervisor] loading game on the public Node server')
  void startGame().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[supervisor] game failed: ${message}`)
  })
  for (let i = 0; i < 100 && !getGameWebsocketSystem(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  if (!getGameWebsocketSystem()) {
    console.error('[supervisor] game websocket handler did not register')
  }
}

