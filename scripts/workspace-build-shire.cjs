const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const engine=require('C:/github/ProjectLaunchers/workspace-tools/engine.cjs');
const retention=require('C:/github/ProjectLaunchers/workspace-tools/verified-build-retention.cjs');
const source=path.resolve(__dirname,'..'),p=JSON.parse(fs.readFileSync(path.join(source,'.workspace-build.json'),'utf8')),c=p.components.find(c=>c.id==='shire');
if(process.env.WORKSPACE_LAUNCHER_PROJECT!==p.id)throw Error('Build through registered Project Console.');
engine.validateProject(p);
const base=path.join(p.buildRoot,'shire');
function read(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}}
function save(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,file);}
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const candidates=fs.readdirSync(base,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>path.join(base,e.name)).filter(root=>{
 const owned=read(path.join(root,'.workspace-run.json'));
 return owned?.project===p.id&&owned.component==='shire'&&fs.existsSync(path.join(root,'failed.json'))&&fs.existsSync(path.join(root,'source/front/node_modules/next/dist/bin/next'))&&sha(path.join(root,'source/pnpm-lock.yaml'))===sha(path.join(source,'pnpm-lock.yaml'));
}).sort();
const root=candidates.at(-1);
if(!root)throw Error('No reusable owned Shire stage with matching installed lockfile. Use Build The Shire local world in Project Console to create one.');
engine.noLinks(root);const lock=fs.openSync(path.join(root,'.repair-build.lock'),'wx');
try{
 const stage=path.join(root,'source'),env=engine.buildEnv(root),node=process.execPath;
 // Reconcile only current source files. Retained installed dependencies and build work stay in this owned run.
 const list=cp.spawnSync('git',['-C',source,'ls-files','-z','--cached','--others','--exclude-standard'],{encoding:'utf8',windowsHide:true});if(list.status)throw Error('Source inventory failed.');
 for(const rel of new Set(list.stdout.split('\0').filter(Boolean))){
  if(!engine.safeRelative(rel)||rel.split(/[\\/]/).some(x=>['.git','node_modules','.next','.shire-next','__pycache__'].includes(x)))continue;
  const from=path.join(source,rel),to=path.join(stage,rel);if(!fs.existsSync(from)||!fs.statSync(from).isFile()||rel.endsWith('package.json'))continue;
  engine.noLinks(from);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);
 }
 env.WORKSPACE_LAUNCHER_PROJECT=p.id;env.WORKSPACE_LAUNCHER_ACTION='Build';
 const previous=read(path.join(stage,'.shire-source.json'));
 const runtimeProof=previous?.sourceFiles?.filter(row=>/^(front|shared)\//.test(row.path));
 const compiledUnchanged=runtimeProof?.length&&runtimeProof.every(row=>fs.existsSync(path.join(source,row.path))&&sha(path.join(source,row.path))===row.sha256)&&fs.existsSync(path.join(stage,'front/.shire-next/BUILD_ID'));
 if(!compiledUnchanged){
  const result=cp.spawnSync(node,[path.join(stage,'scripts/build-shire.mjs')],{cwd:path.join(stage,'front'),env,stdio:'inherit',windowsHide:true});
  if(result.error||result.status)throw result.error||Error('Shire build failed: '+result.status);
 }else{previous.sourceFiles=runtimeProof;previous.revision=cp.spawnSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).stdout.trim();save(path.join(stage,'.shire-source.json'),previous);console.log('Reusing the verified unchanged compiled Shire runtime.');}
 const runID=path.basename(root),releaseID=new Date().toISOString().replace(/[^0-9TZ]/g,'')+'-shire',final=path.join(p.outputRoot,'shire',releaseID);
 if(fs.existsSync(final))throw Error('Published physical run already exists and was preserved.');
 const deployment=path.join(root,'deployment-hoisted/runtime'),pnpm=path.join(root,'package-manager/node_modules/pnpm/bin/pnpm.mjs');
 // Dependencies may be reused, but every release must contain the freshly compiled runtime source.
 for(const relative of ['front','shared'])engine.copyTree(path.join(stage,relative),path.join(deployment,relative),'publish',{source:path.join(stage,relative),destination:path.join(deployment,relative),skipNames:new Set(['node_modules','.shire-next'])});
 if(!fs.existsSync(path.join(deployment,'.dependencies-ready.json'))){
  for(const name of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml'])fs.copyFileSync(path.join(stage,name),path.join(deployment,name));
  env.XDG_CACHE_HOME=path.join(root,'cache/pnpm-meta');env.COREPACK_HOME=path.join(root,'cache/corepack');
  const deployed=cp.spawnSync(node,[pnpm,'install','--frozen-lockfile','--offline','--config.node-linker=hoisted','--store-dir',env.PNPM_STORE_DIR],{cwd:deployment,env,stdio:'inherit',windowsHide:true});
  if(deployed.error||deployed.status)throw deployed.error||Error('Frozen offline Shire runtime dependency deployment failed.');
  save(path.join(deployment,'.dependencies-ready.json'),{lockfile:sha(path.join(stage,'pnpm-lock.yaml')),offline:true,frozen:true});
 }
 for(const relative of ['node_modules/@notblox/shared','front/node_modules/@notblox/shared']){
  const link=path.join(deployment,relative);
  if(fs.existsSync(link)&&fs.lstatSync(link).isSymbolicLink()){
   const target=fs.realpathSync(link);if(path.resolve(target)!==path.resolve(path.join(deployment,'shared')))throw Error('Unexpected workspace dependency target.');
   const physical=link+'.physical';engine.copyTree(target,physical,'publish',{source:target,destination:physical,skipNames:new Set(['node_modules'])});
   fs.rmdirSync(link);fs.renameSync(physical,link);
  }
  if(fs.existsSync(link))engine.copyTree(path.join(deployment,'shared'),link,'publish',{source:path.join(deployment,'shared'),destination:link,skipNames:new Set(['node_modules'])});
 }
 engine.copyTree(path.join(stage,'front/.shire-next'),path.join(deployment,'front/.shire-next'),'publish',{source:path.join(stage,'front/.shire-next'),destination:path.join(deployment,'front/.shire-next'),skipNames:new Set(['cache'])});
 fs.copyFileSync(path.join(stage,'.shire-source.json'),path.join(deployment,'.shire-source.json'));
 const runtime=path.join(final,'payload/runtime');engine.copyTree(deployment,runtime);
 const launch={type:'node',relative:'runtime/front',script:'start',manager:'pnpm'};
 engine.preparePublicStorage(p,c,path.join(final,'payload'),launch);
 const receipt={schemaVersion:1,project:p.id,component:c.id,runID,completedAt:new Date().toISOString(),source:p.source,output:final,payload:path.join(final,'payload'),launch,setup:null,files:engine.manifestFiles(final),status:'completed'};
 save(path.join(final,'receipt.json'),receipt);retention.verifyRelease(p,c,receipt);
 retention.markVerifiedRun(p,c,root,receipt);
 save(path.join(p.outputRoot,'shire/latest.json'),{project:p.id,component:c.id,receipt:path.join(final,'receipt.json'),completedAt:receipt.completedAt});save(path.join(root,'completed.json'),{receipt:path.join(final,'receipt.json')});
 console.log(JSON.stringify(retention.cleanup(p,c)));
 console.log('Verified Shire Console output: '+final);
}finally{fs.closeSync(lock);fs.unlinkSync(path.join(root,'.repair-build.lock'));}
