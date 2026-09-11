const $ = (id) => document.getElementById(id);
const video = $('storyVideo');
const arVideo = $('arVideo');
const cameraFeed = $('cameraFeed');
const state = { stream: null, ar: false, x: 0, y: 0, scale: 1, dragging: false, dragX: 0, dragY: 0, startX: 0, startY: 0, pinchStart: null, pinchScale: 1 };

const icon = (button, name) => button.querySelector('use').setAttribute('href', `#i-${name}`);
const timeText = (seconds) => `0:${String(Math.floor(Number.isFinite(seconds) ? seconds : 0)).padStart(2, '0')}`;
const status = (message = '') => { $('status').textContent = message; };

function updatePlayback(target = video, prefix = '') {
  const paused = target.paused || target.ended;
  const button = $(prefix ? 'arPlay' : 'playButton');
  icon(button, paused ? 'play' : 'pause');
  button.setAttribute('aria-label', paused ? (target.ended ? 'Ponovi prizor' : 'Pokreni prizor') : 'Pauziraj prizor');
  if (!prefix) {
    $('bigPlay').hidden = !paused;
    $('bigPlay').querySelector('span').textContent = target.ended ? 'Ponovi prizor' : target.currentTime > 0 ? 'Nastavi prizor' : 'Otvori vrijeme';
  }
}

function updateTime() {
  const duration = Number.isFinite(video.duration) ? video.duration : 15.04;
  $('seek').max = duration;
  $('seek').value = video.currentTime;
  $('time').textContent = `${timeText(video.currentTime)} / ${timeText(duration)}`;
}

async function play(target = video, fromStart = false) {
  if (fromStart || target.ended) target.currentTime = 0;
  try { await target.play(); status(''); }
  catch (error) { if (!state.ar) status('Dodirnite tipku za reprodukciju da biste pokrenuli snimku.'); }
  updatePlayback(target, target === arVideo ? 'ar' : '');
}

function toggle(target) { if (target.paused || target.ended) void play(target); else target.pause(); }
function setMuted(target, muted) {
  target.muted = muted;
  const button = target === arVideo ? $('arSound') : $('soundButton');
  icon(button, muted ? 'mute' : 'sound');
  button.setAttribute('aria-pressed', String(!muted));
  button.setAttribute('aria-label', muted ? 'Uključi zvuk' : 'Isključi zvuk');
}

$('playButton').addEventListener('click', () => toggle(video));
$('bigPlay').addEventListener('click', () => toggle(video));
$('replay').addEventListener('click', () => void play(video, true));
$('soundButton').addEventListener('click', () => setMuted(video, !video.muted));
$('seek').addEventListener('input', (event) => { video.currentTime = Number(event.target.value); updateTime(); });
video.addEventListener('timeupdate', updateTime);
video.addEventListener('loadedmetadata', updateTime);
['play','pause','ended'].forEach((event) => video.addEventListener(event, () => updatePlayback(video)));
video.addEventListener('waiting', () => { $('loading').hidden = false; });
['playing','canplay','pause','error'].forEach((event) => video.addEventListener(event, () => { $('loading').hidden = true; }));
video.addEventListener('error', () => status('Snimka se nije učitala. Pokušajte ponovno ili je otvorite zasebno.'));

$('aboutButton').addEventListener('click', () => $('aboutPanel').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'}));
$('fullscreenButton').addEventListener('click', async () => {
  document.body.classList.toggle('expanded');
  if (document.body.classList.contains('expanded')) {
    if ($('experience').requestFullscreen) await $('experience').requestFullscreen().catch(() => {});
  } else if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
});
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) document.body.classList.remove('expanded'); });

function cameraPolicyBlocked() {
  const policy = document.permissionsPolicy || document.featurePolicy;
  return !!policy?.allowsFeature && !policy.allowsFeature('camera');
}

async function enterAR() {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || cameraPolicyBlocked()) {
    status('Kamera nije dostupna u ovom prikazu. Otvorite poveznicu u Chromeu ili Safariju i dopustite pristup kameri.');
    return;
  }
  $('enterAR').disabled = true;
  status('Dopustite pristup kameri kada vas preglednik pita.');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
    state.stream = stream;
    cameraFeed.srcObject = stream;
    cameraFeed.hidden = false;
    await cameraFeed.play();
    video.pause();
    video.currentTime = 0;
    state.ar = true;
    state.x = 0; state.y = 0; state.scale = 1;
    applyPortal();
    $('portalScale').value = 1;
    document.body.classList.add('ar-active');
    $('arMode').hidden = false;
    setMuted(arVideo, video.muted);
    arVideo.currentTime = 0;
    await play(arVideo, true);
    status('');
  } catch (error) {
    status(error?.name === 'NotAllowedError' ? 'Kamera nije dopuštena. Omogućite pristup kameri u postavkama preglednika.' : 'Kameru nije moguće pokrenuti u ovom prikazu. Pokušajte otvoriti poveznicu izravno u pregledniku.');
  } finally { $('enterAR').disabled = false; }
}

function exitAR() {
  state.ar = false;
  arVideo.pause();
  if (state.stream) state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
  cameraFeed.srcObject = null;
  cameraFeed.hidden = true;
  $('arMode').hidden = true;
  document.body.classList.remove('ar-active');
}

$('enterAR').addEventListener('click', () => void enterAR());
$('exitAR').addEventListener('click', exitAR);
$('arPlay').addEventListener('click', () => toggle(arVideo));
$('arReplay').addEventListener('click', () => void play(arVideo, true));
$('arSound').addEventListener('click', () => setMuted(arVideo, !arVideo.muted));
['play','pause','ended'].forEach((event) => arVideo.addEventListener(event, () => updatePlayback(arVideo, 'ar')));

document.addEventListener('visibilitychange', () => { if (document.hidden && state.ar) exitAR(); });
window.addEventListener('pagehide', () => { if (state.stream) state.stream.getTracks().forEach((track) => track.stop()); });

function applyPortal() {
  document.documentElement.style.setProperty('--portal-x', `${state.x}px`);
  document.documentElement.style.setProperty('--portal-y', `${state.y}px`);
  document.documentElement.style.setProperty('--portal-scale', state.scale);
}
$('portalScale').addEventListener('input', (event) => { state.scale = Number(event.target.value); applyPortal(); });

const portal = $('portal');
portal.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch' && event.isPrimary === false) return;
  state.dragging = true; state.dragX = event.clientX; state.dragY = event.clientY; state.startX = state.x; state.startY = state.y;
  portal.setPointerCapture?.(event.pointerId);
});
portal.addEventListener('pointermove', (event) => {
  if (!state.dragging) return;
  state.x = state.startX + event.clientX - state.dragX;
  state.y = state.startY + event.clientY - state.dragY;
  applyPortal();
});
['pointerup','pointercancel'].forEach((eventName) => portal.addEventListener(eventName, () => { state.dragging = false; }));

portal.addEventListener('touchstart', (event) => {
  if (event.touches.length === 2) {
    const [a,b] = event.touches;
    state.pinchStart = Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
    state.pinchScale = state.scale;
  }
},{passive:true});
portal.addEventListener('touchmove', (event) => {
  if (event.touches.length === 2 && state.pinchStart) {
    const [a,b] = event.touches;
    const distance = Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
    state.scale = Math.min(1.45,Math.max(.55,state.pinchScale * distance/state.pinchStart));
    $('portalScale').value = state.scale;
    applyPortal();
  }
},{passive:true});
portal.addEventListener('touchend', () => { state.pinchStart = null; },{passive:true});

video.muted = true;
arVideo.muted = true;
updatePlayback(video);
updatePlayback(arVideo,'ar');
