// page.js — interactive controller for "Two features, two handles" (Demo 2a).

import {
  GH, GE, FAMILIES,
  pairDistance, treeToCut,
  recutH, recut2222,
  followTreeData, interpolateView,
  stadium, beadOnLoop, sitesForBall,
  defaultCommas, buildPatternModel,
} from './handles.js';
import { createPattern } from './pattern-ext.js';
import { mul, apply, I3 } from '../../2026-11-15-classification-of-surfaces/src/sym/geom.js';
import { buildSurface } from '../../2026-11-15-classification-of-surfaces/src/sym/surface.js';
import { createStage } from '../../2026-11-15-classification-of-surfaces/src/stage.js';
import { eyeOf } from '../../2026-11-15-classification-of-surfaces/src/turning.js';
import { createTimeline } from '../../2026-11-15-classification-of-surfaces/src/vendor/the-folding/timeline.js';
import { shareHash } from '../../2026-11-15-classification-of-surfaces/src/sharehash.js';

const mqDark = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const mqReduce = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const isDark = () => !!(mqDark && mqDark.matches);
const prefersReduced = () => !!(mqReduce && mqReduce.matches);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ---- DOM elements
const $ = (s) => document.querySelector(s);
const tabBtns = [...document.querySelectorAll('.tab2')];
const playSec = $('#play');
const tutSec = $('#tutorial');
const famBtns = [...document.querySelectorAll('[data-fam]')];
const sigBtns = [...document.querySelectorAll('.sig-btn')];
const patSub = $('#pat-sub');
const surfSub = $('#surf-sub');
const patCanvas = $('#pattern');
const viewCanvas = $('#view');
const labelsEl = $('#labels');
const tipEl = $('#tip');
const lenRange = $('#len-range');
const twRange = $('#tw-range');
const valLen = $('#val-len');
const valTw = $('#val-tw');
const outLen = $('#out-len');
const outTw = $('#out-tw');
const outGeo = $('#out-geo');
const momentBtns = [...document.querySelectorAll('[data-moment]')];
const momentNote = $('#moment-note');
const reset2Btn = $('#reset2');
const reset3Btn = $('#reset3');
const backPlayBtn = $('#back-play');

const MOMENT_COPY = {
  follow: 'Walking sharpest-left along the pair tree (T^∓k) runs straight to both rim ends of the isolating cut; four perpendicular legs drop from A, B, C, D onto it.',
  length: 'At Length = 0.80, the two 3-cones sit 1.18 apart (above the ln 3 ≈ 1.10 floor) with tree-to-cut distance 1.64. Slide Length up to draw them further apart.',
  half: 'Sweep Twist from 0 toward ±0.5 turns: the two far 3-cones swap sites carrying their comma markings, and −0.5 lands back on +0.5 identically.',
};

// ---- State & view helpers
function defaultThetas(k) {
  return defaultCommas(k).map((sp) => (sp ? sp.theta : 0));
}

function makeDefaultState(k = '3333') {
  const fam = FAMILIES[k] || FAMILIES['3333'];
  const perm = fam.defaultM.split('').map(Number);
  return {
    k: fam.k,
    perm,
    orders: perm.map((c) => fam.baseOrders[c]),
    L: fam.defaultL,
    tw: fam.defaultTw,
    thetas: defaultThetas(fam.k),
  };
}

let tab = 'play';
let state = makeDefaultState('3333');
let older = state.perm[0];
let newer = state.perm[1];
let promoted = null;
let lenRangeBounds = FAMILIES['3333'].baseRange.slice();
let activeMoment = null;
let followState = null; // { active, progress, data, raf }
let glideState = null;  // { raf, promise, resolve }
let moveTimer = 0;
let suppressSlider = false;

let built = null;
let loopCache = { key: '', loop: null };
let stage = createStage(viewCanvas, labelsEl);
const pattern = createPattern(patCanvas, { tip: tipEl });

function lToU(L) {
  const lo = Math.log(lenRangeBounds[0]), hi = Math.log(lenRangeBounds[1]);
  return clamp((Math.log(L) - lo) / (hi - lo || 1), 0, 1);
}
function uToL(u) {
  const lo = Math.log(lenRangeBounds[0]), hi = Math.log(lenRangeBounds[1]);
  return Math.exp(lo + clamp(u, 0, 1) * (hi - lo));
}
const twToU = (tw) => clamp(tw + 0.5, 0, 1);
const uToTw = (u) => clamp(u - 0.5, -0.5, 0.5);

function ensureLenBounds(L, { reset = false } = {}) {
  const fam = FAMILIES[state.k];
  if (reset) lenRangeBounds = fam.baseRange.slice();
  if (L < lenRangeBounds[0]) {
    lenRangeBounds[0] = L >= fam.maxRange[0] ? fam.maxRange[0] : Math.max(0.15, L * 0.92);
  }
  if (L > lenRangeBounds[1]) {
    lenRangeBounds[1] = L <= fam.maxRange[1] ? fam.maxRange[1] : L * 1.08;
  }
  const [lo, hi] = lenRangeBounds;
  const ticks = fam.kind === 'E'
    ? [
        [0.5, '0.5'], [Math.SQRT1_2, '1/√2'], [1, '1'], [Math.SQRT2, '√2'], [2, '2'],
      ]
    : [
        [0.4, '0.4'], [0.6, '0.6'], [1, '1'], [2, '2'], [3, '3'], [5, '5'], [7, '7'],
      ];
  const stops = ticks
    .filter(([v]) => v >= lo - 1e-6 && v <= hi + 1e-6)
    .map(([v, label]) => ({ t: lToU(v), label }));
  lenScrub.setStops(stops);
}

const lenScrub = createTimeline({
  slider: lenRange,
  keyTarget: null,
  onChange(u, meta) {
    if (suppressSlider) return;
    cancelGlide();
    const dragging = !!(meta && meta.dragging);
    state.L = uToL(u);
    if (followState && followState.active) {
      followState.data = followTreeData(state);
    }
    drawPattern({ keepView: true, moving: dragging });
    stage.decorate();
    stage.R.render();
    syncUI();
    scheduleHashWrite();
    scheduleSettle(dragging);
  },
});

const twScrub = createTimeline({
  slider: twRange,
  keyTarget: null,
  onChange(u, meta) {
    if (suppressSlider) return;
    cancelGlide();
    const dragging = !!(meta && meta.dragging);
    state.tw = uToTw(u);
    if (followState && followState.active) {
      followState.data = followTreeData(state);
    }
    drawPattern({ keepView: true, moving: dragging });
    stage.decorate();
    stage.R.render();
    syncUI();
    scheduleHashWrite();
    scheduleSettle(dragging);
  },
});

twScrub.setStops([
  { t: 0, label: '-0.5' },
  { t: 0.25, label: '-0.25' },
  { t: 0.5, label: '0' },
  { t: 0.75, label: '+0.25' },
  { t: 1, label: '+0.5' },
]);

function scheduleSettle(dragging) {
  clearTimeout(moveTimer);
  if (dragging) {
    moveTimer = setTimeout(() => {
      drawPattern({ keepView: true, moving: false });
    }, 150);
  }
}

// ---- Geometry helpers & rendering
function getBallLoop() {
  const pairKey = `${state.k}:${state.perm[0]},${state.perm[1]}`;
  if (loopCache.key === pairKey && loopCache.loop) return loopCache.loop;
  const { loopSites } = sitesForBall(built, [state.perm[0], state.perm[1]]);
  const sites = built.layout.sites;
  const loop = stadium(sites[loopSites[0]].site.n, sites[loopSites[1]].site.n, 1.014);
  loopCache = { key: pairKey, loop };
  return loop;
}

function buildSurfaceForFamily(k) {
  const fam = FAMILIES[k];
  const parts = fam.baseOrders.map((n) => ({ t: 'cone', n }));
  built = buildSurface(parts);
  loopCache = { key: '', loop: null };
  stage.setScene(built.scene, built.frame, true);
}

stage.extraLines = () => {
  if (!built) return [];
  const loop = getBallLoop();
  const amber = isDark() ? [0.941, 0.659, 0.188] : [0.902, 0.624, 0];
  return [{ points: loop.flat, color: amber, width: 3.4, alpha: 0.95, xray: 0.18, loop: true }];
};

stage.extraMarkers = () => {
  if (!built) return [];
  const dark = isDark();
  const blueRgb = dark ? [0.337, 0.706, 0.914] : [0, 0.447, 0.698];
  const blueCss = dark ? '#56b4e9' : '#0072b2';
  const darkRgb = dark ? [0.9, 0.92, 0.95] : [0.08, 0.09, 0.12];
  const amber = dark ? [0.941, 0.659, 0.188] : [0.902, 0.624, 0];
  const picked = new Set([state.perm[0], state.perm[1]]);
  const orders = FAMILIES[state.k].baseOrders;
  const markers = built.anchors.map((anc, coneIdx) => {
    const on = picked.has(coneIdx);
    return {
      p: anc.at(),
      color: on ? blueRgb : darkRgb,
      size: on ? 7 : 5,
      alpha: on ? 0.95 : 0.34,
      shape: 'dot',
      label: String(orders[coneIdx]),
      labelColor: on ? blueCss : undefined,
      labelFaint: !on,
    };
  });
  const loop = getBallLoop();
  markers.push({
    p: beadOnLoop(loop, state.tw + 0.5),
    color: amber,
    size: 9,
    shape: 'dot',
    alpha: 1,
    xray: 0.25,
  });
  return markers;
};

let currentModel = null;
function drawPattern({ keepView = false, moving = false } = {}) {
  const model = buildPatternModel(state, {
    dark: isDark(),
    follow: followState && followState.active ? followState : null,
  });
  currentModel = model;
  pattern.set(model, { keepView, moving });
}

function renderAll({ keepView = false, moving = false } = {}) {
  drawPattern({ keepView, moving });
  stage.decorate();
  stage.R.render();
  syncUI();
}

// ---- Smooth animations: re-pick view glide (0.4s) & Follow walk
function cancelGlide() {
  if (!glideState) return;
  if (glideState.raf) cancelAnimationFrame(glideState.raf);
  const res = glideState.resolve;
  glideState = null;
  if (res) res();
}

function waitGlide() {
  return glideState ? glideState.promise : Promise.resolve();
}

function cancelFollow() {
  if (!followState) return;
  if (followState.raf) cancelAnimationFrame(followState.raf);
  followState = null;
}

function startFollowAnimation() {
  cancelFollow();
  const data = followTreeData(state);
  if (prefersReduced() || typeof requestAnimationFrame !== 'function') {
    followState = { active: true, progress: 1, data, raf: 0 };
    drawPattern({ keepView: true, moving: false });
    return;
  }
  followState = { active: true, progress: 0.01, data, raf: 0 };
  drawPattern({ keepView: true, moving: true });
  const t0 = performance.now();
  const DUR = 1800;
  const tick = (now) => {
    if (!followState || !followState.active) return;
    const u = clamp((now - t0) / DUR, 0, 1);
    followState.progress = u;
    followState.raf = 0;
    drawPattern({ keepView: true, moving: u < 1 });
    if (u < 1) followState.raf = requestAnimationFrame(tick);
  };
  followState.raf = requestAnimationFrame(tick);
}

// ---- Readout, buttons, hash
function pairMetrics() {
  if (state.k === '2222') {
    return { d: state.L, mDist: 1 / (2 * state.L) };
  }
  const d = pairDistance(state.orders[0], state.orders[1], state.L);
  const mDist = treeToCut(state.orders[0], state.orders[1], state.L).m;
  return { d, mDist };
}

function fmtSigned(v, dec) {
  const n = Math.abs(v) < 0.5 * Math.pow(10, -dec) ? 0 : v;
  const s = n.toFixed(dec);
  return n > 0 ? '+' + s : n < 0 ? s : '0.' + '0'.repeat(dec);
}

function syncUI() {
  const fam = FAMILIES[state.k];
  for (const b of famBtns) b.setAttribute('aria-pressed', String(b.dataset.fam === state.k));
  const picked = new Set([state.perm[0], state.perm[1]]);
  sigBtns.forEach((b, idx) => {
    b.textContent = String(fam.baseOrders[idx]);
    b.setAttribute('aria-pressed', String(picked.has(idx)));
    b.toggleAttribute('data-pending', promoted === idx);
  });

  patSub.textContent = fam.kind === 'E' ? 'Euclidean plane · pair at centre' : 'Poincaré disc · pair at centre';
  surfSub.textContent = promoted !== null ? `Cone ${fam.baseOrders[promoted]} ready — tap its partner` : 'Tap two cone tips';

  suppressSlider = true;
  ensureLenBounds(state.L);
  lenScrub.set(lToU(state.L));
  twScrub.set(twToU(state.tw));
  suppressSlider = false;

  valLen.textContent = state.L.toFixed(2);
  valTw.textContent = fmtSigned(state.tw, 3);
  outLen.textContent = state.L.toFixed(2);
  outTw.textContent = fmtSigned(state.tw, 3);
  const { d, mDist } = pairMetrics();
  outGeo.textContent = `pair ${d.toFixed(2)} apart · tree to cut ${mDist.toFixed(2)}`;

  for (const b of momentBtns) b.setAttribute('aria-pressed', String(b.dataset.moment === activeMoment));
  momentNote.textContent = activeMoment ? MOMENT_COPY[activeMoment] : '';
}

const fmtHashNum = (x, dec) => {
  const n = Number(x.toFixed(dec));
  return Object.is(n, -0) ? '0' : String(n);
};

function isDefaultState() {
  const fam = FAMILIES['3333'];
  return tab === 'play'
    && state.k === '3333'
    && state.perm.join('') === fam.defaultM
    && Math.abs(state.L - fam.defaultL) < 1e-4
    && Math.abs(state.tw - fam.defaultTw) < 1e-4;
}

function computeHash() {
  if (tab === 'tutorial') return '#tutorial';
  if (isDefaultState()) return '#';
  return `#k=${state.k}&m=${state.perm.join('')}&l=${fmtHashNum(state.L, 3)}&tw=${fmtHashNum(state.tw, 4)}`;
}

let hashTimer = 0;
function writeHashNow() {
  clearTimeout(hashTimer);
  const h = computeHash();
  if (window.location.hash !== h && !(h === '#' && window.location.hash === '')) {
    try { window.history.replaceState(null, '', h); } catch {}
  }
  shareHash(h);
}
function scheduleHashWrite() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(writeHashNow, 60);
}

// ---- Actions: pair re-pick, tap, family, moments, tabs
function recentreStartView(Vstart, model) {
  const G = FAMILIES[state.k].kind === 'E' ? GE : GH;
  if (G.kind !== 'H') return Vstart;
  let V = Vstart;
  const { D, A } = model;
  for (let s = 0; s < 16 && GH.dist(GH.origin, apply(V, GH.origin)) > 3.5; s++) {
    let best = -1, bd = GH.dist(GH.origin, apply(V, D.at));
    for (let i = 0; i < D.n; i++) {
      const cand = mul(V, A.maps[i]);
      const d = GH.dist(GH.origin, apply(cand, D.at));
      if (d < bd - 1e-9) { bd = d; best = i; }
    }
    if (best < 0) break;
    V = GH.fix(mul(V, A.maps[best]), 1);
  }
  return V;
}

function pickPair(i, j, { glide = true } = {}) {
  if (i === j || i < 0 || i > 3 || j < 0 || j > 3) return stateSummary();
  cancelGlide();
  cancelFollow();
  activeMoment = null;

  const fam = FAMILIES[state.k];
  const before = pattern.getView();
  const next = fam.kind === 'E' ? recut2222(state, i, j) : recutH(state, i, j);
  state = {
    k: next.k,
    perm: next.perm,
    orders: next.orders,
    L: next.L,
    tw: next.tw,
    thetas: next.thetas,
  };
  older = next.perm[0];
  newer = next.perm[1];
  promoted = null;

  ensureLenBounds(state.L);
  drawPattern({ keepView: false, moving: false });
  stage.decorate();
  stage.R.render();
  syncUI();
  writeHashNow();

  const shouldGlide = glide && before && !prefersReduced() && typeof requestAnimationFrame === 'function';
  if (shouldGlide) {
    const G = fam.kind === 'E' ? GE : GH;
    let Vstart = G.fix(mul(before.V, next.invQ), 1);
    Vstart = recentreStartView(Vstart, currentModel);
    pattern.setView({ V: Vstart, base: I3.slice(), turned: false }, { moving: true, sync: true });

    let resolveFn;
    const promise = new Promise((r) => { resolveFn = r; });
    const t0 = performance.now();
    const DUR = 400;
    const gObj = { raf: 0, promise, resolve: resolveFn };
    glideState = gObj;

    const tick = (now) => {
      if (glideState !== gObj) return;
      const u = clamp((now - t0) / DUR, 0, 1);
      const V = interpolateView(fam.kind, Vstart, I3, u);
      pattern.setView({ V, base: I3.slice(), turned: false }, { moving: u < 1, sync: true });
      if (u < 1) {
        gObj.raf = requestAnimationFrame(tick);
      } else {
        pattern.setView({ V: I3.slice(), base: I3.slice(), turned: false }, { moving: false, sync: true });
        glideState = null;
        resolveFn();
      }
    };
    gObj.raf = requestAnimationFrame(tick);
  }
  return stateSummary();
}

function handleConeSelect(coneIdx) {
  if (coneIdx < 0 || coneIdx > 3) return stateSummary();
  const a = state.perm[0], b = state.perm[1];
  if (coneIdx === a || coneIdx === b) {
    older = coneIdx === a ? b : a;
    newer = coneIdx;
    promoted = coneIdx;
    syncUI();
    return stateSummary();
  }
  // Replace older pick, keep newer
  const anchor = promoted !== null ? promoted : newer;
  return pickPair(anchor, coneIdx, { glide: true });
}

function setFamily(k, opts = {}) {
  if (!FAMILIES[k]) return;
  cancelGlide();
  cancelFollow();
  const fam = FAMILIES[k];
  const prevK = state.k;
  const perm = opts.perm || fam.defaultM.split('').map(Number);
  state = {
    k: fam.k,
    perm,
    orders: perm.map((c) => fam.baseOrders[c]),
    L: opts.L ?? fam.defaultL,
    tw: opts.tw ?? fam.defaultTw,
    thetas: opts.thetas || defaultThetas(fam.k),
  };
  older = perm[0];
  newer = perm[1];
  promoted = null;
  if (opts.clearMoment !== false) activeMoment = null;
  ensureLenBounds(state.L, { reset: true });
  if (!built || prevK !== fam.k) buildSurfaceForFamily(fam.k);
  renderAll({ keepView: false, moving: false });
  writeHashNow();
}

function showTab(nextTab, { writeHash = true } = {}) {
  tab = nextTab === 'tutorial' ? 'tutorial' : 'play';
  for (const b of tabBtns) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  playSec.hidden = tab !== 'play';
  tutSec.hidden = tab !== 'tutorial';
  if (tab === 'play') {
    stage.R.resize();
    stage.R.render();
    pattern.draw();
  }
  if (writeHash) writeHashNow();
}

function applyMoment(id) {
  if (activeMoment === id && id !== 'follow') {
    activeMoment = null;
    syncUI();
    return;
  }
  cancelGlide();
  cancelFollow();
  showTab('play', { writeHash: false });
  if (id === 'follow') {
    setFamily('3333', { perm: [0, 1, 2, 3], L: 2.0, tw: 0.175, clearMoment: false });
    activeMoment = 'follow';
    syncUI();
    startFollowAnimation();
  } else if (id === 'length') {
    setFamily('3333', { perm: [0, 1, 2, 3], L: 0.8, tw: 0, clearMoment: false });
    activeMoment = 'length';
    syncUI();
  } else if (id === 'half') {
    setFamily('3333', { perm: [0, 1, 2, 3], L: 2.0, tw: 0, clearMoment: false });
    activeMoment = 'half';
    syncUI();
  }
  writeHashNow();
}

function applyHash(raw, { initial = false } = {}) {
  const h = (raw || '').replace(/^#/, '');
  if (h === 'tutorial') {
    if (!built) buildSurfaceForFamily(state.k);
    renderAll({ keepView: false, moving: false });
    showTab('tutorial', { writeHash: false });
    if (initial) shareHash('#tutorial');
    return;
  }
  const params = new URLSearchParams(h);
  const k = FAMILIES[params.get('k')] ? params.get('k') : '3333';
  const fam = FAMILIES[k];
  const mRaw = params.get('m') || fam.defaultM;
  const validM = /^[0-3]{4}$/.test(mRaw) && new Set(mRaw.split('')).size === 4;
  const perm = (validM ? mRaw : fam.defaultM).split('').map(Number);
  const lRaw = parseFloat(params.get('l'));
  const twRaw = parseFloat(params.get('tw'));
  const L = Number.isFinite(lRaw) ? clamp(lRaw, fam.maxRange[0], fam.maxRange[1]) : fam.defaultL;
  const tw = Number.isFinite(twRaw) ? clamp(twRaw, -0.5, 0.5) : fam.defaultTw;
  setFamily(k, { perm, L, tw });
  showTab('play', { writeHash: !initial });
  if (initial) writeHashNow();
}

// ---- Events
for (const b of tabBtns) {
  b.addEventListener('click', () => showTab(b.dataset.tab));
}
if (backPlayBtn) backPlayBtn.addEventListener('click', () => showTab('play'));

for (const b of famBtns) {
  b.addEventListener('click', () => setFamily(b.dataset.fam));
}

sigBtns.forEach((b, idx) => {
  b.addEventListener('click', () => handleConeSelect(idx));
});

for (const b of momentBtns) {
  b.addEventListener('click', () => applyMoment(b.dataset.moment));
}

reset2Btn.addEventListener('click', () => {
  cancelGlide();
  pattern.resetView();
});
reset3Btn.addEventListener('click', () => {
  stage.R.resetView();
  stage.R.render();
});

// 3D ball cone-tip tap & hover
function coneScreenInfo() {
  if (!built) return [];
  const rect = viewCanvas.getBoundingClientRect();
  const { q } = stage.R.getView();
  const eye = eyeOf(q);
  const { siteOf } = sitesForBall(built, [state.perm[0], state.perm[1]]);
  const orders = FAMILIES[state.k].baseOrders;
  return built.anchors.map((anc, i) => {
    const n = built.layout.sites[siteOf[i]].site.n;
    const dotEye = n[0] * eye[0] + n[1] * eye[1] + n[2] * eye[2];
    const [x, y, vis] = stage.R.project(anc.at());
    return {
      cone: i,
      order: orders[i],
      x,
      y,
      clientX: rect.left + x,
      clientY: rect.top + y,
      vis: !!vis,
      dotEye,
      front: dotEye > 0.15,
    };
  });
}

function findConeHit(clientX, clientY) {
  const rect = viewCanvas.getBoundingClientRect();
  const lx = clientX - rect.left, ly = clientY - rect.top;
  let best = -1, bd = 34;
  for (const info of coneScreenInfo()) {
    if (!info.front) continue;
    const d = Math.hypot(lx - info.x, ly - info.y);
    if (d < bd) { bd = d; best = info.cone; }
  }
  return best;
}

const patHint = $('#pat-hint');
const viewHint = $('#view-hint');
if (patHint) patCanvas.addEventListener('pointerdown', () => { patHint.hidden = true; }, { once: true });
if (viewHint) viewCanvas.addEventListener('pointerdown', () => { viewHint.hidden = true; }, { once: true });

let tap3 = null;
viewCanvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  tap3 = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
});
viewCanvas.addEventListener('pointermove', (e) => {
  if (tap3 && tap3.id === e.pointerId) {
    if (Math.hypot(e.clientX - tap3.x, e.clientY - tap3.y) > 6) tap3.moved = true;
  } else if (e.pointerType === 'mouse') {
    viewCanvas.classList.toggle('cone-hover', findConeHit(e.clientX, e.clientY) >= 0);
  }
});
const endTap3 = (e) => {
  if (!tap3 || tap3.id !== e.pointerId) return;
  const was = tap3;
  tap3 = null;
  if (!was.moved && e.type === 'pointerup' && performance.now() - was.t <= 600) {
    const hit = findConeHit(was.x, was.y);
    if (hit >= 0) handleConeSelect(hit);
  }
};
viewCanvas.addEventListener('pointerup', endTap3);
viewCanvas.addEventListener('pointercancel', endTap3);
viewCanvas.addEventListener('pointerleave', () => viewCanvas.classList.remove('cone-hover'));

if (typeof ResizeObserver === 'function') {
  new ResizeObserver(() => {
    if (tab === 'play' && built) {
      stage.R.resize();
      stage.R.render();
    }
  }).observe(viewCanvas);
}

if (mqDark && typeof mqDark.addEventListener === 'function') {
  mqDark.addEventListener('change', () => renderAll({ keepView: true, moving: false }));
}
window.addEventListener('hashchange', () => applyHash(window.location.hash, { initial: false }));

// ---- Verification / inspection API
function stateSummary() {
  const { d, mDist } = pairMetrics();
  const patRect = patCanvas.getBoundingClientRect();
  const tileScreens = currentModel && currentModel.home
    ? currentModel.home.map((p, slot) => {
        const pt = pattern.projectTile(p);
        return pt ? { slot, cone: state.perm[slot], x: pt[0], y: pt[1], clientX: patRect.left + pt[0], clientY: patRect.top + pt[1] } : null;
      })
    : [];
  return {
    tab,
    k: state.k,
    perm: state.perm.slice(),
    m: state.perm.join(''),
    orders: state.orders.slice(),
    pair: [state.perm[0], state.perm[1]],
    L: state.L,
    tw: state.tw,
    d,
    mDist,
    promoted,
    moment: activeMoment,
    follow: !!(followState && followState.active),
    hash: computeHash(),
    locationHash: window.location.hash || '#',
    readout: `${valLen.textContent} | ${valTw.textContent} | ${outGeo.textContent}`,
    coneScreen: coneScreenInfo(),
    tileScreens,
    pattern: pattern.state(),
  };
}

window.__handles = {
  set(opts = {}) {
    cancelGlide();
    cancelFollow();
    if (opts.tab) showTab(opts.tab, { writeHash: false });
    const nextK = opts.k && FAMILIES[opts.k] ? opts.k : state.k;
    const fam = FAMILIES[nextK];
    let perm = state.perm.slice();
    if (Array.isArray(opts.perm)) perm = opts.perm.slice();
    else if (typeof opts.m === 'string' && /^[0-3]{4}$/.test(opts.m)) perm = opts.m.split('').map(Number);
    else if (nextK !== state.k) perm = fam.defaultM.split('').map(Number);

    const rawL = opts.L ?? opts.l;
    const L = Number.isFinite(rawL) ? clamp(rawL, 0.15, 9) : (nextK !== state.k ? fam.defaultL : state.L);
    const tw = Number.isFinite(opts.tw) ? clamp(opts.tw, -0.5, 0.5) : (nextK !== state.k ? fam.defaultTw : state.tw);
    setFamily(nextK, { perm, L, tw });
    if (opts.follow) applyMoment('follow');
    else writeHashNow();
    return stateSummary();
  },
  pick(i, j, opts) { return pickPair(i, j, opts); },
  tapCone(i) { return handleConeSelect(i); },
  show(v) {
    if (v === 'play' || v === 'tutorial') { showTab(v); return stateSummary(); }
    if (v && typeof v === 'object') { stage.R.setView(v); stage.R.render(); }
    return stateSummary();
  },
  moment(id) { applyMoment(id); return stateSummary(); },
  state: stateSummary,
  waitGlide,
  pattern,
  stage,
  get built() { return built; },
};

// ---- Boot
applyHash(window.location.hash, { initial: true });
