import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {shireNextBuildArguments} from './shire-next-build-args.mjs';
if(process.env.WORKSPACE_BUILD_STAGED!=='1'||process.env.WORKSPACE_LAUNCHER_PROJECT!=='grudgegit/grudgeblox')throw Error('Build Shire through Project Console.');
const front=process.cwd(),root=path.dirname(front),source='C:/grudgegit/grudgeblox';
if(!root.toLowerCase().startsWith('d:\\grudgegit\\grudgeblox\\'))throw Error('Shire build must stay in its D project workspace.');
const revision=spawnSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true});
if(revision.status)throw Error('Cannot verify canonical source revision.');
const listing=spawnSync('git',['-C',source,'ls-files','-z','--cached','--others','--exclude-standard'],{encoding:'utf8',windowsHide:true});
if(listing.status)throw Error('Cannot inventory current source.');
const files=[];
for(const relative of new Set(listing.stdout.split('\0').filter(Boolean))){
 if(!/^(front|shared)\//.test(relative)||relative.endsWith('/package.json'))continue;
 const canonical=path.join(source,relative),staged=path.join(root,relative);
 if(!fs.existsSync(canonical)||!fs.statSync(canonical).isFile())continue;
 const sha256=crypto.createHash('sha256').update(fs.readFileSync(canonical)).digest('hex');
 if(!fs.existsSync(staged)||crypto.createHash('sha256').update(fs.readFileSync(staged)).digest('hex')!==sha256)throw Error('Snapshot differs from current source: '+relative);
 files.push({path:relative,sha256});
}
const env={...process.env,GRUDGE_LOCAL_WORLD:'shire',NEXT_TELEMETRY_DISABLED:'1',GRUDGE_SHIRE_DATA_ROOT:'C:/RuntimeData/grudgegit/grudgeblox/TheMiddleEarth'};
function run(args,cwd){const r=spawnSync(process.execPath,args,{cwd,env,stdio:'inherit',windowsHide:true});if(r.error||r.status)throw r.error||Error('Shire build failed: '+r.status);}
run([path.join(root,'shared/node_modules/typescript/bin/tsc'),'--project',path.join(root,'shared/tsconfig.json')],root);
const nextPackage=JSON.parse(fs.readFileSync(path.join(front,'node_modules/next/package.json'),'utf8'));
run([path.join(front,'node_modules/next/dist/bin/next'),...shireNextBuildArguments(nextPackage.version)],front);
if(!fs.existsSync(path.join(front,'.shire-next/BUILD_ID')))throw Error('Next returned no Shire build identity.');
fs.writeFileSync(path.join(root,'.shire-source.json'),JSON.stringify({source,revision:revision.stdout.trim(),sourceFiles:files,stagedAt:new Date().toISOString(),nextVersion:nextPackage.version,consoleBuild:true},null,2));
