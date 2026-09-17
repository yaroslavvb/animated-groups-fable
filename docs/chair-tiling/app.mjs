// Page controls for the chair tiling viewer.
//
// One finger (or the mouse) orbits, two fingers pan, pinch and turn, the wheel
// zooms about the pointer, and the keyboard does all of it. The scene is
// static, so frames are drawn on demand; the only animation is the explode,
// which is skipped when the device asks for reduced motion.
import {createCamera} from './camera.mjs';
import {COLOUR_MODES, createRenderer} from './renderer.mjs';

const canvas = document.querySelector('#view');
const notice = document.querySelector('#notice');
const controls = document.querySelector('#controls');
const caption = document.querySelector('#caption');
const hud = document.querySelector('#hud');
const levelLabel = document.querySelector('#level-label');
const levelDown = document.querySelector('#level-down');
const levelUp = document.querySelector('#level-up');
const explodeButton = document.querySelector('#explode');
const markingsButton = document.querySelector('#markings');
const coloursButton = document.querySelector('#colours');
const resetButton = document.querySelector('#reset');
const fullscreenButton = document.querySelector('#fullscreen');

const params = new URLSearchParams(location.search);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const phone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 500;
// 8^5 = 32768 chairs and 1.6M triangles is comfortable on a desktop GPU and
// not on a phone, so small touch screens stop one level earlier.
const MAX_LEVEL = phone ? 4 : 5;
// Rounded, not just clamped: ?level=2.7 would otherwise size a Float32Array by
// 8**2.7 and label the picture "Level 2.7".
const clampLevel = n => Math.max(0, Math.min(MAX_LEVEL, Math.round(n) || 0));
const startLevel = clampLevel(Number(params.get('level') ?? 1) || 0);

// The hexagonal silhouette of the bounding cube seen down its body diagonal
// has circumradius sqrt(2/3) times the cube's side.
const FIT = Math.sqrt(2 / 3);

let renderer, camera, scheduled = false;
let explode = 0, explodeTarget = 0, explodeFrom = 0, explodeStart = 0;
let showHud = params.get('stats') === '1';
let idleTimer;
// What the reader had set up, kept across a WebGL context loss.
let saved = null;

const size = () => [canvas.clientWidth || 1, canvas.clientHeight || 1];
const pixels = () => {
  const [w, h] = size();
  const dpr = Math.min(devicePixelRatio || 1, 2.5);
  return [Math.max(1, Math.round(w * dpr)), Math.max(1, Math.round(h * dpr))];
};

// While the caption is open as a side panel on a wide screen it would hide the
// left of the object. Rather than choose between the two, hand the camera the
// strip of canvas the panel leaves free and let it frame the object there.
function captionInset() {
  if (!caption.open) return 0;
  const right = caption.getBoundingClientRect().right + 16;
  // Once the panel wants half the page it is an overlay, not a column beside
  // the object, and there is no strip left worth framing into.
  return right < innerWidth * 0.5 ? right : 0;
}

function requestDraw() {
  if (scheduled || !renderer) return;
  scheduled = true;
  requestAnimationFrame(frame);
}

let frames = 0, fpsTime = 0, fps = 0;
function frame(time) {
  scheduled = false;
  if (!renderer) return;
  let animating = false;
  if (explode !== explodeTarget) {
    const t = reduceMotion ? 1 : Math.min(1, (time - explodeStart) / 520);
    const eased = t * t * (3 - 2 * t);
    explode = explodeFrom + (explodeTarget - explodeFrom) * eased;
    animating = t < 1;
  }
  renderer.state.explode = explode;
  const [pw, ph] = pixels();
  // Pulling the sub-chairs apart makes the object bigger; back the camera off
  // by the same factor, so the whole supertile stays in frame whatever the
  // reader has already zoomed or orbited to.
  const free = Math.max(0.35, 1 - captionInset() / Math.max(size()[0], 1));
  camera.fit(pw / ph, 1 + explode * (renderer.explodeRatio - 1), free);
  renderer.draw(camera.viewProjection(pw / ph), pw, ph, {
    direction: camera.basis().back,
    // The object's own centre and radius, not the camera's zoom, so the
    // aerial perspective stays put while you zoom in on a corner.
    centre: [renderer.size / 2, renderer.size / 2, renderer.size / 2],
    radius: renderer.size * 0.87,
  });
  if (showHud) {
    frames++;
    if (time - fpsTime >= 500) { fps = fpsTime ? frames * 1000 / (time - fpsTime) : 0; frames = 0; fpsTime = time; }
    hud.textContent = `${renderer.count} chairs · ${pw}x${ph} px · zoom ${camera.zoomLevel().toFixed(2)}x${fps ? ` · ${Math.round(fps)} fps` : ''}`;
  }
  hud.hidden = !showHud;
  if (animating) requestDraw();
}

function showControls() {
  document.body.classList.remove('quiet');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!controls.contains(document.activeElement)) document.body.classList.add('quiet');
  }, 6000);
}

// Kept in the layout whether or not it is usable: a button that appears the
// moment a drag starts would shift the whole bar under the reader's finger.
function updateReset() { resetButton.classList.toggle('invisible', camera.isHome()); }

function countLabel(n) {
  return n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function updateLevel() {
  const n = renderer.level;
  levelLabel.textContent = `Level ${n} · ${countLabel(renderer.count)}`;
  levelLabel.title = `${renderer.count} chair${renderer.count === 1 ? '' : 's'} in a supertile ${renderer.size} cells across`;
  levelDown.disabled = n <= 0;
  levelUp.disabled = n >= MAX_LEVEL;
  explodeButton.disabled = n === 0;
}

function setLevel(next) {
  const n = clampLevel(next);
  if (n === renderer.level) return;
  const before = renderer.size;
  renderer.setLevel(n);
  camera.rescale(renderer.size / before);
  // A single chair has nothing to pull apart, so drop the explode rather than
  // leave a disabled button reporting itself as pressed.
  if (n === 0 && explodeTarget !== 0) setExplode(false);
  updateLevel(); updateReset(); requestDraw(); showControls();
}

function setExplode(on) {
  explodeTarget = on ? 1 : 0;
  explodeFrom = explode;
  explodeStart = performance.now();
  explodeButton.setAttribute('aria-pressed', String(on));
  explodeButton.setAttribute('aria-label', on ? 'Push the sub-chairs back together' : 'Pull the eight sub-chairs apart');
  requestDraw(); showControls();
}

function describeMarkings() {
  const on = renderer.state.markings;
  markingsButton.setAttribute('aria-pressed', String(on));
  markingsButton.setAttribute('aria-label', on ? 'Hide the markings' : 'Show the markings');
}
function toggleMarkings() {
  renderer.state.markings = !renderer.state.markings;
  describeMarkings();
  requestDraw(); showControls();
}

const COLOUR_NAMES = ['plain', 'by sub-chair of the whole supertile', 'middle chairs against corner chairs'];
function describeColours() {
  coloursButton.title = `Colour: ${COLOUR_NAMES[renderer.state.colourMode]} · C`;
  coloursButton.setAttribute('aria-label', `Colouring: ${COLOUR_NAMES[renderer.state.colourMode]}. Change colouring.`);
}
function cycleColours() {
  renderer.state.colourMode = (renderer.state.colourMode + 1) % COLOUR_MODES.length;
  describeColours();
  requestDraw(); showControls();
}

function resetView() { camera.reset(); updateReset(); requestDraw(); showControls(); }

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.webkitFullscreenElement) document.webkitExitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else if (document.documentElement.webkitRequestFullscreen) document.documentElement.webkitRequestFullscreen();
  } catch { /* Some browsers refuse; the page is already full-bleed. */ }
  showControls();
}

function fullscreenChanged() {
  const full = !!(document.fullscreenElement || document.webkitFullscreenElement);
  fullscreenButton.setAttribute('aria-label', full ? 'Exit fullscreen' : 'Enter fullscreen');
  document.querySelector('#fullscreen-icon').setAttribute('d', full
    ? 'M9 4v5H4m11-5v5h5M4 15h5v5m11-5h-5v5'
    : 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5');
  requestDraw();
}

// Gestures ---------------------------------------------------------------
const pointers = new Map();
let gesture = null;

function summarize() {
  const points = [...pointers.values()];
  const mid = points.reduce(([x, y], p) => [x + p.x / points.length, y + p.y / points.length], [0, 0]);
  const dist = points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;
  const heading = points.length > 1 ? Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x) : 0;
  return {mid, dist, heading, count: points.length};
}

function beginGesture() {
  const s = summarize();
  gesture = s.count ? {...s, multi: s.count > 1} : null;
}

function moveGesture() {
  if (!gesture) return;
  const s = summarize();
  const [width, height] = size();
  if (gesture.multi && s.count > 1) {
    camera.panBy(s.mid[0] - gesture.mid[0], s.mid[1] - gesture.mid[1], height);
    if (gesture.dist > 8 && s.dist > 8) camera.zoomAt(s.dist / gesture.dist, s.mid[0], s.mid[1], width, height);
    camera.rollBy(-(s.heading - gesture.heading));
  } else if (!gesture.multi && s.count === 1) {
    camera.orbit(s.mid[0] - gesture.mid[0], s.mid[1] - gesture.mid[1]);
  }
  gesture = {...s, multi: gesture.multi};
  updateReset(); requestDraw();
}

canvas.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  try { canvas.setPointerCapture(event.pointerId); } catch { /* not capturable */ }
  pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
  beginGesture();
  document.body.classList.add('dragging');
  showControls();
});
canvas.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
  moveGesture();
});
for (const type of ['pointerup', 'pointercancel']) canvas.addEventListener(type, event => {
  if (!pointers.has(event.pointerId)) return;
  pointers.delete(event.pointerId);
  if (pointers.size) beginGesture();
  else { gesture = null; document.body.classList.remove('dragging'); }
});
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  if (event.ctrlKey && performance.now() - trackpad.time < 150) return;   // Safari sends the pinch twice
  const [width, height] = size();
  const step = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? 400 : 1;
  camera.zoomAt(Math.exp(-event.deltaY * step * (event.ctrlKey ? 0.01 : 0.0022)), event.clientX, event.clientY, width, height);
  updateReset(); requestDraw(); showControls();
}, {passive: false});
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('touchmove', event => event.preventDefault(), {passive: false});

// Safari reports trackpad pinch and twist as gesture events with a cumulative
// scale and rotation; they only apply when no fingers are down on the canvas.
const trackpad = {time: -Infinity, active: false, scale: 1, rotation: 0, point: [0, 0]};
document.addEventListener('gesturestart', event => {
  event.preventDefault();
  if (pointers.size || event.target !== canvas) return;
  trackpad.active = true; trackpad.scale = 1; trackpad.rotation = 0;
  trackpad.point = [event.clientX, event.clientY];
  trackpad.time = performance.now();
  showControls();
});
document.addEventListener('gesturechange', event => {
  event.preventDefault();
  if (!trackpad.active) return;
  const [width, height] = size();
  if (event.scale > 0 && trackpad.scale > 0) camera.zoomAt(event.scale / trackpad.scale, trackpad.point[0], trackpad.point[1], width, height);
  camera.rollBy(-(event.rotation - trackpad.rotation) * Math.PI / 180);
  trackpad.scale = event.scale; trackpad.rotation = event.rotation; trackpad.time = performance.now();
  updateReset(); requestDraw();
});
document.addEventListener('gestureend', event => {
  event.preventDefault();
  trackpad.active = false; trackpad.time = performance.now();
});

// Buttons and keys -------------------------------------------------------
levelDown.addEventListener('click', () => setLevel(renderer.level - 1));
levelUp.addEventListener('click', () => setLevel(renderer.level + 1));
explodeButton.addEventListener('click', () => setExplode(explodeTarget === 0));
markingsButton.addEventListener('click', toggleMarkings);
coloursButton.addEventListener('click', cycleColours);
resetButton.addEventListener('click', resetView);
fullscreenButton.addEventListener('click', toggleFullscreen);
// A double tap is how people zoom into a picture, so this stays on real
// pointers: on a touch screen it would throw the page into fullscreen instead.
if (matchMedia('(pointer: fine)').matches) canvas.addEventListener('dblclick', toggleFullscreen);
// Whether the reader is working inside the caption, in which case the arrow
// keys scroll its prose instead of orbiting the model. Tracked rather than read
// off document.activeElement, because WebKit will not focus a scrollable div.
let inCaption = false;
const captionBody = caption.querySelector('.body');
// Opening the panel re-frames the object beside it.
caption.addEventListener('toggle', () => { if (!caption.open) inCaption = false; showControls(); requestDraw(); });
caption.addEventListener('pointerdown', () => { inCaption = true; });
caption.addEventListener('focusin', () => { inCaption = true; });
canvas.addEventListener('pointerdown', () => { inCaption = false; });

document.addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
  showControls();
  const key = event.key.toLowerCase();
  // The prose is longer than the panel, so while the reader is in it the
  // scrolling keys belong to the caption. Everything else still works.
  if (caption.open && (inCaption || caption.contains(event.target))) {
    const page = Math.max(48, captionBody.clientHeight * 0.85);
    const step = {arrowdown: 56, arrowup: -56, pagedown: page, pageup: -page,
      ' ': page, home: -1e7, end: 1e7}[key];
    if (step !== undefined) { event.preventDefault(); captionBody.scrollTop += step; return; }
  }
  const orbitStep = event.shiftKey ? 90 : 26;
  const act = {
    arrowleft: () => camera.orbit(-orbitStep, 0), arrowright: () => camera.orbit(orbitStep, 0),
    arrowup: () => camera.orbit(0, -orbitStep), arrowdown: () => camera.orbit(0, orbitStep),
    '+': () => camera.zoomBy(1.25), '=': () => camera.zoomBy(1.25),
    '-': () => camera.zoomBy(0.8), _: () => camera.zoomBy(0.8),
    0: () => camera.reset(), home: () => camera.reset(),
    ']': () => setLevel(renderer.level + 1), '[': () => setLevel(renderer.level - 1),
    e: () => { if (!explodeButton.disabled) setExplode(explodeTarget === 0); },
    m: toggleMarkings,
    c: cycleColours,
    f: toggleFullscreen,
    i: () => { caption.open = !caption.open; },
    s: () => { showHud = !showHud; },
  }[key];
  if (!act) return;
  event.preventDefault();
  act();
  updateReset(); requestDraw();
});

document.addEventListener('pointermove', showControls, {passive: true});
document.addEventListener('focusin', showControls);
document.addEventListener('fullscreenchange', fullscreenChanged);
document.addEventListener('webkitfullscreenchange', fullscreenChanged);
window.addEventListener('resize', () => { requestDraw(); showControls(); });
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  // Keep what the reader set up; the GPU only took the buffers away.
  saved = {level: renderer.level, markings: renderer.state.markings, colourMode: renderer.state.colourMode};
  renderer = null;
  notice.textContent = 'Restoring the view…'; notice.hidden = false;
});
canvas.addEventListener('webglcontextrestored', () => start());

function start() {
  const restoring = saved !== null;
  try {
    renderer = createRenderer(canvas, {level: restoring ? saved.level : startLevel});
    if (restoring) { renderer.state.markings = saved.markings; renderer.state.colourMode = saved.colourMode; }
    const side = renderer.size;
    camera = camera ?? createCamera();
    // On a restore the viewpoint is still in the camera; only re-derive the
    // home framing, so the reader does not lose the corner they were looking at.
    camera.setHome({target: [side / 2, side / 2, side / 2], radius: FIT * side, keepView: restoring});
    const [pw, ph] = pixels();
    camera.fit(pw / ph, 1, Math.max(0.35, 1 - captionInset() / Math.max(size()[0], 1)));
    canvas.dataset.ready = 'true';
    notice.textContent = 'Building the tiling…';
    notice.hidden = true;
    saved = null;
    updateLevel(); updateReset(); describeColours(); describeMarkings();
    // Wide enough for the panel to sit beside the object rather than over it.
    if (!restoring && !phone && innerWidth >= 1000) caption.open = true;
    showControls(); requestDraw();
  } catch (error) {
    notice.textContent = error.message;
    notice.hidden = false;
  }
}

start();
