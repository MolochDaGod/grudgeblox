import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createWorld, validateWorld } from '../shared/shire/simulation'
import { ensureLife } from '../shared/shire/life'
import { height } from '../shared/shire/terrain'

async function main(){
const base='http://127.0.0.1:4100',output='D:/grudgegit/grudgeblox/shire/validation/npc-live'
const bootstrap=await(await fetch(`${base}/api/shire`)).json()
assert.equal(bootstrap.storage,'C:\\RuntimeData\\grudgegit\\grudgeblox\\TheMiddleEarth')
const post=async(body:unknown)=>{const r=await fetch(`${base}/api/shire`,{method:'POST',headers:{'content-type':'application/json','x-shire-session':bootstrap.session},body:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,200,data.error);return data}
await fs.mkdir(output,{recursive:true})
if(process.argv.includes('--prepare')){
  const w=createWorld('NPC grazing acceptance 10 October',42,'shire-1');ensureLife(w,'homestead')
  if(process.argv.includes('--visual')){w.name='NPC renderer acceptance 10 October';w.time=200;for(const a of w.animals)a.fedUntil=w.time+120}
  const cow=w.animals.find(a=>a.species==='cattle')!;cow.fedUntil=0;cow.calmUntil=10000
  const px=cow.position.x+3,pz=cow.position.z+6
  w.player={x:px,y:height(px,pz,w)+.08,z:pz,yaw:Math.atan2(3,6),pitch:-.15}
  w.life!.settings.camera='first';w.life!.settings.autoPause=false;validateWorld(w)
  const result=await post({type:'import',world:w})
  await fs.writeFile(`${output}/world.json`,JSON.stringify({worldId:result.world.id,cowId:cow.id,player:w.player,before:cow.position,existingSaveIds:bootstrap.worlds.map((w:{id:string})=>w.id)},null,2))
  console.log(JSON.stringify({name:result.world.name,worldId:result.world.id,cowId:cow.id}));
}else{
  const fixture=JSON.parse(await fs.readFile(`${output}/world.json`,'utf8')),samples=[]
  for(let i=0;i<50;i++){
    const {world}=await post({type:'observe',worldId:fixture.worldId,player:fixture.player})
    const cow=world.animals.find((a:{id:string})=>a.id===fixture.cowId)
    samples.push({time:world.time,position:cow.position,activity:cow.activity,fedUntil:cow.fedUntil,goal:cow.goal,grazing:world.grazing})
    if(cow.goal?.completed&&cow.goal.kind==='rest')break
    await new Promise(resolve=>setTimeout(resolve,500))
  }
  const travelled=samples.some(s=>Math.hypot(s.position.x-fixture.before.x,s.position.z-fixture.before.z)>.3),grazed=samples.some(s=>s.activity==='grazing'),consumed=samples.some(s=>s.goal?.kind==='graze'&&s.goal.consumed>.15&&s.grazing?.[s.goal.target.slice(6)]?.amount<.85),completedGraze=samples.some(s=>s.goal?.kind==='graze'&&s.goal.completed>0&&!s.goal.target),next=completedGraze&&samples.some(s=>s.goal?.completed>0&&s.goal.kind==='rest')
  const report={passed:travelled&&grazed&&consumed&&next,worldId:fixture.worldId,cowId:fixture.cowId,travelled,grazed,consumed,completedGraze,next,samples}
  await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,samples:samples.length}));assert.ok(report.passed)
}
}
void main().catch(error=>{console.error(error);process.exitCode=1})
