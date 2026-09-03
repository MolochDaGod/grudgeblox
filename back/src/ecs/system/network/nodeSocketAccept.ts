import type { IncomingMessage } from 'node:http'
import type { WebSocket as NodeWebSocket } from 'ws'

type NodeSocketAcceptor = (socket: NodeWebSocket, req: IncomingMessage) => void

let acceptor: NodeSocketAcceptor | undefined
const pending: Array<[NodeWebSocket, IncomingMessage]> = []

export function deliverNodeSocket(socket: NodeWebSocket, req: IncomingMessage) {
  if (acceptor) {
    acceptor(socket, req)
    return
  }
  pending.push([socket, req])
}

export function setNodeSocketAcceptor(next?: NodeSocketAcceptor) {
  acceptor = next
  if (!next) return
  while (pending.length) {
    const item = pending.shift()
    if (item) next(item[0], item[1])
  }
}
