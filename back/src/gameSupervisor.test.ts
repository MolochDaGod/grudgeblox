import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { describe, it } from 'node:test'
import {
  connectWorkerPort,
  internalPortFor,
  shouldSupervise,
  workerNodeArgs,
} from './gameSupervisor.js'

describe('game supervisor spawn', () => {
  it('keeps tsx when the parent already loaded it', () => {
    assert.deepEqual(workerNodeArgs('/app/back/src/sandbox.ts', ['--import', 'tsx/esm']), [
      '--import',
      'tsx/esm',
      '/app/back/src/sandbox.ts',
    ])
  })

  it('injects tsx when execArgv is only a memory flag', () => {
    assert.deepEqual(workerNodeArgs('src/sandbox.ts', ['--max-old-space-size=512']), [
      '--import',
      'tsx/esm',
      '--max-old-space-size=512',
      'src/sandbox.ts',
    ])
  })

  it('does not auto-supervise on Railway; that path 502s WebSockets', () => {
    const keys = [
      'GAME_WORKER',
      'GAME_SUPERVISOR',
      'RAILWAY_SERVICE_ID',
      'RAILWAY_ENVIRONMENT_ID',
      'RAILWAY_ENVIRONMENT_NAME',
    ]
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
    try {
      for (const key of keys) delete process.env[key]
      process.env.RAILWAY_SERVICE_ID = 'prod'
      process.env.RAILWAY_ENVIRONMENT_NAME = 'production'
      assert.equal(shouldSupervise(), false)
      process.env.GAME_SUPERVISOR = '1'
      assert.equal(shouldSupervise(), true)
      process.env.GAME_WORKER = '1'
      assert.equal(shouldSupervise(), false)
    } finally {
      for (const key of keys) {
        if (previous[key] === undefined) delete process.env[key]
        else process.env[key] = previous[key]
      }
    }
  })

  it('derives an internal port away from the public one', () => {
    const previous = process.env.GAME_INTERNAL_PORT
    delete process.env.GAME_INTERNAL_PORT
    try {
      assert.equal(internalPortFor(8080), 18080)
      assert.equal(internalPortFor(60000), 50000)
    } finally {
      if (previous === undefined) delete process.env.GAME_INTERNAL_PORT
      else process.env.GAME_INTERNAL_PORT = previous
    }
  })
})

describe('game supervisor worker connect', () => {
  it('retries until the worker port accepts IPv4 connections', async () => {
    const server = createServer()
    const port = await new Promise<number>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('expected tcp port')
        resolve(address.port)
      })
    })
    try {
      const socket = await connectWorkerPort(port, 1000, 20)
      socket.end()
    } finally {
      server.close()
    }
  })

  it('rejects when nothing is listening', async () => {
    const server = createServer()
    const port = await new Promise<number>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('expected tcp port')
        resolve(address.port)
      })
    })
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    await assert.rejects(connectWorkerPort(port, 200, 40), /not accepting/)
  })
})
