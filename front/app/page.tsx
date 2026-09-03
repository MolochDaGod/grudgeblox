import { ExternalLink, Github, Twitter } from 'lucide-react'
import Link from 'next/link'
import { Metadata } from 'next'
import LobbyShell from '@/components/LobbyShell'
import { EraCard, SectionHeading, WorldCard } from '@/components/LobbyCards'
import { ERA_GENERATIONS } from '@/lib/characterEras'
import { SUPER_TERRAIN_GITHUB, islandGames, mapGames } from '@/lib/lobbyCatalog'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'GrudgeBlox · Super Terrain live sandboxes',
    description:
      'Generations of era, Super Terrain islands, maps, and multiplayer sandbox rooms on blox.grudge-studio.com.',
    openGraph: {
      title: 'GrudgeBlox · Super Terrain live sandboxes',
      description:
        'Mesh terrain from vibe-stack/super-terrain baked into all-era multiplayer rooms.',
      images: ['/PreviewTestGame.webp'],
      siteName: 'GrudgeBlox',
    },
    twitter: {
      card: 'summary_large_image',
    },
    alternates: {
      canonical: 'https://blox.grudge-studio.com/',
    },
  }
}

export default async function Home() {
  const islands = islandGames()
  const maps = mapGames()

  return (
    <LobbyShell>
      <section className="mt-4 mb-12 rounded-3xl border border-amber-900/30 bg-black/35 p-6 md:p-10">
        <p className="text-[11px] uppercase tracking-[0.24em] text-amber-500/85">
          Super Terrain · live sandboxes
        </p>
        <h1 className="text-4xl md:text-5xl font-serif text-amber-50 mt-3 max-w-3xl leading-tight">
          Mesh terrain, five era generations, one multiplayer kit.
        </h1>
        <p className="text-stone-400 mt-4 max-w-2xl leading-relaxed">
          <a href={SUPER_TERRAIN_GITHUB} className="text-amber-300 hover:text-amber-200">
            vibe-stack/super-terrain
          </a>{' '}
          authors the 4 km mesh world. GrudgeBlox bakes a Rapier heightfield per island and runs
          each map as its own WebSocket room so every fleet era can play live.
        </p>
        <div className="flex flex-wrap gap-3 mt-6">
          <Link
            href="/islands"
            className="px-4 py-2 rounded-md bg-amber-700/80 hover:bg-amber-600 text-amber-50 text-sm"
          >
            Play islands
          </Link>
          <Link
            href="/eras"
            className="px-4 py-2 rounded-md border border-amber-800/50 hover:border-amber-500 text-amber-100 text-sm"
          >
            Era generations
          </Link>
          <Link
            href="/maps"
            className="px-4 py-2 rounded-md border border-amber-800/50 hover:border-amber-500 text-amber-100 text-sm"
          >
            Maps
          </Link>
          <a
            href={SUPER_TERRAIN_GITHUB}
            className="px-4 py-2 rounded-md border border-stone-700 hover:border-stone-500 text-stone-200 text-sm inline-flex items-center gap-2"
            target="_blank"
            rel="noreferrer"
          >
            <Github className="h-4 w-4" /> Super Terrain
          </a>
        </div>
      </section>

      <section id="eras" className="mb-14">
        <SectionHeading kicker="Generations" title="Eras" href="/eras">
          Five fleet generations share every sandbox. Pick an era, then enter any live island or map
          with that roster tab already open.
        </SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {ERA_GENERATIONS.map((era) => (
            <EraCard key={era.id} era={era} />
          ))}
        </div>
      </section>

      <section id="islands" className="mb-14">
        <SectionHeading kicker="Super Terrain + Island Engine" title="Islands" href="/islands">
          Harbor, volcano, and fjord from Island Terrain World Engine. Alpine, granite, forest, and
          cavern from Super Terrain. Each island is a dedicated live room.
        </SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {islands.map((game) => (
            <WorldCard key={game.slug} game={game} />
          ))}
        </div>
      </section>

      <section id="maps" className="mb-14">
        <SectionHeading kicker="Worlds" title="Maps" href="/maps">
          City lobby, combat, Streets, GRUDOX, and the voxel bridge — same all-era roster, separate
          multiplayer processes.
        </SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {maps.map((game) => (
            <WorldCard key={game.slug} game={game} />
          ))}
        </div>
      </section>

      <section id="deploy" className="mb-10 rounded-2xl border border-amber-900/25 bg-black/40 p-6 md:p-8">
        <p className="text-[11px] uppercase tracking-[0.22em] text-amber-500/80">Server deployment</p>
        <h2 className="text-2xl font-serif text-amber-50 mt-2">Multiplayer live sandbox rooms</h2>
        <p className="text-stone-400 text-sm mt-3 max-w-3xl leading-relaxed">
          One Docker/Railway service per slug. Local compose maps host ports 8001–8012. Production
          uses a WSS host per room (or one host while you still share a single Railway replica). See{' '}
          <code className="text-amber-200/90">docs/SANDBOX_DEPLOY.md</code>.
        </p>
        <pre className="mt-4 text-xs text-stone-300 bg-black/60 rounded-xl p-4 overflow-x-auto border border-stone-800">
{`docker compose -f docker-compose.sandboxes.yml up -d
GAME_SCRIPT=islandSandboxScript.ts ISLAND_MAP=alpine-mesh pnpm run dev:back`}
        </pre>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link
          href={'https://discord.gg/kPhgtj49U2'}
          className="flex py-2 items-center justify-center px-8 font-medium border border-transparent rounded-md hover:bg-white/5 md:text-lg md:px-10"
        >
          <ExternalLink className="mr-2" />
          Project Discord
        </Link>
        <Link
          href={'https://twitter.com/iErcan_'}
          className="flex py-2 items-center justify-center px-8 font-medium border border-transparent rounded-md hover:bg-white/5 md:text-lg md:px-10"
        >
          <Twitter className="mr-2" />
          Twitter
        </Link>
        <Link
          href={'https://blox.grudge-studio.com'}
          className="flex py-2 items-center justify-center px-8 font-medium border border-transparent rounded-md hover:bg-white/5 md:text-lg md:px-10"
        >
          <ExternalLink className="mr-2" />
          Live · blox.grudge-studio.com
        </Link>
        <Link
          href={'https://github.com/MolochDaGod/grudgeblox'}
          className="flex py-2 items-center justify-center px-8 font-medium border border-transparent rounded-md hover:bg-white/5 md:text-lg md:px-10"
        >
          <Github className="mr-2" />
          Source Code
        </Link>
      </div>
    </LobbyShell>
  )
}
