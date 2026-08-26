# Dope Budz Streets on GrudgeBlox

Playable web client is the Three.js GTA-like open world (six generative cities, 16 land deeds, growhouses, kits, missions).

## Live server (Railway)

Service root: `dopebudz-streets/`.

```
GAME_TICKRATE=20
PORT=8001
```

Health: `/health`.

## GrudgeBlox ECS world

```
GAME_SCRIPT=dopebudzStreets.ts
GAME_TICKRATE=20
```

Script: `back/src/scripts/dopebudzStreets.ts` — Grove, Harbor, Neon, Mesa, Fogtown, Little Beach, 16 Deed Row lots (BUDZ/SOL), growhouse benches, mission terminals, Motor Row cars, combat-yard NPCs. Uses the same proximity prompts, cars, and zombie street crew as `gtaLobbyScript.ts`.
