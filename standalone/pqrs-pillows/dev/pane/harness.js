// harness.js — the pane owner's test page: print3d + surface-pane on REAL geometry (pillow.js meshes, the engine's
// frames), beside the Pattern pane of Two features, two handles for the same state. Not the product.
//   #k=3333&l=2.63&tw=0.2&mode=open|pressed|solved&size=1024&az=-20&el=14&zoom=1&print=1
import { FAMILIES, normalizeFamilyKey, buildPatternModel, defaultCommas, recut, retiePrint } from '../../../two-features-two-handles/src/handles.js';
import { createSurfaceModel } from '../../src/surface-model.js';
import { createPattern } from '../../../two-features-two-handles/src/pattern-ext.js';
import { createSurfacePane } from '../../src/surface-pane.js';
import { createPrint3d } from '../../src/print3d.js';
import { createSurface } from '../../src/solver.js';
import * as flat2222 from '../../src/flat2222.js';
import { standinFrame } from './standin-frame.js';

const $ = (id) => document.getElementById(id);
function stateFor(text) {
  const k = normalizeFamilyKey(text), fam = k && FAMILIES[k];
  if (!fam || (fam.mode !== 'cones' && fam.mode !== 'pillow')) return null;
  const perm = fam.defaultM.split('').map(Number);
  return { k, perm, orders: perm.map((c) => fam.baseOrders[c]), L: fam.defaultL, tw: fam.defaultTw, b: 0, tau: 0, thetas: defaultCommas(k).map((sp) => (sp ? sp.theta : 0)), print: null };
}
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };

const pattern = createPattern($('pattern'));
const p3 = createPrint3d();
const hq = new URLSearchParams(location.hash.replace(/^#/, ''));
// #chart=1: the pane asks print3d for the chart itself (its `chart` option); show() then hands over no uv
const ownChart = hq.get('chart') === '1';
const pane = createSurfacePane($('view'), { labelLayer: $('labels'), ...(hq.has('puff') ? { puff: +hq.get('puff') } : {}), ...(ownChart ? { chart: (corners) => p3.chartOf(corners) } : {}) });
let solver = null, sm = null;
const ordersByFeature = (st) => [0, 1, 2, 3].map((f) => st.orders[st.perm.indexOf(f)]);
let state = stateFor('3333'), opts = { mode: 'open', size: 1024, print: true }, frame = null, last = {};

function show(o = {}) {
  if (o.k) { const st = stateFor(o.k); if (st) state = st; }
  if (Number.isFinite(o.L)) state = { ...state, L: o.L };
  if (Number.isFinite(o.tw)) state = { ...state, tw: o.tw };
  if (o.mode) opts.mode = o.mode;
  if (o.size) opts.size = o.size;
  if (o.print !== undefined) opts.print = !!o.print;
  const t0 = performance.now();
  if (Number.isFinite(o.j)) opts.j = o.j;
  if (opts.mode === 'solved' && !solver) solver = createSurface();
  if (opts.mode === 'model') {                     // the REAL surface model (src/surface-model.js)
    if (!sm) sm = createSurfaceModel({ nVertices: 2600 });
    sm.set(state);
    frame = sm.frame(opts.j || 0);
    frame.info = { triangles: frame.triangles.length / 3, openVertices: frame.positions.length / 3, mode: 'model' };
  } else frame = standinFrame(state, { mode: opts.mode, solver, flat2222 });
  const t1 = performance.now();
  const print = opts.print ? p3.bake(state, { size: opts.size }) : null;
  const t2 = performance.now();
  const uv = print ? p3.chartOf(frame.corners) : null;
  const t3 = performance.now();
  pane.setPrint(print);
  const info = ownChart && print ? pane.showFrame(frame, { orders: ordersByFeature(state) }) : pane.showFrame(frame, { uv, orders: ordersByFeature(state) });
  const t4 = performance.now();
  if (o.az !== undefined || o.el !== undefined || o.zoom !== undefined) { const v = pane.getView(); pane.setView({ az: o.az ?? v.az, el: o.el ?? v.el, zoom: o.zoom ?? v.zoom }); pane.render(); }
  if (o.pattern !== false) pattern.set(buildPatternModel(state, { dark: false }));
  last = { k: state.k, orders: state.orders, perm: state.perm, L: state.L, tw: state.tw, ...frame.info, stats: frame.stats, frameMs: +(t1 - t0).toFixed(1), bakeMs: +(t2 - t1).toFixed(2), chartMs: +(t3 - t2).toFixed(2), showMs: +(t4 - t3).toFixed(2), print: print ? print.info : null, mesh: info, gl: pane.ok };
  $('log').textContent = JSON.stringify(last);
  return last;
}

/** Times, in this browser: the bake at 512 and 1024 over nearby twists, chartOf and showFrame on the frame shown. */
function bench() {
  const out = {};
  for (const size of [512, 1024]) {
    const ts = [];
    for (let i = 0; i < 9; i++) { const st = { ...state, tw: state.tw + 0.003 * (i + 1) }; const t0 = performance.now(); p3.bake(st, { size }); ts.push(performance.now() - t0); }
    out['bake' + size] = +med(ts).toFixed(2);
  }
  p3.bake(state, { size: opts.size });
  const tc = [], tsF = [], buf = new Float32Array(2 * frame.triangles.length);
  for (let i = 0; i < 15; i++) { const t0 = performance.now(); p3.chartOf(frame.corners, buf); tc.push(performance.now() - t0); }
  out.chartOf = +med(tc).toFixed(3); out.triangles = frame.triangles.length / 3;
  for (let i = 0; i < 9; i++) { const uv = p3.chartOf(frame.corners); uv[0] += 1e-6 * (i + 1); const t0 = performance.now(); pane.showFrame(frame, { uv, render: false }); tsF.push(performance.now() - t0); }
  out.showFrameNewChart = +med(tsF).toFixed(3);
  pane.showFrame(frame, { uv: p3.chartOf(frame.corners) });
  return out;
}
/** A turn as after a flip: the solid shown turned by `deg` about the axis, eased back. */
function turn(deg = 90, axis = 'x', seconds = 0.5) {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const M = axis === 'x' ? [1, 0, 0, 0, c, -s, 0, s, c] : axis === 'y' ? [c, 0, s, 0, 1, 0, -s, 0, c] : [c, -s, 0, s, c, 0, 0, 0, 1];
  return pane.turn(M, seconds);
}
/** A flip as the page makes it, on the real surface model: the engine's recut, the model's carry, the pane's turn. */
function flip(i, j, seconds = 0.5, useShift = true) {
  if (opts.mode !== 'model' || !sm) return { error: 'show({ mode: "model" }) first' };
  const ids = ['P', 'Q', 'R', 'S'], old = state, next = recut(old, i, j);
  const st = { k: next.k, perm: next.perm, orders: next.orders, L: next.L, tw: next.tw, b: 0, tau: 0, thetas: next.thetas };
  st.print = retiePrint(st, old);
  const before = ids.map((id) => pane.markAt(id));
  const r = sm.flip(st, { invQ: next.invQ, before: old });
  state = st;
  frame = sm.frame(opts.j || 0);
  const print = p3.bake(state, { size: opts.size });
  pane.setPrint(print);
  pane.showFrame(frame, { uv: print ? p3.chartOf(frame.corners) : null, orders: ordersByFeature(state), render: false });
  const unturned = ids.map((id) => pane.markAt(id));
  const started = pane.turn(r.turn, seconds, { inverse: true, shift: useShift ? r.shift : null });
  pane.render();
  const after0 = ids.map((id) => pane.markAt(id));
  const d = (a, b) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : NaN);
  pattern.set(buildPatternModel(state, { dark: false }));
  return { cold: !!r.cold, started, shift: r.shift, jumpAtStart: ids.map((id, k) => +d(before[k], after0[k]).toFixed(2)), moveOfTheFlip: ids.map((id, k) => +d(before[k], unturned[k]).toFixed(1)), perm: state.perm, L: state.L, tw: state.tw };
}
function fromHash() {
  const q = new URLSearchParams(location.hash.replace(/^#/, '')), num = (n) => (q.has(n) && Number.isFinite(+q.get(n)) ? +q.get(n) : undefined);
  return show({ k: q.get('k') || '3333', L: num('l'), tw: num('tw'), j: num('j') ?? 0, mode: q.get('mode') || 'open', size: num('size'), az: num('az'), el: num('el'), zoom: num('zoom'), print: q.get('print') !== '0' });
}
window.__h = { show, bench, turn, flip, pane, p3, state: () => state, frame: () => frame, last: () => last, labels: () => [...document.querySelectorAll('.r3d-label')].filter((e) => e.style.display !== 'none').map((e) => e.textContent) };
window.addEventListener('hashchange', fromHash);
for (const b of document.querySelectorAll('[data-go]')) b.addEventListener('click', () => { location.hash = b.dataset.go; });
fromHash();
window.__h.ready = true;
