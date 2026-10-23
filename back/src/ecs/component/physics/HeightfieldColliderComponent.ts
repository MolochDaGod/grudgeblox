import Rapier from '@back/physics/rapier.js'
import { Component } from '@shared/component/Component.js'

export class HeightfieldColliderComponent extends Component {
  constructor(
    entityId: number,
    public nrows: number,
    public ncols: number,
    public heights: number[],
    public scale: { x: number; y: number; z: number },
    public collider?: Rapier.Collider
  ) {
    super(entityId)
  }
}
