/**
 * Parent <-> game-worker IPC. The public process never loads Rapier;
 * it hands accepted upgrade sockets to the child with sendHandle.
 */
import type { ChildProcess } from 'node:child_process'
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http'
import type { Socket } from 'node:net'

export const GAME_IPC_READY = 'ready' as const
export const GAME_IPC_UPGRADE = 'upgrade' as const

export type GameReadyMessage = { type: typeof GAME_IPC_READY }

export type GameUpgradeMessage = {
  type: typeof GAME_IPC_UPGRADE
  headers: IncomingHttpHeaders
  method?: string
  url?: string
  httpVersion?: string
  remoteAddress?: string
  head: string
}

export function isReadyMessage(value: unknown): value is GameReadyMessage {
  return Boolean(value && typeof value === 'object' && (value as GameReadyMessage).type === GAME_IPC_READY)
}

export function isUpgradeMessage(value: unknown): value is GameUpgradeMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as GameUpgradeMessage
  return message.type === GAME_IPC_UPGRADE && typeof message.head === 'string' && Boolean(message.headers)
}

export function serializeUpgrade(req: IncomingMessage, head: Buffer): GameUpgradeMessage {
  return {
    type: GAME_IPC_UPGRADE,
    headers: req.headers,
    method: req.method,
    url: req.url,
    httpVersion: req.httpVersion,
    remoteAddress: req.socket.remoteAddress,
    head: head.toString('base64'),
  }
}

export function decodeUpgradeHead(message: GameUpgradeMessage): Buffer {
  return Buffer.from(message.head || '', 'base64')
}

export function handOffUpgrade(
  child: ChildProcess,
  req: IncomingMessage,
  socket: Socket,
  head: Buffer
): boolean {
  if (!child.connected) return false
  try {
    return child.send(serializeUpgrade(req, head), socket)
  } catch {
    return false
  }
}
