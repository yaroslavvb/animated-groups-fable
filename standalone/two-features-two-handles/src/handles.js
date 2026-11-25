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
    label: '3333',
    kind: 'H',
    mode: 'cones',
    baseOrders: [3, 3, 3, 3],
    featLabels: ['3', '3', '3', '3'],
    defaultM: '0123',
    defaultL: 2.0,
    defaultTw: 0.175,
    baseRange: [0.6, 5.0],
    maxRange: [0.4, 7.0],
  },
  '2223': {
    k: '2223',
    label: '2223',
    kind: 'H',
    mode: 'cones',
    baseOrders: [2, 2, 2, 3],
    featLabels: ['2', '2', '2', '3'],
    defaultM: '3012',
    defaultL: 1.6,
    defaultTw: 0.1,
    baseRange: [0.6, 5.0],
    maxRange: [0.4, 7.0],
  },
  '333*': {
    k: '333*',
    label: '333∗',
    kind: 'H',
    mode: 'cone-star',
    baseOrders: [3, 0, 3, 3],
    featLabels: ['3', '∗', '3', '3'],
    featIdx: 1,
    defaultM: '0123',
    defaultL: 2.0,
    defaultTw: 0.15,
    defaultB: 1.4,
    bRange: [0.4, 3.2],
    bLabel: 'Mirror len',
    defaultTau: 0,
    baseRange: [0.5, 5.5],
    maxRange: [0.35, 9.0],
  },
  '333*3': {
    k: '333*3',
    label: '333∗3',
    kind: 'H',
    mode: 'cone-star3',
    baseOrders: [3, 0, 3, 3],
    featLabels: ['3', '∗3', '3', '3'],
    featIdx: 1,
    defaultM: '0123',
    defaultL: 2.0,
    defaultTw: 0.15,
    defaultB: 1.4,
    bRange: [0.4, 3.2],
    bLabel: 'Mirror len',
    defaultTau: 0.25,
    tauLabel: 'Corner shift',
    baseRange: [0.5, 5.5],
    maxRange: [0.35, 9.0],
  },
  '333x': {
    k: '333x',
    label: '333×',
    kind: 'H',
    mode: 'cone-x',
    baseOrders: [3, 0, 3, 3],
    featLabels: ['3', '×', '3', '3'],
    featIdx: 1,
    defaultM: '0123',
    defaultL: 2.0,
    defaultTw: 0.15,
    defaultB: 0.7,
    bRange: [0.25, 2.0],
    bLabel: 'Crosscap len',
    bMult: 2,
    defaultTau: 0,
    baseRange: [0.5, 5.5],
    maxRange: [0.35, 9.0],
  },
  'o33': {
    k: 'o33',
    label: 'o33',
    kind: 'H',
    mode: 'handle',
    baseOrders: [0, 0, 3, 3],
    featLabels: ['o⁺', 'o⁻', '3', '3'],
    defaultM: '0213',
    defaultL: 2.2,
    defaultTw: 0.15,
    defaultB: 1.3,
    bRange: [0.4, 3.0],
    bLabel: 'Handle len',
    defaultTau: 0.2,
    tauLabel: 'Handle shift',
    baseRange: [0.5, 6.0],
    maxRange: [0.35, 9.5],
  },
  '2222': {
    k: '2222',
    label: '2222',
    kind: 'E',
    mode: 'pillow',
    baseOrders: [2, 2, 2, 2],
    featLabels: ['2', '2', '2', '2'],
    defaultM: '0123',
    defaultL: 1.1,
    defaultTw: 0.15,
    baseRange: [Math.SQRT1_2, Math.SQRT2],
    maxRange: [0.5, 2.0],
  },
};

export function normalizeFamilyKey(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/∗/g, '*').replace(/×/g, 'x');
  return FAMILIES[s] ? s : null;
}

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
  if (k === '333*' || k === '333*3' || k === '333x') {
    return [
      { which: 'big', rho: 0.36, size: 0.165, theta: 1.9 },
      null,
      { which: 'big', rho: 0.31, size: 0.125, theta: 2.6 },
      { which: 'small', rho: 0.27, size: 0.095, theta: 2.2 },
    ];
  }
  if (k === 'o33') {
    return [
      null,
      null,
      { which: 'big', rho: 0.36, size: 0.165, theta: 1.9 },
      { which: 'small', rho: 0.29, size: 0.105, theta: 2.5 },
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

// ---- Exact hyperboloid primitives & F11 cone–cuff / handle formulas
/** Exact Lorentz boost along the x-axis (safe for negative, zero, and positive x). */
export function boostX(x) {
  const c = Math.cosh(x), s = Math.sinh(x);
  return [c, 0, s, 0, 1, 0, s, 0, c];
}
const offH = (x, h, sgn) => [Math.sinh(x) * Math.cosh(h), sgn * Math.sinh(h), Math.cosh(x) * Math.cosh(h)];
const midH = (a, b) => GH.norm([a[0] + b[0], a[1] + b[1], a[2] + b[2]]);
const ldot = (a, b) => a[0] * b[0] + a[1] * b[1] - a[2] * b[2];
const lcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], -(a[0] * b[1] - a[1] * b[0])];
const wrapHalf = (t) => { const r = ((((t + 0.5) % 1) + 1) % 1) - 0.5; return r <= -0.5 + 1e-12 ? 0.5 : r; };
const mod1 = (t) => ((t % 1) + 1) % 1;

function makeDom(verts, pairs) {
  const n = verts.length, edges = new Array(n);
  for (const p of pairs) {
    if (p.mirror) edges[p.a] = { mirror: true };
    else {
      edges[p.a] = { to: p.b, rev: !!p.rev };
      edges[p.b] = { to: p.a, rev: !!p.rev };
    }
  }
  return makeDomain(GH, verts, edges);
}

/** Find translation axis, length, and frame F (F^-1 M F = boostX(+len)) for hyperbolic M. */
export function axisOfTrans(M) {
  const A = [[M[0] - 1, M[1], M[2]], [M[3], M[4] - 1, M[5]], [M[6], M[7], M[8] - 1]];
  const crossE = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const cands = [crossE(A[0], A[1]), crossE(A[1], A[2]), crossE(A[2], A[0])];
  let n = cands.reduce((b, c) => (c[0] * c[0] + c[1] * c[1] + c[2] * c[2] > b[0] * b[0] + b[1] * b[1] + b[2] * b[2] ? c : b));
  const nn = Math.sqrt(Math.max(1e-30, ldot(n, n)));
  n = [n[0] / nn, n[1] / nn, n[2] / nn];
  const p0 = GH.norm([n[2] * n[0], n[2] * n[1], 1 + n[2] * n[2]]);
  const p1 = apply(M, p0);
  const F = GH.frame(p0, p1);
  return { len: GH.dist(p0, p1), p0, p1, F, invF: GH.fix(inv(F), 1) };
}

/** Signed (u, h) along the x-axis of frame invF for a hyperboloid point P. */
export function axisCoords(invF, P) {
  const q = apply(invF, P);
  return { u: Math.atanh(Math.max(-1 + 1e-15, Math.min(1 - 1e-15, q[0] / q[2]))), h: Math.asinh(q[1]) };
}

/** Common perpendicular between the x-axis of frame invF and oriented geodesic gL -> gR. */
export function geodesicCoordsInFrame(invF, gL, gR) {
  const a = apply(invF, gL), b = apply(invF, gR);
  const mRaw = lcross(a, b);
  const mn = Math.sqrt(Math.max(1e-30, ldot(mRaw, mRaw)));
  const m = [mRaw[0] / mn, mRaw[1] / mn, mRaw[2] / mn];
  const u = Math.atanh(Math.max(-1 + 1e-15, Math.min(1 - 1e-15, m[0] / m[2])));
  const dist = Math.acosh(Math.max(1, Math.abs(m[1])));
  const sgn = midH(a, b)[1] >= 0 ? 1 : -1;
  return { u, h: sgn * dist, dist, footOnGam: offH(u, dist, sgn) };
}

/** F11 (cone + geodesic cuff): shortest perpendicular arc D, cone height hA, cuff height hG. */
export function pantsConeCuff(p, b, L) {
  const cp = Math.cos(PI / p), sp = Math.sin(PI / p);
  const cL = Math.cosh(L / 2), sL = Math.sinh(L / 2);
  const cb = Math.cosh(b / 2), sb = Math.sinh(b / 2);
  return {
    D: Math.asinh((cL + cp * cb) / (sp * sb)),
    hA: Math.asinh((cb + cp * cL) / (sp * sL)),
    hG: Math.acosh(Math.max(1, (cp + cL * cb) / (sL * sb))),
  };
}

/** F11 ({o+, o-} once-holed torus): shortest handle arc Doo and cuff height ho. */
export function handleSplitGeom(bo, L) {
  const cL = Math.cosh(L / 2), sL = Math.sinh(L / 2);
  const cb = Math.cosh(bo / 2), sb = Math.sinh(bo / 2);
  return {
    Doo: Math.acosh(Math.max(1, (cL + cb * cb) / (sb * sb))),
    ho: Math.acosh(Math.max(1, cb * (1 + cL) / (sL * sb))),
  };
}

/** Exact minimum distance from hyperbolic segment [P, Q] (on one side of y = 0) to y = 0. */
function segDistToXAxis(P, Q) {
  const dP = Math.abs(Math.asinh(P[1])), dQ = Math.abs(Math.asinh(Q[1]));
  const nRaw = lcross(P, Q);
  const nn = Math.sqrt(Math.max(1e-30, ldot(nRaw, nRaw)));
  const n = [nRaw[0] / nn, nRaw[1] / nn, nRaw[2] / nn];
  if (Math.abs(n[1]) > 1 + 1e-12 && Math.abs(n[0]) < Math.abs(n[2])) {
    const u = Math.atanh(n[0] / n[2]);
    const m = Math.acosh(Math.abs(n[1]));
    const sgn = midH(P, Q)[1] >= 0 ? 1 : -1;
    const foot = offH(u, m, sgn);
    if (Math.abs(GH.dist(P, foot) + GH.dist(Q, foot) - GH.dist(P, Q)) < 1e-6) return m;
  }
  return Math.min(dP, dQ);
}

/** Exact pair distance d and tree-to-cut distance mDist for any family state. */
export function pairMetricsFor(state) {
  const fam = FAMILIES[state.k];
  if (!fam) return { d: state.L, mDist: 0 };
  if (fam.mode === 'pillow') return { d: state.L, mDist: 1 / (2 * state.L) };
  if (fam.mode === 'cones') {
    const p = state.orders[0], q = state.orders[1];
    return { d: pairDistance(p, q, state.L), mDist: treeToCut(p, q, state.L).m };
  }
  if (fam.mode === 'handle') {
    const b = buildO33CutFromState(state);
    return { d: b.d, mDist: b.mDist };
  }
  const b = buildConeFeatCutFromState(state);
  return { d: b.d, mDist: b.mDist };
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

function placeCommas(G, k, perm, home, partners, commas, thetas) {
  const specs = commas || defaultCommas(k);
  const angles = thetas || specs.map((sp) => (sp ? sp.theta : 0));
  const shapes = [];
  for (let feat = 0; feat < 4; feat++) {
    const slot = perm.indexOf(feat), sp = specs[feat];
    if (!sp || slot < 0) continue;
    const th = angles[feat];
    const F = G.frame(home[slot], partners[slot]);
    shapes.push(moved(commaAt(G, G.polar(sp.rho, th), sp.size, th + 1.3, sp.which, 2.0), F));
  }
  return shapes;
}

function thetaDelta(F_old, F_new, M_cut) {
  const R = mul(inv(F_new), mul(M_cut, F_old));
  return Math.atan2(R[3], R[0]);
}

function cutEndpoints(u, v) {
  const den = u[1] - v[1];
  const frac = Math.abs(den) < 1e-15 ? 0 : u[1] / den;
  return GH.norm([u[0] + frac * (v[0] - u[0]), 0, u[2] + frac * (v[2] - u[2])]);
}

// ---- Cone + geodesic cuff families (333*, 333*3, 333x)
function buildConeFeatCut(k, L, tw, bParam, tauC = 0) {
  const fam = FAMILIES[k];
  const b = (fam.bMult || 1) * bParam;
  const { D: Ddist, hA, hG } = pantsConeCuff(3, b, L);
  const hU = hgt(3, 3, L);
  const t = tw * L;
  const gam = (u) => [Math.sinh(u), -Math.cosh(u) * Math.sinh(hG), Math.cosh(u) * Math.cosh(hG)];
  const A_L = offH(-L / 2, hA, -1), A_R = offH(L / 2, hA, -1);
  const UL = offH(t - L / 2, hU, 1), UM = offH(t, hU, 1), UR = offH(t + L / 2, hU, 1);
  const F_L = gam(-b / 2), F_R = gam(b / 2);

  let D, crL = null, crR = null, footFeat = F_R, featDist = Ddist, wMir = 0;
  if (k === '333*') {
    D = makeDom([F_L, F_R, A_R, UR, UM, UL, A_L], [
      { a: 0, mirror: true }, { a: 1, b: 6 }, { a: 2, b: 5 }, { a: 3, b: 4 },
    ]);
  } else if (k === '333x') {
    const F_M = gam(0);
    D = makeDom([F_L, F_M, F_R, A_R, UR, UM, UL, A_L], [
      { a: 0, b: 1, rev: true }, { a: 2, b: 7 }, { a: 3, b: 6 }, { a: 4, b: 5 },
    ]);
  } else {
    const phi = PI / 6;
    wMir = Math.asinh(Math.cos(phi) / Math.sinh(b / 2));
    const s = Math.atanh(Math.tanh(b / 2) * Math.cosh(wMir));
    const mir = (u) => [Math.sinh(u), -Math.cosh(u) * Math.sinh(wMir), Math.cosh(u) * Math.cosh(wMir)];
    const M = GH.fit(offH(-b / 2, 0, -1), offH(b / 2, 0, -1), gam(tauC * b - b / 2), gam(tauC * b + b / 2), false);
    crL = apply(M, mir(-s));
    crR = apply(M, mir(s));
    D = makeDom([crL, crR, A_R, UR, UM, UL, A_L], [
      { a: 0, mirror: true }, { a: 1, b: 6 }, { a: 2, b: 5 }, { a: 3, b: 4 },
    ]);

    const TF = GH.fit(F_L, F_R, F_R, gam(1.5 * b), false);
    const invTF = inv(TF);
    let bestD = Infinity;
    for (let m = -2; m <= 2; m++) {
      let Tm = I3;
      const step = m >= 0 ? TF : invTF;
      for (let q = 0; q < Math.abs(m); q++) Tm = mul(step, Tm);
      const cL = apply(Tm, crL), cR = apply(Tm, crR);
      const Fm = GH.frame(cL, cR);
      const qa = apply(inv(Fm), A_R);
      const segLen = GH.dist(cL, cR);
      const u = Math.max(0, Math.min(segLen, Math.atanh(Math.max(-1 + 1e-15, Math.min(1 - 1e-15, qa[0] / qa[2])))));
      const cand = apply(Fm, [Math.sinh(u), 0, Math.cosh(u)]);
      const dc = GH.dist(A_R, cand);
      if (dc < bestD - 1e-12) { bestD = dc; footFeat = cand; }
    }
    featDist = bestD;
  }

  const A = analyse(D);
  const TF = GH.fit(F_L, F_R, F_R, gam(1.5 * b), false);
  return {
    D, A, A_L, A_R, UL, UM, UR, F_L, F_R, crL, crR, footFeat, featDist,
    hA, hG, hU, b, wMir,
    R_AR: GH.rotate(A_R, TAU / 3),
    R_UM: GH.rotate(UM, TAU / 3),
    R_UR: GH.rotate(UR, TAU / 3),
    T_cut: boostX(L),
    TF,
    cutRawA: cutEndpoints(A_L, UL),
    cutRawB: cutEndpoints(A_R, UR),
  };
}

function coneFeatMapping(k, perm) {
  const fam = FAMILIES[k], fi = fam.featIdx;
  const featPicked = perm[0] === fi || perm[1] === fi;
  if (featPicked) {
    const lowerCone = perm[0] === fi ? perm[1] : perm[0];
    const [u1, u2] = perm[2] < perm[3] ? [perm[2], perm[3]] : [perm[3], perm[2]];
    return { featPicked: true, lowerCone, upperMin: u1, upperMax: u2 };
  }
  const [u1, u2] = perm[0] < perm[1] ? [perm[0], perm[1]] : [perm[1], perm[0]];
  const lowerCone = perm[2] === fi ? perm[3] : perm[2];
  return { featPicked: false, lowerCone, upperMin: u1, upperMax: u2 };
}

function buildConeFeatCutFromState(state) {
  const fam = FAMILIES[state.k];
  const perm = state.perm || fam.defaultM.split('').map(Number);
  const bParam = state.b ?? fam.defaultB;
  const tauC = state.tau ?? fam.defaultTau ?? 0;
  const cut = buildConeFeatCut(state.k, state.L, state.tw, bParam, tauC);
  const mp = coneFeatMapping(state.k, perm);
  const d = mp.featPicked ? cut.featDist : pairDistance(3, 3, state.L);
  const mDist = mp.featPicked ? segDistToXAxis(cut.A_R, cut.footFeat) : treeToCut(3, 3, state.L).m;
  return { ...cut, ...mp, perm, d, mDist };
}

function domainInPair(cutD, toPair) {
  const D = makeDomain(GH, cutD.verts.map(toPair), cutD.edges, { at: toPair(cutD.at) });
  return { D, A: analyse(D) };
}

export function coneFeatCentered(k, L, tw, bParam, tauC = 0, { commas = null, thetas = null, perm = [0, 1, 2, 3] } = {}) {
  const fam = FAMILIES[k], fi = fam.featIdx;
  const cut = buildConeFeatCut(k, L, tw, bParam, tauC);
  const mp = coneFeatMapping(k, perm);

  const rawPos = new Array(4), rawPartner = new Array(4), clsOfFeat = new Array(4).fill(-1);
  rawPos[mp.lowerCone] = cut.A_R; rawPartner[mp.lowerCone] = cut.F_R; clsOfFeat[mp.lowerCone] = cut.A.cls[2];
  rawPos[mp.upperMin] = cut.UM; rawPartner[mp.upperMin] = cut.UR; clsOfFeat[mp.upperMin] = cut.A.cls[k === '333x' ? 5 : 4];
  rawPos[mp.upperMax] = cut.UR; rawPartner[mp.upperMax] = cut.UM; clsOfFeat[mp.upperMax] = cut.A.cls[k === '333x' ? 4 : 3];
  rawPos[fi] = cut.footFeat; rawPartner[fi] = cut.A_R;
  clsOfFeat[fi] = k === '333*3' ? cut.A.cls[0] : -1;

  const pL = rawPos[perm[0]], pR = rawPos[perm[1]];
  const Pmat = GH.fix(inv(GH.frame(midH(pL, pR), pR)), 1);
  const toPair = (v) => GH.norm(apply(Pmat, v));
  const { D, A } = domainInPair(cut.D, toPair);

  const home = perm.map((f) => toPair(rawPos[f]));
  const canonPartners = perm.map((f) => toPair(rawPartner[f]));
  const shapes = placeCommas(GH, k, perm, home, canonPartners, commas, thetas);

  const featDots = mp.featPicked ? [toPair(cut.footFeat)] : [];
  const marks = [clsOfFeat[perm[0]], clsOfFeat[perm[1]]].filter((c) => c >= 0);

  return {
    D,
    A,
    cut,
    mp,
    home,
    cutSeg: [toPair(offH(-L / 2, 0, 1)), toPair(offH(L / 2, 0, 1))],
    treeSeg: [home[0], home[1]],
    Pmat,
    rawPos,
    rawPartner,
    featDots,
    marks,
    extraLines: [],
    d: mp.featPicked ? cut.featDist : pairDistance(3, 3, L),
    mDist: mp.featPicked ? segDistToXAxis(cut.A_R, cut.footFeat) : treeToCut(3, 3, L).m,
    shapes,
  };
}

// ---- Handle family o33 ({o+, o-, 3_a, 3_b})
function buildO33Mixed(L, tw, bo, tauO = 0) {
  const { D: Ddist, hA, hG } = pantsConeCuff(3, bo, L);
  const t = tw * L, hb = bo / 2;
  const Tx = boostX(t);
  const gP = (u) => [Math.sinh(u), -Math.cosh(u) * Math.sinh(hG), Math.cosh(u) * Math.cosh(hG)];
  const gM = (u) => apply(Tx, [Math.sinh(u), Math.cosh(u) * Math.sinh(hG), Math.cosh(u) * Math.cosh(hG)]);
  const A_L = offH(-L / 2, hA, -1), A_R = offH(L / 2, hA, -1);
  const B_L = offH(t - L / 2, hA, 1), B_R = offH(t + L / 2, hA, 1);
  const f = mod1(tauO);
  let verts, pairs, vertA, vertB;
  if (f < 1e-10 || f > 1 - 1e-10) {
    verts = [gP(-hb), gP(hb), A_R, B_R, gM(hb), gM(-hb), B_L, A_L];
    pairs = [{ a: 0, b: 4 }, { a: 1, b: 7 }, { a: 2, b: 6 }, { a: 3, b: 5 }];
    vertA = 2; vertB = 3;
  } else {
    verts = [gP(-hb), gP(hb - f * bo), gP(hb), A_R, B_R, gM(hb), gM(-hb + f * bo), gM(-hb), B_L, A_L];
    pairs = [{ a: 0, b: 5 }, { a: 1, b: 6 }, { a: 2, b: 9 }, { a: 3, b: 8 }, { a: 4, b: 7 }];
    vertA = 3; vertB = 4;
  }
  const D = makeDom(verts, pairs), A = analyse(D);
  const H_glue = GH.fit(gP(-hb), gP(hb), gM(-hb + tauO * bo), gM(hb + tauO * bo), false);
  const ToP = GH.fit(gP(-hb), gP(hb), gP(hb), gP(3 * hb), false);
  const ToM = GH.fit(gM(-hb), gM(hb), gM(hb), gM(3 * hb), false);
  return {
    mode: 'mixed', D, A, A_L, A_R, B_L, B_R, vertA, vertB,
    gP, gM, H_glue, ToP, ToM,
    R_AR: GH.rotate(A_R, TAU / 3), R_BR: GH.rotate(B_R, TAU / 3), T_cut: boostX(L),
    hA, hG, Ddist, d: Ddist,
    mDist: segDistToXAxis(A_R, gP(hb)),
  };
}

function buildO33Split(L, tw, bo, tauO = 0) {
  const h3 = hgt(3, 3, L);
  const { Doo, ho } = handleSplitGeom(bo, L);
  const t = tw * L, hb = bo / 2;
  const cP = (u) => apply(boostX(t - L / 4), [Math.sinh(u), Math.cosh(u) * Math.sinh(ho), Math.cosh(u) * Math.cosh(ho)]);
  const cM = (u) => apply(boostX(t + L / 4), [Math.sinh(u), Math.cosh(u) * Math.sinh(ho), Math.cosh(u) * Math.cosh(ho)]);
  const AL = offH(-L / 2, h3, -1), AM = offH(0, h3, -1), AR = offH(L / 2, h3, -1);
  const Tg = boostX(L), cP2 = (u) => apply(Tg, cP(u));
  const f = mod1(tauO);
  let verts, pairs;
  if (f < 1e-10 || f > 1 - 1e-10) {
    verts = [AL, AM, AR, cP2(-hb), cM(hb), cM(-hb), cP(hb), cP(-hb)];
    pairs = [{ a: 0, b: 1 }, { a: 2, b: 7 }, { a: 3, b: 5 }, { a: 4, b: 6 }];
  } else {
    verts = [AL, AM, AR, cP2(-hb), cM(hb), cM(-hb + f * bo), cM(-hb), cP(hb), cP(-hb + f * bo), cP(-hb)];
    pairs = [{ a: 0, b: 1 }, { a: 2, b: 9 }, { a: 3, b: 6 }, { a: 4, b: 7 }, { a: 5, b: 8 }];
  }
  const D = makeDom(verts, pairs), A = analyse(D);
  const ToP = GH.fit(cP(-hb), cP(hb), cP(hb), cP(3 * hb), false);
  const ToM = GH.fit(cM(-hb), cM(hb), cM(hb), cM(3 * hb), false);
  const H_glue = GH.fit(cP(hb), cP(-hb), cM(-hb + tauO * bo), cM(hb + tauO * bo), false);
  return {
    mode: 'split', D, A, AL, AM, AR, cP, cM, cP2,
    R_AL: GH.rotate(AL, TAU / 3), R_AM: GH.rotate(AM, TAU / 3), R_AR: GH.rotate(AR, TAU / 3),
    T_cut: Tg, ToP, ToM, H_glue, Doo, ho, h3,
  };
}

function o33Mapping(perm) {
  const isMixed = (perm[0] < 2) !== (perm[1] < 2);
  if (isMixed) {
    const pLow = (perm[0] === 0 || perm[1] === 0) ? [perm[0], perm[1]] : [perm[2], perm[3]];
    const pUp = (perm[0] === 1 || perm[1] === 1) ? [perm[0], perm[1]] : [perm[2], perm[3]];
    const lowerCone = pLow[0] === 0 ? pLow[1] : pLow[0];
    const upperCone = pUp[0] === 1 ? pUp[1] : pUp[0];
    return { mode: 'mixed', lowerCone, upperCone };
  }
  const cPair = perm[0] >= 2 ? [perm[0], perm[1]] : [perm[2], perm[3]];
  const [coneAM, coneAR] = cPair[0] < cPair[1] ? [cPair[0], cPair[1]] : [cPair[1], cPair[0]];
  return { mode: 'split', coneAM, coneAR, handlesPicked: perm[0] < 2 };
}

function buildO33CutFromState(state) {
  const fam = FAMILIES.o33;
  const perm = state.perm || fam.defaultM.split('').map(Number);
  const bo = state.b ?? fam.defaultB;
  const tauO = state.tau ?? fam.defaultTau;
  const mp = o33Mapping(perm);
  if (mp.mode === 'mixed') {
    const cut = buildO33Mixed(state.L, state.tw, bo, tauO);
    const usesLower = perm[0] === 0 || perm[1] === 0;
    const hb = bo / 2;
    const mDist = usesLower ? segDistToXAxis(cut.A_R, cut.gP(hb)) : segDistToXAxis(cut.B_R, cut.gM(hb));
    return { ...cut, ...mp, perm, usesLower, d: cut.Ddist, mDist };
  }
  const cut = buildO33Split(state.L, state.tw, bo, tauO);
  const hb = bo / 2;
  const d = mp.handlesPicked ? cut.Doo : pairDistance(3, 3, state.L);
  const mDist = mp.handlesPicked ? segDistToXAxis(cut.cP(hb), cut.cM(-hb)) : treeToCut(3, 3, state.L).m;
  return { ...cut, ...mp, perm, d, mDist };
}

export function o33Centered(L, tw, bo, tauO = 0, { commas = null, thetas = null, perm = [0, 2, 1, 3], dark = false } = {}) {
  const mp = o33Mapping(perm);
  const hb = bo / 2;
  const BLUE = dark ? [0.337, 0.706, 0.914] : [0, 0.447, 0.698];
  let cut, d, mDist;
  const rawPos = new Array(4), rawPartner = new Array(4), clsOfFeat = new Array(4).fill(-1);
  const handleLinesRaw = [];

  if (mp.mode === 'mixed') {
    cut = buildO33Mixed(L, tw, bo, tauO);
    rawPos[0] = cut.gP(hb); rawPartner[0] = cut.A_R;
    rawPos[1] = cut.gM(hb); rawPartner[1] = cut.B_R;
    rawPos[mp.lowerCone] = cut.A_R; rawPartner[mp.lowerCone] = cut.gP(hb); clsOfFeat[mp.lowerCone] = cut.A.cls[cut.vertA];
    rawPos[mp.upperCone] = cut.B_R; rawPartner[mp.upperCone] = cut.gM(hb); clsOfFeat[mp.upperCone] = cut.A.cls[cut.vertB];
    const usesLower = perm[0] === 0 || perm[1] === 0;
    d = cut.Ddist;
    mDist = usesLower ? segDistToXAxis(cut.A_R, cut.gP(hb)) : segDistToXAxis(cut.B_R, cut.gM(hb));
    const Tx = boostX(tw * L);
    handleLinesRaw.push([cut.gP(-hb), cut.gP(hb)]);
    handleLinesRaw.push([cut.gP(0), offH(0, Math.max(0.05, cut.hG - 0.14), -1)]);
    handleLinesRaw.push([cut.gM(0), apply(Tx, offH(0, Math.max(0.05, cut.hG - 0.14), 1))]);
  } else {
    cut = buildO33Split(L, tw, bo, tauO);
    rawPos[0] = cut.cP(hb); rawPartner[0] = cut.cM(-hb);
    rawPos[1] = cut.cM(-hb); rawPartner[1] = cut.cP(hb);
    rawPos[mp.coneAM] = cut.AM; rawPartner[mp.coneAM] = cut.AR; clsOfFeat[mp.coneAM] = cut.A.cls[1];
    rawPos[mp.coneAR] = cut.AR; rawPartner[mp.coneAR] = cut.AM; clsOfFeat[mp.coneAR] = cut.A.cls[2];
    d = mp.handlesPicked ? cut.Doo : pairDistance(3, 3, L);
    mDist = mp.handlesPicked ? segDistToXAxis(cut.cP(hb), cut.cM(-hb)) : treeToCut(3, 3, L).m;
    handleLinesRaw.push([cut.cP(-hb), cut.cP(hb)]);
    handleLinesRaw.push([cut.cP(0), apply(boostX(tw * L - L / 4), [0, Math.sinh(Math.max(0.05, cut.ho - 0.14)), Math.cosh(Math.max(0.05, cut.ho - 0.14))])]);
    handleLinesRaw.push([cut.cM(0), apply(boostX(tw * L + L / 4), [0, Math.sinh(Math.max(0.05, cut.ho - 0.14)), Math.cosh(Math.max(0.05, cut.ho - 0.14))])]);
  }

  const pL = rawPos[perm[0]], pR = rawPos[perm[1]];
  const Pmat = GH.fix(inv(GH.frame(midH(pL, pR), pR)), 1);
  const toPair = (v) => GH.norm(apply(Pmat, v));
  const { D, A } = domainInPair(cut.D, toPair);
  const home = perm.map((f) => toPair(rawPos[f]));
  const canonPartners = perm.map((f) => toPair(rawPartner[f]));
  const shapes = placeCommas(GH, 'o33', perm, home, canonPartners, commas, thetas);

  const featDots = [perm[0], perm[1]].filter((f) => f < 2).map((f) => toPair(rawPos[f]));
  const marks = [clsOfFeat[perm[0]], clsOfFeat[perm[1]]].filter((c) => c >= 0);
  const extraLines = [
    { a: toPair(handleLinesRaw[0][0]), b: toPair(handleLinesRaw[0][1]), color: BLUE, width: 2.3, alpha: 0.9, steps: 6 },
    { a: toPair(handleLinesRaw[1][0]), b: toPair(handleLinesRaw[1][1]), color: BLUE, width: 2.2, alpha: 0.9, steps: 3 },
    { a: toPair(handleLinesRaw[2][0]), b: toPair(handleLinesRaw[2][1]), color: BLUE, width: 2.2, alpha: 0.9, steps: 3 },
  ];

  return {
    D,
    A,
    cut,
    mp,
    home,
    cutSeg: [toPair(offH(-L / 2, 0, 1)), toPair(offH(L / 2, 0, 1))],
    treeSeg: [home[0], home[1]],
    Pmat,
    rawPos,
    rawPartner,
    featDots,
    marks,
    extraLines,
    d,
    mDist,
    shapes,
  };
}

// ---- Exact stationary re-cuts for 333*, 333*3, 333x, o33
function alignToSlot(M_cone, Qcut, oldVert, targetU, Lp) {
  const q = apply(Qcut, apply(M_cone, oldVert));
  const m = Math.round((axisCoords(I3, q).u - targetU) / Lp);
  return mul(boostX(-m * Lp), mul(Qcut, M_cone));
}

export function recutConeFeat(state, i, j) {
  const { k, perm, L, tw, thetas } = state;
  const fam = FAMILIES[k], fi = fam.featIdx;
  if (i === j || i < 0 || i > 3 || j < 0 || j > 3) throw new Error('recutConeFeat: invalid pair');
  const bParam = state.b ?? fam.defaultB;
  const tauC = state.tau ?? fam.defaultTau ?? 0;
  const b = (fam.bMult || 1) * bParam;

  const oldC = coneFeatCentered(k, L, tw, bParam, tauC, { perm, thetas });
  const others = [0, 1, 2, 3].filter((x) => x !== i && x !== j);
  const newPerm = [i, j, others[0], others[1]];
  const mp1 = coneFeatMapping(k, newPerm);

  if (mp1.lowerCone === oldC.mp.lowerCone) {
    const newC = coneFeatCentered(k, L, tw, bParam, tauC, { perm: newPerm, thetas });
    const Q = GH.fix(mul(newC.Pmat, inv(oldC.Pmat)), 1);
    return { k, perm: newPerm, orders: newPerm.map((c) => fam.baseOrders[c]), L, tw, b: bParam, tau: tauC, thetas: thetas.slice(), Q, invQ: GH.fix(inv(Q), 1) };
  }

  const g0 = oldC.cut;
  const fromUM = mp1.lowerCone === oldC.mp.upperMin;
  let best = null;
  for (let km = -2; km <= 2; km++) {
    const Tk = boostX(km * L), Ak = apply(Tk, g0.A_R), RAk = GH.rotate(Ak, TAU / 3);
    const FLk = apply(Tk, g0.F_L), FRk = apply(Tk, g0.F_R);
    let Tnew, Anew, U1, U2, gL, gR, cL = null, cR = null, mapOldLower, mapOldUM, mapOldUR;
    if (fromUM) {
      Tnew = mul(RAk, g0.R_UR);
      Anew = g0.UM; U1 = Ak; U2 = g0.UR;
      gL = apply(g0.R_UM, FLk); gR = apply(g0.R_UM, FRk);
      if (k === '333*3') { cL = apply(g0.R_UM, apply(Tk, g0.crL)); cR = apply(g0.R_UM, apply(Tk, g0.crR)); }
      mapOldUM = I3; mapOldLower = Tk; mapOldUR = I3;
    } else {
      Tnew = mul(g0.R_UM, RAk);
      Anew = g0.UR; U1 = g0.UM; U2 = Ak;
      gL = apply(inv(RAk), FLk); gR = apply(inv(RAk), FRk);
      if (k === '333*3') { cL = apply(inv(RAk), apply(Tk, g0.crL)); cR = apply(inv(RAk), apply(Tk, g0.crR)); }
      mapOldUR = I3; mapOldUM = I3; mapOldLower = Tk;
    }
    const tr = Tnew[0] + Tnew[4] + Tnew[8];
    if (tr <= 3 + 1e-7) continue;
    const len = Math.acosh((tr - 1) / 2);
    if (!best || len < best.len) best = { km, Tnew, Anew, U1, U2, gL, gR, cL, cR, mapOldLower, mapOldUM, mapOldUR, len };
  }

  const ax = axisOfTrans(best.Tnew);
  const Lp = ax.len;
  let invF = ax.invF;
  if (axisCoords(invF, best.Anew).h > 0) invF = mul(GH.rotate(GH.origin, PI), invF);
  const g2 = geodesicCoordsInFrame(invF, best.gL, best.gR);
  const Qcut = GH.fix(mul(boostX(-g2.u), invF), 1);

  const conePtInBest = { [mp1.lowerCone]: best.Anew, [fromUM ? oldC.mp.lowerCone : oldC.mp.upperMin]: best.U1, [fromUM ? oldC.mp.upperMax : oldC.mp.lowerCone]: best.U2 };
  const coneMapInOld = { [oldC.mp.lowerCone]: best.mapOldLower, [oldC.mp.upperMin]: best.mapOldUM, [oldC.mp.upperMax]: best.mapOldUR };
  const cUM = axisCoords(Qcut, conePtInBest[mp1.upperMin]);
  const twP = wrapHalf(cUM.u / Lp);

  let tauCp = tauC;
  if (k === '333*3') {
    const qMid = midH(apply(Qcut, best.cL), apply(Qcut, best.cR));
    const { hG: hGp } = pantsConeCuff(3, b, Lp);
    const Fgam = GH.frame([0, -Math.sinh(hGp), Math.cosh(hGp)], [Math.sinh(1), -Math.cosh(1) * Math.sinh(hGp), Math.cosh(1) * Math.cosh(hGp)]);
    const qm = apply(inv(Fgam), qMid);
    tauCp = wrapHalf(Math.atanh(qm[0] / qm[2]) / b);
  }

  const newC = coneFeatCentered(k, Lp, twP, bParam, tauCp, { perm: newPerm, thetas });
  const targetU = { [mp1.lowerCone]: Lp / 2, [mp1.upperMin]: twP * Lp, [mp1.upperMax]: twP * Lp + Lp / 2 };
  const newThetas = thetas.slice();
  for (const cIdx of [mp1.lowerCone, mp1.upperMin, mp1.upperMax]) {
    const M_cut = alignToSlot(coneMapInOld[cIdx], Qcut, oldC.rawPos[cIdx], targetU[cIdx], Lp);
    const F_old = GH.frame(oldC.rawPos[cIdx], oldC.rawPartner[cIdx]);
    const F_new = GH.frame(newC.rawPos[cIdx], newC.rawPartner[cIdx]);
    newThetas[cIdx] = thetas[cIdx] + thetaDelta(F_old, F_new, M_cut);
  }

  const Q = GH.fix(mul(newC.Pmat, mul(Qcut, inv(oldC.Pmat))), 1);
  return { k, perm: newPerm, orders: newPerm.map((c) => fam.baseOrders[c]), L: Lp, tw: twP, b: bParam, tau: tauCp, thetas: newThetas, Q, invQ: GH.fix(inv(Q), 1) };
}

export function recutO33(state, i, j) {
  const { perm, L, tw, thetas } = state;
  const fam = FAMILIES.o33;
  if (i === j || i < 0 || i > 3 || j < 0 || j > 3) throw new Error('recutO33: invalid pair');
  const bo = state.b ?? fam.defaultB;
  const tauO = state.tau ?? fam.defaultTau;
  const hb = bo / 2;

  const oldC = o33Centered(L, tw, bo, tauO, { perm, thetas });
  const others = [0, 1, 2, 3].filter((x) => x !== i && x !== j);
  const newPerm = [i, j, others[0], others[1]];
  const mp1 = o33Mapping(newPerm);

  // Same unordered partition -> Qcut = I3
  if (mp1.mode === oldC.mp.mode && (mp1.mode === 'split' || mp1.lowerCone === oldC.mp.lowerCone)) {
    const newC = o33Centered(L, tw, bo, tauO, { perm: newPerm, thetas });
    const Q = GH.fix(mul(newC.Pmat, inv(oldC.Pmat)), 1);
    return { k: 'o33', perm: newPerm, orders: newPerm.map((c) => fam.baseOrders[c]), L, tw, b: bo, tau: tauO, thetas: thetas.slice(), Q, invQ: GH.fix(inv(Q), 1) };
  }

  const g0 = oldC.cut;
  let Qcut, Lp, twP, tauOp, M_cone2_pre, M_cone3_pre, oldV2, oldV3, targetU2, targetU3;
  const newLowerIs = (c) => (mp1.mode === 'mixed' ? mp1.lowerCone === c : mp1.coneAM === c);

  if (oldC.mp.mode === 'mixed' && mp1.mode === 'split') {
    let best = null;
    for (let km = -2; km <= 2; km++) {
      const Tk = boostX(km * L), Bk = apply(Tk, g0.B_R), Tsp = mul(g0.R_AR, GH.rotate(Bk, TAU / 3));
      const tr = Tsp[0] + Tsp[4] + Tsp[8];
      if (tr <= 3 + 1e-7) continue;
      const len = Math.acosh((tr - 1) / 2);
      if (!best || len < best.len) best = { km, Tk, Bk, Tsp, len };
    }
    const ax = axisOfTrans(best.Tsp);
    Lp = ax.len;
    let invF = ax.invF;
    if (axisCoords(invF, g0.A_R).h > 0) invF = mul(GH.rotate(GH.origin, PI), invF);
    const posAM = newLowerIs(oldC.mp.lowerCone) ? g0.A_R : best.Bk;
    Qcut = GH.fix(mul(boostX(-axisCoords(invF, posAM).u), invF), 1);
    const invQ = GH.fix(inv(Qcut), 1);
    const cgP = geodesicCoordsInFrame(Qcut, g0.gP(-hb), g0.gP(hb));
    const cgM = geodesicCoordsInFrame(Qcut, apply(best.Tk, g0.gM(-hb)), apply(best.Tk, g0.gM(hb)));
    twP = wrapHalf((cgP.u + Lp / 4) / Lp);

    const { ho } = handleSplitGeom(bo, Lp);
    const TxM = boostX(cgM.u);
    const Fm = GH.frame(apply(TxM, [0, Math.sinh(ho), Math.cosh(ho)]), apply(TxM, [Math.sinh(1), Math.cosh(1) * Math.sinh(ho), Math.cosh(1) * Math.cosh(ho)]));
    const img = apply(Qcut, apply(mul(best.Tk, g0.H_glue), apply(invQ, cgP.footOnGam)));
    tauOp = wrapHalf(axisCoords(inv(Fm), img).u / bo);

    const cL = oldC.mp.lowerCone, cU = oldC.mp.upperCone;
    const uOf = { [cL]: mp1.coneAM === cL ? 0 : Lp / 2, [cU]: mp1.coneAM === cU ? 0 : Lp / 2 };
    const mOf = { [cL]: I3, [cU]: best.Tk };
    M_cone2_pre = mOf[2]; M_cone3_pre = mOf[3];
    oldV2 = oldC.rawPos[2]; oldV3 = oldC.rawPos[3];
    targetU2 = uOf[2]; targetU3 = uOf[3];
  } else if (oldC.mp.mode === 'split' && mp1.mode === 'mixed') {
    const lowIsOldAM = mp1.lowerCone === oldC.mp.coneAM;
    const Acone = lowIsOldAM ? g0.AM : g0.AL;
    const Tmix = mul(inv(GH.rotate(Acone, TAU / 3)), inv(g0.ToP));
    const ax = axisOfTrans(Tmix);
    Lp = ax.len;
    let invF = ax.invF;
    if (axisCoords(invF, Acone).h > 0) invF = mul(GH.rotate(GH.origin, PI), invF);
    const cgP0 = geodesicCoordsInFrame(invF, g0.cP(-hb), g0.cP(hb));
    Qcut = GH.fix(mul(boostX(-cgP0.u), invF), 1);
    const invQ = GH.fix(inv(Qcut), 1);
    const cgP = geodesicCoordsInFrame(Qcut, g0.cP(-hb), g0.cP(hb));
    const cgM = geodesicCoordsInFrame(Qcut, g0.cM(-hb), g0.cM(hb));
    twP = wrapHalf(cgM.u / Lp);

    const { hG: hGp } = pantsConeCuff(3, bo, Lp);
    const TxM = boostX(cgM.u);
    const Fm = GH.frame(apply(TxM, [0, Math.sinh(hGp), Math.cosh(hGp)]), apply(TxM, [Math.sinh(1), Math.cosh(1) * Math.sinh(hGp), Math.cosh(1) * Math.cosh(hGp)]));
    const img = apply(Qcut, apply(g0.H_glue, apply(invQ, cgP.footOnGam)));
    tauOp = wrapHalf(axisCoords(inv(Fm), img).u / bo);

    const cLow = mp1.lowerCone, cUp = mp1.upperCone;
    const mLow = lowIsOldAM ? I3 : boostX(-L);
    const mUp = I3;
    const mOf = { [cLow]: mLow, [cUp]: mUp };
    const uOf = { [cLow]: Lp / 2, [cUp]: twP * Lp + Lp / 2 };
    M_cone2_pre = mOf[2]; M_cone3_pre = mOf[3];
    oldV2 = oldC.rawPos[2]; oldV3 = oldC.rawPos[3];
    targetU2 = uOf[2]; targetU3 = uOf[3];
  } else {
    // Mixed -> Mixed
    let best = null;
    for (let km = -2; km <= 2; km++) {
      const Tk = boostX(km * L), Bk = apply(Tk, g0.B_R), RBk = GH.rotate(Bk, TAU / 3);
      const Tnew = mul(inv(RBk), g0.ToP);
      const tr = Tnew[0] + Tnew[4] + Tnew[8];
      if (tr <= 3 + 1e-7) continue;
      const len = Math.acosh((tr - 1) / 2);
      if (!best || len < best.len) best = { km, Tk, Bk, RBk, Tnew, len };
    }
    const ax = axisOfTrans(best.Tnew);
    Lp = ax.len;
    let invF = ax.invF;
    if (axisCoords(invF, best.Bk).h > 0) invF = mul(GH.rotate(GH.origin, PI), invF);
    const cgP0 = geodesicCoordsInFrame(invF, g0.gP(-hb), g0.gP(hb));
    Qcut = GH.fix(mul(boostX(-cgP0.u), invF), 1);
    const invQ = GH.fix(inv(Qcut), 1);
    const cgP = geodesicCoordsInFrame(Qcut, g0.gP(-hb), g0.gP(hb));
    const cgM = geodesicCoordsInFrame(Qcut, apply(best.Tk, g0.gM(-hb)), apply(best.Tk, g0.gM(hb)));
    twP = wrapHalf(cgM.u / Lp);

    const { hG: hGp } = pantsConeCuff(3, bo, Lp);
    const TxM = boostX(cgM.u);
    const Fm = GH.frame(apply(TxM, [0, Math.sinh(hGp), Math.cosh(hGp)]), apply(TxM, [Math.sinh(1), Math.cosh(1) * Math.sinh(hGp), Math.cosh(1) * Math.cosh(hGp)]));
    const img = apply(Qcut, apply(mul(best.Tk, g0.H_glue), apply(invQ, cgP.footOnGam)));
    tauOp = wrapHalf(axisCoords(inv(Fm), img).u / bo);

    const cLowNew = mp1.lowerCone, cUpNew = mp1.upperCone;
    const mOf = { [cLowNew]: best.Tk, [cUpNew]: inv(best.RBk) };
    const uOf = { [cLowNew]: Lp / 2, [cUpNew]: twP * Lp + Lp / 2 };
    M_cone2_pre = mOf[2]; M_cone3_pre = mOf[3];
    oldV2 = oldC.rawPos[2]; oldV3 = oldC.rawPos[3];
    targetU2 = uOf[2]; targetU3 = uOf[3];
  }

  const newC = o33Centered(Lp, twP, bo, tauOp, { perm: newPerm, thetas });
  const newThetas = thetas.slice();
  for (const [cIdx, M_pre, oldV, tU] of [[2, M_cone2_pre, oldV2, targetU2], [3, M_cone3_pre, oldV3, targetU3]]) {
    const M_cut = alignToSlot(M_pre, Qcut, oldV, tU, Lp);
    const F_old = GH.frame(oldC.rawPos[cIdx], oldC.rawPartner[cIdx]);
    const F_new = GH.frame(newC.rawPos[cIdx], newC.rawPartner[cIdx]);
    newThetas[cIdx] = thetas[cIdx] + thetaDelta(F_old, F_new, M_cut);
  }

  const Q = GH.fix(mul(newC.Pmat, mul(Qcut, inv(oldC.Pmat))), 1);
  return { k: 'o33', perm: newPerm, orders: newPerm.map((c) => fam.baseOrders[c]), L: Lp, tw: twP, b: bo, tau: tauOp, thetas: newThetas, Q, invQ: GH.fix(inv(Q), 1) };
}

/** Unified stationary re-cut across all 7 orbifold families. */
export function recut(state, i, j) {
  const mode = FAMILIES[state.k]?.mode;
  let res;
  if (mode === 'pillow') res = recut2222(state, i, j);
  else if (mode === 'cones') res = recutH(state, i, j);
  else if (mode === 'handle') return recutO33(state, i, j);
  else return recutConeFeat(state, i, j);
  return { ...res, b: state.b ?? 0, tau: state.tau ?? 0 };
}

/** Walk, legs, and highlighted cut data for the "Follow the tree" moment (pair-centred frame). */
export function followTreeData(state) {
  const { k, orders, L, tw } = state;
  const fam = FAMILIES[k];
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
  const toSegs = (vs) => { const out = []; for (let i = 0; i + 1 < vs.length; i++) out.push([vs[i], vs[i + 1]]); return out; };
  const K = Math.min(14, Math.ceil(5 / L) + 1);

  if (fam.mode === 'cones') {
    const c = L / 2, t = tw * L;
    const hA = hgt(orders[0], orders[1], L), hB = hgt(orders[1], orders[0], L);
    const hC = hgt(orders[2], orders[3], L), hD = hgt(orders[3], orders[2], L);
    const A0 = offH(-c / 2, hA, -1), B0 = offH(c / 2, hB, -1);
    const C0 = offH(t - c / 2, hC, 1), D0 = offH(t + c / 2, hD, 1);
    const Pmat = GH.fix(inv(GH.frame(GH.mix(A0, B0, 0.5), B0)), 1);
    const toPair = (v) => GH.norm(apply(Pmat, v));
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
    const cutPts = [];
    for (let i = -10; i <= 10; i++) cutPts.push(toPair(offH(0.75 * i, 0, 1)));
    const fA0 = offH(-c / 2, 0, 1), fB0 = offH(c / 2, 0, 1);
    const fC0 = offH(t - c / 2, 0, 1), fD0 = offH(t + c / 2, 0, 1);
    return {
      kind: 'H',
      fwdSegs: toSegs(fwdVerts),
      backSegs: toSegs(backVerts),
      cutPts,
      ends: [toPair(offH(-9, 0, 1)), toPair(offH(9, 0, 1))],
      legs: [[toPair(A0), toPair(fA0)], [toPair(B0), toPair(fB0)], [toPair(C0), toPair(fC0)], [toPair(D0), toPair(fD0)]],
      feet: [toPair(fA0), toPair(fC0)],
    };
  }

  // Generalized walk for 333*, 333*3, 333x, o33
  const c = fam.mode === 'handle'
    ? o33Centered(L, tw, state.b ?? fam.defaultB, state.tau ?? fam.defaultTau, { perm: state.perm, thetas: state.thetas })
    : coneFeatCentered(k, L, tw, state.b ?? fam.defaultB, state.tau ?? fam.defaultTau ?? 0, { perm: state.perm, thetas: state.thetas });
  const toPair = (v) => GH.norm(apply(c.Pmat, v));
  const cut = c.cut;

  let periodFwd, legPts;
  if (fam.mode === 'handle') {
    const hb = (state.b ?? fam.defaultB) / 2;
    if (cut.mode === 'mixed') {
      if (c.mp.lowerCone === state.perm[0] || c.mp.lowerCone === state.perm[1]) {
        periodFwd = [cut.A_L, cut.gP(-hb), cut.gP(hb), cut.A_R];
      } else {
        periodFwd = [cut.B_L, cut.gM(-hb), cut.gM(hb), cut.B_R];
      }
      legPts = [cut.A_R, cut.gP(hb), cut.B_R, cut.gM(hb)];
    } else if (c.mp.handlesPicked) {
      periodFwd = [cut.cP(-hb), cut.cP(hb), cut.cM(-hb), cut.cM(hb), cut.cP2(-hb)];
      legPts = [cut.cP(hb), cut.cM(-hb), cut.AM, cut.AR];
    } else {
      periodFwd = [cut.AL, cut.AM, cut.AR];
      legPts = [cut.AM, cut.AR, cut.cP(hb), cut.cM(-hb)];
    }
  } else if (c.mp.featPicked) {
    periodFwd = k === '333*3'
      ? [cut.A_L, cut.crL, cut.crR, cut.A_R]
      : [cut.A_L, cut.F_L, cut.F_R, cut.A_R];
    legPts = [cut.A_R, cut.footFeat, cut.UM, cut.UR];
  } else {
    periodFwd = [cut.UL, cut.UM, cut.UR];
    legPts = [cut.UM, cut.UR, cut.A_R, cut.footFeat];
  }

  const fwdVerts = [];
  for (let m = 0; m <= K; m++) {
    const Tm = boostX(m * L);
    for (let idx = m === 0 ? 0 : 1; idx < periodFwd.length; idx++) {
      fwdVerts.push(toPair(apply(Tm, periodFwd[idx])));
    }
  }
  const periodBack = periodFwd.slice().reverse();
  const backVerts = [];
  for (let m = 0; m <= K; m++) {
    const Tm = boostX(-m * L);
    for (let idx = m === 0 ? 0 : 1; idx < periodBack.length; idx++) {
      backVerts.push(toPair(apply(Tm, periodBack[idx])));
    }
  }

  const cutPts = [];
  for (let i = -10; i <= 10; i++) cutPts.push(toPair(offH(0.75 * i, 0, 1)));
  const footOf = (p) => { const ac = axisCoords(I3, p); return offH(ac.u, 0, 1); };
  const legs = legPts.map((p) => [toPair(p), toPair(footOf(p))]);
  return {
    kind: 'H',
    fwdSegs: toSegs(fwdVerts),
    backSegs: toSegs(backVerts),
    cutPts,
    ends: [toPair(offH(-9, 0, 1)), toPair(offH(9, 0, 1))],
    legs,
    feet: [toPair(footOf(legPts[0])), toPair(footOf(legPts[2]))],
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
  const shapes = placeCommas(GE, '2222', perm, home, partners, commas, thetas);
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

  const A0 = slotPos[slotA];
  let bestDist = Infinity, bestSign = 1, bestA = A0;
  for (const sgn of [1, -1]) {
    const vs = [sgn * v[0], sgn * v[1]];
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
  const rel = G.fix(mul(inv(M1), M0), 1);
  if (kind === 'E') {
    const ang = Math.atan2(rel[3], rel[0]), tx = rel[2], ty = rel[5];
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

// ---- 3D ball helpers (stadium loop, handle belt, feature anchors, twist bead)
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const ang3 = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot3(a, b))));

function packClosedLoop(pts) {
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
  return packClosedLoop(pts);
}

/** Closed ring around the 3D handle tube waist of o33, matching beadOnLoop(belt, tauO + 0.5). */
export function handleBeltLoop(built, radius = 0.24, m = 32) {
  const c = built.anchors[0].at();
  const n0 = built.layout.sites[0].site.n, n1 = built.layout.sites[1].site.n;
  const tAxis = unit3([n1[0] - n0[0], n1[1] - n0[1], n1[2] - n0[2]]);
  const e1 = unit3(cross3(tAxis, c));
  const e2 = unit3(cross3(tAxis, e1));
  const pts = [];
  for (let i = 0; i < m; i++) {
    const a = (TAU * i) / m;
    pts.push([
      c[0] + radius * (Math.cos(a) * e1[0] + Math.sin(a) * e2[0]),
      c[1] + radius * (Math.cos(a) * e1[1] + Math.sin(a) * e2[1]),
      c[2] + radius * (Math.cos(a) * e1[2] + Math.sin(a) * e2[2]),
    ]);
  }
  return packClosedLoop(pts);
}

/** Point fraction u in [0, 1) along a closed stadium or belt loop. */
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

/** Parts list passed to buildSurface(parts) for each of the 7 families. */
export function surfacePartsFor(k) {
  if (k === '333*') return [{ t: 'cone', n: 3 }, { t: 'star', corners: [] }, { t: 'cone', n: 3 }, { t: 'cone', n: 3 }];
  if (k === '333*3') return [{ t: 'cone', n: 3 }, { t: 'star', corners: [3] }, { t: 'cone', n: 3 }, { t: 'cone', n: 3 }];
  if (k === '333x') return [{ t: 'cone', n: 3 }, { t: 'x' }, { t: 'cone', n: 3 }, { t: 'cone', n: 3 }];
  if (k === 'o33') return [{ t: 'o' }, { t: 'cone', n: 3 }, { t: 'cone', n: 3 }];
  return (FAMILIES[k] || FAMILIES['3333']).baseOrders.map((n) => ({ t: 'cone', n }));
}

function nearestSite(L, p) {
  let best = 0, bv = -Infinity;
  for (let s = 0; s < L.sites.length; s++) {
    const v = dot3(p, L.sites[s].site.n);
    if (v > bv) { bv = v; best = s; }
  }
  return best;
}

/** Four tappable 3D feature anchors (splits o33 handle into o+ at site 0 and o- at site 1). */
export function featureAnchorsForBall(built, k = '3333') {
  const L = built.layout;
  const labels = (FAMILIES[k] || FAMILIES['3333']).featLabels;
  if (k === 'o33') {
    const p2 = built.anchors[1].at(), p3 = built.anchors[2].at();
    return [
      { p: L.sites[0].site.n.map((x) => 1.15 * x), site: 0, label: labels[0] },
      { p: L.sites[1].site.n.map((x) => 1.15 * x), site: 1, label: labels[1] },
      { p: p2, site: nearestSite(L, p2), label: labels[2] },
      { p: p3, site: nearestSite(L, p3), label: labels[3] },
    ];
  }
  return built.anchors.map((a, idx) => {
    const p = a.at();
    return { p, site: nearestSite(L, p), label: labels[idx] };
  });
}

/** Which dodecahedron sites the 4 features occupy, and which neighbouring pair gets the stadium loop. */
export function sitesForBall(built, pair, k = '3333') {
  const L = built.layout;
  const siteOf = featureAnchorsForBall(built, k).map((f) => f.site);
  const [a, b] = pair, sa = siteOf[a], sb = siteOf[b];
  if (L.sites[sa].toward.has(sb)) return { siteOf, loopSites: [sa, sb], complement: false };
  const others = [0, 1, 2, 3].filter((m) => m !== a && m !== b);
  return { siteOf, loopSites: [siteOf[others[0]], siteOf[others[1]]], complement: true };
}

// ---- Build the pattern model for pattern-ext.js from current state
export function buildPatternModel(state, { dark = false, follow = null } = {}) {
  const INK = [0.08, 0.09, 0.12];
  const AMBER = dark ? [0.941, 0.659, 0.188] : [0.902, 0.624, 0];
  const BLUE = dark ? [0.337, 0.706, 0.914] : [0, 0.447, 0.698];
  const fam = FAMILIES[state.k];
  let built;
  if (fam.mode === 'pillow') {
    built = pillowCentered(state.L, state.tw, { thetas: state.thetas, perm: state.perm });
  } else if (fam.mode === 'cones') {
    built = fourConeCentered(state.orders, state.L, state.tw, { thetas: state.thetas, perm: state.perm, k: state.k });
  } else if (fam.mode === 'handle') {
    built = o33Centered(state.L, state.tw, state.b ?? fam.defaultB, state.tau ?? fam.defaultTau, { thetas: state.thetas, perm: state.perm, dark });
  } else {
    built = coneFeatCentered(state.k, state.L, state.tw, state.b ?? fam.defaultB, state.tau ?? fam.defaultTau ?? 0, { thetas: state.thetas, perm: state.perm });
  }
  const { D, A, home, cutSeg, treeSeg, shapes } = built;

  const lines = [
    ...(built.extraLines || []),
    { a: treeSeg[0], b: treeSeg[1], color: INK, width: 2.3, alpha: 0.9, steps: 6 },
    { a: cutSeg[0], b: cutSeg[1], color: AMBER, width: 2.2, dash: [6, 4.5], alpha: 1, steps: 8 },
  ];
  const dots = [];
  if (!(follow && follow.active) && built.featDots) {
    for (const p of built.featDots) {
      dots.push({ p, color: BLUE, stroke: [1, 1, 1], r: 5.5 });
    }
  }

  if (follow && follow.active) {
    const fd = follow.data;
    const progress = follow.progress ?? 1;
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
    marks: built.marks ?? [A.cls[0], A.cls[1]],
  };
}
