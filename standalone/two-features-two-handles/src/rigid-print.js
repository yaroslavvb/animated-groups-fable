// rigid-print.js — a print that keeps its shape while the tile changes: commas put at given points, at given sizes.
//
// Why: Paisley (the engine's motifs.js design) is laid out from the tile's corners, a big comma sized by the tile's
// room and a small one in every corner that has room, so as a knob deforms the tile its commas change size and come
// and go (five, then four, then three, over one sweep of the twist of 2222). Here a comma is a fixed outline carried
// by a motion, so under "cut and slide" (math-2222.md, section 5.2) every strip of the pattern moves as a whole.
//
// The comma's outline is the engine's own (motifs.js strokeComma and its two commas, copied: that file exports
// `design` alone and test/sym.test.js holds it to that).
//
//   commaAt(G, c, size, turn, which) -> { pts, min }     one comma: its middle at the point c of the geometry G, its
//                                                        radius `size` in the geometry's units, turned by `turn`
//   moved(shape, M) -> shape                             the same comma carried by the motion M (a 3 x 3 matrix)

import { apply } from '../../2026-11-15-classification-of-surfaces/src/sym/geom.js';

function strokeComma({ turn, fat, taper = 1, n = 32 }) {
  const w = (t) => fat * Math.pow(1 - t, taper), out = [], inn = [];
  for (let i = 0; i <= n; i++) { const t = i / n, a = turn * t; out.push([(1 + w(t)) * Math.cos(a), (1 + w(t)) * Math.sin(a)]); inn.push([(1 - w(t)) * Math.cos(a), (1 - w(t)) * Math.sin(a)]); }
  const pts = out.slice();
  pts.push(...inn.reverse());
  for (let i = 1; i < 14; i++) { const b = Math.PI + (Math.PI * i) / 14; pts.push([1 + fat * Math.cos(b), fat * Math.sin(b)]); }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let far = 0;
  for (const p of pts) far = Math.max(far, Math.hypot(p[0] - cx, p[1] - cy));
  return pts.map((p) => [(p[0] - cx) / far, (p[1] - cy) / far]);
}
const COMMA = {
  big: strokeComma({ turn: 3.25, fat: 0.6, taper: 0.9 }),            // curled half way round
  small: strokeComma({ turn: 1.5, fat: 0.42, taper: 0.8, n: 16 }),   // nearly straight, stout
};

export function commaAt(G, c, size, turn = 0, which = 'big', min = 2.4) {
  const T = G.translate(G.origin, c), cs = Math.cos(turn), sn = Math.sin(turn);
  return { pts: COMMA[which].map(([x, y]) => { const u = size * (x * cs - y * sn), v = size * (x * sn + y * cs); return apply(T, G.polar(Math.hypot(u, v), Math.atan2(v, u))); }), min };
}
export const moved = (shape, M) => ({ pts: shape.pts.map((p) => apply(M, p)), min: shape.min });
