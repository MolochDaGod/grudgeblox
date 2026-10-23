# Cinderlord in The Middle-earth

Open the local game at `http://127.0.0.1:4100/play/shire`, then **Map → Ashen Hollow · Cinderlord**. Travel arrives at an overlook outside the detection radius. The separate **Cinderlord encounter preview** save demonstrates the encounter without changing the existing worlds.

Cinderlord is an original Blender-authored magma creature, used as a hostile guardian in the designed countryside. It patrols, idles, roars when approached, pursues intruders and performs a two-handed ground smash. The orange ring warns of the impact. **E** strikes when aimed at the creature within 5.5 metres; six strikes defeat it. Ground smash pushes the player back through collision-checked movement. The guardian returns to its territory when the player withdraws, and rekindles 45 seconds after defeat.

The encounter is transient and resets when a world is reopened. It does not change the save version, wildlife, crops, structures or household inventory. It will not attack within 60 metres of the player's home marker. No new persistent combat-health or loot system is introduced.

## Runtime package

`E:\GrudgeBloxData\TheMiddleEarth\assets\enemy-cinderlord.glb` is served through the existing hash-verified local asset endpoint. The asset manifest includes role `hostile-encounter`, four clips and original-authoring provenance. `scripts/prepare-shire-assets.mjs` reproduces the registration and retains the resident kit, rabbit provenance and reference files.

The source package is `E:\GrudgeBloxData\Cinderlord\runtime\cinderlord.glb`, SHA-256 `77a45e0aafe55fe5eaacff058a500036b3b8f1ebc29ee9c834345aa6d9bd1090`. It contains one skinned mesh, 38 bones, baked albedo/emission/normal textures and `Idle`, `Walk`, `GroundSmash`, `Yell` clips. The two loops begin and end in matching poses. Motion has no audio. Enemy height is 6.5 metres including horns.

`shared/shire/cinderlord.ts` owns encounter rules; `front/game/shire/CinderlordEnemy.ts` handles the asset, motion, effects and collision-checked response. It uses the existing cloned-model loader and releases its resources with the scene.

## Checks completed

- Existing 32 Shire gameplay/storage checks.
- `scripts/cinderlord-checks.ts`: travel/contact, delayed single impact, home protection, leash, strike cooldown, defeat/reset, and the actual asset's structure and clip timings.
- Type checking and the local production build.
- Running browser inspection: textured model, idle/patrol, pursuit and ground-smash knockback; approximately 50–53 fps observed on this RTX 3090 desktop at the inspected window size.

The owned loopback server was restarted with the new build. Existing saves were copied to `E:\GrudgeBloxData\Cinderlord\shire-saves-before-update` before the update. Nothing was pushed or publicly deployed. User visual acceptance remains separate from these implementation checks.
