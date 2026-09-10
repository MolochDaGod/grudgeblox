import * as T from 'three'

/** A seated overlay for the original Hobbit rigs and the retained humanoid rig. */
export class RiderPose {
  private limbs:Array<{bone:T.Bone;rotation:T.Quaternion}>=[]
  constructor(model:T.Object3D){
    model.updateMatrixWorld(true)
    model.traverse(object=>{
      if(!(object instanceof T.Bone))return
      const name=object.name.toLowerCase(),left=name.endsWith('_l')||name.includes('left'),right=name.endsWith('_r')||name.includes('right')
      const leg=name.startsWith('front_')||name.includes('upleg')||name.includes('thigh'),arm=name.startsWith('arm_')||name.endsWith('leftarm')||name.endsWith('rightarm')
      if(!(left||right)||!(leg||arm))return
      const inverse=object.getWorldQuaternion(new T.Quaternion()).invert(),x=new T.Vector3(1,0,0).applyQuaternion(inverse),z=new T.Vector3(0,0,1).applyQuaternion(inverse)
      const rotation=object.quaternion.clone().multiply(new T.Quaternion().setFromAxisAngle(x,leg?-.55:-.65)).multiply(new T.Quaternion().setFromAxisAngle(z,(left?-1:1)*(leg?.58:.12)))
      this.limbs.push({bone:object,rotation})
    })
  }
  apply(){for(const {bone,rotation}of this.limbs)bone.quaternion.copy(rotation)}
}
