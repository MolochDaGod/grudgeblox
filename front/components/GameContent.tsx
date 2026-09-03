// components/GameContent.tsx — Notblox play/test layout + fleet character select
'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import GamePlayer from '@/components/GamePlayer'
import { GameInfo } from '@/types'
import gameData from '../public/gameData.json'
import { MiniGameCard } from './GameCard'
import Navbar from './Navbar'
import FleetCharacterSelect from './FleetCharacterSelect'
import type { FleetCharacter } from '@/lib/fleetCharacters'
import { STORAGE } from '@/lib/fleetConfig'

export default function GameContent({
  gameInfo,
  initialEra,
}: {
  gameInfo: GameInfo
  initialEra?: string
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [playerName, setPlayerName] = useState<string>('')
  const [character, setCharacter] = useState<FleetCharacter | null>(null)

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE.playerName) || localStorage.getItem('playerName')
      if (saved) setPlayerName(saved)
    } catch {
      /* private */
    }
  }, [])

  const handlePlayClick = () => {
    const name = (playerName || character?.name || 'Player').trim()
    try {
      localStorage.setItem(STORAGE.playerName, name)
      localStorage.setItem('playerName', name)
      if (character?.id) {
        localStorage.setItem(STORAGE.characterId, character.id)
      }
    } catch {
      /* private */
    }
    setPlayerName(name)
    setIsPlaying(true)
  }

  return (
    <>
      {isPlaying ? (
        <GamePlayer
          {...gameInfo}
          playerName={playerName}
          character={character}
        />
      ) : (
        <div className="min-h-screen bg-gradient-to-b from-[#0c0a08] via-[#12100e] to-[#0a0a0c] text-stone-100 px-4">
          <div className="container mx-auto">
            <Navbar />
            <div className="flex flex-col lg:flex-row gap-8 mb-12 mt-4">
              {/* Cover — Notblox /play/test style */}
              <div className="lg:w-2/3 cursor-pointer" onClick={handlePlayClick}>
                <div className="relative group rounded-2xl overflow-hidden shadow-xl border border-amber-900/30">
                  <img
                    src={gameInfo.imageUrl}
                    alt={`${gameInfo.title} cover`}
                    className="w-full h-64 md:h-[400px] object-cover transform transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm rounded-xl px-3 py-1.5 flex items-center space-x-2 border border-emerald-700/40">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-emerald-100">Online · Metaverse</span>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
                    <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-black/60 border border-amber-800/40 text-amber-200/90">
                      {gameInfo.rosterMode === 'all-eras' ? 'all eras' : gameInfo.era || 'voxel'}
                    </span>
                    {gameInfo.sandbox && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-black/60 border border-sky-800/40 text-sky-200/90">
                        sandbox
                      </span>
                    )}
                    {gameInfo.mapId && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-black/60 border border-lime-800/40 text-lime-200/90">
                        {gameInfo.mapId}
                      </span>
                    )}
                    {gameInfo.combatEnabled !== false && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-black/60 border border-red-800/40 text-red-200/90">
                        weapon skills
                      </span>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent" />
                </div>
              </div>

              <div className="lg:w-1/3 flex flex-col justify-center space-y-4">
                <h1 className="text-3xl lg:text-4xl font-bold text-amber-50 font-serif tracking-wide">
                  {gameInfo.title}
                </h1>
                <p className="text-stone-400 text-base leading-relaxed">{gameInfo.metaDescription}</p>
                <FleetCharacterSelect
                  playerName={playerName}
                  onPlayerNameChange={setPlayerName}
                  selected={character}
                  onSelect={setCharacter}
                  onPlay={handlePlayClick}
                  gameTitle={gameInfo.title}
                  era={initialEra || gameInfo.era || 'voxel'}
                  rosterMode={gameInfo.rosterMode || (gameInfo.sandbox ? 'all-eras' : 'world-era')}
                  sandbox={!!gameInfo.sandbox}
                />
              </div>
            </div>

            <section className="w-full mb-10">
              <h2 className="text-xl font-bold text-amber-100/90 mb-4">More worlds</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {gameData
                  .filter((game) => game.slug !== gameInfo.slug && game.slug !== 'island')
                  .slice(0, 8)
                  .map((game) => (
                    <MiniGameCard {...game} key={game.slug} />
                  ))}
              </div>
            </section>

            <section className="w-full mb-12 bg-black/40 p-4 md:p-8 rounded-2xl border border-amber-900/25">
              <div className="prose prose-invert max-w-none prose-headings:text-amber-100 prose-a:text-amber-400">
                <ReactMarkdown>{gameInfo.markdown}</ReactMarkdown>
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  )
}
