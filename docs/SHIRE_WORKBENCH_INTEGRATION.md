# Shire Workbench consumer contract

## Current source and launch entry

The consumer is the existing GrudgeBlox project, not a second game project. Canonical editable source is C:\grudgegit\grudgeblox (MolochDaGod/grudgeblox). The route front/app/play/shire/page.tsx mounts ShireGame; front/game/shire/ShireScene.ts owns Three.js gameplay and its WorkbenchLibrary. Edit those TypeScript/React files in the source checkout. In-game construction remains part of Shire.

The restored GAW producer source registers Shire against C:/grudgegit/grudgeblox. Its Shire editor flag does not start a separate visual source editor. The desktop portal creates an Electron BrowserWindow at http://127.0.0.1:4100/play/shire. Its request allowlist permits only that loopback origin, so delivered assets must remain same-origin. An iframe is not required. Native embedded-window acceptance remains pending.

## Asset ingestion and live delivery

GAW owns collection/export, classified entries, immutable GLB delivery and atomic library.json replacement. It delivers assets/<24-hex-key>/<12-hex-fingerprint>/Model.glb and a schema-1 manifest containing assets, updated, key, model, revision, clips, spawn, length_m, habitat and preferred_clip. Delivery does not replace saved buildings, maps, authored species or player state.

The consumer reads the absolute GRUDGE_WORKBENCH_ROOT override, or inherits GAME_ASSET_BULK/Game integrations/shire, then GAME_ASSET_VAULT/Game integrations/shire. This is the producer's existing selected folder. No public junction, asset copy or replacement library is created by the consumer.

The dynamic /workbench/[...asset] route serves library.json and delivered GLBs with Cache-Control: no-store. WorkbenchLibrary polls every two seconds, compares manifest text, clears actors/cache on a changed revision and rejects pending actors from an older epoch. Models use a revision query parameter. A failed model request is removed from the promise cache so the same entry can retry.

Source animations are cloned independently and played by AnimationMixer; this change does not create or alter clips. Ambient spawn remains capped at 12 and uses existing water/air/land placement. Other categories remain available through instantiate(key).

POST /api/workbench acknowledges entries, actors and library_updated in portal-status.json in that same folder. Unique temporary names and serialized publication prevent same-process refresh collisions. Missing delivery folders stay unavailable. The launcher refuses a heartbeat destination on E: or F:, because those volumes are releases and non-project data in this workspace. MAIN must qualify the producer's selected folder separately.

## Routed local workflow

Read-only planning:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\grudgegit\grudgeblox\scripts\shire-local.ps1 -Mode Plan

The launcher reads the existing .workspace-build.json. Its only build root is D:\grudgegit\grudgeblox. The default staged runtime is D:\grudgegit\grudgeblox\shire\runtime; Next dependencies live there, build output is front\.shire-next, and temp, compile cache, logs and process ledger live below D:\grudgegit\grudgeblox\shire. Save records use an explicit retained C: root; the proposed default is C:\RuntimeData\grudgegit\grudgeblox\TheMiddleEarth. This default is not evidence that old saves have been recovered.

After resource admission, Stage copies only committed Git-tracked source into a fresh D: runtime and writes .shire-source.json. An existing runtime is preserved; use a fresh -RuntimeRoot for a new snapshot. Stage never downloads dependencies. Dependencies must be restored/installed into the selected D: snapshot by the qualified build workflow. Build reads the installed Next package version in the selected D: snapshot, preserves the legacy Next 15 build arguments, and selects build --webpack for Next 16. Its existing Windows entry repair and extension aliases remain active, and Shire uses one configured worker. This is source-level readiness; it is not evidence that Next 16 is installed. Build calls Next directly in that D: snapshot and does not publish to E:. Prepare is a separate explicit provenance-sensitive asset import; its legacy upstream evidence/source paths have not been qualified in this repair.

After the retained C: assets and producer delivery root are qualified, use:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\grudgegit\grudgeblox\scripts\shire-local.ps1 -Mode Build -DataRoot "<retained C: Shire root>" -WorkbenchRoot "<qualified producer delivery folder>"
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\grudgegit\grudgeblox\scripts\shire-local.ps1 -Mode Start -DataRoot "<retained C: Shire root>" -WorkbenchRoot "<qualified producer delivery folder>"

GAW inherits GRUDGE_SHIRE_DATA_ROOT and GRUDGE_WORKBENCH_ROOT/GAME_ASSET_BULK when invoking Start. Its native portal fixes port 4100; another port works only for a separate browser. Play The Middle-earth.cmd invokes this same launcher. Existing binary shortcuts have not been regenerated or claimed functional.

Start requires the retained asset manifest, a committed matching stage, existing Next dependencies and a completed build. It never implicitly prepares assets, migrates saves, starts the multiplayer backend or downloads packages. Occupied ports and mismatched owned process records are preserved. Status and Stop refer to the owned D: ledger. No GAW restart/deployment is performed by this workflow.

## Verification and remaining acceptance

14 synthetic tests cover manifest replacement, GLB streaming, concurrent heartbeat publication, absent delivery, unchanged request restrictions, revision URLs, failed-load retries, pending actor cancellation/disposal, read-only planning, staging preservation and missing dependency refusal. The library harness executes its real source with small loader/scene mocks; it does not establish real Three.js rendering, skeleton motion or native portal acceptance.

Run on one admitted CPU, with SHIRE_VALIDATION_ROOT set to a disposable folder below the canonical D: root:

    node --experimental-vm-modules --test --test-concurrency=1 scripts/shire-workbench.test.mjs

As inspected on 9 October 2026, neither the C: source checkout nor the proposed D: runtime contains Next dependencies. The proposed C: save root and library.json under the selected E:/Artifacts/GameAssetWorkbench/Game integrations/shire are absent. The selected GAW bulk configuration still points to E:; its owner must qualify a compliant delivery location. The retained D: shire-next and shire-runtime directories are historical material, with no verified current BUILD_ID/dependency contract. No original saves/assets were moved or overwritten.

On 9 October 2026 MAIN admitted a measured official prerequisite proposal: pnpm 12.10.1 bootstrap first, then a recorded public dependency candidate, with 1 CPU, 4 GiB RAM, 2 GiB total incremental D: storage and at most 250 MiB total network. The exact bootstrap packet was rejected by the unchanged shared runner preflight with exit 78 because prerequisite execution is not an admitted operation; the runner also explicitly excludes grudgegit projects. MAIN assigned a read-only runner-owner review and held activation. Zero package archives were downloaded and no installer resolution, native binding, final toolchain type/lint/unit check, Next build or runtime launch occurred. The packet and failure evidence remain under D:\grudgegit\grudgeblox\shire\dependencies\bootstrap-20261009-001. No alternative executor or policy retry is authorized. Build/runtime and GAW/native desktop acceptance require separate admission.

Then verify /play/shire, /workbench/library.json and one synthetic delivered GLB; open an isolated test save in the existing native portal; acknowledge the exact manifest updated value; change fixture population/size/preferred source clip; verify hot reload, epoch cancellation, disposal and source clip motion. Preserve and compare original save/asset hashes. Use a fixture-only producer folder for delivery/status writes. These steps require qualified dependencies, retained data and GAW deployment admission, and were not run in this phase.

## Historical evidence

26 September 2026: the earlier consumer used a public link to E:/GameAssetVault/Game integrations/shire. Historical type/build and Electron checks reported three model entries, ten bird actions, 12 actors including ten fish and successful habitat/disposal checks. That report does not prove the current restored environment.

28 September 2026: the historical native portal opened Workbench portal verification and acknowledged a library revision. Its immediate heartbeat contained zero actors. Historical evidence was recorded at E:/GameAssetWorkbench/verification/1.16/shire-checks.json and middle-earth-native.png. These files were not revalidated here.

## Source readiness for the proposed stable toolchain

Official metadata inspected on 9 October 2026 reports Next 16.4.0, React/React DOM 19.3.0, Three.js 0.186.1, tsx 4.23.15 and pnpm 12.10.1 as current stable. These are proposed targets, not installed versions or updated manifest/lock entries. Existing engine declarations accept the installed Node 26.10.0; no Node replacement is needed. Security overrides, backend/shared declarations and the installer-owned lock remain unchanged.

The current React/accessibility/import lint plugins exclude ESLint 10; ESLint 9.39.5 is the latest compatible line with eslint-config-next 16.4.0. TypeScript 7 lacks the legacy compiler API required by the TypeScript ESLint tooling, so the proposed frontend API toolchain uses Microsoft's TypeScript 6.0.2 compatibility alias. Next 16.4 itself defaults to CLI checking and supports TypeScript 7; an older compiler is not required by Next alone. The future coordinated patch must pair React/Three typings, migrate next lint to a flat ESLint configuration and review frontend TypeScript configuration, then obtain a normal installer-produced lock before claiming resolution.

Primary references: [Next upgrade guidance](https://nextjs.org/docs/app/guides/upgrading/version-16), [pnpm current release](https://pnpm.io/installation), [TypeScript compatibility API](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), [Three migration guidance](https://github.com/mrdoob/three.js/wiki/Migration-Guide). Exact official hashes, sizes and source/lock comparisons are recorded under D:\grudgegit\grudgeblox\shire\validation\20261009-official-prerequisite-plan.

Three added source tests exercise the installed-metadata argument adapter and the actual next.config.js worker/Windows webpack behavior without loading Next or Three. The full suite contains 17 tests; source-only verification can exclude the three PowerShell launcher/staging tests using --test-skip-pattern="^(launcher |Stage )". This does not certify the installed latest dependency set or an embedded runtime.
