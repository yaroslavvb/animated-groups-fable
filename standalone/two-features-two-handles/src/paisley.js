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
//   3. That page's commas are large: at the default numbers the isolating cut of the default pair runs through
//      them. A Twist cuts the pattern along that cut and slides one side along the other ("cut and slide",
//      rigid-print.js), so each comma is cut along it beforehand, once, into the part on each side. At Twist 0 the
//      parts lie together as that page's comma; a Twist slides them apart along the dashed line, as a fault does.
//   4. Each part is then tied to a cone point on its own side of the cut, in that cone point's own frame (toward
//      its partner), and rides with it for good. Length, Twist and the shifts move cone points, and a part goes
//      with its own; a re-cut turns the frame under it by the angle handles.js already keeps (thetas), so it stays
//      where it was. (Only the default pair's cut is prepared: cut along all three, a comma would be confetti.
//      After a pick, a Twist carries whole parts, and they may come to overlap. So may they under Length: no
//      motion of the plane takes one length of the cut to another.)
//
// Where no such motion is found (a typed signature whose default numbers are not that page's metric: one with a
// mirror, a crosscap or a handle), the same design is laid on this page's own default tile: Paisley still, in the
// same tones, though not that page's very picture.
//
//   createPaisley({ families, centred, GH, GE }) -> { specs(k), view(k), info(k) }
//     centred(state, commas)   the page's pattern for a state, drawn with the given commas (handles.js)
//     specs(k)   per feature: null, or { theta: 0, shapes: [{ pts, min }] } in that feature's frame at the default numbers
//     view(k)    the view in which the default pattern lies exactly as on that page (a motion of the plane), or null
//     info(k)    { exact, shapes, split, tied: [feature of each part] }: for the checks

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
function lineOf(G, a, b) {
  const m = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const w = G.kind === 'H' ? Math.sqrt(Math.max(1e-300, m[0] * m[0] + m[1] * m[1] - m[2] * m[2])) : Math.hypot(m[0], m[1]) || 1;
  return [m[0] / w, m[1] / w, m[2] / w];
}
const side = (m, p) => m[0] * p[0] + m[1] * p[1] + m[2] * p[2];
/** Where a point is on the pane: the Poincaré disc, or the plane itself. */
const flatOf = (G, p) => (G.kind === 'H' ? [p[0] / (1 + p[2]), p[1] / (1 + p[2])] : [p[0], p[1]]);
/** An order of places that no machine's rounding decides: the higher on the pane first, then the further left. */
const byPlace = (a, b) => (Math.abs(a[1] - b[1]) > 1e-7 ? b[1] - a[1] : Math.abs(a[0] - b[0]) > 1e-7 ? a[0] - b[0] : 0);
/** The part of the outline `pts` on the side sgn of the line m, and a hair (lap) beyond it: the two parts of a comma overlap by two hairs, so no seam shows where they meet. */
function partOf(G, pts, m, sgn, lap) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], sa = sgn * side(m, a) + lap, sb = sgn * side(m, b) + lap;
    if (sa >= 0) out.push(a);
    if ((sa > 0 && sb < 0) || (sa < 0 && sb > 0)) out.push(G.norm([(a[0] * sb - b[0] * sa) / (sb - sa), (a[1] * sb - b[1] * sa) / (sb - sa), (a[2] * sb - b[2] * sa) / (sb - sa)]));
  }
  return out;
}
const LAP = 0.004;          // a third of a pixel in the middle of the pane

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

    // Cut each comma along the default pair's isolating cut, wherever a lift of the cut crosses it. Only where each
    // side of the cut has a cone point to carry its parts (not o33: its handle has none, and its commas stay whole).
    const coneFeats = [0, 1, 2, 3].filter((f) => fam.baseOrders[f] > 1);
    const sideOfFeat = (f) => (st.perm.indexOf(f) < 2 ? 0 : 1);
    const split = !!base.cutSeg && [0, 1].every((sd) => coneFeats.some((f) => sideOfFeat(f) === sd));
    const cuts = split ? ts.map((t) => lineOf(G, apply(t.M, base.cutSeg[0]), apply(t.M, base.cutSeg[1]))) : [];
    let parts = shapes.map((sh, j) => ({ pts: sh.pts, min: sh.min, j }));
    for (const m of cuts) {
      let crossed = false;
      for (const pc of parts) {
        let lo = Infinity, hi = -Infinity;
        for (const p of pc.pts) { const d = side(m, p); if (d < lo) lo = d; if (d > hi) hi = d; }
        pc.lo = lo; pc.hi = hi;
        if (lo < -2 * LAP && hi > 2 * LAP) crossed = true;
      }
      if (!crossed) continue;
      const next = [];
      for (const pc of parts) {
        if (!(pc.lo < -2 * LAP && pc.hi > 2 * LAP)) { next.push(pc); continue; }
        for (const sgn of [1, -1]) { const pts = partOf(G, pc.pts, m, sgn, LAP); if (pts.length >= 3) next.push({ pts, min: pc.min, j: pc.j }); }
      }
      parts = next;
    }

    // Tie each part to a cone point near its middle and on its own side of every lift of the cut, in that cone
    // point's frame. A part in the middle of a cell is about as near to two corners of the cell, so "the nearest"
    // would be decided by the last digit: of the cone points within an eighth of the nearest one's distance, the
    // part goes to the one that carries fewer parts so far, then to the nearer, then to the lower number.
    // (The parts are taken comma by comma, and a comma's parts by place: which side of a line a machine calls the
    // first must not decide who carries what. Nor must the order of the tiles: of two copies of a cone point as near,
    // the one by place.)
    for (const pc of parts) pc.mid = G.norm(pc.pts.reduce((sum, p) => [sum[0] + p[0], sum[1] + p[1], sum[2] + p[2]], [0, 0, 0]).map((x) => x / pc.pts.length));
    parts.sort((x, y) => x.j - y.j || byPlace(flatOf(G, x.mid), flatOf(G, y.mid)));
    const homes = coneFeats.map((f) => { const p = base.home[st.perm.indexOf(f)]; return { f, copies: ts.map((t) => apply(t.M, p)) }; });
    const together = (c, q) => { for (const m of cuts) if (side(m, c) * side(m, q) < 0) return false; return true; };
    const has = [0, 0, 0, 0];
    const out = [null, null, null, null], tied = [];
    for (const f of coneFeats) out[f] = { theta: 0, shapes: [] };
    for (const pc of parts) {
      const mid = pc.mid;
      const near = [], any = [];
      for (const h of homes) {
        const order = h.copies.map((q, i) => [apart(G, q, mid), i]).sort((x, y) => (Math.abs(x[0] - y[0]) > 1e-9 * Math.max(1, Math.abs(x[0])) ? x[0] - y[0] : byPlace(flatOf(G, h.copies[x[1]]), flatOf(G, h.copies[y[1]])) || x[1] - y[1]));
        if (order.length) any.push({ d: G.dist(h.copies[order[0][1]], mid), f: h.f, M: ts[order[0][1]].M });
        for (let j = 0; j < Math.min(order.length, 24); j++) {
          const i = order[j][1];
          if (together(mid, h.copies[i])) { near.push({ d: G.dist(h.copies[i], mid), f: h.f, M: ts[i].M }); break; }
        }
      }
      const pool = near.length ? near : any;          // no cone point on its side within reach: the nearest of all
      if (!pool.length) continue;
      const dmin = Math.min(...pool.map((c) => c.d));
      const cands = pool.filter((c) => c.d <= 1.125 * dmin + 1e-6);
      cands.sort((x, y) => (has[x.f] - has[y.f]) || (Math.abs(x.d - y.d) > 1e-6 ? x.d - y.d : x.f - y.f));
      const pick = cands[0];
      has[pick.f]++;
      const back = mul(inv(frame[pick.f]), inv(pick.M));
      out[pick.f].shapes.push({ pts: pc.pts.map((p) => G.norm(apply(back, p))), min: pc.min });
      tied.push(pick.f);
    }
    return { specs: out, view, exact, tied, count: shapes.length, split: split && parts.length > shapes.length };
  }

  const get = (k) => {
    if (cache.has(k)) return cache.get(k);
    if (busy.has(k)) return null;          // asked for while it is being made (the pattern it is made from wants commas): none yet
    busy.add(k);
    let made = null;
    try { made = make(k); } catch (err) { made = { specs: NONE, view: null, exact: false, tied: [], count: 0, split: false, error: String(err && err.message) }; }
    busy.delete(k);
    cache.set(k, made);
    return made;
  };

  return {
    specs: (k) => { const m = get(k); return m ? m.specs : NONE; },
    view: (k) => { const m = get(k); return m && m.view ? m.view.slice() : null; },
    info: (k) => { const m = get(k); return m ? { exact: m.exact, shapes: m.count, split: m.split, tied: m.tied.slice(), error: m.error || null } : null; },
  };
}
