// motifs.js — what is printed on a tile: Paisley, a family of commas.
//
// For a day the page offered six prints behind a chooser, named as The Folding's selector names its own (Paisley,
// Soft commas, Tomoe, Checkerboard, Rings, Comma: his ask of Sun 15 Nov 2026). His decision the next day, Mon 16
// Nov 2026: "keep the Paisley pattern and get rid of the selector". The other five are in this file's history
// (commit eac0a050 is the last that has them).
//
// The Folding's own prints are fitted by hand and by search to each of the 17 plane groups (its src/patterns/: a
// table of knobs per group), so they cannot be carried to a sphere, a hyperbolic tiling or a signature typed a
// moment ago. What is taken from it: the idea and its name, and the paper's two tones a side (its palette.js
// PRINT_FRONT / PRINT_BACK). Here the print is drawn on ONE tile, from nothing but that tile's corners, and every
// symmetry carries it to the others:
//
//   a big comma in the middle of each cell, and a smaller one in every corner that has room
//
// The print has no symmetry of its own (a comma has a hand), so the pattern has the tile's signature and no larger
// one. A tile made of two mirror halves (domains.js half) has two cells, and the second gets the same hand at
// another size and turn: a mirror image would add the very mirror the signature leaves out.
//
//   design(D) -> [shape, ...]
//     shape   { pts: [point of the geometry, ...], min }   a closed outline, a sampled curve, drawn in the darker
//             tone of the tile's side; min: the tile must be this many pixels across its room before the shape is
//             worth drawing

import { apply, inv } from './geom.js';

/**
 * A comma drawn as a stroke: a round head, then a tail that tapers along an arc. turn: how far the arc turns
 * (radians); fat: the head's half width over the arc's radius; taper: the tail's width is fat (1 - t)^taper.
 * Returned fitted into the unit disc: { pts, tip: the angle of the tail's end }.
 */
function strokeComma({ turn, fat, taper = 1, n = 32 }) {
  const w = (t) => fat * Math.pow(1 - t, taper), out = [], inn = [];
  for (let i = 0; i <= n; i++) { const t = i / n, a = turn * t; out.push([(1 + w(t)) * Math.cos(a), (1 + w(t)) * Math.sin(a)]); inn.push([(1 - w(t)) * Math.cos(a), (1 - w(t)) * Math.sin(a)]); }
  const pts = out.slice();
  pts.push(...inn.reverse());
  for (let i = 1; i < 14; i++) { const b = Math.PI + (Math.PI * i) / 14; pts.push([1 + fat * Math.cos(b), fat * Math.sin(b)]); }   // the head's round back, behind the start: from the inner side round to the outer
  // fit into the unit disc: about the middle of its bounding box
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let far = 0;
  for (const p of pts) far = Math.max(far, Math.hypot(p[0] - cx, p[1] - cy));
  const fit = (p) => [(p[0] - cx) / far, (p[1] - cy) / far], tip = fit([Math.cos(turn), Math.sin(turn)]);
  return { pts: pts.map(fit), tip: Math.atan2(tip[1], tip[0]) };
}
const BIG = strokeComma({ turn: 3.25, fat: 0.6, taper: 0.9 });            // the big comma: curled half way round
const SMALL = strokeComma({ turn: 1.5, fat: 0.42, taper: 0.8, n: 16 });   // and the one for a corner: nearly straight, stout

export function design(D) {
  const G = D.G, n = D.n, out = [];
  /** The chart about c: to(x, y) is the point at distance hypot(x, y) from c in that direction; from() undoes it. */
  const chart = (c) => {
    const T = G.translate(G.origin, c), Ti = inv(T);
    return {
      to: (x, y) => apply(T, G.polar(Math.hypot(x, y), Math.atan2(y, x))),
      from: (p) => { const q = apply(Ti, p), r = G.dist(G.origin, G.norm(q)), a = Math.atan2(q[1], q[0]); return [r * Math.cos(a), r * Math.sin(a)]; },
    };
  };
  const placed = (ch, unit, size, turn) => { const c = Math.cos(turn), s = Math.sin(turn); return unit.map(([x, y]) => ch.to(size * (x * c - y * s), size * (x * s + y * c))); };
  // the cells: the tile, or its two halves; each with its middle and the room there (a tile with no edges is the whole sphere)
  const cells = (D.cells || [{ verts: D.verts, at: D.at }]).map((c) => ({ ...c, room: c.verts.length ? Math.min(...c.verts.map((v, i) => G.lineDist(c.at, v, c.verts[(i + 1) % c.verts.length]))) : n ? D.clear : 0.8, ch: chart(c.at) }));
  for (const c of cells) {
    const big = (c.twin ? 0.76 : 0.93) * c.room;
    out.push({ pts: placed(c.ch, BIG.pts, big, c.twin ? 2.0 : -0.6), min: 2.4 });
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
      out.push({ pts: placed(cq, SMALL.pts, r, Math.atan2(vy, vx) - SMALL.tip + (c.twin ? 0.9 : 0)), min: 11 });
    }
  }
  return out;
}
