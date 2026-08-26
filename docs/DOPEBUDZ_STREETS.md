# Dope Budz Streets

GTA-like third-person shooting and driving on the GrudgeBlox stack.

## Live server (Railway)

`dopebudz-streets/` (this folder’s sibling on GitHub) is a 20Hz WebSocket authority:

- Protocol: JSON `hello` / `pose` / `shot` / `plot` / `snapshot` (same as the web client `src/game/net.ts`)
- Tick: `GAME_TICKRATE` (default 20, GrudgeBlox default)
- Health: `GET /health`

**Railway:** new service from `MolochDaGod/grudgeblox`, root directory `dopebudz-streets`, Dockerfile + `railway.toml`. Set `PORT` (Railway injects it). Point the web client at `VITE_LIVE_WS=wss://<service>.up.railway.app`.

## ECS world (GrudgeBlox game server)

`back/src/scripts/dopebudzStreets.ts` is a `GAME_SCRIPT` using Car, Cube, Mesh, ProximityPrompt, ZombieComponent, NetworkComponent.

```
GAME_SCRIPT=dopebudzStreets.ts
GAME_TICKRATE=20
```

Docker Compose service `game_dopebudz_streets` maps host `8005 → 8001`. Front `gameData.json` slug `streets` points at that port.

## Cities

Grove City, Harbor Heights, Neon Strip, Mesa Flats, Fogtown, Little Beach — 18 deed lots (BUDZ or SOL), grow benches, street / sales / robbery terminals, Motor Row cars.

## Kits

Sidearm, SMG, Rifle, Gauge (keys 1–4). Third-person chase cam, F to drive (A left / D right).
