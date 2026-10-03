import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js';
window.THREE=THREE;
const $=id=>document.getElementById(id);
let scene,camera,portal,ready=false,starting=false,placed=false,lastMetrics=0;
const WIDTH=1.35,HEIGHT=2.05;
const inversePortal=new THREE.Matrix4();
const clipUniforms={portalInverse:{value:inversePortal},portalCamera:{value:new THREE.Vector3()}};
function clipMaterial(material){
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,clipUniforms);
  shader.vertexShader='varying vec3 portalWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nportalWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader='uniform mat4 portalInverse; uniform vec3 portalCamera; varying vec3 portalWorld;\n'+shader.fragmentShader.replace('void main() {',`void main() {
   vec3 point=(portalInverse*vec4(portalWorld,1.0)).xyz;
   vec3 eye=portalCamera;
   if(eye.z<=0.01 || point.z>=0.0) discard;
   float t=eye.z/(eye.z-point.z);
   vec3 aperture=mix(eye,point,t);
   if(abs(aperture.x)>0.675 || aperture.y<0.0 || aperture.y>2.05) discard;
  `);
 };
 material.customProgramCacheKey=()=> 'portal-aperture-v4';return material;
}
function interiorMaterial(color){return clipMaterial(new THREE.MeshStandardMaterial({color,roughness:1}));}

function build(){
scene.add(new THREE.HemisphereLight(0xe4f5ff,0x67523c,2.2));const sun=new THREE.DirectionalLight(0xffe6bc,2);sun.position.set(-3,7,4);scene.add(sun);
portal=new THREE.Group();portal.visible=false;scene.add(portal);
const WIDTH=1.35,HEIGHT=2.05;
const colors={ground:interiorMaterial(0x677352),rock:interiorMaterial(0x858a86),trunk:interiorMaterial(0x564939),pine:interiorMaterial(0x304f43),pineLight:interiorMaterial(0x496655),snow:interiorMaterial(0xc6d0cc),water:interiorMaterial(0x7aafbd)};
function mesh(geometry,material,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.renderOrder=2;portal.add(m);return m;}
const ground=mesh(new THREE.PlaneGeometry(32,32),colors.ground,0,-.018,-16);ground.rotation.x=-Math.PI/2;
const sky=mesh(new THREE.PlaneGeometry(34,19),clipMaterial(new THREE.MeshBasicMaterial({color:0x9cbbc9})),0,8,-30);
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

}
function syncClip(){portal.updateMatrixWorld(true);inversePortal.copy(portal.matrixWorld).invert();clipUniforms.portalCamera.value.copy(camera.position).applyMatrix4(inversePortal);}
function place(){
 if(!ready)return;
 // A reference floor at y=0, initialized from an assumed 1.4 m phone height.
 const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),camera);
 const hit=new THREE.Vector3();const found=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),hit);
 if(!found || hit.distanceTo(camera.position)>5 || hit.distanceTo(camera.position)<.5){$('status').textContent='Usmjeri sredinu kamere prema podu 1–3 m ispred sebe pa postavi otvor.';return;}
 portal.position.copy(hit);portal.rotation.set(0,Math.atan2(camera.position.x-hit.x,camera.position.z-hit.z),0);
 portal.visible=true;placed=true;syncClip();$('place').hidden=true;$('reset').hidden=false;
 $('status').textContent='Otvor postavljen. Ostani ispred njega i pomakni se lijevo/desno.';
}
function fail(error){starting=false;$('intro').hidden=false;$('hud').hidden=true;$('start').disabled=false;$('start').textContent='Pokušaj ponovno';$('support').textContent='XR8 nije pokrenut: '+(error?.message||String(error));}
const pipeline={name:'isolated-pleistocene-portal-xr8-v4',
 onStart:({canvas})=>{
  ({scene,camera}=XR8.Threejs.xrScene());build();camera.position.set(0,1.4,0);
  XR8.XrController.updateCameraProjectionMatrix({origin:camera.position,facing:camera.quaternion});
  ready=true;starting=false;document.body.className='ar';$('intro').hidden=true;$('hud').hidden=false;
  $('status').textContent='Drži telefon oko 1,4 m iznad poda. Polako pogledaj oko sebe, zatim naciljaj pod i postavi otvor.';
  canvas.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
 },
 onUpdate:()=>{
  if(!ready)return;if(placed)syncClip();
  const now=performance.now();if(now-lastMetrics>500){lastMetrics=now;$('metrics').textContent='Sustav: XR8 SLAM · v4\nPoložaj telefona: '+camera.position.toArray().map(x=>x.toFixed(2)).join(' / ')+'\nOtvor: '+(placed?'fiksiran u XR8 prostoru':'čeka postavljanje')+'\nPod: procijenjena ravnina, nije detektiran\nSkala: XR8 responsive; dimenzije su približne';}
 },
 onException:fail,
};
async function start(){
 if(starting)return;starting=true;$('start').disabled=true;$('support').textContent='Pokrećem XR8 kameru…';
 try{
  XR8.XrController.configure({disableWorldTracking:false});
  XR8.addCameraPipelineModules([XR8.GlTextureRenderer.pipelineModule(),XR8.Threejs.pipelineModule(),XR8.XrController.pipelineModule(),LandingPage.pipelineModule(),XRExtras.FullWindowCanvas.pipelineModule(),XRExtras.Loading.pipelineModule(),XRExtras.RuntimeError.pipelineModule(),pipeline]);
  await XR8.run({canvas:$('camerafeed')});
 }catch(e){fail(e);}
}
$('start').addEventListener('click',start);$('place').addEventListener('click',place);
$('reset').addEventListener('click',()=>{portal.visible=false;placed=false;$('place').hidden=false;$('reset').hidden=true;$('status').textContent='Naciljaj novi položaj na podu pa postavi otvor.';});
$('exit').addEventListener('click',()=>location.reload());
function loaded(){if(window.XR8&&window.XRExtras&&window.LandingPage){$('start').disabled=false;$('start').textContent='Pokreni XR8 kameru';$('support').textContent='Otvori u Chromeu i dopusti kameru. Ova verzija ne traži ARCore.';}}
window.addEventListener('xrloaded',loaded);loaded();
setTimeout(()=>{if($('start').disabled&&!starting)$('support').textContent='XR8 se nije učitao. Provjeri vezu i osvježi stranicu.';},20000);
