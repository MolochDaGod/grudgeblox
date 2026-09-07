# The Middle-earth — local Shire world

Source: `D:\grudgeblox`, saved main checkout. Data: `E:\GrudgeBloxData\TheMiddleEarth`. This mode is for this PC and needs no sign-in or remote game server.

## Play

After a successful local build, double-click `D:\grudgeblox\Play The Middle-earth.cmd`. It starts the owned server on `127.0.0.1:4100`, waits for E: storage, and opens `/play/shire`. Choose New world or Continue. An occupied port reports a useful error and leaves the other process alone.

- Walk with WASD, run with Shift, jump with Space. Right-drag to look, or use Explore to capture the mouse. Escape and window blur release input. Arrow keys and Page Up/Down also steer the view.
- Mark a free hillside as home. Aim into it and use Entry: it creates an 8–20 m descending tunnel with a gentle slope and a level covered chamber. The translucent preview shows the complete plan. Walk down into the chamber, then extend rooms/passages. Entry undoes as one group and cannot be undone while you are inside it.
- Sculpt and Add earth have independent width, height and depth, initially 2 m each. Choose ellipsoid/sphere, rounded box or cylinder, then adjust its turn. The translucent layer shows the actual volume, including the part inside the hill. Enclosed rooms retain earth overhead. Floor, ceiling, sculpt, fill, undo and redo use the same persistent 3D field. Undo and fill cannot bury the player.
- Place tables, chairs, beds, shelves, a household chest, doors, lamps and fences on supported ground. New doors measure the hallway walls and ceiling and add a solid surround around the round opening. Turn the door across the passage before placing it. Old saved doorways keep their previous form; remove and place one again to apply the fitted surround. Doors open with E; lanterns toggle light and beds advance world time. A furnishing cannot occupy the player or close an existing local escape path. Household storage holds the world's harvested produce.
- Till/plant barley or carrots outdoors. Water, wait 60 seconds of play, then harvest produce, seeds and feed. Look at a crop and press E to water or harvest.
- Feed both adult parents near you, then choose a female and male of the same species. The care panel lists every animal, filters by species, explains when a pair is not ready, and shows actual parents and offspring in Family details. New offspring receive distinct species-numbered names. Maturity, care, gestation/developing clutches, recovery periods, parent IDs and offspring persist. All ten requested species have simulation rules. Durations are accelerated game rules.
- Wildlife now has species-specific routines and nearby-player reactions: flocking sheep, pecking chickens, hopping rabbits, slow-grazing cattle, rooting pigs, cantering horses, schooling fish, watchful browsing llamas, circling/perching birds and basking/hopping frogs. Young follow their actual mother. Wait quietly calms a nearby animal; Call nearby startles it; feeding also calms it. The panel shows its current activity.
- Place a Wildlife feeder outdoors and use it to transfer up to 12 feed from your supplies; hungry land animals approach and eat from it. Birds land on open Bird perches. Startled rabbits retreat to Rabbit shelters, routing around the shelter to its entrance. Use a perch or shelter to close/reopen wildlife access. These new entities and their state save with the world.
- Walk the countryside or use the map to visit three Shire neighbourhoods and the Fangorn elven clearing. Save & leave records your current pose. Continue restores the selected local world.
- Export backup writes a JSON file under E: `saves\backups`. Restore imports it into a new slot. Recover previous creates a separate slot and preserves a damaged original.

## Storage and launcher

`scripts\shire-local.ps1` supports Prepare, Build, Start, Stop and Status. Start opens a browser only with `-OpenBrowser`. Stop verifies and stops only the recorded Shire Node process. The listener binds to loopback. E: is required; no C:/D: data fallback is used.

The launcher points `front\.shire-next` at E: `builds\next`, and directs new temp/Node caches to E:. It preserves the existing `.next`. All world revisions use validated UUID directories, checksummed revision files and atomic current/previous heads. Each accepted action persists before success is returned. Simulation runs only while the world is actively polled; time does not jump forward when closed. The service validates local host, origin, session and request limits. It does not introduce fleet account, bag, wallet or character identity databases.

The isolated Next route uses the existing repo's Three loader plus its own local action/snapshot service. The shared density field serves both character collision and terrain-worker marching tetrahedra. Detailed terrain streams around the player; far countryside uses cheaper surface geometry. Unrelated shared multiplayer source is preserved.

## Assets and evidence boundaries

`scripts\prepare-shire-assets.mjs` verifies and copies the retained approved animated rabbit and all 124 evidence files to E:. Its final GLB SHA-256 is `8e175fae59f5c09a4adc10d3c82645b6c9bd3ddad0f4656a1133f782bf87437c`; canonical asset ID `3777b19b-676a-4d40-9175-104eee12b3e7` is retained. In-game scale/contact and motion acceptance remain separate from the upstream approval.

Existing GrudgeBlox human and high-elf kit models are NPC residents. The first-person player does not introduce a replacement hero asset. Sheep, chickens, cattle, pigs, horses, fish, llamas, birds and frogs currently use explicitly labelled development representations. They are not accepted production models. No new generation pipeline was launched.

The peoples workbook and separate atlas/races reports are copied with exact hashes in `assets\references` and the asset manifest. The 4 km square's hills, roads, pond, 44 public Shire homes and eight Fangorn homes are designed geography. A measured geometric map and fauna database remain unverified. Fangorn's elves follow Al's creative direction. Public homes are scenery and settlement anchors; custom excavated player homes are the editable interiors.

## Current validation

The 32 focused source/filesystem checks include excavation and roofs, walking collision, grouped Entry undo, sculpt dimensions/shapes, fitted-door boundaries, furnishings/storage, timed crops, breeding/family persistence, wildlife habitats/reactions, feeders/perches/shelters, imports, backup/recovery and revision retention. Six live service checks include current-player observations for wildlife. Reports are in E: `evidence\source-checks-latest.json`, `service-checks-latest.json` and the uniquely named storage-check folder.

Al reported a positive gameplay pass for the initial elements on 6 September 2026. That acceptance is retained. The new wildlife/building expansion has source, build, service and fresh-review evidence; its new controls and visuals await the next gameplay pass. All eight pre-expansion worlds were exported and snapshotted on E: before rebuilding; their 16 current/previous revision heads were checked for compatibility and preservation.

Production build and manual gameplay evidence are tracked separately in E: `evidence`. The coordinator controls the exclusive desktop test slot. No commit, push, deployment, paid service, public listener, user-file deletion or unrelated app/GPU interruption is included.

## Reusable administration worker

The dedicated worker `shire-local-admin-v1` lives in `E:\GrudgeBloxData\TheMiddleEarth\admin-worker`. Run a single pass from PowerShell:

```powershell
& 'C:\Program Files\nodejs\node.exe' 'E:\GrudgeBloxData\TheMiddleEarth\admin-worker\run.mjs'
```

It checks E: capacity, the recorded local server identity and entry route, source/build/check freshness, retained asset hashes and rabbit approval evidence, and existing animal-catalog metadata. It writes only its own state, backlog and dated reports. `WORKER.md` describes how to reuse it; `state.json` points to the latest report. A concurrent invocation is refused. Each invocation finishes after one pass; there is no scheduled monitor. Operational health cannot establish gameplay or visual acceptance.
