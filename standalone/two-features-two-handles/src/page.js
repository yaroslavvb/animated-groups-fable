// page.js — interactive controller for "Two features, two handles" (Demo 2a).

import {
  GH, GE, FAMILIES, normalizeFamilyKey,
  pairMetricsFor, recut,
  followTreeData, interpolateView,
  stadium, handleBeltLoop, beadOnLoop, sitesForBall,
  surfacePartsFor, featureAnchorsForBall,
  defaultCommas, buildPatternModel, atDefaults, paisleyView, paisleyInfo, retiePrint, linkedPrint, printScale,
  multiState, multiAtDefaults, multiPrint,
  psuInv, psuMul, psuApplyDisc, psuToSO21, so21ToPSU, discDist,
} from './handles.js';
import { createPattern, locateTilePSU } from './pattern-ext.js';
import { createCustomField } from './custom-ui.js';
import { SyncJitterMonitor, drawJitterGraph } from './perf-monitor.js';
import { mul, apply, det, I3 } from '../../classification-of-surfaces/src/sym/geom.js';
import { buildSurface } from '../../classification-of-surfaces/src/sym/surface.js';
import { createStage } from '../../classification-of-surfaces/src/stage.js';
import { eyeOf } from '../../classification-of-surfaces/src/turning.js';
import { createTimeline } from '../../classification-of-surfaces/src/vendor/the-folding/timeline.js';
import { shareHash } from '../../classification-of-surfaces/src/sharehash.js';

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
const pairAdd = $('#pair-add');
const sliderBox = document.querySelector('.controls .sliders');
const stillNote = $('#still-note');
const readoutEl = $('#readout');
const keyRow = document.querySelector('.key-row');
const momentsRow = document.querySelector('.moments');
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
const keyTree = $('#key-tree');
const keyFault = $('#key-fault');
const keyMirror = $('#key-mirror');
const keyGlide = $('#key-glide');
const outLen = $('#out-len');
const outTw = $('#out-tw');
const outGeo = $('#out-geo');
const momentBtns = [...document.querySelectorAll('[data-moment]')];
const momentNote = $('#moment-note');
const pane2El = $('#pane2');
const fs2Btn = $('#fs2');
const reset3Btn = $('#reset3');
const backPlayBtn = $('#back-play');
const debugPanel = $('#debug-panel');
const dbgStatusEl = $('#dbg-status');
const dbgMsgEl = $('#dbg-msg');
const dbgToggleBtn = $('#dbg-toggle');
const dbgResyncBtn = $('#dbg-resync');
const dbgMotionBtns = [...document.querySelectorAll('[data-dbg-motion]')];
const dbgSpeedBtns = [...document.querySelectorAll('[data-dbg-speed]')];
const dbgScaleBtns = [...document.querySelectorAll('[data-dbg-scale]')];
const dbgHzEl = $('#dbg-hz');
const dbgDriftEl = $('#dbg-drift');
const dbgFpsEl = $('#dbg-fps');
const dbgIdealEl = $('#dbg-ideal');
const dbgJitterEl = $('#dbg-jitter');
const dbgStuttersEl = $('#dbg-stutters');
const dbgLatEl = $('#dbg-lat');
const dbgGpuEl = $('#dbg-gpu');
const dbgGraph = $('#dbg-graph');
const dbgFsHud = $('#debug-fs-hud');
const dbgHudStatus = $('#dbg-hud-status');
const dbgHudText = $('#dbg-hud-text');
const dbgHudToggle = $('#dbg-hud-toggle');
const dbgHudScale = $('#dbg-hud-scale');

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

// Three kinds of orbifold are shown (custom.js): four features with one isolating cut (the page's own: `pairs`),
// five or six cone points with a cut a pair (multi.js: state.mode 'multi'), and every other signature, shown as
// the Classification of Surfaces page shows it with the pair controls off (state.mode 'still').
const isMulti = () => state.mode === 'multi';
const isStill = () => state.mode === 'still';
const isPairs = () => !state.mode;

let tab = 'play';
let state = makeDefaultState('3333');
let older = state.perm[0];
let newer = state.perm[1];
let promoted = null;
let autoCenter = false;
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
let patWheelArmed = false;
const canPatternWheel = () => tab !== 'debug' || !debugRunning || isPatternFs() || patWheelArmed;
const pattern = createPattern(patCanvas, { tip: tipEl, canWheel: canPatternWheel });

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
  if (isStill()) return;
  if (isMulti()) { state.Ls[state.active] = state.L; state.tws[state.active] = state.tw; }          // the sliders move the picked pair's numbers
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
  if (dragging && !(tab === 'debug' && debugRunning)) {
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
  if (FAMILIES[state.k].mode !== 'handle' || !built) return null;
  if (beltCache.k === state.k && beltCache.loop) return beltCache.loop;
  const loop = handleBeltLoop(built);
  beltCache = { k: state.k, loop };
  return loop;
}

function buildSurfaceForFamily(k) {
  loopCache = { key: '', loop: null };
  beltCache = { k: '', loop: null };
  try { built = buildSurface(surfacePartsFor(k)); } catch (err) { built = null; return; }          // more pieces than the ball has places: the surface pane keeps what it had
  stage.setScene(built.scene, built.frame, true);
}

/** The loop round another pair of a family of five or six cone points (not the picked one). */
function ballLoopOf(pairIdx) {
  const { loopSites } = sitesForBall(built, [2 * pairIdx, 2 * pairIdx + 1], state.k);
  const sites = built.layout.sites;
  return stadium(sites[loopSites[0]].site.n, sites[loopSites[1]].site.n, 1.014);
}

stage.extraLines = () => {
  if (!built || isStill() || !built.layout) return [];
  const loop = getBallLoop();
  const dark = isDark();
  const amber = dark ? [0.941, 0.659, 0.188] : [0.902, 0.624, 0];
  const blueRgb = dark ? [0.337, 0.706, 0.914] : [0, 0.447, 0.698];
  const lines = [{ points: loop.flat, color: amber, width: 3.4, alpha: 0.95, xray: 0.18, loop: true }];
  if (isMulti()) for (let i = 0; i < state.shown; i++) if (i !== state.active) lines.push({ points: ballLoopOf(i).flat, color: amber, width: 2.0, alpha: 0.6, xray: 0.12, loop: true });
  const belt = getHandleBelt();
  if (belt) lines.push({ points: belt.flat, color: blueRgb, width: 2.3, alpha: 0.9, xray: 0.18, loop: true });
  return lines;
};

stage.extraMarkers = () => {
  if (!built) return [];
  const dark = isDark();
  const blueRgb = dark ? [0.337, 0.706, 0.914] : [0, 0.447, 0.698];
  const blueCss = dark ? '#56b4e9' : '#0072b2';
  const amber = dark ? [0.941, 0.659, 0.188] : [0.902, 0.624, 0];
  const picked = isStill() ? new Set() : new Set([state.perm[0], state.perm[1]]);
  // an orbifold shown still may be drawn as a plate or a band (surface.js): no ball, no sites, only its anchors
  const feats = built.layout && !isStill() ? featureAnchorsForBall(built, state.k)
    : built.anchors.flatMap((a, idx) => {
        const lbl = FAMILIES[state.k].featLabels[idx] || '', star = lbl[0] === '∗';
        return [{ p: a.at(), label: star ? '∗' : lbl }, ...(star ? a.corners.map((c, q) => ({ p: c(), label: lbl[1 + q] || '', red: true })) : [])];
      });
  // every feature in the signature's own colour, as the Classification of Surfaces page writes it: blue for what
  // keeps the pattern's sense (cone points, a handle), red for what reflects (a mirror, a crosscap). The picked pair
  // is told by the loop round it and by its larger dots, not by greying the others
  const redRgb = dark ? [0.941, 0.541, 0.294] : [0.761, 0.314, 0.039];
  const redCss = dark ? '#f08a4b' : '#c2500a';
  const markers = feats.map((ft, featIdx) => {
    const on = picked.has(featIdx), red = !!ft.red || /^[∗×]/.test(ft.label);          // (a mirror's corners are red too)
    return {
      p: ft.p,
      color: red ? redRgb : blueRgb,
      size: on ? 9 : 6.5,
      alpha: 1,
      shape: 'dot',
      label: ft.label,
      labelColor: red ? redCss : blueCss,
      labelFaint: false,
    };
  });
  if (isStill() || !built.layout) return markers;
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
/**
 * still (five or six cone points, with keepView): nothing is to move on the pattern (another pair was picked). Else
 * the picked pair is what stays where it is: its model is in the frame of its tile and says by `pose` where the
 * pair lies, so the view goes with the change of pose.
 */
function drawPattern({ keepView = false, moving = false, still = false } = {}) {
  const model = buildPatternModel(state, {
    dark: isDark(),
    follow: followState && followState.active ? followState : null,
  });
  const last = currentModel;
  currentModel = model;
  let carry = null;
  if (keepView && !still && model.pose && last && last.pose) carry = psuMul(psuInv(so21ToPSU(last.pose, false)), so21ToPSU(model.pose, false));
  pattern.set(model, { keepView, moving, carry, sel: custom.cursor() });
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
  const fam = FAMILIES[state.k], still = isStill(), many = isMulti();
  for (const b of famBtns) b.setAttribute('aria-pressed', String((b.dataset.k || b.dataset.fam) === state.k));
  custom.sync();          // the text field after the chips: lit while the orbifold shown is the one typed there
  const picked = still ? new Set() : new Set([state.perm[0], state.perm[1]]);
  sigBtns.forEach((b, idx) => {
    const lbl = fam.featLabels[idx];
    b.hidden = lbl === undefined;
    if (lbl === undefined) return;
    b.textContent = lbl;
    b.setAttribute('aria-label', `Feature ${idx + 1}: ${lbl}`);
    b.setAttribute('aria-pressed', String(picked.has(idx)));
    b.toggleAttribute('data-pending', promoted === idx);
    b.disabled = still;
    // five or six cone points: taken two by two as named, a gap after each pair; a pair not yet picked is pale
    b.dataset.gap = many && idx % 2 === 1 && idx < fam.featLabels.length - 1 ? '1' : '0';
    b.dataset.off = many && (idx >> 1) >= state.shown ? '1' : '0';
  });
  pairAdd.hidden = !(many && state.shown < fam.pairs.length);
  pairAdd.parentElement.dataset.many = fam.featLabels.length > 4 ? '1' : '0';          // more than four symbols: closer together on a phone (page.css)

  patSub.textContent = fam.kind === 'E' ? 'Euclidean plane' : fam.kind === 'S' ? 'Sphere' : 'Poincaré disc';
  surfSub.textContent = still ? (fam.rigid ? 'Rigid: nothing to move' : 'Shown as classified')
    : many ? `Pair ${state.active + 1} of ${fam.pairs.length}: tap a feature for its pair`
      : promoted !== null ? `${fam.featLabels[promoted]} ready — tap its partner` : 'Tap two features';
  // the pair controls: off for an orbifold shown still
  sliderBox.toggleAttribute('inert', still);
  readoutEl.hidden = still;
  keyRow.hidden = still;
  momentsRow.hidden = !isPairs();
  momentNote.hidden = !isPairs();
  stillNote.hidden = !still;
  if (still) {
    stillNote.textContent = fam.rigid
      ? `${fam.label} is rigid: its shape has no Length or Twist to move, so the pair controls are off.`
      : `${fam.label} has ${fam.moves} number${fam.moves === 1 ? '' : 's'} of shape, none of them built here yet (this page moves pairs of features: four features, or five or six cone points), so the pair controls are off.`;
  }

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
  keyTree.hidden = many && fam.pairs.every(([a, b], i) => (i !== state.active && i >= state.shown) || (state.orders[a] === 2 && state.orders[b] === 2));
  keyFault.hidden = fam.mode !== 'handle';
  keyMirror.hidden = fam.mode !== 'cone-star' && fam.mode !== 'cone-star3';
  keyGlide.hidden = fam.mode !== 'cone-x';

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
  const cutDistText = mDist < 1e-4 ? 'tree on cut' : `tree to cut ${mDist.toFixed(2)}`;
  if (many) {
    outGeo.textContent = `pair ${state.active + 1} (${fam.featLabels[state.perm[0]]}·${fam.featLabels[state.perm[1]]}) ${d.toFixed(2)} apart · ${cutDistText}`;
  } else if (still) {
    outGeo.textContent = '';
  } else if (fam.mode === 'cones' || fam.mode === 'pillow') {
    outGeo.textContent = `pair ${d.toFixed(2)} apart · ${cutDistText}`;
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
  return state.k === '3333'
    && state.perm.join('') === fam.defaultM
    && Math.abs(state.L - fam.defaultL) < 1e-4
    && Math.abs(state.tw - fam.defaultTw) < 1e-4;
}

function computeHash() {
  if (tab === 'tutorial') return '#tutorial';
  if (isDefaultState()) return tab === 'debug' ? '#debug' : '#';
  const fam = FAMILIES[state.k];
  const suffix = tab === 'debug' ? '&debug=1' : '';
  if (isStill()) return `#k=${state.k}${suffix}`;
  if (isMulti()) return `#k=${state.k}&p=${state.active + 1}&n=${state.shown}&l=${state.Ls.map((x) => fmtHashNum(x, 3)).join(',')}&tw=${state.tws.map((x) => fmtHashNum(x, 4)).join(',')}${suffix}`;
  let h = `#k=${state.k}&m=${state.perm.join('')}&l=${fmtHashNum(state.L, 3)}&tw=${fmtHashNum(state.tw, 4)}`;
  if (fam.bRange) h += `&b=${fmtHashNum(state.b, 3)}`;
  if (fam.mode === 'handle') h += `&to=${fmtHashNum(state.tau, 4)}`;
  else if (fam.mode === 'cone-star3') h += `&tc=${fmtHashNum(state.tau, 4)}`;
  return h + suffix;
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

/**
 * Five or six cone points: pick pair i to move (the sliders, the heavy tree and cut, the loop on the surface go to
 * it). Nothing moves on the pattern: its tile, and so its frame, is the same whichever pair is picked.
 */
function activatePair(i) {
  const fam = FAMILIES[state.k];
  if (!isMulti() || i < 0 || i >= fam.pairs.length) return stateSummary();
  cancelGlide();
  cancelFollow();
  const had = !!currentModel;
  state.active = i;
  state.shown = Math.max(state.shown, i + 1);
  state.perm = [2 * i, 2 * i + 1];
  state.L = state.Ls[i];
  state.tw = state.tws[i];
  loopCache = { key: '', loop: null };
  ensureLenBounds(state.L, { reset: true });
  drawPattern({ keepView: had, moving: false, still: true });          // the tile is the same one, whichever pair is picked
  stage.decorate();
  stage.R.render();
  syncUI();
  writeHashNow();
  return stateSummary();
}
/** The plus after the features: the next pair not yet picked. */
function addPair() {
  return isMulti() ? activatePair(Math.min(state.shown, FAMILIES[state.k].pairs.length - 1)) : stateSummary();
}

function pickPair(i, j, { glide = true } = {}) {
  if (!isPairs()) return stateSummary();
  if (i === j || i < 0 || i > 3 || j < 0 || j > 3) return stateSummary();
  cancelGlide();
  cancelFollow();
  activeMoment = null;

  const fam = FAMILIES[state.k];
  const before = pattern.getView();
  const next = recut(state, i, j), stateBefore = state;
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
  // the commas stay where they are, and are tied to the blocks of the new pair's cut: a Twist then slides them whole
  try { state.print = retiePrint(state, stateBefore); } catch (err) { state.print = stateBefore.print || null; }
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
  if (isStill()) return stateSummary();
  if (isMulti()) return coneIdx >= 0 && (coneIdx >> 1) < FAMILIES[state.k].pairs.length ? activatePair(coneIdx >> 1) : stateSummary();          // a tap on a feature picks its pair (the cone point left over has none)
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
  if (fam.mode === 'multi' || fam.mode === 'still') {
    state = fam.mode === 'multi' ? multiState(fam.k, opts.multi || {}) : { k: fam.k, mode: 'still', perm: [], orders: [], L: 1, tw: 0, b: 0, tau: 0, thetas: [] };
    older = newer = 0;
    promoted = null;
    activeMoment = null;
    if (fam.mode === 'multi') ensureLenBounds(state.L, { reset: true });
    if (!built || prevK !== fam.k) buildSurfaceForFamily(fam.k);
    renderAll({ keepView: false, moving: false });
    writeHashNow();
    return;
  }
  const perm = opts.perm || fam.defaultM.split('').map(Number);
  const linked = opts.thetas ? null : linkedPrint(fam.k, perm);          // another pair than the family's own: the print a pick of it leaves
  state = {
    k: fam.k,
    perm,
    orders: perm.map((c) => fam.baseOrders[c]),
    L: opts.L ?? fam.defaultL,
    tw: opts.tw ?? fam.defaultTw,
    b: opts.b ?? (fam.defaultB ?? 0),
    tau: opts.tau ?? (fam.defaultTau ?? 0),
    thetas: opts.thetas || (linked ? linked.thetas : defaultThetas(fam.k)),
    print: linked ? linked.print : null,
  };
  older = perm[0];
  newer = perm[1];
  promoted = null;
  if (opts.clearMoment !== false) activeMoment = null;
  ensureLenBounds(state.L, { reset: true });
  if (!built || prevK !== fam.k) buildSurfaceForFamily(fam.k);
  renderAll({ keepView: false, moving: false });          // at the family's default numbers the model opens as classified (handles.js atDefaults)
  writeHashNow();
}

/** Put a typed signature's family on the page, at its default numbers: where it has them, the shape the Classification of Surfaces page draws. */
function showCustom(key) {
  setFamily(key);
}
const custom = createCustomField({
  resolve: normalizeFamilyKey,
  show: showCustom,
  shown: () => state.k,
  isCustom: (k) => !!FAMILIES[k].custom && !famBtns.some((b) => (b.dataset.k || b.dataset.fam) === k),
  labelOf: (k) => FAMILIES[k].label,
  onCursor: (idx) => pattern.select(idx),
});

const DEBUG_SPEEDS = { slow: 0.35, med: 0.85, fast: 1.75 };
const debugMonitor = new SyncJitterMonitor();
let debugRaf = 0;
let debugRunning = true;
let debugMode = 'pan';
let debugSpeed = 'med';
let debugUseScale = true;
let debugPrevTs = 0;
let lastDbgUiTs = 0;
let lastDbgStatusCode = '';
let lastTwistSyncTs = 0;

function syncDebugControls() {
  if (dbgToggleBtn) {
    dbgToggleBtn.setAttribute('aria-pressed', String(debugRunning));
    dbgToggleBtn.textContent = debugRunning ? 'Pause' : 'Resume';
  }
  if (dbgHudToggle) {
    dbgHudToggle.setAttribute('aria-pressed', String(debugRunning));
    dbgHudToggle.textContent = debugRunning ? 'Pause' : 'Resume';
  }
  for (const b of dbgMotionBtns) b.setAttribute('aria-pressed', String(b.dataset.dbgMotion === debugMode));
  for (const b of dbgSpeedBtns) b.setAttribute('aria-pressed', String(b.dataset.dbgSpeed === debugSpeed));
  for (const b of dbgScaleBtns) b.setAttribute('aria-pressed', String((b.dataset.dbgScale === 'auto') === debugUseScale));
  if (dbgHudScale) {
    dbgHudScale.setAttribute('aria-pressed', String(debugUseScale));
    dbgHudScale.textContent = debugUseScale ? 'Auto' : '1×';
  }
  if (dbgFsHud) dbgFsHud.hidden = tab !== 'debug' || !isPatternFs();
}

function renderDebugDOM(snap) {
  if (!snap || !dbgStatusEl) return;
  const st = snap.status;
  dbgStatusEl.dataset.cat = st.category;
  dbgStatusEl.textContent = st.label;
  if (dbgMsgEl) dbgMsgEl.textContent = snap.message;

  if (dbgHzEl) dbgHzEl.textContent = snap.hzDisplay;
  if (dbgDriftEl) {
    dbgDriftEl.textContent = snap.drift
      ? `drift ${snap.drift.min.toFixed(1)}..+${snap.drift.max.toFixed(1)} ms · ${snap.samples}s`
      : `est ~${snap.unverifiedHz ? snap.unverifiedHz.toFixed(1) : '—'} Hz · ${snap.samples}s`;
  }
  if (dbgFpsEl) dbgFpsEl.textContent = `${snap.fps > 0 ? snap.fps : '—'} FPS · ${snap.dtMs > 0 ? snap.dtMs.toFixed(2) : '—'} ms`;
  if (dbgIdealEl) dbgIdealEl.textContent = `target ${snap.idealMs.toFixed(2)} ms · lock ${snap.goodSeconds}s`;
  if (dbgJitterEl) dbgJitterEl.textContent = `±${Math.abs(snap.jitterMs).toFixed(2)} ms · p95 ${snap.jitterP95Ms.toFixed(1)}`;
  if (dbgStuttersEl) dbgStuttersEl.textContent = `${snap.stutters} stutters · ${snap.droppedFrames} drops`;
  if (dbgLatEl) {
    dbgLatEl.textContent = snap.inputLatencyP95Ms !== null
      ? `in ${snap.inputLatencyMs.toFixed(1)} · JS ${snap.renderP50Ms.toFixed(2)} ms`
      : `rAF ${snap.rafLatencyP50Ms.toFixed(1)} · JS ${snap.renderP50Ms.toFixed(2)} ms`;
  }
  if (dbgGpuEl) {
    const scPct = `${Math.round(snap.glScale * 100)}%`;
    dbgGpuEl.textContent = snap.gpuP50Ms !== null
      ? `GPU ${snap.gpuP50Ms.toFixed(2)}/${snap.gpuP95Ms.toFixed(2)} ms · ${scPct}`
      : `GPU ${pattern.gpuTimerSupported() ? 'warming' : 'n/a'} · ${scPct}`;
  }
  if (dbgFsHud && !dbgFsHud.hidden) {
    if (dbgHudStatus) {
      dbgHudStatus.dataset.cat = st.category;
      dbgHudStatus.textContent = st.label;
    }
    if (dbgHudText) {
      const hzTxt = snap.hz > 0 ? `${snap.hz.toFixed(2)} Hz` : '… Hz';
      const gpuTxt = snap.gpuP50Ms !== null ? ` · GPU ${snap.gpuP50Ms.toFixed(1)}ms` : '';
      dbgHudText.textContent = `${hzTxt} · ${snap.fps || '—'} FPS · ±${Math.abs(snap.jitterMs).toFixed(1)}ms · ${snap.stutters} stut${gpuTxt} · ${Math.round(snap.glScale * 100)}%`;
    }
  }
}

function debugTick(rafTs) {
  debugRaf = 0;
  if (tab !== 'debug') return;
  const nowStart = performance.now();
  debugMonitor.beginFrame(nowStart, rafTs);
  if (debugRunning && !pattern.isUserInteracting() && !glideState && !(followState && followState.active)) {
    const dt = debugPrevTs > 0 ? clamp(nowStart - debugPrevTs, 1, 50) : 16.6667;
    debugPrevTs = nowStart;
    if (debugMode === 'twist' && !isStill()) {
      const twRate = 0.16 * (DEBUG_SPEEDS[debugSpeed] / DEBUG_SPEEDS.med);
      let nextTw = state.tw + twRate * (dt / 1000);
      if (nextTw >= 0.5) nextTw -= 1.0;
      state.tw = nextTw;
      if (isMulti()) state.tws[state.active] = state.tw;
      drawPattern({ keepView: true, moving: debugUseScale });
      stage.decorate();
      stage.R.render();
      if (nowStart - lastTwistSyncTs >= 120) {
        lastTwistSyncTs = nowStart;
        suppressSlider = true;
        twScrub.set(twToU(state.tw));
        suppressSlider = false;
        valTw.textContent = fmtSigned(state.tw, 3);
        outTw.textContent = fmtSigned(state.tw, 3);
      }
    } else {
      pattern.stepAuto(dt, { speed: DEBUG_SPEEDS[debugSpeed], angle: 0, useScale: debugUseScale });
    }
  } else {
    debugPrevTs = 0;
  }
  const gpuSamples = pattern.consumeGpuSamples();
  debugMonitor.endFrame(performance.now(), { gpuSamples, glScale: pattern.state().glScale });
  drawJitterGraph(dbgGraph, debugMonitor, isDark());
  const snap = debugMonitor.snapshot();
  if (snap.status.code !== lastDbgStatusCode || nowStart - lastDbgUiTs >= 180) {
    lastDbgStatusCode = snap.status.code;
    lastDbgUiTs = nowStart;
    renderDebugDOM(snap);
  }
  debugRaf = requestAnimationFrame(debugTick);
}

function startDebugLoop() {
  if (debugRaf) return;
  debugPrevTs = 0;
  lastDbgUiTs = 0;
  lastDbgStatusCode = '';
  debugRaf = requestAnimationFrame(debugTick);
}

function stopDebugLoop() {
  if (debugRaf) {
    cancelAnimationFrame(debugRaf);
    debugRaf = 0;
  }
  debugPrevTs = 0;
}

function showTab(nextTab, { writeHash = true } = {}) {
  const prevTab = tab;
  tab = nextTab === 'tutorial' ? 'tutorial' : nextTab === 'debug' ? 'debug' : 'play';
  for (const b of tabBtns) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  playSec.hidden = tab === 'tutorial';
  tutSec.hidden = tab !== 'tutorial';
  if (debugPanel) debugPanel.hidden = tab !== 'debug';
  if (tab === 'debug') {
    if (prevTab !== 'debug') {
      debugRunning = true;
      patWheelArmed = false;
      debugMonitor.reset('Measuring refresh rate...', true);
    }
    pattern.setGpuTiming(true);
    syncDebugControls();
    renderDebugDOM(debugMonitor.snapshot());
    stage.R.resize();
    stage.R.render();
    pattern.draw();
    startDebugLoop();
  } else {
    stopDebugLoop();
    pattern.setGpuTiming(false);
    if (prevTab === 'debug') pattern.setInteractiveScale(false);
    syncDebugControls();
    if (tab === 'play') {
      stage.R.resize();
      stage.R.render();
      pattern.draw();
    }
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
  showTab(tab === 'debug' ? 'debug' : 'play', { writeHash: false });
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
  const targetTab = h === 'debug' || params.get('debug') === '1' ? 'debug' : 'play';
  const k = normalizeFamilyKey(params.get('k')) || '3333';
  const fam = FAMILIES[k];
  const typed = params.get('k') && !normalizeFamilyKey(params.get('k')) ? params.get('k') : null;          // not a family: it goes into the text field as written, which says why
  if (fam.mode === 'multi' || fam.mode === 'still') {
    // five or six cone points: a Length and a Twist a pair, as lists; a number that reads as the default IS the default
    const d = fam.defaults, list = (name, def, dec) => (params.get(name) || '').split(',').map((t, i) => { const v = parseFloat(t); return Number.isFinite(v) && def[i] !== undefined && fmtHashNum(v, dec) === fmtHashNum(def[i], dec) ? def[i] : v; });
    setFamily(k, fam.mode === 'multi' ? { multi: { Ls: list('l', d.L, 3), tws: list('tw', d.tw, 4), active: (parseInt(params.get('p'), 10) || 1) - 1, shown: parseInt(params.get('n'), 10) || 1 } } : {});
    if (typed) custom.fill(typed);
    showTab(targetTab, { writeHash: !initial });
    if (initial) writeHashNow();
    return;
  }
  const mRaw = params.get('m') || fam.defaultM;
  const validM = /^[0-3]{4}$/.test(mRaw) && new Set(mRaw.split('')).size === 4;
  const perm = (validM ? mRaw : fam.defaultM).split('').map(Number);
  const lRaw = parseFloat(params.get('l'));
  const twRaw = parseFloat(params.get('tw'));
  const bRaw = parseFloat(params.get('b'));
  const tauRaw = parseFloat(params.get('to') ?? params.get('tc') ?? params.get('tau'));
  // A link carries its numbers as the page writes them, to three or four decimals: one that reads as the family's
  // default number IS that number, so that a link copied at the defaults opens on the classified pattern, exactly.
  const snap = (v, def, dec) => (fmtHashNum(v, dec) === fmtHashNum(def, dec) ? def : v);
  const L = Number.isFinite(lRaw)
    ? snap(clamp(lRaw, fam.kind === 'E' ? 0.25 : 0.15, Math.max(fam.maxRange[1], fam.kind === 'E' ? 4 : 14)), fam.defaultL, 3)
    : fam.defaultL;
  const tw = Number.isFinite(twRaw) ? snap(clamp(twRaw, -0.5, 0.5), fam.defaultTw, 4) : fam.defaultTw;
  const b = fam.bRange && Number.isFinite(bRaw) ? snap(clamp(bRaw, fam.bRange[0], fam.bRange[1]), fam.defaultB ?? 0, 3) : (fam.defaultB ?? 0);
  const tau = fam.tauLabel && Number.isFinite(tauRaw) ? snap(clamp(tauRaw, -0.5, 0.5), fam.defaultTau ?? 0, 4) : (fam.defaultTau ?? 0);
  setFamily(k, { perm, L, tw, b, tau });
  if (typed) custom.fill(typed);
  showTab(targetTab, { writeHash: !initial });
  if (initial) writeHashNow();
}

// ---- Events
for (const b of tabBtns) {
  b.addEventListener('click', () => showTab(b.dataset.tab));
}
if (backPlayBtn) backPlayBtn.addEventListener('click', () => showTab('play'));

for (const b of famBtns) {
  const k = normalizeFamilyKey(b.dataset.fam);
  if (k) b.dataset.k = k;
  b.addEventListener('click', () => setFamily(b.dataset.fam));
}

sigBtns.forEach((b, idx) => {
  b.addEventListener('click', () => handleConeSelect(idx));
});
pairAdd.addEventListener('click', () => addPair());

for (const b of momentBtns) {
  b.addEventListener('click', () => applyMoment(b.dataset.moment));
}

function resetAll() {
  patWheelArmed = false;
  setFamily(state.k);
  stage.R.resetView();
  stage.R.render();
}

const nativeFsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
let fallbackFs = false;
const isPatternFs = () => nativeFsEl() === pane2El || fallbackFs;

function toggleDebugRunning() {
  debugRunning = !debugRunning;
  debugPrevTs = 0;
  if (!debugRunning) pattern.setInteractiveScale(false);
  else pattern.setInteractiveScale(debugUseScale);
  syncDebugControls();
}

function setDebugScale(useAuto) {
  debugUseScale = !!useAuto;
  if (tab === 'debug') pattern.setInteractiveScale(debugRunning && debugUseScale);
  syncDebugControls();
  renderDebugDOM(debugMonitor.snapshot());
}

if (dbgToggleBtn) dbgToggleBtn.addEventListener('click', toggleDebugRunning);
if (dbgHudToggle) dbgHudToggle.addEventListener('click', toggleDebugRunning);
if (dbgHudScale) dbgHudScale.addEventListener('click', () => setDebugScale(!debugUseScale));
if (dbgResyncBtn) {
  dbgResyncBtn.addEventListener('click', () => {
    debugMonitor.resync('Manual resync...', true);
    lastDbgStatusCode = '';
    renderDebugDOM(debugMonitor.snapshot());
  });
}
for (const b of dbgMotionBtns) {
  b.addEventListener('click', () => {
    debugMode = b.dataset.dbgMotion === 'twist' ? 'twist' : 'pan';
    syncDebugControls();
  });
}
for (const b of dbgSpeedBtns) {
  b.addEventListener('click', () => {
    debugSpeed = DEBUG_SPEEDS[b.dataset.dbgSpeed] ? b.dataset.dbgSpeed : 'med';
    syncDebugControls();
  });
}
for (const b of dbgScaleBtns) {
  b.addEventListener('click', () => setDebugScale(b.dataset.dbgScale === 'auto'));
}

const recordDbgInput = (e) => {
  if (tab === 'debug') debugMonitor.recordInput(e.timeStamp, performance.now());
};
patCanvas.addEventListener('pointerdown', (e) => {
  patWheelArmed = true;
  recordDbgInput(e);
}, { passive: true });
patCanvas.addEventListener('pointermove', recordDbgInput, { passive: true });
patCanvas.addEventListener('wheel', (e) => {
  if (canPatternWheel()) recordDbgInput(e);
}, { passive: true });
document.addEventListener('pointerdown', (e) => {
  if (e.target !== patCanvas && !(patCanvas.contains && patCanvas.contains(e.target))) patWheelArmed = false;
}, { capture: true, passive: true });
window.addEventListener('scroll', () => { patWheelArmed = false; }, { passive: true });

document.addEventListener('visibilitychange', () => {
  if (tab === 'debug') debugMonitor.onVisibilityChange(document.hidden);
});
window.addEventListener('resize', () => {
  if (tab === 'debug') debugMonitor.onResize();
});

function syncFsUI() {
  const on = isPatternFs();
  if (pane2El) pane2El.classList.toggle('pane-fs', on);
  document.documentElement.style.overflow = fallbackFs ? 'hidden' : '';
  if (fs2Btn) {
    fs2Btn.setAttribute('aria-pressed', String(on));
    fs2Btn.setAttribute('aria-label', on ? 'Exit full screen pattern' : 'Full screen pattern');
    fs2Btn.title = on ? 'Exit full screen (Esc)' : 'Full screen';
  }
  syncDebugControls();
  if (tab === 'debug') renderDebugDOM(debugMonitor.snapshot());
  else requestAnimationFrame(() => pattern.draw());
}

async function togglePatternFs() {
  if (!pane2El) return;
  if (isPatternFs()) {
    fallbackFs = false;
    if (nativeFsEl() === pane2El) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) { try { const r = exit.call(document); if (r && typeof r.then === 'function') await r; } catch {} }
    }
    syncFsUI();
    return;
  }
  const req = pane2El.requestFullscreen || pane2El.webkitRequestFullscreen;
  if (req && (document.fullscreenEnabled || document.webkitFullscreenEnabled)) {
    try {
      const r = req.call(pane2El);
      if (r && typeof r.then === 'function') await r;
      fallbackFs = false;
      syncFsUI();
      return;
    } catch {
      // Fall through to full-viewport overlay if blocked or unsupported
    }
  }
  fallbackFs = true;
  syncFsUI();
}

if (fs2Btn) fs2Btn.addEventListener('click', () => { togglePatternFs(); });
document.addEventListener('fullscreenchange', () => { if (nativeFsEl() !== pane2El) fallbackFs = false; syncFsUI(); });
document.addEventListener('webkitfullscreenchange', () => { if (nativeFsEl() !== pane2El) fallbackFs = false; syncFsUI(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && fallbackFs) { fallbackFs = false; syncFsUI(); }
});

reset3Btn.addEventListener('click', resetAll);

// 3D ball feature tap & hover
function coneScreenInfo() {
  if (!built || !built.layout || isStill()) return [];          // an orbifold shown still has nothing to tap
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
    if (tab !== 'tutorial' && built) {
      stage.R.resize();
      stage.R.render();
    }
  }).observe(viewCanvas);
}

if (mqDark && typeof mqDark.addEventListener === 'function') {
  mqDark.addEventListener('change', () => {
    renderAll({ keepView: true, moving: false });
    if (tab === 'debug') drawJitterGraph(dbgGraph, debugMonitor, isDark());
  });
}
window.addEventListener('hashchange', () => applyHash(window.location.hash, { initial: false }));

function debugSummary() {
  return {
    running: debugRunning,
    mode: debugMode,
    speed: debugSpeed,
    useScale: debugUseScale,
    ...debugMonitor.snapshot(),
  };
}

// ---- Verification / inspection API
function stateSummary() {
  if (!isPairs()) return otherSummary();
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
    custom: { text: custom.text(), on: custom.on(), cursor: custom.cursor(), why: custom.why(), said: custom.said() },
    classified: { at: atDefaults(state), view: paisleyView(state.k), ...paisleyInfo(state.k) },
    print: { scale: printScale(state), fit: state.print ? state.print.fit : paisleyInfo(state.k).fit, own: !!state.print, joint: state.print && state.print.joint ? { delta: state.print.joint.delta, clear: state.print.joint.clear, seal: !!state.print.joint.seal, fitted: !!state.print.joint.fitted } : paisleyInfo(state.k).joint },
    autoCenter,
    fullscreen: isPatternFs(),
    moment: activeMoment,
    follow: !!(followState && followState.active),
    hash: computeHash(),
    locationHash: window.location.hash || '#',
    readout: `${valLen.textContent} | ${valTw.textContent} | ${outGeo.textContent}`,
    coneScreen: coneScreenInfo(),
    tileScreens,
    pattern: pattern.state(),
    debug: tab === 'debug' ? debugSummary() : null,
  };
}

/** The same for an orbifold of five or six cone points, or one shown still. */
function otherSummary() {
  const fam = FAMILIES[state.k], many = isMulti(), { d, mDist } = pairMetrics();
  const pr = many ? multiPrint(state.k) : null;
  // where the tile's own features are on the pattern's canvas, and (five or six cone points) the middle of the picked pair
  const spot = (p) => { const pt = pattern.projectTile(p); return pt ? { x: pt[0], y: pt[1] } : null; };
  const home = (currentModel && currentModel.home) || [];
  const tileScreens = home.map((p, slot) => ({ slot, ...spot(p) }));
  const pairMid = many && home.length ? spot(GH.mix(home[2 * state.active], home[2 * state.active + 1], 0.5)) : null;
  return {
    tileScreens, pairMid,
    tab, k: state.k, mode: state.mode, perm: state.perm.slice(), m: state.perm.join(''), orders: (state.orders || []).slice(),
    featLabels: fam.featLabels.slice(), pair: state.perm.slice(), L: state.L, tw: state.tw, b: 0, tau: 0, d, mDist, promoted: null,
    multi: many ? { Ls: state.Ls.slice(), tws: state.tws.slice(), active: state.active, shown: state.shown, pairs: fam.pairs.length, atDefaults: multiAtDefaults(state), fit: pr.fit, commas: pr.count, joints: pr.joints, view: currentModel && currentModel.classified ? currentModel.firstV : null, pose: currentModel && currentModel.pose } : null,
    still: many ? null : { rigid: !!fam.rigid, moves: fam.moves, kind: fam.kind },
    controls: { off: sliderBox.hasAttribute('inert'), add: !pairAdd.hidden, note: stillNote.hidden ? '' : stillNote.textContent },
    custom: { text: custom.text(), on: custom.on(), cursor: custom.cursor(), why: custom.why(), said: custom.said() },
    fullscreen: isPatternFs(),
    moment: null, follow: false, hash: computeHash(), locationHash: window.location.hash || '#',
    readout: `${valLen.textContent} | ${valTw.textContent} | ${outGeo.textContent}`,
    surface: !!built, pattern: pattern.state(), debug: tab === 'debug' ? debugSummary() : null,
  };
}

window.__handles = {
  pair(i) { return activatePair(i); },
  add() { return addPair(); },
  set(opts = {}) {
    cancelGlide();
    cancelFollow();
    if (opts.k ? ['multi', 'still'].includes((FAMILIES[normalizeFamilyKey(opts.k)] || {}).mode) : !isPairs()) {
      const key = (opts.k && normalizeFamilyKey(opts.k)) || state.k;
      setFamily(key, FAMILIES[key].mode === 'multi' ? { multi: { Ls: opts.Ls || (key === state.k ? state.Ls : null), tws: opts.tws || (key === state.k ? state.tws : null), active: opts.active ?? (key === state.k ? state.active : 0), shown: opts.shown ?? (key === state.k ? state.shown : 1) } } : {});
      return stateSummary();
    }
    if (typeof opts.autoCenter === 'boolean') autoCenter = opts.autoCenter;
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
    if (v === 'play' || v === 'debug' || v === 'tutorial') { showTab(v); return stateSummary(); }
    if (v && typeof v === 'object') { stage.R.setView(v); stage.R.render(); }
    return stateSummary();
  },
  debug() { return debugSummary(); },
  moment(id) { applyMoment(id); return stateSummary(); },
  reset() { resetAll(); return stateSummary(); },
  custom,
  state: stateSummary,
  waitGlide,
  pattern,
  stage,
  get built() { return built; },
};

// ---- Boot
applyHash(window.location.hash, { initial: true });
