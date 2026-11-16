// tabs/sym.js — tab 5, "Symmetries": a signature, the pattern that has it, and the surface the pattern folds up to.
//
// Three things on the screen say the same thing three ways, and every character of the signature ties them together:
//   the signature   ∗632: tap a character. A chosen digit steps with − and +; the row under the signature adds a
//                   handle, a cone point, a mirror, a corner or a crosscap, or removes the chosen character
//   the pattern     drawn in the geometry it lives in (src/sym/pattern.js): a sphere, the plane or the hyperbolic plane
//   the surface     the pattern's orbifold in the 3D pane (src/sym/surface.js): a tidy surface of tab 2 with cone points
//                   and corners
// Which geometry it is follows from the signature's price (the Magic Theorem): under $2 a sphere, exactly $2 the
// plane, over $2 the hyperbolic plane. ANY signature can be made: one that has no hand-made tile gets the general
// one (src/sym/domains.js canonical), and the few under $2 that no pattern has are shown as such, surface and all.
// Nothing is looked up: the tile is built, folded up on paper (src/sym/orbifold.js) and the signature read off;
// bind() fails loudly if it is not the one shown.

import { analyse, fval, PRICE, frac, fsub } from '../sym/orbifold.js';
import { PRESETS, ALL, parse, textOf, tokensOf, costOf, domainOf, structure, bind, addTo, removeAt, stepAt, tokenAt, toPretty } from '../sym/catalog.js';
import { createPattern, BLUE, RED } from '../sym/pattern.js';
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
  const el = { cells: $('sym-cells'), where: $('sym-where'), minus: $('sym-minus'), plus: $('sym-plus'), prev: $('sym-prev'), next: $('sym-next'), bar: $('sym-bar'), total: $('sym-total'), say: $('sym-say'), presets: $('sym-presets'), zip: $('sym-zip'), tag: $('pat-tag'), hint: $('pat-hint'), reset: $('pat-reset'), none: $('pat-none'), remove: $('sym-remove'), adds: [...document.querySelectorAll('#sym-add [data-add]')] };
  const pattern = createPattern($('pattern'));
  let sig = parse('*632'), model = null, sel = null, built = null, active = false, where = [], note = '';

  const glyph = (k) => (k.t === 'd' ? M('d' + k.v) : M(k.t === 'o' ? 'sym:o' : k.t === '*' ? 'sym:*' : 'sym:x'));
  const isBlue = (i) => { const b = model.binding[i]; return b.t === 'o' || (b.t === 'd' && b.role === 'cone'); };
  const priceOf = (i) => { const b = model.binding[i], k = model.tokens[i]; return b.t === 'o' ? PRICE.o() : b.t === '*' ? PRICE.star() : b.t === 'x' ? PRICE.x() : b.role === 'cone' ? PRICE.cone(k.v) : PRICE.corner(k.v); };
  const kindOf = (i) => { const b = model.binding[i]; return b.t === 'o' ? 'o' : b.t === '*' ? 'star' : b.t === 'x' ? 'x' : b.role; };
  const chosen = () => (sel !== null && model ? model.tokens[sel].ref : null);

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
    stage.extraMarkers = () => {
      const out = [];
      tokens.forEach((k, i) => {
        const w = where[i], a = built.anchors[w.part], on = sel === i, blue = isBlue(i);
        const p = w.corner !== undefined ? a.corners[w.corner]() : a.at();
        const label = k.t === 'd' ? String(k.v) : k.t === '*' ? '∗' : k.t === 'x' ? '×' : '○';
        const dot = k.t === 'd';
        out.push({ p, color: blue ? BLUE : RED, size: dot ? 8 : 1, alpha: dot ? 1 : 0, shape: 'dot', label });
        if (on) out.push({ p, color: blue ? BLUE : RED, size: 26, shape: 'ring' });
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

  // ---- the signature, its price, the line that says where the pattern lives, what can be done to it
  function head() {
    const { tokens, D, cost, chi } = model, kind = D ? D.G.kind : null;
    el.cells.textContent = '';
    tokens.forEach((k, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'symcell ' + (isBlue(i) ? 'is-blue' : 'is-red'); b.dataset.i = String(i);
      b.setAttribute('aria-pressed', String(sel === i));
      b.setAttribute('aria-label', k.t === 'd' ? `${k.v}: ${kindOf(i) === 'cone' ? 'a gyration point' : 'a point where mirrors cross'}` : k.t === '*' ? 'star: a kaleidoscope' : k.t === 'x' ? 'cross: a miracle' : 'ring: a wonder');
      b.title = b.getAttribute('aria-label');
      b.innerHTML = glyph(k);
      b.addEventListener('click', () => select(sel === i ? null : i));
      el.cells.append(b);
    });
    el.cells.setAttribute('aria-label', 'The signature ' + toPretty(tokens) + ': tap a character');
    const money = (f) => `<span class="nb">$${mixed(f)}</span>`;
    el.where.innerHTML = !D ? `<b>No pattern has this signature.</b> It costs ${money(cost)}: under $2, so it would have to live on a sphere.`
      : kind === 'S' ? `<b>On a sphere.</b> It costs ${money(cost)}, which is ${mixed(chi)} short of $2: ${Math.round(2 / fval(chi))} symmetries.`
        : kind === 'E' ? '<b>On the plane.</b> It costs exactly $2.'
          : `<b>On the hyperbolic plane.</b> It costs ${money(cost)}, which is ${mixed(fsub(frac(0), chi))} too much for the plane.`;
    el.tag.textContent = !D ? 'no pattern' : kind === 'S' ? 'the pattern, on a sphere' : kind === 'E' ? 'the pattern, on the plane' : 'the pattern, on the hyperbolic plane';
    el.hint.textContent = kind === 'S' ? 'drag to turn the ball' : 'drag to slide the pattern';
    el.none.hidden = !!D;
    if (!D) el.hint.hidden = true;
    // the stepper (a chosen digit), the adding row, the remove button
    const ref = chosen(), digit = !!(ref && (ref.kind === 'cone' || ref.kind === 'corner'));
    el.minus.disabled = !digit || !stepAt(sig, ref, -1);
    el.plus.disabled = !digit || !stepAt(sig, ref, 1);
    for (const b of el.adds) b.disabled = !addTo(sig, b.dataset.add, ref);
    el.remove.disabled = !ref || !removeAt(sig, ref);
    el.zip.disabled = !D;
    // the price, part by part, on a ruler from $0 to $4 (longer for a dearer signature) with its mark at $2
    const span = Math.max(4, Math.ceil(fval(cost)));
    el.bar.textContent = '';
    tokens.forEach((tk, i) => {
      const f = priceOf(i), s = document.createElement('button');
      s.type = 'button'; s.className = 'cost-seg ' + (isBlue(i) ? 'is-blue' : 'is-red'); s.dataset.i = String(i);
      s.style.width = (fval(f) / span) * 100 + '%';
      s.setAttribute('aria-pressed', String(sel === i));
      s.setAttribute('aria-label', `${toPretty([tk])} costs ${f.n}${f.d > 1 ? '/' + f.d : ''}`);
      s.title = `${toPretty([tk])}: $${f.n}${f.d > 1 ? '/' + f.d : ''}`;
      s.addEventListener('click', () => select(sel === i ? null : i));
      el.bar.append(s);
    });
    el.bar.closest('.symprice').style.setProperty('--two', (2 / span) * 100 + '%');
    el.total.style.left = Math.min(100, (fval(cost) / span) * 100) + '%';
    el.total.innerHTML = `<span>$${mixed(cost)}</span>`;
    el.total.dataset.side = fval(cost) / span > 0.8 ? 'left' : 'right';
    const text = textOf(sig);
    for (const b of el.presets.querySelectorAll('.chip')) b.setAttribute('aria-pressed', String(b.dataset.k === text));
    const i0 = ALL.indexOf(text);
    el.prev.disabled = i0 === 0; el.next.disabled = i0 === ALL.length - 1;
  }

  // what the chosen character stands for, in this signature's own numbers
  function say() {
    const trade = note === 'trade' ? `Beside a crosscap a handle is two crosscaps more: ${M('tradeO')} (<a href="#tidy&amp;k=ox">tab 2</a>). ` : '';
    if (sel === null) { el.say.innerHTML = trade; return; }
    const k = model.tokens[sel], kind = kindOf(sel), f = priceOf(sel), price = `<span class="nb">costs $${mixed(f)}</span>`, g = `<b class="${isBlue(sel) ? 'is-blue' : 'is-red'}">${glyph(k)}</b>`;
    const n = k.v;
    const inPattern = kind === 'cone' ? `The pattern turns by ${TURN[n]} about each blue ${SHAPE[n]}.`
      : kind === 'corner' ? `${WORDS[n][0].toUpperCase() + WORDS[n].slice(1)} mirrors cross at each red ${SHAPE[n]}.`
        : kind === 'star' ? 'The red lines: mirrors.'
          : kind === 'x' ? 'The dashed red line: follow it and the commas come back mirrored, though it is no mirror.'
            : 'The dotted blue paths: two ways to walk off the tile and come back to it, with no turn and no mirror.';
    const onSurface = kind === 'cone' ? 'the tip of a cone' : kind === 'corner' ? 'a corner of the red rim' : kind === 'star' ? 'the red rim of a hole' : kind === 'x' ? 'a crosscap' : 'a handle';
    el.say.innerHTML = `${trade}${g} ${model.D ? inPattern + ' ' : ''}On the surface: ${onSurface}. It ${price}.`;
  }

  function select(i) {
    sel = i; note = '';
    pattern.select(sel);
    head(); say();
    stage.decorate(); stage.R.render();
    ctx.changed();
  }

  /** Show a signature. keep: the character (its ref) that stays or becomes chosen; why: 'trade' when rings became crosses. */
  function load(next, keep = null, why = '') {
    sig = next; note = why;
    const tokens = tokensOf(sig), D = domainOf(sig), A = D ? analyse(D) : null, cost = costOf(sig);
    model = { sig, D, A, tokens, binding: A ? bind(tokens, A) : structure(tokens), cost, chi: fsub(frac(2), cost) };
    const at = keep ? tokenAt(tokens, keep) : -1;
    sel = at >= 0 ? at : null;
    pattern.set(D ? model : null);
    if (D) pattern.select(sel);
    surface(); head(); say();
    ctx.changed();
  }
  const go = (text) => { const s = parse(text); if (s) load(s); return !!s; };

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
  const hop = (d) => { const i = ALL.indexOf(textOf(sig)), j = i < 0 ? 0 : i + d; if (j >= 0 && j < ALL.length) go(ALL[j]); };
  el.prev.addEventListener('click', () => hop(-1));
  el.next.addEventListener('click', () => hop(1));
  const bump = (d) => { const ref = chosen(), s = ref ? stepAt(sig, ref, d) : null; if (s) load(s, ref); return !!s; };
  el.minus.addEventListener('click', () => bump(-1));
  el.plus.addEventListener('click', () => bump(1));
  const add = (kind) => { const r = addTo(sig, kind, chosen()); if (r) load(r.sig, r.ref, r.traded ? 'trade' : ''); return !!r; };
  for (const b of el.adds) b.addEventListener('click', () => add(b.dataset.add));
  const remove = () => { const ref = chosen(), s = ref ? removeAt(sig, ref) : null; if (s) load(s); return !!s; };
  el.remove.addEventListener('click', remove);
  el.zip.addEventListener('click', () => { if (model.A) ctx.goProveWords([model.A.word], toPretty(model.tokens)); });
  el.reset.addEventListener('click', () => pattern.resetView());
  $('pattern').addEventListener('pointerdown', () => { el.hint.hidden = true; }, { once: true });

  return {
    enter() { active = true; load(sig, chosen()); },
    leave() { active = false; },
    when() {
      if (!model) return ['sym:none'];
      const out = [sel === null ? 'sym:none' : 'sym:' + kindOf(sel)];
      if (!model.D) out.push('sym:bad'); else if (sel === null) out.push('symex:' + textOf(sig));
      return out;
    },
    get() { return { k: textOf(sig) }; },
    set(s) { const n = s && s.k ? parse(s.k) : null; if (n) { sig = n; sel = null; if (active) load(n); } },
    // for the tests
    go, select, hop, bump, add, remove, pattern, text: () => textOf(sig), example: () => ({ text: textOf(sig) }), model: () => model, selected: () => sel, built: () => built,
  };
}
