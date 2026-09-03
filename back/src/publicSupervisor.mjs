/**
 * Railway public process: vanilla Node on $PORT, no tsx, no Rapier.
 * /health answers immediately. WebSocket upgrades are handed to a child
 * with child.send(msg, socket). #26 OOMd because the parent also loaded
 * tsx + sandbox.ts; this file is the only parent heap.
 */
import { existsSync } from 'node:fs'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const UPGRADE_WAIT_MS = 45000
const STARTING_BODY = 'Game server starting\n'
const DEFAULT_LIVE_ORIGINS = [
  'https://blox.grudge-studio.com',
  'https://grudgeblox.vercel.app',
  'https://grudgeblox-grudgenexus.vercel.app',
  'https://blox-grudge-studio.vercel.app',
  'https://blox-grudge-studio-grudgenexus.vercel.app',
]
const DEFAULT_LOCAL_ORIGINS = ['http://127.0.0.1:4000', 'http://localhost:4000']

const here = fileURLToPath(new URL('.', import.meta.url))

function workerScript() {
  const candidates = [
    resolve(here, 'sandbox.ts'),
    resolve(process.cwd(), 'src/sandbox.ts'),
    resolve(process.cwd(), 'back/src/sandbox.ts'),
  ]
  return candidates.find((path) => existsSync(path)) || candidates[0]
}

function coerceBrowserOrigin(raw) {
  const value = raw.trim()
  if (value.startsWith('wss://')) return `https://${value.slice(6)}`
  if (value.startsWith('ws://')) return `http://${value.slice(5)}`
  return value
}

function normalizeOrigin(rawOrigin) {
  const url = new URL(rawOrigin.trim())
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Allowed origin must use http or https: ${rawOrigin}`)
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== '/')) {
    throw new Error(`Allowed origin must not contain credentials, a path, query, or fragment: ${rawOrigin}`)
  }
  return url.origin
}

function allowedOrigins(isProduction) {
  const configured = [
    ...(process.env.ALLOWED_ORIGINS?.split(',') ?? []),
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ]
    .map((origin) => origin.trim())
    .filter(Boolean)
  const defaults = isProduction ? DEFAULT_LIVE_ORIGINS : DEFAULT_LOCAL_ORIGINS
  const list = configured.length > 0 ? configured : defaults
  return new Set(list.map((origin) => normalizeOrigin(coerceBrowserOrigin(origin))))
}

function originAllowed(requestOrigin, isProduction, origins) {
  if (!requestOrigin) return !isProduction
  try {
    return origins.has(normalizeOrigin(requestOrigin))
  } catch {
    return false
  }
}

function healthBody() {
  return JSON.stringify({
    status: 'ok',
    ready: true,
    uptime: process.uptime(),
    game: {
      script: process.env.GAME_SCRIPT || 'gtaLobbyScript.ts',
      tickrate: 20,
      map: process.env.ISLAND_MAP || 'live-hub',
    },
  })
}

function writePlain(socket, status, reason, body) {
  if (socket.destroyed) return
  const payload = Buffer.from(body)
  socket.write(
    `HTTP/1.1 ${status} ${reason}\r\nContent-Type: text/plain\r\nContent-Length: ${payload.length}\r\nConnection: close\r\n\r\n`
  )
  socket.write(payload)
  socket.destroy()
}

function serializeUpgrade(req, head) {
  return {
    type: 'upgrade',
    headers: req.headers,
    method: req.method,
    url: req.url,
    httpVersion: req.httpVersion,
    remoteAddress: req.socket.remoteAddress,
    head: head.toString('base64'),
  }
}

const publicPort = Number(process.env.PORT || process.env.GAME_PORT || 8001)
if (!Number.isInteger(publicPort) || publicPort < 1 || publicPort > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535')
}
const listenHost = process.env.LISTEN_HOST || '0.0.0.0'
const isProduction = process.env.NODE_ENV === 'production' || Boolean(
  process.env.RAILWAY_ENVIRONMENT_NAME ||
    process.env.RAILWAY_ENVIRONMENT_ID ||
    process.env.RAILWAY_SERVICE_ID
)
const origins = allowedOrigins(isProduction)
const script = workerScript()

let child
let restarting = false
let workerReady = false
const pending = []

function dropPending(socket) {
  const index = pending.findIndex((item) => item.socket === socket)
  if (index < 0) return
  clearTimeout(pending[index].timer)
  pending.splice(index, 1)
}

function handOff(req, socket, head) {
  if (!child?.connected || !workerReady) return false
  try {
    return child.send(serializeUpgrade(req, head), socket)
  } catch {
    return false
  }
}

function flushPending() {
  while (pending.length > 0 && workerReady && child) {
    const item = pending.shift()
    if (!item) break
    clearTimeout(item.timer)
    if (item.socket.destroyed) continue
    if (!handOff(item.req, item.socket, item.head)) {
      writePlain(item.socket, 502, 'Bad Gateway', STARTING_BODY)
    }
  }
}

function queueUpgrade(req, socket, head) {
  const timer = setTimeout(() => {
    dropPending(socket)
    writePlain(socket, 502, 'Bad Gateway', STARTING_BODY)
  }, UPGRADE_WAIT_MS)
  pending.push({ req, socket, head, timer })
  socket.once('close', () => dropPending(socket))
  socket.once('error', () => dropPending(socket))
}

function spawnWorker() {
  workerReady = false
  const env = { ...process.env, GAME_WORKER: '1', GAME_NO_LISTEN: '1' }
  delete env.GAME_SOCKET
  child = spawn(process.execPath, ['--import', 'tsx/esm', script], {
    cwd: process.cwd(),
    env,
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
  })
  console.log(`[supervisor] lite parent pid=${process.pid} worker pid=${child.pid} ${script} ipc`)
  child.on('error', (error) => {
    console.error(`[supervisor] spawn error: ${error.message}`)
  })
  child.on('message', (value) => {
    if (!value || value.type !== 'ready') return
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

function shutdown(signal) {
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
  if (!originAllowed(origin, isProduction, origins)) {
    writePlain(socket, 403, 'Forbidden', 'Forbidden\n')
    return
  }
  if (handOff(req, socket, head)) return
  queueUpgrade(req, socket, head)
})

server.on('error', (error) => {
  console.error(`[supervisor] listen error: ${error.message}`)
  process.exit(1)
})

server.listen(publicPort, listenHost, () => {
  console.log(`[supervisor] lite public ${listenHost}:${publicPort} (health + websocket handoff)`)
  spawnWorker()
})
