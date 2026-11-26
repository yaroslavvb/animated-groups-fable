// custom-ui.js — the "Custom" chip's editor: a signature in a bar that is typed into like a line of text.
//
// It is the bar of the Classification of Surfaces page's Symmetries tab (tabs/sym.js there), with that page's own
// rules for a typed character (catalog.js addTo / removeAt / stepAt) and its styles (styles.css .symcells ...):
//   o, 2 .. 9, * and x add a character after the cursor; Delete takes the character before it away (down to an
//   empty bar); the arrows move the cursor; a tap puts the cursor on a character; − and + step a chosen digit.
//   The row beside the bar does the same for a finger.
// What is typed is shown as soon as it is a signature this page builds (custom.js): four features. Until then the
// panes keep the last orbifold shown, and the line under the bar says why, in the signature's own numbers, with
// the nearest signatures that do work one tap away.
//
//   createCustomEditor({ resolve, show, shown, labelOf }) -> { open, close, isOpen, sync, ... }
//     resolve(text)   the family key of a signature the page can show, or null (handles.js normalizeFamilyKey)
//     show(key)       put that family on the page
//     shown()         the key of the family on the page now
//     labelOf(key)    how the page writes it (333∗3)

import { parse, textOf, tokensOf, addTo, removeAt, stepAt, tokenAt, EMPTY } from '../../2026-11-15-classification-of-surfaces/src/sym/catalog.js';
import { whyNot, featuresOf, featureLabel, prettyOf } from './custom.js';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const listOf = (items) => (items.length <= 1 ? items.join('') : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1]);

/** The mirrors, crosscaps and handles of a signature in words: "a mirror and a crosscap", "two handles". */
function cuffWords(sig) {
  const part = (n, one, many) => (n === 1 ? one : n > 1 ? `${WORDS[n] || n} ${many}` : '');
  return listOf([part(sig.o, 'a handle', 'handles'), part(sig.stars.length, 'a mirror', 'mirrors'), part(sig.x, 'a crosscap', 'crosscaps')].filter(Boolean));
}

export function createCustomEditor({ resolve, show, shown, labelOf }) {
  const $ = (id) => document.getElementById(id);
  const el = { chip: $('custom-chip'), panel: $('custom-ed'), cells: $('cu-cells'), minus: $('cu-minus'), plus: $('cu-plus'), remove: $('cu-remove'), say: $('cu-say'), adds: [...document.querySelectorAll('#cu-add [data-add]')] };
  const GLYPH = {};          // the characters as MathJax set them at build time (the template's hidden #cu-glyphs)
  for (const g of document.querySelectorAll('#cu-glyphs [data-g]')) GLYPH[g.dataset.g] = g.innerHTML;
  // sel is the cursor: null = at the end, nothing chosen; i >= 0 = on the i-th character (just after it); -1 = before everything
  let isOpen = false, sig = EMPTY, sel = null;
  let last = null;          // the last signature typed here and shown: what the chip comes back to

  const tokens = () => tokensOf(sig);
  const chosen = () => { const t = tokens(); return sel !== null && sel >= 0 && sel < t.length ? t[sel].ref : null; };
  const cursor = () => (sel === -1 ? 'start' : chosen());                    // where a new character goes in after
  const isBlue = (k) => k.t === 'o' || (k.t === 'd' && k.ref.kind === 'cone');   // what keeps the pattern's sense is blue, what reflects red, as in the book
  const glyph = (k) => GLYPH[k.t === 'd' ? String(k.v) : k.t] || esc(k.t === 'd' ? k.v : k.t === '*' ? '∗' : k.t === 'x' ? '×' : '○');
  const keyOf = () => resolve(textOf(sig));

  // ---- the two lines under the bar: what is shown and the rule, or why what is typed is not shown and what would be
  function say() {
    const w = whyNot(sig), feats = featuresOf(sig).map(featureLabel), name = `<b>${esc(prettyOf(sig))}</b>`;
    if (!w) {
      el.say.dataset.state = 'ok';
      el.say.innerHTML = `<span class="cu-l1">Four features: ${feats.map((f) => `<b>${esc(f)}</b>`).join(' · ')}.</span><span class="cu-l2">Cone points of any order from 2 to 9, with at most one mirror (one corner at most), crosscap or handle.</span>`;
      return;
    }
    const n = WORDS[w.count] || String(w.count);
    const why = w.kind === 'empty' ? 'An empty bar. A cut runs between two pairs of features, so a signature needs four of them.'
      : w.kind === 'few' ? `${name} has ${n} feature${w.count === 1 ? '' : 's'}${sig.o ? ' (a handle counts as two: its two sides)' : ''}. A cut runs between two pairs of features, so it takes four.`
        : w.kind === 'many' ? `${name} has ${n} features. One cut runs between two pairs of them; more than four would take more cuts than this page draws.`
          : w.kind === 'corners' ? `In ${name} the mirror has ${WORDS[sig.stars.find((c) => c.length > 1).length]} corners. This page builds a mirror with one corner at most.`
            : `${name} has ${cuffWords(sig)}. This page builds one mirror, crosscap or handle at most, beside cone points.`;
    const tries = w.tries.length ? `<span class="tries"><span class="tries-k">${w.kind === 'empty' ? 'For example' : 'These work'}:</span>${w.tries.map((t) => `<button type="button" class="chip symchip trychip" data-k="${esc(t)}">${esc(prettyOf(parse(t)))}</button>`).join('')}</span>` : '';
    el.say.dataset.state = 'no';
    el.say.innerHTML = `<span class="cu-l1">${why}</span><span class="cu-l2"><span class="cu-still">Still showing ${esc(labelOf(shown()))}.</span>${tries}</span>`;
  }

  // ---- the bar, its caret, the buttons that can be pressed
  function render() {
    if (!isOpen) return;
    const t = tokens(), focused = el.cells.contains(document.activeElement);
    el.cells.textContent = '';
    const caret = () => { const c = document.createElement('i'); c.className = 'symcaret'; c.setAttribute('aria-hidden', 'true'); return c; };
    if (sel === -1) el.cells.append(caret());
    t.forEach((k, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'symcell ' + (isBlue(k) ? 'is-blue' : 'is-red'); b.dataset.i = String(i); b.tabIndex = -1;
      b.setAttribute('aria-pressed', String(sel === i));
      b.setAttribute('aria-label', k.t === 'd' ? `${k.v}: ${k.ref.kind === 'cone' ? 'a cone point' : 'a corner of the mirror'}` : k.t === '*' ? 'star: a mirror' : k.t === 'x' ? 'cross: a crosscap' : 'ring: a handle');
      b.title = b.getAttribute('aria-label');
      b.innerHTML = glyph(k);
      b.addEventListener('click', () => select(sel === i ? null : i));
      el.cells.append(b);
      if (sel === i) el.cells.append(caret());
    });
    if (!t.length) { const p = document.createElement('span'); p.className = 'symempty'; p.textContent = 'type o 2…9 ∗ x'; el.cells.append(p); }
    if (sel === null) el.cells.append(caret());
    if (focused) el.cells.focus({ preventScroll: true });          // the cells were made anew: the bar itself keeps the keyboard
    el.cells.setAttribute('aria-label', (t.length ? 'The signature ' + prettyOf(sig) : 'The signature is empty') + '. Type o, 2 to 9, * or x to add a character; Delete takes one away; the arrow keys move the cursor.');
    const ref = chosen(), digit = !!(ref && (ref.kind === 'cone' || ref.kind === 'corner'));
    el.minus.disabled = !digit || !stepAt(sig, ref, -1);
    el.plus.disabled = !digit || !stepAt(sig, ref, 1);
    for (const b of el.adds) b.disabled = !addTo(sig, b.dataset.add, cursor());
    el.remove.disabled = !t.length;
    say();
  }

  /** Put the cursor: on a character, at the end (null) or before everything (-1). */
  function select(i) { sel = i; render(); }

  /** Take a signature into the bar and, where the page can show it, onto the page. keep: where the cursor goes (a character's ref, 'start', or null for the end). */
  function load(next, keep = null) {
    sig = next;
    const t = tokens(), at = keep && keep !== 'start' ? tokenAt(t, keep) : -1;
    sel = keep === 'start' ? (t.length ? -1 : null) : at >= 0 ? at : null;
    const key = keyOf();
    if (key) last = textOf(sig);
    if (key && key !== shown()) show(key);          // the page's own sync() comes back here; what follows draws the bar either way
    render();
  }
  const go = (text) => { const s = parse(text); if (s) load(s); return !!s; };
  const nope = () => { el.cells.classList.remove('nope'); void el.cells.offsetWidth; el.cells.classList.add('nope'); return false; };

  // ---- editing: one character in after the cursor; the character before the cursor out; a digit one up or down
  function add(kind, value = 2) {
    const r = addTo(sig, kind, cursor(), value);
    if (!r) return nope();
    load(r.sig, r.ref);
    return true;
  }
  function remove() {
    const t = tokens();
    if (!t.length) return nope();
    const i = sel === null ? t.length - 1 : sel === -1 ? 0 : sel, next = removeAt(sig, t[i].ref);
    const keep = sel === null ? null : sel <= 0 ? 'start' : t[sel - 1].ref;
    load(next, keep);
    return true;
  }
  const bump = (d) => { const ref = chosen(), s = ref ? stepAt(sig, ref, d) : null; if (s) load(s, ref); return !!s; };
  function move(d) {
    const n = tokens().length;
    if (!n) return;
    if (sel === null) { if (d < 0) select(n - 1); return; }                  // at the end with nothing chosen: left takes hold of the last character
    select(Math.max(0, Math.min(n, sel + 1 + d)) - 1);                       // the cursor sits before character sel + 1
  }
  /** A key of the signature's own: true if it was taken. The arrows only in the bar. */
  function key(e, inBar) {
    if (e.metaKey || e.ctrlKey || e.altKey) return false;
    const k = e.key;
    if (k >= '2' && k <= '9' && k.length === 1) return add('digit', Number(k)) || true;
    if (k === 'o' || k === 'O') return add('o') || true;
    if (k === 'x' || k === 'X') return add('x') || true;
    if (k === '*') return add('star') || true;
    if (k === 'Backspace' || k === 'Delete') return remove() || true;
    if (!inBar) return false;
    if (k === 'ArrowLeft') { move(-1); return true; }
    if (k === 'ArrowRight') { move(1); return true; }
    if (k === 'ArrowUp') { bump(1); return true; }
    if (k === 'ArrowDown') { bump(-1); return true; }
    if (k === 'Home') { if (tokens().length) select(-1); return true; }
    if (k === 'End' || k === 'Escape') { select(null); return true; }
    return false;
  }
  // typing works in the editor and wherever nothing else has the keyboard; never in a field that takes text itself,
  // on a slider or on a canvas (the pattern has keys of its own)
  document.addEventListener('keydown', (e) => {
    if (!isOpen || e.defaultPrevented || el.panel.offsetParent === null) return;
    const t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    const inBar = !!(t && t.closest && t.closest('#cu-cells'));
    const mine = inBar || t === el.chip || t === document.body || t === document.documentElement || !!(t && t.closest && t.closest('#custom-ed'));
    if (mine && key(e, inBar)) e.preventDefault();
  });

  el.minus.addEventListener('click', () => bump(-1));
  el.plus.addEventListener('click', () => bump(1));
  for (const b of el.adds) b.addEventListener('click', () => add(b.dataset.add));
  el.remove.addEventListener('click', remove);
  el.cells.addEventListener('click', (e) => { if (e.target === el.cells && sel !== null) select(null); });      // a tap on the bar beside the characters: the cursor to the end
  el.say.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('.trychip'); if (b) { go(b.dataset.k); el.cells.focus({ preventScroll: true }); } });

  function setOpen(on) {
    isOpen = on;
    el.panel.hidden = !on;
    el.chip.setAttribute('aria-pressed', String(on));
    el.chip.setAttribute('aria-expanded', String(on));
  }

  return {
    isOpen: () => isOpen,
    /**
     * Show the editor: on `text` (a signature the page may not be able to show); else, with `recall`, on the last
     * signature typed here, which goes back onto the page (the chip is an eighth orbifold: the one made by hand);
     * else on the orbifold the page shows.
     */
    open({ focus = true, text = null, recall = false } = {}) {
      const was = isOpen, given = text !== null ? parse(text) : recall && !was && last ? parse(last) : null;
      if (text !== null && !given) return false;          // not a signature at all: nothing to open on
      setOpen(true);
      if (given) load(given);
      else if (!was || keyOf() !== shown()) { sig = parse(shown()) || EMPTY; sel = null; render(); }
      else render();
      if (focus) el.cells.focus({ preventScroll: true });
      return true;
    },
    close() { if (isOpen) setOpen(false); },
    /** The page changed under the editor (a chip, a link, a moment): the bar follows, unless it holds something still being typed. */
    sync() {
      if (!isOpen) return;
      const key = keyOf();
      if (key && key !== shown()) { sig = parse(shown()) || EMPTY; sel = null; }
      render();
    },
    // for the checks
    go, add, remove, bump, move, select, key: (k, inBar = true) => key({ key: k }, inBar),
    text: () => textOf(sig), selected: () => sel, why: () => whyNot(sig), said: () => el.say.textContent,
  };
}
