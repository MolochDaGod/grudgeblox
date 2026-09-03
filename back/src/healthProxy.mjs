import { Buffer } from 'node:buffer'
import { connect, createServer } from 'node:net'
import process from 'node:process'
import { workerData } from 'node:worker_threads'

const publicPort = Number(workerData.publicPort)
const internalPort = Number(workerData.internalPort)
const listenHost = workerData.listenHost || '0.0.0.0'
const script = workerData.script || 'gtaLobbyScript.ts'
const map = workerData.map || 'live-hub'
const started = Date.now()

function isHealthHttpRequest(head) {
  const line = (head.split(/\r?\n/, 1)[0] || '')
  return /^(GET|HEAD) \/health(\?| HTTP\/|$)/i.test(line)
}

function healthResponse() {
  const body = JSON.stringify({
    status: 'ok',
    ready: true,
    uptime: (Date.now() - started) / 1000,
    game: { script, tickrate: 20, map },
  })
  return Buffer.from(
    `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nCache-Control: no-store\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`
  )
}

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

server.listen(publicPort, listenHost, () => {
  console.log(`[health-proxy] public ${listenHost}:${publicPort} -> 127.0.0.1:${internalPort}`)
})
server.on('error', (error) => {
  console.error(`[health-proxy] ${error.message}`)
  process.exit(1)
})
