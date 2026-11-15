// dev/patterns/designs/feet/design.js — "Footprints": a pattern design for The Folding (dev/patterns/kit.js).
//
// The mark is a LEFT FOOTPRINT: a sole with a round heel, an arch drawn into its inner side and a round ball, and five
// toes as fat ovals, the big toe on the inner side and the others smaller and smaller. It has a direction (heel ->
// toes) and a hand (big toe and arch on one side), so a translated copy is parallel, a rotated copy turns, and a
// mirrored or glided copy is a RIGHT foot. A line of alternating left and right footprints is the textbook picture of
// a glide reflection.
//
// To fill the surface the foot is not a fixed glyph: it is drawn INTO A FRAME, a convex polygon that is (a part of)
// one tile of the group, and takes the frame's shape: a slender foot in a strip, a broad one in a square, a wedge with
// its heel in the thin corner of a triangle. The foot keeps the distance `delta` from its frame, so two copies are
// never closer than 2 delta: the channels between them. One foot per tile, except *x, whose strip holds two in line.
//
//   find(group) -> { shapes: [{ pts }], info }
//
// Everything is computed from the group's own lattice, coset representatives and symmetry elements, in LOCAL
// coordinates: the origin at group.center, the unit one tile size sqrt(domainArea) (so every tolerance below is a
// share of a tile, wherever the group lies and however large it is). With group.presets the frame is seated in the
// page's default tile (the Dirichlet tile of presets[0]); without it, in the tile of a seed found by rule (ruleSeed),
// which is the same tile up to an element of the group or of its normaliser.

import { symmetryElements } from '../../../../src/groups.js';
import { buildDomain } from '../../../../src/domain.js';

export const meta = { key: 'feet', label: 'Footprints', hint: 'one left footprint per tile, fitted to it: a mirror or a glide makes it a right one' };

// ---------------------------------------------------------------------------------------------------------------
// The knobs: all lengths in tile sizes
// ---------------------------------------------------------------------------------------------------------------
const K = {
  delta: 0.036,          // a mark keeps this distance from its frame: a channel between two marks is 2 delta wide
  deltaRel: 0.062,       // ... but at most this share of the frame's width (a thin strip gets thinner channels)
  deltaMin: 0.022,
  toe: [1, 0.64, 0.57, 0.5, 0.44],   // the toes' widths, in big toes
  toeLong: [1.3, 1.25, 1.25, 1.22, 1.2],   // a toe is an oval: this much longer than wide
  toeCap: 0.24,          // the widest big toe
  toeCapRel: 0.36,       // ... and at most this share of the frame's width
  toeCapHard: 0.285,     // ... but on a very long front the toes grow to this, to span it
  gapToe: 0.043,         // between two toes
  gapToeWide: 0.06,      // ... when a capped row of toes is spread over a longer front,
  gapToeMax: 0.085,      // ... and at most
  gapToeMin: 0.039,      // two ovals nearer than this (at a bend of the front) are made rounder
  gapSole: 0.048,        // between the toes and the sole
  h: 0.013,              // the step of a curve,
  turn: 0.2,             // and the most it turns at one vertex (radians)
  hc: 0.05,              // the step of the sole's control points on a corner's arc,
  hl: 0.09,              // on a straight side
  rSide: 0.3,            // corner radius of the sole, in sole widths
  rApex: 0.42,           // the heel in the apex of a wedge
  rMin: 0.024,           // no corner is sharper than this
  gentle: 0.7,           // a corner that turns less than this (radians) is no corner: a long curve
  shortSide: 0.075,      // a side of the sole's polygon shorter than this is dropped
  bare: 0.19,            // a rounded corner leaves at most this much of its frame corner bare (a radius)
  taperIn: 0.2,          // a heel on an edge is narrower than the ball: the inner side comes in by this many sole widths
  taperOut: 0.05,        // ... the outer side by this
  notch: 0.11,           // the arch: at most this deep,
  notchRel: 0.21,        // at most this share of the sole's width there,
  notchFrom: 0.45,       // it begins at this share of the round of a heel that sits on an edge,
  notchPeak: 0.42,       // is deepest at this share of the inner side, from the heel,
  notchLocal: 0.3,       // and nowhere more than this share of the sole's width at that place,
  notchSpan: 0.17,       // nor deeper than this share of the inner side's length (a hollow, never a nick)
  coverMax: 0.585,       // darker than this: the foot is drawn leaner (a deeper arch, more room round the toes) ...
  coverStep: 0.004,      // ... and then the channels are widened by this much at a time,
  coverWiden: 0.02,      // by this much at most
  solidMax: 0.665,       // a sole that holds a disc wider than this is pushed back from its toes,
  solidBack: 0.12,       // by this much at most
};

// ---------------------------------------------------------------------------------------------------------------
// Small vector helpers
// ---------------------------------------------------------------------------------------------------------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, s) => [a[0] * s, a[1] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const crs = (a, b) => a[0] * b[1] - a[1] * b[0];
const len = (a) => Math.hypot(a[0], a[1]);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DEG = Math.PI / 180;

function polyArea(p) {
  let s = 0;
  for (let i = 0, n = p.length; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; s += a[0] * b[1] - a[1] * b[0]; }
  return s / 2;
}
function centroid(p) {
  let cx = 0, cy = 0, s = 0;
  for (let i = 0, n = p.length; i < n; i++) { const a = p[i], b = p[(i + 1) % n], w = a[0] * b[1] - a[1] * b[0]; cx += (a[0] + b[0]) * w; cy += (a[1] + b[1]) * w; s += w; }
  return [cx / (3 * s), cy / (3 * s)];
}
/** The distance between two closed polygons that do not cross (vertices against edges). */
function polyGap(p, q) {
  let best = Infinity;
  const pass = (a, b) => {
    for (const v of a) for (let j = 0, m = b.length; j < m; j++) {
      const s = b[j], e = sub(b[(j + 1) % m], s), l2 = dot(e, e), t = l2 > 0 ? clamp(dot(sub(v, s), e) / l2, 0, 1) : 0;
      const d = Math.hypot(v[0] - s[0] - t * e[0], v[1] - s[1] - t * e[1]);
      if (d < best) best = d;
    }
  };
  pass(p, q); pass(q, p);
  return best;
}

// ---------------------------------------------------------------------------------------------------------------
// Convex polygons with labelled edges: P = { pts: [[x, y], ...] counter-clockwise, lab: [...] }, lab[i] labels the
// edge pts[i] -> pts[i + 1]
// ---------------------------------------------------------------------------------------------------------------
const TINY = 1e-9;

/** Keep the part with n . x <= c; the new edge gets `label`. */
function clipLab(P, nx, ny, c, label) {
  const pts = P.pts, lab = P.lab, n = pts.length;
  if (n < 3) return P;
  const s = new Array(n);
  let out = 0;
  for (let i = 0; i < n; i++) { s[i] = nx * pts[i][0] + ny * pts[i][1] - c; if (s[i] > TINY) out++; }
  if (!out) return P;
  if (out === n) return { pts: [], lab: [] };
  const np = [], nl = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, pin = s[i] <= TINY, qin = s[j] <= TINY;
    if (pin && qin) { np.push(pts[i]); nl.push(lab[i]); } else if (pin) {
      np.push(pts[i]);
      if (s[i] >= -TINY) nl.push(label);
      else { nl.push(lab[i]); np.push(lerp(pts[i], pts[j], s[i] / (s[i] - s[j]))); nl.push(label); }
    } else if (qin) {
      if (s[j] >= -TINY) continue;
      np.push(lerp(pts[i], pts[j], s[i] / (s[i] - s[j]))); nl.push(lab[i]);
    }
  }
  return dropShort({ pts: np, lab: nl });
}
function dropShort(P) {
  const n = P.pts.length, np = [], nl = [];
  for (let i = 0; i < n; i++) if (dist(P.pts[i], P.pts[(i + 1) % n]) > 1e-7) { np.push(P.pts[i]); nl.push(P.lab[i]); }
  return { pts: np, lab: nl };
}
/** Clip by the line through a and b, keeping the side of the point `keep`. */
function clipLine(P, a, b, keep, label) {
  const e = sub(b, a), l = len(e), nx = e[1] / l, ny = -e[0] / l, c = nx * a[0] + ny * a[1];
  if (nx * keep[0] + ny * keep[1] > c) return clipLab(P, -nx, -ny, -c, label);
  return clipLab(P, nx, ny, c, label);
}
/** The polygon moved inward by d: every edge keeps its index as its label; null when nothing is left. */
function inset(poly, d) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of poly) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const B = 4 * (x1 - x0 + y1 - y0);
  let P = { pts: [[x0 - B, y0 - B], [x1 + B, y0 - B], [x1 + B, y1 + B], [x0 - B, y1 + B]], lab: [-1, -1, -1, -1] };
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n], ex = q[0] - p[0], ey = q[1] - p[1], l = Math.hypot(ex, ey);
    if (l < 1e-9) continue;
    const nx = ey / l, ny = -ex / l;                                   // outward normal of a counter-clockwise polygon
    P = clipLab(P, nx, ny, nx * p[0] + ny * p[1] - d, i);
    if (P.pts.length < 3) return null;
  }
  return P;
}
/** The polyline along the edges of P whose labels are in `labels` (consecutive), counter-clockwise. */
function chainOf(P, labels) {
  const n = P.pts.length;
  let k0 = -1;
  for (let k = 0; k < n; k++) if (labels.includes(P.lab[k]) && !labels.includes(P.lab[(k - 1 + n) % n])) { k0 = k; break; }
  if (k0 < 0) return null;
  const pts = [P.pts[k0]];
  for (let k = k0; labels.includes(P.lab[k % n]) && pts.length <= n; k++) pts.push(P.pts[(k + 1) % n]);
  return pts;
}
/** The point at the length s along a polyline; null beyond its end. */
function pointAt(pts, s) {
  for (let k = 0; k + 1 < pts.length; k++) {
    const l = dist(pts[k], pts[k + 1]);
    if (s <= l) return lerp(pts[k], pts[k + 1], l > 0 ? s / l : 0);
    s -= l;
  }
  return null;
}
/** Walk along the polyline from the point nearest to q until the distance from q is d; null when it ends first. */
function walkTo(pts, q, d) {
  let best = Infinity, bk = 0, bs = 0;
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k], e = sub(pts[k + 1], a), l2 = dot(e, e);
    const s = l2 > 0 ? clamp(dot(sub(q, a), e) / l2, 0, 1) : 0, dd = dist(add(a, mul(e, s)), q);
    if (dd < best) { best = dd; bk = k; bs = s; }
  }
  for (let k = bk; k + 1 < pts.length; k++) {
    const a = pts[k], e = sub(pts[k + 1], a), f = sub(a, q), s0 = k === bk ? bs : 0;
    const A = dot(e, e), B = 2 * dot(f, e), C = dot(f, f) - d * d, disc = B * B - 4 * A * C;
    if (A > 0 && disc >= 0) {
      const s = (-B + Math.sqrt(disc)) / (2 * A);                      // where the polyline leaves the circle
      if (s >= s0 - 1e-12 && s <= 1 + 1e-12) return add(a, mul(e, s));
    }
  }
  return null;
}
/** The largest circle in a convex polygon, near enough: { c, r }. */
function inCircle(pts) {
  const n = pts.length, hp = [];
  for (let i = 0; i < n; i++) { const p = pts[i], e = unit(sub(pts[(i + 1) % n], p)); hp.push([e[1], -e[0], e[1] * p[0] - e[0] * p[1]]); }
  let c = centroid(pts), r = 0, step = 0.25 * Math.sqrt(Math.abs(polyArea(pts)));
  for (let it = 0; it < 120; it++) {
    let k = 0; r = Infinity;
    for (let i = 0; i < n; i++) { const d = hp[i][2] - hp[i][0] * c[0] - hp[i][1] * c[1]; if (d < r) { r = d; k = i; } }
    c = [c[0] - hp[k][0] * step, c[1] - hp[k][1] * step];
    step *= 0.95;
  }
  return { c, r };
}
/** How far one can go from p along the unit vector u inside the convex polygon. */
function reach(pts, p, u) {
  let t = Infinity;
  for (let i = 0, n = pts.length; i < n; i++) {
    const a = pts[i], e = sub(pts[(i + 1) % n], a), nx = e[1], ny = -e[0];
    const den = nx * u[0] + ny * u[1];
    if (den > 1e-12) t = Math.min(t, (nx * (a[0] - p[0]) + ny * (a[1] - p[1])) / den);
  }
  return t;
}

// ---------------------------------------------------------------------------------------------------------------
// The foot in a frame
// ---------------------------------------------------------------------------------------------------------------

/**
 * A LEFT footprint in a convex frame.
 *   frame   [[x, y], ...] convex, counter-clockwise
 *   toe     [i0, i1, ...] consecutive vertices of the frame, counter-clockwise: the front of the foot. The big toe sits
 *           in the corner i0 (or o.toeStart further along the front), the little toe in the last corner, the others
 *           between them along the frame.
 *   heel    [j]: the heel sits in the corner j (a wedge);  [j0, j1]: on the edge j0 -> j1
 *   o       { delta, toeCap, toeCapHard, toeStart, gapSole, taper, notch, bare, lean }: overrides
 * -> { sole: [[x, y], ...], toes: [[[x, y], ...] x 5], area, info } or null when the frame is too small.
 */
function leftFoot(frame, toe, heel, o = {}) {
  const n = frame.length, lean = o.lean || 0;
  const fr = inCircle(frame);
  const delta = o.delta ?? clamp(K.deltaRel * 2 * fr.r, K.deltaMin, K.delta);
  const F = inset(frame, delta);
  if (!F) return null;
  const toeLab = [];
  for (let i = 0; i + 1 < toe.length; i++) toeLab.push(toe[i]);
  const heelRef = heel.length > 1 ? lerp(frame[heel[0]], frame[heel[1]], 0.5) : frame[heel[0]];
  const gapSole = K.gapSole + 0.03 * lean + (o.gapSole || 0);

  // --- the toes: five discs along the front, each touching the frame's channel, a gap apart
  const place = (D1, gap) => {
    const c = [], r = [];
    for (let i = 0; i < 5; i++) {
      const ri = (D1 * K.toe[i]) / 2, G = inset(frame, delta + ri), ch = G && chainOf(G, toeLab);
      if (!ch) return null;
      const p = i ? walkTo(ch, c[i - 1], r[i - 1] + ri + gap) : o.toeStart ? pointAt(ch, o.toeStart) : ch[0];
      if (!p) return null;
      c.push(p); r.push(ri);
    }
    return { c, r };
  };
  const most = (f, lo, hi) => {                  // the largest value in [lo, hi] at which the row still fits (it fits at lo)
    let best = f(lo);
    for (let it = 0; it < 28; it++) { const mid = (lo + hi) / 2, t = f(mid); if (t) { lo = mid; best = t; } else hi = mid; }
    return [best, lo];
  };
  const cap = Math.min(o.toeCap ?? K.toeCap, K.toeCapRel * 2 * fr.r);
  let gap = K.gapToe, toes = place(cap, gap);
  if (!toes) {                                   // the largest toes that fit
    if (!place(0.02, gap)) return null;
    [toes] = most((d) => place(d, gap), 0.02, cap);
  } else if (!place(cap, K.gapToeWide)) {        // the capped toes leave a little room: spread them
    [toes, gap] = most((g) => place(cap, g), gap, K.gapToeWide);
  } else {                                       // a long front: wider gaps, and then bigger toes, until the row spans it
    gap = K.gapToeWide;
    const capHard = o.toeCapHard ?? K.toeCapHard;
    if (place(capHard, gap)) [toes, gap] = most((g) => place(capHard, g), gap, K.gapToeMax);
    else [toes] = most((d) => place(d, gap), cap, capHard);
  }
  // each toe is an oval, longer across the front than along it: it grows toward the sole, as far as the channel allows.
  // Its long axis is across the edge it touches; near a bend of the front it turns halfway to the next edge's (unless
  // a corner of the frame leaves no room for the turn).
  const hp = [];
  for (let i = 0; i < n; i++) { const p = frame[i], e = unit(sub(frame[(i + 1) % n], p)); hp.push({ nn: [e[1], -e[0]], c: e[1] * p[0] - e[0] * p[1] - delta }); }
  const long = K.toeLong.map((v) => v * (o.toeLong ?? 1));
  const ovalOf = (i) => {
    const c = toes.c[i], r = toes.r[i];
    let blend = [0, 0], near = toeLab[0], nd = Infinity;
    for (const l of toeLab) {
      const off = hp[l].c - dot(hp[l].nn, c) - r;                      // 0 where the toe touches the edge's channel
      blend = add(blend, mul(hp[l].nn, Math.max(0, 1 - off / (1.2 * r))));
      if (Math.abs(off) < nd) { nd = Math.abs(off); near = l; }
    }
    const fitsAlong = (ax, b) => { const q = sub(c, mul(ax, b - r)); return hp.every((H) => dot(H.nn, q) + Math.hypot(r * crs(H.nn, ax), b * dot(H.nn, ax)) - H.c < 1e-9); };
    let ax = unit(blend), b = r * long[i];
    if (!fitsAlong(ax, b)) ax = hp[near].nn;
    if (!fitsAlong(ax, b)) { let lo = r, hi = b; for (let it = 0; it < 12; it++) { const mid = (lo + hi) / 2; if (fitsAlong(ax, mid)) lo = mid; else hi = mid; } b = lo; }
    const across = [-ax[1], ax[0]], q = sub(c, mul(ax, b - r)), cnt = clamp(Math.ceil((Math.PI * (r + b)) / K.h), 36, 90), pts = [];
    for (let j = 0; j < cnt; j++) { const a = (2 * Math.PI * j) / cnt, x = r * Math.cos(a), y = b * Math.sin(a); pts.push([q[0] + x * across[0] + y * ax[0], q[1] + x * across[1] + y * ax[1]]); }
    return { c: q, r, b, pts };
  };
  let oval = toes.c.map((_, i) => ovalOf(i));
  for (let pass = 0; pass < 6; pass++) {
    let close = false;
    for (let i = 0; i < 4; i++) if (polyGap(oval[i].pts, oval[i + 1].pts) < K.gapToeMin) {
      const k = long[i + 1] > 1.03 ? i + 1 : i;                        // the smaller toe of the two gives way first
      long[k] = 1 + 0.5 * (long[k] - 1); close = true;
    }
    if (!close) break;
    oval = toes.c.map((_, i) => ovalOf(i));
  }

  // --- the sole: the frame behind the toes. Each toe keeps the sole behind a line across the way from the toe to the
  // middle of the foot, so the front of the sole follows the row of toes.
  // (o.front 'straight', for a row of toes that runs far back along the foot: only the big toe has such a line; from
  // where it meets the inner side, ONE straight line passes all the other toes. The sole then comes up to the big toe.)
  const mid = lerp(fr.c, heelRef, 0.3);
  let S = F;
  for (const t of o.front === 'straight' ? oval.slice(0, 1) : oval) {
    const mm = unit(sub(mid, t.c));
    S = clipLab(S, -mm[0], -mm[1], -(dot(mm, t.c) + t.b + gapSole), -2);
    if (S.pts.length < 3) return null;
  }
  if (o.front === 'straight') {
    let fi = -1;
    for (let j = 0, q = S.pts.length; j < q; j++) if (S.lab[j] === -2 && S.lab[(j - 1 + q) % q] !== -2) fi = j;
    if (fi >= 0) {
      const V = S.pts[fi];
      for (const t of oval.slice(1)) {
        const d = sub(t.c, V), l = len(d), R = t.b + gapSole;
        if (l <= R) continue;
        const phi = Math.atan2(d[1], d[0]), al = Math.asin(R / l);
        for (const sgn of [1, -1]) {                                    // the tangent from V that has the toe beyond it
          const a = phi + sgn * al;
          let nn = [-Math.sin(a), Math.cos(a)];
          if (dot(nn, sub(heelRef, V)) < 0) nn = [-nn[0], -nn[1]];
          if (dot(nn, d) < 0) { S = clipLab(S, -nn[0], -nn[1], -dot(nn, V), -2); break; }
        }
        if (S.pts.length < 3) return null;
      }
    }
  }
  const W0 = 2 * inCircle(S.pts).r;
  // a heel on an edge: narrower than the ball
  const taper = o.taper ?? 1;
  if (heel.length > 1 && taper > 0) {
    const k = S.lab.indexOf(heel[0]);
    if (k >= 0) {
      const m = S.pts.length, A0 = S.pts[k], A1 = S.pts[(k + 1) % m];           // outer end, inner end of the heel edge
      if (dist(A0, A1) > 0.62 * W0) {
        const keep = inCircle(S.pts).c;
        let fi = -1, fo = -1;
        for (let j = 0; j < m; j++) { if (S.lab[j] === -2 && S.lab[(j - 1 + m) % m] !== -2) fi = j; if (S.lab[j] !== -2 && S.lab[(j - 1 + m) % m] === -2) fo = j; }
        if (fi >= 0 && fo >= 0) {
          const Fin = S.pts[fi], Fout = S.pts[fo], e = unit(sub(A0, A1));
          S = clipLine(S, add(A1, mul(e, taper * K.taperIn * W0)), Fin, keep, -3);
          S = clipLine(S, add(A0, mul(e, -taper * K.taperOut * W0)), lerp(A0, Fout, 0.6), keep, -4);
        }
      }
    }
  }
  // a side too short to carry a round is dropped (with the gentler of its two corners): what is left is rounded well
  for (let guard = 0; guard < 8 && S.pts.length > 4; guard++) {
    const P = S.pts, q = P.length;
    let k = -1, short = K.shortSide;
    for (let i = 0; i < q; i++) { const l = dist(P[i], P[(i + 1) % q]); if (l < short && S.lab[i] !== heel[0]) { short = l; k = i; } }
    if (k < 0) break;
    const bend = (i) => { const a = unit(sub(P[i], P[(i - 1 + q) % q])), b = unit(sub(P[(i + 1) % q], P[i])); return Math.atan2(crs(a, b), dot(a, b)); };
    const j = (k + 1) % q, drop = bend(k) < bend(j) ? k : j, np = [], nl = [];
    // without corner k the side before it runs on to j; without corner j its own side starts at k
    for (let i = 0; i < q; i++) if (i !== drop) { np.push(P[i]); nl.push(drop === j && i === k ? S.lab[j] : S.lab[i]); }
    S = { pts: np, lab: nl };
  }
  const sp = S.pts, m = sp.length;
  if (m < 3) return null;
  const W = 2 * inCircle(sp).r;

  // --- its corners: which are the heel's, how round each is
  const isHeel = new Array(m).fill(false);
  if (heel.length > 1) {
    const k = S.lab.indexOf(heel[0]);
    if (k >= 0) { isHeel[k] = true; isHeel[(k + 1) % m] = true; }
  } else {
    for (let k = 0; k < m; k++) if (S.lab[k] === heel[0] && S.lab[(k - 1 + m) % m] === (heel[0] - 1 + n) % n) isHeel[k] = true;
  }
  if (!isHeel.includes(true)) { let b = 0; for (let k = 1; k < m; k++) if (dist(sp[k], toes.c[2]) > dist(sp[b], toes.c[2])) b = k; isHeel[b] = true; }
  const turn = [], rr = [], gentle = [], bareMax = o.bare ?? K.bare;
  for (let k = 0; k < m; k++) {
    const d0 = unit(sub(sp[k], sp[(k - 1 + m) % m])), d1 = unit(sub(sp[(k + 1) % m], sp[k]));
    turn.push(Math.max(1e-6, Math.atan2(crs(d0, d1), dot(d0, d1))));
    const sh = Math.sin((Math.PI - turn[k]) / 2);                       // sin of half the interior angle
    const bare = sh < 0.999 ? ((isHeel[k] ? bareMax : K.bare) - delta / sh) / (1 / sh - 1) : Infinity;
    // between two toes' lines, and wherever the outline turns only a little, the two sides run into each other in one
    // long curve; a sharp corner is rounded less (it would leave its corner of the frame bare)
    gentle.push(!isHeel[k] && ((S.lab[k] === -2 && S.lab[(k - 1 + m) % m] === -2) || turn[k] < K.gentle));
    const want = isHeel[k] ? (heel.length > 1 ? W : K.rApex * W) : gentle[k] ? W : (K.rSide + 0.08 * lean) * W * Math.min(1, (Math.PI - turn[k]) / (Math.PI / 2));
    rr.push(Math.max(K.rMin, Math.min(want, bare)));
  }
  // two rounds share the side between them: a long curve gives way to a true corner first
  const tan = (k) => rr[k] * Math.tan(turn[k] / 2);
  for (let pass = 0; pass < 16; pass++) {
    let changed = false;
    for (let k = 0; k < m; k++) {
      const j = (k + 1) % m, L = dist(sp[k], sp[j]) * 0.999;
      if (tan(k) + tan(j) <= L) continue;
      changed = true;
      if (gentle[k] !== gentle[j]) { const g = gentle[k] ? k : j, room = Math.max(L - tan(g === k ? j : k), 0.3 * L); if (tan(g) > room) rr[g] *= room / tan(g); }
      if (tan(k) + tan(j) > L) { const f = L / (tan(k) + tan(j)); rr[k] *= f; rr[j] *= f; }
    }
    if (!changed) break;
  }

  // --- the control points of the outline: on the arcs of the corners and on the straight sides between them
  const ctrl = [], arcAt = [];                                           // arcAt[k] = [first, last] index of corner k's arc
  for (let k = 0; k < m; k++) {
    const p = sp[k], d0 = unit(sub(p, sp[(k - 1 + m) % m])), d1 = unit(sub(sp[(k + 1) % m], p));
    const r = rr[k], t = r * Math.tan(turn[k] / 2), Tin = sub(p, mul(d0, t)), O = add(Tin, mul([-d0[1], d0[0]], r));
    const a0 = Math.atan2(Tin[1] - O[1], Tin[0] - O[0]), steps = Math.max(3, Math.ceil((r * turn[k]) / K.hc));
    const first = ctrl.length;
    for (let j = 0; j <= steps; j++) { const a = a0 + (turn[k] * j) / steps, cs = Math.cos(a), sn = Math.sin(a); ctrl.push({ p: [O[0] + r * cs, O[1] + r * sn], n: [-cs, -sn] }); }
    arcAt.push([first, ctrl.length - 1]);
    const j1 = (k + 1) % m, A = add(p, mul(d1, t)), B = sub(sp[j1], mul(d1, rr[j1] * Math.tan(turn[j1] / 2)));
    const cnt = Math.floor(dist(A, B) / K.hl);
    for (let j = 1; j <= cnt; j++) ctrl.push({ p: lerp(A, B, j / (cnt + 1)), n: [-d1[1], d1[0]] });
  }
  // --- the arch: the inner side, from the heel to the ball, is drawn in (a broad hollow, deepest nearer the heel)
  let notchDepth = 0;
  {
    let kh = 0;
    while (!(isHeel[kh] && !isHeel[(kh + 1) % m]) && kh < m) kh++;        // the heel's last corner, counter-clockwise
    kh %= m;
    let kf = kh;
    for (let guard = 0; guard < m && S.lab[kf] !== -2; guard++) kf = (kf + 1) % m;   // the first corner of the front
    const N = ctrl.length;
    const ia = Math.round(arcAt[kh][0] + (heel.length > 1 ? K.notchFrom : 1) * (arcAt[kh][1] - arcAt[kh][0]));
    const ib = Math.round(arcAt[kf][0] + 0.3 * (arcAt[kf][1] - arcAt[kf][0]));
    const idx = [];
    for (let i = ia; idx.length <= N; i = (i + 1) % N) { idx.push(i); if (i === ib) break; }
    if (kf !== kh && idx.length > 4 && idx.length <= N) {
      const s = [0];
      for (let j = 1; j < idx.length; j++) s.push(s[j - 1] + dist(ctrl[idx[j]].p, ctrl[idx[j - 1]].p));
      const total = s[s.length - 1], kappa = (0.5 - K.notchPeak) / (K.notchPeak * (1 - K.notchPeak));
      let jp = 0;
      for (let j = 0; j < idx.length; j++) if (Math.abs(s[j] / total - K.notchPeak) < Math.abs(s[jp] / total - K.notchPeak)) jp = j;
      const peak = ctrl[idx[jp]];
      const across = reach(sp, add(peak.p, mul(peak.n, 1e-6)), peak.n);
      const ln = o.archKept ? 0 : lean;                                 // (an arch that faces its mirror image is not deepened)
      const depth = Math.min((o.notch ?? 1) * (1 + 0.6 * ln) * K.notch, (1 + 0.4 * ln) * K.notchRel * across, K.notchSpan * total);
      if (depth > 0.012) {
        notchDepth = depth;
        for (let j = 0; j < idx.length; j++) {
          const uu = s[j] / total, w = uu + kappa * uu * (1 - uu), b = Math.sin(Math.PI * w) ** 2, c = ctrl[idx[j]];
          // never more than a share of the sole's width at that place: the thin heel of a wedge keeps its body
          const here = Math.min(depth, K.notchLocal * reach(sp, add(c.p, mul(c.n, 1e-6)), c.n));
          c.p = add(c.p, mul(c.n, here * b));
        }
      }
    }
  }
  // --- the outline: the closed cubic B-spline of the control points (it stays inside their hull, so inside the frame)
  const C = [];
  for (const c of ctrl) if (!C.length || dist(c.p, C[C.length - 1]) > 1e-6) C.push(c.p);
  if (C.length > 3 && dist(C[0], C[C.length - 1]) < 1e-6) C.pop();
  const outline = [];
  for (let i = 0, N = C.length; i < N; i++) {
    const p0 = C[(i - 1 + N) % N], p1 = C[i], p2 = C[(i + 1) % N], p3 = C[(i + 2) % N];
    const t0 = sub(p2, p0), t1 = sub(p3, p1), bend = Math.abs(Math.atan2(crs(t0, t1), dot(t0, t1)));   // how far this span turns
    const q = clamp(Math.max(Math.ceil(dist(p1, p2) / K.h), Math.ceil(bend / K.turn)), 1, 14);
    for (let j = 0; j < q; j++) {
      const t = j / q, t2 = t * t, t3 = t2 * t;
      const b0 = (1 - 3 * t + 3 * t2 - t3) / 6, b1 = (3 * t3 - 6 * t2 + 4) / 6, b2 = (-3 * t3 + 3 * t2 + 3 * t + 1) / 6, b3 = t3 / 6;
      const pt = [b0 * p0[0] + b1 * p1[0] + b2 * p2[0] + b3 * p3[0], b0 * p0[1] + b1 * p1[1] + b2 * p2[1] + b3 * p3[1]];
      const L = outline.length;
      // a point on a straight run is dropped
      if (L > 1 && Math.abs(crs(sub(outline[L - 1], outline[L - 2]), sub(pt, outline[L - 1]))) < 1e-9 && dot(sub(outline[L - 1], outline[L - 2]), sub(pt, outline[L - 1])) > 0) outline[L - 1] = pt;
      else outline.push(pt);
    }
  }

  let area = Math.abs(polyArea(outline));
  for (const t of oval) area += Math.abs(polyArea(t.pts));
  return { sole: outline, toes: oval.map((t) => t.pts), area, info: { delta, toe: 2 * toes.r[0], little: 2 * toes.r[4], gap, width: W, solid: 2 * inRadius(outline), notch: notchDepth, heelR: Math.max(...rr.filter((_, k) => isHeel[k])) } };
}

/** The radius of the largest disc inside a polygon (convex or not), to about a hundredth of its size. */
function inRadius(pts) {
  const n = pts.length;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const depth = (x, y) => {                                           // the distance to the outline; negative outside
    let d2 = Infinity, inn = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const a = pts[j], b = pts[i], ex = b[0] - a[0], ey = b[1] - a[1], l2 = ex * ex + ey * ey;
      const t = l2 > 0 ? clamp(((x - a[0]) * ex + (y - a[1]) * ey) / l2, 0, 1) : 0, dx = x - a[0] - t * ex, dy = y - a[1] - t * ey;
      if (dx * dx + dy * dy < d2) d2 = dx * dx + dy * dy;
      if ((a[1] > y) !== (b[1] > y) && x < a[0] + ((y - a[1]) * ex) / ey) inn = !inn;
    }
    return inn ? Math.sqrt(d2) : -Math.sqrt(d2);
  };
  const G = 14;
  let step = Math.max(x1 - x0, y1 - y0) / G, bx = (x0 + x1) / 2, by = (y0 + y1) / 2, best = -Infinity;
  for (let i = 0; i <= G; i++) for (let j = 0; j <= G; j++) { const x = x0 + (i * (x1 - x0)) / G, y = y0 + (j * (y1 - y0)) / G, d = depth(x, y); if (d > best) { best = d; bx = x; by = y; } }
  for (let it = 0; it < 12; it++) {
    step /= 2;
    for (let moved = true, guard = 0; moved && guard < 6; guard++) {
      moved = false;
      for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4, x = bx + step * Math.cos(a), y = by + step * Math.sin(a), d = depth(x, y); if (d > best) { best = d; bx = x; by = y; moved = true; } }
    }
  }
  return Math.max(0, best);
}

/**
 * A footprint in a frame. `toe` lists the frame's vertices from the big toe to the little toe: counter-clockwise for a
 * left foot, clockwise for a right one (drawn as the mirror image of a left one). The foot is drawn in its own
 * coordinates (the frame's middle at the origin, heel -> toes upward), so it is the same foot however the frame lies.
 */
function footIn(spec, extra) {
  const { poly, toe, heel } = spec, n = poly.length;
  const c0 = centroid(poly), left = (toe[1] - toe[0] + n) % n === 1;
  const heelAt = heel.length > 1 ? lerp(poly[heel[0]], poly[heel[1]], 0.5) : poly[heel[0]];
  const up = unit(sub(lerp(poly[toe[0]], poly[toe[toe.length - 1]], 0.5), heelAt)), right = left ? [up[1], -up[0]] : [-up[1], up[0]];
  let loc = poly.map((p) => [dot(sub(p, c0), right), dot(sub(p, c0), up)]), ix = (i) => i;
  if (!left) { loc = loc.reverse(); ix = (i) => n - 1 - i; }
  let hl = heel.map(ix);
  if (hl.length > 1 && (hl[1] - hl[0] + n) % n !== 1) hl = [hl[1], hl[0]];
  const f = leftFoot(loc, toe.map(ix), hl, { ...(spec.o || {}), ...extra });
  if (!f) return null;
  const back = (pts) => pts.map((p) => add(c0, add(mul(right, p[0]), mul(up, p[1]))));
  return { polys: [back(f.sole), ...f.toes.map(back)], area: f.area, info: { left, ...f.info } };
}

// ---------------------------------------------------------------------------------------------------------------
// The frames: where the feet go in each group. Everything here is in local coordinates.
// ---------------------------------------------------------------------------------------------------------------

/** A reduced basis of the lattice, in tile sizes: [a, b] with |a| <= |b| and the angle between them as near a right one as it gets. */
function reduced(group, ts) {
  let a = mul(group.e1, 1 / ts), b = mul(group.e2, 1 / ts);
  for (let it = 0; it < 50; it++) {
    if (dot(a, a) > dot(b, b)) [a, b] = [b, a];
    const k = Math.round(dot(a, b) / dot(a, a));
    if (!k) break;
    b = sub(b, mul(a, k));
  }
  return [a, b];
}
/** A direction no symmetry axis of a lattice is likely to be perpendicular to: it breaks ties the same way for a group and for its turned copy. */
const tieDir = (group) => unit([0.618 * group.e1[0] + group.e2[0], 0.618 * group.e1[1] + group.e2[1]]);

/** The entry of the list nearest to the point `to`; among equals, the one furthest along `tie`. */
function nearest(list, to, tie) {
  let best = null, bs = Infinity;
  for (const q of list) { const s = dist(q, to) - 1e-4 * dot(sub(q, to), tie); if (s < bs - 1e-9) { bs = s; best = q; } }
  return best;
}

/** The group's frame of reference: local coordinates and its symmetry elements in them. */
function localOf(group) {
  const ts = Math.sqrt(group.domainArea), O = group.center;
  const toL = (p) => [(p[0] - O[0]) / ts, (p[1] - O[1]) / ts], toW = (p) => [O[0] + ts * p[0], O[1] + ts * p[1]];
  let S = null;
  const sym = () => {
    if (!S) {
      const raw = symmetryElements(group, O[0], O[1], 1.5 * (len(group.e1) + len(group.e2)));
      S = {
        centers: raw.centers.map((q) => ({ p: toL([q.x, q.y]), order: q.order, onMirror: q.onMirror })),
        mirrors: raw.mirrors.map((m) => ({ p: toL([m.px, m.py]), u: [m.ux, m.uy] })),
        glides: raw.glides.map((m) => ({ p: toL([m.px, m.py]), u: [m.ux, m.uy] })),
      };
    }
    return S;
  };
  return { ts, toL, toW, sym, tie: tieDir(group), seat: group.presets && group.presets[0] ? toL(group.presets[0].seed) : null };
}
const footOn = (p, m) => add(m.p, mul(m.u, dot(sub(p, m.p), m.u)));

/** Without presets: a seed whose Dirichlet tile is the tile the page would open with (up to the group and its normaliser). */
function ruleSeed(group, L) {
  const S = L.sym(), tie = L.tie, c = [0, 0];
  const cen = (f) => S.centers.filter(f).map((q) => q.p);
  const neighbour = (p, list) => {                                     // a point of the list nearest to p (not p), toward the middle
    let dmin = Infinity;
    for (const q of list) { const d = dist(p, q); if (d > 1e-6 && d < dmin) dmin = d; }
    return nearest(list.filter((q) => { const d = dist(p, q); return d > 1e-6 && d < dmin * 1.0001; }), c, tie);
  };
  const mirrorFoot = (p) => {                                          // the foot of p on a nearest mirror
    const feet = S.mirrors.map((m) => footOn(p, m)), dmin = Math.min(...feet.map((f) => dist(p, f)));
    return nearest(feet.filter((f) => dist(p, f) < dmin * 1.0001 + 1e-9), c, tie);
  };
  switch (group.id) {
    case '**': {
      const feet = S.mirrors.map((m) => footOn(c, m)), f1 = nearest(feet, c, tie);
      return lerp(f1, nearest(feet.filter((f) => dist(f, f1) > 1e-6), c, tie), 0.5);
    }
    case 'xx': case '*x': return nearest(S.glides.map((m) => footOn(c, m)), c, tie);
    case '333': case '22x': { const all = cen(() => true), c1 = nearest(all, c, tie); return lerp(c1, neighbour(c1, all), 0.5); }
    case '442': { const all = cen((q) => q.order === 4), c1 = nearest(all, c, tie); return lerp(c1, neighbour(c1, all), 0.5); }
    case '632': { const c3 = nearest(cen((q) => q.order === 3), c, tie); return lerp(c3, neighbour(c3, cen((q) => q.order === 2)), 0.5); }
    case '22*': case '2*22': case '4*2': { const c1 = nearest(cen((q) => !q.onMirror), c, tie); return lerp(c1, mirrorFoot(c1), 0.5); }
    case '3*3': { const c1 = nearest(cen((q) => !q.onMirror), c, tie); return lerp(c1, mirrorFoot(c1), 0.65); }
    default: return c;                                                 // a kaleidoscope: any chamber (the seed is pushed off the mirrors)
  }
}

/**
 * The Dirichlet tile of a seed, cleaned (an edge shorter than a millionth of a tile is no edge):
 * { poly (counter-clockwise), mirror: [is edge i a mirror], len: [...], cones: [{ p, order }] }.
 */
function tileAt(group, L, seed, metric) {
  const dom = buildDomain(group, { seed: L.toW(seed), metric });
  const poly = [], mirror = [], lens = [];
  dom.edges.forEach((e, i) => { if (e.len / L.ts > 1e-6) { poly.push(L.toL(dom.poly[i])); mirror.push(e.kind === 'mirror'); } });
  poly.forEach((p, i) => lens.push(dist(p, poly[(i + 1) % poly.length])));
  return { poly, mirror, len: lens, cones: dom.conePoints.map((q) => ({ p: L.toL([q.x, q.y]), order: q.order })) };
}
const angleAt = (poly, i) => { const n = poly.length, a = sub(poly[(i - 1 + n) % n], poly[i]), b = sub(poly[(i + 1) % n], poly[i]); return Math.acos(clamp(dot(a, b) / (len(a) * len(b)), -1, 1)); };

/**
 * A foot in a rectangle (or a parallelogram): H0 -> H1 is the heel edge (outer corner, inner corner), T1 and T0 the
 * front corners above H1 and H0. The front recedes from the big toe to the little toe: the outer front corner is cut.
 */
function rectSpec(H0, H1, T1, T0, o = {}) {
  const w = dist(H0, H1), l = dist(H0, T0);
  const alpha = (o.recede ?? 1) * clamp(76 - 72 * w, 14, 50) * DEG;    // a narrow foot recedes more: its toes need the room
  const flat = 0.27;                                                   // the share of the front that stays level, for the big toe
  const drop = Math.min((1 - flat) * w * Math.tan(alpha), 0.45 * l) / l;
  // a broad foot is less waisted at the heel
  return { poly: [H0, H1, T1, lerp(T1, T0, flat), lerp(T0, H0, drop)], toe: [2, 3, 4], heel: [0, 1], o: { taper: clamp((l / w - 0.8) / 0.8, 0.25, 1), ...o } };
}

/**
 * A broad foot in a rectangle, the print of a paw: both front corners are cut (the inner one by ci, the outer one by
 * co along either side) and the toes go round the front in an arc, the big toe on the inner cut.
 */
function roofSpec(H0, H1, T1, T0, ci, co, o = {}) {
  const w = dist(H0, H1), l = dist(H0, T0);
  return { poly: [H0, H1, lerp(H1, T1, 1 - ci / l), lerp(T1, T0, ci / w), lerp(T1, T0, 1 - co / w), lerp(T0, H0, co / l)], toe: [2, 3, 4, 5], heel: [0, 1], o };
}

/**
 * A foot along the diagonal A -> C of the quadrilateral A B C D (counter-clockwise): the heel in the corner A, the big
 * toe in the corner C, the toes along C -> D. The corners B and D are cut by lines parallel to the diagonal, `cut`
 * inside them, so the sole has two sides that run along it.
 */
function bandSpec(A, B, C, D, cut, o) {
  const u = unit(sub(C, A)), nL = [-u[1], u[0]];
  const hB = -dot(sub(B, A), nL) - cut, hD = dot(sub(D, A), nL) - cut;
  let P = { pts: [A, B, C, D], lab: [0, 1, 2, 3] };
  P = clipLab(P, -nL[0], -nL[1], -dot(A, nL) + hB, 20);                // the side of B
  P = clipLab(P, nL[0], nL[1], dot(A, nL) + hD, 21);                   // the side of D
  const m = P.pts.length, ia = P.lab.indexOf(0), ic = P.lab.indexOf(2);
  return { poly: P.pts, toe: [ic, (ic + 1) % m], heel: [ia], o };
}

/** The foot specs of a group: [{ poly, toe, heel, o }] in local coordinates. */
function layout(group, L) {
  const tie = L.tie, id = group.id;

  if (id === 'o') {
    // one foot per cell, along the longer vector of a reduced basis: columns of feet, heel to toe
    const [, b] = reduced(group, L.ts);
    const c = L.seat || [0, 0];
    let ax = unit(b);
    if (dot(ax, tie) < 0) ax = mul(ax, -1);
    const u = [ax[1], -ax[0]], hl = len(b) / 2, hw = 1 / len(b) / 2;   // the cell's area is 1
    const P = (s, t) => add(c, add(mul(u, s * hw), mul(ax, t * hl)));
    return [rectSpec(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1))];
  }

  if (id === '2222') {
    // a brick between two lines of centres, one lattice period long; where it leaves the Dirichlet tile of its own
    // middle (the page's hexagon) its corners are cut, and the toes go over the roof that is left
    const [a, b] = reduced(group, L.ts);
    const cands = [[a, b], [b, a]].map(([u, w]) => ({ u, w, ratio: len(w) / (Math.abs(crs(u, w)) / len(w) / 2) }));
    const pick = cands.sort((p, q) => Math.abs(p.ratio - 2) - Math.abs(q.ratio - 2))[0];
    let u = pick.u, w = pick.w;                                        // the brick: u / 2 across, w along
    if (dot(w, tie) < 0) w = mul(w, -1);
    if (crs(w, u) > 0) u = mul(u, -1);                                 // u to the right of w
    const cs = L.sym().centers.map((q) => q.p);
    const c = L.seat || add(nearest(cs, [0, 0], tie), add(mul(u, 0.25), mul(w, 0.25)));
    const c1 = nearest(cs, c, tie);
    const k = Math.floor(crs(w, sub(c, c1)) / crs(w, mul(u, 0.5)) + 1e-9);   // c1 + k u / 2 + t w is the line of centres just left of c
    const base = add(c1, mul(u, 0.5 * k));
    const t0 = dot(sub(c, base), w) / dot(w, w) - 0.5;                 // the brick is centred on c along w
    const H0 = add(base, mul(w, t0)), H1 = add(H0, mul(u, 0.5)), T1 = add(H1, w), T0 = add(H0, w);
    let P = { pts: [H0, H1, T1, T0], lab: [0, 1, 2, 3] };
    const mid = centroid(P.pts), hex = tileAt(group, L, mid).poly;
    hex.forEach((p, i) => { P = clipLine(P, p, hex[(i + 1) % hex.length], mid, 10 + i); });
    const m = P.pts.length, ih = P.lab.indexOf(0), it = P.lab.indexOf(2);
    if (ih < 0 || it < 0) return [rectSpec(H0, H1, T1, T0)];
    // the big toe on the inner slope, the others across the top and down the outer slope
    const i0 = (it - 1 + m) % m, toe = [i0, it];
    for (let j = it; P.lab[j % m] !== 3 && toe.length < m; j++) toe.push((j + 1) % m);
    return [{ poly: P.pts, toe, heel: [ih, (ih + 1) % m], o: { toeStart: Math.max(0, dist(P.pts[i0], P.pts[it]) - 0.26) } }];
  }

  const p0 = group.presets && group.presets[0];
  const T = p0 ? tileAt(group, L, L.seat, p0.metric) : tileAt(group, L, ruleSeed(group, L));
  const poly = T.poly, n = poly.length;
  const P = (i) => poly[((i % n) + n) % n], ix = (i) => ((i % n) + n) % n;

  if (n === 4 && id !== '333') {
    // a rectangle: the foot along it, its inner side on a mirror when a long side is one
    let best = -1, bs = -Infinity;
    const longest = Math.max(...T.len);
    for (let k = 0; k < 4; k++) {
      if (T.len[k] > 0.999 * longest && T.len[ix(k + 1)] < 0.999 * longest) continue;       // a long side is no front
      let s = dot(unit(sub(P(k), P(k - 1))), tie);
      if (T.mirror[ix(k - 1)]) s += 10;
      if (id === '442' && !T.cones.some((q) => q.order === 4 && dist(q.p, P(k)) < 1e-6)) s -= 100;   // the big toe at a 4-fold centre
      if (s > bs) { bs = s; best = k; }
    }
    const H0 = P(best + 2), H1 = P(best + 3), T1 = P(best), T0 = P(best + 1);
    if (id === '*x') {
      // the strip is five times as long as it is wide: two feet in line, a long one and a short one
      const f = 0.57;
      return [rectSpec(H0, H1, lerp(H1, T1, f), lerp(H0, T0, f)), rectSpec(lerp(H0, T0, f), lerp(H1, T1, f), T1, T0)];
    }
    // *2222: the tile is nearly as broad as it is long, and each of its corners is a crossing of mirrors where four
    // alike corners meet. The print of a paw: a broad pad, unwaisted at the heel, the toes round its front in an arc
    if (id === '*2222') return [roofSpec(H0, H1, T1, T0, 0.15, 0.21, { taper: 0, gapSole: 0.02, notch: 0 })];
    // where the heel's inner corner is a crossing of two mirrors, four heels meet: they stay broader
    const crossing = T.mirror[ix(best - 1)] && T.mirror[ix(best + 2)];
    // where the front is a mirror, or the outer side of a broad foot is one, the cut corners of two feet meet across
    // it: the front recedes less
    const recede = T.mirror[ix(best)] ? 0.78 : T.mirror[ix(best + 1)] && T.len[ix(best)] > 0.6 ? 0.8 : 1;
    // where the inner side is a mirror, two arches face each other across it: each is a little shallower, and stays so
    const facing = T.mirror[ix(best - 1)];
    return [rectSpec(H0, H1, T1, T0, { ...(crossing ? { taper: 0.5 } : {}), recede, ...(facing ? { notch: 0.88, archKept: true } : {}) })];
  }

  if (id === '333') {
    // the rhombus: the heel in an acute corner, the big toe in the other, the toes along the edge that leaves it
    let best = -1, bs = -Infinity;
    for (let k = 0; k < 4; k++) if (angleAt(poly, k) < 80 * DEG) { const s = dot(unit(sub(P(k + 2), P(k))), tie); if (s > bs) { bs = s; best = k; } }
    return [bandSpec(P(best), P(best + 1), P(best + 2), P(best + 3), 0.09, { bare: 0.3 })];
  }

  if (n === 3) {
    const ang = [0, 1, 2].map((i) => angleAt(poly, i) / DEG);
    const wide = ang.indexOf(Math.max(...ang));
    // 632, 3*3: the obtuse triangle. One long foot along the long side: the heel in one thin corner, the big toe toward
    // the other, the toes up the far side
    if (ang[wide] > 100) return [{ poly, toe: [(wide + 2) % 3, wide], heel: [(wide + 1) % 3], o: { toeCap: 0.2, toeCapHard: 0.2, notch: 0.5, delta: 0.03, keepDelta: true, front: 'straight' } }];
    // *442, 4*2: a right isosceles triangle. The heel in a thin corner, the big toe in the right angle
    if (ang[wide] > 80 && Math.min(...ang) > 40) return [{ poly, toe: [wide, (wide + 1) % 3], heel: [(wide + 2) % 3] }];
    if (ang[wide] > 80) {
      // *632: the heel in the 30-degree corner, the big toe in the 60-degree one
      const thin = ang.indexOf(Math.min(...ang)), big = 3 - thin - wide;
      return [{ poly, toe: [big, wide], heel: [thin], o: { keepDelta: true } }];
    }
    // *333: the heel in one corner, the toes along the opposite side
    let best = 0, bs = -Infinity;
    for (let k = 0; k < 3; k++) { const s = dot(unit(sub(lerp(P(k + 1), P(k + 2), 0.5), P(k))), tie); if (s > bs) { bs = s; best = k; } }
    return [{ poly, toe: [(best + 1) % 3, (best + 2) % 3], heel: [best] }];
  }
  // anything else: one foot along the tile's longest diagonal (not reached by the 17 groups)
  let bi = 0, bj = 1, bd = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (dist(poly[i], poly[j]) > bd) { bd = dist(poly[i], poly[j]); bi = i; bj = j; }
  return [{ poly, toe: [bj, (bj + 1) % n], heel: [bi] }];
}

// ---------------------------------------------------------------------------------------------------------------
export function find(group) {
  const L = localOf(group);
  const specs = layout(group, L);
  const canWiden = specs.some((s) => !(s.o && s.o.keepDelta));
  const back = specs.map(() => 0);                                     // how far each sole is pushed back from its toes
  let polys = [], area = 0, feet = [], lean = 0, wider = 0;
  for (let round = 0; round < 16; round++) {
    polys = []; area = 0; feet = [];
    let fat = false;
    specs.forEach((s, i) => {
      const extra = { lean, gapSole: ((s.o && s.o.gapSole) || 0) + back[i] };
      if (wider && !(s.o && s.o.keepDelta)) extra.delta = ((s.o && s.o.delta) ?? clamp(K.deltaRel * 2 * inCircle(polyArea(s.poly) < 0 ? s.poly.slice().reverse() : s.poly).r, K.deltaMin, K.delta)) + wider;
      const f = footIn(s, extra);
      if (!f) return;
      polys.push(...f.polys); area += f.area; feet.push(f.info);
      // a sole that holds too large a disc is pushed back from its toes
      if (f.info.solid > K.solidMax && back[i] < K.solidBack) { back[i] += f.info.solid - K.solidMax + 0.008; fat = true; }
    });
    if (fat) continue;
    if (area <= K.coverMax) break;                                     // the tile's area is 1
    if (lean < 1.5) lean += 0.5; else if (canWiden && wider < K.coverWiden) wider += K.coverStep; else break;
  }
  return {
    shapes: polys.map((p) => ({ pts: p.map(L.toW) })),
    info: { feet, lean, wider, coverage: area, frames: specs.map((s) => ({ poly: s.poly.map(L.toW), toe: s.toe, heel: s.heel })) },
  };
}
