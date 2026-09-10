# Shire life assets — 10 September 2026

These additions are original assets authored for the local Shire game. They are distinct from the retained rabbit, hostile roster, Cinderlord and human/elf packages. Their registered hashes and original-package hashes are retained in the implementation evidence folder.

## Characters and livestock

Eleven independent Blender projects were authored using `scripts/shire-author-life-assets.py`: sheep, chicken, cattle, pig, horse, fish, llama, bird, frog, Hobbit male and Hobbit female. Each project has its own mesh, materials, skeleton and idle, walk, run, eat, rest, hit and death actions. Aquatic and flying species have additional applicable actions. Runtime registration uses `scripts/shire-install-life-assets.mjs`.

The style is deliberately stylised: readable silhouettes, warm material colours and modest material/draw budgets. Meshes, materials and rig actions were created directly in Blender 5.2. These are not Hunyuan outputs, scans or purchased asset-store packages. Blender units and GLB units are metres, with GLB facing positive Z. The studio plane, cameras and lights are excluded from runtime exports.

Native projects and renders: `E:\GrudgeBloxData\TheMiddleEarth\assets\shire-life\<entity>`. Each includes `manifest.json`, `<entity>.blend`, `<entity>.glb`, front, side, rear, opposite walk-contact and rest renders. Package presence, integrity, visual inspection and user acceptance are separate evidence categories. The manifest initially records that runtime review is pending; final review results belong in the implementation evidence ledger.

The final art pass corrected bone-axis motion, supporting-foot height, cattle coat markings, fish gill attachment, frog surface markings, Hobbit hair coverage and clothing, and outward bird wing extension. Initial authored packages remain in the evidence folder. Each final GLB has one skinned mesh with multiple material primitives; the asset installer verifies the registered hash and required semantic clips. These are stylised, deliberately simplified characters and livestock.

All eleven packages were opened individually in Blender and their locomotion was played and inspected at multiple poses. Fish used the swim action and the bird used fly; other entities used walk. The per-entity record is `evidence\immersive-2026-09-10\native-motion-review.json`. This does not claim individual visual review of every death/hit transition or Al's acceptance. The separately saved review projects do not replace the authored source projects.

## Opening artwork

`front/public/shire/art/homecoming.png` was generated with the built-in image generation tool for this task and applied to the opening screen. Its original output is retained in the Codex generated-images folder. Exact prompt:

> Use case: illustration-story. Asset type: original panoramic background artwork for the opening screen of a cosy Shire village-life exploration game. Create a beautifully painted, atmospheric view of rolling green countryside, a lived-in hillside home with a round moss-green wooden door, a small vegetable garden, sheep and a pony in the distance, a winding lane to a village inn and a watermill. Dawn sunlight, mist in distant valleys, warm welcoming windows, flowers, weathered stone and honey-coloured timber. Cohesive painterly storybook realism with richly crafted details, calm greens and warm gold, entirely original composition. Wide landscape 16:9. Keep the leftmost third relatively uncluttered and darker for legible game menu overlay. This is in-game background art, no text, no letters, no logos, no watermark, no interface elements, no copied film composition.

## Interface and identity

`scripts/shire-author-icons.mjs` authors the original SVG item symbols and round-door Shire identity. Raster identity sizes and the Windows ICO are rendered from that vector source. The game page declares its own favicon, touch icon and standalone web manifest. The local shortcut uses the same ICO.

## Sound and scenery

`ShireAudio.ts` synthesises its original plucked-string score, wind, water, bird calls, footsteps and interaction tones locally with Web Audio. It does not download recordings or use a microphone. The music varies with night, interiors and nearby threats. Independent music/effects/master controls and sound captions are available.

Public interiors, signs, resources, furniture, gates, ferry landings, weather particles and the boat are authored scene geometry. Their shared interaction records define gameplay positions and behaviour. The regional atlas and retained woodland architecture continue to distinguish book-grounded geography from designed terrain, settlement layouts and fictional game activities.
