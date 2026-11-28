// print.js — what is printed on the pattern: the Classification of Surfaces page's Paisley (a big comma in the
// middle of each tile, a smaller one in every corner that has room: its motifs.js, whose two comma outlines are
// copied here), laid ONCE, when an orbifold is opened, and from then on only ever moved.
//
// His rule (Fri 27 Nov 2026, on the first version of this page, where the print was laid afresh inside the pieces
// whenever a Length moved, and inked afresh after a flip): "instead of cutting on the geodesic, you're just
// rearranging the corners ... if the pattern doesn't actually go through a special point, it can just be moved
// without distortion ... I don't want to have unexpected changes in pattern." So:
//
//   - A COMMA IS RIGID. It never changes its shape or its size, it is never cut, and none comes or goes.
//   - Each comma is tied to one ANCHOR: a special point of the orbifold (a cone point, a corner of a mirror: a corner
//     of the piece it lies in), or, in a piece that has no special point, the piece's middle. A corner of a piece
//     keeps its angle whatever the numbers are, so the wedge at a special point is a rigid thing: what is tied to it
//     is carried along by a motion of the plane. A Twist carries whole pieces, special points and commas, past each
//     other; a Length moves the special points of a piece apart or together, and each takes its commas with it.
//   - A FLIP MOVES NOTHING. The pieces change and the pattern does not: every comma is tied to an anchor of the new
//     pieces (the nearest one of the piece it lies in) exactly where it is, and goes on from there. Nothing is inked
//     afresh, ever.
//   - Commas of different anchors may come to overlap when their anchors come together, or under a Twist after a
//     flip; they are drawn over each other. How far any two run into each other is measured (crowding), the print is
//     laid so that at first none do, and the page stops a Length before they do by much (model.js, CROWD_MAX).
//
// design(atlas) -> motifs;  place(atlas, motifs) -> shapes per atom;  retie(...) -> the same commas tied to a new
// atlas;  crowding(atlas, shapes) -> how far the commas run into each other.

import { H, E, mul, apply, I3, tx, rot, posOf, invOf, REFL_X } from './h2.js';
import { locate, walk } from './atlas.js';

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
// each as (distance, direction) from its own middle, once
for (const u of Object.values(UNIT)) u.polar = u.pts.map(([x, y]) => [Math.hypot(x, y), Math.atan2(y, x)]);
const MIN_PX = { big: 2.4, small: 11 };
const SLACK = 0.78;            // of the size the room allows
const GAP = 0.9;               // two commas laid next to each other: their circles take this much of the way between their middles
const HUG = 0.66;              // a special point's own comma: this much of the size the corner has room for, and that much nearer the point

const geo = (kind) => (kind === 'H' ? H : E);
const det3 = (M) => M[0] * (M[4] * M[8] - M[5] * M[7]) - M[1] * (M[3] * M[8] - M[5] * M[6]) + M[2] * (M[3] * M[7] - M[4] * M[6]);

/**
 * The anchors of an atom, as frames in its chart: anchor k < n is its corner k (the frame at the corner, heading
 * along the side that leaves it); anchor n is its middle, heading for corner 0.
 */
export function anchorFrame(atlas, atom, k) {
  const n = atom.verts.length;
  return k < n ? atom.frames[k] : geo(atlas.kind).frame(atom.at, atom.verts[0]);
}
/** The frame at the point c that heads the way `theta` says in the chart about c (the slide from the chart's middle to c, then a turn). */
function frameAtAngle(kind, c, theta) {
  const G = geo(kind), d = G.dist(G.origin, c);
  let T = I3;
  if (d > 1e-12) { const F = G.frame(G.origin, c); T = mul(mul(F, tx(kind, d)), invOf(kind)(F)); }
  return mul(T, rot(theta));
}
const angleAt = (kind, c, p) => { const G = geo(kind), d = G.dist(G.origin, c); let Ti = I3; if (d > 1e-12) { const F = G.frame(G.origin, c); Ti = invOf(kind)(mul(mul(F, tx(kind, d)), invOf(kind)(F))); } const q = apply(Ti, p); return Math.atan2(q[1], q[0]); };

/**
 * The corners of an atom that are special points of the orbifold: their numbers. A cone point or a mirror's corner
 * that is an end of the atom's own piece, and the corner 2 at either end of an arc that runs along a mirror. Not the
 * two half-turn points a cuff is folded onto: they lie ON the cuff and slide along it with its Twist, and are at
 * the feet of its seams only when the Twist is 0.
 */
function specialCorners(kind, atom) {
  const G = geo(kind), out = [];
  atom.verts.forEach((v, i) => { if ((atom.marks || []).some((mk) => (mk.which === undefined || mk.kind === 'corner') && G.dist(mk.pt, v) < 1e-6)) out.push(i); });
  return out;
}
/**
 * The anchor a comma at the point c of an atom is tied to after a flip: the nearest of the atom's middle and its
 * corners that are special points. (The foot of a seam on a cut is a corner of this decomposition and of no other:
 * nothing is tied to it.)
 */
function anchorFor(kind, atom, c) {
  const G = geo(kind);
  let best = atom.verts.length, near = G.dist(c, atom.at);
  for (const i of specialCorners(kind, atom)) { const d = G.dist(c, atom.verts[i]); if (d < near) { near = d; best = i; } }
  return best;
}

/** The Paisley of one atom as it is now: [{ anchor, unit, size, F }] (F: the comma's own frame, in the atom's chart). */
function designAtom(kind, atom) {
  const G = geo(kind), n = atom.verts.length, out = [], room = atom.clear, special = specialCorners(kind, atom);
  // a little smaller than the room it has (that page fills it: 0.93, 0.76): a comma keeps its size for good, and
  // the pieces may change shape some way before the commas on them meet
  out.push({ anchor: n, unit: 'big', size: SLACK * (atom.twin ? 0.76 : 0.93) * room, F: frameAtAngle(kind, atom.at, angleAt(kind, atom.at, atom.verts[0]) + (atom.twin ? 2.0 : -0.6)) });
  for (let i = 0; i < n; i++) {
    const v = atom.verts[i], a = atom.verts[(i + n - 1) % n], b = atom.verts[(i + 1) % n];
    // only a corner that is a special point carries a comma of its own (the commas of the two feet of a cut ran
    // into each other as soon as the cut got short)
    if (!special.includes(i)) continue;
    if (G.angle(v, a, b) > 2.3) continue;                          // a flat corner is no corner
    const at = (t) => { const p = G.mix(atom.at, v, t); return { p, room: Math.min(G.lineDist(p, a, v), G.lineDist(p, v, b)), gap: G.dist(atom.at, p) - 0.97 * room }; };
    let lo = 0, hi = 1;
    for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2, q = at(mid); if (q.room > q.gap) lo = mid; else hi = mid; }
    const t0 = (lo + hi) / 2, q0 = at(t0), r0 = 0.9 * Math.min(q0.room, q0.gap);
    if (!(r0 > 0.24 * room)) continue;                             // too little room for one (that page's rule)
    // that page's comma touches the big one. Here it is drawn in towards its special point (the same way in from
    // the two sides of the corner, HUG of the size), so that the middle of the piece can come some way nearer
    // before the two meet
    const q = at(1 - HUG * (1 - t0)), r = Math.min(HUG * r0, 0.9 * q.room);
    out.push({ anchor: i, unit: 'small', size: r, F: frameAtAngle(kind, q.p, angleAt(kind, q.p, v) - UNIT.small.tip + (atom.twin ? 0.9 : 0)) });
  }
  return out;
}
/**
 * The print of an atlas, laid afresh: motifs [{ atom, anchor, unit, size, M, mirror }]. M carries the anchor's frame
 * to the comma's own (a motion of the plane, kept for good); mirror: the comma is its mirror image.
 */
export function design(atlas) {
  const inv = invOf(atlas.kind);
  let out = [];
  for (const atom of atlas.atoms) for (const m of designAtom(atlas.kind, atom)) out.push({ atom: atom.id, anchor: m.anchor, unit: m.unit, size: m.size, M: mul(inv(anchorFrame(atlas, atom, m.anchor)), m.F), mirror: false });
  // no two commas run into each other at first: where the circles round two of them cross, the small ones give way
  // (a corner comma to a big one; two of a kind share), and one that would be left a speck is left out
  const first = out.map((m) => m.size);
  for (let round = 0; round < 8; round++) {
    const hit = crowding(atlas, place(atlas, out), { pairs: true }).pairs;
    if (!hit.length) break;
    const want = out.map((m) => m.size);
    for (const { i, j, d } of hit) {
      const a = out[i], b = out[j];
      if (a.unit !== b.unit) { const small = a.unit === 'small' ? i : j, big = small === i ? j : i; want[small] = Math.min(want[small], Math.max(0, GAP * d - out[big].size)); }
      else { const k = (GAP * d) / (a.size + b.size); want[i] = Math.min(want[i], a.size * k); want[j] = Math.min(want[j], b.size * k); }
    }
    out.forEach((m, i) => { m.size = want[i]; });
  }
  out = out.filter((m, i) => m.unit === 'big' || m.size >= 0.45 * first[i]);
  return out;
}

/**
 * How far the commas run into each other: { worst, pairs }. worst: the deepest any two circles round commas cross,
 * as a part of the smaller one's size (0: no two touch; 1: the smaller lies in the other). With { pairs: true },
 * every crossing pair as { i, j, d } (their numbers in the order place() was given them, the distance of their
 * middles). A matter of the pattern alone: copies of commas in the tiles all round are looked at, whatever the pieces.
 */
export function crowding(atlas, shapes, { pairs = false } = {}) {
  const G = geo(atlas.kind), list = [];
  let worst = 0, out = 0, big = 0;
  atlas.atoms.forEach((atom, a) => { for (const sh of shapes[a]) { out = Math.max(out, G.dist(atom.at, sh.c)); big = Math.max(big, sh.size); } });
  atlas.atoms.forEach((atom, a) => {
    const mine = shapes[a];
    if (!mine.length) return;
    // every tile one of whose commas could reach one of this atom's
    for (const t of walk(atlas, a, { radius: 2 * out + 2 * big + 1e-6, max: 900, ms: 200 })) {
      const home = t.atom === a && t.d < 1e-9;
      shapes[t.atom].forEach((o, j) => {
        const c = home ? o.c : apply(t.M, o.c);
        mine.forEach((sh, i) => {
          if (home && i >= j) return;
          const d = G.dist(sh.c, c), over = (sh.size + o.size - d) / Math.min(sh.size, o.size);
          if (over > worst) worst = over;
          if (pairs && over > 1e-3) list.push({ i: sh.m, j: o.m, d });
        });
      });
    }
  });
  return { worst: Math.max(0, Math.min(1, worst)), pairs: list };
}

/** The shapes to draw, per atom: shapes[atomId] = [{ pts, min, size, c }] (pts in the atom's chart). Every one is its comma moved, never changed. */
export function place(atlas, motifs) {
  const G = geo(atlas.kind), shapes = atlas.atoms.map(() => []);
  for (let k = 0; k < motifs.length; k++) {
    const m = motifs[k], atom = atlas.atoms[m.atom];
    if (!atom || !(m.size > 1e-6)) continue;
    const F = mul(anchorFrame(atlas, atom, m.anchor), m.M), U = UNIT[m.unit], f = m.mirror ? -1 : 1;
    shapes[m.atom].push({ pts: U.polar.map(([r, a]) => apply(F, G.polar(m.size * r, f * a))), min: MIN_PX[m.unit], size: m.size, c: posOf(F), unit: m.unit, m: k });
  }
  return shapes;
}

/**
 * The same commas, tied to another atlas, none of them moved. carry(atomId) says where an atom of the old atlas lies
 * in the new one: { atom, M } (the new atom `atom` placed by M holds the old atom's chart: for a piece that stayed, M
 * is the identity). Each comma is tied to an anchor of the new atom its middle lies in (anchorFor).
 */
export function retie(oldAtlas, motifs, newAtlas, carry) {
  const inv = invOf(newAtlas.kind), out = [];
  for (const m of motifs) {
    const old = oldAtlas.atoms[m.atom], from = old && carry(m.atom);
    if (!from) continue;
    // the comma's own frame, in the chart of the tile it is looked for from
    const there = mul(from.M, mul(anchorFrame(oldAtlas, old, m.anchor), m.M));
    const loc = locate(newAtlas, { atom: from.atom, M: I3 }, posOf(there)) || { atom: from.atom, M: I3 };       // not found (it never happened): the tile it was looked for from will do, a comma is never dropped
    let F = mul(inv(loc.M), there), mirror = m.mirror;
    if (det3(F) < 0) { F = mul(F, REFL_X); mirror = !mirror; }           // carried over a mirror: it is its mirror image there
    const atom = newAtlas.atoms[loc.atom], anchor = anchorFor(newAtlas.kind, atom, posOf(F));
    out.push({ atom: loc.atom, anchor, unit: m.unit, size: m.size, M: mul(inv(anchorFrame(newAtlas, atom, anchor)), F), mirror });
  }
  return out;
}
