# Super Terrain → live sandbox deployment

GrudgeBlox turns [vibe-stack/super-terrain](https://github.com/vibe-stack/super-terrain) (and Island Terrain World Engine) into **one WebSocket process per island/map**. The lobby is split into **Eras**, **Islands**, and **Maps**. Every sandbox loads all five era generations.

## Pipeline

```
Super Terrain editor (WebGPU, 4 km mesh, 128 m sections)
        │  Godot zip / meshterrain-world.json / height grid
        ▼
grudge-island-bake/v1   (Rapier heightfield + client mesh)
        │  pnpm run bake:islands
        ▼
GAME_SCRIPT=islandSandboxScript.ts  ISLAND_MAP=<id>
        │  one Docker/Railway service per slug
        ▼
/play/island-<id>   all-era live sandbox
```

Super Terrain meshes can include overhangs and tunnels. Rapier heightfields cannot. The bake either rasterizes vertex Y onto a grid or fills a catalog island (`alpine-mesh`, `granite-csg`, `spline-forest`, `tunnel-cavern`).

```bash
# Catalog bakes (deterministic)
pnpm run bake:islands

# Prefer live Super Terrain / Island Engine exports
SUPER_TERRAIN_ROOT=/path/to/godot-export \
ISLAND_ENGINE_ROOT=/path/to/Island-Terrain-World-Engine \
  pnpm run bake:islands
```

Point the folder at `source/meshterrain-world.json`, `exports/`, or a `grudge-island-bake/v1` file.

## Lobby sections

| Section | Route | What it is |
|---------|-------|------------|
| Eras | `/eras`, `/eras/{voxel,warlords,nexus,armada,game}` | Five numbered generations. Each deep-links into a home island with `?era=` |
| Islands | `/islands` | Seven live terrain rooms (ports 8006–8012) |
| Maps | `/maps` | Test, combat, lobby, GRUDOX, Streets (ports 8001–8005) |

## Rooms (one process each)

| Slug | Script | Env | Host port |
|------|--------|-----|-----------|
| `test` | `gtaLobbyScript.ts` | | 8001 |
| `combat` | `parkourScript.ts` | | 8002 |
| `lobby` | `gtaLobbyScript.ts` | | 8003 |
| `grudox` | `gtaLobbyScript.ts` | | 8004 |
| `streets` | `dopebudzStreets.ts` | | 8005 |
| `island` / `island-harbor-atoll` | `islandSandboxScript.ts` | `ISLAND_MAP=harbor-atoll` | 8006 |
| `island-volcanic-ridge` | same | `volcanic-ridge` | 8007 |
| `island-frozen-fjord` | same | `frozen-fjord` | 8008 |
| `island-alpine-mesh` | same | `alpine-mesh` | 8009 |
| `island-granite-csg` | same | `granite-csg` | 8010 |
| `island-spline-forest` | same | `spline-forest` | 8011 |
| `island-tunnel-cavern` | same | `tunnel-cavern` | 8012 |

SSOT: `shared/maps/sandboxRooms.ts` + `front/public/gameData.json`.

## Local multi-room

```bash
# Front: omit the port so each /play/{slug} uses its world port
# front/.env.local
NEXT_PUBLIC_SERVER_URL=ws://127.0.0.1

docker compose -f docker-compose.sandboxes.yml up -d --build
```

Health includes the island id when set:

```bash
curl -s http://127.0.0.1:8009/health
# { "game": { "script": "islandSandboxScript.ts", "map": "alpine-mesh", ... } }
```

A single `NEXT_PUBLIC_SERVER_URL=ws://127.0.0.1:8001` sends **every** world to one backend. Use that only when you are running one script.

## Production (Railway / VPS)

One service per live sandbox:

```
GAME_SCRIPT=islandSandboxScript.ts
ISLAND_MAP=alpine-mesh
GAME_TICKRATE=20
FRONTEND_URL=https://blox.grudge-studio.com
```

Then either:

1. Put a dedicated hostname in front (`wss://alpine.blox-game.grudge-studio.com`) and set `websocketUrl` on that game in `gameData.json`, or
2. Keep one shared `NEXT_PUBLIC_SERVER_URL` **only** if you still run a single room.

VPS with the compose file + Caddy (example):

```
alpine.blox-game.grudge-studio.com {
  reverse_proxy localhost:8009
}
```

Do not append compose ports onto a Railway `wss://…railway.app` URL. TLS is on 443.

## Front (Vercel)

- Project root `front/`
- `NEXT_PUBLIC_SERVER_URL=wss://blox-game.grudge-studio.com` for a single production room
- Per-room: set `websocketUrl` on each `gameData.json` entry
