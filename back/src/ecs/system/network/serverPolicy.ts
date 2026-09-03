import { timingSafeEqual } from 'node:crypto'

/** Explicit GAME_SOCKET only. Railway rejected Unix sockets even in-process. */
export function resolveGameSocketPath(
  socket = process.env.GAME_SOCKET
): string | undefined {
  const value = socket?.trim()
  return value || undefined
}

const DEFAULT_LOCAL_ORIGINS = ['http://127.0.0.1:4000', 'http://localhost:4000']
const DEFAULT_LIVE_ORIGINS = [
  'https://blox.grudge-studio.com',
  'https://grudgeblox.vercel.app',
  'https://grudgeblox-grudgenexus.vercel.app',
  'https://blox-grudge-studio.vercel.app',
  'https://blox-grudge-studio-grudgenexus.vercel.app',
]

function coerceBrowserOrigin(raw: string): string {
  const value = raw.trim()
  if (value.startsWith('wss://')) return `https://${value.slice(6)}`
  if (value.startsWith('ws://')) return `http://${value.slice(5)}`
  return value
}

export function onRailwayRuntime(): boolean {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT_NAME ||
      process.env.RAILWAY_ENVIRONMENT_ID ||
      process.env.RAILWAY_SERVICE_ID
  )
}

/** Railway's proxy cannot reach a 127.0.0.1 bind even when NODE_ENV is unset. */
export function resolveServerListenHost(
  listenHost = process.env.LISTEN_HOST,
  nodeEnv = process.env.NODE_ENV,
  railway = onRailwayRuntime()
): string {
  if (listenHost) return listenHost
  if (railway || nodeEnv === 'production') return '0.0.0.0'
  return '127.0.0.1'
}

export type HealthPayload = {
  status: 'starting' | 'ok'
  ready: boolean
  uptime: number
  game: {
    script: string
    tickrate: number
    map?: string
  }
}

function normalizeOrigin(rawOrigin: string): string {
  const value = rawOrigin.trim()
  if (!value) throw new Error('Allowed origins cannot contain empty values')

  const url = new URL(value)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Allowed origin must use http or https: ${value}`)
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== '/')) {
    throw new Error(`Allowed origin must not contain credentials, a path, query, or fragment: ${value}`)
  }
  return url.origin
}

export function resolveAllowedOrigins(
  isProduction: boolean,
  allowedOrigins = process.env.ALLOWED_ORIGINS,
  legacyFrontendUrl = process.env.FRONTEND_URL
): ReadonlySet<string> {
  const configuredOrigins = [
    ...(allowedOrigins?.split(',') ?? []),
    ...(legacyFrontendUrl ? [legacyFrontendUrl] : []),
  ]
    .map((origin) => origin.trim())
    .filter(Boolean)

  const onRailway = onRailwayRuntime()

  if (isProduction && configuredOrigins.length === 0 && !onRailway) {
    throw new Error('Production requires ALLOWED_ORIGINS or FRONTEND_URL')
  }

  const origins =
    configuredOrigins.length > 0
      ? configuredOrigins
      : onRailway
        ? DEFAULT_LIVE_ORIGINS
        : DEFAULT_LOCAL_ORIGINS
  return new Set(origins.map((origin) => normalizeOrigin(coerceBrowserOrigin(origin))))
}

export function isWebSocketOriginAllowed(
  requestOrigin: string,
  isProduction: boolean,
  allowedOrigins: ReadonlySet<string>
): boolean {
  if (!requestOrigin) return !isProduction

  try {
    return allowedOrigins.has(normalizeOrigin(requestOrigin))
  } catch {
    return false
  }
}

export function buildHealthPayload(
  ready: boolean,
  script: string,
  tickrate: number,
  uptime = process.uptime(),
  map?: string
): HealthPayload {
  return {
    status: ready ? 'ok' : 'starting',
    ready,
    uptime,
    game: {
      script,
      tickrate,
      ...(map ? { map } : {}),
    },
  }
}

export function isAdminAuthorized(authorization: string, expectedToken: string | undefined): boolean {
  if (!expectedToken) return false

  const prefix = 'Bearer '
  if (!authorization.startsWith(prefix)) return false

  const suppliedToken = authorization.slice(prefix.length)
  const supplied = Buffer.from(suppliedToken)
  const expected = Buffer.from(expectedToken)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export function isHealthHttpRequest(head: string): boolean {
  const line = head.split(/\r?\n/, 1)[0] || ''
  return /^(GET|HEAD) \/health(\?| HTTP\/|$)/i.test(line)
}

export function readBoundedInteger(
  rawValue: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  if (rawValue === undefined || rawValue.trim() === '') return fallback
  const value = Number(rawValue)
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`Expected an integer between ${minimum} and ${maximum}`)
  }
  return value
}
