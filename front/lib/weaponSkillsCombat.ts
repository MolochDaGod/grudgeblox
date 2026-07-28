/**
 * Weapon skill combat feel for GrudgeBlox worlds — aligned with
 * GrudgeBuilder ProductionSkillCombatRuntime / GRUDGE6_WEAPON_COMBAT.
 * Client VFX + cooldown UI; server damage can hook later.
 */

export type SkillStyle = 'melee' | 'ranged' | 'magic' | 'defense'

export interface WeaponSkillDef {
  id: string
  key: string
  label: string
  style: SkillStyle
  windup: number
  active: number
  recovery: number
  cd: number
  range: number
  /** Projectile damage on impact only */
  projectile: boolean
  projectileSpeed: number
  color: string
}

/** Default sword_shield + magic pack for metaverse combat sandbox */
export const BLOX_WEAPON_SKILLS: WeaponSkillDef[] = [
  {
    id: 'slash',
    key: '1',
    label: 'Slash',
    style: 'melee',
    windup: 0.2,
    active: 0.26,
    recovery: 0.32,
    cd: 0.5,
    range: 2.4,
    projectile: false,
    projectileSpeed: 0,
    color: '#e0553a',
  },
  {
    id: 'guard',
    key: '2',
    label: 'Guard',
    style: 'defense',
    windup: 0.08,
    active: 0.4,
    recovery: 0.2,
    cd: 1.2,
    range: 0,
    projectile: false,
    projectileSpeed: 0,
    color: '#5eb6e8',
  },
  {
    id: 'bolt',
    key: '3',
    label: 'Bolt',
    style: 'magic',
    windup: 0.28,
    active: 0.15,
    recovery: 0.35,
    cd: 1.0,
    range: 18,
    projectile: true,
    projectileSpeed: 30,
    color: '#a78bfa',
  },
  {
    id: 'shot',
    key: '4',
    label: 'Shot',
    style: 'ranged',
    windup: 0.18,
    active: 0.12,
    recovery: 0.3,
    cd: 0.7,
    range: 22,
    projectile: true,
    projectileSpeed: 40,
    color: '#6dce5a',
  },
  {
    id: 'smash',
    key: '5',
    label: 'Smash',
    style: 'melee',
    windup: 0.35,
    active: 0.3,
    recovery: 0.5,
    cd: 2.0,
    range: 2.8,
    projectile: false,
    projectileSpeed: 0,
    color: '#e8c46a',
  },
]

export type SkillCastPhase = 'idle' | 'windup' | 'active' | 'recovery'

export interface SkillCastState {
  skillId: string | null
  phase: SkillCastPhase
  endsAt: number
  readyAt: Map<string, number>
}

export function createSkillState(): SkillCastState {
  return { skillId: null, phase: 'idle', endsAt: 0, readyAt: new Map() }
}

export function isSkillReady(state: SkillCastState, skillId: string, now = performance.now()): boolean {
  return now >= (state.readyAt.get(skillId) ?? 0)
}

export type CastCallbacks = {
  onWindup?: (skill: WeaponSkillDef) => void
  /** Melee hit window — damage gate here */
  onActive?: (skill: WeaponSkillDef) => void
  /** Projectile launch */
  onProjectile?: (skill: WeaponSkillDef) => void
  onRecovery?: (skill: WeaponSkillDef) => void
  onReady?: (skill: WeaponSkillDef) => void
}

/**
 * Start cast with windup → active (hit or projectile spawn) → recovery → CD.
 */
export function beginSkillCast(
  state: SkillCastState,
  skill: WeaponSkillDef,
  cbs: CastCallbacks = {},
  now = performance.now(),
): { ok: boolean; reason?: string } {
  if (state.phase !== 'idle') return { ok: false, reason: 'busy' }
  if (!isSkillReady(state, skill.id, now)) return { ok: false, reason: 'cooldown' }

  state.skillId = skill.id
  state.phase = 'windup'
  state.endsAt = now + skill.windup * 1000
  cbs.onWindup?.(skill)

  const tActive = window.setTimeout(() => {
    state.phase = 'active'
    state.endsAt = performance.now() + skill.active * 1000
    if (skill.projectile) cbs.onProjectile?.(skill)
    else cbs.onActive?.(skill)

    window.setTimeout(() => {
      state.phase = 'recovery'
      state.endsAt = performance.now() + skill.recovery * 1000
      cbs.onRecovery?.(skill)

      window.setTimeout(() => {
        state.phase = 'idle'
        state.skillId = null
        const ready = performance.now() + skill.cd * 1000
        state.readyAt.set(skill.id, ready)
        cbs.onReady?.(skill)
      }, skill.recovery * 1000)
    }, skill.active * 1000)
  }, skill.windup * 1000)

  // stash timer id if needed later
  void tActive
  return { ok: true }
}
