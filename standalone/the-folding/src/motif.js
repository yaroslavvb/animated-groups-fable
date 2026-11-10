// motif.js — the pattern's motif: ONE big asymmetric glyph per tile (a comma), the pieces of its copies that fall
// inside a tile, and the fold mesh with the glyph drawn into it.  SPEC 5.9.  Plain ES module; depends on groups.js,
// domain.js and the placement table groupdata/motif.js.
//
//   motifFor(group)                    -> { polylines: [Float32Array(2k)], at, radius, angle, scale, closed, info, seam }
//   motifInTile(group, domain, motif)  -> [Float32Array(2k), ...]
//   motifTintMesh(group, mesh, motif)  -> the mesh cut along the glyph's outline, tint bit 1 inside (the 3D fill), or null
//   commaOutline(opts)                 -> Float64Array(2k)       the unit glyph (exported for tests / other drawings)
//   placementKey(group)                -> what the placement table was computed from, as a short hash (see below)
//
// The glyph is a comma (one half of a yin-yang): a round head and a tail that curls to a point. It has a direction
// (head -> tail) and a hand (the curl), so every kind of symmetry shows: translated copies are parallel, rotated copies
// turn (around every rotation centre the commas form a pinwheel), mirrored and glided copies curl the other way.
//
// The pattern is the orbit of the glyph under the group. It does NOT depend on the seed or on the "wavy" amount: the
// pattern is the thing being cut, the tile is the cut. So `motifFor` depends on the group alone (cached per group).
// The orbifold is the plane divided by the group, so it carries exactly ONE comma: whatever the cut, the pieces of the
// pattern inside the tile add up to one comma, and folded they join into it.
//
// ONE BIG COMMA (the owner's ask, 9-10 Nov 2026: "find a way to occupy more space on the Orbifold. Basically, right now
// there's a lot of empty space when I fold it, and there should be less empty space", then "I meant for all the
// examples"; the judge's decision, qa/fill-judge.md). Until then the comma covered 1 to 6 % of the tile and was only an
// outline in 3D. Now:
//   * it covers FILL_TARGET (30 %) of the tile. The strip groups cannot reach that with their copies kept apart: o and
//     ** get the largest comma that can (about 29 and 28 %), *x about 21 % (stretched, below), xx about 20 % (below);
//   * its copies stay at least FILL_GAP x sqrt(domainArea) apart, outline to outline (the commas never fuse into
//     yin-yang discs, which would lose the hand), and its bounding radius is at most FILL_RCAP x viewHalf;
//   * among the placements that reach the target, one that lies at least 98 % inside the tile of the default preset
//     (measured exactly; 13 groups hold the comma there), and where several places do as well (a strip's comma slides
//     along its strip without changing size; many places lie wholly in a tile) the one whose comma the default 3D
//     view at t = 1 shows most (the fix-up of 10 Nov 2026: before, the grid's first tie was kept, and whether the
//     comma then lay on the near face or the far one was luck). Found by an offline search: tools/motif-place.mjs
//     writes the table groupdata/motif.js (centre, turn, scale per group);
//   * *x (a thin strip between mirrors) has its comma stretched FILL_STRETCH = 2 x along its head -> tail axis;
//   * xx keeps its seam comma (SEAM_GROUPS, the Klein bottle story, below), two lobes wide;
//   * in 3D the comma is FILLED, for every fold (motifTintMesh: tint bit 1, the renderer's `fill` colour); its outline
//     stays. The plane draws the copies filled in soft ink (plane.js).
//
// The table and its freshness. The search takes about 40 s, so its result is a plain data table, keyed per group by
// placementKey(group): a hash of everything the size search reads (the lattice, the coset representatives, viewHalf,
// the default tile, the rules above). When the group data change (say the lattice of a rolled shape), the key no longer
// matches: test/motif.test.js fails ("stale table") until `node tools/motif-place.mjs` is run, and meanwhile motifFor
// keeps the table's centre and turn but shrinks the comma until its copies keep their distance again (one console
// warning), so the pattern is never wrong. Each entry also carries the tool's `view` key (where the fold puts the
// default tile at t = 1, and the default view): when a fold changes, the test fails the same way, though motifFor has
// nothing to correct (the comma is right, only perhaps less in view). A group missing from the table gets the old
// small comma (`place`).
//
// The seam comma (xx; designer A of the Klein bottle work, 9 Nov 2026, widened by the fill judge). For the groups in
// SEAM_GROUPS the glyph does not sit inside the default tile: it sits ACROSS the tile's seam that a glide sews (a cut
// edge glued by an orientation-reversing element). The tile then holds one piece of it at that edge and, at the
// partner edge, the glide-reflected rest: part of a comma here, its mirror image's other part over there. Folded, the
// two pieces join into one comma only after the sheet has been turned over (xx: the figure 8 makes half a turn round
// the ring), so the picture shows what the glide does and why the closing has to pass through itself.
// Placement (placeAcrossSeam with SEAM_LOBES = 2): head -> tail along the glide axes, the seam through the comma's
// middle, centred on the glide axis through the tile's middle (the room is the two lobes between the axes on either
// side of it); SEAM_SCALE x the one-lobe comma across the axes and SEAM_STRETCH x that along them (the judge: one lobe
// covered 10 % of the tile and was the emptiest shape of all; two lobes cover about 20 %). Its copies keep FILL_GAP
// too (checked here, the comma shrinks if they would not). info.tier = 3, the tier whose rule is "the default tile may
// cut the glyph" (here it does, on purpose).

import { elementsNear, symmetryElements, det, classify } from './groups.js';
import { buildDomain } from './domain.js';
import { PLACEMENTS } from './groupdata/motif.js';

const TAU = 2 * Math.PI;

// ---- the big comma (qa/fill-judge.md) -------------------------------------------------------------------------
/** Share of the tile the comma covers (where its copies can keep their distance; the strips get less). */
export const FILL_TARGET = 0.3;
/** Copies of the comma stay at least this far apart, outline to outline, in units of sqrt(group.domainArea). */
export const FILL_GAP = 0.07;
/** Largest bounding radius of a table comma, in units of group.viewHalf. */
export const FILL_RCAP = 0.34;
/** The comma stretched along its head -> tail axis, per group (1 elsewhere): the *x strip only. */
export const FILL_STRETCH = Object.freeze({ '*x': 2 });
/** The outline the placement search tests overlaps with while it searches (a coarser sampling of commaOutline). */
export const SEARCH_OUTLINE = Object.freeze({ nBack: 28, nHollow: 14, nHead: 14 });
/** The outline that is drawn (commaOutline's defaults): the table's gap and in-tile share are measured on it. */
export const DRAWN_OUTLINE = Object.freeze({ head: 0.5, nBack: 44, nHollow: 24, nHead: 24 });
/** xx's seam comma: the room is this many lobes (spaces between neighbouring glide axes), centred on the middle axis. */
export const SEAM_LOBES = 2;
/** ... the comma is SEAM_SCALE x the one-lobe comma across the axes, and SEAM_STRETCH x that along them. */
export const SEAM_SCALE = 2.6, SEAM_STRETCH = 1.4;

// ---- the old small comma (v1 .. round 3): the fallback for a group the table lacks, and the base of the seam comma ----
/** Largest bounding radius of the glyph, in units of sqrt(group.domainArea). */
export const SIZE_CAP = 0.19;
/** ... and in units of group.viewHalf (so the glyph is never more than about a tenth of the window across). */
export const VIEW_CAP = 0.105;
/** The glyph's bounding radius is at most this fraction of its clearance (half the distance to its nearest copy). */
export const K_CLEAR = 0.68;
/** ... and at most this fraction of its distance to the nearest glide axis (1: the disc may touch an axis, not cross it). */
export const K_GLIDE = 1;
/** Glyph tilt (radians): generic with respect to the mirror directions of all 17 groups (multiples of 30 and 45 degrees). */
export const TILT = -0.33;
/** Groups whose glyph straddles the glide seam of the default tile. */
export const SEAM_GROUPS = new Set(['xx']);
/** The glyph spans at most this fraction of the room between the two glide axes on either side of it. */
export const K_SEAM_GLIDE = 0.78;
/** Largest bounding radius of a one-lobe seam glyph, in units of group.viewHalf: the cap of every v1 glyph. */
export const SEAM_VIEW_CAP = VIEW_CAP;
/** Tilt of a seam glyph away from the glide axis (radians): a little, so no line of the pattern runs along it. */
export const SEAM_TILT = -0.1;
/**
 * How far the glyph's centre lies beyond the seam, in glyph radii along the axis. 0 would cut it exactly where the
 * hollow meets the head, a point where the outline runs along the cut (slivers); 0.3 cuts it into two pieces of
 * equal area (the unit comma below y = -0.3 has area pi/4): the round of the head inside, the curl beyond.
 */
export const SEAM_SHIFT = 0.3;

/**
 * The unit comma: a closed, counter-clockwise outline inside the unit disc (it touches the unit circle along its back).
 * `head` in (0, 1) is the radius of the round head; the hollow of the tail has radius 1 - head. head = 0.5 is the classic
 * yin-yang half. The head is at the bottom, the tail tip at the top (0, 1), the back bulges toward +x.
 * Returns Float64Array [x0, y0, x1, y1, ...]; the last point repeats the first.
 */
export function commaOutline({ head = DRAWN_OUTLINE.head, nBack = DRAWN_OUTLINE.nBack, nHollow = DRAWN_OUTLINE.nHollow, nHead = DRAWN_OUTLINE.nHead } = {}) {
  const a = 1 - head, b = head;
  const pts = [];
  // the back: right half of the unit circle, from the bottom (0, -1) up to the tail tip (0, 1)
  for (let i = 0; i < nBack; i++) { const f = -Math.PI / 2 + (Math.PI * i) / nBack; pts.push(Math.cos(f), Math.sin(f)); }
  // the hollow: right half of the circle of radius a centred (0, 1 - a), from the tip (0, 1) down to (0, 1 - 2a)
  for (let i = 0; i < nHollow; i++) { const f = (Math.PI * i) / nHollow; pts.push(a * Math.sin(f), 1 - a + a * Math.cos(f)); }
  // the head: left half of the circle of radius b centred (0, -1 + b), from (0, -1 + 2b) down to the bottom (0, -1)
  for (let i = 0; i < nHead; i++) { const f = (Math.PI * i) / nHead; pts.push(-b * Math.sin(f), -1 + b + b * Math.cos(f)); }
  pts.push(pts[0], pts[1]);
  return Float64Array.from(pts);
}

const cache = new WeakMap();

function isIdent(g) {
  return Math.abs(g.a - 1) < 1e-9 && Math.abs(g.d - 1) < 1e-9 && Math.abs(g.b) < 1e-9 && Math.abs(g.c) < 1e-9 &&
    Math.abs(g.tx) < 1e-9 && Math.abs(g.ty) < 1e-9;
}

// ---------------------------------------------------------------------------------------------------------------
// The placement table: its key, and the geometry the search and the stale-table guard share
// ---------------------------------------------------------------------------------------------------------------

/** FNV-1a (32 bit) of a string, as 8 hex digits: the fingerprint of the placement's inputs. */
export function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/**
 * Everything the placement search of a group reads (tools/motif-place.mjs), rounded to 1e-6: the lattice, the coset
 * representatives, viewHalf, the default preset's tile (it says where "inside the default tile" is) and the rules.
 */
export function placementInputs(group) {
  const p0 = group.presets[0];
  const D0 = buildDomain(group, { seed: p0.seed, metric: p0.metric });
  const r = (v) => Math.round(v * 1e6) / 1e6 + 0;          // + 0: no -0
  return {
    id: group.id, e1: group.e1.map(r), e2: group.e2.map(r),
    reps: group.reps.map((g) => [g.a, g.b, g.c, g.d, g.tx, g.ty].map(r)),
    viewHalf: r(group.viewHalf), tile: D0.poly.map((p) => [r(p[0]), r(p[1])]),
    target: FILL_TARGET, gap: FILL_GAP, rcap: FILL_RCAP, stretch: FILL_STRETCH[group.id] || 1, outline: SEARCH_OUTLINE,
    drawn: DRAWN_OUTLINE,
  };
}

/** The key a table entry must carry to be fresh: fnv1a of placementInputs(group). */
export function placementKey(group) { return fnv1a(JSON.stringify(placementInputs(group))); }

/** The outline the search tests (no repeated last point is used: NU distinct points). */
export const SEARCH_UNIT = commaOutline(SEARCH_OUTLINE);
/** The outline drawn (the same points motifFor draws, in float64). */
export const DRAWN_UNIT = commaOutline(DRAWN_OUTLINE);

/** The comma's outline points (the unit's first nu points): scaled by s across and s * sig along, turned by ang, at (cx, cy). */
export function commaPoints(unit, nu, cx, cy, ang, s, sig, out) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (let i = 0; i < nu; i++) {
    const x = s * unit[2 * i], y = s * sig * unit[2 * i + 1];
    out[2 * i] = cx + ca * x - sa * y; out[2 * i + 1] = cy + sa * x + ca * y;
  }
  return out;
}
function segsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  if ((d1 > 0) === (d2 > 0)) return false;
  const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  return (d3 > 0) !== (d4 > 0);
}
function insidePoly(P, nu, x, y) {
  let c = false;
  for (let i = 0, j = nu - 1; i < nu; j = i++) {
    const yi = P[2 * i + 1], yj = P[2 * j + 1];
    if ((yi > y) !== (yj > y) && x < ((P[2 * j] - P[2 * i]) * (y - yi)) / (yj - yi) + P[2 * i]) c = !c;
  }
  return c;
}
/** Do the closed outlines P and Q (nu points each) overlap: do their edges cross, or does one hold the other? */
function polysOverlap(P, Q, nu) {
  let ax0 = Infinity, ay0 = Infinity, ax1 = -Infinity, ay1 = -Infinity, bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (let i = 0; i < nu; i++) {
    const x = P[2 * i], y = P[2 * i + 1], u = Q[2 * i], v = Q[2 * i + 1];
    if (x < ax0) ax0 = x; if (x > ax1) ax1 = x; if (y < ay0) ay0 = y; if (y > ay1) ay1 = y;
    if (u < bx0) bx0 = u; if (u > bx1) bx1 = u; if (v < by0) by0 = v; if (v > by1) by1 = v;
  }
  if (ax1 < bx0 || bx1 < ax0 || ay1 < by0 || by1 < ay0) return false;
  for (let i = 0, j = nu - 1; i < nu; j = i++) {
    const px = P[2 * j], py = P[2 * j + 1], qx = P[2 * i], qy = P[2 * i + 1];
    const sx0 = Math.min(px, qx), sx1 = Math.max(px, qx), sy0 = Math.min(py, qy), sy1 = Math.max(py, qy);
    if (sx1 < bx0 || sx0 > bx1 || sy1 < by0 || sy0 > by1) continue;
    for (let k = 0, l = nu - 1; k < nu; l = k++) {
      const rx = Q[2 * l], ry = Q[2 * l + 1], tx = Q[2 * k], ty = Q[2 * k + 1];
      if (Math.max(rx, tx) < sx0 || Math.min(rx, tx) > sx1 || Math.max(ry, ty) < sy0 || Math.min(ry, ty) > sy1) continue;
      if (segsCross(px, py, qx, qy, rx, ry, tx, ty)) return true;
    }
  }
  return insidePoly(Q, nu, P[0], P[1]) || insidePoly(P, nu, Q[0], Q[1]);
}
function segDist2(x, y, ax, ay, bx, by) {
  const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
  let t = l2 > 0 ? ((x - ax) * ex + (y - ay) * ey) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = ax + t * ex - x, dy = ay + t * ey - y;
  return dx * dx + dy * dy;
}
/** Are the disjoint outlines P and Q closer than d somewhere? (Two segments that do not cross are nearest at an end.) */
function polysCloser(P, Q, nu, d) {
  const d2 = d * d;
  for (const [U, V] of [[P, Q], [Q, P]]) {
    for (let i = 0; i < nu; i++) {
      const x = U[2 * i], y = U[2 * i + 1];
      for (let k = 0, l = nu - 1; k < nu; l = k++) {
        const ax = V[2 * l], ay = V[2 * l + 1], bx = V[2 * k], by = V[2 * k + 1];
        if (x < Math.min(ax, bx) - d || x > Math.max(ax, bx) + d || y < Math.min(ay, by) - d || y > Math.max(ay, by) + d) continue;
        if (segDist2(x, y, ax, ay, bx, by) < d2) return true;
      }
    }
  }
  return false;
}
let scratchA = null, scratchB = null;
/**
 * Is the comma at (cx, cy), turned by ang, scaled by s (s * sig along its head -> tail axis, sig >= 1), disjoint from
 * each of its copies g(comma), g in els (the identity left out), and no closer to any of them than `gap`?
 */
export function commaApart(els, cx, cy, ang, s, sig, gap, unit = SEARCH_UNIT) {
  const nu = unit.length / 2 - 1;
  if (!scratchA || scratchA.length < 2 * nu) { scratchA = new Float64Array(2 * nu); scratchB = new Float64Array(2 * nu); }
  const A = commaPoints(unit, nu, cx, cy, ang, s, sig, scratchA), B = scratchB;
  const reach = 2 * s * Math.max(1, sig) + gap;
  for (const g of els) {
    const ox = g.a * cx + g.b * cy + g.tx - cx, oy = g.c * cx + g.d * cy + g.ty - cy;
    if (ox * ox + oy * oy > reach * reach) continue;
    for (let i = 0; i < nu; i++) { const x = A[2 * i], y = A[2 * i + 1]; B[2 * i] = g.a * x + g.b * y + g.tx; B[2 * i + 1] = g.c * x + g.d * y + g.ty; }
    if (polysOverlap(A, B, nu)) return false;
    if (gap > 0 && polysCloser(A, B, nu, gap)) return false;
  }
  return true;
}
/** The largest scale s <= sHi at which commaApart holds (bisection, 14 steps; the result always satisfies it). */
export function largestApart(els, cx, cy, ang, sig, gap, sHi, unit = SEARCH_UNIT) {
  if (commaApart(els, cx, cy, ang, sHi, sig, gap, unit)) return sHi;
  let lo = 0, hi = sHi;
  for (let it = 0; it < 14; it++) { const m = (lo + hi) / 2; if (commaApart(els, cx, cy, ang, m, sig, gap, unit)) lo = m; else hi = m; }
  return lo;
}
/** The elements that can bring a copy of a comma of bounding radius R at (x, y) within `gap` of it (no identity). */
export function nearElements(group, x, y, R, gap) {
  return elementsNear(group, x, y, 2 * R + gap + 1e-9, x, y).filter((g) => !isIdent(g));
}

// ---------------------------------------------------------------------------------------------------------------
// The old small comma (v1): used for a group the table lacks, and (one lobe) the base of the seam comma
// ---------------------------------------------------------------------------------------------------------------

/**
 * The v1 placement (round 3 and before): the glyph inside the tile of the default preset, as large as the symmetry
 * elements, the default tile's cut edges and the seed handles allow, capped at SIZE_CAP x sqrt(domainArea) and
 * VIEW_CAP x viewHalf. Returns { at, radius, info } (info: tier, clearance, depth, distances to the handles).
 */
export function place(group) {
  const p0 = group.presets[0];
  const D0 = buildDomain(group, { seed: p0.seed, metric: p0.metric });
  const poly = D0.poly, n = poly.length;
  const size = Math.sqrt(group.domainArea);
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const p of poly) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
  const c0x = (minx + maxx) / 2, c0y = (miny + maxy) / 2;
  const R0 = Math.hypot(maxx - minx, maxy - miny) / 2;
  // every element that can move a point of the tile by less than 2 R0 (so: its nearest copies, its mirrors, its centres)
  const els = elementsNear(group, c0x, c0y, 4 * R0 + 1e-9, c0x, c0y).filter((g) => !isIdent(g));
  const sym = symmetryElements(group, c0x, c0y, 2 * R0 + size);
  const cuts = D0.edges.filter((e) => e.kind === 'cut');
  const mEdge = 0.03 * group.viewHalf;       // keeps the glyph clear of the tile's bold cut edges
  const h0 = 0.085 * group.viewHalf;         // ... and of the seed handle (about 9 px on a phone, 23 px on a laptop)
  const cap = Math.min(SIZE_CAP * size, VIEW_CAP * group.viewHalf);
  const sx = D0.seed[0], sy = D0.seed[1];
  // where the handle sits in the other presets: the images of their seeds near the default tile
  const others = [];
  for (let k = 1; k < group.presets.length; k++) {
    const sk = buildDomain(group, { seed: group.presets[k].seed, metric: group.presets[k].metric }).seed;
    for (const g of elementsNear(group, c0x, c0y, 2 * R0 + cap + h0, sk[0], sk[1])) {
      others.push(g.a * sk[0] + g.b * sk[1] + g.tx, g.c * sk[0] + g.d * sk[1] + g.ty);
    }
  }

  const q = { clear: 0, glide: 0, depth: 0, seed: 0, other: 0 };
  /** Fills q for the point (x, y); returns false when the point is outside the default tile. */
  const measure = (x, y) => {
    let depthAll = Infinity, depth = Infinity;
    for (let i = 0; i < n; i++) {
      const e = D0.edges[i], d = e.c - (e.nx * x + e.ny * y);
      if (d < depthAll) depthAll = d;
      if (e.kind === 'cut' && d < depth) depth = d;
    }
    if (depthAll < 0) return false;
    let rho = Infinity;
    for (const g of els) {
      const dx = g.a * x + g.b * y + g.tx - x, dy = g.c * x + g.d * y + g.ty - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < rho) rho = d2;
    }
    rho = Math.sqrt(rho) / 2;
    let clear = rho, glide = Infinity;
    for (const m of sym.glides) {
      const d = Math.abs((x - m.px) * -m.uy + (y - m.py) * m.ux);
      if (d < glide) glide = d;
    }
    for (const c of sym.centers) {
      const d = Math.hypot(x - c.x, y - c.y);
      if (d < clear) clear = d;
    }
    let other = Infinity;
    for (let i = 0; i < others.length; i += 2) {
      const d = (x - others[i]) * (x - others[i]) + (y - others[i + 1]) * (y - others[i + 1]);
      if (d < other) other = d;
    }
    q.clear = clear; q.glide = glide; q.depth = cuts.length ? depth : Infinity; q.seed = Math.hypot(x - sx, y - sy);
    q.other = Math.sqrt(other);
    return true;
  };

  // lexicographic score: (1) the radius the point allows, capped; (2) how deep it sits in the allowed region;
  // (3) a fixed generic direction, so exact ties (a tile with a symmetric outline) are broken the same way every time
  const BX = Math.cos(1.2), BY = Math.sin(1.2);
  const scoreOf = (x, y, tier, out) => {            // from the measurements in q
    let f = Math.min(K_CLEAR * q.clear, K_GLIDE * q.glide), s2 = Math.min(q.clear, q.glide);
    if (tier < 3) { f = Math.min(f, q.depth - mEdge); s2 = Math.min(s2, q.depth - mEdge); }
    if (tier < 2) { f = Math.min(f, q.seed - h0); s2 = Math.min(s2, q.seed - h0); }
    if (tier < 1) { f = Math.min(f, q.other - 0.8 * h0); s2 = Math.min(s2, q.other - 0.8 * h0); }
    out[0] = Math.min(f, cap / 0.96);
    out[1] = s2 + 1e-7 * size * ((x - sx) * BX + (y - sy) * BY) / (R0 || 1);
    out[2] = f;
  };
  const score = (x, y, tier, out) => {
    if (!measure(x, y)) return false;
    scoreOf(x, y, tier, out);
    return true;
  };
  const better = (a, b) => a[0] > b[0] + 1e-12 || (a[0] > b[0] - 1e-12 && a[1] > b[1]);

  // one pass over a grid in the tile's bounding box measures every candidate once; each tier then picks its best
  const N = 56;
  const grid = [];                                   // x, y, clear, glide, depth, seed, other
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const x = minx + ((maxx - minx) * (i + 0.5)) / (N + 1), y = miny + ((maxy - miny) * (j + 0.5)) / (N + 1);
      if (measure(x, y)) grid.push(x, y, q.clear, q.glide, q.depth, q.seed, q.other);
    }
  }
  const search = (tier) => {
    const best = { x: sx, y: sy, s: [-Infinity, -Infinity, -Infinity] };
    const s = [0, 0, 0];
    for (let k = 0; k < grid.length; k += 7) {
      q.clear = grid[k + 2]; q.glide = grid[k + 3]; q.depth = grid[k + 4]; q.seed = grid[k + 5]; q.other = grid[k + 6];
      scoreOf(grid[k], grid[k + 1], tier, s);
      if (better(s, best.s)) { best.x = grid[k]; best.y = grid[k + 1]; best.s = s.slice(); }
    }
    // pattern search around the best grid point
    let step = Math.max(maxx - minx, maxy - miny) / (N + 1);
    for (let it = 0; it < 26; it++) {
      let moved = false;
      for (let k = 0; k < 8; k++) {
        const ang = (TAU * k) / 8;
        const x = best.x + step * Math.cos(ang), y = best.y + step * Math.sin(ang);
        if (score(x, y, tier, s) && better(s, best.s)) { best.x = x; best.y = y; best.s = s.slice(); moved = true; }
      }
      if (!moved) step /= 2;
    }
    return best;
  };

  // tier 0: every condition, and clear of the handle in the other presets too; tier 1: the default preset's handle
  // only; tier 2: let the handle overlap; tier 3: also let the default tile cut the glyph.
  // Tiers 2 and 3 are used only when the one before would shrink the glyph below 70 % of what the symmetry allows;
  // tier 0 is kept only if it costs less than 15 % of tier 1's size.
  const free = search(3);
  const full = Math.min(free.s[2], cap / 0.96);
  let chosen = search(1), tier = 1;
  if (chosen.s[0] < 0.7 * full) { chosen = search(2); tier = 2; }
  if (chosen.s[0] < 0.7 * full) { chosen = free; tier = 3; }
  if (tier === 1 && others.length) {
    const all = search(0);
    if (all.s[0] >= 0.85 * chosen.s[0]) { chosen = all; tier = 0; }
  } else if (tier === 1) tier = 0;          // no other preset: nothing more to ask for
  measure(chosen.x, chosen.y);
  const radius = Math.min(cap, 0.96 * chosen.s[2]);
  return {
    at: [chosen.x, chosen.y], radius,
    info: { tier, clear: q.clear, glide: q.glide, depth: q.depth, seed: q.seed, other: q.other, cap, allowed: chosen.s[2], free: free.s[2] },
  };
}

/**
 * Placement across the glide seam (see SEAM_GROUPS): { at, radius, angle, info }, or null when the default tile has
 * no cut edge sewn by a glide. The seam is the cut edge glued by an orientation-reversing element whose outward
 * normal points most nearly up (xx: the top edge, glued to the bottom edge by (x, y) -> (-x, y + A)). The glyph's
 * head -> tail runs along the glide axes, its tail out of the tile across the seam; the seam passes through the
 * glyph's centre (SEAM_SHIFT moves it); across the axes the glyph's own outline (not its bounding disc) is centred
 * in the room. `lobes` = 1 (v1): the room is the space between the two neighbouring glide axes around the seam point
 * farthest from every axis. `lobes` = 2 (the fill, SEAM_LOBES): every other axis is left out, keeping the ones on
 * either side of the axis through the middle of the seam, so the room is two lobes wide and centred on that axis.
 * The radius returned is the one-lobe rule's (K_SEAM_GLIDE of the room, the v1 caps); seamComma scales it.
 */
export function placeAcrossSeam(group, unit = commaOutline(), lobes = 1) {
  const p0 = group.presets[0];
  const D0 = buildDomain(group, { seed: p0.seed, metric: p0.metric });
  const n = D0.poly.length;
  let best = -1, bestUp = -Infinity;
  D0.edges.forEach((e, i) => {
    if (e.kind !== 'cut' || det(e.g) > 0) return;
    const up = e.ny / Math.hypot(e.nx, e.ny);
    if (up > bestUp + 1e-9) { bestUp = up; best = i; }
  });
  if (best < 0) return null;
  const e = D0.edges[best], A = D0.poly[best], B = D0.poly[(best + 1) % n];
  const cg = classify(e.g);
  if (cg.type !== 'glide') return null;
  // u: along the glide axes, pointing out of the tile across the seam (the tail goes there); v: across the axes
  const nl = Math.hypot(e.nx, e.ny), onx = e.nx / nl, ony = e.ny / nl;
  let ux = cg.dir[0], uy = cg.dir[1];
  if (ux * onx + uy * ony < 0) { ux = -ux; uy = -uy; }
  const vx = uy, vy = -ux;
  const size = Math.sqrt(group.domainArea);
  const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, len = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const sym = symmetryElements(group, mx, my, len + 2 * size);
  // offsets (along v) of the glide axes parallel to u
  let axes = sym.glides.filter((m) => Math.abs(m.ux * vx + m.uy * vy) < 1e-9).map((m) => m.px * vx + m.py * vy).sort((a, b) => a - b);
  if (axes.length < 2) return null;
  if (lobes === 2) {
    // two lobes: leave out the axis through the middle of the seam and every second one from it
    const mid = mx * vx + my * vy;
    let k0 = 0, bd = Infinity;
    axes.forEach((a, i) => { const d = Math.abs(a - mid); if (d < bd) { bd = d; k0 = i; } });
    axes = axes.filter((a, i) => (i - k0) % 2 !== 0);
    if (axes.length < 2) return null;
  }
  const roomAt = (pv) => {                       // the two axes around the offset pv: [lower, upper]
    let lo = -Infinity, hi = Infinity;
    for (const a of axes) { if (a <= pv && a > lo) lo = a; if (a >= pv && a < hi) hi = a; }
    return [lo, hi];
  };
  // the seam point farthest from every axis (ties: the one farther along the fixed generic direction)
  const BX = Math.cos(1.2), BY = Math.sin(1.2);
  let sBest = 0.5, cBest = -Infinity;
  for (let i = 0; i <= 400; i++) {
    const s = 0.02 + (0.96 * i) / 400;
    const px = A[0] + s * (B[0] - A[0]), py = A[1] + s * (B[1] - A[1]), pv = px * vx + py * vy;
    const [lo, hi] = roomAt(pv);
    const c = Math.min(pv - lo, hi - pv) + 1e-9 * (px * BX + py * BY);
    if (c > cBest) { cBest = c; sBest = s; }
  }
  const P = [A[0] + sBest * (B[0] - A[0]), A[1] + sBest * (B[1] - A[1])];
  const [lo, hi] = roomAt(P[0] * vx + P[1] * vy);
  // the glyph's frame: its +y (head -> tail) along u, turned by SEAM_TILT
  const angle = Math.atan2(uy, ux) - Math.PI / 2 + SEAM_TILT;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  let wMin = Infinity, wMax = -Infinity;           // the unit outline's extent along v
  for (let i = 0; i < unit.length; i += 2) {
    const x = ca * unit[i] - sa * unit[i + 1], y = sa * unit[i] + ca * unit[i + 1];
    const w = x * vx + y * vy;
    if (w < wMin) wMin = w;
    if (w > wMax) wMax = w;
  }
  let radius = Math.min((K_SEAM_GLIDE * (hi - lo)) / (wMax - wMin), SEAM_VIEW_CAP * group.viewHalf, SIZE_CAP * size,
    (K_GLIDE * (hi - lo)) / 2);
  const els = elementsNear(group, P[0], P[1], 4 * size, P[0], P[1]).filter((g) => !isIdent(g));
  const evx = B[0] - A[0], evy = B[1] - A[1], ev = evx * vx + evy * vy;
  let at = P, clear = Infinity;
  for (let pass = 0; pass < 3; pass++) {
    // centre the outline between the axes (its bounding disc clear of both: K_GLIDE), keep the glyph's centre on
    // the seam line, then SEAM_SHIFT along u
    const pad = radius / K_GLIDE;
    const want = Math.min(hi - pad, Math.max(lo + pad, (lo + hi) / 2 - (radius * (wMax + wMin)) / 2));
    const s = Math.abs(ev) > 1e-12 ? (want - (A[0] * vx + A[1] * vy)) / ev : sBest;
    at = [A[0] + s * evx + SEAM_SHIFT * radius * ux, A[1] + s * evy + SEAM_SHIFT * radius * uy];
    clear = Infinity;
    for (const g of els) {
      const d = Math.hypot(g.a * at[0] + g.b * at[1] + g.tx - at[0], g.c * at[0] + g.d * at[1] + g.ty - at[1]) / 2;
      if (d < clear) clear = d;
    }
    if (radius <= K_CLEAR * clear) break;
    radius = K_CLEAR * clear;
  }
  return {
    at, radius, angle,
    info: { tier: 3, seam: true, lobes, edge: best, axes: [lo, hi], room: hi - lo, extent: [radius * wMin, radius * wMax], clear, cap: SEAM_VIEW_CAP * group.viewHalf },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The big comma of a group
// ---------------------------------------------------------------------------------------------------------------

const warned = new WeakSet();
function warnStale(group, why) {
  if (warned.has(group)) return;
  warned.add(group);
  if (typeof console !== 'undefined') console.warn(`motif.js: the comma placement of ${group.id} is ${why} (run: node tools/motif-place.mjs); the comma is made to fit`);
}

/** The table's comma of a group: { at, angle, sx, sy, info } (sx across, sy = sx * stretch along), or null. */
function tableComma(group) {
  const e = PLACEMENTS[group.id];
  if (!e || !Array.isArray(e.at) || !(e.s > 0)) return null;
  const key = placementKey(group), fresh = e.key === key;
  const sig = e.stretch > 0 ? e.stretch : 1, size = Math.sqrt(group.domainArea);
  let s = e.s;
  if (!fresh) {
    // the group data changed since the table was written: keep its centre and turn, shrink until the copies are apart
    warnStale(group, 'stale');
    s = Math.min(s, (FILL_RCAP * group.viewHalf) / sig);
    s = largestApart(nearElements(group, e.at[0], e.at[1], s * sig, FILL_GAP * size), e.at[0], e.at[1], e.angle, sig, FILL_GAP * size, s);
  }
  const cover = ((Math.PI / 2) * s * s * sig) / group.domainArea;
  return { at: [e.at[0], e.at[1]], angle: e.angle, sx: s, sy: s * sig,
    info: { source: 'table', fresh, key, cover, inTile: e.inTile, fit: e.fit, stretch: sig } };
}

/** xx's comma: across the glide seam, two lobes wide (see the top of the file): { at, angle, sx, sy, info }, or null. */
function seamComma(group, unit) {
  const p = placeAcrossSeam(group, unit, SEAM_LOBES);
  if (!p) return null;
  const size = Math.sqrt(group.domainArea);
  let sx = p.radius * SEAM_SCALE, sy = sx * SEAM_STRETCH;
  // keep the seam through the comma's middle: the centre moves along the glyph's axis with the growth along it
  const ux = -Math.sin(p.angle), uy = Math.cos(p.angle);          // the glyph's +y (head -> tail)
  const shift = SEAM_SHIFT * (sy - p.radius);
  const at = [p.at[0] + shift * ux, p.at[1] + shift * uy];
  // the copies keep FILL_GAP apart, as every other group's (with the current lattice they are far apart: no change)
  const gap = FILL_GAP * size;
  const s = largestApart(nearElements(group, at[0], at[1], sy, gap), at[0], at[1], p.angle, SEAM_STRETCH, gap, sx);
  if (s < sx) { warnStale(group, 'too large for its lattice'); sx = s; sy = s * SEAM_STRETCH; }
  const cover = ((Math.PI / 2) * sx * sy) / group.domainArea;
  return { at, angle: p.angle, sx, sy, info: { ...p.info, source: 'seam', base: p.radius, cover } };
}

/**
 * The motif of a group: { polylines, at, radius, angle, scale, closed, info, seam }.
 *   polylines  [Float32Array(2k)] in world coordinates; here one closed outline (last point = first point)
 *   at         centre of the glyph's frame: a generic point (trivial stabiliser, off every symmetry element)
 *   radius     radius of the disc around `at` that holds the glyph (max(scale))
 *   angle      the glyph's rotation (the unit glyph of commaOutline is scaled by `scale`, then turned by it)
 *   scale      [across, along]: the unit glyph's x and y scales (equal but for *x and xx)
 *   closed     closed[i] is true when polylines[i] is a closed outline (the plane view fills those)
 *   info       where the placement comes from: source 'table' | 'seam' | 'v1', cover (share of the tile), ...
 *   seam       true when the glyph straddles the glide seam of the default tile (SEAM_GROUPS)
 * The same object is returned for the same group every time.
 */
export function motifFor(group) {
  let m = cache.get(group);
  if (m) return m;
  const unit = commaOutline();
  let c = SEAM_GROUPS.has(group.id) ? seamComma(group, unit) : null;
  const seam = !!c;
  if (!c) c = tableComma(group);
  if (!c) {
    warnStale(group, 'missing from the table');
    const p = place(group);
    c = { at: p.at, angle: TILT, sx: p.radius, sy: p.radius, info: { ...p.info, source: 'v1', cover: ((Math.PI / 2) * p.radius * p.radius) / group.domainArea } };
  }
  const { at, angle, sx, sy } = c;
  const k = unit.length / 2;
  const out = new Float32Array(2 * k);
  const ca = Math.cos(angle), sa = Math.sin(angle);
  for (let i = 0; i < k; i++) {
    const x = sx * unit[2 * i], y = sy * unit[2 * i + 1];
    out[2 * i] = at[0] + ca * x - sa * y;
    out[2 * i + 1] = at[1] + sa * x + ca * y;
  }
  out[2 * k - 2] = out[0]; out[2 * k - 1] = out[1];
  m = { polylines: [out], at, radius: Math.max(sx, sy), angle, scale: [sx, sy], closed: [true], info: c.info, seam };
  cache.set(group, m);
  return m;
}

// ---------------------------------------------------------------------------------------------------------------
// The glyph's fill in 3D: the fold mesh, cut along the glyph's outline, with the inside tinted
// ---------------------------------------------------------------------------------------------------------------

/**
 * A closed outline (flat array, last point = first point) with its edges binned by height, so that a point-in-outline
 * test or a crossing search looks at the few edges near one height instead of all of them.
 */
function outlineIndex(pts) {
  const ne = pts.length / 2 - 1;                    // edges i -> i + 1
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i], y = pts[i + 1];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const K = Math.max(4, Math.min(48, Math.round(ne / 3)));
  const h = (y1 - y0) / K || 1;
  const bin = (y) => { const b = Math.floor((y - y0) / h); return b < 0 ? 0 : b >= K ? K - 1 : b; };
  const start = new Int32Array(K + 1);
  for (let i = 0; i < ne; i++) {
    const ya = pts[2 * i + 1], yb = pts[2 * i + 3];
    for (let b = bin(Math.min(ya, yb)), b1 = bin(Math.max(ya, yb)); b <= b1; b++) start[b + 1]++;
  }
  for (let b = 0; b < K; b++) start[b + 1] += start[b];
  const fill = start.slice(0, K), list = new Int32Array(start[K]);
  for (let i = 0; i < ne; i++) {
    const ya = pts[2 * i + 1], yb = pts[2 * i + 3];
    for (let b = bin(Math.min(ya, yb)), b1 = bin(Math.max(ya, yb)); b <= b1; b++) list[fill[b]++] = i;
  }
  return { pts, x0, y0, x1, y1, bin, start, list };
}
/** Is (x, y) inside the indexed outline (even-odd rule)? */
function insideIndexed(I, x, y) {
  if (x < I.x0 || x > I.x1 || y < I.y0 || y > I.y1) return false;
  const P = I.pts, b = I.bin(y);
  let c = false;
  for (let k = I.start[b], k1 = I.start[b + 1]; k < k1; k++) {
    const i = 2 * I.list[k], xa = P[i], ya = P[i + 1], xb = P[i + 2], yb = P[i + 3];
    if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) c = !c;
  }
  return c;
}

/**
 * Ear clipping of a simple counter-clockwise polygon P (flat [x, y, ...], m points): the triangles as index triples
 * (counter-clockwise), or null if no ear can be found (a polygon damaged by rounding). Points on a side (the crossing
 * points along a straight edge of a mesh triangle) are kept: an ear whose diagonal would touch another point is not cut.
 */
function earClip(P, m, eps) {
  const idx = [];
  for (let i = 0; i < m; i++) idx.push(i);
  const cross = (i, j, k) => (P[2 * j] - P[2 * i]) * (P[2 * k + 1] - P[2 * i + 1]) - (P[2 * j + 1] - P[2 * i + 1]) * (P[2 * k] - P[2 * i]);
  const out = [];
  while (idx.length > 3) {
    const L = idx.length;
    let found = -1;
    for (let a = 0; a < L && found < 0; a++) {
      const i0 = idx[(a + L - 1) % L], i1 = idx[a], i2 = idx[(a + 1) % L];
      if (cross(i0, i1, i2) <= eps) continue;                 // reflex, or flat
      let ok = true;
      for (let z = 0; z < L && ok; z++) {
        const j = idx[z];
        if (j === i0 || j === i1 || j === i2) continue;
        if (cross(i0, i1, j) >= -eps && cross(i1, i2, j) >= -eps && cross(i2, i0, j) >= -eps) ok = false;
      }
      if (ok) found = a;
    }
    if (found < 0) return null;
    out.push(idx[(found + L - 1) % L], idx[found], idx[(found + 1) % L]);
    idx.splice(found, 1);
  }
  if (cross(idx[0], idx[1], idx[2]) > eps) out.push(idx[0], idx[1], idx[2]);
  return out;
}

/**
 * The fold mesh with the glyph drawn INTO it: { ...mesh, n, xy, tri, m, triCell, cell, tint, motifTint: true,
 * motifCut: { triangles, bad } }, or null when the glyph does not meet the mesh. A 3D outline alone is a thin line on
 * a bent translucent sheet; a fill in extra layers over the sheet cannot be sorted by the renderer (three nearly
 * coincident sheets). So the sheet itself carries the glyph: every triangle that an outline crosses is cut EXACTLY
 * along it — at the points where the outline crosses the triangle's edges (shared with the triangle across each edge,
 * so the cut mesh has no cracks) and through the outline's own points inside the triangle — and the parts inside and
 * outside the glyph are triangulated apart (ear clipping). So the fill has the drawn outline's shape at any size of
 * comma and of triangle: the thin tail is not lost in a coarse mesh (cutting each triangle along one straight chord,
 * as the Klein-bottle version did, broke the big comma's tail into shards on the hinge meshes). Every point of the
 * cut comes twice, once inside the glyph and once outside, so the colour changes exactly at the outline and every
 * triangle has one tint. One sheet, tinted on both sides alike, which is what a glyph that crosses a glide seam
 * needs: there the tile's front continues into its back.
 * The tint is two bits (the renderer reads them so): bit 0 = the mesh's own tint (a kaleidoscope star's secondary
 * tiles, the renderer's `ghost`), kept; bit 1 = inside the glyph (the renderer's `fill`). So 0 plain, 1 ghost, 2 fill,
 * 3 ghost and fill. A new point takes the piece of the TRIANGLE it is made for (mesh.triCell when the mesh has it: a
 * corner on a crease carries the lowest piece around it, which need not be this triangle's); a crossing point on a
 * crease edge lies on the crease, where the two pieces' maps agree. The mesh's own vertices come first, unchanged,
 * then the new points two by two (inside copy, outside copy). Triangles keep their order and their winding; a cut one
 * is replaced in place by its parts. Everything that refers to the plane (boundary, cells, creases, locate, bbox,
 * root, lid, ...) is the mesh's own. motifCut.bad counts triangles left whole because rounding made the cut
 * inconsistent (never seen; test/motif.test.js checks every group); motifCut.dropped, triangles of no area (two
 * corners on one spot) that the outline crosses: they have nothing to draw and are left out.
 */
export function motifTintMesh(group, mesh, motif = motifFor(group)) {
  const src = motif.polylines[0], rad = motif.radius;
  const n = mesh.n, xy = mesh.xy, tri = mesh.tri, nt = (tri.length / 3) | 0;
  // the box of the vertices themselves (mesh.bbox need not hold every vertex: a star's spines, a lid)
  const bb = [Infinity, Infinity, -Infinity, -Infinity];
  for (let v = 0; v < n; v++) { const x = xy[2 * v], y = xy[2 * v + 1]; if (x < bb[0]) bb[0] = x; if (y < bb[1]) bb[1] = y; if (x > bb[2]) bb[2] = x; if (y > bb[3]) bb[3] = y; }
  if (!(bb[2] >= bb[0])) return null;
  const mx = (bb[0] + bb[2]) / 2, my = (bb[1] + bb[3]) / 2, R = Math.hypot(bb[2] - bb[0], bb[3] - bb[1]) / 2;
  const copies = [];
  for (const g of elementsNear(group, mx, my, R + rad * 1.01, motif.at[0], motif.at[1])) {
    const ox = g.a * motif.at[0] + g.b * motif.at[1] + g.tx, oy = g.c * motif.at[0] + g.d * motif.at[1] + g.ty;
    if (ox < bb[0] - rad || ox > bb[2] + rad || oy < bb[1] - rad || oy > bb[3] + rad) continue;
    const pts = new Float64Array(src.length);
    for (let i = 0; i < src.length; i += 2) {
      const x0 = src[i], y0 = src[i + 1];
      pts[i] = g.a * x0 + g.b * y0 + g.tx; pts[i + 1] = g.c * x0 + g.d * y0 + g.ty;
    }
    const C = outlineIndex(pts);
    let sa = 0;
    for (let i = 0; i + 3 < pts.length; i += 2) sa += pts[i] * pts[i + 3] - pts[i + 2] * pts[i + 1];
    C.ccw = sa > 0; C.nu = pts.length / 2 - 1; C.seen = new Int32Array(C.nu).fill(-1);
    copies.push(C);
  }
  if (!copies.length) return null;
  const cls = new Uint8Array(n);
  let anyIn = false;
  for (let v = 0; v < n; v++) {
    const x = xy[2 * v], y = xy[2 * v + 1];
    for (const C of copies) if (insideIndexed(C, x, y)) { cls[v] = 1; anyIn = true; break; }
  }
  // a coarse grid over the mesh: the cells that a segment of an outline may touch. A triangle that meets none of them
  // is not crossed (its corners are all on one side) and is kept whole without looking for crossings.
  const GN = 48, gw = (bb[2] - bb[0]) / GN || 1, gh = (bb[3] - bb[1]) / GN || 1;
  const gi = (x) => { const i = Math.floor((x - bb[0]) / gw); return i < 0 ? 0 : i >= GN ? GN - 1 : i; };
  const gj = (y) => { const j = Math.floor((y - bb[1]) / gh); return j < 0 ? 0 : j >= GN ? GN - 1 : j; };
  const marked = new Uint8Array(GN * GN);
  for (const C of copies) {
    const P = C.pts;
    for (let i = 0; i < C.nu; i++) {
      const xa = P[2 * i], ya = P[2 * i + 1], xb = P[2 * i + 2], yb = P[2 * i + 3];
      if (Math.max(xa, xb) < bb[0] || Math.min(xa, xb) > bb[2] || Math.max(ya, yb) < bb[1] || Math.min(ya, yb) > bb[3]) continue;
      for (let j = gj(Math.min(ya, yb)), j1 = gj(Math.max(ya, yb)); j <= j1; j++) {
        for (let k = gi(Math.min(xa, xb)), k1 = gi(Math.max(xa, xb)); k <= k1; k++) marked[j * GN + k] = 1;
      }
    }
  }
  const nearOutline = (x0, y0, x1, y1) => {
    for (let j = gj(y0), j1 = gj(y1); j <= j1; j++) for (let k = gi(x0), k1 = gi(x1); k <= k1; k++) if (marked[j * GN + k]) return true;
    return false;
  };
  // the crossings of a mesh edge (lo < hi) with the outlines, in order along it from lo: { t, k, i, u, x, y, vin }
  // (k: the copy, i: its outline's segment i -> i + 1, u: where on it; vin: the index of the inside copy, once made)
  const edgeX = new Map(), NONE = [];
  let visit = 0;
  const crossingsOf = (lo, hi) => {
    const key = lo * n + hi;
    let X = edgeX.get(key);
    if (X) return X;
    X = NONE;
    const px = xy[2 * lo], py = xy[2 * lo + 1], qx = xy[2 * hi], qy = xy[2 * hi + 1];
    const x0 = Math.min(px, qx), x1 = Math.max(px, qx), y0 = Math.min(py, qy), y1 = Math.max(py, qy);
    visit++;
    for (let k = 0; k < copies.length; k++) {
      const C = copies[k];
      if (x1 < C.x0 || x0 > C.x1 || y1 < C.y0 || y0 > C.y1) continue;
      const P = C.pts;
      for (let b = C.bin(y0), b1 = C.bin(y1); b <= b1; b++) {
        for (let s = C.start[b], s1 = C.start[b + 1]; s < s1; s++) {
          const i = C.list[s];
          if (C.seen[i] === visit) continue;
          C.seen[i] = visit;
          const ax = P[2 * i], ay = P[2 * i + 1], bx = P[2 * i + 2], by = P[2 * i + 3];
          const o1 = (qx - px) * (ay - py) - (qy - py) * (ax - px), o2 = (qx - px) * (by - py) - (qy - py) * (bx - px);
          if ((o1 >= 0) === (o2 >= 0)) continue;                 // a point ON a line counts as on its positive side
          const o3 = (bx - ax) * (py - ay) - (by - ay) * (px - ax), o4 = (bx - ax) * (qy - ay) - (by - ay) * (qx - ax);
          if ((o3 >= 0) === (o4 >= 0)) continue;
          const t = Math.min(1 - 1e-9, Math.max(1e-9, o3 / (o3 - o4))), u = o1 / (o1 - o2);
          if (X === NONE) X = [];
          X.push({ t, k, i, u, x: px + t * (qx - px), y: py + t * (qy - py), vin: -1 });
        }
      }
    }
    if (X.length > 1) X.sort((p, q) => p.t - q.t);
    edgeX.set(key, X);
    return X;
  };
  const triCell = mesh.triCell && mesh.triCell.length * 3 >= tri.length ? mesh.triCell : null;
  const ghost0 = mesh.tint && mesh.tint.length >= n ? mesh.tint : null;   // bit 0: a star's secondary tiles
  const extraXY = [], extraCell = [], extraTint = [];
  const pair = (x, y, piece, gb) => {                  // a new point: its inside copy (fill) and, next, its outside copy
    const k = n + extraXY.length / 2;
    extraXY.push(x, y, x, y); extraCell.push(piece, piece); extraTint.push(gb + 2, gb);
    return k;
  };
  const out = [], outCell = [];
  let cutTriangles = 0, bad = 0, dropped = 0;
  const f32 = Math.fround;
  /** Cut triangle (a, b, c) along the outlines and emit its parts; false = leave it whole (no outline in it, or bad). */
  const cutTriangle = (a, b, c, piece) => {
    const ax = xy[2 * a], ay = xy[2 * a + 1], bx = xy[2 * b], by = xy[2 * b + 1], cx = xy[2 * c], cy = xy[2 * c + 1];
    const x0 = Math.min(ax, bx, cx), x1 = Math.max(ax, bx, cx), y0 = Math.min(ay, by, cy), y1 = Math.max(ay, by, cy);
    if (!nearOutline(x0, y0, x1, y1)) return false;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (!(area !== 0)) return false;
    // worked on counter-clockwise (v0, v1, v2); emitted in the triangle's own winding
    const v0 = a, v1 = area > 0 ? b : c, v2 = area > 0 ? c : b;
    const X0 = crossingsOf(v0 < v1 ? v0 : v1, v0 < v1 ? v1 : v0), X1 = crossingsOf(v1 < v2 ? v1 : v2, v1 < v2 ? v2 : v1),
      X2 = crossingsOf(v2 < v0 ? v2 : v0, v2 < v0 ? v0 : v2);
    if ((X0.length & 1) !== (cls[v0] ^ cls[v1]) || (X1.length & 1) !== (cls[v1] ^ cls[v2]) || (X2.length & 1) !== (cls[v2] ^ cls[v0])) { bad++; return false; }
    if (!X0.length && !X1.length && !X2.length) return false;  // no outline crosses it: one side, whole
    const edges = [{ s: v0, t: v1, X: X0, fwd: v0 < v1 }, { s: v1, t: v2, X: X1, fwd: v1 < v2 }, { s: v2, t: v0, X: X2, fwd: v2 < v0 }];
    // the boundary, counter-clockwise: each corner, then the crossings on its edge in order
    const nodes = [];
    for (const E of edges) {
      nodes.push({ x: xy[2 * E.s], y: xy[2 * E.s + 1], v: E.s });
      const X = E.X, L = X.length;
      const ex = xy[2 * E.t] - xy[2 * E.s], ey = xy[2 * E.t + 1] - xy[2 * E.s + 1];
      for (let z = 0; z < L; z++) {
        const rec = X[E.fwd ? z : L - 1 - z], P = copies[rec.k].pts, i = 2 * rec.i;
        nodes.push({ x: rec.x, y: rec.y, rec, enter: ex * (P[i + 3] - P[i + 1]) - ey * (P[i + 2] - P[i]) > 0 });
      }
    }
    const nb = nodes.length;
    // the chains: along each outline, from a crossing where it enters the triangle to the next one, where it leaves
    const byCopy = new Map();
    for (let id = 0; id < nb; id++) {
      const N = nodes[id];
      if (!N.rec) continue;
      let l = byCopy.get(N.rec.k);
      if (!l) byCopy.set(N.rec.k, (l = []));
      l.push(id);
    }
    const chains = [];
    for (const [k, list] of byCopy) {
      const C = copies[k], nu = C.nu;
      list.sort((p, q) => (nodes[p].rec.i + nodes[p].rec.u) - (nodes[q].rec.i + nodes[q].rec.u));
      const L = list.length;
      for (let z = 0; z < L; z++) {
        const from = list[z], N = nodes[from];
        if (!N.enter) continue;
        const to = list[(z + 1) % L], M = nodes[to];
        if (M.enter || to === from) { bad++; return false; }
        const count = (M.rec.i - N.rec.i + nu) % nu;
        if (count === 0 && M.rec.u < N.rec.u) { bad++; return false; }
        const ids = [];
        for (let s = 1; s <= count; s++) {
          const j = (N.rec.i + s) % nu;
          nodes.push({ x: C.pts[2 * j], y: C.pts[2 * j + 1] });
          ids.push(nodes.length - 1);
        }
        chains.push({ from, to, ids, left: C.ccw ? 1 : 0 });
      }
    }
    // cut the triangle along the chains (they never cross: the outlines are simple and their copies disjoint);
    // the part to the left of a chain is inside its copy when the copy runs counter-clockwise
    let polys = [{ ids: Array.from({ length: nb }, (_, i) => i), label: -1 }];
    for (const ch of chains) {
      let q = -1, ia = -1, ib = -1;
      for (let w = 0; w < polys.length && q < 0; w++) {
        const A = polys[w].ids.indexOf(ch.from), B = polys[w].ids.indexOf(ch.to);
        if (A >= 0 && B >= 0) { q = w; ia = A; ib = B; }
      }
      if (q < 0) { bad++; return false; }
      const ids = polys[q].ids, L = ids.length, right = [], left = [];
      for (let z = ia; ; z = (z + 1) % L) { right.push(ids[z]); if (z === ib) break; }
      for (let z = ib; ; z = (z + 1) % L) { left.push(ids[z]); if (z === ia) break; }
      for (let z = ch.ids.length - 1; z >= 0; z--) right.push(ch.ids[z]);
      for (const id of ch.ids) left.push(id);
      polys.splice(q, 1, { ids: right, label: 1 - ch.left }, { ids: left, label: ch.left });
    }
    // triangulate every part; each corner must lie on the side its part is on
    const eps = 1e-12 * ((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
    // An outline's own point can lie ON a straight side of the triangle (exactly, a vertex of the glyph on a mesh
    // edge): it then coincides with the crossing on that side, the part has a side of no length, and every ear is
    // blocked by the twin (final fix, 10 Nov: one triangle in 11,225 of a dragged xx cut was left whole, of mixed
    // tint, qa/final-verify-tests-math). Coincident neighbours are merged, keeping the crossing (it is shared with
    // the triangle across that side) or a corner of the triangle; the same in both parts, which share the chain.
    const tie = 1e-12 * Math.max(x1 - x0, y1 - y0);
    const rank = (id) => (nodes[id].v !== undefined ? 2 : nodes[id].rec ? 1 : 0);
    for (const Pg of polys) {
      const ids = Pg.ids;
      for (let z = 0; ids.length > 3 && z < ids.length; ) {
        const p = nodes[ids[z]], q = nodes[ids[(z + 1) % ids.length]];
        if (Math.abs(p.x - q.x) <= tie && Math.abs(p.y - q.y) <= tie) ids.splice(rank(ids[z]) >= rank(ids[(z + 1) % ids.length]) ? (z + 1) % ids.length : z, 1);
        else z++;
      }
    }
    const parts = [];
    for (const Pg of polys) {
      if (Pg.label < 0) { bad++; return false; }
      const m = Pg.ids.length, flat = new Float64Array(2 * m);
      for (let z = 0; z < m; z++) {
        const N = nodes[Pg.ids[z]];
        if (N.v !== undefined && cls[N.v] !== Pg.label) { bad++; return false; }
        flat[2 * z] = N.x; flat[2 * z + 1] = N.y;
      }
      const T = earClip(flat, m, eps);
      if (!T) { bad++; return false; }
      parts.push({ Pg, T });
    }
    // the cut is good: make its new points (each crossing once, shared with the triangle across its edge) and emit
    const gb = ghost0 && ghost0[a] & 1 ? 1 : 0;
    const vtx = (id, label) => {
      const N = nodes[id];
      if (N.v !== undefined) return N.v;
      if (N.rec) { if (N.rec.vin < 0) N.rec.vin = pair(N.rec.x, N.rec.y, piece, gb); return N.rec.vin + (label ? 0 : 1); }
      if (N.vin === undefined) N.vin = pair(N.x, N.y, piece, gb);
      return N.vin + (label ? 0 : 1);
    };
    for (const { Pg, T } of parts) {
      for (let z = 0; z < T.length; z += 3) {
        const i0 = Pg.ids[T[z]], i1 = Pg.ids[T[z + 1]], i2 = Pg.ids[T[z + 2]];
        // after rounding to the mesh's float32 a sliver may come out flat: leave it out (it has no area to draw)
        const A0 = nodes[i0], A1 = nodes[i1], A2 = nodes[i2];
        const ar = (f32(A1.x) - f32(A0.x)) * (f32(A2.y) - f32(A0.y)) - (f32(A1.y) - f32(A0.y)) * (f32(A2.x) - f32(A0.x));
        if (!(ar > 0)) continue;
        const v0 = vtx(i0, Pg.label), v1 = vtx(i1, Pg.label), v2 = vtx(i2, Pg.label);
        if (area > 0) out.push(v0, v1, v2); else out.push(v0, v2, v1);
        outCell.push(piece);
      }
    }
    return true;
  };
  for (let ti = 0; ti < nt; ti++) {
    const a = tri[3 * ti], b = tri[3 * ti + 1], c = tri[3 * ti + 2];
    const piece = triCell ? triCell[ti] : mesh.cell[a];
    if (cutTriangle(a, b, c, piece)) { cutTriangles++; continue; }
    if (cls[a] !== cls[b] || cls[b] !== cls[c]) {
      // left whole across the outline: a triangle of no area (two corners on one spot, along a crease) has nothing to
      // draw and is left out; any other is a cut that went wrong (counted in cutTriangle, kept so the mesh stays whole)
      const ar = (xy[2 * b] - xy[2 * a]) * (xy[2 * c + 1] - xy[2 * a + 1]) - (xy[2 * b + 1] - xy[2 * a + 1]) * (xy[2 * c] - xy[2 * a]);
      if (ar === 0) { dropped++; continue; }
    }
    out.push(a, b, c); outCell.push(piece);
  }
  if (!anyIn && !cutTriangles) return null;
  const k = extraXY.length / 2;
  const xy2 = new Float32Array(2 * (n + k));
  xy2.set(xy.subarray(0, 2 * n)); xy2.set(extraXY, 2 * n);
  const cell2 = new Uint16Array(n + k);
  cell2.set(mesh.cell.subarray(0, n)); cell2.set(extraCell, n);
  const tint = new Uint8Array(n + k);
  for (let v = 0; v < n; v++) tint[v] = (ghost0 && ghost0[v] & 1 ? 1 : 0) + 2 * cls[v];
  tint.set(extraTint, n);
  return { ...mesh, n: n + k, xy: xy2, tri: Uint32Array.from(out), m: outCell.length, triCell: Uint16Array.from(outCell), cell: cell2, tint,
    motifTint: true, motifCut: { triangles: cutTriangles, bad, dropped } };
}

// ---------------------------------------------------------------------------------------------------------------
// The pieces of the pattern inside a tile
// ---------------------------------------------------------------------------------------------------------------

/**
 * The pieces of all copies of the motif that lie inside the (warped) tile of `domain`, as polylines in actual plane
 * coordinates. A copy that lies wholly inside comes back whole (closed outlines stay closed: last point = first point);
 * a copy that the cut crosses comes back as open arcs that end exactly on the tile's boundary.
 * Because the tile is a fundamental domain, the pieces together are exactly ONE motif: folded up, they join across the seams.
 */
export function motifInTile(group, domain, motif = motifFor(group)) {
  const warp = domain.warp, edges = domain.edges, ne = edges.length;
  const identity = !warp || warp.amp === 0;
  const peak = identity ? 0 : (warp.peak || 0) * 1.05 + 1e-9;
  const tmp = [0, 0];
  /** > 0 outside, < 0 inside: the largest signed distance to the tile's edge lines, at the pre-image of (x, y). */
  const side = (x, y) => {
    let s = -Infinity;
    for (let i = 0; i < ne; i++) { const d = edges[i].nx * x + edges[i].ny * y - edges[i].c; if (d > s) s = d; }
    if (identity || s > peak || s < -peak) return s;       // the warp moves no point by more than `peak`
    warp.inv(x, y, tmp);
    s = -Infinity;
    for (let i = 0; i < ne; i++) { const d = edges[i].nx * tmp[0] + edges[i].ny * tmp[1] - edges[i].c; if (d > s) s = d; }
    return s;
  };

  // bounding disc of the warped tile
  let cx = 0, cy = 0;
  for (const p of domain.poly) { cx += p[0]; cy += p[1]; }
  cx /= domain.poly.length; cy /= domain.poly.length;
  let Rt = 0;
  for (const p of domain.poly) Rt = Math.max(Rt, Math.hypot(p[0] - cx, p[1] - cy));
  Rt += peak;

  const pieces = [];
  const els = elementsNear(group, cx, cy, Rt + motif.radius + 1e-9, motif.at[0], motif.at[1]);
  for (const g of els) {
    for (let pi = 0; pi < motif.polylines.length; pi++) {
      const src = motif.polylines[pi], k = src.length / 2;
      const closed = motif.closed ? !!motif.closed[pi] : (src[0] === src[2 * k - 2] && src[1] === src[2 * k - 1]);
      // the copy's points with their side of the boundary; where the outline runs close to the boundary without
      // changing side, the chord is sampled more finely, so a shallow dip across the cut is not missed
      const X = [], Y = [], S = [];
      let nin = 0, px = 0, py = 0, ps = 0;
      for (let i = 0; i < k; i++) {
        const x = g.a * src[2 * i] + g.b * src[2 * i + 1] + g.tx, y = g.c * src[2 * i] + g.d * src[2 * i + 1] + g.ty;
        const sv = side(x, y);
        if (i > 0 && (sv <= 0) === (ps <= 0)) {
          const seg = Math.hypot(x - px, y - py);
          if (Math.min(Math.abs(sv), Math.abs(ps)) < 1.6 * seg) {
            for (let j = 1; j < 4; j++) {
              const mx = px + (j / 4) * (x - px), my = py + (j / 4) * (y - py), ms = side(mx, my);
              X.push(mx); Y.push(my); S.push(ms);
              if (ms <= 0) nin++;
            }
          }
        }
        X.push(x); Y.push(y); S.push(sv);
        if (sv <= 0) nin++;
        px = x; py = y; ps = sv;
      }
      const kk = X.length;
      if (nin === 0) continue;
      if (nin === kk) {
        const out = new Float32Array(2 * k);
        for (let i = 0; i < k; i++) {
          out[2 * i] = g.a * src[2 * i] + g.b * src[2 * i + 1] + g.tx;
          out[2 * i + 1] = g.c * src[2 * i] + g.d * src[2 * i + 1] + g.ty;
        }
        pieces.push(out);
        continue;
      }
      // the point where the segment i -> j crosses the boundary (i inside, j outside or the reverse): bisection
      const cross = (i, j) => {
        let ax = X[i], ay = Y[i], bx = X[j], by = Y[j];
        const ain = S[i] <= 0;
        for (let it = 0; it < 22; it++) {
          const mx = (ax + bx) / 2, my = (ay + by) / 2;
          if ((side(mx, my) <= 0) === ain) { ax = mx; ay = my; } else { bx = mx; by = my; }
        }
        return ain ? [ax, ay] : [bx, by];
      };
      const runs = [];
      let cur = null;
      for (let i = 0; i < kk; i++) {
        if (S[i] <= 0) {
          if (!cur) { cur = []; if (i > 0) cur.push(cross(i, i - 1)); }
          cur.push([X[i], Y[i]]);
        } else if (cur) {
          cur.push(cross(i - 1, i));
          runs.push(cur); cur = null;
        }
      }
      if (cur) runs.push(cur);
      // a closed outline that starts and ends inside: the last run continues into the first
      if (closed && runs.length > 1 && S[0] <= 0 && S[kk - 1] <= 0) {
        const last = runs.pop();
        last.pop();                                    // the repeated first point
        runs[0] = last.concat(runs[0]);
      }
      for (const r of runs) {
        if (r.length < 2) continue;
        const out = new Float32Array(2 * r.length);
        for (let i = 0; i < r.length; i++) { out[2 * i] = r[i][0]; out[2 * i + 1] = r[i][1]; }
        pieces.push(out);
      }
    }
  }
  return pieces;
}
