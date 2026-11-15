// dev/patterns/designs/bigcomma/design.js — "Big comma": ONE comma per tile, as large as its copies allow, and nested.
//
// The idea. The comma is the yin-yang's own construction, three circular arcs: a round HEAD, a BACK arc that holds the
// head and touches it, a BELLY arc that touches the head from outside; back and belly meet at the tail's tip. Its ROOM is
// one tile of the group: the page's default tile when the group carries presets, else the roundest Dirichlet tile.
//   1. (the designer, 13 Nov) The comma is fitted into the room as large as it goes (a linear programme per shape and
//      turn), free or with its tail's tip sent into one corner, classic, curled or flat.
//   2. (the critique, 13 Nov) The best of those fits, and the largest fit of each class, then GROW AGAINST THEIR COPIES,
//      not against the walls of the room: where a neighbour leaves space (its bay, a corner it does not use) the comma
//      crosses the side of its tile, so the tail of one lies in the hollow of the next with one channel between them
//      (KNOBS.dotGap). A mirror stays a wall (the comma's mirror image is a copy too). The page's tile keeps at least
//      four fifths of the comma's outline (KNOBS.outMax). The growth stops at a dark share of KNOBS.capD and then spreads
//      the comma out (the channel to spare), steering clear of bare patches at the rotation centres.
//   3. The yin-yang's two small details finish it: a light EYE in the head, and a dark DOT in the comma's own bay when
//      the bay is open and a patch would otherwise stay bare; a second dot only where one still would (a mirror corner).
//   The grown comma that wins is the most curled, with the fewest dots and the smallest bare patch.
//
// Nothing is tabulated per group: the room, the fit, the growth and the dots are computed from e1, e2, reps (and
// presets[0] when it is there), every search is laid out relative to e1, and ties go to the first hand and the least
// turn from e1, so a turned, scaled or shifted group gets the same pattern turned, scaled and shifted (check.mjs).
import { elementsNear, latticeCoords, contains, symmetryElements } from '../../../../src/groups.js';
import { buildDomain } from '../../../../src/domain.js';
import { clipHalfPlane, polyArea, inverse, reflThrough } from '../../../../src/geom.js';

export const meta = { key: 'bigcomma', label: 'Big comma', hint: 'one big comma per tile, nested with its neighbours: an eye in its head' };

const TAU = 2 * Math.PI, DEG = Math.PI / 180;
const mod = (a, m) => ((a % m) + m) % m;

/** Dimensionless knobs (lengths in tile sizes, sqrt(domainArea)). */
export const KNOBS = {
  roundRoom: false,     // true: the room is the roundest Dirichlet tile even when the group has presets (rounder commas in
                        // 22*, 2*22, 632, 3*3, 4*2, 442, but the page's default tile then holds slices of two commas)
  margin: 0.032,        // every mark keeps this distance from the sides of its room: channels of twice that ...
  dotGap: 0.064,        // ... and a dot keeps the same channel from the comma and from another dot
  tip: 16,              // the angle of the tail's tip, degrees
  backMax: 2.1,         // the comma rises at most this many head radii above its head -> tip axis (the classic: 2)
  curled: 1.45,         // ... and a "curled" comma at least this many (a "flat" one less)
  eye: 0.36,            // radius of the eye, in head radii ...
  eyeMax: 0.5,          // ... up to this where the print would otherwise be darker than darkMax
  dotMin: 0.06,         // no dot smaller than this (radius)
  dotMax: 0.4,          // a dot's radius is at most this many head radii (about the eye's size: the yin-yang's twins) ...
  dotCap: 0.14,         // ... and at most this
  dots: 3,              // at most this many dots (the fits of the room, before they grow)
  bareGoal: 0.41,       // a bare patch (diameter) up to this is fine
  darkMin: 0.44, darkMax: 0.58,    // the dark share a candidate is not marked down for (the eye grows to keep it)
  step: 0.012,          // segment length of the outline
  // nesting (the critique, 13 Nov): the best fits of the room grow against their copies
  grow: true,           // false: the designer's version (every comma inside its room)
  growStarts: 3,        // how many fits are grown: the chosen one, then the largest curled, classic, flat fit
  growEvals: 100,       // at most this many trial poses per grown comma
  capD: 0.57,           // a comma grows until it alone (less its eye) darkens this share of the plane ...
  slackW: 0.6,          // ... and then spreads out: the channel to spare counts this much (per tile size)
  curlW: 0.03,          // while growing, a curled comma is worth this much more than a flat one
  dotsGrown: 2,         // at most this many dots beside a grown comma: the yin-yang's own in its bay, one more where needed
  outMax: 0.2,          // with the page's tile as the room: at most this share of the outline may leave it
  bayDot: true,         // the first dot goes to the comma's own bay (the yin-yang's), not to the largest patch
  bayMin: 0.2,          // ... when one of at least this many head radii fits there
  bayRl: 2.2,           // ... and only where the belly bends round a real bay (its circle at most this many head radii)
  centreW: 1.5,         // while growing: the bare patch at a rotation centre costs this much (per tile size) ...
  centreGoal: 0.40,     // ... above this diameter
  dotCost: 0.06,        // a grown comma's worth drops this much per dot: a dot has to earn its place
  curlScore: 0.3,       // ... and rises this much for a fully curled comma (comma-like comes first)
};

// ---------------------------------------------------------------------------------------------------------------
// The unit comma: head = the unit circle at the origin, tip T = (lam, 0), the back above the axis, the head's lobe below.
//   back arc:  a circle through T that holds the head and touches it (at Pb); it leaves T at the angle ab from the axis
//   belly arc: a circle through T that touches the head from outside (at Pl); it leaves T at the angle al = ab - tau
// ab = al = 90 degrees, lam = 3: the classic half of a yin-yang. tau > 0 opens the tip; a smaller ab flattens the back.
// Any ab > asin(1 / lam) and any al in (-asin(1 / lam), ab) give a simple closed outline, smooth except at the tip.
// ---------------------------------------------------------------------------------------------------------------
export function unitComma(lam, ab, tau) {
  const L = lam, al = ab - tau;
  const sb = L * Math.sin(ab) - 1, sl = L * Math.sin(al) + 1;
  if (!(sb > 1e-4) || !(sl > 1e-4) || !(tau >= 0)) return null;
  const Rb = (L * L - 1) / (2 * sb), Rl = (L * L - 1) / (2 * sl);
  const Cb = [L - Rb * Math.sin(ab), -Rb * Math.cos(ab)];
  const Cl = [L - Rl * Math.sin(al), -Rl * Math.cos(al)];
  const kb = Math.hypot(Cb[0], Cb[1]), kl = Math.hypot(Cl[0], Cl[1]);       // Rb - 1, Rl + 1
  const Pb = kb > 1e-9 ? [-Cb[0] / kb, -Cb[1] / kb] : [-1, 0];
  const Pl = [Cl[0] / kl, Cl[1] / kl];
  const a0 = Math.atan2(-Cb[1], L - Cb[0]), da = mod(Math.atan2(Pb[1] - Cb[1], Pb[0] - Cb[0]) - a0, TAU);
  const h0 = Math.atan2(Pb[1], Pb[0]), dh = mod(Math.atan2(Pl[1], Pl[0]) - h0, TAU);
  const l0 = Math.atan2(-Cl[1], L - Cl[0]), dl = mod(Math.atan2(Pl[1] - Cl[1], Pl[0] - Cl[0]) - l0, TAU);
  return { lam, ab, tau, al, L, Rb, Rl, Cb, Cl, Pb, Pl, a0, da, h0, dh, l0, dl, per: Rb * da + dh + Rl * dl, back: backHeight(lam, ab) };
}

/** The outline of a unit comma, counter-clockwise from the tip: [[x, y], ...], segments of about ds. */
export function sampleComma(u, ds) {
  const pts = [];
  const arc = (C, R, a0, da, dir) => {
    const n = Math.max(2, Math.ceil((R * da) / ds - 1e-9));
    for (let i = 0; i < n; i++) { const a = a0 + dir * da * (i / n); pts.push([C[0] + R * Math.cos(a), C[1] + R * Math.sin(a)]); }
  };
  arc(u.Cb, u.Rb, u.a0, u.da, 1);                    // the back: T .. Pb
  arc([0, 0], 1, u.h0, u.dh, 1);                     // the head, round its far side: Pb .. Pl
  arc(u.Cl, u.Rl, u.l0 + u.dl, u.dl, -1);            // the belly: Pl .. T
  return pts;
}

/**
 * How high the comma rises above the head -> tip axis, in head radii: the top of the back's circle when the back arc
 * passes over it, else the higher of the point where the back meets the head and the head's own top (1).
 */
function backHeight(lam, ab) {
  const Rb = (lam * lam - 1) / (2 * (lam * Math.sin(ab) - 1)), cx = lam - Rb * Math.sin(ab);
  const pbx = -cx / (Rb - 1), pby = (Rb * Math.cos(ab)) / (Rb - 1);            // Pb = -Cb / (Rb - 1)
  return pbx <= cx ? Rb * (1 - Math.cos(ab)) : Math.max(1, pby);
}

/** How curled a comma is, 0 .. 1: 0 when its back lies flat on its head, 1 when it rises KNOBS.backMax head radii above the axis. */
function curlOf(u) { return Math.max(0, Math.min(1, (u.back - 1) / (KNOBS.backMax - 1))); }
function areaOf(pts) { let s = 0; for (let i = 0, n = pts.length; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; s += p[0] * q[1] - p[1] * q[0]; } return s / 2; }
function circle(cx, cy, r, step, a0) {
  const n = Math.max(20, Math.ceil((TAU * r) / step - 1e-9)), pts = [];
  for (let i = 0; i < n; i++) pts.push([cx + r * Math.cos(a0 + (TAU * i) / n), cy + r * Math.sin(a0 + (TAU * i) / n)]);
  return pts;
}

// ---------------------------------------------------------------------------------------------------------------
// The shapes the search tries, with their support functions on NDIR directions
// ---------------------------------------------------------------------------------------------------------------
const NDIR = 144;
const LAMS = [2.3, 2.6, 3, 3.5, 4.2, 5, 6, 7.5, 9.5];
const ABS = [90, 80, 70, 60, 50, 42, 35, 29, 24, 20, 16, 13];
/** May the search use this shape? cls: undefined (any), 'classic' (the back a half circle: ab = 90 degrees), 'curled', 'flat'. */
function allowed(lam, ab, cls) {
  const lim = Math.asin(1 / lam), tau = KNOBS.tip * DEG;
  if (lam < LAMS[0] || lam > 11 || ab > 90 * DEG + 1e-9 || ab < lim + 6 * DEG || ab - tau < -lim + 4 * DEG) return false;
  const hb = backHeight(lam, ab);
  if (hb > KNOBS.backMax + 1e-9) return false;
  return cls === undefined || (cls === 'classic' ? ab > 90 * DEG - 1e-9 : (hb >= KNOBS.curled) === (cls === 'curled'));
}
let SHAPES = null;
function shapes() {
  if (SHAPES) return SHAPES;
  SHAPES = [];
  for (const lam of LAMS) for (const abd of ABS) {
    const ab = abd * DEG;
    if (!allowed(lam, ab)) continue;
    const u = unitComma(lam, ab, KNOBS.tip * DEG);
    if (!u) continue;
    const pts = sampleComma(u, 0.14), H = new Float64Array(NDIR);
    for (let k = 0; k < NDIR; k++) {
      const c = Math.cos((TAU * k) / NDIR), s = Math.sin((TAU * k) / NDIR);
      let h = -Infinity;
      for (const p of pts) { const v = c * p[0] + s * p[1]; if (v > h) h = v; }
      H[k] = h;
    }
    SHAPES.push({ u, H, area: areaOf(pts) });
  }
  return SHAPES;
}

// ---------------------------------------------------------------------------------------------------------------
// The room
// ---------------------------------------------------------------------------------------------------------------
/** The distances from p to the three nearest other points of its orbit, ascending. */
function nearest3(group, px, py, out) {
  const { e1, e2 } = group, st = [0, 0], tiny = 1e-9 * Math.sqrt(group.domainArea);
  let d1 = Infinity, d2 = Infinity, d3 = Infinity;
  for (const r of group.reps) {
    const vx = r.a * px + r.b * py + r.tx - px, vy = r.c * px + r.d * py + r.ty - py;
    const ident = Math.abs(r.a - 1) < 1e-9 && Math.abs(r.b) < 1e-9 && Math.abs(r.c) < 1e-9 && Math.abs(r.d - 1) < 1e-9;
    latticeCoords(group, vx, vy, st);
    const m0 = Math.round(st[0]), n0 = Math.round(st[1]);
    for (let m = m0 - 2; m <= m0 + 2; m++) for (let n = n0 - 2; n <= n0 + 2; n++) {
      const d = Math.hypot(vx - m * e1[0] - n * e2[0], vy - m * e1[1] - n * e2[1]);
      if (ident && d < tiny) continue;
      if (d < d1) { d3 = d2; d2 = d1; d1 = d; } else if (d < d2) { d3 = d2; d2 = d; } else if (d < d3) d3 = d;
    }
  }
  out[0] = d1; out[1] = d2; out[2] = d3;
  return out;
}

/**
 * A seed whose Dirichlet tile is as round as the group allows: the point farthest from the rest of its orbit, and among
 * such points (a whole line of them in a strip) one whose second and third neighbours are far too.
 */
function roundSeed(group) {
  const { e1, e2, center } = group, n = 26, d = [0, 0, 0];
  const worth = (x, y) => { nearest3(group, x, y, d); return d[0] + 0.3 * d[1] + 0.1 * d[2]; };
  let best = -1, bx = center[0], by = center[1];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const s = (i + 0.37) / n - 0.5, t = (j + 0.61) / n - 0.5;
    const x = center[0] + s * e1[0] + t * e2[0], y = center[1] + s * e1[1] + t * e2[1];
    const r = worth(x, y);
    if (r > best * (1 + 1e-9)) { best = r; bx = x; by = y; }
  }
  let h = 0.5 / n;
  for (let it = 0; it < 22; it++, h /= 2) {
    for (let again = true, guard = 0; again && guard < 8; guard++) {
      again = false;
      for (const [ds, dt] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const x = bx + h * (ds * e1[0] + dt * e2[0]), y = by + h * (ds * e1[1] + dt * e2[1]);
        const r = worth(x, y);
        if (r > best * (1 + 1e-12)) { best = r; bx = x; by = y; again = true; }
      }
    }
  }
  return [bx, by];
}

function dirichletTile(group, seed) {
  const [sx, sy] = seed;
  const L = Math.hypot(group.e1[0], group.e1[1]) + Math.hypot(group.e2[0], group.e2[1]), B = 4 * L;
  let poly = [[sx - B, sy - B], [sx + B, sy - B], [sx + B, sy + B], [sx - B, sy + B]];
  const nb = [];
  for (const g of elementsNear(group, sx, sy, 2.5 * L, sx, sy)) {
    const qx = g.a * sx + g.b * sy + g.tx, qy = g.c * sx + g.d * sy + g.ty;
    const dx = qx - sx, dy = qy - sy, l = Math.hypot(dx, dy);
    if (l < 1e-9 * L) continue;
    nb.push([dx / l, dy / l, (dx * (sx + qx) + dy * (sy + qy)) / (2 * l), l]);
  }
  nb.sort((a, b) => a[3] - b[3]);
  for (const k of nb) {
    let far = 0;
    for (const p of poly) far = Math.max(far, Math.hypot(p[0] - sx, p[1] - sy));
    if (k[3] > 2 * far) break;
    poly = clipHalfPlane(poly, k[0], k[1], k[2]);
  }
  return poly;
}

function distToSeg(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((x - a[0]) * dx + (y - a[1]) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}

/**
 * The room of the comma: the page's default tile when the group has presets, else the roundest Dirichlet tile.
 * { poly, edges [{nx, ny, d, ang, len}] (n.x <= d inside), verts [{x, y, ux, uy, angle}] (u: the inward bisector),
 *   cx, cy, R, near: the inverses of the elements whose copy of the room comes near it,
 *   ref: the direction of e1 (every scan below is laid out relative to it, so a turned group gets the turned pattern) }
 */
export function roomOf(group) {
  const size = Math.sqrt(group.domainArea);
  let poly;
  if (!KNOBS.roundRoom && group.presets && group.presets.length) {
    const p0 = group.presets[0];
    poly = buildDomain(group, { seed: p0.seed, metric: p0.metric }).poly.map((p) => [p[0], p[1]]);
  } else poly = dirichletTile(group, roundSeed(group));
  if (polyArea(poly) < 0) poly.reverse();
  // one vertex per corner: no repeated point, none on a straight side (a tile with a 2-fold centre in the middle of a side)
  poly = poly.filter((p, i) => { const q = poly[(i + 1) % poly.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-9 * size; });
  const out = [];
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[(i + n - 1) % n], b = poly[i], c = poly[(i + 1) % n];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cr) > 1e-7 * group.domainArea) out.push(b);
  }
  const k = out.length, ref = Math.atan2(group.e1[1], group.e1[0]);
  let cx = 0, cy = 0, R = 0;
  for (const p of out) { cx += p[0] / k; cy += p[1] / k; }
  for (const p of out) R = Math.max(R, Math.hypot(p[0] - cx, p[1] - cy));
  // the corners are counted from the one first met going round from the direction of e1: the same corner wherever the group lies
  let first = 0, least = Infinity;
  out.forEach((p, i) => { const a = mod(Math.atan2(p[1] - cy, p[0] - cx) - ref + 1e-7, TAU); if (a < least) { least = a; first = i; } });
  out.push(...out.splice(0, first));
  const edges = out.map((p, i) => {
    const q = out[(i + 1) % k], l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const nx = (q[1] - p[1]) / l, ny = -(q[0] - p[0]) / l;
    return { nx, ny, d: nx * p[0] + ny * p[1], ang: Math.atan2(ny, nx), len: l };
  });
  const verts = out.map((p, i) => {
    const a = out[(i + k - 1) % k], b = out[(i + 1) % k];
    const ax = a[0] - p[0], ay = a[1] - p[1], bx = b[0] - p[0], by = b[1] - p[1], la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    let ux = ax / la + bx / lb, uy = ay / la + by / lb; const lu = Math.hypot(ux, uy);
    ux /= lu; uy /= lu;
    return { x: p[0], y: p[1], ux, uy, angle: Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)))) };
  });
  // the neighbours: elements g (not the identity) whose copy g(room) comes within 0.7 tile sizes of the room
  const near = [];
  for (const g of elementsNear(group, cx, cy, 2 * R + 0.7 * size, cx, cy)) {
    if (Math.abs(g.a - 1) < 1e-9 && Math.abs(g.b) < 1e-9 && Math.abs(g.d - 1) < 1e-9 && Math.hypot(g.tx, g.ty) < 1e-9 * size) continue;
    const img = out.map((p) => [g.a * p[0] + g.b * p[1] + g.tx, g.c * p[0] + g.d * p[1] + g.ty]);
    let dmin = Infinity;
    for (let i = 0; i < k && dmin > 0; i++) for (let j = 0; j < k; j++) {
      dmin = Math.min(dmin, distToSeg(out[i][0], out[i][1], img[j], img[(j + 1) % k]), distToSeg(img[i][0], img[i][1], out[j], out[(j + 1) % k]));
    }
    if (dmin < 0.7 * size) near.push(inverse(g));
  }
  return { poly: out, edges, verts, cx, cy, R, near, ref };
}

/** The points the bare patches are looked for at: the room's corners, its sides, a grid inside. [{x, y, e}], e = distance to the rim. */
function roomSamples(room, size) {
  const S = [], k = room.poly.length, c = Math.cos(room.ref), s = Math.sin(room.ref);
  const rim = (x, y) => { let r = Infinity; for (const e of room.edges) { const d = e.d - (e.nx * x + e.ny * y); if (d < r) r = d; } return r; };
  for (let i = 0; i < k; i++) {
    const a = room.poly[i], b = room.poly[(i + 1) % k], n = Math.max(2, Math.ceil(room.edges[i].len / (0.05 * size)));
    for (let j = 0; j < n; j++) S.push({ x: a[0] + ((b[0] - a[0]) * j) / n, y: a[1] + ((b[1] - a[1]) * j) / n, e: 0 });
  }
  // the grid is laid along e1 and across it, from the room's centre
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (const p of room.poly) {
    const u = c * (p[0] - room.cx) + s * (p[1] - room.cy), v = -s * (p[0] - room.cx) + c * (p[1] - room.cy);
    u0 = Math.min(u0, u); v0 = Math.min(v0, v); u1 = Math.max(u1, u); v1 = Math.max(v1, v);
  }
  const h = 0.055 * size;
  for (let i = Math.floor(u0 / h) - 1; i * h < u1; i++) for (let j = Math.floor(v0 / h) - 1; j * h < v1; j++) {
    const u = (i + 0.31) * h, v = (j + 0.57) * h, x = room.cx + c * u - s * v, y = room.cy + s * u + c * v, e = rim(x, y);
    if (e > 0) S.push({ x, y, e });
  }
  const ring = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]].map(([a, b]) => [c * a - s * b, s * a + c * b]);
  return { S, rim, h, ring };
}

// ---------------------------------------------------------------------------------------------------------------
// The largest copy of a shape in the room: a linear programme in (x, y, s), solved at its vertices.
// rows: k rows [nx, ny, h, rhs] in one Float64Array, meaning  nx x + ny y + h s <= rhs
// ---------------------------------------------------------------------------------------------------------------
function maxScale(rows, k, out) {
  let best = 0, sx = 0, sy = 0, cnt = 0;
  for (let i = 0; i < k; i++) {
    const a1 = rows[4 * i], b1 = rows[4 * i + 1], c1 = rows[4 * i + 2], d1 = rows[4 * i + 3];
    for (let j = i + 1; j < k; j++) {
      const a2 = rows[4 * j], b2 = rows[4 * j + 1], c2 = rows[4 * j + 2], d2 = rows[4 * j + 3];
      for (let l = j + 1; l < k; l++) {
        const a3 = rows[4 * l], b3 = rows[4 * l + 1], c3 = rows[4 * l + 2], d3 = rows[4 * l + 3];
        const m1 = b2 * c3 - b3 * c2, m2 = a2 * c3 - a3 * c2, m3 = a2 * b3 - a3 * b2;
        const det = a1 * m1 - b1 * m2 + c1 * m3;
        if (det < 1e-12 && det > -1e-12) continue;
        const s = (a1 * (b2 * d3 - b3 * d2) - b1 * (a2 * d3 - a3 * d2) + d1 * m3) / det;
        if (!(s > 0) || s < best - 1e-9) continue;
        const x = (d1 * m1 - b1 * (d2 * c3 - d3 * c2) + c1 * (d2 * b3 - d3 * b2)) / det;
        const y = (a1 * (d2 * c3 - d3 * c2) - d1 * m2 + c1 * (a2 * d3 - a3 * d2)) / det;
        let ok = true;
        for (let q = 0; q < k; q++) if (rows[4 * q] * x + rows[4 * q + 1] * y + s * rows[4 * q + 2] > rows[4 * q + 3] + 1e-9) { ok = false; break; }
        if (!ok) continue;
        if (s > best + 1e-9) { best = s; sx = x; sy = y; cnt = 1; } else { sx += x; sy += y; cnt++; }   // a whole side of best places: its middle
      }
    }
  }
  if (!cnt) return false;
  out.s = best; out.x = sx / cnt; out.y = sy / cnt;
  return true;
}

/** The rows of a fit: the room's sides (support numbers h[j]) and, with a pin, "the tip lies within pin.depth of the corner". */
function fitRows(room, margin, h, lam, theta, pin, rows) {
  const k = room.edges.length;
  for (let j = 0; j < k; j++) { const e = room.edges[j]; rows[4 * j] = e.nx; rows[4 * j + 1] = e.ny; rows[4 * j + 2] = h[j]; rows[4 * j + 3] = e.d - margin; }
  if (!pin) return k;
  rows[4 * k] = pin.ux; rows[4 * k + 1] = pin.uy; rows[4 * k + 2] = lam * (pin.ux * Math.cos(theta) + pin.uy * Math.sin(theta)); rows[4 * k + 3] = pin.ux * pin.x + pin.uy * pin.y + pin.depth;
  return k + 1;
}

function fitExact(room, margin, lam, ab, theta, flip, pin) {
  const u = unitComma(lam, ab, KNOBS.tip * DEG);
  if (!u) return null;
  const pts = sampleComma(u, 0.1), k = room.edges.length, h = new Float64Array(k), rows = new Float64Array(4 * (k + 1)), f = { s: 0, x: 0, y: 0 };
  for (let j = 0; j < k; j++) {                       // exact support numbers: the outline mirrored if flip < 0, turned by theta
    const a = room.edges[j].ang - theta, c = Math.cos(a), s = flip * Math.sin(a);
    let m = -Infinity;
    for (let i = 0; i < pts.length; i++) { const v = c * pts[i][0] + s * pts[i][1]; if (v > m) m = v; }
    h[j] = m;
  }
  if (!maxScale(rows, fitRows(room, margin, h, lam, theta, pin, rows), f)) return null;
  return { u, lam, ab, theta, flip, pin, s: f.s, x: f.x, y: f.y, area: f.s * f.s * areaOf(pts) };
}

/**
 * The largest comma of the room among the shapes of one class ('classic', 'curled', 'flat'); with a pin, the largest
 * whose tip lies in that corner. A scan over shapes and turns, then a pattern search.
 */
function searchRoom(room, margin, pin, flip, cls) {
  const k = room.edges.length, h = new Float64Array(k), rows = new Float64Array(4 * (k + 1)), f = { s: 0, x: 0, y: 0 };
  const idx = room.edges.map((e) => mod(Math.round(((e.ang - room.ref) / TAU) * NDIR), NDIR));
  const t0 = pin ? Math.round((((Math.atan2(-pin.uy, -pin.ux) - room.ref) / TAU) * NDIR) / 2) * 2 : 0, span = pin ? 24 : NDIR / 2;
  let best = null;
  for (const sh of shapes()) {
    if (!allowed(sh.u.lam, sh.u.ab, cls)) continue;
    for (let dt = -span; dt < span + (pin ? 2 : 0); dt += 2) {
      const t = mod(t0 + dt, NDIR), theta = room.ref + (TAU * t) / NDIR;
      for (let j = 0; j < k; j++) { const q = flip * (idx[j] - t); h[j] = sh.H[q < 0 ? q + NDIR : q >= NDIR ? q - NDIR : q]; }
      if (!maxScale(rows, fitRows(room, margin, h, sh.u.lam, theta, pin, rows), f)) continue;
      const v = f.s * f.s * sh.area;
      if (!best || v > best.v * (1 + 1e-9)) best = { v, sh, theta };   // of equal ones (a room with a symmetry) the first met
    }
  }
  if (!best) return null;
  let cur = fitExact(room, margin, best.sh.u.lam, best.sh.u.ab, best.theta, flip, pin);
  if (!cur) return null;
  const steps = [2.5 * DEG, 0.08, 6 * DEG];
  for (let round = 0; round < 5; round++) {
    let moved = false;
    for (let v = 0; v < 3; v++) for (const sg of [1, -1]) {
      let { lam, ab, theta } = cur;
      if (v === 0) theta += sg * steps[0]; else if (v === 1) lam *= 1 + sg * steps[1]; else if (cls === 'classic') continue; else ab = Math.min(90 * DEG, ab + sg * steps[2]);
      if (!allowed(lam, ab, cls)) continue;
      const f = fitExact(room, margin, lam, ab, theta, flip, pin);
      if (f && f.area > cur.area * (1 + 1e-9)) { cur = f; moved = true; }
    }
    if (!moved) for (let v = 0; v < 3; v++) steps[v] /= 2;
  }
  return cur;
}

// ---------------------------------------------------------------------------------------------------------------
// A placed comma with its dots, and the bare patch it leaves on the plane
// ---------------------------------------------------------------------------------------------------------------
/** The outline of a fitted comma in the world: [[x, y], ...], segments of about ds head radii. */
function outline(fit, ds) {
  const { s, flip } = fit, ct = Math.cos(fit.theta), st = Math.sin(fit.theta);
  return sampleComma(fit.u, ds).map((p) => [fit.x + s * (ct * p[0] - st * flip * p[1]), fit.y + s * (st * p[0] + ct * flip * p[1])]);
}
function placed(fit) {
  const pts = outline(fit, fit.u.per / 48), n = pts.length, X = new Float64Array(n + 1), Y = new Float64Array(n + 1);
  let bx = 0, by = 0, br = 0;
  for (let i = 0; i < n; i++) { X[i] = pts[i][0]; Y[i] = pts[i][1]; bx += X[i] / n; by += Y[i] / n; }
  X[n] = X[0]; Y[n] = Y[0];
  for (let i = 0; i < n; i++) br = Math.max(br, Math.hypot(X[i] - bx, Y[i] - by));
  return { fit, X, Y, n, bx, by, br };
}
/** min(cut, the distance from (px, py) to the marks: the comma's outline, the dots). The point is outside the comma. */
function distMarks(M, dots, px, py, cut) {
  let d = cut;
  for (const o of dots) { const q = Math.hypot(px - o.x, py - o.y) - o.r; if (q < d) d = q; }
  if (d <= 0) return 0;
  if (Math.hypot(px - M.bx, py - M.by) - M.br >= d) return d;
  let d2 = d * d;
  const { X, Y, n } = M;
  for (let i = 0; i < n; i++) {
    const ax = X[i], ay = Y[i], ex = X[i + 1] - ax, ey = Y[i + 1] - ay, wx = px - ax, wy = py - ay;
    let t = (wx * ex + wy * ey) / (ex * ex + ey * ey);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = wx - t * ex, qy = wy - t * ey, q2 = qx * qx + qy * qy;
    if (q2 < d2) d2 = q2;
  }
  return Math.sqrt(d2);
}
function inComma(M, px, py) {
  if (Math.hypot(px - M.bx, py - M.by) > M.br) return false;
  let inn = false;
  const { X, Y, n } = M;
  for (let i = 0; i < n; i++) if ((Y[i] > py) !== (Y[i + 1] > py) && px < X[i] + ((py - Y[i]) * (X[i + 1] - X[i])) / (Y[i + 1] - Y[i])) inn = !inn;
  return inn;
}
/**
 * How far the point p of the room is from the nearest dark point of the plane (rim: its distance to the room's rim).
 * A neighbour's marks stay ctx.margin inside the neighbour's room, so they count only for a point near the rim.
 */
function bareAt(ctx, M, dots, px, py, rim, floor) {
  if (inComma(M, px, py)) return 0;
  let d = distMarks(M, dots, px, py, Infinity);
  if (d <= floor || d <= rim + ctx.margin) return d;
  for (const g of ctx.room.near) {
    d = distMarks(M, dots, g.a * px + g.b * py + g.tx, g.c * px + g.d * py + g.ty, d);
    if (d <= floor) return d;
  }
  return d;
}
/** The largest bare disc of the plane: { r, x, y } (centre in the room). The three best sample points are each refined. */
function bareOf(ctx, M, dots) {
  const top = [], h = ctx.samples.h;
  let cut = 0;                                        // below this a sample cannot be among the best three
  for (const p of ctx.samples.S) {
    const d = bareAt(ctx, M, dots, p.x, p.y, p.e, cut);
    if (d <= cut) continue;
    const near = top.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < 2.5 * h);
    if (near >= 0) { if (d > top[near].r) top[near] = { r: d, x: p.x, y: p.y }; } else top.push({ r: d, x: p.x, y: p.y });
    top.sort((a, b) => b.r - a.r);
    if (top.length > 3) top.length = 3;
    if (top.length === 3) cut = 0.85 * top[2].r;
  }
  let best = { r: 0, x: ctx.room.cx, y: ctx.room.cy };
  for (let cur of top) {
    for (let step = h / 2, it = 0; it < 9; it++, step /= 2) {
      for (const [dx, dy] of ctx.samples.ring) {
        const x = cur.x + step * dx, y = cur.y + step * dy, e = ctx.samples.rim(x, y);
        if (e < 0) continue;
        const d = bareAt(ctx, M, dots, x, y, e, cur.r);
        if (d > cur.r) cur = { r: d, x, y };
      }
    }
    if (cur.r > best.r) best = cur;
  }
  return best;
}
/** The radius of the largest dot centred at (x, y): its distance to the room's rim, the comma and the dots, less the channel. */
function clearAt(ctx, M, dots, x, y) {
  if (inComma(M, x, y)) return -Infinity;
  return Math.min(ctx.samples.rim(x, y) - ctx.margin, distMarks(M, dots, x, y, Infinity) - KNOBS.dotGap * ctx.size);
}
/** Uphill from (x, y) to a place where a dot is largest: { x, y, r }. */
function climb(ctx, M, dots, x, y, h) {
  let cur = { x, y, r: clearAt(ctx, M, dots, x, y) };
  for (let it = 0; it < 10; it++, h /= 2) {
    for (let again = true, guard = 0; again && guard < 12; guard++) {
      again = false;
      for (const [dx, dy] of ctx.samples.ring) {
        const qx = cur.x + h * dx, qy = cur.y + h * dy, r = clearAt(ctx, M, dots, qx, qy);
        if (r > cur.r) { cur = { x: qx, y: qy, r }; again = true; }
      }
    }
  }
  return cur;
}
/** The dot for a bare patch { x, y, r }: the largest that fits inside the patch's disc, or null. */
function dotAt(ctx, M, dots, patch) {
  const K = KNOBS, dx = ctx.room.cx - patch.x, dy = ctx.room.cy - patch.y, l = Math.hypot(dx, dy) || 1;
  let best = null;
  for (const f of [0, 0.5, 1]) {                    // from the patch's centre (it may lie on the rim) and from further in
    const c = climb(ctx, M, dots, patch.x + (f * patch.r * dx) / l, patch.y + (f * patch.r * dy) / l, patch.r / 2);
    if (Math.hypot(c.x - patch.x, c.y - patch.y) <= patch.r && (!best || c.r > best.r)) best = c;
  }
  if (!best || best.r < K.dotMin * ctx.size) return null;
  return { x: best.x, y: best.y, r: Math.min(best.r, K.dotMax * M.fit.s, K.dotCap * ctx.size) };
}
/** The largest dot that fits anywhere in the room, or null. */
function dotLargest(ctx, M, dots) {
  const K = KNOBS, list = [];
  for (const p of ctx.samples.S) { if (p.e <= ctx.margin) continue; const r = clearAt(ctx, M, dots, p.x, p.y); if (r > 0) list.push({ x: p.x, y: p.y, r }); }
  list.sort((a, b) => b.r - a.r);
  let best = null;
  const tried = [];
  for (const c of list) {
    if (tried.length >= 3) break;
    if (tried.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < 0.2 * ctx.size)) continue;
    tried.push(c);
    const q = climb(ctx, M, dots, c.x, c.y, ctx.samples.h / 2);
    if (!best || q.r > best.r) best = q;
  }
  if (!best || best.r < K.dotMin * ctx.size) return null;
  return { x: best.x, y: best.y, r: Math.min(best.r, K.dotMax * M.fit.s, K.dotCap * ctx.size) };
}

/** What a candidate is worth: its dark share and its curl, marked down for a bare patch, a print too light or too dark, extra dots. */
function worth(D, B, curl, dots) {
  const K = KNOBS;
  return 0.5 * D + 0.1 * curl - 4 * Math.max(0, B - K.bareGoal) - 2 * Math.max(0, K.darkMin - D) - 4 * Math.max(0, D - K.darkMax) - 0.03 * Math.max(0, dots - 1);
}

/** The comma with its dots and its eye, and what it is worth; null when it cannot beat `floor`. */
function evaluate(ctx, fit, floor) {
  const K = KNOBS, A = ctx.group.domainArea, curl = curlOf(fit.u);
  const eye0 = K.eye * fit.s, cap = Math.min(K.dotMax * fit.s, K.dotCap * ctx.size);
  const most = (fit.area - Math.PI * eye0 * eye0 + K.dots * Math.PI * cap * cap) / A;
  if (worth(Math.min(most, K.darkMax), 0, curl, 1) <= floor) return null;
  const M = placed(fit);
  let dots = [], bare = bareOf(ctx, M, dots);
  // a dot goes where the largest bare patch is, as long as one fits there (the first: else the largest that fits anywhere)
  for (let n = 0; n < K.dots; n++) {
    if (dots.length && bare.r * 2 <= K.bareGoal * ctx.size) break;
    const pick = dotAt(ctx, M, dots, bare) || (dots.length ? null : dotLargest(ctx, M, dots));
    if (!pick) break;
    dots = dots.concat([pick]); bare = bareOf(ctx, M, dots);
  }
  // ... and a dot that does not make the largest patch smaller goes again (the largest dot stays: the yin-yang's own)
  for (let again = true; again && dots.length > 1;) {
    again = false;
    const big = dots.reduce((a, b) => (b.r > a.r ? b : a));
    for (const o of dots.slice().sort((a, b) => a.r - b.r)) {
      if (o === big) continue;
      const rest = dots.filter((q) => q !== o), b = bareOf(ctx, M, rest);
      if (b.r <= bare.r + 0.01 * ctx.size) { dots = rest; bare = b; again = true; break; }
    }
  }
  // the eye: larger where the print would be too dark
  let dark = fit.area;
  for (const o of dots) dark += Math.PI * o.r * o.r;
  const eye = Math.min(K.eyeMax * fit.s, Math.max(eye0, Math.sqrt(Math.max(0, dark - K.darkMax * A) / Math.PI)));
  const B = (2 * bare.r) / ctx.size, D = (dark - Math.PI * eye * eye) / A;
  return { fit, dots, eye, bare, B, D, score: worth(D, B, curl, dots.length) };
}

// ---------------------------------------------------------------------------------------------------------------
// Nesting (the critique of 13 Nov, finding 1): the comma grows against its COPIES, not against the walls of its room.
// Where a neighbour leaves space (its bay, a corner it does not use) the comma crosses the side of its tile; it stops
// one channel short of every copy. A mirror is a wall all the same (the comma's mirror image is a copy).
// ---------------------------------------------------------------------------------------------------------------
const inSpan = (a, a0, sw) => mod(a - a0, TAU) <= sw + 1e-12;
function arcsOf(u) {
  if (!u.arcs) u.arcs = Float64Array.from([u.Cb[0], u.Cb[1], u.Rb, u.a0, u.da, 0, 0, 1, u.h0, u.dh, u.Cl[0], u.Cl[1], u.Rl, u.l0, u.dl]);
  return u.arcs;
}
/** The signed distance from (qx, qy) to the unit comma u, in head radii (negative inside): three arcs, exact. */
export function unitSD(u, qx, qy) {
  const A = arcsOf(u);
  let d = Math.min(Math.hypot(qx - u.L, qy), Math.hypot(qx - u.Pb[0], qy - u.Pb[1]), Math.hypot(qx - u.Pl[0], qy - u.Pl[1]));
  let cross = 0;
  for (let k = 0; k < 15; k += 5) {
    const cx = A[k], cy = A[k + 1], R = A[k + 2], a0 = A[k + 3], sw = A[k + 4], dx = qx - cx, dy = qy - cy;
    if (inSpan(Math.atan2(dy, dx), a0, sw)) { const e = Math.abs(Math.hypot(dx, dy) - R); if (e < d) d = e; }
    const h = R * R - dy * dy;                         // the ray from q toward +x crosses the arc where it meets the circle
    if (h > 0) {
      const w = Math.sqrt(h);
      if (cx + w > qx && inSpan(Math.atan2(dy, w), a0, sw)) cross++;
      if (cx - w > qx && inSpan(Math.atan2(dy, -w), a0, sw)) cross++;
    }
  }
  return cross & 1 ? -d : d;
}
function unitData(u) {                                 // a coarse outline (for the channel) and the area, kept on u
  if (!u.coarse) {
    const pts = sampleComma(u, u.per / 44);
    u.coarse = Float64Array.from(pts.flatMap((p) => p));
    u.area = areaOf(sampleComma(u, u.per / 160));
  }
  return u;
}
/** A comma placed in the world: head centre (x, y), turn th, head radius s, flip +-1. */
function poseOf(u, x, y, th, s, flip) { unitData(u); return { u, x, y, th, s, flip, c: Math.cos(th), sn: Math.sin(th) }; }
function sdPose(P, px, py) {
  const dx = px - P.x, dy = py - P.y;
  return P.s * unitSD(P.u, (P.c * dx + P.sn * dy) / P.s, (P.flip * (-P.sn * dx + P.c * dy)) / P.s);
}
function worldOutline(P) {                             // the coarse outline in the world, and its bounding circle
  const q = P.u.coarse, n = q.length / 2, W = new Float64Array(2 * n);
  let bx = 0, by = 0, br = 0;
  for (let i = 0; i < n; i++) {
    const a = q[2 * i] * P.s, b = q[2 * i + 1] * P.s * P.flip;
    W[2 * i] = P.x + P.c * a - P.sn * b; W[2 * i + 1] = P.y + P.sn * a + P.c * b;
    bx += W[2 * i] / n; by += W[2 * i + 1] / n;
  }
  for (let i = 0; i < n; i++) br = Math.max(br, Math.hypot(W[2 * i] - bx, W[2 * i + 1] - by));
  return { W, bx, by, br };
}
const isIdent = (g, tiny) => Math.abs(g.a - 1) < 1e-9 && Math.abs(g.b) < 1e-9 && Math.abs(g.c) < 1e-9 && Math.abs(g.d - 1) < 1e-9 && Math.abs(g.tx) < tiny && Math.abs(g.ty) < tiny;
/**
 * The elements that may carry the comma near itself, for a search that stays within `shift` of (x, y) and below the
 * radius `rmax` (a superset; channelOf sorts out the rest). Rebuilt when the comma leaves that ball.
 */
function nearOf(ctx, bx, by, br, reach) {
  const N = ctx.near;
  if (N && Math.hypot(bx - N.x, by - N.y) <= N.shift && br <= N.rmax && reach <= N.reach) return N.els;
  const shift = 0.25 * ctx.size, rmax = 1.4 * br, R = 2 * rmax + reach + 2 * shift;
  const els = elementsNear(ctx.group, bx, by, R, bx, by).filter((g) => !isIdent(g, ctx.tiny));
  ctx.near = { x: bx, y: by, shift, rmax, reach: Math.max(reach, 3 * ctx.chan), els };
  return els;
}
/** The narrowest channel between the comma and any other copy of it (world units), or `reach` when all are farther. */
function channelOf(ctx, P, reach) {
  const { W, bx, by, br } = worldOutline(P);
  let best = reach;
  for (const g of nearOf(ctx, bx, by, br, reach)) {
    const gx = g.a * bx + g.b * by + g.tx, gy = g.c * bx + g.d * by + g.ty;
    if (Math.hypot(gx - bx, gy - by) - 2 * br >= best) continue;
    for (let i = 0; i < W.length; i += 2) {
      const px = g.a * W[i] + g.b * W[i + 1] + g.tx, py = g.c * W[i] + g.d * W[i + 1] + g.ty;
      if (Math.hypot(px - bx, py - by) - br >= best) continue;
      const d = sdPose(P, px, py);
      if (d < best) { best = d; if (best < 0) return best; }
    }
  }
  return best;
}
/** The largest head radius (the comma scaled about its head centre) that keeps the channel; s0 a guess. */
function maxScaleAt(ctx, u, x, y, th, flip, s0) {
  const c = ctx.chan, ok = (s) => { const P = poseOf(u, x, y, th, s, flip); return channelOf(ctx, P, c) >= c - 1e-9 * ctx.size && outsideOK(ctx, P); };
  let lo, hi;
  if (ok(s0)) { lo = s0; hi = s0 * 1.05; for (let k = 0; ok(hi) && k < 30; k++) { lo = hi; hi *= 1.05; } }
  else { hi = s0; lo = s0 / 1.05; for (let k = 0; !ok(lo); k++) { hi = lo; lo /= 1.05; if (k > 30) return 0; } }
  for (let it = 0; it < 4; it++) { const m = Math.sqrt(lo * hi); if (ok(m)) lo = m; else hi = m; }
  return lo;
}
/**
 * With the page's tile as the room, at most KNOBS.outMax of the comma's outline may leave it (so that tile still holds
 * the comma all but a tail's end, criterion d); a room without presets has no such rule.
 */
function outsideOK(ctx, P) {
  if (!ctx.pageRoom || !(KNOBS.outMax < 1)) return true;
  const q = P.u.coarse, n = q.length / 2, E = ctx.room.edges;
  let out = 0;
  for (let i = 0; i < n; i++) {
    const a = q[2 * i] * P.s, b = q[2 * i + 1] * P.s * P.flip, x = P.x + P.c * a - P.sn * b, y = P.y + P.sn * a + P.c * b;
    for (const e of E) if (e.nx * x + e.ny * y > e.d + 1e-9 * ctx.size) { out++; break; }
  }
  return out <= KNOBS.outMax * n;
}
/**
 * What a grown comma is worth while it grows: its area up to the cap (the dark share KNOBS.capD with its eye), then the
 * channel to spare at the capped size (the slack, so that the copies sit evenly), and its curl.
 */
function growWorth(ctx, st) {
  const K = KNOBS, u = st.u, A = ctx.group.domainArea, eyeA = Math.PI * K.eye * K.eye;
  const area = st.s * st.s * (u.area - eyeA), cap = K.capD * A, curl = curlOf(u);
  let f, sc = st.s;
  if (area <= cap) f = area / A;
  else {
    sc = st.s * Math.sqrt(cap / area);
    const slack = channelOf(ctx, poseOf(u, st.x, st.y, st.th, sc, st.flip), 3 * ctx.chan) - ctx.chan;
    f = K.capD + (K.slackW * Math.min(slack, 2 * ctx.chan)) / ctx.size;
  }
  f += K.curlW * curl;
  if (ctx.specials.length) f -= K.centreW * Math.max(0, centreBare(ctx, poseOf(u, st.x, st.y, st.th, sc, st.flip)) / ctx.size - K.centreGoal);
  return f;
}
/**
 * The bare patch at the rotation centres: the copies round a centre are turned images of one another, all as far from
 * it as the comma is from the nearest point of the centre's orbit, so the patch there is twice that across.
 */
function centreBare(ctx, P) {
  let worst = 0;
  for (const S of ctx.specials) {
    let d = Infinity;
    for (let i = 0; i < S.length; i += 2) { const e = sdPose(P, S[i], S[i + 1]); if (e < d) d = e; }
    if (2 * d > worst) worst = 2 * d;
  }
  return worst;
}
/** The rotation centres of the room (its rim included), each with the points of its orbit near the room. */
function specialsOf(group, room, size) {
  const inRoom = (p) => room.edges.every((e) => e.nx * p.x + e.ny * p.y <= e.d + 1e-6 * size);
  const out = [];
  for (const c of symmetryElements(group, room.cx, room.cy, room.R * 1.001 + 1e-6 * size).centers.filter(inRoom)) {
    const pts = [];
    for (const g of elementsNear(group, room.cx, room.cy, room.R + 1.5 * size, c.x, c.y)) pts.push(g.a * c.x + g.b * c.y + g.tx, g.c * c.x + g.d * c.y + g.ty);
    out.push(Float64Array.from(pts));
  }
  return out;
}
/** Pattern search from a fit of the room: position, turn, tail length and back angle; the head radius as large as the copies allow. */
function growFrom(ctx, fit) {
  const K = KNOBS, size = ctx.size, ref = ctx.room.ref, ex = [Math.cos(ref), Math.sin(ref)], ey = [-Math.sin(ref), Math.cos(ref)];
  const mk = (x, y, th, lam, ab, s0) => {
    if (!allowed(lam, ab)) return null;
    const u = unitComma(lam, ab, K.tip * DEG);
    if (!u) return null;
    const s = maxScaleAt(ctx, u, x, y, th, fit.flip, s0);
    if (!(s > 0)) return null;
    const st = { u, x, y, th, lam, ab, s, flip: fit.flip };
    st.f = growWorth(ctx, st);
    return st;
  };
  let cur = mk(fit.x, fit.y, fit.theta, fit.lam, fit.ab, fit.s);
  if (!cur) return null;
  const step = [0.05 * size, 5 * DEG, 0.07, 6 * DEG];
  let evals = 0;
  for (let round = 0; round < 40 && evals < K.growEvals; round++) {
    let moved = false;
    for (let v = 0; v < 5 && !moved; v++) for (const sg of [1, -1]) {
      let { x, y, th, lam, ab } = cur;
      if (v === 0) { x += sg * step[0] * ex[0]; y += sg * step[0] * ex[1]; }
      else if (v === 1) { x += sg * step[0] * ey[0]; y += sg * step[0] * ey[1]; }
      else if (v === 2) th += sg * step[1];
      else if (v === 3) lam *= 1 + sg * step[2];
      else ab = Math.min(90 * DEG, ab + sg * step[3]);
      const t = mk(x, y, th, lam, ab, cur.s);
      evals++;
      if (t && t.f > cur.f + 1e-6) { cur = t; moved = true; break; }
    }
    if (!moved) { for (let k = 0; k < 4; k++) step[k] /= 2; if (step[0] < 0.004 * size) break; }
  }
  // the size it keeps: the cap, or as large as the copies allow
  const A = ctx.group.domainArea, eyeA = Math.PI * K.eye * K.eye, area = cur.s * cur.s * (cur.u.area - eyeA);
  if (area > K.capD * A) cur.s *= Math.sqrt((K.capD * A) / area);
  cur.evals = evals;
  return cur;
}
/** The signed distance from p to the motif M = { P, eye, dots } (the comma less its eye, and the dots). */
function motifSD(M, px, py) {
  let d = Math.max(sdPose(M.P, px, py), M.eye - Math.hypot(px - M.P.x, py - M.P.y));
  for (const o of M.dots) { const e = Math.hypot(px - o.x, py - o.y) - o.r; if (e < d) d = e; }
  return d;
}
/**
 * The elements h that carry a point of the room (or near it) close to the motif M: then dist(p, h^-1(M)) = dist(h p, M).
 * Kept on M; a point farther than `pad` outside the room asks elementsNear itself.
 */
function bareEls(ctx, M) {
  if (!M.H) M.H = elementsNear(ctx.group, M.bx, M.by, M.br + ctx.bareCap + ctx.room.R + ctx.bareCap, ctx.room.cx, ctx.room.cy);
  return M.H;
}
/** The distance from p to the dark of the plane (0 in the dark), never more than `cap`. */
function bareFreeAt(ctx, M, px, py, cap) {
  let d = cap;
  const far = Math.hypot(px - ctx.room.cx, py - ctx.room.cy) > ctx.room.R + ctx.bareCap - cap;
  for (const h of far ? elementsNear(ctx.group, M.bx, M.by, M.br + cap, px, py) : bareEls(ctx, M)) {
    const qx = h.a * px + h.b * py + h.tx, qy = h.c * px + h.d * py + h.ty;
    if (Math.hypot(qx - M.bx, qy - M.by) - M.br >= d) continue;
    const e = motifSD(M, qx, qy);
    if (e < d) { d = e; if (d <= 0) return 0; }
  }
  return d;
}
/** The largest bare disc of the plane: { r, x, y }. Samples of the room (a whole tile: every orbit meets it), the best refined. */
function bareFree(ctx, M) {
  const { S, h } = ctx.samples, ring = ctx.ring2, cap = ctx.bareCap, top = [];
  let cut = 0;
  for (const p of S) {
    const d = bareFreeAt(ctx, M, p.x, p.y, cap);
    if (d <= cut) continue;
    const near = top.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < 2.5 * h);
    if (near >= 0) { if (d > top[near].r + 1e-9 * ctx.size) top[near] = { r: d, x: p.x, y: p.y }; } else top.push({ r: d, x: p.x, y: p.y });
    top.sort((a, b) => b.r - a.r);
    if (top.length > 3) top.length = 3;
    if (top.length === 3) cut = 0.85 * top[2].r;
  }
  let best = { r: 0, x: ctx.room.cx, y: ctx.room.cy };
  for (let cur of top) {
    for (let step = h / 2, it = 0; it < 8; it++, step /= 2) {
      for (const [dx, dy] of ring) {
        const x = cur.x + step * dx, y = cur.y + step * dy, d = bareFreeAt(ctx, M, x, y, cap);
        if (d > cur.r + 1e-9 * ctx.size) cur = { r: d, x, y };
      }
    }
    if (cur.r > best.r + 1e-9 * ctx.size) best = cur;
  }
  return best;
}
/** The radius of the largest dot centred at p: a channel from every mark of the plane and from its own copies. */
function dotFreeAt(ctx, M, px, py) {
  let r = bareFreeAt(ctx, M, px, py, ctx.bareCap) - ctx.chan;
  if (!(r > 0)) return -1;
  for (const g of elementsNear(ctx.group, px, py, 2 * r + ctx.chan, px, py)) {
    if (isIdent(g, ctx.tiny)) continue;
    r = Math.min(r, (Math.hypot(g.a * px + g.b * py + g.tx - px, g.c * px + g.d * py + g.ty - py) - ctx.chan) / 2);
  }
  return r;
}
function dotFree(ctx, M, x, y, h) {
  let cur = { x, y, r: dotFreeAt(ctx, M, x, y) };
  for (let it = 0; it < 9; it++, h /= 2) {
    for (let again = true, guard = 0; again && guard < 12; guard++) {
      again = false;
      for (const [dx, dy] of ctx.ring2) {
        const qx = cur.x + h * dx, qy = cur.y + h * dy, r = dotFreeAt(ctx, M, qx, qy);
        if (r > cur.r + 1e-9 * ctx.size) { cur = { x: qx, y: qy, r }; again = true; }
      }
    }
  }
  return cur;
}
/**
 * What a grown comma is worth (it ranks the grown starts): curl, few dots, a small largest bare patch; any dark share
 * from 0.46 to 0.58 is as good as any other (more dark is not better: calm is).
 */
function grownWorth(D, B, curl, dots) {
  const K = KNOBS;
  return K.curlScore * curl - K.dotCost * dots - 0.5 * B - 4 * Math.max(0, B - K.bareGoal) - 3 * Math.max(0, 0.46 - D) - 4 * Math.max(0, D - K.darkMax);
}
/** A grown comma finished: its eye, at most KNOBS.dotsGrown dots where the largest bare patches are, and its worth. */
function finishGrown(ctx, st) {
  const K = KNOBS, A = ctx.group.domainArea, P = poseOf(st.u, st.x, st.y, st.th, st.s, st.flip), o = worldOutline(P);
  const M = { P, eye: K.eye * st.s, dots: [], bx: o.bx, by: o.by, br: o.br };
  let bare = bareFree(ctx, M);
  const withDot = (dot) => ({ P, eye: M.eye, dots: M.dots.concat([dot]), bx: M.bx, by: M.by, br: Math.max(M.br, Math.hypot(dot.x - M.bx, dot.y - M.by) + dot.r) });
  // the yin-yang's dot: in the comma's own bay, at the centre of its belly circle (where the light half's head would
  // be), when the bay is open (a nesting neighbour's tail may fill it) and a patch above the goal is left
  if (K.bayDot && 2 * bare.r > K.bareGoal * ctx.size && st.u.Rl <= K.bayRl) {
    const u = st.u, a = u.Cl[0] * st.s, b = u.Cl[1] * st.s * st.flip, cx = st.x + P.c * a - P.sn * b, cy = st.y + P.sn * a + P.c * b;
    const lim = Math.min(0.5, Math.max(0, u.Rl - 1) * 0.5) * st.s;   // the dot may slide this far from the bay's centre
    let d = dotFree(ctx, M, cx, cy, Math.max(lim, 0.01 * ctx.size) / 2);
    if (Math.hypot(d.x - cx, d.y - cy) > lim) d = { x: cx, y: cy, r: dotFreeAt(ctx, M, cx, cy) };
    if (d.r >= K.bayMin * st.s) {
      const M2 = withDot({ x: d.x, y: d.y, r: Math.min(d.r, K.dotMax * st.s, K.dotCap * ctx.size) }), b2 = bareFree(ctx, M2);
      if (b2.r < bare.r - 0.005 * ctx.size) { Object.assign(M, M2); bare = b2; }
    }
  }
  for (let n = M.dots.length; n < K.dotsGrown; n++) {
    if (2 * bare.r <= K.bareGoal * ctx.size) break;
    const d = dotFree(ctx, M, bare.x, bare.y, bare.r / 2);
    if (d.r < K.dotMin * ctx.size) break;
    const M2 = withDot({ x: d.x, y: d.y, r: Math.min(d.r, K.dotMax * st.s, K.dotCap * ctx.size) });
    const b2 = bareFree(ctx, M2);
    if (b2.r > bare.r - 0.01 * ctx.size) break;           // a dot that does not shrink the largest patch stays out
    Object.assign(M, M2); bare = b2;
  }
  let dark = st.s * st.s * st.u.area;
  for (const d of M.dots) dark += Math.PI * d.r * d.r;
  M.eye = Math.min(K.eyeMax * st.s, Math.max(K.eye * st.s, Math.sqrt(Math.max(0, dark - K.darkMax * A) / Math.PI)));
  const B = (2 * bare.r) / ctx.size, D = (dark - Math.PI * M.eye * M.eye) / A, curl = curlOf(st.u);
  return { st, M, bare, B, D, curl, score: grownWorth(D, B, curl, M.dots.length) };
}

// ---------------------------------------------------------------------------------------------------------------
// find
// ---------------------------------------------------------------------------------------------------------------
export function find(group) {
  const size = Math.sqrt(group.domainArea), K = KNOBS, margin = K.margin * size;
  const room = roomOf(group);
  const ctx = { group, room, size, margin, samples: roomSamples(room, size) };
  // the candidates: free or with the tip in one corner, either hand, classic, curled or flat
  const cands = [];
  for (const flip of [1, -1]) for (const cls of ['classic', 'curled', 'flat']) {
    const f = searchRoom(room, margin, null, flip, cls);
    if (f) { f.cls = cls; cands.push(f); }
    for (const v of room.verts) {
      const pin = { x: v.x, y: v.y, ux: v.ux, uy: v.uy, depth: margin / Math.sin(v.angle / 2) + 0.03 * size };
      const g = searchRoom(room, margin, pin, flip, cls);
      if (g) { g.cls = cls; cands.push(g); }
    }
  }
  if (!cands.length) throw new Error('bigcomma: no comma fits the room of ' + group.id);
  cands.sort((a, b) => b.area - a.area);
  const evals = [], log = [], seen = [], TIE = 0.006;
  let top = -Infinity;
  for (const f of cands) {
    if (seen.some((q) => q.flip === f.flip && Math.hypot(q.x - f.x, q.y - f.y) < 0.01 * size && Math.abs(q.s - f.s) < 0.01 * f.s && Math.abs(q.lam - f.lam) < 0.03 && Math.abs(Math.sin((q.theta - f.theta) / 2)) < 0.01)) continue;
    seen.push(f);
    const e = evaluate(ctx, f, top - TIE);
    if (!e) continue;
    evals.push(e);
    if (K.debug) log.push(`${f.pin ? 'pin ' : 'free'} flip ${f.flip} lam ${f.lam.toFixed(2)} ab ${(f.ab / DEG).toFixed(0)} back ${f.u.back.toFixed(2)} turn ${(mod(f.theta - room.ref, TAU) / DEG).toFixed(0)} head ${(f.s / size).toFixed(3)} D ${e.D.toFixed(3)} B ${e.B.toFixed(3)} dots ${e.dots.length} score ${e.score.toFixed(4)}`);
    if (e.score > top) top = e.score;
  }
  // a room with a symmetry of its own has two or more best candidates, images of one another (the same shape and size,
  // worth the same up to the grain of the bare-patch search): of those the comma of the first hand, and of these the
  // one turned least from e1 (the same choice wherever the group lies)
  const first = evals.find((e) => e.score === top), turn = (e) => Math.round(mod(e.fit.theta - room.ref + 1e-6, TAU) / DEG);
  let best = null;
  for (const e of evals) {
    if (e.score < top - TIE || Math.abs(e.fit.lam - first.fit.lam) > 0.02 * first.fit.lam || Math.abs(e.fit.ab - first.fit.ab) > DEG || Math.abs(e.fit.s - first.fit.s) > 0.01 * first.fit.s) continue;
    if (!best || e.fit.flip > best.fit.flip || (e.fit.flip === best.fit.flip && turn(e) < turn(best))) best = e;
  }
  const tried = evals.length;
  if (K.grow) {
    // the best fits of the room (the chosen one first), each grown against its copies; a later one wins only by a margin
    const gctx = { ...ctx, chan: K.dotGap * size, tiny: 1e-9 * size, bareCap: 1.0 * size, ring2: Array.from({ length: 8 }, (_, k) => [Math.cos(room.ref + (17 + 45 * k) * DEG), Math.sin(room.ref + (17 + 45 * k) * DEG)]), pageRoom: !K.roundRoom && !!(group.presets && group.presets.length) };
    // a room walled by mirrors on every side (a kaleidoscope's chamber) cannot be left: no search there
    const walled = room.poly.every((p, i) => contains(group, reflThrough(p, room.poly[(i + 1) % room.poly.length])));
    gctx.specials = walled || !(K.centreW > 0) ? [] : specialsOf(group, room, size);
    // the starts: the chosen fit, the largest fit of each other class (a curled comma may grow where a flat one won),
    // then the next best of the evaluated ones
    const pick = [best.fit];
    const add = (f) => { if (f && pick.length < K.growStarts && !pick.some((q) => q.flip === f.flip && Math.abs(Math.sin((q.theta - f.theta) / 2)) < 0.05 && Math.hypot(q.x - f.x, q.y - f.y) < 0.1 * size)) pick.push(f); };
    // of fits that tie (a room with a symmetry of its own has them, equal up to rounding), the first hand, then the one
    // turned least from e1: the same start wherever the group lies
    const tturn = (f) => Math.round(mod(f.theta - room.ref + 1e-6, TAU) / DEG);
    const canon = (list, val, tie) => {
      let top = -Infinity, out = null;
      for (const f of list) top = Math.max(top, val(f));
      for (const f of list) if (val(f) >= top - tie && (!out || f.flip > out.flip || (f.flip === out.flip && tturn(f) < tturn(out)))) out = f;
      return out;
    };
    // (areas come from a linear programme, exact up to rounding: the starts are the same wherever the group lies. The
    // other evaluated fits are no start: which of them get evaluated at all depends on the order of near-equal areas.)
    for (const cls of ['curled', 'classic', 'flat']) { const of = cands.filter((f) => f.cls === cls); if (of.length) add(canon(of, (f) => f.area, 1e-9 * group.domainArea)); }
    let win = null;
    for (const fit of pick) {
      const e = { fit };
      const st = walled ? { u: unitData(e.fit.u), x: e.fit.x, y: e.fit.y, th: e.fit.theta, lam: e.fit.lam, ab: e.fit.ab, s: e.fit.s, flip: e.fit.flip, evals: 0 } : growFrom(gctx, e.fit);
      if (!st) continue;
      const r = finishGrown(gctx, st);
      if (K.debug) log.push(`grown from ${e.fit.cls} ${e.fit.pin ? "pin" : "free"} flip ${e.fit.flip} turn ${(mod(e.fit.theta - room.ref, TAU) / DEG).toFixed(4)} area ${(e.fit.area / group.domainArea).toFixed(6)} pos ${latticeCoords(group, e.fit.x - group.center[0], e.fit.y - group.center[1]).map((v) => v.toFixed(4))}: lam ${st.lam.toFixed(2)} ab ${(st.ab / DEG).toFixed(0)} head ${(st.s / size).toFixed(3)} D ${r.D.toFixed(3)} B ${r.B.toFixed(3)} dots ${r.M.dots.length} score ${r.score.toFixed(4)} evals ${st.evals}`);
      if (!win || r.score > win.score + TIE) win = r;
    }
    if (win) {
      const { st, M } = win;
      const fitG = { u: st.u, s: st.s, flip: st.flip, theta: st.th, x: st.x, y: st.y, lam: st.lam, ab: st.ab };
      const out = [{ pts: outline(fitG, (K.step * size) / st.s) }, { pts: circle(st.x, st.y, M.eye, K.step * size, room.ref), hole: true }];
      for (const o of M.dots) out.push({ pts: circle(o.x, o.y, o.r, K.step * size, room.ref) });
      return {
        shapes: out,
        info: {
          grown: true, lam: +st.lam.toFixed(3), ab: +(st.ab / DEG).toFixed(1), back: +st.u.back.toFixed(2), turn: +(mod(st.th, TAU) / DEG).toFixed(1), flip: st.flip,
          head: +(st.s / size).toFixed(3), length: +((st.s * (st.lam + 1)) / size).toFixed(3), eye: +(M.eye / size).toFixed(3),
          dark: +win.D.toFixed(3), bare: +win.B.toFixed(3), dots: M.dots.map((o) => +(o.r / size).toFixed(3)), cands: cands.length, tried, log: K.debug ? log : undefined,
        },
      };
    }
  }
  const { fit, dots } = best, s = fit.s;
  const shapesOut = [{ pts: outline(fit, (K.step * size) / s) }, { pts: circle(fit.x, fit.y, best.eye, K.step * size, room.ref), hole: true }];
  for (const o of dots) shapesOut.push({ pts: circle(o.x, o.y, o.r, K.step * size, room.ref) });
  return {
    shapes: shapesOut,
    info: {
      lam: +fit.lam.toFixed(3), ab: +(fit.ab / DEG).toFixed(1), back: +fit.u.back.toFixed(2), turn: +(mod(fit.theta, TAU) / DEG).toFixed(1), flip: fit.flip, pinned: !!fit.pin,
      head: +(s / size).toFixed(3), length: +((s * (fit.lam + 1)) / size).toFixed(3), eye: +(best.eye / size).toFixed(3),
      dark: +best.D.toFixed(3), bare: +best.B.toFixed(3), dots: dots.map((o) => +(o.r / size).toFixed(3)), cands: cands.length, tried, log: K.debug ? log : undefined,
    },
  };
}
