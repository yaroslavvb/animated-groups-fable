// dev/cands.mjs — the candidates of dev/lab.mjs, per group, in world coordinates (second run). Each entry:
// (hook, jhook) => [[name, spec], ...]. Sizes: r, gap, fil, dr, dg are in tile sizes (sqrt(domainArea)).
import { C632 } from './cands632.mjs';
const S3 = Math.sqrt(3);
const SX = Math.sqrt(0.48), S22s = Math.sqrt(0.52);
const t = (v, s) => +(v / s).toFixed(4);                       // world length -> tile sizes

/** The point at distance d from both sides of the corner V (neighbours U and W) of a chamber. */
export function inset(V, U, W, d) {
  const ux = U[0] - V[0], uy = U[1] - V[1], lu = Math.hypot(ux, uy), wx = W[0] - V[0], wy = W[1] - V[1], lw = Math.hypot(wx, wy);
  const ax = ux / lu, ay = uy / lu, bx = wx / lw, by = wy / lw, th = Math.acos(ax * bx + ay * by);
  const mx = ax + bx, my = ay + by, lm = Math.hypot(mx, my), k = d / Math.sin(th / 2);
  return [V[0] + (mx / lm) * k, V[1] + (my / lm) * k];
}
const lerp = (P, Q, f) => [P[0] + (Q[0] - P[0]) * f, P[1] + (Q[1] - P[1]) * f];

// the chambers
const P6 = [0, 0], P3 = [-0.5, -S3 / 6], P2 = [-0.25, -S3 / 4], S632 = Math.sqrt(S3 / 2 / 12);
const Q1 = [0, 0], Q2 = [0.5, S3 / 6], Q3 = [0.5, -S3 / 6], S333 = Math.sqrt(S3 / 2 / 6);

export const CANDS = {
  '22x': () => {
    const base = { B: [0.1262, 0.3107], th: 80.45, a: 0.702, phi: -63.48, b: 0.444, r: 0.207, gap: 0.12 };
    return [['r.207', base], ['r.19', { ...base, r: 0.19 }], ['r.18', { ...base, r: 0.18 }], ['r.19 a.75', { ...base, r: 0.19, a: 0.75 }], ['r.19 b.5', { ...base, r: 0.19, b: 0.5 }], ['r.18 a.75 b.5', { ...base, r: 0.18, a: 0.75, b: 0.5 }]];
  },
  // 442: J's in the square tile [0, 1/2]^2 (4-fold centres at (0,0) and (1/2,1/2), 2-fold at (1/2,0) and (0,1/2))
  '442J': (hook, jhook) => {
    const o = { gap: 0.12, fil: 0.14 }, s = 0.5;
    const J = (name, A, B, B2, C, r) => [name, jhook('442', A, B, B2, C, { ...o, r })];
    return [
      J('J a', [0.06, 0.1], [0.4, 0.1], [0.4, 0.3], [0.2, 0.3], 0.15),
      J('J b', [0.05, 0.11], [0.39, 0.11], [0.39, 0.33], [0.18, 0.33], 0.16),
      J('J c', [0.1, 0.06], [0.42, 0.06], [0.42, 0.28], [0.22, 0.28], 0.15),
      J('J d', [0.08, 0.25], [0.08, -0.15], [0.3, -0.15], [0.3, 0.05], 0.15),
      J('J e', [0.06, 0.12], [0.44, 0.12], [0.44, 0.36], [0.25, 0.36], 0.17),
    ].map(([n, sp]) => [n, sp]);
  },
  '442': (hook, jhook) => {
    const base = { B: [0.0039, 0.3744], th: 352.55, a: 0.8, phi: -73.89, b: 0.458, r: 0.211, gap: 0.12 };
    if (jhook) return [...CANDS['442J'](hook, jhook), ['r.211', base], ['r.2 fil.15 rd.08', { ...base, r: 0.2, fil: 0.15, rd: 0.08 }]];
    return [['r.211', base], ['r.2', { ...base, r: 0.2 }], ['r.19', { ...base, r: 0.19 }], ['r.19 a.85', { ...base, r: 0.19, a: 0.85 }], ['r.19 b.5', { ...base, r: 0.19, b: 0.5 }],
      ['r.2 fil.15', { ...base, r: 0.2, fil: 0.15 }], ['r.2 fil.25', { ...base, r: 0.2, fil: 0.25 }], ['r.2 fil.15 rd.08', { ...base, r: 0.2, fil: 0.15, rd: 0.08 }]];
  },
  '*x': (hook, jhook) => [
    ['J+dot 1.1', jhook('*x', [0.05, 0.075], [1.45, 0.075], [1.45, 0.225], [0.35, 0.225], { r: t(0.05, SX), gap: t(0.05, SX), fil: t(0.075, SX), dr: t(0.05, SX), dg: t(0.145, SX) })],
  ],
  '22*': (hook) => [
    ['L even .22', hook('22*', [0.0, 0.553], [0.975, 0.553], [0.975, 0.74], { r: t(0.11, S22s), gap: 0.12, fil: t(0.06, S22s) })],
    ['L even .23', hook('22*', [0.02, 0.558], [0.975, 0.558], [0.975, 0.735], { r: t(0.115, S22s), gap: 0.12, fil: t(0.06, S22s) })],
  ],
  '*632': (hook, jhook) => C632(hook, jhook),
  // *442: the chamber K1 (0,0) 45 deg, K2 (0,1/2) 90 deg, K3 (1/2,1/2) 45 deg; a C: K3 -> K1 -> K2 -> a foot toward K3
  '*442': (hook, jhook) => {
    const K1 = [0, 0], K2 = [0, 0.5], K3 = [0.5, 0.5], o = { gap: 0.12, rd: 0.03, fil: 0.03 };
    const C = (name, f, r, d, ex = {}, dA = d) => [name, jhook('*442', inset(K3, K1, K2, dA), inset(K1, K2, K3, d), inset(K2, K1, K3, d), lerp(inset(K2, K1, K3, d), inset(K3, K1, K2, d), f), { ...o, r, ...ex })];
    return [
      C('C .4 r.17', 0.4, 0.17, 0.03),
      C('C .4 r.2', 0.4, 0.2, 0.03),
      C('C .5 r.17', 0.5, 0.17, 0.03),
      C('C .4 r.2 g.1', 0.4, 0.2, 0.03, { gap: 0.1 }),
      C('C .3 r.22 g.1', 0.3, 0.22, 0.03, { gap: 0.1 }),
    ];
  },
  // *632: the chamber P6 (30 deg, the 6-fold centre), P3 (60), P2 (90)
  '*632 first': (hook) => {
    const d = 0.022, o = { r: 0.3, gap: 0.12, rd: 0.03, fil: 0.03 };
    return [
      ['bend P3', hook('*632', inset(P6, P3, P2, d), inset(P3, P6, P2, d), inset(P2, P3, P6, d), o)],
      ['bend P2', hook('*632', inset(P6, P3, P2, d), inset(P2, P3, P6, d), inset(P3, P6, P2, d), o)],
      ['bend P6', hook('*632', inset(P3, P6, P2, d), inset(P6, P3, P2, d), inset(P2, P3, P6, d), o)],
      ['bend P2 r.26', hook('*632', inset(P6, P3, P2, d), inset(P2, P3, P6, d), inset(P3, P6, P2, d), { ...o, r: 0.26 })],
    ];
  },
  // *333: the equilateral chamber Q1, Q2, Q3 (all 3-fold, 60 deg)
  '*333': (hook, jhook) => {
    const d = 0.03, o = { r: 0.3, gap: 0.12, rd: 0.03, fil: 0.03 };
    return [
      ['V taper', hook('*333', inset(Q2, Q1, Q3, d), inset(Q1, Q2, Q3, d), inset(Q3, Q1, Q2, d), { ...o, rh: 0.14, hb: 0.8 })],
      ['C 0.35', jhook('*333', inset(Q2, Q1, Q3, d), inset(Q1, Q2, Q3, d), inset(Q3, Q1, Q2, d), lerp(inset(Q3, Q1, Q2, d), inset(Q2, Q1, Q3, d), 0.35), { ...o, r: 0.22 })],
      ['C 0.5', jhook('*333', inset(Q2, Q1, Q3, d), inset(Q1, Q2, Q3, d), inset(Q3, Q1, Q2, d), lerp(inset(Q3, Q1, Q2, d), inset(Q2, Q1, Q3, d), 0.5), { ...o, r: 0.2 })],
      ['C 0.3 r.2', jhook('*333', inset(Q2, Q1, Q3, d), inset(Q1, Q2, Q3, d), inset(Q3, Q1, Q2, d), lerp(inset(Q3, Q1, Q2, d), inset(Q2, Q1, Q3, d), 0.3), { ...o, r: 0.2 })],
      ['C 0.2 r.22', jhook('*333', inset(Q2, Q1, Q3, d), inset(Q1, Q2, Q3, d), inset(Q3, Q1, Q2, d), lerp(inset(Q3, Q1, Q2, d), inset(Q2, Q1, Q3, d), 0.2), { ...o, r: 0.22 })],
      ['C 0.3 r.2 tail', jhook('*333', lerp(inset(Q1, Q2, Q3, d), inset(Q2, Q1, Q3, d), 0.8), inset(Q1, Q2, Q3, d), inset(Q3, Q1, Q2, d), lerp(inset(Q3, Q1, Q2, d), inset(Q2, Q1, Q3, d), 0.35), { ...o, r: 0.21 })],
    ];
  },
};
