import 'dotenv/config'
import { resolve } from 'path'
import { pathToFileURL } from 'url'

async function loadGameLogic() {
  // Production default: GTA-like metaverse lobby (cars, districts, thugs)
  const gameScript = process.env.GAME_SCRIPT ?? 'gtaLobbyScript.ts'
  const codePath = resolve(import.meta.dirname, 'scripts', gameScript)
  if (!process.env.GAME_SCRIPT) console.log('No GAME_SCRIPT provided, using default script')
  console.log(`Loading game logic from ${codePath}`)
  await import(pathToFileURL(codePath).href)
}

async function runGame() {
  const { startGameRuntime } = await import('./index.js')
  await startGameRuntime()
  await new Promise((resolve) => setTimeout(resolve, 250))
  try {
    await loadGameLogic()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Game logic failed to load; keeping /health alive: ${message}`)
  }
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection (server stays up):', reason)
})

async function main() {
  try {
    await runGame()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Listen failed: ${message}`)
    process.exit(1)
  }
}

void main()
