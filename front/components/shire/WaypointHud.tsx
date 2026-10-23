import type { World } from '@shared/shire/model'
import type { ViewState } from '@/game/shire/ShireScene'
import { seasonAt } from '@shared/shire/lifeContent'

export default function WaypointHud({world,view,onFace}:{world:World;view:ViewState;onFace:()=>void}){
  const l=world.life!,p=l.waypoint!.position,dx=p.x-view.x,dz=p.z-view.z,d=Math.hypot(dx,dz)
  const bearing=Math.atan2(dx,-dz),relative=(bearing+(view.yaw||0))*180/Math.PI
  const compass=['N','NE','E','SE','S','SW','W','NW'][Math.round((bearing+Math.PI*2)/(Math.PI/4))%8]
  const minutes=d/(l.riding?7:3.6)/60
  return <div className="shire-waypoint"><span className="shire-bearing" style={{transform:`rotate(${relative}deg)`}} aria-hidden="true">↑</span><span>{l.waypoint!.label}</span><strong>{d>1000?(d/1000).toFixed(1)+' km':Math.round(d)+' m'} {compass}</strong><small>{d<5?'You are here':`About ${minutes<1?'1':Math.ceil(minutes)} min ${l.riding?'riding':'on foot'} · follow the lanes`}<br/>{seasonAt(world.time)} · {l.weather.kind}</small><button onClick={onFace} title="Turn to face this direction; walk along the lanes to reach it">Face direction</button></div>
}
