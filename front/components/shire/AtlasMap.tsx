import { ATLAS_PLACES, ATLAS_ROADS, ATLAS_RIVERS, ATLAS_TOWNS } from '@shared/shire/atlas'
import { pathsNear } from '@shared/shire/atlasPaths'

export default function AtlasMap({x,z,near=false}:{x:number;z:number;near?:boolean}){
  const width=near?160:300,scale=near?1/5:300/310000,px=(v:number)=>near?80+(v-x)*scale:(v+145000)*scale,pz=(v:number)=>near?80+(v-z)*scale:(v+115000)*scale+19
  const path=(points:number[][])=>points.map((p,i)=>`${i?'L':'M'}${px(p[0]).toFixed(2)},${pz(p[1]).toFixed(2)}`).join(' ')
  const primary=['hobbiton','bywater','tuckborough','michel-delving','stock','bucklebury','bree','archet']
  return <svg className={near?'shire-minimap':'shire-large-map'} viewBox={`0 0 ${width} ${width}`} aria-label={near?'Nearby atlas map':'Shire and Bree atlas map'}>
    <rect width={width} height={width} rx="8" fill="#c2cba1"/>
    {ATLAS_RIVERS.map(r=><path key={r.id} d={path(r.points)} stroke="#608b91" strokeWidth={near?Math.max(1,r.width*scale):r.id==='brandywine'?2:0.8} fill="none"/>)}
    {(near?pathsNear(x,z,650):ATLAS_ROADS).map(r=><path key={r.id} d={path(r.points)} stroke="#f2e0ad" strokeWidth={near?1.5:1} strokeLinejoin="round" fill="none"/>)}
    {(near?ATLAS_TOWNS:ATLAS_PLACES.filter(p=>primary.includes(p.id))).map(p=><g key={p.id}><circle cx={px(p.x)} cy={pz(p.z)} r={near?5:2.6} fill="#755e3a"/>{!near&&<text x={px(p.x)} y={pz(p.z)+(p.id==='bywater'?11:-6)} textAnchor="middle" fontSize="7" fill="#34482e">{p.name}</text>}</g>)}
    <circle cx={px(x)} cy={pz(z)} r="4" fill="#fff4ce" stroke="#35583b" strokeWidth="1.5"/>
    <text x="12" y="17" fontSize="10" fill="#3b5236">N ↑</text>
    {!near&&<><path d="M15 278H63M15 275V281M63 275V281" stroke="#3b5236"/><text x="15" y="291" fontSize="8" fill="#3b5236">50 km · map-relative geography</text></>}
  </svg>
}
