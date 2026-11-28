// page.js — controller for "The real 2222 animated":
// fixed aspect ratio/size, three twist-pair selector buttons, continuous animation in 3D and 2D rigid unfolding.

import { shareHash } from '../../classification-of-surfaces/src/sharehash.js';
import { placedInPane, samePrint } from '../../real-2222/src/paisley.js';
import { mod } from '../../real-2222/src/real2222.js';
import {
  FIXED_ELL,
  ANIM_PERIOD,
  createAnimModel,
  switchAnimPair,
  stepAnim,
  scrubAnimTwist,
} from './symbols.js';
import { createAnimPillowStage } from './pillow3d_anim.js';
import { createAnimUnfoldPane } from './unfold2d_anim.js';

const $ = (id) => document.getElementById(id);
const PAISLEY_FNS = { placedInPane, samePrint };

function parseHash() {
  const raw = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#/, '');
  const out = { activeIdx: 0, t: 0.25 };
  if (!raw) return out;
  for (const part of raw.split('&')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const k = part.slice(0, eq);
    const v = parseFloat(decodeURIComponent(part.slice(eq + 1)));
    if (!Number.isFinite(v)) continue;
    if (k === 'p') {
      const idx = Math.round(v);
      if (idx >= 0 && idx <= 2) out.activeIdx = idx;
    } else if (k === 't') {
      out.t = mod(v, ANIM_PERIOD);
    }
  }
  return out;
}

const reducedMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const initial = parseHash();
let model = createAnimModel({
  activeIdx: initial.activeIdx,
  t: initial.t,
  ell: FIXED_ELL,
  playing: !reducedMotion,
  speed: 1,
});

const pillow = createAnimPillowStage($('view'), $('labels'), $('stage-wrap'));
const unfold = createAnimUnfoldPane($('unfold'));

const pairBtns = [0, 1, 2].map((i) => document.querySelector(`[data-pair="${i}"]`));
const speedBtns = [...document.querySelectorAll('[data-speed]')];
const playBtn = $('btn-play');
const scrubEl = $('twist-scrub');
const twistValEl = $('twist-val');
const shapeKindEl = $('shape-kind');

let lastHash = '';
let rafId = 0;
let lastFrameMs = 0;

function writeHash() {
  const parts = [];
  if (model.activeIdx !== 0) parts.push(`p=${model.activeIdx}`);
  if (!model.playing) parts.push(`t=${model.animT.toFixed(3).replace(/\.?0+$/, '')}`);
  const h = parts.length ? '#' + parts.join('&') : '#';
  if (h === lastHash) return;
  lastHash = h;
  try {
    if (window.location.hash !== h) history.replaceState(null, '', h);
  } catch { /* sandboxed */ }
  shareHash(h);
}

function syncUI() {
  for (let i = 0; i < 3; i++) {
    const sel = i === model.activeIdx;
    pairBtns[i].classList.toggle('is-selected', sel);
    pairBtns[i].setAttribute('aria-checked', String(sel));
  }
  playBtn.textContent = model.playing ? 'Pause' : 'Play';
  playBtn.setAttribute('aria-pressed', String(model.playing));
  scrubEl.value = model.animT.toFixed(4);
  twistValEl.textContent = model.animT.toFixed(3);
  const info = pillow.info();
  if (info.kind) shapeKindEl.textContent = info.kind;
  for (const btn of speedBtns) {
    btn.classList.toggle('is-selected', parseFloat(btn.dataset.speed) === model.speed);
  }
}

function renderAll() {
  pillow.set(model);
  unfold.set(model);
  syncUI();
}

function tick(now) {
  rafId = 0;
  if (!model.playing && !model.glide && !model.midGlide) return;
  const dt = lastFrameMs ? Math.min(0.05, Math.max(0, (now - lastFrameMs) / 1000)) : 0;
  lastFrameMs = now;
  stepAnim(model, dt);
  renderAll();
  if (model.playing || model.glide || model.midGlide) {
    rafId = requestAnimationFrame(tick);
  }
}

function ensureLoop() {
  if (!rafId && (model.playing || model.glide || model.midGlide)) {
    lastFrameMs = performance.now();
    rafId = requestAnimationFrame(tick);
  }
}

for (let i = 0; i < 3; i++) {
  pairBtns[i].addEventListener('click', () => {
    switchAnimPair(model, i, PAISLEY_FNS);
    renderAll();
    writeHash();
    ensureLoop();
  });
}

playBtn.addEventListener('click', () => {
  model.playing = !model.playing;
  syncUI();
  writeHash();
  ensureLoop();
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
  scrubAnimTwist(model, parseFloat(scrubEl.value));
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
  pillow.resetView();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
    e.preventDefault();
    model.playing = !model.playing;
    syncUI();
    writeHash();
    ensureLoop();
  }
});

window.addEventListener('hashchange', () => {
  const h = window.location.hash;
  if (h === lastHash) return;
  const p = parseHash();
  model = createAnimModel({
    activeIdx: p.activeIdx,
    t: p.t,
    ell: FIXED_ELL,
    playing: model.playing,
    speed: model.speed,
  });
  lastHash = h;
  renderAll();
  ensureLoop();
});

const paneEl = $('pane');
const unfoldPaneEl = $('unfold-pane');
if (typeof ResizeObserver === 'function') {
  new ResizeObserver(() => pillow.resize()).observe(paneEl);
  new ResizeObserver(() => unfold.resize()).observe(unfoldPaneEl);
} else {
  window.addEventListener('resize', () => {
    pillow.resize();
    unfold.resize();
  });
}

renderAll();
lastHash = window.location.hash || '#';
ensureLoop();

window.__real2222Anim = {
  state: () => ({
    activeIdx: model.activeIdx,
    animEll: model.animEll,
    animT: model.animT,
    playing: model.playing,
    speed: model.speed,
    gliding: !!(model.glide || model.midGlide),
  }),
  info: () => pillow.info(),
  unfoldInfo: () => unfold.info(),
  selectPair: (idx) => {
    switchAnimPair(model, idx, PAISLEY_FNS);
    renderAll();
    ensureLoop();
  },
  setTwist: (t) => {
    scrubAnimTwist(model, t);
    renderAll();
  },
  setPlaying: (playing) => {
    model.playing = !!playing;
    syncUI();
    ensureLoop();
  },
  setSpeed: (speed) => {
    model.speed = speed;
    syncUI();
  },
  resetView: () => pillow.resetView(),
};
