/**
 * Combat hotbar 1–5 for GrudgeBlox weapon skill fighting.
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BLOX_WEAPON_SKILLS,
  beginSkillCast,
  createSkillState,
  isSkillReady,
  type SkillCastState,
  type WeaponSkillDef,
} from '@/lib/weaponSkillsCombat'

export interface WeaponSkillBarProps {
  enabled?: boolean
  onCast?: (skill: WeaponSkillDef, phase: 'windup' | 'active' | 'projectile') => void
}

export default function WeaponSkillBar({ enabled = true, onCast }: WeaponSkillBarProps) {
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
        onRecovery: () => {
          setBanner(null)
          tick((n) => n + 1)
        },
        onReady: () => tick((n) => n + 1),
      })
      if (!r.ok) {
        setBanner(r.reason === 'cooldown' ? 'Cooldown' : 'Busy')
        window.setTimeout(() => setBanner(null), 400)
      }
      tick((n) => n + 1)
    },
    [enabled, onCast, state],
  )

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

  if (!enabled) return null

  const now = performance.now()

  return (
    <div className="pointer-events-auto absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
      {banner && (
        <div className="px-3 py-1 rounded-md bg-black/70 border border-amber-700/40 text-amber-100 text-xs font-semibold">
          {banner}
        </div>
      )}
      <div className="flex gap-1.5 p-2 rounded-xl bg-black/75 border border-amber-800/40 backdrop-blur-sm">
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
              className="relative w-12 h-12 rounded-lg border flex flex-col items-center justify-center text-[10px] font-bold transition"
              style={{
                borderColor: active ? s.color : ready ? `${s.color}88` : '#333',
                background: active ? `${s.color}33` : ready ? '#1a120c' : '#0a0a0a',
                color: ready ? '#f4e6c8' : '#666',
                opacity: ready ? 1 : 0.55,
              }}
            >
              <span className="text-[9px] text-amber-400/80">{s.key}</span>
              <span className="leading-tight">{s.label}</span>
              {!ready && cdLeft > 0 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg text-amber-200 text-xs">
                  {cdLeft.toFixed(1)}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <p className="text-[9px] text-white/40">1–5 weapon skills · windup → hit / projectile impact</p>
    </div>
  )
}
