// showcase.js — the Orbifold showcase: the Symmetries tab of the Classification of Surfaces page on its own, as a
// toy (his ask, Tue 17 Nov 2026: "a little showcase just the symmetries tab only ... the goal is interactive toy for
// people learning about Orbifolds, maybe hide the explanation below a tutorial tab ... along with things that can be
// tried, and a separate link to tutorial"). The same tab module (tabs/sym.js), the same stage; this file is the
// small shell round them: two views, the address, the things to try.
//
//   #k=*632        Play, on that signature (#sym&k=*632, a link copied from the full page, works too)
//   #tutorial      the explanation: the "separate link to the tutorial"
//   window.__surfaces   { tabs: { sym }, stage, show(view), view } for the tools and tests
//
// Not here, on purpose: the other four tabs, the example arrows, "zip it up", and the syncing of screens (a toy many
// strangers open at once should not jump about when its owner touches his copy).

import { createStage } from './stage.js';
import { initBookRefs } from './bookref.js';
import { createSymTab } from './tabs/sym.js';
import { shareHash } from './sharehash.js';

const $ = (id) => document.getElementById(id);
const app = $('app');
const stage = createStage($('view'), $('labels'));
let view = 'play';

const ctx = { stage, badge: $('badge'), changed() { syncText(); scheduleHash(); } };
const sym = createSymTab(ctx);

// which notes show: [data-when] by the tab's state (a state may name several at once)
function syncText() {
  const when = new Set([].concat(sym.when()));
  for (const el of document.querySelectorAll('[data-when]')) el.hidden = !when.has(el.dataset.when);
}

function show(next, state) {
  view = next === 'tutorial' ? 'tutorial' : 'play';
  app.dataset.view = view;
  for (const b of document.querySelectorAll('#tabs .tab')) b.setAttribute('aria-selected', String(b.dataset.view === view));
  $('play').hidden = view !== 'play';
  $('tutorial').hidden = view !== 'tutorial';
  if (view === 'play') {
    if (state && state.k !== undefined) sym.set(state);
    sym.enter();                    // the pictures are drawn afresh: their panes were not laid out while hidden
    syncText();
    stage.R.render();
  } else sym.leave();               // typing on the tutorial does not edit the signature
  scheduleHash();
}

// ---- the address
let hashTimer = 0, lastHash = '';
const HOME = '#k=*632';          // what a plain link opens (tabs/sym.js starts on *632): told to the viewer as no fragment at all, so the plain link stays plain
function scheduleHash() { clearTimeout(hashTimer); hashTimer = setTimeout(writeHash, 250); }
function writeHash() {
  const h = view === 'tutorial' ? '#tutorial' : '#k=' + encodeURIComponent(sym.get().k).replace(/%2A/g, '*');
  lastHash = h;
  try { if (location.hash !== h) history.replaceState(null, '', h); } catch (e) { /* a sandboxed frame may refuse: the page works without */ }
  shareHash(h === HOME ? '#' : h);     // on spacesheep: the address bar now reads this view, so the tutorial's link can be copied from it
}
function readHash() {
  const parts = location.hash.replace(/^#/, '').split('&').filter(Boolean), state = {};
  let name = 'play';
  for (const p of parts) {
    const i = p.indexOf('=');
    if (i > 0) { try { state[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1)); } catch (e) { /* a broken escape: ignored */ } } else if (p === 'tutorial') name = 'tutorial';
  }
  return [name, state];
}
window.addEventListener('hashchange', () => { if (location.hash !== lastHash) { const [name, state] = readHash(); show(name, state); if (name === 'tutorial') window.scrollTo({ top: 0 }); } });

// ---- the two views
for (const b of document.querySelectorAll('#tabs .tab')) b.addEventListener('click', () => show(b.dataset.view));
$('tabs').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const next = view === 'play' ? 'tutorial' : 'play';
  document.querySelector(`#tabs .tab[data-view="${next}"]`).focus(); show(next);
});
for (const a of document.querySelectorAll('[data-view-go]')) a.addEventListener('click', (e) => { e.preventDefault(); show(a.dataset.viewGo); window.scrollTo({ top: 0 }); });

// ---- things to try: each sets the toy up and leaves the doing to the reader
for (const b of document.querySelectorAll('[data-try]')) b.addEventListener('click', () => {
  if (view !== 'play') show('play');
  sym.go(b.dataset.try);
  if (b.dataset.sel !== undefined) sym.select(Number(b.dataset.sel));
  const top = $('sym-top'), calm = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  top.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' });
  $('sym-cells').focus({ preventScroll: true });              // so that Delete, the digits and the arrows go to the signature at once
});

$('reset-view').addEventListener('click', () => stage.R.resetView());
$('view').addEventListener('pointerdown', () => { $('turn-hint').hidden = true; }, { once: true });
if (!stage.R.ok) { const p = document.createElement('p'); p.className = 'r3d-message'; p.textContent = 'The 3D view needs WebGL 2, which this browser does not offer.'; $('pane').append(p); $('turn-hint').hidden = true; }
initBookRefs($('bkpop'), { open: false });           // a page for everyone: the words and the book, no link to the scan on his tailnet

const [name0, state0] = readHash();
show(name0, state0);
window.__surfaces = { show, tabs: { sym }, stage, get tab() { return 'sym'; }, get view() { return view; } };
