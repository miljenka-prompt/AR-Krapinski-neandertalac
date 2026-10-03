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
 material.customProgramCacheKey=()=> 'portal-aperture-v6';return material;
}
function interiorMaterial(color){return clipMaterial(new THREE.MeshStandardMaterial({color,roughness:1}));}

async function build(){
scene.add(new THREE.HemisphereLight(0xc9dbdf,0x3b3926,1.65));
const sun=new THREE.DirectionalLight(0xe5eced,1.6);sun.position.set(-8,12,6);scene.add(sun);
portal=new THREE.Group();portal.visible=false;scene.add(portal);
function terrain(x,z){const fade=Math.min(1,Math.max(0,(-z-.12)/1.2));const cx=1.35+Math.sin(z*.2)*.8;const channel=Math.max(0,1-Math.abs(x-cx)/.7);return -.025+fade*(Math.sin(x*.58+z*.22)*.065+Math.sin(z*.65)*.025-channel*.13);}
const loader=new THREE.TextureLoader();
function texture(name,repeatX,repeatY){const t=loader.load('assets/'+name+'.jpg',()=>{$('textures').textContent='Teksture učitane.';},undefined,()=>{$('textures').textContent='Dio tekstura se nije učitao. Osvježi stranicu.';});t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeatX,repeatY);return t;}
const groundMat=clipMaterial(new THREE.MeshStandardMaterial({map:texture('ground',10,14),color:0xc3bd9f,roughness:1}));
const barkMat=clipMaterial(new THREE.MeshStandardMaterial({map:texture('bark',1,3),color:0xaca998,roughness:1}));
const rockMat=clipMaterial(new THREE.MeshStandardMaterial({map:texture('rock',1,1),color:0xa7ada6,roughness:1}));
function mesh(geometry,material,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.renderOrder=2;portal.add(m);return m;}
const groundGeo=new THREE.PlaneGeometry(32,42,64,84);groundGeo.rotateX(-Math.PI/2);groundGeo.translate(0,0,-21.01);
const pos=groundGeo.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,terrain(pos.getX(i),pos.getZ(i)));groundGeo.computeVertexNormals();mesh(groundGeo,groundMat);
let seed=71;function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
const modelLoader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const [pine,rock]=await Promise.all([modelLoader.loadAsync('assets/pine_sapling_small.glb'),modelLoader.loadAsync('assets/rock_07.glb')]);
function prepare(root){root.traverse(o=>{if(!o.isMesh)return;o.renderOrder=2;o.material=Array.isArray(o.material)?o.material.map(m=>clipMaterial(m.clone())):clipMaterial(o.material.clone());});}
prepare(pine.scene);prepare(rock.scene);
function modelAt(source,x,z,height,rotation){const wrapper=new THREE.Group(),object=source.clone(true);wrapper.add(object);const bounds=new THREE.Box3().setFromObject(object),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 object.position.x-=center.x;object.position.z-=center.z;object.position.y-=bounds.min.y;
 wrapper.scale.setScalar(height/size.y);wrapper.rotation.y=rotation;wrapper.position.set(x,terrain(x,z),z);portal.add(wrapper);return wrapper;}
const variants=pine.scene.children;
// Asymmetric clusters frame a clear stream and a view into the distance.
const trees=[[-2.8,-4.2,6.7],[3.6,-6.3,7.5],[-4.5,-10,8.2],[5,-12.5,7.8],[-5.4,-19,8.7],[4.4,-21.5,8.2],[-3.7,-27,8.5],[6,-29,8.8]];
for(let i=0;i<trees.length;i++){const [x,z,h]=trees[i];modelAt(variants[i%variants.length],x,z,h,rnd()*Math.PI*2);}
const rocks=[[-.55,-.75,.32],[.8,-2.1,.25],[-1.3,-4.8,.47],[2.4,-5.5,.35],[-3.3,-8,.3],[.3,-8.4,.24],[2.5,-11,.36],[-2.9,-15,.5],[1.9,-17.6,.38]];
for(const [x,z,h] of rocks)modelAt(rock.scene,x,z,h,rnd()*Math.PI*2);
$('textures').textContent='3D modeli i teksture učitani.';
// Organic stream ribbon, recessed slightly into the terrain.
const streamVertices=[],streamUV=[],streamIndices=[];for(let i=0;i<=64;i++){const z=-.15-i*.49,cx=1.35+Math.sin(z*.2)*.8,w=.43+Math.sin(z*.5)*.08;for(const side of [-1,1]){const x=cx+side*w;streamVertices.push(x,terrain(cx,z)+.065,z);streamUV.push((side+1)/2,i/8);}if(i<64){const a=i*2;streamIndices.push(a,a+1,a+2,a+1,a+3,a+2);}}
const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(streamVertices,3));sg.setAttribute('uv',new THREE.Float32BufferAttribute(streamUV,2));sg.setIndex(streamIndices);sg.computeVertexNormals();
const waterClock={value:0};
const waterMat=clipMaterial(new THREE.MeshStandardMaterial({color:0x819d9c,roughness:.18,metalness:.15}));
const clipWater=waterMat.onBeforeCompile;
waterMat.onBeforeCompile=shader=>{clipWater(shader);shader.uniforms.waterTime=waterClock;shader.fragmentShader='uniform float waterTime;\n'+shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 float rippleA=sin(portalWorld.x*25.0+portalWorld.z*13.0-waterTime*1.2);
 float rippleB=cos(portalWorld.z*33.0+portalWorld.x*9.0-waterTime*.7);
 normal=normalize(normal+vec3(rippleA*.12,rippleB*.08,0.0));
 `);};waterMat.customProgramCacheKey=()=> 'portal-water-v6';mesh(sg,waterMat);
window.portalWaterClock=waterClock;
// A continuous smooth distant ridge, avoiding repeated cone mountains.
const ridge=new THREE.PlaneGeometry(45,9,90,12),rp=ridge.attributes.position;
for(let i=0;i<rp.count;i++){const x=rp.getX(i),y=rp.getY(i),t=(y+4.5)/9;const crest=3.2+Math.sin(x*.16)*1.7+Math.sin(x*.39)*.7;rp.setY(i,-.5+t*crest);rp.setZ(i,-37-Math.sin(x*.23)*1.1);}
ridge.computeVertexNormals();mesh(ridge,clipMaterial(new THREE.MeshStandardMaterial({color:0x81918f,roughness:1,side:THREE.DoubleSide})),0,0,0);
const skyCanvas=document.createElement('canvas');skyCanvas.width=16;skyCanvas.height=256;const ctx=skyCanvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,0,256);gradient.addColorStop(0,'#738d99');gradient.addColorStop(.65,'#bec9c3');gradient.addColorStop(1,'#7c9081');ctx.fillStyle=gradient;ctx.fillRect(0,0,16,256);
const skyTexture=new THREE.CanvasTexture(skyCanvas);skyTexture.colorSpace=THREE.SRGBColorSpace;mesh(new THREE.PlaneGeometry(44,22),clipMaterial(new THREE.MeshBasicMaterial({map:skyTexture})),0,8,-42);
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
 $('status').textContent='Otvor postavljen. Ostani ispred njega i pomakni se lijevo/desno.';
}
function fail(error){starting=false;$('intro').hidden=false;$('hud').hidden=true;$('start').disabled=false;$('start').textContent='Pokušaj ponovno';$('support').textContent='XR8 nije pokrenut: '+(error?.message||String(error));}
const pipeline={name:'isolated-pleistocene-portal-xr8-v6',
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
  if(!ready)return;if(placed)syncClip();if(window.portalWaterClock)window.portalWaterClock.value=performance.now()/1000;
  const now=performance.now();if(now-lastMetrics>500){lastMetrics=now;$('metrics').textContent='Sustav: XR8 SLAM · v6\nPoložaj telefona: '+camera.position.toArray().map(x=>x.toFixed(2)).join(' / ')+'\nOtvor: '+(placed?'fiksiran u XR8 prostoru':'čeka postavljanje')+'\nPod: procijenjena ravnina, nije detektiran\nSkala: XR8 responsive; dimenzije su približne';}
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
