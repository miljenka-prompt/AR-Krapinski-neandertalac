import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js'

window.THREE = THREE

const PACKED_URL = '/QInspired-WebAR-Tracking-Test/neanderthal-packed.mp4?rev=20260913-frame-lock-1'
const ENVIRONMENT_URL = './assets/krapina-neandertalac-15s.mp4?v=20260911'
const params = new URLSearchParams(location.search)
const lang = params.get('lang') === 'en' || (!params.get('lang') && localStorage.getItem('krapinaLang') === 'en') ? 'en' : 'hr'
const mode = params.get('mode') === 'visitor' ? 'visitor' : 'scientific'
const COPY = {
  hr: {
    page: 'Krapinski neandertalac · Okoliš u stvarnom prostoru', title: 'Krapinski neandertalac u okolišu Hušnjakova', mode: 'BETA · HUŠNJAKOVO U PROSTORU', back: '← Glavni demo',
    place: 'Usmjeri kameru prema podu i dodirni mjesto za prizor.', placed: 'Prizor je postavljen. Dodirni drugdje za novo mjesto.', hint: 'Dodirni pod gdje želiš postaviti prizor',
    replace: 'Postavi ponovno', play: 'Pokreni prizor i zvuk', pause: 'Pauziraj prizor', blocked: 'Preglednik je blokirao reprodukciju. Dodirni tipku ponovno.', error: 'Prizor se nije učitao. Osvježi stranicu i pokušaj ponovno.',
  },
  en: {
    page: 'Krapina Neanderthal · Environment in real space', title: 'Krapina Neanderthal in the Hušnjakovo environment', mode: 'BETA · HUŠNJAKOVO IN REAL SPACE', back: '← Main demo',
    place: 'Aim the camera at the floor and tap where you want the scene.', placed: 'Scene placed. Tap elsewhere to move it.', hint: 'Tap the floor to place the scene',
    replace: 'Place again', play: 'Start scene and sound', pause: 'Pause scene', blocked: 'Playback was blocked. Tap the button again.', error: 'The scene did not load. Refresh the page and try again.',
  },
}
const copy = COPY[lang]

let world = null
let figure = null
let packedVideo = null
let sourceVideo = null
let xrCamera = null
let rearVegetation = null
let statusTimer = null
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const PLACEMENT_DISTANCE = 2.05
const $ = (id) => document.getElementById(id)

function media(src, muted = true) {
  const el = document.createElement('video')
  el.src = src
  el.loop = true
  el.muted = muted
  el.playsInline = true
  el.setAttribute('playsinline', '')
  el.setAttribute('webkit-playsinline', '')
  el.preload = 'auto'
  el.crossOrigin = 'anonymous'
  return el
}

function setStatus(text, autoHideMs = 0) {
  const status = $('status')
  const card = document.querySelector('.status-card')
  if (!status || !card) return
  if (statusTimer) clearTimeout(statusTimer)
  status.textContent = text
  card.classList.remove('is-hidden')
  if (autoHideMs > 0) statusTimer = setTimeout(() => card.classList.add('is-hidden'), autoHideMs)
}

function cropTexture(video, crop, size = 512, mirrorTile = false) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const sx = crop.x * video.videoWidth
  const sy = crop.y * video.videoHeight
  const sw = crop.w * video.videoWidth
  const sh = crop.h * video.videoHeight
  if (!mirrorTile) {
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, size, size)
  } else {
    for (let y = 0; y < 2; y += 1) for (let x = 0; x < 2; x += 1) {
      ctx.save()
      ctx.translate((x + (x ? 1 : 0)) * size / 2, (y + (y ? 1 : 0)) * size / 2)
      ctx.scale(x ? -1 : 1, y ? -1 : 1)
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, size / 2, size / 2)
      ctx.restore()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function featheredMaterial(map, opacity, vertical = false) {
  return new THREE.ShaderMaterial({
    uniforms: {map: {value: map}, opacity: {value: opacity}, vertical: {value: vertical ? 1 : 0}},
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform sampler2D map;uniform float opacity;uniform float vertical;varying vec2 vUv;void main(){vec4 c=texture2D(map,vUv);vec2 d=(vUv-.5)/.5;float n=sin(vUv.x*31.)*sin(vUv.y*27.)*.055+sin((vUv.x+vUv.y)*19.)*.04;float radial=1.-smoothstep(.48+n,.92+n,length(d));float rise=mix(1.,smoothstep(0.,.22,vUv.y),vertical);float a=opacity*radial*rise;if(a<.025)discard;gl_FragColor=vec4(c.rgb,a);}',
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  })
}

function vegetationMaterial(map, opacity) {
  return new THREE.ShaderMaterial({
    uniforms: {map: {value: map}, opacity: {value: opacity}},
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform sampler2D map;uniform float opacity;varying vec2 vUv;void main(){vec4 c=texture2D(map,vUv);vec2 d=(vUv-.5)/.5;float radial=1.-smoothstep(.55,.95,length(d));float green=c.g-max(c.r,c.b)*.78;float foliage=smoothstep(.03,.19,green);float a=opacity*radial*foliage;if(a<.025)discard;gl_FragColor=vec4(c.rgb,a);}',
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  })
}

function packedMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: {packedMap: {value: map}},
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform sampler2D packedMap;varying vec2 vUv;void main(){vec4 c=texture2D(packedMap,vec2(vUv.x*.5,vUv.y));float m=texture2D(packedMap,vec2(.5+vUv.x*.5,vUv.y)).r;float a=smoothstep(.045,1.,m*1.22);float hi=max(c.r,max(c.g,c.b));float lo=min(c.r,min(c.g,c.b));float lum=dot(c.rgb,vec3(.299,.587,.114));vec2 q=vec2((vUv.x-.69)/.14,(vUv.y-.12)/.11);float zone=1.-smoothstep(.65,1.,length(q));float pale=smoothstep(.58,.82,lum)*(1.-smoothstep(.08,.24,hi-lo));a*=1.-zone*pale;if(a<.01)discard;gl_FragColor=vec4(c.rgb,a);}',
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  })
}

function buildEnvironment() {
  const groundMap = cropTexture(sourceVideo, {x: .58, y: .56, w: .40, h: .40}, 512, false)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), featheredMaterial(groundMap, .58))
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -.025
  ground.renderOrder = 1
  world.add(ground)

  const vegetationMap = cropTexture(sourceVideo, {x: 0, y: .02, w: .25, h: .72}, 512, false)
  const leftVegetation = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.0), vegetationMaterial(vegetationMap, .78))
  leftVegetation.position.set(-1.35, .82, -.95)
  leftVegetation.rotation.y = .28
  leftVegetation.renderOrder = 2
  world.add(leftVegetation)

  const backVegetation = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.85), vegetationMaterial(vegetationMap, .62))
  backVegetation.position.set(.9, .76, -1.5)
  backVegetation.rotation.y = -.38
  backVegetation.renderOrder = 2
  world.add(backVegetation)

  const rearMap = cropTexture(sourceVideo, {x: 0, y: .02, w: .20, h: .72}, 640, true)
  rearVegetation = new THREE.Mesh(new THREE.PlaneGeometry(5.05, 3.05), vegetationMaterial(rearMap, .82))
  rearVegetation.position.set(-.2, 1.48, -.42)
  rearVegetation.renderOrder = 3
  world.add(rearVegetation)

}

function build(scene) {
  world = new THREE.Group()
  world.visible = false
  scene.add(world)

  packedVideo = media(PACKED_URL, false)
  sourceVideo = media(ENVIRONMENT_URL, true)
  const packedTexture = new THREE.VideoTexture(packedVideo)
  packedTexture.colorSpace = THREE.SRGBColorSpace
  packedTexture.minFilter = THREE.LinearFilter
  packedTexture.magFilter = THREE.LinearFilter
  packedTexture.generateMipmaps = false

  figure = new THREE.Mesh(new THREE.PlaneGeometry(4.65, 2.62), packedMaterial(packedTexture))
  figure.position.set(-.2, 1.31, -.25)
  figure.renderOrder = 4
  world.add(figure)

  sourceVideo.addEventListener('loadedmetadata', () => { sourceVideo.currentTime = .4 }, {once: true})
  sourceVideo.addEventListener('seeked', buildEnvironment, {once: true})
  packedVideo.addEventListener('error', () => setStatus(copy.error))
  sourceVideo.addEventListener('error', () => setStatus(copy.error))
  setStatus(copy.place)
}

function placeAt(clientX, clientY, canvas) {
  if (!world || !xrCamera) return
  const rect = canvas.getBoundingClientRect()
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, xrCamera)
  const hit = new THREE.Vector3()
  if (!raycaster.ray.intersectPlane(floorPlane, hit)) return
  const dx = hit.x - xrCamera.position.x
  const dz = hit.z - xrCamera.position.z
  const distance = Math.hypot(dx, dz)
  if (distance > .01) {
    hit.x = xrCamera.position.x + (dx / distance) * PLACEMENT_DISTANCE
    hit.z = xrCamera.position.z + (dz / distance) * PLACEMENT_DISTANCE
  } else {
    const facing = new THREE.Vector3(0, 0, -1).applyQuaternion(xrCamera.quaternion)
    facing.y = 0
    facing.normalize()
    hit.x = xrCamera.position.x + facing.x * PLACEMENT_DISTANCE
    hit.z = xrCamera.position.z + facing.z * PLACEMENT_DISTANCE
  }
  world.position.copy(hit)
  world.visible = true
  $('placement-hint')?.classList.add('is-hidden')
  setStatus(copy.placed, 1600)
}

const module = () => ({
  name: 'krapina-environment-v2',
  onStart: ({canvas}) => {
    const {scene, camera} = XR8.Threejs.xrScene()
    xrCamera = camera
    build(scene)
    camera.position.set(0, 1.6, 2.5)
    XR8.XrController.updateCameraProjectionMatrix({origin: camera.position, facing: camera.quaternion})
    canvas.addEventListener('touchmove', (event) => event.preventDefault(), {passive: false})
    canvas.addEventListener('pointerup', (event) => { if (event.target === canvas) placeAt(event.clientX, event.clientY, canvas) })
  },
  onUpdate: () => {
    if (!figure || !xrCamera) return
    const localCamera = world.worldToLocal(xrCamera.position.clone())
    figure.lookAt(localCamera)
    figure.rotation.z = 0
    const bottom = new THREE.Vector3(0, -1.31, 0).applyQuaternion(figure.quaternion)
    figure.position.y = .018 - bottom.y
    if (rearVegetation) {
      rearVegetation.quaternion.copy(figure.quaternion)
      const behind = new THREE.Vector3(0, .12, -.13).applyQuaternion(figure.quaternion)
      rearVegetation.position.copy(figure.position).add(behind)
    }
  },
})

function start() {
  XR8.addCameraPipelineModules([XR8.GlTextureRenderer.pipelineModule(), XR8.Threejs.pipelineModule(), XR8.XrController.pipelineModule(), LandingPage.pipelineModule(), XRExtras.FullWindowCanvas.pipelineModule(), XRExtras.Loading.pipelineModule(), XRExtras.RuntimeError.pipelineModule(), module()])
  XR8.run({canvas: $('camerafeed')})
  $('replace').addEventListener('click', () => {
    packedVideo?.pause()
    if (packedVideo) packedVideo.currentTime = 0
    XR8.XrController.recenter()
    world.visible = false
    $('placement-hint').classList.remove('is-hidden')
    $('video-toggle').textContent = copy.play
    setStatus(copy.place)
  })
  $('video-toggle').addEventListener('click', async () => {
    try {
      if (packedVideo.paused) { await packedVideo.play(); $('video-toggle').textContent = copy.pause }
      else { packedVideo.pause(); $('video-toggle').textContent = copy.play }
    } catch { setStatus(copy.blocked) }
  })
}

document.documentElement.lang = lang
document.title = copy.page
$('scene-title').textContent = copy.title
$('mode-label').textContent = copy.mode
$('back-link').textContent = copy.back
$('back-link').href = `./?lang=${lang}&mode=${mode}`
$('status').textContent = copy.place
$('placement-hint').textContent = copy.hint
$('replace').textContent = copy.replace
$('video-toggle').textContent = copy.play

window.XR8 ? start() : window.addEventListener('xrloaded', start)
