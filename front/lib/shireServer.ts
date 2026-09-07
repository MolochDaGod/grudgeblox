import { LocalWorldStore } from '../../back/src/shire/LocalWorldStore'
import path from 'node:path'
import { timingSafeEqual } from 'node:crypto'

const globals=globalThis as typeof globalThis & {shireStore?:LocalWorldStore}
export function localStore(){
  if(process.env.GRUDGE_LOCAL_WORLD!=='shire')throw Error('Start The Middle-earth with its local launcher to enable local saves.')
  const root=process.env.GRUDGE_SHIRE_DATA_ROOT
  if(!root||!path.isAbsolute(root))throw Error('An explicit local storage root is required. Use the E: launcher.')
  return globals.shireStore??=new LocalWorldStore(root)
}
export function guardLocal(request:Request,write=false){
  const url=new URL(request.url),host=request.headers.get('host')||url.host
  if(!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host))throw Error('This world is available on this PC only.')
  const origin=request.headers.get('origin');if(origin&&new URL(origin).host!==host)throw Error('Open the world from its local launcher.')
  const store=localStore()
  if(write){const supplied=Buffer.from(request.headers.get('x-shire-session')||''),expected=Buffer.from(store.session);if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))throw Error('The local session changed. Refresh the page and try again.')}
  return store
}
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store'}})}
