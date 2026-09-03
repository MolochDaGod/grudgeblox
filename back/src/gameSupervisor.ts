/**
 * Public /health stays on Node net at $PORT so Railway's proxy can reach us.
 * Game traffic is proxied to in-process uWS on 127.0.0.1 (same heap).
 *
 * Unix sockets and a second Node heap both 502'd on Railway.
 * Set GAME_SOCKET to force a Unix path. GAME_WORKER_FORK=1 restores spawn.
 */
import { existsSync, unlinkSync } from 'node:fs'
import { connect, createServer, type Socket } from 'node:net'
import { spawn, type ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildHealthPayload,
  isHealthHttpRequest,
  onRailwayRuntime,
  readBoundedInteger,
  resolveGameSocketPath,
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
  // Railway: public /health on Node net so probes stay up while the
  // listen-first slim worker binds and loads Rapier. GAME_SUPERVISOR=0 opts out.
  return process.env.GAME_SUPERVISOR === '1' || onRailwayRuntime()
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

function unlinkSocket(path: string) {
  try {
    unlinkSync(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
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
  const unixPath = resolveGameSocketPath()
  const internalPort = internalPortFor(publicPort)
  const workerLabel = unixPath || `127.0.0.1:${internalPort}`
  const inProcess = process.env.GAME_WORKER_FORK !== '1' && Boolean(startGame)
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

  const openWorker = () =>
    unixPath ? connect({ path: unixPath }) : connect(workerConnectOptions(internalPort))

  const waitForWorker = () =>
    unixPath ? connectWorkerSocket(unixPath) : connectWorkerPort(internalPort)

  const spawnWorker = () => {
    workerAccepting = false
    if (unixPath) unlinkSocket(unixPath)
    child = spawn(process.execPath, workerNodeArgs(script), {
      cwd: process.cwd(),
      env: {
        ...process.env,
        GAME_WORKER: '1',
        ...(unixPath
          ? { GAME_SOCKET: unixPath }
          : {
              PORT: String(internalPort),
              GAME_PORT: String(internalPort),
              LISTEN_HOST: '127.0.0.1',
            }),
      },
      stdio: 'inherit',
    })
    console.log(`[supervisor] worker pid=${child.pid} ${script} ${workerLabel}`)
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
          const game = openWorker()
          game.once('connect', () => pipeToWorker(socket, chunk, game))
          game.once('error', () => rejectClient(socket))
          return
        }
        void waitForWorker().then(
          (game) => pipeToWorker(socket, chunk, game),
          () => rejectClient(socket)
        )
      })
    })
    server.on('error', reject)
    server.listen(publicPort, listenHost, () => {
      console.log(`[supervisor] public ${listenHost}:${publicPort} -> ${workerLabel}`)
      resolve()
    })
  })

  if (!inProcess || !startGame) {
    spawnWorker()
    return
  }

  process.env.GAME_WORKER = '1'
  if (unixPath) {
    unlinkSocket(unixPath)
    process.env.GAME_SOCKET = unixPath
  } else {
    delete process.env.GAME_SOCKET
    process.env.LISTEN_HOST = '127.0.0.1'
    process.env.PORT = String(internalPort)
    process.env.GAME_PORT = String(internalPort)
  }
  console.log(`[supervisor] in-process worker ${workerLabel}`)
  void startGame().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[supervisor] game failed: ${message}`)
  })
}
