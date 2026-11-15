// dev/patterns/designs/hook/design.js — "Hooks": the print whose mark is a bold hook, two strokes of different length
// joined at a rounded bend (a J, a tick, a walking stick). The long stroke gives the direction, the side the short one
// turns to gives the hand. See NOTES.md.
//
// How a hook is made (the same rule for all 17 groups):
//   1. A FRAME that moves with the group: origin O = the centre of the rotation of highest order among the coset
//      representatives (without a rotation: the point of the first mirror / glide axis nearest group.center; without
//      either: group.center), axes e1, e2. A place is O + s e1 + t e2.
//   2. The hook's SPINE: tail end A, bend B, head end C. B is a place of the frame; the long stroke leaves B at the angle
//      `th` from e1 and is `a` tile sizes long; the short one is turned by `phi` from it and is `b` tile sizes long
//      (tile size = sqrt(domainArea)). The corner at B is rounded with radius `fil`.
//   3. The stroke: every point within the half-width (`r` at the bend, `rt` at the tail end, `rh` at the head end) of
//      the spine ...
//   4. ... TRIMMED where it would come nearer than the channel `gap` to another copy: a point is dark when it is in the
//      stroke of this copy and this copy's stroke is at least `gap` deeper there than any other copy's. So copies never
//      touch, the channel between two fat neighbours is exactly `gap` wide, and next to a mirror the stroke ends in the
//      mirror's own wedge. The outline is traced from that field (marching squares on a grid along the long stroke).
// The table SPEC holds only dimensionless knobs per group id: lattice coordinates, angles from e1, lengths in tile sizes.

import { classify, elementsNear } from '../../../../src/groups.js';

export const meta = { key: 'hook', label: 'Hooks', hint: 'a bold hook per tile: the long stroke points, the short one shows the hand' };

const DEG = Math.PI / 180;

// B: [s, t] · th, phi: degrees · a, b, r, rt, rh, fil, gap: tile sizes · dots: [[s, t, radius]]
export const SPEC = {
  'o':     { B: [-0.3172, -0.1035], th: 46.02, a: 1.292, phi: -84.35, b: 0.458, r: 0.152, gap: 0.12 },
  '2222':  { B: [-0.0055, 0.2579], th: 37.95, a: 1.196, phi: -87.1, b: 0.558, r: 0.15, gap: 0.12 },
  '**':    { B: [0.1405, -0.3459], th: 90.46, a: 1.082, phi: -91.49, u: 0.3677, phi2: 90, b: 0.562, r: 0.121, fil: 0.18, gap: 0.12, dr: 0.114, dg: 0.12, dx: 0.019 },
  'xx':    { B: [-0.4494, 0.0774], th: 313.72, a: 0.981, phi: 81.23, b: 0.425, r: 0.178, gap: 0.12 },
  '*x':    { B: [-0.2826, 0.0627], th: 14.03, a: 1.606, phi: 162.18, b: 0.538, r: 0.111, fil: 0.3, gap: 0.12 },
  '333':   { B: [0.4873, -0.1472], th: 189.41, a: 0.813, phi: -119.27, b: 0.516, r: 0.178, gap: 0.12 },
  '22x':   { B: [0.3449, 0.3853], th: 187.92, a: 0.785, phi: -102.52, b: 0.527, r: 0.186, gap: 0.12 },
  '22*':   { B: [0.6155, 0.3233], th: 5.28, a: 1.314, phi: 144.74, b: 0.745, r: 0.127, fil: 0.3, gap: 0.12 },
  '*2222': { B: [0.0877, 0.114], th: 0, a: 0.82, phi: 90, u: 0.4771, phi2: -90, b: 0.3403, r: 0.14, fil: 0.12, gap: 0.12, dr: 0.15, dg: 0.13 },
  '2*22':  { B: [0.5204, -0.3571], th: 143.1301, a: 1.348, phi: -90, u: 0.4123, phi2: 90, b: 0.3531, r: 0.14, fil: 0.1, gap: 0.12 },
  '442':   { B: [0.1457, 0.2298], th: 99.04, a: 1.309, phi: -71.28, b: 0.637, r: 0.142, gap: 0.12 },
  '632':   { B: [0.3254, 0.2489], th: 207.36, a: 0.944, phi: 103.5, b: 0.551, r: 0.15, gap: 0.12 },
  '3*3':   { B: [0.2631, 0.0878], th: 0, a: 1.6109, phi: 59.9993, b: 0.56, r: 0.14, fil: 0.08, gap: 0.12 },
  '*333':  { B: [0.0684, 0], th: 30.0007, a: 1.2079, phi: -60.0015, b: 0.1909, r: 0.3, fil: 0.03, gap: 0.14, dr: 0.3, dg: 0.14, dx: 0.16 },
  '4*2':   { B: [0.2, 0.4], th: -45, a: 1.315, phi: 90, u: 0.48, phi2: -90, b: 0.36, r: 0.14, fil: 0.14, gap: 0.12 },
  '*442':  { B: [0.0318, 0.0768], th: 45, a: 1.5654, phi: 45, b: 1.0696, r: 0.29, fil: 0.03, gap: 0.15, rd: 0.04 },
  '*632':  { B: [-0.2903, -0.3334], th: 30.0007, a: 1.7119, phi: -60.0015, b: 0.8056, r: 0.3, fil: 0.03, gap: 0.12, rd: 0.03 },
};
export const DEFAULTS = { r: 0.17, gap: 0.12, fil: 0.2, grid: 0.0125, rd: 0.04 };

/** The origin of the frame (see the header). */
export function frameOrigin(group) {
  let best = null, axis = null;
  for (const g of group.reps) {
    const k = classify(g);
    if (k.type === 'rotation' && (!best || k.order > best.order)) best = k;
    if (!axis && (k.type === 'reflection' || k.type === 'glide')) axis = k;
  }
  if (best) return [best.center[0], best.center[1]];
  const c = group.center || [(group.e1[0] + group.e2[0]) / 2, (group.e1[1] + group.e2[1]) / 2];
  if (!axis) return [c[0], c[1]];
  const t = (c[0] - axis.point[0]) * axis.dir[0] + (c[1] - axis.point[1]) * axis.dir[1];
  return [axis.point[0] + t * axis.dir[0], axis.point[1] + t * axis.dir[1]];
}

/**
 * The spine of a hook as world points: tail end A, bend B, head end C; with the knob `u` the hook is a J: after the
 * bend the spine runs u tile sizes (turned by phi), bends again by phi2 at B2 and runs b tile sizes to C.
 */
export function spineOf(group, spec) {
  const O = frameOrigin(group), size = Math.sqrt(group.domainArea), { e1, e2 } = group;
  const B = [O[0] + spec.B[0] * e1[0] + spec.B[1] * e2[0], O[1] + spec.B[0] * e1[1] + spec.B[1] * e2[1]];
  const a0 = Math.atan2(e1[1], e1[0]) + spec.th * DEG, a1 = a0 + spec.phi * DEG;
  const A = [B[0] + spec.a * size * Math.cos(a0), B[1] + spec.a * size * Math.sin(a0)];
  if (spec.u) {
    const B2 = [B[0] + spec.u * size * Math.cos(a1), B[1] + spec.u * size * Math.sin(a1)], a2 = a1 + (spec.phi2 ?? spec.phi) * DEG;
    return { A, B, B2, C: [B2[0] + spec.b * size * Math.cos(a2), B2[1] + spec.b * size * Math.sin(a2)], O, size, path: null };
  }
  const C = [B[0] + spec.b * size * Math.cos(a1), B[1] + spec.b * size * Math.sin(a1)];
  return { A, B, C, O, size };
}

/** A stroke: points of its spine with a half-width at each. { X, Y, R, n, box (grown by the largest half-width) } */
function stroke(pts) {
  const n = pts.length, X = new Float64Array(n), Y = new Float64Array(n), R = new Float64Array(n);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, rm = 0;
  pts.forEach((p, i) => { X[i] = p[0]; Y[i] = p[1]; R[i] = p[2]; x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); rm = Math.max(rm, p[2]); });
  return { X, Y, R, n, rm, box: [x0 - rm, y0 - rm, x1 + rm, y1 + rm] };
}
function moved(S, g) {
  const pts = [];
  for (let i = 0; i < S.n; i++) pts.push([g.a * S.X[i] + g.b * S.Y[i] + g.tx, g.c * S.X[i] + g.d * S.Y[i] + g.ty, S.R[i]]);
  return stroke(pts);
}
/**
 * How deep the point is in the stroke: (half-width at the nearest point of the spine) - (distance to it); NEAR[0..1] is
 * left holding that point of the spine.
 */
const NEAR = [0, 0];
function depth(S, px, py) {
  const { X, Y, R, n } = S;
  if (n === 1) { NEAR[0] = X[0]; NEAR[1] = Y[0]; return R[0] - Math.hypot(px - X[0], py - Y[0]); }
  let best = -Infinity;
  for (let i = 0; i + 1 < n; i++) {
    const ax = X[i], ay = Y[i], bx = X[i + 1] - ax, by = Y[i + 1] - ay, L2 = bx * bx + by * by;
    let t = L2 > 0 ? ((px - ax) * bx + (py - ay) * by) / L2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const qx = ax + t * bx, qy = ay + t * by, dx = px - qx, dy = py - qy;
    const v = R[i] + t * (R[i + 1] - R[i]) - Math.sqrt(dx * dx + dy * dy);
    if (v > best) { best = v; NEAR[0] = qx; NEAR[1] = qy; }
  }
  return best;
}

/**
 * A polyline with its corners rounded: P = [[x, y, halfWidth], ...]; each inner corner becomes an arc of radius `fil`
 * (less where a leg is too short for it), sampled every 9 degrees, with the half-width of its corner point.
 */
function rounded(P, fil) {
  const out = [P[0]], n = P.length;
  for (let i = 1; i + 1 < n; i++) {
    const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1];
    const l0 = Math.hypot(p0[0] - p1[0], p0[1] - p1[1]), l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const u0 = [(p0[0] - p1[0]) / l0, (p0[1] - p1[1]) / l0], u2 = [(p2[0] - p1[0]) / l2, (p2[1] - p1[1]) / l2];
    const f = Math.acos(Math.max(-1, Math.min(1, u0[0] * u2[0] + u0[1] * u2[1])));               // the angle at p1
    if (!(fil > 1e-12) || f > Math.PI - 1e-6 || f < 1e-6) { out.push(p1); continue; }
    const tl = Math.min(fil / Math.tan(f / 2), (i === 1 ? 0.6 : 0.5) * l0, (i === n - 2 ? 0.8 : 0.5) * l2), rr = tl * Math.tan(f / 2);
    const T1 = [p1[0] + tl * u0[0], p1[1] + tl * u0[1]], T2 = [p1[0] + tl * u2[0], p1[1] + tl * u2[1]];
    const bis = [u0[0] + u2[0], u0[1] + u2[1]], bl = Math.hypot(bis[0], bis[1]), cd = rr / Math.sin(f / 2);
    const cx = p1[0] + (bis[0] / bl) * cd, cy = p1[1] + (bis[1] / bl) * cd;
    const a0 = Math.atan2(T1[1] - cy, T1[0] - cx);
    let da = Math.atan2(T2[1] - cy, T2[0] - cx) - a0;
    while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const m = Math.max(2, Math.ceil(Math.abs(da) / (9 * DEG)));
    for (let k = 0; k <= m; k++) { const t = a0 + (da * k) / m; out.push([cx + rr * Math.cos(t), cy + rr * Math.sin(t), p1[2]]); }
  }
  out.push(P[n - 1]);
  return out;
}

/** The strokes of one motif (world): the hook (tail A -> rounded bend at B -> head C) and its dots. */
export function strokesOf(group, spec) {
  const sp = spineOf(group, spec), { A, B, C, O, size } = sp;
  const r = (spec.r ?? DEFAULTS.r) * size, rt = (spec.rt ?? spec.r ?? DEFAULTS.r) * size, rh = (spec.rh ?? spec.r ?? DEFAULTS.r) * size;
  const fil = (spec.fil ?? DEFAULTS.fil) * size;
  // the tail: the half-width grows from rt at A to r over the share `ta` of the long stroke (power `tp`: 1 a wedge)
  const ta = Math.max(0, Math.min(1, spec.ta ?? 1)), tp = spec.tp ?? 1, P = [[A[0], A[1], rt]];
  if (rt !== r) {
    const k = tp === 1 ? 1 : 6;
    for (let i = 1; i <= k; i++) { const q = (ta * i) / k; if (q < 0.999) P.push([A[0] + (B[0] - A[0]) * q, A[1] + (B[1] - A[1]) * q, rt + (r - rt) * Math.pow(i / k, tp)]); }
  }
  P.push([B[0], B[1], r]);
  if (sp.B2) P.push([sp.B2[0], sp.B2[1], r]);
  // the head: the half-width goes from r to rh over the last share `hb` of the short stroke (all of it by default)
  const last = sp.B2 || B, hb = Math.max(0, Math.min(1, spec.hb ?? 1));
  if (rh !== r && hb < 0.999) P.push([C[0] + (last[0] - C[0]) * hb, C[1] + (last[1] - C[1]) * hb, r]);
  P.push([C[0], C[1], rh]);
  const out = [stroke(rounded(P, fil))];
  if (spec.dr > 0) {
    // the dot off the short stroke: its centre on the stroke's own line, the clear gap dg beyond the stroke's round end
    // (dx tile sizes to the left of that line), its radius dr
    const l = Math.hypot(C[0] - last[0], C[1] - last[1]), ux = (C[0] - last[0]) / l, uy = (C[1] - last[1]) / l;
    const dr = spec.dr * size, k = rh + (spec.dg ?? spec.gap ?? DEFAULTS.gap) * size + dr, dx = (spec.dx ?? 0) * size;
    out.push(stroke([[C[0] + k * ux - dx * uy, C[1] + k * uy + dx * ux, dr]]));
  }
  for (const d of spec.dots || []) {
    const p = [O[0] + d[0] * group.e1[0] + d[1] * group.e2[0], O[1] + d[0] * group.e1[1] + d[1] * group.e2[1]];
    if (d.length >= 6) {                                      // a dash: [s, t, radius, angle from e1 (degrees), length, radius at its far end]
      const an = Math.atan2(group.e1[1], group.e1[0]) + d[3] * DEG, L = d[4] * size;
      out.push(stroke([[p[0], p[1], d[2] * size], [p[0] + L * Math.cos(an), p[1] + L * Math.sin(an), d[5] * size]]));
    } else out.push(stroke([[p[0], p[1], d[2] * size]]));
  }
  return { strokes: out, A, B, C, O, size };
}

/** The other copies that can come near the motif: [stroke, ...] (every stroke of every copy but the identity's). */
function rivals(group, strokes, reach) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const S of strokes) { x0 = Math.min(x0, S.box[0]); y0 = Math.min(y0, S.box[1]); x1 = Math.max(x1, S.box[2]); y1 = Math.max(y1, S.box[3]); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2;
  const out = [];
  for (const g of elementsNear(group, cx, cy, 2 * R + reach, cx, cy)) {
    if (Math.abs(g.a - 1) < 1e-9 && Math.abs(g.b) < 1e-9 && Math.abs(g.c) < 1e-9 && Math.abs(g.d - 1) < 1e-9 && Math.hypot(g.tx, g.ty) < 1e-9 * (1 + R)) continue;
    for (const S of strokes) {
      const M = moved(S, g);
      if (M.box[0] > x1 + reach || M.box[2] < x0 - reach || M.box[1] > y1 + reach || M.box[3] < y0 - reach) continue;
      out.push(M);
    }
  }
  return { list: out, box: [x0, y0, x1, y1] };
}

/**
 * The field of the motif: > 0 inside. A point is dark when it is in one of the motif's strokes (depth > 0) and at least
 * gap / 2 inside that stroke's territory: for every other stroke (of any other copy, or another one of this motif)
 *     (depth_own - depth_other) / |u_own - u_other|  >=  gap / 2,
 * u being the unit vector to the point from the nearest point of each spine. The left side is the distance to the
 * border between the two strokes (where they are equally deep) to first order: exactly half the difference where the
 * strokes face each other, and still right at a stroke's end or along a mirror that the stroke meets at an angle (the
 * plain difference would widen the channel there). With `plain` the plain half difference is used: never too small.
 * Corners are rounded by rmin.
 */
function makeField(strokes, riv, gap, rd, plain) {
  const pad = gap + 1e-9, n = strokes.length, own = new Float64Array(n), ux = new Float64Array(n), uy = new Float64Array(n), f1 = new Float64Array(n), f2 = new Float64Array(n);
  // the rounded minimum: where two edges of the dark shape meet in a corner (a stroke cut by a channel, the wedge
  // between two channels) the corner is rounded with about the radius rd, and a sliver thinner than 0.6 rd is dropped
  const rmin = (a, b) => (a < rd && b < rd ? rd - Math.hypot(rd - a, rd - b) : (a < b ? a : b));
  const half = gap / 2;
  const f = (x, y) => {
    let top = -Infinity;
    for (let m = 0; m < n; m++) {
      const v = (own[m] = depth(strokes[m], x, y)); if (v > top) top = v;
      const dx = x - NEAR[0], dy = y - NEAR[1], l = Math.hypot(dx, dy) || 1; ux[m] = dx / l; uy[m] = dy / l;
      f1[m] = f2[m] = Infinity;
    }
    f.top = top;
    if (top <= -pad) return top;
    const against = (m, v, vx, vy) => {                        // stroke m against another one of depth v, direction (vx, vy)
      const D = plain ? 2 : Math.max(0.25, Math.hypot(ux[m] - vx, uy[m] - vy));
      const t = (own[m] - v) / D - half;
      if (t < f1[m]) { f2[m] = f1[m]; f1[m] = t; } else if (t < f2[m]) f2[m] = t;
    };
    for (const S of riv) {
      const b = S.box;
      if (x < b[0] - pad || x > b[2] + pad || y < b[1] - pad || y > b[3] + pad) continue;
      const v = depth(S, x, y), dx = x - NEAR[0], dy = y - NEAR[1], l = Math.hypot(dx, dy) || 1;
      for (let m = 0; m < n; m++) if (own[m] > -pad) against(m, v, dx / l, dy / l);
    }
    let F = -Infinity;
    for (let m = 0; m < n; m++) {
      for (let k = 0; k < n; k++) if (k !== m) against(m, own[k], ux[k], uy[k]);
      const v = rd > 0 ? rmin(rmin(f1[m], f2[m]), own[m]) : Math.min(own[m], f1[m]);
      if (v > F) F = v;
    }
    return F;
  };
  return f;
}

/** Marching squares: the closed curves F = 0 of a grid of values (nx by ny, row by row), in grid coordinates. */
function contours(F, nx, ny) {
  const pos = new Map(), link = new Map();
  const H = (i, j) => 2 * (j * nx + i), V = (i, j) => 2 * (j * nx + i) + 1;
  const put = (id, x, y) => { if (!pos.has(id)) pos.set(id, [x, y]); };
  const join = (p, q) => { (link.get(p) || link.set(p, []).get(p)).push(q); (link.get(q) || link.set(q, []).get(q)).push(p); };
  for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) {
    const fa = F[j * nx + i], fb = F[j * nx + i + 1], fc = F[(j + 1) * nx + i + 1], fd = F[(j + 1) * nx + i];
    const k = (fa > 0 ? 1 : 0) | (fb > 0 ? 2 : 0) | (fc > 0 ? 4 : 0) | (fd > 0 ? 8 : 0);
    if (k === 0 || k === 15) continue;
    const bot = H(i, j), top = H(i, j + 1), lef = V(i, j), rig = V(i + 1, j);
    if ((fa > 0) !== (fb > 0)) put(bot, i + fa / (fa - fb), j);
    if ((fd > 0) !== (fc > 0)) put(top, i + fd / (fd - fc), j + 1);
    if ((fa > 0) !== (fd > 0)) put(lef, i, j + fa / (fa - fd));
    if ((fb > 0) !== (fc > 0)) put(rig, i + 1, j + fb / (fb - fc));
    const mid = (fa + fb + fc + fd) / 4 > 0;
    switch (k) {
      case 1: case 14: join(lef, bot); break;
      case 2: case 13: join(bot, rig); break;
      case 3: case 12: join(lef, rig); break;
      case 4: case 11: join(rig, top); break;
      case 6: case 9: join(bot, top); break;
      case 7: case 8: join(lef, top); break;
      case 5: if (mid) { join(lef, top); join(bot, rig); } else { join(lef, bot); join(rig, top); } break;
      case 10: if (mid) { join(lef, bot); join(rig, top); } else { join(bot, rig); join(lef, top); } break;
    }
  }
  const loops = [], seen = new Set();
  for (const start of pos.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    let prev = -1, cur = start, ok = true;
    for (;;) {
      seen.add(cur); loop.push(pos.get(cur));
      const nb = link.get(cur);
      if (!nb || nb.length !== 2) { ok = false; break; }
      const nxt = nb[0] !== prev ? nb[0] : nb[1];
      prev = cur; cur = nxt;
      if (cur === start) break;
      if (seen.has(cur)) { ok = false; break; }
    }
    if (ok && loop.length >= 3) loops.push(loop);
  }
  return loops;
}

/** Douglas-Peucker on a closed polygon: no vertex of the original farther than tol from the result. */
function simplify(pts, tol) {
  const n = pts.length;
  if (n < 8) return pts;
  let far = 0, fd = -1;
  for (let i = 1; i < n; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > fd) { fd = d; far = i; } }
  const keep = new Uint8Array(n); keep[0] = keep[far] = 1;
  const rec = (i0, i1) => {                                   // indices along the ring, i0 < i1 (i1 may be n = the start again)
    const stack = [[i0, i1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      if (b - a < 2) continue;
      const P = pts[a], Q = pts[b % n], dx = Q[0] - P[0], dy = Q[1] - P[1], L = Math.hypot(dx, dy) || 1;
      let worst = -1, wi = -1;
      for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - P[0]) * dy - (pts[i][1] - P[1]) * dx) / L; if (d > worst) { worst = d; wi = i; } }
      if (worst > tol) { keep[wi] = 1; stack.push([a, wi], [wi, b]); }
    }
  };
  rec(0, far); rec(far, n);
  return pts.filter((_, i) => keep[i]);
}

const area2 = (p) => { let s = 0; for (let i = 0, n = p.length; i < n; i++) { const q = p[(i + 1) % n]; s += p[i][0] * q[1] - q[0] * p[i][1]; } return s / 2; };
function insidePoly(p, x, y) {
  let inn = false;
  for (let i = 0, n = p.length, j = n - 1; i < n; j = i++) {
    if ((p[i][1] > y) !== (p[j][1] > y) && x < p[i][0] + ((y - p[i][1]) * (p[j][0] - p[i][0])) / (p[j][1] - p[i][1])) inn = !inn;
  }
  return inn;
}

/** The motif of a spec: polygons traced from the trimmed field. */
export function motifOf(group, spec) {
  const { strokes, A, B, C, size } = strokesOf(group, spec);
  const gap = (spec.gap ?? DEFAULTS.gap) * size, h = (spec.grid ?? DEFAULTS.grid) * size;
  const riv = rivals(group, strokes, gap + 2 * h);
  // the first-order rule needs every spine to lie outside the channels: at least the gap from every other spine
  let apart = Infinity;
  for (const S of strokes) for (let k = 0; k < S.n; k++) for (const T of riv.list) {
    if (S.X[k] < T.box[0] - gap || S.X[k] > T.box[2] + gap || S.Y[k] < T.box[1] - gap || S.Y[k] > T.box[3] + gap) continue;
    const d = T.rm - depth(T, S.X[k], S.Y[k]);                // at least the distance to T's spine (exactly, where T has one half-width)
    if (d < apart) apart = d;
  }
  const plain = apart < gap * 1.02;
  const field = makeField(strokes, riv.list, gap, (spec.rd ?? DEFAULTS.rd) * size, plain);
  // the grid: along the long stroke (so its straight sides are straight), a margin of three cells around the strokes
  const la = Math.hypot(A[0] - B[0], A[1] - B[1]), ux = (A[0] - B[0]) / la, uy = (A[1] - B[1]) / la, vx = -uy, vy = ux;
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (const S of strokes) for (let i = 0; i < S.n; i++) {
    const u = S.X[i] * ux + S.Y[i] * uy, v = S.X[i] * vx + S.Y[i] * vy;
    u0 = Math.min(u0, u - S.R[i]); u1 = Math.max(u1, u + S.R[i]); v0 = Math.min(v0, v - S.R[i]); v1 = Math.max(v1, v + S.R[i]);
  }
  u0 -= 3 * h; v0 -= 3 * h;
  const nx = Math.ceil((u1 - u0) / h) + 4, ny = Math.ceil((v1 - v0) / h) + 4;
  const F = new Float64Array(nx * ny);
  let full = 0, kept = 0;                                     // grid points in the untrimmed strokes, and of those the dark ones
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const u = u0 + i * h, v = v0 + j * h;
    let f = field(u * ux + v * vx, u * uy + v * vy);
    if (f === 0) f = -1e-12;
    if (field.top > 0) { full++; if (f > 0) kept++; }
    F[j * nx + i] = f;
  }
  const tol = (spec.tol ?? 0.0006) * size, minArea = 0.0012 * size * size;
  let loops = contours(F, nx, ny).map((L) => L.map(([i, j]) => { const u = u0 + i * h, v = v0 + j * h; return [u * ux + v * vx, u * uy + v * vy]; }));
  loops = loops.filter((L) => Math.abs(area2(L)) > minArea).map((L) => simplify(L, tol));
  const shapes = loops.map((L, k) => {
    let depthIn = 0;
    for (let m = 0; m < loops.length; m++) if (m !== k && insidePoly(loops[m], L[0][0], L[0][1])) depthIn++;
    return { pts: L, hole: depthIn % 2 === 1 };
  });
  return { shapes, strokes, rivals: riv.list, gap, size, trimmed: full ? 1 - kept / full : 0, plain, apart: apart / size };
}

const memo = new WeakMap();
export function find(group) {
  let out = memo.get(group);
  if (out) return out;
  const spec = SPEC[group.id];
  if (!spec) throw new Error('hook: no spec for the group ' + group.id);
  const m = motifOf(group, spec);
  out = { shapes: m.shapes, info: { spec: group.id, verts: m.shapes.reduce((s, p) => s + p.pts.length, 0) } };
  memo.set(group, out);
  return out;
}
