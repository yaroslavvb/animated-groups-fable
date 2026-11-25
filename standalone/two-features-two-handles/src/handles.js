// handles.js — pure geometry and re-cut logic for "Two features, two handles" (3333, 2223, 2222).
// Ported from math-general.md (F1–F11), math-2222.md (§3.5, §11.9), orbifold-handles-hyperbolic-check.py (H0–H6),
// and engine-check.mjs (pillow2222, fourCone, stadium). Zero DOM dependencies.

import { geometry, mul, apply, inv, I3 } from '../../2026-11-15-classification-of-surfaces/src/sym/geom.js';
import { makeDomain } from '../../2026-11-15-classification-of-surfaces/src/sym/domains.js';
import { analyse } from '../../2026-11-15-classification-of-surfaces/src/sym/orbifold.js';
import { commaAt, moved } from './rigid-print.js';

const TAU = 2 * Math.PI;
const PI = Math.PI;
export const GH = geometry('H');
export const GE = geometry('E');

export const FAMILIES = {
  '3333': {
    k: '3333',
    kind: 'H',
    baseOrders: [3, 3, 3, 3],
    defaultM: '0123',
    defaultL: 2.0,
    defaultTw: 0.175,
    baseRange: [0.6, 5.0],
    maxRange: [0.4, 7.0],
  },
  '2223': {
    k: '2223',
    kind: 'H',
    baseOrders: [2, 2, 2, 3],
    defaultM: '3012',
    defaultL: 1.6,
    defaultTw: 0.1,
    baseRange: [0.6, 5.0],
    maxRange: [0.4, 7.0],
  },
  '2222': {
    k: '2222',
    kind: 'E',
    baseOrders: [2, 2, 2, 2],
    defaultM: '0123',
    defaultL: 1.1,
    defaultTw: 0.15,
    baseRange: [Math.SQRT1_2, Math.SQRT2],
    maxRange: [0.5, 2.0],
  },
};

export function defaultCommas(k) {
  if (k === '3333') {
    return [
      { which: 'big', rho: 0.38, size: 0.175, theta: 1.9 },
      { which: 'big', rho: 0.33, size: 0.13, theta: 2.6 },
      { which: 'small', rho: 0.29, size: 0.095, theta: 2.2 },
      null,
    ];
  }
  if (k === '2223') {
    return [
      { which: 'big', rho: 0.18, size: 0.09, theta: -PI / 2 },
      { which: 'small', rho: 0.15, size: 0.068, theta: -PI / 2 },
      null,
      { which: 'big', rho: 0.34, size: 0.155, theta: 1.9 },
    ];
  }
  return [
    { which: 'big', rho: 0.19, size: 0.095, theta: -PI / 2 },
    { which: 'big', rho: 0.16, size: 0.075, theta: -PI / 2 },
    { which: 'small', rho: 0.14, size: 0.058, theta: -PI / 2 },
    null,
  ];
}

// ---- Hyperbolic closed-form formulas (F1–F4, F7)
/** F4: distance from the cut of a cone point of order n whose partner has order m (exact 0 for 2, 2). */
export function hgt(n, m, L) {
  return Math.asinh((Math.cos(PI / m) + Math.cos(PI / n) * Math.cosh(L / 2)) / (Math.sin(PI / n) * Math.sinh(L / 2)));
}

/** F2: threshold pair distance below which RA*RB is not a translation. */
export function d0(n, m) {
  return Math.acosh((1 + Math.cos(PI / n) * Math.cos(PI / m)) / (Math.sin(PI / n) * Math.sin(PI / m)));
}

/** F3: distance between two cone points of orders n, m separated by a cut of length L. */
export function pairDistance(n, m, L) {
  return Math.acosh((Math.cosh(L / 2) + Math.cos(PI / n) * Math.cos(PI / m)) / (Math.sin(PI / n) * Math.sin(PI / m)));
}

/** F1 (stable form): cut length L from pair distance d > d0(n, m). */
export function pairLength(n, m, d) {
  const x1 = Math.sin(PI / n) * Math.sin(PI / m) * (Math.cosh(d) - Math.cosh(d0(n, m)));
  return 4 * Math.asinh(Math.sqrt(Math.max(0, x1) / 2));
}

/** F7: distance m from the tree edge A-B to the isolating cut, plus feet offsets dA, dB. */
export function treeToCut(p, q, L) {
  if (p === 2 && q === 2) return { m: 0, dA: 0, dB: 0, hA: 0, hB: 0 };
  const hA = hgt(p, q, L), hB = hgt(q, p, L);
  const dA = p > 2 ? Math.atanh(Math.cos(PI / p) / Math.tanh(hA)) : 0;
  const dB = q > 2 ? Math.atanh(Math.cos(PI / q) / Math.tanh(hB)) : 0;
  const m = Math.asinh(Math.sinh(hA) / Math.cosh(dA));
  return { m, dA, dB, hA, hB };
}

// ---- Complex arithmetic & 2x2 matrices in upper half-plane (SL(2, R) / PSL(2, C))
const cx = (re, im = 0) => [re, im];
const cAdd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const cSub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cMul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cDiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const cConj = (a) => [a[0], -a[1]];
const cAbs = (a) => Math.hypot(a[0], a[1]);
const cArg = (a) => Math.atan2(a[1], a[0]);
const cExpI = (ph) => [Math.cos(ph), Math.sin(ph)];
const cSqrt = (a) => { const r = cAbs(a), ph = cArg(a) / 2, sr = Math.sqrt(r); return [sr * Math.cos(ph), sr * Math.sin(ph)]; };

const mob = (M, z) => cDiv(cAdd(cMul(M[0], z), M[1]), cAdd(cMul(M[2], z), M[3]));
const mmul2 = (M, N) => [
  cAdd(cMul(M[0], N[0]), cMul(M[1], N[2])),
  cAdd(cMul(M[0], N[1]), cMul(M[1], N[3])),
  cAdd(cMul(M[2], N[0]), cMul(M[3], N[2])),
  cAdd(cMul(M[2], N[1]), cMul(M[3], N[3])),
];
const minv2 = (M) => {
  const det = cSub(cMul(M[0], M[3]), cMul(M[1], M[2]));
  return [cDiv(M[3], det), cDiv([-M[1][0], -M[1][1]], det), cDiv([-M[2][0], -M[2][1]], det), cDiv(M[0], det)];
};

function ptUHP(u, h) {
  const s = Math.exp(u);
  return [s * Math.tanh(h), s / Math.cosh(h)];
}

function rotUHP(z0, th) {
  const x = z0[0], y = z0[1], c = Math.cos(th / 2), s = Math.sin(th / 2);
  return [c - (x / y) * s, ((x * x + y * y) / y) * s, -s / y, c + (x / y) * s];
}

const mobR = (M, z) => mob([cx(M[0]), cx(M[1]), cx(M[2]), cx(M[3])], z);
const mmulR = (A, B) => [A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3], A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3]];

export function uhpToDisc(z) {
  const w = cDiv(cSub(z, cx(0, 1)), cAdd(z, cx(0, 1)));
  return w;
}

export function discToHyp(w) {
  const r2 = w[0] * w[0] + w[1] * w[1];
  const k = 1 / (1 - r2);
  return [2 * w[0] * k, 2 * w[1] * k, (1 + r2) * k];
}

export function uhpToHyp(z) {
  return discToHyp(uhpToDisc(z));
}

export function hypToDisc(p) {
  return [p[0] / (1 + p[2]), p[1] / (1 + p[2])];
}

export function discToUhp(w) {
  return cMul(cx(0, 1), cDiv(cAdd(cx(1), w), cSub(cx(1), w)));
}

/** Counter-clockwise angle at z0 from ray z0->z1 to ray z0->z2 in UHP. */
function angleUHP(z0, z1, z2) {
  const z0c = cConj(z0);
  const a = cDiv(cSub(z1, z0), cSub(z1, z0c));
  const b = cDiv(cSub(z2, z0), cSub(z2, z0c));
  return cArg(cDiv(b, a));
}

/** Reference normal form in upper half-plane (math-general.md §6.1, §9). */
export function fourConeUHP(orders, L, t) {
  const [p, q, r, s] = orders, l = L / 2;
  const h = [hgt(p, q, L), hgt(q, p, L), hgt(r, s, L), hgt(s, r, L)];
  const A = ptUHP(0, h[0]), B = ptUHP(l, h[1]), C = ptUHP(t, -h[2]), D = ptUHP(l + t, -h[3]);
  return {
    orders: [p, q, r, s], L, t, h, A, B, C, D,
    RA: rotUHP(A, TAU / p), RB: rotUHP(B, TAU / q), RC: rotUHP(C, TAU / r), RD: rotUHP(D, TAU / s),
  };
}

/** Pair frame transform (UHP -> centred Poincaré disc, H1): midpoint of A-B at 0, A on -x, B on +x. */
export function pairFrameUHP(A, B) {
  const phi = [cx(1), [-A[0], -A[1]], cx(1), [-A[0], A[1]]];
  const b = mob(phi, B);
  const absB = cAbs(b);
  const d = 2 * Math.atanh(absB);
  const thm = Math.tanh(d / 4);
  const m = [b[0] / absB * thm, b[1] / absB * thm];
  const psi = [cx(1), [-m[0], -m[1]], [-m[0], m[1]], cx(1)];
  const bPsi = mob(psi, b);
  const turn = cExpI(-cArg(bPsi));
  const M = mmul2([turn, cx(0), cx(0), cx(1)], mmul2(psi, phi));
  return { Cm: M, d };
}

/** Normal form of a cyclic quadruple [A', B', D', C'] in UHP (ported from H3). */
function normalFormUHP(quad, orders) {
  const [Ap, Bp, Dp, Cp] = quad;
  let T = mmulR(rotUHP(Ap, TAU / orders[0]), rotUHP(Bp, TAU / orders[1]));
  if (T[0] + T[3] < 0) T = T.map((v) => -v);
  const tr = T[0] + T[3];
  if (tr <= 2 + 1e-12) return null;
  if (Math.abs(T[2]) < 1e-7 * (Math.abs(T[0]) + Math.abs(T[3]))) {
    const c = Math.cos(0.7), s = Math.sin(0.7);
    const Q0 = [c, s, -s, c];
    const res = normalFormUHP(quad.map((z) => mobR(Q0, z)), orders);
    return res ? { ...res, N: mmulR(res.N, Q0) } : null;
  }
  const Lp = 2 * Math.acosh(tr / 2);
  const [a, , c, d] = T;
  const root = Math.sqrt(tr * tr - 4);
  const x1 = ((a - d) + root) / (2 * c), x2 = ((a - d) - root) / (2 * c);
  const [att, rep] = Math.abs(c * x1 + d) > 1 ? [x1, x2] : [x2, x1];
  const k = att > rep ? 1 : -1;
  let N = [k, -k * att, 1, -rep];
  const sdet = Math.sqrt(N[0] * N[3] - N[1] * N[2]);
  N = N.map((v) => v / sdet);
  const sc = 1 / cAbs(mobR(N, Ap));
  const sq = Math.sqrt(sc);
  N = mmulR([sq, 0, 0, 1 / sq], N);
  const imgs = [Ap, Bp, Cp, Dp].map((z) => mobR(N, z));
  const tp = Math.log(cAbs(imgs[2]));
  return { Lp, tp, N, imgs };
}

const PICKS = ['AB', 'DC', 'CA', 'BD', 'BC', 'DA'];

/** Re-cut hyperbolic four-cone state onto new pair indices (i, j) in 0..3. */
export function recutH(state, i, j) {
  const { perm, orders, L, tw, thetas } = state;
  if (i === j || i < 0 || i > 3 || j < 0 || j > 3) throw new Error('recutH: invalid pair');
  const t = tw * L;
  const g = fourConeUHP(orders, L, t);
  const slotA = perm.indexOf(i), slotB = perm.indexOf(j);
  const Lset = ['A', 'B', 'C', 'D'];
  const lA = Lset[slotA], lB = Lset[slotB];
  const pick = PICKS.find((pk) => (pk[0] === lA && pk[1] === lB) || (pk[1] === lA && pk[0] === lB));
  if (!pick) throw new Error('recutH: no matching pairing');

  const ordMap = { A: orders[0], B: orders[1], C: orders[2], D: orders[3] };
  const coneMap = { A: perm[0], B: perm[1], C: perm[2], D: perm[3] };
  let cyc, P, oldPart;
  const eMinusL = Math.exp(-L), ePlusL = Math.exp(L);
  if (pick === 'AB' || pick === 'DC' || pick === 'CA' || pick === 'BD') {
    cyc = 'ABDC';
    P = { A: g.A, B: g.B, C: g.C, D: g.D };
    oldPart = { A: g.B, B: g.A, C: g.D, D: g.C };
  } else if (t >= 0) {
    cyc = 'ABCD';
    P = { A: g.A, B: g.B, C: g.C, D: [eMinusL * g.D[0], eMinusL * g.D[1]] };
    oldPart = { A: g.B, B: g.A, C: g.D, D: [eMinusL * g.C[0], eMinusL * g.C[1]] };
  } else {
    cyc = 'ABCD';
    P = { A: g.A, B: g.B, C: [ePlusL * g.C[0], ePlusL * g.C[1]], D: g.D };
    oldPart = { A: g.B, B: g.A, C: [ePlusL * g.D[0], ePlusL * g.D[1]], D: g.C };
  }

  let idx0 = 0;
  for (let q = 0; q < 4; q++) if (cyc[q] === pick[0] && cyc[(q + 1) % 4] === pick[1]) { idx0 = q; break; }
  const cycLetters = [0, 1, 2, 3].map((q) => cyc[(idx0 + q) % 4]); // [A', B', D', C']
  const quad = cycLetters.map((ch) => P[ch]);
  const quadOrders = cycLetters.map((ch) => ordMap[ch]);
  const nf = normalFormUHP(quad, quadOrders);
  if (!nf) throw new Error('recutH: non-hyperbolic product');

  const { Lp, tp: tpRaw, N, imgs } = nf;
  // Reduce t' mod L' into [-L'/2, L'/2] by applying T'^kShift (z -> e^{-kShift*L'} z) to C', D'
  const kShift = Math.round(tpRaw / Lp);
  const tp = tpRaw - kShift * Lp;
  const twp = tp / Lp;
  const scFar = Math.exp(-kShift * Lp);

  // Order slots: [A', B', C', D'] -> cycLetters [0, 1, 3, 2]
  const newLetters = [cycLetters[0], cycLetters[1], cycLetters[3], cycLetters[2]];
  const newPerm = newLetters.map((ch) => coneMap[ch]);
  const newOrders = newLetters.map((ch) => ordMap[ch]);

  const posNew = [imgs[0], imgs[1], [scFar * imgs[2][0], scFar * imgs[2][1]], [scFar * imgs[3][0], scFar * imgs[3][1]]];
  const partnerNew = [posNew[1], posNew[0], posNew[3], posNew[2]];
  const oldPartnersInNew = [
    mobR(N, oldPart[newLetters[0]]),
    mobR(N, oldPart[newLetters[1]]),
    (() => { const w = mobR(N, oldPart[newLetters[2]]); return [scFar * w[0], scFar * w[1]]; })(),
    (() => { const w = mobR(N, oldPart[newLetters[3]]); return [scFar * w[0], scFar * w[1]]; })(),
  ];

  const newThetas = thetas.slice();
  for (let slot = 0; slot < 4; slot++) {
    const cone = newPerm[slot];
    const delta = angleUHP(posNew[slot], partnerNew[slot], oldPartnersInNew[slot]);
    newThetas[cone] = thetas[cone] + delta;
  }

  // Exact hyperboloid isometry Q taking old pair-centred frame -> new pair-centred frame
  const oldFrame = pairFrameUHP(g.A, g.B).Cm;
  const oldA_in_oldDisc = mob(oldFrame, P[newLetters[0]]);
  const oldB_in_oldDisc = mob(oldFrame, P[newLetters[1]]);
  const oldA_hyp = discToHyp(oldA_in_oldDisc);
  const oldB_hyp = discToHyp(oldB_in_oldDisc);

  const dNew = pairDistance(newOrders[0], newOrders[1], Lp);
  const newA_hyp = GH.polar(dNew / 2, PI);
  const newB_hyp = GH.polar(dNew / 2, 0);
  const Q = GH.fix(GH.fit(oldA_hyp, oldB_hyp, newA_hyp, newB_hyp, false), 1);

  return {
    k: state.k,
    perm: newPerm,
    orders: newOrders,
    L: Lp,
    tw: twp,
    thetas: newThetas,
    Q,
    invQ: GH.fix(inv(Q), 1),
  };
}

// ---- Hyperbolic tile & pattern model in pair-centred frame
const offH = (x, h, sgn) => [Math.sinh(x) * Math.cosh(h), sgn * Math.sinh(h), Math.cosh(x) * Math.cosh(h)];

export function fourConeCentered(orders, L, tw, { commas = null, thetas = null, perm = [0, 1, 2, 3], k = '3333' } = {}) {
  const [p, q, r, s] = orders;
  const c = L / 2, t = tw * L;
  const hA = hgt(p, q, L), hB = hgt(q, p, L), hC = hgt(r, s, L), hD = hgt(s, r, L);
  const A0 = offH(-c / 2, hA, -1), B0 = offH(c / 2, hB, -1);
  const C0 = offH(t - c / 2, hC, 1), D0 = offH(t + c / 2, hD, 1);
  const Ds0 = offH(t - 1.5 * c, hD, 1), Bs0 = offH(-1.5 * c, hB, -1);

  const mid0 = GH.mix(A0, B0, 0.5);
  const Pmat = GH.fix(inv(GH.frame(mid0, B0)), 1);
  const toPair = (v) => GH.norm(apply(Pmat, v));

  const verts = [A0, B0, D0, C0, Ds0, Bs0].map(toPair);
  const at = toPair(GH.mix(GH.mix(A0, D0, 0.5), GH.mix(B0, C0, 0.5), 0.47));
  const edges = [5, 4, 3, 2, 1, 0].map((to) => ({ to, rev: false }));
  const D = makeDomain(GH, verts, edges, { at });
  const A = analyse(D);

  // Where the cut (y = 0 in offH frame) crosses edge 4 (Ds0 -> Bs0) and edge 1 (B0 -> D0)
  const rawVerts = [A0, B0, D0, C0, Ds0, Bs0];
  const cross0 = (i) => {
    const u = rawVerts[i], v = rawVerts[(i + 1) % 6];
    const den = u[1] - v[1];
    const frac = Math.abs(den) < 1e-15 ? 0 : u[1] / den;
    return toPair(GH.norm([u[0] + frac * (v[0] - u[0]), 0, u[2] + frac * (v[2] - u[2])]));
  };
  const cutA = cross0(4), cutB = cross0(1);
  const home = [verts[0], verts[1], verts[3], verts[2]];
  const partners = [home[1], home[0], home[3], home[2]];

  const specs = commas || defaultCommas(k);
  const angles = thetas || specs.map((sp) => (sp ? sp.theta : 0));
  const shapes = [];
  for (let cone = 0; cone < 4; cone++) {
    const slot = perm.indexOf(cone), sp = specs[cone];
    if (!sp || slot < 0) continue;
    const th = angles[cone];
    const F = GH.frame(home[slot], partners[slot]);
    shapes.push(moved(commaAt(GH, GH.polar(sp.rho, th), sp.size, th + 1.3, sp.which, 2.0), F));
  }

  return { D, A, home, cutSeg: [cutA, cutB], treeSeg: [home[0], home[1]], Pmat, shapes };
}

/** Walk, legs, and highlighted cut data for the "Follow the tree" moment (pair-centred frame). */
export function followTreeData(state) {
  const { k, orders, L, tw } = state;
  if (k === '2222') {
    const ell = L, w = 1 / ell, s = 2 * ell * tw;
    const A = [-ell / 2, 0, 1], B = [ell / 2, 0, 1], C = [-ell / 2 + s, w, 1], D = [ell / 2 + s, w, 1];
    const fA = [-ell / 2, w / 2, 1], fB = [ell / 2, w / 2, 1], fC = [-ell / 2 + s, w / 2, 1], fD = [ell / 2 + s, w / 2, 1];
    return {
      kind: 'E',
      fwdSegs: Array.from({ length: 8 }, (_, i) => [[(-0.5 + i) * ell, 0, 1], [(0.5 + i) * ell, 0, 1]]),
      backSegs: Array.from({ length: 8 }, (_, i) => [[(-0.5 - i) * ell, 0, 1], [(-1.5 - i) * ell, 0, 1]]),
      cutPts: [[-6 * ell, w / 2, 1], [6 * ell, w / 2, 1]],
      ends: null,
      legs: [[A, fA], [B, fB], [C, fC], [D, fD]],
      feet: [fA, fC],
    };
  }
  const c = L / 2, t = tw * L;
  const hA = hgt(orders[0], orders[1], L), hB = hgt(orders[1], orders[0], L);
  const hC = hgt(orders[2], orders[3], L), hD = hgt(orders[3], orders[2], L);
  const A0 = offH(-c / 2, hA, -1), B0 = offH(c / 2, hB, -1);
  const C0 = offH(t - c / 2, hC, 1), D0 = offH(t + c / 2, hD, 1);
  const Pmat = GH.fix(inv(GH.frame(GH.mix(A0, B0, 0.5), B0)), 1);
  const toPair = (v) => GH.norm(apply(Pmat, v));

  const K = Math.min(14, Math.ceil(5 / L) + 1);
  // T^-k moves +k*L along cut (to the right, past B); T^k moves -k*L (to the left, past A)
  const fwdVerts = [toPair(A0), toPair(B0)];
  for (let m = 1; m <= K; m++) {
    fwdVerts.push(toPair(offH(-c / 2 + m * L, hA, -1)));
    fwdVerts.push(toPair(offH(c / 2 + m * L, hB, -1)));
  }
  const backVerts = [toPair(B0), toPair(A0)];
  for (let m = 1; m <= K; m++) {
    backVerts.push(toPair(offH(c / 2 - m * L, hB, -1)));
    backVerts.push(toPair(offH(-c / 2 - m * L, hA, -1)));
  }
  const toSegs = (vs) => { const out = []; for (let i = 0; i + 1 < vs.length; i++) out.push([vs[i], vs[i + 1]]); return out; };

  const cutPts = [];
  for (let i = -10; i <= 10; i++) cutPts.push(toPair(offH(0.75 * i, 0, 1)));
  const eBack = toPair(offH(-9, 0, 1));
  const eFwd = toPair(offH(9, 0, 1));

  const fA0 = offH(-c / 2, 0, 1), fB0 = offH(c / 2, 0, 1);
  const fC0 = offH(t - c / 2, 0, 1), fD0 = offH(t + c / 2, 0, 1);
  const legs = [
    [toPair(A0), toPair(fA0)],
    [toPair(B0), toPair(fB0)],
    [toPair(C0), toPair(fC0)],
    [toPair(D0), toPair(fD0)],
  ];
  return {
    kind: 'H',
    fwdSegs: toSegs(fwdVerts),
    backSegs: toSegs(backVerts),
    cutPts,
    ends: [eBack, eFwd],
    legs,
    feet: [toPair(fA0), toPair(fC0)],
  };
}

// ---- Euclidean 2222 (math-2222.md §3.5, §11.9)
export function reduceSuperbase(e1, e2, tol = 1e-13) {
  let Va = [1, 0], Vb = [0, 1], Vc = [-1, -1];
  const comb = (r) => [r[0] * e1[0] + r[1] * e2[0], r[0] * e1[1] + r[1] * e2[1]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  for (let n = 0; n < 10000; n++) {
    const va = comb(Va), vb = comb(Vb), vc = comb(Vc);
    const dab = dot(va, vb), dac = dot(va, vc), dbc = dot(vb, vc);
    if (dab > tol) { [Vb, Vc] = [[-Vb[0], -Vb[1]], [Vb[0] - Va[0], Vb[1] - Va[1]]]; }
    else if (dac > tol) { [Vb, Vc] = [[Vc[0] - Va[0], Vc[1] - Va[1]], [-Vc[0], -Vc[1]]]; }
    else if (dbc > tol) { [Va, Vc] = [[Vc[0] - Vb[0], Vc[1] - Vb[1]], [-Vc[0], -Vc[1]]]; }
    else {
      const sig = Va[0] * Vb[1] - Va[1] * Vb[0];
      return { Va, Vb, Vc, va, vb, vc, sig };
    }
  }
  throw new Error('reduceSuperbase: failed to converge');
}

export function pillowCentered(ell, tw, { commas = null, thetas = null, perm = [0, 1, 2, 3] } = {}) {
  const w = 1 / ell, s = 2 * ell * tw;
  const V = [
    [-ell / 2, 0, 1],
    [ell / 2, 0, 1],
    [1.5 * ell, 0, 1],
    [1.5 * ell + s, w, 1],
    [ell / 2 + s, w, 1],
    [-ell / 2 + s, w, 1],
  ];
  const edges = [{ to: 1, rev: false }, { to: 0, rev: false }, { to: 5, rev: false }, { to: 4, rev: false }, { to: 3, rev: false }, { to: 2, rev: false }];
  const D = makeDomain(GE, V, edges);
  const A = analyse(D);
  const home = [V[0], V[1], V[5], V[4]];
  const partners = [home[1], home[0], home[3], home[2]];

  const specs = commas || defaultCommas('2222');
  const angles = thetas || specs.map((sp) => (sp ? sp.theta : 0));
  const shapes = [];
  for (let cone = 0; cone < 4; cone++) {
    const slot = perm.indexOf(cone), sp = specs[cone];
    if (!sp || slot < 0) continue;
    const th = angles[cone];
    const F = GE.frame(home[slot], partners[slot]);
    shapes.push(moved(commaAt(GE, GE.polar(sp.rho, th), sp.size, th + 1.3, sp.which, 2.0), F));
  }
  return {
    D, A, home,
    treeSeg: [V[0], V[2]],
    cutSeg: [[-ell / 2 + s / 2, w / 2, 1], [1.5 * ell + s / 2, w / 2, 1]],
    shapes,
  };
}

export function recut2222(state, i, j) {
  const { perm, L: ell, tw, thetas } = state;
  if (i === j || i < 0 || i > 3 || j < 0 || j > 3) throw new Error('recut2222: invalid pair');
  const w = 1 / ell, s = 2 * ell * tw;
  const e1 = [ell, 0], e2 = [s, w];
  const slotPos = [
    [-ell / 2, 0],
    [ell / 2, 0],
    [-ell / 2 + s, w],
    [ell / 2 + s, w],
  ];
  const parity = [[0, 0], [1, 0], [0, 1], [1, 1]];
  const slotA = perm.indexOf(i), slotB = perm.indexOf(j);
  const pa = parity[slotA], pb = parity[slotB];
  const dp = [pa[0] ^ pb[0], pa[1] ^ pb[1]];
  const { va, vb, vc, sig } = reduceSuperbase(e1, e2);

  let v, u;
  if (dp[0] === 1 && dp[1] === 0) { v = va; u = [sig * vb[0], sig * vb[1]]; }
  else if (dp[0] === 0 && dp[1] === 1) { v = vb; u = [sig * vc[0], sig * vc[1]]; }
  else { v = vc; u = [sig * va[0], sig * va[1]]; }

  // Choose sign of (v, u) and lattice-even copy of A' so midpoint is closest to origin
  const A0 = slotPos[slotA];
  let bestDist = Infinity, bestSign = 1, bestA = A0;
  for (const sgn of [1, -1]) {
    const vs = [sgn * v[0], sgn * v[1]];
    // Optimal even shift 2*(m*e1 + n*e2) minimizing |A0 + shift + vs/2|
    const target = [-(A0[0] + vs[0] / 2), -(A0[1] + vs[1] / 2)];
    const m = Math.round((target[0] - (s / w) * target[1]) / (2 * ell));
    const n = Math.round(target[1] / (2 * w));
    const Ax = A0[0] + 2 * (m * e1[0] + n * e2[0]), Ay = A0[1] + 2 * (m * e1[1] + n * e2[1]);
    const mx = Ax + vs[0] / 2, my = Ay + vs[1] / 2;
    const d2 = mx * mx + my * my;
    if (d2 < bestDist - 1e-12) { bestDist = d2; bestSign = sgn; bestA = [Ax, Ay]; }
  }
  const vDir = [bestSign * v[0], bestSign * v[1]];
  const uDir = [bestSign * u[0], bestSign * u[1]];
  const ellP = Math.hypot(vDir[0], vDir[1]);
  const twP = (uDir[0] * vDir[0] + uDir[1] * vDir[1]) / (2 * ellP * ellP);

  // Determine which remaining cone sits at A' + uDir vs A' + uDir + vDir
  const mod2 = (x) => ((Math.round(x) % 2) + 2) % 2;
  const invE = (px, py) => [(px - (s / w) * py) / ell, py / w];
  const [cu0, cv0] = invE(bestA[0] + uDir[0] - (-ell / 2), bestA[1] + uDir[1]);
  const cPar = [mod2(cu0), mod2(cv0)];
  const others = [0, 1, 2, 3].filter((idx) => idx !== slotA && idx !== slotB);
  const slotC = parity[others[0]][0] === cPar[0] && parity[others[0]][1] === cPar[1] ? others[0] : others[1];
  const slotD = others[0] === slotC ? others[1] : others[0];

  const oldPartnerVec = [
    [e1[0], e1[1]],
    [-e1[0], -e1[1]],
    [e1[0], e1[1]],
    [-e1[0], -e1[1]],
  ];
  const newPerm = [perm[slotA], perm[slotB], perm[slotC], perm[slotD]];
  const newPartnerVec = [vDir, [-vDir[0], -vDir[1]], vDir, [-vDir[0], -vDir[1]]];
  const oldSlotOfNew = [slotA, slotB, slotC, slotD];
  const newThetas = thetas.slice();
  for (let slot = 0; slot < 4; slot++) {
    const cone = newPerm[slot];
    const ov = oldPartnerVec[oldSlotOfNew[slot]];
    const nv = newPartnerVec[slot];
    newThetas[cone] = thetas[cone] + (Math.atan2(ov[1], ov[0]) - Math.atan2(nv[1], nv[0]));
  }

  const Bnew = [bestA[0] + vDir[0], bestA[1] + vDir[1]];
  const Q = GE.fix(GE.fit([bestA[0], bestA[1], 1], [Bnew[0], Bnew[1], 1], [-ellP / 2, 0, 1], [ellP / 2, 0, 1], false), 1);

  return {
    k: '2222',
    perm: newPerm,
    orders: [2, 2, 2, 2],
    L: ellP,
    tw: twP,
    thetas: newThetas,
    Q,
    invQ: GE.fix(inv(Q), 1),
  };
}

// ---- Smooth view interpolation between frames (0.4 s glide on re-pick)
export function interpolateView(kind, M0, M1, u) {
  const e = u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
  const G = kind === 'E' ? GE : GH;
  // Move smoothly from M0 to M1: M(e) = M1 * exp_rel((1 - e) * log(M1^-1 * M0))
  const rel = G.fix(mul(inv(M1), M0), 1);
  if (kind === 'E') {
    const ang = Math.atan2(rel[3], rel[0]), tx = rel[2], ty = rel[5];
    // Interpolate translation of midpoint + rotation cleanly
    const a = (1 - e) * ang, c = Math.cos(a), s = Math.sin(a);
    return mul(M1, [c, -s, (1 - e) * tx, s, c, (1 - e) * ty, 0, 0, 1]);
  }
  const p0 = [rel[2], rel[5], rel[8]];
  const d0 = GH.dist(GH.origin, p0);
  const th0 = Math.atan2(p0[1], p0[0]);
  const Tback = GH.translate(p0, GH.origin);
  const R0 = mul(Tback, rel);
  const ang = Math.atan2(R0[3], R0[0]);
  const p = d0 > 1e-12 ? GH.polar((1 - e) * d0, th0) : GH.origin;
  const R = GH.rotate(GH.origin, (1 - e) * ang);
  return GH.fix(mul(M1, mul(GH.translate(GH.origin, p), R)), 1);
}

// ---- 3D ball helpers (stadium loop + twist bead, matching engine-check.mjs part I)
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const ang3 = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot3(a, b))));

/** Closed stadium loop on a sphere of radius R around two site normals n1, n2. */
export function stadium(n1, n2, R = 1, rho = 0.36, m = 24) {
  const k = unit3(cross3(n1, n2)), th = ang3(n1, n2), pts = [];
  const s = Math.sin(th);
  const at = (t) => n1.map((x, i) => (Math.sin((1 - t) * th) / s) * x + (Math.sin(t * th) / s) * n2[i]);
  const off = (p, dir, a) => p.map((x, i) => (Math.cos(rho) * x + Math.sin(rho) * (Math.cos(a) * dir[i] + Math.sin(a) * k[i])) * R);
  for (let i = 0; i <= m; i++) pts.push(off(at(i / m), k, PI / 2));
  const e2 = unit3(cross3(k, n2));
  for (let i = 1; i < m; i++) pts.push(off(n2, e2, PI / 2 - (PI * i) / m));
  for (let i = 0; i <= m; i++) pts.push(off(at(1 - i / m), k, -PI / 2));
  const e1 = unit3(cross3(n1, k));
  for (let i = 1; i < m; i++) pts.push(off(n1, e1, -PI / 2 + (PI * i) / m));

  // Arc-length table for constant-speed twist bead placement
  const cum = [0];
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    total += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    cum.push(total);
  }
  const flat = new Float32Array(3 * pts.length);
  for (let i = 0; i < pts.length; i++) { flat[3 * i] = pts[i][0]; flat[3 * i + 1] = pts[i][1]; flat[3 * i + 2] = pts[i][2]; }
  return { pts, flat, cum, total };
}

/** Point fraction u in [0, 1) along a closed stadium loop. */
export function beadOnLoop(loop, u) {
  const f = ((u % 1) + 1) % 1;
  const target = f * loop.total;
  const { pts, cum } = loop;
  let lo = 0, hi = pts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cum[mid] <= target) lo = mid; else hi = mid - 1; }
  const segLen = cum[lo + 1] - cum[lo] || 1;
  const a = pts[lo], b = pts[(lo + 1) % pts.length], t = (target - cum[lo]) / segLen;
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
}

/** Which dodecahedron sites the 4 cones occupy, and which neighbouring pair gets the stadium loop. */
export function sitesForBall(built, pair) {
  const L = built.layout;
  const siteOf = built.anchors.map((a) => {
    const p = a.at();
    let best = 0, bv = -Infinity;
    for (let s = 0; s < L.sites.length; s++) {
      const v = dot3(p, L.sites[s].site.n);
      if (v > bv) { bv = v; best = s; }
    }
    return best;
  });
  const [a, b] = pair, sa = siteOf[a], sb = siteOf[b];
  if (L.sites[sa].toward.has(sb)) return { siteOf, loopSites: [sa, sb], complement: false };
  const others = [0, 1, 2, 3].filter((k) => k !== a && k !== b);
  return { siteOf, loopSites: [siteOf[others[0]], siteOf[others[1]]], complement: true };
}

// ---- Build the pattern model for pattern-ext.js from current state
export function buildPatternModel(state, { dark = false, follow = null } = {}) {
  const INK = [0.08, 0.09, 0.12];
  const AMBER = dark ? [0.941, 0.659, 0.188] : [0.902, 0.624, 0];
  const BLUE = dark ? [0.337, 0.706, 0.914] : [0, 0.447, 0.698];
  const fam = FAMILIES[state.k];
  const built = fam.kind === 'E'
    ? pillowCentered(state.L, state.tw, { thetas: state.thetas, perm: state.perm })
    : fourConeCentered(state.orders, state.L, state.tw, { thetas: state.thetas, perm: state.perm, k: state.k });
  const { D, A, home, cutSeg, treeSeg, shapes } = built;

  // On every tile: tree in ink, cut in amber dashed (drawn after tree so both read when p = q = 2)
  const lines = [
    { a: treeSeg[0], b: treeSeg[1], color: INK, width: 2.3, alpha: 0.9, steps: 6 },
    { a: cutSeg[0], b: cutSeg[1], color: AMBER, width: 2.2, dash: [6, 4.5], alpha: 1, steps: 8 },
  ];
  const dots = [];

  if (follow && follow.active) {
    const fd = follow.data;
    const progress = follow.progress ?? 1;
    // Highlighted walk segments (heavy ink)
    const walkSegs = [...fd.fwdSegs, ...fd.backSegs];
    const totalF = fd.fwdSegs.length, totalB = fd.backSegs.length;
    if (progress < 0.45) {
      const fCount = Math.max(1, Math.ceil((progress / 0.45) * totalF));
      for (let i = 0; i < fCount; i++) lines.push({ a: fd.fwdSegs[i][0], b: fd.fwdSegs[i][1], color: INK, width: 4.0, alpha: 0.95, once: true, steps: 8 });
      const last = fd.fwdSegs[Math.min(fCount - 1, totalF - 1)][1];
      dots.push({ p: last, color: AMBER, stroke: INK, r: 5.5 });
    } else if (progress < 0.9) {
      for (const s of fd.fwdSegs) lines.push({ a: s[0], b: s[1], color: INK, width: 4.0, alpha: 0.95, once: true, steps: 8 });
      const bCount = Math.max(1, Math.ceil(((progress - 0.45) / 0.45) * totalB));
      for (let i = 0; i < bCount; i++) lines.push({ a: fd.backSegs[i][0], b: fd.backSegs[i][1], color: INK, width: 4.0, alpha: 0.95, once: true, steps: 8 });
      const last = fd.backSegs[Math.min(bCount - 1, totalB - 1)][1];
      dots.push({ p: last, color: AMBER, stroke: INK, r: 5.5 });
      if (fd.ends) dots.push({ p: fd.ends[1], color: AMBER, stroke: INK, r: 6.5, after: true });
    } else {
      for (const s of walkSegs) lines.push({ a: s[0], b: s[1], color: INK, width: 3.8, alpha: 0.95, once: true, steps: 8 });
      for (const lg of fd.legs) lines.push({ a: lg[0], b: lg[1], color: INK, width: 1.2, alpha: 0.75, once: true, steps: 8 });
      for (let i = 0; i + 1 < fd.cutPts.length; i++) {
        lines.push({ a: fd.cutPts[i], b: fd.cutPts[i + 1], color: [1, 1, 1], width: 5.0, alpha: 0.9, once: true, steps: 4 });
        lines.push({ a: fd.cutPts[i], b: fd.cutPts[i + 1], color: AMBER, width: 3.0, alpha: 1, once: true, steps: 4 });
      }
      if (fd.ends) {
        dots.push({ p: fd.ends[0], color: AMBER, stroke: INK, r: 6.5, after: true });
        dots.push({ p: fd.ends[1], color: AMBER, stroke: INK, r: 6.5, after: true });
      }
      dots.push({ p: fd.feet[0], color: INK, r: 4.5 });
      dots.push({ p: fd.feet[1], color: AMBER, stroke: INK, r: 6 });
    }
    // Keep pair marks visible above
    void BLUE;
  }

  return {
    D,
    A,
    home,
    outline: false,
    center: fam.kind === 'E' ? [0, 0, 1] : GH.origin,
    design: () => shapes,
    lines,
    dots,
    marks: [A.cls[0], A.cls[1]],
  };
}
