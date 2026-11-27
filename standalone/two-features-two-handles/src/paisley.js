// paisley.js — the print of the Classification of Surfaces page (its Symmetries tab), on this page.
//
// His ask, Thu 26 Nov 2026: "change default parameters or patterns in …two-features-two-handles… to match
// visualizations in …classification-of-surfaces#sym&k=2222. Reuse the same colors. For the surface and also for the
// orbifold visualizer. IE, …two-features-two-handles should look like …classification-of-surfaces#sym&k=3333".
//
// That page prints Paisley (its motifs.js design) on its own tile of a signature (its catalog.js domainOf), laid out
// from the tile's corners. This page's tile moves under its sliders, and its promise is that nothing but the shear
// moves: a print re-laid from the corners at every step would grow, shrink, come and go. So:
//
//   1. At a family's default numbers its orbifold IS that page's (the defaults were set to its metric that morning).
//      frame() finds the motion that carries that page's tile onto this page's default pattern: it lays two of that
//      tile's cone points on two of this pattern's, and keeps the motion only if it carries every gluing of that
//      tile to a symmetry of this pattern. No table: the two groups are compared.
//   2. That page's commas, carried by that motion, are the print at the default numbers: the same picture.
//   3. A Twist must not break a comma. His ask on seeing the first version (each comma cut along the isolating
//      cut, the halves sliding apart): "make sure that this is changed so that there are less breaks in pattern …
//      Find out what is done in …twist-of-2222… to avoid breaks in commas. On that page, all the shearing I can
//      apply doesn't actually change the pattern. The commas are all whole. If it's possible to make generalizable,
//      apply this to other orbifolds as well", and: "for 2222, we can draw on the original orbifold, and then twist
//      parameter just affects how the copies of that pattern stack up together".
//      What that page does: its print belongs to the paper. The dominoes along a row of the picked pair make a
//      block, and a twist slides whole blocks along the rows of the other pair's centres: the print's joint is
//      that row (the far seal), where no comma lies, not the loop drawn between the two rows.
//      What carries over: a Twist slides the two sides of the isolating cut along it, and that slide carries
//      every curve that keeps its distance from the cut along itself. So the print may be parted along any such
//      curve (on the plane a parallel line: the far row is one). jointOf looks for one that runs through no
//      comma; then the orbifold falls into pieces that no Twist changes, with the commas drawn whole on them, and
//      a Twist only changes how the pieces are stacked.
//   4. Each comma is tied to a cone point of its piece (its block), in that cone point's own frame (toward its
//      partner), and rides with it for good (tie). Where a comma is larger than any block (333∗: one comma fills
//      the tile) it is drawn in toward its cone point until it fits, over the first fortieth of a turn of Twist
//      away from where the print was laid (scaleAt); at that Twist itself it is that page's comma, whole.
//   5. A pick moves nothing, as before (handles.js thetas). It re-ties the same commas to the blocks of the new
//      pair's cut (retie), so that a Twist along that cut slides them whole too. Under Length a comma still rides
//      rigid with its cone point, and commas can come to overlap: no motion of the plane takes one length of the
//      cut to another.
//
// Where no such motion is found (a typed signature whose default numbers are not that page's metric: one with a
// mirror, a crosscap or a handle), the same design is laid on this page's own default tile: Paisley still, in the
// same tones, though not that page's very picture.
//
//   createPaisley({ families, centred, GH, GE }) -> { specs(k), view(k), info(k), print(k), retie, specsAt, scaleAt }
//     centred(state, commas)   the page's pattern for a state, drawn with the given commas (handles.js)
//     specs(k)   per feature: null, or { theta: 0, shapes: [{ pts, min }] } in that feature's frame at the default numbers
//     view(k)    the view in which the default pattern lies exactly as on that page (a motion of the plane), or null
//     info(k)    { exact, shapes, split, joint: { delta, clear, seal, fitted, rhoA, rhoC }, fit, tied: [feature of each comma] }: for the checks
//     print(k)   the family's print: { k, perm, twBase, fit, specs }
//     retie(state, print) -> print     after a pick: the same commas, tied to the new pair's blocks
//     specsAt(print, state)            the commas to draw at a state (drawn in by scaleAt where they must be)

import { apply, mul, inv as inv3 } from '../../2026-11-15-classification-of-surfaces/src/sym/geom.js';
import { analyse, tiles } from '../../2026-11-15-classification-of-surfaces/src/sym/orbifold.js';
import { design } from '../../2026-11-15-classification-of-surfaces/src/sym/motifs.js';
import { parse, domainOf } from '../../2026-11-15-classification-of-surfaces/src/sym/catalog.js';

/** How far apart, for comparing only (no acosh): the chord on the plane, minus the Lorentz product on the hyperbolic plane. */
const apart = (G, a, b) => (G.kind === 'H' ? a[2] * b[2] - a[0] * b[0] - a[1] * b[1] : (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]));
/** The index of the point of `pts` nearest to p. */
function nearest(G, pts, p) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < pts.length; i++) { const d = apart(G, pts[i], p); if (d < bd) { bd = d; best = i; } }
  return best;
}

/**
 * The line through a and b, as the plane through the origin of the ambient space that holds it (on both geometries a
 * point is [x, y, z]): scaled so that side(m, p) is the distance of p from the line on the plane, and its sinh on the
 * hyperbolic plane.
 */
export function lineOf(G, a, b) {
  const m = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const w = G.kind === 'H' ? Math.sqrt(Math.max(1e-300, m[0] * m[0] + m[1] * m[1] - m[2] * m[2])) : Math.hypot(m[0], m[1]) || 1;
  return [m[0] / w, m[1] / w, m[2] / w];
}
export const side = (m, p) => m[0] * p[0] + m[1] * p[1] + m[2] * p[2];
/** Where a point is on the pane: the Poincaré disc, or the plane itself. */
export const flatOf = (G, p) => (G.kind === 'H' ? [p[0] / (1 + p[2]), p[1] / (1 + p[2])] : [p[0], p[1]]);
/** An order of places that no machine's rounding decides: the higher on the pane first, then the further left. */
export const byPlace = (a, b) => (Math.abs(a[1] - b[1]) > 1e-7 ? b[1] - a[1] : Math.abs(a[0] - b[0]) > 1e-7 ? a[0] - b[0] : 0);
/** side() as a distance: itself on the plane, its asinh on the hyperbolic plane; and back. */
export const toDist = (G, v) => (G.kind === 'H' ? Math.asinh(v) : v), toSide = (G, d) => (G.kind === 'H' ? Math.sinh(d) : d);
/** How far apart two lines that do not meet are (on2: a point of the second). */
const lineGap = (G, m1, m2, on2) => (G.kind === 'H' ? Math.acosh(Math.max(1, Math.abs(m1[0] * m2[0] + m1[1] * m2[1] - m1[2] * m2[2]))) : Math.abs(side(m1, on2)));
/**
 * The part of the outline `pts` on the side sgn of the curve side(m, .) = c (the line m itself for c = 0, else a
 * curve that keeps its distance from it), and a hair (lap) beyond it: the two parts of a comma overlap by two
 * hairs, so no seam shows where they meet.
 */
function partOf(G, pts, m, sgn, lap, c = 0) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], sa = sgn * (side(m, a) - c) + lap, sb = sgn * (side(m, b) - c) + lap;
    if (sa >= 0) out.push(a);
    if ((sa > 0 && sb < 0) || (sa < 0 && sb > 0)) out.push(G.norm([(a[0] * sb - b[0] * sa) / (sb - sa), (a[1] * sb - b[1] * sa) / (sb - sa), (a[2] * sb - b[2] * sa) / (sb - sa)]));
  }
  return out;
}
const LAP = 0.004;          // a third of a pixel in the middle of the pane
const CLEAR = 0.012;        // how far a joint keeps from a comma for choice: a pixel
const TIGHT = 0.001;        // and at the very least
export const TURN = 0.025;         // over this much Twist a comma larger than its block is drawn in to fit it (of a whole turn)

/** A point given in a cone point's own frame (the cone point at the origin), drawn in toward the cone point by the factor s. */
export function drawnIn(G, p, s) {
  if (s === 1) return p;
  if (G.kind !== 'H') return [s * p[0], s * p[1], 1];
  const r = Math.acosh(Math.max(1, p[2])), sh = Math.sinh(r);
  if (sh < 1e-12) return p;
  const k = Math.sinh(s * r) / sh;
  return [k * p[0], k * p[1], Math.cosh(s * r)];
}
/** The middle of an outline. */
export const midOf = (G, pts) => G.norm(pts.reduce((sum, p) => [sum[0] + p[0], sum[1] + p[1], sum[2] + p[2]], [0, 0, 0]).map((x) => x / pts.length));

/**
 * Where the print may be parted. A Twist cuts the pattern along the lifts of the isolating cut and slides one
 * side along the other. The same slide carries every curve that keeps its distance from a lift along itself, so
 * the print can be parted along such a curve instead (its JOINT), at an offset d from every lift, d > 0 toward
 * the far pair: on the plane a parallel line, and for 2222 the row of the far pair's centres, which is what the
 * Twist of 2222 page does. Any offset will do at which the joints of different lifts do not meet and no cone
 * point is passed: from -rhoA to rhoC. (A pair of half-turn centres lies ON its cut: the range ends at 0 there,
 * and the cut itself is the joint, a seal.) The offset is taken where the joints run through no comma, if there
 * is such a stretch: on the far side for choice (the commas by the picked pair then ride with it and the picture
 * round the pair holds still), the widest stretch, its middle. Then no comma is ever cut and none meets another,
 * at any Twist: each rides whole with its block. `clear` says whether there was such a stretch.
 */
export function jointOf(G, lifts, shapes, cones, others = []) {
  const l0 = lifts[0];
  let rhoA = Infinity, rhoC = Infinity, sealA = false, sealC = false;
  // (others: the lifts of OTHER cuts, where an orbifold has several: their joints must not be met either)
  for (const l of lifts.slice(1).concat(others)) {
    const v0 = toDist(G, side(l0.m, l.on)), v1 = toDist(G, side(l.m, l0.on));
    // the cut itself, the other way up, or met again through other tiles (a tile far out is good to five digits, and two lifts are never that near)
    if (Math.abs(v0) < 1e-5 && Math.abs(v1) < 1e-5) continue;
    const gap = lineGap(G, l0.m, l.m, l.on) / 2;
    if (v0 > 0 && v1 > 0) rhoC = Math.min(rhoC, gap); else if (v0 < 0 && v1 < 0) rhoA = Math.min(rhoA, gap);
  }
  for (const c of cones) {
    const v = toDist(G, side(l0.m, c.p));
    if (Math.abs(v) < 1e-5) { if (c.far) sealC = true; else sealA = true; } else if (v > 0) rhoC = Math.min(rhoC, v); else rhoA = Math.min(rhoA, -v);
  }
  if (sealC) rhoC = 0;
  if (sealA) rhoA = 0;
  const EDGE = 1e-3, from = sealA ? 0 : -(rhoA - EDGE), to = sealC ? 0 : rhoC - EDGE;
  // the stretches of offsets at which some lift's joint would run through some comma
  const raw = [];
  for (const sh of shapes) for (const l of lifts) {
    let lo = Infinity, hi = -Infinity;
    for (const q of sh.pts) { const d = side(l.m, q); if (d < lo) lo = d; if (d > hi) hi = d; }
    lo = toDist(G, lo); hi = toDist(G, hi);
    if (hi <= from - CLEAR || lo >= to + CLEAR) continue;
    raw.push([lo, hi]);
  }
  raw.sort((x, y) => x[0] - y[0]);
  /** The stretches of offsets that keep `margin` from every comma. */
  const freeAt = (margin) => {
    const out = [];
    let at = from;
    for (const [lo, hi] of raw) { if (lo - margin > at) out.push([at, Math.min(lo - margin, to)]); if (hi + margin > at) at = hi + margin; if (at >= to) break; }
    if (at < to) out.push([at, to]);
    return out;
  };
  // a seal is a joint if no comma lies across it, however near one comes
  const sealFree = (sealA || sealC) && raw.every(([lo, hi]) => !(lo < -1e-4 && hi > 1e-4));
  const widest = (list) => list.reduce((best, g) => (!best || g[1] - g[0] > best[1] - best[0] + 1e-9 ? g : best), null);
  let delta = 0, clear = true, free = [], far = null, near = null;
  for (const margin of [CLEAR, TIGHT]) {          // a pixel's clearance if there is such a stretch, else any clearance at all
    free = freeAt(margin);
    far = widest(free.map((g) => [Math.max(g[0], 0), g[1]]).filter((g) => g[1] - g[0] > 1e-4));
    near = widest(free.map((g) => [g[0], Math.min(g[1], 0)]).filter((g) => g[1] - g[0] > 1e-4));
    if (far || near) break;
  }
  if (sealC && sealFree) delta = 0;
  else if (far) delta = (far[0] + far[1]) / 2;
  else if (sealA && sealFree) delta = 0;
  else if (near) delta = (near[0] + near[1]) / 2;
  else {
    // No such stretch: a comma is larger than any block (333∗: one comma fills the tile). Then the offset at which
    // the joints cross the fewest commas, and of those the one that takes the least off the comma it crosses.
    clear = false;
    let bestCuts = Infinity, bestDepth = Infinity;
    for (let i = 0; i <= 200; i++) {
      const d = from + ((to - from) * i) / 200;
      let cuts = 0, depth = 0;
      for (const [lo, hi] of raw) if (lo + 2 * LAP < d && d < hi - 2 * LAP) { cuts++; depth += Math.min(d - lo, hi - d); }
      if (cuts < bestCuts || (cuts === bestCuts && depth < bestDepth - 1e-9)) { bestCuts = cuts; bestDepth = depth; delta = d; }
    }
  }
  return { delta, clear, rhoA, rhoC, seal: (sealC || sealA) && delta === 0, free };
}

export function createPaisley({ families, centred, GH, GE }) {
  const cache = new Map(), busy = new Set();
  const NONE = [null, null, null, null];

  /** The default state of a family, as page.js makes it. */
  const stateOf = (k) => {
    const fam = families[k], perm = fam.defaultM.split('').map(Number);
    return { k, perm, orders: perm.map((c) => fam.baseOrders[c]), L: fam.defaultL, tw: fam.defaultTw, b: fam.defaultB ?? 0, tau: fam.defaultTau ?? 0, thetas: [0, 0, 0, 0] };
  };

  /**
   * The motions F with F(that page's tile) on this page's default pattern: F u1 = w1 and F u2 = w2 for two cone
   * points of that tile and two of this pattern alike in order and as far apart, kept if F g F^-1 is a symmetry of
   * this pattern for every gluing g of that tile. Both tiles have the same area by then (the plane's is scaled to
   * it beforehand), so the two groups are one. Every such F that brings that tile's middle within `reach` of the
   * point `mid` is returned, once: they differ by this pattern's symmetries and by the orbifold's own. All of
   * them, so that which two cone points of that tile were used does not matter: on a regular tile several pairs
   * are "the nearest two", and which one a machine names first is its last digit's business.
   */
  function frames(G, Dc, mapsC, D, A, ts, mid, reach) {
    const inv = G.inv || inv3;
    const cones = (dom, an) => an.classes.filter((c) => c.kind === 'cone' && c.n > 1).map((c) => ({ n: c.n, p: dom.verts[c.verts[0]] }));
    const theirs = cones(Dc, Dc.A), mine = cones(D, A);
    if (theirs.length < 2 || mine.length < 2) return [];
    // two cone points of that tile: the nearest two
    let pair = null;
    for (let i = 0; i < theirs.length; i++) for (let j = i + 1; j < theirs.length; j++) { const d = G.dist(theirs[i].p, theirs[j].p); if (d > 1e-6 && (!pair || d < pair.d)) pair = { a: theirs[i], b: theirs[j], d }; }
    if (!pair) return [];
    // every cone point of this pattern that F could send one of the two to, once, by order
    const far = reach + Math.max(G.dist(Dc.at, pair.a.p), G.dist(Dc.at, pair.b.p)) + 1e-3;
    const lifts = [], seen = new Set();
    for (const t of ts) for (const c of mine) {
      const p = G.norm(apply(t.M, c.p)), d = G.dist(p, mid);
      if (d > far + pair.d + 1e-3) continue;
      const f = flatOf(G, p), key = c.n + ':' + Math.round(f[0] * 1e6) + ':' + Math.round(f[1] * 1e6);
      if (seen.has(key)) continue;
      seen.add(key);
      lifts.push({ n: c.n, p, near: d <= far });
    }
    // How far is the motion g from being one of this pattern's symmetries? It must carry the tile's middle onto a
    // tile's middle, and a corner along with it. The default numbers are that page's metric to six digits, and a
    // few units out that is 1e-5: so a motion is kept if it is off by less than a thousandth of a tile (tiles'
    // middles lie a good half unit apart: nothing else comes that near).
    const probe = D.verts[0], middles = ts.map((t) => apply(t.M, D.at));
    const miss = (g) => {
      const c = apply(g, D.at), i = nearest(G, middles, c);
      return i < 0 ? Infinity : Math.max(G.dist(middles[i], c), G.dist(apply(ts[i].M, probe), apply(g, probe)));
    };
    // (as far apart as the two: compared without an acosh a pair, there are a million pairs on a tile of 9999)
    const want = G.kind === 'H' ? Math.cosh(pair.d) : pair.d * pair.d, slack = 2e-4 * (G.kind === 'H' ? Math.sinh(pair.d) : 2 * pair.d) + 1e-12;
    const out = [];
    for (const [u1, u2] of [[pair.a, pair.b], [pair.b, pair.a]]) {
      for (const w1 of lifts) {
        if (!w1.near || w1.n !== u1.n) continue;
        for (const w2 of lifts) {
          if (w2.n !== u2.n || Math.abs(apart(G, w1.p, w2.p) - want) > slack) continue;
          const F = G.fit(u1.p, u2.p, w1.p, w2.p, false), at = apply(F, Dc.at), corner = apply(F, Dc.verts[0]);
          if (G.dist(at, mid) > reach) continue;
          if (out.some((c) => G.dist(c.at, at) < 1e-6 && G.dist(c.corner, corner) < 1e-6)) continue;          // the same motion, met through the other cone point
          const Fi = inv(F);
          let worst = 0;
          for (let e = 0; e < Dc.n && worst < 1e-3; e++) worst = Math.max(worst, miss(mul(F, mul(mapsC[e], Fi))));
          if (worst < 1e-3) out.push({ F, worst, at, corner });
        }
      }
    }
    return out;
  }

  function make(k) {
    const fam = families[k], G = fam.kind === 'E' ? GE : GH, st = stateOf(k);
    const inv = G.inv || inv3;
    // the default pattern, and each feature's frame in it: read off a probe comma (the origin, a step along each axis)
    const probePts = [G.origin, G.polar(0.5, 0), G.polar(0.5, Math.PI / 2)];
    const probe = { theta: 0, shapes: [{ pts: probePts, min: 0 }] };
    const base = centred(st, [probe, probe, probe, probe]);
    const { D, A } = base;
    const frame = new Array(4).fill(null);
    base.shapes.forEach((sh, i) => { frame[i] = G.frame(sh.pts[0], sh.pts[1]); });          // one probe a feature, in feature order
    // the tiles round the middle, nearest first: a fixed number of them and no clock, so that every machine makes the same print
    const ts = tiles(D, A, { radius: fam.kind === 'E' ? 9 : 9.5, max: 3000, ms: 60000 });

    // that page's tile and print, carried here; else the same design on this page's own tile
    let shapes = null, view = null, exact = false;
    const sig = parse(k), D0 = sig ? domainOf(sig) : null;
    if (D0 && D0.G.kind === G.kind && D0.n) {
      // on the plane a pattern has no size of its own: that page's tile is brought to this page's area first
      const A0 = analyse(D0), z = G.kind === 'E' ? Math.sqrt(Math.abs(G.area(D.verts)) / Math.abs(G.area(D0.verts))) : 1;
      const Z = [z, 0, 0, 0, z, 0, 0, 0, 1], Zi = [1 / z, 0, 0, 0, 1 / z, 0, 0, 0, 1], grow = (p) => (z === 1 ? p : apply(Z, p));
      const Dc = { G, n: D0.n, verts: D0.verts.map(grow), at: grow(D0.at), A: A0 };
      const mapsC = A0.maps.map((M) => (z === 1 ? M : mul(Z, mul(M, Zi))));
      const same = Math.abs(Math.abs(G.area(Dc.verts)) - Math.abs(G.area(D.verts))) < 1e-4;
      // Of all such motions that leave that tile's middle near the middle of the picked pair. How near: the pair's
      // middle lies in some copy of that tile, a reach from its middle at most, and the score below adds a quarter
      // of a tilt of half a turn at most (0.79): no motion further off than the two together can be the best.
      const pA = base.home[0], pB = base.home[1], reach0 = Math.max(...Dc.verts.map((v) => G.dist(v, Dc.at)));
      const found = same ? frames(G, Dc, mapsC, D, A, ts, G.mix(pA, pB, 0.5), reach0 + 0.8) : [];
      // the one that shows the picked pair best: near the middle of that page's view and level, A on the left
      let best = null;
      for (const c of found) {
        const V = mul(G.translate(Dc.at, G.origin), inv(c.F)), a = apply(V, pA), b = apply(V, pB);
        const fa = flatOf(G, a), fb = flatOf(G, b), mid = flatOf(G, G.mix(a, b, 0.5));
        const tilt = Math.abs(Math.atan2(fb[1] - fa[1], fb[0] - fa[0]));          // 0: level with A on the left
        const score = G.dist(G.mix(a, b, 0.5), G.origin) + 0.25 * tilt + 20 * c.worst;
        // (two that score alike to seven digits: the one whose pair lies higher, then further left, on every machine)
        if (!best || score < best.score - 1e-7 || (Math.abs(score - best.score) <= 1e-7 && byPlace(mid, best.mid) < 0)) best = { score, F: c.F, V, mid };
      }
      if (best) {
        shapes = design(D0).map((sh) => ({ pts: sh.pts.map((p) => G.norm(apply(best.F, grow(p)))), min: sh.min }));
        view = G.fix ? G.fix(best.V, 1) : best.V;          // that page opens on its tile's middle
        exact = true;
      }
    }
    if (!shapes) shapes = design(D).map((sh) => ({ pts: sh.pts.slice(), min: sh.min }));

    const tied = tie(G, fam, st.perm, base, frame, ts, shapes, null);
    const print = { k, perm: st.perm.slice(), twBase: st.tw, fit: tied.fit, specs: tied.specs };
    return { specs: tied.specs, print, view, exact, tied: tied.tied, count: shapes.length, split: tied.parts > shapes.length, joint: tied.joint };
  }

  /**
   * After a pick: the commas stay where they are drawn, and are tied anew, each to a cone point of its block of
   * the NEW pair's cut, so that a Twist along that cut slides them whole too. `state` is the state after the pick
   * (its thetas keep the old print in place), `pr` the print before it. Nothing moves.
   */
  function retie(state, pr) {
    const fam = families[state.k], G = fam.kind === 'E' ? GE : GH;
    const probePts = [G.origin, G.polar(0.5, 0), G.polar(0.5, Math.PI / 2)];
    const base = centred(state, [0, 1, 2, 3].map((f) => ({ theta: state.thetas[f] || 0, shapes: [{ pts: probePts, min: 0 }] })));
    const frame = base.shapes.map((sh) => G.frame(sh.pts[0], sh.pts[1]));
    const ts = tiles(base.D, base.A, { radius: fam.kind === 'E' ? 9 : 9.5, max: 3000, ms: 60000 });
    const shown = centred(state, specsAt(pr, state) || pr.specs).shapes.map((sh) => ({ pts: sh.pts, min: sh.min }));
    const tied = tie(G, fam, state.perm, base, frame, ts, shown, state.thetas);
    return { k: state.k, perm: state.perm.slice(), twBase: state.tw, fit: tied.fit, specs: tied.specs, joint: tied.joint, tied: tied.tied };
  }

  /**
   * How large the print is drawn at a Twist: whole (1) for a print whose commas fit their blocks, and at the
   * Twist the print was laid at; else drawn in toward the cone points, down to the print's `fit`, over the first
   * TURN of Twist away from there. (A whole turn away is the same pattern again, and the same size.)
   */
  function scaleAt(pr, state) {
    if (!pr || !(pr.fit < 1) || pr.perm.join('') !== state.perm.join('')) return 1;
    let d = Math.abs(state.tw - pr.twBase);
    d = Math.min(d, Math.abs(1 - d));
    const x = Math.min(1, d / TURN);
    return pr.fit + (1 - pr.fit) * (1 - x) * (1 - x);
  }
  /** The commas to draw at a state: the print's own, or drawn in (scaleAt). */
  function specsAt(pr, state) {
    if (!pr) return null;
    const sc = scaleAt(pr, state);
    if (sc === 1) return pr.specs;
    const G = families[state.k].kind === 'E' ? GE : GH;
    return pr.specs.map((sp) => sp && { theta: sp.theta, shapes: sp.shapes.map((sh) => ({ pts: sh.pts.map((q) => drawnIn(G, q, sc)), min: sh.min })) });
  }

  /**
   * The lifts of the isolating cut round the middle, each once and each with its sides named: side(m, p) > 0 on
   * the side of the far pair. (A cut through two half-turn centres is its own image turned over, so it comes
   * twice, once for each side. That is right: it is a seal, with a block of the picked pair's on either side.)
   * The first is the model's own.
   */
  function liftsOf(G, model, ts, coneSlots, reach) {
    const [a0, b0] = model.cutSeg, out = [], seen = new Set(), lim = toSide(G, reach);
    const put = (M) => {
      const a = M ? apply(M, a0) : a0, b = M ? apply(M, b0) : b0;
      let m = lineOf(G, a, b);
      if (M && Math.abs(side(m, G.origin)) > lim) return;
      let s = 0;
      for (const slot of coneSlots) { const h = model.home[slot], v = side(m, M ? apply(M, h) : h); s += slot < 2 ? -v : v; }
      if (s < 0) m = [-m[0], -m[1], -m[2]];
      const key = Math.round(m[0] * 1e5) + ':' + Math.round(m[1] * 1e5) + ':' + Math.round(m[2] * 1e5);
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ m, on: G.mix(a, b, 0.5) });
    };
    put(null);
    for (const t of ts) put(t.M);
    return out;
  }

  /**
   * Tie every comma to a cone point of its block: one on its own side of every joint (jointOf), near its middle,
   * in that cone point's own frame (toward its partner). It rides with it for good: Length, Twist and the shifts
   * move cone points, and a comma goes with its own; a re-cut turns the frame under it by the angle handles.js
   * keeps (thetas), so it stays where it was.
   *
   * Where the joints cannot miss the commas, a comma is larger than any block (333∗: one comma fills the tile).
   * It is still tied whole, to the block its middle is in, and `fit` says how far in toward its cone point it has
   * to be drawn for the joints to miss it (scaleAt draws it so once the Twist has left the print's own). Only if
   * no drawing-in helps is it cut along the joint, into the part on each side.
   *
   * A comma in the middle of a cell is about as near to two corners of the cell, so "the nearest" would be decided
   * by the last digit: of the cone points within an eighth of the nearest one's distance, it goes to the one that
   * carries fewer so far, then to the nearer, then to the lower number. (The commas are taken in their own order
   * and a comma's parts by place: which side of a line a machine calls the first must not decide who carries
   * what. Nor must the order of the tiles: of two copies of a cone point as near, the one by place.)
   */
  function tie(G, fam, perm, model, frame, ts, shapes, thetas) {
    const inv = G.inv || inv3;
    const coneFeats = [0, 1, 2, 3].filter((f) => fam.baseOrders[f] > 1);
    const homes = coneFeats.map((f) => { const slot = perm.indexOf(f), p = model.home[slot]; return { f, far: slot >= 2, copies: ts.map((t) => apply(t.M, p)) }; });
    const lifts = model.cutSeg && coneFeats.length ? liftsOf(G, model, ts, coneFeats.map((f) => perm.indexOf(f)), G.kind === 'E' ? 8 : 6) : [];
    const cones = [];
    for (const h of homes) for (const p of h.copies) cones.push({ p, far: h.far });
    // in one block: on the same side of every joint (a cone point ON a joint, a seal's, carries nothing)
    const together = (x, q, c) => { for (const l of lifts) { const u = side(l.m, q) - c; if (Math.abs(u) < 1e-7 || (side(l.m, x) - c) * u < 0) return false; } return true; };
    /** Each part with the cone point that carries it: { pc, f, q (where that cone point is), back, fwd (to its frame and from it) }. */
    const assign = (parts, c) => {
      for (const pc of parts) pc.mid = midOf(G, pc.pts);
      parts.sort((x, y) => x.j - y.j || byPlace(flatOf(G, x.mid), flatOf(G, y.mid)));
      const has = [0, 0, 0, 0], out = [];
      for (const pc of parts) {
        const mid = pc.mid, near = [], any = [];
        for (const h of homes) {
          const order = h.copies.map((q, i) => [apart(G, q, mid), i]).sort((x, y) => (Math.abs(x[0] - y[0]) > 1e-9 * Math.max(1, Math.abs(x[0])) ? x[0] - y[0] : byPlace(flatOf(G, h.copies[x[1]]), flatOf(G, h.copies[y[1]])) || x[1] - y[1]));
          if (order.length) any.push({ d: G.dist(h.copies[order[0][1]], mid), f: h.f, i: order[0][1], q: h.copies[order[0][1]] });
          for (let j = 0; j < Math.min(order.length, 60); j++) {
            const i = order[j][1];
            if (together(mid, h.copies[i], c)) { near.push({ d: G.dist(h.copies[i], mid), f: h.f, i, q: h.copies[i] }); break; }
          }
        }
        const pool = near.length ? near : any;          // no cone point in its block within reach: the nearest of all
        if (!pool.length) continue;
        const dmin = Math.min(...pool.map((x) => x.d));
        const cands = pool.filter((x) => x.d <= 1.125 * dmin + 1e-6);
        cands.sort((x, y) => (has[x.f] - has[y.f]) || (Math.abs(x.d - y.d) > 1e-6 ? x.d - y.d : x.f - y.f));
        const pick = cands[0];
        has[pick.f]++;
        const fwd = mul(ts[pick.i].M, frame[pick.f]);
        out.push({ pc, f: pick.f, q: pick.q, fwd, back: inv(fwd) });
      }
      return out;
    };

    const whole = () => shapes.map((sh, j) => ({ pts: sh.pts, min: sh.min, j }));
    let joint = lifts.length ? jointOf(G, lifts, shapes, cones) : { delta: 0, clear: true, rhoA: 0, rhoC: 0, seal: false, free: [] };
    let ties = null, fit = 1;
    if (joint.clear) ties = assign(whole(), toSide(G, joint.delta));
    else {
      // larger than any block: whole all the same, and how far in they must be drawn for the joints to miss them
      const loose = assign(whole(), toSide(G, joint.delta));
      const drawn = (sc) => loose.map((t) => ({ pts: t.pc.pts.map((q) => G.norm(apply(t.fwd, drawnIn(G, G.norm(apply(t.back, q)), sc)))), min: t.pc.min }));
      const fits = (sc) => {
        const sh = drawn(sc), j = jointOf(G, lifts, sh, cones);
        if (!j.clear) return null;
        const c = toSide(G, j.delta);
        for (let i = 0; i < sh.length; i++) if (!together(midOf(G, sh[i].pts), loose[i].q, c)) return null;
        return j;
      };
      let lo = 0, hi = 0, found = null;
      for (let sc = 0.96; sc >= 0.34 && !found; sc -= 0.04) { const j = fits(sc); if (j) { found = j; lo = sc; hi = sc + 0.04; } }
      if (found) {
        for (let it = 0; it < 6; it++) { const mid = (lo + hi) / 2, j = fits(mid); if (j) { lo = mid; found = j; } else hi = mid; }
        fit = lo * 0.985;          // a little inside the largest that fits, so the joints clear the commas by more than a hair
        joint = { ...(fits(fit) || found), clear: true, fitted: true };
        ties = loose;
      }
    }
    if (!ties) {
      // no drawing-in helps: cut along the joints that cross
      const c = toSide(G, joint.delta);
      let parts = whole();
      for (const l of lifts) {
        let crossed = false;
        for (const pc of parts) {
          let lo = Infinity, hi = -Infinity;
          for (const p of pc.pts) { const d = side(l.m, p) - c; if (d < lo) lo = d; if (d > hi) hi = d; }
          pc.lo = lo; pc.hi = hi;
          if (lo < -2 * LAP && hi > 2 * LAP) crossed = true;
        }
        if (!crossed) continue;
        const next = [];
        for (const pc of parts) {
          if (!(pc.lo < -2 * LAP && pc.hi > 2 * LAP)) { next.push(pc); continue; }
          for (const sgn of [1, -1]) { const pts = partOf(G, pc.pts, l.m, sgn, LAP, c); if (pts.length >= 3) next.push({ pts, min: pc.min, j: pc.j }); }
        }
        parts = next;
      }
      ties = assign(parts, c);
    }

    const out = [null, null, null, null], tied = [];
    for (const f of coneFeats) out[f] = { theta: thetas ? thetas[f] || 0 : 0, shapes: [] };
    for (const t of ties) {
      out[t.f].shapes.push({ pts: t.pc.pts.map((q) => G.norm(apply(t.back, q))), min: t.pc.min });
      tied.push(t.f);
    }
    return { specs: out, tied, parts: ties.length, joint, fit };
  }

  const get = (k) => {
    if (cache.has(k)) return cache.get(k);
    if (busy.has(k)) return null;          // asked for while it is being made (the pattern it is made from wants commas): none yet
    busy.add(k);
    let made = null;
    try { made = make(k); } catch (err) { made = { specs: NONE, print: null, view: null, exact: false, tied: [], count: 0, split: false, joint: null, error: String(err && err.message) }; }
    busy.delete(k);
    cache.set(k, made);
    return made;
  };

  return {
    specs: (k) => { const m = get(k); return m ? m.specs : NONE; },
    view: (k) => { const m = get(k); return m && m.view ? m.view.slice() : null; },
    info: (k) => { const m = get(k); return m ? { exact: m.exact, shapes: m.count, split: m.split, joint: m.joint && { delta: m.joint.delta, clear: m.joint.clear, seal: !!m.joint.seal, fitted: !!m.joint.fitted, rhoA: m.joint.rhoA, rhoC: m.joint.rhoC }, fit: m.print ? m.print.fit : 1, tied: m.tied.slice(), error: m.error || null } : null; },
    /** The print of a family at its default numbers: { k, perm, twBase, fit, specs }; null while it is being made. */
    print: (k) => { const m = get(k); return m ? m.print : null; },
    retie, specsAt, scaleAt,
  };
}
