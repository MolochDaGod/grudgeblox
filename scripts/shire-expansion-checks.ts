import assert from 'node:assert/strict'
import { createWorld, applyAction, advanceWorld, validateWorld } from '../shared/shire/simulation'
import { DEFAULT_TOOLS, entrancePlan, toolAction, fitDoor } from '../shared/shire/building'
import { clear, density, height, shapeDistance, WATER_LEVEL } from '../shared/shire/terrain'
import { SPECIES, Species, id, distance } from '../shared/shire/model'
import { WILDLIFE } from '../shared/shire/wildlife'
import { LocalWorldStore } from '../back/src/shire/LocalWorldStore'

export async function expansionChecks(check:(name:string,fn:()=>unknown|Promise<unknown>)=>Promise<void>,root:string){
  const w=createWorld(),player={...w.player},direction={x:-Math.sin(player.yaw),y:0,z:-Math.cos(player.yaw)}
  const action=toolAction({...DEFAULT_TOOLS,tool:'entrance'},player,player,direction)!
  assert.equal(action.type,'entrance');if(action.type!=='entrance')throw Error('Invalid fixture')
  const plan=entrancePlan(w,action)
  await check('Entry creates a supported descending walk into a level covered chamber',()=>{
    applyAction(w,action);assert.ok(plan.drop>=1.5);assert.ok(plan.end.y<player.y-1.5)
    for(let d=0;d<=plan.length;d+=0.1){const p={x:action.origin.x+direction.x*d,y:action.origin.y-d*0.22+0.08,z:action.origin.z+direction.z*d};assert.ok(clear(p,w),`walk blocked at ${d}`);assert.ok(density(p.x,p.y-0.25,p.z,w.seed,w.edits)>0,`unsupported at ${d}`)}
    for(let x=-1.5;x<=1.5;x+=0.5)for(let z=-1;z<=1;z+=0.5){const p={x:plan.end.x+x,y:plan.end.y,z:plan.end.z+z};assert.ok(clear(p,w));assert.ok(density(p.x,p.y+2.8,p.z,w.seed,w.edits)>0)}
    validateWorld(w)
  })
  await check('Entry is one undo group and cannot be undone with the player inside',()=>{
    w.player={...plan.end,yaw:player.yaw,pitch:0};assert.throws(()=>applyAction(w,{type:'undo'}),/Step outside/);assert.equal(w.edits.length,2)
    w.player=player;applyAction(w,{type:'undo'});assert.equal(w.edits.length,0);assert.equal(w.redo.length,2);applyAction(w,{type:'redo'});assert.equal(w.edits.length,2);assert.equal(w.redo.length,0)
  })
  await check('Sculpt starts at 2 m and each adjustable shape matches its full dimensions',()=>{
    assert.deepEqual([DEFAULT_TOOLS.brushWidth,DEFAULT_TOOLS.brushHeight,DEFAULT_TOOLS.brushDepth],[2,2,2])
    for(const shape of ['sphere','box','cylinder'] as const){const a=toolAction({...DEFAULT_TOOLS,tool:'dig',brushShape:shape,brushWidth:2,brushHeight:3,brushDepth:4,yaw:0},player,player,{x:0,y:0,z:-1})!;assert.equal(a.type,'excavate');if(a.type!=='excavate')continue;const e={...a.edit,id:id()};for(const [axis,half] of [['x',1],['y',1.5],['z',2]] as const){assert.ok(Math.abs(shapeDistance({...e.center,[axis]:e.center[axis]+half},e))<0.00001);assert.ok(shapeDistance({...e.center,[axis]:e.center[axis]+half+0.1},e)>0)}assert.ok(shapeDistance(e.center,e)<0)}
  })
  await check('A fitted door seals a wide hall and preserves a walkable open aperture',()=>{
    w.player=player;const position={...plan.end,y:plan.end.y-0.04},fitted=fitDoor(w,position,action.yaw);assert.ok(fitted.fit.width>4);assert.ok(fitted.fit.height>2.4)
    w.player={...plan.end,x:plan.end.x-direction.x*2,z:plan.end.z-direction.z*2,yaw:action.yaw,pitch:0}
    applyAction(w,{type:'furnish',kind:'door',position,yaw:action.yaw});const door=w.furniture.at(-1)!,center={...door.position,y:door.position.y+0.08}
    assert.ok(!clear(center,w));applyAction(w,{type:'use-furniture',id:door.id});assert.ok(clear(center,w))
    const side={x:Math.cos(action.yaw),z:-Math.sin(action.yaw)};assert.ok(!clear({...center,x:center.x+side.x*1.6,z:center.z+side.z*1.6},w));w.player={...center,yaw:0,pitch:0};assert.throws(()=>applyAction(w,{type:'use-furniture',id:door.id}),/Step clear/);assert.equal(door.open,true)
    const away={x:center.x+side.x*6,y:center.y,z:center.z+side.z*6};const neighbouring={...w,edits:[...w.edits,{id:id(),kind:'dig' as const,shape:'box' as const,center:{...away,y:away.y+1.2},size:{x:3,y:2.5,z:3},yaw:action.yaw,entrance:true}]};assert.ok(clear(away,neighbouring),'open door must not block the neighbouring corridor')
  })
  await check('Every species has a movement routine and respects its habitat after a long advance',()=>{
    const a=createWorld();a.player={x:-1000,y:height(-1000,-1000),z:-1000,yaw:0,pitch:0};const old=new Map(a.animals.map(b=>[b.id,{...b.position}]))
    advanceWorld(a,40)
    for(const species of Object.keys(SPECIES) as Species[]){assert.ok(WILDLIFE[species].description);const pair=a.animals.filter(b=>b.species===species);assert.ok(pair.every(b=>b.activity));assert.ok(pair.some(b=>distance(b.position,old.get(b.id)!)>0.05),`${species} never moved`)}
    for(const b of a.animals.filter(b=>b.species==='fish'))assert.ok(b.position.y<WATER_LEVEL&&b.position.y>height(b.position.x,b.position.z,a.seed))
    validateWorld(a)
  })
  await check('Nearby players startle wildlife, while quiet observation and feeding calm it',()=>{
    const a=createWorld(),rabbit=a.animals.find(b=>b.species==='rabbit')!;a.player={...rabbit.position,yaw:0,pitch:0};advanceWorld(a,0.5);assert.equal(rabbit.activity,'fleeing');applyAction(a,{type:'calm',id:rabbit.id});advanceWorld(a,0.5);assert.notEqual(rabbit.activity,'fleeing');applyAction(a,{type:'startle',id:rabbit.id});advanceWorld(a,0.5);assert.equal(rabbit.activity,'fleeing');applyAction(a,{type:'feed',id:rabbit.id});assert.equal(rabbit.startledUntil,0);assert.ok(rabbit.calmUntil!>a.time)
  })
  await check('Young follow their actual mother and feeders consume stored supplies',()=>{
    const a=createWorld(),mother=a.animals[0],father=a.animals[1];a.player={x:-200,y:height(-200,0),z:0,yaw:0,pitch:0};mother.calmUntil=1000
    const child={...structuredClone(mother),id:id(),age:0,parents:[mother.id,father.id] as [string,string],position:{...mother.position,x:mother.position.x-5}};a.animals.push(child);const before=distance(child.position,mother.position);advanceWorld(a,2);assert.equal(child.activity,'following mother');assert.ok(distance(child.position,mother.position)<before)
    const position={x:mother.position.x+3,y:0,z:mother.position.z};position.y=height(position.x,position.z,a.seed)+0.04;a.player={...position,x:position.x+2,yaw:0,pitch:0};applyAction(a,{type:'furnish',kind:'feeder',position,yaw:0});const feeder=a.furniture.at(-1)!;const feedBefore=a.supplies.feed;applyAction(a,{type:'use-furniture',id:feeder.id});assert.equal(a.supplies.feed,feedBefore-12);assert.equal(feeder.stock,12);a.player={x:-200,y:height(-200,0),z:0,yaw:0,pitch:0};for(const b of a.animals){b.fedUntil=0;b.calmUntil=1000};advanceWorld(a,30);assert.ok(feeder.stock!<12);assert.ok(feeder.stock!>=0)
  })
  await check('Bird perches and rabbit shelters respond to access toggles',()=>{
    const a=createWorld(),bird=a.animals.find(b=>b.species==='bird')!,rabbit=a.animals.find(b=>b.species==='rabbit')!;a.player={x:-200,y:height(-200,0),z:0,yaw:0,pitch:0};bird.calmUntil=1000
    const perch={id:id(),kind:'perch' as const,position:{x:bird.home.x,y:height(bird.home.x,bird.home.z),z:bird.home.z},yaw:0,open:true};a.furniture.push(perch)
    let perched=false;for(let i=0;i<40;i++){advanceWorld(a,0.5);if(bird.activity==='perching'&&distance(bird.position,{...perch.position,y:perch.position.y+1.78})<0.3)perched=true}assert.ok(perched,'bird never landed')
    a.player={...perch.position,x:perch.position.x+2,yaw:0,pitch:0};applyAction(a,{type:'use-furniture',id:perch.id});assert.equal(perch.open,false);bird.calmUntil=1000;advanceWorld(a,0.5);assert.notEqual(bird.activity,'perching')
    const shelter={id:id(),kind:'burrow' as const,position:{x:rabbit.position.x,y:height(rabbit.position.x,rabbit.position.z-1),z:rabbit.position.z-1},yaw:0,open:true};a.furniture.push(shelter);a.player={...rabbit.position,yaw:0,pitch:0};applyAction(a,{type:'startle',id:rabbit.id});advanceWorld(a,0.5);assert.equal(rabbit.activity,'sheltering')
  })
  await check('Expanded state and legacy optional fields survive save and reopen',async()=>{
    const store=new LocalWorldStore(root),legacy=createWorld();validateWorld(legacy);const old=await store.import(legacy);assert.equal((await new LocalWorldStore(root).read(old.id)).animals.length,20)
    w.player=player;w.animals[0].activity='watching';w.animals[0].calmUntil=w.time+45;const saved=await store.import(w),reopened=await new LocalWorldStore(root).read(saved.id);assert.deepEqual(reopened.edits,w.edits);assert.deepEqual(reopened.furniture,w.furniture);assert.equal(reopened.animals[0].calmUntil,w.animals[0].calmUntil)
    const observed=await store.read(old.id,{...old.player,x:old.player.x+0.05});assert.equal(observed.player.x,old.player.x+0.05);await assert.rejects(()=>store.read(old.id,{...old.player,x:NaN}),/observed position/)
  })
  await check('A rabbit can reach the shelter entrance from its side or rear',()=>{
    for(const yaw of [0,Math.PI/3])for(const local of [{x:-2,z:0},{x:0,z:-2}]){
      const a=createWorld(),rabbit=a.animals.find(b=>b.species==='rabbit')!,c=Math.cos(yaw),s=Math.sin(yaw),position={x:23,y:height(23,52),z:52};a.furniture.push({id:id(),kind:'burrow',position,yaw,open:true});rabbit.position={x:position.x+local.x*c+local.z*s,y:position.y,z:position.z-local.x*s+local.z*c};rabbit.startledUntil=100;rabbit.calmUntil=0;a.player={...rabbit.position,yaw:0,pitch:0};advanceWorld(a,30);assert.equal(rabbit.activity,'sheltering',`approach failed: ${yaw}, ${JSON.stringify(local)}`)
    }
  })
}
