import * as T from 'three'
import type { World } from '@shared/shire/model'
import { pasturePatches } from '@shared/shire/pasture'

/** Visible edible vegetation uses exactly the resource identity consumed by NPCs. */
export class PastureView {
  readonly root=new T.Group()
  private geometry=new T.ConeGeometry(.09,.55,3)
  private material=new T.MeshStandardMaterial({color:0x7c9745,roughness:1})
  private mesh=new T.InstancedMesh(this.geometry,this.material,4096)
  constructor(){this.mesh.count=0;this.root.add(this.mesh);this.mesh.frustumCulled=false}
  update(w:World){
    const patches=new Map<string,ReturnType<typeof pasturePatches>[number]>()
    if(!w.life?.interior)for(const a of w.animals)if(Math.hypot(a.position.x-w.player.x,a.position.z-w.player.z)<100)for(const p of pasturePatches(w,a.position,12))patches.set(p.id,p)
    const matrix=new T.Matrix4(),rotation=new T.Quaternion();let n=0
    for(const p of patches.values())for(let i=0;i<12&&n<4096;i++){
      const angle=i*2.399,x=p.position.x+Math.cos(angle)*(.2+i%4*.14),z=p.position.z+Math.sin(angle)*(.2+i%4*.14),scale=Math.max(.05,p.amount)
      matrix.compose(new T.Vector3(x,p.position.y+.275*scale,z),rotation,new T.Vector3(1,scale,1));this.mesh.setMatrixAt(n++,matrix)
    }
    this.mesh.count=n;this.mesh.instanceMatrix.needsUpdate=true
  }
  dispose(){this.geometry.dispose();this.material.dispose()}
}
