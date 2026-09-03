/**
 * Island sandbox — Super Terrain / Island Engine live room.
 *
 * GAME_SCRIPT=islandSandboxScript.ts
 * ISLAND_MAP=harbor-atoll|…|all
 */
import { startIslandLiveRuntime } from './islandLiveRuntime.js'

const map = (process.env.ISLAND_MAP || 'harbor-atoll').trim()
startIslandLiveRuntime({
  map,
  besideCity: false,
})
