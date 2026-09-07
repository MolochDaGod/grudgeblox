import { Point, World } from './model'
import { height, WATER_LEVEL } from './terrain'

export const CINDERLORD = { assetId:'enemy-cinderlord', name:'Cinderlord', location:'Ashen Hollow', x:1050, z:-1180, height:6.5, aggro:24, leash:42, strikeRange:5.5, impactRange:8, impactTime:33/24, health:120 } as const
export type CinderlordPhase = 'idle'|'patrol'|'yell'|'chase'|'smash'|'return'|'defeated'
export function cinderlordSite(w:Pick<World,'seed'>):Point {
  // Keep the encounter on dry land for every supported world seed.
  for(let ring=0;ring<8;ring++)for(let i=0;i<8;i++){
    const x=CINDERLORD.x+Math.cos(i*Math.PI/4)*ring*22,z=CINDERLORD.z+Math.sin(i*Math.PI/4)*ring*22
    if([[-16,-16],[16,-16],[-16,16],[16,16],[0,0]].every(([dx,dz])=>height(x+dx,z+dz,w.seed)>WATER_LEVEL+1))return {x,y:height(x,z,w.seed),z}
  }
  return {x:CINDERLORD.x,y:height(CINDERLORD.x,CINDERLORD.z,w.seed),z:CINDERLORD.z}
}
export function outsideHome(w:Pick<World,'home'>,p:Point){return !w.home||Math.hypot(p.x-w.home.x,p.z-w.home.z)>60}

/** Encounter state is transient; it never changes animals, structures or save format. */
export class CinderlordBrain {
  phase:CinderlordPhase='idle'
  time=0
  health:number=CINDERLORD.health
  private impacted=false
  private strikeCooldown=0
  private set(phase:CinderlordPhase){this.phase=phase;this.time=0;this.impacted=false}
  strike(distance:number,allowed:boolean){
    if(!allowed||!Number.isFinite(distance)||distance>CINDERLORD.strikeRange||this.phase==='defeated'||this.strikeCooldown>0)return false
    this.strikeCooldown=0.65;this.health=Math.max(0,this.health-20)
    if(this.health===0)this.set('defeated')
    else if(this.phase==='idle'||this.phase==='patrol'||this.phase==='return')this.set('yell')
    return true
  }
  tick(dt:number,distance:number,homeDistance:number,allowed=true){
    dt=Math.max(0,Math.min(0.05,dt));this.time+=dt;this.strikeCooldown=Math.max(0,this.strikeCooldown-dt)
    if(this.phase==='defeated'){if(this.time>=45){this.health=CINDERLORD.health;this.set('return')}return false}
    if((!allowed||homeDistance>CINDERLORD.leash||distance>55)&&!['idle','patrol','return'].includes(this.phase))this.set('return')
    if((this.phase==='idle'||this.phase==='patrol')&&allowed&&distance<CINDERLORD.aggro)this.set('yell')
    else if(this.phase==='idle'&&this.time>5)this.set('patrol')
    else if(this.phase==='patrol'&&this.time>5)this.set('idle')
    else if(this.phase==='yell'&&this.time>=3.5)this.set('chase')
    else if(this.phase==='chase'&&distance<5.3)this.set('smash')
    else if(this.phase==='smash'){
      if(!this.impacted&&this.time>=CINDERLORD.impactTime){this.impacted=true;return true}
      if(this.time>=3.7)this.set('chase')
    }else if(this.phase==='return'&&homeDistance<0.5){this.health=CINDERLORD.health;this.set('idle')}
    return false
  }
}
