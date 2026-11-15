// dev/patterns/designs/stress/design.js — NOT a candidate for the selector: a motif made to strain the machinery of the
// shape prints (src/shapes.js, src/sdf.js, the renderer's third print mode, the plane's canvas path), for the glue's
// proof of 13 Nov 2026 (notes/patterns-foundation.md). About 2000 vertices, of which every kind a design may have:
//   * the body: a lopsided cogwheel (fine teeth: 29 to a turn) with a NEEDLE at its back, a spike 0.04 rad wide;
//   * a round hole on the axis with an ISLAND in it (a five-pointed star: sharp corners both ways);
//   * a SLIT along the axis, 0.03 of the motif's radius wide: a few texels of the texture, the thinnest thing it holds;
//   * triangular holes beside the axis (the smallest polygon there is).
// In the ten groups with mirrors the motif sits ON a mirror line and is symmetric in it, exactly: its two copies there
// coincide (the half above the axis is computed, the half below is its mirror image, point for point). In the other
// seven it sits at the roomiest generic place and is chiral (one triangle, a skewed cog, the slit turned).
// It keeps the rules of dev/patterns/kit.js: a copy lies in the disc of radius rho round its own image of the place,
// and rho is under half the distance to the nearest other image, less the gap.

import { elementsNear, symmetryElements } from '../../../../src/groups.js';

export const meta = { key: 'stress', label: 'Stress test', hint: 'a cogwheel with a needle, holes, an island and a slit: 2000 vertices that strain the machinery' };

const TAU = 2 * Math.PI;
const len = (p) => Math.hypot(p[0], p[1]);

/** The distance from the point to its nearest image under the group that is another point; and how many elements fix it. */
function room(group, x, y) {
  const tiny = 1e-7 * Math.sqrt(group.domainArea);
  let D = Infinity, fix = 0;
  for (const g of elementsNear(group, x, y, 1.01 * Math.max(len(group.e1), len(group.e2)), x, y)) {
    const d = Math.hypot(g.a * x + g.b * y + g.tx - x, g.c * x + g.d * y + g.ty - y);
    if (d <= tiny) fix++; else if (d < D) D = d;
  }
  return { D, fix };
}

/** Where the motif sits: { x, y, ux, uy (its axis), D, onMirror }. On a mirror where the group has one. */
function place(group) {
  const L = len(group.e1) + len(group.e2), sym = symmetryElements(group, group.center[0], group.center[1], 1.2 * L);
  let best = null;
  for (const m of sym.mirrors.slice(0, 6)) {
    for (let k = -40; k <= 40; k++) {
      const x = m.px + (k + 0.37) * 0.015 * L * m.ux, y = m.py + (k + 0.37) * 0.015 * L * m.uy, r = room(group, x, y);
      if (r.fix !== 2) continue;                                          // (a rotation centre on the mirror: more than the one reflection)
      if (!best || r.D > best.D * (1 + 1e-9)) best = { x, y, ux: m.ux, uy: m.uy, D: r.D, onMirror: true };
    }
  }
  if (best) return best;
  for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) {
    const a = (i + 0.31) / 24 - 0.5, b = (j + 0.57) / 24 - 0.5;
    const x = group.center[0] + a * group.e1[0] + b * group.e2[0], y = group.center[1] + a * group.e1[1] + b * group.e2[1], r = room(group, x, y);
    if (r.fix !== 1) continue;
    if (!best || r.D > best.D * (1 + 1e-9)) best = { x, y, D: r.D, onMirror: false };
  }
  const th = Math.atan2(group.e1[1], group.e1[0]) + 0.6;                  // (a direction that moves with the group)
  return { ...best, ux: Math.cos(th), uy: Math.sin(th) };
}

export function find(group) {
  const size = Math.sqrt(group.domainArea), P = place(group);
  const rho = 0.5 * (P.D - 0.03 * size) * 0.985;                          // copies keep 0.03 tile sizes and a little more
  if (!(rho > 0.05 * size)) throw new Error('stress: no room for the motif');
  const { x: px, y: py, ux, uy } = P, nx = -uy, ny = ux, sym = P.onMirror;
  // local frame: a along the axis, b across it
  const W = (a, b) => [px + rho * (a * ux + b * nx), py + rho * (a * uy + b * ny)];
  /** A closed polygon symmetric in the axis from its half above it: half = [[a, b], ...] from an axis point to an axis point. */
  const mirrored = (half) => {
    const out = half.map(([a, b]) => W(a, b));
    for (let i = half.length - 2; i >= 1; i--) out.push(W(half[i][0], -half[i][1]));
    return out;
  };
  const skew = sym ? 0 : 0.045;                                           // (the chiral motif: the cog leans)
  const R = (t) => 0.735 + 0.16 * Math.cos(t) + 0.055 * Math.cos(11 * t) + 0.028 * Math.cos(29 * t) + skew * Math.sin(2 * t) - (sym ? 0 : 0.035);
  const NEEDLE = 0.04, TIP = 0.975;                                       // the needle: from pi - NEEDLE (and pi + NEEDLE) to the tip on the axis
  const shapes = [];
  if (sym) {
    const N = 860, half = [];
    for (let i = 0; i <= N; i++) { const t = ((Math.PI - NEEDLE) * i) / N, r = R(t); half.push([r * Math.cos(t), i ? r * Math.sin(t) : 0]); }
    half.push([-TIP, 0]);
    shapes.push({ pts: mirrored(half) });
    // the round hole on the axis, and the star in it
    const hole = [];
    for (let i = 0; i <= 120; i++) { const t = (Math.PI * i) / 120; hole.push([0.3 + 0.22 * Math.cos(t), i && i < 120 ? 0.22 * Math.sin(t) : 0]); }
    shapes.push({ pts: mirrored(hole), hole: true });
    const star = [];
    for (let i = 0; i <= 5; i++) { const t = (Math.PI * i) / 5, r = i % 2 ? 0.055 : 0.13; star.push([0.3 + r * Math.cos(t), i && i < 5 ? r * Math.sin(t) : 0]); }
    shapes.push({ pts: mirrored(star) });
    // the slit on the axis, and a triangle either side of it
    shapes.push({ pts: [W(-0.4, 0.015), W(-0.14, 0.015), W(-0.14, -0.015), W(-0.4, -0.015)], hole: true });
    for (const s of [1, -1]) shapes.push({ pts: [W(-0.17, s * 0.2), W(0.05, s * 0.3), W(-0.11, s * 0.42)], hole: true });
  } else {
    const N = 1720, body = [];
    for (let i = 0; i < N; i++) {
      const t = -Math.PI + NEEDLE + ((TAU - 2 * NEEDLE) * i) / (N - 1), r = R(t);
      body.push(W(r * Math.cos(t), r * Math.sin(t)));
    }
    body.push(W(-TIP * 0.96, 0));
    shapes.push({ pts: body });
    const hole = [], star = [];
    for (let i = 0; i < 240; i++) { const t = (TAU * i) / 240; hole.push(W(0.3 + 0.22 * Math.cos(t), 0.22 * Math.sin(t))); }
    shapes.push({ pts: hole, hole: true });
    for (let i = 0; i < 10; i++) { const t = (TAU * i) / 10 + 0.3, r = i % 2 ? 0.055 : 0.13; star.push(W(0.3 + r * Math.cos(t), r * Math.sin(t))); }
    shapes.push({ pts: star });
    const c = Math.cos(0.5), s = Math.sin(0.5), T = (a, b) => W(-0.27 + c * a - s * b, -0.06 + s * a + c * b);
    shapes.push({ pts: [T(-0.13, 0.015), T(0.13, 0.015), T(0.13, -0.015), T(-0.13, -0.015)], hole: true });
    shapes.push({ pts: [W(-0.17, 0.2), W(0.05, 0.3), W(-0.11, 0.42)], hole: true });
  }
  return { shapes, info: { at: [px, py], rho, onMirror: sym, axis: [ux, uy] } };
}
