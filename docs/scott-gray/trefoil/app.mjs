import {CENTER, createRenderer, createView, FIELD_BYTES, GRID_SIZE, INITIAL_PHASE, LOOP_SECONDS, MAX_SCALE, MAX_TAA_LAYERS, MIN_SCALE, MOTION_PIXELS, scaleFor, SHUTTER, snapAngle, TAA_LAYERS, wrap} from './renderer.mjs';
import {advanceFling, createFling, ELASTIC_GIVE, estimateVelocity, NO_THROW, trimSamples, WINDOW_MS} from './momentum.mjs';
import {createGeneratorOverlay, legendMarkup} from './generators.mjs';

const canvas = document.querySelector('#pattern');
const notice = document.querySelector('#notice');
const controls = document.querySelector('#controls');
const nameLabel = document.querySelector('#controls .name');
const pauseButton = document.querySelector('#pause');
const fullscreenButton = document.querySelector('#fullscreen');
const resetButton = document.querySelector('#reset');
const stats = document.querySelector('#stats');
const generatorLayer = document.querySelector('#generators');
const generatorCheck = document.querySelector('#generators-check');
const generatorToggle = document.querySelector('#generators-toggle');
const notationButton = document.querySelector('#notation');
const legend = document.querySelector('#legend');
const legendClose = document.querySelector('#legend-close');
const params = new URLSearchParams(location.search);
// A finite value out of range clamps to the nearest allowed one rather than
// being dropped, so a hand-edited share link still does what it asks for.
const number = (name, low, high) => {
  if (!params.has(name)) return null;
  const value = Number(params.get(name));
  return Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : null;
};
let phase = params.has('phase') && Number.isFinite(Number(params.get('phase'))) ? wrap(Number(params.get('phase'))) : INITIAL_PHASE;
// Reduced motion pauses the animation, and takes the inertia off every gesture:
// a release then stops where it was let go, with no glide and no spring.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
// Explicit play=1 can override a device's motion preference.
let playing = params.has('play') ? params.get('play') !== '0' : !reducedMotion.matches;
// dpr=<ratio> pins the render resolution and turns adaptive resolution off.
const pixelRatio = number('dpr', 0.25, 4);
// Zooming out stops where one node of the 66-node lattice spans one device pixel.
const minScale = Math.max(MIN_SCALE, GRID_SIZE / (devicePixelRatio || 1));
// scale=<CSS pixels per lattice length> fixes the initial scale; x=&y= place a
// lattice point at the centre (the lattice origin by default, which is the
// centre of the half-turn the entangled law is about); angle=<degrees> turns
// the pattern clockwise.
// `overshoot` is the slack a glide may take past a zoom limit before springing
// back to it; nothing else in the page may ever leave that range.
const view = createView({tilePixels: number('scale', minScale, MAX_SCALE) ?? scaleFor, center: [number('x', -1e9, 1e9) ?? CENTER[0], number('y', -1e9, 1e9) ?? CENTER[1]], angle: (number('angle', -1e6, 1e6) ?? 0) * Math.PI / 180, minScale, overshoot: Math.exp(ELASTIC_GIVE)});
// taa=<sub-samples per displayed frame>: 0 or 1 turns the shutter off, up to 5.
// shutter=<share of a frame interval> widens or narrows the shutter itself.
// motion=<CSS pixels a frame> is how far the picture must move before the
// shutter is worth paying for; 0 keeps it on whenever anything moves at all.
const taa = Math.max(1, Math.round(number('taa', 0, MAX_TAA_LAYERS) ?? TAA_LAYERS));
const shutter = number('shutter', 0, 2) ?? SHUTTER;
const motion = number('motion', 0, 1000) ?? MOTION_PIXELS;
let showStats = params.get('stats') === '1';
// The generator marks are OFF until someone asks for them: every picture on
// this site opens as the picture alone, and the checkbox under it — or `G` — is
// what adds the annotation. A viewer who has turned them on keeps them on, and
// `?generators=1` shares a view with them (`?generators=0` without); either
// query wins over what the viewer last chose, which is remembered here alone
// and never leaves the browser.
const STORE_KEY = 'trefoil:generators';
const stored = (() => { try { return localStorage.getItem(STORE_KEY); } catch { return null; } })();
const askedGenerators = params.get('generators') ?? params.get('gen');
let showGenerators = askedGenerators !== null ? askedGenerators !== '0' : stored === '1';
let renderer, field, overlay, scheduled = false, dirty = false, lastTime = null, idleTimer, wakeLock;

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
    // The notation panel is a deliberate choice, so the bar that dismisses it
    // stays with it; everything else fades as it always did.
    if (!controls.contains(document.activeElement) && legend.hidden) document.body.classList.add('quiet');
  }, 2600);
}

// ---- the generator marks ----------------------------------------------------
// The overlay is redrawn from the same view the shader reads, on every frame
// that draws anything; a frame whose view has not moved costs nothing, so
// playback — which never moves the view — is untouched.
overlay = createGeneratorOverlay(generatorLayer, view);
generatorLayer.setAttribute('aria-label', overlay.description());
function updateOverlay(force = false) {
  if (!showGenerators || !renderer) return;
  const [width, height] = size();
  overlay.update(width, height, {force});
}
function setGenerators(on, {remember = true} = {}) {
  showGenerators = on;
  // `hidden` is an HTMLElement property and an SVG element does not reflect it,
  // so the attribute itself is what the stylesheet is given.
  if (on) generatorLayer.removeAttribute('hidden'); else generatorLayer.setAttribute('hidden', '');
  generatorCheck.checked = on;
  // The state is the checkbox's own, announced natively; an aria-label on the
  // <label> would never be read, and one on the <input> would replace the
  // accessible name "Generators" that the visible word gives it.
  generatorToggle.dataset.on = String(on);
  if (remember) { try { localStorage.setItem(STORE_KEY, on ? '1' : '0'); } catch { /* Private browsing: the choice lasts this visit. */ } }
  if (on) updateOverlay(true); else overlay.clear();
  renderStats();
}
function toggleGenerators() { setGenerators(!showGenerators); showControls(); }

// ---- the notation panel -----------------------------------------------------
// It is a side panel and not a modal — the picture behind it stays live and
// keeps every gesture — so it is a labelled region, it closes on a tap outside
// as well as on Esc, and it says when there is more of it below the fold.
let legendBuilt = false;
const legendBody = document.querySelector('#legend-body');
function updateLegendScroll() {
  const more = legendBody.scrollHeight - legendBody.clientHeight - legendBody.scrollTop > 4;
  legend.dataset.more = more ? '1' : '0';
}
legendBody.addEventListener('scroll', updateLegendScroll, {passive: true});
function openLegend() {
  if (!legendBuilt) { legendBody.innerHTML = legendMarkup(); legendBuilt = true; }
  legend.hidden = false;
  notationButton.setAttribute('aria-expanded', 'true');
  showControls();
  legendClose.focus({preventScroll: true});
  updateLegendScroll();
}
function closeLegend({restore = true} = {}) {
  if (legend.hidden) return;
  legend.hidden = true;
  notationButton.setAttribute('aria-expanded', 'false');
  if (restore) notationButton.focus({preventScroll: true});
  showControls();
}
function toggleLegend() { if (legend.hidden) openLegend(); else closeLegend(); }

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
    updateOverlay();
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
  // How many repeats of the annotation are on screen, or that it is off: the
  // one number that says whether the overlay is thinning out or gone.
  const marks = showGenerators ? ` · marks ${overlay.count}` : ' · marks off';
  stats.textContent = `${playing ? `${Math.round(fps)} fps` : 'paused'} · ${canvas.width}×${canvas.height} px · quality ${renderer.quality.toFixed(2)} · ${Math.round(view.scale(width, height))} px per repeat${turned} · ${renderer.taps} taps${cadence}${shutterNote}${marks}${gestureNote()}`;
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
// snaps to it; a release keeps all three gliding. The pattern is periodic, so
// panning is endless in every direction.
//
// Every gesture — one finger, two fingers, the trackpad, a burst of wheel
// events — keeps the same list of samples, and hands the same three-channel
// velocity to the same glide, so there is one piece of inertia in the viewer
// rather than one per input. See `momentum.mjs` for what the glide does.
const pointers = new Map();
const samples = [];
/** How long a pinch's zoom and turn wait for the pinch's second finger to lift. */
const HANDOVER_MS = 120;
let gesture = null, fling = null, handover = null;
/** Where the view stands, in the form the release velocity is measured in: the
 * gesture's own point, the log of the scale (so a zoom velocity is a *factor*
 * a second, the same at every zoom) and the turn. */
function sample(time, mid) {
  const [width, height] = size();
  return {time, mid, logScale: Math.log(view.scale(width, height)), angle: view.angle};
}
function summarize() {
  const points = [...pointers.values()];
  const mid = points.reduce(([x, y], p) => [x + p.x / points.length, y + p.y / points.length], [0, 0]);
  const dist = points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;
  const heading = points.length > 1 ? Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x) : 0;
  return {mid, dist, heading, count: points.length};
}
function beginGesture(sawMulti = false) {
  const {mid, dist, heading, count} = summarize();
  if (!count) { gesture = null; return; }
  const [width, height] = size();
  // `sawMulti` marks the one-finger gesture left behind when a pinch loses a
  // finger: the turn it made still has to settle onto a sixth when it ends.
  gesture = {anchor: view.latticeAt(mid, width, height), mid, dist0: dist, heading0: heading, scale0: view.scale(width, height), angle0: view.angle, multi: count > 1, sawMulti: sawMulti || count > 1};
  samples.length = 0;
  samples.push(sample(performance.now(), mid));
}
function moveGesture(time) {
  if (!gesture) return;
  const {mid, dist, heading} = summarize();
  const [width, height] = size();
  gesture.mid = mid;
  if (gesture.multi && gesture.dist0 > 0) view.pin(gesture.anchor, mid, width, height, {scale: gesture.scale0 * dist / gesture.dist0, angle: gesture.angle0 + heading - gesture.heading0});
  else view.pin(gesture.anchor, mid, width, height);
  // Release velocity comes from the last 100 ms of movement.
  samples.push(sample(time, mid));
  trimSamples(samples, WINDOW_MS);
  updateReset(); requestDraw();
}
/** What the gesture was doing as it ended. One finger can only pan, so its zoom
 * and turn channels are switched off rather than measured — the scale and the
 * angle do not move, and a one-finger fling stays exactly what it always was. */
function releaseVelocity(time) {
  if (!gesture || reducedMotion.matches) return NO_THROW;
  const still = gesture.multi ? 1 : 0;
  return estimateVelocity(samples, time, {zoomGain: still, turnGain: still});
}
/** Starts the glide the release asks for, about the point the gesture ended at:
 * the zoom and the turn carry on about that anchor while the pan slides under
 * it, which is the same anchor the fingers themselves were working about. */
function startFling(velocity, point, {snap = true} = {}) {
  const [width, height] = size();
  const state = createFling(velocity, {
    logScale: Math.log(view.scale(width, height)), angle: view.angle,
    logMin: Math.log(view.minScale), logMax: Math.log(view.maxScale), snap,
  });
  if (!state) return null;
  state.point = [...point];
  fling = state;
  schedule();
  return state;
}
function settleTurn() {
  if (!gesture?.sawMulti) return;
  const snapped = snapAngle(view.angle);
  if (snapped !== view.angle) { const [width, height] = size(); view.pin(gesture.anchor, gesture.mid, width, height, {angle: snapped}); requestDraw(); }
}
function stepFling(dt) {
  if (!fling || dt <= 0) return;
  const [width, height] = size();
  const step = advanceFling(fling, dt);
  // The zoom and the turn are pinned about the release point, and the pan then
  // slides the whole picture under it. The anchor is re-read every frame, so
  // the lattice point held under the release point is the one that is there now.
  if (step.zoomMoved || step.turnMoved) {
    const anchor = view.latticeAt(fling.point, width, height);
    // Only a live step may sit outside the zoom limits: the one that ends the
    // glide lands back inside them, and the elastic excursion is over.
    view.pin(anchor, fling.point, width, height, {scale: Math.exp(step.logScale), angle: step.angle, elastic: step.live});
  }
  if (step.pan[0] || step.pan[1]) view.panBy(step.pan[0], step.pan[1], width, height);
  if (!step.live) fling = null;
  updateReset();
}
/** Drops a glide before it has finished. A glide in the middle of its elastic
 * excursion is sitting *outside* the zoom limits — that is the whole point of
 * the excursion — and only a live glide may be out there, so whatever cuts one
 * short (a finger, the wheel, a trackpad pinch, a button, a key) must first put
 * the view back on the limit it was stretching. Dropping the state alone would
 * leave the view permanently past 8000, since nothing else re-clamps the scale. */
function stopFling() {
  if (fling && fling.over) {
    const [width, height] = size();
    // `fling.logScale` is the limit itself: the glide clamps to it and carries
    // the excursion separately, so pinning there is exactly the spring-back
    // arriving instantly, about the point the glide was working about.
    view.pin(view.latticeAt(fling.point, width, height), fling.point, width, height, {scale: Math.exp(fling.logScale)});
    requestDraw();
  }
  fling = null;
}
canvas.addEventListener('pointerdown', event => {
  if (event.button !== undefined && event.button !== 0 && event.pointerType === 'mouse') return;
  try { canvas.setPointerCapture(event.pointerId); } catch { /* Synthetic pointers cannot be captured; the gesture still works. */ }
  pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
  stopFling(); endWheel(); handover = null; // a new pointer cancels any glide
  beginGesture();
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
  const time = performance.now();
  // A turn that was still moving is not snapped as the fingers lift — the glide
  // carries it on and eases onto the nearest sixth when it comes to rest — but
  // one that was let go still must be, and before the glide reads the angle.
  if (pointers.size > 1) {
    // A finger has left a pinch. The fingers of a pinch never lift in the same
    // instant, and the pinch's own velocity dies with the second finger's
    // arrival as a lone pointer, so what it was doing is kept for a moment: if
    // the last finger follows within `HANDOVER_MS` it is one release, and the
    // zoom and the turn are thrown with the pan. If it stays down, the pinch
    // has ended and only the pan it goes on to make is thrown.
    const velocity = releaseVelocity(time);
    if (!velocity.turn) settleTurn();
    handover = velocity.zoom || velocity.turn ? {zoom: velocity.zoom, turn: velocity.turn, point: gesture.mid, time} : null;
  } else {
    const own = releaseVelocity(time);
    const carried = handover && time - handover.time <= HANDOVER_MS ? handover : null;
    const velocity = carried ? {pan: own.pan, zoom: carried.zoom, turn: carried.turn} : own;
    if (!velocity.turn) settleTurn();
    if (gesture) startFling(velocity, carried ? carried.point : gesture.mid);
    gesture = null; handover = null;
  }
  pointers.delete(event.pointerId);
  if (pointers.size) beginGesture(true); else document.body.classList.remove('dragging');
});
// A burst of wheel events is a gesture too — a two-finger scroll on a trackpad
// arrives as thirty of them — so it ends with the same glide, more gently: a
// third of the measured rate, capped well under a finger's, and only once at
// least three events have arrived, so a single notch of a mouse wheel moves the
// view exactly as far as it asks for and no further. The burst is over once no
// wheel event has arrived for `WHEEL_REST_MS`.
const WHEEL_REST_MS = 70, WHEEL_GAIN = 0.3, PINCH_WHEEL_GAIN = 0.6;
const wheel = {samples: [], timer: 0, point: [0, 0], turning: false, pinch: false};
function noteWheel(turning, pinch, point) {
  const now = performance.now();
  const last = wheel.samples[wheel.samples.length - 1];
  // A change of kind, or a gap, starts a new burst: turning and zooming are
  // different gestures and must not be averaged into one velocity.
  if (turning !== wheel.turning || !last || now - last.time > WHEEL_REST_MS * 2) wheel.samples.length = 0;
  wheel.turning = turning; wheel.pinch = pinch; wheel.point = point;
  wheel.samples.push(sample(now, point));
  trimSamples(wheel.samples, WINDOW_MS);
  clearTimeout(wheel.timer);
  wheel.timer = setTimeout(releaseWheel, WHEEL_REST_MS);
}
function endWheel() { clearTimeout(wheel.timer); wheel.samples.length = 0; }
function releaseWheel() {
  const burst = wheel.samples;
  wheel.samples = [];
  if (!burst.length || pointers.size || trackpad.anchor || reducedMotion.matches) return;
  // Measured at the last event rather than now: the rest period is how the end
  // of the burst is noticed, not a hesitation before letting go.
  const gain = wheel.pinch ? PINCH_WHEEL_GAIN : WHEEL_GAIN;
  const velocity = estimateVelocity(burst, burst[burst.length - 1].time, {
    minEvents: 3, panGain: 0, zoomGain: wheel.turning ? 0 : gain, turnGain: wheel.turning ? gain : 0,
    maxZoom: 0.9, maxTurn: 1.5,
  });
  startFling(velocity, wheel.point);
}
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  if (event.ctrlKey && performance.now() - trackpad.time < 150) return; // Safari reports the same pinch as a gesture event.
  const [width, height] = size();
  const step = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? 400 : 1;
  // Option (Alt) turns instead of zooming, so a trackpad with no rotate gesture
  // — and a mouse — can still turn the pattern smoothly about the pointer.
  const turning = event.altKey && !event.ctrlKey;
  stopFling(); // any new wheel input cancels a glide in progress
  if (turning) view.rotateAt(-event.deltaY * step * 0.0015, [event.clientX, event.clientY], width, height);
  else view.zoomAt(Math.exp(-event.deltaY * step * (event.ctrlKey ? 0.01 : 0.0022)), [event.clientX, event.clientY], width, height);
  noteWheel(turning, !!event.ctrlKey, [event.clientX, event.clientY]);
  rebaseGesture(); updateReset(); requestDraw(); showControls();
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
//   · if any one event has ever named both, this Safari accumulates both in
//     every event, and every field of every event is applied;
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
  time: -Infinity, anchor: null, scale0: 0, angle0: 0, point: [0, 0], samples: [],
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
  if (carriesScale && carriesRotation) { trackpad.both++; trackpad.cumulative = true; }
  if (carriesScale) trackpad.sawScale = true;
  if (carriesRotation) trackpad.sawRotation = true;
  trackpad.raw = [hasScale ? s : NaN, hasRotation ? r : NaN];
  if (trackpad.cumulative) { // both quantities in every event: take both, always
    if (hasScale) trackpad.scale = s;
    if (hasRotation) trackpad.rotation = r;
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
 * gesture; without this the next gesture event would undo it.
 *
 * The same step also has to be kept out of the release velocity: a key that
 * turns the view 15° in one frame is not the fingers moving at 900°/s. So the
 * history any gesture in progress is measuring restarts from where the view now
 * stands. (A wheel burst keeps its own history, which is the one thing here
 * that the wheel itself is building.) */
function rebaseGesture() {
  const now = performance.now();
  if (gesture) { samples.length = 0; samples.push(sample(now, gesture.mid)); }
  if (!trackpad.anchor) return;
  const [width, height] = size();
  trackpad.samples = [sample(now, trackpad.point)];
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
  stopFling(); // before the anchor is taken, so the gesture starts from the settled view
  const [width, height] = size();
  trackpad.point = [event.clientX, event.clientY];
  trackpad.anchor = view.latticeAt(trackpad.point, width, height);
  trackpad.scale0 = view.scale(width, height); trackpad.angle0 = view.angle; trackpad.time = performance.now();
  resetTrackpad();
  trackpad.samples = [sample(trackpad.time, trackpad.point)];
  endWheel(); showControls(); renderStats();
});
document.addEventListener('gesturechange', event => {
  event.preventDefault();
  if (pointers.size || !trackpad.anchor) return;
  accumulate(event);
  pinTrackpad();
  trackpad.time = performance.now();
  trackpad.samples.push(sample(trackpad.time, trackpad.point));
  trimSamples(trackpad.samples, WINDOW_MS);
  updateReset(); requestDraw();
});
document.addEventListener('gestureend', event => {
  event.preventDefault();
  if (!trackpad.anchor) return;
  accumulate(event, true);
  pinTrackpad();
  trackpad.time = performance.now();
  trackpad.samples.push(sample(trackpad.time, trackpad.point));
  trimSamples(trackpad.samples, WINDOW_MS);
  // Fingers lifting off a trackpad throw the zoom and the turn exactly as
  // fingers on a screen do; there is no pan in this stream to throw.
  const velocity = reducedMotion.matches ? NO_THROW : estimateVelocity(trackpad.samples, trackpad.time, {panGain: 0});
  if (!velocity.turn) {
    const snapped = snapAngle(view.angle);
    if (snapped !== view.angle) { const [width, height] = size(); view.pin(trackpad.anchor, trackpad.point, width, height, {angle: snapped}); }
  }
  startFling(velocity, trackpad.point);
  trackpad.anchor = null; trackpad.samples = [];
  updateReset(); requestDraw();
});
canvas.addEventListener('touchmove', event => event.preventDefault(), {passive: false});

// Every control that moves the view re-bases any trackpad gesture in progress,
// so a Mac can zoom and turn at once: pinch on the trackpad with one hand and
// hold ] or [ with the other, or turn with the keys and roll the wheel.
// Each of these drops any glide *first* — `stopFling` may put the scale back on
// its limit, and what the control then does must start from where that leaves
// the view (a reset excepted, which is going home whatever the glide was doing).
function resetView() { fling = null; view.reset(); endWheel(); trackpad.anchor = null; updateReset(); requestDraw(); showControls(); }
function zoomCenter(factor) { stopFling(); endWheel(); const [width, height] = size(); view.zoomAt(factor, [width / 2, height / 2], width, height); rebaseGesture(); updateReset(); requestDraw(); }
function turnCenter(delta) { stopFling(); endWheel(); const [width, height] = size(); view.rotateAt(delta, [width / 2, height / 2], width, height); rebaseGesture(); updateReset(); requestDraw(); }
function pan(dx, dy) { stopFling(); endWheel(); const [width, height] = size(); view.panBy(dx, dy, width, height); rebaseGesture(); updateReset(); requestDraw(); }

pauseButton.addEventListener('click', event => { togglePause(); if (event.detail) pauseButton.blur(); });
fullscreenButton.addEventListener('click', event => { toggleFullscreen(); if (event.detail) fullscreenButton.blur(); });
resetButton.addEventListener('click', event => { resetView(); if (event.detail) resetButton.blur(); });
generatorCheck.addEventListener('change', () => { setGenerators(generatorCheck.checked); showControls(); });
notationButton.addEventListener('click', event => { toggleLegend(); if (event.detail && legend.hidden) notationButton.blur(); });
legendClose.addEventListener('click', () => closeLegend());
nameLabel.addEventListener('click', toggleStats);
canvas.addEventListener('dblclick', toggleFullscreen);
document.addEventListener('pointermove', showControls, {passive: true});
document.addEventListener('pointerdown', showControls, {passive: true});
// A tap outside the panel dismisses it — on a phone that gesture is the natural
// one, and without this it pans the picture behind instead. A DRAG that happens
// to start outside must not: it is a pan, and the reader may well want the
// panel open while moving the picture under it.
let legendTap = null;
document.addEventListener('pointerdown', event => {
  legendTap = !legend.hidden && !legend.contains(event.target) && !controls.contains(event.target)
    ? [event.clientX, event.clientY] : null;
}, {passive: true});
document.addEventListener('pointerup', event => {
  if (legendTap && Math.hypot(event.clientX - legendTap[0], event.clientY - legendTap[1]) < 8) closeLegend({restore: false});
  legendTap = null;
}, {passive: true});
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
  if (key === 'escape') { if (!legend.hidden) { event.preventDefault(); closeLegend(); } return; }
  // Space belongs to whatever control has focus — a button, or the generator
  // checkbox — and pauses the animation only when nothing has.
  if (event.code === 'Space' && !['BUTTON', 'INPUT'].includes(event.target.tagName)) { event.preventDefault(); togglePause(); }
  else if (key === 'f') { event.preventDefault(); toggleFullscreen(); }
  else if (key === 's') { event.preventDefault(); toggleStats(); }
  else if (key === 'g') { event.preventDefault(); toggleGenerators(); }
  else if (key === 'n') { event.preventDefault(); toggleLegend(); }
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
    setGenerators(showGenerators, {remember: false});
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
