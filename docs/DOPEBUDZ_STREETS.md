# Dope Budz Streets

GTA-like third-person shooting and driving on the GrudgeBlox stack.

## Runtime decision

The **integrated GrudgeBlox ECS instance is the primary runtime** for the current web client:

- Client route: `/play/streets`
- Main server: `GAME_SCRIPT=dopebudzStreets.ts`
- Production world port: `8005` (container port `8001`)
- Protocol: the existing compressed msgpack ECS snapshots used by every GrudgeBlox world

The `dopebudz-streets/` Railway service remains a **separate, optional JSON compatibility instance**. It must use a distinct URL and must not be substituted for the ECS endpoint because the current GrudgeBlox client does not speak its JSON protocol. Keeping it separate avoids two authorities claiming the same players, lots, and combat state.

## Integrated ECS functionality

The main world now provides session-authoritative:

- 18 claimable lots with BUDZ/SOL session balances and owner labels
- grow benches with plant, timed-ready, and harvest states
- terminal-route jobs with completion rewards and reputation
- player status, owned-lot, and current-job HUD queries
- disconnect cleanup for session lots and grow benches
- the existing districts, roads, cars, crews, jump pad, weapon skills, and proximity prompts

Defaults can be extended without replacing existing configuration:

```text
DOPEBUDZ_ASSETS_URL=<optional asset base>
DOPEBUDZ_STARTING_BUDZ=500
DOPEBUDZ_STARTING_SOL=1.5
DOPEBUDZ_GROW_COST=20
DOPEBUDZ_GROW_REWARD=80
DOPEBUDZ_GROW_SECONDS=45
DOPEBUDZ_SKIP_EXTERNAL_MAP=true  # optional local/offline flat fallback
DOPEBUDZ_SKIP_EXTERNAL_ASSETS=true  # isolated-server fallback; also replaces remote-mesh cars/crews with markers
```

Both skip flags are opt-in diagnostics. Production behavior and the existing asset URLs remain unchanged unless an administrator explicitly sets one.

State is currently session-only. Durable identity, balances, ownership, and missions require an owner-selected persistence service before deployment.

## JSON compatibility instance (Railway)

`dopebudz-streets/` is a separately deployable 20Hz JSON WebSocket authority:

- Protocol: `dopebudz-json-v1` — JSON `hello` / `pose` / `shot` / `plot` / `snapshot` / `ping`
- Tick: `GAME_TICKRATE` (default 20, GrudgeBlox default)
- Health: `GET /health`
- Metadata and limits: `GET /meta`
- Optional origin, payload, connection, and message-rate limits through `.env.example`

**Railway:** use root directory `dopebudz-streets`, Dockerfile, and `railway.toml`. Railway injects `PORT`. Only a compatible JSON client should use this service; the current GrudgeBlox web client remains pointed at the integrated ECS world.

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
