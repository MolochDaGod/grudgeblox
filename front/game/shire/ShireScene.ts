import { AtlasLandscape } from './AtlasLandscape'
import { WorldCombatView } from './WorldCombatView'
import { combatActor, living, combatBlocks } from '@shared/shire/combat'
import { isAtlas, settlements, fallFloor, regionAt, nearestDestination, townPlots, TerrainContext, waterAt } from '@shared/shire/atlas'
import * as T from 'three'
import { World, Tool, FurnitureKind, WorldAction, Point, SPECIES, SETTLEMENTS, FURNITURE, PLAYER_HEIGHT, FALL_RECOVERY_Y } from '@shared/shire/model'
import { clear, height, rayTerrain, meshChunk, WATER_LEVEL } from '@shared/shire/terrain'
import { LoadManager } from '../LoadManager'
import { animalVisual, box, cropVisual, disposeObject, furnitureVisual, home, mat, palette, post, sign } from './visuals'
import { DEFAULT_TOOLS, ToolSettings, toolAction as plannedToolAction } from '@shared/shire/building'
import { BuildPreview } from './BuildPreview'
import { CinderlordEnemy } from './CinderlordEnemy'
import { CINDERLORD, cinderlordSite } from '@shared/shire/cinderlord'
export type { ToolSettings } from '@shared/shire/building'

export interface ViewState { x:number;y:number;z:number;fps:number;pending:number;target:string;targetId?:string;targetKind?:'animal'|'crop'|'furniture'|'enemy'|'resident';region:string;locked:boolean;preview?:string;enemy?:string }
type Chunk={mesh:T.Mesh;stamp:string}
type Work={key:string;cx:number;cz:number;seed:TerrainContext;edits:World['edits'];revision:number}

export class ShireScene {
  readonly scene=new T.Scene()
  readonly camera=new T.PerspectiveCamera(65,1,0.06,5500)
  readonly renderer:T.WebGLRenderer
  world:World
  settings:ToolSettings={...DEFAULT_TOOLS}
  player:World['player']
  private velocityY=0
  private keys=new Set<string>()
  private clock=new T.Clock()
  private disposed=false
  private drag=false
  private callbacks:{view:(state:ViewState)=>void;action:(a:WorldAction)=>void;message:(text:string)=>void}
  private chunks=new Map<string,Chunk>()
  private workers:Worker[]=[]
  private idle:Worker[]=[]
  private queue:Work[]=[]
  private inflight=new Set<string>()
  private generation=0
  private editStamp=''
  private chunkAt=''
  private needed=new Set<string>()
  private terrainMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.FrontSide})
  private farCenter={value:new T.Vector2()}
  private atlasOrigin={value:new T.Vector2()}
  private objects=new Map<string,T.Object3D>()
  private objectSignatures=new Map<string,string>()
  private interactables:T.Object3D[]=[]
  private raycaster=new T.Raycaster()
  private target:ViewState['targetKind']|undefined
  private targetId:string|undefined
  private groundHit:ReturnType<typeof rayTerrain>=null
  private preview=new BuildPreview()
  private previewLabel=''
  private residents=new Map<string,{root:T.Object3D;mixer:T.AnimationMixer;origin:Point;phase:number}>()
  private residentsLoading=new Set<string>()
  private animalMixers=new Map<string,T.AnimationMixer>()
  private animalModels=new Set<string>()
  private animalLoading=new Set<string>()
  private availableAssets=new Map<string,string>()
  private combat:WorldCombatView
  private cinderlord?:CinderlordEnemy
  private atlas?:AtlasLandscape
  overview=false
  landmarkView=false
  private sun!:T.DirectionalLight
  private resizeObserver:ResizeObserver
  private viewTimer=0
  private frameTimes:number[]=[]
  private skyTime=0
  private loopHandle=0

  constructor(private container:HTMLElement,w:World,callbacks:ShireScene['callbacks']){
    this.world=w;this.player={...w.player};this.callbacks=callbacks
    if(isAtlas(w)){this.terrainMaterial.customProgramCacheKey=()=>'atlas-near';this.terrainMaterial.onBeforeCompile=shader=>{shader.uniforms.atlasPlayer=this.farCenter;shader.uniforms.atlasOrigin=this.atlasOrigin;shader.vertexShader='varying vec2 atlasNearXZ;uniform vec2 atlasOrigin;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\natlasNearXZ=(modelMatrix*vec4(position,1.0)).xz+atlasOrigin;');shader.fragmentShader='varying vec2 atlasNearXZ;uniform vec2 atlasPlayer;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(distance(atlasNearXZ,atlasPlayer)>118.0) discard;')}}
    this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=isAtlas(w)?0.87:1.05;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap
    this.scene.background=new T.Color(0xbaccc3);this.scene.fog=new T.FogExp2(0xbaccc3,0.0007)
    this.scene.add(new T.HemisphereLight(0xe3e8da,0x6b6c48,isAtlas(w)?1.7:2.6));const sun=new T.DirectionalLight(0xffedcf,isAtlas(w)?2.2:2.8);this.sun=sun;sun.position.set(-60,110,50);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-95;sun.shadow.camera.right=95;sun.shadow.camera.top=95;sun.shadow.camera.bottom=-95;sun.shadow.bias=-0.001;this.scene.add(sun,sun.target)
    const carried=new T.PointLight(0xffd9a4,1.1,12,1.5);this.camera.add(carried);this.scene.add(this.camera)
    this.preview.visible=false;this.scene.add(this.preview);this.container.appendChild(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','The Middle-earth game view');this.renderer.domElement.tabIndex=0
    this.resizeObserver=new ResizeObserver(this.resize);this.resizeObserver.observe(container);this.resize()
    for(let i=0;i<2;i++){const worker=new Worker(new URL('./terrain.worker.ts',import.meta.url));worker.onmessage=event=>this.receiveChunk(worker,event.data);worker.onerror=()=>this.callbacks.message('A terrain worker failed. Save and reopen the world to recover.');this.workers.push(worker);this.idle.push(worker)}
    this.combat=new WorldCombatView(this.scene,text=>this.callbacks.message(text))
    if(isAtlas(w)){this.atlas=new AtlasLandscape(this.scene,w);this.atlas.update(this.player)}else{this.makeLandscape();this.makeSettlements()}this.setWorld(w,true)
    window.addEventListener('keydown',this.keyDown);window.addEventListener('keyup',this.keyUp);window.addEventListener('blur',this.releaseInput);document.addEventListener('pointerlockchange',this.lockChange);document.addEventListener('mousemove',this.mouseMove);document.addEventListener('mouseup',this.mouseUp);this.renderer.domElement.addEventListener('mousedown',this.mouseDown);this.renderer.domElement.addEventListener('contextmenu',this.contextMenu)
    void fetch('/api/shire/assets').then(r=>r.json()).then(data=>{if(this.disposed)return;for(const a of data.assets||[])this.availableAssets.set(a.id,a.url);this.loadAnimalModels()}).catch(()=>{})
    this.loop()
  }
  private resize=()=>{const width=this.container.clientWidth,height=this.container.clientHeight;this.renderer.setSize(width,height);this.camera.aspect=width/Math.max(1,height);this.camera.updateProjectionMatrix()}
  private contextMenu=(e:Event)=>e.preventDefault()
  private keyDown=(e:KeyboardEvent)=>{if((e.target as HTMLElement)?.closest('input,textarea,select'))return;if(['KeyW','KeyA','KeyS','KeyD','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();this.keys.add(e.code);if(e.repeat)return;if(e.code==='KeyE')this.interact();if(e.code==='KeyF')this.settings.tool==='explore'?this.strike():this.applyTool();if(e.code==='KeyQ')this.callbacks.action({type:'guard'});if(e.code==='KeyH')this.callbacks.action({type:'heal'});if(e.code==='Escape')this.releaseInput()}
  private keyUp=(e:KeyboardEvent)=>this.keys.delete(e.code)
  private mouseDown=(e:MouseEvent)=>{if(e.button===2){this.drag=true;this.renderer.domElement.focus();return}if(e.button===0&&document.pointerLockElement===this.renderer.domElement)this.settings.tool==='explore'?this.strike():this.applyTool()}
  private mouseUp=()=>{this.drag=false}
  private mouseMove=(e:MouseEvent)=>{if(this.drag||document.pointerLockElement===this.renderer.domElement){this.player.yaw-=e.movementX*0.0022;this.player.pitch=Math.max(-1.4,Math.min(1.4,this.player.pitch-e.movementY*0.0022))}}
  private lockChange=()=>{if(document.pointerLockElement!==this.renderer.domElement)this.keys.clear()}
  capture=()=>{this.renderer.domElement.focus();void this.renderer.domElement.requestPointerLock()?.catch(()=>this.callbacks.message('Use right-drag to look and WASD to walk.'))}
  releaseInput=()=>{this.keys.clear();this.drag=false;if(document.pointerLockElement===this.renderer.domElement)document.exitPointerLock()}
  setSettings(settings:ToolSettings){this.settings=settings;if(settings.tool!=='explore')this.releaseInput()}
  getPlayer(){return {...this.player}}
  getCombatDiagnostics(){return this.combat.diagnostics}
  private qaUntil=0
  qaWalk(seconds:number,backward=false){if(!new URLSearchParams(location.search).has('combatQA'))return;this.releaseInput();this.keys.add(backward?'KeyS':'KeyW');this.qaUntil=this.skyTime+Math.min(8,Math.max(0,seconds))}
  qaFace(kind='hostile'){if(!new URLSearchParams(location.search).has('combatQA'))return;const nearest=this.world.combat?.actors.filter(a=>a.kind===kind).sort((a,b)=>Math.hypot(a.position.x-this.player.x,a.position.z-this.player.z)-Math.hypot(b.position.x-this.player.x,b.position.z-this.player.z))[0];if(nearest){const dx=this.player.x-nearest.position.x,dz=this.player.z-nearest.position.z;this.player.yaw=Math.atan2(dx,dz);this.player.pitch=Math.atan2(nearest.position.y+(kind==='animal'?.35:.9)-this.player.y-PLAYER_HEIGHT+.08,Math.hypot(dx,dz))}}
  qaDive(){if(!new URLSearchParams(location.search).has('combatQA'))return;this.releaseInput();this.keys.add('ControlLeft');this.qaUntil=this.skyTime+6}
  retryCreatureModels(){this.combat.retry()}
  strike(){if(this.targetId&&['enemy','animal','resident'].includes(this.target||''))this.callbacks.action({type:'strike',id:this.targetId});else this.callbacks.message('Aim at a living creature within reach to strike.')}
  guard(){this.callbacks.action({type:'guard'})}
  claim(){const hit=this.groundHit;this.callbacks.action({type:'claim',position:hit?{x:hit.x,y:hit.y,z:hit.z}:{...this.player}})}
  private geometry(mesh:{positions:Float32Array;normals:Float32Array;colors:Float32Array}){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(mesh.positions,3));geometry.setAttribute('normal',new T.BufferAttribute(mesh.normals,3));geometry.setAttribute('color',new T.BufferAttribute(mesh.colors,3));geometry.computeBoundingSphere();return geometry}
  private receiveChunk(worker:Worker,data:Work&{positions:Float32Array;normals:Float32Array;colors:Float32Array;error?:string}){
    if(this.disposed)return;this.inflight.delete(`${data.key}:${data.revision}`);this.idle.push(worker)
    if(data.revision===this.generation&&this.needed.has(data.key)&&!data.error){const old=this.chunks.get(data.key);if(old){this.scene.remove(old.mesh);old.mesh.geometry.dispose()}const mesh=new T.Mesh(this.geometry(data),this.terrainMaterial);mesh.receiveShadow=true;mesh.castShadow=true;this.scene.add(mesh);this.chunks.set(data.key,{mesh,stamp:this.editStamp})}
    if(data.error)this.callbacks.message(data.error);this.pump()
  }
  private pump(){while(this.idle.length&&this.queue.length){const task=this.queue.shift()!;if(task.revision!==this.generation||!this.needed.has(task.key))continue;const worker=this.idle.pop()!;this.inflight.add(`${task.key}:${task.revision}`);worker.postMessage(task)}}
  private terrain(force=false){const cx=Math.floor(this.player.x/16),cz=Math.floor(this.player.z/16),at=`${cx}:${cz}`;if(at===this.chunkAt&&!force)return;this.chunkAt=at;this.farCenter.value.set(this.player.x,this.player.z);const needed=new Set<string>();const jobs:Work[]=[]
    for(let dx=-9;dx<=9;dx++)for(let dz=-9;dz<=9;dz++){if(Math.hypot(dx,dz)>9.6)continue;const x=cx+dx,z=cz+dz,key=`${x}:${z}`;needed.add(key);const old=this.chunks.get(key);if(old?.stamp===this.editStamp)continue
      const nearEdits=this.world.edits.filter(e=>Math.abs(e.center.x-(x*16+8))<Math.hypot(e.size.x,e.size.z)+10&&Math.abs(e.center.z-(z*16+8))<Math.hypot(e.size.x,e.size.z)+10)
      if(!nearEdits.length){const meshData=meshChunk(x,z,this.world,[],2);if(old){this.scene.remove(old.mesh);old.mesh.geometry.dispose()}const geometry=this.geometry(meshData);geometry.translate(-x*16,0,-z*16);const mesh=new T.Mesh(geometry,this.terrainMaterial);mesh.position.set(x*16,0,z*16);mesh.receiveShadow=true;this.scene.add(mesh);this.chunks.set(key,{mesh,stamp:this.editStamp})}
      else if(!this.inflight.has(`${key}:${this.generation}`)&&!this.queue.some(j=>j.key===key&&j.revision===this.generation))jobs.push({key,cx:x,cz:z,seed:{seed:this.world.seed,generator:this.world.generator},edits:this.world.edits,revision:this.generation})
    }
    this.needed=needed;this.queue=this.queue.filter(j=>needed.has(j.key)&&j.revision===this.generation);jobs.sort((a,b)=>Math.hypot(a.cx-cx,a.cz-cz)-Math.hypot(b.cx-cx,b.cz-cz));this.queue.push(...jobs)
    for(const [key,chunk] of this.chunks)if(!needed.has(key)){this.scene.remove(chunk.mesh);chunk.mesh.geometry.dispose();this.chunks.delete(key)}this.pump()
  }
  setWorld(w:World,move=false){this.world=w;if(combatActor(w,'player')?.vitality.hp===0){this.releaseInput();this.velocityY=0;this.player={...w.player}}if(move){this.player={...w.player};this.velocityY=0;this.chunkAt='';this.terrain(true);this.atlas?.update(this.player)}const stamp=w.edits.map(e=>e.id).join(':');if(stamp!==this.editStamp||this.chunks.size===0){this.editStamp=stamp;this.generation++;this.terrain(true)}
    const keep=new Set<string>()
    for(const f of w.furniture){keep.add(f.id);const signature=JSON.stringify(f);if(this.objectSignatures.get(f.id)!==signature){this.removeObject(f.id);const obj=furnitureVisual(f);obj.position.set(f.position.x,f.position.y,f.position.z);obj.rotation.y=f.yaw;obj.userData={kind:'furniture',id:f.id,label:FURNITURE[f.kind].label+(f.kind==='feeder'?` · ${f.stock||0}/12 feed`:f.kind==='perch'||f.kind==='burrow'?f.open?' · open':' · closed':'')};this.addObject(f.id,obj,signature)}}
    for(const crop of w.crops){if(crop.harvested)continue;keep.add(crop.id);const progress=crop.watered?Math.min(1,(w.time-crop.planted)/60):0,stage=Math.floor(progress*5),signature=`${stage}:${crop.watered}`;if(this.objectSignatures.get(crop.id)!==signature){this.removeObject(crop.id);const obj=cropVisual(crop.kind,stage/5,crop.watered);obj.position.set(crop.position.x,crop.position.y,crop.position.z);obj.userData={kind:'crop',id:crop.id,label:`${crop.kind} · ${!crop.watered?'needs water':progress>=1?'ready to harvest':'growing'}`};this.addObject(crop.id,obj,signature)}}
    for(const animal of w.animals){keep.add(animal.id);let obj=this.objects.get(animal.id);if(!obj){obj=animalVisual(animal);obj.position.set(animal.position.x,animal.position.y,animal.position.z);obj.userData={...obj.userData,kind:'animal',id:animal.id,label:animal.name};this.addObject(animal.id,obj,animal.species)}obj.userData.label=`${animal.name}${animal.age<SPECIES[animal.species].maturity?' · young':''}${animal.pregnant?' · expecting young':''} · ${animal.activity||animal.mood}`;obj.scale.setScalar((this.animalModels.has(animal.id)?1:SPECIES[animal.species].scale)*(animal.age<SPECIES[animal.species].maturity?0.55:1))}
    for(const key of this.objects.keys())if(!keep.has(key))this.removeObject(key);this.refreshInteractables();this.loadAnimalModels()
  }
  private refreshInteractables(){this.interactables=[...this.objects.values(),...this.combat.roots,...[...this.residents.values()].map(r=>r.root)]}
  private addObject(id:string,obj:T.Object3D,signature:string){this.objects.set(id,obj);this.objectSignatures.set(id,signature);this.scene.add(obj)}
  private removeObject(id:string){const obj=this.objects.get(id);if(obj){this.scene.remove(obj);if(this.animalModels.has(id)){LoadManager.releaseClone(obj);this.animalModels.delete(id);this.animalMixers.delete(id)}else disposeObject(obj);this.objects.delete(id);this.objectSignatures.delete(id)}}
  private makeLandscape(){
    const far=new T.PlaneGeometry(4200,4200,210,210);far.rotateX(-Math.PI/2);const p=far.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,height(p.getX(i),p.getZ(i),this.world));far.computeVertexNormals();const fm=new T.MeshStandardMaterial({color:0x657c3b,roughness:1});fm.onBeforeCompile=shader=>{shader.uniforms.shireCenter=this.farCenter;shader.vertexShader='varying vec2 shireXZ;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nshireXZ = position.xz;');shader.fragmentShader='varying vec2 shireXZ; uniform vec2 shireCenter;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(distance(shireXZ,shireCenter)<118.0) discard;')};const ground=new T.Mesh(far,fm);ground.receiveShadow=true;this.scene.add(ground)
    const pond=new T.Mesh(new T.CircleGeometry(1,64),new T.MeshStandardMaterial({color:0x769c9b,roughness:0.2,metalness:0.2,transparent:true,opacity:0.83}));pond.rotation.x=-Math.PI/2;pond.scale.set(14,28,1);pond.position.set(25,WATER_LEVEL,114);this.scene.add(pond)
    let seed=this.world.seed;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296};const matrix=new T.Matrix4(),q=new T.Quaternion(),scale=new T.Vector3(),position=new T.Vector3()
    const encounter=cinderlordSite(this.world)
    const trees=1100,trunks=new T.InstancedMesh(new T.CylinderGeometry(0.3,0.48,5,5),mat(0x675541),trees),crowns=new T.InstancedMesh(new T.SphereGeometry(1,7,5),mat(0x46683b),trees)
    let used=0;for(let i=0;i<trees;i++){const forest=i<650,x=forest?1050+rand()*900:(rand()-0.5)*3000,z=forest?1050+rand()*900:(rand()-0.5)*3000;if(Math.hypot(x-encounter.x,z-encounter.z)<34||SETTLEMENTS.some(s=>Math.hypot(s.x-x,s.z-z)<48)||height(x,z,this.world)<WATER_LEVEL||Math.hypot(x+30,z)<38)continue;const h=0.6+rand()*0.9;position.set(x,height(x,z,this.world)+h*2.5,z);scale.set(h,h,h);matrix.compose(position,q,scale);trunks.setMatrixAt(used,matrix);position.y+=h*2.7;scale.set(h*3.5,h*3.7,h*3.3);matrix.compose(position,q,scale);crowns.setMatrixAt(used,matrix);used++}trunks.count=used;crowns.count=used;trunks.castShadow=true;crowns.castShadow=true;this.scene.add(trunks,crowns)
    const flowers=new T.InstancedMesh(new T.ConeGeometry(0.12,0.4,3),mat(0xd6c394),1800);for(let i=0;i<1800;i++){const x=(rand()-0.5)*350,z=(rand()-0.5)*350;position.set(x,height(x,z,this.world)+0.16,z);scale.setScalar(0.6+rand()*0.6);matrix.compose(position,q,scale);flowers.setMatrixAt(i,matrix)}this.scene.add(flowers)
    for(const destination of SETTLEMENTS.slice(1)){const start=SETTLEMENTS[0],length=Math.hypot(destination.x-start.x,destination.z-start.z),segments=Math.ceil(length/6),verts:number[]=[];for(let i=0;i<segments;i++){const t=i/segments,u=(i+1)/segments,dx=(destination.x-start.x)/length,dz=(destination.z-start.z)/length;for(const [a,side] of [[t,-1],[u,-1],[u,1],[t,-1],[u,1],[t,1]]){const x=start.x+(destination.x-start.x)*a+dz*side*1.4,z=start.z+(destination.z-start.z)*a-dx*side*1.4;verts.push(x,height(x,z,this.world)+0.05,z)}}const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(verts,3));geometry.computeVertexNormals();const path=new T.Mesh(geometry,new T.MeshStandardMaterial({color:0xb6a582,roughness:1,side:T.DoubleSide}));this.scene.add(path)}
  }
  private makeSettlements(){for(const [j,s]of settlements(this.world).entries()){for(let i=0;i<s.homes;i++){const angle=i/s.homes*Math.PI*2,r=13+(i%3)*6,x=s.x+Math.sin(angle)*r,z=s.z+Math.cos(angle)*r;const house=home([0x65754a,0x637a87,0x995f48,0x8b784a][i%4]);house.position.set(x,height(x,z,this.world),z);house.rotation.y=angle+Math.PI;this.scene.add(house)}const board=sign(s.elves?'FANGORN\nElven clearing':`${s.name.toUpperCase()}\nTHE SHIRE`,5);board.position.set(s.x-28,height(s.x-28,s.z,this.world)+2.6,s.z);board.rotation.y=Math.PI/2;this.scene.add(board);post(this.scene,s.x-28,board.position.y-1.3,s.z,0.12,2.6,palette.wood)}
    const board=sign('A HILL TO CALL HOME\nChoose a hill beyond the village',5);board.position.set(-48,height(-48,20,this.world)+2.3,20);board.rotation.y=-Math.PI/3;this.scene.add(board)
    const farm=sign('MILLBROOK FARM\nWater · feed · raise young',4);farm.position.set(3,height(3,43,this.world)+2,43);this.scene.add(farm)
  }
  private loadResidents(){for(const [key,r]of this.residents){if(Math.hypot(r.origin.x-this.player.x,r.origin.z-this.player.z)>700){r.mixer.stopAllAction();LoadManager.releaseClone(r.root.children[0]);this.scene.remove(r.root);this.residents.delete(key)}}for(const [j,s]of settlements(this.world).entries()){if(Math.hypot(s.x-this.player.x,s.z-this.player.z)>220)continue;for(let i=0;i<Math.min(6,s.homes);i++){const key=`${j}:${i}`;if(this.residents.has(key)||this.residentsLoading.has(key))continue;this.residentsLoading.add(key);const asset=s.elves?'resident-elf':'resident-human',url=this.availableAssets.get(asset);if(!url){this.residentsLoading.delete(key);continue}void LoadManager.glTFLoad(url).then(root=>{if(this.disposed||Math.hypot(s.x-this.player.x,s.z-this.player.z)>700){LoadManager.releaseClone(root);return}const bounds=new T.Box3().setFromObject(root),height0=bounds.max.y-bounds.min.y,target=s.elves?1.75:isAtlas(this.world)&&['Bree','Combe','Archet'].includes(s.name)?1.7:1.1;root.scale.setScalar(target/(height0||1));const actor=new T.Group();root.position.y=-bounds.min.y*root.scale.y;actor.add(root);const origin={x:s.x+Math.sin(i)*8+12,y:0,z:s.z+Math.cos(i)*8+(s.name==='Hobbiton'?-40:4)};origin.y=height(origin.x,origin.z,this.world);actor.position.set(origin.x,origin.y,origin.z);this.scene.add(actor);const mixer=new T.AnimationMixer(root),clip=root.animations.find(c=>/walk/i.test(c.name))||root.animations[0];if(clip)mixer.clipAction(clip).play();actor.userData={id:`resident:${key}`,kind:'resident',label:`${s.name} resident ${i+1}`};this.residents.set(key,{root:actor,mixer,origin,phase:i})}).catch(()=>this.callbacks.message('A resident model could not load. Check the local asset package.')).finally(()=>this.residentsLoading.delete(key))}}}
  private loadAnimalModels(){for(const a of this.world.animals){const url=this.availableAssets.get(`animal-${a.species}`);if(!url||this.animalModels.has(a.id)||this.animalLoading.has(a.id))continue;this.animalLoading.add(a.id);void LoadManager.glTFLoad(url).then(root=>{if(this.disposed){LoadManager.releaseClone(root);return}const existing=this.objects.get(a.id);if(!existing){LoadManager.releaseClone(root);return}const bounds=new T.Box3().setFromObject(root),size=bounds.getSize(new T.Vector3()),scale=0.65/Math.max(size.x,size.y,size.z,0.001);root.scale.setScalar(scale);root.position.set(-(bounds.min.x+bounds.max.x)*scale/2,-bounds.min.y*scale,-(bounds.min.z+bounds.max.z)*scale/2);const mount=new T.Group();mount.add(root);mount.scale.setScalar(a.age<SPECIES[a.species].maturity?0.55:1);mount.position.copy(existing.position);mount.userData={kind:'animal',id:a.id,label:a.name,developmentVisual:false};this.removeObject(a.id);this.addObject(a.id,mount,a.species);this.animalModels.add(a.id);const mixer=new T.AnimationMixer(root);if(root.animations[0])mixer.clipAction(root.animations[0]).play();this.animalMixers.set(a.id,mixer);this.refreshInteractables()}).catch(()=>this.callbacks.message(`The accepted ${a.species} model could not load. Its development representation remains labelled.`)).finally(()=>this.animalLoading.delete(a.id))}}
  private updateTarget(){this.refreshInteractables();this.camera.updateMatrixWorld();const direction=new T.Vector3();this.camera.getWorldDirection(direction);this.groundHit=rayTerrain(this.camera.position,direction,this.world,10);this.raycaster.setFromCamera(new T.Vector2(0,0),this.camera);this.raycaster.far=9;for(const root of this.interactables){if(Math.hypot(root.position.x-this.player.x,root.position.z-this.player.z)>20)continue;root.traverse(o=>{if(o instanceof T.SkinnedMesh){o.computeBoundingSphere();if(o.boundingBox)o.computeBoundingBox()}})}const hit=this.raycaster.intersectObjects(this.interactables,true)[0];this.target=undefined;this.targetId=undefined;let label=this.groundHit?'Earth':'';if(hit&&(!this.groundHit||hit.distance<this.groundHit.distance+0.1)){let obj:T.Object3D|null=hit.object;while(obj&&!obj.userData.id)obj=obj.parent;if(obj){this.target=obj.userData.kind;this.targetId=obj.userData.id;label=obj.userData.label}}
    this.previewLabel=this.preview.update(this.settings.tool==='explore'?null:this.toolAction(),this.world)
    return label
  }
  private toolAction():WorldAction|null{const direction=new T.Vector3();this.camera.getWorldDirection(direction);return plannedToolAction(this.settings,this.groundHit,this.player,direction)}
  applyTool(){if(this.settings.tool==='explore'){this.interact();return}const action=this.toolAction();if(action)this.callbacks.action(action);else this.callbacks.message('Look at nearby earth or a floor, then apply the tool.')}
  interact(){if(this.target==='enemy'){this.strike();return}if(this.target==='resident'){const a=combatActor(this.world,this.targetId||'');this.callbacks.message(a?`${a.name} · ${Math.ceil(a.vitality.hp)}/${a.vitality.maxHp} health.`:'A local resident.');return}if(this.target==='furniture'&&this.targetId)this.callbacks.action({type:'use-furniture',id:this.targetId});else if(this.target==='crop'&&this.targetId){const c=this.world.crops.find(c=>c.id===this.targetId)!;this.callbacks.action({type:!c.watered?'water':'harvest',id:c.id})}else if(this.target==='animal'&&this.targetId)this.callbacks.action({type:'feed',id:this.targetId});else this.callbacks.message('Look at an animal, crop or furnishing and press E.')}
  private move(dt:number){if(this.overview||combatActor(this.world,'player')?.vitality.hp===0)return;if(this.queue.length||[...this.inflight].some(k=>k.endsWith(`:${this.generation}`)))return
    if(this.keys.has('ArrowLeft'))this.player.yaw+=dt*1.5;if(this.keys.has('ArrowRight'))this.player.yaw-=dt*1.5;if(this.keys.has('PageUp'))this.player.pitch=Math.min(1.4,this.player.pitch+dt);if(this.keys.has('PageDown'))this.player.pitch=Math.max(-1.4,this.player.pitch-dt)
    const water=waterAt(this.player.x,this.player.z,this.world),swimming=this.player.y<water-.65
    const forward=Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'))-Number(this.keys.has('KeyS')||this.keys.has('ArrowDown')),side=Number(this.keys.has('KeyD'))-Number(this.keys.has('KeyA')),speed=swimming?2.6:this.keys.has('ShiftLeft')?7:3.6,norm=Math.hypot(forward,side)||1
    const dx=(-Math.sin(this.player.yaw)*forward+Math.cos(this.player.yaw)*side)/norm*speed*dt,dz=(-Math.cos(this.player.yaw)*forward-Math.sin(this.player.yaw)*side)/norm*speed*dt,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/0.12))
    for(let i=0;i<steps;i++){for(const axis of ['x','z'] as const){const amount=(axis==='x'?dx:dz)/steps;if(!amount)continue;const p={...this.player,[axis]:this.player[axis]+amount};if(combatBlocks(this.world,p,this.player))continue;if(clear(p,this.world))this.player[axis]=p[axis];else if(this.velocityY<=0&&clear({...p,y:p.y+0.35},this.world)){this.player[axis]=p[axis];this.player.y+=0.35}}}
    const grounded=!clear({...this.player,y:this.player.y-0.13},this.world)
    if(swimming)this.velocityY=this.keys.has('ControlLeft')?-2.4:this.keys.has('Space')?3:Math.max(-2,Math.min(2,(water-1.15-this.player.y)*4))
    else{if(grounded&&this.keys.has('Space')){this.velocityY=5.2;this.keys.delete('Space')}this.velocityY=Math.max(-12,this.velocityY-15*dt)}
    const vertical=this.velocityY*dt,vsteps=Math.max(1,Math.ceil(Math.abs(vertical)/0.035));for(let i=0;i<vsteps;i++){const next={...this.player,y:this.player.y+vertical/vsteps};if(clear(next,this.world))this.player.y=next.y;else{this.velocityY=0;break}}
    if(this.player.y<fallFloor(this.world)){this.player={...this.world.player};this.velocityY=0;this.callbacks.message('Returned to your last safe saved position.')}
  }
  private loop=()=>{if(this.disposed)return;const rawDt=this.clock.getDelta(),dt=Math.min(0.05,rawDt);this.skyTime+=dt;if(this.qaUntil&&this.skyTime>=this.qaUntil){this.qaUntil=0;this.keys.clear()}this.move(dt);this.combat.update(dt,this.world,this.player,this.availableAssets);this.camera.position.set(this.player.x,this.player.y+PLAYER_HEIGHT-0.08,this.player.z);this.camera.rotation.order='YXZ';this.camera.rotation.set(this.player.pitch,this.player.yaw,0);if(isAtlas(this.world)){this.atlas?.update(this.player);if(this.overview){const town=nearestDestination(this.player.x,this.player.z);this.camera.position.set(town.x+90,height(town.x,town.z,this.world)+65,town.z+100);this.camera.rotation.set(-Math.atan2(61,Math.hypot(90,125)),Math.atan2(90,125),0);if(this.landmarkView){const p=townPlots(town).find(p=>p.label)||townPlots(town)[0];if(p){const c=Math.cos(p.yaw),sn=Math.sin(p.yaw),dx=13*c+29*sn,dz=-13*sn+29*c,zoom=Math.max(1,p.scale);this.camera.position.set(p.x+dx*zoom,height(p.x,p.z,this.world)+10*zoom,p.z+dz*zoom);this.camera.rotation.set(-Math.atan2(7,Math.hypot(dx,dz)),Math.atan2(dx,dz),0)}}}this.sun.position.set(this.player.x-60,this.player.y+110,this.player.z+50);this.sun.target.position.set(this.player.x,this.player.y,this.player.z);this.sun.target.updateMatrixWorld();this.scene.position.set(-Math.round(this.player.x/256)*256,0,-Math.round(this.player.z/256)*256);this.atlasOrigin.value.set(-this.scene.position.x,-this.scene.position.z);this.farCenter.value.set(this.player.x,this.player.z)}this.terrain();
    for(const a of this.world.animals){const obj=this.objects.get(a.id);if(!obj)continue;const health=combatActor(this.world,a.id);if(health?.vitality.hp===0){obj.rotation.z=T.MathUtils.damp(obj.rotation.z,Math.PI*.45,5,dt);const m=this.animalMixers.get(a.id);if(m)m.timeScale=0;obj.userData.label=`${a.name} · defeated`;continue}obj.rotation.z=0;const base=(obj.userData.groundPosition||=obj.position.clone()) as T.Vector3;const dx=a.position.x-base.x,dz=a.position.z-base.z;const moving=Math.hypot(dx,dz)>0.02||(a.species==='bird'&&Math.abs(a.position.y-base.y)>0.02);base.lerp(new T.Vector3(a.position.x,a.position.y,a.position.z),1-Math.exp(-dt*3));obj.position.copy(base);if(Math.hypot(dx,dz)>0.01)obj.rotation.y=Math.atan2(dx,dz);const phase=this.skyTime*(a.activity==='fleeing'?11:6)+a.tint*8;
      if(!this.animalModels.has(a.id)){
        if((a.species==='rabbit'||a.species==='frog')&&moving)obj.position.y+=Math.max(0,Math.sin(phase))*(a.species==='frog'?0.12:0.1)
        obj.rotation.x=['pecking','rooting','grazing'].includes(a.activity||'')?Math.max(0,Math.sin(phase*0.5))*0.1:0
        const limbs=obj.userData.legs as T.Object3D[]|undefined;limbs?.forEach((limb,i)=>{const flying=a.species==='bird'&&a.activity!=='perching',swimming=a.species==='fish';limb.rotation.x=(moving||flying||swimming?1:0)*Math.sin(this.skyTime*(flying?12:swimming?7:6)+i*Math.PI)*(flying?0.8:0.25)})
      }
      const mixer=this.animalMixers.get(a.id);if(mixer){mixer.timeScale=moving?1:0.15;mixer.update(dt)}}
    for(const resident of this.residents.values()){const a=combatActor(this.world,resident.root.userData.id);if(!a)continue;resident.root.position.lerp(new T.Vector3(a.position.x,a.position.y,a.position.z),1-Math.exp(-dt*10));resident.root.rotation.y=a.yaw;resident.root.userData.label=`${a.name} · ${Math.ceil(a.vitality.hp)}/${a.vitality.maxHp}`;if(!living(a)){resident.mixer.timeScale=0;resident.root.rotation.z=T.MathUtils.damp(resident.root.rotation.z,Math.PI*.45,5,dt)}else{resident.root.rotation.z=0;const source=resident.root.children[0],name=a.phase==='windup'||a.phase==='recover'?'attack':'walk',clip=source.animations.find(c=>c.name.toLowerCase()===name)||source.animations[0];if(clip&&resident.root.userData.clip!==clip.name){resident.mixer.stopAllAction();resident.mixer.clipAction(clip).reset().play();resident.root.userData.clip=clip.name}resident.mixer.timeScale=1;resident.mixer.update(dt)}}
    this.renderer.render(this.scene,this.camera);this.frameTimes.push(rawDt);if(this.frameTimes.length>120)this.frameTimes.shift();this.viewTimer+=dt;if(this.viewTimer>0.15){this.viewTimer=0;if(new URLSearchParams(location.search).has('combatQA'))this.renderer.domElement.dataset.combatQa=JSON.stringify({worldId:this.world.id,time:this.world.time,player:{...this.player,vitality:combatActor(this.world,'player')?.vitality},actors:this.world.combat?.actors.filter(a=>Math.hypot(a.position.x-this.player.x,a.position.z-this.player.z)<200),view:this.combat.diagnostics,drawCalls:this.renderer.info.render.calls});const label=this.updateTarget();this.callbacks.view({x:this.player.x,y:this.player.y,z:this.player.z,fps:Math.round(this.frameTimes.length/this.frameTimes.reduce((a,b)=>a+b,0)),pending:this.queue.length+this.inflight.size,target:label,targetId:this.targetId,targetKind:this.target,region:isAtlas(this.world)?regionAt(this.player.x,this.player.z):this.cinderlord&&Math.hypot(this.player.x-this.cinderlord.site.x,this.player.z-this.cinderlord.site.z)<90?'Ashen Hollow':this.player.x>1050&&this.player.z>1050?'Fangorn Forest':'The Shire',enemy:this.cinderlord&&Math.hypot(this.player.x-this.cinderlord.site.x,this.player.z-this.cinderlord.site.z)<60?this.cinderlord.status:undefined,locked:document.pointerLockElement===this.renderer.domElement,preview:this.previewLabel});this.loadResidents();this.cinderlord?.load(this.availableAssets.get(CINDERLORD.assetId),this.player)}
    this.loopHandle=requestAnimationFrame(this.loop)
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.releaseInput();this.combat.dispose();this.cinderlord?.dispose();this.atlas?.dispose();cancelAnimationFrame(this.loopHandle);this.resizeObserver.disconnect();for(const worker of this.workers)worker.terminate();window.removeEventListener('keydown',this.keyDown);window.removeEventListener('keyup',this.keyUp);window.removeEventListener('blur',this.releaseInput);document.removeEventListener('pointerlockchange',this.lockChange);document.removeEventListener('mousemove',this.mouseMove);document.removeEventListener('mouseup',this.mouseUp);this.renderer.domElement.removeEventListener('mousedown',this.mouseDown);this.renderer.domElement.removeEventListener('contextmenu',this.contextMenu);for(const key of [...this.objects.keys()])this.removeObject(key);for(const r of this.residents.values()){r.mixer.stopAllAction();LoadManager.releaseClone(r.root);this.scene.remove(r.root)}disposeObject(this.scene);this.terrainMaterial.dispose();this.renderer.dispose();this.renderer.domElement.remove()}
}
