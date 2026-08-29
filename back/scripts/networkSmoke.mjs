import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import http from 'node:http'
import process from 'node:process'
import { pack, unpack } from 'msgpackr'
import pako from 'pako'

const httpUrl = new URL(process.env.SMOKE_HTTP_URL || 'http://127.0.0.1:8015')
const wsUrl = process.env.SMOKE_WS_URL || `ws://${httpUrl.host}`
const allowedOrigin = process.env.SMOKE_ALLOWED_ORIGIN || 'http://127.0.0.1:4015'
const adminToken = process.env.SMOKE_ADMIN_TOKEN
const burstSize = Number(process.env.SMOKE_MESSAGE_BURST || 100)

async function get(path, authorization) {
  const response = await fetch(new URL(path, httpUrl), {
    headers: authorization ? { Authorization: authorization } : undefined,
  })
  const text = await response.text()
  let body
  try {
    body = text ? JSON.parse(text) : undefined
  } catch {
    body = text
  }
  return { status: response.status, body }
}

function websocketUpgradeStatus(origin) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: httpUrl.hostname,
      port: httpUrl.port,
      path: '/',
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        Origin: origin,
        'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
        'Sec-WebSocket-Version': '13',
      },
    })
    request.on('upgrade', (response, socket) => {
      socket.destroy()
      resolve(response.statusCode || 101)
    })
    request.on('response', (response) => {
      response.resume()
      resolve(response.statusCode)
    })
    request.on('error', reject)
    request.end()
  })
}

function openWebSocket() {
  return new Promise((resolve, reject) => {
    const websocket = new WebSocket(wsUrl)
    websocket.binaryType = 'arraybuffer'
    const timeout = setTimeout(() => reject(new Error('WebSocket open timed out')), 5000)
    websocket.addEventListener(
      'open',
      () => {
        clearTimeout(timeout)
        resolve(websocket)
      },
      { once: true }
    )
    websocket.addEventListener(
      'error',
      () => {
        clearTimeout(timeout)
        reject(new Error('WebSocket open failed'))
      },
      { once: true }
    )
  })
}

function waitForClose(websocket, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WebSocket close timed out')), timeoutMs)
    websocket.addEventListener(
      'close',
      (event) => {
        clearTimeout(timeout)
        resolve(event.code)
      },
      { once: true }
    )
  })
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function testStreetsActions() {
  const websocket = await openWebSocket()
  const received = []
  websocket.addEventListener('message', (event) => {
    try {
      const inflated = pako.inflate(new Uint8Array(event.data))
      received.push(JSON.stringify(unpack(inflated)))
    } catch {
      // A later assertion fails if the expected protocol responses are absent.
    }
  })

  await delay(100)
  websocket.send(pack({ t: 4, name: `Smoke${Date.now().toString().slice(-6)}` }))
  websocket.send(pack({ t: 5, action: 'dopebudz:status' }))
  websocket.send(pack({ t: 5, action: 'dopebudz:lots' }))
  websocket.send(pack({ t: 5, action: 'dopebudz:missions' }))

  const deadline = Date.now() + 6000
  while (Date.now() < deadline) {
    const transcript = received.join('\n')
    if (
      transcript.includes('BUDZ') &&
      transcript.includes('No lots claimed yet.') &&
      transcript.includes('No active job.')
    ) {
      websocket.close()
      return
    }
    await delay(100)
  }

  websocket.close()
  throw new Error('Timed out waiting for targeted Streets status/lots/job responses')
}

async function testRejectedPayload(payload) {
  const websocket = await openWebSocket()
  await delay(50)
  const closePromise = waitForClose(websocket)
  websocket.send(payload)
  await closePromise
}

async function main() {
  const health = await get('/health')
  assert.equal(health.status, 200)
  assert.deepEqual(Object.keys(health.body).sort(), ['game', 'ready', 'status', 'uptime'])
  assert.equal(health.body.ready, true)
  assert.equal(JSON.stringify(health.body).includes('chat'), false)
  assert.equal(JSON.stringify(health.body).includes('players'), false)

  if (adminToken) {
    assert.equal((await get('/admin/events')).status, 401)
    assert.equal((await get('/admin/events', 'Bearer wrong')).status, 401)
    const admin = await get('/admin/events', `Bearer ${adminToken}`)
    assert.equal(admin.status, 200)
    assert.deepEqual(admin.body.retention, {
      storage: 'memory',
      maxMessages: 20,
      resetsOnRestart: true,
    })
    assert.ok(Array.isArray(admin.body.events))
  } else {
    assert.equal((await get('/admin/events')).status, 404)
  }

  assert.equal(await websocketUpgradeStatus(allowedOrigin), 101)
  assert.equal(await websocketUpgradeStatus('https://rejected.invalid'), 403)

  await testStreetsActions()
  await testRejectedPayload(Uint8Array.from([0xd9]))
  await testRejectedPayload(new Uint8Array(513))

  const rateLimited = await openWebSocket()
  await delay(50)
  const rateClose = waitForClose(rateLimited)
  const validAction = pack({ t: 5, action: 'dopebudz:status' })
  for (let index = 0; index < burstSize; index += 1) rateLimited.send(validAction)
  await rateClose

  assert.equal((await get('/health')).status, 200)
  console.log('Network smoke passed: health/auth/origins/Streets/malformed/oversized/rate-limit')
}

await main()
