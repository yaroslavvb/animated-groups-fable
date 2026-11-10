// timeline.js — the scrubber: continuous time with soft detents at the fold's stops, and Fold / Unfold playback.
// OWNER: shell agent. No dependencies; the pure mapping functions run in node (test/timeline.test.js).
//
//   createTimeline({ slider, button, onChange }) -> { setStops, setDuration, set, get, play, stop, isPlaying, toggle, destroy }
//
//   slider    <input type="range">. The timeline owns its min / max / step / value (0..1, step "any").
//             If it sits in a wrapper marked [data-scrub] (see src/index.template.html), the wrapper gets the CSS
//             variable --p (thumb position 0..1, drives the accent fill), ticks are drawn into its [data-ticks] child,
//             and pointer input is taken over (enhanceRange) so the whole 44 px box scrubs — iOS Safari natively
//             drags a range only from its thumb.
//   button    the Fold / Unfold button. Its text (or the text of a [data-label] child) reads
//             Fold -> Pause (while playing) -> Unfold -> Pause -> Fold; button.dataset.state = 'fold' | 'pause' | 'unfold'.
//   onChange  onChange(t) is called for every change of t that the PERSON or PLAYBACK causes: scrubbing, keys,
//             every animation frame, and the final exact frame (t === target).
//             It is NOT called by set(), setStops() or setDuration(): the caller already knows what it asked for.
//   onState   optional: onState('fold' | 'pause' | 'unfold') whenever the button's state changes — 'pause' means it
//             is playing; the other two say what the idle button would do. (Not called for the initial state.)
//
//   setStops([{t, label}])  the fold's main points (magnets + ticks); 0 and 1 are added if missing; keeps t.
//   setDuration(sec)        seconds for a full 0 -> 1 play; a partial play takes the proportional time.
//   set(t)                  jump to t (silently), stopping playback.
//   get()                   current t in [0, 1].
//   play(target?)           animate from the current t to target (default: whatever the button would do). No jump:
//                           eased start and stop, and a stalled frame (hidden tab) advances at most 0.1 s of motion.
//   stop()                  pause where it is.            isPlaying() -> boolean.          toggle() = button press.
//   Round 3 additions: getThumb() -> the thumb's position p (0..1 along the track, what the slider shows);
//   opts.minZonePx (default 10) and opts.trackPx (the track's usable width in px, for hosts without layout; in a
//   page it is measured from the [data-scrub] box, and followed with a ResizeObserver).
//
// The soft detent. The thumb position p (0..1 along the track) is NOT t. Far from every stop t = p. Within a zone of
// half-width w around a stop s (w = 3.5 % of the track, but never under 10 px, so a finger on a phone can feel it),
// with d = p - s and u = |d| / w:
//        t - s = sign(d) * w * F(u),     F(u) = u - u (1 - u)^3
// F(0) = 0 with slope 0: the stop is a fixed point where the map is flat (a slight magnet; the thumb still moves
// freely and t never jumps). F(1) = 1, F'(1) = 1 and F''(1) = 0: t rejoins t = p at the zone's edge with no step in
// the slope (v1's power law |d|^1.6 stepped from slope 1.6 to 1 there). The largest slope is F'(1/2) = 1.25.
// Zones of stops closer than 2w are cut at the midpoint between them (each side scaled to its own half-width).
//
// While the fold PLAYS, t runs at constant speed, and drawing the thumb at p = timeToPosition(t) would make it race
// through every tick (the inverse map is steep at a stop). So a play moves the thumb in proportion to t, from where
// it was to where the target lives: never faster than t, the same speed through a tick as anywhere else. A pause
// part-way then lets the thumb settle in 150 ms onto timeToPosition(t), at most 0.4 % of the track away (t does not
// move); grabbing the thumb mid-play puts it there at once, so the drag starts from the exact t.
//
// Space toggles the play from anywhere except a control that owns Space: a text field, a select, an open dialog —
// or a button reached by the KEYBOARD (Tab), which Space presses. A button focused by a mouse click or a tap does
// not keep Space: after clicking a preset chip or "Reset view", Space plays or pauses (and the button is not pressed
// again). Chrome already reports :focus-visible during that keydown, so the way the button got focus is read when
// it got it (focusin).

export const DETENT = 0.035;        // half-width of a detent zone, as a fraction of the track
export const DETENT_MIN_PX = 10;    // ... but never narrower than this many px
export const DETENT_MAX_SLOPE = 1.25;   // the steepest dt/dp anywhere (F'(1/2))
const DETENT_MAX = 0.08;            // a zone never takes more than 8 % of the track on each side, however short it is
const ENDS = [0, 1];
const END_EPS = 1e-4;               // "is at the end" for the button label
const MIN_PLAY = 0.35;              // seconds: the shortest animation, however small the distance
const MAX_STEP = 0.1;               // seconds of motion one frame may advance (a stalled tab must not cause a jump)
const SETTLE = 0.15;                // seconds for the thumb to settle onto the detent after a pause
const KEY_STEP = 0.01, KEY_STEP_BIG = 0.1;

const clamp01 = (x) => (x > 0 ? (x < 1 ? x : 1) : 0);   // NaN -> 0

/** Clean a list of stops (numbers or {t, label}): clamp to [0,1], sort, merge duplicates, make sure 0 and 1 exist. */
export function normalizeStops(stops) {
  const all = [];
  if (Array.isArray(stops)) {
    for (const s of stops) {
      let t = typeof s === 'number' ? s : s && typeof s.t === 'number' ? s.t : NaN;
      if (!Number.isFinite(t)) continue;
      t = clamp01(t);
      if (t < 1e-6) t = 0; else if (t > 1 - 1e-6) t = 1;
      all.push({ t, label: s && typeof s.label === 'string' ? s.label : '' });
    }
  }
  all.push({ t: 0, label: '' }, { t: 1, label: '' });
  all.sort((a, b) => a.t - b.t);
  const out = [];
  for (const s of all) {
    const prev = out[out.length - 1];
    if (prev && s.t - prev.t < 1e-6) { if (!prev.label && s.label) prev.label = s.label; continue; }
    out.push(s);
  }
  return out;
}

/** Sorted stop times, including 0 and 1 — the form positionToTime / timeToPosition expect. */
export function stopTimes(stops) { return normalizeStops(stops).map((s) => s.t); }

function nearestStop(x, ts) {
  let k = -1, best = Infinity;
  for (let i = 0; i < ts.length; i++) {
    const d = Math.abs(x - ts[i]);
    if (d < best) { best = d; k = i; }
  }
  return k;
}

// Half-width of stop k's zone on one side: w, but never past the midpoint to the neighbouring stop.
function zoneHalf(ts, k, rightSide, w) {
  const gap = rightSide ? (k + 1 < ts.length ? ts[k + 1] - ts[k] : Infinity) : (k > 0 ? ts[k] - ts[k - 1] : Infinity);
  return Math.min(w, gap / 2);
}

/** The detent's profile on [0, 1]: F(u) = u - u (1 - u)^3. F(0) = 0, F'(0) = 0, F(1) = 1, F'(1) = 1, F''(1) = 0. */
export function detentShape(u) {
  if (!(u > 0)) return 0;
  if (u >= 1) return 1;
  const v = 1 - u;
  return u - u * v * v * v;
}

/** The inverse of detentShape on [0, 1] (Newton's method kept inside a shrinking bracket; exact to ~1e-15). */
export function detentShapeInverse(y) {
  if (!(y > 0)) return 0;
  if (y >= 1) return 1;
  let lo = 0, hi = 1, u = Math.max(y, Math.sqrt(y / 3));      // F(u) ~ 3u^2 near 0, ~ u near 1
  if (u >= 1) u = 0.5;
  for (let i = 0; i < 60; i++) {
    const v = 1 - u, f = u - u * v * v * v - y;
    if (f === 0) return u;
    if (f > 0) hi = u; else lo = u;
    const df = 1 - v * v * v + 3 * u * v * v;                     // F'(u)
    let next = df > 0 ? u - f / df : (lo + hi) / 2;
    if (!(next > lo && next < hi)) next = (lo + hi) / 2;
    if (Math.abs(next - u) <= 1e-16) return next;
    u = next;
  }
  return u;
}

function detent(x, ts, w, inverse) {
  x = clamp01(x);
  const k = nearestStop(x, ts);
  if (k < 0) return x;
  const s = ts[k], d = x - s, a = Math.abs(d);
  const half = zoneHalf(ts, k, d >= 0, w);
  if (!(a < half)) return x;
  const r = half * (inverse ? detentShapeInverse(a / half) : detentShape(a / half));
  return d < 0 ? s - r : s + r;
}

/** Half-width of a detent zone (fraction of the track) for a track `trackPx` px long: 3.5 %, at least 10 px. */
export function detentZone(trackPx, minPx = DETENT_MIN_PX) {
  if (!(trackPx > 0)) return DETENT;
  return Math.min(DETENT_MAX, Math.max(DETENT, minPx / trackPx));
}

/** Thumb position p (0..1 along the track) -> time t. `ts`: sorted stop times (see stopTimes); `w`: zone half-width. */
export function positionToTime(p, ts = ENDS, w = DETENT) { return detent(p, ts, w, false); }

/** Time t -> thumb position p: the exact inverse of positionToTime. */
export function timeToPosition(t, ts = ENDS, w = DETENT) { return detent(t, ts, w, true); }

/** Playback easing on [0,1]: constant speed with a linear run-up and run-down over the fraction r at each end (C1). */
export function easePlay(x, r = 0.18) {
  if (!(x > 0)) return 0;
  if (x >= 1) return 1;
  const v = 1 / (1 - r);
  if (x < r) return (0.5 * v * x * x) / r;
  if (x > 1 - r) { const y = 1 - x; return 1 - (0.5 * v * y * y) / r; }
  return v * (x - r / 2);
}

function scrubWrap(input) {
  const w = input && input.parentElement;
  return w && typeof w.hasAttribute === 'function' && w.hasAttribute('data-scrub') ? w : null;
}

const finite = (v, fallback) => { const n = Number(v); return v !== '' && v != null && Number.isFinite(n) ? n : fallback; };

/**
 * Take over pointer input of an <input type="range"> that sits in a [data-scrub] wrapper: a press anywhere in the
 * wrapper's box moves the thumb there and drags it; a press on the thumb drags it without a jump. The input keeps its
 * value, focus, keyboard and accessibility; 'input' events (and 'change' on release) are dispatched as the browser
 * would. Idempotent. Without a wrapper it does nothing and the native behaviour stays. Returns a function that undoes it.
 */
export function enhanceRange(input) {
  const wrap = scrubWrap(input);
  if (!wrap || typeof wrap.addEventListener !== 'function' || wrap.hasAttribute('data-enhanced')) return () => {};
  wrap.setAttribute('data-enhanced', '');
  if (wrap.style) wrap.style.touchAction = 'none';
  let drag = null;

  const fraction = () => {
    const lo = finite(input.min, 0), hi = finite(input.max, 100);
    return hi > lo ? clamp01((Number(input.value) - lo) / (hi - lo)) : 0;
  };
  const setFraction = (f) => {
    const lo = finite(input.min, 0), hi = finite(input.max, 100), before = input.value;
    input.value = String(lo + clamp01(f) * (hi - lo));
    if (input.value !== before) input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const thumbSize = () => {
    const view = wrap.ownerDocument && wrap.ownerDocument.defaultView;
    const px = view ? parseFloat(view.getComputedStyle(wrap).getPropertyValue('--thumb')) : NaN;
    return px > 0 ? px : 22;
  };
  const onDown = (e) => {
    if (drag || input.disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const r = wrap.getBoundingClientRect(), thumb = thumbSize();
    const x0 = r.left + thumb / 2, usable = Math.max(1, r.width - thumb);   // where the thumb's centre can be
    const thumbX = x0 + fraction() * usable;
    const onThumb = Math.abs(e.clientX - thumbX) <= Math.max(22, thumb);    // grabbed: keep the offset, no jump
    drag = { id: e.pointerId, x0, usable, off: onThumb ? e.clientX - thumbX : 0, start: input.value };
    try { wrap.setPointerCapture(e.pointerId); } catch { /* synthetic or stale pointer */ }
    if (typeof input.focus === 'function') input.focus({ preventScroll: true });
    if (!onThumb) setFraction((e.clientX - x0) / usable);
    e.preventDefault();
  };
  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    setFraction((e.clientX - drag.off - drag.x0) / drag.usable);
    e.preventDefault();
  };
  const onEnd = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const changed = input.value !== drag.start;
    drag = null;
    try { wrap.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (changed) input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const types = [['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onEnd], ['pointercancel', onEnd], ['lostpointercapture', onEnd]];
  for (const [type, fn] of types) wrap.addEventListener(type, fn);
  return () => {
    for (const [type, fn] of types) wrap.removeEventListener(type, fn);
    wrap.removeAttribute('data-enhanced');
    drag = null;
  };
}

// Focus on one of these means Space belongs to it, not to play / pause. (A range input has no use for Space, so the
// Wavy slider does not swallow it.)
const OWNS_SPACE = 'button, a[href], input:not([type="range"]), select, textarea, summary, dialog, [contenteditable], [role="dialog"], ' +
  '[role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="menuitem"], [role="option"], [role="textbox"]';
const OPEN_MODAL = '[aria-modal="true"]:not([hidden]):not([aria-hidden="true"]), dialog[open]';

// Is the element really on screen? (A closed picker may stay in the DOM, hidden by display, visibility or opacity.)
function isShown(el) {
  if (typeof el.checkVisibility === 'function') {
    return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, opacityProperty: true, visibilityProperty: true });
  }
  if (typeof el.getClientRects === 'function' && !el.getClientRects().length) return false;
  const view = el.ownerDocument && el.ownerDocument.defaultView;
  const cs = view && typeof view.getComputedStyle === 'function' ? view.getComputedStyle(el) : null;
  return !cs || (cs.visibility !== 'hidden' && cs.opacity !== '0');
}

// A button (not a text field, select, dialog...) is the one kind of control that gives Space back when a pointer focused it.
const BUTTON_LIKE = 'button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"], summary';

// Was `el` focused by a pointer (mouse click, tap) rather than by the keyboard? Read when it gets focus: during a
// later keydown Chrome already counts it as keyboard-focused. Without :focus-visible support: a press within 1 s.
function focusedByPointer(el, pressedAgo) {
  try { if (typeof el.matches === 'function') return !el.matches(':focus-visible'); } catch { /* old engine */ }
  return pressedAgo < 1000;
}

export function createTimeline(opts = {}) {
  const { slider, button = null, onChange = null } = opts;
  if (!slider) throw new Error('createTimeline: `slider` is required');
  const text = { fold: 'Fold', unfold: 'Unfold', pause: 'Pause', ...(opts.labels || {}) };
  const G = globalThis;
  const doc = slider.ownerDocument || G.document || null;
  const now = opts.now || (() => (G.performance ? G.performance.now() : Date.now()));
  const raf = opts.raf || (typeof G.requestAnimationFrame === 'function' ? (f) => G.requestAnimationFrame(f) : (f) => setTimeout(f, 16));
  const caf = opts.caf || (typeof G.cancelAnimationFrame === 'function' ? (id) => G.cancelAnimationFrame(id) : (id) => clearTimeout(id));
  const wrap = scrubWrap(slider);
  const tickBox = opts.ticks || (wrap && typeof wrap.querySelector === 'function' ? wrap.querySelector('[data-ticks]') : null);
  const labelEl = button ? (typeof button.querySelector === 'function' && button.querySelector('[data-label]')) || button : null;
  const keyTarget = opts.keyTarget === undefined ? doc : opts.keyTarget;
  const minZonePx = Number.isFinite(opts.minZonePx) && opts.minZonePx >= 0 ? opts.minZonePx : DETENT_MIN_PX;

  let stops = normalizeStops(null);
  let ts = stops.map((s) => s.t);
  let trackPx = Number.isFinite(opts.trackPx) && opts.trackPx > 0 ? opts.trackPx : 0;
  let w = detentZone(trackPx, minZonePx);   // the zones' half-width on this track
  let duration = 5;
  let t = 0, p = 0;        // time, and the thumb's position along the track (idle: p = timeToPosition(t))
  let dir = 1;             // what the idle button does in mid-fold: +1 folds on, -1 unfolds on
  let playing = false, frameId = 0, from = 0, to = 1, total = 1, elapsed = 0, last = 0;
  let p0 = 0, p1 = 1;      // a play moves the thumb from p0 (where it was) to p1 (where the target lives), in step with t
  let settle = null, settleId = 0;   // after a pause: { from, to, start } the thumb glides onto timeToPosition(t)
  let shownText = null, shownState = null;
  let pointerFocus = null, pressedAt = -Infinity, swallowKeyup = null;
  const onState = typeof opts.onState === 'function' ? opts.onState : null;

  const state = () => (playing ? 'pause' : t >= 1 - END_EPS ? 'unfold' : t <= END_EPS ? 'fold' : dir < 0 ? 'unfold' : 'fold');
  const naturalTarget = () => (t >= 1 - END_EPS ? 0 : t <= END_EPS ? 1 : dir < 0 ? 0 : 1);
  const detentP = (time) => timeToPosition(time, ts, w);

  function valueText() {
    const k = nearestStop(t, ts);
    const pct = Math.round(t * 100) + '%';
    return k >= 0 && Math.abs(t - ts[k]) < 1e-3 && stops[k].label ? stops[k].label + ', ' + pct : pct;
  }

  function sync() {
    const v = String(p);
    if (slider.value !== v) slider.value = v;
    const host = wrap || slider;
    if (host.style) host.style.setProperty('--p', p.toFixed(5));
    const vt = valueText();
    if (vt !== shownText) { shownText = vt; slider.setAttribute('aria-valuetext', vt); }
    const st = state();
    if (st === shownState) return;
    const first = shownState === null;
    shownState = st;
    if (labelEl) {
      if (button.dataset) button.dataset.state = st;
      if (labelEl.textContent !== text[st]) labelEl.textContent = text[st];
    }
    if (onState && !first) onState(st);
  }
  const emit = () => { if (onChange) onChange(t); };

  function renderTicks() {
    if (!tickBox || !doc || typeof tickBox.replaceChildren !== 'function') return;
    tickBox.replaceChildren(...stops.map((s) => {
      const tick = doc.createElement('i');
      tick.style.left = (s.t * 100).toFixed(4) + '%';
      if (s.label) tick.dataset.label = s.label;
      return tick;
    }));
  }

  function halt() {
    if (frameId) { caf(frameId); frameId = 0; }
    playing = false;
  }

  // ---- the thumb after a pause: a short glide onto the detent position (t does not move) ----
  function endSettle(finish) {
    if (settleId) { caf(settleId); settleId = 0; }
    if (settle && finish) p = settle.to;
    settle = null;
  }
  function settleFrame() {
    settleId = 0;
    if (!settle) return;
    const x = (now() - settle.start) / 1000 / SETTLE;
    if (!(x < 1)) { p = settle.to; settle = null; } else {
      const e = x <= 0 ? 0 : x * x * (3 - 2 * x);
      p = settle.from + (settle.to - settle.from) * e;
      settleId = raf(settleFrame);
    }
    sync();
  }
  function startSettle() {
    endSettle(false);
    const target = detentP(t);
    if (Math.abs(target - p) < 1e-7) { p = target; return; }
    settle = { from: p, to: target, start: now() };
    settleId = raf(settleFrame);
  }

  // ---- playback ----
  const thumbOfPlay = (time) => (to === from ? p1 : p0 + ((time - from) * (p1 - p0)) / (to - from));

  function frame() {
    frameId = 0;
    if (!playing) return;
    const n = now();
    let dt = (n - last) / 1000;
    last = n;
    if (!(dt > 0)) dt = 0; else if (dt > MAX_STEP) dt = MAX_STEP;
    elapsed += dt;
    const x = elapsed / total;
    if (x >= 1) { t = to; p = p1; playing = false; }
    else { t = from + (to - from) * easePlay(x); p = thumbOfPlay(t); frameId = raf(frame); }   // scheduled before the callbacks: a throwing onChange cannot freeze the play
    sync();
    emit();
  }

  function play(target) {
    const goal = target === undefined || target === null ? naturalTarget() : clamp01(Number(target));
    halt();
    endSettle(false);                                   // the play starts from the thumb where it is drawn
    if (Math.abs(goal - t) < 1e-9) { t = goal; p = detentP(t); sync(); return; }
    from = t; to = goal; dir = goal > t ? 1 : -1;
    p0 = p; p1 = detentP(goal);
    total = Math.max(MIN_PLAY, duration * Math.abs(goal - t));
    elapsed = 0; last = now();
    playing = true;
    sync();
    frameId = raf(frame);
  }

  function stop() {
    if (!playing) return;
    halt();
    startSettle();
    sync();
  }

  const toggle = () => (playing ? stop() : play());

  // The person moved the thumb (pointer, keyboard, assistive technology).
  function scrubTo(position) {
    halt();
    endSettle(false);
    p = clamp01(position);
    for (const s of ts) if (Math.abs(p - s) < 1e-9) p = s;
    t = positionToTime(p, ts, w);
    dir = 1;
    sync();
    emit();
  }

  // ---- the track's length in px (the zones are at least minZonePx wide) ----
  function setZone(next) {
    if (Math.abs(next - w) < 1e-9) return;
    w = next;
    if (playing) p1 = detentP(to);
    else if (settle) settle.to = detentP(t);
    else { p = detentP(t); sync(); }
  }
  function measureTrack() {
    if (!wrap || typeof wrap.getBoundingClientRect !== 'function') return;
    const r = wrap.getBoundingClientRect();
    let thumb = 22;
    try {
      const view = wrap.ownerDocument && wrap.ownerDocument.defaultView;
      const v = view ? parseFloat(view.getComputedStyle(wrap).getPropertyValue('--thumb')) : NaN;
      if (v > 0) thumb = v;
    } catch { /* no styles */ }
    const usable = r.width - thumb;
    if (usable > 0) { trackPx = usable; setZone(detentZone(trackPx, minZonePx)); }
  }
  let resizeObserver = null;
  if (wrap && typeof G.ResizeObserver === 'function') {
    try { resizeObserver = new G.ResizeObserver(() => measureTrack()); resizeObserver.observe(wrap); } catch { resizeObserver = null; }
  }

  const onInput = () => scrubTo(Number(slider.value));
  // Touching the slider stops playback, even before it moves, and puts the thumb exactly where t lives, so the drag
  // continues from t (the press is under the finger: the thumb moves by at most 0.4 % of the track).
  const onGrab = () => {
    measureTrack();
    const was = playing || !!settle;
    halt();
    endSettle(false);
    if (was) p = detentP(t);
    sync();
  };
  const isSpace = (e) => e.key === ' ' || e.key === 'Spacebar';
  const onSliderKey = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (isSpace(e)) {
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) toggle();
      return;
    }
    const step = e.shiftKey ? KEY_STEP_BIG : KEY_STEP;
    let np;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowUp': case 'Right': case 'Up': np = p + step; break;
      case 'ArrowLeft': case 'ArrowDown': case 'Left': case 'Down': np = p - step; break;
      case 'Home': np = 0; break;
      case 'End': np = 1; break;
      case 'PageUp': np = ts.find((s) => s > t + 1e-9); if (np === undefined) np = 1; break;       // next stop
      case 'PageDown': np = [...ts].reverse().find((s) => s < t - 1e-9); if (np === undefined) np = 0; break;
      default: return;
    }
    e.preventDefault();
    scrubTo(np);
  };
  const modalOpen = () => {
    if (!doc || typeof doc.querySelectorAll !== 'function') return false;
    for (const modal of doc.querySelectorAll(OPEN_MODAL)) if (isShown(modal)) return true;
    return false;
  };
  const onGlobalKey = (e) => {
    if (!isSpace(e) || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const el = e.target;
    const owner = el && typeof el.closest === 'function' ? el.closest(OWNS_SPACE) : null;
    // a button that a pointer focused gives Space back (outside dialogs): Space plays, the button is not pressed
    const takeOver = !!owner && owner === pointerFocus && typeof owner.matches === 'function' && owner.matches(BUTTON_LIKE) &&
      !owner.closest('dialog, [role="dialog"], [aria-modal="true"]');
    if (owner && !takeOver) return;
    if (modalOpen()) return;                            // a dialog is open: Space is its business
    e.preventDefault();                                 // (on a button this also keeps it from being pressed)
    if (takeOver) swallowKeyup = owner;
    if (!e.repeat) toggle();
  };
  // Engines that press a button on keyup whatever happened to the keydown: that keyup is ours too.
  const onGlobalKeyUp = (e) => {
    if (!swallowKeyup || !isSpace(e)) return;
    if (e.target === swallowKeyup || (typeof swallowKeyup.contains === 'function' && swallowKeyup.contains(e.target))) e.preventDefault();
    swallowKeyup = null;
  };
  const onFocusIn = (e) => {
    const el = e.target;
    pointerFocus = el && el !== doc && el !== (doc && doc.body) && focusedByPointer(el, now() - pressedAt) ? el : null;
    swallowKeyup = null;
  };
  const onPress = () => { pressedAt = now(); };
  const onClick = () => toggle();

  slider.min = '0'; slider.max = '1'; slider.step = 'any';
  measureTrack();
  p = clamp01(Number(slider.value));
  t = positionToTime(p, ts, w);
  const grabTarget = wrap || slider;
  slider.addEventListener('input', onInput);
  slider.addEventListener('keydown', onSliderKey);
  grabTarget.addEventListener('pointerdown', onGrab);
  if (button) button.addEventListener('click', onClick);
  if (keyTarget) {
    keyTarget.addEventListener('keydown', onGlobalKey);
    keyTarget.addEventListener('keyup', onGlobalKeyUp, true);
    keyTarget.addEventListener('focusin', onFocusIn, true);
    keyTarget.addEventListener('pointerdown', onPress, true);
  }
  const unenhance = enhanceRange(slider);
  renderTicks();
  sync();

  return {
    setStops(next) {
      const cleaned = normalizeStops(next);
      const same = cleaned.length === stops.length && cleaned.every((s, i) => s.t === stops[i].t && s.label === stops[i].label);
      if (same) return;
      stops = cleaned;
      ts = stops.map((s) => s.t);
      renderTicks();
      if (playing) p1 = detentP(to);                    // the play keeps its thumb; it now ends where the target lives
      else if (settle) settle.to = detentP(t);
      else p = detentP(t);
      shownText = null;
      sync();
    },
    setDuration(sec) { if (Number.isFinite(sec) && sec > 0) duration = sec; },
    set(value) {
      halt();
      endSettle(false);
      t = clamp01(Number(value));
      p = detentP(t);
      dir = 1;
      sync();
    },
    get: () => t,
    getThumb: () => p,
    play,
    stop,
    toggle,
    isPlaying: () => playing,
    getStops: () => stops.map((s) => ({ ...s })),
    destroy() {
      halt();
      endSettle(false);
      if (resizeObserver) { try { resizeObserver.disconnect(); } catch { /* gone */ } }
      slider.removeEventListener('input', onInput);
      slider.removeEventListener('keydown', onSliderKey);
      grabTarget.removeEventListener('pointerdown', onGrab);
      if (button) button.removeEventListener('click', onClick);
      if (keyTarget) {
        keyTarget.removeEventListener('keydown', onGlobalKey);
        keyTarget.removeEventListener('keyup', onGlobalKeyUp, true);
        keyTarget.removeEventListener('focusin', onFocusIn, true);
        keyTarget.removeEventListener('pointerdown', onPress, true);
      }
      unenhance();
    },
  };
}
