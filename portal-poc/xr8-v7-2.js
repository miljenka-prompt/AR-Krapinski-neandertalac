import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js';
import {GLTFLoader} from 'https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/libs/meshopt_decoder.module.js';
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
 material.customProgramCacheKey=()=> 'portal-aperture-v7';return material;
}
function interiorMaterial(color){return clipMaterial(new THREE.MeshStandardMaterial({color,roughness:1}));}

async function build(){
scene.add(new THREE.HemisphereLight(0xd9e8e2,0x414738,1.6));const sun=new THREE.DirectionalLight(0xe9f0e6,.8);sun.position.set(-4,8,3);scene.add(sun);
portal=new THREE.Group();portal.visible=false;scene.add(portal);
function mesh(geometry,material,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.renderOrder=2;portal.add(m);return m;}
const loader=new THREE.TextureLoader();
const photo=await loader.loadAsync('assets/krapina-environment-v7.jpg');photo.colorSpace=THREE.SRGBColorSpace;photo.anisotropy=4;
const photoMat=clipMaterial(new THREE.MeshBasicMaterial({map:photo,side:THREE.DoubleSide}));
const reliefMaterial=clipMaterial(new THREE.MeshBasicMaterial({map:photo,side:THREE.DoubleSide,transparent:true,depthWrite:false}));
const reliefCompile=reliefMaterial.onBeforeCompile;reliefMaterial.onBeforeCompile=shader=>{reliefCompile(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>', 'diffuseColor.a *= smoothstep(0.0,0.025,vMapUv.y);\n#include <opaque_fragment>');};reliefMaterial.customProgramCacheKey=()=> 'portal-relief-edge-v7-1';
// Artist-estimated depth, not depth recovered from the static source video.
const cols=96,rows=56,positions=[],uvs=[],indices=[];
for(let j=0;j<=rows;j++){const v=j/rows;for(let i=0;i<=cols;i++){const u=i/cols;
 const cliff=THREE.MathUtils.smoothstep(u,.42,.76);
 const far=14-cliff*7.5;
 const groundBlend=THREE.MathUtils.smoothstep(v,.18,.52);
 const groundDistance=1.425/(Math.max(.42-v,.20)*.848214);
 const distance=THREE.MathUtils.lerp(groundDistance,far,groundBlend);
 positions.push((u-.5)*1.36*distance,Math.max(-.025,1.4+(v-.42)*.848214*distance),2-distance);uvs.push(u,v);
 if(i<cols&&j<rows){const n=j*(cols+1)+i;indices.push(n,n+1,n+cols+1,n+1,n+cols+2,n+cols+1);}
}}
const relief=new THREE.BufferGeometry();relief.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));relief.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));relief.setIndex(indices);relief.computeVertexNormals();const reliefMesh=mesh(relief,reliefMaterial);reliefMesh.renderOrder=2.5;
// Closed far shell prevents the real camera appearing through uncovered background.
const shell=new THREE.SphereGeometry(38,48,24);mesh(shell,clipMaterial(new THREE.MeshBasicMaterial({color:0x414c40,side:THREE.BackSide})),0,3,-12);
// Independent repeating ground texture: never clamp the photograph UV to one row.
const groundTexture=await loader.loadAsync('assets/ground.jpg');groundTexture.colorSpace=THREE.SRGBColorSpace;groundTexture.wrapS=groundTexture.wrapT=THREE.RepeatWrapping;groundTexture.repeat.set(8,1.02);groundTexture.anisotropy=4;
const ground=new THREE.PlaneGeometry(16,2.04,24,12);ground.rotateX(-Math.PI/2);ground.translate(0,-.029,-1.03);
const groundMaterial=clipMaterial(new THREE.MeshStandardMaterial({map:groundTexture,color:0xa7b0a0,roughness:1}));mesh(ground,groundMaterial);
const rockLoader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);const rock=await rockLoader.loadAsync('assets/rock_07.glb');
const grayRock=await loader.loadAsync('assets/rock.jpg');grayRock.colorSpace=THREE.SRGBColorSpace;
rock.scene.traverse(o=>{if(!o.isMesh)return;o.renderOrder=2;o.material=clipMaterial(new THREE.MeshStandardMaterial({map:grayRock,color:0xa9b3a4,roughness:1,metalness:0}));});
for(const [x,z,h,angle] of [[-.47,-.62,.2,.7],[.53,-1.25,.27,2.5],[-1.3,-2.5,.35,1.4]]){
 const wrap=new THREE.Group(),object=rock.scene.clone(true);wrap.add(object);const box=new THREE.Box3().setFromObject(object),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());object.position.x-=center.x;object.position.z-=center.z;object.position.y-=box.min.y;wrap.scale.setScalar(h/size.y);wrap.rotation.y=angle;wrap.position.set(x,-.025,z);portal.add(wrap);
}
$('textures').textContent='Kadar videa, reljefna pozadina i 3D stijene učitani.';
const frameMat=new THREE.MeshStandardMaterial({color:0x6f7974,roughness:.8});
for(const x of [-WIDTH/2-.045,WIDTH/2+.045]){const p=new THREE.Mesh(new THREE.BoxGeometry(.09,HEIGHT+.09,.12),frameMat);p.position.set(x,HEIGHT/2,.025);p.renderOrder=3;portal.add(p);}
const top=new THREE.Mesh(new THREE.BoxGeometry(WIDTH+.18,.09,.12),frameMat);top.position.set(0,HEIGHT+.045,.025);top.renderOrder=3;portal.add(top);
const pad=new THREE.Mesh(new THREE.PlaneGeometry(1.55,.3),new THREE.MeshStandardMaterial({color:0x67717a,roughness:1}));pad.rotation.x=-Math.PI/2;pad.position.set(0,-.025,.12);pad.renderOrder=3;portal.add(pad);
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
 $('status').textContent='Otvor postavljen. Za ovaj prizor pomakni se malo lijevo/desno, ostajući ispred otvora.';
}
function fail(error){starting=false;$('intro').hidden=false;$('hud').hidden=true;$('start').disabled=false;$('start').textContent='Pokušaj ponovno';$('support').textContent='XR8 nije pokrenut: '+(error?.message||String(error));}
const pipeline={name:'isolated-pleistocene-portal-xr8-v7',
 onStart:async({canvas})=>{
  ({scene,camera}=XR8.Threejs.xrScene());camera.position.set(0,1.4,0);
  XR8.XrController.updateCameraProjectionMatrix({origin:camera.position,facing:camera.quaternion});
  document.body.className='ar';$('intro').hidden=true;$('hud').hidden=false;$('place').disabled=true;$('status').textContent='Kamera radi. Učitavam 3D šumu…';
  try{await build();}catch(e){fail(new Error('Učitavanje šume: '+e.message));return;}
  ready=true;starting=false;$('place').disabled=false;
  $('status').textContent='Drži telefon oko 1,4 m iznad poda. Polako pogledaj oko sebe, zatim naciljaj pod i postavi otvor.';
  canvas.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
 },
 onUpdate:()=>{
  if(!ready)return;if(placed)syncClip();
  const now=performance.now();if(now-lastMetrics>500){lastMetrics=now;$('metrics').textContent='Sustav: XR8 SLAM · v7.2\nPoložaj telefona: '+camera.position.toArray().map(x=>x.toFixed(2)).join(' / ')+'\nOtvor: '+(placed?'fiksiran u XR8 prostoru':'čeka postavljanje')+'\nPod: procijenjena ravnina, nije detektiran\nSkala: XR8 responsive; dimenzije su približne';}
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
