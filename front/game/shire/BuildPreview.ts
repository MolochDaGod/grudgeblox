import * as T from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { World, WorldAction, Excavation, FURNITURE } from '@shared/shire/model'
import { entrancePlan, fitDoor } from '@shared/shire/building'

export class BuildPreview extends T.Group {
  private signature=''
  private material=new T.MeshBasicMaterial({color:0xf2d396,transparent:true,opacity:0.22,depthWrite:false,depthTest:false,side:T.DoubleSide})
  update(action:WorldAction|null,world:World):string {
    this.visible=false
    if(!action)return ''
    try{
      let volumes:Excavation[]=[];let label=''
      if(action.type==='excavate')volumes=[{...action.edit,id:'preview'}]
      else if(action.type==='entrance'){const plan=entrancePlan(world,action);volumes=plan.edits;label=`${plan.length} m tunnel · ${plan.drop.toFixed(1)} m descent · level chamber`}
      else if(action.type==='furnish'||action.type==='plant'){
        let position=action.position,size=action.type==='furnish'?FURNITURE[action.kind].size:{x:0.9,y:0.15,z:0.9}
        if(action.type==='furnish'&&action.kind==='door'){const fitted=fitDoor(world,position,action.yaw);position=fitted.position;size={x:fitted.fit.width,y:fitted.fit.height,z:0.25};label=`Hallway fit · ${size.x.toFixed(1)} m wide · ${size.y.toFixed(1)} m high`}
        volumes=[{id:'preview',kind:'dig',shape:'box',center:{...position,y:position.y+size.y/2},size,yaw:action.type==='furnish'?action.yaw:0,entrance:true}]
      }
      const signature=JSON.stringify(volumes.map(e=>[e.shape,e.size,e.slope]))
      if(signature!==this.signature){
        for(const child of [...this.children]){this.remove(child);(child as T.Mesh).geometry.dispose()}
        for(const e of volumes){
          let geometry:T.BufferGeometry
          if(e.shape==='sphere'){geometry=new T.SphereGeometry(1,28,18);geometry.scale(e.size.x,e.size.y,e.size.z)}
          else if(e.shape==='cylinder'){geometry=new T.CylinderGeometry(1,1,e.size.y,32);geometry.scale(e.size.x/2,1,e.size.z/2)}
          else {geometry=new RoundedBoxGeometry(e.size.x,e.size.y,e.size.z,3,Math.min(0.22,e.size.x/2,e.size.y/2,e.size.z/2));if(e.shape==='ramp'){const p=geometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+p.getZ(i)*(e.slope||0));geometry.computeVertexNormals()}}
          const mesh=new T.Mesh(geometry,this.material);mesh.renderOrder=20;this.add(mesh)
        }
        this.signature=signature
      }
      volumes.forEach((e,i)=>{this.children[i].position.set(e.center.x,e.center.y,e.center.z);this.children[i].rotation.y=e.yaw})
      this.material.color.setHex(volumes[0]?.kind==='fill'?0x8ccdc9:0xf2d396);this.visible=volumes.length>0
      return label
    }catch(e){return (e as Error).message}
  }
}
