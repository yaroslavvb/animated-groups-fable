// app.js — Classification of Surfaces: one 3D stage (The Folding's renderer), four tabs after Chapter 8 of
// The Symmetries of Things and a fifth for what the chapter is for (patterns and their orbifolds). Each tab is a small module with enter() / leave() / when(); this file owns the shell:
// the tab bar, what text shows for the current tab and state, the play bar, the hash, the book citations.
//
//   #zip  #tidy  #prove  #name  #sym     deep links to the tabs (with &k=<state> where a tab has one: #sym&k=*732)
//   window.__surfaces               { show(tab), tabs, stage, sync, snapshot(), applyRemote(s) } for the tools and tests
//
// One screen can drive the others: sync.js, through a spacesheep page stream. snapshot() and applyRemote() below are
// the page's state as one small object and the way back.

import { createStage } from './stage.js';
import { createTimeline } from './vendor/the-folding/timeline.js';
import { initBookRefs } from './bookref.js';
import { createZipTab } from './tabs/zip.js';
import { createTidyTab } from './tabs/tidy.js';
import { createProveTab } from './tabs/prove.js';
import { createNameTab } from './tabs/name.js';
import { createSymTab } from './tabs/sym.js';
import { createSync } from './sync.js';
import { shareHash } from './sharehash.js';

const $ = (id) => document.getElementById(id);
const app = $('app');
const stage = createStage($('view'), $('labels'));
const turnHint = $('turn-hint');

// The tab the page opens on when its address names none: Symmetries, which is also first in the bar (his ask, Mon 16
// Nov 2026: "make 'symmetries' tab the default first tab"). The page calls its tabs by name, never by number.
const DEFAULT_TAB = 'sym';
let current = null, currentName = '';
const timeline = createTimeline({
  slider: $('scrubber'), button: $('play'), labels: { fold: 'Zip', unfold: 'Unzip', pause: 'Pause' },
  keyTarget: null,            // the play bar belongs to one tab: no page-wide Space key
  onChange: (t) => { if (current && current.setT) current.setT(t); },
});

const ctx = {
  stage, timeline, badge: $('badge'),
  changed() { syncText(); scheduleHash(); },
  // show a surface in its tidy form: the Tidy surfaces tab with these counts ({ o, star, x, X })
  goTidy(counts) { show('tidy'); tabs.tidy.setAll(counts); },
  // zip a surface up from its pieces: the Zip it up tab with that preset
  goProve(key) { show('prove'); tabs.prove.start(key); },
  // zip one polygon up: the Zip it up tab with the tile of a pattern (the Symmetries tab)
  goProveWords(words, label) { show('prove'); tabs.prove.tile(words, label); window.scrollTo({ top: 0 }); },
};
const tabs = { zip: createZipTab(ctx), tidy: createTidyTab(ctx), prove: createProveTab(ctx), name: createNameTab(ctx), sym: createSymTab(ctx) };

// what shows: [data-tab-only] by tab, [data-when] by "tab:state" (a tab may name several states at once)
function syncText() {
  const when = new Set([].concat(current && current.when ? current.when() : []));
  for (const el of document.querySelectorAll('[data-tab-only]')) el.hidden = !el.dataset.tabOnly.split(/\s+/).includes(currentName);
  for (const el of document.querySelectorAll('[data-when]')) el.hidden = !when.has(el.dataset.when);
}

function show(name, state) {
  if (!tabs[name]) name = DEFAULT_TAB;
  if (current && current.leave) current.leave();
  stage.stopAll();
  stage.extraLines = null; stage.extraMarkers = null;
  $('badge').textContent = '';
  current = tabs[name]; currentName = name;
  app.dataset.tab = name;
  for (const b of document.querySelectorAll('.tab')) b.setAttribute('aria-selected', String(b.dataset.tab === name));
  if (state && current.set) current.set(state);
  syncText();
  current.enter();
  syncText();
  scheduleHash();
}
for (const b of document.querySelectorAll('.tab')) b.addEventListener('click', () => show(b.dataset.tab));
$('tabs').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const list = [...document.querySelectorAll('.tab:not([hidden])')], i = list.findIndex((b) => b.dataset.tab === currentName);
  const next = list[(i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
  next.focus(); show(next.dataset.tab);
});

$('reset-view').addEventListener('click', () => stage.R.resetView());
// "Next" under each tab: the chapter's order
for (const a of document.querySelectorAll('[data-go]')) a.addEventListener('click', (e) => { e.preventDefault(); show(a.dataset.go, a.dataset.k ? { k: a.dataset.k } : undefined); window.scrollTo({ top: 0 }); });
$('view').addEventListener('pointerdown', () => { turnHint.hidden = true; }, { once: true });

// ---- the hash: #<tab>&k=<state>
let hashTimer = 0, lastHash = '';
const HOME = '#' + DEFAULT_TAB + '&k=*632';      // what a plain link opens (tabs/sym.js starts on *632): told to the viewer as no fragment at all
function scheduleHash() { clearTimeout(hashTimer); hashTimer = setTimeout(writeHash, 250); }
function writeHash() {
  const s = current && current.get ? current.get() : {};
  const parts = [currentName];
  for (const [k, v] of Object.entries(s)) if (v !== undefined && v !== null && k !== 't') parts.push(k + '=' + encodeURIComponent(v));
  const h = '#' + parts.join('&');
  lastHash = h;
  try { if (location.hash !== h) history.replaceState(null, '', h); } catch (e) { /* a sandboxed frame may refuse: the page works without */ }
  shareHash(h === HOME ? '#' : h);     // on spacesheep: the address bar follows the tab and its state
}
function readHash() {
  const parts = location.hash.replace(/^#/, '').split('&').filter(Boolean);
  const name = parts.shift() || DEFAULT_TAB, state = {};
  for (const p of parts) { const i = p.indexOf('='); if (i > 0) { try { state[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1)); } catch (e) { /* a broken escape (#sym&k=%zz): that part is ignored */ } } }
  return [name, state];
}
// a link followed or an address typed: another tab, or another state of this one (#sym&k=*732 while the Symmetries tab is open)
window.addEventListener('hashchange', () => { const [name, state] = readHash(); if (name !== currentName || location.hash !== lastHash) show(name, state); });

if (!stage.R.ok) { const p = document.createElement('p'); p.className = 'r3d-message'; p.textContent = 'The 3D view needs WebGL 2, which this browser does not offer.'; $('pane').append(p); turnHint.hidden = true; }
initBookRefs($('bkpop'));
const [name0, state0] = readHash();
show(name0, state0);

// ---- one screen drives the others (sync.js): the page's state as one small object, and the way back
const round = (x, k) => Math.round(x * k) / k;
const plain = (s) => JSON.stringify(Object.entries(s || {}).filter(([k, v]) => k !== 't' && v !== undefined && v !== null).map(([k, v]) => [k, String(v)]).sort());
function snapshot() {
  const s = current && current.get ? current.get() : {}, v = stage.R.getView(), st = {};
  for (const [k, x] of Object.entries(s)) if (x !== undefined && x !== null) st[k] = typeof x === 'number' ? round(x, 1e3) : x;
  const out = { tab: currentName, st };
  if (current && current.live) out.live = current.live();
  if (v && v.q) { out.q = v.q.map((x) => round(x, 1e4)); out.z = round(v.zoom, 1e3); }
  return out;
}
function applyRemote(s) {
  if (!s || typeof s.tab !== 'string' || !tabs[s.tab]) return;
  const st = s.st && typeof s.st === 'object' ? s.st : {}, mine = current && current.get ? current.get() : {};
  if (s.tab !== currentName || plain(st) !== plain(mine)) show(s.tab, st);                     // another tab, or another state of this one
  else if (current.setT && Number.isFinite(st.t) && Math.abs(st.t - (mine.t || 0)) > 5e-4) { timeline.set(st.t); current.setT(st.t); }      // the scrubber
  if (s.live && current.applyLive) current.applyLive(s.live);
  if (Array.isArray(s.q) && s.q.length === 4 && s.q.every(Number.isFinite)) {
    const v = stage.R.getView(), z = Number.isFinite(s.z) ? s.z : 1;
    if (!v || !v.q || Math.abs(v.zoom - z) > 2e-3 || v.q.some((x, i) => Math.abs(x - s.q[i]) > 2e-4)) { stage.R.setView({ q: s.q, zoom: z }); stage.R.render(); }
  }
}
const streamName = (document.querySelector('meta[name="ss-streams"]') || { dataset: {} }).dataset.push;
const sync = createSync({ stream: streamName && window.ss && window.ss.stream ? window.ss.stream(streamName) : null, snapshot, apply: applyRemote, chip: $('sync-chip') });
window.__surfaces = { show, tabs, stage, timeline, sync, snapshot, applyRemote, get tab() { return currentName; } };
