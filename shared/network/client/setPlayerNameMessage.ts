import { ClientMessage, ClientMessageType } from './base.js'

export interface SetPlayerNameMessage extends ClientMessage {
  t: ClientMessageType.SET_PLAYER_NAME
  name: string
  /** 4character / fleet appearance — replicated on PlayerComponent */
  raceId?: string
  classId?: string
  characterId?: string
  model3d?: string
}
