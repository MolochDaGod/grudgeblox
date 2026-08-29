import { ClientMessage } from './base'

/**
 * A small, game-script-owned action sent by an in-world control.
 *
 * The server validates the action name before adding it to the ECS event queue.
 * Individual game scripts decide which actions they support.
 */
export interface WorldActionMessage extends ClientMessage {
  action: string
}
