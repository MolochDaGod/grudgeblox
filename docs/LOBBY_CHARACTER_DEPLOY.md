# GrudgeBlox — Lobby, character select, avatars, weapon skills

**Repo:** https://github.com/MolochDaGod/grudgeblox  
**Reference lobby UX:** https://www.notblox.online/play/test  
**Mine-Loader lobby:** https://mine.grudge-studio.com/#/lobby  
**GRUDOX:** https://grudox.grudge-studio.com  
**Metaverse DNS (target):** https://blox.grudge-studio.com  

---

## Product shape (Notblox + fleet)

```
/play/test  (and /play/{slug})
  ├── Cover image + Online badge          ← Notblox
  ├── Display name                        ← Notblox playerName
  ├── Fleet character roster              ← sandbox = every era
  │     Voxel + Warlords + Nexus + Armada + Game
  │     SSOT: Railway /api/characters?era=
  │     Island maps: baked Island Terrain World Engine
  ├── Enter world → WebSocket multiplayer ← Notblox ECS + Rapier
  ├── Local avatar mesh                   ← grudge6 CDN GLB (visual)
  └── Weapon skills 1–5                   ← windup → hit / projectile impact
```

Physics/network body remains Notblox ECS. **Avatar is a visual swap** on **every** player mesh (`PlayerAvatarSystem` + `applyAvatarToMesh`). Appearance (race / class / kit path / VFX seq) replicates on `PlayerComponent` so remotes see the same skin, locomotion clips, and skill FX.

---

## Metaverse DNS

| Host | Role |
|------|------|
| **blox.grudge-studio.com** | GrudgeBlox SPA (this repo front) |
| mine.grudge-studio.com | Voxel Realms lobby / play (`#/lobby`, `#/play`) |
| grudox.grudge-studio.com | GRUDOX voxel hub / cabinets |
| **grudox.grudge-studio.com/studio/** | Creative Sandbox **Voxel Studio** (modes, maker, AI lobby) |
| id.grudge-studio.com | Grudge ID SSO |
| assets.grudge-studio.com | grudge6 race GLBs |
| client.grudge-studio.com | Warlords + character API rewrites |

Vercel project should alias `blox.grudge-studio.com` → this front.  
Optional rewrite `/api/characters` → Railway game API (same as fleet satellites).

---

## Worlds (`public/gameData.json`)

Lobby sections: **Eras** `/eras` · **Islands** `/islands` · **Maps** `/maps`.

| Slug | Section | Script / map | Port |
|------|---------|--------------|------|
| `island-harbor-atoll` (`island`) | islands | `ISLAND_MAP=harbor-atoll` | 8006 |
| `island-volcanic-ridge` | islands | volcanic-ridge | 8007 |
| `island-frozen-fjord` | islands | frozen-fjord | 8008 |
| `island-alpine-mesh` | islands | Super Terrain alpine | 8009 |
| `island-granite-csg` | islands | Super Terrain granite | 8010 |
| `island-spline-forest` | islands | Super Terrain forest | 8011 |
| `island-tunnel-cavern` | islands | Super Terrain cavern | 8012 |
| `test` | maps | `gtaLobbyScript.ts` | 8001 |
| `combat` | maps | `parkourScript.ts` | 8002 |
| `lobby` | maps | lobby bridge | 8003 |
| `grudox` | maps | GRUDOX sandbox | 8004 |
| `streets` | maps | `dopebudzStreets.ts` | 8005 |

Deploy: `docs/SANDBOX_DEPLOY.md`. Terrain: `docs/ISLAND_SANDBOX.md`. Super Terrain: https://github.com/vibe-stack/super-terrain

---

## Code map

| File | Role |
|------|------|
| `front/lib/fleetConfig.ts` | DNS + grudge6 CDN + auth helpers |
| `front/lib/fleetCharacters.ts` | Roster load (multi-era) |
| `front/lib/grudgeAvatar.ts` | GLB load + Box3 fit 1.8 m |
| `front/lib/weaponSkillsCombat.ts` | Cast timing SSOT |
| `front/components/FleetCharacterSelect.tsx` | Lobby select UI |
| `front/components/WeaponSkillBar.tsx` | Skills 1–5 HUD |
| `front/components/GameContent.tsx` | Notblox layout + fleet select |
| `front/components/GamePlayer.tsx` | Start game + avatar + skills |

---

## Avatar rules

1. Prefer 4character Mixamo races at `/kit/4character/races/{race}.glb` (unzipped from `D:\Games\Models\4character.zip`)
2. Else `character.model3d` if absolute/CDN path
3. Else grudge6 race kit: `WK_|BRB_|ELF_|DWF_|ORC_|UD_` GLB on assets CDN  
4. Fit height **1.8 m** (Box3); Mixamo kit yaw **0**; grudge6 Toon **+π/2**  
5. Never leave Meshy capsules as production look
6. Create/select is **4 slots** (`FleetCharacterSelect`). Signed-in POST Railway `/api/characters` (`era=voxel`). Guest looks are lobby-only.
7. `PlayerComponent` serializes `{ n, r, k, c, m, fx, fxn }` so each client loads the same race + plays Idle/Walk/Run from the race GLB + spawns kit VFX on `fx:` world actions.  

---

## Weapon skills

Aligned with GrudgeBuilder `ProductionSkillCombatRuntime`:

- Melee: windup → **active hit**  
- Magic/ranged: windup → **projectile spawn** → damage on impact (client VFX now)  
- Keys **1–5**, GCD/busy while casting  

---

## Handoff peers

| From | To |
|------|-----|
| GrudgeBlox lobby | Mine-Loader `#/lobby` (same characterId storage keys) |
| GrudgeBlox | GRUDOX hub (voxel era) |
| GrudgeBlox / Mine | **Voxel Studio** `/studio/` (maker + game modes from `voxel-studio.zip`) |
| Empty roster | Foundry `era=voxel` create with returnTo play URL |

Studio monorepo SSOT: Mine-Loader `artifacts/voxel-studio` — see `Mine-Loader/docs/VOXEL_STUDIO_DEPLOY.md`.

Storage: `grudge_active_character` / `grudge.activeCharId` / `grudge_auth_token`.

---

## GTA-like city lobby (backend)

Default script: `back/src/scripts/gtaLobbyScript.ts` (`GAME_SCRIPT` default).

| District | Content |
|----------|---------|
| Spawn plaza | Jump pad, style station (E) |
| Motor row | 6+ cars (enter/drive) |
| Combat yard | Street thug NPCs |
| Market strip | Physics loot balls |
| Back alley | Bounce pads |

## Deploy checklist

1. **Front** — Vercel project root `front/`, alias `blox.grudge-studio.com`  
2. **Env** — `NEXT_PUBLIC_SERVER_URL=wss://blox-game.grudge-studio.com`  
3. **Back** — Docker/Railway/VPS: `GAME_SCRIPT=gtaLobbyScript.ts`, expose 8001–8004  
4. **DNS** — `blox` → Vercel; `blox-game` → WS host  
5. **API** — vercel rewrites `/api/characters` → Railway  
6. Smoke: `/play/test` → hero → avatar · cars · 1–5 skills  
7. Fleet launcher lists GrudgeBlox via `gameDeployments`  

```bash
# Front (from front/)
vercel --prod --yes

# Back (example Docker)
GAME_SCRIPT=gtaLobbyScript.ts GAME_TICKRATE=20 pnpm --filter @notblox/back start
```


---

## Agent rules

- Voxel games + GRUDOX character select should **look like Notblox play/test** (cover + name + play), not a blank canvas.  
- Character **identity** from fleet Railway; **mesh** from CDN grudge6/voxel; **lobby worlds** can deep-link Mine-Loader.  
- Combat timing must stay windup/active/recovery — no damage on button-down for projectiles.  
