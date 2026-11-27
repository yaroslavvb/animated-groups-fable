// handles.js — pure geometry and re-cut logic for "Two features, two handles" (3333, 2223, 2222).
// Ported from math-general.md (F1–F11), math-2222.md (§3.5, §11.9), orbifold-handles-hyperbolic-check.py (H0–H6),
// and engine-check.mjs (pillow2222, fourCone, stadium). Zero DOM dependencies.

import { geometry, mul, apply, inv, det, I3 } from '../../classification-of-surfaces/src/sym/geom.js';
import { makeDomain } from '../../classification-of-surfaces/src/sym/domains.js';
import { analyse } from '../../classification-of-surfaces/src/sym/orbifold.js';
import { commaAt, moved } from './rigid-print.js';
import { customSpec, canonText, readSignature, stillSpec } from './custom.js';
import { createPaisley } from './paisley.js';
import { createMulti, multiSpec } from './multi.js';
import { parse as parseSignature, tokensOf, bind, domainOf } from '../../classification-of-surfaces/src/sym/catalog.js';

const TAU = 2 * Math.PI;
const PI = Math.PI;

// ---- Exact Lorentz O+(2,1) & PSU(1,1) x Z2 hyperbolic isometries (exact at large L and twist)
export const invH = (M) => [M[0], M[3], -M[6], M[1], M[4], -M[7], -M[2], -M[5], M[8]];
const boostTo0 = (p) => { const [x, y, z] = p, k = 1 / (z + 1); return [1 + x * x * k, x * y * k, -x, x * y * k, 1 + y * y * k, -y, -x, -y, z]; };
const boostFrom0 = (p) => { const [x, y, z] = p, k = 1 / (z + 1); return [1 + x * x * k, x * y * k, x, x * y * k, 1 + y * y * k, y, x, y, z]; };
const normH = (v) => {
  const l = Math.sqrt(Math.abs(v[0] * v[0] + v[1] * v[1] - v[2] * v[2])) || 1;
  const s = v[2] < 0 ? -1 : 1;
  return [(s * v[0]) / l, (s * v[1]) / l, (s * v[2]) / l];
};

export const psuI = () => [1, 0, 0, 0, 0];
export const psuNorm = (g) => {
  const s = 1 / Math.sqrt(Math.max(1e-30, g[0] * g[0] + g[1] * g[1] - g[2] * g[2] - g[3] * g[3]));
  return [g[0] * s, g[1] * s, g[2] * s, g[3] * s, g[4]];
};
export const psuInv = (g) => (g[4] ? [g[0], g[1], -g[2], g[3], 1] : [g[0], -g[1], -g[2], -g[3], 0]);
export const psuMul = (g1, g2) => {
  const ar1 = g1[0], ai1 = g1[1], br1 = g1[2], bi1 = g1[3];
  const ar2 = g2[0], ai2 = g1[4] ? -g2[1] : g2[1];
  const br2 = g2[2], bi2 = g1[4] ? -g2[3] : g2[3];
  return psuNorm([
    (ar1 * ar2 - ai1 * ai2) + (br1 * br2 + bi1 * bi2),
    (ar1 * ai2 + ai1 * ar2) + (bi1 * br2 - br1 * bi2),
    (ar1 * br2 - ai1 * bi2) + (br1 * ar2 + bi1 * ai2),
    (ar1 * bi2 + ai1 * br2) + (bi1 * ar2 - br1 * ai2),
    g1[4] ^ g2[4],
  ]);
};
export const psuApplyDisc = (g, w) => {
  const u = w[0], v = g[4] ? -w[1] : w[1];
  const nr = g[0] * u - g[1] * v + g[2], ni = g[0] * v + g[1] * u + g[3];
  const dr = g[2] * u + g[3] * v + g[0], di = g[2] * v - g[3] * u - g[1];
  const d2 = dr * dr + di * di;
  return [(nr * dr + ni * di) / d2, (ni * dr - nr * di) / d2];
};
export const psuToSO21 = (g) => {
  const ar = g[0], ai = g[1], br = g[2], bi = g[3], s = g[4] ? -1 : 1;
  const a2r = ar * ar - ai * ai, a2i = 2 * ar * ai, b2r = br * br - bi * bi, b2i = 2 * br * bi;
  return [
    a2r + b2r, s * (b2i - a2i), 2 * (ar * br - ai * bi),
    a2i + b2i, s * (a2r - b2r), 2 * (ar * bi + ai * br),
    2 * (ar * br + ai * bi), s * 2 * (ar * bi - ai * br), ar * ar + ai * ai + br * br + bi * bi,
  ];
};
export const discDist = (w1, w2) => {
  const dx = w1[0] - w2[0], dy = w1[1] - w2[1];
  const r1 = w1[0] * w1[0] + w1[1] * w1[1], r2 = w2[0] * w2[0] + w2[1] * w2[1];
  const den = Math.max(1e-30, (1 - r1) * (1 - r2));
  return Math.acosh(1 + (2 * (dx * dx + dy * dy)) / den);
};
const psuBoostFrom0 = (p) => { const s = Math.sqrt(2 * (p[2] + 1)); return [s / 2, 0, p[0] / s, p[1] / s, 0]; };
const psuBoostTo0 = (p) => { const s = Math.sqrt(2 * (p[2] + 1)); return [s / 2, 0, -p[0] / s, -p[1] / s, 0]; };
const psuRot = (th) => [Math.cos(th / 2), Math.sin(th / 2), 0, 0, 0];
export const psuBoostX = (x) => [Math.cosh(x / 2), 0, Math.sinh(x / 2), 0, 0];
const psuFrame = (p, q) => {
  const qr = apply(boostTo0(p), q);
  return psuMul(psuBoostFrom0(p), psuRot(Math.atan2(qr[1], qr[0])));
};
export const psuRotate = (p, ang) => psuMul(psuBoostFrom0(p), psuMul(psuRot(ang), psuBoostTo0(p)));
const psuRotAtX = (x, h, sgn, ang) =>
  psuMul(psuBoostX(x), psuMul(psuRotate([0, sgn * Math.sinh(h), Math.cosh(h)], ang), psuBoostX(-x)));
const psuFit = (a0, a1, b0, b1, rev = false) =>
  psuMul(psuFrame(b0, b1), psuMul(rev ? [1, 0, 0, 0, 1] : psuI(), psuInv(psuFrame(a0, a1))));
const psuReflect = (a, b) => psuFit(a, b, a, b, true);

export function psuAxisOfTrans(gIn) {
  const g = gIn[0] < 0 ? [-gIn[0], -gIn[1], -gIn[2], -gIn[3], 0] : gIn;
  const ar = g[0], ai = g[1], br = g[2], bi = g[3];
  const s = Math.sqrt(Math.max(1e-30, ar * ar - 1));
  const bAbs = Math.hypot(br, bi);
  const len = 2 * Math.acosh(Math.max(1, ar));
  const phi = Math.atan2(bi, br);
  const c = Math.sqrt((bAbs + s) / (2 * s));
  const sh = ai / Math.sqrt(2 * s * (bAbs + s));
  const F = psuMul(psuRot(phi), [c, 0, 0, sh, 0]);
  return { len, F, invF: psuInv(F) };
}

export function so21ToPSU(M, flip) {
  const p = normH([M[2], M[5], M[8]]);
  const t0 = apply(boostTo0(p), [M[0], M[3], M[6]]);
  const g = psuMul(psuBoostFrom0(p), psuRot(Math.atan2(t0[1], t0[0])));
  const rev = (flip === true || flip === false) ? flip : det(M) < 0;
  return rev ? [g[0], g[1], g[2], g[3], 1] : g;
}

function makeExactH() {
  const G = geometry('H');
  G.inv = invH;
  G.fix = (M, hand) => {
    const sign = hand === 1 || hand === -1 ? hand : (det(M) < 0 ? -1 : 1);
    const p = G.norm([M[2], M[5], M[8]]);
    const t0 = apply(boostTo0(p), [M[0], M[3], M[6]]);
    const th = Math.atan2(t0[1], t0[0]), c = Math.cos(th), s = Math.sin(th);
    return mul(boostFrom0(p), [c, -sign * s, 0, s, sign * c, 0, 0, 0, 1]);
  };
  G.dist = (a, b) => {
    const d = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const dd = d[0] * d[0] + d[1] * d[1] - d[2] * d[2];
    if (dd < 4 && (dd >= 0 || Math.hypot(d[0], d[1], d[2]) < 1e-3 * (a[2] + b[2]))) {
      return 2 * Math.asinh(Math.sqrt(Math.max(0, dd)) / 2);
    }
    return Math.acosh(Math.max(1, a[2] * b[2] - a[0] * b[0] - a[1] * b[1]));
  };
  G.frame = (p, q) => {
    const qr = apply(boostTo0(p), q);
    const th = Math.atan2(qr[1], qr[0]), c = Math.cos(th), s = Math.sin(th);
    return mul(boostFrom0(p), [c, -s, 0, s, c, 0, 0, 0, 1]);
  };
  G.fit = (a0, a1, b0, b1, rev = false) => psuToSO21(psuFit(a0, a1, b0, b1, rev));
  G.reflect = (a, b) => psuToSO21(psuReflect(a, b));
  G.rotate = (p, ang) => {
    const c = Math.cos(ang), s = Math.sin(ang);
    return mul(mul(boostFrom0(p), [c, -s, 0, s, c, 0, 0, 0, 1]), boostTo0(p));
  };
  G.translate = (a, b) => (G.dist(a, b) < 1e-12 ? I3.slice() : mul(mul(G.frame(b, a), [-1, 0, 0, 0, -1, 0, 0, 0, 1]), invH(G.frame(a, b))));
  G.angle = (p, a, b) => {
    const B = boostTo0(p), qa = apply(B, a), qb = apply(B, b);
    return Math.abs(Math.atan2(qa[0] * qb[1] - qa[1] * qb[0], qa[0] * qb[0] + qa[1] * qb[1]));
  };
  G.lineDist = (p, a, b) => {
    const F = G.frame(a, b), n = [F[1], F[4], F[7]];
    return Math.asinh(Math.abs(p[0] * n[0] + p[1] * n[1] - p[2] * n[2]));
  };
  G.foot = (p, a, b) => {
    const F = G.frame(a, b), n = [F[1], F[4], F[7]];
    const s = p[0] * n[0] + p[1] * n[1] - p[2] * n[2];
    return G.norm([p[0] - s * n[0], p[1] - s * n[1], p[2] - s * n[2]]);
  };
  return G;
}

export const GH = makeExactH();
const multi = createMulti({ GH, psu: { mul: psuMul, inv: psuInv, rotate: psuRotate, toSO21: psuToSO21 } });
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
    defaultL: 2 * Math.acosh(2),
    defaultTw: 0,
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
    defaultL: Math.acosh(2),
    defaultTw: 0,
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
    defaultL: 3.014617,
    defaultTw: 0.042514,
    defaultB: 1.534394,
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
    defaultL: 3.221358,
    defaultTw: 0.061403,
    defaultB: 2.5122,
    bRange: [0.4, 3.2],
    bLabel: 'Mirror len',
    defaultTau: 0.269155,
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
    defaultL: 3.21495,
    defaultTw: 0.032356,
    defaultB: 1.265203,
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
    defaultL: 3.588202,
    defaultTw: -0.145361,
    defaultB: 2.039494,
    bRange: [0.4, 3.0],
    bLabel: 'Handle len',
    defaultTau: 0,
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
    defaultL: 1,
    defaultTw: 0,
    baseRange: [Math.SQRT1_2, Math.SQRT2],
    maxRange: [0.5, 2.0],
  },
};

export function normalizeFamilyKey(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/∗/g, '*').replace(/×/g, 'x');
  if (FAMILIES[s]) return s;
  const t = canonText(s);          // the same signature however it was typed: "2 2 2 2", "3 3 3 ∗ 3", "x234"
  if (t && FAMILIES[t]) return t;
  // any other signature of one of the engine's shapes (custom.js) becomes a family the first time it is asked for,
  // on the numbers of the built-in family of its shape, with its own orders
  const spec = customSpec(s);
  if (spec) {
    if (!FAMILIES[spec.k]) FAMILIES[spec.k] = { ...FAMILIES[CUSTOM_BASE[spec.mode]], ...spec, ...canonicalDefaults(spec), custom: true };
    return spec.k;
  }
  // five or six cone points (multi.js): a pair, a cut, a Length and a Twist for every two of them, in the order named
  const sig = readSignature(s), more = sig && multiSpec(sig);
  if (more) {
    if (!FAMILIES[more.k]) {
      const d = multi.defaults(more.orders);
      // (a Length from 1 to 5: a shorter cut has a collar so wide, and a longer one runs so far, that the tile
      // round one point reaches further than the numbers carry. Measured over 3,000 random shapes: none without a
      // tile from 1.2 to 4.5, one from 1 to 5, one in a hundred from 0.6 to 6: multi.js dirichlet)
      FAMILIES[more.k] = { ...more, baseOrders: more.orders.slice(), defaultM: '', defaultL: d.L[0], defaultTw: 0, defaults: { L: d.L.slice(), tw: d.tw.slice() }, baseRange: [0.8, 5.5], maxRange: [0.7, 6.0], custom: true };
    }
    return more.k;
  }
  // any other signature with a pattern: shown as the Classification of Surfaces page shows it, the pair controls off
  const still = sig && stillSpec(sig);
  if (still) {
    if (!FAMILIES[still.k]) FAMILIES[still.k] = { ...still, baseOrders: [], defaultM: '', defaultL: 1, defaultTw: 0, baseRange: [0.6, 5.0], maxRange: [0.4, 7.0], custom: true };
    return still.k;
  }
  return null;
}
/**
 * The numbers at which a typed family is the orbifold the Classification of Surfaces page draws for its signature.
 * Four cone points p q r s: that page's tile is a quadrilateral with corners pi/p .. pi/s round an inscribed circle
 * and its mirror image, so the cut between {p, q} and {s, r} has no twist, the corners run p, q, r, s round it
 * (this page's A, B, D, C), and its length follows from the side p-q (F1). With a cuff the numbers stay those of
 * the built-in family of the shape: finding that page's metric there would take solving for four numbers.
 */
function canonicalDefaults(spec) {
  if (spec.mode !== 'cones') return {};
  try {
    const sig = parseSignature(spec.k), Dc = sig ? domainOf(sig) : null, cell = Dc && Dc.cells && Dc.cells[0];
    if (!cell || cell.verts.length !== 4 || Dc.G.kind !== 'H') return {};
    const [p, q] = spec.baseOrders, L = pairLength(p, q, Dc.G.dist(cell.verts[0], cell.verts[1]));
    return Number.isFinite(L) && L > 0 ? { defaultM: '0132', defaultL: L, defaultTw: 0 } : {};
  } catch (err) { return {}; }
}
const CUSTOM_BASE = { cones: '3333', 'cone-star': '333*', 'cone-star3': '333*3', 'cone-x': '333x', handle: 'o33' };
/** The orders of a cone-and-cuff family's three cone points by the place each takes in the cut. */
const roleOrders = (fam, mp) => ({ low: fam.baseOrders[mp.lowerCone], um: fam.baseOrders[mp.upperMin], ur: fam.baseOrders[mp.upperMax] });

/**
 * Commas for a custom family: one a cone point, none on a cuff, and among four cone points one of the lowest
 * order goes bare (as the fourth of 3333 does). A half-turn point takes the small commas of 2223. A cone point of
 * order n >= 3 takes the commas of 3333, put further out as n grows so that its n copies round the point keep the
 * room they have round a 3 (sinh(rho) sin(pi / n) held).
 */
function customCommas(fam) {
  const THREE = [{ which: 'big', rho: 0.38, size: 0.175, theta: 1.9 }, { which: 'big', rho: 0.33, size: 0.13, theta: 2.6 }, { which: 'small', rho: 0.29, size: 0.095, theta: 2.2 }];
  const TWO = [{ which: 'big', rho: 0.18, size: 0.09, theta: -PI / 2 }, { which: 'small', rho: 0.15, size: 0.068, theta: -PI / 2 }, { which: 'big', rho: 0.16, size: 0.075, theta: -PI / 2 }];
  const cones = [0, 1, 2, 3].filter((f) => fam.baseOrders[f] > 1);
  let bare = -1;
  if (cones.length === 4) { const low = Math.min(...fam.baseOrders); bare = fam.baseOrders.lastIndexOf(low); }
  const out = [null, null, null, null];
  let j = 0;
  for (const f of cones) {
    if (f === bare) continue;
    const n = fam.baseOrders[f], sp = (n === 2 ? TWO : THREE)[j++ % 3];
    out[f] = n <= 3 ? { ...sp } : { ...sp, rho: Math.asinh((Math.sinh(sp.rho) * Math.sin(PI / 3)) / Math.sin(PI / n)) };
  }
  return out;
}

export function defaultCommas(k) {
  if (FAMILIES[k]) return paisley.specs(k);          // the print of the Classification of Surfaces page (paisley.js); what follows is the print before it
  return smallCommas(k);
}
/** The small commas the page had until Thu 26 Nov 2026: one by each cone point, sized to stay clear at every setting. */
export function smallCommas(k) {
  if (FAMILIES[k] && FAMILIES[k].custom) return customCommas(FAMILIES[k]);
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

function edgesFromPairs(n, pairs) {
  const edges = new Array(n);
  for (const p of pairs) {
    if (p.mirror) edges[p.a] = { mirror: true };
    else {
      edges[p.a] = { to: p.b, rev: !!p.rev };
      edges[p.b] = { to: p.a, rev: !!p.rev };
    }
  }
  return edges;
}

function buildCenteredDomain(symVerts, edges, P_symToPair, symAt = null) {
  const D_sym = makeDomain(GH, symVerts, edges, symAt ? { at: symAt } : {});
  const A_sym = analyse(D_sym);

  const n = symVerts.length;
  const maps2_sym = new Array(n);
  for (let i = 0; i < n; i++) {
    const e = edges[i];
    const a = symVerts[i], b = symVerts[(i + 1) % n];
    if (e.mirror) {
      maps2_sym[i] = psuReflect(a, b);
    } else if (e.to > i) {
      const c = symVerts[e.to], d = symVerts[(e.to + 1) % n];
      const g = e.rev ? psuFit(c, d, a, b, true) : psuFit(c, d, b, a, false);
      maps2_sym[i] = g;
      maps2_sym[e.to] = psuInv(g);
    }
  }

  const invP = psuInv(P_symToPair);
  const maps2 = new Array(n);
  for (let i = 0; i < n; i++) {
    const e = edges[i];
    if (e.mirror) maps2[i] = psuMul(P_symToPair, psuMul(maps2_sym[i], invP));
    else if (e.to > i) {
      const g = psuMul(P_symToPair, psuMul(maps2_sym[i], invP));
      maps2[i] = g;
      maps2[e.to] = psuInv(g);
    }
  }
  const maps = maps2.map(psuToSO21);
  const M_s2p = psuToSO21(P_symToPair);
  const toPairFromSym = (v) => GH.norm(apply(M_s2p, v));
  const verts = symVerts.map(toPairFromSym);
  const at = toPairFromSym(D_sym.at);
  const glides = A_sym.glides.map((g) => ({ ...g, seg: g.seg && [toPairFromSym(g.seg[0]), toPairFromSym(g.seg[1])] }));
  const D = makeDomain(GH, verts, edges, { at });
  const A = { ...A_sym, maps, maps2, glides };
  return { D, A };
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
  const len = Math.acosh(Math.max(1, (M[0] + M[4] + M[8] - 1) / 2));
  return { len, p0, p1, F, invF: GH.fix(invH(F), 1) };
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
  if (!fam || fam.mode === 'still') return { d: 0, mDist: 0 };
  if (fam.mode === 'multi') {
    const b = multi.build(state.orders, state.Ls, state.tws), cut = b.cuts[state.active || 0];
    return { d: GH.dist(cut.A, cut.B), mDist: GH.lineDist(GH.mix(cut.A, cut.B, 0.5), cut.seg[0], cut.seg[1]) };
  }
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
    invQ: GH.fix(invH(Q), 1),
  };
}

// ---- Hyperbolic tile & pattern model in pair-centred frame
export function fourConeCentered(orders, L, tw, { commas = null, thetas = null, perm = [0, 1, 2, 3], k = '3333' } = {}) {
  const [p, q, r, s] = orders;
  const c = L / 2, t = tw * L;
  const shift = t >= 0 ? -c / 2 + t / 2 : c / 2 + t / 2;
  const hA = hgt(p, q, L), hB = hgt(q, p, L), hC = hgt(r, s, L), hD = hgt(s, r, L);
  const A_s = offH(-c / 2 - shift, hA, -1), B_s = offH(c / 2 - shift, hB, -1);
  const C_s = offH(t - c / 2 - shift, hC, 1), D_s = offH(t + c / 2 - shift, hD, 1);
  const Ds_s = offH(t - 1.5 * c - shift, hD, 1), Bs_s = offH(-1.5 * c - shift, hB, -1);
  const Ap_s = offH(1.5 * c - shift, hA, -1), Cp_s = offH(t + 1.5 * c - shift, hC, 1);

  const symVerts = t >= 0 ? [A_s, B_s, D_s, C_s, Ds_s, Bs_s] : [B_s, Ap_s, Cp_s, D_s, C_s, A_s];
  const symAt = t >= 0
    ? GH.mix(GH.mix(A_s, D_s, 0.5), GH.mix(B_s, C_s, 0.5), 0.47)
    : GH.mix(GH.mix(B_s, Cp_s, 0.5), GH.mix(Ap_s, C_s, 0.5), 0.47);
  const P_symToPair = psuInv(psuFrame(midH(A_s, B_s), B_s));
  const M_s2p = psuToSO21(P_symToPair);
  const toPairFromSym = (v) => GH.norm(apply(M_s2p, v));
  const P_psu = psuMul(P_symToPair, psuBoostX(-shift));
  const Pmat = psuToSO21(P_psu);

  const edges = [5, 4, 3, 2, 1, 0].map((to) => ({ to, rev: false }));
  const { D, A } = buildCenteredDomain(symVerts, edges, P_symToPair, symAt);

  // Continuous canonical pair-centred cut segment of exact length L = 2c; when either pair is (2, 2), its geodesic
  // is stabilized by two half-turns with fundamental segment [A, B] of length L/2 so emitting length L would double-cover it.
  const cutA = GH.norm(apply(Pmat, offH(-c, 0, 1)));
  const cutB = GH.norm(apply(Pmat, offH(c, 0, 1)));
  const home = [A_s, B_s, C_s, D_s].map(toPairFromSym);
  const partners = [home[1], home[0], home[3], home[2]];
  const cutOnPicked = p === 2 && q === 2;
  const cutOnFar = r === 2 && s === 2;
  const cutOnTree = cutOnPicked || cutOnFar;
  const cutSeg = cutOnPicked ? [home[0], home[1]] : cutOnFar ? [home[2], home[3]] : [cutA, cutB];

  const shapes = placeCommas(GH, k, perm, home, partners, commas, thetas);

  return { D, A, home, cutSeg, cutOnTree, cutOnPicked, cutOnFar, treeSeg: [home[0], home[1]], farTreeSeg: [home[2], home[3]], Pmat, P_psu, shapes, markRefs: buildMarkRefs(GH, k, perm, D, A, home, partners, thetas) };
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
    if (sp.shapes) {
      // outlines given in the feature's own frame (paisley.js): turned with the frame's angle, carried by the frame
      const a = th - sp.theta, c = Math.cos(a), sn = Math.sin(a), FR = mul(F, [c, -sn, 0, sn, c, 0, 0, 0, 1]);
      for (const sh of sp.shapes) shapes.push(moved(sh, FR));
    } else shapes.push(moved(commaAt(G, G.polar(sp.rho, th), sp.size, th + 1.3, sp.which, 2.0), F));
  }
  return shapes;
}

function buildMarkRefs(G, k, perm, D, A, home, partners, thetas) {
  const fam = FAMILIES[k];
  const specs = defaultCommas(k);
  const angles = thetas || specs.map((sp) => (sp ? sp.theta : 0));
  const refs = {};
  for (let slot = 0; slot < 4; slot++) {
    const feat = perm[slot];
    if (fam.baseOrders[feat] <= 1) continue;
    const p = home[slot], partner = partners[slot];
    let bestV = -1, bestD = Infinity;
    for (let vi = 0; vi < D.n; vi++) {
      const d = G.dist(p, D.verts[vi]);
      if (d < bestD) { bestD = d; bestV = vi; }
    }
    if (bestV < 0 || bestD > 1e-5) continue;
    const cid = A.cls[bestV];
    const th0 = specs[feat] ? specs[feat].theta : 0;
    const F = G.frame(p, partner);
    const a = angles[feat] - th0;
    refs[cid] = { v: bestV, dir: apply(F, [Math.cos(a), Math.sin(a), 0]) };
  }
  return refs;
}

function thetaDeltaPsu(pOld, partOld, pNew, partNew, M_cut_psu) {
  const r = psuMul(psuInv(psuFrame(pNew, partNew)), psuMul(M_cut_psu, psuFrame(pOld, partOld)));
  return Math.atan2(2 * r[0] * r[1], r[0] * r[0] - r[1] * r[1]);
}

function cutEndpoints(u, v) {
  const den = u[1] - v[1];
  const frac = Math.abs(den) < 1e-15 ? 0 : u[1] / den;
  return GH.norm([u[0] + frac * (v[0] - u[0]), 0, u[2] + frac * (v[2] - u[2])]);
}

// ---- Cone + geodesic cuff families (333*, 333*3, 333x)
function buildConeFeatCut(k, L, tw, bParam, tauC = 0, ord = { low: 3, um: 3, ur: 3 }) {
  const fam = FAMILIES[k];
  const b = (fam.bMult || 1) * bParam;
  const { D: Ddist, hA, hG } = pantsConeCuff(ord.low, b, L);
  const hU = hgt(ord.um, ord.ur, L), hV = hgt(ord.ur, ord.um, L);          // the far pair: UM (order um), UL = UR (order ur)
  const t = tw * L;
  const symShift = t / 2;
  const gam = (u) => [Math.sinh(u), -Math.cosh(u) * Math.sinh(hG), Math.cosh(u) * Math.cosh(hG)];
  const gamS = (u) => GH.norm(apply(boostX(-symShift), gam(u)));
  const A_L = offH(-L / 2, hA, -1), A_R = offH(L / 2, hA, -1);
  const UL = offH(t - L / 2, hV, 1), UM = offH(t, hU, 1), UR = offH(t + L / 2, hV, 1);
  const F_L = gam(-b / 2), F_R = gam(b / 2);

  const A_Ls = offH(-L / 2 - symShift, hA, -1), A_Rs = offH(L / 2 - symShift, hA, -1);
  const UL_s = offH(symShift - L / 2, hV, 1), UM_s = offH(symShift, hU, 1), UR_s = offH(symShift + L / 2, hV, 1);
  const F_Ls = gamS(-b / 2), F_Rs = gamS(b / 2);

  let symVerts, pairs, crL = null, crR = null, crL_s = null, crR_s = null, footFeat = F_R, footFeat_s = F_Rs, footCorner = null, footCorner_s = null, featDist = Ddist, wMir = 0;
  let footAlt = null, footAlt_s = null, footCornerAlt = null, footCornerAlt_s = null, featDistAlt = Infinity;          // a mirror with a corner: the next shortest arc (below)
  if (fam.mode === 'cone-star') {
    symVerts = [F_Ls, F_Rs, A_Rs, UR_s, UM_s, UL_s, A_Ls];
    pairs = [{ a: 0, mirror: true }, { a: 1, b: 6 }, { a: 2, b: 5 }, { a: 3, b: 4 }];
  } else if (fam.mode === 'cone-x') {
    const F_Ms = gamS(0);
    symVerts = [F_Ls, F_Ms, F_Rs, A_Rs, UR_s, UM_s, UL_s, A_Ls];
    pairs = [{ a: 0, b: 1, rev: true }, { a: 2, b: 7 }, { a: 3, b: 6 }, { a: 4, b: 5 }];
  } else {
    const phi = PI / (2 * (fam.corner || 3));          // half the corner's angle: the mirrors cross at pi / n
    wMir = Math.asinh(Math.cos(phi) / Math.sinh(b / 2));
    const s = Math.atanh(Math.tanh(b / 2) * Math.cosh(wMir));
    const mir = (u) => [Math.sinh(u), -Math.cosh(u) * Math.sinh(wMir), Math.cosh(u) * Math.cosh(wMir)];
    const M = GH.fit(offH(-b / 2, 0, -1), offH(b / 2, 0, -1), gam(tauC * b - b / 2), gam(tauC * b + b / 2), false);
    crL = apply(M, mir(-s));
    crR = apply(M, mir(s));
    crL_s = GH.norm(apply(boostX(-symShift), crL));
    crR_s = GH.norm(apply(boostX(-symShift), crR));
    symVerts = [crL_s, crR_s, A_Rs, UR_s, UM_s, UL_s, A_Ls];
    pairs = [{ a: 0, mirror: true }, { a: 1, b: 6 }, { a: 2, b: 5 }, { a: 3, b: 4 }];

    const TF_s = psuFit(F_Ls, F_Rs, F_Rs, gamS(1.5 * b), false);
    const invTF_s = psuInv(TF_s);
    let bestD = Infinity, bestM = 0;
    const feet = [];
    for (let m = -2; m <= 2; m++) {
      let Tm = psuI();
      const step = m >= 0 ? TF_s : invTF_s;
      for (let q = 0; q < Math.abs(m); q++) Tm = psuMul(step, Tm);
      const TmMat = psuToSO21(Tm);
      const cL = apply(TmMat, crL_s), cR = apply(TmMat, crR_s);
      const Fm = GH.frame(cL, cR);
      const qa = apply(invH(Fm), A_Rs);
      const segLen = GH.dist(cL, cR);
      const uRaw = Math.atanh(Math.max(-1 + 1e-15, Math.min(1 - 1e-15, qa[0] / qa[2])));
      const u = Math.max(0, Math.min(segLen, uRaw));
      const cand = apply(Fm, [Math.sinh(u), 0, Math.cosh(u)]);
      const dc = GH.dist(A_Rs, cand);
      feet.push({ m, dc, cand, cL, square: uRaw > 1e-9 && uRaw < segLen - 1e-9 });
      if (dc < bestD - 1e-12) { bestD = dc; footFeat_s = cand; footCorner_s = cL; bestM = m; }
    }
    footFeat = GH.norm(apply(boostX(symShift), footFeat_s));
    footCorner = GH.norm(apply(boostX(symShift), footCorner_s));
    featDist = bestD;
    // The next shortest arc: square on another wall of the mirror. The tree is the SHORTEST arc from the cone point
    // to the mirror, and at Corner shift 0 the cone point stands on the bisector of the mirror's corner: its two
    // walls are equally near (the corner itself is further), and the nearest point of the mirror passes from one
    // wall to the other without crossing what lies between. Drawn alone, the tree turns about the cone point in
    // one step there. So near that tie both arcs are drawn, cross-faded (cornerFade, buildPatternModel).
    let alt = null;
    for (const f of feet) if (f.m !== bestM && f.square && (!alt || f.dc < alt.dc)) alt = f;
    if (alt) {
      footAlt_s = alt.cand; footCornerAlt_s = alt.cL; featDistAlt = alt.dc;
      footAlt = GH.norm(apply(boostX(symShift), footAlt_s));
      footCornerAlt = GH.norm(apply(boostX(symShift), footCornerAlt_s));
    }
  }

  const edges = edgesFromPairs(symVerts.length, pairs);
  const { D, A } = buildCenteredDomain(symVerts, edges, psuBoostX(symShift));
  const TF = GH.fit(F_L, F_R, F_R, gam(1.5 * b), false);
  const R_AR_psu = psuRotAtX(L / 2, hA, -1, TAU / ord.low);
  const R_UM_psu = psuRotAtX(t, hU, 1, TAU / ord.um);
  const R_UR_psu = psuRotAtX(t + L / 2, hV, 1, TAU / ord.ur);
  return {
    D, A, symVerts, edges, symShift, ord,
    A_L, A_R, UL, UM, UR, F_L, F_R, crL, crR, footFeat, footCorner, featDist,
    A_Ls, A_Rs, UL_s, UM_s, UR_s, F_Ls, F_Rs, crL_s, crR_s, footFeat_s, footCorner_s,
    footAlt, footCornerAlt, featDistAlt, footAlt_s, footCornerAlt_s,
    hA, hG, hU, b, wMir,
    R_AR: psuToSO21(R_AR_psu), R_AR_psu,
    R_UM: psuToSO21(R_UM_psu), R_UM_psu,
    R_UR: psuToSO21(R_UR_psu), R_UR_psu,
    T_cut: boostX(L),
    TF,
    cutRawA: cutEndpoints(A_L, UL),
    cutRawB: cutEndpoints(A_R, UR),
  };
}

/**
 * A mirror with a corner, by Corner shift (in turns): how strongly the shortest arc from the cone point to the
 * mirror is drawn (main) and the next shortest (alt). At Corner shift 0 the two are equally short, mirror images
 * of each other, and the shortest changes walls: there each is drawn half. Away from 0 the second fades out, gone
 * at CORNER_FADE of a turn. main + alt = 1.
 * His ask, Thu 26 Nov 2026, on 234*2 ("If I modify the corner shift here, the tree, the 'follow the tree line,'
 * jumps rapidly. Is that necessary here?"), and of three ways offered: "make it a cross-fade".
 */
export const CORNER_FADE = 0.06;
export function cornerFade(tauC) {
  const t = Math.abs(tauC - Math.round(tauC)), x = Math.min(1, t / CORNER_FADE), s = x * x * (3 - 2 * x);
  return { main: 0.5 + 0.5 * s, alt: 0.5 - 0.5 * s };
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

function coneFeatTreeToCut(cut) {
  const { A_R, footFeat, R_AR } = cut;
  const invR = invH(R_AR);
  let best = Math.min(
    segDistToXAxis(A_R, footFeat),
    segDistToXAxis(apply(R_AR, A_R), apply(R_AR, footFeat)),
    segDistToXAxis(apply(invR, A_R), apply(invR, footFeat)),
  );
  // a cone point of order 4 or more has further copies of the edge round it than the edge and its two nearest turns
  let M = R_AR;
  for (let j = 2; j < (cut.ord ? cut.ord.low : 3) - 1; j++) {
    M = mul(R_AR, M);
    best = Math.min(best, segDistToXAxis(apply(M, A_R), apply(M, footFeat)));
  }
  return best;
}

function buildConeFeatCutFromState(state) {
  const fam = FAMILIES[state.k];
  const perm = state.perm || fam.defaultM.split('').map(Number);
  const bParam = state.b ?? fam.defaultB;
  const tauC = state.tau ?? fam.defaultTau ?? 0;
  const mp = coneFeatMapping(state.k, perm);
  const ord = roleOrders(fam, mp);
  const cut = buildConeFeatCut(state.k, state.L, state.tw, bParam, tauC, ord);
  const d = mp.featPicked ? cut.featDist : pairDistance(ord.um, ord.ur, state.L);
  const mDist = mp.featPicked ? coneFeatTreeToCut(cut) : treeToCut(ord.um, ord.ur, state.L).m;
  return { ...cut, ...mp, perm, d, mDist };
}

export function coneFeatCentered(k, L, tw, bParam, tauC = 0, { commas = null, thetas = null, perm = [0, 1, 2, 3] } = {}) {
  const fam = FAMILIES[k], fi = fam.featIdx;
  const mp = coneFeatMapping(k, perm);
  const ord = roleOrders(fam, mp);
  const cut = buildConeFeatCut(k, L, tw, bParam, tauC, ord);
  const isX = fam.mode === 'cone-x';

  const rawPos = new Array(4), rawPartner = new Array(4), clsOfFeat = new Array(4).fill(-1);
  rawPos[mp.lowerCone] = cut.A_R; rawPartner[mp.lowerCone] = cut.F_R; clsOfFeat[mp.lowerCone] = cut.A.cls[isX ? 3 : 2];
  rawPos[mp.upperMin] = cut.UM; rawPartner[mp.upperMin] = cut.UR; clsOfFeat[mp.upperMin] = cut.A.cls[isX ? 5 : 4];
  rawPos[mp.upperMax] = cut.UR; rawPartner[mp.upperMax] = cut.UM; clsOfFeat[mp.upperMax] = cut.A.cls[isX ? 4 : 3];
  rawPos[fi] = cut.footFeat; rawPartner[fi] = cut.A_R;
  clsOfFeat[fi] = fam.mode === 'cone-star3' ? cut.A.cls[0] : -1;

  const symPos = new Array(4), symPartner = new Array(4);
  symPos[mp.lowerCone] = cut.A_Rs; symPartner[mp.lowerCone] = cut.F_Rs;
  symPos[mp.upperMin] = cut.UM_s; symPartner[mp.upperMin] = cut.UR_s;
  symPos[mp.upperMax] = cut.UR_s; symPartner[mp.upperMax] = cut.UM_s;
  symPos[fi] = cut.footFeat_s; symPartner[fi] = cut.A_Rs;

  const framePos = symPos.slice();
  if (fam.mode === 'cone-star3') {
    framePos[fi] = GH.norm(apply(
      GH.frame(cut.A_Rs, cut.F_Rs),
      GH.polar(GH.dist(cut.A_Rs, cut.F_Rs) + cut.wMir, 0),
    ));
  }

  const pL_sym = framePos[perm[0]], pR_sym = framePos[perm[1]];
  const P_symToPair = psuInv(psuFrame(midH(pL_sym, pR_sym), pR_sym));
  const P_psu = psuMul(P_symToPair, psuBoostX(-cut.symShift));
  const Pmat = psuToSO21(P_psu);
  const M_s2p = psuToSO21(P_symToPair);
  const toPairFromSym = (v) => GH.norm(apply(M_s2p, v));
  const { D, A } = buildCenteredDomain(cut.symVerts, cut.edges, P_symToPair);

  const home = perm.map((f) => toPairFromSym(symPos[f]));
  const canonPartners = perm.map((f) => toPairFromSym(symPartner[f]));
  const shapes = placeCommas(GH, k, perm, home, canonPartners, commas, thetas);

  const featDots = mp.featPicked ? [toPairFromSym(cut.footFeat_s)] : [];
  const marks = [clsOfFeat[perm[0]], clsOfFeat[perm[1]]].filter((c) => c >= 0);
  const x0_sym = axisCoords(I3, midH(pL_sym, pR_sym)).u;

  return {
    D,
    A,
    cut,
    mp,
    home,
    cutSeg: [toPairFromSym(offH(x0_sym - L / 2, 0, 1)), toPairFromSym(offH(x0_sym + L / 2, 0, 1))],
    treeSeg: [home[0], home[1]],
    farTreeSeg: [home[2], home[3]],
    Pmat,
    P_psu,
    rawPos,
    rawPartner,
    featDots,
    marks,
    extraLines: [],
    d: mp.featPicked ? cut.featDist : pairDistance(ord.um, ord.ur, L),
    mDist: mp.featPicked ? coneFeatTreeToCut(cut) : treeToCut(ord.um, ord.ur, L).m,
    shapes,
    markRefs: buildMarkRefs(GH, k, perm, D, A, home, canonPartners, thetas),
    // a mirror with a corner: the next shortest arc from the cone point to the mirror (seg: cone point, foot), how
    // strongly each of the two is drawn (cornerFade), and whether they are the far pair's tree (the mirror not picked)
    treeFade: cut.footAlt_s ? { ...cornerFade(tauC), far: !mp.featPicked, seg: [toPairFromSym(cut.A_Rs), toPairFromSym(cut.footAlt_s)], length: cut.featDistAlt } : null,
  };
}

// ---- Handle family o33 ({o+, o-, 3_a, 3_b})
function buildO33Mixed(L, tw, bo, tauO = 0, pLow = 3, pUp = 3) {
  const { D: Ddist, hA, hG } = pantsConeCuff(pLow, bo, L);
  const { D: DdistUp, hA: hB, hG: hGu } = pantsConeCuff(pUp, bo, L);
  const t = tw * L, symShift = t / 2, hb = bo / 2;
  const baseP = (u) => [Math.sinh(u), -Math.cosh(u) * Math.sinh(hG), Math.cosh(u) * Math.cosh(hG)];
  const baseM = (u) => [Math.sinh(u), Math.cosh(u) * Math.sinh(hGu), Math.cosh(u) * Math.cosh(hGu)];
  const gP = baseP;
  const gM = (u) => apply(boostX(t), baseM(u));
  const gP_s = (u) => GH.norm(apply(boostX(-symShift), baseP(u)));
  const gM_s = (u) => GH.norm(apply(boostX(symShift), baseM(u)));

  const A_L = offH(-L / 2, hA, -1), A_R = offH(L / 2, hA, -1);
  const B_L = offH(t - L / 2, hB, 1), B_R = offH(t + L / 2, hB, 1);
  const A_Ls = offH(-L / 2 - symShift, hA, -1), A_Rs = offH(L / 2 - symShift, hA, -1);
  const B_Ls = offH(symShift - L / 2, hB, 1), B_Rs = offH(symShift + L / 2, hB, 1);

  const f = mod1(tauO);
  let symVerts, pairs, vertA, vertB;
  if (f < 1e-10 || f > 1 - 1e-10) {
    symVerts = [gP_s(-hb), gP_s(hb), A_Rs, B_Rs, gM_s(hb), gM_s(-hb), B_Ls, A_Ls];
    pairs = [{ a: 0, b: 4 }, { a: 1, b: 7 }, { a: 2, b: 6 }, { a: 3, b: 5 }];
    vertA = 2; vertB = 3;
  } else {
    symVerts = [gP_s(-hb), gP_s(hb - f * bo), gP_s(hb), A_Rs, B_Rs, gM_s(hb), gM_s(-hb + f * bo), gM_s(-hb), B_Ls, A_Ls];
    pairs = [{ a: 0, b: 5 }, { a: 1, b: 6 }, { a: 2, b: 9 }, { a: 3, b: 8 }, { a: 4, b: 7 }];
    vertA = 3; vertB = 4;
  }
  const edges = edgesFromPairs(symVerts.length, pairs);
  const { D, A } = buildCenteredDomain(symVerts, edges, psuBoostX(symShift));

  const H_glue_psu = psuMul(psuBoostX(t), psuFit(baseP(-hb), baseP(hb), baseM(-hb + tauO * bo), baseM(hb + tauO * bo), false));
  const ToP_psu = psuFit(baseP(-hb), baseP(hb), baseP(hb), baseP(3 * hb), false);
  const ToM_psu = psuMul(psuBoostX(t), psuMul(psuFit(baseM(-hb), baseM(hb), baseM(hb), baseM(3 * hb), false), psuBoostX(-t)));
  const R_AR_psu = psuRotAtX(L / 2, hA, -1, TAU / pLow);
  const R_BR_psu = psuRotAtX(t + L / 2, hB, 1, TAU / pUp);
  return {
    mode: 'mixed', D, A, symVerts, edges, symShift, pLow, pUp, hB, hGu, DdistUp,
    A_L, A_R, B_L, B_R, A_Ls, A_Rs, B_Ls, B_Rs, vertA, vertB,
    gP, gM, gP_s, gM_s,
    H_glue: psuToSO21(H_glue_psu), H_glue_psu,
    ToP: psuToSO21(ToP_psu), ToP_psu,
    ToM: psuToSO21(ToM_psu), ToM_psu,
    R_AR: psuToSO21(R_AR_psu), R_AR_psu,
    R_BR: psuToSO21(R_BR_psu), R_BR_psu,
    T_cut: boostX(L), hA, hG, Ddist, d: Ddist,
    mDist: segDistToXAxis(A_Rs, gP_s(hb)),
  };
}

function buildO33Split(L, tw, bo, tauO = 0, pAM = 3, pAR = 3) {
  const h3 = hgt(pAM, pAR, L), h3r = hgt(pAR, pAM, L);
  const { Doo, ho } = handleSplitGeom(bo, L);
  const t = tw * L, hb = bo / 2;
  const baseC = (u) => [Math.sinh(u), Math.cosh(u) * Math.sinh(ho), Math.cosh(u) * Math.cosh(ho)];
  const cP = (u) => apply(boostX(t - L / 4), baseC(u));
  const cM = (u) => apply(boostX(t + L / 4), baseC(u));
  const AL = offH(-L / 2, h3r, -1), AM = offH(0, h3, -1), AR = offH(L / 2, h3r, -1);
  const Tg = boostX(L), cP2 = (u) => apply(Tg, cP(u));
  const symShift = t <= 0 ? (t + L / 4) / 2 : (t - L / 4) / 2;
  const cS = (xOff, u) => GH.norm(apply(boostX(xOff - symShift), baseC(u)));
  const cP_s = (u) => cS(t - L / 4, u), cM_s = (u) => cS(t + L / 4, u);
  const cP2_s = (u) => cS(t + 3 * L / 4, u), cM0_s = (u) => cS(t - 3 * L / 4, u);
  const AL_s = offH(-L / 2 - symShift, h3r, -1), AM_s = offH(-symShift, h3, -1), AR_s = offH(L / 2 - symShift, h3r, -1);

  const f = mod1(tauO);
  let symVerts, pairs;
  if (f < 1e-10 || f > 1 - 1e-10) {
    symVerts = t <= 0
      ? [AL_s, AM_s, AR_s, cP2_s(-hb), cM_s(hb), cM_s(-hb), cP_s(hb), cP_s(-hb)]
      : [AL_s, AM_s, AR_s, cM_s(hb), cM_s(-hb), cP_s(hb), cP_s(-hb), cM0_s(hb)];
    pairs = [{ a: 0, b: 1 }, { a: 2, b: 7 }, { a: 3, b: 5 }, { a: 4, b: 6 }];
  } else {
    symVerts = t <= 0
      ? [AL_s, AM_s, AR_s, cP2_s(-hb), cM_s(hb), cM_s(-hb + f * bo), cM_s(-hb), cP_s(hb), cP_s(-hb + f * bo), cP_s(-hb)]
      : [AL_s, AM_s, AR_s, cM_s(hb), cM_s(-hb + f * bo), cM_s(-hb), cP_s(hb), cP_s(-hb + f * bo), cP_s(-hb), cM0_s(hb)];
    pairs = [{ a: 0, b: 1 }, { a: 2, b: 9 }, { a: 3, b: 6 }, { a: 4, b: 7 }, { a: 5, b: 8 }];
  }
  const edges = edgesFromPairs(symVerts.length, pairs);
  const { D, A } = buildCenteredDomain(symVerts, edges, psuBoostX(symShift));

  const To0_psu = psuFit(baseC(-hb), baseC(hb), baseC(hb), baseC(3 * hb), false);
  const ToP_psu = psuMul(psuBoostX(t - L / 4), psuMul(To0_psu, psuBoostX(-(t - L / 4))));
  const ToM_psu = psuMul(psuBoostX(t + L / 4), psuMul(To0_psu, psuBoostX(-(t + L / 4))));
  const H0_glue_psu = psuFit(baseC(hb), baseC(-hb), baseC(-hb + tauO * bo), baseC(hb + tauO * bo), false);
  const H_glue_psu = psuMul(psuBoostX(t + L / 4), psuMul(H0_glue_psu, psuBoostX(-(t - L / 4))));
  const R_AL_psu = psuRotAtX(-L / 2, h3r, -1, TAU / pAR);
  const R_AM_psu = psuRotAtX(0, h3, -1, TAU / pAM);
  const R_AR_psu = psuRotAtX(L / 2, h3r, -1, TAU / pAR);
  return {
    mode: 'split', D, A, symVerts, edges, symShift, pAM, pAR,
    AL, AM, AR, cP, cM, cP2, AL_s, AM_s, AR_s, cP_s, cM_s,
    R_AL: psuToSO21(R_AL_psu), R_AL_psu,
    R_AM: psuToSO21(R_AM_psu), R_AM_psu,
    R_AR: psuToSO21(R_AR_psu), R_AR_psu,
    T_cut: Tg,
    ToP: psuToSO21(ToP_psu), ToP_psu,
    ToM: psuToSO21(ToM_psu), ToM_psu,
    H_glue: psuToSO21(H_glue_psu), H_glue_psu,
    Doo, ho, h3,
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
  const fam = FAMILIES[state.k] || FAMILIES.o33, ord = fam.baseOrders;
  const perm = state.perm || fam.defaultM.split('').map(Number);
  const bo = state.b ?? fam.defaultB;
  const tauO = state.tau ?? fam.defaultTau;
  const mp = o33Mapping(perm);
  if (mp.mode === 'mixed') {
    const cut = buildO33Mixed(state.L, state.tw, bo, tauO, ord[mp.lowerCone], ord[mp.upperCone]);
    const usesLower = perm[0] === 0 || perm[1] === 0;
    const hb = bo / 2;
    const mDist = usesLower ? segDistToXAxis(cut.A_Rs, cut.gP_s(hb)) : segDistToXAxis(cut.B_Rs, cut.gM_s(hb));
    return { ...cut, ...mp, perm, usesLower, d: usesLower ? cut.Ddist : cut.DdistUp, mDist };
  }
  const cut = buildO33Split(state.L, state.tw, bo, tauO, ord[mp.coneAM], ord[mp.coneAR]);
  const hb = bo / 2;
  const d = mp.handlesPicked ? cut.Doo : pairDistance(cut.pAM, cut.pAR, state.L);
  const mDist = mp.handlesPicked ? segDistToXAxis(cut.cP_s(hb), cut.cM_s(-hb)) : treeToCut(cut.pAM, cut.pAR, state.L).m;
  return { ...cut, ...mp, perm, d, mDist };
}

export function o33Centered(L, tw, bo, tauO = 0, { commas = null, thetas = null, perm = [0, 2, 1, 3], dark = false, k = 'o33' } = {}) {
  const mp = o33Mapping(perm), ord = (FAMILIES[k] || FAMILIES.o33).baseOrders;
  const hb = bo / 2;
  const BLUE = dark ? [0.337, 0.706, 0.914] : [0, 0.447, 0.698];
  let cut, d, mDist;
  const rawPos = new Array(4), rawPartner = new Array(4), clsOfFeat = new Array(4).fill(-1);
  const symPos = new Array(4), symPartner = new Array(4);
  const handleLinesSym = [];

  if (mp.mode === 'mixed') {
    cut = buildO33Mixed(L, tw, bo, tauO, ord[mp.lowerCone], ord[mp.upperCone]);
    rawPos[0] = cut.gP(hb); rawPartner[0] = cut.A_R;
    rawPos[1] = cut.gM(hb); rawPartner[1] = cut.B_R;
    rawPos[mp.lowerCone] = cut.A_R; rawPartner[mp.lowerCone] = cut.gP(hb); clsOfFeat[mp.lowerCone] = cut.A.cls[cut.vertA];
    rawPos[mp.upperCone] = cut.B_R; rawPartner[mp.upperCone] = cut.gM(hb); clsOfFeat[mp.upperCone] = cut.A.cls[cut.vertB];

    symPos[0] = cut.gP_s(hb); symPartner[0] = cut.A_Rs;
    symPos[1] = cut.gM_s(hb); symPartner[1] = cut.B_Rs;
    symPos[mp.lowerCone] = cut.A_Rs; symPartner[mp.lowerCone] = cut.gP_s(hb);
    symPos[mp.upperCone] = cut.B_Rs; symPartner[mp.upperCone] = cut.gM_s(hb);

    const usesLower = perm[0] === 0 || perm[1] === 0;
    d = usesLower ? cut.Ddist : cut.DdistUp;
    mDist = usesLower ? segDistToXAxis(cut.A_Rs, cut.gP_s(hb)) : segDistToXAxis(cut.B_Rs, cut.gM_s(hb));
    handleLinesSym.push([cut.gP_s(-hb), cut.gP_s(hb)]);
    handleLinesSym.push([cut.gP_s(0), offH(-cut.symShift, Math.max(0.05, cut.hG - 0.14), -1)]);
    handleLinesSym.push([cut.gM_s(0), offH(cut.symShift, Math.max(0.05, cut.hGu - 0.14), 1)]);
  } else {
    cut = buildO33Split(L, tw, bo, tauO, ord[mp.coneAM], ord[mp.coneAR]);
    rawPos[0] = cut.cP(hb); rawPartner[0] = cut.cM(-hb);
    rawPos[1] = cut.cM(-hb); rawPartner[1] = cut.cP(hb);
    rawPos[mp.coneAM] = cut.AM; rawPartner[mp.coneAM] = cut.AR; clsOfFeat[mp.coneAM] = cut.A.cls[1];
    rawPos[mp.coneAR] = cut.AR; rawPartner[mp.coneAR] = cut.AM; clsOfFeat[mp.coneAR] = cut.A.cls[2];

    symPos[0] = cut.cP_s(hb); symPartner[0] = cut.cM_s(-hb);
    symPos[1] = cut.cM_s(-hb); symPartner[1] = cut.cP_s(hb);
    symPos[mp.coneAM] = cut.AM_s; symPartner[mp.coneAM] = cut.AR_s;
    symPos[mp.coneAR] = cut.AR_s; symPartner[mp.coneAR] = cut.AM_s;

    d = mp.handlesPicked ? cut.Doo : pairDistance(cut.pAM, cut.pAR, L);
    mDist = mp.handlesPicked ? segDistToXAxis(cut.cP_s(hb), cut.cM_s(-hb)) : treeToCut(cut.pAM, cut.pAR, L).m;
    const t = tw * L;
    handleLinesSym.push([cut.cP_s(-hb), cut.cP_s(hb)]);
    handleLinesSym.push([cut.cP_s(0), offH(t - L / 4 - cut.symShift, Math.max(0.05, cut.ho - 0.14), 1)]);
    handleLinesSym.push([cut.cM_s(0), offH(t + L / 4 - cut.symShift, Math.max(0.05, cut.ho - 0.14), 1)]);
  }

  const pL_sym = symPos[perm[0]], pR_sym = symPos[perm[1]];
  const P_symToPair = psuInv(psuFrame(midH(pL_sym, pR_sym), pR_sym));
  const P_psu = psuMul(P_symToPair, psuBoostX(-cut.symShift));
  const Pmat = psuToSO21(P_psu);
  const M_s2p = psuToSO21(P_symToPair);
  const toPairFromSym = (v) => GH.norm(apply(M_s2p, v));
  const { D, A } = buildCenteredDomain(cut.symVerts, cut.edges, P_symToPair);
  const home = perm.map((f) => toPairFromSym(symPos[f]));
  const canonPartners = perm.map((f) => toPairFromSym(symPartner[f]));
  const shapes = placeCommas(GH, k, perm, home, canonPartners, commas, thetas);

  const featDots = [perm[0], perm[1]].filter((f) => f < 2).map((f) => toPairFromSym(symPos[f]));
  const marks = [clsOfFeat[perm[0]], clsOfFeat[perm[1]]].filter((c) => c >= 0);
  const x0_sym = axisCoords(I3, midH(pL_sym, pR_sym)).u;
  const extraLines = [
    { a: toPairFromSym(handleLinesSym[0][0]), b: toPairFromSym(handleLinesSym[0][1]), color: BLUE, width: 2.3, alpha: 0.9, steps: 6, role: 'o' },
    { a: toPairFromSym(handleLinesSym[1][0]), b: toPairFromSym(handleLinesSym[1][1]), color: BLUE, width: 2.2, alpha: 0.9, steps: 3, role: 'o' },
    { a: toPairFromSym(handleLinesSym[2][0]), b: toPairFromSym(handleLinesSym[2][1]), color: BLUE, width: 2.2, alpha: 0.9, steps: 3, role: 'o' },
  ];

  return {
    D,
    A,
    cut,
    mp,
    home,
    cutSeg: [toPairFromSym(offH(x0_sym - L / 2, 0, 1)), toPairFromSym(offH(x0_sym + L / 2, 0, 1))],
    treeSeg: [home[0], home[1]],
    farTreeSeg: [home[2], home[3]],
    Pmat,
    P_psu,
    rawPos,
    rawPartner,
    featDots,
    marks,
    extraLines,
    d,
    mDist,
    shapes,
    markRefs: buildMarkRefs(GH, k, perm, D, A, home, canonPartners, thetas),
  };
}

// ---- Exact stationary re-cuts for 333*, 333*3, 333x, o33 (PSU(1,1)-exact)
function alignToSlotPsu(M_cone_psu, Qcut_psu, oldVert, targetU, Lp) {
  const g0 = psuMul(Qcut_psu, M_cone_psu);
  const q = apply(psuToSO21(g0), oldVert);
  const m = Math.round((axisCoords(I3, q).u - targetU) / Lp);
  return psuMul(psuBoostX(-m * Lp), g0);
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
    const Q_psu = psuMul(newC.P_psu, psuInv(oldC.P_psu));
    return { k, perm: newPerm, orders: newPerm.map((c) => fam.baseOrders[c]), L, tw, b: bParam, tau: tauC, thetas: thetas.slice(), Q: psuToSO21(Q_psu), invQ: psuToSO21(psuInv(Q_psu)) };
  }

  const g0 = oldC.cut;
  const fromUM = mp1.lowerCone === oldC.mp.upperMin;
  let best = null;
  for (let km = -2; km <= 2; km++) {
    const Tk_psu = psuBoostX(km * L), Tk = boostX(km * L);
    const Ak = offH(km * L + L / 2, g0.hA, -1);
    const RAk_psu = psuRotAtX(km * L + L / 2, g0.hA, -1, TAU / g0.ord.low);
    const FLk = apply(Tk, g0.F_L), FRk = apply(Tk, g0.F_R);
    let Tnew_psu, Anew, U1, U2, gL, gR, cL = null, cR = null, mapOldLower_psu, mapOldUM_psu, mapOldUR_psu;
    if (fromUM) {
      Tnew_psu = psuMul(RAk_psu, g0.R_UR_psu);
      Anew = g0.UM; U1 = Ak; U2 = g0.UR;
      gL = apply(g0.R_UM, FLk); gR = apply(g0.R_UM, FRk);
      if (fam.mode === 'cone-star3') { cL = apply(g0.R_UM, apply(Tk, g0.crL)); cR = apply(g0.R_UM, apply(Tk, g0.crR)); }
      mapOldUM_psu = psuI(); mapOldLower_psu = Tk_psu; mapOldUR_psu = psuI();
    } else {
      Tnew_psu = psuMul(g0.R_UM_psu, RAk_psu);
      Anew = g0.UR; U1 = g0.UM; U2 = Ak;
      const invRAk = psuToSO21(psuInv(RAk_psu));
      gL = apply(invRAk, FLk); gR = apply(invRAk, FRk);
      if (fam.mode === 'cone-star3') { cL = apply(invRAk, apply(Tk, g0.crL)); cR = apply(invRAk, apply(Tk, g0.crR)); }
      mapOldUR_psu = psuI(); mapOldUM_psu = psuI(); mapOldLower_psu = Tk_psu;
    }
    if (Math.abs(Tnew_psu[0]) <= 1 + 1e-7) continue;
    const len = 2 * Math.acosh(Math.max(1, Math.abs(Tnew_psu[0])));
    if (!best || len < best.len) best = { km, Tnew_psu, Anew, U1, U2, gL, gR, cL, cR, mapOldLower_psu, mapOldUM_psu, mapOldUR_psu, len };
  }

  const ax = psuAxisOfTrans(best.Tnew_psu);
  const Lp = ax.len;
  let invF_psu = ax.invF;
  if (axisCoords(psuToSO21(invF_psu), best.Anew).h > 0) invF_psu = psuMul(psuRot(PI), invF_psu);
  const g2 = geodesicCoordsInFrame(psuToSO21(invF_psu), best.gL, best.gR);
  const Qcut_psu = psuMul(psuBoostX(-g2.u), invF_psu);
  const Qcut = psuToSO21(Qcut_psu);

  const conePtInBest = { [mp1.lowerCone]: best.Anew, [fromUM ? oldC.mp.lowerCone : oldC.mp.upperMin]: best.U1, [fromUM ? oldC.mp.upperMax : oldC.mp.lowerCone]: best.U2 };
  const coneMapInOld = { [oldC.mp.lowerCone]: best.mapOldLower_psu, [oldC.mp.upperMin]: best.mapOldUM_psu, [oldC.mp.upperMax]: best.mapOldUR_psu };
  const cUM = axisCoords(Qcut, conePtInBest[mp1.upperMin]);
  const twP = wrapHalf(cUM.u / Lp);

  let tauCp = tauC;
  if (fam.mode === 'cone-star3') {
    const qMid = midH(apply(Qcut, best.cL), apply(Qcut, best.cR));
    const { hG: hGp } = pantsConeCuff(fam.baseOrders[mp1.lowerCone], b, Lp);
    const Fgam = GH.frame([0, -Math.sinh(hGp), Math.cosh(hGp)], [Math.sinh(1), -Math.cosh(1) * Math.sinh(hGp), Math.cosh(1) * Math.cosh(hGp)]);
    const qm = apply(invH(Fgam), qMid);
    tauCp = wrapHalf(Math.atanh(qm[0] / qm[2]) / b);
  }

  const newC = coneFeatCentered(k, Lp, twP, bParam, tauCp, { perm: newPerm, thetas });
  const targetU = { [mp1.lowerCone]: Lp / 2, [mp1.upperMin]: twP * Lp, [mp1.upperMax]: twP * Lp + Lp / 2 };
  const newThetas = thetas.slice();
  for (const cIdx of [mp1.lowerCone, mp1.upperMin, mp1.upperMax]) {
    const M_cut_psu = alignToSlotPsu(coneMapInOld[cIdx], Qcut_psu, oldC.rawPos[cIdx], targetU[cIdx], Lp);
    newThetas[cIdx] = thetas[cIdx] + thetaDeltaPsu(oldC.rawPos[cIdx], oldC.rawPartner[cIdx], newC.rawPos[cIdx], newC.rawPartner[cIdx], M_cut_psu);
  }

  const Q_psu = psuMul(newC.P_psu, psuMul(Qcut_psu, psuInv(oldC.P_psu)));
  return { k, perm: newPerm, orders: newPerm.map((c) => fam.baseOrders[c]), L: Lp, tw: twP, b: bParam, tau: tauCp, thetas: newThetas, Q: psuToSO21(Q_psu), invQ: psuToSO21(psuInv(Q_psu)) };
}

export function recutO33(state, i, j) {
  const { perm, L, tw, thetas } = state;
  const k = FAMILIES[state.k] ? state.k : 'o33', fam = FAMILIES[k], ord = fam.baseOrders;
  if (i === j || i < 0 || i > 3 || j < 0 || j > 3) throw new Error('recutO33: invalid pair');
  const bo = state.b ?? fam.defaultB;
  const tauO = state.tau ?? fam.defaultTau;
  const hb = bo / 2;

  const oldC = o33Centered(L, tw, bo, tauO, { perm, thetas, k });
  const others = [0, 1, 2, 3].filter((x) => x !== i && x !== j);
  const newPerm = [i, j, others[0], others[1]];
  const mp1 = o33Mapping(newPerm);

  // Same unordered partition -> Qcut = I3
  if (mp1.mode === oldC.mp.mode && (mp1.mode === 'split' || mp1.lowerCone === oldC.mp.lowerCone)) {
    const newC = o33Centered(L, tw, bo, tauO, { perm: newPerm, thetas, k });
    const Q_psu = psuMul(newC.P_psu, psuInv(oldC.P_psu));
    return { k, perm: newPerm, orders: newPerm.map((c) => fam.baseOrders[c]), L, tw, b: bo, tau: tauO, thetas: thetas.slice(), Q: psuToSO21(Q_psu), invQ: psuToSO21(psuInv(Q_psu)) };
  }

  const g0 = oldC.cut;
  let Qcut_psu, Qcut, Lp, twP, tauOp, M_cone2_pre_psu, M_cone3_pre_psu, oldV2, oldV3, targetU2, targetU3;
  const newLowerIs = (c) => (mp1.mode === 'mixed' ? mp1.lowerCone === c : mp1.coneAM === c);

  if (oldC.mp.mode === 'mixed' && mp1.mode === 'split') {
    const t = tw * L;
    let best = null;
    for (let km = -2; km <= 2; km++) {
      const Tk_psu = psuBoostX(km * L), Bk = offH(t + km * L + L / 2, g0.hB, 1);
      const R_Bk_psu = psuRotAtX(t + km * L + L / 2, g0.hB, 1, TAU / g0.pUp);
      const Tsp_psu = psuMul(g0.R_AR_psu, R_Bk_psu);
      if (Math.abs(Tsp_psu[0]) <= 1 + 1e-7) continue;
      const len = 2 * Math.acosh(Math.max(1, Math.abs(Tsp_psu[0])));
      if (!best || len < best.len) best = { km, Tk_psu, Tk: boostX(km * L), Bk, Tsp_psu, len };
    }
    const ax = psuAxisOfTrans(best.Tsp_psu);
    Lp = ax.len;
    let invF_psu = ax.invF;
    // the two cone points belong below their cut, the handle above. Two half-turn points lie ON the cut (the pants
    // between them has no room): there the handle says which side is which
    const hConeSp = axisCoords(psuToSO21(invF_psu), g0.A_R).h;
    const coneAbove = Math.abs(hConeSp) > 1e-7 ? hConeSp > 0 : geodesicCoordsInFrame(psuToSO21(invF_psu), g0.gP(-hb), g0.gP(hb)).h < 0;
    if (coneAbove) invF_psu = psuMul(psuRot(PI), invF_psu);
    const posAM = newLowerIs(oldC.mp.lowerCone) ? g0.A_R : best.Bk;
    Qcut_psu = psuMul(psuBoostX(-axisCoords(psuToSO21(invF_psu), posAM).u), invF_psu);
    Qcut = psuToSO21(Qcut_psu);
    const cgP = geodesicCoordsInFrame(Qcut, g0.gP(-hb), g0.gP(hb));
    const cgM = geodesicCoordsInFrame(Qcut, apply(best.Tk, g0.gM(-hb)), apply(best.Tk, g0.gM(hb)));
    twP = wrapHalf((cgP.u + Lp / 4) / Lp);

    const { ho } = handleSplitGeom(bo, Lp);
    const Fm_psu = psuMul(psuBoostX(cgM.u), psuBoostFrom0([0, Math.sinh(ho), Math.cosh(ho)]));
    const gM_p = psuMul(Qcut_psu, psuMul(best.Tk_psu, g0.H_glue_psu));
    // footOnGam in cut: cgP.footOnGam transformed cleanly back from Qcut via psuToSO21(psuInv(Qcut_psu))
    const footRaw = apply(psuToSO21(psuInv(Qcut_psu)), cgP.footOnGam);
    const img = apply(psuToSO21(gM_p), footRaw);
    tauOp = wrapHalf(axisCoords(psuToSO21(psuInv(Fm_psu)), img).u / bo);

    const cL = oldC.mp.lowerCone, cU = oldC.mp.upperCone;
    const uOf = { [cL]: mp1.coneAM === cL ? 0 : Lp / 2, [cU]: mp1.coneAM === cU ? 0 : Lp / 2 };
    const mOf = { [cL]: psuI(), [cU]: best.Tk_psu };
    M_cone2_pre_psu = mOf[2]; M_cone3_pre_psu = mOf[3];
    oldV2 = oldC.rawPos[2]; oldV3 = oldC.rawPos[3];
    targetU2 = uOf[2]; targetU3 = uOf[3];
  } else if (oldC.mp.mode === 'split' && mp1.mode === 'mixed') {
    const lowIsOldAM = mp1.lowerCone === oldC.mp.coneAM;
    const Acone = lowIsOldAM ? g0.AM : g0.AL;
    const R_Acone_psu = lowIsOldAM ? g0.R_AM_psu : g0.R_AL_psu;
    const Tmix_psu = psuMul(psuInv(R_Acone_psu), psuInv(g0.ToP_psu));
    const ax = psuAxisOfTrans(Tmix_psu);
    Lp = ax.len;
    let invF_psu = ax.invF;
    if (axisCoords(psuToSO21(invF_psu), Acone).h > 0) invF_psu = psuMul(psuRot(PI), invF_psu);
    const cgP0 = geodesicCoordsInFrame(psuToSO21(invF_psu), g0.cP(-hb), g0.cP(hb));
    Qcut_psu = psuMul(psuBoostX(-cgP0.u), invF_psu);
    Qcut = psuToSO21(Qcut_psu);
    const cgP = geodesicCoordsInFrame(Qcut, g0.cP(-hb), g0.cP(hb));
    const cgM = geodesicCoordsInFrame(Qcut, g0.cM(-hb), g0.cM(hb));
    twP = wrapHalf(cgM.u / Lp);

    const { hG: hGp } = pantsConeCuff(ord[mp1.upperCone], bo, Lp);
    const Fm_psu = psuMul(psuBoostX(cgM.u), psuBoostFrom0([0, Math.sinh(hGp), Math.cosh(hGp)]));
    const footRaw = apply(psuToSO21(psuInv(Qcut_psu)), cgP.footOnGam);
    const img = apply(psuToSO21(psuMul(Qcut_psu, g0.H_glue_psu)), footRaw);
    tauOp = wrapHalf(axisCoords(psuToSO21(psuInv(Fm_psu)), img).u / bo);

    const cLow = mp1.lowerCone, cUp = mp1.upperCone;
    const mLow = lowIsOldAM ? psuI() : psuBoostX(-L);
    const mUp = psuI();
    const mOf = { [cLow]: mLow, [cUp]: mUp };
    const uOf = { [cLow]: Lp / 2, [cUp]: twP * Lp + Lp / 2 };
    M_cone2_pre_psu = mOf[2]; M_cone3_pre_psu = mOf[3];
    oldV2 = oldC.rawPos[2]; oldV3 = oldC.rawPos[3];
    targetU2 = uOf[2]; targetU3 = uOf[3];
  } else {
    // Mixed -> Mixed
    const t = tw * L;
    let best = null;
    for (let km = -2; km <= 2; km++) {
      const Tk_psu = psuBoostX(km * L), Bk = offH(t + km * L + L / 2, g0.hB, 1);
      const RBk_psu = psuRotAtX(t + km * L + L / 2, g0.hB, 1, TAU / g0.pUp);
      const Tnew_psu = psuMul(psuInv(RBk_psu), g0.ToP_psu);
      if (Math.abs(Tnew_psu[0]) <= 1 + 1e-7) continue;
      const len = 2 * Math.acosh(Math.max(1, Math.abs(Tnew_psu[0])));
      if (!best || len < best.len) best = { km, Tk_psu, Tk: boostX(km * L), Bk, RBk_psu, Tnew_psu, len };
    }
    const ax = psuAxisOfTrans(best.Tnew_psu);
    Lp = ax.len;
    let invF_psu = ax.invF;
    if (axisCoords(psuToSO21(invF_psu), best.Bk).h > 0) invF_psu = psuMul(psuRot(PI), invF_psu);
    const cgP0 = geodesicCoordsInFrame(psuToSO21(invF_psu), g0.gP(-hb), g0.gP(hb));
    Qcut_psu = psuMul(psuBoostX(-cgP0.u), invF_psu);
    Qcut = psuToSO21(Qcut_psu);
    const cgP = geodesicCoordsInFrame(Qcut, g0.gP(-hb), g0.gP(hb));
    const cgM = geodesicCoordsInFrame(Qcut, apply(best.Tk, g0.gM(-hb)), apply(best.Tk, g0.gM(hb)));
    twP = wrapHalf(cgM.u / Lp);

    const { hG: hGp } = pantsConeCuff(ord[mp1.upperCone], bo, Lp);
    const Fm_psu = psuMul(psuBoostX(cgM.u), psuBoostFrom0([0, Math.sinh(hGp), Math.cosh(hGp)]));
    const footRaw = apply(psuToSO21(psuInv(Qcut_psu)), cgP.footOnGam);
    const img = apply(psuToSO21(psuMul(Qcut_psu, psuMul(best.Tk_psu, g0.H_glue_psu))), footRaw);
    tauOp = wrapHalf(axisCoords(psuToSO21(psuInv(Fm_psu)), img).u / bo);

    const cLowNew = mp1.lowerCone, cUpNew = mp1.upperCone;
    const mOf = { [cLowNew]: best.Tk_psu, [cUpNew]: psuInv(best.RBk_psu) };
    const uOf = { [cLowNew]: Lp / 2, [cUpNew]: twP * Lp + Lp / 2 };
    M_cone2_pre_psu = mOf[2]; M_cone3_pre_psu = mOf[3];
    oldV2 = oldC.rawPos[2]; oldV3 = oldC.rawPos[3];
    targetU2 = uOf[2]; targetU3 = uOf[3];
  }

  const newC = o33Centered(Lp, twP, bo, tauOp, { perm: newPerm, thetas, k });
  const newThetas = thetas.slice();
  for (const [cIdx, M_pre_psu, oldV, tU] of [[2, M_cone2_pre_psu, oldV2, targetU2], [3, M_cone3_pre_psu, oldV3, targetU3]]) {
    const M_cut_psu = alignToSlotPsu(M_pre_psu, Qcut_psu, oldV, tU, Lp);
    newThetas[cIdx] = thetas[cIdx] + thetaDeltaPsu(oldC.rawPos[cIdx], oldC.rawPartner[cIdx], newC.rawPos[cIdx], newC.rawPartner[cIdx], M_cut_psu);
  }

  const Q_psu = psuMul(newC.P_psu, psuMul(Qcut_psu, psuInv(oldC.P_psu)));
  return { k, perm: newPerm, orders: newPerm.map((c) => fam.baseOrders[c]), L: Lp, tw: twP, b: bo, tau: tauOp, thetas: newThetas, Q: psuToSO21(Q_psu), invQ: psuToSO21(psuInv(Q_psu)) };
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
/** alt (a mirror with a corner): the walk that goes by the next shortest arc to the mirror instead of the shortest. */
export function followTreeData(state, { alt = false } = {}) {
  const { k, orders, L, tw } = state;
  const fam = FAMILIES[k];
  if (k === '2222') {
    const ell = L, w = 1 / ell, s = 2 * ell * tw;
    const A = [-ell / 2, 0, 1], B = [ell / 2, 0, 1], C = [-ell / 2 + s, w, 1], D = [ell / 2 + s, w, 1];
    const fA = [-ell / 2, w / 2, 1], fB = [ell / 2, w / 2, 1], fC = [-ell / 2 + s, w / 2, 1], fD = [ell / 2 + s, w / 2, 1];
    const baseLegs = [[A, fA], [B, fB], [C, fC], [D, fD]];
    const extraLegs = [];
    for (const m of [-2, -1, 1, 2]) {
      const dx = 2 * m * ell;
      for (const [p, q] of baseLegs) extraLegs.push([[p[0] + dx, p[1], 1], [q[0] + dx, q[1], 1]]);
    }
    return {
      kind: 'E',
      fwdSegs: Array.from({ length: 8 }, (_, i) => [[(-0.5 + i) * ell, 0, 1], [(0.5 + i) * ell, 0, 1]]),
      backSegs: Array.from({ length: 8 }, (_, i) => [[(-0.5 - i) * ell, 0, 1], [(-1.5 - i) * ell, 0, 1]]),
      cutPts: [[-12 * Math.max(1, ell), w / 2, 1], [12 * Math.max(1, ell), w / 2, 1]],
      ends: null,
      legs: baseLegs,
      extraLegs,
      feet: [fA, fC],
    };
  }
  const toSegs = (vs) => { const out = []; for (let i = 0; i + 1 < vs.length; i++) out.push([vs[i], vs[i + 1]]); return out; };
  const K = Math.min(14, Math.ceil(5 / L) + 1);
  const K_leg = Math.min(6, Math.max(1, Math.ceil(3.5 / L)));

  if (fam.mode === 'cones') {
    const c = L / 2, t = tw * L;
    const hA = hgt(orders[0], orders[1], L), hB = hgt(orders[1], orders[0], L);
    const hC = hgt(orders[2], orders[3], L), hD = hgt(orders[3], orders[2], L);
    const A0 = offH(-c / 2, hA, -1), B0 = offH(c / 2, hB, -1);
    const C0 = offH(t - c / 2, hC, 1), D0 = offH(t + c / 2, hD, 1);
    const Pmat = GH.fix(invH(GH.frame(GH.mix(A0, B0, 0.5), B0)), 1);
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
    for (let i = -12; i <= 12; i++) cutPts.push(toPair(offH(0.75 * i, 0, 1)));
    const fA0 = offH(-c / 2, 0, 1), fB0 = offH(c / 2, 0, 1);
    const fC0 = offH(t - c / 2, 0, 1), fD0 = offH(t + c / 2, 0, 1);
    const basePairs = [[A0, fA0], [B0, fB0], [C0, fC0], [D0, fD0]];
    const extraLegs = [];
    for (let m = -K_leg; m <= K_leg; m++) {
      if (m === 0) continue;
      const Tm = boostX(m * L);
      for (const [p, q] of basePairs) extraLegs.push([toPair(apply(Tm, p)), toPair(apply(Tm, q))]);
    }
    return {
      kind: 'H',
      fwdSegs: toSegs(fwdVerts),
      backSegs: toSegs(backVerts),
      cutPts,
      ends: [toPair(offH(-9, 0, 1)), toPair(offH(9, 0, 1))],
      legs: basePairs.map(([p, q]) => [toPair(p), toPair(q)]),
      extraLegs,
      feet: [toPair(fA0), toPair(fC0)],
    };
  }

  // Generalized walk for 333*, 333*3, 333x, o33
  const c = fam.mode === 'handle'
    ? o33Centered(L, tw, state.b ?? fam.defaultB, state.tau ?? fam.defaultTau, { perm: state.perm, thetas: state.thetas, k })
    : coneFeatCentered(k, L, tw, state.b ?? fam.defaultB, state.tau ?? fam.defaultTau ?? 0, { perm: state.perm, thetas: state.thetas });
  const toPair = (v) => GH.norm(apply(c.Pmat, v));
  const cut = alt && c.cut.footAlt ? { ...c.cut, footFeat: c.cut.footAlt, footCorner: c.cut.footCornerAlt } : c.cut;

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
    if (fam.mode === 'cone-star3') {
      const footL = GH.norm(apply(invH(cut.TF), cut.footFeat));
      periodFwd = [cut.A_L, footL];
      if (cut.footCorner && GH.dist(footL, cut.footCorner) > 1e-7 && GH.dist(cut.footCorner, cut.footFeat) > 1e-7) {
        periodFwd.push(cut.footCorner);
      }
      periodFwd.push(cut.footFeat, cut.A_R);
    } else {
      periodFwd = [cut.A_L, cut.F_L, cut.F_R, cut.A_R];
    }
    legPts = [cut.A_R, cut.footFeat, cut.UR, cut.UM];
  } else {
    periodFwd = [cut.UL, cut.UM, cut.UR];
    legPts = [cut.UR, cut.UM, cut.A_R, cut.footFeat];
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
  for (let i = -12; i <= 12; i++) cutPts.push(toPair(offH(0.75 * i, 0, 1)));
  const footOf = (p) => { const ac = axisCoords(I3, p); return offH(ac.u, 0, 1); };
  const legs = legPts.map((p) => [toPair(p), toPair(footOf(p))]);
  const extraLegs = [];
  for (let m = -K_leg; m <= K_leg; m++) {
    if (m === 0) continue;
    const Tm = boostX(m * L);
    for (const p of legPts) extraLegs.push([toPair(apply(Tm, p)), toPair(apply(Tm, footOf(p)))]);
  }
  return {
    kind: 'H',
    fwdSegs: toSegs(fwdVerts),
    backSegs: toSegs(backVerts),
    cutPts,
    ends: [toPair(offH(-9, 0, 1)), toPair(offH(9, 0, 1))],
    legs,
    extraLegs,
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
    farTreeSeg: [V[5], V[3]],
    cutSeg: [[-ell / 2 + s / 2, w / 2, 1], [1.5 * ell + s / 2, w / 2, 1]],
    shapes,
    markRefs: buildMarkRefs(GE, '2222', perm, D, A, home, partners, thetas),
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
  const rel = G.fix(mul(kind === 'E' ? inv(M1) : invH(M1), M0), 1);
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
export function stadium(n1, n2, R = 1, rho = 0.36, m = 24, waist = null) {
  const k = unit3(cross3(n1, n2)), th = ang3(n1, n2), pts = [];
  const s = Math.sin(th);
  const w = waist === null ? (th > 1.5 ? Math.min(rho, 0.16) : rho) : waist;
  const sideM = w < rho ? Math.max(m, 32) : m;
  const at = (t) => n1.map((x, i) => (Math.sin((1 - t) * th) / s) * x + (Math.sin(t * th) / s) * n2[i]);
  const rAt = (t) => rho - (rho - w) * Math.sin(PI * t) ** 2;
  const off = (p, dir, a, r) => p.map((x, i) => (Math.cos(r) * x + Math.sin(r) * (Math.cos(a) * dir[i] + Math.sin(a) * k[i])) * R);
  for (let i = 0; i <= sideM; i++) { const t = i / sideM; pts.push(off(at(t), k, PI / 2, rAt(t))); }
  const e2 = unit3(cross3(k, n2));
  for (let i = 1; i < m; i++) pts.push(off(n2, e2, PI / 2 - (PI * i) / m, rho));
  for (let i = 0; i <= sideM; i++) { const t = 1 - i / sideM; pts.push(off(at(t), k, -PI / 2, rAt(t))); }
  const e1 = unit3(cross3(n1, k));
  for (let i = 1; i < m; i++) pts.push(off(n1, e1, -PI / 2 + (PI * i) / m, rho));
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
  const fam = FAMILIES[k] || FAMILIES['3333'], cone = (f) => ({ t: 'cone', n: fam.baseOrders[f] });
  if (fam.mode === 'still') return fam.parts.map((p) => ({ ...p }));
  if (fam.mode === 'handle') return [{ t: 'o' }, cone(2), cone(3)];
  if (fam.mode === 'cones' || fam.mode === 'pillow' || fam.mode === 'multi') return fam.baseOrders.map((n) => ({ t: 'cone', n }));
  const cuff = fam.mode === 'cone-x' ? { t: 'x' } : { t: 'star', corners: fam.mode === 'cone-star3' ? [fam.corner || 3] : [] };
  return [0, 1, 2, 3].map((f) => (f === fam.featIdx ? cuff : cone(f)));
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
  if ((FAMILIES[k] || FAMILIES['3333']).mode === 'handle') {
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

/** Which dodecahedron sites the 4 features occupy, with loopSites always matching the picked pair. */
export function sitesForBall(built, pair, k = '3333') {
  const L = built.layout;
  const siteOf = featureAnchorsForBall(built, k).map((f) => f.site);
  const [a, b] = pair, sa = siteOf[a], sb = siteOf[b];
  return { siteOf, loopSites: [sa, sb], adjacent: L.sites[sa].toward.has(sb), complement: false };
}

/** The pair-centred pattern of a state, whichever family it is of; commas: a print in place of the family's own. */
export function centredFor(state, { dark = false, commas = null } = {}) {
  const fam = FAMILIES[state.k];
  // the print: the state's own (page.js keeps it across picks) or the family's, at its size for this state
  if (!commas) commas = paisley.specsAt(state.print || paisley.print(state.k), state);
  if (fam.mode === 'pillow') return pillowCentered(state.L, state.tw, { thetas: state.thetas, perm: state.perm, commas });
  if (fam.mode === 'cones') return fourConeCentered(state.orders, state.L, state.tw, { thetas: state.thetas, perm: state.perm, k: state.k, commas });
  if (fam.mode === 'handle') return o33Centered(state.L, state.tw, state.b ?? fam.defaultB, state.tau ?? fam.defaultTau, { thetas: state.thetas, perm: state.perm, dark, k: state.k, commas });
  return coneFeatCentered(state.k, state.L, state.tw, state.b ?? fam.defaultB, state.tau ?? fam.defaultTau ?? 0, { thetas: state.thetas, perm: state.perm, commas });
}
const paisley = createPaisley({ families: FAMILIES, centred: (st, commas) => centredFor(st, { commas }), GH, GE });
/** The view in which a family's default pattern lies exactly as on the Classification of Surfaces page, or null. */
export const paisleyView = (k) => (FAMILIES[k] ? paisley.view(k) : null);
export const paisleyInfo = (k) => (FAMILIES[k] ? paisley.info(k) : null);
/** The family's print at its default numbers: { k, perm, twBase, fit, specs } (paisley.js). */
export const paisleyPrint = (k) => (FAMILIES[k] ? paisley.print(k) : null);
/**
 * After a pick: the commas as they were drawn in the state before it (at the size they had there), tied anew to
 * the blocks of the new pair's cut. Nothing moves.
 */
export function retiePrint(after, before) {
  const pr = before.print || paisley.print(before.k);
  return paisley.retie({ ...after, print: null }, { ...pr, specs: paisley.specsAt(pr, before) || pr.specs, fit: 1 });
}
/** How large the print is drawn at a state (1: as laid). */
export const printScale = (state) => paisley.scaleAt(state.print || paisley.print(state.k), state);
/**
 * The print and the comma angles of a link to another pair than the family's own: what picks leave on the default
 * pattern. The shortest chain of picks that names the four features as the link does is run (at most four; the
 * pairs are tried in one fixed order), and the default print, which no pick moves, is tied to the blocks of the
 * last pick's cut. The link's own numbers then carry it from there. null where the pair is the family's own, or
 * no chain of picks names the features so (a hand-written m): then the family's print is drawn in the link's
 * frames, as before.
 */
const linkedCache = new Map();
export function linkedPrint(k, perm) {
  const fam = FAMILIES[k], target = perm.join('');
  if (!fam || target === fam.defaultM) return null;
  const cacheKey = k + ' ' + target;
  if (linkedCache.has(cacheKey)) return linkedCache.get(cacheKey);
  let out = null;
  try {
    const p0 = fam.defaultM.split('').map(Number);
    const st0 = { k, perm: p0, orders: p0.map((c) => fam.baseOrders[c]), L: fam.defaultL, tw: fam.defaultTw, b: fam.defaultB ?? 0, tau: fam.defaultTau ?? 0, thetas: defaultCommas(k).map((sp) => (sp ? sp.theta : 0)) };
    const seen = new Map([[fam.defaultM, { st: st0, prev: null }]]);
    let frontier = [st0];
    for (let depth = 0; depth < 4 && !seen.has(target) && frontier.length; depth++) {
      const next = [];
      for (const st of frontier) for (const [i, j] of [[0, 1], [2, 3], [0, 2], [1, 3], [1, 2], [0, 3]]) {
        let r = null;
        try { r = recut(st, i, j); } catch (err) { continue; }
        const key = r.perm.join('');
        if (seen.has(key)) continue;
        const st1 = { k, perm: r.perm, orders: r.orders, L: r.L, tw: r.tw, b: r.b ?? st.b, tau: r.tau ?? st.tau, thetas: r.thetas };
        seen.set(key, { st: st1, prev: st });
        next.push(st1);
      }
      frontier = next;
    }
    const hit = seen.get(target);
    if (hit && hit.prev) out = { print: retiePrint(hit.st, hit.prev), thetas: hit.st.thetas.slice(), base: { L: hit.st.L, tw: hit.st.tw, b: hit.st.b, tau: hit.st.tau } };
  } catch (err) { out = null; }
  linkedCache.set(cacheKey, out);
  return out;
}

/**
 * Is this state a family's default numbers, with its default pair? There the pattern is the one the Classification
 * of Surfaces page draws for the signature, and it opens (and resets) lying as it lies there: that page's tile in
 * the middle, turned as it is there. At any other numbers the pattern opens on its pair.
 */
export function atDefaults(state) {
  const fam = FAMILIES[state.k], near = (a, b) => Math.abs(a - b) < 1e-9;
  if (!fam) return false;
  const specs = defaultCommas(state.k);
  return state.perm.join('') === fam.defaultM && near(state.L, fam.defaultL) && near(state.tw, fam.defaultTw)
    && near(state.b ?? fam.defaultB ?? 0, fam.defaultB ?? 0) && near(state.tau ?? fam.defaultTau ?? 0, fam.defaultTau ?? 0)
    && (state.thetas || []).every((t, i) => near(t, specs[i] ? specs[i].theta : 0));
}

// ---- Build the pattern model for pattern-ext.js from current state
/** The default state of a family of five or six cone points: every pair at the Classification page's numbers, the first pair picked. */
export function multiState(k, over = {}) {
  const fam = FAMILIES[k], d = fam.defaults, m = d.L.length;
  const num = (list, def, lo, hi) => def.map((v, i) => (list && Number.isFinite(list[i]) ? Math.max(lo, Math.min(hi, list[i])) : v));
  const Ls = num(over.Ls, d.L, fam.maxRange[0], fam.maxRange[1]), tws = num(over.tws, d.tw, -0.5, 0.5);
  const active = Math.max(0, Math.min(m - 1, over.active | 0)), shown = Math.max(active + 1, Math.min(m, over.shown || 1));
  return { k, mode: 'multi', orders: fam.orders.slice(), Ls, tws, active, shown, perm: [2 * active, 2 * active + 1], L: Ls[active], tw: tws[active], b: 0, tau: 0, thetas: [] };
}
/** Is a state of five or six cone points the Classification page's shape (every pair at its default numbers)? */
export const multiAtDefaults = (state) => { const d = FAMILIES[state.k].defaults; return state.Ls.every((v, i) => Math.abs(v - d.L[i]) < 1e-9) && state.tws.every((v, i) => Math.abs(v - d.tw[i]) < 1e-9); };
/** For the checks: the print of a family of five or six cone points, and a state's pattern. */
export const multiPrint = (k) => multi.printOf(FAMILIES[k].orders);
export const multiCentred = (state) => multi.centred(state);
export const multiBuild = (state) => multi.build(state.orders, state.Ls, state.tws);

/** The pattern of an orbifold shown still: the Classification of Surfaces page's own tile and print, its tile lines and all. */
function stillModel(fam) {
  const sig = parseSignature(fam.k);
  const D = domainOf(sig), A = analyse(D), tokens = tokensOf(sig);
  let binding = [];
  try { binding = bind(tokens, A); } catch {}
  return { D, A, tokens, binding, home: [], outline: false, lines: [], dots: [], marks: null };
}

/** Map each signature token of a 4-feature `pairs` orbifold (in `tokensOf` order) to its pattern feature descriptor. */
function pairsBinding(fam, state, D, A, home) {
  const G = fam.kind === 'E' ? GE : GH;
  const clsForFeat = (feat) => {
    const slot = state.perm.indexOf(feat);
    const p = slot >= 0 && home[slot] ? home[slot] : null;
    if (!p) return -1;
    let bestV = -1, bestD = Infinity;
    for (let vi = 0; vi < D.verts.length; vi++) {
      const dd = G.dist(D.verts[vi], p);
      if (dd < bestD) { bestD = dd; bestV = vi; }
    }
    return bestV >= 0 ? A.cls[bestV] : -1;
  };
  if (fam.mode === 'cones' || fam.mode === 'pillow') {
    return [0, 1, 2, 3].map((f) => ({ t: 'd', role: 'cone', cls: clsForFeat(f) }));
  }
  if (fam.mode === 'handle') {
    return [{ t: 'o', k: 0 }, { t: 'd', role: 'cone', cls: clsForFeat(2) }, { t: 'd', role: 'cone', cls: clsForFeat(3) }];
  }
  const cones = [0, 2, 3].map((f) => ({ t: 'd', role: 'cone', cls: clsForFeat(f) }));
  if (fam.mode === 'cone-x') return cones.concat([{ t: 'x', k: 0 }]);
  if (fam.mode === 'cone-star') return cones.concat([{ t: '*', star: 0 }]);
  const cornerCls = A.stars[0] && A.stars[0].corners.length ? A.stars[0].corners[0] : A.cls[0];
  return cones.concat([{ t: '*', star: 0 }, { t: 'd', role: 'corner', cls: cornerCls, star: 0 }]);
}

/** The pattern of five or six cone points (multi.js): every pair's tree and cut, the picked pair's the heavier. */
const lastGood = new Map();
function multiModel(state, dark) {
  const INK = [0.08, 0.09, 0.12], AMBER = dark ? [0.941, 0.659, 0.188] : [0.902, 0.624, 0];
  // should a tile not be found at some numbers, the pattern keeps the last one it had (a slider must not stop the page)
  let c = null;
  try { c = multi.centred(state); lastGood.set(state.k, c); } catch (err) { c = lastGood.get(state.k) || multi.centred(multiState(state.k, { active: state.active, shown: state.shown })); }
  const lines = [];
  c.pairs.forEach((pr, i) => {
    const on = i === state.active;
    if (!on && i >= state.shown) return;
    if (!pr.onCut) {
      lines.push({ a: pr.tree[0], b: pr.tree[1], color: INK, width: on ? 2.3 : 1.9, alpha: on ? 0.9 : 0.5, steps: 6 });
    }
    lines.push({ a: pr.cut[0], b: pr.cut[1], color: AMBER, width: on ? 2.2 : 1.6, dash: [6, 4.5], alpha: on ? 1 : 0.75, steps: 8 });
  });
  // The model is in the frame of its tile (multi.js centred says why), so it says how it is to be looked at:
  //   pose        the motion that lays the picked pair level in the middle; page.js keeps the pair there while its
  //               sliders move (the view is carried by the change of pose)
  //   firstV      how it opens: where the numbers are the Classification page's and the first pair is picked, as
  //               that page lies (classified: true); else by its pose
  const classified = multiAtDefaults(state) && state.active === 0;
  return {
    D: c.D, A: c.A, home: c.home, outline: false, tileEdges: false, center: GH.mix(c.home[c.marks[0]], c.home[c.marks[1]], 0.5),
    firstV: classified ? c.view : c.pose, classified, pose: c.pose,
    design: () => c.shapes, lines, dots: [], marks: c.marks, dimMarks: false,
    binding: state.orders.map((_, f) => ({ t: 'd', role: 'cone', cls: f })),
  };
}

export function buildPatternModel(state, { dark = false, follow = null } = {}) {
  const INK = [0.08, 0.09, 0.12];
  const AMBER = dark ? [0.941, 0.659, 0.188] : [0.902, 0.624, 0];
  const BLUE = dark ? [0.337, 0.706, 0.914] : [0, 0.447, 0.698];
  const fam = FAMILIES[state.k];
  if (fam.mode === 'still') return stillModel(fam);
  if (fam.mode === 'multi') return multiModel(state, dark);
  const built = centredFor(state, { dark });
  const { D, A, home, cutSeg, treeSeg, farTreeSeg, shapes } = built;
  // A mirror with a corner, near Corner shift 0: two arcs from the cone point to the mirror are almost equally
  // short, and the shortest changes walls at 0. Both are drawn, the shortest the stronger (cornerFade): the tree
  // does not jump, it fades from one into the other. Away from 0 there is one tree, drawn as ever.
  const fade = built.treeFade && built.treeFade.alt > 0 ? built.treeFade : null;
  const wTree = fade && !fade.far ? fade.main : 1, wFar = fade && fade.far ? fade.main : 1;

  const lines = [
    ...(built.extraLines || []),
    ...(farTreeSeg && !built.cutOnFar ? [{ a: farTreeSeg[0], b: farTreeSeg[1], color: INK, width: 1.9, alpha: 0.5 * wFar, steps: 6 }] : []),
    ...(fade && fade.far ? [{ a: fade.seg[0], b: fade.seg[1], color: INK, width: 1.9, alpha: 0.5 * fade.alt, steps: 6 }] : []),
    ...(!built.cutOnPicked ? [{ a: treeSeg[0], b: treeSeg[1], color: INK, width: 2.3, alpha: 0.9 * wTree, steps: 6 }] : []),
    ...(fade && !fade.far ? [{ a: fade.seg[0], b: fade.seg[1], color: INK, width: 2.3, alpha: 0.9 * fade.alt, steps: 6 }] : []),
    { a: cutSeg[0], b: cutSeg[1], color: AMBER, width: 2.2, dash: [6, 4.5], alpha: 1, steps: 8 },
  ];
  const dots = [];
  if (!(follow && follow.active) && built.featDots) {
    for (const p of built.featDots) {
      dots.push(wTree < 1 ? { p, color: BLUE, stroke: [1, 1, 1], r: 5.5, alpha: wTree } : { p, color: BLUE, stroke: [1, 1, 1], r: 5.5 });
    }
    // the foot of the second arc, as faint as its arc
    if (fade && !fade.far && built.featDots.length) dots.push({ p: fade.seg[1], color: BLUE, stroke: [1, 1, 1], r: 5.5, alpha: fade.alt });
  }

  if (follow && follow.active) {
    const progress = follow.progress ?? 1;
    /** What one walk draws at this stage of the moment: its own strokes (path), the cut's (the same for any walk), its dots. */
    const walkOf = (fd) => {
      const path = [], cut = [], ds = [];
      const walkSegs = [...fd.fwdSegs, ...fd.backSegs];
      const totalF = fd.fwdSegs.length, totalB = fd.backSegs.length;
      if (progress < 0.45) {
        const fCount = Math.max(1, Math.ceil((progress / 0.45) * totalF));
        for (let i = 0; i < fCount; i++) path.push({ a: fd.fwdSegs[i][0], b: fd.fwdSegs[i][1], color: INK, width: 4.0, alpha: 0.95, once: true, steps: 8 });
        const last = fd.fwdSegs[Math.min(fCount - 1, totalF - 1)][1];
        ds.push({ p: last, color: AMBER, stroke: INK, r: 5.5 });
      } else if (progress < 0.9) {
        for (const s of fd.fwdSegs) path.push({ a: s[0], b: s[1], color: INK, width: 4.0, alpha: 0.95, once: true, steps: 8 });
        const bCount = Math.max(1, Math.ceil(((progress - 0.45) / 0.45) * totalB));
        for (let i = 0; i < bCount; i++) path.push({ a: fd.backSegs[i][0], b: fd.backSegs[i][1], color: INK, width: 4.0, alpha: 0.95, once: true, steps: 8 });
        const last = fd.backSegs[Math.min(bCount - 1, totalB - 1)][1];
        ds.push({ p: last, color: AMBER, stroke: INK, r: 5.5 });
        if (fd.ends) ds.push({ p: fd.ends[1], color: AMBER, stroke: INK, r: 6.5, after: true });
      } else {
        for (const s of walkSegs) path.push({ a: s[0], b: s[1], color: INK, width: 3.8, alpha: 0.95, once: true, steps: 8 });
        for (const lg of fd.legs) path.push({ a: lg[0], b: lg[1], color: INK, width: 1.2, alpha: 0.75, once: true, steps: 8 });
        if (fd.extraLegs) {
          for (const lg of fd.extraLegs) path.push({ a: lg[0], b: lg[1], color: INK, width: 1.2, alpha: 0.75, once: true, steps: 8 });
        }
        for (let i = 0; i + 1 < fd.cutPts.length; i++) {
          cut.push({ a: fd.cutPts[i], b: fd.cutPts[i + 1], color: [1, 1, 1], width: 5.0, alpha: 0.9, once: true, steps: 4 });
        }
        for (let i = 0; i + 1 < fd.cutPts.length; i++) {
          cut.push({ a: fd.cutPts[i], b: fd.cutPts[i + 1], color: AMBER, width: 3.0, alpha: 1, once: true, steps: 4 });
        }
        if (fd.ends) {
          ds.push({ p: fd.ends[0], color: AMBER, stroke: INK, r: 6.5, after: true });
          ds.push({ p: fd.ends[1], color: AMBER, stroke: INK, r: 6.5, after: true });
        }
        ds.push({ p: fd.feet[0], color: INK, r: 4.5 });
        ds.push({ p: fd.feet[1], color: AMBER, stroke: INK, r: 6 });
      }
      return { path, cut, ds };
    };
    const one = walkOf(follow.data);
    if (!fade) {
      lines.push(...one.path, ...one.cut);
      dots.push(...one.ds);
    } else {
      // The walk by the second arc as well. What the two walks share is drawn once, as ever; what is one walk's
      // alone is drawn as strongly as its arc.
      const two = walkOf(followTreeData(state, { alt: true }));
      const sameLine = (u, v) => u.width === v.width && GH.dist(u.a, v.a) < 1e-9 && GH.dist(u.b, v.b) < 1e-9;
      const sameDot = (u, v) => u.r === v.r && !!u.after === !!v.after && GH.dist(u.p, v.p) < 1e-9;
      for (const u of one.path) lines.push(two.path.some((v) => sameLine(u, v)) ? u : { ...u, alpha: u.alpha * fade.main });
      for (const v of two.path) if (!one.path.some((u) => sameLine(u, v))) lines.push({ ...v, alpha: v.alpha * fade.alt });
      lines.push(...one.cut);
      for (const u of one.ds) dots.push(two.ds.some((v) => sameDot(u, v)) ? u : { ...u, alpha: fade.main });
      for (const v of two.ds) if (!one.ds.some((u) => sameDot(u, v))) dots.push({ ...v, alpha: fade.alt });
    }
    void BLUE;
  }

  return {
    D,
    A,
    binding: pairsBinding(fam, state, D, A, home),
    home,
    outline: false,
    tileEdges: false,
    center: fam.kind === 'E' ? [0, 0, 1] : GH.origin,
    firstV: atDefaults(state) ? paisley.view(state.k) : null,
    design: () => shapes,
    lines,
    dots,
    marks: built.marks ?? [A.cls[0], A.cls[1]],
    dimMarks: false,
    markRefs: built.markRefs,
  };
}
