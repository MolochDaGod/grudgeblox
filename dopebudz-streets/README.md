# Dope Budz Streets — live server

GrudgeBlox-style 20Hz WebSocket authority for **Dope Budz Streets**.

## Railway

1. New Railway service from `MolochDaGod/grudgeblox`.
2. Root directory: `dopebudz-streets`.
3. Railway reads `Dockerfile` + `railway.toml`.
4. Set `GAME_TICKRATE=20` (40–60 if cars feel laggy, same as GrudgeBlox).
5. Point the web client at the public `wss://` URL (`VITE_LIVE_URL`).

Health: `GET /health` → `{ ok, players, tick }`.

## Protocol

Matches the in-browser P2P payload (`pose`, `shot`, `plot`) so the same net types work on Railway.
