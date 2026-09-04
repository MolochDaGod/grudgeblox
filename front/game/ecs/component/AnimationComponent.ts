import { Component } from '@shared/component/Component'
import * as THREE from 'three'
import { AvatarAnimator } from '@/game/avatarAnimator'

export class AnimationComponent extends Component {
  mixer: THREE.AnimationMixer
  animator: AvatarAnimator
  animationState: number = 0
  constructor(
    public entityId: number,
    public mesh: THREE.Mesh,
    public animations: THREE.AnimationClip[]
  ) {
    super(entityId)
    this.mixer = new THREE.AnimationMixer(mesh)
    this.animator = new AvatarAnimator(this.mixer, animations)
  }

  /** Swap in a freshly loaded avatar rig. Disposes the previous animator lane. */
  bind(mixer: THREE.AnimationMixer, clips: THREE.AnimationClip[]): void {
    this.animator.dispose()
    this.mixer = mixer
    this.animations = clips
    this.animator = new AvatarAnimator(mixer, clips)
  }
}
