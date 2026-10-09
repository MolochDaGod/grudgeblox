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

After resource admission, Stage copies only committed Git-tracked source into a fresh D: runtime and writes .shire-source.json. An existing runtime is preserved; use a fresh -RuntimeRoot for a new snapshot. Stage never downloads dependencies. Dependencies must be restored/installed into the selected D: snapshot by the qualified build workflow. Build calls Next directly in that D: snapshot and does not publish to E:. Prepare is a separate explicit provenance-sensitive asset import; its legacy upstream evidence/source paths have not been qualified in this repair.

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

Requested next admission: one CPU, 4 GiB total RAM, up to 2 GiB additional D: storage, 20 minutes, no GPU and no E:/F: writes. Restore only an approved existing offline dependency set into the staged D: runtime; no network download is included. Run targeted Shire TypeScript checking, a local Next production build, and an owned loopback service. MAIN must separately approve any GAW/native desktop action because the deployment denial remains in effect.

Then verify /play/shire, /workbench/library.json and one synthetic delivered GLB; open an isolated test save in the existing native portal; acknowledge the exact manifest updated value; change fixture population/size/preferred source clip; verify hot reload, epoch cancellation, disposal and source clip motion. Preserve and compare original save/asset hashes. Use a fixture-only producer folder for delivery/status writes. These steps require qualified dependencies, retained data and GAW deployment admission, and were not run in this phase.

## Historical evidence

26 September 2026: the earlier consumer used a public link to E:/GameAssetVault/Game integrations/shire. Historical type/build and Electron checks reported three model entries, ten bird actions, 12 actors including ten fish and successful habitat/disposal checks. That report does not prove the current restored environment.

28 September 2026: the historical native portal opened Workbench portal verification and acknowledged a library revision. Its immediate heartbeat contained zero actors. Historical evidence was recorded at E:/GameAssetWorkbench/verification/1.16/shire-checks.json and middle-earth-native.png. These files were not revalidated here.
