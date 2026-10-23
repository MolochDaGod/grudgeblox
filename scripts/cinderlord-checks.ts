import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createWorld, applyAction, validateWorld } from '../shared/shire/simulation'
import { clear, density } from '../shared/shire/terrain'
import { CinderlordBrain, CINDERLORD, cinderlordSite, outsideHome } from '../shared/shire/cinderlord'

let checks=0
const check=(name:string,fn:()=>void)=>{fn();checks++;console.log('PASS '+name)}
check('old saves travel to supported ground outside the aggro radius',()=>{
  for(const seed of [0,42,91,198,-99,2026]){
    const world=createWorld('Cinderlord validation',seed),before=JSON.stringify([world.animals,world.edits,world.furniture,world.supplies])
    applyAction(world,{type:'travel-cinderlord'});validateWorld(world)
    assert.ok(clear(world.player,world));assert.ok(density(world.player.x,world.player.y-.4,world.player.z,seed,world.edits)>0)
    const site=cinderlordSite(world);assert.ok(Math.hypot(world.player.x-site.x,world.player.z-site.z)>CINDERLORD.aggro)
    assert.equal(JSON.stringify([world.animals,world.edits,world.furniture,world.supplies]),before)
  }
})
check('roar precedes pursuit and the smash has one delayed impact',()=>{
  const brain=new CinderlordBrain();brain.tick(.05,15,0);assert.equal(brain.phase,'yell')
  for(let i=0;i<72;i++)brain.tick(.05,15,0)
  assert.equal(brain.phase,'chase');brain.tick(.05,4,0);assert.equal(brain.phase,'smash')
  let impacts=0;for(let i=0;i<70;i++){const hit=brain.tick(.05,4,0);if(i<26)assert.equal(hit,false);if(hit)impacts++}
  assert.equal(impacts,1)
})
check('home protection and leash interrupt an attack without impact',()=>{
  const brain=new CinderlordBrain();brain.tick(.05,4,0);brain.tick(.05,4,10,false);assert.equal(brain.phase,'return')
  assert.equal(brain.tick(.05,4,10,false),false)
  const world=createWorld(),site=cinderlordSite(world);world.home=site;assert.equal(outsideHome(world,site),false)
  const leash=new CinderlordBrain();leash.tick(.05,4,0);leash.tick(.05,4,50);assert.equal(leash.phase,'return')
})
check('strikes respect distance, cooldown, defeat and encounter reset',()=>{
  const brain=new CinderlordBrain();assert.equal(brain.strike(10,true),false);assert.equal(brain.strike(3,false),false)
  for(let hit=0;hit<6;hit++){assert.equal(brain.strike(3,true),true);assert.equal(brain.strike(3,true),false);for(let i=0;i<14;i++)brain.tick(.05,4,0)}
  assert.equal(brain.health,0);assert.equal(brain.phase,'defeated');assert.equal(brain.strike(3,true),false)
  for(let i=0;i<920;i++)brain.tick(.05,60,0)
  assert.equal(brain.health,120);assert.equal(brain.phase,'idle')
})
check('the actual game asset has one skinned mesh, textures and four distinct clips',()=>{
  const bytes=fs.readFileSync('E:/GrudgeBloxData/Cinderlord/runtime/cinderlord.glb'),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString())
  assert.equal(gltf.meshes.length,1);assert.equal(gltf.skins[0].joints.length,38);assert.equal(gltf.images.length,3)
  assert.deepEqual(gltf.animations.map((a:{name:string})=>a.name).sort(),['GroundSmash','Idle','Walk','Yell'])
  for(const a of gltf.animations)assert.ok(a.channels.length>100)
  for(const a of gltf.animations)for(const sampler of a.samplers)assert.equal(gltf.accessors[sampler.input].min[0],0)
  assert.ok(gltf.extensionsUsed.includes('KHR_materials_emissive_strength'))
})
console.log(`CINDERLORD_CHECKS_OK ${checks}`)
