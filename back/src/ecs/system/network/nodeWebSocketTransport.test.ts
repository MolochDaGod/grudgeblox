import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { request as httpRequest } from 'node:http'
import { connect, createServer, type Socket } from 'node:net'
import { describe, it } from 'node:test'
import { WebSocket as NodeWebSocket } from 'ws'
import {
  collectHttpHead,
  createNetUpgradeHandler,
  httpHeadersComplete,
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

  it('parses LF-only heads the way some proxies emit them', () => {
    const parsed = parseHttpHead(
      Buffer.from('GET / HTTP/1.1\nUpgrade: websocket\nConnection: Upgrade\n\nxyz')
    )
    assert.equal(parsed?.method, 'GET')
    assert.equal(parsed?.headers.upgrade, 'websocket')
    assert.deepEqual(parsed?.leftover, Buffer.from('xyz'))
  })

  it('does not treat an incomplete head as ready', () => {
    const partial = Buffer.from('GET / HTTP/1.1\r\nHost: example\r\nUpgrade: websocket\r\n')
    assert.equal(httpHeadersComplete(partial), false)
    assert.equal(parseHttpHead(partial), undefined)
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

  it('upgrades when the HTTP head arrives split across TCP packets', async () => {
    const origins = new Set(['https://blox-grudge-studio-grudgenexus.vercel.app'])
    let accepted = false
    const handler = createNetUpgradeHandler(() => {
      accepted = true
    }, true, origins)
    const server = createServer()
    server.on('connection', (socket: Socket) => {
      void collectHttpHead(socket, 2000).then((leftover) => {
        assert.equal(handler(socket, leftover), true)
        assert.equal(socket.isPaused(), false)
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
        const socket = connect({ host: '127.0.0.1', port })
        socket.once('error', reject)
        socket.once('connect', () => {
          socket.write('GET / HTTP/1.1\r\nHost: 127.0.0.1\r\n')
          setTimeout(() => {
            socket.write(
              'Connection: Upgrade\r\nUpgrade: websocket\r\n' +
                'Origin: https://blox-grudge-studio-grudgenexus.vercel.app\r\n' +
                'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n' +
                'Sec-WebSocket-Version: 13\r\n\r\n'
            )
          }, 40)
        })
        socket.on('data', (chunk) => {
          const text = chunk.toString('utf8')
          const match = /^HTTP\/1\.\d (\d+)/.exec(text)
          if (match) {
            socket.destroy()
            resolve(Number(match[1]))
          }
        })
        setTimeout(() => reject(new Error('split upgrade timed out')), 5000)
      })
      assert.equal(status, 101)
      assert.equal(accepted, true)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('upgrades an LF-only websocket head', async () => {
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
        const socket = connect({ host: '127.0.0.1', port })
        socket.once('error', reject)
        socket.once('connect', () => {
          socket.write(
            'GET / HTTP/1.1\nHost: 127.0.0.1\nConnection: Upgrade\nUpgrade: websocket\n' +
              'Origin: https://blox-grudge-studio-grudgenexus.vercel.app\n' +
              'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\n' +
              'Sec-WebSocket-Version: 13\n\n'
          )
        })
        socket.on('data', (chunk) => {
          const text = chunk.toString('utf8')
          const match = /^HTTP\/1\.\d (\d+)/.exec(text)
          if (match) {
            socket.destroy()
            resolve(Number(match[1]))
          }
        })
        setTimeout(() => reject(new Error('LF upgrade timed out')), 5000)
      })
      assert.equal(status, 101)
      assert.equal(accepted, true)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})
