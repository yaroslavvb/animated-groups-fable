// page.js — controller for "The real 2222": parses hash, couples all 3 partition slider pairs,
// drives the full-pillow 3D view, and shares live hash state.

import { shareHash } from '../../classification-of-surfaces/src/sharehash.js';
import {
  REG_ELL,
  DEFAULT_C,
  L_MIN,
  L_MAX,
  T_MIN,
  T_MAX,
  clamp,
  createModel,
  readPartitions,
  activatePartition,
  setPartitionParams,
} from './real2222.js';
import { placedInPane, samePrint } from './paisley.js';
import { createPillowStage } from './pillow3d.js';

const $ = (id) => document.getElementById(id);
const PAISLEY_FNS = { placedInPane, samePrint };

function parseHash() {
  const raw = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#/, '');
  const out = { ell: 1, t: 0, cFrac: DEFAULT_C, activeIdx: 0 };
  if (!raw) return out;
  for (const part of raw.split('&')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const k = part.slice(0, eq);
    const v = parseFloat(decodeURIComponent(part.slice(eq + 1)));
    if (!Number.isFinite(v)) continue;
    if (k === 'l') out.ell = v;
    else if (k === 't') out.t = v;
    else if (k === 'c') out.cFrac = v;
    else if (k === 'p') {
      const idx = Math.round(v);
      if (idx >= 0 && idx <= 2) out.activeIdx = idx;
    }
  }
  return out;
}

function fmtSigned(v) {
  const rounded = Math.abs(v) < 0.0005 ? 0 : v;
  return (rounded >= 0 ? '+' : '') + rounded.toFixed(3);
}

const initial = parseHash();
let model = createModel(initial);
const pillow = createPillowStage($('view'), $('labels'), $('stage-wrap'));

const lenInputs = [0, 1, 2].map((i) => $(`len-${i}`));
const twInputs = [0, 1, 2].map((i) => $(`tw-${i}`));
const lenVals = [0, 1, 2].map((i) => $(`len-val-${i}`));
const twVals = [0, 1, 2].map((i) => $(`tw-val-${i}`));
const cards = [0, 1, 2].map((i) => document.querySelector(`.partition-card[data-part="${i}"]`));
const headBtns = [0, 1, 2].map((i) => document.querySelector(`[data-select="${i}"]`));
const shapeKindEl = $('shape-kind');
const edgesReadoutEl = $('edges-readout');
const cutReadoutEl = $('cut-readout');

let hashTimer = 0;
let lastHash = '';

function formatHash() {
  const act = readPartitions(model)[model.activeIdx];
  const isDefault =
    model.activeIdx === 0 &&
    Math.abs(act.ell - 1) < 1e-4 &&
    Math.abs(act.t) < 1e-4 &&
    Math.abs(model.cFrac - DEFAULT_C) < 1e-4;
  if (isDefault) return `#l=1&t=0&c=${DEFAULT_C}`;
  const parts = [
    `l=${act.ell.toFixed(4).replace(/\.?0+$/, '')}`,
    `t=${act.t.toFixed(4).replace(/\.?0+$/, '')}`,
    `c=${model.cFrac.toFixed(3).replace(/\.?0+$/, '')}`,
  ];
  if (model.activeIdx !== 0) parts.push(`p=${model.activeIdx}`);
  return '#' + parts.join('&');
}

function writeHashNow() {
  const h = formatHash();
  if (h === lastHash) return;
  lastHash = h;
  try {
    if (window.location.hash !== h) history.replaceState(null, '', h);
  } catch { /* sandboxed frame */ }
  shareHash(h);
}

function scheduleHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(writeHashNow, 180);
}

function syncControls() {
  const parts = readPartitions(model);
  for (let i = 0; i < 3; i++) {
    const p = parts[i];
    const active = i === model.activeIdx;
    cards[i].classList.toggle('is-active', active);
    headBtns[i].setAttribute('aria-pressed', String(active));
    lenInputs[i].value = clamp(p.ell, L_MIN, L_MAX).toFixed(4);
    twInputs[i].value = clamp(p.t, T_MIN, T_MAX).toFixed(4);
    lenVals[i].textContent = p.ell.toFixed(3);
    twVals[i].textContent = fmtSigned(p.t);
  }
}

function renderAll() {
  pillow.set(model);
  syncControls();
  const info = pillow.info();
  shapeKindEl.textContent = info.kind || 'tetrahedron';
  if (info.edges.length === 3) {
    edgesReadoutEl.textContent = 'edges ' + info.edges.map((e) => e.toFixed(2)).join(', ');
  }
  cutReadoutEl.textContent = model.cFrac.toFixed(3).replace(/\.?0+$/, '');
}

for (let i = 0; i < 3; i++) {
  headBtns[i].addEventListener('click', () => {
    activatePartition(model, i, PAISLEY_FNS);
    renderAll();
    scheduleHash();
  });

  const onActivate = () => {
    if (model.activeIdx !== i) {
      activatePartition(model, i, PAISLEY_FNS);
      renderAll();
    }
  };

  lenInputs[i].addEventListener('pointerdown', onActivate);
  twInputs[i].addEventListener('pointerdown', onActivate);

  lenInputs[i].addEventListener('input', () => {
    const cur = readPartitions(model)[i];
    const ell = parseFloat(lenInputs[i].value);
    setPartitionParams(model, i, ell, cur.t, PAISLEY_FNS);
    renderAll();
    scheduleHash();
  });

  twInputs[i].addEventListener('input', () => {
    // Use true numeric length cur.ell from the model so an edge > L_MAX doesn't jump when twisting!
    const cur = readPartitions(model)[i];
    const t = parseFloat(twInputs[i].value);
    setPartitionParams(model, i, cur.ell, t, PAISLEY_FNS);
    renderAll();
    scheduleHash();
  });

  lenInputs[i].addEventListener('change', writeHashNow);
  twInputs[i].addEventListener('change', writeHashNow);
}

$('reset-view').addEventListener('click', () => {
  pillow.resetView();
});

$('preset-square').addEventListener('click', () => {
  model = createModel({ ell: 1, t: 0, cFrac: model.cFrac, activeIdx: 0 });
  renderAll();
  writeHashNow();
});

$('preset-reg').addEventListener('click', () => {
  model = createModel({ ell: REG_ELL, t: 0.25, cFrac: model.cFrac, activeIdx: 0 });
  renderAll();
  writeHashNow();
});

$('preset-reset').addEventListener('click', () => {
  model = createModel({ ell: 1, t: 0, cFrac: DEFAULT_C, activeIdx: 0 });
  pillow.resetView();
  renderAll();
  writeHashNow();
});

window.addEventListener('hashchange', () => {
  const h = window.location.hash;
  if (h === lastHash) return;
  model = createModel(parseHash());
  lastHash = h;
  renderAll();
});

const paneEl = $('pane');
if (typeof ResizeObserver === 'function') {
  new ResizeObserver(() => pillow.resize()).observe(paneEl);
} else {
  window.addEventListener('resize', () => pillow.resize());
}

renderAll();
lastHash = window.location.hash || formatHash();

window.__real2222 = {
  state: () => ({
    e: model.e.map((r) => [...r]),
    activeIdx: model.activeIdx,
    activeFrame: model.activeFrame.map((r) => [...r]),
    cFrac: model.cFrac,
    pr: model.pr,
  }),
  partitions: () => readPartitions(model).map((p) => ({ idx: p.idx, ell: p.ell, t: p.t, M: p.M })),
  info: () => pillow.info(),
  activate: (idx) => {
    activatePartition(model, idx, PAISLEY_FNS);
    renderAll();
    writeHashNow();
  },
  set: (idx, ell, t) => {
    setPartitionParams(model, idx, ell, t, PAISLEY_FNS);
    renderAll();
    writeHashNow();
  },
  resetView: () => pillow.resetView(),
};
