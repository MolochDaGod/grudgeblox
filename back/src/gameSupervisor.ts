/**
 * On Railway, /health runs in a worker thread so Rapier/tsx on the main
 * thread cannot stall probes. Game traffic is proxied to localhost.
 */
import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import { readBoundedInteger } from './ecs/system/network/serverPolicy.js'

function internalPortFor(publicPort: number): number {
  const configured = process.env.GAME_INTERNAL_PORT
  if (configured) return readBoundedInteger(configured, 18001, 1024, 65535)
  const candidate = publicPort < 55000 ? publicPort + 10000 : publicPort - 10000
  return candidate === publicPort ? 18001 : candidate
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

export function startHealthProxy(): { publicPort: number; internalPort: number } {
  const publicPort = readBoundedInteger(process.env.PORT ?? process.env.GAME_PORT, 8001, 1, 65535)
  const internalPort = internalPortFor(publicPort)
  const listenHost = process.env.LISTEN_HOST || '0.0.0.0'
  const worker = new Worker(fileURLToPath(new URL('./healthProxy.mjs', import.meta.url)), {
    workerData: {
      publicPort,
      internalPort,
      listenHost,
      script: process.env.GAME_SCRIPT || 'gtaLobbyScript.ts',
      map: process.env.ISLAND_MAP || 'live-hub',
    },
  })
  worker.on('error', (error) => {
    console.error(`[health-proxy] worker error: ${error.message}`)
  })
  worker.on('exit', (code) => {
    if (code !== 0) console.error(`[health-proxy] worker exited ${code}`)
  })
  process.env.GAME_WORKER = '1'
  process.env.PORT = String(internalPort)
  process.env.GAME_PORT = String(internalPort)
  process.env.LISTEN_HOST = '127.0.0.1'
  console.log(`[supervisor] health worker thread on ${listenHost}:${publicPort}; game on 127.0.0.1:${internalPort}`)
  return { publicPort, internalPort }
}
