import type { Socket } from 'node:net'

export type PublicUpgradeHandler = (socket: Socket, chunk: Buffer) => boolean

let handler: PublicUpgradeHandler | undefined

export function setPublicUpgradeHandler(next?: PublicUpgradeHandler) {
  handler = next
}

export function hasPublicUpgradeHandler(): boolean {
  return typeof handler === 'function'
}

export function tryPublicUpgrade(socket: Socket, chunk: Buffer): boolean {
  return handler ? handler(socket, chunk) : false
}
