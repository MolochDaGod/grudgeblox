import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { request as httpRequest, createServer } from 'node:http'
import type { Socket } from 'node:net'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  decodeUpgradeHead,
  handOffUpgrade,
  isReadyMessage,
  isUpgradeMessage,
  serializeUpgrade,
} from './gameIpc.js'

describe('game IPC messages', () => {
  it('round-trips an upgrade payload including the leftover head bytes', () => {
    const head = Buffer.from('abc')
    const req = {
      headers: { origin: 'https://blox-grudge-studio.vercel.app', upgrade: 'websocket' },
      method: 'GET',
      url: '/',
      httpVersion: '1.1',
      socket: { remoteAddress: '127.0.0.1' },
    }
    const message = serializeUpgrade(req as never, head)
    assert.equal(isUpgradeMessage(message), true)
    assert.equal(isReadyMessage(message), false)
    assert.equal(isReadyMessage({ type: 'ready' }), true)
    assert.equal(isUpgradeMessage({ type: 'upgrade' }), false)
    assert.deepEqual(decodeUpgradeHead(message), head)
    assert.equal(message.remoteAddress, '127.0.0.1')
  })
})

describe('game IPC socket handoff', () => {
  it('completes a WebSocket upgrade in the child without a second listen', async () => {
    const script = join(process.cwd(), `ipc-child-${process.pid}.mjs`)
    writeFileSync(
      script,
      `
import { WebSocketServer } from 'ws'
const wss = new WebSocketServer({ noServer: true })
process.on('message', (msg, socket) => {
  if (msg?.type !== 'upgrade' || !socket) return
  const head = Buffer.from(msg.head || '', 'base64')
  const req = { headers: msg.headers, method: msg.method, url: msg.url, socket }
  wss.handleUpgrade(req, socket, head, () => {})
})
process.send({ type: 'ready' })
`
    )
    const child = spawn(process.execPath, [script], {
      cwd: process.cwd(),
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    })
    const server = createServer((_req, res) => res.writeHead(404).end())
    try {
      await new Promise<void>((resolve, reject) => {
        const fail = (reason: Error) => reject(reason)
        child.once('error', fail)
        child.once('exit', (code) => fail(new Error(`child exited ${code}`)))
        child.once('message', (value) => {
          if (isReadyMessage(value)) resolve()
          else fail(new Error('expected ready'))
        })
      })
      const port = await new Promise<number>((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', () => {
          const address = server.address()
          if (!address || typeof address === 'string') throw new Error('expected tcp port')
          resolve(address.port)
        })
      })
      server.on('upgrade', (req, socket, head) => {
        assert.equal(handOffUpgrade(child, req, socket as Socket, head), true)
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
        req.on('upgrade', () => resolve(101))
        req.on('error', reject)
        req.setTimeout(5000, () => req.destroy(new Error('upgrade timed out')))
        req.end()
      })
      assert.equal(status, 101)
    } finally {
      child.kill('SIGTERM')
      await new Promise<void>((resolve) => server.close(() => resolve()))
      try {
        unlinkSync(script)
      } catch {
        // already removed
      }
    }
  })
})
