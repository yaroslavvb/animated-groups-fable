// The scrubber: the pure position <-> time mapping (soft detents) and the play controller, driven with fake elements and a fake clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DETENT, DETENT_MAX_SLOPE, DETENT_MIN_PX, detentShape, detentShapeInverse, detentZone,
  normalizeStops, stopTimes, positionToTime, timeToPosition, easePlay, createTimeline,
} from '../src/timeline.js';

const STOP_SETS = [
  [0, 1],
  [0, 0.5, 1],
  [0, 0.3, 0.62, 1],
  [0, 0.25, 0.5, 0.75, 1],
  [0, 0.48, 0.52, 1],          // two stops closer than 2 * DETENT: their zones are cut at the midpoint
  [0, 0.02, 0.97, 1],          // stops crowding the ends
  [0, 0.4375, 0.5, 0.5625, 1],
].map(stopTimes);
const N = 20000;

// ---- the pure mapping -------------------------------------------------------------------------------------------

test('mapping: exact at 0 and 1, every stop is a fixed point, out-of-range input is clamped', () => {
  for (const ts of STOP_SETS) {
    assert.equal(positionToTime(0, ts), 0);
    assert.equal(positionToTime(1, ts), 1);
    for (const s of ts) {
      assert.equal(positionToTime(s, ts), s, 'stop ' + s);
      assert.equal(timeToPosition(s, ts), s, 'stop ' + s + ' (inverse)');
    }
    assert.equal(positionToTime(-0.3, ts), 0);
    assert.equal(positionToTime(1.7, ts), 1);
    assert.equal(positionToTime(NaN, ts), 0);
    assert.equal(timeToPosition(-1, ts), 0);
    assert.equal(timeToPosition(2, ts), 1);
  }
  assert.equal(positionToTime(0.37), 0.37, 'default stops are just the two ends');
});

test('mapping: strictly monotonic and continuous (never a jump)', () => {
  for (const ts of STOP_SETS) {
    let prevT = positionToTime(0, ts), prevP = timeToPosition(0, ts);
    for (let i = 1; i <= N; i++) {
      const x = i / N, h = 1 / N;
      const t = positionToTime(x, ts), p = timeToPosition(x, ts);
      assert.ok(t > prevT, `t increases at p=${x} (stops ${ts})`);
      // the slope never exceeds 1.25 (v1's power law reached 1.6), so a thumb step h moves t by at most 1.25 h
      assert.ok(t - prevT <= DETENT_MAX_SLOPE * h * (1 + 1e-9) + 1e-15, `no jump at p=${x}: step ${t - prevT}`);
      assert.ok(p > prevP, `inverse increases at t=${x}`);
      assert.ok(t >= 0 && t <= 1 && p >= 0 && p <= 1);
      prevT = t; prevP = p;
    }
  }
});

test('mapping: identity far from every stop', () => {
  for (const ts of STOP_SETS) {
    let checked = 0;
    for (let i = 0; i <= N; i++) {
      const p = i / N;
      if (Math.min(...ts.map((s) => Math.abs(p - s))) < DETENT) continue;
      assert.equal(positionToTime(p, ts), p);
      assert.equal(timeToPosition(p, ts), p);
      checked++;
    }
    if (ts.length <= 5 && ts[1] > 0.1) assert.ok(checked > N / 2, 'most of the track is plain');
  }
});

// (round 3, #51: the profile is F(u) = u - u (1 - u)^3 instead of v1's u^1.6 — flat at the stop as before, and now
// with no step in the slope at the zone's edge; the law is checked exactly, as the power law was)
test('mapping: flattened near a stop — a soft magnet, t - s = w F(|d| / w) with F(u) = u - u (1 - u)^3', () => {
  const ts = stopTimes([0, 0.5, 1]);
  for (const s of ts) {
    for (const sign of [-1, 1]) {
      for (const frac of [0.02, 0.1, 0.25, 0.5, 0.75, 0.95]) {
        const d = sign * frac * DETENT, p = s + d;
        if (p < 0 || p > 1) continue;
        const t = positionToTime(p, ts);
        assert.ok(Math.abs(t - s) < Math.abs(d), `t is pulled toward the stop at d=${d}`);
        assert.ok(Math.sign(t - s) === sign, 'on the same side of the stop');
        const expected = DETENT * (frac - frac * (1 - frac) ** 3);
        assert.ok(Math.abs(Math.abs(t - s) - expected) < 1e-12, `the detent law at ${frac} of the zone`);
      }
    }
    // the slope vanishes at the stop: the thumb can wiggle there and t barely moves
    const h = 1e-5, inside = s === 1 ? s - h : s + h;
    assert.ok(Math.abs(positionToTime(inside, ts) - s) / h < 0.02, 'flat at the stop');
  }
  // at the edge of the zone it has rejoined t = p
  assert.equal(positionToTime(0.5 + DETENT, ts), 0.5 + DETENT);
  assert.ok(Math.abs(positionToTime(0.5 + DETENT - 1e-9, ts) - (0.5 + DETENT)) < 1e-8);
});

test('mapping: close stops share the gap, each keeping its own fixed point', () => {
  const ts = stopTimes([0, 0.48, 0.52, 1]);
  assert.equal(positionToTime(0.5, ts), 0.5, 'the midpoint between two close stops is not moved');
  assert.ok(positionToTime(0.49, ts) < 0.49 && positionToTime(0.49, ts) > 0.48, 'left of the midpoint: pulled to 0.48');
  assert.ok(positionToTime(0.51, ts) > 0.51 && positionToTime(0.51, ts) < 0.52, 'right of the midpoint: pulled to 0.52');
  assert.ok(positionToTime(0.47, ts) > 0.47 && positionToTime(0.47, ts) < 0.48, 'outer side keeps the full zone');
});

test('mapping: timeToPosition inverts positionToTime', () => {
  for (const ts of STOP_SETS) {
    for (let i = 0; i <= 4000; i++) {
      const x = i / 4000;
      assert.ok(Math.abs(timeToPosition(positionToTime(x, ts), ts) - x) < 1e-9, `p -> t -> p at ${x}`);
      assert.ok(Math.abs(positionToTime(timeToPosition(x, ts), ts) - x) < 1e-9, `t -> p -> t at ${x}`);
    }
  }
});

test('normalizeStops: sorts, clamps, merges duplicates, keeps labels, always has 0 and 1', () => {
  assert.deepEqual(normalizeStops(null), [{ t: 0, label: '' }, { t: 1, label: '' }]);
  assert.deepEqual(normalizeStops([]), [{ t: 0, label: '' }, { t: 1, label: '' }]);
  assert.deepEqual(
    normalizeStops([{ t: 1, label: 'closed' }, { t: 0.5, label: 'tube' }, { t: 0, label: 'flat' }]),
    [{ t: 0, label: 'flat' }, { t: 0.5, label: 'tube' }, { t: 1, label: 'closed' }],
  );
  assert.deepEqual(stopTimes([0.5, 0.5, 0.5000000001, 2, -1, NaN, 'x', null, { t: 0.2 }]), [0, 0.2, 0.5, 1]);
  assert.deepEqual(stopTimes([{ t: 0.9999999 }, { t: 0.0000001 }]), [0, 1], 'stops within 1e-6 of an end ARE the end');
  assert.deepEqual(normalizeStops([{ t: 0.5 }, { t: 0.5, label: 'tube' }])[1], { t: 0.5, label: 'tube' });
});

test('easePlay: 0 -> 1, monotonic, continuous speed', () => {
  assert.equal(easePlay(0), 0);
  assert.equal(easePlay(1), 1);
  assert.equal(easePlay(-1), 0);
  assert.equal(easePlay(2), 1);
  assert.ok(Math.abs(easePlay(0.5) - 0.5) < 1e-12, 'symmetric');
  const n = 5000, h = 1 / n;
  let prev = 0, prevSpeed = 0, maxSpeed = 0;
  for (let i = 1; i <= n; i++) {
    const y = easePlay(i * h), speed = (y - prev) / h;
    assert.ok(y > prev, 'increasing at ' + i * h);
    assert.ok(Math.abs(speed - prevSpeed) < 0.02, 'no kink in speed at ' + i * h);
    maxSpeed = Math.max(maxSpeed, speed);
    prev = y; prevSpeed = speed;
  }
  assert.ok(maxSpeed < 1.3, 'cruise speed stays near 1');
  assert.ok(prevSpeed < 0.02, 'arrives at rest');
});

// ---- the controller, with fake elements ---------------------------------------------------------------------------

function fakeEl(props = {}) {
  const listeners = new Map();
  const el = {
    value: '0', min: '', max: '', step: '', disabled: false, textContent: '', dataset: {}, attrs: {}, css: {},
    parentElement: null,
    style: { setProperty(k, v) { el.css[k] = v; } },
    setAttribute(k, v) { el.attrs[k] = String(v); },
    getAttribute(k) { return k in el.attrs ? el.attrs[k] : null; },
    hasAttribute(k) { return k in el.attrs; },
    removeAttribute(k) { delete el.attrs[k]; },
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { if (listeners.has(type)) listeners.get(type).delete(fn); },
    count(type) { return listeners.has(type) ? listeners.get(type).size : 0; },
    fire(type, init = {}) {
      const e = {
        type, target: el, defaultPrevented: false, repeat: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
        preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...init,
      };
      for (const fn of [...(listeners.get(type) || [])]) fn(e);
      return e;
    },
    ...props,
  };
  return el;
}

function fakeClock() {
  let time = 1000, queue = [], id = 0;
  return {
    now: () => time,
    raf(fn) { queue.push([++id, fn]); return id; },
    caf(handle) { queue = queue.filter(([k]) => k !== handle); },
    tick(ms = 1000 / 60) { time += ms; const run = queue; queue = []; for (const [, fn] of run) fn(time); },
    pending: () => queue.length,
  };
}

function rig(extra = {}) {
  const slider = fakeEl(), button = fakeEl({ textContent: 'Fold' }), keys = fakeEl(), clock = fakeClock();
  const seen = [];
  const tl = createTimeline({ slider, button, onChange: (t) => seen.push(t), keyTarget: keys, now: clock.now, raf: clock.raf, caf: clock.caf, ...extra });
  const run = (maxFrames = 5000) => { let n = 0; while (tl.isPlaying() && n < maxFrames) { clock.tick(); n++; } return n; };
  return { slider, button, keys, clock, seen, tl, run };
}

test('timeline: starts at 0, owns the slider range, set() is silent', () => {
  const { slider, button, seen, tl } = rig();
  assert.equal(tl.get(), 0);
  assert.equal(slider.min, '0'); assert.equal(slider.max, '1'); assert.equal(slider.step, 'any');
  assert.equal(button.textContent, 'Fold');
  assert.equal(button.dataset.state, 'fold');
  tl.set(0.4);
  assert.equal(tl.get(), 0.4);
  assert.equal(Number(slider.value), 0.4);
  assert.equal(slider.css['--p'], '0.40000');
  assert.equal(slider.attrs['aria-valuetext'], '40%');
  assert.equal(button.textContent, 'Fold');
  tl.set(1);
  assert.equal(button.textContent, 'Unfold');
  tl.set(7); assert.equal(tl.get(), 1);
  tl.set(-3); assert.equal(tl.get(), 0);
  tl.set(NaN); assert.equal(tl.get(), 0);
  assert.deepEqual(seen, [], 'set() never calls onChange');
  assert.equal(tl.isPlaying(), false);
});

test('timeline: Fold plays smoothly to exactly 1, then the button reads Unfold and plays back to exactly 0', () => {
  const { button, seen, tl, clock, run } = rig();
  tl.setDuration(5);
  button.fire('click');
  assert.equal(tl.isPlaying(), true);
  assert.equal(button.textContent, 'Pause');
  assert.equal(button.dataset.state, 'pause');
  const frames = run();
  assert.ok(Math.abs(frames / 60 - 5) < 0.1, `a full fold takes the fold's duration (${frames} frames)`);
  assert.equal(tl.get(), 1);
  assert.equal(seen[seen.length - 1], 1, 'the last frame is exactly the target');
  assert.equal(button.textContent, 'Unfold');
  assert.equal(clock.pending(), 0, 'no frame left scheduled');
  let maxStep = 0;
  for (let i = 1; i < seen.length; i++) {
    assert.ok(seen[i] >= seen[i - 1], 'time never runs backwards while folding');
    maxStep = Math.max(maxStep, seen[i] - seen[i - 1]);
  }
  assert.ok(maxStep < 1.3 / (5 * 60), `no jump between frames (largest step ${maxStep})`);
  assert.ok(seen[1] - seen[0] < 0.0005 && 1 - seen[seen.length - 2] < 0.0005, 'eased start and stop');

  seen.length = 0;
  button.fire('click');
  assert.equal(button.textContent, 'Pause');
  run();
  assert.equal(tl.get(), 0);
  assert.equal(seen[seen.length - 1], 0);
  assert.equal(button.textContent, 'Fold');
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] <= seen[i - 1], 'monotonic while unfolding');
});

test('timeline: play restarts from the current t and takes the proportional time', () => {
  const { seen, tl, run } = rig();
  tl.setDuration(6);
  tl.set(0.5);
  tl.play(1);
  const frames = run();
  assert.ok(Math.abs(frames / 60 - 3) < 0.1, `half the way takes half the time (${frames} frames)`);
  assert.ok(seen.every((t) => t >= 0.5 && t <= 1), 'never leaves [0.5, 1]');
  assert.equal(tl.get(), 1);
  tl.set(0.999);
  tl.play(1);
  const short = run();
  assert.ok(short >= 20 && short <= 23, `a tiny distance still animates for a moment (${short} frames)`);
  tl.play(1);
  assert.equal(tl.isPlaying(), false, 'already there: nothing to play');
});

test('timeline: pausing keeps the direction; touching the slider stops playback', () => {
  const { slider, button, seen, tl, clock, run } = rig();
  tl.setDuration(4);
  button.fire('click');
  for (let i = 0; i < 60; i++) clock.tick();
  button.fire('click');                                   // pause mid-fold
  assert.equal(tl.isPlaying(), false);
  const paused = tl.get();
  assert.ok(paused > 0.1 && paused < 0.9);
  assert.equal(button.textContent, 'Fold', 'paused while folding: the button folds on');
  for (let i = 0; i < 10; i++) clock.tick();
  assert.equal(tl.get(), paused, 'paused means paused');
  button.fire('click'); run();
  assert.equal(tl.get(), 1);

  button.fire('click');                                   // unfold…
  for (let i = 0; i < 60; i++) clock.tick();
  slider.fire('pointerdown');                             // …and grab the slider
  assert.equal(tl.isPlaying(), false, 'touching the slider stops playback');
  assert.equal(button.textContent, 'Unfold', 'paused while unfolding: the button unfolds on');
  const n = seen.length;
  for (let i = 0; i < 10; i++) clock.tick();
  assert.equal(seen.length, n, 'no more frames after the stop');

  tl.play(1);
  for (let i = 0; i < 30; i++) clock.tick();
  tl.set(0.25);
  assert.equal(tl.isPlaying(), false, 'set() stops playback');
  assert.equal(tl.get(), 0.25);
  assert.equal(button.textContent, 'Fold');
});

test('timeline: a stalled frame (hidden tab) never makes the fold jump', () => {
  const { seen, tl, clock } = rig();
  tl.setDuration(5);
  tl.play(1);
  for (let i = 0; i < 90; i++) clock.tick();
  const before = tl.get();
  clock.tick(60000);                                      // a minute passes between two frames
  assert.ok(tl.isPlaying(), 'still playing');
  assert.ok(tl.get() - before < 0.03, `advanced by ${tl.get() - before}, not to the end`);
  assert.ok(seen.every((t, i) => i === 0 || t - seen[i - 1] < 0.03));
});

test('timeline: scrubbing is continuous, with soft detents at the stops', () => {
  const { slider, button, seen, tl } = rig();
  tl.setStops([{ t: 0, label: 'flat' }, { t: 0.5, label: 'tube' }, { t: 1, label: 'torus' }]);
  slider.value = '0.2'; slider.fire('input');
  assert.equal(tl.get(), 0.2);
  assert.deepEqual(seen, [0.2]);
  slider.value = '0.5'; slider.fire('input');
  assert.equal(tl.get(), 0.5);
  assert.equal(slider.attrs['aria-valuetext'], 'tube, 50%');
  slider.value = '0.51'; slider.fire('input');
  assert.ok(tl.get() > 0.5 && tl.get() < 0.51, 'just past the stop t has barely moved: ' + tl.get());
  assert.equal(Number(slider.value), 0.51, 'the thumb itself is never snapped');
  slider.value = '0'; slider.fire('input');
  let prev = tl.get();
  assert.equal(prev, 0);
  for (let i = 1; i <= 1000; i++) {                       // drag across the whole track, 0.1 % at a time
    slider.value = String(i / 1000); slider.fire('input');
    assert.ok(tl.get() > prev && tl.get() - prev <= 0.0017, `step at ${i / 1000}: ${tl.get() - prev}`);
    prev = tl.get();
  }
  assert.equal(tl.get(), 1);
  assert.equal(button.textContent, 'Unfold');
  slider.value = '0.97'; slider.fire('input');
  assert.equal(button.textContent, 'Fold', 'scrubbed back from the end: the button folds again');
});

test('timeline: setStops keeps t and moves the thumb to where that t lives on the new track', () => {
  const { slider, tl } = rig();
  tl.set(0.51);
  assert.equal(Number(slider.value), 0.51);
  tl.setStops([0, 0.5, 1]);
  assert.equal(tl.get(), 0.51, 't is kept');
  const p = Number(slider.value);
  assert.ok(p > 0.51 && p < 0.5 + DETENT, 'the thumb sits where that t lives on the new track: ' + p);
  assert.ok(Math.abs(positionToTime(p, stopTimes([0, 0.5, 1])) - 0.51) < 1e-12);
  assert.deepEqual(tl.getStops().map((s) => s.t), [0, 0.5, 1]);
});

test('timeline: keyboard — arrows step the slider, Home / End / PageUp / PageDown, Space toggles play', () => {
  const { slider, button, keys, seen, tl, clock } = rig();
  tl.setStops([0, 0.4, 1]);
  const key = (k, init = {}) => slider.fire('keydown', { key: k, ...init });
  assert.ok(key('ArrowRight').defaultPrevented);
  assert.ok(Math.abs(Number(slider.value) - 0.01) < 1e-12, 'one step = 1 % of the track');
  assert.ok(tl.get() > 0 && tl.get() < 0.01, 'next to the stop at 0 the step is softened');
  for (let i = 0; i < 19; i++) key('ArrowRight');
  assert.ok(Math.abs(tl.get() - 0.2) < 1e-9);
  key('ArrowUp', { shiftKey: true });
  assert.ok(Math.abs(tl.get() - 0.3) < 1e-9);
  key('ArrowLeft'); key('ArrowDown');
  assert.ok(Math.abs(tl.get() - 0.28) < 1e-9);
  key('PageUp'); assert.equal(tl.get(), 0.4);
  key('PageUp'); assert.equal(tl.get(), 1);
  key('PageDown'); assert.equal(tl.get(), 0.4);
  key('PageDown'); assert.equal(tl.get(), 0);
  key('End'); assert.equal(tl.get(), 1);
  key('ArrowRight'); assert.equal(tl.get(), 1, 'clamped at the end');
  key('Home'); assert.equal(tl.get(), 0);
  assert.equal(key('a').defaultPrevented, false, 'other keys are left alone');
  assert.equal(key('ArrowRight', { metaKey: true }).defaultPrevented, false);
  assert.ok(seen.length > 20, 'every key step reports through onChange');

  assert.ok(key(' ').defaultPrevented);
  assert.equal(tl.isPlaying(), true, 'Space on the slider plays');
  key(' ', { repeat: true });
  assert.equal(tl.isPlaying(), true, 'a held Space does not flutter');
  key(' ');
  assert.equal(tl.isPlaying(), false, 'Space again pauses');

  const body = { closest: () => null };
  assert.ok(keys.fire('keydown', { key: ' ', target: body }).defaultPrevented);
  assert.equal(tl.isPlaying(), true, 'Space anywhere outside a control plays');
  for (let i = 0; i < 5; i++) clock.tick();
  key('ArrowLeft');
  assert.equal(tl.isPlaying(), false, 'an arrow key takes over from playback');
  // what the selector passed to closest() would match, for a few kinds of focused element
  const focused = (tag, type) => ({
    closest(sel) {
      const hit = sel.split(',').map((s) => s.trim()).some((s) => s === tag || (tag === 'input' && s === 'input:not([type="range"])' && type !== 'range'));
      return hit ? this : null;
    },
  });
  assert.equal(keys.fire('keydown', { key: ' ', target: focused('button') }).defaultPrevented, false);
  assert.equal(tl.isPlaying(), false, 'Space on another button belongs to that button');
  assert.equal(keys.fire('keydown', { key: ' ', target: focused('input', 'text') }).defaultPrevented, false);
  assert.equal(tl.isPlaying(), false, 'Space in a text field is a space');
  assert.ok(keys.fire('keydown', { key: ' ', target: focused('input', 'range') }).defaultPrevented);
  assert.equal(tl.isPlaying(), true, 'Space on another range input (the Wavy slider) still plays');
  keys.fire('keydown', { key: ' ', target: focused('canvas') });
  assert.equal(tl.isPlaying(), false, 'and on a canvas it pauses');
  assert.equal(button.textContent, 'Fold');
});

test('timeline: onState reports every change of the button, and only changes', () => {
  const states = [];
  const { slider, button, tl, clock, run } = rig({ onState: (s) => states.push(s) });
  tl.setDuration(2);
  assert.deepEqual(states, [], 'the initial state is not reported');
  button.fire('click'); run();
  assert.deepEqual(states, ['pause', 'unfold'], 'fold: playing, then done');
  button.fire('click');
  for (let i = 0; i < 30; i++) clock.tick();
  button.fire('click');                                   // pause half-way back
  assert.deepEqual(states, ['pause', 'unfold', 'pause', 'unfold'], 'paused while unfolding: still offers Unfold');
  slider.value = '0.3'; slider.fire('input');
  assert.deepEqual(states.slice(4), ['fold'], 'a scrub turns it back to Fold');
  slider.value = '0.31'; slider.fire('input');
  tl.set(0.5); tl.setStops([0, 0.5, 1]);
  assert.equal(states.length, 5, 'nothing is reported while the state stays the same');
  tl.set(1);
  assert.deepEqual(states.slice(5), ['unfold'], 'set() changes the label and says so');
  assert.equal(button.textContent, 'Unfold');
});

test('timeline: destroy removes every listener', () => {
  const { slider, button, keys, tl, clock } = rig();
  tl.play(1);
  tl.destroy();
  assert.equal(tl.isPlaying(), false);
  assert.equal(clock.pending(), 0);
  for (const type of ['input', 'keydown', 'pointerdown']) assert.equal(slider.count(type), 0, type);
  assert.equal(button.count('click'), 0);
  for (const type of ['keydown', 'keyup', 'focusin', 'pointerdown']) assert.equal(keys.count(type), 0, 'key target: ' + type);
});

// ---- round 3: #51 (a C1/C2 detent, the playing thumb, a touch-sized zone) and #35 (Space after a mouse click) ----

test('#51 the detent profile: flat at the stop, slope 1 and no curvature at the zone edge, slope at most 1.25, exact inverse', () => {
  assert.equal(detentShape(0), 0);
  assert.equal(detentShape(1), 1);
  assert.equal(detentShape(-1), 0);
  assert.equal(detentShape(2), 1);
  const slope = (u, h = 1e-6) => (detentShape(u + h) - detentShape(u - h)) / (2 * h);
  assert.ok(detentShape(1e-6) / 1e-6 < 1e-5, 'flat at the stop (the magnet)');
  assert.ok(Math.abs(slope(1 - 1e-6) - 1) < 1e-5, 'slope 1 at the edge, as outside the zone (v1: 1.6)');
  const curvature = (u, h = 1e-4) => (detentShape(u + h) - 2 * detentShape(u) + detentShape(u - h)) / (h * h);
  assert.ok(Math.abs(curvature(1 - 1e-4)) < 2e-3, 'and no curvature there: C2');
  let steepest = 0;
  for (let i = 1; i < 10000; i++) {
    const s = slope(i / 10000);
    assert.ok(s > 0, 'strictly increasing');
    steepest = Math.max(steepest, s);
  }
  assert.ok(Math.abs(steepest - DETENT_MAX_SLOPE) < 1e-6, `the steepest slope is 1.25, in the middle of the zone (${steepest})`);
  for (let i = 0; i <= 20000; i++) {
    const y = i / 20000;
    assert.ok(Math.abs(detentShape(detentShapeInverse(y)) - y) < 1e-14, 'inverse at ' + y);
  }
});

test('#51 dragging: dt/dp is continuous everywhere (no step at a zone edge), on laptop and phone zones', () => {
  const sets = [
    [stopTimes([0, 0.45, 1]), DETENT],                              // o on a laptop (zone 13.3 px)
    [stopTimes([0, 0.2824, 0.5858, 0.7854, 1]), DETENT],            // ∗632's stops
    [stopTimes([0, 0.45, 1]), detentZone(178)],                     // o on a 390 px phone (zone 10 px)
    [stopTimes([0, 0.48, 0.52, 1]), DETENT],                        // zones cut at the midpoint
  ];
  for (const [ts, w] of sets) {
    const slope = (x, h) => (positionToTime(x + h, ts, w) - positionToTime(x, ts, w)) / h;
    // the largest change of the slope between neighbouring samples shrinks with the sample (a continuous slope);
    // v1's step of 0.6 at every zone edge would stay 0.6 at any sampling
    const worst = (h) => {
      let prev = slope(0, h), max = 0;
      for (let x = h; x + h <= 1; x += h) { const s = slope(x, h); max = Math.max(max, Math.abs(s - prev)); prev = s; }
      return max;
    };
    const coarse = worst(1e-4), fine = worst(1e-5);
    assert.ok(fine < 0.15 * coarse && fine < 0.03, `stops ${ts}: slope change per sample ${coarse.toFixed(4)} -> ${fine.toFixed(4)} as the sample shrinks tenfold`);
    for (const s of ts) {
      for (const edge of [s - w, s + w]) {
        if (edge <= 0 || edge >= 1) continue;
        const e = 1e-7, left = (positionToTime(edge, ts, w) - positionToTime(edge - e, ts, w)) / e, right = (positionToTime(edge + e, ts, w) - positionToTime(edge, ts, w)) / e;
        assert.ok(Math.abs(left - right) < 1e-4, `stops ${ts}: slope ${left.toFixed(5)} | ${right.toFixed(5)} at the zone edge ${edge.toFixed(4)}`);
      }
    }
  }
});

test('#51 the zone is 3.5 % of the track, but at least 10 px (a finger can feel it on a phone)', () => {
  assert.equal(DETENT_MIN_PX, 10);
  assert.equal(detentZone(378.66), DETENT, 'laptop: 3.5 % = 13.3 px');
  assert.ok(Math.abs(detentZone(178) - 10 / 178) < 1e-15, 'phone: 10 px instead of 6.2');
  assert.equal(detentZone(0), DETENT, 'no layout: the default');
  assert.equal(detentZone(50), 0.08, 'never more than 8 % of the track');
  for (const trackPx of [178, 214, 296]) {
    const { slider, tl } = rig({ trackPx });
    tl.setStops([0, 0.45, 1]);
    const p = 0.45 + 8.5 / trackPx;                       // 8.5 px past the stop
    slider.value = String(p); slider.fire('input');
    assert.ok(tl.get() < p - 1e-4 && tl.get() > 0.45, `${trackPx} px track: 8.5 px past the stop is inside its zone`);
    slider.value = String(0.45 + 10.5 / trackPx); slider.fire('input');
    assert.equal(tl.get(), 0.45 + 10.5 / trackPx, '10.5 px past it is outside');
  }
  // the zone follows the [data-scrub] box the slider sits in (width - 22 px thumb = the usable track)
  const wrap = fakeEl({ getBoundingClientRect: () => ({ width: 200, left: 0 }), querySelector: () => null });
  wrap.attrs['data-scrub'] = '';
  const slider = fakeEl({ parentElement: wrap });
  const tl = createTimeline({ slider, keyTarget: null, now: () => 0, raf: () => 1, caf() {} });
  tl.setStops([0, 0.45, 1]);
  slider.value = String(0.45 + 8.5 / 178); slider.fire('input');
  assert.ok(tl.get() < 0.45 + 8.5 / 178 - 1e-4, 'measured from the box: 178 px usable, 10 px zones');
  tl.destroy();
});

test('#51 playing: the thumb moves in step with t — through a tick as fast as anywhere else — and ends on the target', () => {
  const ts = stopTimes([0, 0.45, 1]);
  // from rest at 0: the thumb is exactly at p = t all the way
  {
    const { tl, clock } = rig();
    tl.setDuration(6);
    tl.setStops([{ t: 0, label: 'flat' }, { t: 0.45, label: 'tube' }, { t: 1, label: 'torus' }]);
    tl.play(1);
    let n = 0;
    while (tl.isPlaying()) { clock.tick(); n++; assert.ok(Math.abs(tl.getThumb() - tl.get()) < 1e-12, 'p = t while playing from 0'); }
    assert.equal(tl.getThumb(), 1);
    // v1 drew the thumb at timeToPosition(t): over the same frames it raced through the tick at 0.45
    const frames = [];
    for (let i = 1; i <= n; i++) frames.push(easePlay(i / n));
    let median = [], fastest = 0;
    for (let i = 1; i < frames.length; i++) {
      const v = timeToPosition(frames[i], ts) - timeToPosition(frames[i - 1], ts);
      median.push(v); fastest = Math.max(fastest, v);
    }
    median.sort((a, b) => a - b);
    assert.ok(fastest / median[median.length >> 1] > 2.5, 'v1 would have lurched (control)');
  }
  // from a scrubbed point inside a zone (the thumb is not at p = t there): affine in t, ending on the target
  {
    const { slider, tl, clock } = rig();
    tl.setDuration(6);
    tl.setStops([0, 0.45, 1]);
    slider.value = '0.43'; slider.fire('input');
    const t0 = tl.get(), p0 = tl.getThumb();
    assert.ok(Math.abs(p0 - t0) > 1e-3, 'inside the zone p differs from t');
    tl.play(1);
    const rows = [[t0, p0]];
    while (tl.isPlaying()) { clock.tick(); rows.push([tl.get(), tl.getThumb()]); }
    const k = (1 - p0) / (1 - t0);
    for (const [t, p] of rows) assert.ok(Math.abs(p - (p0 + (t - t0) * k)) < 1e-12, 'the thumb is an affine function of t');
    assert.deepEqual(rows[rows.length - 1], [1, 1]);
    let ratio = 0;
    for (let i = 1; i < rows.length; i++) {
      const dt = rows[i][0] - rows[i - 1][0];
      if (dt > 1e-9) ratio = Math.max(ratio, (rows[i][1] - rows[i - 1][1]) / dt);
    }
    assert.ok(ratio < 1.01, `the thumb moves at most 1 % faster than t (${ratio.toFixed(4)}); v1 up to 3x at a tick`);
  }
  // unfolding from 1 to 0 likewise, and play to a stop in the middle ends exactly on its tick
  {
    const { tl, clock } = rig();
    tl.setStops([0, 0.45, 1]);
    tl.set(1);
    tl.play(0.45);
    while (tl.isPlaying()) { clock.tick(); assert.ok(Math.abs(tl.getThumb() - tl.get()) < 1e-12); }
    assert.equal(tl.get(), 0.45);
    assert.equal(tl.getThumb(), 0.45);
  }
});

test('#51 a pause mid-play: the thumb glides onto the detent position in 150 ms, t does not move, nothing jumps', () => {
  const { tl, clock, seen } = rig();
  tl.setDuration(6);
  tl.setStops([0, 0.45, 1]);
  tl.play(1);
  while (tl.get() < 0.462) clock.tick();                  // just past the inner stop, inside its zone
  tl.stop();
  const t = tl.get(), from = tl.getThumb(), target = timeToPosition(t, stopTimes([0, 0.45, 1]));
  assert.ok(Math.abs(from - target) > 5e-4, 'the playing thumb is off the detent position here');
  assert.ok(Math.abs(from - target) < 0.004, 'by less than 0.4 % of the track');
  const n = seen.length, ps = [from];
  for (let i = 0; i < 15; i++) { clock.tick(); ps.push(tl.getThumb()); }
  assert.equal(seen.length, n, 'no onChange: t did not change');
  assert.equal(tl.get(), t);
  assert.equal(ps[ps.length - 1], target, 'settled exactly');
  const sign = Math.sign(target - from);
  let biggest = 0, moving = 0;
  for (let i = 1; i < ps.length; i++) {
    const d = ps[i] - ps[i - 1];
    assert.ok(d * sign >= -1e-15, 'never back');
    biggest = Math.max(biggest, Math.abs(d));
    if (Math.abs(d) > 0) moving++;
  }
  assert.ok(moving >= 7 && biggest < 0.3 * Math.abs(target - from), `a glide over ${moving} frames, not a jump`);
  // a play started during the glide starts from the thumb where it is drawn
  const { tl: tl2, clock: c2 } = rig();
  tl2.setDuration(6); tl2.setStops([0, 0.45, 1]); tl2.play(1);
  while (tl2.get() < 0.462) c2.tick();
  tl2.stop(); c2.tick(); c2.tick();
  const mid = tl2.getThumb();
  tl2.play(1);
  assert.equal(tl2.getThumb(), mid, 'resuming does not move the thumb');
  c2.tick();
  assert.ok(tl2.getThumb() >= mid, 'and it goes on forward');
});

test('#51 grabbing the thumb while it plays: it takes the detent position at once, and a drag continues from t', () => {
  const { slider, tl, clock } = rig();
  tl.setDuration(6);
  tl.setStops([0, 0.45, 1]);
  tl.play(1);
  while (tl.get() < 0.462) clock.tick();
  const t = tl.get();
  slider.fire('pointerdown');
  assert.equal(tl.isPlaying(), false, 'touching the slider stops playback');
  assert.equal(tl.getThumb(), timeToPosition(t, stopTimes([0, 0.45, 1])), 'the thumb is where t lives');
  assert.equal(Number(slider.value), tl.getThumb(), 'and the slider shows it');
  slider.value = String(tl.getThumb() + 0.001); slider.fire('input');
  assert.ok(Math.abs(tl.get() - t) <= 1.25 * 0.001 + 1e-12, 'the first move of the drag moves t by a slope-bounded step');
});

test('#35 Space after a mouse click on another button plays or pauses; after Tab to it, Space presses that button', () => {
  const { keys, tl, clock } = rig();
  // a button as the timeline sees it: what closest() / matches() answer, and whether it showed a focus ring on focus
  const btn = (focusVisible, inDialog = false) => {
    const el = {
      closest(sel) { if (/^dialog/.test(sel)) return inDialog ? {} : null; return sel.includes('button') ? el : null; },
      matches(sel) {
        if (sel === ':focus-visible') { if (focusVisible === 'unsupported') throw new SyntaxError(':focus-visible'); return focusVisible; }
        return sel.split(',').map((s) => s.trim()).includes('button');
      },
      contains: (x) => x === el,
    };
    return el;
  };
  const chip = btn(false);                                // focused by a mouse click (no focus ring)
  keys.fire('focusin', { target: chip });
  const down = keys.fire('keydown', { key: ' ', target: chip });
  assert.ok(down.defaultPrevented, 'the keydown is taken, so the chip is not pressed again');
  assert.equal(tl.isPlaying(), true, 'Space plays');
  assert.ok(keys.fire('keyup', { key: ' ', target: chip }).defaultPrevented, 'its keyup too (engines that press on keyup)');
  assert.ok(keys.fire('keydown', { key: ' ', target: chip, repeat: true }).defaultPrevented, 'a held Space does not press it either');
  assert.equal(tl.isPlaying(), true, '...and does not flutter');
  keys.fire('keydown', { key: ' ', target: chip });
  assert.equal(tl.isPlaying(), false, 'Space again pauses');
  keys.fire('keyup', { key: ' ', target: chip });

  const tabbed = btn(true);                               // reached by Tab: focus ring on focus
  keys.fire('focusin', { target: tabbed });
  assert.equal(keys.fire('keydown', { key: ' ', target: tabbed }).defaultPrevented, false, 'a button reached by keyboard keeps its Space');
  assert.equal(keys.fire('keyup', { key: ' ', target: tabbed }).defaultPrevented, false);
  assert.equal(tl.isPlaying(), false);

  const inDialog = btn(false, true);                      // a button in an open dialog (the picker's close button)
  keys.fire('focusin', { target: inDialog });
  assert.equal(keys.fire('keydown', { key: ' ', target: inDialog }).defaultPrevented, false, 'a dialog keeps its Space');
  assert.equal(tl.isPlaying(), false);

  const field = { closest: (sel) => (sel.includes('input:not') ? field : null), matches: (sel) => sel !== ':focus-visible' && false, contains: (x) => x === field };
  keys.fire('focusin', { target: field });
  assert.equal(keys.fire('keydown', { key: ' ', target: field }).defaultPrevented, false, 'a text field clicked into keeps its Space');
  assert.equal(tl.isPlaying(), false);

  // an engine without :focus-visible: a press just before the focus means a pointer focused it
  const old = btn('unsupported');
  keys.fire('pointerdown', {});
  keys.fire('focusin', { target: old });
  assert.ok(keys.fire('keydown', { key: ' ', target: old }).defaultPrevented);
  assert.equal(tl.isPlaying(), true, 'clicked, then Space: plays');
  keys.fire('keydown', { key: ' ', target: old }); keys.fire('keyup', { key: ' ', target: old });
  assert.equal(tl.isPlaying(), false, 'and pauses');
  clock.tick(1500);                                       // no press in the last second: the keyboard focused it
  const later = btn('unsupported');
  keys.fire('focusin', { target: later });
  assert.equal(keys.fire('keydown', { key: ' ', target: later }).defaultPrevented, false, 'Tab, then Space: the button keeps it');
  assert.equal(tl.isPlaying(), false);
});
