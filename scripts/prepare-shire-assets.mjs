import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { registerHostiles } from './register-shire-hostiles.mjs'

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const root=process.env.GRUDGE_SHIRE_DATA_ROOT||'E:\\GrudgeBloxData\\TheMiddleEarth'
if(!/^E:[\\/]/i.test(root))throw Error('Shire storage must be on E: as directed by Al.')
await fs.access('E:\\')
for(const folder of ['assets','saves','cache','builds','evidence'])await fs.mkdir(path.join(root,folder),{recursive:true})
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const verify=async(file,expected)=>{const bytes=await fs.readFile(file);if(expected&&sha(bytes)!==expected.toLowerCase())throw Error(`Hash mismatch: ${file}`);return bytes}
const put=async(file,bytes)=>{await fs.mkdir(path.dirname(file),{recursive:true});try{const old=await fs.readFile(file);if(sha(old)!==sha(bytes))throw Error(`Existing asset differs; preserved: ${file}`)}catch(e){if(e.code!=='ENOENT')throw e;await fs.writeFile(file,bytes,{flag:'wx'})}}
const assets=[]
for(const [id,name] of [['resident-human','human.glb'],['resident-elf','high_elf.glb']]){
  const sourcePath=path.join(repo,'front','public','kit','4character','races',name),bytes=await verify(sourcePath),file=`${id}.glb`
  await put(path.join(root,'assets',file),bytes)
  assets.push({id,file,sha256:sha(bytes),byteSize:bytes.length,sourcePath,status:'existing-local-resident-kit',role:'non-player-resident'})
}
const catalogPath='E:\\GrudgePrompt3D\\saved-assets\\workflow-catalog\\99e0d789-48a5-4c0b-b961-e0c5713e7dce.json'
const catalogBytes=await verify(catalogPath),catalog=JSON.parse(catalogBytes)
const bundleBytes=await verify(catalog.evidenceBundleManifestPath,'518c8e31b04e25953fb13a859aebfe24ef5ff64819b9a31aee424b12f949d494')
const bundle=JSON.parse(bundleBytes),bundleDir=path.dirname(catalog.evidenceBundleManifestPath)
const approvalEntry=bundle.entries.find(e=>e.kind==='visual-approval'&&e.sha256==='1965b2dd257ec73aa886b58f7def213df48a22271c2866c71a091900aa2c3954')
if(!approvalEntry)throw Error('The final retained rabbit approval is missing.')
const approval=JSON.parse(await verify(path.join(bundleDir,approvalEntry.bundlePath),approvalEntry.sha256))
const expected='8e175fae59f5c09a4adc10d3c82645b6c9bd3ddad0f4656a1133f782bf87437c'
if(approval.assetSha256!==expected||approval.assetId!==bundle.assetId||approval.stage!=='animation'||!approval.inspection?.attestations?.animationMotionMatchesPrompt?.accepted||!approval.inspection?.attestations?.geometryIdentityAndCompleteness?.accepted)throw Error('The rabbit approval is not bound to the retained animated file.')
const rabbit=await verify(catalog.savedPath,expected)
const provenance=path.join(root,'assets','provenance','rabbit',bundle.bundleId)
for(const entry of bundle.entries){
  const source=path.resolve(bundleDir,entry.bundlePath),destination=path.resolve(provenance,entry.bundlePath)
  if(!source.startsWith(bundleDir+path.sep)||!destination.startsWith(provenance+path.sep))throw Error('Invalid evidence bundle path.')
  const bytes=await verify(source,entry.sha256);if(bytes.length!==entry.byteSize)throw Error('Evidence bundle size mismatch.')
  await put(destination,bytes)
}
await put(path.join(provenance,'manifest.json'),bundleBytes)
await put(path.join(provenance,'original-workflow-catalog.json'),catalogBytes)
await put(path.join(root,'assets','animal-rabbit.glb'),rabbit)
assets.push({id:'animal-rabbit',file:'animal-rabbit.glb',sha256:expected,byteSize:rabbit.length,status:'retained-visual-approval',assetId:catalog.assetId,sourceJobId:catalog.sourceJobId,sourcePath:catalog.savedPath,provenance:path.relative(path.join(root,'assets'),provenance),approvalSha256:approvalEntry.sha256,note:'Retained upstream acceptance; in-game scale, contact and animation acceptance are separate.'})
const cinderlordSource=path.join('E:\\GrudgeBloxData\\Cinderlord','runtime','cinderlord.glb')
const cinderlordHash='77a45e0aafe55fe5eaacff058a500036b3b8f1ebc29ee9c834345aa6d9bd1090'
const cinderlord=await verify(cinderlordSource,cinderlordHash)
await put(path.join(root,'assets','enemy-cinderlord.glb'),cinderlord)
assets.push({id:'enemy-cinderlord',file:'enemy-cinderlord.glb',sha256:cinderlordHash,byteSize:cinderlord.length,sourcePath:cinderlordSource,status:'original-blender-authored',role:'hostile-encounter',animations:['Idle','Walk','GroundSmash','Yell'],note:'Original magma creature authored for Al. Baked procedural textures and 38-bone animation rig; user visual acceptance is separate.'})
const references=[
  ['middle-earth-peoples-races-reference.xlsx','D:\\gruda-build\\outputs\\01a06c97-93b2-7dc3-bb41-7c5b4225cf71\\middle-earth-peoples-races-reference.xlsx','460be9ddc0f5b4bbdcc661609ed27ba73e6508ef4dd65e937a577dd12b67f5ad'],
  ['ultimate-atlas-research-specification.md','C:\\Users\\mjneu\\Documents\\Codex\\2026-09-02\\middle-earth-atlas-research\\outputs\\ultimate-atlas-research-specification.md','d3e3fdb4d3fc930d4813396bef02a47ab0112f7b78d4fd6857fba3c82844c918'],
  ['tolkien-legendarium-peoples-and-races-reference-catalogue.md','C:\\Users\\mjneu\\Documents\\Codex\\2026-09-02\\middle-earth-races-research\\outputs\\tolkien-legendarium-peoples-and-races-reference-catalogue.md','b0e3525ae59b16420834a9297ea1254cd4750ad93a4ca1e1088fea1924963a04']
]
for(const [name,source,hash] of references)await put(path.join(root,'assets','references',name),await verify(source,hash))
const manifest={version:1,createdAt:new Date().toISOString(),assets,references:references.map(([file,sourcePath,sha256])=>({file:`references/${file}`,sourcePath,sha256:sha256.toLowerCase()})),missingProductionSpecies:['sheep','chicken','cattle','pig','horse','fish','llama','bird','frog'],geography:'Designed layout; no measured geographic or fauna database verified.'}
await fs.writeFile(path.join(root,'assets','manifest.json'),JSON.stringify(manifest,null,2))
if(await fs.stat(path.join(root,'assets','hostile-races')).catch(()=>null))await registerHostiles(root)
console.log(JSON.stringify({storage:root,assets:assets.map(a=>({id:a.id,sha256:a.sha256,byteSize:a.byteSize})),verifiedEvidenceFiles:bundle.entries.length,missingProductionSpecies:manifest.missingProductionSpecies},null,2))
