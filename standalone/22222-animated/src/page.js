// page.js — controller for "22222 animated":
// closed-form hyperbolic two-pair center-sliding animation with 5 center motifs,
// direct geometry-preserving local flips, and 15-grouping navigation via shortest flip paths.

import { shareHash } from '../../classification-of-surfaces/src/sharehash.js';
import {
  LABELS,
  D_BAL,
  ALL_GROUPINGS,
  GROUPING_BY_KEY,
  groupingKeyOfState,
  deltaOf,
  createBalancedModel,
  applyLocalFlip,
  availableLocalFlips,
  navigateToGrouping,
  getTwistTurn,
  scrubTwist,
  stepAnim,
  rebalanceNow,
} from './h22222.js';
import { FEATURES } from './motifs.js';
import { createDiskView } from './disk_view.js';

const $ = (id) => document.getElementById(id);

function formatGroupingText(key) {
  const [p1, piv, p2] = key.split('|');
  return `{${p1[0]}, ${p1[1]}} | ${piv} | {${p2[0]}, ${p2[1]}}`;
}

function formatStateGrouping(state) {
  const [a, b, c, d, e] = state.labels;
  return `{${a}, ${b}} | ${e} | {${c}, ${d}}`;
}

function smallSvg(lbl) {
  return FEATURES[lbl].svg.replace('class="sym-ico ', 'class="sym-ico sym-ico-sm ');
}

function parseHash() {
  const raw = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#/, '');
  const out = { grouping: null, rail: 0, t: null, autoBalance: true };
  if (!raw) return out;
  for (const part of raw.split('&')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const k = part.slice(0, eq);
    const val = decodeURIComponent(part.slice(eq + 1));
    if (k === 'g') {
      const norm = val.replace(/\./g, '|').toUpperCase();
      if (GROUPING_BY_KEY[norm]) out.grouping = norm;
    } else if (k === 'r') {
      const r = parseInt(val, 10);
      if (r >= 0 && r <= 2) out.rail = r;
    } else if (k === 't') {
      const tv = parseFloat(val);
      if (Number.isFinite(tv)) out.t = tv;
    } else if (k === 'bal') {
      out.autoBalance = val !== '0';
    }
  }
  return out;
}

const reducedMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const initial = parseHash();
let model = createBalancedModel({
  activeRail: initial.rail,
  playing: !reducedMotion,
  speed: 1,
  autoBalance: initial.autoBalance,
});
if (initial.grouping && initial.grouping !== groupingKeyOfState(model)) {
  model = navigateToGrouping(model, initial.grouping).state;
  rebalanceNow(model);
  model.activeRail = initial.rail;
}
if (initial.t !== null) {
  scrubTwist(model, initial.t);
}

const diskView = createDiskView($('disk'));

const activeTagEl = $('active-tag');
const playBtn = $('btn-play');
const resetBtn = $('btn-reset');
const balanceBtn = $('btn-balance');
const scrubEl = $('twist-scrub');
const twistValEl = $('twist-val');
const lenReadoutEl = $('len-readout');
const chkRails = $('chk-rails');
const chkBalance = $('chk-balance');
const speedBtns = [...document.querySelectorAll('[data-speed]')];
const railPills = [0, 1, 2].map((i) => document.querySelector(`[data-rail="${i}"]`));
const railDiagramEl = $('rail-diagram');
const flipsGridEl = $('flips-grid');
const groupsMatrixEl = $('groups-matrix');
const flipTrailEl = $('flip-trail');

chkBalance.checked = model.autoBalance;

// Build static 5x3 matrix of all 15 groupings (grouped by pivot A..E)
const chipByKey = {};
function buildGroupsMatrix() {
  groupsMatrixEl.innerHTML = '';
  for (const piv of LABELS) {
    const row = document.createElement('div');
    row.className = 'gm-row';
    const pivEl = document.createElement('div');
    pivEl.className = 'gm-piv';
    pivEl.title = `Pivot ${piv} (${FEATURES[piv].label})`;
    pivEl.innerHTML = `${smallSvg(piv)}<span>${piv}</span>`;
    row.appendChild(pivEl);

    const entries = ALL_GROUPINGS.filter((g) => g.pivot === piv);
    for (const g of entries) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'g-chip';
      btn.dataset.key = g.key;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.title = `${formatGroupingText(g.key)} — click to reach via local flips`;
      btn.innerHTML = `
        <span class="g-pair">${smallSvg(g.pair1[0])}${smallSvg(g.pair1[1])}</span>
        <span class="g-sep">|</span>
        <span class="g-pair">${smallSvg(g.pair2[0])}${smallSvg(g.pair2[1])}</span>
      `;
      btn.addEventListener('click', () => {
        const res = navigateToGrouping(model, g.key);
        model = res.state;
        updateTrail(res.path);
        renderAll();
        writeHash();
        ensureLoop();
      });
      row.appendChild(btn);
      chipByKey[g.key] = btn;
    }
    groupsMatrixEl.appendChild(row);
  }
}
buildGroupsMatrix();

let lastHash = '';
let rafId = 0;
let lastFrameMs = 0;
let lastGroupingRendered = '';

function writeHash() {
  const key = groupingKeyOfState(model);
  const parts = [];
  if (key !== 'AB|E|CD') parts.push(`g=${key.replace(/\|/g, '.')}`);
  if (model.activeRail !== 0) parts.push(`r=${model.activeRail}`);
  if (!model.autoBalance) parts.push('bal=0');
  if (!model.playing) parts.push(`t=${getTwistTurn(model).toFixed(3).replace(/\.?0+$/, '')}`);
  const h = parts.length ? '#' + parts.join('&') : '#';
  if (h === lastHash) return;
  lastHash = h;
  try {
    if (window.location.hash !== h) history.replaceState(null, '', h);
  } catch { /* sandboxed */ }
  shareHash(h);
}

function updateTrail(path) {
  if (!path || path.length <= 1) {
    flipTrailEl.textContent = `Current grouping · ${formatStateGrouping(model)}`;
    return;
  }
  const n = path.length - 1;
  const chain = path.map((k) => {
    const [p1, piv, p2] = k.split('|');
    return `${p1}|${piv}|${p2}`;
  }).join(' → ');
  flipTrailEl.textContent = `${n} local ${n === 1 ? 'flip' : 'flips'}: ${chain}`;
}

function renderActiveGroupingControls() {
  const [a, b, c, d, e] = model.labels;
  const r1On = model.activeRail === 0 || model.activeRail === 2;
  const r2On = model.activeRail === 1 || model.activeRail === 2;

  railDiagramEl.innerHTML = `
    <button type="button" class="rd-pair ${r1On ? 'is-active' : ''}" id="rd-p1" title="Animate Rail 1 {${a}, ${b}}">
      <span class="rd-pair-icons">
        <span class="rd-badge">${FEATURES[a].svg}${a}</span>
        <span class="rd-badge">${FEATURES[b].svg}${b}</span>
      </span>
      <span class="rd-pair-tag">Rail 1</span>
    </button>
    <span class="rd-rail-line r1" aria-hidden="true"></span>
    <div class="rd-pivot" title="Pivot ${e} (${FEATURES[e].label}) stays stationary during rail twists">
      <span class="rd-badge">${FEATURES[e].svg}${e}</span>
      <span class="rd-pivot-tag">Pivot</span>
    </div>
    <span class="rd-rail-line r2" aria-hidden="true"></span>
    <button type="button" class="rd-pair ${r2On ? 'is-active' : ''}" id="rd-p2" title="Animate Rail 2 {${c}, ${d}}">
      <span class="rd-pair-icons">
        <span class="rd-badge">${FEATURES[c].svg}${c}</span>
        <span class="rd-badge">${FEATURES[d].svg}${d}</span>
      </span>
      <span class="rd-pair-tag">Rail 2</span>
    </button>
  `;

  const rdP1 = $('rd-p1');
  const rdP2 = $('rd-p2');
  rdP1.addEventListener('click', () => selectRail(0));
  rdP2.addEventListener('click', () => selectRail(1));
  rdP1.addEventListener('pointerenter', () => diskView.setHover({ kind: 'rail', railIdx: 0 }));
  rdP1.addEventListener('pointerleave', () => diskView.setHover(null));
  rdP2.addEventListener('pointerenter', () => diskView.setHover({ kind: 'rail', railIdx: 1 }));
  rdP2.addEventListener('pointerleave', () => diskView.setHover(null));

  railPills[0].textContent = `Rail 1 {${a}, ${b}}`;
  railPills[1].textContent = `Rail 2 {${c}, ${d}}`;

  // Render the 4 direct local flip buttons
  const flips = availableLocalFlips(model);
  flipsGridEl.innerHTML = '';
  flips.forEach((fl, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `flip-btn rail-${fl.railIdx + 1}`;
    btn.dataset.flipIdx = String(idx);
    btn.innerHTML = `
      <span class="flip-top">
        <span>Flip Rail ${fl.railIdx + 1}</span>
        <span>${fl.swapOut} ↔ ${fl.pivot}</span>
      </span>
      <span class="flip-icons">
        ${smallSvg(fl.keepLabel)}${smallSvg(fl.pivot)}
        <span class="flip-arrow">pair</span>
      </span>
      <span class="flip-target">→ ${formatGroupingText(fl.targetKey)}</span>
    `;
    btn.addEventListener('click', () => {
      diskView.setHover(null);
      model = applyLocalFlip(model, fl.railIdx, fl.keepIdx, { focusFlippedRail: true });
      updateTrail(model.lastPath);
      renderAll();
      writeHash();
      ensureLoop();
    });
    btn.addEventListener('pointerenter', () => diskView.setHover({ kind: 'flip', flip: fl }));
    btn.addEventListener('pointerleave', () => diskView.setHover(null));
    flipsGridEl.appendChild(btn);
  });

  // Update 15-grouping matrix selection & 1-flip neighbor highlights
  const curKey = groupingKeyOfState(model);
  const nbrSet = new Set(GROUPING_BY_KEY[curKey].neighbors);
  for (const g of ALL_GROUPINGS) {
    const chip = chipByKey[g.key];
    const sel = g.key === curKey;
    const isNbr = nbrSet.has(g.key);
    chip.classList.toggle('is-selected', sel);
    chip.classList.toggle('is-neighbor', !sel && isNbr);
    chip.setAttribute('aria-checked', String(sel));
  }
}

function syncUI() {
  const curKey = groupingKeyOfState(model);
  const sig = `${model.labels.join('')}:${model.activeRail}`;
  if (sig !== lastGroupingRendered) {
    lastGroupingRendered = sig;
    renderActiveGroupingControls();
  }

  activeTagEl.textContent = formatStateGrouping(model);
  playBtn.textContent = model.playing ? 'Pause' : 'Play';
  playBtn.setAttribute('aria-pressed', String(model.playing));

  const u = getTwistTurn(model);
  scrubEl.value = u.toFixed(4);
  twistValEl.textContent = u.toFixed(3);

  const delta = deltaOf(model.d1, model.d2);
  lenReadoutEl.textContent = `d₁ = ${model.d1.toFixed(3)} · d₂ = ${model.d2.toFixed(3)} · δ = ${delta.toFixed(3)}`;
  const isBalanced = Math.abs(model.d1 - D_BAL) < 0.005 && Math.abs(model.d2 - D_BAL) < 0.005;
  balanceBtn.disabled = isBalanced;
  balanceBtn.style.opacity = isBalanced ? '0.45' : '1';

  for (let i = 0; i < 3; i++) {
    const sel = i === model.activeRail;
    railPills[i].classList.toggle('is-selected', sel);
    railPills[i].setAttribute('aria-checked', String(sel));
  }
  for (const btn of speedBtns) {
    btn.classList.toggle('is-selected', parseFloat(btn.dataset.speed) === model.speed);
  }
  chkBalance.checked = model.autoBalance;
}

function renderAll() {
  diskView.set(model);
  syncUI();
}

function selectRail(idx) {
  model.activeRail = idx;
  lastGroupingRendered = '';
  renderAll();
  writeHash();
  ensureLoop();
}

function tick(now) {
  rafId = 0;
  if (!model.playing) return;
  const dt = lastFrameMs ? Math.min(0.05, Math.max(0, (now - lastFrameMs) / 1000)) : 0;
  lastFrameMs = now;
  stepAnim(model, dt);
  renderAll();
  if (model.playing) {
    rafId = requestAnimationFrame(tick);
  }
}

function ensureLoop() {
  if (!rafId && model.playing) {
    lastFrameMs = performance.now();
    rafId = requestAnimationFrame(tick);
  }
}

function resetAll() {
  model = createBalancedModel({
    activeRail: 0,
    playing: model.playing,
    speed: model.speed,
    autoBalance: model.autoBalance,
  });
  lastGroupingRendered = '';
  diskView.resetView();
  flipTrailEl.textContent = `Balanced 5-fold start · ${formatStateGrouping(model)}`;
  renderAll();
  writeHash();
  ensureLoop();
}

for (let i = 0; i < 3; i++) {
  railPills[i].addEventListener('click', () => selectRail(i));
  if (i < 2) {
    railPills[i].addEventListener('pointerenter', () => diskView.setHover({ kind: 'rail', railIdx: i }));
    railPills[i].addEventListener('pointerleave', () => diskView.setHover(null));
  }
}

playBtn.addEventListener('click', () => {
  model.playing = !model.playing;
  syncUI();
  writeHash();
  ensureLoop();
});

resetBtn.addEventListener('click', resetAll);

balanceBtn.addEventListener('click', () => {
  rebalanceNow(model);
  renderAll();
});

chkRails.addEventListener('change', () => {
  diskView.setShowRails(chkRails.checked);
});

chkBalance.addEventListener('change', () => {
  model.autoBalance = chkBalance.checked;
  writeHash();
  syncUI();
});

for (const btn of speedBtns) {
  btn.addEventListener('click', () => {
    model.speed = parseFloat(btn.dataset.speed) || 1;
    syncUI();
  });
}

let resumeOnScrubUp = false;
scrubEl.addEventListener('pointerdown', () => {
  resumeOnScrubUp = model.playing;
  model.playing = false;
  syncUI();
});

scrubEl.addEventListener('input', () => {
  scrubTwist(model, parseFloat(scrubEl.value));
  renderAll();
});

scrubEl.addEventListener('change', () => {
  if (resumeOnScrubUp) {
    model.playing = true;
    resumeOnScrubUp = false;
    ensureLoop();
  }
  syncUI();
  writeHash();
});

$('reset-view').addEventListener('click', () => {
  diskView.resetView();
});

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
  if (e.code === 'Space') {
    e.preventDefault();
    model.playing = !model.playing;
    syncUI();
    writeHash();
    ensureLoop();
  } else if (e.key >= '1' && e.key <= '4') {
    const idx = parseInt(e.key, 10) - 1;
    const fl = availableLocalFlips(model)[idx];
    if (fl) {
      model = applyLocalFlip(model, fl.railIdx, fl.keepIdx, { focusFlippedRail: true });
      updateTrail(model.lastPath);
      renderAll();
      writeHash();
      ensureLoop();
    }
  }
});

const diskPaneEl = $('disk-pane');
if (typeof ResizeObserver === 'function') {
  new ResizeObserver(() => diskView.resize()).observe(diskPaneEl);
} else {
  window.addEventListener('resize', () => diskView.resize());
}

renderAll();
lastHash = window.location.hash || '#';
ensureLoop();

window.__anim22222 = {
  state: () => ({
    grouping: groupingKeyOfState(model),
    labels: model.labels.slice(),
    d1: model.d1,
    d2: model.d2,
    delta: deltaOf(model.d1, model.d2),
    twistTurn: getTwistTurn(model),
    activeRail: model.activeRail,
    playing: model.playing,
    autoBalance: model.autoBalance,
    flipCount: model.flipCount,
    lastPath: model.lastPath.slice(),
  }),
  info: () => diskView.info(),
  availableFlips: () => availableLocalFlips(model),
  doFlip: (railIdx, keepIdx) => {
    model = applyLocalFlip(model, railIdx, keepIdx, { focusFlippedRail: true });
    updateTrail(model.lastPath);
    renderAll();
    writeHash();
  },
  goTo: (key) => {
    const res = navigateToGrouping(model, key);
    model = res.state;
    updateTrail(res.path);
    renderAll();
    writeHash();
    return res.path;
  },
  setRail: (r) => selectRail(r),
  setTwist: (u) => {
    scrubTwist(model, u);
    renderAll();
  },
  setPlaying: (p) => {
    model.playing = !!p;
    syncUI();
    ensureLoop();
  },
  setAutoBalance: (b) => {
    model.autoBalance = !!b;
    syncUI();
  },
  setShowRails: (s) => {
    chkRails.checked = !!s;
    diskView.setShowRails(!!s);
  },
  rebalance: () => {
    rebalanceNow(model);
    renderAll();
  },
  reset: resetAll,
  resetView: () => diskView.resetView(),
};
