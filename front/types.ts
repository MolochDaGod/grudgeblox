export interface GameInfo {
  title: string
  slug: string
  imageUrl: string
  websocketPort: number
  images?: { url: string; width: number; height: number; alt: string; type: string }[]
  metaDescription: string
  markdown: string
  /** Fleet era hint: voxel (includes GRUDOX) | warlords | nexus */
  era?: string
  /** Show weapon skill bar 1–5 */
  combatEnabled?: boolean
}
