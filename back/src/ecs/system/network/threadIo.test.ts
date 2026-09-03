import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MessageChannel } from 'node:worker_threads'
import {
  bytesFromThreadData,
  isMainToWorker,
  isWorkerToMain,
  toArrayBuffer,
  wrapThreadSocket,
} from './threadIo.js'

describe('thread websocket I/O protocol', () => {
  it('accepts open/message/close from the public thread', () => {
    assert.equal(isMainToWorker({ t: 'open', id: 'a', remote: '127.0.0.1' }), true)
    assert.equal(isMainToWorker({ t: 'close', id: 'a' }), true)
    assert.equal(isMainToWorker({ t: 'message', id: 'a', data: new Uint8Array([1]) }), true)
    assert.equal(isMainToWorker({ t: 'send', id: 'a', data: new Uint8Array([1]) }), false)
  })

  it('accepts listening/send/end from the game worker', () => {
    assert.equal(isWorkerToMain({ t: 'listening' }), true)
    assert.equal(isWorkerToMain({ t: 'send', id: 'a', data: new Uint8Array([1, 2]) }), true)
    assert.equal(isWorkerToMain({ t: 'end', id: 'a', code: 1008, reason: 'nope' }), true)
    assert.equal(isWorkerToMain({ t: 'open', id: 'a', remote: '127.0.0.1' }), false)
  })

  it('copies non-ArrayBuffer payloads into a detached ArrayBuffer', () => {
    const source = Buffer.from([9, 8, 7])
    const copied = toArrayBuffer(source)
    source[0] = 0
    assert.equal(copied.byteLength, 3)
    assert.equal(new Uint8Array(copied)[0], 9)
  })

  it('forwards send/end over a MessagePort without sharing Rapier', async () => {
    const { port1, port2 } = new MessageChannel()
    try {
      const received: unknown[] = []
      const done = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('thread I/O timed out')), 1000)
        port1.on('message', (message) => {
          received.push(message)
          if (received.length >= 2) {
            clearTimeout(timer)
            resolve()
          }
        })
      })
      const ws = wrapThreadSocket(port2, '10.0.0.1', { rateKey: 'k', id: 'player-1' })
      assert.equal(ws.getUserData().id, 'player-1')
      assert.equal(Buffer.from(ws.getRemoteAddressAsText() as ArrayBuffer).toString(), '10.0.0.1')
      ws.send(new Uint8Array([4, 5, 6]), true)
      ws.end(1000, 'bye')
      await done
      assert.equal(received.length, 2)
      assert.deepEqual(received[0], { t: 'send', id: 'player-1', data: new Uint8Array([4, 5, 6]) })
      assert.deepEqual(received[1], { t: 'end', id: 'player-1', code: 1000, reason: 'bye' })
      ws.end(1001, 'again')
      await new Promise((resolve) => setTimeout(resolve, 20))
      assert.equal(received.length, 2)
    } finally {
      port1.close()
      port2.close()
    }
  })

  it('round-trips binary through bytesFromThreadData', () => {
    const payload = new Uint8Array([1, 2, 3]).buffer
    assert.deepEqual([...bytesFromThreadData(payload)], [1, 2, 3])
  })
})
