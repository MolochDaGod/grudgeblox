import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createWorld, applyAction, validateWorld } from '../shared/shire/simulation'
import { height, clear, density, meshChunk } from '../shared/shire/terrain'
import { ATLAS_TOWNS, ATLAS_DESTINATIONS, ATLAS_RIVERS, ATLAS_SOURCE_SHA256, townPlots, regionalHeight, inBounds, waterAt, buildingBlocked, landcover } from '../shared/shire/atlas'

async function main(){
  const w=createWorld('Atlas verification',42,'shire-atlas-1'),checks:string[]=[],towns:Array<{name:string;buildings:number;arrival:{x:number;y:number;z:number}}> = []
  validateWorld(w);assert.ok(clear(w.player,w));checks.push('Atlas spawn is supported and clear')
  for(let i=0;i<ATLAS_TOWNS.length;i++){
    applyAction(w,{type:'travel',settlement:i});validateWorld(w);assert.ok(clear(w.player,w),ATLAS_TOWNS[i].name)
    assert.ok(density(w.player.x,w.player.y-0.4,w.player.z,w,w.edits)>0,ATLAS_TOWNS[i].name+' floor')
    const plots=townPlots(ATLAS_TOWNS[i]);assert.ok(plots.length>0);assert.ok(plots.every(p=>[p.x,p.z,p.scale].every(Number.isFinite)))
    towns.push({name:ATLAS_TOWNS[i].name,buildings:plots.length,arrival:{x:w.player.x,y:w.player.y,z:w.player.z}})
  }
  checks.push('Every settlement has buildings and a valid supported travel destination')
  for(let i=ATLAS_TOWNS.length;i<ATLAS_DESTINATIONS.length;i++){applyAction(w,{type:'travel',settlement:i});validateWorld(w);assert.ok(clear(w.player,w));assert.ok(w.player.y>waterAt(w.player.x,w.player.z,w))}
  checks.push('All six additional landmark destinations arrive on clear dry ground')
  for(const town of ATLAS_TOWNS){const plot=townPlots(town)[0],p={x:plot.x,y:height(plot.x,plot.z,w)+0.1,z:plot.z};assert.ok(buildingBlocked(p,w),town.name+' protected building')}
  checks.push('Every settlement has a solid public building footprint')
  assert.ok(w.player.x>100000);assert.equal(inBounds(166000,0,w),false);assert.equal(inBounds(0,-116000,w),false)
  assert.ok(Math.abs(height(12000,33000,w)-regionalHeight(12000,33000))<1)
  checks.push('Full-size regional coordinates and atlas elevation samples are used')
  for(const r of ATLAS_RIVERS){for(let i=1;i<r.points.length;i++)assert.ok(r.points[i][2]<=r.points[i-1][2]+0.0002,r.id);const p=r.points[Math.floor(r.points.length/2)];assert.ok(height(p[0],p[1],w)<waterAt(p[0],p[1],w),r.id+' carved below water')}
  checks.push('Seven rivers descend downstream and have beds below their water surfaces')
  let confluenceStep=0
  for(let x=70100;x<=70700;x+=2)for(let z=3400;z<=4000;z+=2){const y=height(x,z,w);confluenceStep=Math.max(confluenceStep,Math.abs(y-height(x+2,z,w)),Math.abs(y-height(x,z+2,w)))}
  assert.ok(confluenceStep<2,'Confluence has an abrupt wall: '+confluenceStep)
  checks.push('The Water and Brandywine confluence has continuous traversable banks without centreline-switch walls')
  assert.equal(landcover(120000,25000),10);assert.equal(landcover(109000,32000),3);assert.equal(landcover(94000,37000),3)
  checks.push('Open Barrow-downs take priority over the overlapping forest mask; the Old Forest stays wooded')
  const legacy=createWorld();assert.ok(clear(legacy.player,legacy));assert.equal(legacy.animals.length,20);assert.equal(legacy.generator,'shire-1');assert.equal(height(-30,-6,legacy),height(-30,-6,42));validateWorld(JSON.parse(JSON.stringify(legacy)))
  checks.push('Original worlds retain their terrain, wildlife count and save format')
  const p={x:12000,z:33000,y:height(12000,33000,w)-4};w.edits=[{id:crypto.randomUUID(),kind:'dig',shape:'box',center:{...p,y:p.y+1.5},size:{x:5,y:3,z:5},yaw:0,entrance:false}]
  assert.ok(density(p.x,p.y+1.5,p.z,w,w.edits)<0);assert.ok(density(p.x,p.y-0.2,p.z,w,w.edits)>0);assert.ok(density(p.x,p.y+3.4,p.z,w,w.edits)>0)
  const mesh=meshChunk(Math.floor(p.x/16),Math.floor(p.z/16),w,w.edits,0.5);assert.ok(mesh.positions.length);assert.ok(mesh.positions.every(Number.isFinite));assert.ok(mesh.normals.some((n,i)=>i%3===1&&n<-.8))
  checks.push('Atlas excavation keeps floor, cavity and roof in the collision/mesh field')
  const report={status:'pass',at:new Date().toISOString(),generator:w.generator,sourceSHA256:ATLAS_SOURCE_SHA256,checks,towns,buildings:towns.reduce((n,t)=>n+t.buildings,0)}
  await fs.writeFile('E:/GrudgeBloxData/TheMiddleEarth/evidence/shire-atlas-checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
}
main().catch(e=>{console.error(e);process.exitCode=1})
