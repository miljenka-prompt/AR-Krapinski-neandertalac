import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js';
window.THREE=THREE;
const $=id=>document.getElementById(id);
let scene,camera,portal,ready=false,starting=false,placed=false,lastMetrics=0;
const WIDTH=1.35,HEIGHT=2.05,inversePortal=new THREE.Matrix4();
const clipUniforms={portalInverse:{value:inversePortal},portalCamera:{value:new THREE.Vector3()}};
function clipMaterial(material){material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,clipUniforms);shader.vertexShader='varying vec3 portalWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nportalWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');shader.fragmentShader='uniform mat4 portalInverse; uniform vec3 portalCamera; varying vec3 portalWorld;\n'+shader.fragmentShader.replace('void main() {',`void main(){vec3 point=(portalInverse*vec4(portalWorld,1.0)).xyz;vec3 eye=portalCamera;if(eye.z<=0.01||point.z>=0.0)discard;float t=eye.z/(eye.z-point.z);vec3 aperture=mix(eye,point,t);if(abs(aperture.x)>.675||aperture.y<0.0||aperture.y>2.05)discard;`);};material.customProgramCacheKey=()=> 'portal-aperture-v10';return material;}
function bowedPlane(w,h,bow=.08){const g=new THREE.PlaneGeometry(w,h,28,14),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i)/(w*.5),y=p.getY(i)/(h*.5);p.setZ(i,bow*(1-x*x)+.018*Math.sin(x*9+y*5));}g.computeVertexNormals();return g;}
async function build(){
 scene.add(new THREE.HemisphereLight(0xe8eee8,0x353b2e,1.35));
 portal=new THREE.Group();portal.visible=false;scene.add(portal);
 const add=(g,m,x=0,y=0,z=0)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.renderOrder=2;portal.add(o);return o;};
 const photo=await new THREE.TextureLoader().loadAsync('assets/krapina-relief-v11.jpg');photo.colorSpace=THREE.SRGBColorSpace;photo.anisotropy=4;
 const cols=64,rows=44,positions=[],uv=[],indices=[];
 const fold=.47,nearZ=-.38,farZ=-5.25,nearW=1.75,farW=4.75,wallH=3.0;
 const smooth=(a,b,x)=>{x=Math.max(0,Math.min(1,(x-a)/(b-a)));return x*x*(3-2*x);};
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const u=i/cols,v=j/rows;let x,y,z;
  if(v<=fold){const q=Math.pow(v/fold,.82),w=nearW+(farW-nearW)*q;x=(u-.5)*w;y=-.035+.055*q;z=nearZ+(farZ-nearZ)*q;}
  else{const q=(v-fold)/(1-fold);x=(u-.5)*farW;y=q*wallH;z=farZ;
   const right=smooth(.43,.72,u);const arch=smooth(.42,.61,q);const edgeFade=1-smooth(.88,1,u);
   const du=(u-.79)/.145,dv=(q-.52)/.34,recess=Math.max(0,1-du*du-dv*dv);
   z+=right*arch*edgeFade*.55-recess*.72;
   z+=.045*Math.sin(u*22+q*9)*right;
  }
  positions.push(x,y,z);uv.push(u,v);
 }
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const n=j*(cols+1)+i;indices.push(n,n+1,n+cols+1,n+1,n+cols+2,n+cols+1);}
 const relief=new THREE.BufferGeometry();relief.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));relief.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));relief.setIndex(indices);relief.computeVertexNormals();
 add(relief,clipMaterial(new THREE.MeshBasicMaterial({map:photo,side:THREE.DoubleSide})));
 const frameMat=new THREE.MeshStandardMaterial({color:0x68736d,roughness:.9});
 for(const x of [-WIDTH/2-.045,WIDTH/2+.045]){const p=new THREE.Mesh(new THREE.BoxGeometry(.09,HEIGHT+.09,.12),frameMat);p.position.set(x,HEIGHT/2,.025);p.renderOrder=3;portal.add(p);}
 const top=new THREE.Mesh(new THREE.BoxGeometry(WIDTH+.18,.09,.12),frameMat);top.position.set(0,HEIGHT+.045,.025);top.renderOrder=3;portal.add(top);
 const sill=new THREE.Mesh(new THREE.BoxGeometry(WIDTH,.045,.16),frameMat);sill.position.set(0,.015,.03);sill.renderOrder=3;portal.add(sill);
 $('textures').textContent='Klingov kadar postavljen je na jednu kontinuiranu reljefnu površinu.';
}
function syncClip(){portal.updateMatrixWorld(true);inversePortal.copy(portal.matrixWorld).invert();clipUniforms.portalCamera.value.copy(camera.position).applyMatrix4(inversePortal);}
function place(){if(!ready)return;const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(),camera);const hit=new THREE.Vector3(),found=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),hit);if(!found||hit.distanceTo(camera.position)>5||hit.distanceTo(camera.position)<.5){$('status').textContent='Usmjeri sredinu kamere prema podu 1–3 m ispred sebe pa postavi otvor.';return;}portal.position.copy(hit);portal.rotation.set(0,Math.atan2(camera.position.x-hit.x,camera.position.z-hit.z),0);portal.visible=true;placed=true;syncClip();$('place').hidden=true;$('reset').hidden=false;$('status').textContent='Otvor postavljen. Pomakni se malo lijevo/desno i provjeri prostornu dubinu.';}
function fail(error){starting=false;$('intro').hidden=false;$('hud').hidden=true;$('start').disabled=false;$('start').textContent='Pokušaj ponovno';$('support').textContent='XR8 nije pokrenut: '+(error?.message||String(error));}
const pipeline={name:'isolated-pleistocene-portal-xr8-v11',onStart:async({canvas})=>{({scene,camera}=XR8.Threejs.xrScene());camera.position.set(0,1.4,0);XR8.XrController.updateCameraProjectionMatrix({origin:camera.position,facing:camera.quaternion});document.body.className='ar';$('intro').hidden=true;$('hud').hidden=false;$('place').disabled=true;$('status').textContent='Kamera radi. Učitavam slojeviti Kling prizor…';try{await build();}catch(e){fail(new Error('Učitavanje prizora: '+e.message));return;}ready=true;starting=false;$('place').disabled=false;$('status').textContent='Polako pogledaj oko sebe, naciljaj pod i postavi otvor.';canvas.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});},onUpdate:()=>{if(!ready)return;if(placed)syncClip();const now=performance.now();if(now-lastMetrics>500){lastMetrics=now;$('metrics').textContent='Sustav: XR8 SLAM · v11\nPrizor: Kling kontinuirani 2.5D reljef\nPoložaj: '+camera.position.toArray().map(x=>x.toFixed(2)).join(' / ')+'\nOtvor: '+(placed?'fiksiran':'čeka postavljanje');}},onException:fail};
async function start(){if(starting)return;starting=true;$('start').disabled=true;$('support').textContent='Pokrećem XR8 kameru…';try{XR8.XrController.configure({disableWorldTracking:false});XR8.addCameraPipelineModules([XR8.GlTextureRenderer.pipelineModule(),XR8.Threejs.pipelineModule(),XR8.XrController.pipelineModule(),LandingPage.pipelineModule(),XRExtras.FullWindowCanvas.pipelineModule(),XRExtras.Loading.pipelineModule(),XRExtras.RuntimeError.pipelineModule(),pipeline]);await XR8.run({canvas:$('camerafeed')});}catch(e){fail(e);}}
$('start').addEventListener('click',start);$('place').addEventListener('click',place);$('reset').addEventListener('click',()=>{portal.visible=false;placed=false;$('place').hidden=false;$('reset').hidden=true;$('status').textContent='Naciljaj novi položaj na podu pa postavi otvor.';});$('exit').addEventListener('click',()=>location.reload());function loaded(){if(window.XR8&&window.XRExtras&&window.LandingPage){$('start').disabled=false;$('start').textContent='Pokreni XR8 kameru';$('support').textContent='Otvori u Chromeu i dopusti kameru. Ova verzija ne traži ARCore.';}}window.addEventListener('xrloaded',loaded);loaded();setTimeout(()=>{if($('start').disabled&&!starting)$('support').textContent='XR8 se nije učitao. Provjeri vezu i osvježi stranicu.';},20000);
