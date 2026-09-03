import { SerializedComponent, SerializedComponentType } from '../network/server/serialized.js'
import { NetworkComponent } from '../network/NetworkComponent.js'

export class PlayerComponent extends NetworkComponent {
  constructor(
    entityId: number,
    public name: string = 'Player' + entityId,
    public raceId: string = 'human',
    public classId: string = 'adventurer',
    public characterId: string = '',
    public model3d: string = 'races/human.glb',
    public fx: string = '',
    public fxSeq: number = 0,
    public gameEra: string = 'voxel'
  ) {
    super(entityId, SerializedComponentType.PLAYER)
  }

  serialize(): SerializedPlayerComponent {
    return {
      n: this.name,
      r: this.raceId,
      k: this.classId,
      c: this.characterId,
      m: this.model3d,
      fx: this.fx,
      fxn: this.fxSeq,
      e: this.gameEra,
    }
  }

  deserialize(data: SerializedPlayerComponent): void {
    if (!data) return
    if (data.n) this.name = data.n
    if (data.r) this.raceId = data.r
    if (data.k) this.classId = data.k
    if (typeof data.c === 'string') this.characterId = data.c
    if (data.m) this.model3d = data.m
    if (typeof data.fx === 'string') this.fx = data.fx
    if (typeof data.fxn === 'number') this.fxSeq = data.fxn
    if (typeof data.e === 'string') this.gameEra = data.e
  }
}

export interface SerializedPlayerComponent extends SerializedComponent {
  n: string
  r?: string
  k?: string
  c?: string
  m?: string
  fx?: string
  fxn?: number
  e?: string
}


