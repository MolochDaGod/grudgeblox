import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { request as httpRequest } from 'node:http'
import { createServer, type Socket } from 'node:net'
import { describe, it } from 'node:test'
import { WebSocket as NodeWebSocket } from 'ws'
import {
  createNetUpgradeHandler,
  parseHttpHead,
  toArrayBuffer,
  wrapNodeWebSocket,
} from './nodeWebSocketTransport.js'

class FakeSocket extends EventEmitter {
  readyState: number = NodeWebSocket.OPEN
  bufferedAmount = 0
  binaryType = 'nodebuffer'
  sent: unknown[] = []
  send(data: unknown) {
    this.sent.push(data)
  }
  close() {
    this.readyState = NodeWebSocket.CLOSED
  }
}

describe('node websocket transport', () => {
  it('sends only while the socket is OPEN and copies payload bytes', () => {
    const socket = new FakeSocket()
    const wrapped = wrapNodeWebSocket(socket as never, {
      socket: { remoteAddress: '127.0.0.1' },
    } as never)
    assert.equal(wrapped.send(Buffer.from('hi')), 1)
    socket.readyState = NodeWebSocket.CLOSED
    assert.equal(wrapped.send(Buffer.from('nope')), 2)
    const copy = toArrayBuffer(Buffer.from('ab'))
    assert.equal(copy.byteLength, 2)
    assert.equal(Buffer.from(copy).toString(), 'ab')
  })

  it('drops sends when backpressure exceeds the cap', () => {
    const socket = new FakeSocket()
    socket.bufferedAmount = 65 * 1024
    const wrapped = wrapNodeWebSocket(socket as never, {
      socket: { remoteAddress: '127.0.0.1' },
    } as never)
    assert.equal(wrapped.send(Buffer.from('hi')), 0)
    assert.equal(socket.sent.length, 0)
  })

  it('parses an HTTP upgrade head and leftover bytes', () => {
    const parsed = parseHttpHead(
      Buffer.from('GET / HTTP/1.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\nabc')
    )
    assert.equal(parsed?.method, 'GET')
    assert.equal(parsed?.headers.upgrade, 'websocket')
    assert.deepEqual(parsed?.leftover, Buffer.from('abc'))
  })

  it('completes a WebSocket upgrade on a Node net listener without a second bind', async () => {
    const origins = new Set(['https://blox-grudge-studio-grudgenexus.vercel.app'])
    let accepted = false
    const handler = createNetUpgradeHandler(() => {
      accepted = true
    }, true, origins)
    const server = createServer()
    server.on('connection', (socket: Socket) => {
      socket.once('data', (chunk) => {
        assert.equal(handler(socket, chunk), true)
      })
    })
    try {
      const port = await new Promise<number>((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', () => {
          const address = server.address()
          if (!address || typeof address === 'string') throw new Error('expected tcp port')
          resolve(address.port)
        })
      })
      const status = await new Promise<number>((resolve, reject) => {
        const req = httpRequest(
          {
            hostname: '127.0.0.1',
            port,
            path: '/',
            headers: {
              Connection: 'Upgrade',
              Upgrade: 'websocket',
              Origin: 'https://blox-grudge-studio-grudgenexus.vercel.app',
              'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
              'Sec-WebSocket-Version': '13',
            },
          },
          (response) => resolve(response.statusCode || 0)
        )
        req.on('upgrade', (_response, socket) => {
          socket.destroy()
          resolve(101)
        })
        req.on('error', reject)
        req.setTimeout(5000, () => req.destroy(new Error('upgrade timed out')))
        req.end()
      })
      assert.equal(status, 101)
      assert.equal(accepted, true)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})
