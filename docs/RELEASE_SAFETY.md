# Release-safety contract

This document records repository behavior only. It does not select a public hostname, provider root, TLS termination mode, world-to-script mapping, licence policy, or deployed revision.

## Guided reliability repairs — 2026-09-05

Normal changing-yaw input is sent at the server tick cadence (20 Hz by default) independently of rendering FPS. Discrete key edges remain immediate; state advances only after a successful send and reconnects resend the first state. The server's 80-message/second budget and 512-byte frame limit remain enforced. Thirty-second simulated 60/120/144 Hz runs and a separate real 10-second loopback traffic smoke cover different evidence boundaries.

Avatar loading permits three attempts per appearance with 500/1000 ms retry delays, retains prior visuals on failure, and discards results after appearance, entity or session changes. Transient effects own cloned geometry/materials and dispose only those resources; cached textures/prototypes remain shared. Reset/unmount stops pending work, listeners, controls and the renderer, removes prior entities and events, and rejects late mesh and socket completions. Existing sources and physics scale remain intact; this does not establish canonical persistent hero ownership.

Login and Foundry links receive the active world path. Their first render uses the same canonical origin on server and client; an effect adopts the browser's origin after hydration. Optional character-creation choices remain explicit; local URL construction does not establish backend account ownership.

Security maintenance stays on Next 15.x (15.5.25), DOMPurify 3.4.14, PostCSS 8.5.28 and tsx 4.23.13. Narrow workspace overrides update Next's pinned PostCSS and node-three-gltf's Sharp to 0.35.4. The actual backend loader decoded the existing human GLB's five textured meshes/53 clips plus a PNG after the Sharp change, and the text sanitizer retained intended markup while stripping active content. The production audit snapshot has zero reported advisories; this is not a permanent security guarantee. Frozen-lockfile installation remains the release contract.

Reproduce focused checks with `pnpm test:back`, `pnpm test:client:reliability`, `pnpm --filter @notblox/back run smoke:dependencies`, `pnpm build`, and the loopback `smoke:network`. Cross-project evidence: `D:\gruda-build\outputs\guided-reliability-20260905\AUDIT.md`. No production configuration, deployment or upstream merge accompanied these local fixes.

## Runtime boundaries

- `GET /health` is an operational readiness endpoint. It returns only `status`, `ready`, `uptime`, and the configured game script/tick rate. It never returns player names, chat, notifications, target IDs, or moderation data. It returns `503` until the game script has loaded and the WebSocket listener is accepting connections.
- `GET /admin/events` is optional and unavailable (`404`) unless `ADMIN_API_TOKEN` is configured. When enabled it requires an exact bearer token, disables caching, and returns only the current in-memory ECS message list. Retention is capped at 20 messages, is not written to disk, and resets on process restart. Any broader or durable moderation store requires a separate privacy and retention decision.
- Production WebSocket startup requires at least one exact origin in comma-separated `ALLOWED_ORIGINS` or the legacy single-value `FRONTEND_URL`. Missing, malformed, path-bearing, or unapproved origins fail closed. Development defaults only to the normal `localhost:4000` and `127.0.0.1:4000` browser origins; a different local frontend must be configured explicitly.
- Client frames remain capped at 512 bytes. Msgpack decoding is guarded, every message type is schema-checked, non-finite numbers and invalid entity IDs are rejected, and each connection has a configurable per-second message budget (`MAX_MESSAGES_PER_SECOND`, default 80).
- `PORT` takes precedence over `GAME_PORT`; both are validated. Startup exits nonzero if the game script fails to load, the origin policy is invalid, or the listener cannot bind.
- The Docker health probe checks application readiness over HTTP and HTTPS so it does not choose between the existing direct-TLS and edge-proxy deployment modes.

## Build and release consistency

- The root workspace is pinned to pnpm 11.19.0 and Node 24 in CI. Required dependency build scripts are explicitly allowed in `pnpm-workspace.yaml`.
- CI installs from the root lockfile, runs the backend network-policy tests, builds shared/backend/frontend, and retains the Docker smoke build. The stale GitHub Pages deploy workflow is now a build-only check; selecting a hosting target remains an owner action.
- Compose's prebuilt game services default to the same GHCR repository published by `.github/workflows/deploy.yml`. Production should override `GRUDGEBLOX_GAME_IMAGE` with an immutable commit tag or digest.
- The web manifest and standard, Apple, and maskable icon sizes are generated from the existing repository GrudgeBlox face branding.

## Decisions intentionally left open

- Canonical public HTTP/WebSocket hostnames and the provider root directory.
- Direct application TLS versus an existing edge/proxy terminator.
- The production world names, ports, scripts, and allowed origins.
- Restricted licence/commercial wording versus package metadata.
- Vercel credential revocation and any coordinated Git-history rewrite.
- The deployed provider branch/commit and immutable container digest.

## Local Shire mode — 6 September 2026

`/play/shire` is a separate local single-player mode inside this checkout. Its Next action service is enabled only by the local launcher, requires an explicit E: root, rejects nonlocal Host and foreign Origin, requires a local session token for actions/import/export/recovery, and caps requests. The owned server binds only to `127.0.0.1`. It leaves existing fleet identities, multiplayer protocols, user environment files, dependencies and previous dirty work intact; the household produce ledger is local world state, not a second canonical bag.

Saves use validated IDs, bounded typed state, checksummed revision files, atomic heads and separate recovery/import slots. Builds, temp/compilation caches, accepted assets and evidence use E:. The launcher identifies its own process before stopping it and does not take occupied ports from other apps.

Source/filesystem checks (32), the production build, and live service checks (6) pass. Al reported positive gameplay for the initial elements; the new wildlife/building expansion awaits its next gameplay/visual pass. Nine production animal packages and measured geographic/fauna source integration remain open. The previously accepted rabbit is included with its original hashes/identity and complete evidence bundle. No commit, push, public launch, account operation or asset-generation pipeline is part of this local pass.

The wildlife/building expansion uses optional save fields, preserves old door/animal records, and requires the local session for current-player observations. The observed pose is validated before it influences wildlife. Entry plans are created by the shared planner and committed as one undo group; fitted doors retain their measured surround and aperture. All eight existing worlds were exported and snapshotted on E: before the rebuild, and their 16 current/previous heads passed read-only compatibility and preservation checks.

The reusable Shire administration worker stores its instructions, state, backlog and dated reports only under E: `admin-worker`. It verifies the owned server before a read-only entry-route request, avoids world/session APIs, and does not change saves, processes, source, assets or acceptance gates. An exclusive invocation lock prevents concurrent passes. It is invoked on demand, not scheduled.
