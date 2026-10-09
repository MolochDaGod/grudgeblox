import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { mkdir, mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { serveWorkbench, workbenchHeartbeat, workbenchRoot } from '../front/lib/workbenchServer.ts'
import { workbenchModelUrl } from '../front/game/shire/workbenchContract.ts'

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const validation = process.env.SHIRE_VALIDATION_ROOT
if (!validation || !path.isAbsolute(validation)) throw Error('Set SHIRE_VALIDATION_ROOT to a disposable canonical D: project validation folder.')
await mkdir(validation, { recursive: true })
const root = await mkdtemp(path.join(validation, 'fixture-'))
const key = 'a'.repeat(24), revision = 'b'.repeat(12)
const model = 'assets/' + key + '/' + revision + '/Model.glb'
const env = { GRUDGE_LOCAL_WORLD: 'shire', GRUDGE_WORKBENCH_ROOT: root }
const request = (file = 'library.json', options = {}) => new Request('http://127.0.0.1:4100/workbench/' + file, {
  headers: { host: '127.0.0.1:4100', origin: 'http://127.0.0.1:4100' }, ...options,
})
await mkdir(path.dirname(path.join(root, model)), { recursive: true })
await writeFile(path.join(root, model), Buffer.from('synthetic GLB bytes'))
await writeFile(path.join(root, 'library.json'), JSON.stringify({ schema: 1, updated: 'first', assets: [{ key, model, revision }] }))

test('producer namespace inheritance and explicit consumer overrides share one root', () => {
  assert.equal(workbenchRoot({ GAME_ASSET_BULK: root }), path.resolve(root, 'Game integrations', 'shire'))
  assert.equal(workbenchRoot({ GAME_ASSET_VAULT: root }), path.resolve(root, 'Game integrations', 'shire'))
  assert.equal(workbenchRoot({ ...env, GAME_ASSET_BULK: 'ignored' }), root)
  assert.throws(() => workbenchRoot({}), /absolute/)
  assert.throws(() => workbenchRoot({ GRUDGE_WORKBENCH_ROOT: 'relative' }), /absolute/)
})

test('manifest reload observes producer replacement without a public junction or copied assets', async () => {
  let response = await serveWorkbench(request(), ['library.json'], env)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal((await response.json()).updated, 'first')
  await writeFile(path.join(root, 'library.json'), JSON.stringify({ schema: 1, updated: 'second', assets: [] }))
  response = await serveWorkbench(request(), ['library.json'], env)
  assert.equal((await response.json()).updated, 'second')
})

test('delivered immutable GLB streams preserve bytes and disable stale caching', async () => {
  const response = await serveWorkbench(request(model), model.split('/'), env)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'model/gltf-binary')
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(Buffer.from(await response.arrayBuffer()).toString(), 'synthetic GLB bytes')
})

test('missing deliveries stay unavailable; source files and traversal are never served', async () => {
  assert.equal((await serveWorkbench(request(), ['library.json'], { ...env, GRUDGE_WORKBENCH_ROOT: path.join(root, 'absent') })).status, 404)
  for (const parts of [['..', 'private'], ['assets', key, revision, 'Model.fbx'], ['portal-status.json']]) {
    assert.equal((await serveWorkbench(request(), parts, env)).status, 404)
  }
})

test('existing local-only request contract is retained for assets and acknowledgement', async () => {
  for (const options of [
    { headers: { host: 'example.test' } },
    { headers: { host: '127.0.0.1:4100', origin: 'https://example.test' } },
  ]) {
    assert.equal((await serveWorkbench(request('library.json', options), ['library.json'], env)).status, 403)
    assert.equal((await workbenchHeartbeat(request('library.json', { ...options, method: 'POST', body: '{}' }), env)).status, 403)
  }
  assert.equal((await serveWorkbench(request(), ['library.json'], { ...env, GRUDGE_LOCAL_WORLD: undefined })).status, 403)
})

test('heartbeat uses the selected producer folder and tolerates concurrent refreshes atomically', async () => {
  const before = await readFile(path.join(root, 'library.json'), 'utf8')
  const response = await Promise.all([1, 2].map(actors => workbenchHeartbeat(request('library.json', {
    method: 'POST', body: JSON.stringify({ entries: 3, actors, updated: 'second' }),
  }), env)))
  assert.deepEqual(response.map(r => r.status), [200, 200])
  const receipt = JSON.parse(await readFile(path.join(root, 'portal-status.json'), 'utf8'))
  assert.equal(receipt.engine, 'Three.js')
  assert.equal(receipt.entries, 3)
  assert.equal(receipt.library_updated, 'second')
  assert.equal(receipt.live_updates, true)
  assert.equal(await readFile(path.join(root, 'library.json'), 'utf8'), before)
  assert.equal((await readdir(root)).filter(f => f.endsWith('.tmp')).length, 0)
})

test('failed or oversized heartbeats never initialize an absent delivery', async () => {
  const absent = path.join(root, 'not-created')
  assert.equal((await workbenchHeartbeat(request('library.json', { method: 'POST', body: '{}' }), { ...env, GRUDGE_WORKBENCH_ROOT: absent })).status, 400)
  assert.ok(!(await readdir(root)).includes('not-created'))
  assert.equal((await workbenchHeartbeat(request('library.json', { method: 'POST', body: 'x'.repeat(4097) }), env)).status, 413)
})

test('model URLs bind immutable delivery revisions and encode path segments', () => {
  assert.equal(workbenchModelUrl({ model, revision: 'revision one' }), '/workbench/' + model + '?revision=revision%20one')
  assert.equal(workbenchModelUrl({ model, sha256: 'digest' }), '/workbench/' + model + '?revision=digest')
})

test('launcher Plan is read-only and resolves C data and one canonical D runtime root', async () => {
  const before = await readdir(validation)
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(project, 'scripts', 'shire-local.ps1'), '-Mode', 'Plan'], {
    encoding: 'utf8', env: { ...process.env, GRUDGE_SHIRE_DATA_ROOT: '', GRUDGE_WORKBENCH_ROOT: '', GAME_ASSET_BULK: '', GAME_ASSET_VAULT: '' },
  })
  assert.equal(result.status, 0, result.stderr)
  const plan = JSON.parse(result.stdout)
  assert.equal(plan.data, 'C:\\RuntimeData\\grudgegit\\grudgeblox\\TheMiddleEarth')
  for (const role of ['runtime', 'build', 'dependencies', 'temporary', 'logs', 'ledger']) {
    assert.ok(plan[role].startsWith('D:\\grudgegit\\grudgeblox\\'), role)
  }
  assert.equal(plan.url, 'http://127.0.0.1:4100/play/shire')
  assert.deepEqual(await readdir(validation), before)
})

test('launcher rejects obsolete F save storage and runtime folders outside the project', () => {
  for (const arguments_ of [
    ['-DataRoot', 'F:\\Data\\GrudgeBlox\\TheMiddleEarth'],
    ['-RuntimeRoot', 'D:\\build\\GrudgeBlox'],
  ]) {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(project, 'scripts', 'shire-local.ps1'), '-Mode', 'Plan', ...arguments_], { encoding: 'utf8' })
    assert.notEqual(result.status, 0)
  }
})

async function libraryHarness(load) {
  const { SourceTextModule, SyntheticModule, createContext } = await import('node:vm')
  const { stripTypeScriptTypes } = await import('node:module')
  let manifest = { schema: 1, updated: 'fixture', assets: [{ key, name: 'Synthetic', model, revision, spawn: true, habitat: 'land', length_m: 1, clips: [], animation_status: 'fixture' }] }
  let disposedTimers = 0, traversals = 0
  const urls = []
  const scene = { added: [], removed: [], add(root) { this.added.push(root) }, remove(root) { this.removed.push(root) } }
  class Vector3 { constructor(x, y, z) { this.x = x; this.y = y; this.z = z } }
  const context = createContext({
    console, Math, setInterval: () => 1, clearInterval: () => disposedTimers++,
    fetch: async url => url === '/api/workbench'
      ? { ok: true }
      : { ok: true, text: async () => JSON.stringify(manifest) },
  })
  const dependencies = {
    three: { Mesh: class {}, Texture: class {}, Vector3 },
    'three/examples/jsm/loaders/GLTFLoader.js': {
      GLTFLoader: class { loadAsync(url) { urls.push(url); return load(url) } },
    },
    'three/examples/jsm/utils/SkeletonUtils.js': {
      clone: source => ({ animations: source.animations, userData: {} }),
    },
    '@shared/shire/terrain': { height: () => 0, clear: () => true },
    '@shared/shire/atlas': { waterAt: () => Infinity },
    './workbenchContract': { workbenchModelUrl },
  }
  const source = (await readFile(path.join(project, 'front/game/shire/WorkbenchLibrary.ts'), 'utf8')).replace('constructor(private scene:T.Scene){', 'constructor(scene:T.Scene){this.scene=scene;')
  const code = stripTypeScriptTypes(source)
  const module = new SourceTextModule(code, { context })
  await module.link(specifier => {
    const exported = dependencies[specifier]
    assert.ok(exported, 'Unexpected runtime dependency: ' + specifier)
    return new SyntheticModule(Object.keys(exported), function () {
      for (const [name, value] of Object.entries(exported)) this.setExport(name, value)
    }, { context })
  })
  await module.evaluate()
  const library = new module.namespace.WorkbenchLibrary(scene)
  await new Promise(setImmediate)
  return {
    library, scene, urls,
    source: () => ({ scene: { animations: [], traverse() { traversals++ } }, animations: [{ name: 'source clip' }] }),
    manifest: value => { manifest = value },
    cleanup: () => ({ disposedTimers, traversals }),
  }
}

test('a failed model load can retry the same unchanged manifest revision', async () => {
  let attempts = 0, harness
  harness = await libraryHarness(async () => {
    if (++attempts === 1) throw Error('synthetic load failure')
    return harness.source()
  })
  try {
    await assert.rejects(harness.library.instantiate(key), /synthetic load failure/)
    const first = await harness.library.instantiate(key)
    const second = await harness.library.instantiate(key)
    assert.equal(harness.urls.length, 2)
    assert.equal(harness.urls[0], '/workbench/' + model + '?revision=' + revision)
    assert.notEqual(first, second)
    assert.equal(first.animations[0].name, 'source clip')
  } finally {
    harness.library.dispose()
  }
  await new Promise(setImmediate)
  assert.equal(harness.cleanup().disposedTimers, 1)
})

test('manifest replacement rejects an old pending actor and disposes its source cache', async () => {
  let resolve
  const pending = new Promise(done => { resolve = done })
  const harness = await libraryHarness(() => pending)
  harness.library.update(0.1, {}, { x: 0, y: 1, z: 0 })
  assert.equal(harness.urls.length, 1)
  harness.manifest({ schema: 1, updated: 'replaced', assets: [] })
  await harness.library.refresh()
  resolve(harness.source())
  await new Promise(setImmediate)
  assert.equal(harness.library.actors.length, 0)
  assert.equal(harness.scene.added.length, 0)
  assert.equal(harness.cleanup().traversals, 1)
  harness.library.dispose()
  assert.equal(harness.cleanup().disposedTimers, 1)
})

test('new deliveries change loader revision while settings reload preserves source identity', async () => {
  let harness
  harness = await libraryHarness(async () => harness.source())
  await harness.library.instantiate(key)
  harness.manifest({ schema: 1, updated: 'settings', assets: [{ key, model, revision, spawn: false }] })
  await harness.library.refresh()
  await harness.library.instantiate(key)
  harness.manifest({ schema: 1, updated: 'delivery', assets: [{ key, model, revision: 'new revision', spawn: false }] })
  await harness.library.refresh()
  await harness.library.instantiate(key)
  assert.deepEqual(harness.urls, [
    '/workbench/' + model + '?revision=' + revision,
    '/workbench/' + model + '?revision=' + revision,
    '/workbench/' + model + '?revision=new%20revision',
  ])
  harness.library.dispose()
})

test('Stage copies a committed fixture to D, records its revision and preserves an existing runtime', async () => {
  const source = await mkdtemp(path.join(validation, 'stage-source-'))
  const runtime = path.join(source, 'staged-runtime')
  await mkdir(path.join(source, 'scripts'), { recursive: true })
  await mkdir(path.join(source, 'front'), { recursive: true })
  await writeFile(path.join(source, 'scripts/shire-local.ps1'), await readFile(path.join(project, 'scripts/shire-local.ps1')))
  await writeFile(path.join(source, '.workspace-build.json'), JSON.stringify({ buildRoot: 'D:\\grudgegit\\grudgeblox' }))
  await writeFile(path.join(source, 'front/package.json'), JSON.stringify({ name: 'synthetic-fixture' }))
  for (const args of [
    ['init', '--initial-branch=main'],
    ['add', '.'],
    ['-c', 'user.name=Consumer Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Synthetic fixture'],
  ]) {
    const result = spawnSync('git', ['-C', source, ...args], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
  }
  const launch = mode => spawnSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(source, 'scripts/shire-local.ps1'),
    '-Mode', mode, '-RuntimeRoot', runtime,
  ], { encoding: 'utf8', env: { ...process.env, GRUDGE_SHIRE_DATA_ROOT: '', GRUDGE_WORKBENCH_ROOT: '' } })
  const staged = launch('Stage')
  assert.equal(staged.status, 0, staged.stderr)
  const receipt = JSON.parse(await readFile(path.join(runtime, '.shire-source.json'), 'utf8'))
  assert.equal(receipt.source.toLowerCase(), source.toLowerCase())
  assert.equal(receipt.files, 3)
  assert.equal(await readFile(path.join(runtime, 'front/package.json'), 'utf8'), '{"name":"synthetic-fixture"}')
  await writeFile(path.join(runtime, 'keep.txt'), 'Unique staged work')
  const repeated = launch('Stage')
  assert.notEqual(repeated.status, 0)
  assert.match(repeated.stderr, /already exists and was preserved/)
  assert.equal(await readFile(path.join(runtime, 'keep.txt'), 'utf8'), 'Unique staged work')
  // Ignore this test's managed snapshot so the original fixture remains clean.
  await writeFile(path.join(source, '.git/info/exclude'), '/staged-runtime/\n')
  const start = launch('Start')
  assert.notEqual(start.status, 0)
  assert.match(start.stderr, /Existing Next dependencies are missing/)
  assert.ok(!(await readdir(path.join(runtime, 'front'))).includes('node_modules'))
})

after(async () => {
  const report = {
    scope: 'Synthetic consumer/source tests only; no live Next, GPU, GAW or native portal',
    node: process.version,
    rssBytesAtEnd: process.memoryUsage().rss,
    resourceUsage: process.resourceUsage(),
    fixtureRoot: root,
    recordedAt: new Date().toISOString(),
  }
  await writeFile(path.join(validation, 'resources.json'), JSON.stringify(report, null, 2))
})