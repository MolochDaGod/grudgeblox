# The Shire — local game guide

Current implementation: 10 September 2026. Source: saved `D:\grudgeblox` main. Worlds, assets and builds: `E:\GrudgeBloxData\TheMiddleEarth`. This game runs on this PC without sign-in.

## Start playing

Double-click **The Shire.lnk** in `D:\grudgeblox`. The existing **Play The Middle-earth.cmd** also works. The launcher opens `http://127.0.0.1:4100/play/shire`. Continue a save or create a named world, choosing a seed, atlas or original geography, and play style.

| Style | Experience |
| --- | --- |
| Homestead | Default peaceful life: neighbours, earned improvements, gardens, animals and discovery. Hostile encounters are inactive. |
| Adventure | Home and village systems plus six authored regional threats, equipment, rewards and stories. |
| Creative | Free construction, supplied items, open travel and the retained encounter catalogue. |

Settings can change the style. Opened original worlds receive additive village-life state and initially use Creative to preserve their building and travel access. Their geography and existing objects remain.

## Your first home

1. Journal starts with **A place at the table**. Talk to Ada Goodbarrel in Hobbiton or enter the Ivy Bush. Finish the request with the neighbour to receive the reward.
2. Accept **A hill to call home**. Follow the suggested hillside waypoint. **Face direction** turns the view; walk there yourself. Build → **Mark this hill as home** claims the land.
3. Return to the carpenter to collect timber and bedding cloth. Journal's **Find neighbour** points to the workshop. Village search finds names, villages and professions; enter the building when the resident is indoors.
4. At your home marker, face clear ground and choose Household → **Starter smial**. Walk down the descending entrance into its covered chamber. Individual building tools can extend it.
5. Furnish a bed and chest. Aim at supported floor or use **Place on the floor ahead**. Keep the exit clear. Complete the carpenter's next requests.
6. Outside, face clear soil and use Household → **Kitchen garden**. Twelve watered plots cost six seeds of each crop. After 60 seconds of active play, Farm → **Nearby garden** offers harvesting.
7. Cook carrots and herbs into garden stew at a village kitchen. Complete the gardening/cooking requests and deliver a stew to the Green Dragon in Bywater.
8. Continue through animal care, a crafted lantern, discovery and a village gathering. Already-achieved objectives count when a request becomes available; each reward is collected once.

The journal has 11 introductory requests, 37 village requests and three regional stories. Completed objectives may still require their named neighbour before rewards can be collected.

## Controls and settings

| Action | Default |
| --- | --- |
| Walk / run / jump | W A S D / Shift / Space |
| Walk forward with the mouse | Hold LMB + RMB together; release either to stop |
| Point to a walking destination | Right-click dry, open ground; keyboard movement cancels |
| Select a creature or object | Left-click it, then interact or strike when within reach |
| Look | Right-drag, Explore mouse capture, or arrow keys and Page Up/Down |
| Interact | E or the contextual interaction button |
| Apply tool / strike while exploring | F |
| Guard / heal / dodge | Q / H / R |
| Swim up / dive | Space / Ctrl |
| Pause and release input | Escape or Pause |

Right-drag steers the view. Both-button forward movement works with this steering and uses normal collision, swimming and riding rules. Right-click travel follows a local route and stops on arrival or when blocked; walking, opening a panel, pausing or losing focus cancels it. Turn it off with **Right-click ground to walk there** in Settings. While Explore has captured the mouse, left-click uses the current tool or weapon.

Settings provides rebinding, sensitivity, vertical inversion, field of view, first/third-person camera, interface scale, contrast, reduced motion, quality, captions and separate master/music/effects volumes. Duplicate control bindings are rejected. Auto-pause on focus loss is configurable. Pause freezes simulation; ordinary activity panels leave the world running. Touch and gamepad controls are implemented; physical-device acceptance is separate from desktop checks. Character settings offer Hobbit/human appearance, a name and clothing colour.

## A useful village life

Atlas worlds contain 215 named residents, 37 settlements and 675 public buildings. Residents have professions, households, friendship, dialogue and daily destinations. They walk toward work, home, inns, markets and festivals; distant populations sleep to limit processing. These are authored game households, not a claim that every resident occurs in Tolkien's books.

Use Village search, Directions and Nearby doorways, or aim at a marked entrance and use the current Interact binding (E by default). Public interiors have furniture, kitchens and workbenches. Mills and smithies add specialised stations. Shared workshops allow visits to different assigned residents; Talk selects the person being addressed.

Trade shows quantities and prices. Gifts improve friendship once per resident per day. Hosts offer rest, meals, lessons, news and journey bookings. Lessons are limited to one per host per day. Food heals and grants a meal bonus; tea clears harmful effects. The satchel contains 35 item types and 16 recipes, with six skills gaining experience from useful actions.

Ten-minute days form seven-day seasons. Every third day is a market day and every seventh a festival. Share food at an inn or green for a reward, larger on festival days. Rain waters crops. Clear weather, clouds, mist, rain and seasonal snow change the atmosphere. Original local music, environmental cues and interaction sounds have captions and volume controls.

## Home, garden and animal options

Earned construction belongs within 85 metres of the home marker. Public homes, lanes and gardens are protected. Creative removes costs while retaining physical and public-place rules. Established furnished homes cannot be casually relocated in earned styles.

Volumetric terrain supports actual earth-covered rooms, passages, adjustable sculpt shapes, filling and grouped undo/redo. Changes that bury the player are rejected. Round doors fit their passages. Furniture checks support, occupancy and exits. Household controls move, copy, rotate and undo nearby furniture. Empty a chest before removing it or undoing its placement. A table supplies a home workbench; a nearby table plus lantern supplies a cooking station. Beds provide a comfort bonus.

Barley and carrots yield produce, seed and feed. Apple trees, herbs and flax offer repeat harvests. Renewable gathering spots provide timber, stone, fruit, herbs, fibre, clay and iron. Place garden plans outside on supported soil.

In Household, feed a pasture animal to earn trust, adopt it, name it, lead it along clear ground and settle it on your land. Cared-for animals provide applicable eggs, milk or wool. An owned pony and saddle support riding. Fish, frogs and wild birds remain habitat wildlife; riverbank fishing provides food.

Use Animals → Follow directions to locate livestock. Animal cards keep their positions while the panel is open, and directions mark the last observed position. The Animals panel retains species filtering, calm/call actions, breeding and family records. Mature, healthy, fed, unrelated opposite-sex pairs of one species can breed nearby. Parents, offspring, maturity, gestation/clutches and recovery persist; young follow their actual mother. Feeders consume stored feed, birds use open perches and rabbits use open shelters. Regional populations retain their identities when revisited.

## Travel and adventure

The atlas offers 43 destinations: settlements, bridge, quarry, ferry, Hay Gate, Old Man Willow and barrow. Discovered map destinations are free to revisit. An indoor host can book an undiscovered destination for five coins. Walking and riding remain available across continuous countryside. Travel shortcuts, elevations and settlement layouts are designed interpretations; the dated atlas references distinguish book geography from inference.

Booked or discovered ferry travel arrives at a usable dock; walking directions choose the nearer bank. The Brandywine ferry crosses between two physical landings in 18 seconds. Board through the landing interaction or nearby Village control, then wait for arrival. Hay Gate can open and close. Forest landmarks and the barrow provide persistent exploration actions. Follow the barrow's entry clue to activate its three runes and receive a token once.

Adventure territories use ambushes, flanking, guarding, thrown projectiles, area attacks and flight. Combat includes sword, bow, arrows, shield, guard, dodge, healing, armour, effects, death and recovery. Damage and outcomes are server-controlled. Arrows travel and consume ammunition. Defeated regional threats grant rewards and journal progress. Creative additionally exposes the retained 25 hostile representatives and Cinderlord for direct encounter travel. Original geography retains Ashen Hollow and the user-directed Fangorn clearing.

## Save management

Save world records progress; Save & leave returns to the opening screen. Settings renames or archives slots. Show archived slots to restore them. Export writes an E: backup; import and previous-revision recovery create separate slots.

The store validates worlds and atomically switches checksummed current/previous revisions. Accepted actions persist before success is reported. Simulation advances only while actively polled; closed worlds do not jump forward. The implementation review uses an isolated play store, with original save and asset hashes tracked separately.

## Assets and acceptance

Eleven original Blender packages cover nine animal species and male/female Hobbits. Each has its own native project, skin, materials, semantic clips and review renders. The approved rabbit, human/elf packages and hostile catalogue remain. New opening artwork, 35 item icons, round-door identity and local shortcut are applied. See [asset provenance](SHIRE_ASSET_PROVENANCE_2026-09-10.md).

The new art is stylised Blender-authored geometry, not Hunyuan output, scans or purchased models. Integrity, native motion inspection, runtime appearance, audible output and Al's visual acceptance remain separate checks. Current results belong in [the implementation ledger](SHIRE_IMMERSIVE_IMPLEMENTATION.md). [The original audit](SHIRE_GAME_AUDIT_2026-09-10.md) records the pre-implementation state. [Atlas integration](SHIRE_ATLAS_INTEGRATION.md) and [combat integration](SHIRE_COMBAT_INTEGRATION.md) retain their dated history.

The previous guide is preserved as `evidence\immersive-2026-09-10\SHIRE_LOCAL_WORLD-before.md`. Al's positive initial gameplay feedback from 6 September remains historical acceptance; it does not automatically approve these new systems and assets.

## Local operation

`scripts\shire-local.ps1` supports Prepare, Build, Start, Stop and Status. Start opens a browser with `-OpenBrowser`. Stop verifies the owned process. The listener binds to loopback; occupied ports leave other processes alone. E: is required, with no C:/D: fallback. The launcher directs `front\.shire-next` and new caches to E: and preserves the unrelated `.next`.

The administration worker remains at `E:\GrudgeBloxData\TheMiddleEarth\admin-worker`. Its `run.mjs` performs one bounded operational pass; `WORKER.md` explains usage. It is not a scheduled monitor, and operational health does not establish gameplay or visual acceptance.
