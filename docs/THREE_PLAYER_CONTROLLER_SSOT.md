# three-player-controller → GrudgeBlox production SSOT

**Refs (learn from, do not vendor whole engine):**

| Ref | URL |
|-----|-----|
| Shooting demo | https://hh-hang.github.io/three-player-controller/shooting/shooting.html |
| Foot IK plugin | https://github.com/hh-hang/three-player-controller/tree/1a788df2b7a505f9650614198fc1bee6233e56aa/src/plugins/foot-ik |
| Multiplayer GLTF | https://github.com/hh-hang/three-player-controller/blob/1a788df2b7a505f9650614198fc1bee6233e56aa/example/multiplayer-gltf.js |

**Stack base:** Notblox ECS + Rapier (`grudgeblox`) · fleet avatars · Danger Room skill timing · Mine-Loader / GRUDOX / Open PvP links.

---

## Patterns we adopt

### 1. Character select (multiplayer-gltf)
- Name + character card grid before enter
- Persist name / selection in localStorage
- Guest explorer fallback

**Ours:** `FleetCharacterSelect` + fleet Railway eras (voxel/warlords/nexus)

### 2. Avatar deploy
- Per-character model URL + scale + rotateY + anim map
- Fit height to SI (1.8 m), not raw FBX units
- Art-forward correction for grudge6

**Ours:** `grudgeAvatar.ts` + CDN grudge6 race kits

### 3. Bone hitboxes (PvP)
```
head 2.0× · torso 1.0× · arm/leg 0.75×
```
Meshes parented to bones; raycast layer for weapons

**Ours:** `avatarCombat.attachAvatarHitboxes` (Bip001 + Mixamo names)

### 4. Weapon colliders + projectiles
- Melee: hand sphere **only during active frames**
- Ranged: flying projectile + **segment raycast each tick** (damage on impact)
- Soft aim (RMB): pull direction toward camera, tighter spread
- Muzzle / hand offset ~1.35 m

**Ours:** `createWeaponCollider` + `FlyingProjectile` + `raycastProjectile`

### 5. Foot IK
- Raycast sole after FK locomotion
- Two-bone IK (hip → knee → ankle)
- Weight off when airborne

**Ours:** `footIkLite.ts` (lite port of foot-ik + CharacterIK cosine rule)

### 6. Combat HUD
- Crosshair center
- HP fill under avatar
- Kill feed top-right
- Ammo/skill bar
- Tab scoreboard
- Chat Enter

**Ours:** `MetaverseHud` + `WeaponSkillBar` + crosshair in `GamePlayer`

### 7. Skill timing (Danger Room)
- windup → active (hit window / projectile spawn) → recovery → CD
- Never damage on button-down for projectiles

**Ours:** `weaponSkillsCombat` + `dangerRoomSkills` (1–5)

### 8. Remote players (future server hook)
- Lerp position / slerp quat
- Separate rifle/idle anim maps when armed
- Name labels projected from head bone

**Notblox ECS already syncs transforms; avatar swap is local-first**

---

## Fleet access from lobby HUD

| Action | Link |
|--------|------|
| Mine-Loader lobby | mine.grudge-studio.com/#/lobby |
| Mine play | mine.grudge-studio.com/#/play |
| GRUDOX PvP rooms | grudox.grudge-studio.com |
| Danger Room | open.grudge-studio.com/danger |
| Warlords island | client.grudge-studio.com/home-island |

---

## Code map

| Module | Role |
|--------|------|
| `front/lib/avatarCombat.ts` | Hitboxes, weapon collider, ray projectiles |
| `front/lib/footIkLite.ts` | Foot plant IK |
| `front/lib/dangerRoomSkills.ts` | Skill defs + fight links |
| `front/lib/grudgeAvatar.ts` | Load + attach combat/IK |
| `front/components/GamePlayer.tsx` | Loop: IK + projectiles + cast hooks |
| `front/components/MetaverseHud.tsx` | HP, kills, feed, Tab board, Mine/GRUDOX |

---

## Production QA

```
/play/test
[ ] Select fleet hero + enter
[ ] Avatar mesh + hitboxes loaded
[ ] Foot IK on uneven ground (if terrain meshes present)
[ ] 1 slash melee (weapon collider flashes)
[ ] 3 bolt / 4 shot fly + impact
[ ] RMB soft-aim tightens cone
[ ] Tab scoreboard, kill feed updates
[ ] Links open Mine / GRUDOX / Danger Room
```
