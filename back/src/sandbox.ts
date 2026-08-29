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
  await loadGameLogic()
  await startGameRuntime()
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Startup failed: ${message}`)
  process.exit(1)
})
