import 'dotenv/config'
import { resolve } from 'path'
import { pathToFileURL } from 'url'
import { startGameRuntime } from './index.js'

// This isn't a true "sandbox", not secured if player's can create their own scripts.
// isolation could be done with this : https://github.com/sebastianwessel/quickjs maybe.
async function loadGameLogic() {
  // Production default: GTA-like metaverse lobby (cars, districts, thugs)
  const gameScript = process.env.GAME_SCRIPT ?? 'gtaLobbyScript.ts'
  const codePath = resolve(import.meta.dirname, 'scripts', gameScript)
  if (!process.env.GAME_SCRIPT) console.log('No GAME_SCRIPT provided, using default script')
  console.log(`Loading game logic from ${codePath}`)
  await import(pathToFileURL(codePath).href)
}

async function main() {
  // Bind /health before loading worlds so Railway/Docker probes succeed.
  await startGameRuntime()
  // Yield so the first health probes can complete before tsx compiles the world script.
  await new Promise((resolve) => setTimeout(resolve, 500))
  try {
    await loadGameLogic()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Game logic failed to load; keeping /health and WebSocket alive: ${message}`)
  }
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection (server stays up):', reason)
})

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Listen failed: ${message}`)
  process.exit(1)
})
