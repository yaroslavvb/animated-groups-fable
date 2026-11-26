// page.js — interactive controller for "Two features, two handles" (Demo 2a).

import {
  GH, GE, FAMILIES, normalizeFamilyKey,
  pairMetricsFor, recut,
  followTreeData, interpolateView,
  stadium, handleBeltLoop, beadOnLoop, sitesForBall,
  surfacePartsFor, featureAnchorsForBall,
  defaultCommas, buildPatternModel,
  psuInv, psuMul, psuApplyDisc, psuToSO21, so21ToPSU, discDist,
} from './handles.js';
import { createPattern, locateTilePSU } from './pattern-ext.js';
import { mul, apply, det, I3 } from '../../2026-11-15-classification-of-surfaces/src/sym/geom.js';
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
const bRange = $('#b-range');
const tauRange = $('#tau-range');
const valLen = $('#val-len');
const valTw = $('#val-tw');
const valB = $('#val-b');
const valTau = $('#val-tau');
const bLabel = $('#b-label');
const tauLabel = $('#tau-label');
const extraSliders = $('#extra-sliders');
const bRow = $('#b-row');
const tauRow = $('#tau-row');
const keyFault = $('#key-fault');
const keyMirror = $('#key-mirror');
const keyGlide = $('#key-glide');
const outLen = $('#out-len');
const outTw = $('#out-tw');
const outGeo = $('#out-geo');
const momentBtns = [...document.querySelectorAll('[data-moment]')];
const momentNote = $('#moment-note');
const reset2Btn = $('#reset2');
const reset3Btn = $('#reset3');
const centerToggle = $('#center-toggle');
const backPlayBtn = $('#back-play');

const MOMENT_COPY = {
  length: 'At Length = 0.80, the two 3-cones sit 1.18 apart (above the ln 3 ≈ 1.10 floor) with tree-to-cut distance 1.64. Slide Length up to draw them further apart.',
  half: 'Sweep Twist from 0 toward ±0.5 turns: the two far 3-cones swap sites carrying their comma markings, and −0.5 lands back on +0.5 identically.',
  fault: 'On o33, o⁺ and o⁻ are the two sides of a handle geodesic γ_o. Drag Handle shift to shear the two sides against one another along the blue fault line, even as Length and Twist steer the cut.',
};

function followNoteFor(st) {
  const fam = FAMILIES[st.k];
  if (fam.mode === 'handle') {
    return 'Repeating the shortest arc and cuff tree of the picked o33 pair runs straight to both rim ends of the isolating cut, while perpendicular legs drop onto it.';
  }
  if (fam.mode !== 'cones' && fam.mode !== 'pillow') {
    return `Repeating copies of the shortest tree connecting ${fam.featLabels[st.perm[0]]} and ${fam.featLabels[st.perm[1]]} converges to both rim ends of the separating geodesic.`;
  }
  return 'Walking sharpest-left along the pair tree (T^∓k) runs straight to both rim ends of the isolating cut; four perpendicular legs drop from A, B, C, D onto it.';
}

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
    b: fam.defaultB ?? 0,
    tau: fam.defaultTau ?? 0,
    thetas: defaultThetas(fam.k),
  };
}

let tab = 'play';
let state = makeDefaultState('3333');
let older = state.perm[0];
let newer = state.perm[1];
let promoted = null;
let autoCenter = centerToggle ? centerToggle.checked : true;
let lenRangeBounds = FAMILIES['3333'].baseRange.slice();
let bRangeBounds = [0.4, 3.0];
let activeMoment = null;
let followState = null;
let glideState = null;
let moveTimer = 0;
let suppressSlider = false;

let built = null;
let loopCache = { key: '', loop: null };
let beltCache = { k: '', loop: null };
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
function bToU(b) {
  const lo = Math.log(bRangeBounds[0]), hi = Math.log(bRangeBounds[1]);
  return clamp((Math.log(Math.max(bRangeBounds[0], b)) - lo) / (hi - lo || 1), 0, 1);
}
function uToB(u) {
  const lo = Math.log(bRangeBounds[0]), hi = Math.log(bRangeBounds[1]);
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
        [0.4, '0.4'], [0.6, '0.6'], [1, '1'], [2, '2'], [3, '3'], [5, '5'], [7, '7'], [9, '9'],
      ];
  const stops = ticks
    .filter(([v]) => v >= lo - 1e-6 && v <= hi + 1e-6)
    .map(([v, label]) => ({ t: lToU(v), label }));
  lenScrub.setStops(stops);
}

function ensureBStops() {
  const fam = FAMILIES[state.k];
  if (!fam.bRange) return;
  bRangeBounds = fam.bRange.slice();
  const [lo, hi] = bRangeBounds;
  const ticks = [[0.3, '0.3'], [0.5, '0.5'], [0.8, '0.8'], [1.0, '1.0'], [1.4, '1.4'], [2.0, '2.0'], [3.0, '3.0']];
  bScrub.setStops(ticks.filter(([v]) => v >= lo - 1e-6 && v <= hi + 1e-6).map(([v, label]) => ({ t: bToU(v), label })));
}

function onParamInput(dragging) {
  if (followState && followState.active) followState.data = followTreeData(state);
  drawPattern({ keepView: true, moving: dragging });
  stage.decorate();
  stage.R.render();
  syncUI();
  scheduleHashWrite();
  scheduleSettle(dragging);
}

const lenScrub = createTimeline({
  slider: lenRange,
  keyTarget: null,
  onChange(u, meta) {
    if (suppressSlider) return;
    cancelGlide();
    const dragging = !!(meta && meta.dragging);
    state.L = uToL(u);
    onParamInput(dragging);
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
    onParamInput(dragging);
  },
});

const bScrub = createTimeline({
  slider: bRange,
  keyTarget: null,
  onChange(u, meta) {
    if (suppressSlider) return;
    cancelGlide();
    const dragging = !!(meta && meta.dragging);
    state.b = uToB(u);
    onParamInput(dragging);
  },
});

const tauScrub = createTimeline({
  slider: tauRange,
  keyTarget: null,
  onChange(u, meta) {
    if (suppressSlider) return;
    cancelGlide();
    const dragging = !!(meta && meta.dragging);
    state.tau = uToTw(u);
    onParamInput(dragging);
  },
});

const HALF_TURN_STOPS = [
  { t: 0, label: '-0.5' },
  { t: 0.25, label: '-0.25' },
  { t: 0.5, label: '0' },
  { t: 0.75, label: '+0.25' },
  { t: 1, label: '+0.5' },
];
twScrub.setStops(HALF_TURN_STOPS);
tauScrub.setStops(HALF_TURN_STOPS);

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
  const { loopSites } = sitesForBall(built, [state.perm[0], state.perm[1]], state.k);
  const sites = built.layout.sites;
  const loop = stadium(sites[loopSites[0]].site.n, sites[loopSites[1]].site.n, 1.014);
  loopCache = { key: pairKey, loop };
  return loop;
}

function getHandleBelt() {
  if (state.k !== 'o33' || !built) return null;
  if (beltCache.k === state.k && beltCache.loop) return beltCache.loop;
  const loop = handleBeltLoop(built);
  beltCache = { k: state.k, loop };
  return loop;
}

function buildSurfaceForFamily(k) {
  built = buildSurface(surfacePartsFor(k));
  loopCache = { key: '', loop: null };
  beltCache = { k: '', loop: null };
  stage.setScene(built.scene, built.frame, true);
}

stage.extraLines = () => {
  if (!built) return [];
  const loop = getBallLoop();
  const dark = isDark();
  const amber = dark ? [0.941, 0.659, 0.188] : [0.902, 0.624, 0];
  const blueRgb = dark ? [0.337, 0.706, 0.914] : [0, 0.447, 0.698];
  const lines = [{ points: loop.flat, color: amber, width: 3.4, alpha: 0.95, xray: 0.18, loop: true }];
  const belt = getHandleBelt();
  if (belt) lines.push({ points: belt.flat, color: blueRgb, width: 2.3, alpha: 0.9, xray: 0.18, loop: true });
  return lines;
};

stage.extraMarkers = () => {
  if (!built) return [];
  const dark = isDark();
  const blueRgb = dark ? [0.337, 0.706, 0.914] : [0, 0.447, 0.698];
  const blueCss = dark ? '#56b4e9' : '#0072b2';
  const darkRgb = dark ? [0.9, 0.92, 0.95] : [0.08, 0.09, 0.12];
  const amber = dark ? [0.941, 0.659, 0.188] : [0.902, 0.624, 0];
  const picked = new Set([state.perm[0], state.perm[1]]);
  const feats = featureAnchorsForBall(built, state.k);
  const markers = feats.map((ft, featIdx) => {
    const on = picked.has(featIdx);
    return {
      p: ft.p,
      color: on ? blueRgb : darkRgb,
      size: on ? 7 : 5,
      alpha: on ? 0.95 : 0.38,
      shape: 'dot',
      label: ft.label,
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
  const belt = getHandleBelt();
  if (belt) {
    markers.push({
      p: beadOnLoop(belt, state.tau + 0.5),
      color: blueRgb,
      size: 7.5,
      shape: 'dot',
      alpha: 0.95,
      xray: 0.25,
    });
  }
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
  return pairMetricsFor(state);
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
    const lbl = fam.featLabels[idx];
    b.textContent = lbl;
    b.setAttribute('aria-label', `Feature ${idx + 1}: ${lbl}`);
    b.setAttribute('aria-pressed', String(picked.has(idx)));
    b.toggleAttribute('data-pending', promoted === idx);
  });

  if (centerToggle) centerToggle.checked = autoCenter;
  const modeSuffix = autoCenter ? 'pair at centre' : 'view fixed';
  patSub.textContent = fam.kind === 'E' ? `Euclidean plane · ${modeSuffix}` : `Poincaré disc · ${modeSuffix}`;
  surfSub.textContent = promoted !== null ? `${fam.featLabels[promoted]} ready — tap its partner` : 'Tap two features';

  const hasB = !!fam.bRange;
  const hasTau = !!fam.tauLabel;
  extraSliders.hidden = !(hasB || hasTau);
  bRow.hidden = !hasB;
  tauRow.hidden = !hasTau;
  if (hasB) {
    bLabel.textContent = fam.bLabel;
    bRange.setAttribute('aria-label', fam.bLabel);
  }
  if (hasTau) {
    tauLabel.textContent = fam.tauLabel;
    tauRange.setAttribute('aria-label', fam.tauLabel);
  }
  keyFault.hidden = state.k !== 'o33';
  keyMirror.hidden = state.k !== '333*' && state.k !== '333*3';
  keyGlide.hidden = state.k !== '333x';

  suppressSlider = true;
  ensureLenBounds(state.L);
  lenScrub.set(lToU(state.L));
  twScrub.set(twToU(state.tw));
  if (hasB) {
    ensureBStops();
    bScrub.set(bToU(state.b));
  }
  if (hasTau) tauScrub.set(twToU(state.tau));
  suppressSlider = false;

  valLen.textContent = state.L.toFixed(2);
  valTw.textContent = fmtSigned(state.tw, 3);
  if (hasB) valB.textContent = state.b.toFixed(2);
  if (hasTau) valTau.textContent = fmtSigned(state.tau, 3);

  outLen.textContent = state.L.toFixed(2);
  outTw.textContent = fmtSigned(state.tw, 3);
  const { d, mDist } = pairMetrics();
  if (fam.mode === 'cones' || fam.mode === 'pillow') {
    outGeo.textContent = `pair ${d.toFixed(2)} apart · tree to cut ${mDist.toFixed(2)}`;
  } else if (fam.mode === 'handle') {
    outGeo.textContent = `arc ${d.toFixed(2)} · cut ${mDist.toFixed(2)} · shift ${fmtSigned(state.tau, 3)}`;
  } else {
    outGeo.textContent = `arc ${d.toFixed(2)} · tree to cut ${mDist.toFixed(2)}`;
  }

  for (const b of momentBtns) b.setAttribute('aria-pressed', String(b.dataset.moment === activeMoment));
  momentNote.textContent = activeMoment === 'follow'
    ? followNoteFor(state)
    : activeMoment ? MOMENT_COPY[activeMoment] : '';
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
  const fam = FAMILIES[state.k];
  let h = `#k=${state.k}&m=${state.perm.join('')}&l=${fmtHashNum(state.L, 3)}&tw=${fmtHashNum(state.tw, 4)}`;
  if (fam.bRange) h += `&b=${fmtHashNum(state.b, 3)}`;
  if (state.k === 'o33') h += `&to=${fmtHashNum(state.tau, 4)}`;
  else if (state.k === '333*3') h += `&tc=${fmtHashNum(state.tau, 4)}`;
  return h;
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
  if (G.kind === 'E') {
    const { D, A } = model;
    let Vc = Vstart.slice();
    const far = (M) => { const p = apply(M, D.at); return p[0] * p[0] + p[1] * p[1]; };
    for (let guard = 0; guard < 120; guard++) {
      let best = -1, bd = far(Vc) - 1e-9;
      for (let i = 0; i < D.n; i++) { const d = far(mul(Vc, A.maps[i])); if (d < bd) { bd = d; best = i; } }
      if (best < 0) break;
      Vc = mul(Vc, A.maps[best]);
    }
    return G.fix(Vc, 1);
  }
  if (G.kind !== 'H') return Vstart;
  const { D, A } = model;
  let vPsu = so21ToPSU(Vstart, det(Vstart) < 0);
  const focus = psuApplyDisc(psuInv(vPsu), [0, 0]);
  const { g } = locateTilePSU(D, A, focus);
  vPsu = psuMul(vPsu, g);
  if (vPsu[4]) {
    const maps2 = A.maps2 || A.maps.map((M, i) => so21ToPSU(M, !!(D.edges[i].mirror || D.edges[i].rev)));
    let bestPsu = null, bestD = Infinity;
    for (let i = 0; i < D.n; i++) {
      if (!(D.edges[i].mirror || D.edges[i].rev)) continue;
      const cand = psuMul(vPsu, maps2[i]);
      const d = discDist(psuApplyDisc(psuInv(cand), [0, 0]), [0, 0]);
      if (d < bestD) { bestD = d; bestPsu = cand; }
    }
    if (bestPsu) vPsu = bestPsu;
  }
  return psuToSO21(vPsu);
}

function pickPair(i, j, { glide = true } = {}) {
  if (i === j || i < 0 || i > 3 || j < 0 || j > 3) return stateSummary();
  cancelGlide();
  cancelFollow();
  activeMoment = null;

  const fam = FAMILIES[state.k];
  const before = pattern.getView();
  const next = recut(state, i, j);
  state = {
    k: next.k,
    perm: next.perm,
    orders: next.orders,
    L: next.L,
    tw: next.tw,
    b: next.b ?? state.b,
    tau: next.tau ?? state.tau,
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

  const G = fam.kind === 'E' ? GE : GH;
  let Vstart = null;
  if (before) {
    Vstart = fam.kind === 'H'
      ? psuToSO21(psuMul(so21ToPSU(before.V, det(before.V) < 0), so21ToPSU(next.invQ, false)))
      : G.fix(mul(before.V, next.invQ), 1);
    Vstart = recentreStartView(Vstart, currentModel);
  }

  if (!autoCenter) {
    if (Vstart) {
      pattern.setView({ V: Vstart, base: I3.slice(), turned: false }, { moving: false, sync: true });
    }
    return stateSummary();
  }

  const shouldGlide = glide && Vstart && !prefersReduced() && typeof requestAnimationFrame === 'function';
  if (shouldGlide) {
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
  const anchor = promoted !== null ? promoted : newer;
  return pickPair(anchor, coneIdx, { glide: true });
}

function setFamily(k, opts = {}) {
  const key = normalizeFamilyKey(k);
  if (!key) return;
  cancelGlide();
  cancelFollow();
  const fam = FAMILIES[key];
  const prevK = state.k;
  const perm = opts.perm || fam.defaultM.split('').map(Number);
  state = {
    k: fam.k,
    perm,
    orders: perm.map((c) => fam.baseOrders[c]),
    L: opts.L ?? fam.defaultL,
    tw: opts.tw ?? fam.defaultTw,
    b: opts.b ?? (fam.defaultB ?? 0),
    tau: opts.tau ?? (fam.defaultTau ?? 0),
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
  } else if (id === 'fault') {
    setFamily('o33', { perm: [0, 2, 1, 3], L: 2.2, tw: 0.15, b: 1.3, tau: 0.25, clearMoment: false });
    activeMoment = 'fault';
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
  const k = normalizeFamilyKey(params.get('k')) || '3333';
  const fam = FAMILIES[k];
  const mRaw = params.get('m') || fam.defaultM;
  const validM = /^[0-3]{4}$/.test(mRaw) && new Set(mRaw.split('')).size === 4;
  const perm = (validM ? mRaw : fam.defaultM).split('').map(Number);
  const lRaw = parseFloat(params.get('l'));
  const twRaw = parseFloat(params.get('tw'));
  const bRaw = parseFloat(params.get('b'));
  const tauRaw = parseFloat(params.get('to') ?? params.get('tc') ?? params.get('tau'));
  const L = Number.isFinite(lRaw)
    ? clamp(lRaw, fam.kind === 'E' ? 0.25 : 0.15, Math.max(fam.maxRange[1], fam.kind === 'E' ? 4 : 14))
    : fam.defaultL;
  const tw = Number.isFinite(twRaw) ? clamp(twRaw, -0.5, 0.5) : fam.defaultTw;
  const b = fam.bRange && Number.isFinite(bRaw) ? clamp(bRaw, fam.bRange[0], fam.bRange[1]) : (fam.defaultB ?? 0);
  const tau = fam.tauLabel && Number.isFinite(tauRaw) ? clamp(tauRaw, -0.5, 0.5) : (fam.defaultTau ?? 0);
  setFamily(k, { perm, L, tw, b, tau });
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
if (centerToggle) {
  centerToggle.addEventListener('change', () => {
    autoCenter = centerToggle.checked;
    syncUI();
  });
}

// 3D ball feature tap & hover
function coneScreenInfo() {
  if (!built) return [];
  const rect = viewCanvas.getBoundingClientRect();
  const { q } = stage.R.getView();
  const eye = eyeOf(q);
  const fam = FAMILIES[state.k];
  return featureAnchorsForBall(built, state.k).map((ft, i) => {
    const n = built.layout.sites[ft.site].site.n;
    const dotEye = n[0] * eye[0] + n[1] * eye[1] + n[2] * eye[2];
    const [x, y, vis] = stage.R.project(ft.p);
    return {
      cone: i,
      order: fam.baseOrders[i],
      label: ft.label,
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
    featLabels: FAMILIES[state.k].featLabels.slice(),
    pair: [state.perm[0], state.perm[1]],
    L: state.L,
    tw: state.tw,
    b: state.b,
    tau: state.tau,
    d,
    mDist,
    promoted,
    autoCenter,
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
    if (typeof opts.autoCenter === 'boolean') {
      autoCenter = opts.autoCenter;
      if (centerToggle) centerToggle.checked = autoCenter;
    }
    if (opts.tab) showTab(opts.tab, { writeHash: false });
    const nextK = (opts.k && normalizeFamilyKey(opts.k)) || state.k;
    const fam = FAMILIES[nextK];
    let perm = state.perm.slice();
    if (Array.isArray(opts.perm)) perm = opts.perm.slice();
    else if (typeof opts.m === 'string' && /^[0-3]{4}$/.test(opts.m)) perm = opts.m.split('').map(Number);
    else if (nextK !== state.k) perm = fam.defaultM.split('').map(Number);

    const rawL = opts.L ?? opts.l;
    const L = Number.isFinite(rawL) ? clamp(rawL, 0.15, 9.5) : (nextK !== state.k ? fam.defaultL : state.L);
    const tw = Number.isFinite(opts.tw) ? clamp(opts.tw, -0.5, 0.5) : (nextK !== state.k ? fam.defaultTw : state.tw);
    const rawB = opts.b;
    const b = fam.bRange && Number.isFinite(rawB) ? clamp(rawB, fam.bRange[0], fam.bRange[1]) : (nextK !== state.k ? (fam.defaultB ?? 0) : state.b);
    const rawTau = opts.tau ?? opts.to ?? opts.tc;
    const tau = fam.tauLabel && Number.isFinite(rawTau) ? clamp(rawTau, -0.5, 0.5) : (nextK !== state.k ? (fam.defaultTau ?? 0) : state.tau);
    setFamily(nextK, { perm, L, tw, b, tau });
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
