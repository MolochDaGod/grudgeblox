import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { describe, it } from 'node:test'
import { WebSocket as NodeWebSocket } from 'ws'
import { toArrayBuffer, wrapNodeWebSocket } from './nodeWebSocketTransport.js'

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
    assert.equal(Buffer.from(toArrayBuffer(Buffer.from('ab'))).toString(), 'ab')
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
})
