export interface GameInfo {
  title: string
  slug: string
  imageUrl: string
  websocketPort: number
  images?: { url: string; width: number; height: number; alt: string; type: string }[]
  metaDescription: string
  markdown: string
  /** Default fleet era for create/foundry. Sandboxes still load every era. */
  era?: string
  /** Show weapon skill bar 1–5 */
  combatEnabled?: boolean
  /** Playable by every fleet era when true. */
  sandbox?: boolean
  /** `all-eras` unions Warlords, Voxel, Nexus, Armada, and Game rosters. */
  rosterMode?: string
  /** Baked Island Terrain World Engine map id. */
  mapId?: string
}
