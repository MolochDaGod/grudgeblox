import { unpack } from 'msgpackr'
import { config } from '@shared/network/config.js'
import {
  ChatMessage,
  ClientMessage,
  ClientMessageType,
  InputMessage,
  ProximityPromptInteractMessage,
  SetPlayerNameMessage,
  WorldActionMessage,
} from '@shared/network/client/index.js'

export const MAX_CLIENT_MESSAGE_BYTES = 512

export type ClientMessageDecodeResult =
  | { ok: true; message: ClientMessage }
  | { ok: false; reason: string }

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isInputMessage(value: UnknownRecord): value is UnknownRecord & InputMessage {
  return (
    value.t === ClientMessageType.INPUT &&
    typeof value.u === 'boolean' &&
    typeof value.d === 'boolean' &&
    typeof value.l === 'boolean' &&
    typeof value.r === 'boolean' &&
    typeof value.s === 'boolean' &&
    typeof value.i === 'boolean' &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y)
  )
}

function isChatMessage(value: UnknownRecord): value is UnknownRecord & ChatMessage {
  return (
    value.t === ClientMessageType.CHAT_MESSAGE &&
    typeof value.content === 'string' &&
    value.content.trim().length > 0 &&
    value.content.length <= config.MAX_MESSAGE_CONTENT_LENGTH
  )
}

function isProximityMessage(
  value: UnknownRecord
): value is UnknownRecord & ProximityPromptInteractMessage {
  return (
    value.t === ClientMessageType.PROXIMITY_PROMPT_INTERACT &&
    Number.isSafeInteger(value.eId) &&
    Number(value.eId) > 0
  )
}

function isSetPlayerNameMessage(value: UnknownRecord): value is UnknownRecord & SetPlayerNameMessage {
  return (
    value.t === ClientMessageType.SET_PLAYER_NAME &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    value.name.length <= 64
  )
}

function isWorldActionMessage(value: UnknownRecord): value is UnknownRecord & WorldActionMessage {
  return (
    value.t === ClientMessageType.WORLD_ACTION &&
    typeof value.action === 'string' &&
    /^[a-z0-9:_-]{1,40}$/.test(value.action.trim().toLowerCase())
  )
}

export function validateClientMessage(value: unknown): ClientMessageDecodeResult {
  if (!isRecord(value) || !Number.isInteger(value.t)) {
    return { ok: false, reason: 'message must be an object with an integer type' }
  }

  switch (value.t) {
    case ClientMessageType.INPUT:
      return isInputMessage(value)
        ? { ok: true, message: value }
        : { ok: false, reason: 'invalid input message schema' }
    case ClientMessageType.CHAT_MESSAGE:
      return isChatMessage(value)
        ? { ok: true, message: value }
        : { ok: false, reason: 'invalid chat message schema' }
    case ClientMessageType.PROXIMITY_PROMPT_INTERACT:
      return isProximityMessage(value)
        ? { ok: true, message: value }
        : { ok: false, reason: 'invalid proximity message schema' }
    case ClientMessageType.SET_PLAYER_NAME:
      return isSetPlayerNameMessage(value)
        ? { ok: true, message: value }
        : { ok: false, reason: 'invalid player-name message schema' }
    case ClientMessageType.WORLD_ACTION:
      return isWorldActionMessage(value)
        ? { ok: true, message: value }
        : { ok: false, reason: 'invalid world-action message schema' }
    default:
      return { ok: false, reason: 'unsupported message type' }
  }
}

export function decodeClientMessage(payload: ArrayBuffer | Uint8Array): ClientMessageDecodeResult {
  const bytes = Buffer.from(new Uint8Array(payload))
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_CLIENT_MESSAGE_BYTES) {
    return { ok: false, reason: 'message payload size is outside the allowed range' }
  }

  try {
    return validateClientMessage(unpack(bytes))
  } catch {
    return { ok: false, reason: 'message is not valid msgpack' }
  }
}
