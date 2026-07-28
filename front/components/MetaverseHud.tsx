/**
 * Full production HUD for GTA-like voxel lobby — minimap strip, chat, controls, fleet links.
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import { Joystick } from 'react-joystick-component'
import { Game } from '@/game/Game'
import { SerializedMessageType } from '@shared/network/server/serialized'
import { MessageComponent } from '@shared/component/MessageComponent'
import { Maximize, Car, Crosshair, MessageSquare, Map as MapIcon } from 'lucide-react'
import { MicroGameCard } from './GameCard'
import { GameInfo } from '@/types'
import gameData from '../public/gameData.json'
import { FLEET } from '@/lib/fleetConfig'
import type { FleetCharacter } from '@/lib/fleetCharacters'

export interface MetaverseHudProps {
  messages: MessageComponent[]
  sendMessage: (message: string) => void
  gameInstance: Game
  character?: FleetCharacter | null
  worldTitle?: string
  hp?: number
  maxHp?: number
  kills?: number
  killFeed?: Array<{ id: number; text: string }>
  softAim?: boolean
  fightLinks?: Record<string, string>
}

export default function MetaverseHud({
  messages: messageComponents,
  sendMessage,
  gameInstance,
  character,
  worldTitle = 'GrudgeBlox City',
  hp = 100,
  maxHp = 100,
  kills = 0,
  killFeed = [],
  softAim = false,
  fightLinks,
}: MetaverseHudProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [notifications, setNotifications] = useState<
    Array<{ id: number; content: string; author: string }>
  >([])
  const processedMessagesRef = useRef<Set<number>>(new Set())
  const [chatOpen, setChatOpen] = useState(true)
  const [scoreboard, setScoreboard] = useState(false)

  // Tab scoreboard (multiplayer-gltf)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault()
        setScoreboard(true)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Tab') setScoreboard(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const hpPct = Math.max(0, Math.min(100, (hp / Math.max(1, maxHp)) * 100))

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messageComponents])

  useEffect(() => {
    if (!messageComponents?.length) return
    messageComponents.forEach((messageComponent, index) => {
      const messageType = messageComponent.messageType
      const messageId = messageComponent.timestamp
      if (processedMessagesRef.current.has(messageId)) return
      if (
        messageType === SerializedMessageType.GLOBAL_NOTIFICATION ||
        (messageType === SerializedMessageType.TARGETED_NOTIFICATION &&
          gameInstance?.currentPlayerEntityId &&
          messageComponent.targetPlayerIds?.includes(gameInstance.currentPlayerEntityId))
      ) {
        processedMessagesRef.current.add(messageId)
        const n = {
          id: Date.now() + index,
          content: messageComponent.content,
          author: messageComponent.author,
        }
        setNotifications([n])
        setTimeout(() => setNotifications((prev) => prev.filter((x) => x.id !== n.id)), 5000)
      }
    })
  }, [messageComponents, gameInstance?.currentPlayerEntityId])

  const filtered = (messageComponents || []).filter((message) => {
    const messageType = message.messageType
    const targetPlayerIds = message.targetPlayerIds || []
    if (messageType === SerializedMessageType.GLOBAL_CHAT) return true
    if (
      messageType === SerializedMessageType.TARGETED_CHAT &&
      gameInstance?.currentPlayerEntityId
    ) {
      return targetPlayerIds.includes(gameInstance.currentPlayerEntityId)
    }
    if (
      messageType === SerializedMessageType.GLOBAL_NOTIFICATION ||
      messageType === SerializedMessageType.TARGETED_NOTIFICATION
    ) {
      return false
    }
    return true
  })

  return (
    <div className="fixed inset-0 z-50 pointer-events-none text-white">
      {/* Notifications */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        {notifications.map((n) => (
          <div
            key={n.id}
            className="bg-black/75 border border-amber-600/40 text-center px-4 py-2 rounded-lg max-w-md shadow-xl"
          >
            <p className="text-amber-400 font-semibold text-sm">{n.author}</p>
            <p className="text-sm">{n.content}</p>
          </div>
        ))}
      </div>

      {/* Kill feed (multiplayer-gltf) */}
      <div className="fixed top-14 right-3 z-[70] flex flex-col items-end gap-1 pointer-events-none">
        {killFeed.map((k) => (
          <div
            key={k.id}
            className="text-xs text-white px-2 py-0.5 rounded bg-black/60 border border-amber-800/30 shadow"
          >
            {k.text}
          </div>
        ))}
      </div>

      {/* Top bar */}
      <div className="absolute top-3 left-3 right-3 flex justify-between items-start gap-3">
        <div className="pointer-events-auto bg-black/70 backdrop-blur-md border border-amber-800/40 rounded-xl px-4 py-3 max-w-xs shadow-lg">
          <p className="text-[10px] uppercase tracking-[0.15em] text-amber-500/80">Metaverse lobby</p>
          <a href="/" className="text-lg font-bold text-amber-50 hover:text-amber-200 block">
            {worldTitle}
          </a>
          {character && (
            <p className="text-xs text-stone-400 mt-1">
              {character.name} · {character.raceId || 'human'} · Lv {character.level ?? 1}
            </p>
          )}
          {/* HP avatar fill (three-player-controller player-hud) */}
          <div className="flex items-center gap-2 mt-2">
            <div className="relative w-10 h-10 rounded border-2 border-emerald-500/70 overflow-hidden bg-black/50">
              <div
                className="absolute bottom-0 left-0 right-0 transition-all"
                style={{
                  height: `${hpPct}%`,
                  background:
                    hpPct > 50
                      ? 'rgba(34,204,68,0.55)'
                      : hpPct > 25
                        ? 'rgba(255,170,0,0.65)'
                        : 'rgba(255,50,50,0.7)',
                }}
              />
            </div>
            <div>
              <p className="text-[10px] text-emerald-400 font-bold tracking-wider">HP</p>
              <p className="font-mono text-sm font-bold">{hp}/{maxHp}</p>
            </div>
            <div className="ml-2 pl-2 border-l border-white/10">
              <p className="text-[10px] text-amber-400 font-bold">KILLS</p>
              <p className="font-mono text-sm font-bold text-amber-200">{kills}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2 text-[10px]">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/50 border border-emerald-800/40 text-emerald-200">
              <Car className="w-3 h-3" /> E vehicles
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-950/50 border border-red-800/40 text-red-200">
              <Crosshair className="w-3 h-3" /> 1–5 skills {softAim ? '· AIM' : ''}
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-950/50 border border-sky-800/40 text-sky-200">
              <MapIcon className="w-3 h-3" /> Tab board
            </span>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex flex-wrap gap-2 justify-end">
            <a
              href={fightLinks?.mineLobby || FLEET.mineLobby}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] px-2 py-1 rounded-md bg-black/60 border border-sky-700/40 text-sky-200 hover:bg-sky-950/50"
            >
              Mine lobby
            </a>
            <a
              href={fightLinks?.minePlay || FLEET.minePlay}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] px-2 py-1 rounded-md bg-black/60 border border-sky-700/40 text-sky-200 hover:bg-sky-950/50"
            >
              Mine play
            </a>
            <a
              href={fightLinks?.grudox || FLEET.grudox}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] px-2 py-1 rounded-md bg-black/60 border border-violet-700/40 text-violet-200 hover:bg-violet-950/50"
            >
              GRUDOX PvP
            </a>
            <a
              href={fightLinks?.dangerRoom || 'https://open.grudge-studio.com/danger'}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] px-2 py-1 rounded-md bg-black/60 border border-red-700/40 text-red-200 hover:bg-red-950/50"
            >
              Danger Room
            </a>
            <button
              type="button"
              onClick={() => {
                if (document.fullscreenElement) document.exitFullscreen()
                else document.documentElement.requestFullscreen()
              }}
              className="p-1.5 rounded-md bg-black/60 border border-stone-600 text-white hover:bg-stone-800"
              aria-label="Fullscreen"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-white/40 bg-black/40 px-2 py-1 rounded">
            WASD · Space · RMB aim · E · 1–5 skills · Tab
          </p>
        </div>
      </div>

      {/* Scoreboard Tab */}
      {scoreboard && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 pointer-events-none">
          <div className="min-w-[320px] rounded-xl border border-white/15 bg-black/85 backdrop-blur-md overflow-hidden">
            <div className="px-4 py-2 text-center text-xs tracking-widest text-white/80 border-b border-white/10">
              SCOREBOARD
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-white/50 uppercase">
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-right text-amber-300">Kills</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-sky-500/10">
                  <td className="px-4 py-2 text-white/40">1</td>
                  <td className="px-4 py-2 text-sky-300 font-semibold">
                    {character?.name || 'You'}
                  </td>
                  <td className="px-4 py-2 text-right text-amber-300 font-bold">{kills}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Chat panel */}
      <div className="absolute bottom-4 right-4 hidden lg:flex flex-col w-[340px] pointer-events-auto space-y-2">
        <div className="grid grid-cols-4 gap-2">
          {gameData.slice(0, 4).map((game: GameInfo) => (
            <MicroGameCard
              key={game.slug}
              title={game.title}
              imageUrl={game.imageUrl}
              slug={game.slug}
            />
          ))}
        </div>

        <div className="bg-black/75 backdrop-blur-md border border-amber-900/35 rounded-xl p-3 space-y-2">
          <button
            type="button"
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-400/80"
            onClick={() => setChatOpen((o) => !o)}
          >
            <MessageSquare className="w-3 h-3" /> Chat {chatOpen ? '▾' : '▸'}
          </button>
          {chatOpen && (
            <>
              <div className="overflow-y-auto max-h-40 space-y-1.5 pr-1">
                {filtered.map((m, index) => (
                  <div
                    key={index}
                    ref={index === filtered.length - 1 ? messagesEndRef : null}
                    className="rounded-md px-2 py-1 bg-white/5 text-sm break-words"
                  >
                    <span className="font-medium text-amber-200/90">{m.author}</span>
                    <span className="text-stone-300">: {m.content}</span>
                  </div>
                ))}
                {!filtered.length && (
                  <p className="text-[11px] text-stone-500">Say hi — city chat is live.</p>
                )}
              </div>
              <input
                type="text"
                placeholder="Message the city…"
                className="w-full p-2 bg-black/50 border border-stone-700 text-white rounded-lg text-sm outline-none focus:border-amber-600/50"
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') {
                    sendMessage(e.currentTarget.value)
                    e.currentTarget.value = ''
                    e.currentTarget.blur()
                  }
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* Mobile joystick */}
      <div className="flex lg:hidden pointer-events-auto">
        <div className="absolute bottom-12 left-8">
          <Joystick
            size={100}
            baseColor="rgba(255, 255, 255, 0.35)"
            stickColor="rgba(232, 196, 106, 0.45)"
            move={(props) => gameInstance?.inputManager.handleJoystickMove(props)}
            stop={(props) => gameInstance?.inputManager.handleJoystickStop(props)}
          />
        </div>
      </div>
    </div>
  )
}
