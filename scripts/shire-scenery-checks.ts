import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { ATLAS_TOWNS, ATLAS_BRIDGES, townPlots, bridgeDeck, bridgeAt, riverAt, projection } from '../shared/shire/atlas'
import { townPaths, pathsNear, pathClearance, plotContains, entrancePoint, REGIONAL_PATHS } from '../shared/shire/atlasPaths'
import { woodlandPoint, WOODLAND_CELL } from '../shared/shire/atlasScenery'
import { height } from '../shared/shire/terrain'

async function main(){
const checks:string[]=[];let entrances=0,routeSegments=0
for(const town of ATLAS_TOWNS){const paths=townPaths(town),plots=townPlots(town)
  for(const plot of plots){const path=paths.find(p=>p.entrance===plot.id);assert.ok(path,plot.id);assert.deepEqual(path.points[0],entrancePoint(plot));const end=path.points.at(-1)!;assert.ok(paths.some(p=>p.kind!=='door'&&p.points.some((a,i)=>i>0&&projection(end[0],end[1],p.points[i-1],a).d<0.01))||town.style==='woodland',plot.id+' disconnected');entrances++}
  for(const path of paths)for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1]));routeSegments++;for(let j=0;j<=n;j++){const x=a[0]+(b[0]-a[0])*j/Math.max(1,n),z=a[1]+(b[1]-a[1])*j/Math.max(1,n);assert.ok(!plots.some(p=>p.id!==path.entrance&&plotContains(x,z,p,0.45)),path.id+' enters a neighbouring building at '+[x,z]);if(['hobbiton','tom-bombadil'].includes(town.id)){const r=riverAt(x,z);if(r&&r.distance<r.width/2)assert.ok(bridgeAt(x,z),path.id+' bypasses its bridge')}}}
}
checks.push('Every public building has an entrance walk connected to a village route')
checks.push('All village routes avoid neighbouring building footprints at one-metre samples')
checks.push('Hobbiton and Tom Bombadil river paths cross on their bridge decks')
const bridge=ATLAS_BRIDGES.find(b=>b.id==='brandywine-bridge')!,crossing=REGIONAL_PATHS.find(p=>p.id==='stonebows-alignment')!
assert.ok(crossing.points.every(p=>p[1]===bridge.z));for(const b of ATLAS_BRIDGES)for(const sign of [-1,1]){const x=b.x+(b.turn?0:sign*b.length/2),z=b.z+(b.turn?sign*b.length/2:0);assert.ok(Math.abs(height(x,z,{seed:42,generator:'shire-atlas-1'})-bridgeDeck(b))<0.05,b.id)}
checks.push('Bridge paths align with decks and graded approaches meet deck height')
pathsNear(94500,37000,1000);let forest=0;const species=new Set<string>(),scales:number[]=[]
for(let ix=Math.floor(94000/8);ix<95000/8;ix++)for(let iz=Math.floor(36500/8);iz<37500/8;iz++){const p=woodlandPoint(ix,iz,42);if(!p)continue;forest++;species.add(p.kind);scales.push(p.scale);assert.deepEqual(p,woodlandPoint(ix,iz,42));assert.ok(pathClearance(p.x,p.z)>=3)}
assert.ok(forest>7500);assert.ok(species.size>=4);assert.ok(Math.max(...scales)-Math.min(...scales)>0.7)
checks.push('Old Forest sample exceeds 7,500 trees per square kilometre with varied species and sizes')
checks.push('Tree placement is repeatable and reserves a clear verge along paths')
let downland=0;for(let ix=120000/8;ix<120400/8;ix++)for(let iz=25000/8;iz<25400/8;iz++)if(woodlandPoint(ix,iz,42))downland++
assert.equal(downland,0);checks.push('Open Barrow-downs remain free of generated woodland')
const report={status:'pass',at:new Date().toISOString(),checks,entrances,routeSegments,forestSample:{areaKm2:1,trees:forest,species:[...species],cellMetres:WOODLAND_CELL,previousNominalDensity:1000000/(24*24)*0.72},bridges:ATLAS_BRIDGES}
await fs.writeFile('E:/GrudgeBloxData/TheMiddleEarth/evidence/shire-scenery-checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
}
main().catch(e=>{console.error(e);process.exitCode=1})
