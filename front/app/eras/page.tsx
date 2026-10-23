import { Metadata } from 'next'
import LobbyShell from '@/components/LobbyShell'
import { EraCard, SectionHeading } from '@/components/LobbyCards'
import { ERA_GENERATIONS } from '@/lib/characterEras'

export const metadata: Metadata = {
  title: 'Era generations · GrudgeBlox',
  description: 'Five fleet generations — Voxel, Warlords, Nexus, Armada, Game — play every Super Terrain island.',
}

export default function ErasPage() {
  return (
    <LobbyShell>
      <section className="mt-6 mb-10">
        <SectionHeading kicker="Generations of era" title="Every generation shares the sandboxes">
          One account, four slots per era. Sandbox rooms load the full roster so a Warlords hero and
          a Voxel kit can stand on the same Super Terrain bake.
        </SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ERA_GENERATIONS.map((era) => (
            <EraCard key={era.id} era={era} />
          ))}
        </div>
      </section>
    </LobbyShell>
  )
}
