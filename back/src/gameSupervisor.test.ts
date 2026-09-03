import assert from 'node:assert/strict'
import { unlinkSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  connectWorkerPort,
  connectWorkerSocket,
  internalPortFor,
  shouldSupervise,
  workerNodeArgs,
  workerSocketPath,
  workerThreadEntry,
} from './gameSupervisor.js'

describe('game supervisor spawn', () => {
  it('loads the game worker through a native ESM entry so tsx can register', () => {
    assert.match(workerThreadEntry(), /gameWorker\.mjs$/)
  })

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

  it('auto-supervises on Railway so public /health stays on Node net', () => {
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
      assert.equal(shouldSupervise(), true)
      process.env.GAME_SUPERVISOR = '0'
      assert.equal(shouldSupervise(), false)
      delete process.env.GAME_SUPERVISOR
      process.env.GAME_WORKER = '1'
      assert.equal(shouldSupervise(), false)
    } finally {
      for (const key of keys) {
        if (previous[key] === undefined) delete process.env[key]
        else process.env[key] = previous[key]
      }
    }
  })

  it('enables supervision off Railway only with GAME_SUPERVISOR=1', () => {
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
      assert.equal(shouldSupervise(), false)
      process.env.GAME_SUPERVISOR = '1'
      assert.equal(shouldSupervise(), true)
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

  it('uses GAME_SOCKET only when explicitly set', () => {
    const previousSocket = process.env.GAME_SOCKET
    const previousWorker = process.env.GAME_WORKER
    try {
      delete process.env.GAME_SOCKET
      process.env.GAME_WORKER = '1'
      assert.equal(workerSocketPath(), undefined)
      process.env.GAME_SOCKET = '/tmp/custom-game.sock'
      assert.equal(workerSocketPath(), '/tmp/custom-game.sock')
    } finally {
      if (previousSocket === undefined) delete process.env.GAME_SOCKET
      else process.env.GAME_SOCKET = previousSocket
      if (previousWorker === undefined) delete process.env.GAME_WORKER
      else process.env.GAME_WORKER = previousWorker
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

  it('retries until the worker unix socket accepts connections', async () => {
    const path = join(tmpdir(), `grudgeblox-test-${process.pid}.sock`)
    try {
      unlinkSync(path)
    } catch {
      // no leftover socket
    }
    const server = createServer()
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(path, () => resolve())
    })
    try {
      const socket = await connectWorkerSocket(path, 1000, 20)
      socket.end()
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
      try {
        unlinkSync(path)
      } catch {
        // already removed
      }
    }
  })
})
