'use client'
import type { InputAction } from '@shared/shire/lifeTypes'
export default function TouchControls({input,interact,apply}:{input:(key:InputAction,pressed:boolean)=>void;interact:()=>void;apply:()=>void}){
  function hold(key:InputAction,label:string){return <button aria-label={label} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);input(key,true)}} onPointerUp={()=>input(key,false)} onPointerCancel={()=>input(key,false)} onLostPointerCapture={()=>input(key,false)}>{label}</button>}
  return <div className="shire-touch" aria-label="Touch controls"><div className="shire-touch-pad"><div/>{hold('forward','↑')}<div/>{hold('left','←')}{hold('back','↓')}{hold('right','→')}</div><div className="shire-touch-actions">{hold('run','Run')}{hold('jump','Jump')}<button onClick={interact}>Use</button><button onClick={apply}>Tool</button></div></div>
}
