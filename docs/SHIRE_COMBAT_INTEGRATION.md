# Shire creatures and shared combat — 8 September 2026

All 25 hostile race/faction representatives are complete and integrated into the local Shire game, alongside the retained Cinderlord. Each export passed individual Blender reimport, visual and animation review. Screenshots were saved and Blender was closed after each entity. All 26 encounters were then visited in the running atlas game: textured models loaded and movement clips played without asset errors.

Open http://127.0.0.1:4100/play/shire, continue a world and choose **Creatures**. The journal describes every representative and provides encounter travel. Approach on foot or swim closer. **F** or captured left click strikes, **Q** guards for two seconds while facing the attacker, and **H** consumes a healing draught. **Space** swims upward; **Ctrl** dives. Resting in a bed restores health and replenishes draughts. The defeat screen recovers the player at home with brief protection.

## Delivered assets

- [Complete catalog: descriptions, Blender screenshots and models](E:/GrudgeBloxData/TheMiddleEarth/assets/hostile-races/CATALOG.md)
- [Visual gallery](E:/GrudgeBloxData/TheMiddleEarth/assets/hostile-races/gallery.html)
- Editable `.blend` files, self-contained `.glb` files, embedded PNG/PBR textures, rigs, named clips and manifests are under `E:\GrudgeBloxData\TheMiddleEarth\assets\hostile-races`.
- The existing asset API serves 25 registered copies totaling 88.6 MB. Human faction variants retain the current people skeleton and movements, with distinct skins, equipment and stature. The Balrog derives from a copy of the retained Cinderlord source.

The final three completed entities were the Barrow-wight, ten-armed Watcher and six-tendrilled Nameless Thing. Their native Blender screenshots and playback evidence are in their asset folders.

## Health and damage behavior

The existing world save owns one additive combat section. Player, hostile creatures, Cinderlord, residents and every wildlife species share it. Animal records retain their UUIDs and family relationships; newborns receive health immediately. No second inventory or identity database was added. Older worlds receive combat defaults when opened. Unopened saves are untouched.

The server owns damage amounts, health, armour, stamina, cooldowns, timed windups, elemental resistance, burning and poison, healing, death and respawn. It rejects missing/dead/self targets, out-of-range or obstructed attacks and invalid save data. Position observations cannot supply health or damage amounts. Physical hits account for armour; facing guards reduce hits and consume stamina. Fire and poison can leave timed effects. Healing cures effects. Breath runs down while submerged, then drowning damages health. Falls use observed height loss; entering water resets the fall measurement.

Hostile actors patrol, detect targets, chase, signal attacks, apply one impact per windup, recover and return home. Terrain, fitted doors and actor bodies constrain movement or attacks. Ground, airborne and water actors use appropriate movement clips. Nearby assets stream in and distant assets unload. Animation bounds are refreshed for nearby ray targeting, fixing the retained resident models' stale pick bounds. Health bars, target status, attack warnings and damage feedback are visible in play.

Defeated actors stop attacking and moving. Animals stop breeding and cannot be cared for until they return. Their panel displays health and recovery time. Residents retaliate when struck; living wildlife retain escape/care behavior. NPCs and wildlife return on their own timers. The player's home and supplies survive defeat. Timers advance during active local play and pause when the world is closed.

## Actual game verification

Input was applied through the running production game. Query-gated verification controls held normal movement keys and aimed the camera; they did not set health, inflict damage or bypass the action service. A separate original-world fixture began eight metres above land to exercise actual falling. The user's worlds were not used for destructive combat tests.

| Live check | Observed result | Evidence |
|---|---|---|
| Complete roster | All 25 new models plus Cinderlord visible with locomotion; no loader failures | roster-runtime.json and 26 game screenshots |
| Orc combat | Player strikes reduced health to zero; Orc stopped, then respawned once on its timer | orc-attack-sequence.json; initial-combat-events.json |
| Guard and heal | Normal Orc hit: 13 damage; guarded hit: 3. Draught restored 45 health | initial-combat-events.json |
| Player recovery | Defeat blocked actions; recovery restored 100 health and protection. State survived server restart | player-defeated.png; player-recovery.png |
| Poison | Spider applied poison; healing removed it and restored health | spider-poison-runtime.json; poison-in-game.png |
| Fire | Cinderlord GroundSmash played; guarded fire hit dealt 8 and applied burning | fire-combat-runtime.json; cinderlord-fire-combat.png |
| Flying combat | Vampire health: 75 → 48 → 21 → 0. Flight, attack and death clips observed | flying-defeat-verified.json; flying-defeated.png |
| Water combat | Player floated and swam; Watcher switched swim → grab, dealt 25 and received 23 damage | water-combat-runtime-verified.json; watcher-combat.png |
| Resident | Health: 65 → 38 → 11 → 0. Retaliation dealt 8 player damage, then ceased | resident-combat-verified.json; resident-defeated.png |
| Wildlife | Normal strike defeated a chicken; it later returned with health | wildlife-combat-runtime.json; original-world-combat-events.json |
| Falling | Actual descent from 18.33 to 10.23 metres reduced health from 100 to 54 | fall-damage-runtime.json; fall-damage.png |
| Drowning | Diving exhausted breath; environment hits dealt 10 each, ending in defeat and recovery | drowning-runtime.json; original-world-combat-events.json; drowning.png |

Evidence: [verification folder](E:/GrudgeBloxData/TheMiddleEarth/evidence/hostile-combat-20260908).

Dedicated test saves:

- Atlas: `121056c0-259c-4326-904e-74c344a67f00` — Creature combat verification — 8 September.
- Original: `c6814989-8968-4154-8559-c9327c7bedcd` — Original world combat verification (imported).

## Automated and build checks

- **18 combat checks passed:** identities in both generators, migration, range/cooldown/stamina, armour/resistance, blocking, effects, actor kinds, death/respawn, doors, residents, falls/water, invalid state, persistence/rejection preservation and every encounter approach.
- **32 existing Shire checks passed**, including building collision, furnishings, crops, breeding, wildlife and storage/recovery.
- **10 atlas checks passed**, including arrivals, geography, towns, water and old-world compatibility.
- The final production build, including type checking, passed and runs on `127.0.0.1:4100`.

Checks remain available in `scripts/shire-combat-checks.ts`, `scripts/shire-smoke.ts`, `scripts/shire-atlas-checks.ts` and `scripts/shire-local.ps1`. Output, roster snapshots, save events and preservation checks are retained with the screenshots.

## Preservation and practical scope

The five original source model files match the hashes recorded during authoring. All 25 runtime GLBs match their validated exports. All 24 current/previous heads of the 12 pre-existing saved worlds match their starting hashes. Existing dirty atlas/terrain/building work was retained on `D:\grudgeblox` main. No commit, push or deployment was performed.

The roster supplies one representative per entry. Human entries describe factions; designs and ambiguous beings are interpretations. Wainriders and Corsairs fight on foot. Dragon flight clips are provided; its current encounter uses ground movement. Flying enemies use low-altitude combat movement. Collision-aware steering is not a general route planner through arbitrary player-built mazes. The original Cinderlord uses a controller-driven collapse because its preserved file has no death clip. Existing non-rabbit livestock remain labelled development visuals, now with working health and damage.

All exported clips were reviewed in Blender. Live combat tests cover actor kinds and movement/damage families; they do not claim that every clip was exercised in gameplay or every possible terrain edit tested. Al's visual judgment remains separate from these observed checks.
