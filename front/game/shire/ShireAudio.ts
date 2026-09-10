import type { World, Point } from '@shared/shire/model'
import { riverAt, isAtlas } from '@shared/shire/atlas'

/** Original synthesised score and spatial world sounds. No microphone or network audio. */
export class ShireAudio {
  private context?:AudioContext
  private master?:GainNode
  private music?:GainNode
  private effects?:GainNode
  private wind?:GainNode
  private water?:GainNode
  private waterPan?:PannerNode
  private sources:AudioScheduledSourceNode[]=[]
  private last?:Point
  private distance=0
  private nextBird=0
  private nextNote=0
  private note=0
  private lastEvent=0
  private doorState?:string
  private lastLifeEvent=0
  private world?:World
  private time=0
  private lastCaption=-10
  constructor(private caption:(text:string)=>void){window.addEventListener('pointerdown',this.start);window.addEventListener('keydown',this.start)}
  private noise(seconds:number){const ctx=this.context!,buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*seconds),ctx.sampleRate),data=buffer.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){const v=Math.random()*2-1;last=(last+.02*v)/1.02;data[i]=last*3.5}return buffer}
  private start=()=>{if(!this.context){this.context=new AudioContext();const c=this.context;this.master=c.createGain();this.master.connect(c.destination);this.music=c.createGain();this.effects=c.createGain();this.music.connect(this.master);this.effects.connect(this.master)
      const bed=(frequency:number,gain:number,spatial=false)=>{const source=c.createBufferSource();source.buffer=this.noise(8);source.loop=true;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=frequency;const volume=c.createGain();volume.gain.value=gain;source.connect(filter);filter.connect(volume);if(spatial){this.waterPan=c.createPanner();this.waterPan.panningModel='HRTF';this.waterPan.distanceModel='inverse';this.waterPan.refDistance=8;this.waterPan.maxDistance=100;volume.connect(this.waterPan);this.waterPan.connect(this.effects!)}else volume.connect(this.effects!);source.start();this.sources.push(source);return volume};this.wind=bed(450,.04);this.water=bed(1600,0,true)
    }if(this.context.state==='suspended')void this.context.resume()}
  private tone(frequency:number,duration:number,volume:number,type:OscillatorType='sine',end=frequency,position?:Point){
    const c=this.context;if(!c||!this.effects)return;const now=c.currentTime,osc=c.createOscillator(),gain=c.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency,now);osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),now+duration);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(Math.max(.001,volume),now+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(gain)
    if(position){const panner=c.createPanner();panner.panningModel='HRTF';panner.refDistance=3;panner.positionX.value=position.x;panner.positionY.value=position.y;panner.positionZ.value=position.z;gain.connect(panner);panner.connect(this.effects);osc.onended=()=>{osc.disconnect();gain.disconnect();panner.disconnect()}}else{gain.connect(this.effects);osc.onended=()=>{osc.disconnect();gain.disconnect()}}osc.start(now);osc.stop(now+duration+.02)
  }
  private pluck(frequency:number){
    const c=this.context!;const length=Math.round(c.sampleRate/frequency),buffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate),data=buffer.getChannelData(0),delay=new Float32Array(length);for(let i=0;i<length;i++)delay[i]=(Math.random()*2-1)*.25
    for(let i=0;i<data.length;i++){const at=i%length,next=(at+1)%length;data[i]=delay[at];delay[at]=.495*(delay[at]+delay[next])}
    const source=c.createBufferSource(),gain=c.createGain();source.buffer=buffer;gain.gain.value=.2;source.connect(gain);gain.connect(this.music!);source.onended=()=>{source.disconnect();gain.disconnect()};source.start()
  }
  private describe(text:string){if(this.world?.life?.settings.subtitles&&this.time-this.lastCaption>5){this.lastCaption=this.time;this.caption(text)}}
  update(w:World,p:Point,dt:number){
    this.world=w;this.time+=dt;const c=this.context,l=w.life;if(!c||!l)return;const settings=l.settings,paused=l.paused
    this.master!.gain.setTargetAtTime(paused?0:settings.masterVolume,c.currentTime,.1);this.music!.gain.setTargetAtTime(settings.musicVolume,c.currentTime,.15);this.effects!.gain.setTargetAtTime(settings.effectsVolume,c.currentTime,.15)
    c.listener.positionX.value=p.x;c.listener.positionY.value=p.y+1.4;c.listener.positionZ.value=p.z;c.listener.forwardX.value=-Math.sin(w.player.yaw);c.listener.forwardY.value=0;c.listener.forwardZ.value=-Math.cos(w.player.yaw);c.listener.upY.value=1
    const storm=['rain','snow'].includes(l.weather.kind),inside=!!l.interior;this.wind!.gain.setTargetAtTime(inside?.008:storm?.14:.035,c.currentTime,.5)
    const river=!inside&&isAtlas(w)?riverAt(p.x,p.z):undefined;this.water!.gain.setTargetAtTime(river&&river.distance<river.width/2+35?.16:0,c.currentTime,.4);if(river&&this.waterPan){this.waterPan.positionX.value=p.x+Math.min(15,river.distance);this.waterPan.positionY.value=river.stage;this.waterPan.positionZ.value=p.z}
    if(paused){this.last={...p};return}
    const doors=(l.interior?.id||'outside')+w.furniture.filter(f=>f.kind==='door').map(f=>f.id+f.open).join(':')+l.gates?.['hay-gate'];if(this.doorState!==undefined&&doors!==this.doorState){this.tone(140,.45,.06,'triangle',70);this.describe('A wooden door creaks and closes')}this.doorState=doors
    for(const event of l.events)if(event.id>this.lastLifeEvent){this.lastLifeEvent=event.id;if(w.time-event.time>1)continue;if(/crafted|gathered|collected|harvested|built|furnish/i.test(event.text)){this.tone(210,.12,.035,'triangle',95,p);this.describe('Hands at work')}else if(event.kind==='trade')this.tone(1500,.13,.035,'sine',1000);else if(event.kind==='quest')this.tone(660,.35,.035,'sine',880)}
    const threat=w.combat?.actors.some(a=>a.kind==='hostile'&&a.targetId==='player'&&a.vitality.hp>0&&Math.hypot(a.position.x-p.x,a.position.z-p.z)<45),night=w.time%600<150||w.time%600>525
    
    if(this.time>=this.nextNote){const tune=[146.83,220,246.94,293.66,329.63,293.66,246.94,220,164.81,220,293.66,329.63,293.66,246.94,220,164.81];this.pluck(tune[this.note%tune.length]*(threat?.75:night?.5:1));if(this.note%4===0)this.pluck(tune[this.note%tune.length]/2);this.note++;this.nextNote=this.time+(threat?.65:inside?1.35:night?1.8:1.15)+(this.note%4===0?.6:0)}
    if(this.last){const moved=Math.hypot(p.x-this.last.x,p.z-this.last.z);if(moved<2)this.distance+=moved;else this.distance=0;if(this.distance>(l.riding?1.3:1.5)&&!l.transport){this.distance=0;this.tone(l.riding?125:inside?180:95,.085,l.riding?.055:.035,'triangle',50);if(l.riding)this.tone(170,.065,.025,'triangle',70)}}this.last={...p}
    if(!inside&&this.time>=this.nextBird){this.nextBird=this.time+7+Math.random()*7;const bird=w.animals.find(a=>a.species==='bird'&&Math.hypot(a.position.x-p.x,a.position.z-p.z)<45);if(bird){this.tone(1800,.22,.05,'sine',2800,bird.position);this.describe('Birdsong in the trees')}else if(storm)this.describe(l.weather.kind==='snow'?'Snow whispers across the fields':'Rain rustles through the leaves')}
    for(const event of w.combat?.events||[])if(event.seq>this.lastEvent){this.lastEvent=event.seq;if(w.time-event.time>1)continue;const a=w.combat!.actors.find(a=>a.id===event.target);if(a&&Math.hypot(a.position.x-p.x,a.position.z-p.z)>40)continue;if(event.type==='attack')this.tone(l.equipment.weapon==='bow'?420:240,.16,.05,'triangle',90,a?.position);if(event.type==='damage')this.tone(80,.13,.07,'triangle',35,a?.position);if(event.type==='blocked')this.tone(700,.2,.04,'triangle',420,a?.position);if(event.type==='heal')this.tone(440,.3,.025,'sine',660)}
  }
  dispose(){window.removeEventListener('pointerdown',this.start);window.removeEventListener('keydown',this.start);for(const s of this.sources)try{s.stop()}catch{};void this.context?.close()}
}
