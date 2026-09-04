/**
 * Combat hotbar 1–5 for GrudgeBlox weapon skill fighting.
 */
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BLOX_WEAPON_SKILLS,
  beginSkillCast,
  createSkillState,
  isSkillReady,
  type SkillCastState,
  type WeaponSkillDef,
} from '@/lib/weaponSkillsCombat'
import { HUD_Z } from '@/game/hudLayers'
import { StudioItemIcon, type StudioIconId } from './StudioItemIcon'
import { codexIconUrl } from '@/lib/voxelCodex'

export interface WeaponSkillBarProps {
  enabled?: boolean
  /** Keys and gamepad still cast when hidden; only the bar itself is removed. */
  visible?: boolean
  onCast?: (
    skill: WeaponSkillDef,
    phase: 'windup' | 'active' | 'projectile' | 'recovery' | 'ready',
  ) => void
  consumeSkillSlot?: () => number | null
}

function iconForSkill(skill: WeaponSkillDef): StudioIconId {
  if (skill.id === 'guard') return 'guard'
  if (skill.id === 'bolt') return 'bolt'
  if (skill.id === 'shot') return 'shot'
  if (skill.id === 'smash') return 'smash'
  return 'sword'
}

export default function WeaponSkillBar({
  enabled = true,
  visible = true,
  onCast,
  consumeSkillSlot,
}: WeaponSkillBarProps) {
  const [state] = useState<SkillCastState>(() => createSkillState())
  const [, tick] = useState(0)
  const [banner, setBanner] = useState<string | null>(null)

  const cast = useCallback(
    (skill: WeaponSkillDef) => {
      if (!enabled) return
      const r = beginSkillCast(state, skill, {
        onWindup: (s) => {
          setBanner(`${s.label}…`)
          onCast?.(s, 'windup')
          tick((n) => n + 1)
        },
        onActive: (s) => {
          setBanner(`${s.label} hit!`)
          onCast?.(s, 'active')
          tick((n) => n + 1)
        },
        onProjectile: (s) => {
          setBanner(`${s.label} →`)
          onCast?.(s, 'projectile')
          tick((n) => n + 1)
        },
        onRecovery: (s) => {
          setBanner(null)
          onCast?.(s, 'recovery')
          tick((n) => n + 1)
        },
        onReady: (s) => {
          onCast?.(s, 'ready')
          tick((n) => n + 1)
        },
      })
      if (!r.ok) {
        setBanner(r.reason === 'cooldown' ? 'Cooldown' : 'Busy')
        window.setTimeout(() => setBanner(null), 400)
      }
      tick((n) => n + 1)
    },
    [enabled, onCast, state],
  )

  const consumeSkillSlotRef = useRef(consumeSkillSlot)
  consumeSkillSlotRef.current = consumeSkillSlot

  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => {
      const slot = consumeSkillSlotRef.current?.()
      if (!slot) return
      const skill = BLOX_WEAPON_SKILLS.find((s) => s.key === String(slot))
      if (skill) cast(skill)
    }, 50)
    return () => window.clearInterval(id)
  }, [cast, enabled])

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const skill = BLOX_WEAPON_SKILLS.find((s) => s.key === e.key)
      if (skill) {
        e.preventDefault()
        cast(skill)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cast, enabled])

  // CD UI refresh
  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => tick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [enabled])

  if (!enabled || !visible) return null

  const now = performance.now()

  return (
    <div
      className="pointer-events-auto absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      style={{ zIndex: HUD_Z.SKILLBAR }}
    >
      {banner && (
        <div className="px-3 py-1 rounded-md bg-slate-950/80 border border-amber-400/40 text-amber-100 text-xs font-semibold shadow-[0_0_20px_rgba(245,158,11,0.22)]">
          {banner}
        </div>
      )}
      <div className="flex gap-1.5 p-2 rounded-2xl bg-slate-950/80 border border-amber-400/30 backdrop-blur-md shadow-[inset_0_2px_8px_rgba(0,0,0,0.65),0_12px_40px_rgba(0,0,0,0.45)]">
        {BLOX_WEAPON_SKILLS.map((s) => {
          const ready = isSkillReady(state, s.id, now)
          const active = state.skillId === s.id
          const readyAt = state.readyAt.get(s.id) ?? 0
          const cdLeft = Math.max(0, (readyAt - now) / 1000)
          return (
            <button
              key={s.id}
              type="button"
              title={`${s.label} [${s.key}] · ${s.style}`}
              onClick={() => cast(s)}
              className="relative w-14 h-14 rounded-xl border flex flex-col items-center justify-center text-[10px] font-bold transition overflow-hidden"
              style={{
                borderColor: active ? s.color : ready ? `${s.color}aa` : '#334155',
                background: active
                  ? `linear-gradient(180deg, ${s.color}44, rgba(15,23,42,0.94))`
                  : ready
                    ? 'linear-gradient(180deg, rgba(30,41,59,0.95), rgba(2,6,23,0.95))'
                    : 'linear-gradient(180deg, rgba(15,23,42,0.8), rgba(2,6,23,0.95))',
                color: ready ? '#f4e6c8' : '#666',
                opacity: ready ? 1 : 0.55,
                boxShadow: active
                  ? `0 0 0 2px ${s.color}44, inset 0 2px 8px rgba(255,255,255,0.08)`
                  : 'inset 0 2px 6px rgba(255,255,255,0.06)',
              }}
            >
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_35%_20%,rgba(255,255,255,0.18),transparent_40%)]" />
              <img
                src={codexIconUrl(s.id)}
                alt=""
                width={30}
                height={30}
                className="relative z-10 drop-shadow"
                style={{ imageRendering: 'pixelated' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const fb = e.currentTarget.nextElementSibling
                  if (fb instanceof HTMLElement) fb.style.display = 'block'
                }}
              />
              <span className="relative z-10 hidden">
                <StudioItemIcon id={iconForSkill(s)} size={30} className="drop-shadow" />
              </span>
              <span className="absolute top-1 left-1.5 z-10 text-[9px] text-amber-200 drop-shadow">{s.key}</span>
              <span className="relative z-10 mt-0.5 leading-tight drop-shadow">{s.label}</span>
              {!ready && cdLeft > 0 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg text-amber-200 text-xs">
                  {cdLeft.toFixed(1)}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <p className="text-[9px] text-white/45">Studio combat bar · 1-5 skills · windup to active to recovery</p>
    </div>
  )
}
