import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import LobbyShell from '@/components/LobbyShell'
import { WorldCard } from '@/components/LobbyCards'
import { ERA_GENERATIONS, isFleetEra } from '@/lib/characterEras'
import { islandGames, mapGames } from '@/lib/lobbyCatalog'

type Params = Promise<{ era: string }>

export async function generateStaticParams() {
  return ERA_GENERATIONS.map((era) => ({ era: era.id }))
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { era } = await params
  const gen = ERA_GENERATIONS.find((item) => item.id === era)
  return {
    title: gen ? `${gen.label} · Generation ${gen.generation}` : 'Era · GrudgeBlox',
    description: gen?.blurb,
  }
}

export default async function EraPage({ params }: { params: Params }) {
  const { era } = await params
  if (!isFleetEra(era)) notFound()
  const gen = ERA_GENERATIONS.find((item) => item.id === era)
  if (!gen) notFound()
  const islands = islandGames()
  const maps = mapGames()

  return (
    <LobbyShell>
      <section className="mt-6 mb-8 rounded-3xl border border-amber-900/30 bg-black/35 p-6 md:p-8">
        <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: gen.accent }}>
          Generation {gen.generation}
        </p>
        <h1 className="text-4xl font-serif text-amber-50 mt-2">{gen.label}</h1>
        <p className="text-stone-400 mt-3 max-w-2xl leading-relaxed">{gen.blurb}</p>
        <Link
          href={`/play/${gen.playSlug}?era=${gen.id}`}
          className="inline-block mt-6 px-4 py-2 rounded-md bg-amber-700/80 hover:bg-amber-600 text-amber-50 text-sm"
        >
          Enter {gen.playSlug.replace('island-', '')} as {gen.label}
        </Link>
      </section>

      <h2 className="text-xl font-serif text-amber-100 mb-4">Islands this generation can enter</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {islands.map((game) => (
          <WorldCard key={game.slug} game={game} />
        ))}
      </div>

      <h2 className="text-xl font-serif text-amber-100 mb-4">Maps</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {maps.map((game) => (
          <WorldCard key={game.slug} game={game} />
        ))}
      </div>
    </LobbyShell>
  )
}
