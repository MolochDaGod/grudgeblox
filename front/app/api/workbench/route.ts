import { NextRequest, NextResponse } from 'next/server'
import { mkdir, writeFile, rename } from 'node:fs/promises'
import path from 'node:path'
export const dynamic='force-dynamic'
/** Local test-portal heartbeat only; no user-supplied path or command. */
export async function POST(request:NextRequest){
  const host=request.headers.get('host')||'',origin=request.headers.get('origin')
  if(process.env.GRUDGE_LOCAL_WORLD!=='shire'||!/^127\.0\.0\.1:\d+$/.test(host)||(origin&&origin!==`http://${host}`))return NextResponse.json({error:'Local testing only'},{status:403})
  if(Number(request.headers.get('content-length')||0)>4096)return NextResponse.json({error:'Too large'},{status:413})
  try{const data=await request.json();const folder='E:/GameAssetVault/Game integrations/shire';await mkdir(folder,{recursive:true})
    const receipt={engine:'Three.js',entries:Math.max(0,Math.min(100000,Number(data.entries)||0)),actors:Math.max(0,Math.min(1000,Number(data.actors)||0)),library_updated:String(data.updated||'').slice(0,80),live_updates:true,updated:new Date().toISOString()}
    const temp=path.join(folder,'portal-status-'+process.pid+'.tmp');await writeFile(temp,JSON.stringify(receipt));await rename(temp,path.join(folder,'portal-status.json'));return NextResponse.json({ok:true})
  }catch{return NextResponse.json({error:'Heartbeat not saved'},{status:400})}
}
