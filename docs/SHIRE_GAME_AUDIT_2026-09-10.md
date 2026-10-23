# The Shire in GrudgeBlox — current-state and immersive-game audit

**Audit date:** 10 September 2026, Australia/Perth.  
**Source:** `D:\grudgeblox`, saved `main`, commit `436fe319ed1f4270c9c192be48ab2e2e7d1b6457` (9 September, “the shire”). The working tree was clean at the start.  
**Runtime data:** `E:\GrudgeBloxData\TheMiddleEarth`.  
**Scope:** Analyse the existing local Shire game and identify the work needed for a coherent, immersive game. This audit does not implement the proposed features.

## Assessment

The Shire is a substantial playable local sandbox. Its strongest systems are continuous regional geography, editable underground homes, persistent farming and animal families, and a shared combat simulation. It has a much larger foundation than the older four-kilometre demonstration described in some project notes.

The main shortfall is the connection between systems. Players can build a home, grow produce, breed animals, travel, and fight, but few of these activities change their standing in the world or enable a meaningful next activity. Villages have buildings and residents without functioning households, services or social relationships. Encounters have health and attacks without quest context, rewards or regional consequences. The map supplies a large setting without enough activity between its destinations.

**Recommended next milestone:** a complete, repeatable Hobbiton–Bywater life-and-adventure loop, incorporating one usable home, an enterable inn, named residents with daily routines, useful produce and crafted goods, a persistent local quest chain, and an optional nearby threat. Expand this working pattern across the atlas after its play quality is demonstrated.

This assessment is qualitative. No percentage-complete estimate is justified without an agreed final game specification.

## What was verified

| Evidence | Result and boundary |
| --- | --- |
| Current source | Inspected the Shire UI, scene, atlas, terrain, building, simulation, wildlife, combat, save store, API, launcher and asset registration. Counts below were calculated from executable source. |
| Current source checks | **67 passed:** 32 gameplay/storage/building/wildlife checks, 18 combat checks, 10 atlas checks and 7 scenery checks. These establish bounded rules, not whole-game acceptance. |
| Type checking | The dedicated Shire TypeScript configuration passed with no emitted files. |
| Retained production build | Build `tCgqWqjx6217IEyNCYQzg`, dated 8 September 2026. It was run on `127.0.0.1:4110` with a separate audit data folder. This was not a fresh production rebuild of the 9 September commit. |
| Fresh browser inspection | Created an isolated atlas world; inspected Hobbiton, settlement overview, animal-care panel, atlas destinations, Old Forest travel, creature journal and an Orc encounter. Seven screenshots retained. No captured browser errors; two deprecation warnings concerning the graphics clock and soft-shadow mode. |
| Frame-rate observations | Stationary scenes displayed about 60 FPS. Readouts immediately after the two sampled travels dropped to 40 and 36 FPS before settling. These are the game's displayed moving-average readings, not frame-time or hardware performance certification. |
| Asset integrity | All **29 registered GLBs**, totalling **127,484,144 bytes** (about 121.6 MiB), matched their recorded size and SHA-256. Integrity does not establish artistic approval or prove every animation works in every situation. |
| Existing saves | **14 original saved worlds**, all 28 current/previous heads readable, checksummed and valid under current validation. Only two already contained persistent combat state on disk; opening older worlds adds it in memory. |
| Preserved state | Original worlds were inspected directly from disk. Browser activity used an isolated audit save. Final preservation results are retained beside this report's evidence. |
| Earlier gameplay evidence | The 8 September combat integration report records a broader encounter/combat pass. That is historical evidence, not a fresh repetition of every fight in this audit. |

The normal port-4100 game service was not listening when this audit began. The audit service was separate and was stopped after inspection. No original world was opened through the running service, and no game code, assets, source branch or deployment was changed. The final check found **all 28 original save heads unchanged**.

The prepared **The Shire · Tolkien atlas** save currently contains no player terrain edits, furnishings or crops and has its 14 founding animals. A developed older creative-world save contains 319 terrain edits, eight furnishings and five crop records. These saved snapshots show that durable player construction exists, while a developed atlas homestead and its full gameplay loop still need a dedicated current-build playthrough. Save contents alone do not establish how extensively a player has explored or accepted the game.

Evidence folder: [game-audit-2026-09-10](E:/GrudgeBloxData/TheMiddleEarth/evidence/game-audit-2026-09-10). Structured inventory: [source-inventory.json](E:/GrudgeBloxData/TheMiddleEarth/evidence/game-audit-2026-09-10/source-inventory.json).

## Current features and player capabilities

### World, geography and exploration

New worlds use `shire-atlas-1`, a **310 × 270 km** regional rectangle: **83,700 km² of bounds**, including Shire/Bree surroundings. This is the generator's coverage, not a claim that every square kilometre has authored gameplay, or that the rectangle is the canonical area of the Shire.

The source contains **37 inhabited settlement/farm/house sites, 675 public building plots, 43 travel destinations, seven rivers and 21 regional road polylines**, plus the local entrance/path network. Rivers are the Brandywine, The Water, Stock-brook, Thistle Brook, Shirebourn, Withywindle and Northern tributary. Named locations, terrain heights and local building layouts have different evidence bases; numerical elevations and settlement reconstruction are designed rather than surveyed Tolkien measurements.

Players can walk, run, jump, swim, dive, travel instantly to any listed destination, return to their home marker, and inspect an area or principal landmark through overview cameras. All travel destinations are available immediately. There is no discovery prerequisite, journey cost, route quest or transport timetable.

The regional terrain streams around the player. Nearby terrain uses a two-metre surface mesh; edited ground uses a finer volume mesh. The shared density field supports floors, walls, roofs, collision and digging. Roads, rivers, bridge approaches, village lanes and front walks are represented. Three authored bridge sites are registered; smaller crossings can use fords. The Bucklebury Ferry has scenery, but no working ferry journey.

The atlas includes differentiated pastoral, woodland, marsh and downland scenery. Woodland has oak, beech, birch, willow, alder and hazel forms, instancing, two detail levels, shrubs and fern-like undergrowth. The existing forest check samples 11,999 trees in one square kilometre of Old Forest. That is a local sample, not a count of separately simulated forest entities throughout the region.

**Important limit:** vegetation is visual scenery. A source diagnostic at an actual generated tree returned clear walking space at its trunk centre. Public building and bridge collision exists, but generated trees, many scenery fences, the High Hay and decorative props are not generally included in the shared collision system.

Older `shire-1` saves retain a four-kilometre-square creative world with Millbrook, Greenbank, Willow End and the Fangorn clearing. They preserve their own terrain and additions. The normal new-world UI now creates atlas worlds; it offers no generator selector.

Sources: [atlas](D:/grudgeblox/shared/shire/atlas.ts:11), [terrain collision](D:/grudgeblox/shared/shire/terrain.ts:40), [landscape](D:/grudgeblox/front/game/shire/AtlasLandscape.ts:72), [woodland](D:/grudgeblox/front/game/shire/AtlasWoodland.ts:32).

### Building and home ownership

The player can mark a home outside protected settlements, dig an Entry tunnel, extend rooms and passages, lower floors, raise ceilings, sculpt ground, refill it, and undo/redo terrain edits. This is genuine saved underground space, including earth above enclosed rooms.

Entry searches for an 8–20 metre descending tunnel ending in a level covered chamber. It groups its edits for undo. Construction uses a translucent preview and rejects several unsafe operations, including insufficient earth above a room and changes that would bury the player. Furniture placement checks nearby support and can reject blocking the existing route outdoors.

Player controls include room dimensions, sculpt shape, separate brush width/height/depth and rotation. Sculpt controls cover 0.5–6 metres; room width is exposed as 2–6 metres and height as 2.5–4 metres. Entry internally clamps its tunnel width to four metres, so its UI should communicate that limit more clearly.

There are **11 furnishing types**: table, chair, bed, shelves, household chest, round door, lantern, fence, wildlife feeder, bird perch and rabbit shelter. Doors open and close; fitted doorframes obstruct passage around the round opening. Lanterns toggle light. Beds advance 60 seconds of simulation, restore health and stamina, cure effects and refill three healing draughts. Feeders and habitats support wildlife care. Tables, chairs and shelves are decorative; there are no sit, read or table-use activities.

Construction and catalogue furniture are free. There is no timber/stone gathering, construction recipe, workbench, tool quality, material cost or unlocking system. The home marker is a single coordinate, not a property boundary, named household or persistent social ownership record. Building generally relies on range and public-area restrictions rather than ownership of a plot.

Existing hard limits are **1,500 terrain edits**, **1,000 furnishings**, **500 crop records** and **100 animals** per world. These are implementation budgets, not an unlimited building system. Terrain has undo/redo; furnishing removal does not have a corresponding general editing history.

Sources: [building plans](D:/grudgeblox/shared/shire/building.ts:6), [construction actions](D:/grudgeblox/shared/shire/simulation.ts:66), [furnishing catalogue](D:/grudgeblox/shared/shire/model.ts:54).

### Farming, supplies and household storage

Players start with **40 barley seeds, 40 carrot seeds and 80 feed**. They can till/plant barley or carrots on supported dry outdoor ground, water each plant and harvest after 60 seconds of active growth. A harvest returns three produce, two seeds and four feed. Seeds and feed can therefore grow quickly without a broader resource cost.

A nearby household chest transfers all barley/carrots between carried supplies and one world-level storage total. Multiple chests access the same household totals. There is no item-by-item container inventory, capacity, carried weight, equipment bag, currency, shop or trade ledger in this mode.

The current useful loop is **plant → water → harvest → feed animals → breed animals**. Produce itself mainly accumulates or is stored. It cannot yet be eaten, cooked, brewed, milled, sold, gifted or used to fulfil a request. Decorative village fields and market produce are separate scenery, not functioning crop or shop inventories.

There are no crop seasons, soil fertility, weather-driven watering, pests, harvest quality or varied regional crops. These are optional depth choices; useful outputs and reasons to grow food should precede a complex agronomy simulation.

A concrete rule inconsistency was reproduced in memory: planting a carrot at the protected Hobbiton spawn was accepted. Public-area protection is enforced for building and furnishing, but the plant action lacks the equivalent check.

Sources: [crop/storage actions](D:/grudgeblox/shared/shire/simulation.ts:111), [saved supplies](D:/grudgeblox/shared/shire/model.ts:20).

### Animals and wildlife

The simulation supports **ten species**, but a normal new atlas world starts with **seven species and 14 animals**, all clustered around the Hobbiton starting area. It deliberately skips fish, frogs and llamas. The older creative generator starts one adult female/male pair of all ten species, for 20 animals.

| Species | New atlas population | Current behaviour | Asset state |
| --- | ---: | --- | --- |
| Sheep | 2 | Grazing, flocking, fleeing, feeding, breeding | Development representation |
| Chicken | 2 | Pecking, scattering, feeding, developing clutch | Development representation |
| Rabbit | 2 | Hopping, fleeing, shelter approach, breeding | Retained approved asset; in-game acceptance remains distinct |
| Cattle | 2 | Grazing, resting, feeding, calves following mothers | Development representation |
| Pig | 2 | Rooting, feeding, fleeing, breeding | Development representation |
| Horse | 2 | Cantering, shying, feeding, breeding | Development representation; not rideable |
| Bird | 2 | Circling, flight reactions, perching, developing clutch | Development representation |
| Fish | 0 | Legacy pond schooling and offspring rules | Development representation |
| Frog | 0 | Legacy bank basking, hopping and offspring rules | Development representation |
| Llama | 0 | Legacy browsing, watching and breeding | Development representation; omitted from atlas preset |

Animal care is more developed than a simple ambient animation. It includes sex, age, maturity, feeding duration, pregnancy/developing clutch, parental identities, offspring, recovery periods, current activity, calm/startle state, health and defeat/return. Young can follow their actual mother. The panel filters species, sorts by distance, explains failed breeding conditions and displays family relationships.

Feeders accept up to 12 feed and attract nearby hungry land animals. Birds can land on open perches. Startled rabbits can approach an open shelter. None of these supplies a means to transfer the founding animals to a distant player home. There is no lead, tame, adopt, herd-to-location, mount, animal purchase or relocation command.

Wildlife remains home-centred, with short movement ranges. There is no biome-based regional spawning, population replenishment, seasonal migration or substantial predator/prey ecology. The combat system permits attacks on wildlife, but that is not a complete food chain. There is also no egg, milk, wool or manure production, fishing activity, individual temperament progression or animal naming UI. Parent records exist; breeding does not currently reject close relatives.

The wildlife movement rules still use the original constant water level and original frog refuge coordinates. Atlas fish/frog support needs a regional-water adaptation and appropriate spawning, not just removal of the generator's skip condition. The generic accepted-animal loader currently fits every incoming species to the same 0.65-metre maximum dimension and plays its first clip; it needs species-specific scale and animation mappings before adding full horse/cattle/etc. packages.

Sources: [world creation](D:/grudgeblox/shared/shire/simulation.ts:10), [wildlife behaviour](D:/grudgeblox/shared/shire/wildlife.ts:27), [breeding rules](D:/grudgeblox/shared/shire/animalCare.ts:4), [asset fitting](D:/grudgeblox/front/game/shire/ShireScene.ts:150).

### Residents and settlement life

The new atlas generator creates **215 resident actor records** across its 37 inhabited sites. Most places receive six residents, Bamfurlong four and Tom Bombadil's site one. Six residents is also the count for larger settlements such as Michel Delving and Bree; the number does not scale with their actual building population.

Residents are loaded near the player, walk small local circuits, have health, retaliate when attacked, can be defeated and return after a delay. Their identities are generic labels such as “Hobbiton resident 1.” They do not have named household membership, occupations, personal inventory, relationships, memories, schedules or dialogue trees.

**“E · Greet” currently displays the resident's name and health.** It does not start a conversation. The atlas uses an existing human model scaled down for most Shire residents; it does not provide distinct authored Hobbit characters. The legacy Fangorn clearing uses the retained elf kit. The place named Tom Bombadil supplies a house and one generic resident record, not a developed Bombadil character interaction.

Public buildings have exterior forms and collision. Inns, halls, homes, barns, mills, smithies and markets do not provide explorable public interiors or their implied services. The mill waterwheel is geometry without a milling production system. Quarry rocks cannot be mined; decorative orchards cannot be harvested. The Old Man Willow landmark is scenery, and barrow mounds do not provide a dungeon interior or scripted barrow encounter sequence.

Sources: [resident creation and patrols](D:/grudgeblox/shared/shire/combat.ts:44), [resident rendering](D:/grudgeblox/front/game/shire/ShireScene.ts:149), [greeting implementation](D:/grudgeblox/front/game/shire/ShireScene.ts:157), [landmark scenery](D:/grudgeblox/front/game/shire/AtlasLandscape.ts:128).

### Hostile entities and combat

Both generators create **26 hostile actor records: 25 representatives plus Cinderlord**. These are individual encounter representatives, not 25 fully implemented civilizations or regionally distributed enemy populations.

| Group | Current representatives |
| --- | --- |
| Orcs | Orc Scout, Uruk-hai Soldier, Half-orc Enforcer |
| Trolls | Cave Troll, Olog-hai |
| Great beasts and predators | Northern Fire-drake, Great Spider, Warg, Werewolf of Tol-in-Gaurhoth, Vampire Messenger, Fell Beast |
| Human hostile factions | Easterling Warrior, Wainrider Raider, Balchoth Spearman, Haradrim Warrior, Variag of Khand, Black Numenorean, Corsair of Umbar, Dunlending Axeman, Rhudaur Hillman |
| Wraith/undead representatives | Nazgul, Barrow-wight |
| Water/deep creatures | Watcher in the Water, Nameless Thing |
| Flame beings | Balrog, original Cinderlord |

The journal explicitly describes the encounters as creative additions and the human entries as hostile factions. Region and era are not enforced by the spawn algorithm. Atlas positions are principally selected by town-array index and radial offsets. For example, the Barrow-wight is currently near Michel Delving rather than at the named Barrow destination; the Watcher is put in Bywater Pool. This is a content-placement issue requiring an authored encounter policy.

Combat includes server-owned health, armour, stamina, attack cooldowns, windups, attack warning rings, blocking, damage resistance, burn/poison effects, healing draughts, death and recovery. Players start with 100 health and fixed armour. Their single melee strike uses 28 raw physical damage, a 0.65-second cooldown and 16 stamina, with validated reach and a clear attack path. Guard lasts two seconds and depends on facing. There are three healing draughts, restored through bed use. Falls and drowning can damage or defeat the player.

Hostiles patrol, detect targets, pursue, wind up, strike, recover and return home. They can attack the player and eligible nearby residents/animals. Home proximity provides protection. Residents retaliate. Defeated players can recover at home after three seconds; supplies and construction remain. Most hostiles return after two minutes, some after longer timers; residents return after three minutes and animals after five.

The journal can visit every encounter immediately and retry failed models. Hostile models load near the player and unload at distance. The registered assets expose named animation clips and health overlays.

Depth is limited by one general player strike, fixed equipment, a shared small state machine, and mostly numerical enemy variation. There are no weapon choices, ranged attacks, ammunition, equipment progression, loot, experience, skill unlocks, faction reputation or persistent encounter completion rewards. Stepping away from a warned strike is possible, but there is no dedicated dodge-roll mechanic. Wargs have no coordinated combat pack tactic; Wainriders and Corsairs fight on foot. The dragon's encounter moves on the ground, and flying enemies use low-altitude movement. Water movement is implemented for the Watcher. General pathfinding through arbitrary buildings, tunnels and fences is absent.

Sources: [roster and statistics](D:/grudgeblox/shared/shire/hostiles.ts:14), [spawn placement](D:/grudgeblox/shared/shire/combat.ts:30), [player actions](D:/grudgeblox/shared/shire/combat.ts:95), [enemy behaviour](D:/grudgeblox/shared/shire/combat.ts:146), [combat view](D:/grudgeblox/front/game/shire/WorldCombatView.ts:39).

### Persistence and local architecture

The Shire runs as an isolated local mode inside GrudgeBlox, using its own local action/snapshot service. It is currently **single-player**, with one saved player pose and one local player combat record. The broader GrudgeBlox multiplayer architecture does not make this route multiplayer. Existing platform accounts, player inventories and networked-world capabilities should not be counted as Shire features without integration.

The save system is a useful foundation: UUID world directories, validated records, checksums, atomic writes, current/previous heads, bounded retained revisions, revision conflict detection and backup export. Import and recovery create separate save slots. Actions persist before success is reported. Active observation advances the simulation and checkpoints periodically. There is no intended offline growth; long gaps do not advance the whole elapsed absence.

It stores player position, the home marker, terrain edits, furnishing states, crops, animals, household supplies and optional combat state. It does not yet store the proposed social, quest, item, discovery, schedule or economic systems.

Source and UI both poll every 250 ms and return the complete world snapshot. A fresh atlas sample serialized to about 138 KB. Four such snapshots per second imply about 0.55 MB/s of JSON before headers/compression, even when little changes. All resident actors are also processed for their basic patrols. Three diagnostic 0.25-second source advances took roughly 34–44 ms on this PC; that is a small indicative sample, not a load test. A larger living population needs local activation and efficient state changes before the current caps are raised.

Streaming already exists, but unedited terrain and major scenery rebuilds still execute synchronously on the render thread. The woodland region rebuilds around 384-metre anchor changes. The next engineering step is to remove those stalls while retaining stable positions, correct collision and persistent edits.

Sources: [local save store](D:/grudgeblox/back/src/shire/LocalWorldStore.ts:20), [polling](D:/grudgeblox/front/components/shire/ShireGame.tsx:56), [local guard](D:/grudgeblox/front/lib/shireServer.ts:11), [scene terrain work](D:/grudgeblox/front/game/shire/ShireScene.ts:116).

## User options actually exposed

| Surface | Available now | Important omissions |
| --- | --- | --- |
| Welcome screen | Name a new world; Continue; Recover previous; Restore JSON backup | Rename/delete/archive slots, sorting/filtering, seed input, generator choice, game-mode choice |
| Explore | Mouse capture or right-drag look; WASD/arrow movement; run/jump; interact; swim/dive | Character creation, third-person view, camera sensitivity/FOV settings, rebinding, controller/touch movement |
| Build | Home marker; Entry, Room, Passage, Sculpt, Lower floor, Raise ceiling, Add earth; dimensions, turn, preview, undo/redo | Construction materials, blueprint selection, snapping, furniture move/copy, general undo history |
| Furnish | Eleven catalogue objects, rotation, place/use/remove, chest store/take | Item ownership, quantities, catalogue progression, useful sitting/reading/cooking activities |
| Farm | Choose barley/carrots, plant, water, harvest, view supplies | Recipes, consumption, trade, crop quality, farming progression |
| Animals | Pair selection, feed, calm/startle, species filter, family details, status/distance | Rename, acquire/adopt, lead/relocate, ride, animal products, habitat placement guidance |
| Creatures | Roster descriptions/stats, direct encounter travel, model retry | Discovery journal, difficulty selection, peaceful setting, rewards, encounter progression |
| Map | Regional/local map, 43 destinations, home return, area/landmark cameras | Waypoints, route directions, distance/time estimates, discovered-place filtering, usable transport |
| Combat HUD | Player/target health, stamina, breath/effects, strike/guard/heal, recover after defeat | Equipment selection, attack variety, nonviolent mode, scalable HUD or colour/contrast choices |
| Help/save | Basic activity instructions, control text, backup export, save/leave | Interactive tutorial stages, actual pause menu, audio/graphics/accessibility settings |

F applies the selected construction/farming tool outside Explore and strikes in Explore. Left click also strikes/applies while mouse capture is active. E interacts, Q guards, H heals, Space jumps/swims up and left Ctrl dives. Escape releases input; **it does not explicitly pause the simulation**. Overview also stops player movement without creating a gameplay pause.

There is no Shire audio implementation found in the inspected scene/component paths. The visible day/hour display is derived from a 600-second game day, while sunlight and sky settings remain fixed. This is a simulation clock without a completed day/night presentation, weather or calendar.

The UI is readable and offers direct activity tabs, but the large home-building prompt remains present even at the Old Forest and encounter overlooks. The current compass decoration uses a fixed rotation. The Shire route reuses GrudgeBlox's app identity; the root web manifest launches `/` and describes the broader platform. A dedicated local-game entry and coherent icon/shortcut treatment remain presentation work if Shire is to feel like its own launched game.

Sources: [full player UI](D:/grudgeblox/front/components/shire/ShireGame.tsx:66), [input and camera](D:/grudgeblox/front/game/shire/ShireScene.ts:90), [fixed light setup](D:/grudgeblox/front/game/shire/ShireScene.ts:75), [platform manifest](D:/grudgeblox/front/app/manifest.ts:3).

## Missing components, ordered by game value

The following are proposed work, not claims about existing functionality. Priority reflects the value of an immersive local Shire game rather than public release or multiplayer infrastructure.

| Priority | Component to implement | Player benefit | Concrete acceptance condition |
| --- | --- | --- | --- |
| 1 | A persistent introduction and connected quest/objective system | Establishes what the player is doing and why | A new player can meet a resident, establish a home, fulfil a request, receive something useful and resume the next objective after reopening. |
| 1 | Named NPCs, households, jobs and daily schedules | Turns settlements into communities | At least several named residents move between assigned home/work/social locations, offer distinct interactions and remember completed dealings after reload. |
| 1 | Enterable public buildings and services | Makes inns, shops and civic buildings meaningful | The player can enter a furnished inn, interact with its keeper, obtain a meal/rest/service, leave safely and retain the outcome. |
| 1 | Useful items, recipes, consumption and local trade | Connects gardening, gathering and home life | A grown ingredient can become food or another useful good, be used/traded/gifted, and change a persistent need, supply or objective. |
| 1 | Regional and era rules for encounters, plus player-facing peaceful/adventure settings | Supports both calm Shire life and intentional danger | A peaceful world avoids hostile interruption; an adventure world places threats in authored appropriate areas and preserves that choice in its save. |
| 1 | Consistent world collision, interaction and public/owned-land rules | Makes the visible world trustworthy | Tree trunks, important fences and gates behave as expected; planting/building/removal apply the same intended ownership rules; player and NPC routes remain usable. |
| 1 | Real pause and adjustable controls/readability | Makes long play comfortable | Pause stops local simulation explicitly; remapping, mouse settings and readable UI options persist. Gamepad/touch support is verified only for intended devices. |
| 2 | Day/night, spatial environmental audio and contextual music | Makes time and place perceptible | Dawn/dusk/night visibly change the scene; footsteps, birds, river, doors, work and combat have appropriate sound; volume controls work. |
| 2 | Home progression and an intentional resource model | Gives a reason to improve the home | Adventure construction uses coherent resources/unlocks; creative construction remains available as an explicit choice; furnished spaces enable useful activities. |
| 2 | Farm and animal livelihood | Makes care support the household | Animals can be brought home and cared for there; eggs/milk/wool or selected equivalent outputs feed recipes/trade; farming has varied useful outputs. |
| 2 | Population and habitat systems | Makes travel encounter ordinary life | New areas activate appropriate animals, workers and travellers; leaving/revisiting avoids duplication or losing persistent individual state. |
| 2 | General navigation and richer behaviour | Supports believable NPCs and varied threats | Residents reach work and return home through doors/paths; animals use enclosures; enemies route around valid obstacles and respect their territory. |
| 2 | Combat identity, rewards and consequences | Makes optional danger satisfying | Several genuinely different enemy behaviours and player choices are tested; success changes an objective, reputation, discovery or tangible reward. |
| 2 | A practical travel system | Makes a full-size region usable | Players can follow a route, understand distance/time, use a supported pony/ferry/other chosen transport, or take a clearly designed fast-travel option. |
| 2 | Scenery and simulation performance budgets | Keeps extended play smooth | Repeated village/forest/interior transitions show measured acceptable frame-time and memory behaviour; edited terrain and NPC state remain correct. |
| 2 | Consistent production art and motion | Makes the world feel visually unified | Hobbit residents, livestock, architecture, props and hostile models pass in-game scale, ground contact, animation transition and visual review. |
| 3 | Weather, seasons, festivals, local news and changing routines | Gives repeat visits variation | Chosen changes affect activities and NPC behaviour, remain legible and persist without breaking core food/home/quest loops. |
| 3 | Broader regional stories, caves/barrows and landmark interactions | Makes distant destinations worth visiting | Each expanded region has distinct interactive content, approach routes, local actors, outcomes and reasons to return. |

A skills system does not need to be a combat level ladder. Cooking, gardening, animal care, craft, exploration and neighbourly reputation are stronger default progression candidates for the current “A home in the Shire” premise. Hunger, thirst, illness, equipment wear and severe death penalties are optional design choices. Add only the ones that improve the intended experience.

Multiplayer/co-op is a separate possible expansion, not a prerequisite for the requested immersive local game. If later selected, the current client-position observation and one-player save model require a dedicated integration design. The existing local service should not simply be exposed on the network.

## Recommended implementation sequence

### Milestone 1 — trustworthy and playable starting village

Set the game's default experience explicitly: home life with optional adventure, with a preserved creative mode for unrestricted building. Define what belongs in the atlas baseline and what belongs in the creative encounter catalogue.

Repair the known collision and land-rule gaps. Add a real pause menu and core comfort settings. Make help contextual, so a new player's next action is clear and the initial building card does not occupy every later activity. Make save metadata identify generator and game mode; offer a clear save list separate from old verification worlds without deleting those worlds.

**Exit condition:** a player can start, learn controls, claim a sensible site, safely establish a usable home, save/leave/continue and understand the current objective without external instructions.

### Milestone 2 — complete one local life loop

Develop a small set of named Hobbiton/Bywater residents and their homes/jobs. Make one inn and one other service interior work. Add a small structured item/recipe/transaction system and a quest chain which uses the existing farm and home systems. Give farming outputs real purposes. Add ways to bring selected animals to the player's home and care for them there.

Example design: meet an innkeeper, supply garden ingredients, help prepare a meal, trade or receive a useful household item, improve the home, then learn of an optional local problem. This is a proposed sequence; it is not current quest content.

**Exit condition:** a 30–60 minute play session has several connected activities, a satisfying outcome and an obvious reason to return; progress survives reopening and the world acknowledges it. Treat that duration as a design target to play-test.

### Milestone 3 — atmosphere and purposeful adventure

Add spatial sound and a real daily cycle tied to NPC schedules. Give optional threats authored territories and differentiated behaviours. Add route discovery, a small dungeon or equivalent interactive landmark, meaningful rewards and persistent outcomes. Complete the high-visibility Hobbit/animal art and interaction animations.

**Exit condition:** ordinary home/village play and optional danger feel like parts of the same world; time of day, sounds, NPC routines and outcomes reinforce each other.

### Milestone 4 — extend across the regional atlas

Introduce chunk/region ownership of persistent entities, sleeping simulation for distant populations, cached or asynchronous scenery work and lighter state updates. Add travel support before expecting players to traverse realistic regional distances manually. Repeat the proven settlement pattern with variation in occupation, architecture, wildlife, services and stories.

At current movement constants, even a flat uninterrupted 10 km trip is about 46 minutes walking or 24 minutes running; a 100 km run is nearly four hours. These are arithmetic illustrations from 3.6 m/s walking and 7 m/s running, excluding obstacles. Full geographical scale needs designed travel pacing and things to do along routes.

**Exit condition:** new districts add distinctive play without losing fluid movement, coherent NPC state, save integrity or the quality of the starting area.

## Implementation foundations worth keeping

Keep the existing terrain density field, save identity/revision system, animal family records, atlas coordinate conversion, asset provenance and shared combat rules. Their responsibilities are already valuable.

Extend the local saved-world model with explicit versioned records for items/recipes, households/residents, interactions/dialogue, quests/objectives, relationships/reputation, discoveries, and persistent game settings. Give each record a stable identity. Introduce save migrations and recovery for those additions rather than overwriting older worlds.

Use authoritative local actions for transactions and quest progress, with a shared interaction description that the UI can display consistently. Scenery that becomes usable needs an interaction record and matching collision/navigation representation, not just a labelled mesh. A public inn should have a stable building identity, doorway, interior, assigned keeper and service state.

Separate simulated state from what is currently visible. Generating every resident in a large world does not require animating or frequently updating all of them. Existing stable woodland placement and near/distant scene handling can be extended into region-owned entities with carefully selected active simulation.

Additional model generation is not the main dependency for the first milestone. The existing catalogue already supplies enough visual variety to build and assess a coherent short game. For each new asset package, bind its actual height and semantic animations to the relevant behaviour; a file containing clips alone is insufficient.

## Documentation and evidence corrections

| Existing description | Current interpretation |
| --- | --- |
| “Four kilometres across” | Correct for original creative saves. New atlas worlds use 310 × 270 km regional bounds. |
| “Ten species” / “ten adult pairs” | Correct for supported simulation and legacy generation. Normal atlas creation currently produces seven pairs; fish, frogs and llamas are absent. |
| “Populated towns” | Means public scenery plus 215 generic resident actor records. It does not mean functioning NPC households or town services. |
| Public doors, mills, markets and ferry scenery | Visual representations do not establish explorable interiors, production, trading or transport. |
| Old Cinderlord note: transient encounter, no persistent health, six strikes, 45-second return | Superseded by the shared combat implementation and current hostile definition. The old file/controller still exists; active gameplay uses the shared combat view. |
| “Day 1, 09:00” | A time display exists. It currently does not imply a changing sun, night lighting or schedules. |
| Earlier “all encounters verified” report | Useful historical 8 September evidence. This audit rechecked registered assets, source rules and selected runtime views, not every fight/clip. |
| Complete GrudgeBlox platform features | Only features actually wired into `/play/shire` count toward this Shire assessment. |

Reference documents: [local-world notes](D:/grudgeblox/docs/SHIRE_LOCAL_WORLD.md), [atlas integration](D:/grudgeblox/docs/SHIRE_ATLAS_INTEGRATION.md), [combat integration](D:/grudgeblox/docs/SHIRE_COMBAT_INTEGRATION.md), [older Cinderlord note](D:/grudgeblox/docs/CINDERLORD.md).

## Fresh visual evidence

These are unretouched screenshots of the retained local build in the isolated audit world.

### Hobbiton overview

![Current Hobbiton village overview](E:/GrudgeBloxData/TheMiddleEarth/evidence/game-audit-2026-09-10/02-hobbiton-overview.png)

The settlement has coherent paths, bridges, home exteriors, gardens, livestock and trees. Repeated building forms, sparse resident activity, simple materials and the absence of usable village interiors remain apparent limitations.

### Old Forest

![Current Old Forest walking view](E:/GrudgeBloxData/TheMiddleEarth/evidence/game-audit-2026-09-10/05-old-forest.png)

The woodland is visually denser and more enclosed than the village, with different trunk/canopy forms. Sound, interactive vegetation, traversal collision and distinct forest events are the next contributors to an immersive forest experience.

### Encounter approach

![Current Orc encounter approach](E:/GrudgeBloxData/TheMiddleEarth/evidence/game-audit-2026-09-10/07-orc-encounter.png)

The journal successfully brought the audit player to the encounter and the Orc model/health display rendered. This image does not claim a fresh combat defeat or close-up animation acceptance.

## Appendix — complete settlement and travel inventory

The following numbers are generator outputs for the inspected source. Public buildings are exterior plots. Residents are actor records, generally streamed visually near the player. They are reconstruction/game-design counts, not historical or literary population estimates.

| Settlement/site | Public buildings | Resident actors |
| --- | ---: | ---: |
| Hobbiton | 19 | 6 |
| Bywater | 18 | 6 |
| Overhill | 19 | 6 |
| Needlehole | 16 | 6 |
| Nobottle | 19 | 6 |
| Waymeet | 19 | 6 |
| Tookbank | 19 | 6 |
| Tuckborough | 20 | 6 |
| Pincup | 19 | 6 |
| Woodhall | 19 | 6 |
| Stock | 19 | 6 |
| Rushey | 19 | 6 |
| Deephallow | 19 | 6 |
| Willowbottom | 19 | 6 |
| Frogmorton | 19 | 6 |
| Whitfurrows | 19 | 6 |
| Budgeford | 19 | 6 |
| Scary | 19 | 6 |
| Brockenborings | 19 | 6 |
| Newbury | 19 | 6 |
| Standelf | 19 | 6 |
| Haysend | 18 | 6 |
| Brandy Hall | 9 | 6 |
| Bucklebury | 19 | 6 |
| Crickhollow | 19 | 6 |
| Michel Delving | 33 | 6 |
| Little Delving | 19 | 6 |
| Oatbarton | 19 | 6 |
| Dwaling | 19 | 6 |
| Longbottom | 19 | 6 |
| Whitwell | 19 | 6 |
| Bamfurlong | 5 | 4 |
| Bree | 29 | 6 |
| Staddle | 17 | 6 |
| Combe | 17 | 6 |
| Archet | 17 | 6 |
| Tom Bombadil | 1 | 1 |
| **Total** | **675** | **215** |

Six additional travel destinations bring the total to 43: **Brandywine Bridge, Scary quarry, Bucklebury Ferry, Hay Gate, Old Man Willow and Barrow encounter**.

## Appendix — retained verification files

- [Executable-source inventory and saved-world/asset verification](E:/GrudgeBloxData/TheMiddleEarth/evidence/game-audit-2026-09-10/source-inventory.json)
- [32 gameplay/storage checks](E:/GrudgeBloxData/TheMiddleEarth/evidence/game-audit-2026-09-10/shire-smoke.txt)
- [18 combat checks](E:/GrudgeBloxData/TheMiddleEarth/evidence/game-audit-2026-09-10/combat-checks.txt)
- [10 atlas checks](E:/GrudgeBloxData/TheMiddleEarth/evidence/game-audit-2026-09-10/shire-atlas-checks.json)
- [7 scenery checks](E:/GrudgeBloxData/TheMiddleEarth/evidence/game-audit-2026-09-10/shire-scenery-checks.json)
- [Type-check output; empty means no diagnostics, exit status recorded separately](E:/GrudgeBloxData/TheMiddleEarth/evidence/game-audit-2026-09-10/typecheck.txt)
- [Browser warnings/errors](E:/GrudgeBloxData/TheMiddleEarth/evidence/game-audit-2026-09-10/browser-logs.json)
- [Final audit verification and preservation](E:/GrudgeBloxData/TheMiddleEarth/evidence/game-audit-2026-09-10/audit-verification.json)


