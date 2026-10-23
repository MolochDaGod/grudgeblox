import { Component } from '@shared/component/Component.js'
import type { IslandNpcBehavior, IslandNpcRole, Vec3 } from '@shared/maps/islandLive.js'

/** Server-only NPC brain for live island sandboxes. */
export class IslandNpcComponent extends Component {
  waypointIndex = 0
  talkCooldown = 0
  constructor(
    entityId: number,
    public role: IslandNpcRole,
    public behavior: IslandNpcBehavior,
    public islandId: string,
    public displayName: string,
    public lines: string[],
    public waypoints: Vec3[]
  ) {
    super(entityId)
  }
}
