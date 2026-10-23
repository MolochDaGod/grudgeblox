# Shire Workbench consumer contract

## Scope

The Shire (`/play/shire`) is part of GrudgeBlox, not a separate project. `front/app/play/shire/page.tsx` mounts ShireGame, and `front/game/shire/ShireScene.ts` owns the Three.js scene and its WorkbenchLibrary. The Game Asset Workbench (GAW) produces the models; this repo only consumes them.

## Local-only routes

Two Next.js routes serve the Workbench delivery folder. Both are implemented in `front/lib/workbenchServer.ts`:

- `GET /workbench/library.json` and `GET /workbench/assets/<24-hex key>/<12-hex fingerprint>/Model.glb` serve the manifest and delivered GLBs with `Cache-Control: no-store`. Any other path returns 404.
- `POST /api/workbench` writes a small heartbeat (`portal-status.json`: entries, actors, library_updated) into the same folder. Bodies over 4 KB are rejected with 413.

**Both routes return 403 unless `GRUDGE_LOCAL_WORLD=shire` is set and the request comes from localhost.** Localhost means the Host header is `127.0.0.1:<port>`, and any Origin header must be `http://<that host>`.

**`GRUDGE_LOCAL_WORLD` must never be set in production** (Vercel, Railway or any public host). With it unset, the routes always return 403 and never touch the filesystem.

The delivery folder is resolved from `GRUDGE_WORKBENCH_ROOT` (an absolute path), or else `<GAME_ASSET_BULK or GAME_ASSET_VAULT>/Game integrations/shire`. The consumer never creates or replaces `library.json`. If the folder is missing, the routes return 404 or 503.

## Live delivery

GAW publishes `assets/<key>/<fingerprint>/Model.glb` and a schema-1 `library.json` manifest. Each entry contains key, model, revision, clips, spawn, length_m, habitat and preferred_clip. WorkbenchLibrary polls the manifest every two seconds. When the revision changes, it clears actors and its cache and drops pending loads from the older epoch. Model URLs carry a revision query parameter (`workbenchContract.ts`), and a failed load is evicted from the cache so it can retry. Ambient spawns stay capped at 12 and use the existing water, air and land placement rules.

## NPC needs and pasture

`shared/shire/pasture.ts` defines grass patches on the world grid that animals consume and that regrow over world time. These are saved in `world.grazing` and validated on load. `shared/shire/animalGoals.ts` gives animals goal-driven behaviour (graze, forage, feed, rest, perch, school, bask). Each goal has a travel phase and an act phase. Blocked targets go on cooldown, with no teleporting. A startle interrupts the current goal. `PastureView.ts` renders the same patches the NPCs eat as instanced grass near the player. Gardener and farmer residents walk to unwatered crops and water them after six seconds on site. Rangers advance their survey slot only after finishing work there, not on a timer.

## Verification

- `scripts/npc-goals.test.ts` (6 tests) runs in CI as part of `pnpm run test:back`. It covers grazing, depleted and unreachable targets, startle and feed, save round-trips, regrowth, invalid-save rejection, species foraging and resident work.
- `scripts/npc-live-acceptance.ts` is an optional manual check against a locally running Shire server. Configure it with `SHIRE_BASE_URL`, `SHIRE_VALIDATION_OUTPUT` and optionally `SHIRE_EXPECTED_STORAGE`.
- A real Three.js render and a native GAW portal check have not been run for this change.
