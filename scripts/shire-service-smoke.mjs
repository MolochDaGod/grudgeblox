import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {createHash} from 'node:crypto'
import http from 'node:http'
const base='http://127.0.0.1:4100',checks=[]
const check=async(name,fn)=>{await fn();checks.push(name);console.log(`PASS ${name}`)}
const bootstrap=await(await fetch(`${base}/api/shire`)).json()
assert.equal(bootstrap.storage,'E:\\GrudgeBloxData\\TheMiddleEarth')
const headers={'content-type':'application/json','x-shire-session':bootstrap.session}
const post=async(body,overrides={})=>{const r=await fetch(`${base}/api/shire`,{method:'POST',headers:{...headers,...overrides},body:JSON.stringify(body)});return {status:r.status,data:await r.json()}}
let w
await check('production route renders the local entry screen',async()=>{const r=await fetch(`${base}/play/shire`);assert.equal(r.status,200);assert.match(await r.text(),/Start a new world/)})
await check('local create, save and export use E: persisted revisions',async()=>{const created=await post({type:'new',name:'Service verification · 6 September',seed:42});assert.equal(created.status,200);w=created.data.world;const save=await post({type:'action',worldId:w.id,revision:w.revision,action:{type:'save'}});assert.equal(save.status,200);w=save.data.world;const backup=await post({type:'export',worldId:w.id});assert.equal(backup.status,200);assert.ok(backup.data.backupPath.startsWith(bootstrap.storage+'\\'));assert.equal(JSON.parse(await fs.readFile(backup.data.backupPath,'utf8')).id,w.id)})
await check('missing session, foreign origin and nonlocal host are refused',async()=>{assert.equal((await post({type:'new',name:'Rejected',seed:42},{'x-shire-session':''})).status,400);assert.equal((await post({type:'new',name:'Rejected',seed:42},{origin:'https://example.invalid'})).status,400);const hostStatus=await new Promise((resolve,reject)=>{http.get(`${base}/api/shire`,{headers:{host:'example.invalid'}},r=>{r.resume();resolve(r.statusCode)}).on('error',reject)});assert.equal(hostStatus,400)})
await check('stale revisions, malformed imports and oversized action requests are refused',async()=>{assert.equal((await post({type:'action',worldId:w.id,revision:0,action:{type:'save'}})).status,400);assert.equal((await post({type:'import',world:{version:1}})).status,400);assert.equal((await post({type:'action',worldId:w.id,revision:w.revision,action:{type:'save',padding:'x'.repeat(5000)}})).status,400)})
await check('all installed local assets match their manifest hashes, including optional enemies',async()=>{const manifest=await(await fetch(`${base}/api/shire/assets`)).json(),ids=new Set(manifest.assets.map(asset=>asset.id));assert.equal(ids.size,manifest.assets.length);for(const id of ['animal-rabbit','resident-human','resident-elf'])assert.ok(ids.has(id));for(const asset of manifest.assets){const r=await fetch(base+asset.url);assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer()),sha=new URL(base+asset.url).searchParams.get('sha');assert.equal(createHash('sha256').update(bytes).digest('hex'),sha)}assert.equal((await fetch(`${base}/api/shire/assets?id=..%2Fsecret`)).status,404)})
await check('live wildlife observations use the current player pose and reject invalid positions',async()=>{const player={...w.player,x:w.player.x+0.05};const observed=await post({type:'observe',worldId:w.id,player});assert.equal(observed.status,200);assert.equal(observed.data.world.player.x,player.x);assert.equal((await post({type:'observe',worldId:w.id,player:{...player,y:-100}})).status,400);assert.equal((await post({type:'observe',worldId:w.id,player},{'x-shire-session':''})).status,400)})
const report={at:new Date().toISOString(),status:'pass',scope:'Production HTTP service checks only; no running-game control or visual acceptance.',worldId:w.id,checks}
await fs.writeFile('E:\\GrudgeBloxData\\TheMiddleEarth\\evidence\\service-checks-latest.json',JSON.stringify(report,null,2))
console.log(JSON.stringify({passed:checks.length,worldId:w.id}))
