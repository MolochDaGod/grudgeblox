import assert from 'node:assert/strict'
import {createWorld,advanceWorld,applyAction,validateWorld} from '../shared/shire/simulation'
import {ensureLife} from '../shared/shire/life'
import {height} from '../shared/shire/terrain'
import {resetPlayerTracking} from '../shared/shire/combat'
const w=createWorld('Animal home route',42,'shire-atlas-1');ensureLife(w,'homestead')
const cow=w.animals.find(a=>a.species==='cattle'&&a.sex==='female')!
w.player={...w.player,...cow.position,y:cow.position.y+.08};resetPlayerTracking(w)
applyAction(w,{type:'feed',id:cow.id});applyAction(w,{type:'life',action:{kind:'animal-adopt',id:cow.id}});applyAction(w,{type:'life',action:{kind:'animal-follow',id:cow.id}})
w.home={x:-221.62738755751917,y:height(-221.62738755751917,-189.3322140212804,w)+.08,z:-189.3322140212804};applyAction(w,{type:'return-home'})
let crossed=false
for(let i=0;i<180;i++){advanceWorld(w,1);if(cow.position.z<-20)crossed=true}
const remaining=Math.hypot(cow.position.x-w.player.x,cow.position.z-w.player.z)
console.log(JSON.stringify({crossed,remaining,position:cow.position,home:w.home}))
assert(crossed,'A following cow must use the Hobbiton bridge rather than stop above the riverbed')
assert(remaining<7,'The adopted cow must reach the home land through the village')
applyAction(w,{type:'life',action:{kind:'animal-home',id:cow.id}});validateWorld(w)
assert.equal(w.life!.stats.animalsHome,1)
console.log('PASS pasture bridge crossing, home following and settlement')
