/**
 * Live Super Terrain sandbox layer — generative NPCs, events, and chat-bot lines.
 * Used by the production game server (GTA lobby + dedicated island rooms).
 */
import { ISLAND_CATALOG, type IslandKind } from './islandBake.js'

export const ISLAND_HUB_SPACING = 200
export const ISLAND_CITY_OFFSET_X = 560

export type IslandNpcRole = 'guide' | 'scout' | 'warden' | 'raider'
export type IslandNpcBehavior = 'guard' | 'patrol' | 'hunt'
export type IslandEventKind = 'supply-drop' | 'storm-front' | 'wildlife' | 'festival' | 'raid-horn'

export type Vec3 = { x: number; y: number; z: number }

export type IslandOrigin = { x: number; y: number; z: number; islandId: string }

export type IslandNpcSpec = {
  role: IslandNpcRole
  behavior: IslandNpcBehavior
  name: string
  lines: string[]
  color: string
  islandId: string
  x: number
  y: number
  z: number
  waypoints: Vec3[]
}

export type IslandEventSpec = {
  kind: IslandEventKind
  title: string
  line: string
  periodSec: number
}

const NPC_NAMES: Record<IslandNpcRole, string[]> = {
  guide: ['Kesh', 'Mira', 'Solan', 'Rook', 'Nyx'],
  scout: ['Vell', 'Pim', 'Orrin', 'Sable', 'Jex'],
  warden: ['Brann', 'Hale', 'Torva', 'Quill', 'Ire'],
  raider: ['Ash-Fang', 'Red Wake', 'Gutter', 'Nox', 'Skel'],
}

const ROLE_LINES: Record<IslandNpcRole, string[]> = {
  guide: [
    'Landing is marked. Stay on the ridge if the weather turns.',
    'Every era parks here. Your kit is welcome.',
    'Ask me about islands, events, or /help.',
  ],
  scout: [
    'Tracks on the east slope. Something moved at last bell.',
    'I loop the perimeter. Wave if you need a heading.',
    'Fog hides the low path. Take the saddle.',
  ],
  warden: [
    'Keep steel sheathed near the camp unless a raid horn sounds.',
    'I hold this stone. Raiders hunt the outer ring.',
    'E to report in. Chat the Guide if you are lost.',
  ],
  raider: [
    'This ground is claimed.',
    'Run or pay the ridge.',
    'The horn means we push.',
  ],
}

const ROLE_COLOR: Record<IslandNpcRole, string> = {
  guide: '#e8c46a',
  scout: '#7dd3a0',
  warden: '#78b5ff',
  raider: '#e0553a',
}

export const ISLAND_EVENTS: IslandEventSpec[] = [
  {
    kind: 'supply-drop',
    title: 'Supply drop',
    line: 'Crate inbound. Look for the gold marker near a landing.',
    periodSec: 48,
  },
  {
    kind: 'storm-front',
    title: 'Storm front',
    line: 'Wind shears the ridge. Scouts pull in; raiders get bold.',
    periodSec: 72,
  },
  {
    kind: 'wildlife',
    title: 'Wildlife spike',
    line: 'Something large is moving the brush. Wardens on the inner path.',
    periodSec: 56,
  },
  {
    kind: 'festival',
    title: 'Era festival',
    line: 'All five generations on the pad. Guides are handing out headings.',
    periodSec: 90,
  },
  {
    kind: 'raid-horn',
    title: 'Raid horn',
    line: 'Horn from the outer ring. Raiders hunt anyone off the landing.',
    periodSec: 64,
  },
]

function hash2(a: number, b: number): number {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123
  return n - Math.floor(n)
}

function pick<T>(list: T[], seed: number, salt: number): T {
  return list[Math.floor(hash2(seed, salt) * list.length) % list.length]
}

export function islandHubOrigin(index: number, besideCity = false): Vec3 {
  const col = index % 4
  const row = Math.floor(index / 4)
  return {
    x: (besideCity ? ISLAND_CITY_OFFSET_X : 0) + col * ISLAND_HUB_SPACING,
    y: 0,
    z: row * ISLAND_HUB_SPACING,
  }
}

export function parseIslandMapId(raw?: string): IslandKind | null {
  if (!raw) return null
  const value = raw.trim().toLowerCase().replace(/^island-/, '')
  if (value === 'island' || value === 'all' || value === 'hub') return null
  const match = ISLAND_CATALOG.find((entry) => entry.id === value)
  return match ? match.id : null
}

export function generateNpcCast(
  islandId: string,
  seed: number,
  origin: Vec3,
  points: Vec3[]
): IslandNpcSpec[] {
  const sites = points.length > 0 ? points : [{ x: origin.x, y: origin.y + 4, z: origin.z }]
  const roles: IslandNpcRole[] = ['guide', 'scout', 'warden', 'raider']
  return roles.map((role, index) => {
    const site = sites[index % sites.length]
    const next = sites[(index + 1) % sites.length]
    const name = `${pick(NPC_NAMES[role], seed, index + 3)}`
    const behavior: IslandNpcBehavior =
      role === 'raider' ? 'hunt' : role === 'guide' ? 'guard' : 'patrol'
    return {
      role,
      behavior,
      name: `${name} the ${role}`,
      lines: ROLE_LINES[role],
      color: ROLE_COLOR[role],
      islandId,
      x: site.x,
      y: site.y,
      z: site.z,
      waypoints: [
        { x: site.x, y: site.y, z: site.z },
        { x: next.x, y: next.y, z: next.z },
        { x: (site.x + origin.x) / 2, y: site.y, z: (site.z + origin.z) / 2 },
      ],
    }
  })
}

export function nextIslandEvent(seed: number, elapsedSec: number): IslandEventSpec {
  const tick = Math.floor(elapsedSec / 12)
  return pick(ISLAND_EVENTS, seed, tick + 19)
}

export function chatbotReply(
  text: string,
  ctx: { islandTitle: string; era?: string; eventTitle?: string; npcNames: string[] }
): string | null {
  const q = text.trim().toLowerCase()
  if (!q) return null
  const addressed =
    q.startsWith('/') ||
    q.includes('help') ||
    q.includes('guide') ||
    q.includes('island') ||
    q.includes('where') ||
    q.includes('npc') ||
    q.includes('event') ||
    q.includes('bot') ||
    q.includes('era') ||
    q.includes('terrain')
  if (!addressed) return null
  if (q === '/help' || q.includes('help')) {
    return `Commands: /help /where /npcs /event. You are on ${ctx.islandTitle}. All five era generations spawn here.`
  }
  if (q.includes('where') || q === '/where') {
    return `${ctx.islandTitle}. Landing pad is the gold square. ${ctx.era ? `Your era tab is ${ctx.era}.` : ''}`
  }
  if (q.includes('npc') || q === '/npcs') {
    return `On this island: ${ctx.npcNames.join(', ') || 'guides and raiders'}. E to talk. Raiders hunt.`
  }
  if (q.includes('event') || q === '/event') {
    return ctx.eventTitle
      ? `Live event: ${ctx.eventTitle}. Watch chat for the next horn.`
      : 'No event on the pad yet — wait for the next generative tick.'
  }
  if (q.includes('era')) {
    return 'Voxel, Warlords, Nexus, Armada, and Game share this heightfield. Your mesh stays your era.'
  }
  if (q.includes('terrain') || q.includes('island')) {
    return `${ctx.islandTitle} is a Super Terrain / Island Engine bake. Physics is a Rapier heightfield.`
  }
  if (q.includes('guide') || q.includes('bot')) {
    return `Guide bot on ${ctx.islandTitle}. Ask /help if you need a heading.`
  }
  return null
}
