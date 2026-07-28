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
  ├── Fleet character roster              ← Mine-Loader multi-era pattern
  │     eras: voxel · warlords · nexus
  │     SSOT: Railway /api/characters?era=
  ├── Enter world → WebSocket multiplayer ← Notblox ECS + Rapier
  ├── Local avatar mesh                   ← grudge6 CDN GLB (visual)
  └── Weapon skills 1–5                   ← windup → hit / projectile impact
```

Physics/network body remains Notblox ECS. **Avatar is a visual swap** on the local player mesh (`applyAvatarToMesh`).

---

## Metaverse DNS

| Host | Role |
|------|------|
| **blox.grudge-studio.com** | GrudgeBlox SPA (this repo front) |
| mine.grudge-studio.com | Voxel Realms lobby / play (`#/lobby`, `#/play`) |
| grudox.grudge-studio.com | GRUDOX rooms / nexus |
| id.grudge-studio.com | Grudge ID SSO |
| assets.grudge-studio.com | grudge6 race GLBs |
| client.grudge-studio.com | Warlords + character API rewrites |

Vercel project should alias `blox.grudge-studio.com` → this front.  
Optional rewrite `/api/characters` → Railway game API (same as fleet satellites).

---

## Worlds (`public/gameData.json`)

| Slug | Era | Combat | Port |
|------|-----|--------|------|
| `test` | voxel | yes | 8001 |
| `combat` | warlords | yes | 8002 |
| `lobby` | voxel | no | 8003 |
| `grudox` | nexus | yes | 8004 |

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

1. Prefer `character.model3d` if absolute/CDN path  
2. Else race kit: `WK_|BRB_|ELF_|DWF_|ORC_|UD_` GLB on assets CDN  
3. Fit height **1.8 m** (Box3); art-forward **+π/2** for grudge6  
4. Never leave Meshy capsules as production look  

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
| GrudgeBlox | GRUDOX hub for nexus rooms |
| Empty roster | Foundry `era=voxel` create with returnTo play URL |

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
