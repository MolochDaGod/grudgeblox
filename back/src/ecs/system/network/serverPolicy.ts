import { timingSafeEqual } from 'node:crypto'

const DEFAULT_LOCAL_ORIGINS = ['http://127.0.0.1:4000', 'http://localhost:4000']

export type HealthPayload = {
  status: 'starting' | 'ok'
  ready: boolean
  uptime: number
  game: {
    script: string
    tickrate: number
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

  if (isProduction && configuredOrigins.length === 0) {
    throw new Error('Production requires ALLOWED_ORIGINS or FRONTEND_URL')
  }

  const origins = configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_LOCAL_ORIGINS
  return new Set(origins.map(normalizeOrigin))
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
  uptime = process.uptime()
): HealthPayload {
  return {
    status: ready ? 'ok' : 'starting',
    ready,
    uptime,
    game: {
      script,
      tickrate,
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
