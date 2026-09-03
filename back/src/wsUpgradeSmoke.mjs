import http from 'node:http'
import process from 'node:process'
import { randomBytes } from 'node:crypto'

const port = Number(process.env.PORT || process.env.GAME_PORT || 8001)
const origin =
  process.env.SMOKE_ALLOWED_ORIGIN || 'https://blox-grudge-studio-grudgenexus.vercel.app'

if (!Number.isInteger(port) || port < 1 || port > 65535) process.exit(1)

const request = http.request(
  {
    hostname: '127.0.0.1',
    port,
    path: '/',
    headers: {
      Connection: 'Upgrade',
      Upgrade: 'websocket',
      Origin: origin,
      'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
      'Sec-WebSocket-Version': '13',
    },
  },
  (response) => {
    console.error(`WebSocket upgrade rejected: ${response.statusCode}`)
    process.exit(1)
  }
)
request.on('upgrade', (_response, socket) => {
  socket.destroy()
  console.log('WebSocket upgrade 101')
  process.exit(0)
})
request.on('error', (error) => {
  console.error(error.message)
  process.exit(1)
})
request.setTimeout(45000, () => {
  request.destroy(new Error('upgrade timed out'))
})
request.end()
