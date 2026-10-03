import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js';
import {mergeGeometries} from 'https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/utils/BufferGeometryUtils.js';
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
 material.customProgramCacheKey=()=> 'portal-aperture-v5';return material;
}
function interiorMaterial(color){return clipMaterial(new THREE.MeshStandardMaterial({color,roughness:1}));}

function build(){
scene.add(new THREE.HemisphereLight(0xc9dbdf,0x3b3926,1.65));
const sun=new THREE.DirectionalLight(0xffe9ca,2.1);sun.position.set(-8,12,6);scene.add(sun);
portal=new THREE.Group();portal.visible=false;scene.add(portal);
function terrain(x,z){return -.045+Math.sin(x*.58+z*.22)*.08+Math.sin(z*.65)*.035;}
const loader=new THREE.TextureLoader();
function texture(name,repeatX,repeatY){const t=loader.load('assets/'+name+'.jpg',()=>{$('textures').textContent='Teksture učitane.';},undefined,()=>{$('textures').textContent='Dio tekstura se nije učitao. Osvježi stranicu.';});t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeatX,repeatY);return t;}
const groundMat=clipMaterial(new THREE.MeshStandardMaterial({map:texture('ground',10,14),color:0xa4aa87,roughness:1}));
const barkMat=clipMaterial(new THREE.MeshStandardMaterial({map:texture('bark',1,3),color:0xaca998,roughness:1}));
const rockMat=clipMaterial(new THREE.MeshStandardMaterial({map:texture('rock',1,1),color:0xa7ada6,roughness:1}));
function mesh(geometry,material,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.renderOrder=2;portal.add(m);return m;}
const groundGeo=new THREE.PlaneGeometry(32,42,48,64);groundGeo.rotateX(-Math.PI/2);groundGeo.translate(0,0,-21.1);
const pos=groundGeo.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,terrain(pos.getX(i),pos.getZ(i)));groundGeo.computeVertexNormals();mesh(groundGeo,groundMat);
let seed=71;function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
function boughTexture(){const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
 for(let b=0;b<34;b++){const x=256+(rnd()-.5)*290,y=55+rnd()*350;const dir=b%2?1:-1;ctx.strokeStyle='#464b2f';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(256,490);ctx.lineTo(x,y);ctx.stroke();
  for(let n=0;n<45;n++){const t=rnd(),px=256+(x-256)*t,py=490+(y-490)*t;const length=8+rnd()*20;ctx.strokeStyle=['#264334','#446544','#67825a','#375439'][n%4];ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+dir*length,py-length*.65);ctx.moveTo(px,py);ctx.lineTo(px-dir*length*.7,py-length*.4);ctx.stroke();}}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
const foliageMat=clipMaterial(new THREE.MeshStandardMaterial({map:boughTexture(),alphaTest:.3,side:THREE.DoubleSide,color:0xc0cbb1,roughness:1}));
const woodParts=[],leafParts=[];
function branch(a,b,r1,r2){const delta=new THREE.Vector3().subVectors(b,a),g=new THREE.CylinderGeometry(r2,r1,delta.length(),7,1);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...new THREE.Vector3().addVectors(a,b).multiplyScalar(.5).toArray());woodParts.push(g);}
for(let i=0;i<42;i++){let x=(rnd()-.5)*25,z=-2.8-rnd()*34;if(Math.abs(x)<1.4)x+=x<0?-2:2;const base=terrain(x,z),h=4.5+rnd()*4.5;
 branch(new THREE.Vector3(x,base,z),new THREE.Vector3(x+.1,base+h,z),.15+rnd()*.07,.025);
 for(let tier=0;tier<9;tier++){const level=.2+tier*.078,radius=(1-level)*1.8;for(let j=0;j<5;j++){const angle=j*Math.PI*2/5+tier*.7+rnd()*.4;
 const root=new THREE.Vector3(x,base+h*level,z),tip=new THREE.Vector3(x+Math.cos(angle)*radius,root.y+.12,z+Math.sin(angle)*radius);
 branch(root,tip,.035*(1-level),.006);
 for(let cross=0;cross<2;cross++){const g=new THREE.PlaneGeometry(radius*1.7,1.2);g.rotateZ((rnd()-.5)*.55);g.rotateY(angle+cross*Math.PI/2);g.translate(tip.x,tip.y+.22,tip.z);leafParts.push(g);}}}
}
mesh(mergeGeometries(woodParts),barkMat);mesh(mergeGeometries(leafParts),foliageMat);woodParts.forEach(g=>g.dispose());leafParts.forEach(g=>g.dispose());
for(let i=0;i<25;i++){const x=(rnd()-.5)*14,z=-.55-rnd()*17,scale=.16+rnd()*.42;const g=new THREE.IcosahedronGeometry(1,3);const a=g.attributes.position;for(let k=0;k<a.count;k++){const v=new THREE.Vector3().fromBufferAttribute(a,k);const f=1+.13*Math.sin(v.x*12+v.y*7+v.z*9);a.setXYZ(k,v.x*f*scale,v.y*f*scale*.7,v.z*f*scale);}g.computeVertexNormals();mesh(g,rockMat,x,terrain(x,z)+scale*.35,z);}
// Organic stream ribbon, recessed slightly into the terrain.
const streamVertices=[],streamUV=[],streamIndices=[];for(let i=0;i<=64;i++){const z=-.15-i*.49,cx=1.35+Math.sin(z*.2)*.8,w=.43+Math.sin(z*.5)*.08;for(const side of [-1,1]){const x=cx+side*w;streamVertices.push(x,terrain(x,z)+.022,z);streamUV.push((side+1)/2,i/8);}if(i<64){const a=i*2;streamIndices.push(a,a+1,a+2,a+1,a+3,a+2);}}
const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(streamVertices,3));sg.setAttribute('uv',new THREE.Float32BufferAttribute(streamUV,2));sg.setIndex(streamIndices);sg.computeVertexNormals();
const waterMat=clipMaterial(new THREE.MeshStandardMaterial({color:0x526f6e,roughness:.27,metalness:.25}));mesh(sg,waterMat);
// Ground cover uses real geometry rather than cones.
const grass=[];for(let i=0;i<800;i++){const x=(rnd()-.5)*22,z=-.25-rnd()*30,y=terrain(x,z)+.01,h=.12+rnd()*.24;const cx=1.35+Math.sin(z*.2)*.8;if(Math.abs(x-cx)<.58)continue;const angle=rnd()*Math.PI,g=new THREE.PlaneGeometry(.055,h);g.rotateY(angle);g.translate(x,y+h*.5,z);grass.push(g);}
mesh(mergeGeometries(grass),clipMaterial(new THREE.MeshStandardMaterial({color:0x66734b,side:THREE.DoubleSide,roughness:1})));grass.forEach(g=>g.dispose());
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
const pipeline={name:'isolated-pleistocene-portal-xr8-v5',
 onStart:({canvas})=>{
  ({scene,camera}=XR8.Threejs.xrScene());build();camera.position.set(0,1.4,0);
  XR8.XrController.updateCameraProjectionMatrix({origin:camera.position,facing:camera.quaternion});
  ready=true;starting=false;document.body.className='ar';$('intro').hidden=true;$('hud').hidden=false;
  $('status').textContent='Drži telefon oko 1,4 m iznad poda. Polako pogledaj oko sebe, zatim naciljaj pod i postavi otvor.';
  canvas.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
 },
 onUpdate:()=>{
  if(!ready)return;if(placed)syncClip();
  const now=performance.now();if(now-lastMetrics>500){lastMetrics=now;$('metrics').textContent='Sustav: XR8 SLAM · v5\nPoložaj telefona: '+camera.position.toArray().map(x=>x.toFixed(2)).join(' / ')+'\nOtvor: '+(placed?'fiksiran u XR8 prostoru':'čeka postavljanje')+'\nPod: procijenjena ravnina, nije detektiran\nSkala: XR8 responsive; dimenzije su približne';}
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
