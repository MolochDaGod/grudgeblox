import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { deliverNodeSocket, setNodeSocketAcceptor } from './nodeSocketAccept.js'

describe('node socket accept queue', () => {
  it('delivers queued sockets once an acceptor is registered', () => {
    setNodeSocketAcceptor(undefined)
    const received: Array<{ id: number; url: string }> = []
    deliverNodeSocket({ id: 1 } as never, { url: '/a' } as never)
    setNodeSocketAcceptor((socket, req) => {
      received.push({ id: (socket as unknown as { id: number }).id, url: req.url || '' })
    })
    deliverNodeSocket({ id: 2 } as never, { url: '/b' } as never)
    assert.deepEqual(received, [
      { id: 1, url: '/a' },
      { id: 2, url: '/b' },
    ])
    setNodeSocketAcceptor(undefined)
  })
})
