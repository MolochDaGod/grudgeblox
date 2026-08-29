# Release-safety contract

This document records repository behavior only. It does not select a public hostname, provider root, TLS termination mode, world-to-script mapping, licence policy, or deployed revision.

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
