// tabs/sym.js — tab 5, "Symmetries": a signature, the pattern that has it, and the surface the pattern folds up to.
//
// Three things on the screen say the same thing three ways, and every character of the signature ties them together:
//   the signature   ∗632: tap a character (a digit can then be changed with − and +)
//   the pattern     drawn in the geometry it lives in (src/sym/pattern.js): a sphere, the plane or the hyperbolic plane
//   the surface     the pattern's orbifold in the 3D pane (src/sym/surface.js): a tidy surface of tab 2 with cone points
//                   and corners
// Which geometry it is follows from the signature's price (the Magic Theorem): under $2 a sphere, exactly $2 the
// plane, over $2 the hyperbolic plane. Nothing is looked up: the tile is built (src/sym/domains.js), folded up on
// paper (src/sym/orbifold.js) and the signature read off; bind() fails loudly if it is not the one shown.

import { analyse, fval, PRICE, frac, fsub } from '../sym/orbifold.js';
import { FAMILIES, PRESETS, ALL, fromText, toPretty, bind, stepParam } from '../sym/catalog.js';
import { createPattern, BLUE, RED } from '../sym/pattern.js';
import { buildSurface } from '../sym/surface.js';
import { M, mixed } from '../mathbank.js';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TURN = { 2: 'half a turn', 3: 'a third of a turn', 4: 'a quarter of a turn', 5: 'a fifth of a turn', 6: 'a sixth of a turn', 7: 'a seventh of a turn', 8: 'an eighth of a turn', 9: 'a ninth of a turn' };
const plural = (k, one, many) => `${WORDS[k] || k} ${k === 1 ? one : many}`;
const NAMES = { '0,1,0': 'a disc', '0,2,0': 'an annulus', '0,0,0': 'a sphere', '1,0,0': 'a torus', '2,0,0': 'a double torus', '0,0,1': 'a projective plane', '0,0,2': 'a Klein bottle', '0,1,1': 'a Möbius band', '0,3,0': 'a pair of pants' };

export function createSymTab(ctx) {
  const { stage, badge } = ctx;
  const $ = (id) => document.getElementById(id);
  const el = { cells: $('sym-cells'), where: $('sym-where'), minus: $('sym-minus'), plus: $('sym-plus'), prev: $('sym-prev'), next: $('sym-next'), bar: $('sym-bar'), total: $('sym-total'), say: $('sym-say'), presets: $('sym-presets'), zip: $('sym-zip'), tag: $('pat-tag'), hint: $('pat-hint'), reset: $('pat-reset') };
  const pattern = createPattern($('pattern'));
  let example = fromText('*632'), model = null, sel = null, built = null, active = false, where = [];

  const glyph = (k) => (k.t === 'd' ? M('d' + k.v) : M(k.t === 'o' ? 'sym:o' : k.t === '*' ? 'sym:*' : 'sym:x'));
  const isBlue = (i) => { const b = model.binding[i]; return b.t === 'o' || (b.t === 'd' && b.role === 'cone'); };
  const priceOf = (i) => { const b = model.binding[i], k = model.tokens[i]; return b.t === 'o' ? PRICE.o() : b.t === '*' ? PRICE.star() : b.t === 'x' ? PRICE.x() : b.role === 'cone' ? PRICE.cone(k.v) : PRICE.corner(k.v); };
  const kindOf = (i) => { const b = model.binding[i]; return b.t === 'o' ? 'o' : b.t === '*' ? 'star' : b.t === 'x' ? 'x' : b.role; };

  // ---- the surface: the signature's parts on a ball, each with a label; the chosen one ringed
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
    const s = model.A.surface, cones = model.A.cones.length, corners = model.A.stars.reduce((q, st) => q + st.corners.length, 0);
    const name = NAMES[`${s.o},${s.star},${s.x}`] || `a sphere with ${[s.o && plural(s.o, 'handle', 'handles'), s.star && plural(s.star, 'hole', 'holes'), s.x && plural(s.x, 'crosscap', 'crosscaps')].filter(Boolean).join(', ')}`;
    const extra = [cones && plural(cones, 'cone point', 'cone points'), corners && plural(corners, 'corner', 'corners')].filter(Boolean).join(' and ');
    badge.innerHTML = `<span class="badge-name">the orbifold: ${name}${extra ? ' with ' + extra : ''}</span>`;
  }

  // ---- the signature, its price, the line that says where the pattern lives
  function head() {
    const { tokens, A, D } = model;
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
    const kind = D.G.kind, cost = A.cost, chi = A.chi, money = (f) => `<span class="nb">$${mixed(f)}</span>`;
    el.where.innerHTML = kind === 'S'
      ? `<b>On a sphere.</b> It costs ${money(cost)}, which is ${mixed(chi)} short of $2: ${Math.round(2 / fval(chi))} symmetries.`
      : kind === 'E' ? '<b>On the plane.</b> It costs exactly $2.'
        : `<b>On the hyperbolic plane.</b> It costs ${money(cost)}, which is ${mixed(fsub(frac(0), chi))} too much for the plane.`;
    el.tag.textContent = kind === 'S' ? 'the pattern, on a sphere' : kind === 'E' ? 'the pattern, on the plane' : 'the pattern, on the hyperbolic plane';
    el.hint.textContent = kind === 'S' ? 'drag to turn the ball' : 'drag to slide the pattern';
    // the stepper: for a chosen digit that the tile can follow
    const k = sel !== null ? tokens[sel] : null, can = !!(k && k.t === 'd' && k.p !== undefined);
    el.minus.disabled = !can || !stepParam(example, k.p, -1);
    el.plus.disabled = !can || !stepParam(example, k.p, 1);
    // the price, part by part, on a ruler from $0 to $4 with its mark at $2
    el.bar.textContent = '';
    tokens.forEach((tk, i) => {
      const f = priceOf(i), s = document.createElement('button');
      s.type = 'button'; s.className = 'cost-seg ' + (isBlue(i) ? 'is-blue' : 'is-red'); s.dataset.i = String(i);
      s.style.width = (fval(f) / 4) * 100 + '%';
      s.setAttribute('aria-pressed', String(sel === i));
      s.setAttribute('aria-label', `${toPretty([tk])} costs ${f.n}${f.d > 1 ? '/' + f.d : ''}`);
      s.title = `${toPretty([tk])}: $${f.n}${f.d > 1 ? '/' + f.d : ''}`;
      s.addEventListener('click', () => select(sel === i ? null : i));
      el.bar.append(s);
    });
    el.total.style.left = Math.min(100, (fval(cost) / 4) * 100) + '%';
    el.total.innerHTML = `<span>$${mixed(cost)}</span>`;
    el.total.dataset.side = fval(cost) > 3 ? 'left' : 'right';
    for (const b of el.presets.querySelectorAll('.chip')) b.setAttribute('aria-pressed', String(b.dataset.k === example.text));
    const i0 = ALL.indexOf(example.text);
    el.prev.disabled = i0 === 0; el.next.disabled = i0 === ALL.length - 1;
  }

  // what the chosen character stands for, in this example's own numbers
  function say() {
    if (sel === null) { el.say.textContent = ''; return; }
    const k = model.tokens[sel], kind = kindOf(sel), f = priceOf(sel), price = `<span class="nb">costs $${mixed(f)}</span>`, g = `<b class="${isBlue(sel) ? 'is-blue' : 'is-red'}">${glyph(k)}</b>`;
    const n = k.v, shape = { 2: 'lens', 3: 'triangle', 4: 'square', 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon' }[n];
    el.say.innerHTML = kind === 'cone' ? `${g} The pattern turns by ${TURN[n]} about each blue ${shape}. On the surface: the tip of a cone. It ${price}.`
      : kind === 'corner' ? `${g} ${WORDS[n][0].toUpperCase() + WORDS[n].slice(1)} mirrors cross at each red ${shape}. On the surface: a corner of the red rim. It ${price}.`
        : kind === 'star' ? `${g} The red lines: mirrors. On the surface: the red rim of a hole. It ${price}.`
          : kind === 'x' ? `${g} The dashed red line: follow it and the commas come back mirrored, though it is no mirror. On the surface: a crosscap. It ${price}.`
            : `${g} The dotted blue paths: two ways to walk off the tile and come back to it, with no turn and no mirror. On the surface: a handle. It ${price}.`;
  }

  function select(i) {
    sel = i;
    pattern.select(sel);
    head(); say();
    stage.decorate(); stage.R.render();
    ctx.changed();
  }

  function load(ex, keep = null) {
    const F = FAMILIES[ex.family], D = F.make(ex.params), A = analyse(D), tokens = F.tokens(ex.params);
    example = ex; model = { D, A, tokens, binding: bind(tokens, A) };
    sel = keep !== null && keep < tokens.length ? keep : null;
    pattern.set(model); pattern.select(sel);
    surface(); head(); say();
    ctx.changed();
  }
  const go = (text) => { const ex = fromText(text); if (ex) load(ex); };

  // ---- controls
  for (const g of PRESETS) {
    const h = document.createElement('p'); h.className = 'side-k'; h.textContent = g.title; h.id = 'sym-g-' + g.group;
    const row = document.createElement('div'); row.className = 'chips symchips'; row.setAttribute('role', 'group'); row.setAttribute('aria-labelledby', h.id);
    for (const text of g.list) {
      const ex = fromText(text), b = document.createElement('button');
      b.type = 'button'; b.className = 'chip symchip'; b.dataset.k = text; b.setAttribute('aria-pressed', 'false');
      b.textContent = toPretty(FAMILIES[ex.family].tokens(ex.params));
      b.addEventListener('click', () => { go(text); document.getElementById('sym-top').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
      row.append(b);
    }
    el.presets.append(h, row);
  }
  const hop = (d) => { const i = ALL.indexOf(example.text), j = i < 0 ? 0 : i + d; if (j >= 0 && j < ALL.length) go(ALL[j]); };
  el.prev.addEventListener('click', () => hop(-1));
  el.next.addEventListener('click', () => hop(1));
  const bump = (d) => { const k = sel !== null ? model.tokens[sel] : null; if (!k || k.p === undefined) return; const ex = stepParam(example, k.p, d); if (ex) load(ex, sel); };
  el.minus.addEventListener('click', () => bump(-1));
  el.plus.addEventListener('click', () => bump(1));
  el.zip.addEventListener('click', () => ctx.goProveWords([model.A.word], toPretty(model.tokens)));
  el.reset.addEventListener('click', () => pattern.resetView());
  $('pattern').addEventListener('pointerdown', () => { el.hint.hidden = true; }, { once: true });

  return {
    enter() { active = true; load(example, sel); },
    leave() { active = false; },
    when() { return sel === null ? ['sym:none', 'symex:' + example.text] : ['sym:' + kindOf(sel)]; },
    get() { return { k: example.text }; },
    set(s) { const ex = s && s.k ? fromText(s.k) : null; if (ex) { example = ex; sel = null; if (active) load(ex); } },
    // for the tests
    go, select, hop, bump, pattern, example: () => example, model: () => model, selected: () => sel, built: () => built,
  };
}
