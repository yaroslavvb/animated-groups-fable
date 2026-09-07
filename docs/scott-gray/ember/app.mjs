import {createRenderer, INITIAL_PHASE, LOOP_SECONDS} from './renderer.mjs';

const canvas = document.querySelector('#pattern');
const notice = document.querySelector('#notice');
const controls = document.querySelector('#controls');
const pauseButton = document.querySelector('#pause');
const fullscreenButton = document.querySelector('#fullscreen');
const params = new URLSearchParams(location.search);
let phase = INITIAL_PHASE;
if (params.has('phase') && Number.isFinite(Number(params.get('phase')))) phase = ((Number(params.get('phase')) % 1) + 1) % 1;
// Explicit play=1 can override a device's motion preference.
let playing = params.has('play') ? params.get('play') !== '0' : !matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer, field, frame = 0, lastTime = null, idleTimer, wakeLock;

function showControls() {
  document.body.classList.remove('quiet');
  clearTimeout(idleTimer);
  if (playing && renderer) idleTimer = setTimeout(() => {
    if (!controls.contains(document.activeElement)) document.body.classList.add('quiet');
  }, 2600);
}

function updatePause() {
  const label = playing ? 'Pause animation' : 'Play animation';
  pauseButton.setAttribute('aria-label', label);
  pauseButton.title = `${playing ? 'Pause' : 'Play'} · Space`;
  document.querySelector('#pause-icon').setAttribute('d', playing ? 'M8 5v14M16 5v14' : 'M8 4l12 8-12 8Z');
}

async function updateWakeLock() {
  const immersive = document.fullscreenElement || document.webkitFullscreenElement || navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const shouldHold = playing && !document.hidden && !!immersive;
  if (!shouldHold) { await wakeLock?.release().catch(() => {}); wakeLock = null; return; }
  if (!wakeLock && navigator.wakeLock) {
    try { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } catch { /* Optional: the animation still works. */ }
  }
}

function schedule() {
  cancelAnimationFrame(frame); frame = 0;
  if (!document.hidden && playing && renderer) frame = requestAnimationFrame(animate);
}

function animate(time) {
  frame = 0;
  if (!renderer || !playing || document.hidden) return;
  if (lastTime !== null) phase = (phase + (time - lastTime) / (1000 * LOOP_SECONDS)) % 1;
  lastTime = time;
  renderer.draw(phase);
  frame = requestAnimationFrame(animate);
}

function togglePause() {
  if (!renderer) return;
  playing = !playing; lastTime = null;
  updatePause(); showControls(); schedule(); updateWakeLock();
}

function fullscreenChanged() {
  const full = !!(document.fullscreenElement || document.webkitFullscreenElement);
  fullscreenButton.setAttribute('aria-label', full ? 'Exit fullscreen' : 'Enter fullscreen');
  document.querySelector('#fullscreen-label').textContent = full ? 'Exit fullscreen' : 'Fullscreen';
  document.querySelector('#fullscreen-icon').setAttribute('d', full ? 'M4 9h5V4m6 0v5h5M9 20v-5H4m11 5v-5h5' : 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5');
  renderer?.draw(phase); showControls(); updateWakeLock();
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.webkitFullscreenElement) document.webkitExitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else if (document.documentElement.webkitRequestFullscreen) document.documentElement.webkitRequestFullscreen();
    else {
      notice.textContent = 'This browser already fills the page. For an immersive view on iPhone, use Share → Add to Home Screen.';
      notice.hidden = false; setTimeout(() => { notice.hidden = true; }, 5500);
    }
  } catch {
    notice.textContent = 'Fullscreen could not open. Try opening this page in its own browser tab.';
    notice.hidden = false; setTimeout(() => { notice.hidden = true; }, 4500);
  }
  showControls();
}

pauseButton.addEventListener('click', event => { togglePause(); if (event.detail) pauseButton.blur(); });
fullscreenButton.addEventListener('click', event => { toggleFullscreen(); if (event.detail) fullscreenButton.blur(); });
canvas.addEventListener('dblclick', toggleFullscreen);
document.addEventListener('pointermove', showControls, {passive: true});
document.addEventListener('pointerdown', showControls, {passive: true});
document.addEventListener('focusin', showControls);
document.addEventListener('focusout', showControls);
document.addEventListener('keydown', event => {
  showControls();
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.code === 'Space' && event.target.tagName !== 'BUTTON') { event.preventDefault(); togglePause(); }
  if (event.key.toLowerCase() === 'f') { event.preventDefault(); toggleFullscreen(); }
});
document.addEventListener('fullscreenchange', fullscreenChanged);
document.addEventListener('webkitfullscreenchange', fullscreenChanged);
window.addEventListener('resize', () => renderer?.draw(phase));
document.addEventListener('visibilitychange', () => { lastTime = null; schedule(); updateWakeLock(); });
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault(); cancelAnimationFrame(frame); renderer = null;
  pauseButton.disabled = true;
  notice.textContent = 'Restoring the animation…'; notice.hidden = false; showControls();
});
canvas.addEventListener('webglcontextrestored', () => start());

function start() {
  try {
    renderer = createRenderer(canvas, field);
    renderer.draw(phase); lastTime = null;
    canvas.dataset.ready = 'true';
    notice.hidden = true; pauseButton.disabled = false; fullscreenButton.disabled = false;
    updatePause(); showControls(); schedule(); updateWakeLock();
  } catch (error) { notice.textContent = error.message; notice.hidden = false; }
}

try {
  const response = await fetch('./field.f32');
  if (!response.ok) throw new Error('The spiral lattice could not load. Please reload to try again.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== 10368) throw new Error('The pattern download is incomplete. Please reload.');
  const view = new DataView(bytes);
  field = Float32Array.from({length: bytes.byteLength / 4}, (_, i) => view.getFloat32(i * 4, true));
  start();
} catch (error) { notice.textContent = error.message; }
