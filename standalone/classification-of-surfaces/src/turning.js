// turning.js — how a drag turns the 3D view: four ways to choose from (his ask, Sun 15 Nov 2026: "Rotation is a
// little weird. If I do it in a circle, there is a drift").
//
// The renderer's own control (render3d.js onPointerMove) is a ROLLING BALL: every step of the pointer turns the
// picture about the screen axis square to that step. Such steps do not commute, so a pointer that goes round a
// closed loop leaves the picture twisted about the line of sight, by (the loop's area) x (sensitivity squared):
// 70 degrees for one circle of 100 px radius in a 755 x 566 pane. That is the drift, and it is how a rolling ball
// is meant to behave; it cannot be tuned away.
//
//   rolling     the renderer's own, untouched: free, with momentum; circles twist the picture
//   turntable   left-right turns the picture about the vertical (world z), up-down tilts it; "up" stays up, the
//               view is a function of where the pointer is, so any loop comes home exactly. No twist at all
//   arcball     Shoemake's: the pointer grabs a point of a ball that fills the pane; the turn is the one that takes
//               the grabbed point to the pointer, at double speed. Comes home on any loop; dragging round the rim
//               twists the picture on purpose
//   grab        the same ball at single speed, with Bell's flare outside it: the point you grabbed stays under the
//               pointer. Comes home on any loop
//
// How it sits on the renderer without changing it: the renderer's listeners are on the canvas and run first; this
// module listens on the canvas's parent, so each event reaches it afterwards and it simply sets the view it wants
// (R.setView), which also stops the renderer's momentum. Taps, double-tap to reset, wheel and pinch zoom stay the
// renderer's. In turntable mode the twist of a two-finger pinch (and of Safari's trackpad rotate) is taken out
// again, and the arrow keys turn and tilt instead of rolling the ball.

import { viewFromAzEl } from './vendor/the-folding/render3d.js';

export const MODES = [
  { key: 'turntable', label: 'Turntable' },
  { key: 'arcball', label: 'Arcball' },
  { key: 'grab', label: 'Grab' },
  { key: 'rolling', label: 'Rolling ball' },
];
export const DEFAULT_MODE = 'turntable';
const DEG = Math.PI / 180;
const STORE = 'classification-of-surfaces.turning';

// quaternions [x, y, z, w]; the view q takes world to camera space (x right, y up, z toward the eye)
function qMul(a, b) {       // a after b
  return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
}
const qNorm = (q) => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };
/** Where the eye is, seen from the middle of the scene (the camera's z axis in world coordinates). */
export const eyeOf = (q) => [2 * (q[0] * q[2] - q[3] * q[1]), 2 * (q[1] * q[2] + q[3] * q[0]), 1 - 2 * (q[0] * q[0] + q[1] * q[1])];
const upOf = (q) => [2 * (q[0] * q[1] + q[3] * q[2]), 1 - 2 * (q[0] * q[0] + q[2] * q[2]), 2 * (q[1] * q[2] - q[3] * q[0])];
const rightOf = (q) => [1 - 2 * (q[1] * q[1] + q[2] * q[2]), 2 * (q[0] * q[1] - q[3] * q[2]), 2 * (q[0] * q[2] + q[3] * q[1])];

/** Azimuth and elevation (degrees) of a view, whatever twist it has. */
export function azElOf(q) {
  const d = eyeOf(q), el = Math.asin(Math.max(-1, Math.min(1, d[2])));
  let az;
  if (Math.cos(el) > 1e-3) az = Math.atan2(d[0], -d[1]);
  else { const u = upOf(q); az = d[2] > 0 ? Math.atan2(-u[0], u[1]) : Math.atan2(u[0], -u[1]); }     // straight down / up: read it off "up"
  return [az / DEG, el / DEG];
}
/** How far a view is twisted about the line of sight, in degrees: 0 when the world's "up" is up on the screen. */
export function twistOf(q) {
  const r = rightOf(q), u = upOf(q);
  return Math.atan2(r[2], u[2]) / DEG;      // the world z axis as seen on the screen: straight up means no twist
}

/** The point of the control ball under a pointer, in camera space. flare: Bell's sheet outside the ball (no rim). */
function ballPoint(x, y, rect, flare) {
  const r = 0.46 * Math.min(rect.width, rect.height), px = (x - (rect.left + rect.width / 2)) / r, py = -(y - (rect.top + rect.height / 2)) / r, d2 = px * px + py * py;
  if (flare) { const z = d2 <= 0.5 ? Math.sqrt(1 - d2) : 0.5 / Math.sqrt(d2), l = Math.hypot(px, py, z); return [px / l, py / l, z / l]; }
  if (d2 <= 1) return [px, py, Math.sqrt(1 - d2)];
  const l = Math.sqrt(d2);
  return [px / l, py / l, 0];
}

export function createTurning(R, pane, canvas) {
  let mode = DEFAULT_MODE;
  try { const m = window.localStorage.getItem(STORE); if (MODES.some((x) => x.key === m)) mode = m; } catch (e) { /* no storage here: the default */ }
  const ptrs = new Map();
  let drag = null;          // one pointer down: { id, x0, y0, q0, az0, el0, v0, moved }
  const listeners = new Set();

  const sensitivity = () => { const b = canvas.getBoundingClientRect(); return Math.min(0.011, Math.max(0.0045, Math.PI / (0.85 * Math.max(1, Math.min(b.width, b.height))))) / DEG; };   // degrees per px, the renderer's own
  const level = () => { const v = R.getView(); if (!v || !v.q) return; const [az, el] = azElOf(v.q); R.setView({ q: viewFromAzEl(az, Math.max(-89.9, Math.min(89.9, el))).q }); };

  function begin(id, x, y) {
    const v = R.getView();
    if (!v || !v.q) { drag = null; return; }
    const [az0, el0] = azElOf(v.q);
    drag = { id, x0: x, y0: y, q0: v.q.slice(), az0, el0, v0: ballPoint(x, y, canvas.getBoundingClientRect(), mode === 'grab'), moved: false };
  }
  function turn(x, y) {
    const d = drag;
    if (Math.hypot(x - d.x0, y - d.y0) > 3) d.moved = true;
    if (mode === 'turntable') {
      const k = sensitivity(), el = Math.max(-89.9, Math.min(89.9, d.el0 + (y - d.y0) * k));
      R.setView({ q: viewFromAzEl(d.az0 - (x - d.x0) * k, el).q });
      return;
    }
    const v1 = ballPoint(x, y, canvas.getBoundingClientRect(), mode === 'grab'), v0 = d.v0;
    const c = [v0[1] * v1[2] - v0[2] * v1[1], v0[2] * v1[0] - v0[0] * v1[2], v0[0] * v1[1] - v0[1] * v1[0]], dot = v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2];
    let qd;
    if (mode === 'arcball') qd = qNorm([c[0], c[1], c[2], dot]);                       // twice the angle between the two points
    else { const s = Math.hypot(c[0], c[1], c[2]), half = Math.atan2(s, dot) / 2, k = s > 1e-9 ? Math.sin(half) / s : 0; qd = [c[0] * k, c[1] * k, c[2] * k, Math.cos(half)]; }
    R.setView({ q: qNorm(qMul(qd, d.q0)) });
  }

  // after the renderer has had each event (it listens on the canvas itself)
  pane.addEventListener('pointerdown', (e) => {
    if (e.target !== canvas || (e.pointerType === 'mouse' && e.button !== 0)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mode === 'rolling') return;
    if (ptrs.size === 1) begin(e.pointerId, e.clientX, e.clientY); else drag = null;
  });
  pane.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (mode === 'rolling') return;
    if (ptrs.size === 1 && drag && drag.id === e.pointerId) turn(e.clientX, e.clientY);
    else if (ptrs.size >= 2 && mode === 'turntable') level();            // a pinch zooms; its twist is taken out again
  });
  const end = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (mode === 'rolling') { drag = null; return; }
    if (drag && drag.id === e.pointerId) {
      if (drag.moved) { const v = R.getView(); if (v && v.q) R.setView({ q: v.q }); }      // no momentum: the view stops with the hand
      drag = null;
    }
    if (ptrs.size === 1) { const [id, p] = [...ptrs][0]; begin(id, p.x, p.y); }             // one finger of a pinch stays down: it goes on turning
  };
  pane.addEventListener('pointerup', end);
  pane.addEventListener('pointercancel', end);
  pane.addEventListener('gesturechange', () => { if (mode === 'turntable') level(); });
  // the arrow keys: on a turntable they turn and tilt (the renderer would roll the ball)
  pane.addEventListener('keydown', (e) => {
    if (mode !== 'turntable' || e.target !== canvas || e.altKey || e.ctrlKey || e.metaKey) return;
    const step = { ArrowLeft: [9, 0], ArrowRight: [-9, 0], ArrowUp: [0, -9], ArrowDown: [0, 9] }[e.key];
    if (!step) return;
    e.preventDefault(); e.stopPropagation();
    const v = R.getView();
    if (!v || !v.q) return;
    const [az, el] = azElOf(v.q);
    R.setView({ q: viewFromAzEl(az + step[0], Math.max(-89.9, Math.min(89.9, el + step[1]))).q });
  }, true);

  return {
    get mode() { return mode; },
    setMode(m) {
      if (!MODES.some((x) => x.key === m) || m === mode) return;
      mode = m; drag = null;
      try { window.localStorage.setItem(STORE, m); } catch (e) { /* not kept, that is all */ }
      for (const fn of listeners) fn(mode);
    },
    onMode(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
