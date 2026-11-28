// schematic.js — the decomposition as a small graph: a dot for every piece, a line for every cut, and the features
// hanging off the pieces as their signature characters. This is where the moves are clicked: a cut that offers a move
// carries a round handle at its middle.
//
//   graphOf(state)                 -> { nodes, edges }     (pure: the tests read it)
//   layoutOf(graph, before, box)   -> { id: [x, y] }       (pure: springs along the lines, every node pushing the
//                                                           others away; `before` keeps what was there where it was)
//   createSchematic(svg, { onHover, onPick })  -> { show(state, cuts, colors), setHover(id) }

import { refs, isCap, cutList } from './decomp.js';

const NS = 'http://www.w3.org/2000/svg';
// what each piece of the diagram is, said when it is pointed at
const WHAT = {
  P: 'A pair of pants: three ends, each a cuff or a cone point',
  M: 'A mirror polygon: its sides are mirrors and arcs between them',
  S: 'Half a pair of pants: a cuff in front of a mirror',
  cap: 'A cap: nothing with a number of its own',
  A: 'An annulus', R: 'A strip between two mirrors',
};

/** The graph of a state: nodes { id, kind: 'piece' | 'leaf', shape, text, tone }, edges { id, a, b, cut, loop }. */
export function graphOf(state) {
  const nodes = [], edges = [];
  const leaf = (id, text, tone, at) => { nodes.push({ id, kind: 'leaf', text, tone }); edges.push({ id: 'l:' + id, a: at, b: id, cut: null }); };
  if (state.mode === 'rigid') {
    nodes.push({ id: 'tile', kind: 'piece', shape: 'P' });
    const sig = state.sig;
    for (let i = 0; i < sig.o; i++) leaf('o' + i, '○', 'ink', 'tile');
    sig.cones.forEach((n, i) => leaf('n' + i, String(n), 'cone', 'tile'));
    sig.stars.forEach((c, i) => leaf('s' + i, '∗' + c.join(''), 'mirror', 'tile'));
    for (let i = 0; i < sig.x; i++) leaf('x' + i, '×', 'mirror', 'tile');
    return { nodes, edges };
  }
  if (state.mode === 'flat') {
    const D = state.D, f = D.family, arc = D.view === 'arc';
    const end = (id, what) => {
      if (what === 'self') return null;
      nodes.push({ id, kind: 'piece', shape: 'cap' });
      if (what === 'fold') { leaf(id + 'a', '2', 'cone', id); leaf(id + 'b', '2', 'cone', id); }
      if (what === 'half') leaf(id + 'a', '2', 'cone', id);
      if (what === 'corners') { leaf(id + 'a', '2', 'mirror', id); leaf(id + 'b', '2', 'mirror', id); }
      if (what === '*') leaf(id + 'a', '∗', 'mirror', id);
      if (what === 'x') leaf(id + 'a', '×', 'mirror', id);
      return id;
    };
    const ends = arc
      ? { '**': ['self', 'self'], '*x': ['self', 'self'], '22*': ['half', 'half'], '*2222': ['corners', 'corners'], '2*22': ['half', 'corners'] }[f]
      : { 2222: ['fold', 'fold'], o: ['self', 'self'], '**': ['*', '*'], '*x': ['*', 'x'], '22*': ['fold', '*'], '22x': ['fold', 'x'], xx: ['x', 'x'] }[f];
    const a = end('e0', ends[0]), b = end('e1', ends[1]);
    if (!a) { nodes.push({ id: 'flat', kind: 'piece', shape: arc ? 'M' : 'P' }); edges.push({ id: 'c0', a: 'flat', b: 'flat', cut: 'c0', loop: true }); if (arc) leaf('m', f === '*x' ? '∗×' : '∗∗', 'mirror', 'flat'); }
    else edges.push({ id: 'c0', a, b, cut: 'c0' });
    return { nodes, edges };
  }
  const D = state.D;
  for (const p of D.pieces) {
    nodes.push({ id: p.id, kind: 'piece', shape: isCap(p) ? 'cap' : p.kind });
    p.ends.forEach((e, k) => { if (e.t === 'cone') leaf(p.id + ':' + k, String(e.n), 'cone', p.id); if (e.t === 'corner') leaf(p.id + ':' + k, String(e.n), 'mirror', p.id); });
  }
  for (const id of cutList(D)) {
    const r = refs(D, id), cut = D.cuts[id];
    if (r.length === 2) edges.push({ id, a: r[0].piece.id, b: r[1].piece.id, cut: id, loop: r[0].piece === r[1].piece });
    else { nodes.push({ id: 'cap:' + id, kind: 'leaf', text: cut.cap === 'x' ? '×' : '∗', tone: 'mirror' }); edges.push({ id, a: r[0].piece.id, b: 'cap:' + id, cut: id }); }
  }
  return { nodes, edges };
}

/**
 * Where the nodes go: springs along the edges, every node pushing the others away, a pull to the middle; then fitted
 * into the box. Nothing random: a node that was not there before starts beside its neighbour.
 */
export function layoutOf(graph, before = {}, box = { w: 320, h: 210, pad: 26 }) {
  const { nodes, edges } = graph, pos = {}, n = nodes.length;
  const nbr = (id) => { const e = edges.find((x) => (x.a === id || x.b === id) && x.a !== x.b && pos[x.a === id ? x.b : x.a]); return e ? (e.a === id ? e.b : e.a) : null; };
  nodes.forEach((nd, i) => { if (before[nd.id]) pos[nd.id] = before[nd.id].slice(); else if (i === 0 && !Object.keys(before).length) pos[nd.id] = [0, 0]; });
  nodes.forEach((nd, i) => {
    if (pos[nd.id]) return;
    const m = nbr(nd.id), a = 2.39996 * (i + 1), r = nd.kind === 'leaf' ? 22 : 38, base = m ? pos[m] : [0, 0];
    pos[nd.id] = [base[0] + r * Math.cos(a), base[1] + r * Math.sin(a)];
  });
  const K = 40, rest = (e) => (nodes.find((x) => x.id === e.b).kind === 'leaf' || nodes.find((x) => x.id === e.a).kind === 'leaf' ? 24 : 46);
  const live = edges.filter((e) => e.a !== e.b);
  for (let it = 0; it < 420; it++) {
    const heat = 9 * (1 - it / 420) + 0.2, f = {};
    for (const nd of nodes) f[nd.id] = [-0.012 * pos[nd.id][0], -0.03 * pos[nd.id][1]];        // a wider box than tall
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = nodes[i].id, b = nodes[j].id;
      let dx = pos[a][0] - pos[b][0], dy = pos[a][1] - pos[b][1], d = Math.hypot(dx, dy);
      if (d < 0.01) { dx = 0.01 * (i - j); dy = 0.013; d = Math.hypot(dx, dy); }
      const q = (K * K) / (d * d) * (nodes[i].kind === 'leaf' && nodes[j].kind === 'leaf' ? 0.55 : 1);
      f[a][0] += (dx / d) * q; f[a][1] += (dy / d) * q; f[b][0] -= (dx / d) * q; f[b][1] -= (dy / d) * q;
    }
    for (const e of live) {
      const dx = pos[e.b][0] - pos[e.a][0], dy = pos[e.b][1] - pos[e.a][1], d = Math.hypot(dx, dy) || 0.01, q = (d - rest(e)) * 0.16;
      f[e.a][0] += (dx / d) * q; f[e.a][1] += (dy / d) * q; f[e.b][0] -= (dx / d) * q; f[e.b][1] -= (dy / d) * q;
    }
    for (const nd of nodes) { const v = f[nd.id], l = Math.hypot(v[0], v[1]) || 1, s = Math.min(heat, l); pos[nd.id][0] += (v[0] / l) * s; pos[nd.id][1] += (v[1] / l) * s; }
  }
  // into the box
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const nd of nodes) { const p = pos[nd.id]; x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const loops = edges.some((e) => e.a === e.b) ? 26 : 0;
  const s = Math.min(1.5, (box.w - 2 * box.pad) / Math.max(1, x1 - x0 + loops), (box.h - 2 * box.pad) / Math.max(1, y1 - y0 + loops));
  const out = {};
  for (const nd of nodes) { const p = pos[nd.id]; out[nd.id] = [box.w / 2 + (p[0] - (x0 + x1) / 2) * s, box.h / 2 + (p[1] - (y0 + y1) / 2) * s]; }
  out.raw = pos;
  return out;
}

/** How tall the diagram's box is (320 wide): chosen when an orbifold is opened and kept through its flips, so nothing below it jumps. */
const heightFor = (graph) => {
  const cuts = graph.edges.filter((e) => e.cut).length, pieces = graph.nodes.filter((n) => n.kind === 'piece').length, leaves = graph.nodes.length - pieces;
  return cuts ? Math.max(110, Math.min(220, 70 + 13 * pieces + 14 * cuts + 6 * leaves)) : 76;
};

/** How tangled a layout is: the number of pairs of lines that cross (lines between the same two nodes count once). */
export function tangle(graph, pos) {
  const segs = [], seen = new Set();
  for (const e of graph.edges) {
    if (e.a === e.b || !pos[e.a] || !pos[e.b]) continue;
    const key = [e.a, e.b].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key); segs.push([e.a, e.b]);
  }
  const side = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  let n = 0;
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const [a, b] = segs[i], [c, d] = segs[j];
    if (a === c || a === d || b === c || b === d) continue;
    const A = pos[a], B = pos[b], C = pos[c], D = pos[d];
    if (side(A, B, C) * side(A, B, D) < 0 && side(C, D, A) * side(C, D, B) < 0) n++;
  }
  return n;
}

export function createSchematic(svg, opts = {}) {
  const W = 320;
  let H = 190;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  let raw = {}, shown = {}, graph = null, cuts = [], colors = {}, sides = {}, hover = null, anim = 0, from = {}, to = {}, t0 = 0;
  const el = (name, attrs = {}, parent = null) => { const e = document.createElementNS(NS, name); for (const k of Object.keys(attrs)) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const calm = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function paint(pos) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (!graph) return;
    const gE = el('g', { class: 'sch-edges' }, svg), gN = el('g', { class: 'sch-nodes' }, svg), gH = el('g', { class: 'sch-handles' }, svg);
    // several cuts between the same two pieces bow apart, far enough for their handles to stand side by side
    const seen = {}, many = {}, keyOf = (e) => [e.a, e.b].sort().join('|');
    for (const e of graph.edges) many[keyOf(e)] = (many[keyOf(e)] || 0) + 1;
    for (const e of graph.edges) {
      const a = pos[e.a], b = pos[e.b];
      if (!a || !b) continue;
      const info = e.cut ? cuts.find((c) => c.id === e.cut) : null, color = e.cut ? colors[e.cut] || '#888' : null, on = e.cut && hover === e.cut;
      const key = keyOf(e), k = (seen[key] = (seen[key] || 0) + 1) - 1;
      let d, mx, my;
      if (e.a === e.b) {
        // a loop leans away from whatever else hangs on its piece
        let ux = 0, uy = 0;
        for (const o of graph.edges) { if (o.a === o.b || (o.a !== e.a && o.b !== e.a)) continue; const q = pos[o.a === e.a ? o.b : o.a]; if (!q) continue; const l = Math.hypot(a[0] - q[0], a[1] - q[1]) || 1; ux += (a[0] - q[0]) / l; uy += (a[1] - q[1]) / l; }
        const ul = Math.hypot(ux, uy);
        if (ul < 1e-6) { ux = 0; uy = -1; } else { ux /= ul; uy /= ul; }
        const r = 13 + 7 * k, px = -uy, py = ux, at = (f, g) => `${a[0] + f * ux + g * px} ${a[1] + f * uy + g * py}`;
        d = `M ${at(4, -5)} C ${at(2.4 * r, -2.2 * r)}, ${at(2.4 * r, 2.2 * r)}, ${at(4, 5)}`; mx = a[0] + 1.8 * r * ux; my = a[1] + 1.8 * r * uy;
      }
      else {
        // the same way round whichever end the edge names first, so that two edges of a pair never bow the same way
        const flip = e.a > e.b ? -1 : 1, dx = (b[0] - a[0]) * flip, dy = (b[1] - a[1]) * flip, l = Math.hypot(dx, dy) || 1, bow = (k - (many[key] - 1) / 2) * 46, cx = (a[0] + b[0]) / 2 - (dy / l) * bow, cy = (a[1] + b[1]) / 2 + (dx / l) * bow;
        d = `M ${a[0]} ${a[1]} Q ${cx} ${cy} ${b[0]} ${b[1]}`; mx = (a[0] + b[0]) / 4 + cx / 2; my = (a[1] + b[1]) / 4 + cy / 2;
      }
      if (!e.cut) { el('path', { d, class: 'sch-twig' }, gE); continue; }
      const g = el('g', { class: 'sch-cut' + (on ? ' on' : '') + (info && info.moves.length ? ' can' : ''), 'data-cut': e.cut }, gE);
      el('path', { d, class: 'sch-under' }, g);
      el('path', { d, class: 'sch-line', stroke: color, 'stroke-dasharray': info && info.type === 'arc' ? '5 4' : 'none' }, g);
      el('path', { d, class: 'sch-hit' }, g);
      const num = cuts.findIndex((c) => c.id === e.cut) + 1;
      const h = el('g', { class: 'sch-handle' + (on ? ' on' : '') + (info && info.moves.length ? ' can' : ''), 'data-cut': e.cut, transform: `translate(${mx} ${my})` }, gH);
      if (info && info.moves.length) {
        h.setAttribute('role', 'button'); h.setAttribute('tabindex', '0');
        h.setAttribute('aria-label', `Cut ${num}: ${info.moves[0].label}`);
        el('circle', { r: 16, class: 'sch-tap' }, h);
        el('circle', { r: 9.5, class: 'sch-knob', stroke: color }, h);
      } else el('circle', { r: 7.5, class: 'sch-tag' }, h);
      const tx = el('text', { class: 'sch-num', y: 3.6 }, h);
      tx.textContent = String(num);
      const title = el('title', {}, h);
      title.textContent = info ? `${num}: ${info.what}` + (info.moves.length ? `. Click: ${info.moves[0].label}.` : '. No move here.') : '';
      for (const target of [g, h]) {
        target.addEventListener('pointerenter', () => opts.onHover && opts.onHover(e.cut));
        target.addEventListener('pointerleave', () => opts.onHover && opts.onHover(null));
        target.addEventListener('click', () => opts.onPick && opts.onPick(e.cut));
      }
      h.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (opts.onPick) opts.onPick(e.cut); } });
    }
    const owner = {};
    for (const e of graph.edges) if (!e.cut) owner[e.b] = e.a;                     // a feature hangs on its piece by a twig
    for (const nd of graph.nodes) {
      const p = pos[nd.id];
      if (!p) continue;
      if (nd.kind === 'leaf') { const t = el('text', { x: p[0], y: p[1] + 4.6, class: 'sch-leaf ' + nd.tone + (/^[∗×○]$/.test(nd.text) ? ' sym' : ''), 'data-owner': owner[nd.id] || '' }, gN); t.textContent = nd.text; continue; }
      let dot;
      if (nd.shape === 'M') dot = el('rect', { x: p[0] - 5.5, y: p[1] - 5.5, width: 11, height: 11, class: 'sch-piece mirror' }, gN);
      else if (nd.shape === 'cap') dot = el('circle', { cx: p[0], cy: p[1], r: 3, class: 'sch-piece cap' }, gN);
      else dot = el('circle', { cx: p[0], cy: p[1], r: 6, class: 'sch-piece' + (nd.shape === 'S' ? ' half' : '') }, gN);
      el('title', {}, dot).textContent = WHAT[nd.shape] || WHAT.P;
    }
  }
  /** The features on the two sides of the cut pointed at: one side in the cut's colour, the other ringed in it (as on the pattern). */
  function tint() {
    const part = hover != null && sides[hover] ? sides[hover].pieces : null, color = hover != null ? colors[hover] : null;
    for (const t of svg.querySelectorAll('.sch-leaf')) {
      const side = part ? part[t.getAttribute('data-owner')] : undefined;
      t.classList.toggle('side-a', side === 0); t.classList.toggle('side-b', side === 1);
      if (side === 0) { t.style.fill = color; t.style.stroke = ''; } else if (side === 1) { t.style.fill = ''; t.style.stroke = color; } else { t.style.fill = ''; t.style.stroke = ''; }
    }
  }
  function step(now) {
    anim = 0;
    const t = Math.min(1, (now - t0) / 260), k = t * t * (3 - 2 * t), pos = {};
    for (const id of Object.keys(to)) { const a = from[id] || to[id], b = to[id]; pos[id] = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; }
    shown = pos;
    paint(pos); tint();
    if (t < 1) anim = requestAnimationFrame(step);
  }
  return {
    show(state, cutInfo, cutColors, { keep = true, parts = {} } = {}) {
      graph = state ? graphOf(state) : null; cuts = cutInfo || []; colors = cutColors || {}; sides = parts || {};
      if (!graph) { raw = {}; shown = {}; paint({}); return; }
      if (!keep) { H = heightFor(graph); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); }
      const box = { w: W, h: H, pad: H < 100 ? 18 : 26 };
      let L = layoutOf(graph, keep ? raw : {}, box);
      // what was there stays where it was, unless that leaves the lines crossing and a fresh drawing does not
      if (keep && tangle(graph, L) > 0) { const anew = layoutOf(graph, {}, box); if (tangle(graph, anew) < tangle(graph, L)) L = anew; }
      raw = L.raw; delete L.raw;
      from = keep ? shown : {}; to = L; t0 = performance.now();
      if (anim) cancelAnimationFrame(anim);
      if (calm || !keep || !Object.keys(from).length) { shown = L; paint(L); tint(); } else anim = requestAnimationFrame(step);
    },
    /** The numbers changed and nothing else: the same picture, with what a cut says about itself brought up to date. */
    refresh(cutInfo) { cuts = cutInfo || cuts; if (!anim) { paint(shown); tint(); } },
    // only the class changes: a repaint would take away the very element the pointer is over
    setHover(id) { if (hover === id) return; hover = id; for (const e of svg.querySelectorAll('[data-cut]')) e.classList.toggle('on', e.getAttribute('data-cut') === id); tint(); },
    state: () => ({ nodes: graph ? graph.nodes.length : 0, edges: graph ? graph.edges.length : 0, hover }),
  };
}
