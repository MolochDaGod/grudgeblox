# GrudgeBlox

**Modular WebSocket game-server kit for Grudge Studio multiplayer games.**

GrudgeBlox provides a shared ECS (Entity-Component-System) runtime with real-time physics, networking, and pluggable game scripts. Game servers run on Railway; web clients are Next.js SPAs deployed to Vercel. This kit powers Warlords, Nemesis, Armada, and other studio titles.

---

## What GrudgeBlox IS

- **Game Server Runtime**: Node.js WebSocket authority using [uWebSockets.js](https://github.com/uNetworking/uWebSockets.js), [Rapier3D](https://rapier.rs/) physics, and Three.js GLTF loaders
- **Modular Game Scripts**: Each game is a TypeScript file in `back/src/scripts/` that defines worlds, entities, and behaviors
- **Shared ECS Architecture**: Entity-Component-System design with `@notblox/shared` code reused by both server and client
- **Monorepo**: `pnpm` workspace with `shared/`, `back/`, and `front/` packages

---

## Repository Structure

```
grudgeblox/
├── shared/           # Shared ECS code (entities, components, network protocol)
├── back/             # Game server (Node.js + uWebSockets.js + Rapier)
│   └── src/
│       ├── scripts/  # Game world scripts (THIS IS WHERE YOU ADD NEW GAMES)
│       │   ├── gtaLobbyScript.ts      # Default GTA-style lobby (cars, districts)
│       │   ├── dopebudzStreets.ts     # Dope Budz Streets world
│       │   ├── parkourScript.ts       # Parkour obby
│       │   ├── footballScript.ts      # Football game
│       │   ├── petSimulatorScript.ts  # Pet simulator
│       │   └── defaultScript.ts       # Minimal test world
│       └── ecs/      # Server-side systems (physics, network, AI)
├── front/            # Next.js web client (Three.js renderer, input)
├── dopebudz-streets/ # Standalone Railway deployment (example)
└── docker-compose.yml # Multi-instance game server setup
```

---

## How Studio Games Plug In

### Adding a New Game Server

1. **Create a new script** in `back/src/scripts/yourGame.ts`
2. **Define your world** using the ECS entities:
   ```typescript
   import { MapWorld } from '../ecs/entity/MapWorld.js'
   import { Car } from '../ecs/entity/Car.js'
   import { Cube } from '../ecs/entity/Cube.js'
   
   // Load map GLTF
   new MapWorld('https://assets.grudge-studio.com/models/yourMap.glb')
   
   // Add entities
   new Cube({
     position: { x: 0, y: 1, z: 0 },
     size: { width: 2, height: 2, depth: 2 },
     color: '#ff6347'
   })
   ```
3. **Run with `GAME_SCRIPT=yourGame.ts`** (see "Running Locally" below)

### Available ECS Entities

- `MapWorld` – GLTF map with collision mesh
- `Player` – Network-controlled player capsule (created automatically on connect)
- `Cube`, `Sphere`, `Mesh` – Physics-enabled primitives
- `Car` – Drivable vehicle with raycast wheels
- `TriggerCube` – Invisible collision volumes (jump pads, teleports)
- `FloatingText` – 3D billboard text
- `Chat` – Global chat system (singleton)

See `back/src/ecs/entity/` for full entity catalog.

---

## Architecture

### Rooms & Sessions

- **One WebSocket server = one game room**
- **No built-in matchmaking** – each server is a single persistent session
- Deploy multiple servers (via `docker-compose.yml` ports or separate Railway services) for multiple rooms
- Players join by connecting to `wss://your-server.railway.app` (or `ws://localhost:8001` in dev)

### Authentication & Identity

**GrudgeID** (id.grudge-studio.com) is the studio SSO, integrated via Railway `grudge-api`:

- Frontend exchanges GrudgeID token with `grudge-api` to fetch character data
- Character roster stored in **Railway Postgres** (via `grudge-api`), NOT Neon
- See `front/lib/fleetConfig.ts` for auth helpers (`getAuthToken()`, `buildLoginUrl()`)

**Current State:**
- Player SSOT is Railway `grudge-api` (character metadata, era, race)
- Game servers do NOT enforce auth (players set display name on connect via `SetPlayerNameMessage`)
- Token validation is client-side only (frontend fetches character before entering game)

**NOT Implemented:**
- Server-side token verification
- Puter ID integration (no Puter code in this repo)
- Crossmint wallet locators (no Crossmint code in this repo)
- Phantom signer integration (not used by GrudgeBlox game servers)

### Wallet & Currency (GBuX)

**GBuX** is a Solana SPL token:
- **Mint**: `55TpSoMNxbfsNJ9U1dQoo9H3dRtDmjBZVMcKqvU2nray`
- **Decimals**: 6

**Current State:**
- **No on-chain integration in this codebase**
- In-game credits are separate from SPL balance (handled by `grudge-api`)
- Official exchange rate (0.001 sell-into-credit) is NOT implemented here
- Poker buy-in paths are out of scope for GrudgeBlox

If you need to implement on-chain GBuX transfers, that logic belongs in `grudge-api` or a separate service, NOT in GrudgeBlox game servers.

---

## Running Locally

### Prerequisites

- **Node.js** ≥24
- **pnpm** (install: `npm i -g pnpm`)

### Install Dependencies

```bash
pnpm install
```

### Run All Services (Dev Mode)

```bash
# Terminal 1: Shared package (watch mode)
pnpm run dev:shared

# Terminal 2: Game server (default script on port 8001)
pnpm run dev:back

# Terminal 3: Web client (Next.js on port 4000)
pnpm run dev:front
```

### Run a Specific Game Script

```bash
cd back
GAME_SCRIPT=gtaLobbyScript.ts pnpm run dev
```

### Available Scripts

- `gtaLobbyScript.ts` – GTA-style city lobby (cars, districts, NPCs)
- `dopebudzStreets.ts` – Dope Budz Streets world
- `parkourScript.ts` – Parkour obby course
- `footballScript.ts` – Football field
- `petSimulatorScript.ts` – Pet collection game
- `defaultScript.ts` – Minimal test world

### Environment Variables

**Backend (`back/.env`):**
```bash
NODE_ENV=development           # or production (auto-detects Railway)
GAME_SCRIPT=gtaLobbyScript.ts  # Which game to run
GAME_TICKRATE=20               # Server tick rate (Hz)
PORT=8001                      # Local dev port (Railway injects its own PORT)
FRONTEND_URL=                  # CORS origin (optional, dev allows all)
```

**🚂 Railway Auto-Detection**:
- Code automatically detects Railway via `RAILWAY_ENVIRONMENT_NAME`, `RAILWAY_ENVIRONMENT_ID`, or `RAILWAY_SERVICE_ID`
- On Railway: Always uses plain HTTP `App()` (Railway proxy handles TLS)
- Listens on `process.env.PORT` (Railway-injected) or falls back to 8001 (local/VPS)
- **You can use any `NODE_ENV` on Railway** — SSL is disabled when Railway is detected

**⚠️ NODE_ENV=production (VPS Only)**:
- Enables `SSLApp` with Let's Encrypt certificates (VPS with mounted certs only)
- Requires `SSL_KEY_FILE` and `SSL_CERT_FILE` env vars or defaults to `/etc/letsencrypt/live/npm-3/`
- **Railway automatically bypasses SSLApp** even if `NODE_ENV=production`

**Frontend (`front/.env.local`):**
```bash
NEXT_PUBLIC_SERVER_URL=ws://localhost:8001  # WebSocket URL (dev)
# NEXT_PUBLIC_SERVER_URL=wss://your-server.railway.app  # (prod)
```

### Health Check

```bash
curl http://localhost:8001/health
```

Returns:
```json
{
  "status": "ok",
  "timestamp": "2026-08-27T19:57:00.000Z",
  "uptime": 123.456,
  "game": {
    "script": "gtaLobbyScript.ts",
    "tickrate": 20
  },
  "players": ["Alice", "Bob"],
  "messages": { ... }
}
```

---

## Deploying to Production

### Game Servers (Railway)

**Dock owns Railway/VPS game server deployments.**

1. **Create a Railway service** from this repo
2. **Set root directory** (optional):
   - Default: `back/` (use Dockerfile in repo root)
   - Standalone: `dopebudz-streets/` (see example)
3. **Environment variables**:
   ```
   GAME_SCRIPT=gtaLobbyScript.ts
   GAME_TICKRATE=20
   NODE_ENV=production               # Safe on Railway (auto-detects)
   FRONTEND_URL=https://your-vercel-client.com
   ```
   **Note**: Railway automatically injects `PORT` — do not set it manually.

4. **🚂 Railway Auto-Detection**:
   - Code detects Railway via `RAILWAY_ENVIRONMENT_NAME`, `RAILWAY_ENVIRONMENT_ID`, or `RAILWAY_SERVICE_ID`
   - Automatically uses plain HTTP `App()` on Railway (proxy handles TLS)
   - Listens on Railway-injected `PORT` automatically
   - **NODE_ENV=production is safe on Railway** (SSL bypassed when Railway detected)

5. **Health check**: Railway reads `/health` endpoint (configure in Railway dashboard or `railway.toml`)

6. **Multiple rooms**: Deploy separate Railway services or use `docker-compose.yml` for multi-instance VPS

#### Dockerfile Deployment

The repo includes a `Dockerfile` that builds the entire monorepo. To deploy:

```bash
docker build -t grudgeblox-server .
docker run -p 8001:8001 -e GAME_SCRIPT=gtaLobbyScript.ts grudgeblox-server
```

Railway will auto-detect the Dockerfile.

#### Docker Compose (Multi-Instance VPS Only)

For running multiple game servers on one VPS with nginx/Caddy TLS termination:

```bash
docker-compose up -d
```

This starts:
- `game_test_server` (port 8001, `defaultScript.ts`)
- `game_obby_parkour` (port 8002, `parkourScript.ts`)
- `game_football` (port 8003, `footballScript.ts`)
- `game_pet_simulator` (port 8004, `petSimulatorScript.ts`)
- `game_dopebudz_streets` (port 8005, `dopebudzStreets.ts`)

Each service listens on `http://localhost:PORT`. Put nginx/Caddy in front for TLS termination.

**Note**: Ports 8001-8005 are hardcoded in `docker-compose.yml`. For Railway, the platform injects `PORT` dynamically.

### Web Client (Vercel)

**Gate owns Vercel client deployments.**

1. **Vercel project root**: `front/`
2. **Build command**: `pnpm run build-vercel` (builds `shared` → `front`)
3. **Environment variable**:
   ```
   NEXT_PUBLIC_SERVER_URL=wss://your-game-server.railway.app
   ```
4. **Rewrites** (optional, in `vercel.json`):
   - `/api/characters` → Railway `grudge-api` (for character roster)

**Important**: Vercel is NOT the game server host. Vercel only serves the Next.js client. Game servers run on Railway or VPS.

---

## Network Protocol

### WebSocket

- **Transport**: uWebSockets.js (binary, compression enabled)
- **Serialization**: [msgpackr](https://github.com/kriszyp/msgpackr) + [pako](https://github.com/nodeca/pako) (deflate)
- **Tick Rate**: 20 Hz default (configurable via `GAME_TICKRATE`)

### Message Types

**Client → Server** (`shared/network/client/`):
- `INPUT` – Movement keys + camera angle
- `CHAT_MESSAGE` – Chat text
- `SET_PLAYER_NAME` – Display name on join
- `PROXIMITY_PROMPT_INTERACT` – "Press E" interactions

**Server → Client** (`shared/network/server/`):
- `FIRST_CONNECTION` – Initial handshake (assigns entity ID, sends tick rate)
- `SNAPSHOT` – Delta or full world state (entities + components)

### Bandwidth Optimization

- **Delta snapshots**: Only sends changed components (except first snapshot)
- **Component dirty flags**: `updated` field marks changes
- **Compression**: msgpackr + pako deflate (~3x reduction)
- **Rate limiting**: 10 messages/sec per IP

---

## ECS Design

GrudgeBlox uses an **Entity-Component-System** architecture:

### Entities

Entities are just IDs. All logic lives in **components** and **systems**.

Example entity creation:
```typescript
const cube = new Cube({
  position: { x: 0, y: 10, z: 0 },
  size: { width: 2, height: 2, depth: 2 },
  color: '#ff6347'
})
```

This internally:
1. Creates an entity with a unique ID
2. Adds `PositionComponent`, `SizeComponent`, `ColorComponent`
3. Adds physics components (`DynamicRigidBodyComponent`, `BoxColliderComponent`)
4. Registers with `EntityManager`

### Components

Components are pure data (no logic). See `shared/component/`:

- **Transform**: `PositionComponent`, `RotationComponent`, `SizeComponent`
- **Physics**: `DynamicRigidBodyComponent`, `KinematicRigidBodyComponent`, `ColliderComponent`
- **Network**: `NetworkDataComponent` (serialization), `WebSocketComponent` (player connection)
- **Gameplay**: `PlayerComponent`, `VehicleComponent`, `ProximityPromptComponent`
- **Visual**: `ColorComponent`, `TextComponent`, `ServerMeshComponent`

### Systems

Systems process entities with specific component combinations. See `back/src/ecs/system/`:

- **Physics**: `PhysicsSystem`, `SyncPositionSystem`, `SyncRotationSystem`, `GroundedCheckSystem`
- **Gameplay**: `MovementSystem`, `VehicleSystem`, `ZombieSystem`, `FollowTargetSystem`
- **Network**: `NetworkSystem` (broadcasts snapshots), `InputProcessingSystem`
- **Events**: `ProximityPromptSystem`, `MessageEventSystem`, `DestroyEventSystem`

The game loop (`back/src/index.ts`) runs all systems every tick (50ms at 20Hz).

---

## How to Contribute / Improve It

### Module Layout

- **Don't fork for new games** – add scripts to `back/src/scripts/`
- **Don't invent L1 chains** – no "Grudachain RPC" exists; use Solana mainnet via `grudge-api` if needed
- **Keep shared code in `shared/`** – network protocol, components, and entities that both client/server use

### Adding a New System

1. Create `back/src/ecs/system/YourSystem.ts`:
   ```typescript
   import { Entity } from '@shared/entity/Entity.js'
   
   export class YourSystem {
     update(entities: Entity[], dt: number) {
       for (const entity of entities) {
         const yourComponent = entity.getComponent(YourComponent)
         if (yourComponent) {
           // Do something
         }
       }
     }
   }
   ```
2. Register in `back/src/index.ts`:
   ```typescript
   const yourSystem = new YourSystem()
   // Add to game loop
   yourSystem.update(entities, fixedTimestep)
   ```

### Adding a New Component

1. Create `shared/component/YourComponent.ts`:
   ```typescript
   import { Component } from './Component.js'
   
   export class YourComponent extends Component {
     constructor(entityId: number, public value: number) {
       super(entityId, 'YourComponent')
     }
   }
   ```
2. If networked, add serialization to `shared/network/NetworkDataComponent.ts`

### Adding a New Entity Type

1. Create `back/src/ecs/entity/YourEntity.ts`:
   ```typescript
   import { Entity } from '@shared/entity/Entity.js'
   
   export class YourEntity {
     entity: Entity
     
     constructor() {
       this.entity = new Entity()
       this.entity.addComponent(new YourComponent(...))
     }
   }
   ```
2. Use in game scripts: `new YourEntity()`

### File Organization

- `shared/` – Protocol, components, base entities (client + server)
- `back/src/ecs/` – Server-only ECS (physics, AI, authority)
- `back/src/scripts/` – **Game definitions** (THIS IS WHERE NEW GAMES GO)
- `front/game/ecs/` – Client-only ECS (rendering, input, interpolation)
- `front/components/` – React UI (HUD, menus, character select)

### What NOT to Fork

- **Physics engine**: Use Rapier3D via `back/src/physics/rapier.ts`
- **Network transport**: Use uWebSockets.js (don't replace with Socket.io, etc.)
- **Client framework**: Use Next.js + Three.js (this is the studio standard)
- **Auth provider**: Use GrudgeID + `grudge-api` (don't add Firebase, Clerk, etc.)

---

## Troubleshooting

### "Connection refused" on localhost

- Ensure game server is running: `pnpm run dev:back`
- Check port in `.env.local`: `NEXT_PUBLIC_SERVER_URL=ws://localhost:8001`
- Default port is 8001 (override with `PORT` env var)

### Physics objects falling through the map

- Ensure `MapWorld` GLTF has a collision mesh (`TrimeshColliderComponent` is async – map must load first)
- Check `back/src/ecs/system/physics/TrimeshColliderSystem.ts` – it waits for GLTF load

### Players can't move

- Server tick rate too low: increase `GAME_TICKRATE` (try 40-60)
- Check `MovementSystem` in game loop (it should be called after physics step)

### Lag or high draw calls

- See `PERFORMANCE.md` for Three.js optimization guide
- Reduce shadow-casting lights (prefer `DirectionalLight`, avoid `PointLight` shadows)
- Target <200 draw calls for web

### Game script not loading

- Check `GAME_SCRIPT` env var matches filename in `back/src/scripts/`
- Ensure TypeScript file has `.ts` extension in env var (not `.js`)
- Check server logs for import errors

---

## Related Repositories & Services

- **grudge-api** (Railway Postgres + Express): Character roster, account data, GBuX credit balances
- **id.grudge-studio.com**: GrudgeID SSO (Hitch owns)
- **assets.grudge-studio.com**: CDN for GLB models, textures (Grudge6 races, voxel kits)
- **Mine-Loader** (mine.grudge-studio.com): Voxel Realms lobby (separate product, shares character storage keys)
- **GRUDOX** (grudox.grudge-studio.com): Nexus multiplayer hub (separate product)

---

## Tech Stack

### Backend (`back/`)
- **Node.js** 24+
- **uWebSockets.js** – High-performance WebSocket server
- **Rapier3D** (`@dimforge/rapier3d-compat`) – Physics engine
- **Three.js** – GLTF loader (server-side, for collision meshes)
- **msgpackr** + **pako** – Binary serialization + compression
- **TypeScript** 5.7

### Frontend (`front/`)
- **Next.js** 15
- **React** 19
- **Three.js** – 3D renderer
- **msgpackr** + **pako** – Client-side protocol
- **Tailwind CSS** + **shadcn/ui** – UI components

### Shared (`shared/`)
- **TypeScript** – ECS types, network protocol

---

## License

MIT (see `LICENCE.md`)

---

## Team Contacts

- **Keel**: GrudgeID SSO (`id.grudge-studio.com`), Railway player API (`grudge-api`)
- **Hitch**: GitHub repository management
- **Dock**: Railway/VPS game server deployments
- **Gate**: Vercel client deployments
- **Muster**: Game scripts, prefabs, world design

For questions about this kit, ask in `#grudgeblox` or ping Dock.

---

## FAQ

### Can I use this for a non-Grudge Studio game?

Yes, it's MIT licensed. Fork it, rename the studio-specific stuff, and remove GrudgeID auth.

### Do I need a blockchain node?

No. GrudgeBlox game servers are off-chain. GBuX SPL balances are handled by `grudge-api` (which does talk to Solana). Game servers only track in-game credits.

### Can I run multiple rooms on one Railway service?

No. Deploy one Railway service per room/world. For multi-instance, use `docker-compose.yml` on a VPS with nginx/Caddy.

### Why is the repo called "notblox" in package.json?

Legacy name. GrudgeBlox is a fork/rebrand of Notblox (an open-source Roblox-like engine). The `@notblox/` package scope is kept for code stability.

### Where's the poker game?

Poker is out of scope for GrudgeBlox. It's a separate product with its own codebase.

### How do I add a new race (Grudge6)?

Add the GLB to `assets.grudge-studio.com`, then update `front/lib/fleetConfig.ts` `GRUDGE6_CDN` map. GrudgeBlox doesn't host assets; it only references CDN URLs.

### How does Railway deployment work?

- Code auto-detects Railway via `RAILWAY_ENVIRONMENT_NAME`, `RAILWAY_ENVIRONMENT_ID`, or `RAILWAY_SERVICE_ID` env vars
- Railway always injects these variables (plus `RAILWAY_PUBLIC_DOMAIN` and `PORT`)
- On Railway: uses plain HTTP `App()` behind Railway's TLS proxy (even if `NODE_ENV=production`)
- Listens on Railway's injected `PORT` automatically
- See `back/src/ecs/system/network/WebsocketSystem.ts` for detection logic

### Can I use a different physics engine?

Not recommended. Rapier3D is deeply integrated (see `back/src/ecs/system/physics/`). Replacing it would require rewriting 15+ systems.

### Is there a live demo?

- **Test lobby**: Ask Dock for current Railway URL
- **Dope Budz Streets**: Separate Railway deploy (ask Dock for URL)
- **Local dev**: Follow "Running Locally" section above

---

**Last Updated**: 2026-08-27 (by Cursor Cloud Agent)
