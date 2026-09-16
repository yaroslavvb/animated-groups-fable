import {createRenderer, createView, FIELD_BYTES, INITIAL_PHASE, LOOP_SECONDS, MAX_SCALE, MIN_SCALE, scaleFor, wrap} from './renderer.mjs';

const canvas = document.querySelector('#pattern');
const notice = document.querySelector('#notice');
const controls = document.querySelector('#controls');
const nameLabel = document.querySelector('#controls .name');
const pauseButton = document.querySelector('#pause');
const fullscreenButton = document.querySelector('#fullscreen');
const resetButton = document.querySelector('#reset');
const stats = document.querySelector('#stats');
const params = new URLSearchParams(location.search);
const number = (name, low, high) => {
  if (!params.has(name)) return null;
  const value = Number(params.get(name));
  return Number.isFinite(value) && value >= low && value <= high ? value : null;
};
let phase = params.has('phase') && Number.isFinite(Number(params.get('phase'))) ? wrap(Number(params.get('phase'))) : INITIAL_PHASE;
// Explicit play=1 can override a device's motion preference.
let playing = params.has('play') ? params.get('play') !== '0' : !matchMedia('(prefers-reduced-motion: reduce)').matches;
// The page picks the style: data-style="monochrome" on the canvas, else ember.
const style = canvas.dataset.style || 'ember';
// dpr=<ratio> pins the render resolution and turns adaptive resolution off.
const pixelRatio = number('dpr', 0.25, 4);
// Zooming out stops where one texel of the 96-node grid spans one device pixel.
const minScale = Math.max(MIN_SCALE, 64 / (devicePixelRatio || 1));
// scale=<CSS pixels per lattice length> fixes the initial scale; x=&y= place a lattice point at the centre.
const view = createView({tilePixels: number('scale', minScale, MAX_SCALE) ?? scaleFor, center: [number('x', -1e9, 1e9) ?? 1, number('y', -1e9, 1e9) ?? 1], minScale});
let showStats = params.get('stats') === '1';
let renderer, field, scheduled = false, dirty = false, lastTime = null, idleTimer, wakeLock;

// While the pattern downloads, idle animation frames reveal the display's
// frame interval, so adaptive resolution starts out knowing the target cadence.
const cadence = [];
let cadenceLast = null;
function measureCadence(time) {
  if (cadenceLast !== null && time - cadenceLast > 2 && time - cadenceLast < 200) cadence.push(time - cadenceLast);
  cadenceLast = time;
  if (cadence.length < 40 && !renderer) requestAnimationFrame(measureCadence);
}
requestAnimationFrame(measureCadence);
const displayInterval = () => cadence.length >= 12 ? cadence.slice().sort((a, b) => a - b)[Math.floor(cadence.length * 0.2)] : null;

const size = () => [canvas.clientWidth, canvas.clientHeight];

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

function updateReset() { resetButton.hidden = view.isHome(); }

async function updateWakeLock() {
  const immersive = document.fullscreenElement || document.webkitFullscreenElement || navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const shouldHold = playing && !document.hidden && !!immersive;
  if (!shouldHold) { await wakeLock?.release().catch(() => {}); wakeLock = null; return; }
  if (!wakeLock && navigator.wakeLock) {
    try { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } catch { /* Optional: the animation still works. */ }
  }
}

// One animation loop serves playback, inertial panning and on-demand redraws.
function requestDraw() {
  dirty = true;
  if (!scheduled && renderer) { scheduled = true; requestAnimationFrame(frame); }
}

function schedule() {
  if (!scheduled && renderer && !document.hidden && (playing || fling)) { scheduled = true; requestAnimationFrame(frame); }
}

function frame(time) {
  scheduled = false;
  if (!renderer) return;
  const animating = playing && !document.hidden;
  const dt = lastTime === null ? 0 : Math.min(time - lastTime, 250);
  lastTime = time;
  if (animating) phase = wrap(phase + dt / (1000 * LOOP_SECONDS));
  if (fling) { stepFling(dt / 1000); dirty = true; }
  if (animating || dirty) {
    renderer.draw(phase, {continuous: animating || !!fling});
    dirty = false;
    if (animating) countFrame(time); else renderStats();
  }
  if (animating || fling) { scheduled = true; requestAnimationFrame(frame); }
  else lastTime = null;
}

// Frame statistics: shown with ?stats=1, the S key, or a tap on the name.
let frames = 0, statsTime = 0, fps = 0;
function countFrame(time) {
  frames++;
  if (time - statsTime >= 500) {
    fps = statsTime ? frames * 1000 / (time - statsTime) : 0;
    frames = 0; statsTime = time;
    renderStats();
  }
}
function renderStats() {
  stats.hidden = !showStats;
  if (!showStats || !renderer) return;
  const [width, height] = size();
  const cadence = renderer.display ? ` · display ${Math.round(1000 / renderer.display)} Hz` : '';
  stats.textContent = `${playing ? `${Math.round(fps)} fps` : 'paused'} · ${canvas.width}×${canvas.height} px · quality ${renderer.quality.toFixed(2)} · ${Math.round(view.scale(width, height))} px per repeat · ${renderer.taps} taps${cadence}`;
}
function toggleStats() { showStats = !showStats; renderStats(); }

function togglePause() {
  if (!renderer) return;
  playing = !playing; lastTime = null;
  updatePause(); showControls(); schedule(); updateWakeLock(); renderStats();
}

function fullscreenChanged() {
  const full = !!(document.fullscreenElement || document.webkitFullscreenElement);
  fullscreenButton.setAttribute('aria-label', full ? 'Exit fullscreen' : 'Enter fullscreen');
  document.querySelector('#fullscreen-label').textContent = full ? 'Exit fullscreen' : 'Fullscreen';
  document.querySelector('#fullscreen-icon').setAttribute('d', full ? 'M4 9h5V4m6 0v5h5M9 20v-5H4m11 5v-5h5' : 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5');
  requestDraw(); showControls(); updateWakeLock();
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

// Pointer gestures: one finger or a mouse pans; two fingers pan and zoom about
// their midpoint; a released pan keeps gliding. The pattern is periodic, so
// panning is endless in every direction.
const pointers = new Map();
const samples = [];
let gesture = null, fling = null;
function summarize() {
  const points = [...pointers.values()];
  const mid = points.reduce(([x, y], p) => [x + p.x / points.length, y + p.y / points.length], [0, 0]);
  const dist = points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;
  return {mid, dist, count: points.length};
}
function beginGesture() {
  const {mid, dist, count} = summarize();
  if (!count) { gesture = null; return; }
  const [width, height] = size();
  gesture = {anchor: view.latticeAt(mid, width, height), dist0: dist, scale0: view.scale(width, height), multi: count > 1};
  samples.length = 0;
}
function moveGesture(time) {
  if (!gesture) return;
  const {mid, dist} = summarize();
  const [width, height] = size();
  view.pin(gesture.anchor, mid, gesture.multi && gesture.dist0 > 0 ? gesture.scale0 * dist / gesture.dist0 : undefined, width, height);
  samples.push({time, mid});
  while (samples.length > 6) samples.shift();
  updateReset(); requestDraw();
}
function endGesture(time) {
  if (gesture && !gesture.multi && samples.length > 1) {
    const first = samples[0], last = samples[samples.length - 1], dt = (time - first.time) / 1000;
    if (time - last.time < 80 && dt > 0) {
      const velocity = [(last.mid[0] - first.mid[0]) / dt, (last.mid[1] - first.mid[1]) / dt];
      const speed = Math.hypot(...velocity);
      if (speed > 60) { const cap = Math.min(1, 6000 / speed); fling = {velocity: [velocity[0] * cap, velocity[1] * cap]}; schedule(); }
    }
  }
  gesture = null;
}
function stepFling(dt) {
  if (!fling || dt <= 0) return;
  const decay = Math.exp(-dt / 0.35);
  const [width, height] = size();
  // Displacement of an exponentially decaying velocity over dt.
  const travel = 0.35 * (1 - decay);
  view.panBy(fling.velocity[0] * travel, fling.velocity[1] * travel, width, height);
  fling.velocity = [fling.velocity[0] * decay, fling.velocity[1] * decay];
  if (Math.hypot(...fling.velocity) < 20) fling = null;
  updateReset();
}
canvas.addEventListener('pointerdown', event => {
  if (event.button !== undefined && event.button !== 0 && event.pointerType === 'mouse') return;
  canvas.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
  fling = null; beginGesture();
  if (event.pointerType === 'touch') renderer?.touched();
  document.body.classList.add('dragging');
  showControls();
});
canvas.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
  moveGesture(event.timeStamp);
});
for (const type of ['pointerup', 'pointercancel']) canvas.addEventListener(type, event => {
  if (!pointers.has(event.pointerId)) return;
  pointers.delete(event.pointerId);
  if (pointers.size) beginGesture(); else { endGesture(event.timeStamp); document.body.classList.remove('dragging'); }
});
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  const [width, height] = size();
  const step = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? 400 : 1;
  const factor = Math.exp(-event.deltaY * step * (event.ctrlKey ? 0.01 : 0.0022));
  view.zoomAt(factor, [event.clientX, event.clientY], width, height);
  fling = null; updateReset(); requestDraw(); showControls();
}, {passive: false});
canvas.addEventListener('contextmenu', event => event.preventDefault());
// Safari's own pinch and double-tap zoom must not fight the gesture.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(type, event => event.preventDefault());
canvas.addEventListener('touchmove', event => event.preventDefault(), {passive: false});

function resetView() { view.reset(); fling = null; updateReset(); requestDraw(); showControls(); }
function zoomCenter(factor) { const [width, height] = size(); view.zoomAt(factor, [width / 2, height / 2], width, height); updateReset(); requestDraw(); }
function pan(dx, dy) { const [width, height] = size(); view.panBy(dx, dy, width, height); fling = null; updateReset(); requestDraw(); }

pauseButton.addEventListener('click', event => { togglePause(); if (event.detail) pauseButton.blur(); });
fullscreenButton.addEventListener('click', event => { toggleFullscreen(); if (event.detail) fullscreenButton.blur(); });
resetButton.addEventListener('click', event => { resetView(); if (event.detail) resetButton.blur(); });
nameLabel.addEventListener('click', toggleStats);
canvas.addEventListener('dblclick', toggleFullscreen);
document.addEventListener('pointermove', showControls, {passive: true});
document.addEventListener('pointerdown', showControls, {passive: true});
document.addEventListener('focusin', showControls);
document.addEventListener('focusout', showControls);
document.addEventListener('keydown', event => {
  showControls();
  if (event.repeat && !event.key.startsWith('Arrow')) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase(), pace = event.shiftKey ? 240 : 48;
  if (event.code === 'Space' && event.target.tagName !== 'BUTTON') { event.preventDefault(); togglePause(); }
  else if (key === 'f') { event.preventDefault(); toggleFullscreen(); }
  else if (key === 's') { event.preventDefault(); toggleStats(); }
  else if (key === '0' || key === 'home') { event.preventDefault(); resetView(); }
  else if (key === '+' || key === '=') { event.preventDefault(); zoomCenter(1.25); }
  else if (key === '-' || key === '_') { event.preventDefault(); zoomCenter(0.8); }
  else if (key === 'arrowleft') { event.preventDefault(); pan(pace, 0); }
  else if (key === 'arrowright') { event.preventDefault(); pan(-pace, 0); }
  else if (key === 'arrowup') { event.preventDefault(); pan(0, pace); }
  else if (key === 'arrowdown') { event.preventDefault(); pan(0, -pace); }
});
document.addEventListener('fullscreenchange', fullscreenChanged);
document.addEventListener('webkitfullscreenchange', fullscreenChanged);
window.addEventListener('resize', requestDraw);
document.addEventListener('visibilitychange', () => { lastTime = null; schedule(); updateWakeLock(); });
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault(); renderer = null; scheduled = false;
  pauseButton.disabled = true;
  notice.textContent = 'Restoring the animation…'; notice.hidden = false; showControls();
});
canvas.addEventListener('webglcontextrestored', () => start());

function start() {
  try {
    renderer = createRenderer(canvas, field, {style, view, pixelRatio, display: displayInterval()});
    renderer.draw(phase); lastTime = null;
    canvas.dataset.ready = 'true';
    notice.hidden = true; pauseButton.disabled = false; fullscreenButton.disabled = false;
    updatePause(); updateReset(); renderStats(); showControls(); schedule(); updateWakeLock();
  } catch (error) { notice.textContent = error.message; notice.hidden = false; }
}

try {
  const response = await fetch('./field.f32');
  if (!response.ok) throw new Error('The pattern could not load. Please reload to try again.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== FIELD_BYTES) throw new Error('The pattern download is incomplete. Please reload.');
  const view32 = new DataView(bytes);
  field = Float32Array.from({length: bytes.byteLength / 4}, (_, i) => view32.getFloat32(i * 4, true));
  start();
} catch (error) { notice.textContent = error.message; }
