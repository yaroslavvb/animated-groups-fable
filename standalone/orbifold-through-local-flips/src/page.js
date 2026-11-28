// page.js — the page: an orbifold box (entries to pick from, one quiet field to type in, the ones you typed kept),
// the pattern, the decomposition as a diagram you click to flip, and a Length and a Twist for every cut.
//
// One state (model.js) is on show at a time. Three things change it:
//   a new signature      the view starts over
//   a slider             the same decomposition, another number: what is in the middle of the pane stays put
//   a click on a cut     a flip: another decomposition of the same pattern; nothing on the pane moves
// The address carries the state (#k=...&d=...&p=...), so a link opens it.

import { createView } from './view.js';
import { createSchematic } from './schematic.js';
import { openOrbifold, spell, withParam, withMove, relaid, cutsOf, sidesOf, crowdOf, linkOf, readLink, rangeOf, GEOMETRY, LIMIT } from './model.js';

const $ = (id) => document.getElementById(id);
// the page's own icon, set from here because the one-file build keeps the page free of <link>s; without one a
// browser asks the site for favicon.ico, which it does not have
try {
  const icon = document.createElement('link');
  icon.rel = 'icon';
  icon.href = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#9ad5cc"/><path d="M10 64 Q50 26 90 64" fill="none" stroke="#e69f00" stroke-width="10" stroke-linecap="round"/><circle cx="50" cy="70" r="9" fill="#4fa397"/></svg>');
  document.head.append(icon);
} catch (err) { /* a page without a head to add to still works */ }
// the cuts' colours: clear of the teal ground, the red mirrors and the blue cone points, and readable in the diagram
// on a light page and on a dark one
const PALETTE = ['#E69F00', '#7A5CC7', '#C2409F', '#8C6D1F', '#4660C4', '#5C8A12', '#56B4E9', '#A0522D', '#77778A'];
const KEY = 'orbifold-flips:typed';
const pretty = (t) => String(t).replace(/\*/g, '∗').replace(/x/g, '×');
const plain = (t) => String(t).trim().replace(/[∗＊]/g, '*').replace(/[×✕]/g, 'x').replace(/[○◦∘O0]/g, 'o').replace(/[\s,]+/g, '');
const fmt = (x, d = 2) => (Math.abs(x) < 0.5 * 10 ** -d ? 0 : x).toFixed(d).replace('-', '−');

let cur = null, colors = {}, hover = null, hashTimer = 0, lastHash = '';
// the way back: before every flip, and before every slide of a slider, what was on show and how to return to it
// without the pattern moving ({ state, colors, how: 'flip', back, gone, made } | { ..., how: 'slide', cut })
let past = [], sliding = '';
const keep = (entry) => { past.push({ state: cur, colors: { ...colors }, ...entry }); if (past.length > 200) past.shift(); $('undo').disabled = false; };
const view = createView($('pattern'), { onHover: setHover, onPick: (id) => flip(id) });
const schematic = createSchematic($('schematic'), { onHover: setHover, onPick: (id) => flip(id) });

// what each cut parts: the special points on its two sides (null for a cut that parts none)
const partsOf = (s) => { const out = {}; for (const c of cutsOf(s)) out[c.id] = sidesOf(s, c.id); return out; };
const sceneOf = (s) => {
  const cuts = {}, sides = {}, parts = partsOf(s);
  for (const c of cutsOf(s)) { cuts[c.id] = { color: colors[c.id], type: c.type }; sides[c.id] = parts[c.id] ? parts[c.id].marks : null; }
  return { atlas: s.atlas, shapes: s.shapes, cuts, sides, area: s.atlas.area };
};
function colourCuts(s, fresh) {
  if (fresh) colors = {};
  const used = new Set(Object.values(colors)), ids = cutsOf(s).map((c) => c.id);
  for (const id of Object.keys(colors)) if (!ids.includes(id)) { used.delete(colors[id]); delete colors[id]; }
  for (const id of ids) if (!colors[id]) { const c = PALETTE.find((p) => !used.has(p)) || PALETTE[ids.indexOf(id) % PALETTE.length]; colors[id] = c; used.add(c); }
}
function setHover(id) {
  if (hover === id) return;
  hover = id;
  view.setHover(id); schematic.setHover(id);
  for (const el of $('cuts').children) el.classList.toggle('on', el.dataset.cut === id);
}

// ---- the line that says what the orbifold is
function sayOrbifold(s) {
  const line = $('sig-line');
  line.textContent = '';
  const b = document.createElement('b');
  b.textContent = pretty(s.text) || '1';
  line.append(b, ' · on the ' + GEOMETRY[s.cls.geometry] + ' · ');
  const cuts = cutsOf(s);
  if (!cuts.length) { line.append('rigid: no number of shape, nothing to cut'); return; }
  const L = cuts.length, T = cuts.filter((c) => c.twist).length, n = document.createElement('span');
  n.className = 'n'; n.textContent = String(L + T);
  line.append(n, ` number${L + T === 1 ? '' : 's'} of shape: ${L} length${L === 1 ? '' : 's'}${T ? ` and ${T} twist${T === 1 ? '' : 's'}` : ''}`);
}

// ---- the cuts and their sliders
const STEPS = 1000;
const toSlider = (len, r) => Math.round((STEPS * Math.log(len / r[0])) / Math.log(r[1] / r[0]));
const fromSlider = (v, r) => r[0] * Math.pow(r[1] / r[0], v / STEPS);
function drawCuts() {
  const box = $('cuts'), cuts = cutsOf(cur);
  box.textContent = '';
  if (!cuts.length) {
    const p = document.createElement('p');
    p.className = 'rigid-note';
    p.textContent = cur.mode === 'rigid' ? 'This orbifold is rigid: its pattern has one shape only, so there is no cut to make and no number to move. It is drawn with the tile and the print of Classification of Surfaces.' : '';
    box.append(p);
    return;
  }
  cuts.forEach((c, i) => {
    const el = document.createElement('div');
    el.className = 'cut'; el.dataset.cut = c.id; el.dataset.type = c.type; el.style.setProperty('--c', colors[c.id]);
    const head = document.createElement('div');
    head.className = 'cut-head';
    const sw = document.createElement('span'); sw.className = 'cut-sw';
    const num = document.createElement('span'); num.className = 'cut-n'; num.textContent = String(i + 1);
    const what = document.createElement('span'); what.className = 'cut-what';
    if (c.parts) {
      // the special points it parts, side by side: the first side as the pattern fills it, the other as it rings it
      const a = document.createElement('b'), b = document.createElement('b'), bar = document.createElement('i');
      a.className = 'pt-a'; a.textContent = pretty(c.parts[0]); b.className = 'pt-b'; b.textContent = pretty(c.parts[1]); bar.textContent = ' | ';
      what.append('parts ', a, bar, b);
      what.title = c.what;
    } else what.textContent = c.what;
    head.append(sw, num, what);
    if (c.moves.length) {
      // the moves stay together: beside the name where there is room, under it where there is not
      const moves = document.createElement('span');
      moves.className = 'cut-moves';
      for (const m of c.moves) {
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'cut-flip'; btn.textContent = m.label;
        btn.addEventListener('click', () => flip(c.id, m.kind));
        moves.append(btn);
      }
      head.append(moves);
    }
    el.append(head);
    const row = (key, label, title) => {
      const r = rangeOf(cur, c.id, key), id = `s-${c.id}-${key}`, wrap = document.createElement('div');
      wrap.className = 'cut-row';
      const lab = document.createElement('label'); lab.htmlFor = id; lab.textContent = label; if (title) lab.title = title;
      const input = document.createElement('input');
      input.type = 'range'; input.id = id; input.dataset.key = key;
      if (key === 'len') { input.min = '0'; input.max = String(STEPS); input.step = '1'; input.value = String(toSlider(c.len, r)); }
      else { input.min = '-500'; input.max = '500'; input.step = '1'; input.value = String(Math.round(c.tw * 1000)); }
      const out = document.createElement('output'); out.htmlFor = id;
      out.textContent = key === 'len' ? fmt(c.half ? c.len / 2 : c.len) : fmt(c.tw, 3);
      input.addEventListener('input', () => slide(c.id, key, key === 'len' ? fromSlider(Number(input.value), r) : Number(input.value) / 1000, out));
      input.addEventListener('change', () => { sliding = ''; });
      wrap.append(lab, input, out);
      return wrap;
    };
    el.append(row('len', 'Length', c.half ? 'The length of the crosscap\'s one-sided core: half of the cuff that closes on it' : ''));
    if (c.twist) el.append(row('tw', 'Twist', 'In turns: 1 is once round the cuff'));
    el.addEventListener('pointerenter', () => setHover(c.id));
    el.addEventListener('pointerleave', () => setHover(null));
    el.addEventListener('focusin', () => setHover(c.id));
    el.addEventListener('focusout', () => setHover(null));
    box.append(el);
  });
}
function slide(id, key, value, out) {
  if (sliding !== id + key) { sliding = id + key; keep({ how: 'slide', cut: id, snap: view.snap() }); }       // one step back for one drag of a slider
  const next = withParam(cur, id, key, value);
  const c = cutsOf(next).find((x) => x.id === id);
  cur = next;
  out.textContent = key === 'len' ? fmt(c.half ? c.len / 2 : c.len) : fmt(c.tw, 3);
  if (cur.limited) {
    // the Length has stopped short of where the slider was taken: the slider goes back to it
    const el = document.getElementById(`s-${id}-len`);
    if (el) el.value = String(toSlider(c.len, rangeOf(cur, id, 'len')));
    say(`Length ${cutsOf(cur).findIndex((x) => x.id === id) + 1} stops here: past it the commas, which keep their size, would run into each other.`, 'no');
  } else if ($('say').dataset.kind === 'no') say('', '');
  view.update(sceneOf(cur), { cut: id, fast: true });
  setHover(id);
  noteLink();
}

// ---- a flip
function say(text, kind = '') { const el = $('say'); el.textContent = text; el.dataset.kind = kind; }
function flip(id, kind) {
  if (!cur || cur.mode === 'rigid') return;
  const before = cutsOf(cur), c = before.find((x) => x.id === id), n = before.indexOf(c) + 1;
  if (!c) return;
  if (!c.moves.length) { say(`Cut ${n} (${c.what}) has no move.`, 'no'); return; }
  const mv = c.moves.find((m) => m.kind === kind) || c.moves[0];
  let res;
  try { res = withMove(cur, id, mv.kind); } catch (err) {
    // too long to draw (a refusal), or pieces so long and thin that the arithmetic lost its digits on them
    const lim = err.limit || LIMIT[err.cut] || LIMIT.cuff;
    say(err.refused ? `Cut ${n} not flipped: ${err.message}, and the page draws ${err.cut === 'arc' ? 'arcs' : 'cuffs'} ${err.short ? 'from' : 'up to'} ${fmt(lim, lim % 1 ? 2 : 1)}. ${err.short ? 'Lengthen' : 'Shorten'} the cuts round it first.`
      : `Cut ${n} not flipped: the pieces round it are too long and thin to work out the new cut exactly. Shorten them first.`, 'no');
    return;
  }
  keep({ how: 'flip', back: res.back, gone: res.made, made: res.gone });
  sliding = '';
  cur = res.state;
  colourCuts(cur, false);
  view.replace(sceneOf(cur), res.carry, { gone: res.gone, made: res.made });
  const after = cutsOf(cur);
  drawCuts();
  schematic.show(cur, after, colors, { parts: partsOf(cur) });
  const told = res.made.map((m) => { const x = after.find((y) => y.id === m); return x ? `${after.indexOf(x) + 1}: Length ${fmt(x.half ? x.len / 2 : x.len)}${x.twist ? ', Twist ' + fmt(x.tw, 3) : ''}` : ''; }).filter(Boolean).join('; ');
  const verb = { A: 're-paired', F: 'flipped', S: 'swapped', pop: 'opened', merge: 'closed', slide: 'moved' }[res.info.kind] || 'flipped';
  const skip = res.info.skipped ? ` (the next pairing round would make a cuff ${fmt(res.info.skipped, 1)} long: this is the one after)` : '';
  say(`Cut ${n} ${verb}${skip}. The pattern has not moved. ${told}`, 'ok');
  sayOrbifold(cur);
  noteLink(true);
}

/** One step back: the flip or the slide before, undone; the pattern stays where it is. */
function undo() {
  const was = past.pop();
  $('undo').disabled = !past.length;
  if (!was) return;
  cur = was.state; colors = { ...was.colors }; sliding = '';
  if (was.how === 'print') view.update(sceneOf(cur), {});
  else if (was.how === 'flip') view.replace(sceneOf(cur), was.back, { gone: was.gone, made: was.made });
  else if (was.snap && view.snap().panned === was.snap.panned) view.restore(sceneOf(cur), was.snap);      // exactly as it was, if the pattern has not been slid about since
  else view.update(sceneOf(cur), { cut: was.cut });                                                        // otherwise what is in the middle stays put
  drawCuts();
  schematic.show(cur, cutsOf(cur), colors, { parts: partsOf(cur) });
  sayOrbifold(cur);
  say(was.how === 'flip' ? 'The flip is undone. The pattern has not moved.' : was.how === 'print' ? 'The print is as it was.' : 'The slider is back where it was.', 'ok');
  noteLink(true);
}

// ---- opening an orbifold
function show(state, { fresh = true } = {}) {
  past = []; sliding = ''; $('undo').disabled = true;
  hover = null; schematic.setHover(null);            // another orbifold: no cut of the one before is pointed at any more
  cur = state;
  colourCuts(cur, fresh);
  sayOrbifold(cur);
  drawCuts();
  schematic.show(cur, cutsOf(cur), colors, { keep: false, parts: partsOf(cur) });
  $('pat-sub').textContent = { S: 'the sphere, seen from outside', E: 'the plane', H: 'Poincaré disc' }[cur.cls.geometry];
  $('pat-hint').textContent = cur.cls.geometry === 'S' ? 'Drag to turn' : 'Drag to slide';
  $('cut-sub').textContent = cutsOf(cur).some((c) => c.moves.length) ? 'click a numbered cut to flip it' : cutsOf(cur).length ? 'no move for this cut' : 'nothing to cut';
  $('fresh').disabled = cur.mode === 'rigid';
  view.show(sceneOf(cur));
  say('', '');
  markChips();
  noteLink(true);
}
function tryOpen(text, saved = null, { typed = false } = {}) {
  const t = plain(text);
  if (!t) { popNote(null); return false; }
  const s = openOrbifold(t, saved);
  if (s.mode === 'none') { popNote(s); return false; }
  popNote(null);
  show(s);
  if (typed) remember(s.text);
  return true;
}
function popNote(s) {
  const pop = $('custom-pop');
  if (!s) { pop.hidden = true; pop.textContent = ''; return; }
  pop.textContent = '';
  const w = s.why || {}, b = (t) => { const e = document.createElement('b'); e.textContent = pretty(t); return e; };
  if (w.kind === 'text') pop.append(b(s.text), ' is no signature: write handles o, then cone points 2–9, then each mirror ∗ with its corners, then crosscaps ×.');
  else if (w.kind === 'cone') pop.append('A sphere with one cone point ', b(String(w.m)), ' folds up from no pattern.');
  else if (w.kind === 'cones') pop.append('Two cone points of different orders ', b(String(w.m)), ' and ', b(String(w.n)), ' fold up from no pattern.');
  else if (w.kind === 'corner') pop.append('A mirror with one corner ', b(String(w.m)), ' alone folds up from no pattern.');
  else if (w.kind === 'corners') pop.append('A mirror with two corners of different orders ', b(String(w.m)), ' and ', b(String(w.n)), ' folds up from no pattern.');
  else pop.append(b(s.text), ' has no pattern.');
  if (w.tries && w.tries.length) {
    pop.append(' Nearest that have one:');
    for (const t of w.tries.slice(0, 4)) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'trylink'; btn.textContent = pretty(t.text);
      btn.addEventListener('pointerdown', (e) => e.preventDefault());        // the field keeps the caret: its blur would take this note away before the click
      btn.addEventListener('click', () => { $('custom-in').value = pretty(t.text); tryOpen(t.text, null, { typed: true }); });
      pop.append(btn);
    }
  }
  pop.hidden = false;
}

// ---- the entries: the page's own, and the ones typed here (kept in this browser)
function typedList() { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 10) : []; } catch (err) { return []; } }
function remember(text) {
  if ([...document.querySelectorAll('#presets .chip[data-k]:not([data-typed])')].some((c) => (spell(c.dataset.k) || {}).text === text)) return;
  const list = [text, ...typedList().filter((x) => x !== text)].slice(0, 10);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (err) { /* private window: the row lasts as long as the page */ }
  drawTyped(list);
}
function drawTyped(list = typedList()) {
  const row = $('recent-row');
  for (const c of [...row.querySelectorAll('.chip')]) c.remove();
  for (const t of list) {
    const sp = spell(t);
    if (!sp || sp.mode === 'none') continue;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'chip'; btn.dataset.k = t; btn.dataset.typed = '1'; btn.textContent = pretty(t);
    btn.addEventListener('click', () => tryOpen(t));
    row.append(btn);
  }
  row.hidden = !row.querySelector('.chip');
  markChips();
}
function markChips() {
  let any = false;
  for (const c of document.querySelectorAll('#presets .chip[data-k]')) { const sp = spell(c.dataset.k), on = !!cur && !!sp && sp.text === cur.text; c.setAttribute('aria-pressed', on ? 'true' : 'false'); any = any || on; }
  // on a phone a row of entries is one line that slides: the entry that is on is brought into it
  const lit = document.querySelector('#presets .chip[aria-pressed="true"]'), row = lit && lit.parentElement;
  if (row && row.scrollWidth > row.clientWidth + 2) {
    const lab = row.querySelector('.preset-lab'), left = lit.offsetLeft - (lab ? lab.offsetWidth + 8 : 0), right = lit.offsetLeft + lit.offsetWidth + 40;
    if (left < row.scrollLeft) row.scrollLeft = Math.max(0, left); else if (right > row.scrollLeft + row.clientWidth) row.scrollLeft = right - row.clientWidth;
  }
  // the box always says what is on show; it is lit when no entry says it already
  const input = $('custom-in');
  input.dataset.on = cur && !any ? '1' : '0';
  if (cur && document.activeElement !== input) input.value = pretty(cur.text);
}

// ---- the address
function noteLink(now = false) {
  clearTimeout(hashTimer);
  const write = () => { if (!cur) return; lastHash = '#' + linkOf(cur); try { history.replaceState(null, '', lastHash); } catch (err) { /* a sandboxed frame: the page works without it */ } };
  if (now) write(); else hashTimer = setTimeout(write, 250);
}
function openFromHash() {
  const link = readLink(location.hash);
  return !!link && tryOpen(link.k, link.saved);
}

// ---- wiring
for (const c of document.querySelectorAll('#presets .chip[data-k]')) c.addEventListener('click', () => tryOpen(c.dataset.k));
const input = $('custom-in');
// a click into the box takes the whole signature, so that typing replaces it; a second click places the caret
let boxHadFocus = false;
input.addEventListener('pointerdown', () => { boxHadFocus = document.activeElement === input; });
input.addEventListener('click', () => { if (!boxHadFocus) input.select(); });
input.addEventListener('input', () => { const t = plain(input.value); if (!t) { popNote(null); return; } const sp = spell(t); if (cur && sp && sp.text === cur.text) { popNote(null); return; } tryOpen(input.value, null, { typed: false }); });
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); if (tryOpen(input.value, null, { typed: true })) input.blur(); else { input.classList.remove('nope'); void input.offsetWidth; input.classList.add('nope'); } }
  if (e.key === 'Escape') { input.value = ''; popNote(null); input.blur(); }
});
input.addEventListener('blur', () => { const sp = spell(plain(input.value)); if (cur && sp && sp.text === cur.text) remember(cur.text); popNote(null); markChips(); });
$('reset').addEventListener('click', () => { if (cur) show(openOrbifold(cur.text)); });
$('undo').addEventListener('click', undo);
// the print laid afresh on the pieces as they are: the only thing that changes the commas, and only when asked
$('fresh').addEventListener('click', () => {
  if (!cur || cur.mode === 'rigid') return;
  keep({ how: 'print' }); sliding = '';
  cur = relaid(cur);
  view.update(sceneOf(cur), {});
  say('The print is laid afresh on the pieces as they are now.', 'ok');
});
window.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && document.activeElement !== input && past.length) { e.preventDefault(); undo(); } });
$('reset-view').addEventListener('click', () => view.resetView());
$('cuts-on').addEventListener('change', (e) => { view.setCuts(e.target.checked); for (const el of document.querySelectorAll('#legend [data-with-cuts]')) el.hidden = !e.target.checked; for (const el of document.querySelectorAll('#legend [data-without-cuts]')) el.hidden = e.target.checked; });
$('pattern').addEventListener('pointerdown', () => { $('pat-hint').hidden = true; }, { once: true });
window.addEventListener('hashchange', () => { if (location.hash !== lastHash) openFromHash(); });

drawTyped();
if (!openFromHash()) tryOpen('333*2x');

// for the checks: what is on show, and the levers
window.__flips = {
  state: () => cur, cuts: () => (cur ? cutsOf(cur) : []), view, schematic, colors: () => ({ ...colors }), link: () => (cur ? linkOf(cur) : ''),
  open: (t) => tryOpen(t), flip: (id, kind) => flip(id, kind), undo, past: () => past.length, set: (id, key, value) => { const row = document.getElementById(`s-${id}-${key}`); cur = withParam(cur, id, key, value); view.update(sceneOf(cur), { cut: id }); drawCuts(); schematic.refresh(cutsOf(cur)); noteLink(true); return !!row; },
  hover: (id) => setHover(id), crowd: () => (cur ? crowdOf(cur) : 0), showCuts: (on) => { $('cuts-on').checked = !!on; $('cuts-on').dispatchEvent(new Event('change')); },
};
