// dev/ad-cands.mjs — the art director's candidates (13 Nov 2026, the critique round), per group: () => [[name, spec], ...].
// Drawn in the WORLD coordinates of src/groups.js and turned into dimensionless path specs (lattice coordinates from the
// frame origin of design.js, half-widths in tile sizes), so a row moves with its group.
import { BY_ID } from '../../../../../src/groups.js';
import { frameOrigin } from '../design.js';
import { inset } from './cands.mjs';

const r4 = (v) => +v.toFixed(4);
/** World point [x, y, r?] -> [s, t, r?] in the frame of the group. */
export function lat(id, P) {
  const g = BY_ID[id], O = frameOrigin(g), { e1, e2 } = g, dd = e1[0] * e2[1] - e1[1] * e2[0], x = P[0] - O[0], y = P[1] - O[1];
  const st = [r4((x * e2[1] - y * e2[0]) / dd), r4((e1[0] * y - e1[1] * x) / dd)];
  return P.length > 2 && P[2] !== undefined ? [...st, P[2]] : st;
}
export const path = (id, pts, extra = {}) => ({ path: pts.map((p) => lat(id, p)), ...extra });
const lerp = (P, Q, f) => [P[0] + (Q[0] - P[0]) * f, P[1] + (Q[1] - P[1]) * f];
const W = (P, r) => [P[0], P[1], r];
const size = (id) => Math.sqrt(BY_ID[id].domainArea);
const S3 = Math.sqrt(3);

// the chambers (world)
const P6 = [0, 0], P3 = [-0.5, -S3 / 6], P2 = [-0.25, -S3 / 4];            // *632: 30, 60, 90 degrees
const Q1 = [0, 0], Q2 = [0.5, S3 / 6], Q3 = [0.5, -S3 / 6];                 // *333: all 60
const K1 = [0, 0], K2 = [0, 0.5], K3 = [0.5, 0.5];                          // *442: 45, 90, 45

/**
 * A curl in a triangular chamber (round 2): tail tip in corner V0, along side V0V1, bend at V1, along V1V2, bend at V2,
 * back along V2V0 for the share f, then a barb into the chamber toward I (share hk of the way) with a head of half-width
 * hr. d: the spine's inset from the sides (tile sizes); rt: the tail's half-width; fil: [at V1, at V2, at the barb].
 */
function curlIn(id, V0, V1, V2, I, { name, r, rt = r, rv = r, hr = r, f = 0.45, hk = 0.6, d = 0.085, fil = [0.04, 0.04, 0.12], gap = 0.12, rd = 0.03, tail = 1 }) {
  const s = size(id), D = d * s;
  const a = inset(V0, V1, V2, D * tail), b = inset(V1, V0, V2, D), c = inset(V2, V0, V1, D), e = lerp(c, inset(V0, V1, V2, D), f);
  return [name, path(id, [W(a, rt), W(b, rv), W(c, r), W(e, r), W(lerp(e, I, hk), hr)], { r, fil, gap, rd })];
}

/**
 * A "seven" in a triangular chamber (round 3): tail tip in V0, along V0V1, bend at V1, along V1V2, bend at V2, then a
 * head stroke diagonally toward the third side V2V0: to the point at the share hf from V2 along it, inset by hin tile
 * sizes; the head's half-width hr. The third side is lined by the head's bulge, not hugged.
 */
function seven(id, V0, V1, V2, { name, r, rt = r, rv = r, hr = r, hf = 0.5, hin = 0.3, d = 0.085, fil = [0.04, 0.1], gap = 0.12, rd = 0.03 }) {
  const s = size(id), D = d * s;
  const a = inset(V0, V1, V2, D), b = inset(V1, V0, V2, D), c = inset(V2, V0, V1, D);
  const m = lerp(V2, V0, hf), ux = V1[0] - m[0], uy = V1[1] - m[1];
  // the point of the third side at the share hf, moved inward (toward V1's side of the line) by hin tile sizes
  const L = Math.hypot(V0[0] - V2[0], V0[1] - V2[1]), nx = -(V0[1] - V2[1]) / L, ny = (V0[0] - V2[0]) / L, sg = Math.sign(nx * ux + ny * uy);
  const H = [m[0] + sg * nx * hin * s, m[1] + sg * ny * hin * s];
  return [name, path(id, [W(a, rt), W(b, rv), W(c, r), W(H, hr)], { r, fil, gap, rd })];
}

/**
 * A crook with a floating return (round 4): tail tip in V0, along V0V1, bend at V1, along V1V2, bend at V2, then a
 * return parallel to the third side V2V0 but `fin` tile sizes in from it (a white slot along that mirror), for the share
 * f of its length, ending in a head of half-width hr.
 */
function crook(id, V0, V1, V2, { name, r, rt = r, rv = r, rr = r, hr = r, f = 0.55, fin = 0.24, d = 0.085, fil = [0.04, 0.12, 0.1], gap = 0.12, rd = 0.03 }) {
  const s = size(id), D = d * s;
  const a = inset(V0, V1, V2, D), b = inset(V1, V0, V2, D), c0 = inset(V2, V0, V1, fin * s), e0 = inset(V0, V1, V2, fin * s);
  const c = inset(V2, V0, V1, D);
  // the return runs from the point of the line at fin from side 3 nearest the corner V2 toward V0
  const g = lerp(c0, e0, f);
  return [name, path(id, [W(a, rt), W(b, rv), W(c, rr), W(g, hr)], { r, fil, gap, rd })];
}

/**
 * The designer's C with a comma's character (round 5): tail tip in V0 (half-width rt), along V0V1 thickening to rv at
 * V1, along V1V2 (r), back along V2V0 for the share f, ending in a round head of half-width hr; the share hb of the
 * return before the head keeps r (the head swells over the rest).
 */
function cc(id, V0, V1, V2, { name, r, rt = r, rv = r, hr = r, f = 0.4, d = 0.085, dt = d, fil = [0.03, 0.03], gap = 0.12, rd = 0.03, hb = 0.5 }) {
  const s = size(id), D = d * s;
  const a = inset(V0, V1, V2, dt * s), b = inset(V1, V0, V2, D), c = inset(V2, V0, V1, D), e = lerp(c, inset(V0, V1, V2, D), f);
  const pts = [W(a, rt), W(lerp(a, b, 0.5), (rt + rv) / 2), W(b, rv), W(c, r)];
  if (hb > 0 && hb < 1) pts.push(W(lerp(c, e, hb), r));
  pts.push(W(e, hr));
  return [name, path(id, pts, { r, fil: [0.001, ...fil, 0.001].slice(0, pts.length - 2), gap, rd })];
}

import { SPEC } from '../design.js';
const vary = (id, list) => list.map(([name, ch]) => [name, { ...SPEC[id], ...ch }]);

export const CANDS = {
  // round 5: less trimming, fewer lumps (the current rows with a thinner stroke or rounder bends)
  '*632g': () => [
    cc('*632', P6, P3, P2, { name: 'cc r.15 rt.12 f.4 hr.21', r: 0.15, rt: 0.12, rv: 0.17, hr: 0.21, f: 0.4, gap: 0.09, rd: 0.02 }),
    cc('*632', P6, P3, P2, { name: 'cc r.14 rt.12 f.45 hr.2', r: 0.14, rt: 0.12, rv: 0.17, hr: 0.2, f: 0.45, gap: 0.09, rd: 0.02 }),
    cc('*632', P6, P3, P2, { name: 'cc r.15 rt.13 f.35 hr.22', r: 0.15, rt: 0.13, rv: 0.18, hr: 0.22, f: 0.35, gap: 0.09, rd: 0.02 }),
  ],
  '*442g': () => [
    cc('*442', K3, K1, K2, { name: 'cc r.16 rt.11 f.35 hr.24', r: 0.16, rt: 0.11, rv: 0.2, hr: 0.24, f: 0.35 }),
    cc('*442', K3, K1, K2, { name: 'cc r.17 rt.1 f.3 hr.25', r: 0.17, rt: 0.1, rv: 0.21, hr: 0.25, f: 0.3 }),
  ],
  'xx#h': () => {
    const J = (name, pts, r, fil, extra = {}) => [name, path('xx', pts, { r, fil, gap: 0.12, rd: 0.03, ...extra })];
    return [
      J('J5 foot.17 fil.28', [[0.27, 1.8, 0.14], [-0.21, 0.74, 0.2], [0.16, 0.54, 0.17]], 0.2, [0.28]),
      J('J5 foot.16 fil.3 r.21', [[0.27, 1.8, 0.14], [-0.21, 0.76, 0.21], [0.15, 0.56, 0.16]], 0.21, [0.3]),
      J('J5 foot.18 fil.26 short', [[0.27, 1.8, 0.14], [-0.21, 0.74, 0.2], [0.12, 0.56, 0.18]], 0.2, [0.26]),
    ];
  },
  '442#g': () => vary('442', [['plain', { plain: true }], ['plain r.18', { plain: true, r: 0.18 }], ['plain r.18 fil.2', { plain: true, r: 0.18, fil: 0.2 }]]),
  '22x#g': () => vary('22x', [['plain', { plain: true }], ['plain r.2', { plain: true, r: 0.2 }]]),
  '22*#g': () => vary('22*', [['plain', { plain: true }], ['plain r.17', { plain: true, r: 0.17 }]]),
  '442#f': () => vary('442', [['r.16', { r: 0.16 }], ['r.155', { r: 0.155 }], ['r.15', { r: 0.15 }], ['r.16 fil.2', { r: 0.16, fil: 0.2 }], ['r.16 rd.06', { r: 0.16, rd: 0.06 }]]),
  '22x#f': () => vary('22x', [['r.18', { r: 0.18 }], ['r.175', { r: 0.175 }], ['r.18 rd.06', { r: 0.18, rd: 0.06 }]]),
  '22*#f': () => vary('22*', [['r.15', { r: 0.15 }], ['r.145', { r: 0.145 }], ['r.15 rd.06', { r: 0.15, rd: 0.06 }]]),
  '2222#f': () => vary('2222', [['r.19', { r: 0.19 }], ['r.185', { r: 0.185 }]]),
  // round 4: *x as a J of two unequal arms (a fat shank with a pointed tail, a thinner return with a round head), and
  // 22* with longer interlocking J's
  '*x#e': () => {
    const s = size('*x');
    const J = (name, { rl, ru, Ls, Lr, gap = 0.1, x0 = 0.06, rt = rl * 0.55, hr = ru * 1.15 }) => {
      const gw = (gap / 2) * s, yl = gw + rl * s, yu = 0.3 - gw - ru * s, fc = (yu - yl) / 2 / s;
      return [name, path('*x', [W([x0 + Ls * s, yl], rt), W([x0 + Ls * s * 0.6, yl], rl), W([x0, yl], rl), W([x0, yu], ru), W([x0 + Lr * s, yu], hr)], { r: rl, fil: [0.001, fc, fc], gap, rd: 0.02 })];
    };
    return [
      J('J4 .08/.06 2.1/1.95', { rl: 0.08, ru: 0.06, Ls: 2.1, Lr: 1.95 }),
      J('J4 .085/.055 2.15/1.9', { rl: 0.085, ru: 0.055, Ls: 2.15, Lr: 1.9 }),
      J('J4 .08/.06 2.2/1.85', { rl: 0.08, ru: 0.06, Ls: 2.2, Lr: 1.85, x0: 0.04 }),
      J('J3 .08/.06 2.1/1.65', { rl: 0.08, ru: 0.06, Ls: 2.1, Lr: 1.65 }),
      J('J3 .085/.055 2.12/1.62', { rl: 0.085, ru: 0.055, Ls: 2.12, Lr: 1.62 }),
      J('J3 .08/.06 2.15/1.72 g.09', { rl: 0.08, ru: 0.06, Ls: 2.15, Lr: 1.72, gap: 0.09 }),
      J('J2 .075/.055 2.2/1.5', { rl: 0.075, ru: 0.055, Ls: 2.2, Lr: 1.5 }),
      J('J2 .08/.055 2.15/1.4', { rl: 0.08, ru: 0.055, Ls: 2.15, Lr: 1.4 }),
      J('J2 .075/.06 2.25/1.3', { rl: 0.075, ru: 0.06, Ls: 2.25, Lr: 1.3 }),
    ];
  },
  '22*e': () => {
    const c = 0.65;
    const J = (name, { y, x0, x1, yc, xr, r, rt = r, hr = r, fil = [0.12, 0.08] }) => [name, path('22*', [W([c + x0, y], rt), W([c + x1, y], r), W([c + x1, yc], r), W([c + xr, yc], hr)], { r, fil, gap: 0.12, rd: 0.03 })];
    return [
      J('S r.16 1.08', { y: -0.19, x0: -0.78, x1: 0.3, yc: 0.035, xr: 0.14, r: 0.16, rt: 0.12, hr: 0.17 }),
      J('S r.17 1.1', { y: -0.2, x0: -0.8, x1: 0.3, yc: 0.03, xr: 0.13, r: 0.17, rt: 0.12, hr: 0.18 }),
      J('S r.15 y.21', { y: -0.21, x0: -0.82, x1: 0.29, yc: 0.02, xr: 0.12, r: 0.15, rt: 0.11, hr: 0.17 }),
    ];
  },
  // round 3: the tuned ones
  'xx#d': () => {
    const J = (name, pts, r, fil, extra = {}) => [name, path('xx', pts, { r, fil, gap: 0.12, rd: 0.03, ...extra })];
    return [
      J('J1 r.2', [[0.25, 1.75, 0.14], [-0.2, 0.75, 0.2], [0.15, 0.55, 0.21]], 0.2, [0.22]),
      J('J1 r.2 long', [[0.27, 1.8, 0.14], [-0.21, 0.74, 0.2], [0.18, 0.52, 0.21]], 0.2, [0.22]),
      J('J1 r.21 foot', [[0.25, 1.75, 0.14], [-0.2, 0.75, 0.21], [0.2, 0.58, 0.22]], 0.21, [0.24]),
    ];
  },
  '*x#d': () => {
    const s = size('*x');
    const cane = (name, { yl, yu, r, x0 = 0.05, Ls, Lr, rt = r, hr = r, gap = 0.1 }) => [name, path('*x', [W([x0 + Ls * s, yl], rt), W([x0, yl], r), W([x0, yu], r), W([x0 + Lr * s, yu], hr)], { r, fil: [(yu - yl) / 2 / s, (yu - yl) / 2 / s], gap, rd: 0.02 })];
    return [
      cane('cane r.075 2.05/1.0', { yl: 0.075, yu: 0.225, r: 0.075, Ls: 2.05, Lr: 1.0, hr: 0.08 }),
      cane('cane r.08 2.05/1.1', { yl: 0.075, yu: 0.225, r: 0.08, Ls: 2.05, Lr: 1.1, hr: 0.085, rt: 0.065 }),
      cane('cane r.08 2.1/.9 g.09', { yl: 0.073, yu: 0.227, r: 0.08, Ls: 2.1, Lr: 0.9, hr: 0.085, gap: 0.09 }),
    ];
  },
  '22*d': () => {
    const s = size('22*'), c = 0.65;                          // round the 2-fold centre (0.65, 0): the hook lies in the default tile
    const J = (name, { y, x0, x1, yc, xr, r, rt = r, hr = r, fil = [0.12, 0.08] }) => [name, path('22*', [W([c + x0, y], rt), W([c + x1, y], r), W([c + x1, yc], r), W([c + xr, yc], hr)], { r, fil, gap: 0.12, rd: 0.03 })];
    return [
      J('S r.16', { y: -0.19, x0: -0.62, x1: 0.27, yc: 0.035, xr: 0.12, r: 0.16, rt: 0.13, hr: 0.17 }),
      J('S r.17 long', { y: -0.185, x0: -0.7, x1: 0.28, yc: 0.035, xr: 0.12, r: 0.17, rt: 0.13, hr: 0.18 }),
      J('S r.18', { y: -0.18, x0: -0.62, x1: 0.28, yc: 0.04, xr: 0.13, r: 0.18, rt: 0.14, hr: 0.19 }),
    ];
  },
  '*632f': () => [
    cc('*632', P6, P3, P2, { name: 'cc r.16 rt.13 f.45', r: 0.16, rt: 0.13, rv: 0.18, hr: 0.21, f: 0.45, gap: 0.09, rd: 0.02 }),
    cc('*632', P6, P3, P2, { name: 'cc r.15 rt.13 f.5', r: 0.15, rt: 0.13, rv: 0.18, hr: 0.21, f: 0.5, gap: 0.09, rd: 0.02 }),
  ],
  '*333f': () => [
    cc('*333', Q1, Q2, Q3, { name: 'cc r.2 rt.12 f.4', r: 0.2, rt: 0.12, rv: 0.22, hr: 0.25, f: 0.4 }),
    cc('*333', Q1, Q2, Q3, { name: 'cc r.21 rt.13 f.42', r: 0.21, rt: 0.13, rv: 0.22, hr: 0.26, f: 0.42 }),
  ],
  '*442f': () => [
    cc('*442', K3, K1, K2, { name: 'cc r.16 rt.1 f.4', r: 0.16, rt: 0.1, rv: 0.2, hr: 0.23, f: 0.4 }),
    cc('*442', K3, K1, K2, { name: 'cc r.17 rt.11 f.45', r: 0.17, rt: 0.11, rv: 0.2, hr: 0.23, f: 0.45 }),
  ],
  // *2222, chamber [0, 0.65] x [0, 0.5]: a G whose top arm curls down the right side (the tail), the opening on the
  // right side between it and the barb
  '*2222c': () => {
    const s = size('*2222'), X = 0.65, Y = 0.5;
    const G = (name, { r, d = 0.085, tailY, barbY, barbX, hr = r, rt = r, fil = [0.08, 0.08, 0.08, 0.08, 0.06] }) => {
      const D = d * s;
      return [name, path('*2222', [W([X - D, tailY * Y], rt), W([X - D, Y - D], r), W([D, Y - D], r), W([D, D], r), W([X - D, D], r), W([X - D, barbY * Y], r), W([barbX * X, barbY * Y], hr)], { r, fil, gap: 0.12, rd: 0.03 })];
    };
    return [
      G('G2 r.14 t.62 b.3', { r: 0.14, tailY: 0.62, barbY: 0.3, barbX: 0.55, hr: 0.17 }),
      G('G2 r.15 t.66 b.3', { r: 0.15, tailY: 0.66, barbY: 0.3, barbX: 0.5, hr: 0.18 }),
      G('G2 r.13 t.6 b.32', { r: 0.13, tailY: 0.6, barbY: 0.32, barbX: 0.45, hr: 0.18, rt: 0.11 }),
    ];
  },
  // *x, strip y in [0, 0.3], glide axis y = 0.15: a candy cane lying down (shank in one lane, crook, short return)
  '*x#c': () => {
    const s = size('*x');
    const cane = (name, { yl, yu, r, x0 = 0.05, Ls, Lr, rt = r, hr = r, gap = 0.1 }) => [name, path('*x', [W([x0 + Ls * s, yl], rt), W([x0, yl], r), W([x0, yu], r), W([x0 + Lr * s, yu], hr)], { r, fil: [(yu - yl) / 2 / s, (yu - yl) / 2 / s], gap, rd: 0.02 })];
    const stick = (name, { r, rt, Ls, hook, gap = 0.1 }) => [name, path('*x', [W([0.05 + Ls * s, 0.15], rt), W([0.05, 0.15], r), W([0.05 - 0.05, 0.15 + hook], r * 0.9)], { r, fil: [0.12], gap, rd: 0.02 })];
    return [
      cane('cane r.075 1.9/.8', { yl: 0.075, yu: 0.225, r: 0.075, Ls: 1.9, Lr: 0.8, hr: 0.08 }),
      cane('cane r.08 2.0/.7 taper', { yl: 0.075, yu: 0.225, r: 0.08, Ls: 2.0, Lr: 0.7, rt: 0.05, hr: 0.085 }),
      stick('stick r.13 taper', { r: 0.13, rt: 0.06, Ls: 1.9, hook: 0.09 }),
    ];
  },
  // 22*, strip y in [-0.4, 0.4] round the 2-fold centre (0, 0): a J in the lower lane whose crook rises toward the
  // centre, its half-turn hangs from above: the two crooks interlock (an S round each 2-fold centre)
  '22*c': () => {
    const s = size('22*');
    const J = (name, { y, x0, x1, yc, xr, r, rt = r, hr = r }) => [name, path('22*', [W([x0, y], rt), W([x1, y], r), W([x1, yc], r), W([xr, yc], hr)], { r, fil: [0.12, 0.08], gap: 0.12, rd: 0.03 })];
    return [
      J('S r.13', { y: -0.2, x0: -0.62, x1: 0.26, yc: 0.03, xr: 0.12, r: 0.13, hr: 0.14 }),
      J('S r.15 taper', { y: -0.19, x0: -0.66, x1: 0.27, yc: 0.04, xr: 0.13, r: 0.15, rt: 0.1, hr: 0.16 }),
      J('S r.14 long', { y: -0.2, x0: -0.75, x1: 0.28, yc: 0.02, xr: 0.1, r: 0.14, rt: 0.11, hr: 0.15 }),
    ];
  },
  // xx, glide axes x = 0, +-0.45, glide distance 1.7: a J (long stroke, round bend, a short arm turned back)
  'xx#c': () => {
    const J = (name, pts, r, fil, extra = {}) => [name, path('xx', pts, { r, fil, gap: 0.12, rd: 0.03, ...extra })];
    return [
      J('J1', [[0.25, 1.75, 0.13], [-0.2, 0.75, 0.19], [0.15, 0.55, 0.2]], 0.19, [0.22]),
      J('J2', [[0.28, 1.8, 0.12], [-0.22, 0.8, 0.19], [0.12, 0.62, 0.2], [0.2, 0.85, 0.2]], 0.19, [0.22, 0.12]),
      J('J3', [[0.3, 1.65, 0.13], [-0.25, 0.85, 0.2], [0.05, 0.45, 0.21]], 0.2, [0.25]),
    ];
  },
  '*632e': () => [
    cc('*632', P6, P3, P2, { name: 'cc r.17 hr.22 f.45', r: 0.17, rt: 0.1, rv: 0.19, hr: 0.22, f: 0.45, gap: 0.09, rd: 0.02 }),
    cc('*632', P6, P3, P2, { name: 'cc r.16 hr.24 f.4', r: 0.16, rt: 0.09, rv: 0.2, hr: 0.24, f: 0.4, gap: 0.09, rd: 0.02 }),
  ],
  '*333e': () => [
    cc('*333', Q1, Q2, Q3, { name: 'cc r.2 hr.25 f.3', r: 0.2, rt: 0.11, rv: 0.22, hr: 0.25, f: 0.3 }),
    cc('*333', Q1, Q2, Q3, { name: 'cc r.19 hr.26 f.35', r: 0.19, rt: 0.1, rv: 0.22, hr: 0.26, f: 0.35 }),
  ],
  '*442e': () => [
    cc('*442', K3, K1, K2, { name: 'cc r.17 hr.22 f.4', r: 0.17, rt: 0.1, rv: 0.19, hr: 0.22, f: 0.4 }),
    cc('*442', K3, K1, K2, { name: 'cc r.16 hr.24 f.35', r: 0.16, rt: 0.09, rv: 0.2, hr: 0.24, f: 0.35 }),
  ],
  '*632d': () => [
    crook('*632', P6, P3, P2, { name: 'crook r.17 fin.24 f.55', r: 0.17, rt: 0.14, hr: 0.2, f: 0.55, fin: 0.24, gap: 0.09 }),
    crook('*632', P6, P3, P2, { name: 'crook r.16 fin.28 f.6', r: 0.16, rt: 0.13, hr: 0.2, f: 0.6, fin: 0.28, gap: 0.09 }),
    crook('*632', P6, P2, P3, { name: 'crookx r.17 fin.24 f.55', r: 0.17, rt: 0.14, hr: 0.2, f: 0.55, fin: 0.24, gap: 0.09 }),
  ],
  '*333d': () => [
    crook('*333', Q1, Q2, Q3, { name: 'crook r.17 fin.24 f.55', r: 0.17, rt: 0.14, hr: 0.2, f: 0.55, fin: 0.24 }),
    crook('*333', Q1, Q2, Q3, { name: 'crook r.16 fin.28 f.6', r: 0.16, rt: 0.13, hr: 0.2, f: 0.6, fin: 0.28 }),
  ],
  '*442d': () => [
    crook('*442', K1, K3, K2, { name: 'crook r.17 fin.24 f.55', r: 0.17, rt: 0.14, hr: 0.2, f: 0.55, fin: 0.24 }),
    crook('*442', K1, K3, K2, { name: 'crook r.16 fin.28 f.6', r: 0.16, rt: 0.13, hr: 0.2, f: 0.6, fin: 0.28 }),
    crook('*442', K1, K2, K3, { name: 'crookx r.17 fin.24 f.55', r: 0.17, rt: 0.14, hr: 0.2, f: 0.55, fin: 0.24 }),
  ],
  '*632c': () => [
    seven('*632', P6, P3, P2, { name: '7 r.2 hf.5', r: 0.2, rt: 0.16, hr: 0.24, hf: 0.5, hin: 0.32, gap: 0.09 }),
    seven('*632', P6, P3, P2, { name: '7 r.2 hf.6', r: 0.2, rt: 0.16, hr: 0.26, hf: 0.6, hin: 0.3, gap: 0.09 }),
    seven('*632', P6, P2, P3, { name: '7x r.2 hf.5', r: 0.2, rt: 0.16, hr: 0.24, hf: 0.5, hin: 0.32, gap: 0.09 }),
    seven('*632', P6, P2, P3, { name: '7x r.22 hf.6', r: 0.22, rt: 0.16, hr: 0.26, hf: 0.6, hin: 0.3, gap: 0.09 }),
  ],
  '*333c': () => [
    seven('*333', Q1, Q2, Q3, { name: '7 r.2 hf.5', r: 0.2, rt: 0.16, hr: 0.24, hf: 0.5, hin: 0.32 }),
    seven('*333', Q1, Q2, Q3, { name: '7 r.22 hf.6', r: 0.22, rt: 0.16, hr: 0.26, hf: 0.6, hin: 0.3 }),
  ],
  '*442c': () => [
    seven('*442', K1, K3, K2, { name: '7 r.2 hf.5', r: 0.2, rt: 0.16, hr: 0.24, hf: 0.5, hin: 0.32 }),
    seven('*442', K1, K3, K2, { name: '7 r.22 hf.6', r: 0.22, rt: 0.16, hr: 0.26, hf: 0.6, hin: 0.3 }),
    seven('*442', K1, K2, K3, { name: '7x r.2 hf.5', r: 0.2, rt: 0.16, hr: 0.24, hf: 0.5, hin: 0.32 }),
  ],
  '*632b': () => {
    const I = [-S3 / 6, -S3 / 6];
    return [
      curlIn('*632', P6, P3, P2, I, { name: 'G6 r.15 f.45', r: 0.15, rt: 0.13, f: 0.45, hk: 0.55, hr: 0.2, gap: 0.09 }),
      curlIn('*632', P6, P3, P2, I, { name: 'G6 r.14 f.55', r: 0.14, rt: 0.12, f: 0.55, hk: 0.5, hr: 0.19, gap: 0.09 }),
      curlIn('*632', P6, P2, P3, I, { name: 'G6x r.15 f.6', r: 0.15, rt: 0.13, f: 0.6, hk: 0.5, hr: 0.2, gap: 0.09 }),
      curlIn('*632', P6, P3, P2, I, { name: 'G6 r.17 f.4 rv.2', r: 0.15, rv: 0.2, rt: 0.12, f: 0.4, hk: 0.6, hr: 0.21, gap: 0.09 }),
    ];
  },
  '*333b': () => {
    const I = [1 / 3, 0];
    return [
      curlIn('*333', Q1, Q2, Q3, I, { name: 'G3 r.15 f.45', r: 0.15, rt: 0.13, f: 0.45, hk: 0.55, hr: 0.2 }),
      curlIn('*333', Q1, Q2, Q3, I, { name: 'G3 r.14 f.55', r: 0.14, rt: 0.12, f: 0.55, hk: 0.5, hr: 0.19 }),
      curlIn('*333', Q1, Q2, Q3, I, { name: 'G3 r.16 f.4 rv.2', r: 0.15, rv: 0.2, rt: 0.12, f: 0.4, hk: 0.6, hr: 0.21 }),
    ];
  },
  '*442b': () => {
    const I = [0.1464, 0.3536];
    return [
      curlIn('*442', K1, K3, K2, I, { name: 'G4 r.15 f.45', r: 0.15, rt: 0.13, f: 0.45, hk: 0.55, hr: 0.2 }),
      curlIn('*442', K1, K2, K3, I, { name: 'G4x r.15 f.55', r: 0.15, rt: 0.13, f: 0.55, hk: 0.5, hr: 0.2 }),
      curlIn('*442', K1, K3, K2, I, { name: 'G4 r.16 f.4 rv.2', r: 0.15, rv: 0.2, rt: 0.12, f: 0.4, hk: 0.6, hr: 0.21 }),
    ];
  },
  '*2222b': () => {
    const s = size('*2222'), d = 0.085 * s, X = 0.65, Y = 0.5;
    const G = (name, r, top, barbY, barbX, fil, hr = r) => [name, path('*2222', [W([top, Y - d], r * 0.9), W([d, Y - d], r), W([d, d], r), W([X - d, d], r), W([X - d, barbY], r), W([barbX, barbY], hr)], { r, fil, gap: 0.12, rd: 0.03 })];
    return [
      G('G r.15 b.18 t.42', 0.15, 0.42, 0.18, 0.42, [0.08, 0.08, 0.08, 0.06], 0.18),
      G('G r.16 b.2 t.38', 0.16, 0.38, 0.2, 0.38, [0.08, 0.08, 0.08, 0.06], 0.19),
      G('G r.15 b.16 t.46', 0.15, 0.46, 0.16, 0.36, [0.1, 0.08, 0.08, 0.06], 0.2),
    ];
  },
  '*632': () => {
    const s = size('*632'), d = 0.08 * s, I = [-S3 / 6, -S3 / 6];
    const tick = (name, r, f, fil, rt = r) => [name, path('*632', [W(inset(P6, P3, P2, d * 0.5), rt), W(inset(P2, P6, P3, d), r), W(lerp(inset(P2, P6, P3, d), inset(P3, P6, P2, d), f), r)], { r, fil, gap: 0.1, rd: 0.03 })];
    const curl = (name, r, f, fil, hr = r, hk = 0.55) => {
      const a = inset(P6, P3, P2, d * 0.5), b = inset(P2, P6, P3, d), c = inset(P3, P6, P2, d), e = lerp(c, inset(P6, P3, P2, d), f);
      return [name, path('*632', [W(a, r * 0.8), W(b, r), W(c, r), W(e, r), W(lerp(e, I, hk), hr)], { r, fil, gap: 0.1, rd: 0.03 })];
    };
    const back = (name, r, fil, hr = r, hk = 0.8) => {      // tail at P6 along the hypotenuse, P3, P2, then in toward the centre
      const a = inset(P6, P3, P2, d * 0.5), b = inset(P3, P6, P2, d), c = inset(P2, P6, P3, d);
      return [name, path('*632', [W(a, r * 0.8), W(b, r), W(c, r), W(lerp(c, I, hk), hr)], { r, fil, gap: 0.1, rd: 0.03 })];
    };
    return [
      tick('tick r.22 f.6', 0.22, 0.6, [0.12]),
      tick('tick r.26 f.55', 0.26, 0.55, [0.12]),
      curl('curl r.16', 0.16, 0.35, [0.04, 0.04, 0.1]),
      curl('curl r.18 head', 0.18, 0.3, [0.04, 0.04, 0.12], 0.22),
      back('back r.2', 0.2, [0.04, 0.06], 0.24),
      back('back r.22 hk.95', 0.22, [0.04, 0.08], 0.24, 0.95),
    ];
  },
  '*333': () => {
    const s = size('*333'), d = 0.08 * s, I = [1 / 3, 0];
    const tick = (name, r, f, fil) => [name, path('*333', [W(inset(Q1, Q2, Q3, d * 0.5), r), W(inset(Q2, Q1, Q3, d), r), W(lerp(inset(Q2, Q1, Q3, d), inset(Q3, Q1, Q2, d), f), r)], { r, fil, gap: 0.12, rd: 0.03 })];
    const curl = (name, r, f, fil, hr = r, hk = 0.55) => {
      const a = inset(Q1, Q2, Q3, d * 0.5), b = inset(Q2, Q1, Q3, d), c = inset(Q3, Q1, Q2, d), e = lerp(c, inset(Q1, Q2, Q3, d), f);
      return [name, path('*333', [W(a, r * 0.8), W(b, r), W(c, r), W(e, r), W(lerp(e, I, hk), hr)], { r, fil, gap: 0.12, rd: 0.03 })];
    };
    return [
      tick('tick r.26 f.6', 0.26, 0.6, [0.12]),
      tick('tick r.3 f.55', 0.3, 0.55, [0.12]),
      curl('curl r.15', 0.15, 0.35, [0.04, 0.04, 0.1]),
      curl('curl r.17 head', 0.17, 0.3, [0.04, 0.04, 0.12], 0.21),
    ];
  },
  '*442': () => {
    const s = size('*442'), d = 0.08 * s, I = [0.1464, 0.3536];
    const tick = (name, r, f, fil) => [name, path('*442', [W(inset(K1, K2, K3, d * 0.5), r), W(inset(K2, K1, K3, d), r), W(lerp(inset(K2, K1, K3, d), inset(K3, K1, K2, d), f), r)], { r, fil, gap: 0.12, rd: 0.03 })];
    const curl = (name, r, f, fil, hr = r, hk = 0.55) => {
      const a = inset(K1, K2, K3, d * 0.5), b = inset(K2, K1, K3, d), c = inset(K3, K1, K2, d), e = lerp(c, inset(K1, K2, K3, d), f);
      return [name, path('*442', [W(a, r * 0.8), W(b, r), W(c, r), W(e, r), W(lerp(e, I, hk), hr)], { r, fil, gap: 0.12, rd: 0.03 })];
    };
    const back = (name, r, fil, hr = r, hk = 0.8) => {
      const a = inset(K1, K2, K3, d * 0.5), b = inset(K3, K1, K2, d), c = inset(K2, K1, K3, d);
      return [name, path('*442', [W(a, r * 0.8), W(b, r), W(c, r), W(lerp(c, I, hk), hr)], { r, fil, gap: 0.12, rd: 0.03 })];
    };
    return [
      tick('tick r.24 f.6', 0.24, 0.6, [0.12]),
      tick('tick r.28 f.55', 0.28, 0.55, [0.12]),
      curl('curl r.15', 0.15, 0.35, [0.04, 0.04, 0.1]),
      curl('curl r.17 head', 0.17, 0.3, [0.04, 0.04, 0.12], 0.21),
      back('back r.2', 0.2, [0.04, 0.06], 0.24),
    ];
  },
  '*2222': () => {
    const s = size('*2222'), d = 0.08 * s, X = 0.65, Y = 0.5;
    const G = (name, r, top, barbY, barbX, fil, hr = r) => [name, path('*2222', [W([top, Y - d], r * 0.9), W([d, Y - d], r), W([d, d], r), W([X - d, d], r), W([X - d, barbY], r), W([barbX, barbY], hr)], { r, fil, gap: 0.12, rd: 0.03 })];
    return [
      G('G r.15', 0.15, 0.5, 0.25, 0.4, [0.08, 0.08, 0.08, 0.06]),
      G('G r.17 low', 0.17, 0.46, 0.22, 0.38, [0.08, 0.08, 0.08, 0.06], 0.19),
      G('G r.14 deep', 0.14, 0.52, 0.27, 0.3, [0.1, 0.1, 0.1, 0.06], 0.17),
    ];
  },
};
