// custom-ui.js — the text field after the chips: any orbifold, typed.
//
// His ask, Thu 26 Nov 2026, on seeing the first version (a "Custom" chip that opened the Classification page's
// signature bar, with its add row and stepper): "replace custom with a minimal text-field where I can enter
// arbitrary notation, maybe in gray, give a hint that I can enter orbifold stuff in there". So: one quiet field,
// its hint in its placeholder. What is typed is read loosely (custom.js readSignature) and shown as soon as it is a
// signature this page builds; the field then stands for an eighth chip. Until then the panes keep the last
// orbifold shown, and a small note under the field says why, in the signature's own numbers, with the nearest
// signatures that do work one tap away. The note lies over the page (it moves nothing) and is there only while the
// field is being typed in.
//
//   createCustomField({ resolve, show, shown, isCustom, labelOf }) -> { sync, fill, ... }
//     resolve(text)   the family key of a signature the page can show, or null (handles.js normalizeFamilyKey)
//     show(key)       put that family on the page
//     shown()         the key of the family on the page now
//     isCustom(key)   is that family one made here (not one of the page's chips)
//     labelOf(key)    how the page writes it (234∗5)

import { textOf, parse } from '../../2026-11-15-classification-of-surfaces/src/sym/catalog.js';
import { readSignature, whyNot, prettyOf } from './custom.js';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const listOf = (items) => (items.length <= 1 ? items.join('') : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1]);

/** The mirrors, crosscaps and handles of a signature in words: "a mirror and a crosscap", "two handles". */
function cuffWords(sig) {
  const part = (n, one, many) => (n === 1 ? one : n > 1 ? `${WORDS[n] || n} ${many}` : '');
  return listOf([part(sig.o, 'a handle', 'handles'), part(sig.stars.length, 'a mirror', 'mirrors'), part(sig.x, 'a crosscap', 'crosscaps')].filter(Boolean));
}

/** Why the text of the field is not on the page: { kind, html, tries } or null (nothing typed, or it is shown). */
export function noteFor(text) {
  if (!String(text || '').trim()) return null;
  const sig = readSignature(text);
  if (!sig) return { kind: 'bad', tries: [], html: 'Not a signature. A digit 2–9 is a cone point, ∗ a mirror (digits after it are its corners), × a crosscap, o a handle.' };
  const w = whyNot(sig);
  if (!w) return null;
  const name = `<b>${esc(prettyOf(sig))}</b>`, n = WORDS[w.count] || String(w.count);
  const html = w.kind === 'few' ? `${name} has ${n} feature${w.count === 1 ? '' : 's'}${sig.o ? ' (a handle counts as two)' : ''}; a cut runs between two pairs, so it takes four.`
    : w.kind === 'many' ? `${name} has ${n} features; one cut sorts four.`
      : w.kind === 'corners' ? `In ${name} the mirror has ${WORDS[sig.stars.find((c) => c.length > 1).length]} corners; one at most is built here.`
        : `${name} has ${cuffWords(sig)}; one mirror, crosscap or handle at most is built here, beside cone points.`;
  return { kind: w.kind, tries: w.tries, html };
}

export function createCustomField({ resolve, show, shown, isCustom, labelOf }) {
  const field = document.getElementById('custom-in'), pop = document.getElementById('custom-pop'), bar = field.closest('.ctrl-bar');
  let sticky = false;          // the note is up without the keyboard being in the field (a link named a signature the page cannot show)

  const keyOf = () => { const sig = readSignature(field.value); return sig && field.value.trim() ? resolve(textOf(sig)) : null; };
  const focused = () => document.activeElement === field;

  /** The note goes right under the field, inside the row of chips, wherever the row has wrapped the field to. */
  function place() {
    if (pop.hidden) return;
    const b = bar.getBoundingClientRect(), f = field.getBoundingClientRect();
    pop.style.maxWidth = Math.min(b.width, 520) + 'px';
    pop.style.top = f.bottom - b.top + 2 + 'px';
    pop.style.left = '0px';
    pop.style.left = Math.max(0, Math.min(f.left - b.left, b.width - pop.offsetWidth)) + 'px';
  }

  function paint() {
    const key = keyOf();
    field.dataset.on = key && key === shown() && isCustom(key) ? '1' : '0';
    const note = focused() || sticky ? noteFor(field.value) : null;
    if (!note) { pop.hidden = true; pop.textContent = ''; return; }
    const tries = note.tries.length ? ` <span class="tries">Try ${note.tries.map((t) => `<button type="button" class="trylink" data-k="${esc(t)}">${esc(prettyOf(parse(t)))}</button>`).join(' ')}</span>` : '';
    pop.innerHTML = note.html + tries;
    pop.hidden = false;
    place();
  }

  /** Read the field; what it holds goes onto the page as soon as the page can show it. */
  function take() {
    const key = keyOf();
    if (key && key !== shown()) show(key);          // the page's sync() comes back through here
    paint();
  }
  const nope = () => { field.classList.remove('nope'); void field.offsetWidth; field.classList.add('nope'); };

  field.addEventListener('input', () => { sticky = false; take(); });
  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); take(); if (!keyOf()) nope(); }
    else if (e.key === 'Escape') { sticky = false; field.blur(); }
  });
  field.addEventListener('focus', paint);
  field.addEventListener('blur', () => { sticky = false; paint(); });
  // a tap on the field is a tap on an eighth chip: what it holds comes back onto the page
  field.addEventListener('click', take);
  // an offer in the note: it goes into the field and onto the page; the field keeps the keyboard (no blur on the way)
  pop.addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest('.trylink')) e.preventDefault(); });
  pop.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.trylink');
    if (!b) return;
    field.value = prettyOf(parse(b.dataset.k));
    sticky = false;
    field.focus({ preventScroll: true });
    take();
  });
  window.addEventListener('resize', place);

  return {
    /** The page changed (a chip, a link, a moment, a slider): the field follows a custom orbifold it does not hold, and never touches what is being typed. */
    sync() {
      const k = shown();
      if (isCustom(k) && keyOf() !== k && !focused() && (keyOf() || !field.value.trim())) field.value = labelOf(k);
      paint();
    },
    /** A link named a signature: it goes into the field as written, with its note if the page cannot show it. */
    fill(text) {
      field.value = String(text);
      sticky = true;
      take();
    },
    // for the checks
    type(text) { field.value = text; field.dispatchEvent(new Event('input', { bubbles: true })); },
    text: () => field.value,
    on: () => field.dataset.on === '1',
    why: () => { const n = noteFor(field.value); return n ? { kind: n.kind, tries: n.tries } : null; },
    said: () => (pop.hidden ? '' : pop.textContent),
  };
}
