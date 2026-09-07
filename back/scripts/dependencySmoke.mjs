import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { loadGltf, ImageLoader } from 'node-three-gltf'

// Exercise the actual backend GLTF/image adapter after the scoped sharp update.
const gltf = await loadGltf(fileURLToPath(new URL('../../front/public/kit/4character/races/human.glb', import.meta.url)))
let meshes = 0, textures = 0
gltf.scene.traverse((object) => {
  if (!object.isMesh) return
  meshes++
  for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
    if (!material.map) continue
    const image = material.map.image
    assert.ok(image.width > 0 && image.height > 0 && image.data?.length > 0)
    textures++
  }
})
assert.ok(meshes > 0 && textures > 0 && gltf.animations.length > 0)
const icon = await new ImageLoader().loadAsync(fileURLToPath(new URL('../../front/public/icons/grudgeblox-192.png', import.meta.url)))
assert.equal(icon.width, 192)
assert.equal(icon.height, 192)

const backRequire = createRequire(import.meta.url)
const adapterRequire = createRequire(backRequire.resolve('node-three-gltf'))
const frontRequire = createRequire(new URL('../../front/package.json', import.meta.url))
const { JSDOM } = adapterRequire('jsdom')
const window = new JSDOM('').window
try {
  const purify = frontRequire('dompurify')(window)
  const safe = purify.sanitize('<b>Hi</b><img src=x onerror=alert(1)><script>alert(2)</script><span onclick=alert(3) data-x=bad>text</span>', {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span', 'p', 'br'],
    ALLOWED_ATTR: ['style', 'class', 'className'], ALLOW_DATA_ATTR: false,
  })
  assert.equal(safe, '<b>Hi</b><span>text</span>')
} finally { window.close() }
console.log(`Dependency smoke passed: actual GLTF (${meshes} meshes, ${textures} textured materials, ${gltf.animations.length} clips), PNG decoding and sanitized text.`)
