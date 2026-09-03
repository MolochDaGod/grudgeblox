/**
 * Public /health stays in this process so Railway probes never share the
 * Rapier/tsx event loop. Game traffic is proxied to a spawned worker.
 *
 * The worker binds uWS before loading Rapier. Connecting to 127.0.0.1 fails
 * when that socket is never up; health 200 + WS 502 is that split.
 */
import { existsSync } from 'node:fs'
import { connect, createServer, type Socket } from 'node:net'
import { spawn, type ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildHealthPayload,
  isHealthHttpRequest,
  readBoundedInteger,
} from './ecs/system/network/serverPolicy.js'

const WORKER_CONNECT_MS = 5000
const WORKER_RETRY_MS = 50
const STARTING_BODY = 'Game server starting\n'

export function internalPortFor(publicPort: number): number {
  const configured = process.env.GAME_INTERNAL_PORT
  if (configured) return readBoundedInteger(configured, 18001, 1024, 65535)
  const candidate = publicPort < 55000 ? publicPort + 10000 : publicPort - 10000
  return candidate === publicPort ? 18001 : candidate
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
  // Railway must not auto-spawn a second Node process. Two heaps leave the
  // worker dead (public /health 200, WebSocket 502 Game server starting).
  return process.env.GAME_SUPERVISOR === '1'
}

function healthResponse(): Buffer {
  const body = JSON.stringify(
    buildHealthPayload(
      true,
      process.env.GAME_SCRIPT || 'gtaLobbyScript.ts',
      20,
      process.uptime(),
      process.env.ISLAND_MAP || 'live-hub'
    )
  )
  return Buffer.from(
    `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nCache-Control: no-store\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`
  )
}

function startingResponse(): Buffer {
  return Buffer.from(
    `HTTP/1.1 502 Bad Gateway\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(STARTING_BODY)}\r\nConnection: close\r\n\r\n${STARTING_BODY}`
  )
}

function workerConnectOptions(port: number) {
  return { host: '127.0.0.1', port, family: 4 as const }
}

export function connectWorkerPort(
  port: number,
  timeoutMs = WORKER_CONNECT_MS,
  retryMs = WORKER_RETRY_MS
): Promise<Socket> {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = connect(workerConnectOptions(port))
      const fail = () => {
        socket.destroy()
        if (Date.now() >= deadline) {
          reject(new Error(`worker ${port} not accepting connections`))
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

export async function runGameSupervisor(): Promise<void> {
  const publicPort = readBoundedInteger(process.env.PORT ?? process.env.GAME_PORT, 8001, 1, 65535)
  const internalPort = internalPortFor(publicPort)
  const listenHost = process.env.LISTEN_HOST || '0.0.0.0'
  const script = workerScript()
  let child: ChildProcess | undefined
  let restarting = false
  let workerAccepting = false

  const pipeToWorker = (client: Socket, head: Buffer, game: Socket) => {
    workerAccepting = true
    game.write(head)
    client.pipe(game)
    game.pipe(client)
    game.on('error', () => {
      workerAccepting = false
      if (!client.destroyed) client.destroy()
    })
  }

  const rejectClient = (client: Socket) => {
    workerAccepting = false
    if (!client.destroyed) client.end(startingResponse())
  }

  const spawnWorker = () => {
    workerAccepting = false
    child = spawn(process.execPath, workerNodeArgs(script), {
      cwd: process.cwd(),
      env: {
        ...process.env,
        GAME_WORKER: '1',
        PORT: String(internalPort),
        GAME_PORT: String(internalPort),
        LISTEN_HOST: '0.0.0.0',
      },
      stdio: 'inherit',
    })
    console.log(
      `[supervisor] worker pid=${child.pid} ${script} listening 0.0.0.0:${internalPort}`
    )
    child.on('error', (error) => {
      console.error(`[supervisor] spawn error: ${error.message}`)
    })
    child.on('exit', (code, signal) => {
      console.error(`[supervisor] worker exited code=${code} signal=${signal}`)
      workerAccepting = false
      child = undefined
      if (restarting) return
      restarting = true
      setTimeout(() => {
        restarting = false
        spawnWorker()
      }, 3000)
    })
  }

  await new Promise<void>((resolve, reject) => {
    const server = createServer((socket) => {
      socket.once('data', (chunk) => {
        const head = chunk.subarray(0, Math.min(chunk.length, 160)).toString('utf8')
        if (isHealthHttpRequest(head)) {
          socket.end(healthResponse())
          return
        }
        if (workerAccepting) {
          const game = connect(workerConnectOptions(internalPort))
          game.once('connect', () => pipeToWorker(socket, chunk, game))
          game.once('error', () => rejectClient(socket))
          return
        }
        void connectWorkerPort(internalPort).then(
          (game) => pipeToWorker(socket, chunk, game),
          () => rejectClient(socket)
        )
      })
    })
    server.on('error', reject)
    server.listen(publicPort, listenHost, () => {
      console.log(`[supervisor] public ${listenHost}:${publicPort} -> 127.0.0.1:${internalPort}`)
      resolve()
    })
  })

  spawnWorker()
}
