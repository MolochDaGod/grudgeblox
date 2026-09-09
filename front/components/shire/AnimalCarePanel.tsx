'use client'
import { useState } from 'react'
import { Animal, Point, Species, World, SPECIES, distance } from '@shared/shire/model'
import { breedingIssue } from '@shared/shire/animalCare'
import { WILDLIFE } from '@shared/shire/wildlife'
import { combatActor, living } from '@shared/shire/combat'

function lifeStage(a:Animal){return a.age<SPECIES[a.species].maturity?'Young':'Adult'}
function optionLabel(a:Animal,w:World,position:Point){
  const wait=Math.ceil(a.cooldownUntil-w.time)
  const care=!living(combatActor(w,a.id))?'defeated':a.pregnant?'expecting young':wait>0?`recovering ${wait}s`:a.fedUntil<w.time?'needs feed':'fed'
  return `${a.name} · ${lifeStage(a)} · ${care} · ${Math.round(distance(a.position,position))} m`
}

export default function AnimalCarePanel({world,position,busy,onFeed,onBreed,onReact}:{world:World;position:Point;busy:boolean;onFeed:(id:string)=>void;onBreed:(dam:string,sire:string)=>void;onReact:(id:string,type:'calm'|'startle')=>void}){
  const [damId,setDam]=useState(''),[sireId,setSire]=useState(''),[filter,setFilter]=useState<Species|'all'>('all')
  const nearby=[...world.animals].sort((a,b)=>distance(a.position,position)-distance(b.position,position))
  const dam=world.animals.find(a=>a.id===damId),sire=world.animals.find(a=>a.id===sireId)
  const issue=breedingIssue(world,damId,sireId,position)
  const alive=(a:Animal)=>living(combatActor(world,a.id))
  const eligible=(a:Animal)=>alive(a)&&a.age>=SPECIES[a.species].maturity&&!a.pregnant&&a.cooldownUntil<=world.time
  const nameOf=(id:string)=>world.animals.find(a=>a.id===id)?.name||'Original parent record unavailable'
  function selectMother(id:string){setDam(id);const next=world.animals.find(a=>a.id===id);if(sire&&sire.species!==next?.species)setSire('')}
  return <>
    <div className="shire-eyebrow">CARE FOR A GROWING FAMILY</div>
    <h2>Animals & breeding</h2>
    <p>Feed both adult parents. Choose a female and a male of the same species while standing nearby.</p>
    <label>Mother<select value={damId} onChange={e=>selectMother(e.target.value)}>
      <option value="">Choose a female</option>
      {nearby.filter(a=>a.sex==='female').map(a=><option key={a.id} value={a.id} disabled={!eligible(a)}>{optionLabel(a,world,position)}</option>)}
    </select></label>
    <label>Father<select value={sireId} onChange={e=>setSire(e.target.value)}>
      <option value="">Choose a male{dam?` ${SPECIES[dam.species].label.toLowerCase()}`:''}</option>
      {nearby.filter(a=>a.sex==='male'&&(!dam||a.species===dam.species)).map(a=><option key={a.id} value={a.id} disabled={!eligible(a)}>{optionLabel(a,world,position)}</option>)}
    </select></label>
    <div className="shire-row">
      {dam&&<button disabled={busy||!alive(dam)||world.supplies.feed<1||distance(position,dam.position)>7} onClick={()=>onFeed(dam.id)}>Feed mother</button>}
      {sire&&<button disabled={busy||!alive(sire)||world.supplies.feed<1||distance(position,sire.position)>7} onClick={()=>onFeed(sire.id)}>Feed father</button>}
    </div>
    <p className="shire-breeding-status" aria-live="polite">{issue||'Both parents are ready to breed.'}</p>
    <button className="shire-primary" disabled={busy||!!issue} onClick={()=>onBreed(damId,sireId)}>Breed selected pair</button>
    <p className="shire-note">Feed left: {world.supplies.feed}. Stand within 7 m to feed an animal. Harvest crops to replenish feed.</p>
    <label>Show animals<select value={filter} onChange={e=>setFilter(e.target.value as Species|'all')}>
      <option value="all">All species · {world.animals.length} animals</option>
      {(Object.keys(SPECIES) as Species[]).map(species=><option value={species} key={species}>{SPECIES[species].label} · {world.animals.filter(a=>a.species===species).length}</option>)}
    </select></label>
    <div className="shire-animal-list">{nearby.filter(a=>filter==='all'||a.species===filter).map(a=>{
      const children=world.animals.filter(child=>child.parents?.includes(a.id)),health=combatActor(world,a.id)?.vitality
      const growing=Math.max(0,Math.ceil(SPECIES[a.species].maturity-a.age)),recovery=Math.max(0,Math.ceil(a.cooldownUntil-world.time))
      return <article key={a.id}><div>
        <strong>{a.name}</strong>
        <small>{lifeStage(a)} · {a.sex} · {Math.round(distance(a.position,position))} m · {a.fedUntil<world.time?'needs feed':'fed'}</small>
        <small>{health?`Health ${Math.ceil(health.hp)} / ${health.maxHp}`:''}{health?.hp===0?` · Defeated · returns in ${Math.max(0,Math.ceil((health.respawnAt||0)-world.time))}s`:` · ${a.activity||a.mood}`}</small>
        <small>{WILDLIFE[a.species].description}</small>
        {growing>0&&<small>Adult in {growing} seconds of play</small>}
        {a.pregnant&&<small>Young due in {Math.max(0,Math.ceil(a.pregnant.due-world.time))} seconds · Father: {nameOf(a.pregnant.sire)}</small>}
        {recovery>0&&<small>Recovering · {recovery} seconds remaining</small>}
        <details className="shire-family"><summary>Family details{children.length?` · ${children.length} offspring`:''}</summary>
          {a.parents?<p>Mother: {nameOf(a.parents[0])}<br/>Father: {nameOf(a.parents[1])}</p>:<p>One of this world’s founding animals.</p>}
          {children.length>0&&<p>Offspring: {children.map(child=>child.name).join(', ')}</p>}
        </details>
        <div className="shire-row"><button disabled={busy||!alive(a)||distance(position,a.position)>7} onClick={()=>onReact(a.id,'calm')}>Wait quietly</button><button disabled={busy||!alive(a)||distance(position,a.position)>9} onClick={()=>onReact(a.id,'startle')}>Call nearby</button></div>
      </div><button disabled={busy||!alive(a)||world.supplies.feed<1||distance(position,a.position)>7} onClick={()=>onFeed(a.id)}>Feed</button></article>
    })}</div>
    <p className="shire-note">Durations are shortened game rules. The retained rabbit is reused; development visuals for other species still await accepted production assets.</p>
  </>
}
