import {createRenderer, createView, FIELD_BYTES, GRID_SIZE, INITIAL_PHASE, LOOP_SECONDS, MAX_SCALE, MAX_TAA_LAYERS, MIN_SCALE, MOTION_PIXELS, scaleFor, SHUTTER, snapAngle, TAA_LAYERS, wrap} from './renderer.mjs';

const canvas = document.querySelector('#pattern');
const notice = document.querySelector('#notice');
const controls = document.querySelector('#controls');
const nameLabel = document.querySelector('#controls .name');
const pauseButton = document.querySelector('#pause');
const fullscreenButton = document.querySelector('#fullscreen');
const resetButton = document.querySelector('#reset');
const stats = document.querySelector('#stats');
const params = new URLSearchParams(location.search);
// A finite value out of range clamps to the nearest allowed one rather than
// being dropped, so a hand-edited share link still does what it asks for.
const number = (name, low, high) => {
  if (!params.has(name)) return null;
  const value = Number(params.get(name));
  return Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : null;
};
let phase = params.has('phase') && Number.isFinite(Number(params.get('phase'))) ? wrap(Number(params.get('phase'))) : INITIAL_PHASE;
// Explicit play=1 can override a device's motion preference.
let playing = params.has('play') ? params.get('play') !== '0' : !matchMedia('(prefers-reduced-motion: reduce)').matches;
// dpr=<ratio> pins the render resolution and turns adaptive resolution off.
const pixelRatio = number('dpr', 0.25, 4);
// Zooming out stops where one node of the 66-node lattice spans one device pixel.
const minScale = Math.max(MIN_SCALE, GRID_SIZE / (devicePixelRatio || 1));
// scale=<CSS pixels per lattice length> fixes the initial scale; x=&y= place a lattice point at the centre; angle=<degrees> turns the pattern clockwise.
const view = createView({tilePixels: number('scale', minScale, MAX_SCALE) ?? scaleFor, center: [number('x', -1e9, 1e9) ?? 0, number('y', -1e9, 1e9) ?? 0], angle: (number('angle', -1e6, 1e6) ?? 0) * Math.PI / 180, minScale});
// taa=<sub-samples per displayed frame>: 0 or 1 turns the shutter off, up to 5.
// shutter=<share of a frame interval> widens or narrows the shutter itself.
// motion=<CSS pixels a frame> is how far the picture must move before the
// shutter is worth paying for; 0 keeps it on whenever anything moves at all.
const taa = Math.max(1, Math.round(number('taa', 0, MAX_TAA_LAYERS) ?? TAA_LAYERS));
const shutter = number('shutter', 0, 2) ?? SHUTTER;
const motion = number('motion', 0, 1000) ?? MOTION_PIXELS;
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
    // `time` is the animation frame's own timestamp: it names the frame the
    // browser is about to show, and is far steadier than a clock read inside
    // the callback, so both the phase and the cadence the governor measures
    // follow the display instead of the main thread's jitter.
    renderer.draw(phase, {continuous: animating || !!fling, moving: animating, time});
    dirty = false;
    if (animating) countFrame(time); else renderStats();
  }
  if (animating || fling) { scheduled = true; requestAnimationFrame(frame); }
  else {
    lastTime = null;
    // The frame just drawn was integrated over the motion it had; once the
    // motion stops, one more frame settles the picture back to a sharp one.
    // It asks for nothing further, since by then nothing is moving.
    if (renderer?.layers > 1) requestDraw();
  }
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
  const turned = view.angle ? ` · turned ${Math.round(view.angle * 180 / Math.PI)}°` : '';
  // The shutter: how many sub-samples the last frame averaged, out of the most
  // this viewer may use, and how wide the shutter is as a share of a frame.
  const shutterNote = renderer.maxLayers > 1
    ? ` · shutter ${renderer.layers > 1 ? `${renderer.layers}×${renderer.shutter.toFixed(2)} frame` : `off (of ${renderer.maxLayers})`}`
    : ' · shutter off';
  stats.textContent = `${playing ? `${Math.round(fps)} fps` : 'paused'} · ${canvas.width}×${canvas.height} px · quality ${renderer.quality.toFixed(2)} · ${Math.round(view.scale(width, height))} px per repeat${turned} · ${renderer.taps} taps${cadence}${shutterNote}${gestureNote()}`;
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

// Inside a host page's sandboxed frame (spacesheep embeds the viewer that way)
// fullscreen is not permitted, so the button opens the viewer in its own tab.
const embedded = window.top !== window && document.fullscreenEnabled === false && !document.webkitFullscreenEnabled;
if (embedded) {
  fullscreenButton.setAttribute('aria-label', 'Open in its own tab');
  fullscreenButton.title = 'Open in its own tab';
  document.querySelector('#fullscreen-label').textContent = 'Open full page';
}

async function toggleFullscreen() {
  if (embedded) { window.open(location.href, '_blank', 'noopener'); showControls(); return; }
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

// Pointer gestures: one finger or a mouse pans; two fingers pan, zoom and turn
// about their midpoint, and a turn that ends within 4° of a sixth of a turn
// snaps to it; a released pan keeps gliding. The pattern is periodic, so
// panning is endless in every direction.
const pointers = new Map();
const samples = [];
let gesture = null, fling = null;
function summarize() {
  const points = [...pointers.values()];
  const mid = points.reduce(([x, y], p) => [x + p.x / points.length, y + p.y / points.length], [0, 0]);
  const dist = points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;
  const heading = points.length > 1 ? Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x) : 0;
  return {mid, dist, heading, count: points.length};
}
function beginGesture() {
  const {mid, dist, heading, count} = summarize();
  if (!count) { gesture = null; return; }
  const [width, height] = size();
  gesture = {anchor: view.latticeAt(mid, width, height), mid, dist0: dist, heading0: heading, scale0: view.scale(width, height), angle0: view.angle, multi: count > 1};
  samples.length = 0;
  samples.push({time: performance.now(), mid});
}
function moveGesture(time) {
  if (!gesture) return;
  const {mid, dist, heading} = summarize();
  const [width, height] = size();
  gesture.mid = mid;
  if (gesture.multi && gesture.dist0 > 0) view.pin(gesture.anchor, mid, width, height, {scale: gesture.scale0 * dist / gesture.dist0, angle: gesture.angle0 + heading - gesture.heading0});
  else view.pin(gesture.anchor, mid, width, height);
  // Release velocity comes from the last 100 ms of movement.
  samples.push({time, mid});
  while (samples.length > 1 && time - samples[0].time > 100) samples.shift();
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
function settleTurn() {
  if (!gesture?.multi) return;
  const snapped = snapAngle(view.angle);
  if (snapped !== view.angle) { const [width, height] = size(); view.pin(gesture.anchor, gesture.mid, width, height, {angle: snapped}); requestDraw(); }
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
  try { canvas.setPointerCapture(event.pointerId); } catch { /* Synthetic pointers cannot be captured; the gesture still works. */ }
  pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
  fling = null; beginGesture();
  if (event.pointerType === 'touch') renderer?.touched();
  document.body.classList.add('dragging');
  showControls();
});
canvas.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
  moveGesture(performance.now());
});
for (const type of ['pointerup', 'pointercancel']) canvas.addEventListener(type, event => {
  if (!pointers.has(event.pointerId)) return;
  settleTurn();
  pointers.delete(event.pointerId);
  if (pointers.size) beginGesture(); else { endGesture(performance.now()); document.body.classList.remove('dragging'); }
});
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  if (event.ctrlKey && performance.now() - trackpad.time < 150) return; // Safari reports the same pinch as a gesture event.
  const [width, height] = size();
  const step = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? 400 : 1;
  // Option (Alt) turns instead of zooming, so a trackpad with no rotate gesture
  // — and a mouse — can still turn the pattern smoothly about the pointer.
  if (event.altKey && !event.ctrlKey) view.rotateAt(-event.deltaY * step * 0.0015, [event.clientX, event.clientY], width, height);
  else view.zoomAt(Math.exp(-event.deltaY * step * (event.ctrlKey ? 0.01 : 0.0022)), [event.clientX, event.clientY], width, height);
  fling = null; rebaseGesture(); updateReset(); requestDraw(); showControls();
}, {passive: false});
canvas.addEventListener('contextmenu', event => event.preventDefault());
// Safari reports trackpad pinches and two-finger turns as gesture events with a
// cumulative scale and rotation (degrees, clockwise). They zoom and turn the
// view about the pointer whenever no touch pointers are active; on iPhone and
// iPad the pointer events above already handle the fingers, and the gesture
// events are only cancelled so Safari does not zoom the page itself.
//
// On a Mac the two live in separate streams. AppKit sends a pinch as
// NSEventTypeMagnify and a turn as NSEventTypeRotate, and WebKit forwards each
// as its own gesture event carrying only its own quantity: the magnify kind
// sets the rotation to zero and the rotate kind sets the scale to a neutral 1
// (the platform event carries 0). Applying both fields of every event therefore
// lets the two streams cancel each other — a pinch and a turn together read as
// a pinch that keeps snapping back to no turn, and a turn that keeps snapping
// back to no zoom, which is why they only ever worked one at a time. So each
// quantity is accumulated on its own and taken only from an event that actually
// carries it — a non-neutral value.
//
// An event that names *neither* quantity is ambiguous: a magnify event whose
// pinch has come back to exactly 1×, or a rotate event whose turn has come back
// to exactly 0°, look identical. The kind of stream settles it, and the stream
// is latched over the whole gesture rather than guessed at per event:
//
//   · if two events have named both, this Safari accumulates both in every
//     event, and every field of every event is applied — except a neutral field
//     arriving beside a moving one, which is the split stream's signature and
//     is held rather than allowed to cancel the other accumulator. Two events
//     and not one: a single coalesced event that happened to name both must not
//     be able to switch the handler into a mode that then throws a turn away;
//   · if only one quantity has ever been named, the stream is that one kind, so
//     a silent event is that quantity returning to neutral and is applied;
//   · if both have been named, but never together, it is the split Mac stream
//     and a silent event is ignored — reading it as both would throw away the
//     other accumulator, collapsing the view mid-gesture (pinch to 1.4×, turn
//     20°, turn back through 0° and the zoom would be gone). The cost of
//     ignoring it is that an exact return to 1× or 0° waits for the next event
//     that names something, which is a frame away.
//
// The view is pinned with both accumulators every time, so zoom and turn
// survive each other.
const trackpad = {
  time: -Infinity, anchor: null, scale0: 0, angle0: 0, point: [0, 0],
  scale: 1, rotation: 0, // the accumulators, each from its own stream
  cumulative: false, sawScale: false, sawRotation: false, // what this gesture's stream has shown so far
  raw: [1, 0], events: 0, flatScale: 0, flatRotation: 0, both: 0, ignored: 0, // diagnostics for the stats overlay
};
function resetTrackpad() {
  trackpad.scale = 1; trackpad.rotation = 0; trackpad.raw = [1, 0];
  trackpad.cumulative = false; trackpad.sawScale = false; trackpad.sawRotation = false;
  trackpad.events = 0; trackpad.flatScale = 0; trackpad.flatRotation = 0; trackpad.both = 0; trackpad.ignored = 0;
}
/** Folds one gesture event into the two accumulators. `final` marks the event
 * that ends the gesture, where a silent event says nothing at all and must
 * never be read as a return to neutral. */
function accumulate(event, final = false) {
  const s = Number(event.scale), r = Number(event.rotation);
  // A scale is usable when it is a finite positive number; the rotate stream's
  // 0 (and any missing field) says nothing about the zoom.
  const hasScale = Number.isFinite(s) && s > 0, hasRotation = Number.isFinite(r);
  const carriesScale = hasScale && s !== 1, carriesRotation = hasRotation && r !== 0;
  trackpad.events++;
  if (!carriesScale) trackpad.flatScale++;
  if (!carriesRotation) trackpad.flatRotation++;
  if (carriesScale && carriesRotation) { trackpad.both++; if (trackpad.both >= 2) trackpad.cumulative = true; }
  if (carriesScale) trackpad.sawScale = true;
  if (carriesRotation) trackpad.sawRotation = true;
  trackpad.raw = [hasScale ? s : NaN, hasRotation ? r : NaN];
  if (trackpad.cumulative) { // both quantities in every event: take both
    // …but never a neutral field from an event whose *other* field is moving,
    // while this accumulator is not neutral. That combination is exactly what
    // the split Mac stream looks like, and applying it would wipe a live turn
    // or a live zoom — the cancellation this whole handler exists to prevent.
    // A genuine return to 1× or 0° in a cumulative stream therefore waits for
    // the next event that names something, a frame away, which is the same
    // price the split stream pays below.
    if (hasScale && (carriesScale || !carriesRotation || trackpad.scale === 1)) trackpad.scale = s;
    else if (hasScale) trackpad.ignored++;
    if (hasRotation && (carriesRotation || !carriesScale || trackpad.rotation === 0)) trackpad.rotation = r;
    else if (hasRotation) trackpad.ignored++;
    return;
  }
  if (carriesScale) trackpad.scale = s;
  if (carriesRotation) trackpad.rotation = r;
  if (carriesScale || carriesRotation) return;
  if (final) { trackpad.ignored++; return; }
  if (hasScale && !trackpad.sawRotation) trackpad.scale = s;        // a magnify stream back at 1×
  else if (hasRotation && !trackpad.sawScale) trackpad.rotation = r; // a rotate stream back at 0°
  else trackpad.ignored++;                                           // ambiguous: keep both accumulators
}
function pinTrackpad() {
  const [width, height] = size();
  view.pin(trackpad.anchor, trackpad.point, width, height, {scale: trackpad.scale0 * trackpad.scale, angle: trackpad.angle0 + trackpad.rotation * Math.PI / 180});
}
/** Re-reads the gesture's baseline from the view. Any other control — a turn
 * key, an arrow key, the wheel — may move the view in the middle of a trackpad
 * gesture; without this the next gesture event would undo it. */
function rebaseGesture() {
  if (!trackpad.anchor) return;
  const [width, height] = size();
  trackpad.anchor = view.latticeAt(trackpad.point, width, height);
  trackpad.scale0 = view.scale(width, height) / (trackpad.scale || 1);
  trackpad.angle0 = view.angle - trackpad.rotation * Math.PI / 180;
}
/** What the last gesture event carried, for the stats overlay: the raw scale and
 * rotation, how many events named neither, how many of those were too ambiguous
 * to apply, and where the accumulators stand. */
function gestureNote() {
  if (!trackpad.events) return '';
  const [s, r] = trackpad.raw;
  const show = v => Number.isFinite(v) ? v.toFixed(3) : '—';
  const held = trackpad.ignored ? ` · held ${trackpad.ignored}` : '';
  return ` · gesture raw ${show(s)}/${show(r)} · flat ${trackpad.flatScale}s ${trackpad.flatRotation}r both ${trackpad.both} of ${trackpad.events}${held} · kept ${trackpad.scale.toFixed(3)}×/${trackpad.rotation.toFixed(1)}°`;
}
document.addEventListener('gesturestart', event => {
  event.preventDefault();
  if (pointers.size || event.target !== canvas) return;
  const [width, height] = size();
  trackpad.point = [event.clientX, event.clientY];
  trackpad.anchor = view.latticeAt(trackpad.point, width, height);
  trackpad.scale0 = view.scale(width, height); trackpad.angle0 = view.angle; trackpad.time = performance.now();
  resetTrackpad();
  fling = null; showControls(); renderStats();
});
document.addEventListener('gesturechange', event => {
  event.preventDefault();
  if (pointers.size || !trackpad.anchor) return;
  accumulate(event);
  pinTrackpad();
  trackpad.time = performance.now();
  updateReset(); requestDraw();
});
document.addEventListener('gestureend', event => {
  event.preventDefault();
  if (!trackpad.anchor) return;
  accumulate(event, true);
  pinTrackpad();
  const snapped = snapAngle(view.angle);
  if (snapped !== view.angle) { const [width, height] = size(); view.pin(trackpad.anchor, trackpad.point, width, height, {angle: snapped}); }
  trackpad.anchor = null; trackpad.time = performance.now();
  updateReset(); requestDraw();
});
canvas.addEventListener('touchmove', event => event.preventDefault(), {passive: false});

// Every control that *moves* the view re-bases a trackpad gesture in progress,
// so a Mac can zoom and turn at once: pinch on the trackpad with one hand and
// hold ] or [ with the other, or turn with the keys and roll the wheel. Reset is
// the exception, and cancels the gesture instead: going home in the middle of a
// pinch means home, not home-plus-whatever-the-fingers-have-done-so-far, so the
// anchor is dropped and the rest of that gesture's events are ignored.
function resetView() { view.reset(); fling = null; trackpad.anchor = null; updateReset(); requestDraw(); showControls(); }
function zoomCenter(factor) { const [width, height] = size(); view.zoomAt(factor, [width / 2, height / 2], width, height); rebaseGesture(); updateReset(); requestDraw(); }
function turnCenter(delta) { const [width, height] = size(); view.rotateAt(delta, [width / 2, height / 2], width, height); rebaseGesture(); updateReset(); requestDraw(); }
function pan(dx, dy) { const [width, height] = size(); view.panBy(dx, dy, width, height); fling = null; rebaseGesture(); updateReset(); requestDraw(); }

pauseButton.addEventListener('click', event => { togglePause(); if (event.detail) pauseButton.blur(); });
fullscreenButton.addEventListener('click', event => { toggleFullscreen(); if (event.detail) fullscreenButton.blur(); });
resetButton.addEventListener('click', event => { resetView(); if (event.detail) resetButton.blur(); });
nameLabel.addEventListener('click', toggleStats);
canvas.addEventListener('dblclick', toggleFullscreen);
document.addEventListener('pointermove', showControls, {passive: true});
document.addEventListener('pointerdown', showControls, {passive: true});
document.addEventListener('focusin', showControls);
document.addEventListener('focusout', showControls);
// The zoom and turn keys repeat while held, in smaller steps: holding ] turns
// the pattern steadily, which is what makes turning while pinching the trackpad
// possible on a Mac. Arrow keys repeat as before; the rest act once per press.
const REPEATS = new Set(['+', '=', '-', '_', ']', '}', '[', '{']);
document.addEventListener('keydown', event => {
  showControls();
  const repeating = event.repeat;
  if (repeating && !event.key.startsWith('Arrow') && !REPEATS.has(event.key)) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase(), pace = event.shiftKey ? 240 : 48;
  const turn = (repeating ? 3 : event.shiftKey ? 60 : 15) * Math.PI / 180;
  const zoom = repeating ? 1.05 : 1.25;
  if (event.code === 'Space' && event.target.tagName !== 'BUTTON') { event.preventDefault(); togglePause(); }
  else if (key === 'f') { event.preventDefault(); toggleFullscreen(); }
  else if (key === 's') { event.preventDefault(); toggleStats(); }
  else if (key === '0' || key === 'home') { event.preventDefault(); resetView(); }
  else if (key === '+' || key === '=') { event.preventDefault(); zoomCenter(zoom); }
  else if (key === '-' || key === '_') { event.preventDefault(); zoomCenter(1 / zoom); }
  else if (key === ']' || key === '}') { event.preventDefault(); turnCenter(turn); }
  else if (key === '[' || key === '{') { event.preventDefault(); turnCenter(-turn); }
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
    renderer = createRenderer(canvas, field, {view, pixelRatio, display: displayInterval(), taa, shutter, motion});
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
  // The file is little-endian float32, as every platform a browser ships on is;
  // the probe keeps the decode correct if that ever stops being true, and the
  // typed-array view costs a fraction of a millisecond where the loop cost ~14.
  const littleEndian = new Uint8Array(Uint16Array.of(1).buffer)[0] === 1;
  if (littleEndian) field = new Float32Array(bytes);
  else {
    const view32 = new DataView(bytes);
    field = Float32Array.from({length: bytes.byteLength / 4}, (_, i) => view32.getFloat32(i * 4, true));
  }
  start();
} catch (error) { notice.textContent = error.message; }
