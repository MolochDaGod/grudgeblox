import { ClientMessage, ClientMessageType } from './base.js'

export interface SetPlayerNameMessage extends ClientMessage {
  t: ClientMessageType.SET_PLAYER_NAME
  name: string
  /** Fleet appearance — replicated on PlayerComponent so every era can share a sandbox. */
  raceId?: string
  classId?: string
  characterId?: string
  model3d?: string
  gameEra?: string
}
