// folds/hinge.js — fold type 'hinge' (SPEC 5.3, 5.4, 7): 2222, 22*, 2*22, 442, 4*2, 333, 3*3, 632.
//
// ===============================================================================================================
// THE ANCHORED FORM (SPEC 7, anchor contract) — read this first if you build on hingeKinematics (the cross-cap does)
// ===============================================================================================================
//
//   hingeKinematics(group, mesh, { anchor: [x, y], plump?, root? })      createFold(group, domain, mesh, { anchor })
//
// opts.anchor is a plane point in STRAIGHT (unwarped) coordinates; the app sets it when a preset is chosen, to
// preset.anchor ?? preset.seed (contract C3, SPEC 8: a preset whose seed lies on a crease names a point of the cell its
// siblings close over, src/groupdata/hinge.js), and does not change it while the cut is dragged or made wavy. Without
// it (or with a malformed one) every result below is exactly the v1 one (anchor = seed: the frame is the identity).
//
//   C0      the kaleidoscope cell holding the anchor nudged by 1e-6 (0.3713, 0.9285) (the nudge of mesh.js).
//   walk    the straight segment from that anchor to the seed (domain.seed, nudged the same way) crosses lines of the
//           kaleidoscope l_1, ..., l_k, in this order (kin.walk). If the fixed piece kin.root does not lie in the
//           seed's cell (a forced opts.root), the walk goes on from the seed to the middle of that piece's cell.
//   frame   A(theta, phi) = Rot(l_1, a_1) ∘ ... ∘ Rot(l_k, a_k) ∘ Z_eps       (kin.frame(theta, out, phi))
//           Rot(l, a): rotation by a about l in the FLAT layout, lifting the far side of l (away from the anchor)
//           toward +z; a_i = theta for a crease (a glued line), phi for a mirror of the group (the page turn, below).
//           Z_eps: (x, y, z) -> (x, y, eps z), see "eps" below.
//   pose    f(x) = A(theta, phi) · M_c(theta) · (x, y, −beta h(u))     M_c, h: the root-relative kinematics and the
//           puff, exactly as described further down (unchanged).
//   page    the fold runs phi = pageTurn(t) (theta's ramp in PAGE_END = 0.5 instead of FOLD_END): a tile across a
//   turn    mirror of the group from the anchor first turns over that mirror onto the anchor's side, like a page,
//           while its flaps fold. Dragging the seed across a mirror m maps the tile onto its mirror image and changes
//           f by A_W Rot(m, phi + pi) A_W^-1 (A_W: the rest of the walk): nothing once phi = pi, so from PAGE_END on
//           the shape stays put (final fix, 10 Nov 2026: with phi = theta it jumped until FOLD_END,
//           qa/final-verify-owner-asks/crossing-22s.png). Before PAGE_END the jump is inherent: at t = 0 the tile
//           itself flips over the mirror (the seed is kept off it, clampSeed).
//
// At theta = pi the planar part of A is the reflection chain that carries the root cell onto C0, so at t = 1 every
// plane point x goes to the same place for EVERY seed and every wave:
//           F(x) = ( g_C0(u),  −s(x) · h(u) ),   u = the T-coordinates of x,   s(x) = +1 on the anchor's sheet, −1 on the other
// (the G-invariant map of the plane onto the closed shape over C0). The shape stays put; the seams slide over it.
// For 0 < theta < pi, f(x) is the product of the hinge rotations along the path anchor -> seed -> x; it therefore
// does not change at all while the seed moves (a plane point that stays in the tile keeps its place, also across a
// crease), except when the segment anchor -> seed sweeps across a vertex of the kaleidoscope (a rotation centre)
// or, in the groups with a mirror rim, when the seed crosses a mirror of the group before PAGE_END (the tile itself
// flips over it; see "page turn" below).
//
//   eps     22*, 2*22, 4*2 and 3*3 have mirrors (the open sides of T), and they are lines of the kaleidoscope too: the
//           walk may cross them. The reflection in a mirror of G maps a tile onto a tile with its two faces swapped,
//           so a tile an odd number of mirrors away from the anchor (kin.mirrored) must fold the other way round to
//           land on F: its own fold is mirrored (eps = −1: the flaps turn toward the paper's −z side, the puff goes
//           to +z), and A(pi) turns it over onto F. (With the rotations alone it would land on the same pouch, but
//           with every point on the other sheet: the seams and the motif would jump between the two sheets.) A tile
//           with eps = −1 can dip below the plane during the fold. 2222, 442, 333, 632 and 22x have no mirror: eps = 1.
//           Such a tile's paper is turned over in the closed shape (its +z side outside): fold.mirrored says so, for a
//           renderer that colours the two sides of the paper and wants the closed shape's colours to stay put too;
//           fold.mirroredAt(t) says when to swap them: while the page turn is edge-on (mirrorMix), so the flat tile
//           shows its front, as the plane does.
//
// The kinematics object in the anchored form (everything else as documented at hingeKinematics):
//   pose(theta, beta, phi)  includes A(theta, phi) (phi defaults to theta); pose(0, 0) is still the exact identity
//   pillow(x, y, cell, out) (X, Y) as before (T-coordinates: they do not depend on the frame); Z = ∓ h / H, MINUS on
//                           the anchor's sheet (kin.sheet 0: underneath at t = 1), plus on the other
//   unpillow(X, Y, Z, out)  through the anchor's cell: pose(pi, 1)(p) = unpillow(pillow(p)) (1e-12), as before
//   anchor                  [x, y] as used, or null
//   anchorIso               the isometry g of C0 (T-coordinates -> world) = the frame of the CLOSED shape. Equal to
//                           rootIso without an anchor. Place anything that belongs to the closed shape (the cross-cap's
//                           second stage) with anchorIso, NOT with rootIso (which stays the cell of the fixed piece).
//   sheet: Uint8Array       per piece, its sheet in the closed shape: 0 = the anchor's sheet (Z <= 0), 1 = the other.
//                           Use it instead of (depth & 1): sheet = (depth + flip) & 1 (= depth & 1 without an anchor).
//   flip                    the number of GLUED lines on the walk, mod 2 (the root's sheet is `flip`)
//   mirrored                eps === −1 (an odd number of mirrors of the group on the walk)
//   walk                    [{ px, py, dx, dy, glued }]: the lines crossed, in order; the far side is LEFT of (dx, dy)
//   pageTurns               a mirror of the group is on the walk (only then does phi matter)
//   frame(theta, out?, phi?) Float64Array(12): rows (r00 r01 r02 t0 | r10 r11 r12 t1 | r20 r21 r22 t2) of A(theta, phi)
// For 22x (all four sides of T glued) the half-turn seams again meet and the glide seams are again antipodal in
// pillow coordinates, now relative to C0 (test/hinge.test.js checks both with anchors).
//
// ===============================================================================================================
//
// The orbifold of these groups is two copies (front, back) of the kaleidoscope cell T, joined along the `glued`
// sides of T and open along its mirror sides. The tile is cut by the kaleidoscope's mirror lines into rigid pieces
// that form a tree of hinges (src/mesh.js). The fold:
//
//   kinematics   M_root = identity,  M_c(theta) = M_parent(theta) ∘ Rot(hinge_c, theta): every piece turns about the
//                crease it shares with its parent, by the same angle theta: 0 -> pi, lifting toward +z. At theta = pi
//                every piece lies on the root cell: even depth face up, odd depth face down.
//   the root     is the piece that stays where it is: the main piece of the kaleidoscope cell that holds the SEED
//                (straight coordinates, nudged as mesh.js nudges it). With a straight cut that is mesh.root, and it is
//                the whole cell, so every other piece is a flap hinged to it. With a wavy cut mesh.root is the piece
//                under the WARPED seed, which can be a flap across a crease; taking the seed's own cell keeps the
//                fixed piece the same for every amplitude of the wave, and keeps every piece of depth >= 2 a small
//                lobe that wraps around the rim. Parents, depths and hinge directions are recomputed from this root
//                (kin.root, kin.parent, kin.depth); the hinge LINES are those of the mesh.
//   puff         a point x of piece c has T-coordinates u = g_c^-1 x and height
//                    h(u) = H · prod over glued sides s of sqrt(dist(u, side s) / D_s),      D_s = max of that distance over T
//                and sits at  M_c(theta) · (x, y, −beta·h(u)),  beta: 0 -> 1.  (The −z side of the flat tile is the
//                outside of the finished shape.) Near a glued side h ~ sqrt(distance): front and back join smoothly;
//                at a corner where two glued sides meet h is linear: a cone point; on a mirror side h does not
//                vanish: the rim opens like a mouth.
//
// The mesh the fold hands back (fold.mesh) is the mesh it was given with a FINER BOUNDARY: the outline samples of
// mesh.js are sqrt(domainArea)/40 apart, and where the puffed sheet is steep (the ends of a mouth, a seam running
// over the rim) a polyline that coarse shows its corners. Every edge is resampled to about sqrt(domainArea)/120;
// the old samples are kept (sample j becomes sample k·j, so the glued partners still correspond index by index) and
// each new one gets its piece the way mesh.js does it. Vertices, triangles and pieces are the same arrays.
//
// Exports
//   default createFold(group, domain, mesh, opts) -> Fold            (SPEC 5.3; opts.anchor, SPEC 7; fold.anchor = the one used)
//   hingeKinematics(group, mesh, opts) -> { pose, pillow, unpillow, ... }   (SPEC 5.4, 7; the cross-cap builds on it)
//   kaleidoWalk(group, from, to) -> { lines, g0, g1 } | null           the lines of the kaleidoscope crossed by a segment
//   hingeSchedule(t, out) -> [theta, beta]                            the timing of this fold, reusable
//   pageTurn(t) -> phi, mirrorMix(t) -> [0, 1]                        the page turn over the mirrors, its colour swap
//   FOLD_END, PUFF_START, PAGE_END                                    its inner times
//   refineBoundary(domain, mesh, step) -> mesh                        the mesh with outline samples at most `step` apart
//
// A point that lies ACROSS a crease from its nominal piece. The callers hand over points with a piece index that can
// be off by one crease: a mesh vertex on a crease belongs to two pieces and its Float32 coordinates sit ~1e-7 to
// either side; a boundary sample gets the piece of the point nudged 1e-6 into the tile. The puff has a square-root
// profile at a crease, so "clamp the distance at 0" would cost sqrt(1e-7) there. Instead such a point moves exactly
// as the piece across the crease would: its T-coordinates are reflected back into T and the reflection is undone by
// the hinge rotation about that side (A_s(theta) below: the identity of the plane at theta = 0, the fold at
// theta = pi). So for every (x, cell) with x in or next to the cell:  at(1) is the G-invariant map of the plane,
// independent of `cell`, and at(t) is continuous in t and in x. Seams close to about 1e-8 tile sizes (on a glued
// side the height is the square root of a rounding error), well inside the 1e-6 of the SPEC.

import { inverse, compose } from '../geom.js';

const PI = Math.PI;
const MAX_REFLECT = 8;   // a point next to its cell is at most 6 reflections away (around the 6-fold corner of *632)
const NUDGE = 1e-6, NUDGE_X = 0.3713, NUDGE_Y = 0.9285;   // the nudge of mesh.js (seed -> root piece)
const MAX_WALK = 4096;   // lines a walk may cross (the plane view's window holds a few dozen)

/** t at which the hinges reach pi: from here on the seams are closed and the shape only puffs. */
export const FOLD_END = 0.8;
/** t at which the puff starts (the flaps are then 45 degrees from closing). */
export const PUFF_START = 0.48;
/**
 * t at which the page turn over the MIRRORS of the walk is done (THE ANCHORED FORM, "page turn"): a tile across a
 * mirror of the group from the anchor has then turned over onto the anchor's side, and from here on dragging the cut
 * across a mirror changes nothing in the shape (before the final fix of 10 Nov the mirrors turned with the creases,
 * until FOLD_END, and the half-folded shape jumped there: qa/final-verify-owner-asks/crossing-22s.png).
 */
export const PAGE_END = 0.5;

/**
 * Height of the puffed sheet at its highest point, as a fraction of the inradius of T. The closed pillows take the
 * default, except the two whose T is a thin triangle: 632 (30-60-90) and 442 (right isosceles) have a small inradius
 * for their size, and with the default their closed shape is only 0.20 and 0.23 of the longest side of T thick and
 * reads as a flat triangle from the default view (round 3, finding 37). 632 now 0.31, as 333 (0.32; 2222 0.43);
 * 442 at the reviewer's 0.75 since 10 Nov (it was 0.62, 0.25 thick: from 0.65 on the renderer's label test found the
 * "2" label on the comma line over the rim, notes/hinge-round3.md; under the label rule as amended for the big comma,
 * the comma's thin outline may touch a label where no spot is clean, at most 1 label in 40, and the whole suite is
 * green with 0.75: notes/integrator-final.md). On the open shapes the highest point is on the rim (half
 * the gape of the mouth); the two cone pouches and the pocket get a little more so that the mouth reads as open from
 * the default view.
 */
const TUNING = {
  default: { plump: 0.56 },
  '632': { plump: 0.85 },
  '442': { plump: 0.75 },
  '2*22': { plump: 0.62 },
  '4*2': { plump: 0.64 },
  '3*3': { plump: 0.72 },
};

// The two ramps. A flap turns at a constant rate and lands softly: linear, then a parabola with zero slope at the
// end (the seams approach and close gently; nothing clacks shut). The puff is the mirror image: it starts with zero
// slope and then grows at a constant rate. The slopes at t = 0 and t = 1 are not zero on purpose: the scrubber
// answers at once, and when the fold is played the timeline eases the ends in real time.
const EASE = 0.4;                      // share of a ramp spent easing
const RATE = 1 / (1 - EASE / 2);       // slope of its linear part
const land = (s) => (s <= 0 ? 0 : s >= 1 ? 1 : s < 1 - EASE ? RATE * s : 1 - (RATE / (2 * EASE)) * (1 - s) * (1 - s));
const launch = (s) => (s <= 0 ? 0 : s >= 1 ? 1 : s < EASE ? (RATE / (2 * EASE)) * s * s : RATE * (s - EASE / 2));

/** The timing: out[0] = hinge angle theta in [0, pi], out[1] = puff beta in [0, 1]; both C1 in t on (0, 1). */
export function hingeSchedule(t, out = [0, 0]) {
  out[0] = PI * land(t / FOLD_END);
  out[1] = launch((t - PUFF_START) / (1 - PUFF_START));
  return out;
}

/**
 * The angle of the page turn about the mirrors of the walk at t: the ramp of the creases, run in PAGE_END instead of
 * FOLD_END, so it is never behind theta (pi from PAGE_END on; C1 in t, soft landing).
 */
export function pageTurn(t) { return PI * land(t / PAGE_END); }

/** 0 -> 1, C2, zero slope at both ends (6x^5 - 15x^4 + 10x^3). */
const smoother = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (10 + x * (6 * x - 15)));

/**
 * Toward the default camera of the 3D view (src/render3d.js: azimuth 0, elevation 55 degrees, from the -y side), unit.
 * A mirrored tile's colours are swapped where its fixed piece, turning over, is seen edge-on from there.
 */
export const VIEW0 = Object.freeze([0, -Math.cos((55 * PI) / 180), Math.sin((55 * PI) / 180)]);
/** Half the time (in t) the colour swap of a mirrored tile takes: about 18 degrees of the page turn either side. */
export const SWAP_HALF = 0.04;

/**
 * [lo, hi] in t over which a mirrored tile's surface colours are swapped (fold.mirroredAt): centred on the moment its
 * fixed piece is first seen edge-on from the default camera on its way over (the image normal of the piece, which
 * moves with the frame A, turns from facing VIEW0 to facing away), the crossing nearest the page's own edge-on moment
 * (pageTurn = pi/2) when there are several; without one, on that moment. Always inside (0, PAGE_END], so a drag
 * across a mirror changes nothing, colours included, from PAGE_END on.
 */
export function swapWindow(kin) {
  const sch = [0, 0], fr = new Float64Array(12), s = kin.mirrored ? -1 : 1;   // a reflection reverses the normal
  const facing = (t) => {
    hingeSchedule(t, sch); kin.frame(sch[0], fr, pageTurn(t));
    return s * (fr[2] * VIEW0[0] + fr[6] * VIEW0[1] + fr[10] * VIEW0[2]);
  };
  return edgeOnWindow(facing, PAGE_END - SWAP_HALF, 0.4 * PAGE_END);
}

/**
 * The window of a colour swap (also the Möbius band's, src/folds/roll.js): facing(t) = the turning piece's unit
 * normal . VIEW0 (> 0 at t = 0). Centred on the moment, in (0, tMax], where it turns from facing the camera to facing
 * away, the one nearest tHalf when there are several, else on tHalf: [max(tc - SWAP_HALF, tc / 2), tc + SWAP_HALF].
 */
export function edgeOnWindow(facing, tMax, tHalf) {
  const N = 200;
  let best = null, prev = facing(0);
  for (let k = 1; k <= N; k++) {
    const t = (k / N) * tMax, cur = facing(t);
    if (prev > 0 && !(cur > 0)) {
      let lo = ((k - 1) / N) * tMax, hi = t;
      for (let it = 0; it < 40; it++) { const mid = 0.5 * (lo + hi); if (facing(mid) > 0) lo = mid; else hi = mid; }
      const tc = 0.5 * (lo + hi);
      if (best === null || Math.abs(tc - tHalf) < Math.abs(best - tHalf)) best = tc;
    }
    prev = cur;
  }
  const tc = best === null ? tHalf : best;
  return [Math.max(tc - SWAP_HALF, 0.5 * tc), tc + SWAP_HALF];
}

/** The swap over the window [lo, hi]: 0 before, 1 after, C2 in between. */
export function mirrorMix(t, win) { return smoother((t - win[0]) / (win[1] - win[0])); }

// ---------------------------------------------------------------------------------------------------------------
// The kaleidoscope cell T: its sides, which of them are glued, the height profile
// ---------------------------------------------------------------------------------------------------------------

const geometryCache = new WeakMap();

function cellGeometry(kaleido) {
  let G = geometryCache.get(kaleido);
  if (G) return G;
  const T = kaleido.cell, n = T.length;
  let area2 = 0;
  for (let i = 0; i < n; i++) { const p = T[i], q = T[(i + 1) % n]; area2 += p[0] * q[1] - p[1] * q[0]; }
  const sgn = area2 >= 0 ? 1 : -1;       // T is counter-clockwise by contract; survive the other order
  // side i runs T[i] -> T[i+1]; (nx, ny) is its unit normal pointing INTO T, so nx*u + ny*v - c >= 0 inside
  const nx = new Float64Array(n), ny = new Float64Array(n), c = new Float64Array(n), D = new Float64Array(n);
  let perimeter = 0;
  for (let i = 0; i < n; i++) {
    const p = T[i], q = T[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy);
    nx[i] = (-dy / l) * sgn; ny[i] = (dx / l) * sgn; c[i] = nx[i] * p[0] + ny[i] * p[1];
    for (const v of T) D[i] = Math.max(D[i], nx[i] * v[0] + ny[i] * v[1] - c[i]);
    perimeter += l;
  }
  const glued = [];
  for (let i = 0; i < n; i++) if (kaleido.glued[i]) glued.push(i);
  const ng = glued.length;
  const gnx = Float64Array.from(glued, (i) => nx[i]), gny = Float64Array.from(glued, (i) => ny[i]);
  const gc = Float64Array.from(glued, (i) => c[i]), ginvD = Float64Array.from(glued, (i) => 1 / D[i]);
  /** prod over glued sides of d_s / D_s (distances clamped at 0): (h / H)^2. */
  const prod = (u, v) => {
    let p = 1;
    for (let j = 0; j < ng; j++) { const d = gnx[j] * u + gny[j] * v - gc[j]; p *= d > 0 ? d * ginvD[j] : 0; }
    return p;
  };
  // the largest value of prod over T: a pattern search from the centroid (prod is log-concave on T: one maximum,
  // possibly on an open side or at an open corner)
  const inside = (u, v) => { for (let i = 0; i < n; i++) if (nx[i] * u + ny[i] * v - c[i] < -1e-12) return false; return true; };
  let bu = 0, bv = 0;
  for (const p of T) { bu += p[0] / n; bv += p[1] / n; }
  let best = prod(bu, bv), step = 0;
  for (const p of T) step = Math.max(step, Math.hypot(p[0] - bu, p[1] - bv));
  for (const p of T) { const q = prod(p[0], p[1]); if (q > best) { best = q; bu = p[0]; bv = p[1]; } }
  const DIRS = 16;
  while (step > 1e-11) {
    let moved = false;
    for (let k = 0; k < DIRS; k++) {
      const a = (2 * PI * k) / DIRS, u = bu + step * Math.cos(a), v = bv + step * Math.sin(a);
      if (!inside(u, v)) continue;
      const q = prod(u, v);
      if (q > best * (1 + 1e-15)) { best = q; bu = u; bv = v; moved = true; }
    }
    if (!moved) step /= 2;
  }
  // inradius: triangle 2·area/perimeter; a rectangle (or parallelogram) half its smaller height
  let inradius = Math.abs(area2) / perimeter;
  if (n !== 3) { inradius = Infinity; for (let i = 0; i < n; i++) inradius = Math.min(inradius, D[i] / 2); }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of T) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  // the reflection in each side (T is the cell whose isometry is the identity): s_i(u) = u - 2 (n_i·u - c_i) n_i
  const S = Array.from({ length: n }, (_, i) => ({
    a: 1 - 2 * nx[i] * nx[i], b: -2 * nx[i] * ny[i], c: -2 * nx[i] * ny[i], d: 1 - 2 * ny[i] * ny[i], tx: 2 * c[i] * nx[i], ty: 2 * c[i] * ny[i],
  }));
  let cenX = 0, cenY = 0;
  for (const p of T) { cenX += p[0] / n; cenY += p[1] / n; }
  G = {
    T, n, ng, glued, gnx, gny, gc, ginvD, prod, inside,
    nx, ny, c, isGlued: Uint8Array.from(T, (_, i) => (kaleido.glued[i] ? 1 : 0)), S, cen: [cenX, cenY],
    scale: Math.max(x1 - x0, y1 - y0),
    prodMax: best, zMax: Math.sqrt(best), top: [bu, bv], inradius,
    box: { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hx: (x1 - x0) / 2, hy: (y1 - y0) / 2 },
  };
  geometryCache.set(kaleido, G);
  return G;
}

const IDENTITY = (x, y, cell, out) => { out[0] = x; out[1] = y; out[2] = 0; return out; };

// ---------------------------------------------------------------------------------------------------------------
// Walking through the kaleidoscope: the cells a segment passes, the lines it crosses (the anchor's frame, SPEC 7)
// ---------------------------------------------------------------------------------------------------------------

const ID_ISO = Object.freeze({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
const isoAt = (g, p) => [g.a * p[0] + g.b * p[1] + g.tx, g.c * p[0] + g.d * p[1] + g.ty];

/** The isometry g (T -> world) of the kaleidoscope cell that holds (x, y), by folding the point into T; null if lost. */
function cellIsoOf(G, x, y) {
  let g = ID_ISO, u = x, v = y;
  const tol = -1e-12 * G.scale;
  for (let it = 0; it < MAX_WALK; it++) {
    let hit = -1, worst = tol;
    for (let i = 0; i < G.n; i++) { const d = G.nx[i] * u + G.ny[i] * v - G.c[i]; if (d < worst) { worst = d; hit = i; } }
    if (hit < 0) return g;
    // reflecting across a side of T that separates the point from T: one line fewer between them (it terminates)
    u -= 2 * worst * G.nx[hit]; v -= 2 * worst * G.ny[hit];
    g = compose(g, G.S[hit]);
  }
  return null;
}

/** Do the isometries g and h carry T onto the same cell? (A cell has one isometry: the kaleidoscope is simply transitive.) */
function sameCell(G, g, h) {
  const p = isoAt(g, G.cen), q = isoAt(h, G.cen);
  return Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6 * G.scale;
}

/**
 * Walk the segment (ax, ay) -> (bx, by), starting in the cell g0 (which holds the start), through the cells of the
 * kaleidoscope. Every line crossed is appended to `lines`, in order, as { px, py, dx, dy, glued }: a point of the
 * line and its unit direction, with the FAR side (toward the end) on the left; `glued` = the line is a side of the
 * cells that the group glues (a crease), false = a mirror of the group. Returns the isometry of the cell holding the
 * end, or null if the walk got lost.
 */
function walkSegment(G, g0, ax, ay, bx, by, lines) {
  let g = g0;
  const q = inverse(g);
  // T-coordinates (relative to the current cell) of the two ends; reflected along as the walk enters each next cell
  let ua = q.a * ax + q.b * ay + q.tx, va = q.c * ax + q.d * ay + q.ty;
  let ub = q.a * bx + q.b * by + q.tx, vb = q.c * bx + q.d * by + q.ty;
  let entry = -1, tcur = 0;
  for (let it = 0; it < MAX_WALK; it++) {
    let best = -1, bt = Infinity;
    for (let i = 0; i < G.n; i++) {
      if (i === entry) continue;
      const da = G.nx[i] * ua + G.ny[i] * va - G.c[i], db = G.nx[i] * ub + G.ny[i] * vb - G.c[i];
      if (!(db < 0 && db < da)) continue;      // the end lies on the inner side of this side's line
      const ti = da / (da - db);                // where the segment meets the line (0 = start, 1 = end)
      if (ti >= tcur - 1e-12 && ti < bt) { bt = ti; best = i; }
    }
    if (best < 0) return g;
    const P0 = isoAt(g, G.T[best]), P1 = isoAt(g, G.T[(best + 1) % G.n]);
    const next = compose(g, G.S[best]), C = isoAt(next, G.cen);
    let dx = P1[0] - P0[0], dy = P1[1] - P0[1];
    const l = Math.hypot(dx, dy);
    dx /= l; dy /= l;
    if (dx * (C[1] - P0[1]) - dy * (C[0] - P0[0]) < 0) { dx = -dx; dy = -dy; }
    lines.push({ px: P0[0], py: P0[1], dx, dy, glued: G.isGlued[best] === 1 });
    const s = G.S[best];
    let t0 = s.a * ua + s.b * va + s.tx; va = s.c * ua + s.d * va + s.ty; ua = t0;
    t0 = s.a * ub + s.b * vb + s.tx; vb = s.c * ub + s.d * vb + s.ty; ub = t0;
    g = next; entry = best; tcur = bt;
  }
  return null;
}

/**
 * The straight walk from `from` to `to` (plane points, straight coordinates, taken as they are: no nudge) through
 * the cells of group.kaleido: { lines (as in walkSegment), g0 (the cell of `from`), g1 (the cell of `to`) }, or null.
 */
export function kaleidoWalk(group, from, to) {
  if (!group || !group.kaleido) return null;
  const G = cellGeometry(group.kaleido);
  const g0 = cellIsoOf(G, from[0], from[1]);
  if (!g0) return null;
  const lines = [];
  const g1 = walkSegment(G, g0, from[0], from[1], to[0], to[1], lines);
  return g1 ? { lines, g0, g1 } : null;
}

/** opts.anchor as two finite numbers, or null (missing or malformed: anchor = seed, the v1 behaviour). */
function anchorOf(a) {
  if (!a || typeof a === 'string' || !(a.length >= 2)) return null;
  const x = Number(a[0]), y = Number(a[1]);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

/** M (12 numbers at offset m, rows r | t) := M ∘ (rotation by theta about the directed line (ax, ay) + s (dx, dy), its left side rising). */
function turnAbout(M, m, ax, ay, dx, dy, co, si) {
  const oc = 1 - co;
  const r00 = co + oc * dx * dx, r01 = oc * dx * dy, r02 = si * dy;
  const r10 = r01, r11 = co + oc * dy * dy, r12 = -si * dx;
  const r20 = -si * dy, r21 = si * dx, r22 = co;
  const t0 = ax - (r00 * ax + r01 * ay), t1 = ay - (r10 * ax + r11 * ay), t2 = -(r20 * ax + r21 * ay);
  for (let r = 0; r < 3; r++) {
    const k = m + 4 * r, a = M[k], b = M[k + 1], c = M[k + 2];
    M[k] = a * r00 + b * r10 + c * r20;
    M[k + 1] = a * r01 + b * r11 + c * r21;
    M[k + 2] = a * r02 + b * r12 + c * r22;
    M[k + 3] = a * t0 + b * t1 + c * t2 + M[k + 3];
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Kinematics
// ---------------------------------------------------------------------------------------------------------------

/**
 * hingeKinematics(group, mesh, opts) ->
 *   pose(theta, beta) -> fn(x, y, cell, out)   position of the plane point (x, y) of piece `cell`: hinges at theta in
 *                                              [0, pi], puff beta in [0, 1]. pose(0, 0) is the exact identity.
 *   pillow(x, y, cell, out) -> out = (X, Y, Z) pillow coordinates of the point at theta = pi, beta = 1, in the root frame:
 *                                              (X, Y) = T-coordinates mapped so that the bounding box of T is [-1, 1]^2,
 *                                              Z = ∓ h / H = ∓ prod over glued sides of sqrt(d_s / D_s): minus on the
 *                                              sheet of the root (even depth, underneath), plus on the other sheet.
 *                                              |Z| <= zMax (1/4 for a rectangle with four glued sides, reached at X = Y = 0,
 *                                              where Z = ∓ sqrt((1 - X²)(1 - Y²)) / 4).
 *   unpillow(X, Y, Z, out) -> out = (x, y, z)  the world position of a pillow point: pose(pi, 1)(p) = unpillow(pillow(p)).
 *   H, hMax, zMax                              h = H · |Z|; hMax = H · zMax = the greatest height
 *   box { cx, cy, hx, hy }                     centre and half-sizes of the bounding box of T (T-coordinates)
 *   root, rootIso                              the piece that stays put (see the top of the file: NOT always mesh.root
 *                                              when the cut is wavy) and the isometry g of its cell: T-coordinates -> world
 *   pieces, parent, depth: Int32Array          number of pieces; the tree seen from `root` (parent[root] = -1): use these,
 *                                              not mesh.cells[i].parent / .depth, to tell the sheets apart (even depth =
 *                                              the root's sheet, Z <= 0)
 *   geometry                                   the cell data (sides, glued sides, prod, box, inradius)
 *   anchor, anchorIso, sheet, flip, mirrored, walk, frame(theta)
 *                                              the anchored form (opts.anchor): see THE ANCHORED FORM at the top of the
 *                                              file. Without an anchor: anchor null, anchorIso = rootIso, sheet = depth & 1,
 *                                              flip 0, mirrored false, walk [], frame = the identity.
 * opts.plump overrides the height (hMax / inradius of T); opts.root forces the fixed piece (an index into mesh.cells);
 * opts.anchor = [x, y] (straight coordinates) makes the closed shape sit over the anchor's cell (SPEC 7).
 * Nothing here assumes that pieces of both sheets exist: a tile that covers only half of the pillow (22x), or a
 * single piece, is fine.
 */
export function hingeKinematics(group, mesh, opts = {}) {
  const kal = group.kaleido;
  if (!kal) throw new Error(`hinge fold: group ${group.id} has no kaleidoscope`);
  const G = cellGeometry(kal);
  const tune = { ...TUNING.default, ...(TUNING[group.id] || {}) };
  const plump = Number.isFinite(opts.plump) ? opts.plump : tune.plump;
  const hMax = plump * G.inradius;
  const H = G.zMax > 0 ? hMax / G.zMax : 0;
  const { ng, gnx, gny, gc, ginvD } = G;

  const cells = mesh.cells, P = cells.length;
  const gi = new Float64Array(6 * P);     // world -> T-coordinates, per piece: u = a x + b y + tx, v = c x + d y + ty
  const gf = new Float64Array(6 * P);     // T-coordinates -> world
  for (let i = 0; i < P; i++) {
    const g = cells[i].g, q = inverse(g);
    gi.set([q.a, q.b, q.tx, q.c, q.d, q.ty], 6 * i);
    gf.set([g.a, g.b, g.tx, g.c, g.d, g.ty], 6 * i);
  }

  // ---- the piece that stays put: the largest piece in the kaleidoscope cell of the (nudged, unwarped) seed
  let root = mesh.root || 0;
  const seed = mesh.domain && mesh.domain.seed;
  if (Number.isInteger(opts.root) && opts.root >= 0 && opts.root < P) root = opts.root;
  else if (seed) {
    const sx = seed[0] + NUDGE * NUDGE_X, sy = seed[1] + NUDGE * NUDGE_Y;
    let bestArea = -1;
    for (let i = 0; i < P; i++) {
      const k = 6 * i;
      if (cells[i].area > bestArea && G.inside(gi[k] * sx + gi[k + 1] * sy + gi[k + 2], gi[k + 3] * sx + gi[k + 4] * sy + gi[k + 5])) { bestArea = cells[i].area; root = i; }
    }
  }
  // ---- the tree of hinges seen from that root. The mesh gives each piece the crease it shares with its mesh parent,
  //      directed so that the piece lies on its left; walked the other way the same line is taken reversed.
  const hinge = new Float64Array(4 * P);  // ax, ay, unit direction (dx, dy); the piece lies to the left of the direction
  const parent = new Int32Array(P).fill(-1), depth = new Int32Array(P);
  const links = Array.from({ length: P }, () => []);
  for (let i = 0; i < P; i++) {
    const c = cells[i];
    if (!(c.parent >= 0 && c.parent < P) || !c.hinge) continue;
    const dx = c.hinge.bx - c.hinge.ax, dy = c.hinge.by - c.hinge.ay, l = Math.hypot(dx, dy) || 1;
    links[c.parent].push([i, c.hinge.ax, c.hinge.ay, dx / l, dy / l]);        // i hangs on its parent: as given
    links[i].push([c.parent, c.hinge.bx, c.hinge.by, -dx / l, -dy / l]);      // the parent hangs on i: reversed
  }
  const order = [root];                   // parents before children
  const seen = new Uint8Array(P);
  seen[root] = 1;
  for (let h = 0; h < order.length; h++) {
    const p = order[h];
    for (const [i, ax, ay, dx, dy] of links[p]) {
      if (seen[i]) continue;
      seen[i] = 1; parent[i] = p; depth[i] = depth[p] + 1;
      hinge.set([ax, ay, dx, dy], 4 * i);
      order.push(i);
    }
  }
  for (let i = 0; i < P; i++) if (!seen[i]) order.push(i);   // (a piece the mesh left without a hinge would simply stay put)
  const seq = new Int32Array(MAX_REFLECT);

  // ---- the anchor (SPEC 7): the walk from the anchor's cell to the root's cell, and the frame A(theta) it gives
  const r = cells[root].g;
  const walk = [];
  let anchorIso = r, anchorUsed = null, mirrored = false, flip = 0;
  const anchor = anchorOf(opts.anchor);
  if (anchor) {
    const ax = anchor[0] + NUDGE * NUDGE_X, ay = anchor[1] + NUDGE * NUDGE_Y;
    const g0 = cellIsoOf(G, ax, ay), lines = [];
    let g = g0, ex = ax, ey = ay;
    if (g && seed) { ex = seed[0] + NUDGE * NUDGE_X; ey = seed[1] + NUDGE * NUDGE_Y; g = walkSegment(G, g0, ax, ay, ex, ey, lines); }
    if (g && !sameCell(G, g, r)) {
      // the fixed piece is not in the seed's cell (a forced root): go on to the middle of the fixed piece's cell
      const rc = isoAt(r, G.cen);
      g = walkSegment(G, g, ex, ey, rc[0], rc[1], lines);
    }
    if (g && sameCell(G, g, r)) {
      walk.push(...lines);
      anchorIso = sameCell(G, g0, r) ? r : g0; anchorUsed = anchor;
      let mirrors = 0, creases = 0;
      for (const L of lines) if (L.glued) creases++; else mirrors++;
      mirrored = (mirrors & 1) === 1; flip = creases & 1;
    }
    // (a walk that got lost — never seen — leaves the v1 frame)
  }
  /**
   * The frame A(theta, phi) ∘ Z_eps of the anchored form, as rows (r00 r01 r02 t0 | r10 r11 r12 t1 | r20 r21 r22 t2):
   * each crease of the walk turns by theta, each mirror of the group on it by phi (the page turn; phi = theta by default).
   */
  function frame(theta, out = new Float64Array(12), phi = theta) {
    out.fill(0); out[0] = 1; out[5] = 1; out[10] = 1;
    if (walk.length) {
      const co = Math.cos(theta), si = theta === PI ? 0 : Math.sin(theta);
      const cm = Math.cos(phi), sm = phi === PI ? 0 : Math.sin(phi);
      for (const L of walk) {
        if (L.glued) turnAbout(out, 0, L.px, L.py, L.dx, L.dy, co, si);
        else turnAbout(out, 0, L.px, L.py, L.dx, L.dy, cm, sm);
      }
    }
    if (mirrored) { out[2] = -out[2]; out[6] = -out[6]; out[10] = -out[10]; }
    return out;
  }
  const anchored = walk.length > 0 || mirrored;
  const sheet = Uint8Array.from(depth, (d) => (d + flip) & 1);
  const pageTurns = walk.some((L) => !L.glued);   // a mirror of the group on the walk: phi matters

  function pose(theta, beta, phi = theta) {
    if (theta === 0 && beta === 0 && phi === 0) return IDENTITY;
    const co = Math.cos(theta), si = theta === PI ? 0 : Math.sin(theta), oc = 1 - co;
    // M[12 i ..]: rows (r00 r01 r02 t0 | r10 r11 r12 t1 | r20 r21 r22 t2) of the rigid motion of piece i
    const M = new Float64Array(12 * P);
    const F = anchored ? frame(theta, undefined, phi) : null;
    for (const i of order) {
      const m = 12 * i, p = parent[i];
      if (p < 0) { if (F) M.set(F, m); else { M[m] = 1; M[m + 5] = 1; M[m + 10] = 1; } continue; }
      // rotation by theta about the directed line a + s d (d in the plane): the left side rises toward +z
      const ax = hinge[4 * i], ay = hinge[4 * i + 1], dx = hinge[4 * i + 2], dy = hinge[4 * i + 3];
      const r00 = co + oc * dx * dx, r01 = oc * dx * dy, r02 = si * dy;
      const r10 = r01, r11 = co + oc * dy * dy, r12 = -si * dx;
      const r20 = -si * dy, r21 = si * dx, r22 = co;
      const t0 = ax - (r00 * ax + r01 * ay), t1 = ay - (r10 * ax + r11 * ay), t2 = -(r20 * ax + r21 * ay);
      const q = 12 * p;
      for (let r = 0; r < 3; r++) {
        const a = M[q + 4 * r], b = M[q + 4 * r + 1], c = M[q + 4 * r + 2];
        M[m + 4 * r] = a * r00 + b * r10 + c * r20;
        M[m + 4 * r + 1] = a * r01 + b * r11 + c * r21;
        M[m + 4 * r + 2] = a * r02 + b * r12 + c * r22;
        M[m + 4 * r + 3] = a * t0 + b * t1 + c * t2 + M[q + 4 * r + 3];
      }
    }
    const bh = beta * H;
    return (x, y, cell, out) => {
      if (!(cell >= 0 && cell < P)) cell = 0;
      const k = 6 * cell, m = 12 * cell;
      let u = gi[k] * x + gi[k + 1] * y + gi[k + 2], v = gi[k + 3] * x + gi[k + 4] * y + gi[k + 5];
      let prod = 1, z, j = 0;
      for (; j < ng; j++) {
        const d = gnx[j] * u + gny[j] * v - gc[j];
        if (d < 0) break;
        prod *= d * ginvD[j];
      }
      if (j === ng) z = -bh * Math.sqrt(prod);
      else {
        // across a crease from its piece: reflect into T, take the height there, undo each reflection by the hinge
        let K = 0;
        for (; K < MAX_REFLECT; K++) {
          let hit = -1, worst = 0;
          for (j = 0; j < ng; j++) { const d = gnx[j] * u + gny[j] * v - gc[j]; if (d < worst) { worst = d; hit = j; } }
          if (hit < 0) break;
          u -= 2 * worst * gnx[hit]; v -= 2 * worst * gny[hit];
          seq[K] = hit;
        }
        prod = 1;
        for (j = 0; j < ng; j++) { const d = gnx[j] * u + gny[j] * v - gc[j]; prod *= d > 0 ? d * ginvD[j] : 0; }
        z = -bh * Math.sqrt(prod);
        while (K-- > 0) {
          // A_s(theta) = (rotation by theta about side s, lifting the outside of T) ∘ (mirror in the plane through s)
          j = seq[K];
          const d = gnx[j] * u + gny[j] * v - gc[j], d2 = z * si - d * co;
          z = d * si + z * co;
          u += (d2 - d) * gnx[j]; v += (d2 - d) * gny[j];
        }
        x = gf[k] * u + gf[k + 1] * v + gf[k + 2]; y = gf[k + 3] * u + gf[k + 4] * v + gf[k + 5];
      }
      out[0] = M[m] * x + M[m + 1] * y + M[m + 2] * z + M[m + 3];
      out[1] = M[m + 4] * x + M[m + 5] * y + M[m + 6] * z + M[m + 7];
      out[2] = M[m + 8] * x + M[m + 9] * y + M[m + 10] * z + M[m + 11];
      return out;
    };
  }

  const { cx, cy, hx, hy } = G.box;
  function pillow(x, y, cell, out) {
    if (!(cell >= 0 && cell < P)) cell = 0;
    const k = 6 * cell;
    let u = gi[k] * x + gi[k + 1] * y + gi[k + 2], v = gi[k + 3] * x + gi[k + 4] * y + gi[k + 5];
    let flips = depth[cell] + flip;          // the sheet of the piece in the closed shape (anchored: relative to C0)
    for (let K = 0; K < MAX_REFLECT; K++) {
      let hit = -1, worst = 0;
      for (let j = 0; j < ng; j++) { const d = gnx[j] * u + gny[j] * v - gc[j]; if (d < worst) { worst = d; hit = j; } }
      if (hit < 0) break;
      u -= 2 * worst * gnx[hit]; v -= 2 * worst * gny[hit];
      flips++;
    }
    const zz = Math.sqrt(G.prod(u, v));
    out[0] = hx > 0 ? (u - cx) / hx : 0; out[1] = hy > 0 ? (v - cy) / hy : 0; out[2] = flips & 1 ? zz : -zz;
    return out;
  }
  const w = anchorIso;                       // the cell the closed shape sits on (= the root's cell without an anchor)
  function unpillow(X, Y, Z, out) {
    const u = cx + X * hx, v = cy + Y * hy;
    out[0] = w.a * u + w.b * v + w.tx; out[1] = w.c * u + w.d * v + w.ty; out[2] = Z * H;
    return out;
  }

  return {
    pose, pillow, unpillow, H, hMax, zMax: G.zMax, box: G.box, root, rootIso: r, pieces: P, parent, depth, geometry: G,
    anchor: anchorUsed, anchorIso, sheet, flip, mirrored, walk, frame, pageTurns,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The fold
// ---------------------------------------------------------------------------------------------------------------

/** Outline samples at most this far apart (in units of sqrt(domainArea)) in the mesh the fold hands back. */
const BOUNDARY_STEP = 1 / 120;

/**
 * The mesh with every boundary edge resampled k times finer (k per edge, the same for the two partners of a glued
 * pair; old sample j = new sample k·j). Returns the mesh itself when it is already fine enough.
 */
export function refineBoundary(domain, mesh, step) {
  const poly = domain && domain.poly, E = domain && domain.edges, warp = domain && domain.warp;
  if (!poly || !E || !warp || !Array.isArray(mesh.boundary) || typeof mesh.locate !== 'function' || !(step > 0)) return mesh;
  const H = poly.length, tmp = [0, 0];
  let cx = 0, cy = 0;
  for (const p of poly) { cx += p[0] / H; cy += p[1] / H; }
  let changed = false;
  const boundary = mesh.boundary.map((b) => {
    const i = b.edge, m = b.cells ? b.cells.length - 1 : 0;
    if (!(i >= 0 && i < H) || m < 1 || !E[i]) return b;
    const r = E[i].partner >= 0 && E[i].partner < i ? E[i].partner : i;          // the pair's first edge sets the count
    const len = Math.hypot(poly[(r + 1) % H][0] - poly[r][0], poly[(r + 1) % H][1] - poly[r][1]);
    const k = Math.min(8, Math.ceil(len / m / step - 1e-6));
    if (!(k > 1)) return b;
    changed = true;
    const M = m * k, pts = new Float32Array(2 * (M + 1)), cells = new Uint16Array(M + 1);
    const a = poly[i], c = poly[(i + 1) % H];
    for (let j = 0; j <= M; j++) {
      if (j % k === 0) { pts[2 * j] = b.pts[(2 * j) / k]; pts[2 * j + 1] = b.pts[(2 * j) / k + 1]; cells[j] = b.cells[j / k]; continue; }
      const t = j / M, sx = (1 - t) * a[0] + t * c[0], sy = (1 - t) * a[1] + t * c[1];
      warp.fwd(sx, sy, tmp);
      pts[2 * j] = tmp[0]; pts[2 * j + 1] = tmp[1];
      // its piece: the one of the point nudged toward the inside of the tile (as mesh.js does for its own samples)
      const dx = cx - sx, dy = cy - sy, l = Math.hypot(dx, dy) || 1;
      warp.fwd(sx + (1e-6 * dx) / l, sy + (1e-6 * dy) / l, tmp);
      cells[j] = mesh.locate(tmp[0], tmp[1]);
    }
    return { ...b, pts, cells };
  });
  return changed ? { ...mesh, boundary } : mesh;
}

export default function createFold(group, domain, mesh, opts = {}) {
  opts = opts || {};
  const kin = hingeKinematics(group, mesh, opts);
  const sched = [0, 0];
  const closed = kin.pose(PI, 1);
  const step = opts.boundaryStep === undefined ? BOUNDARY_STEP * Math.sqrt(group.domainArea) : opts.boundaryStep;
  const swap = kin.mirrored ? swapWindow(kin) : null;
  return {
    mesh: refineBoundary(domain || mesh.domain, mesh, step),
    stops: [{ t: 0, label: 'flat' }, { t: 1, label: 'closed' }],
    duration: 6,
    at(t) {
      if (!(t > 0)) return IDENTITY;
      if (t >= 1) return closed;
      hingeSchedule(t, sched);
      return kin.pageTurns ? kin.pose(sched[0], sched[1], pageTurn(t)) : kin.pose(sched[0], sched[1]);
    },
    kinematics: kin,
    /** The anchor the closed shape is placed by (SPEC 7), or null (anchor = seed). */
    anchor: kin.anchor,
    /**
     * true when the tile lies an odd number of mirrors of the group away from the anchor (eps = -1, see the top of the
     * file): its paper ends up TURNED OVER — the +z side of the flat tile is the outside of the closed shape, where a
     * tile on the anchor's side shows its -z side there. A renderer that colours the two sides of the paper differently
     * keeps the closed shape's colours unchanged while the seed is dragged across a mirror only if it swaps its front
     * and back colours for such a tile; mirroredAt(t) says when (the flat tile shows its front, as in the plane).
     */
    mirrored: kin.mirrored,
    /**
     * How far the surface colours are swapped at t (SPEC 9 C3 addition): for a mirrored tile 0 at t = 0, 1 from
     * PAGE_END on, a cross-fade over swapWindow (about 0.08 of t, where its fixed piece is seen edge-on from the
     * default camera on its way over the mirror); 0 throughout for every other tile. (Before the final fix of 10 Nov
     * the app swapped at every t, so the flat tile turned pale when the cut crossed a mirror.)
     */
    mirroredAt(t) { return swap ? mirrorMix(t > 0 ? (t >= 1 ? 1 : t) : 0, swap) : 0; },
    /** [lo, hi]: the times of that cross-fade (null for a tile that is not mirrored). */
    swapWindow: swap,
  };
}
