import assert from 'node:assert/strict'
import {MouseTravelInput} from '../front/game/shire/MouseTravelInput'
import {validatedSettings} from '../shared/shire/life'
import {DEFAULT_LIFE_SETTINGS} from '../shared/shire/lifeContent'
const mouse=new MouseTravelInput()
mouse.press(2,2);assert(!mouse.forward);assert.equal(mouse.release(2),'point')
mouse.press(2,2);mouse.motion(4,4);assert.equal(mouse.release(2),undefined)
console.log('PASS right click and right drag have distinct outcomes')
for(const first of [0,2])for(const released of [0,2]){
  mouse.reset();mouse.press(first,first===0?1:2);mouse.press(first===0?2:0,3);assert(mouse.forward)
  assert.equal(mouse.release(released),undefined);assert(!mouse.forward)
  assert.equal(mouse.release(released===0?2:0),undefined)
  assert(!mouse.left&&!mouse.right)
}
console.log('PASS both press orders and both release orders move without accidental clicks')
mouse.press(0,1);mouse.press(2,3);mouse.reset();assert(!mouse.forward);assert.equal(mouse.release(0),undefined);assert.equal(mouse.release(2),undefined)
console.log('PASS focus loss or pause resets the entire mouse chord')
const previous={...DEFAULT_LIFE_SETTINGS};delete previous.clickToMove
assert.doesNotThrow(()=>validatedSettings(previous));assert.equal(validatedSettings({...previous,clickToMove:false}).clickToMove,false)
assert.throws(()=>validatedSettings({...previous,clickToMove:'yes'} as never),/click-to-move/)
console.log('PASS old comfort settings remain valid and the new preference validates')
