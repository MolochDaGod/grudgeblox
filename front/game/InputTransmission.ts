import type { InputMessage } from '@shared/network/client/inputMessage'

const INPUT_KEYS = ['u', 'd', 'l', 'r', 's', 'i'] as const
const YAW_TOLERANCE = 0.001

/** Renderer frequency must not determine network traffic or acknowledge unsent input. */
export class InputTransmission {
  private previous: InputMessage | null = null
  private sentAt = -Infinity
  private epoch = -1

  previousFor(epoch: number): InputMessage | null {
    return this.epoch === epoch ? this.previous : null
  }

  shouldSend(input: InputMessage, now: number, tickRate: number, epoch: number): boolean {
    const previous = this.previousFor(epoch)
    if (!previous) return true
    if (INPUT_KEYS.some((key) => input[key] !== previous[key])) return true
    const yawDifference = Math.atan2(Math.sin(input.y - previous.y), Math.cos(input.y - previous.y))
    const rate = Number.isFinite(tickRate) && tickRate > 0 ? Math.min(60, tickRate) : 20
    return Math.abs(yawDifference) >= YAW_TOLERANCE && now - this.sentAt >= 1000 / rate
  }

  didSend(input: InputMessage, now: number, epoch: number): void {
    this.previous = { ...input }
    this.sentAt = now
    this.epoch = epoch
  }
}
