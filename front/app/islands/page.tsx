import { Metadata } from 'next'
import LobbyShell from '@/components/LobbyShell'
import { SectionHeading, WorldCard } from '@/components/LobbyCards'
import { SUPER_TERRAIN_GITHUB, islandGames } from '@/lib/lobbyCatalog'

export const metadata: Metadata = {
  title: 'Islands · GrudgeBlox',
  description: 'Super Terrain and Island Engine bakes, each a live multiplayer sandbox room.',
}

export default function IslandsPage() {
  const islands = islandGames()
  return (
    <LobbyShell>
      <section className="mt-6 mb-10">
        <SectionHeading kicker="Islands" title="Baked terrain, live rooms">
          Import from{' '}
          <a href={SUPER_TERRAIN_GITHUB} className="text-amber-300 hover:text-amber-200">
            Super Terrain
          </a>{' '}
          (`meshterrain-world.json`) or Island Terrain World Engine, then run one process per map
          with `GAME_SCRIPT=islandSandboxScript.ts`.
        </SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {islands.map((game) => (
            <WorldCard key={game.slug} game={game} />
          ))}
        </div>
      </section>
    </LobbyShell>
  )
}
