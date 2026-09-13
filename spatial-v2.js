import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js'

window.THREE = THREE

const params = new URLSearchParams(location.search)
const lang = params.get('lang') === 'en' ? 'en' : 'hr'
const mode = params.get('mode') === 'visitor' ? 'visitor' : 'scientific'
localStorage.setItem('krapinaLang', lang)
localStorage.setItem('krapinaMode', mode)

document.documentElement.lang = lang

const t = lang === 'en' ? {
  title: 'KRAPINA · SPATIAL CHRONOVISOR',
  site: 'Hušnjakovo Hill · c. 125–130 ka',
  back: '← Chronovisor',
  backAria: 'Back to the main chronovisor',
  starting: 'Starting spatial view…',
  ready: 'Move around the scene. If you lose the figure, tap “Re-anchor”.',
  recenter: 'Re-anchor',
  recentered: 'Scene re-anchored.',
  play: 'Play scene',
  pause: 'Pause scene',
  soundOn: 'Turn sound on',
  soundOff: 'Turn sound off',
  tapPlay: 'Tap “Play scene”.',
  blocked: 'The browser blocked playback. Tap the button again.',
  error: 'The scene did not load. Refresh the page and try again.',
  pageTitle: 'Krapina Neanderthal · Spatial chronovisor',
} : {
  title: 'KRAPINA · PROSTORNI KRONOVIZOR',
  site: 'Hušnjakovo brdo · cca 125–130 ka',
  back: '← Kronovizor',
  backAria: 'Povratak na glavni kronovizor',
  starting: 'Uspostavljam prostorni prikaz…',
  ready: 'Pomakni se oko prizora. Ako izgubiš lik, dodirni “Ponovno usidri”.',
  recenter: 'Ponovno usidri',
  recentered: 'Prizor je ponovno usidren.',
  play: 'Pokreni prizor',
  pause: 'Pauziraj prizor',
  soundOn: 'Uključi zvuk',
  soundOff: 'Isključi zvuk',
  tapPlay: 'Dodirni “Pokreni prizor”.',
  blocked: 'Preglednik je blokirao reprodukciju. Dodirni tipku ponovno.',
  error: 'Prizor se nije učitao. Osvježi stranicu i pokušaj ponovno.',
  pageTitle: 'Krapinski neandertalac · Prostorni kronovizor',
}

document.title = t.pageTitle

const PACKED_URL = `/QInspired-WebAR-Tracking-Test/neanderthal-packed.mp4?rev=20260913-frame-lock-1`

let packedVideo = null
let figure = null
let shadow = null
let xrCamera = null
let statusTimer = null

const $ = (id) => document.getElementById(id)

function localizeHud() {
  const back = $('backLink')
  if (back) {
    back.textContent = t.back
    back.setAttribute('aria-label', t.backAria)
    back.href = `./?lang=${lang}&mode=${mode}`
  }
  if ($('spatialTitle')) $('spatialTitle').textContent = t.title
  if ($('siteLabel')) $('siteLabel').textContent = t.site
  if ($('recenter')) $('recenter').textContent = t.recenter
  if ($('video-toggle')) $('video-toggle').textContent = t.play
  if ($('sound-toggle')) $('sound-toggle').textContent = t.soundOn
}

function setStatus(text, autoHideMs = 0) {
  const el = $('status')
  const card = document.querySelector('.status-card')
  if (!el || !card) return
  if (statusTimer) clearTimeout(statusTimer)
  el.textContent = text
  card.classList.remove('is-hidden')
  if (autoHideMs > 0) statusTimer = setTimeout(() => card.classList.add('is-hidden'), autoHideMs)
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

function packedAlphaMaterial(packedMap) {
  return new THREE.ShaderMaterial({
    uniforms: {
      packedMap: {value: packedMap},
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
      uniform sampler2D packedMap;
      uniform float alphaGain;
      uniform float alphaFloor;
      varying vec2 vUv;
      void main(){
        vec2 rgbUv = vec2(vUv.x * 0.5, vUv.y);
        vec2 maskUv = vec2(0.5 + vUv.x * 0.5, vUv.y);
        vec4 rgb = texture2D(packedMap, rgbUv);
        float m = texture2D(packedMap, maskUv).r;
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

async function playScene() {
  if (!packedVideo) return false
  await packedVideo.play()
  return true
}

function pauseScene() {
  packedVideo?.pause()
}

function buildFigure(scene) {
  packedVideo = makeVideo(PACKED_URL, true)

  const packedTexture = new THREE.VideoTexture(packedVideo)
  packedTexture.colorSpace = THREE.SRGBColorSpace
  packedTexture.minFilter = THREE.LinearFilter
  packedTexture.magFilter = THREE.LinearFilter
  packedTexture.generateMipmaps = false

  const targetHeight = 1.75
  figure = new THREE.Mesh(new THREE.PlaneGeometry(3.1, targetHeight), packedAlphaMaterial(packedTexture))
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

  packedVideo.addEventListener('loadedmetadata', () => {
    const sourceAspect = (packedVideo.videoWidth * 0.5) / packedVideo.videoHeight
    const width = targetHeight * sourceAspect
    figure.geometry.dispose()
    figure.geometry = new THREE.PlaneGeometry(width, targetHeight)
    shadow.geometry.dispose()
    shadow.geometry = new THREE.PlaneGeometry(Math.max(1.4, width * .55), .75)

    setStatus(t.ready, 5200)
    playScene().then(() => {
      $('video-toggle').textContent = t.pause
    }).catch(() => {
      setStatus(t.tapPlay, 4200)
    })
  })

  packedVideo.addEventListener('error', () => setStatus(t.error))
}

const spatialModule = () => ({
  name: 'krapina-spatial-chronovisor-v3-frame-locked',
  onStart: ({canvas}) => {
    const {scene, camera} = XR8.Threejs.xrScene()
    xrCamera = camera
    buildFigure(scene)
    camera.position.set(0, 1.6, 2.5)
    XR8.XrController.updateCameraProjectionMatrix({origin: camera.position, facing: camera.quaternion})
    canvas.addEventListener('touchmove', (event) => event.preventDefault(), {passive: false})
    setStatus(t.starting)
  },
  onUpdate: () => {
    if (!figure || !xrCamera) return
    const dx = xrCamera.position.x - figure.position.x
    const dz = xrCamera.position.z - figure.position.z
    figure.rotation.y = Math.atan2(dx, dz)
  },
})

function start() {
  localizeHud()

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
    setStatus(t.recentered, 2600)
  })

  $('video-toggle')?.addEventListener('click', async () => {
    try {
      if (packedVideo?.paused) {
        await playScene()
        $('video-toggle').textContent = t.pause
      } else {
        pauseScene()
        $('video-toggle').textContent = t.play
      }
    } catch {
      setStatus(t.blocked)
    }
  })

  $('sound-toggle')?.addEventListener('click', () => {
    if (!packedVideo) return
    packedVideo.muted = !packedVideo.muted
    const on = !packedVideo.muted
    $('sound-toggle').textContent = on ? t.soundOff : t.soundOn
    $('sound-toggle').setAttribute('aria-pressed', String(on))
  })
}

localizeHud()
window.XR8 ? start() : window.addEventListener('xrloaded', start)
