const DEFAULT_LOCAL_SERVER_PORT = 8001

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
 * A normal local run has one backend on port 8001, so an unported loopback URL
 * deliberately sends every world to that process. Non-loopback hosts retain
 * the per-world ports used by the production multi-instance deployment. An
 * explicit port in NEXT_PUBLIC_SERVER_URL always wins.
 */
export function resolveWebSocketServerUrl(baseUrl: string | undefined, worldPort: number): string {
  const normalizedBaseUrl = (baseUrl ?? 'ws://127.0.0.1').replace(/\/$/, '')
  const url = new URL(normalizedBaseUrl)

  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new Error('NEXT_PUBLIC_SERVER_URL must use ws:// or wss://')
  }

  if (url.port) return normalizedBaseUrl

  url.port = String(isLoopbackHost(url.hostname) ? DEFAULT_LOCAL_SERVER_PORT : worldPort)
  return url.toString().replace(/\/$/, '')
}
