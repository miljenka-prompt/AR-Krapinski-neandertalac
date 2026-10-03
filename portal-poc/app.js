import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js';
const $=id=>document.getElementById(id);
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,stencil:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.setClearColor(0x101d29,1);renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local');document.body.prepend(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.05,60);
camera.position.set(0,1.55,3.4);camera.lookAt(0,1,-2);
scene.add(new THREE.HemisphereLight(0xe4f5ff,0x67523c,2.2));const sun=new THREE.DirectionalLight(0xffe6bc,2);sun.position.set(-3,7,4);scene.add(sun);
const portal=new THREE.Group();portal.visible=false;scene.add(portal);
const WIDTH=1.35,HEIGHT=2.05;
const maskMaterial=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,depthTest:true,side:THREE.DoubleSide,stencilWrite:true,stencilRef:1,stencilFunc:THREE.AlwaysStencilFunc,stencilZPass:THREE.ReplaceStencilOp});
const mask=new THREE.Mesh(new THREE.PlaneGeometry(WIDTH,HEIGHT),maskMaterial);mask.position.y=HEIGHT/2;mask.renderOrder=1;portal.add(mask);
function interiorMaterial(color){return new THREE.MeshStandardMaterial({color,roughness:1,stencilWrite:true,stencilRef:1,stencilFunc:THREE.EqualStencilFunc,stencilFail:THREE.KeepStencilOp,stencilZFail:THREE.KeepStencilOp,stencilZPass:THREE.KeepStencilOp});}
const colors={ground:interiorMaterial(0x677352),rock:interiorMaterial(0x858a86),trunk:interiorMaterial(0x564939),pine:interiorMaterial(0x304f43),pineLight:interiorMaterial(0x496655),snow:interiorMaterial(0xc6d0cc),water:interiorMaterial(0x7aafbd)};
function mesh(geometry,material,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.renderOrder=2;portal.add(m);return m;}
const ground=mesh(new THREE.PlaneGeometry(32,32),colors.ground,0,-.018,-16);ground.rotation.x=-Math.PI/2;
const sky=mesh(new THREE.PlaneGeometry(34,19),new THREE.MeshBasicMaterial({color:0x9cbbc9,stencilWrite:true,stencilRef:1,stencilFunc:THREE.EqualStencilFunc,stencilZPass:THREE.KeepStencilOp}),0,8,-30);
const sphere=new THREE.IcosahedronGeometry(1,1),cone=new THREE.ConeGeometry(1,1,7),trunk=new THREE.CylinderGeometry(.045,.075,1,6);
// Deterministic lightweight scenery: depth layers, no photographic panels.
let seed=71;function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
for(let i=0;i<28;i++){const x=(rnd()-.5)*18,z=-2-rnd()*22,h=1.4+rnd()*2.6;mesh(trunk,colors.trunk,x,h*.35,z,1,h*.7,1);mesh(cone,i%2?colors.pine:colors.pineLight,x,h*.7,z,h*.27,h*.8,h*.27);}
for(let i=0;i<9;i++){const x=(rnd()-.5)*15,z=-12-rnd()*12,h=3+rnd()*4;mesh(cone,colors.rock,x,h/2,z,3,h,3);mesh(cone,colors.snow,x,h*.86,z,.87,h*.29,.87);}
for(const [x,y,z,s] of [[-.48,.25,-.65,.3],[.75,.35,-1.5,.5],[-1.8,.4,-3,.65],[2,.35,-5,.6]])mesh(sphere,colors.rock,x,y,z,s,s*.8,s);
const stream=mesh(new THREE.PlaneGeometry(1.15,22),colors.water,1.3,.002,-12);stream.rotation.x=-Math.PI/2;stream.rotation.z=-.12;
const frameMat=new THREE.MeshStandardMaterial({color:0x8d9b9d,roughness:.8});
for(const x of [-WIDTH/2-.045,WIDTH/2+.045]){const p=new THREE.Mesh(new THREE.BoxGeometry(.09,HEIGHT+.09,.12),frameMat);p.position.set(x,HEIGHT/2,.025);p.renderOrder=3;portal.add(p);}
const top=new THREE.Mesh(new THREE.BoxGeometry(WIDTH+.18,.09,.12),frameMat);top.position.set(0,HEIGHT+.045,.025);top.renderOrder=3;portal.add(top);
const pad=new THREE.Mesh(new THREE.PlaneGeometry(1.9,1.15),new THREE.MeshStandardMaterial({color:0x67717a,roughness:1}));pad.rotation.x=-Math.PI/2;pad.position.set(0,-.025,.5);pad.renderOrder=3;portal.add(pad);
const sill=new THREE.Mesh(new THREE.BoxGeometry(WIDTH,.035,.16),frameMat);sill.position.set(0,.012,.03);sill.renderOrder=3;portal.add(sill);
const reticle=new THREE.Mesh(new THREE.RingGeometry(.12,.15,32).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xbceef3,side:THREE.DoubleSide}));reticle.matrixAutoUpdate=false;reticle.visible=false;scene.add(reticle);
let session=null,hitSource=null,lastHit=null,anchor=null,placed=false,pending=false,placementVersion=0,yaw=0,preview=false,frames=0,lastTime=0,fps=0;
const hitMatrix=new THREE.Matrix4(),tempPosition=new THREE.Vector3(),anchorPosition=new THREE.Vector3(),normal=new THREE.Vector3();
function setStatus(t){$('status').textContent=t;}
function clearPlacement(){placementVersion++;anchor?.delete();anchor=null;placed=false;pending=false;portal.visible=false;reticle.visible=false;lastHit=null;$('place').disabled=true;$('place').hidden=false;$('reset').hidden=true;setStatus('Polako pomakni kameru prema osvijetljenom podu.');}
function endUI(){hitSource?.cancel();hitSource=null;anchor?.delete();anchor=null;session=null;placed=false;pending=false;placementVersion++;lastHit=null;portal.visible=false;reticle.visible=false;preview=false;document.body.className='';$('intro').hidden=false;$('hud').hidden=true;$('start').disabled=false;renderer.setClearColor(0x101d29,1);}
async function startAR(){
 $('start').disabled=true;
 try{
  const active=await navigator.xr.requestSession('immersive-ar',{requiredFeatures:['hit-test'],optionalFeatures:['anchors','dom-overlay'],domOverlay:{root:$('overlay')}});
  session=active;active.addEventListener('end',endUI,{once:true});document.body.className='ar';$('intro').hidden=true;$('hud').hidden=false;renderer.setClearColor(0x000000,0);clearPlacement();
  await renderer.xr.setSession(active);
  const viewer=await active.requestReferenceSpace('viewer');hitSource=await active.requestHitTestSource({space:viewer});
  active.addEventListener('select',()=>{if(!active.domOverlayState)placePortal();});
  if(!active.domOverlayState)setStatus('Naciljaj pod; dodir zaslona postavlja portal.');
 }catch(err){if(session){await session.end().catch(()=>{});}else endUI();$('support').textContent='AR nije pokrenut: '+err.message;}
}
async function placePortal(){
 if(!lastHit||placed||pending||!session)return;
 pending=true;const version=placementVersion,active=session,hit=lastHit;tempPosition.setFromMatrixPosition(reticle.matrix);portal.position.copy(tempPosition);
 const viewerCamera=renderer.xr.getCamera();viewerCamera.getWorldPosition(anchorPosition);yaw=Math.atan2(anchorPosition.x-tempPosition.x,anchorPosition.z-tempPosition.z);portal.rotation.set(0,yaw,0);portal.visible=true;placed=true;reticle.visible=false;$('place').hidden=true;$('reset').hidden=false;setStatus('Portal postavljen. Pomakni telefon u stranu i približi ga otvoru.');
 try{if(typeof hit.createAnchor==='function'){const created=await hit.createAnchor();if(version!==placementVersion||session!==active){created.delete();return;}anchor=created;}}
 catch{anchor=null;}finally{if(version===placementVersion)pending=false;}
}
$('start').addEventListener('click',startAR);$('place').addEventListener('click',placePortal);$('reset').addEventListener('click',clearPlacement);$('exit').addEventListener('click',()=>session?session.end():endUI());
// DOM interaction must not also trigger WebXR select.
$('overlay').addEventListener('beforexrselect',e=>e.preventDefault());
$('preview').addEventListener('click',()=>{preview=true;portal.visible=true;portal.position.set(0,0,0);portal.rotation.set(0,0,0);document.body.className='preview';$('intro').hidden=true;$('hud').hidden=false;$('place').hidden=true;$('reset').hidden=true;setStatus('3D pregled · bez kamere i prostornog praćenja. Povuci prizor za promjenu pogleda.');});
let dragX=null,azimuth=0;renderer.domElement.addEventListener('pointerdown',e=>{if(preview){dragX=e.clientX;renderer.domElement.setPointerCapture(e.pointerId);}});renderer.domElement.addEventListener('pointermove',e=>{if(preview&&dragX!==null){azimuth=Math.max(-1.1,Math.min(1.1,azimuth+(e.clientX-dragX)*.008));dragX=e.clientX;}});renderer.domElement.addEventListener('pointerup',()=>dragX=null);renderer.domElement.addEventListener('pointercancel',()=>dragX=null);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
renderer.setAnimationLoop((time,frame)=>{
 if(preview){camera.position.set(Math.sin(azimuth)*3.4,1.55,Math.cos(azimuth)*3.4);camera.lookAt(0,1,-2);}
 if(frame&&session){
  const reference=renderer.xr.getReferenceSpace(),viewerPose=frame.getViewerPose(reference);
  if(!placed&&hitSource){lastHit=null;reticle.visible=false;for(const hit of frame.getHitTestResults(hitSource)){const pose=hit.getPose(reference);if(!pose)continue;hitMatrix.fromArray(pose.transform.matrix);normal.set(0,1,0).transformDirection(hitMatrix);if(normal.y<.9)continue;reticle.matrix.copy(hitMatrix);reticle.visible=true;lastHit=hit;break;}$('place').disabled=!lastHit;if(lastHit)setStatus('Pod pronađen. Provjeri da je prsten na podu pa postavi portal.');else setStatus('Tražim pod. Polako pomakni kameru; pomažu svjetlo i vidljiva tekstura poda.');}
  if(placed&&anchor){const p=frame.getPose(anchor.anchorSpace,reference);portal.visible=!!p&&!!viewerPose;if(p)portal.position.setFromMatrixPosition(hitMatrix.fromArray(p.transform.matrix));}else if(placed)portal.visible=!!viewerPose;
  if(placed&&!viewerPose)setStatus('Praćenje izgubljeno. Polako vrati kameru prema poznatom dijelu sobe.');
  else if(placed)setStatus('Pomakni se lijevo/desno; usporedi bliže stijene i udaljena stabla.');
  frames++;if(time-lastTime>1000){fps=Math.round(frames*1000/(time-lastTime));frames=0;lastTime=time;const v=viewerPose?.transform.position;$('metrics').textContent=`Praćenje: ${viewerPose?'aktivno':'izgubljeno'}\nSidro: ${anchor?'XRAnchor':placed?'local prostor (bez XRAnchor)':'još nije postavljeno'}\nBrzina: ${fps} fps\nPoložaj telefona: ${v?[v.x,v.y,v.z].map(n=>n.toFixed(2)).join(' / ')+' m':'—'}\nOtvor: ${WIDTH} × ${HEIGHT} m`;}
 }else if(preview){$('metrics').textContent='Ovo provjerava 3D geometriju i masku otvora. 6DoF i sidrenje testiraju se samo na AR uređaju.';}
 renderer.render(scene,camera);
});
(async()=>{try{if(!isSecureContext)throw Error('AR treba HTTPS adresu.');if(!navigator.xr||!await navigator.xr.isSessionSupported('immersive-ar'))throw Error('Ovaj preglednik ili uređaj ne podržava WebXR AR. Otvori u Chromeu; uređaj mora imati podršku za Google Play Services for AR.');$('start').disabled=false;$('start').textContent='Pokreni AR kameru';$('support').textContent='Nakon pokretanja naciljaj pod i postavi portal. Kamera se ne snima niti šalje na server.';}catch(e){$('start').textContent='AR nije dostupan';$('support').textContent=e.message;}})();
