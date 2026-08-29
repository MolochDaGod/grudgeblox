import { Component } from '@shared/component/Component.js'

/** A validated action requested by a connected player for the active world script. */
export class WorldActionEvent extends Component {
  constructor(
    entityId: number,
    public action: string
  ) {
    super(entityId)
  }
}
