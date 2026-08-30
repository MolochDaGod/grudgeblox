# 4character play kit (GrudgeBlox)

Unzipped from `D:\Games\Models\4character.zip` (source remains on disk).

| Path | Role |
|------|------|
| `races/*.glb` | Mixamo play bodies (idle/walk/run/attack/jump embedded) |
| `anim/anim-bank.glb` | Extra class packs (not required for loco) |
| `weapons/*.glb` | Hand attach by class |
| `vfx/*.glb` | Replicated skill FX (`fx:slash\|bolt\|orb`) |

The original meshes, skeletons, clips and 1.8 m source height stay unchanged.
These six race files author forward on `+X`; GrudgeBlox applies a clockwise 90°
source yaw at their existing non-animated `Root_normalized` node before
`AnimationMixer` binding so visual forward agrees with world `+Z`.

The network player position is the centre of its Rapier capsule. The existing
outer avatar child is therefore placed at `y=-1.5` in unscaled player-mesh
units—the capsule's `0.5` half-height plus `1.0` radius. The network mesh and
collider share the same `SingleSize` scale, so this keeps every bundled race's
feet on the physics contact plane without changing its authored root, model
scale, skeleton, mixer, camera or collider.

This is **not** Warlords Toon `loadRaceKit`.
