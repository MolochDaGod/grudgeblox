import { Metadata } from 'next'
import LobbyShell from '@/components/LobbyShell'
import { SectionHeading, WorldCard } from '@/components/LobbyCards'
import { mapGames } from '@/lib/lobbyCatalog'

export const metadata: Metadata = {
  title: 'Maps · GrudgeBlox',
  description: 'Live GrudgeBlox map rooms — test, combat, lobby, GRUDOX, Streets.',
}

export default function MapsPage() {
  const maps = mapGames()
  return (
    <LobbyShell>
      <section className="mt-6 mb-10">
        <SectionHeading kicker="Maps" title="City, combat, Streets, hubs">
          Each map is a separate WebSocket authority. Locally they bind 8001–8005; production
          deploys one Railway/Docker service per slug.
        </SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {maps.map((game) => (
            <WorldCard key={game.slug} game={game} />
          ))}
        </div>
      </section>
    </LobbyShell>
  )
}
