# 4character play kit (GrudgeBlox)

Unzipped from `D:\Games\Models\4character.zip` (source remains on disk).

| Path | Role |
|------|------|
| `races/*.glb` | Mixamo play bodies (idle/walk/run/attack/jump embedded) |
| `anim/anim-bank.glb` | Extra class packs (not required for loco) |
| `weapons/*.glb` | Hand attach by class |
| `vfx/*.glb` | Replicated skill FX (`fx:slash\|bolt\|orb`) |

The original meshes, skeletons, clips, 1.8 m height and grounding stay
unchanged. These six race files author forward on `+X`; GrudgeBlox applies a
clockwise 90° source yaw at their existing non-animated `Root_normalized` node
before `AnimationMixer` binding so visual forward agrees with world `+Z`.

This is **not** Warlords Toon `loadRaceKit`.
