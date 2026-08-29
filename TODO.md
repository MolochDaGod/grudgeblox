# GrudgeBlox work list

Status labels are evidence-based: **complete** means source plus a relevant check prove the item; **partial** means only part is proved; **blocked** needs missing authority or identity; **external** is not owned by this repository; **open** is not yet verified.

## Locally actionable functionality

### Dope Budz Streets integration

- [~] **Partial — integrated ECS Streets authority.** The primary `GAME_SCRIPT=dopebudzStreets.ts` path now retains all existing production districts, roads, cars, crews, lots, benches, terminals, and combat surfaces while adding session-authoritative balances, lot claims, grow/harvest cycles, terminal-route jobs, reputation, targeted status messages, and disconnect cleanup. Shared/backend/frontend builds and an isolated startup, health, stable-floor, player-connect, targeted-action, and disconnect smoke pass; proximity gameplay and multi-client acceptance remain open.
- [x] **Complete — structured world actions.** A generic validated `WORLD_ACTION` client message and ECS `WorldActionEvent` let the Streets HUD query status, owned lots, and the active job without depending on globally visible chat commands. Shared, backend, and frontend builds pass, and an isolated msgpack client received the targeted `dopebudz:lots` result.
- [x] **Complete — separate JSON compatibility instance.** `dopebudz-streets/` remains separately deployable and preserves its existing JSON messages while adding `/meta`, origin/client/payload/message limits, finite numeric validation, correct zero-value handling, ping/pong, connection cleanup, graceful shutdown, and explicit compatibility-role metadata. Syntax, HTTP health/metadata, WebSocket welcome/ping/plot/zero-value snapshot, cleanup, and loopback shutdown checks pass.
- [ ] **Open — integrated local gameplay acceptance.** Run `/play/streets` against a local `GAME_SCRIPT=dopebudzStreets.ts` backend and prove claim, insufficient funds, plant, ready, harvest, mission start, mission completion, HUD queries, vehicle entry, and disconnect cleanup.
- [ ] **Open — two-client authority check.** Prove that lot contention, another player’s grow bench, targeted responses, and release-on-disconnect behave correctly with two simultaneous ECS clients.
- [ ] **Open — persistence adapter.** Keep the runtime session-only until the owner selects identity and storage. Once selected, add a repository adapter for balances, lot ownership, grow timers, and missions without making the game script depend directly on a vendor SDK.

### Other local functionality

- [x] **Complete — truthful backend readiness.** The game script now loads before the listener starts; startup awaits a successful bind, reports `503` until ready, and exits nonzero on script or listen failure. Focused missing-script and occupied-port smoke checks pass.
- [x] **Complete — private-data-safe health and authenticated event access.** `/health` contains no player/chat/notification data. The optional `/admin/events` feed is disabled without `ADMIN_API_TOKEN`, requires exact bearer authentication when enabled, and documents an in-memory 20-message/restart retention boundary. Unit and live HTTP checks pass.
- [x] **Complete — bounded WebSocket message handling.** Invalid/oversized msgpack is contained, every client message type is schema-validated, and a configurable per-connection message limiter protects dispatch. Unit plus live malformed, oversized, and burst checks pass.
- [x] **Complete — explicit WebSocket origins.** Production fails startup without configured origins and rejects missing/unapproved origins. Exact multi-origin configuration and the legacy `FRONTEND_URL` value are supported; loopback development remains available only through the documented local defaults or explicit configuration.
- [~] **Partial — lint backend + shared.** Backend ESLint passes. Shared passes its TypeScript build/type check but has no lint script or lint configuration; adding a new lint policy/toolchain is a separate maintenance choice.
- [x] **Complete — frontend CI/package consistency.** CI now uses the pinned pnpm/Node versions, runs the focused backend tests, and builds shared, backend, and the production frontend from the repository root. The stale Pages deployment assumptions were replaced with a build-only workflow.
- [x] **Complete — web manifest and icon pack.** The existing GrudgeBlox face branding now supplies standard, Apple, 192/512, and maskable icons through a generated web manifest; production build and local manifest/icon checks pass.

## Server/admin/owner changes

- [!] **Admin — select the production Streets instance.** Use the integrated ECS service (`GAME_SCRIPT=dopebudzStreets.ts`, production world port `8005`) as the primary endpoint for `/play/streets`. Do not point the current GrudgeBlox client at the separate JSON service.
- [!] **Admin — only deploy the JSON compatibility service when a compatible client exists.** Give it a distinct hostname, set `ALLOWED_ORIGINS`, connection/payload/message limits, and decide whether client-reported HP and session plot claims remain enabled. Do not share state or a public URL with the ECS authority.
- [!] **Admin — choose identity and persistence.** Provide the approved account identity and backing store/volume for durable balances, lots, crops, and missions. Until then, ECS progress is deliberately released on disconnect and JSON claims are session-only.
- [!] **Admin — reconcile world ports and scripts.** The client advertises `test`, `combat`, `lobby`, `grudox`, and `streets` on `8001`–`8005`, while Compose currently starts default, parkour, football, pet-simulator, and Streets scripts. Decide the intended mapping before deployment.
- [!] **Admin — correct production origins.** Compose ports `8001`–`8004` allow `https://www.notblox.online`, while the current frontend is `https://blox.grudge-studio.com`; the exact origin check will reject the current frontend until the server environment is corrected.
- [~] **Admin — pin the game-server image.** Repository Compose defaults now match the published `ghcr.io/molochdagod/grudgeblox-game-server` image and accept `GRUDGEBLOX_GAME_IMAGE`; production still needs an approved immutable release/SHA tag or digest.
- [!] **Admin — TLS/DNS exposure.** Choose the existing proxy stack or direct WSS ports, provide valid DNS/certificates, and expose only the listeners required by the selected architecture. Caddy/Certbot is not an additional requirement when the existing proxy terminates TLS.
- [!] **Owner — rotate/revoke the historical Vercel credential.** The source deletion is local, but credential invalidation and any coordinated history cleanup are owner-controlled.
- [!] **Owner — reconcile licence metadata and restricted-use wording.** Package manifests declare MIT while `LICENCE.md` adds a blockchain/cryptocurrency prohibition. Select the intended policy before any release touching token-like functionality; this pass deliberately leaves the legal/commercial text unchanged.
- [!] **Owner/external — Voxel Realms reports.** `snapToTerrain` and the missing model/texture references belong in the owning deployment/source repository.
- [ ] **Owner — final lobby guest visual acceptance.** Automated bounds and unaffected-route checks pass; manual acceptance remains separate.

## Completed repair evidence (2026-08-29)

- [x] **Complete — local world connection contract.** Commit `3c0b573` maps unported loopback WebSocket URLs to the single local backend on `8001`, preserves explicit ports, and keeps production world ports. Live `/play/lobby` connected to `127.0.0.1:8001`; no listeners were created on `8002`–`8005`.
- [x] **Complete — actionable startup failure and retry.** Commit `3c0b573` adds a connection timeout, visible failure details, and a retry action. Verified by stopping only the GrudgeBlox backend, observing the error state, restoring it, and reconnecting without reloading the page.
- [x] **Complete — development listener safety.** Commit `3c0b573` defaults development to `127.0.0.1`; explicit production remains `0.0.0.0`, and `LISTEN_HOST` remains the override. The restored local backend was observed only on `127.0.0.1:8001`.
- [~] **Partial — repository credential hygiene.** Commit `3c0b573` removes `front/.env.local` from tracking while preserving the ignored local file and adds `front/.env.example`. Rotation/revocation of the exposed credential and Git-history cleanup remain user-controlled external actions.
- [x] **Complete — owned build/browser warnings and branding wiring.** Commit `3c0b573` supplies `metadataBase`, uses the existing favicon/logo, preserves the browser msgpack fallback without a misleading native-addon warning, and fixes the owned Three.js color/shadow warnings. The production build and a clean lobby browser console were verified.
- [x] **Complete — armored long-necked Voxel Lobby Bridge guest transform.** The user confirmed the visible `guest-explorer` as the target, and Chrome proved its resolved asset is `WK_Characters.glb`. The lobby-only identity guard applies a clockwise quarter-turn and `(1, 2, 1)` visual scale, preserves the `1.8` top, and moves the bottom from `0` to the `-1.8` ground reference. The same guest on `/play/test` remains unchanged.
- [!] **External — Voxel Realms `snapToTerrain` and missing model/texture reports.** No authoritative implementation or referenced assets were proved inside this checkout. Preserve the references and correct them in the owning deployment/source repository.
- [ ] **Open — final visual acceptance.** Re-check the corrected armored lobby guest manually; automated Chrome bounds and unaffected-route checks pass, but the user's final visual acceptance remains separate.

## Deferred or conditional functionality

- [ ] **Open — use absolute imports in backend + shared.** This is a broad import-style refactor without a demonstrated defect or acceptance rule, so it is outside the bounded repair.
- [ ] **Open — basic tests?** The original item is exploratory. Define a specific risk and test boundary before adding a routine suite.
- [>] **Tracked as server/admin — IaC.** Requires the selected deployment target and infrastructure decision.
- [>] **Tracked as server/admin — TLS proxy/certificates.** Requires host, DNS, certificate, and deployment authority.
- [ ] **Deferred condition — if real UGC is required, evaluate WASM + QuickJS.** No current real-UGC requirement is proved.
- [ ] **Open — fix the car.** Needs an authoritative route/entity and reproducible defect before changing vehicle code.
- [ ] **Open — fix the lighting.** The prior Three.js warning repair does not prove a visual-lighting defect is fixed; provide a route and expected appearance.
- [ ] **Open — fix sky since Three.js modified it.** Needs a reproducible affected route and expected rendering before changing sky code.
- [ ] **Open — add more games.** Product expansion, not an obvious-error repair.

## Known non-blocking maintenance

- [ ] **Open — refresh Browserslist data deliberately.** Do this as a reviewed lockfile maintenance change; do not broadly upgrade dependencies merely to silence the age warning.
- [ ] **Open — configure persistent Next.js build caching if CI/runtime warrants it.** The warning is environmental and does not identify a source defect in the local build.
