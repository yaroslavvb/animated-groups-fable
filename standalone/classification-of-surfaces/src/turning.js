// turning.js — how a drag turns the 3D view: a TURNTABLE.
//
// His note on the first version (Sun 15 Nov 2026): "Rotation is a little weird. If I do it in a circle, there is a
// drift." The renderer's own control (render3d.js onPointerMove) is a rolling ball: every step of the pointer turns
// the picture about the screen axis square to that step. Such steps do not commute, so a pointer that goes round a
// closed loop leaves the picture twisted about the line of sight, by (the loop's area) x (sensitivity squared):
// 70 degrees for one circle of 100 px radius in a 755 x 566 pane. That cannot be tuned away. Four ways of turning
// were offered behind a chooser (turntable, arcball, grab, the rolling ball); his choice the same evening: "make
// Turnable the default and get rid of chooser". So there is one:
//
//   left-right turns the picture about the vertical (world z), up-down tilts it, to straight above or below. "Up"
//   stays up, and the view is a function of where the pointer is, so any loop comes home exactly. No twist at all.
//
// How it sits on the renderer without changing it: the renderer's listeners are on the canvas and run first; this
// module listens on the canvas's parent, so each event reaches it afterwards and it simply sets the view it wants
// (R.setView), which also stops the renderer's momentum. Taps, double-tap to reset and a pinch's zoom stay the
// renderer's; a wheel without ctrl (a trackpad's two-finger swipe, a mouse wheel) turns, as a drag does (Sat 21 Nov
// 2026). The twist of a two-finger pinch (and of Safari's trackpad rotate) is taken out again, and the arrow keys turn
// and tilt instead of rolling the ball.

import { viewFromAzEl } from './vendor/the-folding/render3d.js';

const DEG = Math.PI / 180;

// quaternions [x, y, z, w]; the view q takes world to camera space (x right, y up, z toward the eye)
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

export function createTurning(R, pane, canvas) {
  const ptrs = new Map();
  let drag = null;          // one pointer down: { id, x0, y0, az0, el0, moved }
  const PAGE_SCROLL_HOLD_MS = 450;
  let pageScrollLatched = false, pageScrollUntil = 0;
  let lastPtrX = NaN, lastPtrY = NaN, scrollPtrX = NaN, scrollPtrY = NaN;
  const markPageScroll = () => {
    pageScrollLatched = true;
    pageScrollUntil = performance.now() + PAGE_SCROLL_HOLD_MS;
    scrollPtrX = lastPtrX;
    scrollPtrY = lastPtrY;
  };
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('scroll', markPageScroll, { passive: true });
  }
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('wheel', (e) => {
      if (e.target !== canvas && !(canvas.contains && canvas.contains(e.target))) markPageScroll();
    }, { capture: true, passive: true });
    document.addEventListener('pointermove', (e) => {
      const movedFromScroll = !Number.isFinite(scrollPtrX) || Math.hypot(e.clientX - scrollPtrX, e.clientY - scrollPtrY) > 6;
      lastPtrX = e.clientX; lastPtrY = e.clientY;
      if (pageScrollLatched && movedFromScroll && performance.now() > pageScrollUntil
          && (e.target === canvas || (canvas.contains && canvas.contains(e.target)))) {
        pageScrollLatched = false;
      }
    }, { capture: true, passive: true });
  }

  const sensitivity = () => { const b = canvas.getBoundingClientRect(); return Math.min(0.011, Math.max(0.0045, Math.PI / (0.85 * Math.max(1, Math.min(b.width, b.height))))) / DEG; };   // degrees per px, the renderer's own
  const tilt = (el) => Math.max(-89.9, Math.min(89.9, el));
  const level = () => { const v = R.getView(); if (!v || !v.q) return; const [az, el] = azElOf(v.q); R.setView({ q: viewFromAzEl(az, tilt(el)).q }); };

  function begin(id, x, y) {
    const v = R.getView();
    if (!v || !v.q) { drag = null; return; }
    const [az0, el0] = azElOf(v.q);
    drag = { id, x0: x, y0: y, az0, el0, moved: false };
  }
  function turn(x, y) {
    const d = drag, k = sensitivity();
    if (Math.hypot(x - d.x0, y - d.y0) > 3) d.moved = true;
    R.setView({ q: viewFromAzEl(d.az0 - (x - d.x0) * k, tilt(d.el0 + (y - d.y0) * k)).q });
  }

  // after the renderer has had each event (it listens on the canvas itself)
  pane.addEventListener('pointerdown', (e) => {
    if (e.target !== canvas || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pageScrollLatched = false; pageScrollUntil = 0;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) begin(e.pointerId, e.clientX, e.clientY); else drag = null;
  });
  pane.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 1 && drag && drag.id === e.pointerId) turn(e.clientX, e.clientY);
    else if (ptrs.size >= 2) level();            // a pinch zooms; its twist is taken out again
  });
  const end = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (drag && drag.id === e.pointerId) {
      if (drag.moved) { const v = R.getView(); if (v && v.q) R.setView({ q: v.q }); }      // no momentum: the view stops with the hand
      drag = null;
    }
    if (ptrs.size === 1) { const [id, p] = [...ptrs][0]; begin(id, p.x, p.y); }             // one finger of a pinch stays down: it goes on turning
  };
  pane.addEventListener('pointerup', end);
  pane.addEventListener('pointercancel', end);
  pane.addEventListener('gesturechange', level);
  // A trackpad's two-finger swipe turns the view, as a drag does (his note on the page, Sat 21 Nov 2026 20:12: on the
  // MacBook's trackpad a finger drag zoomed and never turned). Shepherd, the page's own agent, did it on the live page
  // at 20:15 by editing the built file (the renderer's wheel handler); this is that change in the source, with the
  // renderer left as it was: any wheel without ctrl turns, and only a pinch (ctrl+wheel in Chrome and Firefox; Safari's
  // gesture events) zooms. So a mouse wheel turns too and no longer zooms; wheel.js can tell a mouse's notch from a
  // swipe if the wheel is to zoom again (in this listener: return when wheelSorter() says 'wheel'). The renderer reads
  // every wheel as zoom, so this listens on the way down (capture) and keeps a turning wheel from the canvas. With
  // natural scrolling, the fingers moving right give deltaX < 0.
  pane.addEventListener('wheel', (e) => {
    if (e.target !== canvas || e.ctrlKey) return;
    if (pageScrollLatched) {
      pageScrollUntil = performance.now() + PAGE_SCROLL_HOLD_MS;
      e.stopPropagation();
      return;
    }
    e.preventDefault(); e.stopPropagation();
    if (drag) return;                              // a button is down as well: the drag has the view
    let dx = e.deltaX, dy = e.deltaY;
    if (e.deltaMode === 1) { dx *= 30; dy *= 30; } else if (e.deltaMode === 2) { dx *= 300; dy *= 300; }
    dx = Math.max(-240, Math.min(240, dx)); dy = Math.max(-240, Math.min(240, dy));
    if (!dx && !dy) return;
    const v = R.getView();
    if (!v || !v.q) return;
    const [az, el] = azElOf(v.q), k = sensitivity();
    R.setView({ q: viewFromAzEl(az + dx * k, tilt(el - dy * k)).q });
  }, { capture: true, passive: false });
  // the arrow keys turn and tilt (the renderer would roll the ball)
  pane.addEventListener('keydown', (e) => {
    if (e.target !== canvas || e.altKey || e.ctrlKey || e.metaKey) return;
    const step = { ArrowLeft: [9, 0], ArrowRight: [-9, 0], ArrowUp: [0, -9], ArrowDown: [0, 9] }[e.key];
    if (!step) return;
    e.preventDefault(); e.stopPropagation();
    const v = R.getView();
    if (!v || !v.q) return;
    const [az, el] = azElOf(v.q);
    R.setView({ q: viewFromAzEl(az + step[0], tilt(el + step[1])).q });
  }, true);

  return { mode: 'turntable' };
}
