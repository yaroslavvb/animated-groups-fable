// app.js — Classification of Surfaces: one 3D stage (The Folding's renderer), four tabs after Chapter 8 of
// The Symmetries of Things and a fifth for what the chapter is for (patterns and their orbifolds). Each tab is a small module with enter() / leave() / when(); this file owns the shell:
// the tab bar, what text shows for the current tab and state, the play bar, the hash, the book citations.
//
//   #zip  #tidy  #prove  #name  #sym     deep links to the tabs (with &k=<state> where a tab has one: #sym&k=*732)
//   window.__surfaces               { show(tab), tabs, stage } for the tools and tests

import { createStage } from './stage.js';
import { createTimeline } from './vendor/the-folding/timeline.js';
import { initBookRefs } from './bookref.js';
import { MODES } from './turning.js';
import { createZipTab } from './tabs/zip.js';
import { createTidyTab } from './tabs/tidy.js';
import { createProveTab } from './tabs/prove.js';
import { createNameTab } from './tabs/name.js';
import { createSymTab } from './tabs/sym.js';

const $ = (id) => document.getElementById(id);
const app = $('app');
const stage = createStage($('view'), $('labels'));
const turnHint = $('turn-hint');

let current = null, currentName = '';
const timeline = createTimeline({
  slider: $('scrubber'), button: $('play'), labels: { fold: 'Zip', unfold: 'Unzip', pause: 'Pause' },
  keyTarget: null,            // the play bar belongs to one tab: no page-wide Space key
  onChange: (t) => { if (current && current.setT) current.setT(t); },
});

const ctx = {
  stage, timeline, badge: $('badge'),
  changed() { syncText(); scheduleHash(); },
  // show a surface in its tidy form: tab 2 with these counts ({ o, star, x, X })
  goTidy(counts) { show('tidy'); tabs.tidy.setAll(counts); },
  // zip a surface up from its pieces: tab 3 with that preset
  goProve(key) { show('prove'); tabs.prove.start(key); },
  // zip one polygon up: tab 3 with the tile of a pattern (tab 5)
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
  if (!tabs[name]) name = 'zip';
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
// how a drag turns the view: the chooser in the corner of the pane (kept between visits where the browser allows)
{
  const sel = $('turning');
  for (const m of MODES) { const o = document.createElement('option'); o.value = m.key; o.textContent = m.label; sel.append(o); }
  sel.value = stage.turning.mode;
  sel.addEventListener('change', () => stage.turning.setMode(sel.value));
  stage.turning.onMode((m) => { sel.value = m; });
}
// "Next" under each tab: the chapter's order
for (const a of document.querySelectorAll('[data-go]')) a.addEventListener('click', (e) => { e.preventDefault(); show(a.dataset.go, a.dataset.k ? { k: a.dataset.k } : undefined); window.scrollTo({ top: 0 }); });
$('view').addEventListener('pointerdown', () => { turnHint.hidden = true; }, { once: true });

// ---- the hash: #<tab>&k=<state>
let hashTimer = 0;
function scheduleHash() { clearTimeout(hashTimer); hashTimer = setTimeout(writeHash, 250); }
function writeHash() {
  const s = current && current.get ? current.get() : {};
  const parts = [currentName];
  for (const [k, v] of Object.entries(s)) if (v !== undefined && v !== null && k !== 't') parts.push(k + '=' + encodeURIComponent(v));
  const h = '#' + parts.join('&');
  try { if (location.hash !== h) history.replaceState(null, '', h); } catch (e) { /* a sandboxed frame may refuse: the page works without */ }
}
function readHash() {
  const parts = location.hash.replace(/^#/, '').split('&').filter(Boolean);
  const name = parts.shift() || 'zip', state = {};
  for (const p of parts) { const i = p.indexOf('='); if (i > 0) state[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1)); }
  return [name, state];
}
window.addEventListener('hashchange', () => { const [name, state] = readHash(); if (name !== currentName) show(name, state); });

if (!stage.R.ok) { const p = document.createElement('p'); p.className = 'r3d-message'; p.textContent = 'The 3D view needs WebGL 2, which this browser does not offer.'; $('pane').append(p); turnHint.hidden = true; }
initBookRefs($('bkpop'));
const [name0, state0] = readHash();
show(name0, state0);
window.__surfaces = { show, tabs, stage, timeline, get tab() { return currentName; } };
