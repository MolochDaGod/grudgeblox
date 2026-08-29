# GrudgeBlox work list

Status labels are evidence-based: **complete** means source plus a relevant check prove the item; **partial** means only part is proved; **blocked** needs missing authority or identity; **external** is not owned by this repository; **open** is not yet verified.

## Obvious-issue repair (2026-08-29)

- [x] **Complete — local world connection contract.** Commit `3c0b573` maps unported loopback WebSocket URLs to the single local backend on `8001`, preserves explicit ports, and keeps production world ports. Live `/play/lobby` connected to `127.0.0.1:8001`; no listeners were created on `8002`–`8005`.
- [x] **Complete — actionable startup failure and retry.** Commit `3c0b573` adds a connection timeout, visible failure details, and a retry action. Verified by stopping only the GrudgeBlox backend, observing the error state, restoring it, and reconnecting without reloading the page.
- [x] **Complete — development listener safety.** Commit `3c0b573` defaults development to `127.0.0.1`; explicit production remains `0.0.0.0`, and `LISTEN_HOST` remains the override. The restored local backend was observed only on `127.0.0.1:8001`.
- [~] **Partial — repository credential hygiene.** Commit `3c0b573` removes `front/.env.local` from tracking while preserving the ignored local file and adds `front/.env.example`. Rotation/revocation of the exposed credential and Git-history cleanup remain user-controlled external actions.
- [x] **Complete — owned build/browser warnings and branding wiring.** Commit `3c0b573` supplies `metadataBase`, uses the existing favicon/logo, preserves the browser msgpack fallback without a misleading native-addon warning, and fixes the owned Three.js color/shadow warnings. The production build and a clean lobby browser console were verified.
- [x] **Complete — armored long-necked Voxel Lobby Bridge guest transform.** The user confirmed the visible `guest-explorer` as the target, and Chrome proved its resolved asset is `WK_Characters.glb`. The lobby-only identity guard applies a clockwise quarter-turn and `(1, 2, 1)` visual scale, preserves the `1.8` top, and moves the bottom from `0` to the `-1.8` ground reference. The same guest on `/play/test` remains unchanged.
- [!] **External — Voxel Realms `snapToTerrain` and missing model/texture reports.** No authoritative implementation or referenced assets were proved inside this checkout. Preserve the references and correct them in the owning deployment/source repository.
- [ ] **Open — final visual acceptance.** Re-check the corrected armored lobby guest manually; automated Chrome bounds and unaffected-route checks pass, but the user's final visual acceptance remains separate.

## Existing backlog, reconciled

- [~] **Partial — lint backend + shared.** Backend ESLint passes. Shared passes its TypeScript build/type check but has no lint script or lint configuration; adding a new lint policy/toolchain is a separate maintenance choice.
- [ ] **Open — use absolute imports in backend + shared.** This is a broad import-style refactor without a demonstrated defect or acceptance rule, so it is outside the bounded repair.
- [ ] **Open — basic tests?** The original item is exploratory. Define a specific risk and test boundary before adding a routine suite.
- [ ] **Open — IaC?** Requires a deployment target and infrastructure decision.
- [!] **External/deployment — use Caddy + Certbot for SSL.** Requires host, DNS, certificate, and deployment authority; no deployment work is authorized here.
- [ ] **Deferred condition — if real UGC is required, evaluate WASM + QuickJS.** No current real-UGC requirement is proved.
- [ ] **Open — fix the car.** Needs an authoritative route/entity and reproducible defect before changing vehicle code.
- [ ] **Open — fix the lighting.** The prior Three.js warning repair does not prove a visual-lighting defect is fixed; provide a route and expected appearance.
- [ ] **Open — fix sky since Three.js modified it.** Needs a reproducible affected route and expected rendering before changing sky code.
- [ ] **Open — add more games.** Product expansion, not an obvious-error repair.

## Known non-blocking maintenance

- [ ] **Open — refresh Browserslist data deliberately.** Do this as a reviewed lockfile maintenance change; do not broadly upgrade dependencies merely to silence the age warning.
- [ ] **Open — configure persistent Next.js build caching if CI/runtime warrants it.** The warning is environmental and does not identify a source defect in the local build.
