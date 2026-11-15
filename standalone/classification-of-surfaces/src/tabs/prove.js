// tabs/prove.js — tab 3, "Zip it up": the Tidying Lemma (pp. 96-100) by hand. A surface is given as polygons whose
// edges carry zips (same colour = one zipper). Tap an arrow and that pair is zipped; what you hold is tidy again:
// a sphere with holes, handles, crosscaps and cross-handles. When no zip is left, that is the surface's name.
// engine.js does the bookkeeping, view.js the drawing, moves.js the motion of each zip.

import { fromWords, zip, zips, isDone, countsOf, normalForm, copyState } from '../zipper/engine.js';
import { buildScene, nextLooks, polyLook, PALETTE, cssColor, rimKeys, makeNeighbours, fits } from '../zipper/view.js';
import { playZip, dryRun } from '../zipper/moves.js';
import { symbol, M } from '../mathbank.js';
import { describe } from './tidy.js';
import { bookLink } from '../bookref.js';

const PRESETS = [
  { key: 'pillow', label: 'Two triangles', words: ['a b c', 'c- b- a-'] },
  { key: 'square', label: 'A square', words: ['a b a- b-'] },
  { key: 'fig810', label: 'Figure 8.10', html: () => `Fig. 8.10: why ${M('tradeX')}`, words: ['a b a- b'],
    note: () => `One square, two orders. Blue first: a cross-handle ${M('sym:X')}. Start over, orange first: two crosscaps ${M('sym:x')}${M('sym:x')}. The same square, so ${M('tradeX')}.` },
  { key: 'band', label: 'A twisted band', words: ['a b! a c!'] },
  { key: 'punched', label: 'The figure-eight hole', words: ['r p q! s t! r- u!', 'p v! s- w!'], pieces: ['the ring', 'the strap'] },
  { key: 'strange', label: 'The strange surface', words: ['r i f! j g! k h! r- u!', 'l m! n o! p q!', 'i s! l t!', 'j v! n w!', 'k x! p y!'], pieces: ['the ring', 'the middle', 'a band', 'a band', 'a band'] },
  { key: 'deal', label: 'Deal four triangles', words: null },
];

const NAMES = { 'o0*0x0': 'a sphere', 'o1*0x0': 'a torus', 'o0*0x1': 'a projective plane', 'o0*0x2': 'a Klein bottle', 'o0*1x0': 'a disk', 'o0*2x0': 'an annulus', 'o0*1x1': 'a Möbius band', 'o1*2x0': 'a twice-punched torus', 'o0*2x1': 'a punched Möbius band' };
const nameOfCounts = (c) => NAMES[`o${c.o}*${c.star}x${c.x}`] || null;

const FIGS = {
  '8.2': [98, 'Zips on different components of a surface'],
  '8.3': [98, 'Zips on different boundaries of the same surface component'],
  '8.4': [99, 'Zips on same boundary'],
  '8.5': [99, 'Gaping zips on different components form a joined surface with boundary'],
  '8.6': [100, 'Gaping zips with opposite orientations on the same boundary form a cap with boundaries'],
  '8.7': [100, 'Gaping zips with the same orientation on the same boundary form a crosscap with boundaries'],
  '8.8': [100, 'form a crosshandle with a boundary'],
  '8.9': [100, 'form a handle with boundaries'],
};

function dealTriangles(seed) {
  let s = seed >>> 0;
  const rand = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const slots = [...Array(12).keys()].sort(() => rand() - 0.5), labels = new Array(12), letters = 'abcdef';
  for (let k = 0; k < 6; k++) { labels[slots[2 * k]] = letters[k] + (rand() < 0.5 ? '-' : ''); labels[slots[2 * k + 1]] = letters[k] + (rand() < 0.5 ? '-' : ''); }
  return [0, 1, 2, 3].map((p) => labels.slice(3 * p, 3 * p + 3).join(' '));
}

function sayStep(info) {
  const one = info.kind === 'join' ? 'Two pieces become one.'
    : info.kind === 'cap' ? 'One rim, the two arrows opposite ways round it: a cap.'
    : info.kind === 'crosscap' ? `One rim, both arrows the same way round it: a crosscap ${M('sym:x')}.`
    : info.kind === 'handle' ? `Two rims, their arrows opposite ways round: a handle ${M('sym:o')}.`
    : `Two rims, both arrows the same way round: a cross-handle ${M('sym:X')}.`;
  const left = info.newRims.length, star = M('sym:*');
  const two = info.kind === 'join' ? (left ? 'What was left of their two rims is one rim' : 'Their two holes are gone')
    : !info.gaping ? (info.kind === 'cap' ? 'The hole is gone' : 'No hole is left')
    : info.kind === 'cap' ? (left === 2 ? `The two stretches not zipped stay open: two holes, ${star}${star}` : `The stretch not zipped stays open: one hole, ${star}`)
    : info.kind === 'crosscap' ? `The flaps meet with a half twist: that is the crosscap, and what was left of the rim is one hole ${star} beside it`
    : `What was left of the two rims is one hole, ${star}`;
  const [page, words] = FIGS[info.fig];
  return `${one} ${two} (${bookLink(page, words, 'Fig. ' + info.fig)}).`;
}
const SHORT = { join: 'joined', cap: 'cap', crosscap: 'crosscap', handle: 'handle', crosshandle: 'cross-handle' };

export function createProveTab(ctx) {
  const { stage, badge } = ctx;
  const el = { presets: document.getElementById('prove-presets'), zips: document.getElementById('prove-zips'), undo: document.getElementById('prove-undo'), reset: document.getElementById('prove-reset'), log: document.getElementById('prove-log'), cap: document.getElementById('prove-cap'), zk: document.getElementById('prove-zips-k') };
  const canvas = stage.R.canvas;
  let preset = PRESETS[1], seed = 7, words = preset.words;
  let state = null, looks = [], history = [], log = [], colors = new Map(), picks = [], hot = null, busy = null, active = false, lastSay = '';

  const colorOf = (id) => colors.get(id) || [0.4, 0.4, 0.45];

  function start(p = preset, keepSeed = false) {
    stopMove();
    preset = p;
    if (p.key === 'deal') { if (!keepSeed) seed = (seed * 31 + 11) % 9973; words = dealTriangles(seed); } else words = p.words;
    state = fromWords(words);
    looks = state.comps.map(() => polyLook());
    history = []; log = []; lastSay = p.note ? p.note() : '';
    colors = new Map();
    let k = 0;
    for (const c of state.comps) for (const e of c.rims[0]) if (e.s && !colors.has(e.id)) colors.set(e.id, PALETTE[k++ % PALETTE.length]);
    for (const b of el.presets.children) b.setAttribute('aria-pressed', String(b.dataset.key === preset.key));
    render(true);
  }

  function render(reframe = false) {
    const built = buildScene(state, looks, { colorOf, hot: () => hot, n: state.comps.length > 2 ? 30 : 40 });
    picks = built.picks;
    // before the first zip, the pieces of a surface taken from the book carry their names
    const names = preset.pieces && history.length === 0 ? preset.pieces : null;
    // and every arrow carries its zip's letter (the chips at the side carry the same letters): seven colours are too
    // many to tell apart by eye alone
    stage.extraMarkers = () => {
      const out = picks.map((pk) => ({ p: pk.at(), color: colorOf(pk.id), size: 1, alpha: 0, shape: 'dot', label: pk.id }));
      if (names) built.slotList.forEach((sl, i) => out.push({ p: [sl.center[0], sl.center[1] - 1.5 * sl.R, 0], color: [0.5, 0.5, 0.55], size: 1, alpha: 0, shape: 'dot', label: names[i] }));
      return out;
    };
    // polygons lie flat and small: bring the view a little closer while there is no ball
    const flat = looks.every((l) => l.kind === 'poly');
    stage.setScene(built.scene, flat ? { center: built.frame.center, radius: built.frame.radius * 0.8 } : built.frame, reframe);
    panel();
  }

  function panel() {
    const left = [...zips(state).keys()];
    el.zips.textContent = '';
    for (const id of left) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip zipchip'; b.dataset.id = id;
      b.innerHTML = `<i style="background:${cssColor(colorOf(id))}"></i><b>${id}</b>`;
      b.setAttribute('aria-label', 'zip the pair ' + id);
      b.addEventListener('click', () => doZip(id));
      b.addEventListener('pointerenter', () => setHot(id)); b.addEventListener('pointerleave', () => setHot(null));
      b.addEventListener('focus', () => setHot(id)); b.addEventListener('blur', () => setHot(null));
      el.zips.append(b);
    }
    el.zk.hidden = left.length === 0;
    el.undo.disabled = history.length === 0;
    el.log.textContent = '';
    for (const l of log) {
      const li = document.createElement('li');
      li.innerHTML = `<i style="background:${cssColor(l.color)}"></i>${SHORT[l.kind]}${l.kind === 'join' || !l.left ? '' : l.left === 2 ? ', two holes left' : ', a hole left'} <span>(Fig. ${l.fig})</span>`;
      el.log.append(li);
    }
    // the badge: what each piece is now
    // the badge: every ball by its symbol and in words (a bare sphere needs no symbol)
    const line = (c) => { const k = countsOf(c), bare = !(k.o + k.star + k.x + k.X); return `<span class="badge-line">${bare ? '' : `<span class="badge-sym">${symbol(k)}</span>`}<span class="badge-name">${describe(k)}</span></span>`; };
    const balls = state.comps.filter((c, i) => looks[i].kind !== 'poly'), polys = state.comps.length - balls.length;
    badge.innerHTML = balls.length ? balls.map(line).join('') + (polys ? `<span class="badge-name">and ${polys} polygon${polys > 1 ? 's' : ''}</span>` : '') : '';
    let say = lastSay;
    if (isDone(state)) {
      const done = state.comps.map((c) => {
        const raw = countsOf(c), nf = normalForm(raw), name = nameOfCounts(nf), traded = raw.X > 0 || (raw.o > 0 && raw.x > 0), bare = !(raw.o + raw.star + raw.x + raw.X);
        const sym = bare ? '' : `<span class="nb">${symbol(raw)}${traded ? ` ${M('eq')} ${symbol(nf)}` : ''}</span>`;
        return name ? name + (sym ? ', ' + sym : '') : sym;
      });
      say = `${lastSay ? lastSay + ' ' : ''}<b>Nothing left to zip.</b> It is ${done.join(' and ')}.`;
    }
    el.cap.innerHTML = say || 'Tap an arrow: it is zipped to the other arrow of its colour, tail to tail and head to head.';
    ctx.changed();
  }

  function setHot(id) { if (hot === id) return; hot = id; if (!busy) { stage.decorate(); stage.R.render(); } }
  function stopMove() { if (busy) { busy.cancel(); busy = null; } }

  function doZip(id, dry = false) {
    if (!active || !zips(state).has(id)) return -1;
    if (busy) { busy.finish(); }
    const before = state, looksBefore = looks;
    // two rims of one ball are joined by a tube: the two holes have to be neighbours first ("push the holes around")
    const where = zips(before).get(id);
    let looks0 = looksBefore;
    if (where[0].c === where[1].c && where[0].r !== where[1].r && looksBefore[where[0].c].kind === 'ball') {
      looks0 = looksBefore.slice();
      const l = { kind: 'ball', rims: new Map(looksBefore[where[0].c].rims), tubes: looksBefore[where[0].c].tubes.map((t) => ({ ...t })), caps: looksBefore[where[0].c].caps.slice() };
      const comp = before.comps[where[0].c];
      const keys = rimKeys(comp);
      makeNeighbours(l, keys[where[0].r], keys[where[1].r]);
      looks0[where[0].c] = l;
    }
    const { state: after, info } = zip(before, id);
    if (!fits(after.comps[info.to])) { lastSay = 'That makes more holes and handles than this ball has room for. Try another pair first.'; panel(); return; }
    const looksAfter = nextLooks(looks0, before, info, after);
    history.push({ state: copyState(before), looks: looksBefore, log: log.slice(), lastSay });
    const commit = () => {
      busy = null;
      state = after; looks = looksAfter;
      log.push({ kind: info.kind, fig: info.fig, left: info.newRims.length, color: colorOf(id) });
      lastSay = sayStep(info);
      hot = null;
      render();
    };
    hot = null;
    stage.extraMarkers = null;
    if (dry) { const n = dryRun({ stage, before, looks: looks0, after, looksAfter, info, id, colorOf, done: () => {} }); commit(); return n; }
    busy = playZip({ stage, before, looks: looks0, after, looksAfter, info, id, colorOf, done: commit });
    if (!busy) commit();
    return 0;
  }

  function undo() {
    stopMove();
    const h = history.pop();
    if (!h) return;
    state = h.state; looks = h.looks; log = h.log; lastSay = h.lastSay;
    render();
  }

  // tapping an arrow on the stage
  let down = null;
  const nearest = (ev) => {
    const r = canvas.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    let best = null, bd = 34;
    for (const p of picks) { const q = stage.R.project(p.at()); const d = Math.hypot(q[0] - x, q[1] - y) + (q[2] ? 0 : 14); if (d < bd) { bd = d; best = p; } }
    return best;
  };
  canvas.addEventListener('pointerdown', (ev) => { if (active) down = { x: ev.clientX, y: ev.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (ev) => {
    if (!active || !down) return;
    const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y), dt = performance.now() - down.t;
    down = null;
    if (moved > 6 || dt > 600 || busy) return;
    const p = nearest(ev);
    if (p) doZip(p.id);
  });
  canvas.addEventListener('pointermove', (ev) => { if (!active || ev.pointerType !== 'mouse' || ev.buttons) return; const p = busy ? null : nearest(ev); setHot(p ? p.id : null); canvas.style.cursor = p ? 'pointer' : ''; });

  for (const p of PRESETS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.key = p.key; b.setAttribute('aria-pressed', 'false');
    if (p.html) { b.innerHTML = p.html(); b.setAttribute('aria-label', p.label + ': why a cross-handle is two crosscaps'); } else b.textContent = p.label;
    b.addEventListener('click', () => start(p));
    el.presets.append(b);
  }
  el.undo.addEventListener('click', undo);
  el.reset.addEventListener('click', () => start(preset, true));

  return {
    enter() { active = true; stage.R.setView({ az: 0, el: 55, zoom: 1 }); if (!state) start(preset, true); else render(true); },
    leave() { active = false; stopMove(); canvas.style.cursor = ''; hot = null; },
    when() { return 'prove:any'; },
    get() { return { k: preset.key, s: preset.key === 'deal' ? seed : undefined }; },
    set(s) { const p = PRESETS.find((x) => x.key === s.k); if (p) { preset = p; if (s.s) seed = Number(s.s) || seed; state = null; if (active) start(p, true); } },
    start: (key, s) => { if (s !== undefined) seed = s; start(PRESETS.find((x) => x.key === key) || preset, s !== undefined); }, doZip, undo, dry: (id) => doZip(id, true), words: () => words,
    state: () => state, looks: () => looks.map((l) => (l.kind === 'poly' ? 'poly' : { rims: [...l.rims], tubes: l.tubes, caps: l.caps })), picks: () => picks, isBusy: () => !!busy, finish: () => { if (busy) busy.finish(); },
  };
}
