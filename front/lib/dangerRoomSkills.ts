/**
 * Danger Room / fleet weapon skills exposed in GrudgeBlox metaverse.
 * Timing + colliders align with ProductionSkillCombatRuntime + three-player-controller shooting.
 */
import type { WeaponSkillDef } from './weaponSkillsCombat'

/** Extended skill set: swords + danger-room style bolt / shot / smash */
export const DANGER_ROOM_METAVERSE_SKILLS: WeaponSkillDef[] = [
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
    active: 0.45,
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
    label: 'Arcane Bolt',
    style: 'magic',
    windup: 0.28,
    active: 0.12,
    recovery: 0.35,
    cd: 1.0,
    range: 22,
    projectile: true,
    projectileSpeed: 32,
    color: '#a78bfa',
  },
  {
    id: 'shot',
    key: '4',
    label: 'Rifle Shot',
    style: 'ranged',
    windup: 0.1,
    active: 0.08,
    recovery: 0.22,
    cd: 0.35,
    range: 40,
    projectile: true,
    projectileSpeed: 55,
    color: '#e8c46a',
  },
  {
    id: 'smash',
    key: '5',
    label: 'Overhead',
    style: 'melee',
    windup: 0.35,
    active: 0.3,
    recovery: 0.5,
    cd: 2.0,
    range: 2.8,
    projectile: false,
    projectileSpeed: 0,
    color: '#f59e0b',
  },
]

/** Soft-aim: hold RMB increases accuracy (three-player soft aim pattern) */
export const SOFT_AIM = {
  key: 'MouseRight',
  spreadDegNormal: 4.5,
  spreadDegAim: 1.2,
  moveSpeedMultAim: 0.8,
} as const

/** Deep links for PvP / Mine / Danger Room from lobby HUD */
export const METAVERSE_FIGHT_LINKS = {
  dangerRoom: 'https://open.grudge-studio.com/danger',
  openPvp: 'https://open.grudge-studio.com/play',
  mineLobby: 'https://mine.grudge-studio.com/#/lobby',
  minePlay: 'https://mine.grudge-studio.com/#/play',
  grudox: 'https://grudox.grudge-studio.com',
  warlordsCombat: 'https://client.grudge-studio.com/home-island?from=blox&unlock=1',
  productionLab: 'https://client.grudge-studio.com/production',
} as const
