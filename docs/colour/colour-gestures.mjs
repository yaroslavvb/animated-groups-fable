// The endless camera's input, lifted from `../scott-gray/gyre/app.mjs` and
// packaged so the explorer page can switch it off for the fixed
// "simulation width" framing.
//
// One finger or a mouse pans; two fingers pan, zoom and turn about their
// midpoint, and a turn that ends within 4° of a sixth of a turn snaps to it; a
// release keeps all three gliding. Every gesture — one finger, two fingers, the
// trackpad, a burst of wheel events — keeps the same list of samples and hands
// the same three-channel velocity to the same glide, so there is one piece of
// inertia in the viewer rather than one per input.
import {advanceFling, createFling, estimateVelocity, NO_THROW, trimSamples, WINDOW_MS} from './momentum.mjs';
import {snapAngle} from './colour-renderer.mjs';

/** How long a pinch's zoom and turn wait for the pinch's second finger to lift. */
const HANDOVER_MS = 120;
const WHEEL_REST_MS = 70, WHEEL_GAIN = 0.3, PINCH_WHEEL_GAIN = 0.6;

export function createGestures(canvas, {view, size, onChange = () => {}, onSettle = () => {}, onTouch = () => {}, reducedMotion = {matches: false}} = {}) {
  const pointers = new Map();
  const samples = [];
  let gesture = null, fling = null, handover = null, enabled = true, flingTime = null;

  /** Where the view stands, in the form the release velocity is measured in. */
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
    samples.push(sample(time, mid));
    trimSamples(samples, WINDOW_MS);
    onChange();
  }
  /** One finger can only pan, so its zoom and turn channels are switched off
   * rather than measured. */
  function releaseVelocity(time) {
    if (!gesture || reducedMotion.matches) return NO_THROW;
    const still = gesture.multi ? 1 : 0;
    return estimateVelocity(samples, time, {zoomGain: still, turnGain: still});
  }
  function startFling(velocity, point, {snap = true} = {}) {
    const [width, height] = size();
    const state = createFling(velocity, {
      logScale: Math.log(view.scale(width, height)), angle: view.angle,
      logMin: Math.log(view.minScale), logMax: Math.log(view.maxScale), snap,
    });
    if (!state) { onSettle(); return null; }
    state.point = [...point];
    fling = state; flingTime = null;
    onChange();
    return state;
  }
  function settleTurn() {
    if (!gesture?.sawMulti) return;
    const snapped = snapAngle(view.angle);
    if (snapped !== view.angle) { const [width, height] = size(); view.pin(gesture.anchor, gesture.mid, width, height, {angle: snapped}); onChange(); }
  }
  /** Drops a glide before it has finished. A glide in the middle of its elastic
   * excursion is sitting OUTSIDE the zoom limits, and only a live glide may be
   * out there, so whatever cuts one short must first put the view back. */
  function stopFling() {
    if (fling && fling.over) {
      const [width, height] = size();
      view.pin(view.latticeAt(fling.point, width, height), fling.point, width, height, {scale: Math.exp(fling.logScale)});
      onChange();
    }
    fling = null; flingTime = null;
  }

  const pointerDown = event => {
    if (!enabled) return;
    if (event.button !== undefined && event.button !== 0 && event.pointerType === 'mouse') return;
    try { canvas.setPointerCapture(event.pointerId); } catch { /* Synthetic pointers cannot be captured; the gesture still works. */ }
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
    stopFling(); endWheel(); handover = null;
    beginGesture();
    if (event.pointerType === 'touch') onTouch();
    canvas.parentElement?.classList.add('dragging');
  };
  const pointerMove = event => {
    if (!enabled || !pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
    moveGesture(performance.now());
  };
  const pointerUp = event => {
    if (!pointers.has(event.pointerId)) return;
    const time = performance.now();
    if (pointers.size > 1) {
      // A finger has left a pinch. The fingers of a pinch never lift in the same
      // instant, so what it was doing is kept for a moment.
      const velocity = releaseVelocity(time);
      if (!velocity.turn) settleTurn();
      handover = velocity.zoom || velocity.turn ? {zoom: velocity.zoom, turn: velocity.turn, point: gesture.mid, time} : null;
    } else {
      const own = releaseVelocity(time);
      const carried = handover && time - handover.time <= HANDOVER_MS ? handover : null;
      const velocity = carried ? {pan: own.pan, zoom: carried.zoom, turn: carried.turn} : own;
      if (!velocity.turn) settleTurn();
      if (gesture) startFling(velocity, carried ? carried.point : gesture.mid); else onSettle();
      gesture = null; handover = null;
    }
    pointers.delete(event.pointerId);
    if (pointers.size) beginGesture(true); else canvas.parentElement?.classList.remove('dragging');
  };

  // A burst of wheel events is a gesture too — a two-finger scroll on a trackpad
  // arrives as thirty of them — so it ends with the same glide, more gently.
  const wheel = {samples: [], timer: 0, point: [0, 0], turning: false, pinch: false};
  function noteWheel(turning, pinch, point) {
    const now = performance.now();
    const last = wheel.samples[wheel.samples.length - 1];
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
    if (!burst.length || pointers.size || trackpad.anchor || reducedMotion.matches) { onSettle(); return; }
    const gain = wheel.pinch ? PINCH_WHEEL_GAIN : WHEEL_GAIN;
    const velocity = estimateVelocity(burst, burst[burst.length - 1].time, {
      minEvents: 3, panGain: 0, zoomGain: wheel.turning ? 0 : gain, turnGain: wheel.turning ? gain : 0,
      maxZoom: 0.9, maxTurn: 1.5,
    });
    startFling(velocity, wheel.point);
  }
  const onWheel = event => {
    if (!enabled) return;
    event.preventDefault();
    if (event.ctrlKey && performance.now() - trackpad.time < 150) return; // Safari reports the same pinch as a gesture event.
    const [width, height] = size();
    const step = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? 400 : 1;
    // Option (Alt) turns instead of zooming, so a trackpad with no rotate
    // gesture — and a mouse — can still turn the pattern about the pointer.
    const turning = event.altKey && !event.ctrlKey;
    stopFling();
    if (turning) view.rotateAt(-event.deltaY * step * 0.0015, [event.clientX, event.clientY], width, height);
    else view.zoomAt(Math.exp(-event.deltaY * step * (event.ctrlKey ? 0.01 : 0.0022)), [event.clientX, event.clientY], width, height);
    noteWheel(turning, !!event.ctrlKey, [event.clientX, event.clientY]);
    rebaseGesture(); onChange();
  };
  const onContextMenu = event => event.preventDefault();
  const onTouchMove = event => { if (enabled) event.preventDefault(); };

  // Safari reports trackpad pinches and two-finger turns as gesture events with
  // a cumulative scale and rotation. On a Mac the two live in SEPARATE streams:
  // AppKit sends a pinch as NSEventTypeMagnify and a turn as NSEventTypeRotate,
  // and WebKit forwards each carrying only its own quantity — the magnify kind
  // sets the rotation to zero and the rotate kind sets the scale to a neutral 1.
  // Applying both fields of every event therefore lets the two streams cancel
  // each other. So each quantity is accumulated on its own and taken only from
  // an event that actually carries it, with the stream's kind latched over the
  // whole gesture; an event that names neither is applied only when the stream
  // has shown just one kind so far, and ignored when it has shown both
  // separately. The view is pinned with BOTH accumulators every time.
  const trackpad = {
    time: -Infinity, anchor: null, scale0: 0, angle0: 0, point: [0, 0], samples: [],
    scale: 1, rotation: 0, cumulative: false, sawScale: false, sawRotation: false,
  };
  function resetTrackpad() {
    trackpad.scale = 1; trackpad.rotation = 0;
    trackpad.cumulative = false; trackpad.sawScale = false; trackpad.sawRotation = false;
  }
  function accumulate(event, final = false) {
    const s = Number(event.scale), r = Number(event.rotation);
    const hasScale = Number.isFinite(s) && s > 0, hasRotation = Number.isFinite(r);
    const carriesScale = hasScale && s !== 1, carriesRotation = hasRotation && r !== 0;
    if (carriesScale && carriesRotation) trackpad.cumulative = true;
    if (carriesScale) trackpad.sawScale = true;
    if (carriesRotation) trackpad.sawRotation = true;
    if (trackpad.cumulative) {
      if (hasScale) trackpad.scale = s;
      if (hasRotation) trackpad.rotation = r;
      return;
    }
    if (carriesScale) trackpad.scale = s;
    if (carriesRotation) trackpad.rotation = r;
    if (carriesScale || carriesRotation) return;
    if (final) return;
    if (hasScale && !trackpad.sawRotation) trackpad.scale = s;         // a magnify stream back at 1×
    else if (hasRotation && !trackpad.sawScale) trackpad.rotation = r; // a rotate stream back at 0°
    // otherwise ambiguous: keep both accumulators
  }
  function pinTrackpad() {
    const [width, height] = size();
    view.pin(trackpad.anchor, trackpad.point, width, height, {scale: trackpad.scale0 * trackpad.scale, angle: trackpad.angle0 + trackpad.rotation * Math.PI / 180});
  }
  /** Re-reads a gesture's baseline from the view: any other control may move the
   * view in the middle of a trackpad gesture, and the step must not be read as
   * the fingers moving. */
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
  const gestureStart = event => {
    if (!enabled) return;
    event.preventDefault();
    if (pointers.size || event.target !== canvas) return;
    stopFling();
    const [width, height] = size();
    trackpad.point = [event.clientX, event.clientY];
    trackpad.anchor = view.latticeAt(trackpad.point, width, height);
    trackpad.scale0 = view.scale(width, height); trackpad.angle0 = view.angle; trackpad.time = performance.now();
    resetTrackpad();
    trackpad.samples = [sample(trackpad.time, trackpad.point)];
    endWheel();
  };
  const gestureChange = event => {
    if (!enabled) return;
    event.preventDefault();
    if (pointers.size || !trackpad.anchor) return;
    accumulate(event);
    pinTrackpad();
    trackpad.time = performance.now();
    trackpad.samples.push(sample(trackpad.time, trackpad.point));
    trimSamples(trackpad.samples, WINDOW_MS);
    onChange();
  };
  const gestureEnd = event => {
    if (!enabled) return;
    event.preventDefault();
    if (!trackpad.anchor) return;
    accumulate(event, true);
    pinTrackpad();
    trackpad.time = performance.now();
    trackpad.samples.push(sample(trackpad.time, trackpad.point));
    trimSamples(trackpad.samples, WINDOW_MS);
    const velocity = reducedMotion.matches ? NO_THROW : estimateVelocity(trackpad.samples, trackpad.time, {panGain: 0});
    if (!velocity.turn) {
      const snapped = snapAngle(view.angle);
      if (snapped !== view.angle) { const [width, height] = size(); view.pin(trackpad.anchor, trackpad.point, width, height, {angle: snapped}); }
    }
    startFling(velocity, trackpad.point);
    trackpad.anchor = null; trackpad.samples = [];
    onChange();
  };

  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('wheel', onWheel, {passive: false});
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('touchmove', onTouchMove, {passive: false});
  document.addEventListener('gesturestart', gestureStart);
  document.addEventListener('gesturechange', gestureChange);
  document.addEventListener('gestureend', gestureEnd);

  return {
    get enabled() { return enabled; },
    set enabled(value) {
      enabled = !!value;
      if (!enabled) { stopFling(); endWheel(); pointers.clear(); gesture = null; trackpad.anchor = null; canvas.parentElement?.classList.remove('dragging'); }
    },
    get gliding() { return !!fling; },
    get dragging() { return pointers.size > 0 || !!trackpad.anchor; },
    /** Advances a glide to `now`. Called from the page's animation loop; returns
     * true while the glide is still live. */
    advance(now) {
      if (!fling) return false;
      const dt = flingTime === null ? 0 : Math.min(0.25, (now - flingTime) / 1000);
      flingTime = now;
      if (dt <= 0) return true;
      const [width, height] = size();
      const step = advanceFling(fling, dt);
      // The zoom and the turn are pinned about the release point, and the pan
      // then slides the whole picture under it. The anchor is re-read every
      // frame, so the lattice point held under the release point is the one
      // that is there now.
      if (step.zoomMoved || step.turnMoved) {
        const anchor = view.latticeAt(fling.point, width, height);
        view.pin(anchor, fling.point, width, height, {scale: Math.exp(step.logScale), angle: step.angle, elastic: step.live});
      }
      if (step.pan[0] || step.pan[1]) view.panBy(step.pan[0], step.pan[1], width, height);
      if (!step.live) { fling = null; flingTime = null; onSettle(); }
      return !!fling;
    },
    /** Any control that moves the view calls this first. */
    interrupt() { stopFling(); endWheel(); },
    rebase: rebaseGesture,
    dispose() {
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('gesturestart', gestureStart);
      document.removeEventListener('gesturechange', gestureChange);
      document.removeEventListener('gestureend', gestureEnd);
      clearTimeout(wheel.timer);
    },
  };
}
