// multi.js — orbifolds with more than two pairs of features: a sphere with five or six cone points.
//
// His ask, Thu 26 Nov 2026: "user interface to allow modifying more orbifolds, more than just 2 pairs ones like
// 2222. Perhaps a plus button I can click to select another pair for modification."
//
// Four features have one isolating cut, and handles.js builds them from its Length and Twist. Five or six cone
// points have a cut for every PAIR: the cone points are taken two by two in the order the signature names them
// (22 33 44: three pairs; 22 33 4: two pairs and one cone point left over), each pair is parted from the rest by
// its own cut, and what is left in the middle is a pair of pants: three cuffs, or two cuffs and the cone point
// left over. Every cut has a Length and a Twist of its own, and those are all the shapes there are (4 numbers for
// five cone points, 6 for six).
//
// The build (build) is done with mirrors, so that the group's one relation holds by construction:
//   - the pants in the middle is two right-angled hexagons; one of them is laid down with cuff 1 along the x axis
//     and the seam to cuff 2 along the y axis. Its three seams s12, s13, s23 are mirrors of the hexagon, and the
//     slide along cuff i by its length is the product of the mirrors in the two seams that meet it:
//         T1 = s13 s12,   T2 = s12 s23,   T3 = s23 s13,   so   T1 T2 T3 = 1.
//     With five cone points the third cuff is the cone point left over: s13 and s23 meet at it, and T3 is its turn.
//   - a pair (A, B) beyond cuff i: A and B lie on two lines a, b square to the cuff, half its length apart, as far
//     from it as their orders ask, and with m the line through A and B the two turns are  A = a m,  B = m b,  so
//     A B = a b = the slide along the cuff by its length. At Twist 0 the lines a, b are the seams themselves
//     (that is the shape the Classification of Surfaces page draws: its tile is a polygon with the cone points at
//     its corners, and its odd sides are these seams); a Twist slides the pair along its cuff.
// So the turns about the cone points, taken in the signature's order, multiply to 1, whatever the numbers.
//
// The tile (dirichlet) is the set of points nearer to one chosen point than to any copy of it: convex whatever the
// lengths and twists, which is what the pattern pane's walk from tile to tile needs.

import { mul, apply, I3 } from '../../2026-11-15-classification-of-surfaces/src/sym/geom.js';
import { inscribed, makeDomain } from '../../2026-11-15-classification-of-surfaces/src/sym/domains.js';
import { tiles } from '../../2026-11-15-classification-of-surfaces/src/sym/orbifold.js';
import { design } from '../../2026-11-15-classification-of-surfaces/src/sym/motifs.js';
import { domainOf } from '../../2026-11-15-classification-of-surfaces/src/sym/catalog.js';
import { jointOf, lineOf, side, toSide, flatOf, byPlace, midOf, drawnIn, TURN } from './paisley.js';

const TAU = 2 * Math.PI;

/** What a signature is here: five or six cone points on a sphere, taken two by two as named. null: not that. */
export function multiSpec(sig) {
  if (!sig || sig.o || sig.x || sig.stars.length) return null;
  const n = sig.cones.length;
  if (n !== 5 && n !== 6) return null;
  const orders = sig.cones.slice(), pairs = [[0, 1], [2, 3]];
  if (n === 6) pairs.push([4, 5]);
  return { k: orders.join(''), label: orders.join(''), mode: 'multi', kind: 'H', orders, pairs, single: n === 5 ? 4 : null, featLabels: orders.map(String) };
}

export function createMulti({ GH, psu }) {
  const G = GH, inv = G.inv;
  const O = G.origin;
  /**
   * The point `u` along the x axis and `v` off it, in the frame F (a motion; none: the plane's own). Off it: to the
   * RIGHT for v > 0. The head of this file lays the middle piece above cuff 1; laid so, the cone points would go
   * round clockwise, and the Classification page's polygon has them counter-clockwise. A mirror image of an
   * orbifold is another orbifold (its commas curl the other way), so the whole build is done in the mirror.
   */
  const at = (F, u, v) => {
    const p = apply(G.translate(O, G.polar(Math.abs(u), u >= 0 ? 0 : Math.PI)), G.polar(Math.abs(v), v >= 0 ? -Math.PI / 2 : Math.PI / 2));
    return F ? G.norm(apply(F, p)) : p;
  };
  /** The mirror in the line square to the x axis of the frame F at u. */
  const across = (F, u) => G.reflect(at(F, u, 0), at(F, u, 1));
  /** How far two lines that do not meet are apart (each given by two of its points). */
  const lineGap = (a0, a1, b0, b1) => {
    const Fa = G.frame(a0, a1), Fb = G.frame(b0, b1);
    return Math.acosh(Math.max(1, Math.abs(Fa[1] * Fb[1] + Fa[4] * Fb[4] - Fa[7] * Fb[7])));
  };
  const half = (L) => ({ c: Math.cosh(L / 2), s: Math.sinh(L / 2) });

  /**
   * The Lengths and Twists at which the orbifold is the one the Classification of Surfaces page draws: its tile is
   * the polygon with the cone points at its corners (angle pi / order), all sides touching one circle. A pair's
   * cut is the line square to both sides next to the pair's own; every Twist is 0.
   */
  function defaults(orders) {
    const n = orders.length, P = inscribed(orders), V = P.verts, m = n === 6 ? 3 : 2;
    const sideOf = (j) => [V[((j % n) + n) % n], V[(((j + 1) % n) + n) % n]];
    const L = [];
    for (let i = 0; i < m; i++) { const [a0, a1] = sideOf(2 * i - 1), [b0, b1] = sideOf(2 * i + 1); L.push(2 * lineGap(a0, a1, b0, b1)); }
    return { L, tw: L.map(() => 0), corners: V };
  }

  /**
   * The orbifold with these Lengths and Twists, laid down as the head of this file says.
   * Returns { cones: [point a cone point], gens: [its turn], order, cuts: [{ F, L, T, sign, seg }], Y } with
   *   gens[order[0]] gens[order[1]] ... = 1     (order: the features pair by pair, a pair's two either way round)
   *   cuts[i].F     the cut's frame: the cut along its x axis, in the direction its slide T goes
   *   cuts[i].sign  +1 / -1: the pair lies to the left / right of that direction
   *   cuts[i].seg   one length of the cut (two points)
   *   Y             a point of the middle piece: the heart of its hexagon (hex: that hexagon's corners)
   *   sense         +1 / -1 for each turn: counter-clockwise or clockwise by 2 pi / order
   */
  function build(orders, L, tw) {
    const n = orders.length, six = n === 6;
    const h1 = half(L[0]), h2 = half(L[1]);
    const c3 = six ? Math.cosh(L[2] / 2) : Math.cos(Math.PI / orders[4]);
    const d12 = Math.acosh((h1.c * h2.c + c3) / (h1.s * h2.s));
    const F1 = I3.slice(), F2raw = G.translate(O, at(null, 0, d12));
    // cuff 2 in the direction its slide goes (from s23 back to s12): the x axis turned round, the pair then on its right
    const F2 = mul(F2raw, [-1, 0, 0, 0, -1, 0, 0, 0, 1]);
    const s12 = G.reflect(O, at(null, 0, 1)), s13 = across(F1, L[0] / 2), s23 = across(F2, -L[1] / 2);
    const T1 = mul(s13, s12), T2 = mul(s12, s23), T3 = mul(s23, s13);
    const cuts = [
      { F: F1, L: L[0], T: T1, sign: -1, refA: L[0] / 2, refB: 0 },
      { F: F2, L: L[1], T: T2, sign: -1, refA: 0, refB: -L[1] / 2 },
    ];
    // The hexagon's corners, going round: cuff 1 from s12 to s13, (cuff 3 from s13 to s23, or the cone point left
    // over), cuff 2 from s23 back to s12. Its heart is their mean: a point INSIDE the middle piece whatever the
    // lengths (the hexagon is convex). A point picked by its coordinates is not: with cuff 3 long, that cuff runs
    // 0.6 from cuff 1, and a point a third of the way up s12's side lies beyond it, in pair 3's own piece.
    const hex = [O, at(null, L[0] / 2, 0)];
    let E = null;
    if (six) {
      const h3 = half(L[2]);
      const d13 = Math.acosh((h1.c * h3.c + h2.c) / (h1.s * h3.s)), d23 = Math.acosh((h2.c * h3.c + h1.c) / (h2.s * h3.s));
      const f13 = at(F1, L[0] / 2, d13), f23 = at(F2, -L[1] / 2, d23);          // where the seams meet cuff 3 (toward the middle is to the left of cuff 2's direction)
      hex.push(f13, f23);
    } else {
      const th = Math.PI / orders[4], hE = Math.asinh((h2.c + h1.c * Math.cos(th)) / (h1.s * Math.sin(th)));
      E = at(F1, L[0] / 2, hE);
      hex.push(E);
    }
    hex.push(at(F2, -L[1] / 2, 0), at(null, 0, d12));
    const heart = G.norm(hex.reduce((sum, q) => [sum[0] + q[0], sum[1] + q[1], sum[2] + q[2]], [0, 0, 0]));
    if (six) {
      // the pair lies on the side of cuff 3 away from the middle piece: not the heart's side
      const F3 = G.frame(hex[2], hex[3]), m3 = lineOf(G, hex[2], hex[3]);
      cuts.push({ F: F3, L: L[2], T: T3, sign: side(m3, at(F3, L[2] / 4, 0.5)) * side(m3, heart) > 0 ? -1 : 1, refA: L[2] / 2, refB: 0 });
    }
    const cones = [], gens = [], order = [];          // order: the features in the order their turns multiply to 1
    cuts.forEach((cut, i) => {
      const p = orders[2 * i], q = orders[2 * i + 1], al = Math.PI / p, be = Math.PI / q, lam = half(cut.L);
      const hA = Math.asinh((Math.cos(be) + Math.cos(al) * lam.c) / (Math.sin(al) * lam.s));
      const hB = Math.asinh((Math.cos(al) + Math.cos(be) * lam.c) / (Math.sin(be) * lam.s));
      // Along the cut the pair's copies stand half a Length apart, A's and B's by turns: ... A B A B ... Any two
      // neighbours are a pair that makes the same slide (B then A going the cut's way: A B = a b; A then B: B A =
      // b a, the turns taken the other way round), so the two nearest the middle piece are taken: their turns have
      // the smallest matrices, and the tile is found from them.
      const shift = (tw[i] || 0) * cut.L, mid = (cut.refA + cut.refB) / 2;
      let uA = cut.refA + shift, uB = cut.refB + shift, lead = true;          // lead: A ahead of B (the cut's way)
      for (const k of [-1, 0, 1]) for (const ahead of [true, false]) {
        const cA = cut.refA + shift + k * cut.L - (ahead ? 0 : cut.L), cB = cut.refB + shift + k * cut.L;
        if (Math.abs((cA + cB) / 2 - mid) < Math.abs((uA + uB) / 2 - mid) - 1e-12) { uA = cA; uB = cB; lead = ahead; }
      }
      const A = at(cut.F, uA, cut.sign * hA), B = at(cut.F, uB, cut.sign * hB);
      // the line through A and B; for two half-turn centres, which lie ON the cut, that is the cut itself
      const m = G.dist(A, B) > 1e-9 ? G.reflect(A, B) : G.reflect(at(cut.F, 0, 0), at(cut.F, 1, 0));
      const a = across(cut.F, uA), b = across(cut.F, uB);
      cones.push(A, B);
      if (lead) { gens.push(mul(a, m), mul(m, b)); order.push(2 * i, 2 * i + 1); } else { gens.push(mul(m, a), mul(b, m)); order.push(2 * i + 1, 2 * i); }
      cut.A = A; cut.B = B; cut.hA = hA; cut.hB = hB; cut.shift = shift;
      cut.seg = [at(cut.F, -cut.L / 2, 0), at(cut.F, cut.L / 2, 0)];
    });
    if (!six) { cones.push(E); gens.push(T3); order.push(4); }
    // which way round each turn goes (they all go the same way: the mirrors make them so): read off, not assumed
    const sense = gens.map((g, i) => {
      const probe = apply(G.translate(O, cones[i]), G.polar(0.7, 0.3)), got = apply(g, probe), ang = TAU / orders[i];
      return G.dist(got, apply(G.rotate(cones[i], ang), probe)) <= G.dist(got, apply(G.rotate(cones[i], -ang), probe)) ? 1 : -1;
    });
    // Y: a point of the middle piece for the tile to be drawn round (its heart); core: one on the seam between
    // cuffs 1 and 2, half way, which no joint of any cut reaches
    return { cones, gens, order, sense, cuts, E, d12, hex, Y: heart, core: at(null, 0, d12 / 2) };
  }

  /**
   * The tile round the point `base`: the points nearer to it than to any of its copies under the group the turns
   * about `built.cones` make. Convex. Its edges are glued in pairs by the group; an edge that a half-turn takes to
   * itself is split at the half-turn's centre into two edges glued to each other.
   * Returns { D, A, own }: D a domain (domains.js makeDomain), A what orbifold.js analyse would say of it, as far as
   * the pattern pane asks: maps (edge i's is the motion that carries the tile onto its neighbour across that edge,
   * the very group element, not one fitted to the corners), classes (the cone points on the tile, one corner each,
   * numbered as the features are) and cls. own: the same tile in its own frame, `base` at the plane's own point
   * ({ at, verts, maps, maps2 (the motions as spinors), edges }): there its numbers are small.
   *
   * Only finitely many copies are looked at, so the polygon found could be too large (a copy that cuts a corner off
   * not yet met). It cannot be too small, and the right tile's area is known (`area`, from the signature): the
   * search for copies goes on until the polygon has that area, and then it IS the tile.
   */
  function dirichlet(built, orders, base, area) {
    const B = G.translate(base, O), Bi = inv(B);
    // The turns, made afresh round `base`, and as spinors (handles.js psu...: a motion as a 2 x 2 complex matrix).
    // About a cone point d away a turn's 3 x 3 matrix has entries of the size e^(2d) and its spinor of the size e^d;
    // the copies wanted are products of several turns that land back near `base`, and with matrices those products
    // lost the digits the tile needs (seen: a short cuff, cone points 4 away, corners shaved by 1e-5 a round).
    const steps = [];
    built.cones.forEach((c, i) => { const g = psu.rotate(G.norm(apply(B, c)), (built.sense[i] * TAU) / orders[i]); steps.push(g, psu.inv(g)); });
    /** Where a motion g takes `base` (the origin, in this frame). */
    const landing = (g) => [2 * (g[0] * g[2] - g[1] * g[3]), 2 * (g[0] * g[3] + g[1] * g[2]), g[0] * g[0] + g[1] * g[1] + g[2] * g[2] + g[3] * g[3]];
    // The polygon, in Klein's picture (lines are straight): corners [X, Y, the copy whose line the edge leaving the
    // corner lies on]. A copy g(base) cuts off what is nearer to it than to base:  x X + y Y <= z - 1  stays.
    // A line that only passes THROUGH a corner cuts nothing: at a cone point of order n the lines of all n - 1
    // powers of its turn meet, and rounding must not let the inner ones shave the corner.
    let poly = [[-1, -1, null], [1, -1, null], [1, 1, null], [-1, 1, null]], rho = Infinity;
    const NEAR = 1e-11, STILL = Math.cosh(0.01);          // a "copy" that near is base itself, come back through rounding (x times its own inverse)
    const FAR = Math.cosh(12);          // a copy further off than this is not looked at: its spinor would be too large to multiply on
    const same = (u, w) => Math.abs(u[0] - w[0]) + Math.abs(u[1] - w[1]) < 1e-6 * (1 + w[2]);
    /**
     * The corners on the plane, each where the lines of the two edges that meet at it cross: worked out on the
     * hyperboloid, where a line is a plane through the origin (the points as far from base as from g(base):
     * those square to g(base) - base). Klein's picture squeezes everything far out against its rim, and a
     * corner read off it seven units out is good to four digits only.
     */
    const corners = () => poly.map((q, k) => {
      const f = poly[(k + poly.length - 1) % poly.length][2].w, g = q[2].w;
      const a = [f[0], f[1], f[2] - 1], b = [g[0], g[1], g[2] - 1];          // the two lines' normals (for the plane's own product)
      const v = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], -(a[0] * b[1] - a[1] * b[0])];
      return G.norm(v[2] < 0 ? [-v[0], -v[1], -v[2]] : v);
    });
    /** The polygon's area (null while it is still open to the rim); sets how far a copy may be and still cut it. */
    const measure = () => {
      const closed = poly.length >= 3 && poly.every((q) => q[2]) && poly.every((q) => q[0] * q[0] + q[1] * q[1] < 0.99999999);
      if (!closed) { rho = Infinity; return null; }
      // (a line through a corner leaves two corners in one place: they are one, or the angle there means nothing)
      const all = corners(), V = all.filter((v, k) => G.dist(v, all[(k + 1) % all.length]) > 1e-7);
      if (V.length < 3) { rho = Infinity; return null; }
      // no copy further than twice the polygon's reach (and a little) can cut it
      rho = Math.cosh(2 * Math.max(...V.map((v) => Math.acosh(Math.max(1, v[2])))) + 0.5);
      return G.area(V);
    };
    const tol = 1e-5 * Math.max(1, area);
    /** Cut the polygon by the copy g(base), if it cuts anything; false if it did not, or was no copy at all. */
    const meet = (g) => {
      const w = landing(g);
      if (!(w[2] > STILL) || w[2] > Math.min(rho, FAR)) return false;          // base itself, or a copy too far to reach the polygon
      // A copy that owns an edge already cuts nothing more. (The same copy comes back as other products, its line a
      // hair off; laid over its own edge, that line would part the edge in two at a corner that is nowhere.)
      if (poly.some((q) => q[2] && same(q[2].w, w))) return false;
      const nrm = Math.hypot(w[0], w[1]) || 1, val = (q) => (w[0] * q[0] + w[1] * q[1] - (w[2] - 1)) / nrm;
      const vals = poly.map(val);
      if (vals.every((v) => v <= NEAR)) return false;
      const el = { g, w }, out = [], before = poly, rhoBefore = rho;
      for (let k = 0; k < poly.length; k++) {
        const q = poly[k], r = poly[(k + 1) % poly.length], vq = vals[k], vr = vals[(k + 1) % poly.length];
        if (vq <= NEAR) out.push(q);
        if ((vq <= NEAR) !== (vr <= NEAR)) { const t = vq / (vq - vr), hit = [q[0] + t * (r[0] - q[0]), q[1] + t * (r[1] - q[1])]; out.push(vq <= NEAR ? [hit[0], hit[1], el] : [hit[0], hit[1], q[2]]); }
      }
      poly = out;
      // Every true copy leaves at least the tile. One that leaves less is no copy: rounding made it (a long
      // product come back near base, a hair off). The polygon is put back.
      const got = measure();
      if (out.length < 3 || (got !== null && got < area - tol)) { poly = before; rho = rhoBefore; return false; }
      return true;
    };
    /** The corners with the copy that owns the edge leaving each; an edge too short to matter left out. */
    const ringOf = () => { const V = corners(); let ring = poly.map((q, k) => ({ p: V[k], f: q[2] })); ring = ring.filter((c, k) => G.dist(c.p, ring[(k + 1) % ring.length].p) > 1e-6); return ring; };
    const partnered = (ring) => ring.map((c) => { const wi = landing(psu.inv(c.f.g)); return same(c.f.w, wi) || ring.some((o) => o !== c && same(o.f.w, wi)); });
    for (const st of steps) meet(st);
    // Then, round after round: the way back of every copy that owns an edge so far, and every product of two of
    // those copies and the turns, until the polygon has the tile's area. A round that finds nothing while the area
    // is still too large looks further: products of three, then of four (a long cut beside a short one: the tile
    // is then closed by copies three turns off, which no two of the nearer ones make). Then one round more: a
    // corner where four tiles nearly meet has an edge too short for its area to show, and that round finds it.
    const round = (deep = 2) => {
      const owners = [...new Set(poly.map((q) => q[2]).filter(Boolean))].map((f) => f.g), wide = [...owners, ...steps];
      let changed = false;
      for (const x of owners) if (meet(psu.inv(x))) changed = true;
      const words = (g, left) => { for (const y of wide) { const h = psu.mul(g, y); if (left > 1) words(h, left - 1); else if (meet(h)) changed = true; } };
      for (const x of wide) words(x, deep - 1);
      return changed;
    };
    const right = () => { const got = measure(); return got !== null && Math.abs(got - area) <= tol; };
    let ok = right(), deep = 2;
    for (let k = 0; k < 24 && !ok; k++) {
      if (round(deep)) { deep = 2; ok = right(); } else if (deep < 4) deep++; else break;
    }
    if (!ok) throw new Error('multi: the tile did not close');
    round();

    // An edge too short to matter is left out (its two corners are one). As a slider moves, the tile's edges come
    // and go: each new one starts with no length, and at that moment rounding can show it on one side of the
    // tile and not yet on the side it is glued to. So a short edge with no partner is left out as well; the tiles
    // across it are still reached, round the corner. An edge a half-turn takes to itself is split at its centre.
    let ring = ringOf();
    for (let pass = 0; pass < 6; pass++) {
      const has = partnered(ring);
      if (has.every(Boolean)) break;
      if (ring.some((c, k) => !has[k] && G.dist(c.p, ring[(k + 1) % ring.length].p) > 0.02)) throw new Error('multi: an edge of the tile has no partner');
      ring = ring.filter((c, k) => has[k]);
    }
    const verts = [], labels = [], maps = [], own = { at: O, verts: [], maps: [], maps2: [] };
    const carry = (f) => G.fix(mul(Bi, mul(psu.toSO21(f.g), B)), 1);          // the group element, in the frame the orbifold is given in
    const put = (p, f, lab) => { verts.push(G.norm(apply(Bi, p))); maps.push(carry(f)); labels.push(lab); own.verts.push(p); own.maps.push(psu.toSO21(f.g)); own.maps2.push(f.g); };
    for (const c of ring) {
      const f = c.f, wi = landing(psu.inv(f.g));
      if (same(f.w, wi)) { put(c.p, f, { f, half: 0 }); put(G.mix(O, f.w, 0.5), f, { f, half: 1 }); } else put(c.p, f, { f, wi, half: -1 });
    }
    const edges = labels.map((l, i) => {
      if (l.half === 0) return { to: i + 1, rev: false };
      if (l.half === 1) return { to: i - 1, rev: false };
      const j = labels.findIndex((o) => o.half === -1 && same(o.f.w, l.wi));
      if (j < 0) throw new Error('multi: an edge of the tile has no partner');
      return { to: j, rev: false };
    });
    const D = makeDomain(G, verts, edges, { at: base });
    own.edges = edges;
    // the cone points on the tile: each one's copy nearest `base` is a corner of it (looked for in the tile's own frame)
    const A = { maps, stars: [], glides: [], pairs: [], letter: [], classes: [], cls: new Array(verts.length).fill(-1) };
    built.cones.forEach((c, f) => {
      const p = intoOwn(own, G.norm(apply(B, c)));
      let best = 0, bd = Infinity;
      own.verts.forEach((v, i) => { const dd = chord(v, p); if (dd < bd) { bd = dd; best = i; } });
      A.classes.push({ id: f, kind: 'cone', n: orders[f], verts: [best], off: bd });
      A.cls[best] = f;
    });
    return { D, A, own };
  }

  /** How far apart two close points are: 2 sinh(d / 2), from their difference (no acosh of a product that is 1 for one point). */
  const chord = (p, q) => { const x = p[0] - q[0], y = p[1] - q[1], z = p[2] - q[2]; return Math.sqrt(Math.max(0, x * x + y * y - z * z)); };
  /** A point brought into the tile `own` (its copy nearest the tile's own point, which is the plane's own). */
  function intoOwn(own, p) {
    const near = own.maps.map((M) => apply(M, O));
    for (let guard = 0; guard < 200; guard++) {
      let best = -1, bd = G.dist(p, O) - 1e-9;
      for (let i = 0; i < near.length; i++) { const d = G.dist(p, near[i]); if (d < bd) { bd = d; best = i; } }
      if (best < 0) break;
      p = G.norm(apply(inv(own.maps[best]), p));
    }
    return p;
  }

  const areaOf = (orders) => TAU * (orders.reduce((s, n) => s + 1 - 1 / n, 0) - 2);
  /** Which pair a feature is of (-1: the cone point left over). */
  const pairOf = (f, n) => (n === 5 && f === 4 ? -1 : f >> 1);
  /** The frame that carries what is tied to feature f: at the cone point, toward its partner (the one left over: toward cuff 1). */
  const frameOf = (b, f) => (pairOf(f, b.cones.length) < 0 ? G.frame(b.cones[f], at(null, b.cuts[0].L / 2, 0)) : G.frame(b.cones[f], b.cones[f ^ 1]));

  /**
   * The print: the Classification page's commas for the signature, tied so that no Twist of any pair breaks one or
   * runs it into another (paisley.js has the reasoning for one cut; here every cut has a joint of its own).
   * The joints part the plane into blocks: beyond each lift of a cut the block of that pair, and what is left, the
   * blocks of the middle piece. A comma is tied whole to a cone point of its pair's block, in that cone point's
   * frame; one in a middle block to that block's own frame (the middle piece of six cone points has no cone point
   * to carry it; of five, the cone point left over).
   * Returns { anchors: [per feature: outlines in its frame], middle: [outlines in the middle piece's frame],
   *           joints, clear, view: the Classification page's first view, as a motion of the frame of build() }.
   */
  function tie(orders, b, shapes) {
    const n = orders.length, { D, A } = dirichlet(b, orders, b.Y, areaOf(orders));
    const ts = tiles(D, A, { radius: 9, max: 2500, ms: 60000 });
    const lim = toSide(G, 7);
    const liftsOf = (cut) => {
      const out = [], seen = new Set(), inner = at(cut.F, 0, cut.sign);          // a point on the pair's side of the cut
      const put = (M) => {
        const p0 = M ? apply(M, cut.seg[0]) : cut.seg[0], p1 = M ? apply(M, cut.seg[1]) : cut.seg[1];
        let m = lineOf(G, p0, p1);
        if (M && Math.abs(side(m, b.core)) > lim) return;
        if (side(m, M ? apply(M, inner) : inner) > 0) m = [-m[0], -m[1], -m[2]];          // the pair on the negative side, the middle piece on the positive
        const key = Math.round(m[0] * 1e5) + ':' + Math.round(m[1] * 1e5) + ':' + Math.round(m[2] * 1e5);
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ m, on: G.mix(p0, p1, 0.5) });
      };
      put(null);
      for (const t of ts) put(t.M);
      return out;
    };
    const lifts = b.cuts.map(liftsOf);
    const copies = b.cones.map((c) => ts.map((t) => apply(t.M, c)));
    const jointsFor = (sh) => b.cuts.map((cut, i) => {
      const cones = [];
      copies.forEach((list, f) => { for (const p of list) cones.push({ p, far: pairOf(f, n) !== i }); });
      return jointOf(G, lifts[i], sh, cones, lifts.flatMap((l, j) => (j === i ? [] : l)));
    });
    /**
     * Where each comma is tied: { f (a feature, or -1: the middle piece), fwd, back (the frame it is kept in), q
     * (that frame's own point) }. In one block: on the same side of every joint of every cut. (A cut through two
     * half-turn centres comes with both its sides named, so "beyond the joint" would be true of every point: only
     * "on the same side as" tells the blocks apart. A cone point ON a joint, a seal's, carries nothing.)
     */
    const assign = (sh, joints) => {
      const cs = joints.map((j) => toSide(G, j.delta));
      const together = (x, q) => { for (let i = 0; i < lifts.length; i++) for (const l of lifts[i]) { const u = side(l.m, q) - cs[i]; if (Math.abs(u) < 1e-7 || (side(l.m, x) - cs[i]) * u < 0) return false; } return true; };
      const firstIn = (x, list, make) => {
        const order = list.map((q, k) => [G.dist(q, x), k]).sort((u, v) => (Math.abs(u[0] - v[0]) > 1e-9 ? u[0] - v[0] : byPlace(flatOf(G, list[u[1]]), flatOf(G, list[v[1]])) || u[1] - v[1]));
        for (let j = 0; j < Math.min(order.length, 60); j++) { const k = order[j][1]; if (together(x, list[k])) return make(k, order[j][0]); }
        return null;
      };
      const cores = ts.map((t) => apply(t.M, b.core));
      return sh.map((one) => {
        const x = midOf(G, one.pts);
        let pick = null;
        copies.forEach((list, f) => { const c = firstIn(x, list, (k, d) => ({ f, q: list[k], d, fwd: mul(ts[k].M, frameOf(b, f)) })); if (c && (!pick || c.d < pick.d - 1e-9)) pick = c; });
        if (!pick) pick = firstIn(x, cores, (k, d) => ({ f: -1, q: cores[k], d, fwd: ts[k].M }));
        return pick && { f: pick.f, q: pick.q, fwd: pick.fwd, back: inv(pick.fwd) };
      });
    };
    let joints = jointsFor(shapes), ties = assign(shapes, joints), fit = 1;
    if (!joints.every((j) => j.clear) && ties.every(Boolean)) {
      // a comma larger than its block: how far in toward what carries it (a cone point; in the middle piece, its own middle) must all be drawn
      const mids = shapes.map((sh) => midOf(G, sh.pts));
      const drawn = (sc) => shapes.map((sh, k) => {
        const t = ties[k];
        if (t.f >= 0) return { pts: sh.pts.map((q) => G.norm(apply(t.fwd, drawnIn(G, G.norm(apply(t.back, q)), sc)))), min: sh.min };
        const to = G.translate(mids[k], O), from = inv(to);
        return { pts: sh.pts.map((q) => G.norm(apply(from, drawnIn(G, G.norm(apply(to, q)), sc)))), min: sh.min };
      });
      const fits = (sc) => { const sh = drawn(sc), js = jointsFor(sh); if (!js.every((j) => j.clear)) return null; const as = assign(sh, js); return as.every((a2, k) => a2 && a2.f === ties[k].f && G.dist(a2.q, ties[k].q) < 1e-6) ? js : null; };
      let lo = 0, hi = 0, found = null;
      for (let sc = 0.96; sc >= 0.34 && !found; sc -= 0.04) { const js = fits(sc); if (js) { found = js; lo = sc; hi = sc + 0.04; } }
      if (found) {
        for (let it = 0; it < 6; it++) { const mid = (lo + hi) / 2, js = fits(mid); if (js) { lo = mid; found = js; } else hi = mid; }
        fit = lo * 0.985;
        joints = fits(fit) || found;
      }
    }
    const anchors = b.cones.map(() => []), middle = [];
    shapes.forEach((sh, k) => {
      const t = ties[k];
      if (!t) return;
      const local = { pts: sh.pts.map((q) => G.norm(apply(t.back, q))), min: sh.min };
      if (t.f >= 0) anchors[t.f].push(local); else middle.push({ ...local, mid: G.norm(apply(t.back, midOf(G, sh.pts))) });
    });
    return { anchors, middle, joints: joints.map((j) => ({ delta: j.delta, clear: j.clear, seal: !!j.seal })), fit, tied: ties.map((t) => (t ? t.f : null)) };
  }

  const prints = new Map();
  /** The family's print at its default numbers (made once): see tie. */
  function printOf(orders) {
    const key = orders.join('');
    if (prints.has(key)) return prints.get(key);
    const d = defaults(orders), b = build(orders, d.L, d.tw);
    const D0 = domainOf({ o: 0, x: 0, cones: orders.slice(), stars: [] });
    // that page's frame to this build's: its polygon's corners onto the cone points
    const M0 = G.fit(d.corners[0], d.corners[1], b.cones[0], b.cones[1], false);
    const off = Math.max(...d.corners.map((c, i) => G.dist(apply(M0, c), b.cones[i])));
    const shapes = design(D0).map((sh) => ({ pts: sh.pts.map((q) => G.norm(apply(M0, q))), min: sh.min }));
    const tied = tie(orders, b, shapes);
    const pr = { ...tied, orders: orders.slice(), base: { L: d.L.slice(), tw: d.tw.slice() }, count: shapes.length, off, view: mul(G.translate(D0.at, O), inv(M0)) };
    prints.set(key, pr);
    return pr;
  }
  /** How large the print is drawn: whole, but drawn in (to its fit) once any Twist has left the print's own. */
  function scaleOf(pr, st) {
    if (!(pr.fit < 1)) return 1;
    let far = 0;
    st.tws.forEach((t, i) => { let d = Math.abs(t - pr.base.tw[i]); d = Math.min(d, Math.abs(1 - d)); far = Math.max(far, d); });
    const x = Math.min(1, far / TURN);
    return pr.fit + (1 - pr.fit) * (1 - x) * (1 - x);
  }

  /**
   * The pattern of a state { orders, Ls, tws, active }, in the frame of its TILE: the tile's own point (a point of
   * the middle piece) at the plane's own.
   *   { D, A (maps, and maps2: the same motions as spinors), home (the cone points), pairs: [{ tree, cut, L, d,
   *     toCut }], shapes, marks (the picked pair's corner classes),
   *     pose   the motion that lays the picked pair level in the middle (as handles.js lays its one pair),
   *     view   the Classification page's first view }
   * Why the tile's frame and not the pair's: with a short cut and cone points of high order a pair stands as far as
   * 5 from the middle piece. In the pair's frame the tile would lie that far out, its corners 11 out, and the
   * motions to its neighbours would be matrices with entries of 1e9: the pattern pane's walk from tile to tile
   * then met the same tile again and again without knowing it (seen: 4,200 tiles listed for 550). In the tile's own
   * frame nothing is further than 6, and the pane is told where to look instead (pose).
   */
  function centred(st) {
    const orders = st.orders, b = build(orders, st.Ls, st.tws), a = st.active || 0;
    const B = G.translate(b.Y, O), Bi = inv(B), move = (p) => G.norm(apply(B, p));
    const got = dirichlet(b, orders, b.Y, areaOf(orders)), own = got.own;
    const D = makeDomain(G, own.verts, own.edges, { at: O }), A = { ...got.A, maps: own.maps, maps2: own.maps2 };
    const A0 = b.cones[2 * a], B0 = b.cones[2 * a + 1], d = G.dist(A0, B0);
    const Q = G.fit(A0, B0, G.polar(d / 2, Math.PI), G.polar(d / 2, 0), false);
    const pr = printOf(orders), sc = scaleOf(pr, st), shapes = [];
    pr.anchors.forEach((list, f) => { if (!list.length) return; const FR = mul(B, frameOf(b, f)); for (const sh of list) shapes.push({ pts: sh.pts.map((q) => G.norm(apply(FR, drawnIn(G, q, sc)))), min: sh.min }); });
    for (const sh of pr.middle) {
      const to = G.translate(sh.mid, O), from = mul(B, inv(to));
      shapes.push({ pts: sh.pts.map((q) => G.norm(apply(from, drawnIn(G, G.norm(apply(to, q)), sc)))), min: sh.min });
    }
    const pairs = b.cuts.map((cut) => ({ tree: [move(cut.A), move(cut.B)], cut: cut.seg.map(move), L: cut.L, d: G.dist(cut.A, cut.B), toCut: G.lineDist(G.mix(cut.A, cut.B, 0.5), cut.seg[0], cut.seg[1]) }));
    return { D, A, home: b.cones.map(move), pairs, shapes, marks: [2 * a, 2 * a + 1], pose: mul(Q, Bi), view: mul(pr.view, Bi), scale: sc, built: b };
  }

  return { defaults, build, dirichlet, at, tie, printOf, scaleOf, centred, areaOf };
}
