import { createReadStream } from 'node:fs'
import { readFile, realpath, stat, writeFile, rename, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import path from 'node:path'

type Environment = Record<string, string | undefined>
const headers = { 'Cache-Control': 'no-store' }
let heartbeatQueue: Promise<unknown> = Promise.resolve()

/** Inherit the producer's selected namespace, or use an explicit consumer override. */
export function workbenchRoot(env: Environment = process.env) {
  const base = env.GAME_ASSET_BULK || env.GAME_ASSET_VAULT
  const root = env.GRUDGE_WORKBENCH_ROOT || (base && path.join(base, 'Game integrations', 'shire'))
  if (!root || !path.isAbsolute(root)) throw Error('Configure the absolute Shire Workbench delivery folder.')
  return path.resolve(root)
}

function localRequest(request: Request, env: Environment) {
  const host = request.headers.get('host') || new URL(request.url).host
  const origin = request.headers.get('origin')
  return env.GRUDGE_LOCAL_WORLD === 'shire' &&
    /^127\.0\.0\.1:\d+$/.test(host) && (!origin || origin === `http://${host}`)
}

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers })
}

/** Serve the live manifest and immutable delivered GLBs without a public junction. */
export async function serveWorkbench(request: Request, parts: string[], env: Environment = process.env) {
  if (!localRequest(request, env)) return json({ error: 'Local testing only' }, 403)
  const relative = parts.join('/')
  if (relative !== 'library.json' && !/^assets\/[a-f0-9]{24}\/[a-f0-9]{12}\/Model\.glb$/.test(relative)) {
    return json({ error: 'Workbench asset not found' }, 404)
  }
  try {
    const root = await realpath(workbenchRoot(env))
    const file = await realpath(path.join(root, ...parts))
    const inside = path.relative(root, file)
    if (inside.startsWith('..') || path.isAbsolute(inside)) return json({ error: 'Workbench asset not found' }, 404)
    const info = await stat(file)
    if (!info.isFile()) return json({ error: 'Workbench asset not found' }, 404)
    if (relative === 'library.json') {
      return new Response(await readFile(file, 'utf8'), { headers: { ...headers, 'Content-Type': 'application/json' } })
    }
    const body = Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>
    return new Response(body, { headers: { ...headers, 'Content-Type': 'model/gltf-binary', 'Content-Length': String(info.size) } })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return json({ error: 'Workbench delivery unavailable' }, code === 'ENOENT' ? 404 : 503)
  }
}

/** Fixed producer acknowledgement, in the same selected folder as library.json. */
export async function workbenchHeartbeat(request: Request, env: Environment = process.env) {
  if (!localRequest(request, env)) return json({ error: 'Local testing only' }, 403)
  if (Number(request.headers.get('content-length') || 0) > 4096) return json({ error: 'Too large' }, 413)
  try {
    const text = await request.text()
    if (Buffer.byteLength(text) > 4096) return json({ error: 'Too large' }, 413)
    const data = JSON.parse(text)
    const folder = await realpath(workbenchRoot(env))
    // Delivery belongs to GAW. A consumer never creates a replacement library.
    await stat(path.join(folder, 'library.json'))
    const receipt = {
      engine: 'Three.js',
      entries: Math.max(0, Math.min(100000, Number(data.entries) || 0)),
      actors: Math.max(0, Math.min(1000, Number(data.actors) || 0)),
      library_updated: String(data.updated || '').slice(0, 80),
      live_updates: true,
      updated: new Date().toISOString(),
    }
    const temporary = path.join(folder, `portal-status-${process.pid}-${randomUUID()}.tmp`)
    const publish = heartbeatQueue.then(async () => {
      try {
        await writeFile(temporary, JSON.stringify(receipt), { flag: 'wx' })
        await rename(temporary, path.join(folder, 'portal-status.json'))
      } finally {
        await rm(temporary, { force: true })
      }
    })
    heartbeatQueue = publish.catch(() => {})
    await publish
    return json({ ok: true })
  } catch {
    return json({ error: 'Heartbeat not saved' }, 400)
  }
}
