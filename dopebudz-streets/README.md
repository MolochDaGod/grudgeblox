# Dope Budz Streets — JSON compatibility server

Separately deployable 20Hz JSON WebSocket authority for legacy or lightweight **Dope Budz Streets** clients.

The current GrudgeBlox frontend uses the integrated msgpack ECS runtime at `GAME_SCRIPT=dopebudzStreets.ts`. Do not point `/play/streets` at this JSON service. Keep this instance on its own URL when a compatible client actually needs it.

## Railway

1. New Railway service from `MolochDaGod/grudgeblox`.
2. Root directory: `dopebudz-streets`.
3. Railway reads `Dockerfile` + `railway.toml`.
4. Set `GAME_TICKRATE=20` (40–60 if cars feel laggy, same as GrudgeBlox).
5. Configure `ALLOWED_ORIGINS` for the compatible client and give the instance a distinct public `wss://` URL.

Health: `GET /health`. Runtime role, protocol, capabilities, and limits: `GET /meta`.

## Protocol

Protocol `dopebudz-json-v1` preserves `hello`, `pose`, `shot`, `plot`, and `snapshot`, and adds bounded errors and `ping`/`pong`. It is not the GrudgeBlox ECS msgpack protocol.

## ECS path

The full GrudgeBlox world is `back/src/scripts/dopebudzStreets.ts`. Run the main game image with `GAME_SCRIPT=dopebudzStreets.ts` (Compose service `game_dopebudz_streets` on port 8005).
