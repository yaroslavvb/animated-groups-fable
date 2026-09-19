// Inertia for the viewer's gestures: what keeps moving after the fingers lift.
//
// The page has always had a fling on a one-finger pan. This module generalises
// it to all three quantities a gesture can change — the pan, the zoom and the
// turn — and keeps them in one glide, so a pinch that also drifted and twisted
// carries on doing all three and settles together.
//
// Nothing here touches the DOM, the clock or an animation frame: a velocity is
// read from a list of samples, and a glide is a state object advanced by a
// number of seconds. That is what makes the behaviour testable without a
// browser, and it is why the browser test can check the *feel* (still growing a
// few frames later, finite when it stops) rather than re-deriving the constants.
//
// Three things make it iOS-like rather than merely exponential:
//
//   · the release velocity is the mean over the gesture's last ~100 ms, capped,
//     and a release that is really a stop (slow, or after a pause) throws
//     nothing at all;
//   · the zoom is integrated multiplicatively — a fling adds a *factor*, not a
//     number of pixels per lattice length, so it feels the same at every zoom;
//   · a glide that reaches a zoom limit does not stop dead against it. It gives
//     a few percent and springs back over a sixth of a second, which is how a
//     limit announces itself without feeling like a wall.
import {snapAngle, TURN_STEP, wrapAngle} from './renderer.mjs';

/** Decay time constants, seconds. The pan keeps the 0.35 s the page already
 * used, so a one-finger fling is unchanged to the last pixel; the zoom and the
 * turn settle sooner, since a picture that keeps growing reads as runaway far
 * earlier than one that keeps sliding. */
export const PAN_TAU = 0.35, ZOOM_TAU = 0.22, TURN_TAU = 0.25;

/** The release velocity is the mean over this much of the gesture's tail. */
export const WINDOW_MS = 100;
/** A release this long after the last movement is a stop, not a throw. */
export const STALE_MS = 80;
/** And a stretch this long *inside* the gesture with nothing reported is a
 * gesture that stopped: what it was doing before the pause is not part of the
 * speed it was let go at. Fingers and trackpads report every 8–16 ms, so this
 * only ever cuts a gesture that really did pause. */
export const MAX_GAP_MS = 50;
/** A scale or a turn measured over less than this is not a measurement: real
 * fingers report every 8–16 ms, so a gesture whose samples span less than two
 * frames says nothing about how fast it was going. (The pan has no such floor,
 * so that its long-standing behaviour — including the synthetic bursts the
 * browser test throws at it — is untouched.) */
export const MIN_SPAN_MS = 24;

/** Below these a release throws nothing. */
export const MIN_PAN_SPEED = 60;    // CSS px/s
export const MIN_ZOOM_RATE = 0.30;  // log units/s: 1.35× a second
export const MIN_TURN_RATE = 0.30;  // rad/s: 17°/s
/** And above these it throws no harder, however fast the events arrived. The
 * glide that follows adds at most rate × τ: 1.49× of zoom and 50° of turn. */
export const MAX_PAN_SPEED = 6000;
export const MAX_ZOOM_RATE = 1.8;
export const MAX_TURN_RATE = 3.5;
/** A channel stops when its velocity falls under these — a tenth of a lattice
 * length a second, 1.4 % of the scale a second, 6°/s — which is what keeps a
 * glide to about two thirds of a second rather than a long imperceptible crawl.
 * The pan keeps the threshold it has always had. */
export const STOP_PAN = 20, STOP_ZOOM = 0.06, STOP_TURN = 0.10;

/** The zoom limits are elastic: a glide may pass one by this much in log units
 * — 4 % — and is then returned to it over `ELASTIC_MS`. */
export const ELASTIC_GIVE = 0.04, ELASTIC_MS = 150;
/** How long the turn takes to ease onto the nearest quarter turn when it snaps. */
export const SNAP_MS = 130;
/** A thrown turn aims at a quarter turn rather than at wherever the decay
 * happens to stop. When the glide starts, the angle it is heading for is worked
 * out, and the nearest quarter turn to *that* becomes the target — but only if
 * the correction is no bigger than half a quarter turn (the most it can ever be)
 * **and** no bigger than the throw itself, and only if that quarter turn lies
 * the way the fingers were turning. So a flick lands on a symmetry of the
 * picture — the lattice is square, and a quarter turn with a quarter period is
 * one of its colour-preserving operations — exactly as a turn released at rest
 * does, while a small nudge is never dragged 45° it did not ask for and nothing
 * is ever pulled backwards. */
export const TURN_CATCH = TURN_STEP / 2;
const STEP_TURN = TURN_STEP;
/** The longest step the integrator will take in one go: a tab that was hidden
 * for a second must not teleport the view when it comes back. */
export const MAX_STEP = 0.25;

/** Nothing thrown — the value the estimator returns for a release that is a
 * stop, and what a reduced-motion viewer gets for every release. */
export const NO_THROW = Object.freeze({pan: Object.freeze([0, 0]), zoom: 0, turn: 0, span: 0, age: 0});

const easeOutCubic = u => 1 - (1 - u) ** 3;
const easeInOutCubic = u => u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2;
/** The elastic excursion: out over the first third, back over the rest, exactly
 * zero at the end. The way out is a quarter sine rather than a cubic because
 * its opening speed is about the speed the glide arrived at the limit with —
 * a cubic leaves twice as fast as it came in, which reads as a pop rather than
 * as the same movement carrying past the end. */
export function elasticProfile(u) {
  if (u <= 0) return 0;
  if (u >= 1) return 0;
  const out = 0.34;
  return u <= out ? Math.sin(Math.PI * u / (2 * out)) : 1 - easeInOutCubic((u - out) / (1 - out));
}
const clampMagnitude = (value, cap) => Math.max(-cap, Math.min(cap, value));

/** Drops samples older than `window` before the newest one. The gesture keeps
 * its own list and trims it as it moves, so the estimate below reads a fixed
 * slice of the tail rather than the whole gesture. */
export function trimSamples(samples, window = WINDOW_MS) {
  const last = samples[samples.length - 1];
  while (samples.length > 1 && last.time - samples[0].time > window) samples.shift();
  return samples;
}

/** The release velocity of a gesture.
 *
 * A sample is `{time` (ms)`, mid` ([x, y] CSS px)`, logScale, angle` (rad)`}`;
 * the last two may be absent for a gesture that cannot change them. The
 * estimate is the mean over the window — first to last, divided by the time
 * from the first sample to the release, so that a hesitation before letting go
 * damps the throw exactly as it should.
 *
 * Each channel is then floored (a slow release is a stop) and capped (a burst
 * of events arriving in the same millisecond is not a fast gesture). `gain`
 * scales a channel before both, which is how the wheel gets a gentler version
 * of the same inertia. */
export function estimateVelocity(samples, at, options = {}) {
  const {
    window = WINDOW_MS, stale = STALE_MS, maxGap = MAX_GAP_MS, minSpan = MIN_SPAN_MS, minEvents = 2,
    panGain = 1, zoomGain = 1, turnGain = 1,
    minPan = MIN_PAN_SPEED, minZoom = MIN_ZOOM_RATE, minTurn = MIN_TURN_RATE,
    maxPan = MAX_PAN_SPEED, maxZoom = MAX_ZOOM_RATE, maxTurn = MAX_TURN_RATE,
  } = options;
  if (!samples || samples.length < Math.max(2, minEvents)) return NO_THROW;
  const last = samples[samples.length - 1];
  const age = at - last.time;
  if (!(age >= 0) || age > stale) return NO_THROW;
  // The window is measured back from the newest sample, which is how the
  // gesture trimmed its own list: the estimate is then the same whether the
  // trimming happened as it moved or here. A gap in the reporting ends it
  // early — a jump after a pause is a jump, not a speed.
  let first = last;
  for (let i = samples.length - 1; i > 0; i--) {
    const previous = samples[i - 1];
    if (last.time - previous.time > window || samples[i].time - previous.time > maxGap) break;
    first = previous;
  }
  const span = last.time - first.time;
  const dt = (at - first.time) / 1000;
  if (first === last || !(dt > 0)) return NO_THROW;

  const pan = [(last.mid[0] - first.mid[0]) / dt * panGain, (last.mid[1] - first.mid[1]) / dt * panGain];
  const speed = Math.hypot(pan[0], pan[1]);
  const kept = speed > minPan ? Math.min(1, maxPan / speed) : 0;

  const measurable = span >= minSpan;
  let zoom = 0;
  if (measurable && Number.isFinite(first.logScale) && Number.isFinite(last.logScale)) {
    zoom = (last.logScale - first.logScale) / dt * zoomGain;
    zoom = Math.abs(zoom) > minZoom ? clampMagnitude(zoom, maxZoom) : 0;
  }
  let turn = 0;
  if (measurable && Number.isFinite(first.angle) && Number.isFinite(last.angle)) {
    // The angle is kept wrapped, and two fingers crossing the atan2 seam step
    // by a full turn; the short way round is always the one that happened.
    turn = wrapAngle(last.angle - first.angle) / dt * turnGain;
    turn = Math.abs(turn) > minTurn ? clampMagnitude(turn, maxTurn) : 0;
  }
  return {pan: [pan[0] * kept, pan[1] * kept], zoom, turn, span, age};
}

/** Starts a glide, or returns null when nothing was thrown.
 *
 * `logScale`/`angle` are where the view stands at the release and where the
 * glide takes over; `logMin`/`logMax` are the zoom limits it may stretch past
 * by `ELASTIC_GIVE`. `snap` asks for the turn to ease onto the nearest quarter
 * when it comes to rest, as a turn made by hand already does. */
export function createFling(velocity, {
  logScale = 0, angle = 0, logMin = -Infinity, logMax = Infinity, snap = true,
  panTau = PAN_TAU, zoomTau = ZOOM_TAU, turnTau = TURN_TAU,
  give = ELASTIC_GIVE, elasticMs = ELASTIC_MS, snapMs = SNAP_MS, turnCatch = TURN_CATCH,
} = {}) {
  const pan = velocity?.pan ?? [0, 0];
  const zoomRate = velocity?.zoom ?? 0, turnRate = velocity?.turn ?? 0;
  if (!Math.hypot(pan[0], pan[1]) && !zoomRate && !turnRate) return null;
  const target = snap ? turnTargetFor(angle, turnRate, turnTau, turnCatch) : null;
  // Aiming at a quarter turn is a change of *rate*, not a correction bolted on
  // end: the decay's own asymptote is moved onto the target, so the glide eases
  // onto it with the same exponential it would have had anyway.
  const aimed = target === null ? turnRate : (target - angle) / turnTau;
  return {
    velocity: [pan[0], pan[1]], zoomRate, turnRate: aimed, thrownTurn: turnRate, turnTarget: target,
    logScale, angle, logMin, logMax, over: 0, overSign: 1,
    zoomPhase: zoomRate ? 'glide' : 'done', turnPhase: turnRate ? 'glide' : 'done',
    depth: 0, elasticElapsed: 0, snapFrom: angle, snapTo: angle, snapElapsed: 0,
    snap, panTau, zoomTau, turnTau, give, elasticMs, snapMs, live: true,
  };
}

/** Where a thrown turn should land, or null for "wherever it stops". `angle` is
 * the angle at the release, `rate` the thrown angular velocity; the glide would
 * come to rest at `angle + rate × tau`, and this returns the nearest quarter
 * turn to that when it is close enough to be worth aiming at — see TURN_CATCH.
 * The angles are absolute, not wrapped: the caller wraps what it draws. */
export function turnTargetFor(angle, rate, turnTau = TURN_TAU, catchWindow = TURN_CATCH) {
  if (!rate) return null;
  const thrown = rate * turnTau, landing = angle + thrown;
  const quarter = Math.round(landing / STEP_TURN) * STEP_TURN;
  const correction = quarter - landing;
  if (Math.abs(correction) > Math.min(catchWindow, Math.abs(thrown))) return null;
  // Never against the throw: a quarter turn behind where the fingers let go is
  // not somewhere a flick forwards may end up.
  if (Math.sign(quarter - angle) !== Math.sign(rate)) return null;
  return quarter;
}

/** Advances a glide by `dt` seconds and says what to do with the view: how far
 * to pan in CSS pixels, and what the log scale and the angle now are — the
 * scale including any elastic excursion past a limit. `live` is false on the
 * step that finishes it, and that step always lands inside the limits. */
export function advanceFling(state, dt) {
  if (!state || !state.live) return {pan: [0, 0], logScale: state?.logScale ?? 0, angle: state?.angle ?? 0, zoomMoved: false, turnMoved: false, live: false};
  const step = Math.min(Math.max(dt, 0), MAX_STEP);
  const wasScale = state.logScale + state.over, wasAngle = state.angle;

  // The pan: the displacement of an exponentially decaying velocity over dt.
  const decay = Math.exp(-step / state.panTau);
  const travel = state.panTau * (1 - decay);
  const pan = [state.velocity[0] * travel, state.velocity[1] * travel];
  state.velocity = [state.velocity[0] * decay, state.velocity[1] * decay];
  if (Math.hypot(state.velocity[0], state.velocity[1]) < STOP_PAN) state.velocity = [0, 0];

  advanceZoom(state, step);
  advanceTurn(state, step);

  state.live = !!(state.velocity[0] || state.velocity[1]) || state.zoomPhase !== 'done' || state.turnPhase !== 'done';
  const logScale = state.logScale + state.over;
  return {pan, logScale, angle: state.angle, zoomMoved: logScale !== wasScale, turnMoved: state.angle !== wasAngle, live: state.live};
}

function advanceZoom(state, dt) {
  if (state.zoomPhase === 'done') return;
  if (state.zoomPhase === 'elastic') {
    state.elasticElapsed += dt * 1000;
    const u = Math.min(1, state.elasticElapsed / state.elasticMs);
    state.over = u >= 1 ? 0 : state.overSign * state.depth * elasticProfile(u);
    if (u >= 1) state.zoomPhase = 'done';
    return;
  }
  const decay = Math.exp(-dt / state.zoomTau);
  const next = state.logScale + state.zoomRate * state.zoomTau * (1 - decay);
  state.zoomRate *= decay;
  const limit = next > state.logMax ? state.logMax : next < state.logMin ? state.logMin : null;
  if (limit !== null) {
    // The glide has run into a limit. How deep it gives is set by what it had
    // left to spend — the step it could not take, plus the rate × τ still in
    // the velocity — squashed through a rubber band that can never exceed the
    // give, so a gentle arrival barely dents it and a hard one bottoms out.
    const remaining = Math.abs(next - limit) + Math.abs(state.zoomRate) * state.zoomTau;
    state.logScale = limit;
    state.overSign = Math.sign(next - limit) || 1;
    state.depth = state.give * (1 - Math.exp(-remaining / state.give));
    state.zoomRate = 0;
    state.elasticElapsed = 0;
    state.over = 0;
    state.zoomPhase = state.depth > 1e-4 ? 'elastic' : 'done';
    return;
  }
  state.logScale = next;
  if (Math.abs(state.zoomRate) < STOP_ZOOM) { state.zoomRate = 0; state.zoomPhase = 'done'; }
}

function advanceTurn(state, dt) {
  if (state.turnPhase === 'done') return;
  if (state.turnPhase === 'snap') {
    state.snapElapsed += dt * 1000;
    const u = Math.min(1, state.snapElapsed / state.snapMs);
    state.angle = u >= 1 ? state.snapTo : state.snapFrom + (state.snapTo - state.snapFrom) * easeOutCubic(u);
    if (u >= 1) state.turnPhase = 'done';
    return;
  }
  const decay = Math.exp(-dt / state.turnTau);
  state.angle = wrapAngle(state.angle + state.turnRate * state.turnTau * (1 - decay));
  state.turnRate *= decay;
  if (Math.abs(state.turnRate) >= STOP_TURN) return;
  state.turnRate = 0;
  // Coming to rest: onto the quarter turn the throw was aimed at, and failing
  // that — an unaimed glide, or one the catch declined — onto a quarter within 4° of
  // where it stopped, exactly as a turn made by hand does as the fingers lift.
  const snapped = state.turnTarget !== null && state.turnTarget !== undefined ? state.turnTarget
    : state.snap ? snapAngle(state.angle) : state.angle;
  if (snapped === state.angle) { state.turnPhase = 'done'; return; }
  state.turnPhase = 'snap';
  state.snapFrom = state.angle;
  state.snapTo = state.angle + wrapAngle(snapped - state.angle);
  state.snapElapsed = 0;
}
