import 'dotenv/config'
import { resolve } from 'path'
import { pathToFileURL } from 'url'
import { runGameSupervisor, shouldSupervise } from './gameSupervisor.js'
import { serverLoadsGltfColliders } from './physics/colliderBudget.js'

async function loadGameLogic() {
  // Production default: GTA-like metaverse lobby (cars, districts, thugs)
  const gameScript = process.env.GAME_SCRIPT ?? 'gtaLobbyScript.ts'
  const codePath = resolve(import.meta.dirname, 'scripts', gameScript)
  if (!process.env.GAME_SCRIPT) console.log('No GAME_SCRIPT provided, using default script')
  console.log(`Loading game logic from ${codePath}`)
  await import(pathToFileURL(codePath).href)
}

async function bindGameSocket() {
  const { NetworkSystem } = await import('./ecs/system/network/NetworkSystem.js')
  const network = new NetworkSystem()
  await network.waitUntilListening()
  network.markReady()
  return network
}

async function runGame() {
  const socket = process.env.GAME_SOCKET
  if (process.env.GAME_NO_LISTEN === '1') {
    console.log('[worker] no listen; WebSocket upgrades on the public Node net listener')
  } else {
    console.log(
      socket
        ? `[worker] bind unix ${socket}`
        : `[worker] bind ${process.env.LISTEN_HOST || 'default'}:${process.env.PORT ?? process.env.GAME_PORT}`
    )
  }
  const network = await bindGameSocket()
  console.log('[worker] socket bound; loading physics')
  try {
    if (serverLoadsGltfColliders()) {
      const { startGameRuntime } = await import('./index.js')
      await startGameRuntime(network)
    } else {
      const { startRailwayRuntime } = await import('./railwayRuntime.js')
      await startRailwayRuntime(network)
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
    await loadGameLogic()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Game logic failed to load; keeping the socket bound: ${message}`)
  }
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection (server stays up):', reason)
})

async function main() {
  if (shouldSupervise()) {
    console.log('SUPERVISOR : public /health isolated from the game worker')
    await runGameSupervisor(runGame)
    return
  }

  try {
    await runGame()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Listen failed: ${message}`)
    process.exit(1)
  }
}

void main()
