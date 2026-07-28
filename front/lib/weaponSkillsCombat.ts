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

import { DANGER_ROOM_METAVERSE_SKILLS } from './dangerRoomSkills'

/** Danger Room + sword pack for metaverse combat (three-player-controller timing bar) */
export const BLOX_WEAPON_SKILLS: WeaponSkillDef[] = DANGER_ROOM_METAVERSE_SKILLS

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
