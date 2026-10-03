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
 material.customProgramCacheKey=()=> 'portal-aperture-v8';return material;
}
function interiorMaterial(color){return clipMaterial(new THREE.MeshStandardMaterial({color,roughness:1}));}

async function build(){
scene.add(new THREE.HemisphereLight(0xd9e5e0,0x3c4435,1.7));const sun=new THREE.DirectionalLight(0xe8eee1,1.5);sun.position.set(-7,10,4);scene.add(sun);
portal=new THREE.Group();portal.visible=false;scene.add(portal);
function mesh(geometry,material,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.renderOrder=2;portal.add(m);return m;}
const loader=new THREE.TextureLoader();
const [groundMap,rockMap,photo]=await Promise.all(['ground.jpg','rock.jpg','krapina-environment-v7.jpg'].map(n=>loader.loadAsync('assets/'+n)));
for(const t of [groundMap,rockMap,photo]){t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;}
groundMap.wrapS=groundMap.wrapT=THREE.RepeatWrapping;groundMap.repeat.set(13,11);rockMap.wrapS=rockMap.wrapT=THREE.RepeatWrapping;rockMap.repeat.set(3,2);
function height(x,z){const near=Math.min(1,Math.max(0,(-z-.12)/2));const caveZone=x>-2.5&&x<4&&z<-3.5&&z>-10;return -.025+(caveZone?0:near*(Math.sin(x*.45+z*.22)*.09+Math.sin(z*.55)*.04));}
const terrain=new THREE.PlaneGeometry(40,34,64,64);terrain.rotateX(-Math.PI/2);terrain.translate(0,0,-17.01);const tp=terrain.attributes.position;for(let i=0;i<tp.count;i++)tp.setY(i,height(tp.getX(i),tp.getZ(i)));terrain.computeVertexNormals();mesh(terrain,clipMaterial(new THREE.MeshStandardMaterial({map:groundMap,color:0xb0b8a1,roughness:1})));
// True volumetric shell: inner wall, outer rock surface and thick front rim.
const cliffMat=clipMaterial(new THREE.MeshStandardMaterial({map:rockMap,bumpMap:rockMap,bumpScale:.045,color:0xb2bbaa,roughness:1}));
const innerMat=clipMaterial(new THREE.MeshStandardMaterial({map:rockMap,bumpMap:rockMap,bumpScale:.04,color:0x717b6a,roughness:1,side:THREE.DoubleSide}));
const caveX=.8,front=-4.8,back=-9.5,segments=64,depthSegments=20;
function surface(outer){const positions=[],uv=[],indices=[];for(let j=0;j<=depthSegments;j++){const z=front+(back-front)*j/depthSegments;for(let i=0;i<=segments;i++){const angle=i/segments*Math.PI;const irregular=.07*Math.sin(angle*13+z*2.1)+.045*Math.cos(angle*23-z*1.6);const rx=(outer?2.85:2.1)+irregular,ry=(outer?4:3)+irregular;positions.push(caveX+Math.cos(angle)*rx,-.025+Math.sin(angle)*ry,z);uv.push(i/segments,j/depthSegments);if(i<segments&&j<depthSegments){const n=j*(segments+1)+i;if(outer)indices.push(n,n+segments+1,n+1,n+1,n+segments+1,n+segments+2);else indices.push(n,n+1,n+segments+1,n+1,n+segments+2,n+segments+1);}}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;}
mesh(surface(true),cliffMat);mesh(surface(false),innerMat);
const rimPositions=[],rimUv=[],rimIndices=[];for(let i=0;i<=segments;i++){const a=i/segments*Math.PI;const noise=.07*Math.sin(a*13+front*2.1)+.045*Math.cos(a*23-front*1.6);for(const outer of [false,true]){rimPositions.push(caveX+Math.cos(a)*((outer?2.85:2.1)+noise),-.025+Math.sin(a)*((outer?4:3)+noise),front);rimUv.push(i/segments,outer?1:0);}if(i<segments){const n=i*2;rimIndices.push(n,n+1,n+2,n+1,n+3,n+2);}}
const rim=new THREE.BufferGeometry();rim.setAttribute('position',new THREE.Float32BufferAttribute(rimPositions,3));rim.setAttribute('uv',new THREE.Float32BufferAttribute(rimUv,2));rim.setIndex(rimIndices);rim.computeVertexNormals();mesh(rim,clipMaterial(new THREE.MeshStandardMaterial({map:rockMap,color:0xb6c0b0,roughness:1,side:THREE.DoubleSide})));
const endWall=new THREE.PlaneGeometry(5.7,4);mesh(endWall,clipMaterial(new THREE.MeshStandardMaterial({map:rockMap,color:0x30392e,roughness:1})),caveX,1.97,back-.015);
// Only the forest portion of the user's frame is used in the distance.
const backdrop=new THREE.PlaneGeometry(100,40);const buv=backdrop.attributes.uv;for(let i=0;i<buv.count;i++)buv.setX(i,buv.getX(i)*.40);mesh(backdrop,clipMaterial(new THREE.MeshBasicMaterial({map:photo})),0,15,-33);
const shell=new THREE.SphereGeometry(60,32,16);mesh(shell,clipMaterial(new THREE.MeshBasicMaterial({color:0x66766c,side:THREE.BackSide})),0,4,-15);
const gltf=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);const [rock,pine]=await Promise.all([gltf.loadAsync('assets/rock_07.glb'),gltf.loadAsync('assets/pine_sapling_small.glb')]);
const stoneMap=rockMap.clone();stoneMap.repeat.set(1,1);
rock.scene.traverse(o=>{if(o.isMesh){o.renderOrder=2;o.material=clipMaterial(new THREE.MeshStandardMaterial({map:stoneMap,color:0xa4af9d,roughness:1}));}});
pine.scene.traverse(o=>{if(o.isMesh){o.renderOrder=2;o.material=clipMaterial(o.material.clone());}});
function instance(source,x,z,h,angle){const wrapper=new THREE.Group(),object=source.clone(true);wrapper.add(object);const box=new THREE.Box3().setFromObject(object),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());object.position.x-=center.x;object.position.z-=center.z;object.position.y-=box.min.y;wrapper.scale.setScalar(h/size.y);wrapper.rotation.y=angle;wrapper.position.set(x,height(x,z),z);portal.add(wrapper);}
for(const [x,z,h,a] of [[-.55,-.8,.22,.7],[.58,-1.7,.32,2.5],[-1.7,-4.5,.5,1.2],[3.1,-4.7,.65,2],[-2.4,-6.2,.35,.4],[3.4,-7,.45,1.4]])instance(rock.scene,x,z,h,a);
for(const [i,x,z,h,a] of [[0,-3.3,-9,7,1.2],[1,-5.8,-15,9,2.2],[0,5.4,-17,8.5,.4]])instance(pine.scene.children[i],x,z,h,a);
$('textures').textContent='3D zaklon i teren učitani; šuma iz kadra je u daljini.';
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
 $('status').textContent='Otvor postavljen. Pomakni se lijevo/desno ispred otvora i pogledaj bočne strane zaklona.';
}
function fail(error){starting=false;$('intro').hidden=false;$('hud').hidden=true;$('start').disabled=false;$('start').textContent='Pokušaj ponovno';$('support').textContent='XR8 nije pokrenut: '+(error?.message||String(error));}
const pipeline={name:'isolated-pleistocene-portal-xr8-v8',
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
  const now=performance.now();if(now-lastMetrics>500){lastMetrics=now;$('metrics').textContent='Sustav: XR8 SLAM · v8\nPoložaj telefona: '+camera.position.toArray().map(x=>x.toFixed(2)).join(' / ')+'\nOtvor: '+(placed?'fiksiran u XR8 prostoru':'čeka postavljanje')+'\nPod: procijenjena ravnina, nije detektiran\nSkala: XR8 responsive; dimenzije su približne';}
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
