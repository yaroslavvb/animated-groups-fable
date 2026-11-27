// wheel.js — is a wheel event a trackpad's two-finger swipe, or a mouse wheel / a pinch?
//
// NOT USED BY THE PAGE (Sun 22 Nov 2026): kept, with its tests, for the day a mouse wheel should zoom again. Since Sat
// 21 Nov every wheel without ctrl turns the 3D view and slides the pattern (turning.js, pattern.js), so a mouse wheel
// no longer zooms. To give the wheel its zoom back, keep a swipe turning and let the rest through to the renderer: in
// turning.js's wheel listener, `if (sort(e, performance.now()) !== 'swipe') return;` with `const sort = wheelSorter()`.
//
// His note on the page (Sat 21 Nov 2026, 20:12): on the MacBook's trackpad a finger drag zooms but never turns, while
// the mouse works. A two-finger swipe reaches a page as wheel events, and the renderer reads every wheel event as zoom
// (render3d.js onWheel). This tells a swipe (to turn) from what would still zoom:
//   - a pinch: ctrl+wheel in Chrome and Firefox (Safari sends gesture events, which never come here);
//   - a mouse wheel: its notches. Chrome and Safari give the old wheelDelta beside the new delta. A trackpad's precise
//     scroll has wheelDelta = -3 x delta (pixels / 40 x 120); a mouse notch on macOS is 120 against about 4 px
//     (Chrome: 4.000244140625 a notch, the step mapbox-gl reads as a wheel), and 120 against 100 or so elsewhere;
//   - anything counted in lines or pages (deltaMode 1 or 2: Firefox's mouse wheel).
// One gesture keeps the kind its first event got: a swipe's last momentum events must not turn into zoom half-way.

export const MOUSE_STEP = 4.000244140625;
const GAP = 240;                  // ms without a wheel event: the next one starts a new gesture

const near = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
const notch = (d) => d !== 0 && near(d / MOUSE_STEP, Math.round(d / MOUSE_STEP));
// wheelDelta is a whole number, delta need not be: a precise scroll of 1.5 px can come with -4 or -5. A notch is far
// off either way (120 against 12 on a Mac, against 300 elsewhere).
const threeTimes = (w, d) => Math.abs(w + 3 * d) <= Math.max(1.5, 0.02 * Math.abs(3 * d));

/** The kind of one wheel event taken alone: 'swipe', 'wheel' (a mouse wheel) or 'pinch'. */
export function wheelKind(e) {
  if (e.ctrlKey) return 'pinch';
  if (e.metaKey || e.altKey || e.shiftKey) return 'wheel';
  if (e.deltaMode !== 0) return 'wheel';
  const dx = e.deltaX || 0, dy = e.deltaY || 0;
  if (!dx && !dy) return 'wheel';
  if (dx === 0 && notch(dy)) return 'wheel';                                  // Chrome on macOS: a mouse notch
  const wx = e.wheelDeltaX, wy = e.wheelDeltaY;
  if (typeof wy === 'number' && typeof wx === 'number' && (wx || wy)) {
    return threeTimes(wy, dy) && threeTimes(wx, dx) ? 'swipe' : 'wheel';     // a precise scroll, or a notch
  }
  return dx !== 0 ? 'swipe' : 'wheel';                                         // no wheelDelta (Firefox): only a sideways scroll counts
}

/** A small memory across events, so that one gesture keeps one kind. Returns (event, now in ms) => kind. */
export function wheelSorter() {
  let kind = null, at = -1e9;
  return (e, now) => {
    const k = wheelKind(e);
    if (k === 'pinch') { kind = null; at = now; return k; }
    if (kind === null || now - at > GAP) kind = k;
    at = now;
    return kind;
  };
}
