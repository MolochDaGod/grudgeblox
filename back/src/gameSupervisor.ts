/**
 * Public /health stays on a tiny Node process so Railway probes never share
 * the Rapier/tsx event loop. Game traffic is proxied to a forked worker.
 */
import { connect, createServer } from 'node:net'
import { fork, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  buildHealthPayload,
  isHealthHttpRequest,
  readBoundedInteger,
} from './ecs/system/network/serverPolicy.js'

const INTERNAL_PORT = readBoundedInteger(process.env.GAME_INTERNAL_PORT, 18741, 1024, 65535)

export function shouldSupervise(): boolean {
  if (process.env.GAME_WORKER === '1') return false
  return Boolean(
    process.env.RAILWAY_SERVICE_ID ||
      process.env.RAILWAY_ENVIRONMENT_ID ||
      process.env.RAILWAY_ENVIRONMENT_NAME ||
      process.env.GAME_SUPERVISOR === '1'
  )
}

function healthResponse(ready: boolean): Buffer {
  const body = JSON.stringify(
    buildHealthPayload(
      ready,
      process.env.GAME_SCRIPT || 'gtaLobbyScript.ts',
      20,
      process.uptime(),
      process.env.ISLAND_MAP || (ready ? 'live-hub' : undefined)
    )
  )
  return Buffer.from(
    `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nCache-Control: no-store\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`
  )
}

export async function runGameSupervisor(entryHref: string): Promise<void> {
  const publicPort = readBoundedInteger(process.env.PORT ?? process.env.GAME_PORT, 8001, 1, 65535)
  const listenHost = process.env.LISTEN_HOST || '0.0.0.0'
  let child: ChildProcess | undefined
  let restarting = false

  const spawnWorker = () => {
    child = fork(fileURLToPath(entryHref), [], {
      env: {
        ...process.env,
        GAME_WORKER: '1',
        PORT: String(INTERNAL_PORT),
        GAME_PORT: String(INTERNAL_PORT),
        LISTEN_HOST: '127.0.0.1',
      },
      stdio: 'inherit',
    })
    console.log(`[supervisor] game worker pid=${child.pid} on 127.0.0.1:${INTERNAL_PORT}`)
    child.on('exit', (code, signal) => {
      console.error(`[supervisor] game worker exited code=${code} signal=${signal}`)
      child = undefined
      if (restarting) return
      restarting = true
      setTimeout(() => {
        restarting = false
        spawnWorker()
      }, 2000)
    })
  }

  spawnWorker()

  await new Promise<void>((resolve, reject) => {
    const server = createServer((socket) => {
      socket.once('data', (chunk) => {
        const head = chunk.subarray(0, Math.min(chunk.length, 160)).toString('utf8')
        if (isHealthHttpRequest(head)) {
          socket.end(healthResponse(true))
          return
        }
        const game = connect({ host: '127.0.0.1', port: INTERNAL_PORT })
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
      console.log(`[supervisor] public ${listenHost}:${publicPort} -> 127.0.0.1:${INTERNAL_PORT}`)
      resolve()
    })
  })
}
