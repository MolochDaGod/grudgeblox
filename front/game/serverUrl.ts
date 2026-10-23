import { FLEET } from '@/lib/fleetConfig'

const DEFAULT_LOCAL_SERVER_PORT = 8001
const DEFAULT_RAILWAY_WSS = FLEET.ws

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  )
}

/**
 * Resolve a world's WebSocket endpoint.
 *
 * Local: one backend on 8001 (or an explicit port in the env URL).
 * Production (wss, Railway / custom domain): TLS is on 443. Do **not** append
 * docker-compose world ports 8001–8005 — that times out on Railway.
 * An explicit port in NEXT_PUBLIC_SERVER_URL always wins.
 */
export function resolveWebSocketServerUrl(
  baseUrl: string | undefined,
  worldPort: number,
  roomUrl?: string
): string {
  const override = roomUrl?.trim()
  if (override) {
    const url = new URL(override)
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
      throw new Error('Room websocketUrl must use ws:// or wss://')
    }
    return url.toString().replace(/\/$/, '')
  }

  const raw = (baseUrl && baseUrl.trim()) || (typeof window === 'undefined' ? 'ws://127.0.0.1' : DEFAULT_RAILWAY_WSS)
  const normalizedBaseUrl = raw.replace(/\/$/, '')
  const url = new URL(normalizedBaseUrl)

  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new Error('NEXT_PUBLIC_SERVER_URL must use ws:// or wss://')
  }

  if (url.port) return url.toString().replace(/\/$/, '')

  if (isLoopbackHost(url.hostname)) {
    url.port = String(worldPort || DEFAULT_LOCAL_SERVER_PORT)
    return url.toString().replace(/\/$/, '')
  }

  if (url.protocol === 'wss:') {
    return url.toString().replace(/\/$/, '')
  }

  url.port = String(worldPort || DEFAULT_LOCAL_SERVER_PORT)
  return url.toString().replace(/\/$/, '')
}
