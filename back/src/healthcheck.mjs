import http from 'node:http'
import https from 'node:https'
import process from 'node:process'

const port = Number(process.env.PORT || process.env.GAME_PORT || 8001)
if (!Number.isInteger(port) || port < 1 || port > 65535) process.exit(1)

function check(client, extraOptions = {}) {
  return new Promise((resolve) => {
    const request = client.get(
      {
        hostname: '127.0.0.1',
        port,
        path: '/health',
        timeout: 1000,
        ...extraOptions,
      },
      (response) => {
        response.resume()
        resolve(response.statusCode === 200)
      }
    )
    request.on('timeout', () => request.destroy())
    request.on('error', () => resolve(false))
  })
}

async function main() {
  // Support direct TLS or plaintext behind an edge proxy without choosing between them.
  const healthy = (await check(http)) || (await check(https, { rejectUnauthorized: false }))
  process.exit(healthy ? 0 : 1)
}

void main()
