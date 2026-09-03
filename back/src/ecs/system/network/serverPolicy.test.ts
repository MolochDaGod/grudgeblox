import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { pack } from 'msgpackr'
import { ClientMessageType } from '@shared/network/client/index.js'
import { decodeClientMessage, MAX_CLIENT_MESSAGE_BYTES } from './clientMessageValidation.js'
import {
  buildHealthPayload,
  isAdminAuthorized,
  isHealthHttpRequest,
  isWebSocketOriginAllowed,
  onRailwayRuntime,
  readBoundedInteger,
  resolveAllowedOrigins,
  resolveGameSocketPath,
  resolveServerListenHost,
} from './serverPolicy.js'

describe('health and admin policy', () => {
  it('keeps health operational and excludes player/chat data', () => {
    const health = buildHealthPayload(true, 'dopebudzStreets.ts', 20, 12.5)
    assert.deepEqual(health, {
      status: 'ok',
      ready: true,
      uptime: 12.5,
      game: { script: 'dopebudzStreets.ts', tickrate: 20 },
    })
    assert.equal('players' in health, false)
    assert.equal('messages' in health, false)
    assert.equal(JSON.stringify(health).includes('chat'), false)
  })

  it('includes the island map on health when provided', () => {
    const health = buildHealthPayload(true, 'islandSandboxScript.ts', 20, 1, 'alpine-mesh')
    assert.equal(health.game.map, 'alpine-mesh')
  })

  it('requires an exact bearer token for the optional admin feed', () => {
    assert.equal(isAdminAuthorized('', undefined), false)
    assert.equal(isAdminAuthorized('Bearer correct', undefined), false)
    assert.equal(isAdminAuthorized('', 'correct'), false)
    assert.equal(isAdminAuthorized('Basic correct', 'correct'), false)
    assert.equal(isAdminAuthorized('Bearer wrong', 'correct'), false)
    assert.equal(isAdminAuthorized('Bearer correct', 'correct'), true)
  })

  it('detects health probes from the first HTTP line', () => {
    assert.equal(isHealthHttpRequest('GET /health HTTP/1.1\r\nHost: x'), true)
    assert.equal(isHealthHttpRequest('HEAD /health HTTP/1.1\r\n'), true)
    assert.equal(isHealthHttpRequest('GET / HTTP/1.1\r\n'), false)
    assert.equal(isHealthHttpRequest('GET /play HTTP/1.1\r\n'), false)
  })
})

describe('origin policy', () => {
  it('fails closed when production has no configured origin', () => {
    const railwayVars = ['RAILWAY_SERVICE_ID', 'RAILWAY_ENVIRONMENT_ID', 'RAILWAY_ENVIRONMENT_NAME']
    const previous = Object.fromEntries(railwayVars.map((key) => [key, process.env[key]]))
    for (const key of railwayVars) delete process.env[key]
    try {
      assert.throws(() => resolveAllowedOrigins(true, undefined, undefined), /requires/)
    } finally {
      for (const key of railwayVars) {
        if (previous[key] === undefined) delete process.env[key]
        else process.env[key] = previous[key]
      }
    }
  })

  it('defaults to the live blox origin on Railway when none are configured', () => {
    const previous = process.env.RAILWAY_SERVICE_ID
    process.env.RAILWAY_SERVICE_ID = 'test-service'
    try {
      const origins = resolveAllowedOrigins(true, undefined, undefined)
      assert.equal(isWebSocketOriginAllowed('https://blox.grudge-studio.com', true, origins), true)
    } finally {
      if (previous === undefined) delete process.env.RAILWAY_SERVICE_ID
      else process.env.RAILWAY_SERVICE_ID = previous
    }
  })

  it('accepts a websocket FRONTEND_URL as the matching https origin', () => {
    const origins = resolveAllowedOrigins(true, undefined, 'wss://blox.grudge-studio.com')
    assert.equal(isWebSocketOriginAllowed('https://blox.grudge-studio.com', true, origins), true)
  })

  it('supports explicit comma-separated origins and the legacy frontend value', () => {
    const origins = resolveAllowedOrigins(
      true,
      'https://one.example, https://two.example/',
      'https://legacy.example'
    )
    assert.deepEqual([...origins], [
      'https://one.example',
      'https://two.example',
      'https://legacy.example',
    ])
    assert.equal(isWebSocketOriginAllowed('https://one.example', true, origins), true)
    assert.equal(isWebSocketOriginAllowed('https://unknown.example', true, origins), false)
    assert.equal(isWebSocketOriginAllowed('', true, origins), false)
  })

  it('preserves loopback browser defaults and origin-less local tools in development', () => {
    const origins = resolveAllowedOrigins(false, undefined, undefined)
    assert.equal(isWebSocketOriginAllowed('http://127.0.0.1:4000', false, origins), true)
    assert.equal(isWebSocketOriginAllowed('http://localhost:4000', false, origins), true)
    assert.equal(isWebSocketOriginAllowed('', false, origins), true)
    assert.equal(isWebSocketOriginAllowed('https://unknown.example', false, origins), false)
  })

  it('binds 0.0.0.0 on Railway even when NODE_ENV is unset', () => {
    assert.equal(resolveServerListenHost(undefined, undefined, true), '0.0.0.0')
    assert.equal(resolveServerListenHost(undefined, 'production', false), '0.0.0.0')
    assert.equal(resolveServerListenHost(undefined, undefined, false), '127.0.0.1')
    assert.equal(resolveServerListenHost('127.0.0.1', 'production', true), '127.0.0.1')
    assert.equal(onRailwayRuntime(), Boolean(process.env.RAILWAY_SERVICE_ID || process.env.RAILWAY_ENVIRONMENT_ID || process.env.RAILWAY_ENVIRONMENT_NAME))
  })

  it('binds the worker to a unix socket only when GAME_SOCKET is set', () => {
    assert.equal(resolveGameSocketPath('/tmp/custom.sock'), '/tmp/custom.sock')
    assert.equal(resolveGameSocketPath(undefined), undefined)
    assert.equal(resolveGameSocketPath(''), undefined)
  })
})

describe('client message decoding', () => {
  it('accepts a finite, schema-valid input message', () => {
    const result = decodeClientMessage(
      pack({ t: ClientMessageType.INPUT, u: true, d: false, l: false, r: true, s: false, y: 1.2, i: false })
    )
    assert.equal(result.ok, true)
  })

  it('rejects malformed and oversized msgpack without throwing', () => {
    assert.deepEqual(decodeClientMessage(Uint8Array.from([0xd9])), {
      ok: false,
      reason: 'message is not valid msgpack',
    })
    assert.deepEqual(decodeClientMessage(new Uint8Array(MAX_CLIENT_MESSAGE_BYTES + 1)), {
      ok: false,
      reason: 'message payload size is outside the allowed range',
    })
  })

  it('rejects non-finite input, oversized chat, invalid IDs, and unknown types', () => {
    const invalidMessages = [
      { t: ClientMessageType.INPUT, u: true, d: false, l: false, r: false, s: false, y: Number.NaN, i: false },
      { t: ClientMessageType.CHAT_MESSAGE, content: 'x'.repeat(301) },
      { t: ClientMessageType.PROXIMITY_PROMPT_INTERACT, eId: -1 },
      { t: 999 },
    ]
    for (const message of invalidMessages) {
      assert.equal(decodeClientMessage(pack(message)).ok, false)
    }
  })
})

describe('bounded numeric configuration', () => {
  it('accepts valid integers and rejects unsafe values', () => {
    assert.equal(readBoundedInteger(undefined, 80, 10, 1000), 80)
    assert.equal(readBoundedInteger('120', 80, 10, 1000), 120)
    assert.throws(() => readBoundedInteger('0', 80, 10, 1000))
    assert.throws(() => readBoundedInteger('10.5', 80, 10, 1000))
  })
})
