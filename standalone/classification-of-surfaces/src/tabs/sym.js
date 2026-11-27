// tabs/sym.js — the "Symmetries" tab, the first in the bar and the one the page opens on: a signature, the pattern that has it, and the surface the pattern folds up to.
//
// Three things on the screen say the same thing three ways, and every character of the signature ties them together:
//   the signature   ∗632, in a bar that is typed into like a line of text: o, 2 .. 9, * and x add a character after
//                   the cursor, Delete takes the character before it away (down to an empty bar), the arrows move
//                   the cursor. A tap puts the cursor on a character; − and + step a digit. The row under the bar
//                   does the same for a finger
//   the pattern     drawn in the geometry it lives in (src/sym/pattern.js): a sphere, the plane or the hyperbolic
//                   plane, in one of six designs (src/sym/motifs.js)
//   the surface     the pattern's orbifold in the 3D pane (src/sym/surface.js): a tidy surface of the Tidy surfaces tab with cone points
//                   and corners
// Which geometry it is follows from the signature's price (the Magic Theorem): under $2 a sphere, exactly $2 the
// plane, over $2 the hyperbolic plane. ANY signature can be made: one that has no hand-made tile gets the general
// one (src/sym/domains.js canonical), and the few under $2 that no pattern has are shown as such, surface and all.
// Nothing is looked up: the tile is built, folded up on paper (src/sym/orbifold.js) and the signature read off;
// bind() fails loudly if it is not the one shown.

import { analyse, fval, PRICE, frac, fsub } from '../sym/orbifold.js';
import { PRESETS, ALL, parse, textOf, linkOf, tokensOf, costOf, domainOf, structure, bind, addTo, removeAt, stepAt, tokenAt, toPretty, isEmpty, spelled, canon, whyNot } from '../sym/catalog.js';
import { createPattern, BLUE, RED } from '../sym/pattern.js';
import { pairCss } from '../sym/pairs.js';
import { buildSurface } from '../sym/surface.js';
import { M, mixed } from '../mathbank.js';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const TURN = { 2: 'half a turn', 3: 'a third of a turn', 4: 'a quarter of a turn', 5: 'a fifth of a turn', 6: 'a sixth of a turn', 7: 'a seventh of a turn', 8: 'an eighth of a turn', 9: 'a ninth of a turn' };
const SHAPE = { 2: 'lens', 3: 'triangle', 4: 'square', 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon' };
const plural = (k, one, many) => `${WORDS[k] || k} ${k === 1 ? one : many}`;
const NAMES = { '0,1,0': 'a disc', '0,2,0': 'an annulus', '0,0,0': 'a sphere', '1,0,0': 'a torus', '2,0,0': 'a double torus', '0,0,1': 'a projective plane', '0,0,2': 'a Klein bottle', '0,1,1': 'a Möbius band', '0,3,0': 'a pair of pants' };

export function createSymTab(ctx) {
  const { stage, badge } = ctx;
  const $ = (id) => document.getElementById(id);
  const el = { cells: $('sym-cells'), where: $('sym-where'), minus: $('sym-minus'), plus: $('sym-plus'), prev: $('sym-prev'), next: $('sym-next'), bar: $('sym-bar'), total: $('sym-total'), say: $('sym-say'), presets: $('sym-presets'), zip: $('sym-zip'), hint: $('pat-hint'), reset: $('pat-reset'), none: $('pat-none'), remove: $('sym-remove'), adds: [...document.querySelectorAll('#sym-add [data-add]')], same: $('sym-same'), canon: $('sym-canon'), usual: $('sym-usual'), bad: $('sym-bad'), key: $('sym-key'), keyGlue: $('key-glue'), keyPairs: $('key-pairs') };
  const pattern = createPattern($('pattern'), { tip: $('pat-tip') });
  // sel is the cursor: null = at the end, nothing chosen; i >= 0 = on the i-th character (just after it); -1 = before everything
  let sig = parse('*632'), model = null, sel = null, built = null, active = false, where = [], note = '';

  const glyph = (k) => (k.t === 'd' ? M('d' + k.v) : M(k.t === 'o' ? 'sym:o' : k.t === '*' ? 'sym:*' : 'sym:x'));
  const isBlue = (i) => { const b = model.binding[i]; return b.t === 'o' || (b.t === 'd' && b.role === 'cone'); };
  const priceOf = (i) => { const b = model.binding[i], k = model.tokens[i]; return b.t === 'o' ? PRICE.o() : b.t === '*' ? PRICE.star() : b.t === 'x' ? PRICE.x() : b.role === 'cone' ? PRICE.cone(k.v) : PRICE.corner(k.v); };
  const kindOf = (i) => { const b = model.binding[i]; return b.t === 'o' ? 'o' : b.t === '*' ? 'star' : b.t === 'x' ? 'x' : b.role; };
  const on = () => (sel !== null && sel >= 0 && model ? sel : null);                     // the chosen character's index
  const chosen = () => (on() !== null ? model.tokens[sel].ref : null);
  const cursor = () => (sel === -1 ? 'start' : chosen());                                 // where a new character goes in after

  // ---- the surface: the signature's parts on a ball, a plate or a band, each with a label; the chosen one ringed
  function surface() {
    const { tokens, binding } = model, parts = [];
    where = new Array(tokens.length).fill(null);          // token -> { part, corner? }
    tokens.forEach((k, i) => {
      const b = binding[i];
      if (b.t === 'o' || b.t === 'x') { where[i] = { part: parts.length }; parts.push({ t: b.t }); }
      else if (b.t === '*') { where[i] = { part: parts.length }; parts.push({ t: 'star', corners: [], star: b.star }); }
      else if (b.role === 'cone') { where[i] = { part: parts.length }; parts.push({ t: 'cone', n: k.v }); }
      else { const p = parts.findIndex((q) => q.t === 'star' && q.star === b.star); where[i] = { part: p, corner: parts[p].corners.length }; parts[p].corners.push(k.v); }
    });
    built = buildSurface(parts);
    // Each character on the surface: its label in the signature's own colour (blue or red), as in the bar above. A
    // chosen one keeps its strength while the others fade. It used to get a ring round it; his note, Mon 16 Nov 2026:
    // "this large circle selector is confusing, perhaps just use color, same as in the edit box".
    stage.extraMarkers = () => {
      const out = [], one = on();
      tokens.forEach((k, i) => {
        const w = where[i], a = built.anchors[w.part], blue = isBlue(i), faint = one !== null && one !== i;
        const p = w.corner !== undefined ? a.corners[w.corner]() : a.at();
        const label = k.t === 'd' ? String(k.v) : k.t === '*' ? '∗' : k.t === 'x' ? '×' : '○';
        const dot = k.t === 'd';
        out.push({ p, color: blue ? BLUE : RED, size: dot ? (one === i ? 11 : 8) : 1, alpha: dot ? (faint ? 0.3 : 1) : 0, shape: 'dot', label, labelColor: blue ? 'var(--blue)' : 'var(--red)', labelFaint: faint });
      });
      return out;
    };
    stage.R.setView({ ...built.view, zoom: 1 });
    stage.setScene(built.scene, built.frame, true);
    const cones = sig.cones.length, corners = sig.stars.reduce((q, st) => q + st.length, 0), holes = sig.stars.length;
    const known = NAMES[`${sig.o},${holes},${sig.x}`];
    const name = known || `a sphere with ${[sig.o && plural(sig.o, 'handle', 'handles'), holes && plural(holes, 'hole', 'holes'), sig.x && plural(sig.x, 'crosscap', 'crosscaps')].filter(Boolean).join(' and ')}`;
    const extra = [cones && plural(cones, 'cone point', 'cone points'), corners && plural(corners, 'corner', 'corners')].filter(Boolean).join(' and ');
    badge.innerHTML = `<span class="badge-name">${model.D ? 'the orbifold' : 'the surface'}: ${name}${extra ? (known ? ' with ' : ', plus ') + extra : ''}</span>`;
  }

  // ---- the signature in its bar, its price, the line that says where the pattern lives, what can be done to it
  function head() {
    const { tokens, D, cost, chi } = model, kind = D ? D.G.kind : null, empty = !tokens.length;
    const focused = el.cells.contains(document.activeElement);
    el.cells.textContent = '';
    const caret = () => { const c = document.createElement('i'); c.className = 'symcaret'; c.setAttribute('aria-hidden', 'true'); return c; };
    if (sel === -1) el.cells.append(caret());
    tokens.forEach((k, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'symcell ' + (isBlue(i) ? 'is-blue' : 'is-red'); b.dataset.i = String(i); b.tabIndex = -1;
      b.setAttribute('aria-pressed', String(sel === i));
      b.setAttribute('aria-label', k.t === 'd' ? `${k.v}: ${kindOf(i) === 'cone' ? 'a gyration point' : 'a point where mirrors cross'}` : k.t === '*' ? 'star: a kaleidoscope' : k.t === 'x' ? 'cross: a miracle' : 'ring: a wonder');
      b.title = b.getAttribute('aria-label');
      b.innerHTML = glyph(k);
      b.addEventListener('click', () => select(sel === i ? null : i));
      el.cells.append(b);
      if (sel === i) el.cells.append(caret());
    });
    if (empty) { const p = document.createElement('span'); p.className = 'symempty'; p.textContent = 'type o 2…9 ∗ x'; el.cells.append(p); }
    if (sel === null) el.cells.append(caret());
    if (focused) el.cells.focus({ preventScroll: true });          // the cells were made anew: the bar itself keeps the keyboard
    el.cells.setAttribute('aria-label', (empty ? 'The signature is empty' : 'The signature ' + toPretty(tokens)) + '. Type o, 2 to 9, * or x to add a character; Delete takes one away; the arrow keys move the cursor.');
    const money = (f) => `<span class="nb">$${mixed(f)}</span>`;
    el.where.innerHTML = empty ? '<b>On a sphere.</b> An empty signature costs nothing: no symmetry at all, the whole sphere is one tile.'
      : !D ? `<b>No pattern has this signature.</b> It costs ${money(cost)}: under $2, so it would have to live on a sphere.`
        : kind === 'S' ? `<b>On a sphere.</b> It costs ${money(cost)}, which is ${mixed(chi)} short of $2: ${Math.round(2 / fval(chi))} symmetries.`
          : kind === 'E' ? '<b>On the plane.</b> It costs exactly $2.'
            : `<b>On the hyperbolic plane.</b> It costs ${money(cost)}, which is ${mixed(fsub(frac(0), chi))} too much for the plane.`;
    el.hint.textContent = kind === 'S' ? 'drag to turn the ball' : 'drag to slide the pattern';
    el.none.hidden = !!D;
    if (!D) el.hint.hidden = true;
    // the stepper (a chosen digit), the adding row, the delete button
    const ref = chosen(), digit = !!(ref && (ref.kind === 'cone' || ref.kind === 'corner'));
    el.minus.disabled = !digit || !stepAt(sig, ref, -1);
    el.plus.disabled = !digit || !stepAt(sig, ref, 1);
    for (const b of el.adds) b.disabled = !addTo(sig, b.dataset.add, cursor());
    el.remove.disabled = empty;
    if (el.zip) el.zip.disabled = !D || empty;
    // the price, part by part, on a ruler from $0 to $4 (longer for a dearer signature) with its mark at $2
    const span = Math.max(4, Math.ceil(fval(cost)));
    el.bar.textContent = '';
    tokens.forEach((tk, i) => {
      const f = priceOf(i), s = document.createElement('button');
      s.type = 'button'; s.className = 'cost-seg ' + (isBlue(i) ? 'is-blue' : 'is-red'); s.dataset.i = String(i); s.tabIndex = -1;
      s.style.width = (fval(f) / span) * 100 + '%';
      s.setAttribute('aria-pressed', String(sel === i));
      s.setAttribute('aria-label', `${toPretty([tk])} costs ${f.n}${f.d > 1 ? '/' + f.d : ''}`);
      s.title = `${toPretty([tk])}: $${f.n}${f.d > 1 ? '/' + f.d : ''}`;
      s.addEventListener('click', () => select(sel === i ? null : i));
      el.bar.append(s);
    });
    el.bar.closest('.symprice').style.setProperty('--two', (2 / span) * 100 + '%');
    el.bar.closest('.symprice').toggleAttribute('data-far', span > 6);          // a long ruler: no room left of the mark for its label
    el.total.style.left = Math.min(100, (fval(cost) / span) * 100) + '%';
    el.total.innerHTML = `<span>$${mixed(cost)}</span>`;
    el.total.dataset.side = fval(cost) / span > 0.8 ? 'left' : 'right';
    // the key under the two pictures names only what is in them: an outlined tile, glued edges
    el.key.hidden = !D || !D.n;
    const pairs = D ? model.A.pairs.length : 0;          // one swatch a glued pair, in the pair's colour (five at most: then the colours come round again)
    el.keyGlue.hidden = !pairs;
    el.keyPairs.innerHTML = Array.from({ length: Math.min(pairs, 5) }, (_, k) => `<i class="sw sw-pair" style="background:${pairCss(k)}"></i>`).join('');
    // the same signature under another spelling: the book's, one tap away; the examples know it under any spelling
    const text = textOf(sig), name = spelled(sig);
    el.same.hidden = !model.D;                           // a signature no pattern has gets its reason instead (bad())
    el.same.dataset.show = name === text ? '0' : '1';     // side by side its line is kept, empty, so the panes stay put (styles.css)
    if (name !== text) { el.canon.textContent = toPretty(tokensOf(parse(name))); el.canon.dataset.k = name; el.usual.textContent = name === textOf(canon(sig)) ? 'larger numbers first' : 'as the book lists it'; }
    for (const b of el.presets.querySelectorAll('.chip')) b.setAttribute('aria-pressed', String(b.dataset.k === name));
    const i0 = ALL.indexOf(name);
    if (el.prev) { el.prev.disabled = i0 === 0; el.next.disabled = i0 === ALL.length - 1; }
  }

  // a signature no pattern has: why, in its own numbers, and the nearest ones that do have one
  function bad() {
    const w = model.D || isEmpty(sig) ? null : whyNot(sig);
    if (!w) { el.bad.textContent = ''; return; }
    const { m, n } = w, P = (t) => toPretty(tokensOf(parse(t)));
    const R = (d) => `<b class="is-red">${d}</b>`, U = (d) => `<b class="is-blue">${d}</b>`;       // a corner's number is red, a turn's blue, as in the signature
    const why = w.kind === 'corner' ? `After the star, ${R(m)} is a corner where ${WORDS[m]} mirrors cross. On a sphere they cross again at the opposite point, so a mirror never has one corner alone: it takes two alike. Before the star, ${U(m)} is a turn with no mirror through it, and that pattern exists.`
      : w.kind === 'corners' ? `A mirror with two corners is a slice between two mirror lines, and they cross at the same angle at both ends: ${R(m)} and ${R(n)} would have to be equal. A third corner frees them. Before the star a number is a turn, not a corner.`
        : w.kind === 'cone' ? `One gyration point, ${U(m)}, alone. On a sphere a turn about a point is a turn about the opposite point too, so it takes two alike, or a mirror or a miracle to carry one onto the other.`
          : `Two gyration points and nothing else are the two ends of one axis, and an axis turns alike at both ends: ${U(m)} and ${U(n)} would have to be equal. A third point frees them.`;
    el.bad.innerHTML = `<span class="why">${why}</span>${w.tries.length ? `<span class="tries"><span class="tries-k">These have one:</span>${w.tries.map((x) => `<button type="button" class="chip symchip trychip" data-k="${x.text}">${P(x.text)}</button>`).join('')}</span>` : ''}`;
  }

  // what the chosen character stands for, in this signature's own numbers
  function say() {
    const trade = note === 'trade' ? `Beside a crosscap a handle is two crosscaps more: ${M('tradeO')} (<a href="#tidy&amp;k=ox">Tidy surfaces</a>). ` : '';
    if (on() === null) { el.say.innerHTML = trade; return; }
    const k = model.tokens[sel], kind = kindOf(sel), f = priceOf(sel), price = `<span class="nb">costs $${mixed(f)}</span>`, g = `<b class="${isBlue(sel) ? 'is-blue' : 'is-red'}">${glyph(k)}</b>`;
    const n = k.v;
    const inPattern = kind === 'cone' ? `The pattern turns by ${TURN[n]} about each blue ${SHAPE[n]}.`
      : kind === 'corner' ? `${WORDS[n][0].toUpperCase() + WORDS[n].slice(1)} mirrors cross at each red ${SHAPE[n]}.`
        : kind === 'star' ? 'The red lines: mirrors.'
          : kind === 'x' ? 'The dashed red line: follow it and the marks come back mirrored, though it is no mirror.'
            : 'The dotted blue paths: two ways to walk off the tile and come back to it, with no turn and no mirror.';
    const onSurface = kind === 'cone' ? 'the tip of a cone' : kind === 'corner' ? 'a corner of the red rim' : kind === 'star' ? 'the red rim of a hole' : kind === 'x' ? 'a crosscap' : 'a handle';
    el.say.innerHTML = `${trade}${g} ${model.D ? inPattern + ' ' : ''}On the surface: ${onSurface}. It ${price}.`;
  }

  /** Put the cursor: on a character (it lights up in both panes), at the end (null) or before everything (-1). */
  function select(i) {
    sel = i; note = '';
    pattern.select(on());
    head(); say();
    stage.decorate(); stage.R.render();
    ctx.changed();
  }

  /** Show a signature. keep: where the cursor goes (a character's ref, 'start', or null for the end); why: 'trade' when rings became crosses. */
  function load(next, keep = null, why = '') {
    sig = next; note = why;
    const tokens = tokensOf(sig), D = domainOf(sig), A = D ? analyse(D) : null, cost = costOf(sig);
    model = { sig, D, A, tokens, binding: A ? bind(tokens, A) : structure(tokens), cost, chi: fsub(frac(2), cost) };
    const at = keep && keep !== 'start' ? tokenAt(tokens, keep) : -1;
    sel = keep === 'start' ? (tokens.length ? -1 : null) : at >= 0 ? at : null;
    pattern.set(D ? model : null);
    if (D) pattern.select(on());
    surface(); head(); say(); bad();
    ctx.changed();
  }
  const go = (text) => { const s = parse(text); if (s) load(s); return !!s; };
  /** Write the signature its usual way (larger numbers first, or as the book lists it), where it is written another. */
  const usual = () => { const t = spelled(sig); return !!model.D && t !== textOf(sig) && go(t); };
  const nope = () => { el.cells.classList.remove('nope'); void el.cells.offsetWidth; el.cells.classList.add('nope'); return false; };

  // ---- editing: one character in after the cursor; the character before the cursor out; a digit one up or down
  /** kind: 'o' | 'x' | 'star' | 'cone' | 'corner', or 'digit' with its value (what a typed digit means where the cursor is). */
  function add(kind, value = 2) {
    const r = addTo(sig, kind, cursor(), value);
    if (!r) return nope();
    load(r.sig, r.ref, r.traded ? 'trade' : '');
    return true;
  }
  /** Delete: the chosen character goes and the cursor steps back; with nothing chosen, the last one; at the start, the first. */
  function remove() {
    const tokens = model.tokens;
    if (!tokens.length) return nope();
    const i = sel === null ? tokens.length - 1 : sel === -1 ? 0 : sel, next = removeAt(sig, tokens[i].ref);
    const keep = sel === null ? null : sel <= 0 ? 'start' : tokens[sel - 1].ref;
    load(next, keep);
    return true;
  }
  const bump = (d) => { const ref = chosen(), s = ref ? stepAt(sig, ref, d) : null; if (s) load(s, ref); return !!s; };
  /** The cursor one character left or right. */
  function move(d) {
    const n = model.tokens.length;
    if (!n) return;
    if (sel === null) { if (d < 0) select(n - 1); return; }                              // at the end with nothing chosen: left takes hold of the last character
    const at = sel + 1, to = Math.max(0, Math.min(n, at + d));                          // the cursor sits before character `at`
    select(to - 1);
  }
  /** A key of the signature's own: true if it was taken. */
  function key(e, inBar, loose = inBar) {
    if (e.metaKey || e.ctrlKey || e.altKey) return false;
    const k = e.key;
    if (k === 'Enter' && loose) return usual();          // not on a button, where Enter presses it
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
    if (k === 'Home') { if (model.tokens.length) select(-1); return true; }
    if (k === 'End' || k === 'Escape') { select(null); return true; }
    return false;
  }
  // typing works wherever the focus is on this tab, short of a field that takes text itself; the arrows only in the bar
  document.addEventListener('keydown', (e) => {
    if (!active || e.defaultPrevented) return;
    const t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    const inBar = !!(t && t.closest && t.closest('#sym-cells'));
    if (key(e, inBar, inBar || t === document.body || t === document.documentElement)) e.preventDefault();
  });

  // ---- controls
  for (const g of PRESETS) {
    const h = document.createElement('p'); h.className = 'side-k'; h.textContent = g.title; h.id = 'sym-g-' + g.group;
    const row = document.createElement('div'); row.className = 'chips symchips'; row.setAttribute('role', 'group'); row.setAttribute('aria-labelledby', h.id);
    for (const text of g.list) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip symchip'; b.dataset.k = text; b.setAttribute('aria-pressed', 'false');
      b.textContent = toPretty(tokensOf(parse(text)));
      b.addEventListener('click', () => { go(text); document.getElementById('sym-top').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
      row.append(b);
    }
    el.presets.append(h, row);
  }
  const hop = (d) => { const i = ALL.indexOf(spelled(sig)), j = i < 0 ? 0 : i + d; if (j >= 0 && j < ALL.length) go(ALL[j]); };
  el.canon.addEventListener('click', () => usual());
  el.bad.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('.trychip'); if (b) go(b.dataset.k); });
  if (el.prev) { el.prev.addEventListener('click', () => hop(-1)); el.next.addEventListener('click', () => hop(1)); }      // the showcase page has no example arrows
  el.minus.addEventListener('click', () => bump(-1));
  el.plus.addEventListener('click', () => bump(1));
  for (const b of el.adds) b.addEventListener('click', () => add(b.dataset.add));
  el.remove.addEventListener('click', remove);
  el.cells.addEventListener('click', (e) => { if (e.target === el.cells && sel !== null) select(null); });      // a tap on the bar beside the characters: the cursor to the end
  if (el.zip) el.zip.addEventListener('click', () => { if (model.A && model.tokens.length) ctx.goProveWords([model.A.word], toPretty(model.tokens)); });
  el.reset.addEventListener('click', () => pattern.resetView());
  $('pattern').addEventListener('pointerdown', () => { el.hint.hidden = true; }, { once: true });
  return {
    enter() { active = true; load(sig, cursor()); },
    leave() { active = false; },
    when() {
      if (!model) return ['sym:none'];
      const out = [on() === null ? 'sym:none' : 'sym:' + kindOf(sel)];
      if (isEmpty(sig)) out.push('sym:empty'); else if (!model.D) out.push('sym:bad'); else if (on() === null) out.push('symex:' + spelled(sig));
      return out;
    },
    get() { return { k: linkOf(sig) }; },
    /** What the address does not hold and another screen needs to show the same (sync.js): the chosen character, and where the pattern has been slid to. */
    live() {
      const v = pattern.getView();
      return { sel, pv: v ? { V: v.V.map((x) => Math.round(x * 1e7) / 1e7), base: v.base.map((x) => Number(x.toPrecision(10))), turned: v.turned } : null };
    },
    applyLive(l) {
      if (!l || typeof l !== 'object' || !model) return;
      const s = l.sel === null || (Number.isInteger(l.sel) && l.sel >= -1 && l.sel < model.tokens.length) ? l.sel : sel;
      if (s !== sel) select(s);
      if (l.pv) pattern.setView(l.pv);
    },
    set(s) {
      const n = s && s.k !== undefined ? parse(s.k) : null;
      if (n) { sig = n; sel = null; if (active) load(n); }
    },
    // for the tests
    go, usual, select, hop, bump, add, remove, move, key: (k, inBar = true) => key({ key: k }, inBar), pattern, text: () => textOf(sig), example: () => ({ text: textOf(sig) }), model: () => model, selected: () => sel, built: () => built,
  };
}
