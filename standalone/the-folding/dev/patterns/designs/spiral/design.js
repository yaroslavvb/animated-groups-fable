// dev/patterns/designs/spiral/design.js — "Spirals": one spiral arm per fundamental domain.
//
// The motif is ONE closed polygon: a comma whose tail keeps winding. It lives in a convex fundamental domain F of the
// group (the page's default tile: the Dirichlet tile of presets[0]), set back from F's rim by a margin, so its copies
// are disjoint and the print's own symmetry group is the group itself (the mark has no symmetry of its own).
//
// The rule, in four steps (find -> spiralIn -> spiralCore):
//  1. NORMALIZE. A long tile is squeezed along its long axis (the principal axis of its area) until it is as round as
//     its regular cousin (a parallelogram becomes a square, a triangle roughly equilateral), by 2.2 at most and only
//     while it keeps 90 % of its depth. The spiral is drawn in the squeezed tile and stretched back, so a long tile
//     carries an ELLIPTIC spiral, fatter across its ends.
//  2. COORDINATES fitted to the (squeezed) tile:
//       level u in [0, 1]   the family of ROUNDED INSETS of the tile: u = 1 is its rim (corners barely rounded),
//                           u -> 0 shrinks to its middle and gets rounder on the way (an inset polygon opened by a
//                           disc whose radius grows with the depth);
//       turn  x             the share of the way round a level curve (by arc length), counted from a fixed seam.
//  3. THE ARM. A channel winds from its round end beside the head out to its mouth at the rim, widening a little as
//     it goes: as many turns (1.15 to 1.45) as leave the arm between two turns of it its least width; a tile too
//     shallow for that (the strip of *x) gets one loop. Past the mouth the arm's outer edge swings out to the rim over
//     up to half a turn (leaving a bare wedge, which shows the hand from afar), then the tail runs along the rim,
//     thinning as the turn inside it climbs, and ends in a point.
//  4. THE SEAT. Hand, the place of the point (in a corner, or part of the way along a side) and the length of the
//     wedge are searched: the longest wedge that leaves no bare disc wider than 0.4 tile sizes along it, measured on
//     the outline and doubled as if the neighbour across the rim were the mirror image (in a kaleidoscope it is).
//     So the sharp corners of the tile end up under the tail, filled.
//  5. THE SNAIL (13 Nov 2026, second run). A tile too shallow for 1.15 turns (of the 17 default tiles only the strip
//     of *x, which used to get a one-loop hairpin that read as stripes) gets snailIn(): a round curl of about one turn
//     at one end of the strip, its outer whorl running on as a fat body to the other end. See its header.
//
//  6. THE ART DIRECTOR'S ROUND (13 Nov 2026, second run; design.v1.js is the backup, CRITIQUE.md and NOTES.md say why):
//     rounder levels and rim corners (round0, roundPow), longer wedges where the bare-disc limit allows (flares, bareMax)
//     and a slimmer snail body in *x (snail.body, bodyEnd). The rewrites tried as a figure are in exp/ (not used here).
//
// Reads group.e1, e2, reps, domainArea, center, and presets[0] when it is there; without presets the same tile comes
// from a table of the seeds in lattice coordinates (SEEDS). Pure and deterministic; a few milliseconds a group (the
// snail of *x about 15 ms: a traced level set).
import { buildDomain } from '../../../../src/domain.js';

export const meta = { key: 'spiral', label: 'Spirals', hint: 'one spiral arm per tile: a comma whose tail keeps winding' };

const TAU = 2 * Math.PI;

// ---- knobs: lengths in tile sizes (sqrt(domainArea)), the rest dimensionless -------------------------------------
export const KNOBS = {
  margin: 0.026,      // the motif stays this far inside the rim of F: copies are 2 * margin apart
  squash: 1,          // 0: no squeeze (the spiral keeps even widths, a paperclip in a long tile); 1: squeeze a long tile round
  squashCap: 2.2,     // ... by this factor at most,
  keepDepth: 0.9,     // ... and only as far as the tile keeps this share of its depth (a triangle gets shallower as it is squeezed)
  slit: 0.085,        // width of the channel between two turns of the arm (at the middle of its length)
  slitIn: 0.85, slitOut: 1.15,  // ... times this at its round end and at its mouth
  tip: 0.052,         // width of the tail where its point begins
  tipLen: 2.6,        // length of the point, in tip widths
  arm: 0.075,         // least width of the arm between two turns of the channel
  headR: 0.07,        // radius of the head's rim where the channel starts
  floors: { slit: 0.05, tip: 0.042, arm: 0.045, headR: 0.045 },   // no width falls below these, squeezed or shrunk (the channel's round end: slitIn of its floor)
  full: 0.44,         // a tile this deep (inradius less margin) carries the sizes above; a shallower one scales them down ...
  shrink: 0.72,       // ... but never below this factor
  turnsMin: 1.15, turnsMax: 1.45, // turns of the channel
  turnsShort: 0.72,   // ... in a tile too shallow for that: one loop, the head joined to the tail through the rest
  // (13 Nov 2026, the art director's round: longer wedges allowed, so the tail visibly tapers away from the rim where the
  // bare-disc limit lets it - 2222, 22x, 22*, *2222, *632 take 0.62 to 0.7; v1 had at most 0.55. design.v1.js is the backup.)
  flares: [0.7, 0.62, 0.55, 0.47, 0.4, 0.33, 0.27, 0.22],   // turns the outer edge may take to swing out to the rim past the mouth (the bare wedge): the longest that ...
  flareShort: 0.2,    // ... (in a shallow tile: this one)
  bareMax: 0.41,      // ... leaves no bare disc wider than this along the wedge (were the tile's neighbour its mirror image)
  places: [1, 0.8, 0.65, 0.5, 0.35],   // where on a side the tail's point may end: share of the side's length (1: in the corner)
  tries: 12, triesPer: 2,   // how many of the likeliest places are drawn and measured (in all, and for one length of wedge) before the least bare of them is taken
  gamma: 0.8,         // 1: even pitch; < 1: the inner turns are fatter (the arm thins from the head outward)
  round0: 0.034,      // corner radius of the rim (u = 1)   (v1: 0.022; rounder, the art director's round)
  roundIn: 0.97,      // roundness of the innermost levels (1 = circles / stadiums)
  roundPow: 0.38,     // how fast the levels get round with depth   (v1: 0.5; the middle turns rounder, less Greek key)
  aniso: 1,           // what is left long after the squeeze: 0 every side moves in at the same speed, 1 radial scaling
  anisoCap: 2.2,      // ... but no side moves in more than this many times faster than the nearest one
  anisoCapShort: 1.6, // ... in a shallow tile
  // a tile too shallow for 1.15 turns (the strip of *x) carries a SNAIL instead (snailIn); null: the one loop above
  snail: {
    arm: 0.052,       // width of the arm between the turns of the channel in the curl
    slit: 0.047,      // width of the channel in the curl (times slitIn at its round end, slitOut at its mouth)
    head: 0.04,       // radius of the head: the dark round the channel's round end
    turnsMax: 1.35,   // turns of the channel round the head (as many as fit, up to this)
    body: 0.5,        // the body's share of the strip's width where it leaves the curl ...
    bodyEnd: 0.66,    // ... and at the far end (the head of the arm: fat at the far end, tapering into the curl)
                      // (v1: 0.58 / 0.76: the closed Moebius band read as one solid teal band; now a dark stripe beside a light one)
    ramp: 0.05,       // the fillet where the channel's floor leaves the curl for the body
    wedge: 1.1,       // radians past the mouth the arm's outer edge takes to swing out to the rim (the bare wedge)
    nose: 0.5,        // the body's far end rounded: radius = this share of the body's width
    round: 0.03,      // corner radius of the rim
    soft: 0.014,      // the level set's joints rounded by this (smooth min / max)
    grid: 0.0035,     // grid step of the trace
    tol: 0.0004,      // the traced outline thinned to this (Douglas-Peucker)
  },
};

// ---- the fundamental domain ----------------------------------------------------------------------------------------
// The page's default tile is the Dirichlet tile of presets[0]. A group handed over without its presets gets the same
// tile from this table: the seed's place, in lattice coordinates from group.center (dimensionless, so it follows the
// group when it is turned, scaled and shifted). `o` also takes the page's metric (in which e1 and e2 are orthonormal).
const SEEDS = {
  'o': [0, 0], '2222': [-0.25, -0.25], '**': [0, 0], 'xx': [-0.125, 0], '*x': [0, 0], '333': [0, -0.5], '22x': [-0.25, 0],
  '22*': [0, -0.125], '*2222': [-0.25, -0.25], '2*22': [-0.125, -0.125], '442': [0, -0.25],
  '632': [-0.0866025404, -0.3267949192], '3*3': [-0.0577350269, -0.3845299462], '*333': [0, -1 / 3], '4*2': [-0.15, -0.15],
  '*442': [-1 / 3, -1 / 6], '*632': [-1 / 9, -5 / 18],
};
function tilePolygon(group) {
  const pre = group.presets && group.presets[0];
  const { e1, e2 } = group, center = group.center || [(e1[0] + e2[0]) / 2, (e1[1] + e2[1]) / 2];
  let seed, metric;
  if (pre) { seed = pre.seed; metric = pre.metric; } else {
    const st = SEEDS[group.id] || [0, 0];
    seed = [center[0] + st[0] * e1[0] + st[1] * e2[0], center[1] + st[0] * e1[1] + st[1] * e2[1]];
    if (group.reps.length === 1) {                           // the lattice cell itself: the form with e1, e2 orthonormal
      const det = e1[0] * e2[1] - e1[1] * e2[0], r0 = [e2[1] / det, -e2[0] / det], r1 = [-e1[1] / det, e1[0] / det];
      metric = [r0[0] * r0[0] + r1[0] * r1[0], r0[0] * r0[1] + r1[0] * r1[1], r0[1] * r0[1] + r1[1] * r1[1]];
    }
  }
  let d;
  try { d = buildDomain(group, { seed, metric }); } catch (e) { d = buildDomain(group, { seed: [center[0] + 0.137 * e1[0] + 0.071 * e2[0], center[1] + 0.137 * e1[1] + 0.071 * e2[1]] }); }   // any tile will do
  return d.poly.map((p) => [p[0], p[1]]);
}

/** The polygon without zero-length edges, and its sides: outward unit normal, offset h (n.x = h on the side), angle of the normal. */
function sidesOf(poly0, eps) {
  const poly = [];
  for (let i = 0; i < poly0.length; i++) { const a = poly0[i], b = poly0[(i + 1) % poly0.length]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) > eps) poly.push([a[0], a[1]]); }
  const S = [], n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    const nx = dy / len, ny = -dx / len;                       // outward normal of a counter-clockwise polygon
    S.push({ nx, ny, h: nx * a[0] + ny * a[1], len, ang: Math.atan2(ny, nx) });
  }
  return { poly, S };
}

const wrap = (a) => { a %= TAU; return a < 0 ? a + TAU : a; };

/** The convex polygon with every side moved in by d (sides that vanish are dropped). */
function insetPolygon(poly, S, d) {
  let P = poly.map((p) => [p[0], p[1]]);
  for (const s of S) {
    const c = s.h - d, Q = [];
    for (let i = 0; i < P.length; i++) {
      const p = P[i], q = P[(i + 1) % P.length];
      const sp = s.nx * p[0] + s.ny * p[1] - c, sq = s.nx * q[0] + s.ny * q[1] - c;
      if (sp <= 0) Q.push(p);
      if ((sp <= 0) !== (sq <= 0)) { const w = sp / (sp - sq); Q.push([p[0] + w * (q[0] - p[0]), p[1] + w * (q[1] - p[1])]); }
    }
    P = Q;
    if (P.length < 3) break;
  }
  return P;
}

/** Centroid, long axis (angle) and aspect (ratio of the principal radii of gyration) of a polygon's area. */
function shapeOf(poly) {
  let A = 0, cx = 0, cy = 0, ixx = 0, iyy = 0, ixy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], w = p[0] * q[1] - q[0] * p[1];
    A += w; cx += (p[0] + q[0]) * w; cy += (p[1] + q[1]) * w;
    ixx += (p[0] * p[0] + p[0] * q[0] + q[0] * q[0]) * w; iyy += (p[1] * p[1] + p[1] * q[1] + q[1] * q[1]) * w;
    ixy += (p[0] * q[1] + 2 * p[0] * p[1] + 2 * q[0] * q[1] + q[0] * p[1]) * w;
  }
  A /= 2; cx /= 6 * A; cy /= 6 * A;
  const sxx = ixx / (12 * A) - cx * cx, syy = iyy / (12 * A) - cy * cy, sxy = ixy / (24 * A) - cx * cy;
  const mean = (sxx + syy) / 2, dev = Math.hypot((sxx - syy) / 2, sxy);
  const aspect = Math.sqrt((mean + dev) / Math.max(1e-12 * mean, mean - dev));
  return { cx, cy, aspect, angle: aspect > 1 + 1e-6 ? 0.5 * Math.atan2(2 * sxy, sxx - syy) : 0 };
}

/** The largest inscribed circle: its radius and the middle of the set of its centres (a point, or a segment's middle). */
function chebyshev(S, scale) {
  const n = S.length, tol = 1e-9 * scale;
  let best = -1; const sols = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    const a = S[i], b = S[j], c = S[k];
    // n.x + r = h for the three sides
    const det = a.nx * (b.ny - c.ny) - a.ny * (b.nx - c.nx) + (b.nx * c.ny - b.ny * c.nx);
    if (Math.abs(det) < 1e-9) continue;
    const x = (a.h * (b.ny - c.ny) - a.ny * (b.h - c.h) + (b.h * c.ny - b.ny * c.h)) / det;
    const y = (a.nx * (b.h - c.h) - a.h * (b.nx - c.nx) + (b.nx * c.h - b.h * c.nx)) / det;
    const r = a.h - a.nx * x - a.ny * y;
    if (r <= 0) continue;
    let ok = true;
    for (const s of S) if (s.nx * x + s.ny * y + r > s.h + tol) { ok = false; break; }
    if (!ok) continue;
    sols.push([x, y, r]);
    if (r > best) best = r;
  }
  let cx = 0, cy = 0, m = 0;
  for (const s of sols) if (s[2] > best - 1e-7 * scale) { cx += s[0]; cy += s[1]; m++; }
  return { r: best, cx: cx / m, cy: cy / m };
}

// ---- the family of level curves ------------------------------------------------------------------------------------
/**
 * Level curves of a convex polygon: K(t) = (the polygon with side i moved in by kappa_i t + rho(t)) grown by rho(t),
 * t in [0, T). point(u, f, out): the point of the level u = 1 - t / T at the share f of its length past the seam (the
 * point whose outward normal is nu). length(u): the length of that level curve.
 */
function makeFamily(poly, S, T, kappa, rhoOf, nuAng) {
  const n = S.length, CAP = 4 * n + 8;
  let px = new Float64Array(CAP), py = new Float64Array(CAP), qx = new Float64Array(CAP), qy = new Float64Array(CAP);
  let pl = new Int32Array(CAP), ql = new Int32Array(CAP);
  const sw = new Float64Array(CAP), ln = new Float64Array(CAP);
  let cnt = 0, rho = 0, total = 0, seam = 0, cur = NaN;

  function build(u) {
    if (u === cur) return;
    cur = u;
    const t = (1 - u) * T;
    rho = rhoOf(t);
    cnt = n;
    for (let i = 0; i < cnt; i++) { px[i] = poly[i][0]; py[i] = poly[i][1]; pl[i] = i; }
    for (let k = 0; k < n; k++) {
      const s = S[k], c = s.h - (kappa[k] * t + rho);
      let c2 = 0;
      for (let i = 0; i < cnt; i++) {
        const j = i + 1 === cnt ? 0 : i + 1;
        const si = s.nx * px[i] + s.ny * py[i] - c, sj = s.nx * px[j] + s.ny * py[j] - c;
        const inI = si <= 0, inJ = sj <= 0;
        if (inI) { qx[c2] = px[i]; qy[c2] = py[i]; ql[c2] = pl[i]; c2++; }
        if (inI !== inJ) {
          const w = si / (si - sj);
          qx[c2] = px[i] + w * (px[j] - px[i]); qy[c2] = py[i] + w * (py[j] - py[i]); ql[c2] = inI ? k : pl[i]; c2++;
        }
      }
      let tmp = px; px = qx; qx = tmp; tmp = py; py = qy; qy = tmp; tmp = pl; pl = ql; ql = tmp; cnt = c2;
      if (!cnt) break;
    }
    // drop zero-length edges (their label goes with them)
    if (cnt > 1) {
      let c3 = 0;
      for (let i = 0; i < cnt; i++) {
        const j = i + 1 === cnt ? 0 : i + 1;
        if (Math.hypot(px[j] - px[i], py[j] - py[i]) > 1e-11 * T) { qx[c3] = px[i]; qy[c3] = py[i]; ql[c3] = pl[i]; c3++; }
      }
      if (c3 === 0) { qx[0] = px[0]; qy[0] = py[0]; ql[0] = pl[0]; c3 = 1; }
      let tmp = px; px = qx; qx = tmp; tmp = py; py = qy; qy = tmp; tmp = pl; pl = ql; ql = tmp; cnt = c3;
    }
    total = 0; seam = 0;
    let seamSet = false;
    for (let i = 0; i < cnt; i++) {
      const j = i + 1 === cnt ? 0 : i + 1, h = i === 0 ? cnt - 1 : i - 1;
      const a0 = S[pl[h]].ang;
      sw[i] = cnt > 1 ? wrap(S[pl[i]].ang - a0) : TAU;
      ln[i] = Math.hypot(px[j] - px[i], py[j] - py[i]);
      const off = wrap(nuAng - a0);
      if (!seamSet && off < sw[i]) { seam = total + rho * off; seamSet = true; }
      total += rho * sw[i] + ln[i];
    }
  }

  function point(u, f, out) {
    build(u);
    let pos = (seam + (f - Math.floor(f)) * total) % total;
    for (let i = 0; i < cnt; i++) {
      const h = i === 0 ? cnt - 1 : i - 1, al = rho * sw[i];
      if (pos <= al) { const a = S[pl[h]].ang + pos / rho; out[0] = px[i] + rho * Math.cos(a); out[1] = py[i] + rho * Math.sin(a); return out; }
      pos -= al;
      if (pos <= ln[i]) {
        const j = i + 1 === cnt ? 0 : i + 1, s = S[pl[i]], w = ln[i] > 0 ? pos / ln[i] : 0;
        out[0] = px[i] + w * (px[j] - px[i]) + rho * s.nx; out[1] = py[i] + w * (py[j] - py[i]) + rho * s.ny; return out;
      }
      pos -= ln[i];
    }
    const a = S[pl[cnt - 1]].ang; out[0] = px[0] + rho * Math.cos(a); out[1] = py[0] + rho * Math.sin(a);
    return out;
  }
  /** The point of the level u nearest to (vx, vy), a point outside it. */
  function nearest(u, vx, vy, out) {
    build(u);
    let bx = px[0], by = py[0], bd = Infinity;
    for (let i = 0; i < cnt; i++) {
      const j = i + 1 === cnt ? 0 : i + 1, dx = px[j] - px[i], dy = py[j] - py[i], l2 = dx * dx + dy * dy;
      let w = l2 > 0 ? ((vx - px[i]) * dx + (vy - py[i]) * dy) / l2 : 0; w = w < 0 ? 0 : w > 1 ? 1 : w;
      const x = px[i] + w * dx, y = py[i] + w * dy, d = Math.hypot(vx - x, vy - y);
      if (d < bd) { bd = d; bx = x; by = y; }
    }
    if (bd > 0) { out[0] = bx + (rho * (vx - bx)) / bd; out[1] = by + (rho * (vy - by)) / bd; } else { out[0] = bx; out[1] = by; }
    return out;
  }
  return { point, nearest, length(u) { build(u); return total; } };
}

// ---- sampling a curve x -> point finely enough -------------------------------------------------------------------
function sampleCurve(fn, s0, s1, n0, tol, maxSeg, out) {
  const A = [0, 0], B = [0, 0], M = [0, 0];
  const rec = (sa, ax, ay, sb, bx, by, depth) => {
    const sm = (sa + sb) / 2;
    fn(sm, M);
    const mx = M[0], my = M[1];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
    const dev = L > 0 ? Math.abs((mx - ax) * dy - (my - ay) * dx) / L : Math.hypot(mx - ax, my - ay);
    const along = L > 0 ? Math.abs(((mx - ax) * dx + (my - ay) * dy) / L - L / 2) : 0;
    if (depth < 12 && (dev > tol || L > maxSeg || along > 0.2 * L + tol)) {
      rec(sa, ax, ay, sm, mx, my, depth + 1);
      out.push([mx, my]);
      rec(sm, mx, my, sb, bx, by, depth + 1);
    }
  };
  fn(s0, A);
  out.push([A[0], A[1]]);
  let pa = [A[0], A[1]], sa = s0;
  for (let i = 1; i <= n0; i++) {
    const sb = s0 + ((s1 - s0) * i) / n0;
    fn(sb, B);
    rec(sa, pa[0], pa[1], sb, B[0], B[1], 0);
    out.push([B[0], B[1]]);
    pa = [B[0], B[1]]; sa = sb;
  }
  return out;
}

// ---- where the spiral sits in the tile: its hand, where its tail ends, the length of the wedge -------------------------
/**
 * The tail runs along the rim and ends in a point, in a corner or part of the way along a side; from the mouth beside
 * the point the rim is bare for `flare` turns (the wedge: the outer edge of the turn before has still to swing out to
 * the rim). What lies under the tail is filled. In the wedge the rim is bare as far as the outer edge stays away, a
 * corner worst of all (the levels round a corner off, a sharp one from far away), and were the neighbour across the
 * rim a mirror image the bare disc there would be twice that wide.
 * seats() lists, for one length of wedge, every (hand, side, place on it) with a quick estimate of that disc, the
 * likeliest first: those whose estimate is near the limit K.bareMax before the others, then a point in a corner
 * before a point on a side, then the smaller estimate, then the point nearest G.ref (so that the choice among places
 * a symmetry of the TILE makes equal does not depend on how the tile happens to be listed).
 *   ang[j]                the true interior angle at vertex j (the polygon may be squeezed)
 *   G.nearest(u, x, y, out)   the point of the level curve u nearest to (x, y);  G.level(flare, y)  the level of the outer edge y turns past the mouth
 *   G.tipLen, G.rho0, G.m, G.ts, G.squeeze, G.ref   the length of the tail's point, the rim's corner radius, the margin and the tile size (true lengths), the squeeze, a fixed point
 */
function seats(poly, S, ang, flare, G, K) {
  const n = poly.length, cum = [0];
  for (let j = 0; j < n; j++) cum.push(cum[j] + S[j].len);
  const per = cum[n];
  const pointAt = (s) => {
    s -= Math.floor(s / per) * per;
    let j = 0; while (j < n - 1 && s >= cum[j + 1]) j++;
    const w = (s - cum[j]) / S[j].len, a = poly[j], b = poly[(j + 1) % n];
    return [a[0] + w * (b[0] - a[0]), a[1] + w * (b[1] - a[1])];
  };
  const tau = [], beta = [];                                            // the rim's corner arc starts tau before the vertex
  for (let j = 0; j < n; j++) { tau.push(G.rho0 * Math.tan(wrap(S[j].ang - S[(j + n - 1) % n].ang) / 2)); beta.push(1 / Math.max(0.05, Math.sin(ang[j] / 2))); }
  const real = (dx, dy) => Math.hypot(G.squeeze * dx, dy), near = [0, 0], NS = 14;
  const list = [];
  for (let pass = 0; pass < 2 && !list.length; pass++) for (const ccw of [true, false]) for (let t = 0; t < n; t++) for (const pl of K.places) {
    const dir = ccw ? 1 : -1, kEnd = ccw ? (t + 1) % n : t, kStart = ccw ? t : (t + 1) % n;
    const flat = S[t].len - tau[kEnd] - tau[kStart];                    // the straight part of the side the tail ends on
    if (pass === 0 ? pl * flat < G.tipLen : pl < 1 || flat <= 0) continue;   // no room for the point (second pass: any corner, a shorter point)
    const gap = tau[kEnd] + (1 - pl) * flat;                            // from the point's end to the corner ahead
    const sE = ccw ? cum[t + 1] - gap : cum[t] + gap;
    list.push({ ccw, t, pl, flare, gap, dir, sM: sE - dir * G.tipLen, E: pointAt(sE), est: 0 });
  }
  const look = (c, R, u, extra) => {
    G.nearest(u, R[0], R[1], near);
    const d = Math.min(real(near[0] - R[0], near[1] - R[1]), real(c.E[0] - R[0], c.E[1] - R[1]));
    c.est = Math.max(c.est, (2 * (d + extra)) / G.ts);
  };
  for (let i = 0; i < NS; i++) {                                        // along the wedge (one level curve serves every place)
    const y = (flare * (i + 0.5)) / NS, u = G.level(flare, y);
    for (const c of list) look(c, pointAt(c.sM + c.dir * y * per), u, G.m);
  }
  for (const c of list) for (let j = 0; j < n; j++) {                   // and at the corners in it
    let y = (c.dir * (cum[j] - c.sM)) / per; y -= Math.floor(y);
    if (y < flare) look(c, poly[j], G.level(flare, y), G.m * beta[j]);
  }
  for (const c of list) c.key = [c.est <= 1.15 * K.bareMax ? 1 : 0, c.pl === 1 ? 1 : 0, -Math.round(c.est * 1e5) / 1e5, -Math.round((real(c.E[0] - G.ref[0], c.E[1] - G.ref[1]) / G.ts) * 1e5) / 1e5, c.ccw ? 1 : 0];
  list.sort((p, q) => { for (let i = 0; i < p.key.length; i++) if (p.key[i] !== q.key[i]) return q.key[i] - p.key[i]; return 0; });
  return list;
}

// ---- the spiral in a (squeezed) polygon: the rim IS the polygon ------------------------------------------------------
/**
 * ts: the tile size the sizes are counted in; floor: the real tile size (no width below K.floors of it); squeeze: true
 * lengths along x are this many times the polygon's; ref: a fixed point (ties between equal places go to the nearer).
 */
function spiralCore(poly0, ang, ts, floor, squeeze, ref, K) {
  const first = sidesOf(poly0, 1e-9 * ts);
  const che = chebyshev(first.S, ts), T = che.r;
  // sizes and turns
  const size = (sc) => ({
    c: Math.max(K.slit * ts * sc, K.floors.slit * floor), wTip: Math.max(K.tip * ts * sc, K.floors.tip * floor),
    wArm: Math.max(K.arm * ts * sc, K.floors.arm * floor), hR: Math.max(K.headR * ts * sc, K.floors.headR * floor),
  });
  let sc = Math.min(1, Math.max(K.shrink, T / (K.full * ts)));
  let z = size(sc);
  // as many turns as leave the arm its least width where it is thinnest (beside the mouth: the pitch shrinks outward
  // when gamma < 1, and the channel widens)
  // (the taper is given up, half of it, then all of it, where it would cost the tile its spiral)
  let nS = 1, gamma = 1;
  for (const gm of [K.gamma, (K.gamma + 1) / 2, 1]) {
    const armEnd = (nT) => (T - z.c * K.slitOut - z.wTip - z.hR) * (1 - Math.pow((nT - 1) / nT, gm)) - z.c * (K.slitIn + ((K.slitOut - K.slitIn) * (nT - 1)) / nT);
    nS = 1; gamma = gm;
    if (armEnd(1.0001) >= z.wArm) { let lo = 1.0001, hi = 4; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (armEnd(mid) >= z.wArm) lo = mid; else hi = mid; } nS = lo; }
    if (nS >= K.turnsMin + 0.08) break;
  }
  const deep = nS >= K.turnsMin;
  if (deep) nS = Math.min(nS, K.turnsMax);
  else {                                                     // one loop: bold, in the real tile's own sizes
    sc = Math.min(1, T / ((K.headR + K.slit * K.slitOut + 1.25 * K.arm) * floor));
    z = { c: K.slit * floor * sc, wTip: Math.max(K.tip * sc, K.floors.tip) * floor, wArm: K.arm * floor * sc, hR: K.headR * floor * sc };
    nS = K.turnsShort;
  }
  const { c, wTip, hR } = z;
  const cu = c / T, wt = wTip / T, e0 = hR / T;
  const b1 = 1 - cu * K.slitOut - wt;                                           // the level of the channel's inner wall at the mouth
  const gB = (gamma * (b1 - e0)) / nS;                                          // the climb of that wall per turn, at the mouth
  const flareAt = (dF, y) => {                                                  // the outer edge y turns past the mouth: out to the rim in dF turns
    const q = y / dF;
    if (q >= 1) return 1;
    const q2 = q * q, q3 = q2 * q;
    return b1 * (2 * q3 - 3 * q2 + 1) + dF * gB * (q3 - 2 * q2 + q) + (3 * q2 - 2 * q3);
  };
  const cuAt = (x) => cu * (K.slitIn + (K.slitOut - K.slitIn) * Math.min(1, Math.max(0, (x - 1) / nS)));   // the channel widens toward its mouth
  // B: the rim of the turn inside the channel (the head's rim first), from the channel's round end to its mouth
  const B = (x) => e0 + (b1 - e0) * Math.pow(Math.min(1, Math.max(0, x / nS)), gamma);
  const cap = deep ? K.anisoCap : K.anisoCapShort;
  const kappaOf = (S, cx, cy) => S.map((s) => Math.min(cap, Math.pow(Math.max(1, (s.h - s.nx * cx - s.ny * cy) / T), K.aniso)));
  const lam0 = Math.min(0.5, (K.round0 * ts) / T);
  const rhoOf = (t) => { const x = Math.min(1, Math.max(0, t / T)); return (T - t) * (lam0 + (K.roundIn - lam0) * Math.pow(x, K.roundPow)); };
  const tipLen = K.tipLen * wTip, rho0 = K.round0 * ts, m = K.margin * floor;

  // the places it may sit, the likeliest first
  const F0 = makeFamily(first.poly, first.S, T, kappaOf(first.S, che.cx, che.cy), rhoOf, 0.1);
  const minFlare = (tipLen + 1.3 * c * K.slitOut) / F0.length(1);               // never shorter than the mouth
  const G = { tipLen, rho0, m, ts: floor, squeeze, ref, nearest: F0.nearest, level: (flare, y) => flareAt(Math.max(flare, minFlare), y) };

  /** The outline for one place, and the widest bare disc along its wedge (measured on the outline itself). */
  function draw(st) {
    const N0 = first.poly.length, order = [];
    for (let i = 0; i < N0; i++) order.push((st.ccw ? st.t + 1 + i : st.t - i + N0) % N0);
    // re-indexed (and mirrored for a clockwise spiral): counter-clockwise, the tail's last run is the LAST side
    const { poly, S } = sidesOf(order.map((j) => (st.ccw ? [first.poly[j][0], first.poly[j][1]] : [-first.poly[j][0], first.poly[j][1]])), 1e-9 * ts);
    const n = S.length, dF = Math.max(st.flare, minFlare);
    const che2 = chebyshev(S, ts);
    // the seam: the bisector of corner 0 (between the last side, where the tail ends, and side 0)
    const nuAng = S[n - 1].ang + wrap(S[0].ang - S[n - 1].ang) / 2;
    const kap = kappaOf(S, che2.cx, che2.cy);
    const F = makeFamily(poly, S, T, kap, rhoOf, nuAng);
    const L0 = F.length(1);
    // The tail's point lies on the last side and ends `gap` short of corner 0 (in the corner itself, or part of the
    // way along the side). In the frame of that side (xi along it, eta the depth inside it) the tail's inner wall runs
    // level at eta = etaFlat until it leaves the side to turn the corner ahead (xiDep); the point begins no later
    // than that, and from there the wall is drawn to the rim.
    const turn0 = wrap(S[0].ang - S[n - 1].ang), tau0 = rho0 * Math.tan(turn0 / 2);
    const sideT = S[n - 1], Ax = poly[n - 1][0], Ay = poly[n - 1][1], dx = -sideT.ny, dy = sideT.nx, q = [0, 0];
    const frame = (pt) => [(pt[0] - Ax) * dx + (pt[1] - Ay) * dy, sideT.h - pt[0] * sideT.nx - pt[1] * sideT.ny];
    const u1 = 1 - wt, etaFlat = kap[n - 1] * wTip;                             // the level and the depth of the tail's inner wall at the mouth
    let xiDep = 0, etaMin = Infinity;
    for (let i = 0; i <= 80; i++) {                                             // back along the level from the seam
      F.point(u1, -0.4 * (i / 80), q);
      const [xi, eta] = frame(q);
      if (eta < etaMin) { etaMin = eta; xiDep = xi; }
      if (eta <= 1.03 * etaFlat) { xiDep = xi; break; }
    }
    const xiE0 = sideT.len - st.gap;                                            // where the point is meant to end ...
    const xiS = Math.min(xiE0 - tipLen, xiDep - 0.01 * ts);                     // ... and to begin
    const fE = -((rho0 * turn0) / 2 + (st.gap - tau0)) / L0;                    // its end, in turns from the seam
    const Eo = (x) => (x <= nS ? B(x) : flareAt(dF, x - nS));
    const x1 = nS + 1, xE0 = x1 + (xiE0 - xiS) / L0;                            // the mouth, the point's end
    const sA = fE - xE0;
    const Ei = (x) => B(x - 1) + cuAt(x);                                       // (level u1 from the mouth on)
    const outerAt = (x, o) => F.point(Eo(x), sA + x, o), innerAt = (x, o) => F.point(Ei(x), sA + x, o);

    // the channel's round end: a half circle on the chord P Q across the channel, square to the wall at P
    const P = outerAt(0, [0, 0]), P2 = outerAt(1e-4, [0, 0]);
    let tx = P2[0] - P[0], ty = P2[1] - P[1]; { const l = Math.hypot(tx, ty); tx /= l; ty /= l; }
    const Q = [0, 0], along = (x) => { innerAt(x, Q); return (Q[0] - P[0]) * tx + (Q[1] - P[1]) * ty; };
    let xa = 1, fa = along(xa), xb = 1 + 0.02, fb = along(xb);
    for (let it = 0; it < 12 && Math.abs(fb) > 1e-9 * ts && fb !== fa; it++) { const xn = Math.max(1 - 0.08, Math.min(1 + 0.08, xb - (fb * (xb - xa)) / (fb - fa))); xa = xb; fa = fb; xb = xn; fb = along(xb); }
    const xQ = xb; innerAt(xQ, Q);

    // The inner wall runs to where the point begins: at xi = xiS on the last side, but not before it has come out of
    // the corner behind and runs level with the side (a sharp corner keeps a wall away from the side for long).
    const wall = (x) => frame(innerAt(x, q));
    const W = [];
    for (let k = 0; k <= 62; k++) { const x = x1 - 0.42 + 0.01 * k, w = wall(x); W.push([x, w[0], w[1]]); }
    let k0 = -1;                                                                // the first stretch that runs level along the side
    for (let k = 0; k + 1 < W.length && k0 < 0; k++) {
      const a = W[k], b = W[k + 1];
      if (a[2] <= 3 * etaFlat && b[2] <= 3 * etaFlat && b[1] > a[1] && Math.abs(b[2] - a[2]) <= 0.15 * (b[1] - a[1])) k0 = k;
    }
    let xW = x1;
    if (k0 >= 0) {
      let k1 = k0;
      while (k1 + 1 < W.length && W[k1][1] < xiS && W[k1 + 1][1] > W[k1][1] && W[k1 + 1][2] <= 3 * etaFlat) k1++;
      xW = W[k1][0];
      if (k1 > k0 && W[k1][1] >= xiS) { let lo = W[k1 - 1][0], hi = W[k1][0]; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (wall(mid)[0] < xiS) lo = mid; else hi = mid; } xW = (lo + hi) / 2; }
    }
    const [xiW, etaW] = wall(xW);
    // the point ends where it was meant to, or its own length past its beginning if that is further (never past the corner)
    const xiE = Math.max(xiE0, Math.min(xiW + tipLen, sideT.len - tau0)), xE = xE0 + (xiE - xiE0) / L0, gap = sideT.len - xiE;

    const tol = 0.00025 * ts, maxSeg = 0.3 * ts;
    const pts = [];
    sampleCurve(outerAt, 0, xE, Math.ceil(40 * xE), tol, maxSeg, pts);          // the head's rim, the arm's outer edge, the rim to the point's end
    // the point: from the wall to the rim, squared (a short point on a side, a long one into a sharp corner)
    const NT = 14;
    for (let k = NT - 1; k >= 1; k--) {
      const y = k / NT, xi = xiW + (xiE - xiW) * y, dep = etaW * (1 - y * y);
      pts.push([Ax + xi * dx - dep * sideT.nx, Ay + xi * dy - dep * sideT.ny]);
    }
    const inner = [];
    sampleCurve(innerAt, xQ, xW, Math.ceil(40 * (xW - xQ)), tol, maxSeg, inner); // the channel's outer wall, from its round end to the point
    for (let i = inner.length - 1; i >= 0; i--) pts.push(inner[i]);
    // the channel's round end, from Q back round to P: a half circle but for the walls not being quite parallel (a
    // cubic that leaves each wall along it)
    const Q2 = innerAt(xQ + 1e-4, [0, 0]);
    let ux = Q2[0] - Q[0], uy = Q2[1] - Q[1]; { const l = Math.hypot(ux, uy); ux /= l; uy /= l; }
    const hk = (2 / 3) * Math.hypot(Q[0] - P[0], Q[1] - P[1]), NC = 22;
    for (let i = 1; i < NC; i++) {
      const v = i / NC, w = 1 - v, b0 = w * w * w, b1c = 3 * w * w * v, b2 = 3 * w * v * v, b3 = v * v * v;
      pts.push([b0 * Q[0] + b1c * (Q[0] - hk * ux) + b2 * (P[0] - hk * tx) + b3 * P[0], b0 * Q[1] + b1c * (Q[1] - hk * uy) + b2 * (P[1] - hk * ty) + b3 * P[1]]);
    }

    // the widest bare disc along the wedge: from the point's end on along the rim, how far is the outline? (true
    // lengths; twice that and the margin, as if the neighbour across the rim were the mirror image)
    const M = pts.length, X = new Float64Array(M), Y = new Float64Array(M);
    for (let i = 0; i < M; i++) { X[i] = squeeze * pts[i][0]; Y[i] = pts[i][1]; }
    const away = (px, py) => {
      px *= squeeze;
      let best = Infinity;
      for (let i = 0, j = M - 1; i < M; j = i++) {
        const ex = X[i] - X[j], ey = Y[i] - Y[j], l2 = ex * ex + ey * ey;
        let w = l2 > 0 ? ((px - X[j]) * ex + (py - Y[j]) * ey) / l2 : 0; w = w < 0 ? 0 : w > 1 ? 1 : w;
        const d = Math.hypot(px - X[j] - w * ex, py - Y[j] - w * ey);
        if (d < best) best = d;
      }
      return best;
    };
    let bare = 0, run = -gap;                                                   // run: length along the rim past corner 0
    const reach = dF * L0 + 0.15 * ts, step = 0.035 * ts;
    for (let k = 1; gap - k * step > 0; k++) bare = Math.max(bare, 2 * (away(poly[0][0] - (gap - k * step) * dx, poly[0][1] - (gap - k * step) * dy) + m));
    run = 0;
    for (let j = 0; j < n && run < reach; j++) {
      const a = poly[j], b = poly[(j + 1) % n], len = S[j].len, beta = 1 / Math.max(0.05, Math.sin(ang[order[j]] / 2));
      bare = Math.max(bare, 2 * (away(a[0], a[1]) + m * beta));
      for (let w = step; w < len && run + w < reach; w += step) bare = Math.max(bare, 2 * (away(a[0] + (w / len) * (b[0] - a[0]), a[1] + (w / len) * (b[1] - a[1])) + m));
      run += len;
    }
    if (!st.ccw) for (const p of pts) p[0] = -p[0];
    return { pts, bare: bare / floor, gap, dF };
  }

  // the longest wedge first; a place is taken when the disc measured on its outline is within the limit
  let best = null, bestSt = null, tried = 0;
  search: for (const flare of deep ? K.flares : [K.flareShort]) {
    let here = 0;
    for (const st of seats(first.poly, first.S, ang, flare, G, K)) {
      if (best && st.est > 1.15 * K.bareMax) break;                             // no hope with this wedge: a shorter one
      const d = draw(st);
      tried++; here++;
      if (!best || d.bare < best.bare) { best = d; bestSt = st; }
      if (d.bare <= K.bareMax || tried >= K.tries) break search;
      if (here >= K.triesPer) break;
    }
  }
  return { pts: best.pts, info: { turns: +nS.toFixed(3), deep, taper: gamma, scale: +sc.toFixed(3), depth: +(T / ts).toFixed(3), slit: +(c / floor).toFixed(3), hand: bestSt.ccw ? 'ccw' : 'cw', side: bestSt.t, flare: +best.dF.toFixed(3), gap: +(best.gap / floor).toFixed(3), wedge: +best.bare.toFixed(3), est: +bestSt.est.toFixed(3), tried } };
}

// ---- the snail: the spiral of a tile too shallow for one (the strip of *x) --------------------------------------
// The strip of *x is 0.43 tile sizes across and 5.3 times as long: across it there is no room for 1.15 turns of arm
// and channel. So the spiral is wound at one END: a round curl of about one turn of channel round the head, whose
// outer whorl runs round the end of the strip along the rim and leaves it along one long side as a fat BODY to the
// far end (rounded there: the arm is fat at that end and tapers into the curl). Over the body a bare channel runs
// from the far end to the curl and becomes the channel between the turns; past its mouth a bare wedge shows the hand,
// as in the deep spiral. Across the mirror on the channel's side the channel meets its mirror image, so it is kept
// to about a third of the strip.
// Built as a level set, dark <=> f < 0, f = max(rim, -bare), bare = channel in the curl U wedge U channel over the
// body (smooth unions: no corner), traced on a fine grid (marching squares) and thinned (Douglas-Peucker).
// Canonical frame: the long axis is X, the curl at the low-X end, the body along the low-Y side; the channel in the
// curl winds clockwise out from its round end and leaves at the top of the curl heading +X.
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
function smax(a, b, k) { return -smin(-a, -b, k); }

/** Signed distance to a convex counter-clockwise polygon [[x, y]...] (negative inside). */
function sdConvex(P, x, y) {
  let d2 = Infinity, out = false;
  for (let i = 0, n = P.length; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n], ex = b[0] - a[0], ey = b[1] - a[1], l2 = ex * ex + ey * ey;
    let t = l2 > 0 ? ((x - a[0]) * ex + (y - a[1]) * ey) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = x - a[0] - t * ex, dy = y - a[1] - t * ey, q = dx * dx + dy * dy;
    if (q < d2) d2 = q;
    if (ex * (y - a[1]) - ey * (x - a[0]) < 0) out = true;
  }
  return out ? Math.sqrt(d2) : -Math.sqrt(d2);
}

/**
 * The loops of the zero set of a grid F (F[j * nx + i] at (x0 + i g, y0 + j g), every border value > 0): marching
 * squares, dark (F < 0) on the left of every loop, so an outer loop runs counter-clockwise. A saddle is decided by the
 * mean of its four corners.
 */
function traceLoops(F, nx, ny, x0, y0, g) {
  const H = (i, j) => 2 * (j * nx + i), V = (i, j) => 2 * (j * nx + i) + 1;   // the edge (i,j)-(i+1,j), (i,j)-(i,j+1)
  const next = new Map(), pos = new Map();
  const at = (k) => {
    if (pos.has(k)) return;
    const c = k >> 1, i = c % nx, j = (c - i) / nx, f0 = F[c], f1 = k & 1 ? F[c + nx] : F[c + 1], t = f0 / (f0 - f1);
    pos.set(k, k & 1 ? [x0 + i * g, y0 + (j + t) * g] : [x0 + (i + t) * g, y0 + j * g]);
  };
  for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) {
    const a = F[j * nx + i], b = F[j * nx + i + 1], c = F[(j + 1) * nx + i + 1], d = F[(j + 1) * nx + i];
    const dk = [a < 0, b < 0, c < 0, d < 0];
    if (dk[0] === dk[1] && dk[1] === dk[2] && dk[2] === dk[3]) continue;
    const E = [H(i, j), V(i + 1, j), H(i, j + 1), V(i, j)];          // bottom, right, top, left: counter-clockwise
    const out = [], inn = [];                                       // dark -> bare, bare -> dark (walking ccw round the cell)
    for (let e = 0; e < 4; e++) { if (dk[e] && !dk[(e + 1) % 4]) out.push(e); if (!dk[e] && dk[(e + 1) % 4]) inn.push(e); }
    const link = (e1, e2) => { at(E[e1]); at(E[e2]); next.set(E[e1], E[e2]); };
    if (out.length === 1) link(out[0], inn[0]);
    else {                                                          // a saddle: two dark corners facing each other
      const mid = (a + b + c + d) / 4 < 0;
      for (const e of out) link(e, mid ? (e + 1) % 4 : (e + 3) % 4);
    }
  }
  const loops = [], seen = new Set();
  for (const k0 of next.keys()) {
    if (seen.has(k0)) continue;
    const L = [];
    let k = k0;
    while (k !== undefined && !seen.has(k)) { seen.add(k); L.push(pos.get(k)); k = next.get(k); }
    if (L.length >= 3) loops.push(L);
  }
  return loops;
}

/** A closed loop thinned by Douglas-Peucker to the tolerance tol. */
function thinLoop(L, tol) {
  const n = L.length;
  if (n < 8) return L;
  let far = 0, fd = -1;
  for (let i = 1; i < n; i++) { const d = Math.hypot(L[i][0] - L[0][0], L[i][1] - L[0][1]); if (d > fd) { fd = d; far = i; } }
  const keep = new Uint8Array(n); keep[0] = keep[far] = 1;
  const rec = (a, b) => {                                           // indices a < b (b may be n: the point 0 again)
    const A = L[a], B = L[b % n], dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy);
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = l > 0 ? Math.abs((L[i][0] - A[0]) * dy - (L[i][1] - A[1]) * dx) / l : Math.hypot(L[i][0] - A[0], L[i][1] - A[1]);
      if (d > best) { best = d; bi = i; }
    }
    if (best > tol) { keep[bi] = 1; rec(a, bi); rec(bi, b); }
  };
  rec(0, far); rec(far, n);
  return L.filter((_, i) => keep[i]);
}

/** The snail in a tile (rim: the tile set back by the margin, counter-clockwise). null if the tile has no room for it. */
export function snailIn(rim, ts, K = KNOBS, ref = null) {
  const Z = K.snail, sh = shapeOf(rim), co = Math.cos(sh.angle), si = Math.sin(sh.angle);
  const rf = ref || [sh.cx + 0.137 * ts, sh.cy + 0.071 * ts];
  const ru = co * (rf[0] - sh.cx) + si * (rf[1] - sh.cy), rv = -si * (rf[0] - sh.cx) + co * (rf[1] - sh.cy);
  const fx = ru > 0 ? -1 : 1, fy = rv > 0 ? -1 : 1;                 // the curl at the end nearer ref, the body on its side
  let P = rim.map((p) => { const u = co * (p[0] - sh.cx) + si * (p[1] - sh.cy), v = -si * (p[0] - sh.cx) + co * (p[1] - sh.cy); return [fx * u, fy * v]; });
  if (fx * fy < 0) P.reverse();
  const { poly, S } = sidesOf(P, 1e-9 * ts);
  P = poly;
  let X0 = Infinity, X1 = -Infinity, Y0 = Infinity, Y1 = -Infinity;
  for (const p of P) { X0 = Math.min(X0, p[0]); X1 = Math.max(X1, p[0]); Y0 = Math.min(Y0, p[1]); Y1 = Math.max(Y1, p[1]); }
  const span = (X) => {                                             // the cross-section of the tile at X: [lo, hi]
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      if ((a[0] - X) * (b[0] - X) > 0 || a[0] === b[0]) continue;
      const y = a[1] + ((X - a[0]) * (b[1] - a[1])) / (b[0] - a[0]);
      lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    return lo <= hi ? [lo, hi] : [0, 0];
  };
  // the curl's centre: the first point along the middle of the strip whose inscribed circle is (nearly) the widest
  const NS = 60, cand = [];
  let dMax = 0;
  for (let k = 1; k < NS; k++) {
    const X = X0 + ((X1 - X0) * 0.5 * k) / NS, [lo, hi] = span(X), Y = (lo + hi) / 2, d = -sdConvex(P, X, Y);
    cand.push([X, Y, d]); dMax = Math.max(dMax, d);
  }
  const C = cand.find((c) => c[2] >= 0.97 * dMax);
  const cx = C[0], cy = C[1];
  // the channel in the curl: clockwise out from its round end to the top of the curl, then along the top (+X)
  const sides = S;
  const rimAt = (th) => {                                           // distance from the centre to the rim along th
    const ux = Math.cos(th), uy = Math.sin(th);
    let t = Infinity;
    for (const s of sides) { const dn = s.nx * ux + s.ny * uy; if (dn > 1e-12) t = Math.min(t, (s.h - s.nx * cx - s.ny * cy) / dn); }
    return t;
  };
  const thE = Math.PI / 2, w0 = 0.5 * Z.slit * ts * K.slitIn, w1 = 0.5 * Z.slit * ts * K.slitOut;
  const rho1 = rimAt(thE) - 0.75 * w1, rho0 = Z.head * ts + w0, pitch = (Z.arm + Z.slit) * ts;
  const turns = Math.min(Z.turnsMax, (rho1 - rho0) / pitch);
  if (!(turns >= 0.6)) return null;
  const Phi = 2 * Math.PI * turns;
  const rhoAt = (phi) => rho0 + ((rho1 - rho0) * phi) / Phi, wAt = (phi) => w0 + ((w1 - w0) * phi) / Phi;
  const sx0 = cx + rho0 * Math.cos(thE + Phi), sy0 = cy + rho0 * Math.sin(thE + Phi);   // the round end
  // the body: its top (the channel's floor) follows the curl down from the mouth's lower wall (a circle round the
  // centre, so the arm under it keeps its width) to the body's share of the strip, joined by a fillet; then it runs to
  // the far end and rounds off there
  const yE = cy + rho1 - w1, Rf = rho1 - w1, kf = Z.ramp * ts;
  const nose = (X) => { const [lo, hi] = span(X); const sh0 = Z.body + ((Z.bodyEnd - Z.body) * (X - cx)) / Math.max(1e-9, X1 - cx); return [lo, lo + sh0 * (hi - lo)]; };
  const [, yN] = nose(X1 - 1e-6 * ts), rN = Z.nose * (yN - span(X1 - 1e-6 * ts)[0]);
  const pitchT = (rho1 - rho0) / turns;                            // the channel's pitch (per turn)
  const floor = (X) => {
    // the point of the spiral R(th) = Rf + pitch (pi/2 - th) / 2 pi (the mouth's lower wall, wound on clockwise)
    // that lies above X: th from cos(th) = (X - cx) / R(th), a few fixed-point steps
    const d0 = X - cx;
    let th = Math.PI / 2, R = Rf;
    for (let it = 0; it < 4; it++) { R = Rf + (pitchT * (Math.PI / 2 - th)) / (2 * Math.PI); th = d0 >= R ? 0 : Math.acos(Math.max(-1, d0 / R)); }
    let y = smax(nose(X)[1], d0 >= R ? cy - R : cy + R * Math.sin(th), kf);
    const dx = X - (X1 - rN);
    if (dx > 0) y -= rN - Math.sqrt(Math.max(0, rN * rN - dx * dx));
    return y;
  };
  const rr = Z.round * ts, inner = insetPolygon(P, S, rr), k = Z.soft * ts, TAU2 = 2 * Math.PI, far = 4 * ts;
  const f = (X, Y, flo) => {
    const sdRim = inner.length >= 3 ? sdConvex(inner, X, Y) - rr : sdConvex(P, X, Y);
    if (sdRim > k) return sdRim;                                    // outside the rim: bare whatever else
    const dx = X - cx, dy = Y - cy, r = Math.sqrt(dx * dx + dy * dy), th = Math.atan2(dy, dx);
    let back = (th - thE) % TAU2; if (back < 0) back += TAU2;       // turns back from the mouth, as an angle
    const ex = X - sx0, ey = Y - sy0;
    let corr = Math.sqrt(ex * ex + ey * ey) - w0;                   // the round end
    for (let phi = Phi - back; phi >= 0; phi -= TAU2) corr = Math.min(corr, Math.abs(r - rhoAt(phi)) - wAt(phi));
    let wedge = far;
    if (back < Z.wedge) {                                           // the arm's outer edge swings out to the rim
      const q = back / Z.wedge, s = q * q * (3 - 2 * q), inE = rhoAt(Phi - back) + wAt(Phi - back);
      wedge = inE + s * (rimAt(th) + 2 * rr - inE) - r;
    }
    const chan = X > cx ? flo - Y : Math.max(flo - Y, cx - X);
    const bare = smin(smin(corr, wedge, k), chan, k);
    return smax(sdRim, -bare, k);
  };
  const g = Z.grid * ts, pad = 2 * g;
  const nx = Math.ceil((X1 - X0 + 2 * pad) / g) + 1, ny = Math.ceil((Y1 - Y0 + 2 * pad) / g) + 1, gx0 = X0 - pad, gy0 = Y0 - pad;
  const F = new Float64Array(nx * ny), FL = new Float64Array(nx);
  for (let i = 0; i < nx; i++) { const X = gx0 + i * g; FL[i] = X >= cx ? floor(X) : yE; }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let v = i === 0 || j === 0 || i === nx - 1 || j === ny - 1 ? 1 : f(gx0 + i * g, gy0 + j * g, FL[i]);
    if (v === 0) v = 1e-12;
    F[j * nx + i] = v;
  }
  const loops = traceLoops(F, nx, ny, gx0, gy0, g);
  const area = (L) => { let a = 0; for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
  let best = null, bestA = 0;
  for (const L of loops) { const a = area(L); if (a > bestA) { bestA = a; best = L; } }
  if (!best) return null;
  const thin = thinLoop(best, Z.tol * ts);
  let pts = thin.map(([X, Y]) => { const u = fx * X, v = fy * Y; return [sh.cx + co * u - si * v, sh.cy + si * u + co * v]; });
  if (fx * fy < 0) pts.reverse();
  return { pts, info: { snail: true, turns: +turns.toFixed(3), loops: loops.length, depth: +(dMax / ts).toFixed(3), hand: fx * fy > 0 ? 'cw' : 'ccw', traced: best.length } };
}

// ---- the spiral in a tile ----------------------------------------------------------------------------------------
export function spiralIn(tile, ts, K = KNOBS, ref = null) {
  const t0 = sidesOf(tile, 1e-9 * ts);
  const rim = sidesOf(insetPolygon(t0.poly, t0.S, K.margin * ts), 1e-9 * ts);   // the tile set back by the margin
  const n = rim.poly.length;
  const ang = [];                                                               // the true corners, not the squeezed ones
  for (let j = 0; j < n; j++) ang.push(Math.PI - wrap(rim.S[j].ang - rim.S[(j + n - 1) % n].ang));
  const sh = shapeOf(rim.poly);
  const co = Math.cos(sh.angle), si = Math.sin(sh.angle);
  const squeezed = (f) => rim.poly.map((p) => { const x = p[0] - sh.cx, y = p[1] - sh.cy; return [(co * x + si * y) / f, -si * x + co * y]; });
  const depthAt = (f) => chebyshev(sidesOf(squeezed(f), 1e-9 * ts).S, ts).r;
  // the squeeze along the long axis: until the tile is round, or the cap, or it has lost too much of its depth
  let a = Math.pow(Math.min(sh.aspect, K.squashCap), K.squash);
  const need = K.keepDepth * depthAt(1);
  if (a > 1 && depthAt(a) < need) { let lo = 1, hi = a; for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (depthAt(mid) >= need) lo = mid; else hi = mid; } a = lo; }
  const sq = squeezed(a);
  const rf = ref || [sh.cx + 0.137 * ts, sh.cy + 0.071 * ts], rx = rf[0] - sh.cx, ry = rf[1] - sh.cy;
  const sp = spiralCore(sq, ang, ts / Math.sqrt(a), ts, a, [(co * rx + si * ry) / a, -si * rx + co * ry], K);
  if (!sp.info.deep && K.snail) {                                               // too shallow for a spiral: a snail
    const sn = snailIn(rim.poly, ts, K, rf);
    if (sn) return sn;
  }
  const pts = sp.pts.map((p) => { const x = p[0] * a, y = p[1]; return [sh.cx + co * x - si * y, sh.cy + si * x + co * y]; });
  sp.info.squeeze = +a.toFixed(3);
  return { pts, info: sp.info };
}

export function findWith(group, K) {
  const ts = Math.sqrt(group.domainArea);
  // a fixed point of the plane that moves with the group: where the tile's own symmetry leaves a choice, it decides
  const { e1, e2 } = group, center = group.center || [(e1[0] + e2[0]) / 2, (e1[1] + e2[1]) / 2];
  const ref = [center[0] + 0.137 * e1[0] + 0.071 * e2[0], center[1] + 0.137 * e1[1] + 0.071 * e2[1]];
  const sp = spiralIn(tilePolygon(group), ts, K, ref);
  return { shapes: [{ pts: sp.pts, hole: false }], info: sp.info };
}

export function find(group) { return findWith(group, KNOBS); }
