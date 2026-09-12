import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js'

window.THREE = THREE

const VIDEO_URL = './Krapinski_neandertalac.mp4?v=20260912c'
const MASK_URL = '/QInspired-WebAR-Tracking-Test/neanderthal-mask.mp4?v=20260912c'

let rgbVideo = null
let maskVideo = null
let figure = null
let shadow = null
let xrCamera = null
let statusTimer = null

const $ = (id) => document.getElementById(id)

function setStatus(text, autoHideMs = 0) {
  const el = $('status')
  const card = document.querySelector('.status-card')
  if (!el || !card) return
  if (statusTimer) clearTimeout(statusTimer)
  el.textContent = text
  card.classList.remove('is-hidden')
  if (autoHideMs > 0) {
    statusTimer = setTimeout(() => card.classList.add('is-hidden'), autoHideMs)
  }
}

function makeVideo(src, muted = true) {
  const video = document.createElement('video')
  video.src = src
  video.loop = true
  video.muted = muted
  video.playsInline = true
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
  video.preload = 'auto'
  video.crossOrigin = 'anonymous'
  return video
}

function softShadowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(128, 64, 8, 128, 64, 120)
  g.addColorStop(0, 'rgba(0,0,0,.34)')
  g.addColorStop(.45, 'rgba(0,0,0,.14)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 128)
  return new THREE.CanvasTexture(canvas)
}

function alphaMaterial(rgbMap, maskMap) {
  return new THREE.ShaderMaterial({
    uniforms: {
      rgbMap: {value: rgbMap},
      maskMap: {value: maskMap},
      alphaGain: {value: 1.22},
      alphaFloor: {value: 0.045},
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D rgbMap;
      uniform sampler2D maskMap;
      uniform float alphaGain;
      uniform float alphaFloor;
      varying vec2 vUv;
      void main(){
        vec4 rgb = texture2D(rgbMap, vUv);
        float m = texture2D(maskMap, vUv).r;
        float a = smoothstep(alphaFloor, 1.0, m * alphaGain);
        if (a < 0.01) discard;
        gl_FragColor = vec4(rgb.rgb, a);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  })
}

function syncVideos() {
  if (!rgbVideo || !maskVideo) return
  if (Math.abs(rgbVideo.currentTime - maskVideo.currentTime) > 0.035) {
    maskVideo.currentTime = rgbVideo.currentTime
  }
}

async function playBoth() {
  if (!rgbVideo || !maskVideo) return false
  maskVideo.currentTime = rgbVideo.currentTime
  await Promise.all([rgbVideo.play(), maskVideo.play()])
  return true
}

function pauseBoth() {
  rgbVideo?.pause()
  maskVideo?.pause()
}

function buildFigure(scene) {
  rgbVideo = makeVideo(VIDEO_URL, true)
  maskVideo = makeVideo(MASK_URL, true)

  const rgbTexture = new THREE.VideoTexture(rgbVideo)
  rgbTexture.colorSpace = THREE.SRGBColorSpace
  rgbTexture.minFilter = THREE.LinearFilter
  rgbTexture.magFilter = THREE.LinearFilter
  rgbTexture.generateMipmaps = false

  const maskTexture = new THREE.VideoTexture(maskVideo)
  maskTexture.colorSpace = THREE.NoColorSpace
  maskTexture.minFilter = THREE.LinearFilter
  maskTexture.magFilter = THREE.LinearFilter
  maskTexture.generateMipmaps = false

  const targetHeight = 1.75
  figure = new THREE.Mesh(new THREE.PlaneGeometry(3.1, targetHeight), alphaMaterial(rgbTexture, maskTexture))
  figure.position.set(0, targetHeight / 2, -1.5)
  figure.renderOrder = 2
  scene.add(figure)

  shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, .75),
    new THREE.MeshBasicMaterial({map: softShadowTexture(), transparent: true, depthWrite: false, toneMapped: false})
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.set(0, .012, -1.5)
  scene.add(shadow)

  let rgbReady = false
  let maskReady = false
  const ready = () => {
    if (!rgbReady || !maskReady) return
    const aspect = rgbVideo.videoWidth / rgbVideo.videoHeight
    const width = targetHeight * aspect
    figure.geometry.dispose()
    figure.geometry = new THREE.PlaneGeometry(width, targetHeight)
    shadow.geometry.dispose()
    shadow.geometry = new THREE.PlaneGeometry(Math.max(1.4, width * .55), .75)

    setStatus('Pomakni se oko prizora. Ako izgubiš lik, dodirni “Ponovno usidri”.', 5200)
    playBoth().then(() => {
      $('video-toggle').textContent = 'Pauziraj prizor'
    }).catch(() => {
      setStatus('Dodirni “Pokreni prizor”.', 4200)
    })
  }

  rgbVideo.addEventListener('loadedmetadata', () => { rgbReady = true; ready() })
  maskVideo.addEventListener('loadedmetadata', () => { maskReady = true; ready() })
  const error = () => setStatus('Prizor se nije učitao. Osvježi stranicu i pokušaj ponovno.')
  rgbVideo.addEventListener('error', error)
  maskVideo.addEventListener('error', error)
}

const spatialModule = () => ({
  name: 'krapina-spatial-chronovisor-v2',
  onStart: ({canvas}) => {
    const {scene, camera} = XR8.Threejs.xrScene()
    xrCamera = camera
    buildFigure(scene)
    camera.position.set(0, 1.6, 2.5)
    XR8.XrController.updateCameraProjectionMatrix({origin: camera.position, facing: camera.quaternion})
    canvas.addEventListener('touchmove', (event) => event.preventDefault(), {passive: false})
    setStatus('Uspostavljam prostorni prikaz…')
  },
  onUpdate: () => {
    if (!figure || !xrCamera) return
    syncVideos()
    const dx = xrCamera.position.x - figure.position.x
    const dz = xrCamera.position.z - figure.position.z
    figure.rotation.y = Math.atan2(dx, dz)
  },
})

function start() {
  XR8.addCameraPipelineModules([
    XR8.GlTextureRenderer.pipelineModule(),
    XR8.Threejs.pipelineModule(),
    XR8.XrController.pipelineModule(),
    LandingPage.pipelineModule(),
    XRExtras.FullWindowCanvas.pipelineModule(),
    XRExtras.Loading.pipelineModule(),
    XRExtras.RuntimeError.pipelineModule(),
    spatialModule(),
  ])

  XR8.run({canvas: $('camerafeed')})

  $('recenter')?.addEventListener('click', () => {
    XR8.XrController.recenter()
    setStatus('Prizor je ponovno usidren.', 2600)
  })

  $('video-toggle')?.addEventListener('click', async () => {
    try {
      if (rgbVideo?.paused) {
        await playBoth()
        $('video-toggle').textContent = 'Pauziraj prizor'
      } else {
        pauseBoth()
        $('video-toggle').textContent = 'Pokreni prizor'
      }
    } catch {
      setStatus('Preglednik je blokirao reprodukciju. Dodirni tipku ponovno.')
    }
  })

  $('sound-toggle')?.addEventListener('click', () => {
    if (!rgbVideo) return
    rgbVideo.muted = !rgbVideo.muted
    const on = !rgbVideo.muted
    $('sound-toggle').textContent = on ? 'Isključi zvuk' : 'Uključi zvuk'
    $('sound-toggle').setAttribute('aria-pressed', String(on))
  })
}

window.XR8 ? start() : window.addEventListener('xrloaded', start)
