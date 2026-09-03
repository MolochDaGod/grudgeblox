# Island maps + all-era sandboxes

GrudgeBlox plays **baked** terrain from [Super Terrain](https://github.com/vibe-stack/super-terrain) and Island Terrain World Engine. **Every fleet era** enters the same sandbox. The lobby splits this into **Eras**, **Islands**, and **Maps**.

The **production live room** (`gtaLobbyScript.ts` on Railway) loads the city plate plus every catalog island east of spawn, with generative events, NPC AI (guides/scouts/wardens/raiders), and the island guide chat bot (`/help`, `/where`, `/npcs`, `/event`). `/play/island-*` sends `mapId` so you teleport onto that bake. `/play/test` stays in the city.

Dedicated rooms still use `GAME_SCRIPT=islandSandboxScript.ts` — see `docs/SANDBOX_DEPLOY.md`.

## Super Terrain

Repo: https://github.com/vibe-stack/super-terrain

Mesh Terrain Lab is a 4 km × 4 km WebGPU editor (128 m sections, sculpt layers, forest splines, granite CSG, tunnels). Export `source/meshterrain-world.json` (Godot zip) or a height grid. GrudgeBlox rasterizes vertex Y onto `grudge-island-bake/v1` or fills a catalog island:

| Id | Live slug | Port |
|----|-----------|------|
| `alpine-mesh` | `/play/island-alpine-mesh` | 8009 |
| `granite-csg` | `/play/island-granite-csg` | 8010 |
| `spline-forest` | `/play/island-spline-forest` | 8011 |
| `tunnel-cavern` | `/play/island-tunnel-cavern` | 8012 |

```bash
SUPER_TERRAIN_ROOT=/path/to/meshterrain-export pnpm run bake:islands
```

## Island Terrain World Engine

Local engine path:

`C:\Users\nugye\Documents\Island-Terrain-World-Engine2\Island-Terrain-World-Engine`

Export JSON as `grudge-island-bake/v1` into `exports/`, `bakes/`, `out/`, or `maps/` inside that folder.

```json
{
  "format": "grudge-island-bake/v1",
  "engine": "Island-Terrain-World-Engine",
  "id": "harbor-atoll",
  "title": "Harbor Atoll",
  "seed": 1847291,
  "size": 64,
  "cellSize": 4,
  "seaLevel": 0.2,
  "maxHeight": 22,
  "heights": [0, 12, 40],
  "biomes": [0, 2, 3],
  "spawns": [{ "x": 8, "y": 6, "z": -4, "label": "landing" }],
  "pois": [{ "kind": "dock", "x": 12, "y": 3, "z": 2, "label": "dock" }]
}
```

`heights` and `biomes` are row-major grids of `size * size`. Heights are 0–255 (quantized) or 0–1 / meters (auto-quantized on import). Nested `terrain.heightmap` 2D arrays are also accepted.

Catalog islands from this engine: `harbor-atoll` (8006), `volcanic-ridge` (8007), `frozen-fjord` (8008).

## Bake

```bash
# Generate catalog bakes (7 islands)
pnpm --filter @notblox/back exec tsx scripts/bakeIslands.ts

# Prefer live engine / Super Terrain exports when the folder is mounted
ISLAND_ENGINE_ROOT=/path/to/Island-Terrain-World-Engine \
SUPER_TERRAIN_ROOT=/path/to/super-terrain-export \
  pnpm --filter @notblox/back exec tsx scripts/bakeIslands.ts
```

Outputs land in `shared/maps/baked/*.json`. The game server loads those files, then falls back to the same deterministic generator if a bake is missing.

## Run the sandbox

```bash
GAME_SCRIPT=islandSandboxScript.ts ISLAND_MAP=alpine-mesh pnpm run dev:back
```

Maps: catalog ids above, or any id imported from the engines.

Client routes: `/play/island-{id}` (Harbor also at `/play/island`).

Physics uses a Rapier heightfield from the bake. The client rebuilds the colored terrain mesh from the same seed/catalog so collision and visuals stay aligned.

## All-era characters

Sandbox worlds set `rosterMode: "all-eras"`. Character select loads Voxel, Warlords, Nexus, Armada, and Game heroes (4 slots per era). Appearance replication accepts kit Mixamo paths and HTTPS GLBs on studio hosts (`assets.grudge-studio.com`, `grudgewarlords.com`, …).

Era pages (`/eras/warlords`) open a home island with `?era=warlords` so the roster tab starts on that generation.
