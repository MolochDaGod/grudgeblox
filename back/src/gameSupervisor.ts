/**
 * Public /health stays on Node net at $PORT so Railway's proxy can reach us.
 * In-process WebSocket upgrades are accepted on that same listener (no second
 * bind). The upgrade handler is registered before Rapier/uWS load so Hikari
 * does not wait 15s for a handler that never appears. Accumulate a complete
 * HTTP head before upgrading: Hikari can split the request across TCP packets,
 * and LF-only heads fail a CRLF-only parse.
 * Railway never reaches an extra TCP/Unix port; a second Node heap OOMs.
 *
 * GAME_WORKER_FORK=1 restores spawn + TCP proxy for local extra-listen debug.
 */
import { existsSync, unlinkSync } from 'node:fs'
import { connect, createServer, type Socket } from 'node:net'
import { spawn, type ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildHealthPayload,
  isHealthHttpRequest,
  isWebSocketHttpRequest,
  onRailwayRuntime,
  readBoundedInteger,
  resolveAllowedOrigins,
  resolveGameSocketPath,
} from './ecs/system/network/serverPolicy.js'
import { collectHttpHead, createNetUpgradeHandler } from './ecs/system/network/nodeWebSocketTransport.js'
import { deliverNodeSocket } from './ecs/system/network/nodeSocketAccept.js'
import { hasPublicUpgradeHandler, setPublicUpgradeHandler, tryPublicUpgrade } from './ecs/system/network/publicUpgrade.js'

const WORKER_CONNECT_MS = 15000
const WORKER_RETRY_MS = 50
const HEADER_WAIT_MS = 10_000
const STARTING_BODY = 'Game server starting\n'

export function internalPortFor(publicPort: number): number {
  const configured = process.env.GAME_INTERNAL_PORT
  if (configured) return readBoundedInteger(configured, 18001, 1024, 65535)
  const candidate = publicPort < 55000 ? publicPort + 10000 : publicPort - 10000
  return candidate === publicPort ? 18001 : candidate
}

export function workerListenHost(configured = process.env.GAME_INTERNAL_HOST): string {
  const value = configured?.trim()
  return value || '0.0.0.0'
}

export function workerConnectTargets(port: number) {
  return [
    { host: '127.0.0.1', port, family: 4 as const },
    { host: '::1', port, family: 6 as const },
  ]
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

function healthResponse(headOnly = false): Buffer {
  const body = JSON.stringify({
    ...buildHealthPayload(
      true,
      process.env.GAME_SCRIPT || 'gtaLobbyScript.ts',
      20,
      process.uptime(),
      process.env.ISLAND_MAP || 'live-hub'
    ),
    upgrade: hasPublicUpgradeHandler(),
    fork: process.env.GAME_WORKER_FORK === '1',
    noListen: process.env.GAME_NO_LISTEN === '1',
  })
  const payload = headOnly ? '' : body
  return Buffer.from(
    `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nCache-Control: no-store\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${payload}`
  )
}

function startingResponse(): Buffer {
  return Buffer.from(
    `HTTP/1.1 502 Bad Gateway\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(STARTING_BODY)}\r\nConnection: close\r\n\r\n${STARTING_BODY}`
  )
}

function workerConnectOptions(port: number, index = 0) {
  const targets = workerConnectTargets(port)
  return targets[index % targets.length]
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
  let index = 0
  return connectWorker(
    () => connect(workerConnectOptions(port, index++)),
    `tcp ${port}`,
    timeoutMs,
    retryMs
  )
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
  const internalHost = workerListenHost()
  const workerLabel = unixPath || `${internalHost}:${internalPort}`
  if (onRailwayRuntime() && process.env.GAME_WORKER_FORK === '1') {
    console.warn('[supervisor] ignoring GAME_WORKER_FORK on Railway; extra-listen is unreachable')
  }
  const inProcess = Boolean(startGame) && (onRailwayRuntime() || process.env.GAME_WORKER_FORK !== '1')
  const script = workerScript()
  const registerUpgrade = () => {
    const isProduction = process.env.NODE_ENV === 'production' || onRailwayRuntime()
    process.env.GAME_WORKER = '1'
    process.env.GAME_NO_LISTEN = '1'
    delete process.env.GAME_SOCKET
    setPublicUpgradeHandler(
      createNetUpgradeHandler(deliverNodeSocket, isProduction, resolveAllowedOrigins(isProduction))
    )
    console.log(`[supervisor] upgrade handler registered=${hasPublicUpgradeHandler()}`)
  }
  if (inProcess) {
    try {
      registerUpgrade()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[supervisor] upgrade handler failed: ${message}`)
    }
  }
  let child: ChildProcess | undefined
  let restarting = false
  let workerAccepting = false
  let workerFamily: 4 | 6 = 4

  const pipeToWorker = (client: Socket, head: Buffer, game: Socket) => {
    workerAccepting = true
    if (game.remoteFamily === 'IPv6') workerFamily = 6
    else if (game.remoteFamily === 'IPv4') workerFamily = 4
    game.write(head)
    client.pipe(game)
    game.pipe(client)
    client.resume()
    game.on('error', () => {
      workerAccepting = false
      if (!client.destroyed) client.destroy()
    })
    client.on('error', () => {
      if (!game.destroyed) game.destroy()
    })
  }

  const rejectClient = (client: Socket) => {
    workerAccepting = false
    if (!client.destroyed) client.end(startingResponse())
  }

  const openWorker = () =>
    unixPath
      ? connect({ path: unixPath })
      : connect(
          workerFamily === 6
            ? { host: '::1', port: internalPort, family: 6 }
            : { host: '127.0.0.1', port: internalPort, family: 4 }
        )

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
              LISTEN_HOST: internalHost,
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
      socket.on('error', () => undefined)
      void collectHttpHead(socket, HEADER_WAIT_MS).then(
        (leftover) => {
          const head = leftover.subarray(0, Math.min(leftover.length, 2048)).toString('utf8')
          if (isHealthHttpRequest(head)) {
            socket.end(healthResponse(/^\s*HEAD\s/i.test(head)))
            return
          }
          if (tryPublicUpgrade(socket, leftover)) return
          if (inProcess && isWebSocketHttpRequest(head)) {
            const deadline = Date.now() + WORKER_CONNECT_MS
            const retry = () => {
              if (socket.destroyed) return
              if (tryPublicUpgrade(socket, leftover)) return
              if (hasPublicUpgradeHandler() || Date.now() >= deadline) {
                console.warn(
                  `[supervisor] 502 websocket ${leftover.length}b handler=${hasPublicUpgradeHandler()}`
                )
                rejectClient(socket)
                return
              }
              setTimeout(retry, WORKER_RETRY_MS)
            }
            setTimeout(retry, WORKER_RETRY_MS)
            return
          }
          if (inProcess) {
            console.warn(
              `[supervisor] 502 ${leftover.length}b ws=${isWebSocketHttpRequest(head)}`
            )
            rejectClient(socket)
            return
          }
          if (workerAccepting) {
            const game = openWorker()
            game.once('connect', () => pipeToWorker(socket, leftover, game))
            game.once('error', () => rejectClient(socket))
            return
          }
          void waitForWorker().then(
            (game) => pipeToWorker(socket, leftover, game),
            () => rejectClient(socket)
          )
        },
        () => rejectClient(socket)
      )
    })
    server.on('error', reject)
    server.listen(publicPort, listenHost, () => {
      console.log(
        inProcess
          ? `[supervisor] public ${listenHost}:${publicPort} (health + in-process websocket)`
          : `[supervisor] public ${listenHost}:${publicPort} -> ${workerLabel}`
      )
      resolve()
    })
  })

  if (!inProcess || !startGame) {
    spawnWorker()
    return
  }

  if (!hasPublicUpgradeHandler()) {
    try {
      registerUpgrade()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[supervisor] upgrade handler failed: ${message}`)
    }
  }
  console.log(
    `[supervisor] public ${listenHost}:${publicPort} in-process websocket (handler registered before physics)`
  )
  void startGame().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[supervisor] game failed: ${message}`)
  })
}
