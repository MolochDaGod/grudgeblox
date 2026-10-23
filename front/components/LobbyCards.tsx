import type { ReactNode } from 'react'
import Link from 'next/link'
import type { GameInfo } from '@/types'
import type { EraGeneration } from '@/lib/characterEras'
import { islandMeta } from '@/lib/lobbyCatalog'

export function SectionHeading({
  kicker,
  title,
  href,
  children,
}: {
  kicker: string
  title: string
  href?: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-amber-500/80">{kicker}</p>
        <h2 className="text-2xl md:text-3xl font-serif text-amber-50 mt-1">{title}</h2>
        {children ? <p className="text-stone-400 text-sm mt-2 max-w-2xl leading-relaxed">{children}</p> : null}
      </div>
      {href ? (
        <Link href={href} className="text-sm text-amber-400/90 hover:text-amber-200 shrink-0">
          View all →
        </Link>
      ) : null}
    </div>
  )
}

export function EraCard({ era }: { era: EraGeneration }) {
  return (
    <Link
      href={`/eras/${era.id}`}
      className="block rounded-2xl border border-amber-900/30 bg-black/40 p-5 hover:border-amber-600/50 hover:bg-black/55 transition-colors h-full"
    >
      <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: era.accent }}>
        Generation {era.generation}
      </p>
      <h3 className="text-xl font-serif text-amber-50 mt-2">{era.label}</h3>
      <p className="text-[11px] text-stone-500 mt-1">{era.tagline}</p>
      <p className="text-sm text-stone-400 mt-3 leading-relaxed line-clamp-3">{era.blurb}</p>
      <p className="text-xs text-amber-400/80 mt-4">Play {era.playSlug.replace('island-', '')} →</p>
    </Link>
  )
}

export function WorldCard({ game }: { game: GameInfo }) {
  const island = islandMeta(game.mapId)
  return (
    <a
      href={`/play/${game.slug}`}
      className="block group rounded-2xl overflow-hidden border border-amber-900/30 bg-gray-900/80 hover:border-amber-600/40 transition-colors h-full"
    >
      <div className="relative h-44">
        <img
          src={game.imageUrl}
          alt={game.title}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {game.sandbox ? (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-black/70 text-sky-200 border border-sky-800/40">
              live sandbox
            </span>
          ) : null}
          {game.engine ? (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-black/70 text-lime-200 border border-lime-800/40">
              {game.engine}
            </span>
          ) : null}
        </div>
      </div>
      <div className="p-4 space-y-1.5">
        <h3 className="text-lg font-serif text-amber-50">{game.title}</h3>
        <p className="text-sm text-stone-400 line-clamp-2">{game.metaDescription}</p>
        <p className="text-[11px] text-stone-500">
          port {game.websocketPort}
          {island ? ` · ${island.source}` : ''}
          {game.rosterMode === 'all-eras' ? ' · all eras' : ''}
        </p>
      </div>
    </a>
  )
}
