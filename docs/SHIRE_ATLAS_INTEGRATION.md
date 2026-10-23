# Shire atlas integration — 8 September 2026

New worlds use `shire-atlas-1`: a continuous 310 × 270 km regional landscape derived from the retained Shire and Bree atlas. Original `shire-1` worlds keep their original terrain, settlements, excavation data, animals and creative Fangorn/Cinderlord areas. Nothing migrates an existing save implicitly.

## Open and explore

Run `Play The Middle-earth.cmd`, then continue **The Shire · Tolkien atlas** or start a new world. Open **Map**, choose a destination, and travel. **Area overview** shows the district; **Landmark view** frames its principal building. **Return to walking** restores normal movement. These cameras do not relocate the saved player or bypass gameplay collision.

The world contains 37 inhabited settlement/farm/house sites, 675 public buildings, and 43 travel destinations including crossings, the Old Forest and the Barrow-downs. Counts are our reconstruction, not a census from Tolkien. Named reference points preserve the atlas coordinates; Haysend's inhabited layout is offset 140 m east onto one bank to avoid splitting its houses across the Brandywine. Town footprints and building footprints are designed at metre scale.

## Woodland and path refinement

The woodland pass replaces the sparse 24 m tree grid with stable, jittered 8 m cells. A one-square-kilometre Old Forest sample with seed 42 contains 11,999 trees, compared with the previous nominal 1,250 per square kilometre. The canopy mixes oak, beech, birch, willow, alder and hazel forms, varied heights, crown shapes and tones, riverside trees, shrubs and fern-like ground plants. Pastoral areas have irregular copses; village greens, productive fields, house footprints, paths, water and open Barrow-downs remain reserved.

Trees use instanced geometry and two levels of detail. Absolute cell hashes preserve their positions when scenery tiles reload. The higher density therefore does not require a separate scene object and unique mesh for every tree.

Regional atlas roads now hand over at local gateways to a shared village route graph. Every public doorway has a connected front walk. Routes avoid neighbouring building footprints; garden fences leave openings where paths cross, and scenery placement reserves the verges. The nearby map displays this same route graph. Path surfaces follow the actual two-metre terrain triangles, and river crossings align with bridge decks and graded approaches. A small authored wooden footbridge joins Tom Bombadil's house approach across the Withywindle. Budgeford and very small streams retain ford routes, rather than treating every water crossing as a bridge.

Seven focused scenery checks cover all 675 entrances, neighbouring building clearance, Hobbiton/Tom bridge routing, deck/approach alignment, woodland density and variety, repeatability/path clearance, and open downland. Fresh in-game screenshots and the report are retained in `E:/GrudgeBloxData/TheMiddleEarth/evidence/scenery-2026-09-08`. The earlier 14-image atlas gallery records the previous scenery pass.

## Geography and terrain

- Easting and northing in the atlas are converted to game metres: `x = east_km × 1000`, `z = -north_km × 1000`. The retained 1,241 × 1,081 elevation grid is decoded as linear unsigned 16-bit data, `metres = value / 64 - 64`. The generator never interprets it as a colour texture.
- All heights use the atlas's arbitrary design datum. They are not measured Tolkien elevations. River profiles are designed and descend downstream. Seven vector rivers are carved beneath their water surfaces; Bywater Pool has its own footprint and level.
- The original raster explicitly required hydrologic conditioning. Where a profile stood above the coarse terrain, the generator blends banks into the surrounding terrain over up to 700 m. Settlement ground blends within 400 m; local relief shapes the Hill at Hobbiton and Bree-hill. The separate 5 m Hobbiton study is retained as a reference, not pasted into an incompatible datum.
- Grassland, woodland, marsh, downland, the Old Forest, quarry country and open barrow country use the atlas landcover. The High Hay, Stonebows bridge, Bucklebury Ferry, standing stones and burial mounds have scenery representations. Woodland trees use stable absolute cell positions as scenery streams.
- Near terrain uses the existing two-metre surface mesh and half-metre edited terrain mesh. The shared density field drives digging, roofs, floors and collision. Detailed river corridors subdivide the middle-distance terrain, with shared edge vertices joining coarse cells. Channel cuts combine at confluences to avoid artificial walls between narrow tributaries and wide rivers. Distant layers have separate clipping areas; local mesh vertices and an origin shift reduce precision problems at full regional distances.

## Settlement character

| Area | Buildings and scenery |
| --- | --- |
| Hobbiton | Bag End, Bagshot Row-inspired smials, the old mill and waterwheel, Ivy Bush, Party Tree/field, stream bridge, gardens, orchards, barns and fields |
| Bywater | Green Dragon, round-door cottages and smials, village lanes, gardens and surrounding agriculture; Bywater Pool remains at the atlas's separate location |
| Tuckborough | Great Smials as the principal three-wing grass-roofed hall, surrounding smials, cottages, gardens and estate farmland |
| Michel Delving | Town Hole, the largest Shire building group, market stalls, working lanes, wells, storage barns and orchards |
| Stock and the Marish | Surface farmhouses and barns, crops, fences and gardens; no default smial housing in the wet farm palette |
| Buckland | Bucklebury and neighbouring villages, Brandy Hall, the ferry crossing and High Hay |
| Bree-land | Human-scale rectangular doors, shuttered windows, timber façades, varied roof colours and storeys; Prancing Pony, market, gardens and farm outbuildings |
| Old Forest | Dense woodland, willow scenery, Tom Bombadil's isolated house and vegetable garden |
| Barrow-downs | Open grassland, burial mounds, stone entrance groups; no town or orchard on the downs |

Public buildings have protected footprints and exterior collision. They are scenery buildings, not furnished explorable interiors. Player-built excavated homes retain their existing interiors and furnishing system. Resident figures reuse the existing GrudgeBlox kit; they are not newly approved, Tolkien-specific character assets. The approved rabbit remains available; other wildlife remains labelled as development art. The atlas preset omits the creative llama pair.

The baseline is the pre-Scouring Shire of T.A. 3018: old mill and Party Tree, with no post-Scouring replacement scenery. Fangorn and Ashen Hollow remain features of original creative saves.

## Evidence and retained sources

Reference atlas: `E:/GrudgeBloxData/TheMiddleEarth/assets/references/shire-atlas-2026-09-08`.

`scripts/import-shire-atlas.py` reproducibly compiles the retained raster, river profiles, named places and roads into `shared/shire/atlasData.ts`. Source metadata SHA-256: `da66843c6feb58bd8311791a1f0d82b0d46a1431166d5f4bd3bce139ea8fbb57`. The original atlas package retains its full source register, chapter locators, raster manifests and checksums.

Validation: the production Shire build, existing 32 gameplay/storage checks, and 10 focused atlas checks passed. The latter cover supported travel to all 43 destinations, public building collision, coordinate bounds, use of regional heights, river profiles and confluences, forest/downland separation, legacy saves and closed excavations in atlas terrain. Reports and 14 genuine, unretouched browser screenshots are stored under `E:/GrudgeBloxData/TheMiddleEarth/evidence/atlas-2026-09-08`. The screenshot PDF and HTML gallery show the running production build, not concept art. Travel and both viewing controls were exercised in the browser; this does not establish a complete manual gameplay acceptance pass.

The prepared world is `The Shire · Tolkien atlas`, save ID `7daf2eda-c0a2-4f3d-ba96-5f86954ca2f9`, saved at Hobbiton. Travel still rebuilds local scenery synchronously and may pause briefly. Public interiors, detailed architecture, settlement density and streaming transitions remain areas for further development.

The atlas resolves neither every narrative distance conflict nor the exact dimensions of unmeasured towns. In particular, the adopted regional Hobbiton/Bywater arrangement is the atlas's published-map-relative variant. This is a playable geographic foundation and authored town reconstruction, not a claim of surveyed completeness or finished asset approval.
