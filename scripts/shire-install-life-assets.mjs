import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
const root='E:/GrudgeBloxData/TheMiddleEarth/assets',folder=path.join(root,'shire-life'),registerFile=path.join(root,'manifest.json'),register=JSON.parse(fs.readFileSync(registerFile,'utf8'))
const records=[]
for(const name of fs.readdirSync(folder)){
  const file=path.join(folder,name,'manifest.json');if(!fs.existsSync(file))continue
  const record=JSON.parse(fs.readFileSync(file,'utf8')),bytes=fs.readFileSync(record.file)
  if(bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw Error('Invalid GLB: '+name)
  const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)).trim()),clips=(json.animations||[]).map(a=>a.name)
  for(const clip of record.animations)if(!clips.includes(clip))throw Error('Missing '+clip+' in '+name)
  if(!json.skins?.length)throw Error('Missing skin: '+name)
  const id=record.id,sha=crypto.createHash('sha256').update(bytes).digest('hex'),old=register.assets.find(a=>a.id===id)
  if(old&&!old.status.startsWith('original-shire-life'))throw Error('Refusing to replace a retained asset: '+id)
  const destination=id+'.glb';fs.copyFileSync(record.file,path.join(root,destination))
  const next={id,file:destination,sha256:sha,byteSize:bytes.length,status:'original-shire-life-authored',role:id.startsWith('animal')?'animal':'non-player-resident',sourcePath:record.file,nativeProject:record.nativeProject,units:'metres',forward:'+Z',animations:clips,provenance:`shire-life/${name}/manifest.json`,note:'Original Blender-authored geometry and actions. Native views retained; runtime and user visual acceptance are separate.'}
  register.assets=register.assets.filter(a=>a.id!==id);register.assets.push(next);records.push({id,sha256:sha,clips,skins:json.skins.length,meshes:json.meshes.length,primitives:json.meshes.reduce((n,m)=>n+m.primitives.length,0)})
}
if(records.length!==11)throw Error('Expected all eleven new entity packages before registration.')
register.missingProductionSpecies=[];register.updatedAt=new Date().toISOString();fs.writeFileSync(registerFile,JSON.stringify(register,null,2)+'\n')
fs.writeFileSync('E:/GrudgeBloxData/TheMiddleEarth/evidence/immersive-2026-09-10/asset-package-validation.json',JSON.stringify({time:new Date().toISOString(),records},null,2))
console.log(JSON.stringify({installed:records.length,assets:register.assets.length,records},null,2))
