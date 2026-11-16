// motifs.js — what is printed on a tile. Six designs, named as The Folding's selector names its prints (his ask,
// Sun 15 Nov 2026: "give me a chooser to choose between patterns, maybe reuse the patterns from ... the-folding").
//
// The Folding's own prints are fitted by hand and by search to each of the 17 plane groups (its src/patterns/: a
// table of knobs per group), so they cannot be carried to a sphere, a hyperbolic tiling or a signature typed a
// moment ago. What is taken from it: the six ideas and their names, the unit comma itself (its motif.js
// commaOutline, copied below) and the paper's two tones a side (its palette.js PRINT_FRONT / PRINT_BACK). Here every
// design is drawn on ONE tile, from nothing but that tile's corners, and every symmetry carries it to the others:
//
//   paisley   a family of commas: a big one in the middle of each cell, a smaller one in every corner that has room
//   soft      one fat soft comma with an eye
//   tomoe     the tile split in two by an S: a dark comma and a light comma, each with an eye; the dark tail runs
//             into the tile's farthest corner
//   checker   a print that covers the tile: triangles from a hub to the tile's corners and the middles of its sides,
//             every other one dark
//   rings     bands: the tile's own outline, shrunk again and again toward a point
//   comma     The Folding's comma, one a cell
//
// No design has a symmetry of its own (the commas have a hand; the hub, the point the rings shrink to and the S sit
// off the middle), so the pattern has the tile's signature and no larger one. A tile made of two mirror halves
// (domains.js half) has two cells, and the second gets the same hand at another size and turn: a mirror image would
// add the very mirror the signature leaves out.
//
//   design(D, key) -> { dark: [shape], light: [shape], evenodd }
//     shape   { pts: [point of the geometry, ...], min, convex, curve }   a closed outline; min: the tile must be this
//             many pixels across its room before the shape is worth drawing; convex: it may be cut exactly at a
//             ball's rim; curve: it is a sampled curve, so a small tile may draw every second point of it
//     dark    drawn in the paper's dark tone (even-odd for the rings), light: drawn over it in the light tone (eyes)

import { apply, inv } from './geom.js';

export const PATTERNS = [
  { key: 'paisley', label: 'Paisley' }, { key: 'soft', label: 'Soft commas' }, { key: 'tomoe', label: 'Tomoe' },
  { key: 'checker', label: 'Checkerboard' }, { key: 'rings', label: 'Rings' }, { key: 'comma', label: 'Comma' },
];
export const DEFAULT_PATTERN = 'paisley';
export const isPattern = (key) => PATTERNS.some((p) => p.key === key);

const TAU = 2 * Math.PI;

/** The Folding's unit comma (src/motif.js commaOutline): half a disc's worth, a round head and a horn of a tail. */
function foldingComma(head = 0.5, nBack = 44, nHollow = 24, nHead = 24) {
  const a = 1 - head, b = head, pts = [];
  for (let i = 0; i < nBack; i++) { const f = -Math.PI / 2 + (Math.PI * i) / nBack; pts.push([Math.cos(f), Math.sin(f)]); }           // the back: half the unit circle, up to the tail's tip (0, 1)
  for (let i = 0; i < nHollow; i++) { const f = (Math.PI * i) / nHollow; pts.push([a * Math.sin(f), 1 - a + a * Math.cos(f)]); }       // the hollow
  for (let i = 0; i < nHead; i++) { const f = (Math.PI * i) / nHead; pts.push([-b * Math.sin(f), -1 + b + b * Math.cos(f)]); }         // the head
  return pts;
}

/**
 * A comma drawn as a stroke: a round head, then a tail that tapers along an arc. turn: how far the arc turns
 * (radians); fat: the head's half width over the arc's radius; taper: the tail's width is fat (1 - keep t)^taper;
 * keep < 1 leaves a blunt round end. Returned fitted into the unit disc: { pts, head: [x, y], headR, tip: angle }.
 */
function strokeComma({ turn, fat, taper = 1, keep = 1, n = 32 }) {
  const w = (t) => fat * Math.pow(1 - keep * t, taper), out = [], inn = [];
  for (let i = 0; i <= n; i++) { const t = i / n, a = turn * t; out.push([(1 + w(t)) * Math.cos(a), (1 + w(t)) * Math.sin(a)]); inn.push([(1 - w(t)) * Math.cos(a), (1 - w(t)) * Math.sin(a)]); }
  const pts = out.slice();
  if (keep < 1) { const we = w(1), c = [Math.cos(turn), Math.sin(turn)], t = [-Math.sin(turn), Math.cos(turn)]; for (let i = 1; i < 6; i++) { const b = (Math.PI * i) / 6; pts.push([c[0] + we * (Math.cos(b) * c[0] + Math.sin(b) * t[0]), c[1] + we * (Math.cos(b) * c[1] + Math.sin(b) * t[1])]); } }
  pts.push(...inn.reverse());
  for (let i = 1; i < 14; i++) { const b = Math.PI + (Math.PI * i) / 14; pts.push([1 + fat * Math.cos(b), fat * Math.sin(b)]); }   // the head's round back, behind the start: from the inner side round to the outer
  // fit into the unit disc: about the middle of its bounding box
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let far = 0;
  for (const p of pts) far = Math.max(far, Math.hypot(p[0] - cx, p[1] - cy));
  const fit = (p) => [(p[0] - cx) / far, (p[1] - cy) / far], tip = fit([Math.cos(turn), Math.sin(turn)]);
  return { pts: pts.map(fit), head: fit([1, 0]), headR: fat / far, tip: Math.atan2(tip[1], tip[0]) };
}
const BIG = strokeComma({ turn: 3.25, fat: 0.6, taper: 0.9 });            // paisley's big comma: curled half way round
const SMALL = strokeComma({ turn: 1.5, fat: 0.42, taper: 0.8, n: 16 });   // and the one for a corner: nearly straight, stout
const SOFT = strokeComma({ turn: 2.5, fat: 0.7, taper: 1, keep: 0.72 });  // a fat comma with a blunt round tail
const UNIT = foldingComma();

export function design(D, key) {
  const G = D.G, n = D.n, out = { dark: [], light: [], evenodd: false };
  const step = G.kind === 'S' ? 0.1 : G.kind === 'H' ? 0.22 : Infinity;
  /** The chart about c: to(x, y) is the point at distance hypot(x, y) from c in that direction; from() undoes it. */
  const chart = (c) => {
    const T = G.translate(G.origin, c), Ti = inv(T);
    return {
      to: (x, y) => apply(T, G.polar(Math.hypot(x, y), Math.atan2(y, x))),
      from: (p) => { const q = apply(Ti, p), r = G.dist(G.origin, G.norm(q)), a = Math.atan2(q[1], q[0]); return [r * Math.cos(a), r * Math.sin(a)]; },
    };
  };
  /** The straight line from a to b, sampled (b itself left out). */
  const seg = (a, b, pts) => { const k = Math.max(1, Math.ceil(G.dist(a, b) / step)); for (let i = 0; i < k; i++) pts.push(i ? G.mix(a, b, i / k) : a); };
  const rim = (verts) => { const pts = []; verts.forEach((v, i) => seg(v, verts[(i + 1) % verts.length], pts)); return pts; };
  const placed = (ch, unit, size, turn) => { const c = Math.cos(turn), s = Math.sin(turn); return unit.map(([x, y]) => ch.to(size * (x * c - y * s), size * (x * s + y * c))); };
  const disc = (ch, x, y, r, k = 14) => { const pts = []; for (let i = 0; i < k; i++) { const a = (TAU * i) / k; pts.push(ch.to(x + r * Math.cos(a), y + r * Math.sin(a))); } return pts; };
  // the cells: the tile, or its two halves; each with its middle and the room there
  const cells = (D.cells || [{ verts: D.verts, at: D.at }]).map((c) => ({ ...c, room: c.verts.length ? Math.min(...c.verts.map((v, i) => G.lineDist(c.at, v, c.verts[(i + 1) % c.verts.length]))) : 0.8, ch: chart(c.at) }));
  const whole = { at: D.at, room: n ? D.clear : 0.8, ch: chart(D.at) };

  const commas = (unit, sizes, turns) => { for (const c of cells) out.dark.push({ pts: placed(c.ch, unit, (c.twin ? sizes[1] : sizes[0]) * c.room, c.twin ? turns[1] : turns[0]), min: 2.4, curve: true }); };

  if (key === 'comma' || (!n && (key === 'checker' || key === 'rings'))) commas(UNIT, [0.88, 0.64], [-0.33, 2.2]);
  else if (key === 'soft') {
    for (const c of cells) {
      const size = (c.twin ? 0.7 : 0.94) * c.room, turn = c.twin ? 2.7 : 0.5, cs = Math.cos(turn), sn = Math.sin(turn);
      out.dark.push({ pts: placed(c.ch, SOFT.pts, size, turn), min: 2.4, curve: true });
      const hx = size * (SOFT.head[0] * cs - SOFT.head[1] * sn), hy = size * (SOFT.head[0] * sn + SOFT.head[1] * cs);
      out.light.push({ pts: disc(c.ch, hx, hy, 0.36 * SOFT.headR * size), min: 16 });
    }
  } else if (key === 'paisley') {
    for (const c of cells) {
      const big = (c.twin ? 0.76 : 0.93) * c.room;
      out.dark.push({ pts: placed(c.ch, BIG.pts, big, c.twin ? 2.0 : -0.6), min: 2.4, curve: true });
      const m = c.verts.length;
      for (let i = 0; i < m; i++) {
        // the largest disc in the corner at v that keeps off the big comma's room: its middle lies on the line from the cell's middle to v
        const v = c.verts[i], a = c.verts[(i + m - 1) % m], b = c.verts[(i + 1) % m];
        if (G.angle(v, a, b) > 2.3) continue;                    // a flat corner is no corner
        const at = (t) => { const p = G.mix(c.at, v, t); return { p, room: Math.min(G.lineDist(p, a, v), G.lineDist(p, v, b)), gap: G.dist(c.at, p) - 0.97 * c.room }; };
        let lo = 0, hi = 1;
        for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2, q = at(mid); if (q.room > q.gap) lo = mid; else hi = mid; }
        const q = at((lo + hi) / 2), r = 0.9 * Math.min(q.room, q.gap);
        if (!(r > 0.24 * c.room)) continue;
        // drawn in the chart about its own middle (a true disc of radius r there), its tip toward the corner
        const cq = chart(q.p), [vx, vy] = cq.from(v);
        out.dark.push({ pts: placed(cq, SMALL.pts, r, Math.atan2(vy, vx) - SMALL.tip + (c.twin ? 0.9 : 0)), min: 11, curve: true });
      }
    }
  } else if (key === 'tomoe') {
    const R = 0.9 * whole.room, ch = whole.ch;
    if (!n) {
      // no tile to split: the old sign itself, in a disc
      out.dark.push({ pts: placed(ch, UNIT, R, -0.33), min: 2.4, curve: true });
      const cs = Math.cos(-0.33), sn = Math.sin(-0.33);
      out.light.push({ pts: disc(ch, 0.5 * R * sn, -0.5 * R * cs, 0.15 * R), min: 14 });
      out.dark.push({ pts: disc(ch, -0.5 * R * sn, 0.5 * R * cs, 0.15 * R), min: 14 });
    } else {
      // the line from the farthest corner through the middle; e1 points at that corner, the dark side is on its left
      let far = 0, fd = -1;
      D.verts.forEach((v, i) => { const d = G.dist(D.at, v); if (d > fd) { fd = d; far = i; } });
      const [fx, fy] = ch.from(D.verts[far]), phi = Math.atan2(fy, fx), c1 = Math.cos(phi), s1 = Math.sin(phi);
      const loc = (x, y) => ch.to(x * c1 - y * s1, x * s1 + y * c1);
      const side = (p) => { const [x, y] = ch.from(p); return c1 * y - s1 * x; }, along = (p) => { const [x, y] = ch.from(p); return c1 * x + s1 * y; };
      let hit = null;
      for (let k = 1; k < n - 1 && !hit; k++) {
        const j = (far + k) % n, a = D.verts[j], b = D.verts[(j + 1) % n], sa = side(a), sb = side(b);
        if (sa * sb > 0) continue;
        let lo = 0, hi = 1;
        for (let q = 0; q < 50; q++) { const mid = (lo + hi) / 2; if (side(G.mix(a, b, mid)) * sa > 0) lo = mid; else hi = mid; }
        const p = G.mix(a, b, (lo + hi) / 2);
        if (along(p) < 0) hit = { j, p };                        // the crossing beyond the middle, not the corner's own side
      }
      if (hit) {
        const pts = [];
        for (let k = 0; ; k++) { const j = (far + k) % n; if (j === hit.j) { seg(D.verts[j], hit.p, pts); break; } seg(D.verts[j], D.verts[(j + 1) % n], pts); }
        // back along the line: from the rim to the S, round the dark head (it bulges into the light side), round the light head, on to the corner
        const L2 = G.dist(D.at, hit.p), k1 = Math.max(1, Math.ceil((L2 - R) / (step === Infinity ? 1e9 : step)));
        for (let i = 0; i < k1; i++) pts.push(loc(-L2 + ((L2 - R) * i) / k1, 0));
        for (let i = 0; i < 12; i++) { const a = Math.PI + (Math.PI * i) / 12; pts.push(loc(-R / 2 + (R / 2) * Math.cos(a), (R / 2) * Math.sin(a))); }
        for (let i = 0; i < 12; i++) { const a = Math.PI - (Math.PI * i) / 12; pts.push(loc(R / 2 + (R / 2) * Math.cos(a), (R / 2) * Math.sin(a))); }
        const k2 = Math.max(1, Math.ceil((fd - R) / (step === Infinity ? 1e9 : step)));
        for (let i = 0; i < k2; i++) pts.push(loc(R + ((fd - R) * i) / k2, 0));
        out.dark.push({ pts, min: 0 });
        out.light.push({ pts: disc(ch, -(R / 2) * c1, -(R / 2) * s1, 0.15 * R), min: 14 });
        out.dark.push({ pts: disc(ch, (R / 2) * c1, (R / 2) * s1, 0.15 * R), min: 14 });
      } else commas(UNIT, [0.88, 0.64], [-0.33, 2.2]);
    }
  } else if (key === 'checker') {
    const hub = whole.ch.to(0.3 * whole.room * Math.cos(1.1), 0.3 * whole.room * Math.sin(1.1));
    for (let j = 0; j < n; j++) {
      const v = D.verts[j], mid = G.mix(v, D.verts[(j + 1) % n], 0.5), pts = [];
      seg(hub, v, pts); seg(v, mid, pts); seg(mid, hub, pts);
      out.dark.push({ pts, min: 0, convex: true });
    }
  } else if (key === 'rings') {
    const q = whole.ch.to(0.32 * whole.room * Math.cos(2.2), 0.32 * whole.room * Math.sin(2.2)), edge = rim(D.verts);
    out.evenodd = true;
    [0.84, 0.68, 0.52, 0.36, 0.2].forEach((f, k) => out.dark.push({ pts: edge.map((p) => G.mix(q, p, f)), min: k < 2 ? 0 : 9, convex: true }));
  } else commas(UNIT, [0.88, 0.64], [-0.33, 2.2]);
  return out;
}
