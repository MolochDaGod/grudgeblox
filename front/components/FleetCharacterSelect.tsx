/**
 * Notblox-style play lobby + 4-slot character select/create (Mine-Loader + Foundry pattern).
 * Looks: 4character Mixamo races. Identity: Railway when signed in.
 */
'use client'

import { useEffect, useState } from 'react'
import {
  loadFleetRoster,
  setStoredCharacterId,
  getStoredCharacterId,
  type FleetCharacter,
  guestExplorer,
  createBloxHero,
} from '@/lib/fleetCharacters'
import { buildFoundryCreateUrl, buildLoginUrl, FLEET, getAuthToken } from '@/lib/fleetConfig'
import {
  ALL_FLEET_ERAS,
  CHARACTER_ERA_POLICIES,
  getEraPolicy,
  type FleetEraId,
  type RosterMode,
} from '@/lib/characterEras'
import { CODEX, probeCodexSystems, voxelPortraitUrl } from '@/lib/voxelCodex'
import {
  KIT_CLASSES,
  KIT_RACES,
  normalizeKitRace,
  type KitClassId,
  type KitRaceId,
} from '@/lib/fourCharacterKit'

export interface FleetCharacterSelectProps {
  playerName: string
  onPlayerNameChange: (n: string) => void
  selected: FleetCharacter | null
  onSelect: (c: FleetCharacter) => void
  onPlay: () => void
  gameTitle: string
  era?: string
  rosterMode?: RosterMode | string
  sandbox?: boolean
}

const SLOT_COUNT = 4

export default function FleetCharacterSelect({
  playerName,
  onPlayerNameChange,
  selected,
  onSelect,
  onPlay,
  gameTitle,
  era = 'voxel',
  rosterMode = 'world-era',
  sandbox = false,
}: FleetCharacterSelectProps) {
  const [chars, setChars] = useState<FleetCharacter[]>([])
  const [status, setStatus] = useState<string>('loading')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createRace, setCreateRace] = useState<KitRaceId>(KIT_RACES[0].id)
  const [createClass, setCreateClass] = useState<KitClassId>(KIT_CLASSES[0].id)
  const [createError, setCreateError] = useState<string | null>(null)
  const [codexNote, setCodexNote] = useState<string>('')
  const [eraFilter, setEraFilter] = useState<FleetEraId | 'all'>(
    rosterMode === 'all-eras' ? 'all' : (era as FleetEraId),
  )
  const allEras = rosterMode === 'all-eras' || sandbox
  const policy = getEraPolicy(eraFilter === 'all' ? era : eraFilter)

  const refresh = async () => {
    setLoading(true)
    const r = await loadFleetRoster(era, allEras ? 'all-eras' : 'world-era')
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
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await refresh()
      const probe = await probeCodexSystems()
      if (cancelled) return
      setCodexNote(
        probe.ok
          ? `Codex · ${probe.races} races${probe.tvsUnits ? ` · ${probe.tvsUnits} TVS units` : ''} (${probe.source})`
          : 'Codex portraits local · Mine-Loader defs live',
      )
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [era, rosterMode])

  const pick = (c: FleetCharacter) => {
    onSelect(c)
    setStoredCharacterId(c.id)
    if (c.name) onPlayerNameChange(c.name)
  }

  const signedIn = !!getAuthToken()
  const visibleChars =
    eraFilter === 'all'
      ? chars
      : chars.filter((c) => (c.gameEra || 'voxel').toLowerCase() === eraFilter)
  const slotCount = eraFilter === 'all' ? Math.max(SLOT_COUNT, visibleChars.length) : SLOT_COUNT
  const slots: Array<FleetCharacter | null> = Array.from(
    { length: slotCount },
    (_, i) => visibleChars[i] || null,
  )

  const onCreate = async () => {
    setCreateError(null)
    setCreating(true)
    try {
      const result = await createBloxHero({
        name: createName || playerName || 'Hero',
        raceId: createRace,
        classId: createClass,
        gameEra: policy.apiEra,
      })
      pick(result.character)
      setChars((prev) => {
        const next = prev.filter((c) => c.id !== 'guest-explorer')
        if (next.some((c) => c.id === result.character.id)) return next
        return [...next, result.character]
      })
      if (result.character.name) onPlayerNameChange(result.character.name)
      setCreateOpen(false)
      if (result.error) setCreateError(result.error)
      if (result.stored === 'railway') void refresh()
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setCreating(false)
    }
  }

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
          <span className="text-sm font-medium text-amber-100/90">
            Heroes · {allEras ? 'every era' : policy.label}
            {eraFilter !== 'all' ? ` · 4 ${policy.label} slots` : ''}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-stone-500">{status}</span>
        </div>
        {allEras && (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setEraFilter('all')}
              className={`px-2 py-1 rounded-md text-[10px] uppercase tracking-wider border ${
                eraFilter === 'all'
                  ? 'border-amber-500 bg-amber-950/60 text-amber-50'
                  : 'border-stone-700 text-stone-400'
              }`}
            >
              All eras
            </button>
            {ALL_FLEET_ERAS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setEraFilter(id)}
                className={`px-2 py-1 rounded-md text-[10px] uppercase tracking-wider border ${
                  eraFilter === id
                    ? 'border-amber-500 bg-amber-950/60 text-amber-50'
                    : 'border-stone-700 text-stone-400'
                }`}
              >
                {CHARACTER_ERA_POLICIES[id].label}
              </button>
            ))}
          </div>
        )}
        {loading ? (
          <p className="text-xs text-stone-400">Loading heroes…</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {slots.map((c, i) => {
              if (!c) {
                return (
                  <button
                    key={`empty-${i}`}
                    type="button"
                    onClick={() => {
                      setCreateName(playerName)
                      setCreateOpen(true)
                    }}
                    className="min-h-[4.5rem] text-left px-3 py-2 rounded-lg border border-dashed border-stone-600 bg-black/20 text-stone-400 hover:border-amber-700/60"
                  >
                    <div className="font-semibold text-sm">Empty slot</div>
                    <div className="text-[11px] text-amber-400/80">Create hero</div>
                  </button>
                )
              }
              const active = selected?.id === c.id
              const race = normalizeKitRace(c.raceId)
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
                  <div className="flex items-center gap-2">
                    <img
                      src={voxelPortraitUrl(race)}
                      alt=""
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded border border-stone-700 object-cover bg-stone-900"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{c.name}</div>
                      <div className="text-[11px] text-stone-500 truncate">
                        {c.gameEra || era} · {c.raceId || race} · {c.classId || 'adventurer'}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {createOpen && (
          <div className="rounded-xl border border-amber-800/40 bg-black/50 p-3 space-y-3">
            <div className="text-sm font-medium text-amber-100">Create hero</div>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Hero name"
              maxLength={20}
              className="w-full px-3 py-2 border border-amber-800/40 rounded-lg bg-black/40 text-amber-50 text-sm outline-none"
            />
            <div className="grid grid-cols-3 gap-1.5">
              {KIT_RACES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setCreateRace(r.id)}
                  className={`px-2 py-1.5 rounded-md text-[11px] border ${
                    createRace === r.id
                      ? 'border-amber-500 bg-amber-950/60 text-amber-50'
                      : 'border-stone-700 text-stone-300'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {KIT_CLASSES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCreateClass(c.id)}
                  className={`px-2 py-1.5 rounded-md text-[11px] border ${
                    createClass === c.id
                      ? 'border-amber-500 bg-amber-950/60 text-amber-50'
                      : 'border-stone-700 text-stone-300'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {createError && <p className="text-[11px] text-red-300">{createError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={creating}
                onClick={() => void onCreate()}
                className="flex-1 bg-amber-800 hover:bg-amber-700 text-amber-50 text-sm py-2 rounded-lg disabled:opacity-50"
              >
                {creating ? 'Saving…' : signedIn ? 'Save to roster' : 'Save look'}
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="px-3 py-2 text-sm text-stone-400"
              >
                Cancel
              </button>
            </div>
            <p className="text-[10px] text-stone-500">
              {signedIn
                ? `Signed in: new hero POSTs Railway /api/characters (era=${policy.apiEra}).`
                : 'Guest look is local to this lobby. Sign in + Foundry for fleet roster.'}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 text-[11px]">
          {!signedIn && (
            <a href={buildLoginUrl(`/play/test`)} className="text-emerald-400 underline">
              Sign in Grudge ID
            </a>
          )}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="text-amber-300 underline"
          >
            Create in lobby
          </button>
          <a
            href={buildFoundryCreateUrl(`/play/test`, policy.apiEra)}
            className="text-amber-400/90 underline"
            target="_blank"
            rel="noreferrer"
          >
            Foundry (fleet)
          </a>
          <a href={CODEX.defs} className="text-lime-400/90 underline" target="_blank" rel="noreferrer">
            Codex defs
          </a>
          <a href={FLEET.mineLobby} className="text-sky-400/90 underline" target="_blank" rel="noreferrer">
            Mine-Loader lobby
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
        Era={allEras ? 'all sandboxes' : policy.apiEra}. Characters from every fleet era can enter
        this world. Skins replicate to other players. {codexNote}
      </p>
    </div>
  )
}
