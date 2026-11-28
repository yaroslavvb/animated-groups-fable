// page.js — PQRS pillows: the controller. ONE state (state.js: the engine's state of four cone points), ONE ui
// ({ j: the journey 0..2, az, el: the turntable }), and ONE door for every change:
//
//   apply(next, { flip, cold, dragging })
//       pattern   pattern-glue.js   (a flip: still(invQ) first, so no pixel of the print moves)
//       cards     cards.js          (the three partitions, all refreshed: they stay true at every moment)
//       surface   showSurface()     (surface-model.js + surface-pane.js + print3d.js, behind ONE switch: SURFACE)
//       table     the two pillows in numbers
//       address   toHash -> history.replaceState + shareHash (the spacesheep viewer)
//
// A slider's input is drawn once a frame (several inputs in one frame are one draw); a flip, a preset, a typed
// signature and a link are drawn at once, in the task that asked.

import {
  PRESETS, DEFAULT_UI, stateFor, kindOf, keyOf, featureLabel, cardsOf, activate, withNumbers, toHash, fromHash, pillowsOf,
  lengthText, twistText,
} from './state.js';
import { createPatternGlue } from './pattern-glue.js';
import { createCards } from './cards.js';
import { createTimeline } from '../../classification-of-surfaces/src/vendor/the-folding/timeline.js';
import { shareHash } from '../../classification-of-surfaces/src/sharehash.js';
// ---- the Surface pane's three modules (SPEC 3.3, 3.4) ----
import { createSurfaceModel } from './surface-model.js';
import { createSurfacePane } from './surface-pane.js';
import { createPrint3d } from './print3d.js';

/** THE SWITCH: false shows the quiet "surface loading" line instead of the 3D pane; everything else works. */
const SURFACE = true;

const $ = (id) => document.getElementById(id);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const now = () => (window.performance ? window.performance.now() : Date.now());

// ---- the one state, the one ui -------------------------------------------------------------------------------------
let state = null;
const ui = { j: DEFAULT_UI.j, az: DEFAULT_UI.az, el: DEFAULT_UI.el };
let tab = 'play';

const glue = createPatternGlue($('pattern'), { tip: $('tip') });
const cards = createCards($('cards'), {
  onActivate: (key) => activateCard(key),
  onInput: (key, numbers, meta) => inputCard(key, numbers, meta),
  format: { length: lengthText, twist: twistText },
});

// ---- the Surface pane: mountSurface(host) once, showSurface(state, { flip, dragging }) on every change ---------------
const PAIR_BLUE = [0, 0.447, 0.698], PAIR_ORANGE = [0.835, 0.369, 0], INK = [0.102, 0.102, 0.122];
const surface = {
  on: false, sm: null, pane: null, print: null,
  started: false, version: null, stats: null, exact: null, fails: 0, error: null,
  lastBake: -1e9, bakeMs: 0, bakeTimer: 0, baked: '', bakedFor: null, charted: false, settle: 0, settleLeft: 0, userView: false,
  ms: { model: 0, bake: 0, baked: false, chart: 0, pane: 0 },      // the last frame's script time, part by part (for the checks)
};

function surfaceNote(text) {
  const el = $('surf-wait');
  if (!el) return;
  el.textContent = text || '';
  el.hidden = !text;
}
function surfaceFailed(err) {
  surface.error = String(err && err.message ? err.message : err);
  surface.fails += 1;
  surface.started = false;                       // the next change starts cold
  if (surface.fails === 1 && typeof console !== 'undefined') console.warn('PQRS pillows: the surface could not be drawn:', err);
  if (surface.fails >= 6) surface.on = false;      // give up quietly; the page works without it
  surfaceNote(surface.on ? 'surface not drawn for these numbers' : 'surface not available');
}

function mountSurface(host) {
  if (!SURFACE || typeof createSurfaceModel !== 'function' || typeof createSurfacePane !== 'function') return false;
  try {
    surface.sm = createSurfaceModel({ nVertices: 2600 });
    surface.pane = createSurfacePane(host.canvas, { labelLayer: host.labels, view: { az: ui.az, el: ui.el, zoom: 1 }, sides: 'paper' });
    if (surface.pane && surface.pane.ok === false) throw new Error('no WebGL2 for the surface');
    try { surface.print = typeof createPrint3d === 'function' ? createPrint3d() : null; } catch (err) { surface.print = null; }
    if (typeof surface.pane.onView === 'function') {
      surface.pane.onView(() => {
        const v = surface.pane.getView ? surface.pane.getView() : null;
        if (!v || !Number.isFinite(v.az) || !Number.isFinite(v.el)) return;
        if (Math.abs(v.az - ui.az) < 0.05 && Math.abs(v.el - ui.el) < 0.05) return;
        ui.az = v.az; ui.el = v.el; surface.userView = true;
        scheduleHash();
      });
    }
    surface.on = true;
    host.reset.hidden = false;
    host.hint.hidden = hintGone['view-hint'];
    surfaceNote('');
  } catch (err) {
    surface.on = false;
    surface.error = String(err && err.message ? err.message : err);
    if (typeof console !== 'undefined') console.warn('PQRS pillows: the surface pane could not start:', err);
    surfaceNote('surface not available');
  }
  return surface.on;
}

/**
 * The print on the surface: the pattern's own commas, baked for this state (print3d.js). Returns true when the
 * texture now shown is this state's. A failure leaves the surface in its plain tones for good.
 */
function bakePrint(st, size) {
  const S = surface;
  if (!S.on || !S.print || typeof S.print.bake !== 'function') return false;
  try {
    const t0 = now(), pr = S.print.bake(st, { size });
    S.bakeMs = now() - t0; S.lastBake = now();
    S.pane.setPrint(pr || null);
    S.baked = pr ? `${toHash(st, {})}@${size}` : '';
    S.bakedFor = pr ? st : null;                  // print3d's chartOf folds with THIS state's motions from here on
    return !!pr;
  } catch (err) {
    S.print = null;                               // plain tones from here on
    try { S.pane.setPrint(null); } catch (e) { /* nothing to undo */ }
    if (typeof console !== 'undefined') console.warn('PQRS pillows: the print could not be baked; the surface keeps its plain tones:', err);
    return false;
  }
}

/**
 * One frame of the surface: the model's frame at the journey's place, handed to the pane.
 *   bake   'auto': the state changed (a full print at once; while a slider is dragged a small one, every frame
 *          where a bake is quick, else at most every 90 ms, and the full one 200 ms after the last change);
 *          'full': that late full print; null: the state is the one drawn last (the journey moved, the solver
 *          settled).
 * The chart points go with the bake: print3d folds with the motions of the state baked last, so they are taken anew
 * only when a bake was made, or when the mesh itself is another.
 */
function drawSurfaceFrame(st, { dragging = false, bake = null } = {}) {
  const S = surface, tA = now(), fr = S.sm.frame(clamp(ui.j, 0, 2));
  const labelOf = (m) => featureLabel(st, m.feature);
  let baked = false;
  if (S.print && bake) {
    // a bake is a few ms here: under a drag every frame gets a small one; where a bake is slow they are spaced out
    const slow = S.bakeMs > 90, quick = S.bakeMs < 12;
    if (bake === 'full') baked = bakePrint(st, 1024);
    else if (!dragging && !slow) baked = bakePrint(st, 1024);
    else if (quick || now() - S.lastBake >= (slow ? 240 : 90)) baked = bakePrint(st, 512);
    clearTimeout(S.bakeTimer);
    if (bake === 'auto' && (dragging || slow)) {
      S.bakeTimer = setTimeout(() => {
        if (!S.on || !S.started || !S.print || S.baked === `${toHash(state, {})}@1024`) return;
        try { drawSurfaceFrame(state, { bake: 'full' }); } catch (err) { surfaceFailed(err); }
      }, 200);
    }
  }
  // A new mesh needs a new chart, and a chart is only right beside the texture of ITS state (the pane owner's note 2):
  // where this frame's bake was skipped (a slow bake under a drag) and the triangles changed, bake after all.
  const needChart = fr.version !== S.version || !S.charted;
  if (S.print && !baked && needChart && S.bakedFor !== st) baked = bakePrint(st, dragging ? 512 : 1024);
  // uv: undefined keeps the chart shown (the pane's rule), null is no print, an array is this state's chart
  const tB = now();
  let uv;
  if (!S.print) uv = null;
  else if (fr.corners && typeof S.print.chartOf === 'function' && (baked || needChart)) {
    try {
      uv = S.print.chartOf(fr.corners);
      S.charted = true;
    } catch (err) { uv = null; }
  }
  const tC = now();
  if (typeof S.pane.showFrame === 'function') {
    const o = { labels: labelOf, render: false };
    if (uv !== undefined) o.uv = uv;
    S.pane.showFrame(fr, o);
  } else {
    // the prototype pane (no showFrame): the same through its setters
    if (fr.version !== S.version || uv) S.pane.setMesh({ positions: fr.positions, triangles: fr.triangles, pillow: fr.pillow, uv: uv || null });
    else S.pane.setPositions(fr.positions);
    S.pane.setCurves((fr.curves || []).map((c) => ({
      id: c.id, chain: c.chain, pillow: c.pillow, closed: !!c.closed,
      color: c.id === 'loop' ? INK : c.id === 'seal0' ? PAIR_BLUE : PAIR_ORANGE, width: c.id === 'loop' ? 1.8 : 3, xray: 0.3,
    })));
    S.pane.setMarks((fr.marks || []).map((m) => ({
      id: m.id, vertex: m.vertex, pillow: m.pillow, label: labelOf(m),
      color: m.pair ? PAIR_ORANGE : PAIR_BLUE, labelColor: m.pair ? '#b04d00' : '#0072b2', size: m.pair ? 9.5 : 13,
    })));
    if (fr.frame) S.pane.setFrame(fr.frame);
  }
  S.version = fr.version;
  S.stats = fr.stats || null;
  S.exact = fr.exact;
  S.pane.render();
  S.ms.bake = baked ? tB - tA : 0; S.ms.baked = baked; S.ms.chart = tC - tB; S.ms.pane = now() - tC;
  return fr;
}

/** After a change the solver may still be settling: a few more frames of it, while nothing else is asked. */
function settleSurface() {
  const S = surface;
  cancelAnimationFrame(S.settle);
  // A solver that says whether it is settling (solver.js) is followed until it rests: a cold start that begins from
  // the flattened tetrahedron takes about half a second. Otherwise a few frames, until the stretch stops changing.
  S.settleLeft = S.sm.settling === undefined ? 30 : 400;
  const step = () => {
    S.settle = 0;
    if (!S.on || !S.started || S.settleLeft <= 0 || tab !== 'play') return;
    S.settleLeft -= 1;
    try {
      const before = S.stats ? S.stats.strainMean : null;
      if (S.sm.settling === false) { fillNote(); return; }                                       // it rests
      if (typeof S.sm.settle === 'function') S.sm.settle(8); else S.sm.update(state, 6);
      drawSurfaceFrame(state, {});
      const after = S.stats ? S.stats.strainMean : null;
      fillNote();
      if (S.sm.settling === false) return;
      if (S.sm.settling === undefined && before !== null && after !== null && Math.abs(after - before) < 2e-5) return;
    } catch (err) { surfaceFailed(err); return; }
    S.settle = requestAnimationFrame(step);
  };
  S.settle = requestAnimationFrame(step);
}

/**
 * The surface for a state. flip: { invQ, before } of an activation (the SAME surface on the new partition's mesh,
 * turned over to its new pose); dragging: a slider is moving (a short solver step, a small print); cold: a new
 * signature or a link; journey: only the journey moved.
 */
function showSurface(st, { flip = null, dragging = false, cold = false, journey = false } = {}) {
  const S = surface;
  if (!S.on) return;
  try {
    let turn = null, shift = null;
    const tM = now();
    if (!journey || !S.started) {
      if (cold || !S.started) {
        S.sm.set(st);
        S.started = true;
      } else if (flip) {
        // new pose = turn · old pose + shift (each pose has its own loop's middle at the origin)
        const r = S.sm.flip(st, { invQ: flip.invQ, before: flip.before });
        if (r && r.turn && !r.cold) { turn = r.turn; shift = r.shift || null; }
      } else {
        S.sm.update(st, dragging ? 4 : 10);
      }
    }
    S.ms.model = now() - tM;
    drawSurfaceFrame(st, { dragging, bake: journey && S.started ? null : 'auto' });
    // the model is in its new pose already: the pane shows it turned back onto the old one and eases to the new
    // (0.5 s; at once under reduced motion: the pane's own rule)
    if (turn && typeof S.pane.turn === 'function') S.pane.turn(turn, reducedMotion() ? 0 : 0.5, shift ? { inverse: true, shift } : { inverse: true });
    S.fails = 0;
    surfaceNote('');
    if (!dragging && !journey) settleSurface();
  } catch (err) {
    surfaceFailed(err);
  }
}

// ---- the table of the two pillows (SPEC 1.5) -------------------------------------------------------------------------
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
/** The cone angle 2 pi / n as text, reduced: π, 2π/3, π/2, 2π/5, π/3 … */
const cornerText = (n) => (n === 2 ? 'π' : n % 2 === 0 ? `π/${n / 2}` : `2π/${n}`);
/** The area 2 pi (1 - 1/p - 1/q) as a multiple of pi. */
function areaText(row) {
  if (row.kind === 'E') return row.area.toFixed(3);
  const [p, q] = row.orders, n = 2 * (p * q - p - q), d = p * q, g = gcd(n, d) || 1, a = n / g, b = d / g;
  if (a === 0) return '0';
  return `${a === 1 ? '' : a}π${b === 1 ? '' : `/${b}`}`;
}
function fillTable() {
  const rows = pillowsOf(state), body = $('pillows-body');
  // a pillow's two cone points are written in the order P, Q, R, S (state.js lists them in the cut's slot order)
  const inOrder = (r) => (r.features[0] <= r.features[1] ? [0, 1] : [1, 0]);
  const nameOf = (r) => inOrder(r).map((i) => featureLabel(state, r.features[i])).join(' ');
  const html = rows.map((r, i) => {
    const o = inOrder(r);
    const cells = [
      `<span class="pq-tdot"></span>${nameOf(r)}`,
      o.map((k) => cornerText(r.orders[k])).join(', '),
      r.loop.toFixed(3),
      r.seal.toFixed(3),
      o.map((k) => r.heights[k].toFixed(3)).join(', '),
      areaText(r),
    ];
    return `<tr data-pair="${i}">${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
  }).join('');
  if (body.innerHTML !== html) body.innerHTML = html;
  $('key-pair-1').textContent = nameOf(rows[0]);
  $('key-pair-2').textContent = nameOf(rows[1]);
  fillNote(rows);
}
/** The one line under the table: is the crown exact, and how far the closed mesh is from its exact lengths. */
function fillNote(rows = null) {
  const rs = rows || pillowsOf(state), kind = kindOf(state), parts = [];
  if (kind === 'E') parts.push('Flat: the closed solid is exact, no relaxation.');
  else {
    const past = rs.filter((r) => !r.degenerate && !r.exact);
    parts.push(past.length ? 'Open crowns: peaks past the rim: flange.' : 'Open crowns: crown exact.');
    if (rs.some((r) => r.degenerate)) parts.push('A pair of 2s has no area: its pillow is its seal, lying on the loop.');
    const s = surface.on ? surface.stats : null;
    if (s && Number.isFinite(s.strainMean) && Number.isFinite(s.strainMax)) parts.push(`Closed surface: relaxed mesh, mean stretch ${(100 * s.strainMean).toFixed(1)} %, worst ${(100 * s.strainMax).toFixed(1)} %.`);
    else parts.push('Closed surface: a mesh relaxed toward the exact lengths.');
  }
  const text = parts.join(' '), el = $('pillows-note');
  if (el.textContent !== text) el.textContent = text;
}

// ---- the address ---------------------------------------------------------------------------------------------------
let hashTimer = 0, lastHash = null;
const hashNow = () => toHash(state, surface.userView ? ui : { j: ui.j });
function writeHash() {
  clearTimeout(hashTimer);
  hashTimer = 0;
  if (!state) return;
  const h = hashNow();
  if (h === lastHash) return;
  lastHash = h;
  try { if (window.location.hash !== h && !(h === '#' && window.location.hash === '')) window.history.replaceState(null, '', h); } catch (err) { /* a sandboxed frame may refuse */ }
  shareHash(h);
}
function scheduleHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(writeHash, 80);
}

// ---- the one door ----------------------------------------------------------------------------------------------------
let pending = null, frame = 0;
/** Script time of the last draw, part by part (ms), and the sums over the slider frames since perfReset(): for the checks. */
const perf = { last: null, drag: null };
function perfReset() { perf.drag = { n: 0, pattern: 0, cards: 0, surface: 0, model: 0, bake: 0, bakes: 0, chart: 0, pane: 0, rest: 0, total: 0, worst: 0 }; }
perfReset();
function draw(next, { flip = null, cold = false, dragging = false } = {}) {
  const t0 = now();
  state = next;
  if (flip) glue.still(flip.invQ);
  glue.show(state, { keepView: !cold });
  const t1 = now();
  cards.update(cardsOf(state), state);
  const t2 = now();
  showSurface(state, { flip, cold, dragging });
  const t3 = now();
  fillTable();
  syncShell();
  if (dragging) scheduleHash(); else writeHash();
  const t4 = now(), m = surface.ms;
  perf.last = { kind: flip ? 'flip' : cold ? 'cold' : dragging ? 'drag' : 'step', pattern: t1 - t0, cards: t2 - t1, surface: t3 - t2, model: m.model, bake: m.bake, chart: m.chart, pane: m.pane, rest: t4 - t3, total: t4 - t0 };
  if (!flip && !cold) {
    const d = perf.drag;
    d.n += 1; d.pattern += t1 - t0; d.cards += t2 - t1; d.surface += t3 - t2; d.model += m.model; d.bake += m.bake; d.bakes += m.baked ? 1 : 0; d.chart += m.chart; d.pane += m.pane; d.rest += t4 - t3; d.total += t4 - t0;
    if (t4 - t0 > d.worst) d.worst = t4 - t0;
  }
}
function flush() {
  if (!frame) return;
  cancelAnimationFrame(frame);
  frame = 0;
  const p = pending;
  pending = null;
  if (p) draw(p.state, p.opts);
}
/**
 * Every change of the state comes through here. opts.flip = { invQ, before } (an activation), opts.cold (another
 * orbifold, a link), opts.dragging (a slider under the finger). Nothing is done when nothing changed.
 */
function apply(next, opts = {}) {
  if (!next) return;
  if (next === state && !opts.flip && !opts.cold) {
    // nothing changed. The end of a drag still says so: the frame not yet drawn is drawn at rest, or the surface
    // (last drawn in a hurry) is let settle, and the address is written
    if (opts.dragging) return;
    if (pending) pending.opts.dragging = false;
    else { if (surface.on && surface.started) settleSurface(); writeHash(); }
    return;
  }
  if (opts.flip || opts.cold || opts.now) { flush(); draw(next, opts); return; }
  pending = { state: next, opts: { dragging: !!opts.dragging } };
  state = next;                                   // what the next input builds on
  if (!frame) frame = requestAnimationFrame(() => { frame = 0; const p = pending; pending = null; if (p) draw(p.state, p.opts); });
}

function activateCard(key) {
  const r = activate(state, key);
  if (!r.changed) return false;
  dropHint('view-hint');
  apply(r.state, { flip: { invQ: r.invQ, Q: r.Q, before: r.before } });
  return true;
}
function inputCard(key, numbers, meta = {}) {
  if (key !== keyOf(state)) activateCard(key);                      // a slider of another card: that card first
  const next = withNumbers(state, numbers, meta.range && Number.isFinite(numbers.L) ? { lRange: meta.range } : {});
  if (next !== state) dropHint('view-hint');
  apply(next, { dragging: !!meta.dragging });
}

// ---- presets, the typed orders ---------------------------------------------------------------------------------------
const sigIn = $('sig-in'), sigPop = $('sig-pop');
let popTimer = 0;
function refuse(text) {
  sigPop.textContent = text;
  sigPop.hidden = false;
  clearTimeout(popTimer);
  popTimer = setTimeout(() => { sigPop.hidden = true; }, 2600);
}
function openSignature(text, { fromField = false } = {}) {
  const st = stateFor(text);
  if (!st) return false;
  if (!fromField) sigIn.value = PRESETS.includes(st.k) ? '' : st.k;
  sigPop.hidden = true;
  if (state && st.k === state.k && fromField) { syncShell(); return true; }      // already shown: nothing moves
  apply(st, { cold: true });
  return true;
}
function readField({ final = false } = {}) {
  const raw = sigIn.value, s = raw.replace(/[\s,;·]+/g, '');
  if (!s) { sigPop.hidden = true; return; }
  if (/^[2-9]{4}$/.test(s)) {
    if (!openSignature(s, { fromField: true })) refuse(`No pattern for ${s} here: four orders from 2 to 9.`);
    return;
  }
  const bad = /[^2-9]/.test(s) || s.length > 4;
  if (bad || final) refuse('Four cone points only: four orders, each from 2 to 9, such as 2346.');
}
sigIn.addEventListener('input', () => readField());
sigIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); readField({ final: true }); } });
for (const b of document.querySelectorAll('.chip[data-sig]')) b.addEventListener('click', () => openSignature(b.dataset.sig));

function syncShell() {
  const k = state.k, preset = PRESETS.includes(k);
  for (const b of document.querySelectorAll('.chip[data-sig]')) b.setAttribute('aria-pressed', String(b.dataset.sig === k));
  if (!preset && document.activeElement !== sigIn && sigIn.value.replace(/[\s,;·]+/g, '') !== k) sigIn.value = k;
  sigIn.dataset.on = !preset && sigIn.value.replace(/[\s,;·]+/g, '') === k ? '1' : '0';
  $('pat-sub').textContent = kindOf(state) === 'E' ? 'Euclidean plane' : 'Poincaré disc';
}

// ---- the journey: surface -> two pillows -> open crowns --------------------------------------------------------------
const jLeft = $('j-left'), jRight = $('j-right'), jStops = Array.from(document.querySelectorAll('.pq-jstops > span'));
function syncJourney() {
  const j = ui.j, e = 0.004;
  jLeft.textContent = j > 1 + e ? 'Zip' : 'Join';
  jLeft.disabled = j <= e;
  jRight.textContent = j >= 1 - e ? 'Unzip' : 'Part';
  jRight.disabled = j >= 2 - e;
  jStops.forEach((s, i) => { s.dataset.at = Math.abs(j - i) <= e ? '1' : '0'; });
}
function setJourney(j, { fromScrub = false } = {}) {
  const v = clamp(j, 0, 2);
  if (v === ui.j && fromScrub) return;
  ui.j = v;
  if (v > 0) dropHint('view-hint');
  if (!fromScrub) journey.set(v / 2);
  syncJourney();
  if (surface.on && state) showSurface(state, { journey: true });
  scheduleHash();
}
const journey = createTimeline({ slider: $('j-range'), keyTarget: null, onChange: (t) => setJourney(2 * t, { fromScrub: true }) });
journey.setStops([{ t: 0, label: 'surface' }, { t: 0.5, label: 'two pillows' }, { t: 1, label: 'open crowns' }]);
journey.setDuration(2.4);                          // the whole run; one stop to the next takes half of it
function journeyTo(target) {
  if (reducedMotion()) { setJourney(target); return; }
  journey.play(clamp(target, 0, 2) / 2);
}
jLeft.addEventListener('click', () => journeyTo(ui.j > 1.004 ? 1 : 0));
jRight.addEventListener('click', () => journeyTo(ui.j >= 0.996 ? 2 : 1));

// ---- tabs ----------------------------------------------------------------------------------------------------------
function showTab(next) {
  tab = next === 'tutorial' ? 'tutorial' : 'play';
  for (const b of document.querySelectorAll('.tab2[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  $('play').hidden = tab !== 'play';
  $('tutorial').hidden = tab !== 'tutorial';
  if (tab === 'play') {
    // the canvases had no size while hidden
    glue.redraw();
    if (surface.on) { try { surface.pane.resize(); surface.pane.render(); } catch (err) { /* drawn on the next change */ } }
  }
}
for (const b of document.querySelectorAll('.tab2[data-tab]')) b.addEventListener('click', () => showTab(b.dataset.tab));

// ---- small things ----------------------------------------------------------------------------------------------------
// the two hints go at the first touch of their pane; the Surface's also once the reader works the cards or the
// journey (it lies over the foot of the pane, where a cone point may stand)
const hintGone = { 'pat-hint': false, 'view-hint': false };
function dropHint(id) { hintGone[id] = true; $(id).hidden = true; }
for (const [wrapId, hintId] of [['pat-wrap', 'pat-hint'], ['surf-wrap', 'view-hint']]) {
  const wrap = $(wrapId);
  wrap.addEventListener('pointerdown', () => dropHint(hintId), { once: true });
  wrap.addEventListener('keydown', () => dropHint(hintId), { once: true });
}
$('reset-view').addEventListener('click', () => {
  if (!surface.on) return;
  try { surface.pane.setView({ az: DEFAULT_UI.az, el: DEFAULT_UI.el, zoom: 1 }); surface.pane.render(); } catch (err) { /* the view stays */ }
  // An activation leaves the solid where it was (his ask, 27 Nov 22:30), so after a few the active loop may stand
  // tilted. The reset lays it level again (loop level, the active first pair below), turning the solid there over half
  // a second: the one place where the solid turns. The pane shows Q (x - Qs) and eases Q to none: Q = hold.R and
  // Qs = -hold.Rᵀ hold.t start it exactly where it was held.
  try {
    const h = surface.started && typeof surface.sm.relevel === 'function' ? surface.sm.relevel() : null;
    if (h) {
      drawSurfaceFrame(state, {});
      const R = h.R, t = h.t, Rt = [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
      const sh = [0, 1, 2].map((r) => -(Rt[3 * r] * t[0] + Rt[3 * r + 1] * t[1] + Rt[3 * r + 2] * t[2]));
      if (typeof surface.pane.turn === 'function') surface.pane.turn(Rt, reducedMotion() ? 0 : 0.5, { inverse: true, shift: sh });
    }
  } catch (err) { surfaceFailed(err); }
  ui.az = DEFAULT_UI.az; ui.el = DEFAULT_UI.el; surface.userView = false;
  scheduleHash();
});
if (typeof ResizeObserver === 'function') {
  new ResizeObserver(() => { if (surface.on && tab === 'play') { try { surface.pane.resize(); surface.pane.render(); } catch (err) { /* next change */ } } }).observe($('surf-wrap'));
}

// ---- links -----------------------------------------------------------------------------------------------------------
function openAddress(raw, { initial = false } = {}) {
  const text = String(raw || '');
  if (/^#?tutorial$/.test(text)) { if (!state) apply(stateFor('3333'), { cold: true }); showTab('tutorial'); return; }
  const got = fromHash(text) || fromHash('#');
  const u = got.ui || DEFAULT_UI;
  ui.j = Number.isFinite(u.j) ? u.j : 0;
  const viewed = Number.isFinite(u.az) && Number.isFinite(u.el) && (u.az !== DEFAULT_UI.az || u.el !== DEFAULT_UI.el);
  ui.az = Number.isFinite(u.az) ? u.az : DEFAULT_UI.az;
  ui.el = Number.isFinite(u.el) ? u.el : DEFAULT_UI.el;
  surface.userView = viewed;
  if (surface.on && (viewed || !initial)) { try { surface.pane.setView({ az: ui.az, el: ui.el }); } catch (err) { /* the view stays */ } }
  journey.set(ui.j / 2);
  syncJourney();
  sigIn.value = PRESETS.includes(got.state.k) ? '' : got.state.k;
  lastHash = null;
  apply(got.state, { cold: true });
  if (tab !== 'play') showTab('play');
}
window.addEventListener('hashchange', () => {
  if (window.location.hash === lastHash || (lastHash === '#' && window.location.hash === '')) return;
  openAddress(window.location.hash);
});

// ---- start -----------------------------------------------------------------------------------------------------------
{
  // the view an address asks for is known before the pane is made
  const first = fromHash(window.location.hash);
  if (first && first.ui && Number.isFinite(first.ui.az) && Number.isFinite(first.ui.el)) { ui.az = first.ui.az; ui.el = first.ui.el; }
}
mountSurface({ canvas: $('view'), labels: $('labels'), reset: $('reset-view'), hint: $('view-hint') });
openAddress(window.location.hash, { initial: true });

// ---- for checks (tools/check.mjs) and for the console ----------------------------------------------------------------
/** The Pattern pane as pixels (its WebGL canvas and its overlay drawn onto one canvas, in this task), 1 px a css px. */
function patternPixels() {
  glue.redraw();
  const over = $('pattern'), prev = over.previousElementSibling, glc = prev && prev.classList && prev.classList.contains('pat-gl') ? prev : null;
  const W = over.clientWidth, H = over.clientHeight, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  if (glc && glc.style.display !== 'none') ctx.drawImage(glc, glc.offsetLeft, glc.offsetTop, glc.clientWidth, glc.clientHeight);
  ctx.drawImage(over, 0, 0, W, H);
  return ctx.getImageData(0, 0, W, H);
}
/** The print's two tones: 'p' paper #9ad5cc, 'i' comma #4fa397, 'o' anything else (a line, a mark, the rim, the page). */
function toneOf(r, g, b) {
  const near = (c) => Math.abs(r - c[0]) + Math.abs(g - c[1]) + Math.abs(b - c[2]) < 24;
  return near([154, 213, 204]) ? 'p' : near([79, 163, 151]) ? 'i' : 'o';
}
/** The tone at every node of an n x n grid over the middle of the Pattern pane: a string of n * n letters. */
function patternGrid(n = 48, reach = 0.6) {
  const img = patternPixels(), W = img.width, H = img.height, half = Math.min(W, H) / 2;
  let s = '';
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    const x = Math.round(W / 2 + reach * half * ((2 * (b + 0.5)) / n - 1)), y = Math.round(H / 2 + reach * half * ((2 * (a + 0.5)) / n - 1)), i = 4 * (y * W + x);
    s += toneOf(img.data[i], img.data[i + 1], img.data[i + 2]);
  }
  return s;
}
window.__pqrs = {
  state: () => ({ ...state, key: keyOf(state), kind: kindOf(state), hash: hashNow(), ui: { ...ui }, tab }),
  cards: () => cardsOf(state).map((c) => ({ key: c.key, active: c.active, L: c.L, tw: c.tw, length: c.length, pairs: c.pairs })),
  shown: () => cards.read(),
  pillows: () => pillowsOf(state),
  open: (text) => openSignature(String(text)),
  activate: (key) => { const done = activateCard(key); flush(); return done; },
  set: (numbers = {}, { key = null, dragging = false } = {}) => { inputCard(key || keyOf(state), numbers, { dragging }); flush(); return window.__pqrs.state(); },
  journey: (j) => { setJourney(j); return ui.j; },
  tab: (t) => { showTab(t); return tab; },
  flush,
  perf: () => ({ last: perf.last && { ...perf.last }, drag: { ...perf.drag } }),
  perfReset,
  pattern: glue.pattern,
  patternGrid,
  patternPixels,
  surface: () => ({ on: surface.on, started: surface.started, error: surface.error, fails: surface.fails, stats: surface.stats, exact: surface.exact, version: surface.version, bakeMs: surface.bakeMs, print: !!surface.print, view: surface.on && surface.pane.getView ? surface.pane.getView() : null }),
  pane: () => surface.pane,
  model: () => surface.sm,
};
