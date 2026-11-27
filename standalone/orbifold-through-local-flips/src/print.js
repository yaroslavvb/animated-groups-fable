// print.js — what is printed on the pattern: the Classification of Surfaces page's Paisley (a big comma in the
// middle of each tile, a smaller one in every corner that has room: its motifs.js, whose two comma outlines are
// copied here), laid on THIS page's atoms, and carried along when the numbers of shape change.
//
// His rule (Thu 26 Nov 2026, on Two features, two handles): the print is drawn on the orbifold, and a deformation
// only changes how its copies stack. A comma is never cut. So:
//
//   - The print of a decomposition is design(atlas): every comma lies inside ONE atom, and the atoms are the rigid
//     pieces. A twist slides whole atoms past each other and the commas with them; a length changes an atom's shape
//     and its commas are laid in it afresh by the same rule (their size goes with the room they have).
//   - A FLIP MOVES NOTHING. The cuts change and the pattern does not, so the commas stay exactly where they are: they
//     are tied to the atoms of the new decomposition they now lie in (retie), each by a fixed mix of its atom's
//     middle and two of its corners, and are drawn as they were. Some of them now lie across the new cuts.
//   - The first number that is moved after a flip inks the print afresh for the new pieces (the page cross-fades the
//     two): from then on no comma lies across a cut again, whatever is twisted.
//
// design(atlas) -> motifs;  place(atlas, motifs) -> shapes per atom;  retie(...) -> the same commas for a new atlas.

import { H, E, mul, apply, I3, tx, invOf } from './h2.js';
import { locate } from './atlas.js';

/** A comma drawn as a stroke: a round head, then a tail that tapers along an arc (the Classification page's motifs.js strokeComma). */
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
  const fit = (p) => [(p[0] - cx) / far, (p[1] - cy) / far], tip = fit([Math.cos(turn), Math.sin(turn)]);
  return { pts: pts.map(fit), tip: Math.atan2(tip[1], tip[0]) };
}
const UNIT = { big: strokeComma({ turn: 3.25, fat: 0.6, taper: 0.9 }), small: strokeComma({ turn: 1.5, fat: 0.42, taper: 0.8, n: 16 }) };
const MIN_PX = { big: 2.4, small: 11 };

const geo = (kind) => (kind === 'H' ? H : E);
/** The chart about c: to(x, y) is the point at distance hypot(x, y) from c that way; angle(p) the direction of p seen from c. */
function chartAt(kind, c) {
  const G = geo(kind), inv = invOf(kind), d = G.dist(G.origin, c);
  let T = I3, Ti = I3;
  if (d > 1e-12) { const F = G.frame(G.origin, c); T = mul(mul(F, tx(kind, d)), inv(F)); Ti = inv(T); }
  return {
    to: (x, y) => apply(T, G.polar(Math.hypot(x, y), Math.atan2(y, x))),
    angle: (p) => { const q = apply(Ti, p); return Math.atan2(q[1], q[0]); },
  };
}
const sidesRoom = (G, atom, p) => { const n = atom.verts.length; let r = Infinity; for (let i = 0; i < n; i++) r = Math.min(r, G.lineDist(p, atom.verts[i], atom.verts[(i + 1) % n])); return r; };
const mixOf = (G, atom, m) => {
  const n = atom.verts.length, a = atom.at, b = atom.verts[m.tri], c = atom.verts[(m.tri + 1) % n], w = m.w;
  return G.norm([w[0] * a[0] + w[1] * b[0] + w[2] * c[0], w[0] * a[1] + w[1] * b[1] + w[2] * c[1], w[0] * a[2] + w[1] * b[2] + w[2] * c[2]]);
};

/** The Paisley of one atom, as motifs tied to it. */
function designAtom(kind, atom) {
  const G = geo(kind), n = atom.verts.length, out = [], room = atom.clear;
  out.push({ atom: atom.id, unit: 'big', tri: 0, w: [1, 0, 0], ref: 0, turn: atom.twin ? 2.0 : -0.6, size0: (atom.twin ? 0.76 : 0.93) * room, room0: room, mirror: false });
  for (let i = 0; i < n; i++) {
    const v = atom.verts[i], a = atom.verts[(i + n - 1) % n], b = atom.verts[(i + 1) % n];
    if (G.angle(v, a, b) > 2.3) continue;                          // a flat corner is no corner
    const at = (t) => { const p = G.mix(atom.at, v, t); return { p, room: Math.min(G.lineDist(p, a, v), G.lineDist(p, v, b)), gap: G.dist(atom.at, p) - 0.97 * room }; };
    let lo = 0, hi = 1;
    for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2, q = at(mid); if (q.room > q.gap) lo = mid; else hi = mid; }
    const t = (lo + hi) / 2, q = at(t), r = 0.9 * Math.min(q.room, q.gap);
    // a corner with too little room has no comma (that page's rule: 0.24 of the big one's room); here one comes in
    // gradually as the corner opens, so that nothing appears from nowhere while a slider moves
    const k = Math.max(0, Math.min(1, (r / room - 0.2) / 0.08)), grow = k * k * (3 - 2 * k);
    if (!(grow > 0.02)) continue;
    out.push({ atom: atom.id, unit: 'small', tri: i, w: [1 - t, t, 0], ref: i, turn: -UNIT.small.tip + (atom.twin ? 0.9 : 0), size0: r * grow, room0: sidesRoom(G, atom, q.p), mirror: false });
  }
  return out;
}
export const design = (atlas) => atlas.atoms.flatMap((a) => designAtom(atlas.kind, a));

/** Where every motif lies now: [{ m, atom, c, size, theta, ch }] (theta: the way it faces, in the chart ch about its middle c). */
function layout(atlas, motifs) {
  const G = geo(atlas.kind), out = [];
  for (const m of motifs) {
    const atom = atlas.atoms[m.atom];
    if (!atom) continue;
    const c = mixOf(G, atom, m), room = sidesRoom(G, atom, c), grow = m.room0 > 1e-9 ? Math.max(0.05, Math.min(20, room / m.room0)) : 1;
    const ch = chartAt(atlas.kind, c);
    out.push({ m, atom: m.atom, c, size: m.size0 * grow, ch, theta: ch.angle(atom.verts[m.ref]) + (m.mirror ? -1 : 1) * m.turn });
  }
  return out;
}

/** The shapes to draw, per atom: shapes[atomId] = [{ pts, min, size, c }] (pts in the atom's chart). */
export function place(atlas, motifs) {
  const shapes = atlas.atoms.map(() => []);
  for (const it of layout(atlas, motifs)) {
    if (!(it.size > 1e-4)) continue;
    const U = UNIT[it.m.unit], c = Math.cos(it.theta), s = Math.sin(it.theta), f = it.m.mirror ? -1 : 1, k = it.size;
    shapes[it.atom].push({ pts: U.pts.map(([x, y]) => it.ch.to(k * (x * c - f * y * s), k * (x * s + f * y * c))), min: MIN_PX[it.m.unit], size: it.size, c: it.c });
  }
  return shapes;
}

/**
 * The same commas, tied to another atlas, none of them moved. carry(atomId) says where an atom of the old atlas lies
 * in the new one: { atom, M } (the new atom `atom` placed by M holds the old atom's chart: for a piece that stayed, M
 * is the identity) and the tile the point is then looked for from.
 */
export function retie(oldAtlas, motifs, newAtlas, carry) {
  const G = geo(newAtlas.kind), inv = invOf(newAtlas.kind), out = [];
  for (const it of layout(oldAtlas, motifs)) {
    const from = carry(it.atom);
    if (!from) continue;
    // its middle and a point just ahead of it, in the chart of the tile it is looked for from
    const p = apply(from.M, it.c), ahead = apply(from.M, it.ch.to(0.02 * Math.cos(it.theta), 0.02 * Math.sin(it.theta)));
    const loc = locate(newAtlas, { atom: from.atom, M: I3 }, p);
    if (!loc) continue;
    const Li = inv(loc.M), c = apply(Li, p), d = apply(Li, ahead), atom = newAtlas.atoms[loc.atom], n = atom.verts.length;
    const turned = (det3(from.M) < 0) !== loc.flip;                       // carried over a mirror: the comma is its mirror image there
    // which triangle of the fan (the atom's middle and two neighbouring corners) holds it, and its weights there
    let best = null;
    for (let i = 0; i < n; i++) {
      const w = solve3(atom.at, atom.verts[i], atom.verts[(i + 1) % n], c);
      if (!w) continue;
      const low = Math.min(w[0], w[1], w[2]);
      if (!best || low > best.low) best = { low, tri: i, w };
    }
    if (!best) continue;
    const ch = chartAt(newAtlas.kind, c), mirror = it.m.mirror !== turned;
    // the way it faces is kept against the corner FARTHEST from it: a comma's middle can lie exactly on a corner of
    // its new atom (the symmetric 2222 does this), and the direction to a point from itself is no direction
    let ref = 0, far = -1;
    for (let i = 0; i < n; i++) { const dd = G.dist(c, atom.verts[i]); if (dd > far) { far = dd; ref = i; } }
    const turn = (ch.angle(d) - ch.angle(atom.verts[ref])) * (mirror ? -1 : 1);
    out.push({ atom: loc.atom, unit: it.m.unit, tri: best.tri, w: best.w, ref, turn, size0: it.size, room0: sidesRoom(G, atom, c), mirror });
  }
  return out;
}
const det3 = (M) => M[0] * (M[4] * M[8] - M[5] * M[7]) - M[1] * (M[3] * M[8] - M[5] * M[6]) + M[2] * (M[3] * M[7] - M[4] * M[6]);
/** w with w0 a + w1 b + w2 c = p (as vectors), or null. */
function solve3(a, b, c, p) {
  const d = a[0] * (b[1] * c[2] - b[2] * c[1]) - b[0] * (a[1] * c[2] - a[2] * c[1]) + c[0] * (a[1] * b[2] - a[2] * b[1]);
  if (Math.abs(d) < 1e-14) return null;
  const w0 = (p[0] * (b[1] * c[2] - b[2] * c[1]) - b[0] * (p[1] * c[2] - p[2] * c[1]) + c[0] * (p[1] * b[2] - p[2] * b[1])) / d;
  const w1 = (a[0] * (p[1] * c[2] - p[2] * c[1]) - p[0] * (a[1] * c[2] - a[2] * c[1]) + c[0] * (a[1] * p[2] - a[2] * p[1])) / d;
  const w2 = (a[0] * (b[1] * p[2] - b[2] * p[1]) - b[0] * (a[1] * p[2] - a[2] * p[1]) + p[0] * (a[1] * b[2] - a[2] * b[1])) / d;
  return [w0, w1, w2];
}
