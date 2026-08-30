import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', '..')
const kitRoot = path.join(root, 'front', 'public', 'kit', '4character')
const manifest = JSON.parse(fs.readFileSync(path.join(kitRoot, 'manifest.json'), 'utf8'))
const expectedPrefixes = {
  human: 'WK_',
  barbarian: 'BRB_',
  dwarf: 'DWF_',
  high_elf: 'ELF_',
  orc: 'ORC_',
  undead: 'UD_',
}
const expectedRootTransforms = {
  human: {
    translation: [-0.0014364911291048776, -8.048379360899548e-7, 0.020837505270446033],
    scale: 0.9000006107704821,
  },
  barbarian: {
    translation: [0.0539088160765758, -8.139291648957478e-7, 0.050611639351709425],
    scale: 0.9544496320458742,
  },
  dwarf: {
    translation: [0.009251605989410966, -9.281633918606716e-7, 0.021755646833431674],
    scale: 1.0195284379900211,
  },
  high_elf: {
    translation: [0.012831267840659882, -8.038459105813404e-7, 0.04099302453903503],
    scale: 0.9939042150741306,
  },
  orc: {
    translation: [0.05518620877836121, -7.964915311980784e-7, 0.009813015592201935],
    scale: 0.9017934621303937,
  },
  undead: {
    translation: [0.0218947658675116, -0.005198907140630303, 0.02872452060325137],
    scale: 0.9918880685406671,
  },
}
const requiredClips = [
  'idle',
  'run',
  'attack',
  'strafe_left',
  'strafe_right',
]

assert.equal(manifest.orientationRoot, 'Root_normalized')
assert.equal(manifest.sourceForwardAxis, '+X')
assert.equal(manifest.worldForwardAxis, '+Z')
assert.equal(manifest.yaw, -Math.PI / 2)
assert.equal(manifest.heightM, 1.8)
assert.equal(manifest.meshRootContactPlaneY, -(0.5 + 1))
assert.deepEqual([...manifest.races].sort(), Object.keys(expectedPrefixes).sort())

function readGlbJson(file) {
  const bytes = fs.readFileSync(file)
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF')
  const jsonLength = bytes.readUInt32LE(12)
  assert.equal(bytes.toString('ascii', 16, 20), 'JSON')
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8').trimEnd())
}

for (const race of manifest.races) {
  const file = path.join(kitRoot, 'races', `${race}.glb`)
  const gltf = readGlbJson(file)
  const roots = (gltf.nodes || [])
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => node.name === manifest.orientationRoot)
  assert.equal(roots.length, 1, `${race}: one stable orientation root`)

  const sourceRoot = roots[0]
  const expectedRoot = expectedRootTransforms[race]
  const sceneRoots = gltf.scenes?.[gltf.scene || 0]?.nodes || []
  assert.deepEqual(sceneRoots, [sourceRoot.index], `${race}: orientation root is the authored scene root`)
  assert.deepEqual(
    sourceRoot.node.translation,
    expectedRoot.translation,
    `${race}: authored root translation stays unchanged`,
  )
  assert.deepEqual(
    sourceRoot.node.rotation || [0, 0, 0, 1],
    [0, 0, 0, 1],
    `${race}: orientation root rotation stays identity in the source`,
  )
  assert.deepEqual(
    sourceRoot.node.scale,
    [expectedRoot.scale, expectedRoot.scale, expectedRoot.scale],
    `${race}: authored uniform root scale stays unchanged`,
  )
  assert.deepEqual(
    sourceRoot.node.matrix || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    `${race}: orientation root matrix stays identity in the source`,
  )

  const animatedNodes = new Set()
  for (const animation of gltf.animations || []) {
    for (const channel of animation.channels || []) animatedNodes.add(channel.target.node)
  }
  assert.equal(animatedNodes.has(sourceRoot.index), false, `${race}: orientation root is not animated`)

  const reachable = new Set()
  const visit = (index) => {
    if (reachable.has(index)) return
    reachable.add(index)
    for (const child of gltf.nodes[index]?.children || []) visit(child)
  }
  visit(sourceRoot.index)
  const meshNodes = (gltf.nodes || [])
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => node.mesh !== undefined)
  assert.ok(meshNodes.length > 0, `${race}: original skinned meshes exist`)
  for (const { node, index } of meshNodes) {
    assert.ok(reachable.has(index), `${race}: mesh ${node.name} remains under orientation root`)
    assert.ok(node.name.startsWith(expectedPrefixes[race]), `${race}: preserved model identity ${node.name}`)
  }
  for (const skin of gltf.skins || []) {
    for (const joint of skin.joints || []) {
      assert.ok(reachable.has(joint), `${race}: skeleton joint stays under orientation root`)
    }
  }

  const clipNames = new Set((gltf.animations || []).map((animation) => animation.name))
  for (const clip of requiredClips) {
    assert.ok(clipNames.has(clip), `${race}: required ${clip} clip`)
  }
  console.log(
    `${race}: ${meshNodes.map(({ node }) => node.name).join(', ')} | ${clipNames.size} clips | root stable | contact ${manifest.meshRootContactPlaneY}`,
  )
}

console.log('Avatar orientation and contact-plane registry validation passed for all six bundled races.')
