/**
 * Notblox-style play lobby + fleet character select (Mine-Loader multi-era roster).
 */
'use client'

import { useEffect, useState } from 'react'
import {
  loadFleetRoster,
  setStoredCharacterId,
  getStoredCharacterId,
  type FleetCharacter,
  guestExplorer,
} from '@/lib/fleetCharacters'
import { buildFoundryCreateUrl, buildLoginUrl, FLEET, getAuthToken } from '@/lib/fleetConfig'

export interface FleetCharacterSelectProps {
  playerName: string
  onPlayerNameChange: (n: string) => void
  selected: FleetCharacter | null
  onSelect: (c: FleetCharacter) => void
  onPlay: () => void
  gameTitle: string
}

export default function FleetCharacterSelect({
  playerName,
  onPlayerNameChange,
  selected,
  onSelect,
  onPlay,
  gameTitle,
}: FleetCharacterSelectProps) {
  const [chars, setChars] = useState<FleetCharacter[]>([])
  const [status, setStatus] = useState<string>('loading')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const r = await loadFleetRoster()
      if (cancelled) return
      setChars(r.characters)
      setStatus(r.status)
      const stored = getStoredCharacterId()
      const pick =
        r.characters.find((c) => c.id === stored) ||
        r.characters.find((c) => c.id !== 'guest-explorer') ||
        r.characters[0] ||
        guestExplorer()
      onSelect(pick)
      if (pick.name && !playerName) onPlayerNameChange(pick.name)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pick = (c: FleetCharacter) => {
    onSelect(c)
    setStoredCharacterId(c.id)
    if (c.name) onPlayerNameChange(c.name)
  }

  const signedIn = !!getAuthToken()

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col space-y-2">
        <label htmlFor="playerName" className="text-sm font-medium text-amber-100/90">
          Display name
        </label>
        <input
          type="text"
          id="playerName"
          value={playerName}
          onChange={(e) => onPlayerNameChange(e.target.value)}
          placeholder="Enter your name"
          maxLength={20}
          className="px-4 py-2 border border-amber-800/40 rounded-lg bg-black/40 text-amber-50 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-amber-100/90">Character (fleet roster)</span>
          <span className="text-[10px] uppercase tracking-wider text-stone-500">{status}</span>
        </div>
        {loading ? (
          <p className="text-xs text-stone-400">Loading heroes…</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
            {chars.map((c) => {
              const active = selected?.id === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c)}
                  className={`text-left px-3 py-2 rounded-lg border transition ${
                    active
                      ? 'border-amber-500/60 bg-amber-950/40 text-amber-50'
                      : 'border-stone-700/60 bg-black/30 text-stone-300 hover:border-amber-800/40'
                  }`}
                >
                  <div className="font-semibold text-sm">{c.name}</div>
                  <div className="text-[11px] text-stone-500">
                    Lv {c.level ?? 1} · {c.raceId || '—'} · {c.classId || '—'} · {c.gameEra || 'voxel'}
                  </div>
                </button>
              )
            })}
          </div>
        )}
        <div className="flex flex-wrap gap-2 text-[11px]">
          {!signedIn && (
            <a href={buildLoginUrl(`/play/test`)} className="text-emerald-400 underline">
              Sign in Grudge ID
            </a>
          )}
          <a
            href={buildFoundryCreateUrl(`/play/test`)}
            className="text-amber-400/90 underline"
            target="_blank"
            rel="noreferrer"
          >
            Create hero (Foundry)
          </a>
          <a href={FLEET.mineLobby} className="text-sky-400/90 underline" target="_blank" rel="noreferrer">
            Mine-Loader lobby
          </a>
          <a href={FLEET.grudoxStudio} className="text-cyan-400/90 underline" target="_blank" rel="noreferrer">
            Voxel Studio
          </a>
          <a href={FLEET.grudox} className="text-violet-400/90 underline" target="_blank" rel="noreferrer">
            GRUDOX hub
          </a>
        </div>
      </div>

      <button
        onClick={onPlay}
        className="bg-gradient-to-b from-amber-700 to-amber-900 hover:from-amber-600 hover:to-amber-800 text-amber-50 px-8 py-3 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-[1.02] shadow-lg border border-amber-500/30"
      >
        Enter {gameTitle} →
      </button>
      <p className="text-[10px] text-stone-500 leading-relaxed">
        Avatar uses fleet grudge6 / voxel mesh on CDN. Weapon skills 1–5: windup → hit / projectile
        impact. Worlds: blox · mine · grudox/studio (Voxel Studio tools)
      </p>
    </div>
  )
}
