/**
 * Public /health stays in this process so Railway probes never share the
 * Rapier/tsx event loop. Game traffic is proxied to a spawned worker.
 */
import { existsSync } from 'node:fs'
import { connect, createServer } from 'node:net'
import { spawn, type ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildHealthPayload,
  isHealthHttpRequest,
  readBoundedInteger,
} from './ecs/system/network/serverPolicy.js'

function internalPortFor(publicPort: number): number {
  const configured = process.env.GAME_INTERNAL_PORT
  if (configured) return readBoundedInteger(configured, 18001, 1024, 65535)
  const candidate = publicPort < 55000 ? publicPort + 10000 : publicPort - 10000
  return candidate === publicPort ? 18001 : candidate
}

function workerScript(): string {
  const candidates = [
    fileURLToPath(new URL('./sandbox.ts', import.meta.url)),
    resolve(process.cwd(), 'src/sandbox.ts'),
    resolve(process.cwd(), 'back/src/sandbox.ts'),
  ]
  return candidates.find((path) => existsSync(path)) || candidates[0]
}

export function shouldSupervise(): boolean {
  if (process.env.GAME_WORKER === '1') return false
  return Boolean(
    process.env.RAILWAY_SERVICE_ID ||
      process.env.RAILWAY_ENVIRONMENT_ID ||
      process.env.RAILWAY_ENVIRONMENT_NAME ||
      process.env.GAME_SUPERVISOR === '1'
  )
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

export async function runGameSupervisor(): Promise<void> {
  const publicPort = readBoundedInteger(process.env.PORT ?? process.env.GAME_PORT, 8001, 1, 65535)
  const internalPort = internalPortFor(publicPort)
  const listenHost = process.env.LISTEN_HOST || '0.0.0.0'
  const script = workerScript()
  let child: ChildProcess | undefined
  let restarting = false

  const spawnWorker = () => {
    child = spawn(process.execPath, ['--import', 'tsx/esm', script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        GAME_WORKER: '1',
        PORT: String(internalPort),
        GAME_PORT: String(internalPort),
        LISTEN_HOST: '127.0.0.1',
      },
      stdio: 'inherit',
    })
    console.log(
      `[supervisor] worker pid=${child.pid} ${script} on 127.0.0.1:${internalPort}`
    )
    child.on('error', (error) => {
      console.error(`[supervisor] spawn error: ${error.message}`)
    })
    child.on('exit', (code, signal) => {
      console.error(`[supervisor] worker exited code=${code} signal=${signal}`)
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
        const game = connect({ host: '127.0.0.1', port: internalPort })
        game.on('error', () => {
          if (!socket.destroyed) {
            socket.end(
              'HTTP/1.1 502 Bad Gateway\r\nContent-Type: text/plain\r\nContent-Length: 21\r\nConnection: close\r\n\r\nGame server starting\n'
            )
          }
        })
        game.write(chunk)
        socket.pipe(game)
        game.pipe(socket)
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
