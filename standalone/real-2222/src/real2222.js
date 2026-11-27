// real2222.js — pure math, 3-partition coupled parameterization, and Selling disphenoid mesh for "The real 2222".
//
// Convention: area 2 (covolume(e1, e2) = 1), y up.
// Four order-2 centres mod 2: A=(0,0), B=(1,0), C=(0,1), D=(1,1).
// Three partitions of the four corners into two pairs:
//   0: {A, B} | {C, D}   (parity (1,0), blue)
//   1: {A, C} | {B, D}   (parity (0,1), amber)
//   2: {A, D} | {B, C}   (parity (1,1), purple)

export const PI = Math.PI;
export const TAU = 2 * Math.PI;
export const SQRT2 = Math.SQRT2;
export const REG_ELL = Math.pow(4 / 3, 0.25); // 1.07456993...
export const DEFAULT_C = 0.296;
export const L_MIN = 0.55;
export const L_MAX = 1.95;
export const T_MIN = -0.5;
export const T_MAX = 0.5;

export const PARTITIONS = [
  { idx: 0, id: 'ab', title: '{A, B} | {C, D}', short: 'AB | CD', pairs: [['A', 'B'], ['C', 'D']], colorKey: 'ab' },
  { idx: 1, id: 'ac', title: '{A, C} | {B, D}', short: 'AC | BD', pairs: [['A', 'C'], ['B', 'D']], colorKey: 'ac' },
  { idx: 2, id: 'ad', title: '{A, D} | {B, C}', short: 'AD | BC', pairs: [['A', 'D'], ['B', 'C']], colorKey: 'ad' },
];

export const mod = (a, m) => ((a % m) + m) % m;
export const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
export const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const mul2 = (k, a) => [k * a[0], k * a[1]];
export const dot2 = (a, b) => a[0] * b[0] + a[1] * b[1];
export const det2 = (a, b) => a[0] * b[1] - a[1] * b[0];
export const norm2 = (a) => Math.hypot(a[0], a[1]);
export const comb = (r, e) => [r[0] * e[0][0] + r[1] * e[1][0], r[0] * e[0][1] + r[1] * e[1][1]];

export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul3 = (k, a) => [k * a[0], k * a[1], k * a[2]];
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const norm3 = (a) => Math.hypot(a[0], a[1], a[2]);
export const unit3 = (a) => {
  const n = norm3(a) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
};

// Stage display coordinates: (x_stage, y_stage, z_stage) = (Y_box, Z_box, X_box)
export const toStage = (p) => [p[1], p[2], p[0]];

export function coords2(p, u1, u2) {
  const d = det2(u1, u2);
  return [det2(p, u2) / d, det2(u1, p) / d];
}

export function basis(ell, t, angDeg = 0) {
  const th = (angDeg * PI) / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const rot = ([x, y]) => [c * x - s * y, s * x + c * y];
  return [rot([ell, 0]), rot([2 * ell * t, 1 / ell])];
}

export function pairVectors(e, M) {
  const v = comb(M[0], e);
  const u = comb(M[1], e);
  const ell = norm2(v);
  const vh = [v[0] / ell, v[1] / ell];
  const nh = [-vh[1], vh[0]];
  const w = 1 / ell;
  const t = dot2(u, vh) / (2 * ell);
  const ang = (Math.atan2(v[1], v[0]) * 180) / PI;
  return { v, u, vh, nh, ell, w, t, s: 2 * ell * t, ang };
}

export function basisFromPair(ell, t, M, angDeg = 0) {
  const [vv, uu] = basis(ell, t, angDeg);
  const [[a, b], [c, d]] = M;
  // v = a*e1 + b*e2, u = c*e1 + d*e2, ad - bc = 1
  const e1 = [d * vv[0] - b * uu[0], d * vv[1] - b * uu[1]];
  const e2 = [a * uu[0] - c * vv[0], a * uu[1] - c * vv[1]];
  return [e1, e2];
}

export function reduceSuperbase(e1, e2, tol = 1e-13) {
  let va = [1, 0];
  let vb = [0, 1];
  let vc = [-1, -1];
  const e = [e1, e2];
  const iz = (x) => (x === 0 ? 0 : x);
  const ineg = (a) => [iz(-a[0]), iz(-a[1])];
  const isub = (a, b) => [iz(a[0] - b[0]), iz(a[1] - b[1])];
  for (let iter = 0; iter < 100000; iter++) {
    const A = comb(va, e);
    const B = comb(vb, e);
    const C = comb(vc, e);
    if (dot2(A, B) > tol) {
      [va, vb, vc] = [va, ineg(vb), isub(vb, va)];
    } else if (dot2(A, C) > tol) {
      [va, vb, vc] = [va, isub(vc, va), ineg(vc)];
    } else if (dot2(B, C) > tol) {
      [va, vb, vc] = [isub(vc, vb), vb, ineg(vc)];
    } else {
      return { R: [va, vb, vc], flips: iter };
    }
  }
  throw new Error('reduceSuperbase did not converge');
}

export function classifySolid(X, Y, Z, tol = 2e-3) {
  const s = [Math.max(0, X), Math.max(0, Y), Math.max(0, Z)].sort((a, b) => a - b);
  if (s[0] < 1e-6) {
    return Math.abs(s[1] - s[2]) < tol ? 'square envelope' : 'flat envelope';
  }
  if (s[2] - s[0] < tol) return 'regular tetrahedron';
  return 'tetrahedron';
}

function faceOutwardNormal(V, n0, n1, n2) {
  const p0 = V[n0];
  const p1 = V[n1];
  const p2 = V[n2];
  const n = cross3(sub3(p1, p0), sub3(p2, p0));
  const mid = [(p0[0] + p1[0] + p2[0]) / 3, (p0[1] + p1[1] + p2[1]) / 3, (p0[2] + p1[2] + p2[2]) / 3];
  const u = unit3(n);
  return dot3(u, mid) >= 0 ? u : mul3(-1, u);
}

/**
 * Globally continuous 3D Selling disphenoid vertices `box` (and rotated `stage`),
 * four outward-wound faces over [0, 2*va] x [0, vb], and per-partition dihedral bends.
 */
export function solidFromBasis(e, { tol = 1e-13, minConorm = 4e-4 } = {}) {
  const [e1, e2] = e;
  const { R, flips } = reduceSuperbase(e1, e2, tol);
  const [[ma, na], [mb, nb]] = R;
  const va = comb(R[0], e);
  const vb = comb(R[1], e);
  const vc = comb(R[2], e);
  const X = -dot2(vb, vc);
  const Y = -dot2(va, vc);
  const Z = -dot2(va, vb);
  const sigma = ma * nb - na * mb;
  const ex = ((na >> 1) & 1) ? -1 : 1;
  const ey = ((mb >> 1) & 1) ? -1 : 1;
  const ez = sigma * ex * ey;

  const Xd = Math.max(X, minConorm);
  const Yd = Math.max(Y, minConorm);
  const Zd = Math.max(Z, minConorm);
  const x = ex * Math.sqrt(Xd);
  const y = ey * Math.sqrt(Yd);
  const z = ez * Math.sqrt(Zd);

  const box = {
    A: [-x / 2, -y / 2, -z / 2],
    B: [-x / 2, y / 2, z / 2],
    C: [x / 2, -y / 2, z / 2],
    D: [x / 2, y / 2, -z / 2],
  };
  const stage = {
    A: toStage(box.A),
    B: toStage(box.B),
    C: toStage(box.C),
    D: toStage(box.D),
  };

  // Fundamental region [0, 2*va] x [0, vb] split along diagonals va + vb = -vc.
  const pt = (i, j) => [i * va[0] + j * vb[0], i * va[1] + j * vb[1]];
  const nm = (i, j) => 'ABCD'[(i & 1) + 2 * (j & 1)];
  const raw = [
    [[0, 0], [1, 0], [1, 1]],
    [[0, 0], [1, 1], [0, 1]],
    [[1, 0], [2, 0], [2, 1]],
    [[1, 0], [2, 1], [1, 1]],
  ];
  const tris = raw.map((tri) => {
    const ordered = sigma > 0 ? tri : [tri[0], tri[2], tri[1]];
    return {
      pts: ordered.map(([i, j]) => pt(i, j)),
      names: ordered.map(([i, j]) => nm(i, j)),
    };
  });

  // Exterior dihedral bend angles (in [0, pi]) across edges AB, AC, AD.
  // Near 0 means flat envelope diagonal; near pi means folded envelope rim.
  const nABD = faceOutwardNormal(stage, 'A', 'B', 'D');
  const nADC = faceOutwardNormal(stage, 'A', 'D', 'C');
  const nBAC = faceOutwardNormal(stage, 'B', 'A', 'C');
  const nBCD = faceOutwardNormal(stage, 'B', 'C', 'D');
  // Outward normal angle between the two faces sharing each edge of vertex A:
  //   AB shared by (A,B,D) and (B,A,C)
  //   AC shared by (A,D,C) and (B,A,C)
  //   AD shared by (A,B,D) and (A,D,C)
  const angleBetween = (u, v) => Math.acos(clamp(dot3(u, v), -1, 1));
  const bends = [
    angleBetween(nABD, nBAC),
    angleBetween(nADC, nBAC),
    angleBetween(nABD, nADC),
  ];

  // Raw (un-clamped) vertices too for bend test? stage uses minConorm, which gives accurate non-degenerate normals everywhere.
  void nBCD;

  return {
    R, flips, va, vb, vc,
    X, Y, Z, sigma,
    ex, ey, ez,
    box, stage,
    edges: [norm2(va), norm2(vb), norm2(vc)],
    bends,
    kind: classifySolid(X, Y, Z),
    tris,
  };
}

/**
 * Canonical Selling-reduced frames for all 3 partitions k = 0 (AB|CD), 1 (AC|BD), 2 (AD|BC).
 * Each has det(M) = +1 and canonical partner parity so twist passes continuously through 0 at flat states.
 */
export function sellingFrames(e) {
  const { R } = reduceSuperbase(e[0], e[1], 1e-13);
  const sigma = R[0][0] * R[1][1] - R[0][1] * R[1][0];
  const iz = (x) => (x === 0 ? 0 : x);
  const scale = (s, v) => [iz(s * v[0]), iz(s * v[1])];
  const Ms = [
    [R[0], scale(sigma, R[1])],
    [R[1], scale(-sigma, R[0])],
    [R[2], scale(sigma, R[0])],
  ];
  return Ms.map((M, idx) => {
    const pv = pairVectors(e, M);
    return { idx, M, ell: pv.ell, t: pv.t, pv };
  });
}

export function nstrip(y, c, w) {
  const tw = 2 * w;
  const m = mod(y + c, tw);
  return 2 * Math.floor((y + c) / tw) + (m > 2 * c ? 1 : 0);
}

// ---- Coupled 3-partition state machine ----

export function createModel({ ell = 1, t = 0, cFrac = DEFAULT_C, activeIdx = 0, pr = 0 } = {}) {
  const M0 = [[1, 0], [0, 1]];
  const state = {
    e: basisFromPair(clamp(ell, 0.35, 3.0), clamp(t, T_MIN, T_MAX), M0, 0),
    activeIdx: 0,
    activeFrame: M0,
    cFrac: clamp(cFrac, 0.05, 0.95),
    pr: pr || 0,
    q90: 0,
  };
  if (activeIdx === 1 || activeIdx === 2) {
    const sf = sellingFrames(state.e);
    state.activeIdx = activeIdx;
    state.activeFrame = sf[activeIdx].M;
    state.q90 = Math.round(pairVectors(state.e, state.activeFrame).ang / 90);
  }
  return state;
}

export function readPartitions(state) {
  const sf = sellingFrames(state.e);
  const actPv = pairVectors(state.e, state.activeFrame);
  return sf.map((f, k) => (k === state.activeIdx ? { idx: k, M: state.activeFrame, ell: actPv.ell, t: actPv.t, pv: actPv } : f));
}

export function pairPrintParams(e, M, bits = 0, q90 = null) {
  const pv = pairVectors(e, M);
  return {
    l: pv.ell,
    w: pv.w,
    s: 2 * pv.ell * mod(pv.t, 1),
    bits: bits || 0,
    q90: q90 !== null && q90 !== undefined ? q90 : Math.round(pv.ang / 90),
  };
}

/**
 * Optionally find bits in 0..7 keeping the exact same comma layout in fixed plane coordinates
 * when switching active frames (requires placedInPane & samePrint injected to stay dependency-light).
 */
export function bitsThatKeep2222(state, nextFrame, paisleyFns = null, nextQ90 = null) {
  if (!paisleyFns) return 0;
  const { placedInPane, samePrint } = paisleyFns;
  if (!placedInPane || !samePrint) return 0;
  const wide = { x0: -2.6, x1: 2.6, y0: -2.6, y1: 2.6 };
  const keep = { x0: -1.25, x1: 1.25, y0: -1.25, y1: 1.25 };
  const prevPv = pairVectors(state.e, state.activeFrame);
  const prevPlaced = placedInPane(
    '2222',
    pairPrintParams(state.e, state.activeFrame, state.pr || 0, state.q90),
    [0, 0],
    prevPv.vh,
    wide
  );
  const nextPv = pairVectors(state.e, nextFrame);
  const targetQ90 = nextQ90 !== null && nextQ90 !== undefined ? nextQ90 : Math.round(nextPv.ang / 90);
  for (let b = 0; b < 8; b++) {
    const cand = placedInPane(
      '2222',
      pairPrintParams(state.e, nextFrame, b, targetQ90),
      [0, 0],
      nextPv.vh,
      wide
    );
    if (samePrint(prevPlaced, cand, keep, 1e-6)) return b;
  }
  return null;
}

export function activatePartition(state, idx, paisleyFns = null) {
  if (idx < 0 || idx > 2 || idx === state.activeIdx) return state;
  const sf = sellingFrames(state.e);
  const nextFrame = sf[idx].M;
  const nextQ90 = Math.round(pairVectors(state.e, nextFrame).ang / 90);
  const kept = bitsThatKeep2222(state, nextFrame, paisleyFns, nextQ90);
  state.activeIdx = idx;
  state.activeFrame = nextFrame;
  state.q90 = nextQ90;
  state.pr = kept !== null ? kept : 0;
  return state;
}

export function setPartitionParams(state, idx, ell, t, paisleyFns = null) {
  if (idx !== state.activeIdx) activatePartition(state, idx, paisleyFns);
  const safeEll = clamp(Number.isFinite(ell) ? ell : 1, 0.35, 3.0);
  const safeT = clamp(Number.isFinite(t) ? t : 0, T_MIN, T_MAX);
  const angDeg = pairVectors(state.e, state.activeFrame).ang;
  state.e = basisFromPair(safeEll, safeT, state.activeFrame, angDeg);
  return state;
}

// ---- Exact 4-face disphenoid slicing against isolating cut lines y = 2kw +- c ----

function clipHalf(poly, Y, keepAbove) {
  const out = [];
  const side = (v) => (keepAbove ? v.p[1] - Y : Y - v.p[1]);
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sa = side(a);
    const sb = side(b);
    if (sa >= -1e-12) out.push(a);
    if ((sa > 1e-12 && sb < -1e-12) || (sa < -1e-12 && sb > 1e-12)) {
      const f = sa / (sa - sb);
      out.push({
        p: [a.p[0] + f * (b.p[0] - a.p[0]), a.p[1] + f * (b.p[1] - a.p[1])],
        pos: [
          a.pos[0] + f * (b.pos[0] - a.pos[0]),
          a.pos[1] + f * (b.pos[1] - a.pos[1]),
          a.pos[2] + f * (b.pos[2] - a.pos[2]),
        ],
      });
    }
  }
  return out;
}

function cutLineSegmentOnTri(triVerts, Y) {
  const hits = [];
  for (let i = 0; i < triVerts.length; i++) {
    const a = triVerts[i];
    const b = triVerts[(i + 1) % triVerts.length];
    const da = a.p[1] - Y;
    const db = b.p[1] - Y;
    if (Math.abs(da) <= 1e-10 && Math.abs(db) <= 1e-10) continue;
    if ((da <= 0 && db >= 0) || (da >= 0 && db <= 0)) {
      const denom = db - da;
      if (Math.abs(denom) < 1e-13) continue;
      const f = clamp(-da / denom, 0, 1);
      const pos = [
        a.pos[0] + f * (b.pos[0] - a.pos[0]),
        a.pos[1] + f * (b.pos[1] - a.pos[1]),
        a.pos[2] + f * (b.pos[2] - a.pos[2]),
      ];
      if (!hits.some((h) => norm3(sub3(h, pos)) < 1e-8)) hits.push(pos);
    }
  }
  if (hits.length >= 2 && norm3(sub3(hits[0], hits[1])) > 1e-8) {
    return [hits[0], hits[1]];
  }
  return null;
}

export function buildPillowMesh(e, activeFrame, cFrac = DEFAULT_C, { minConorm = 4e-4 } = {}) {
  const S = solidFromBasis(e, { minConorm });
  const pv = pairVectors(e, activeFrame);
  const toPair = (p) => [dot2(p, pv.vh), dot2(p, pv.nh)];
  const w = pv.w;
  const c = clamp(cFrac, 0.05, 0.95) * w;
  const tw = 2 * w;

  const vertsPos = [];
  const vertsUv = [];
  const vertsTint = [];
  const indices = [];
  const cutSegments = [];

  for (const tr of S.tris) {
    const poly0 = tr.pts.map((pt, i) => ({
      p: toPair(pt),
      pos: S.stage[tr.names[i]],
    }));
    const ys = poly0.map((v) => v.p[1]);
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);

    const cuts = [];
    const k0 = Math.floor((lo - c) / tw) - 1;
    const k1 = Math.ceil((hi + c) / tw) + 1;
    for (let k = k0; k <= k1; k++) {
      for (const Y of [2 * k * w - c, 2 * k * w + c]) {
        if (Y > lo + 1e-10 && Y < hi - 1e-10 && !cuts.some((u) => Math.abs(u - Y) < 1e-10)) {
          cuts.push(Y);
        }
      }
    }
    cuts.sort((a, b) => a - b);

    for (const Y of cuts) {
      const seg = cutLineSegmentOnTri(poly0, Y);
      if (seg) cutSegments.push(seg);
    }

    let rem = poly0;
    const pieces = [];
    for (const Y of cuts) {
      const below = clipHalf(rem, Y, false);
      const above = clipHalf(rem, Y, true);
      if (below.length >= 3) pieces.push(below);
      rem = above;
    }
    if (rem.length >= 3) pieces.push(rem);

    for (const pc of pieces) {
      let cy = 0;
      for (const v of pc) cy += v.p[1];
      cy /= pc.length;
      const shaded = (nstrip(cy, c, w) & 1) !== 0 ? 1 : 0;
      const base = vertsPos.length / 3;
      for (const v of pc) {
        vertsPos.push(v.pos[0], v.pos[1], v.pos[2]);
        vertsUv.push(v.p[0], v.p[1]);
        vertsTint.push(shaded);
      }
      for (let i = 1; i < pc.length - 1; i++) {
        indices.push(base, base + i, base + i + 1);
      }
    }
  }

  let cutLength = 0;
  for (const [a, b] of cutSegments) cutLength += norm3(sub3(a, b));

  const V = S.stage;
  const edgePairs = [
    { idx: 0, colorKey: 'ab', bend: S.bends[0], segs: [[V.A, V.B], [V.C, V.D]] },
    { idx: 1, colorKey: 'ac', bend: S.bends[1], segs: [[V.A, V.C], [V.B, V.D]] },
    { idx: 2, colorKey: 'ad', bend: S.bends[2], segs: [[V.A, V.D], [V.B, V.C]] },
  ];

  return {
    S,
    pv,
    positions: new Float32Array(vertsPos),
    uv: new Float32Array(vertsUv),
    tint: new Uint8Array(vertsTint),
    indices: new Uint32Array(indices),
    triangles: indices.length / 3,
    cutSegments,
    cutLength,
    edgePairs,
    corners: V,
    ca: mul2(2, toPair(S.va)),
    cb: mul2(2, toPair(S.vb)),
  };
}

function classifyEdgeNames(a, b) {
  const pair = [a, b].sort().join('');
  if (pair === 'AB') return { partIdx: 0, side: 0 };
  if (pair === 'CD') return { partIdx: 0, side: 1 };
  if (pair === 'AC') return { partIdx: 1, side: 0 };
  if (pair === 'BD') return { partIdx: 1, side: 1 };
  if (pair === 'AD') return { partIdx: 2, side: 0 };
  return { partIdx: 2, side: 1 };
}

/**
 * Rigid 4-triangle planar unfolding (two-cell parallelogram strip) of S nearest `target`.
 */
export function unfoldedNet(S, target = [0, 0.45]) {
  const { va, vb, sigma, bends } = S;
  const pt = (i, j) => [i * va[0] + j * vb[0], i * va[1] + j * vb[1]];
  const nm = (i, j) => 'ABCD'[(i & 1) + 2 * (j & 1)];

  let best = null;
  for (let m = -2; m <= 2; m++) {
    for (let n = -2; n <= 2; n++) {
      const cx = m * va[0] + (n + 0.5) * vb[0];
      const cy = m * va[1] + (n + 0.5) * vb[1];
      const d2 = (cx - target[0]) ** 2 + (cy - target[1]) ** 2 - 1e-6 * cy;
      if (!best || d2 < best.d2) best = { m, n, cx, cy, d2 };
    }
  }
  const { m, n } = best;
  const raw = [
    [[m - 1, n], [m, n], [m, n + 1]],
    [[m - 1, n], [m, n + 1], [m - 1, n + 1]],
    [[m, n], [m + 1, n], [m + 1, n + 1]],
    [[m, n], [m + 1, n + 1], [m, n + 1]],
  ];

  const tris = raw.map((tri) => {
    const ord = sigma > 0 ? tri : [tri[0], tri[2], tri[1]];
    return {
      pts: ord.map(([i, j]) => pt(i, j)),
      names: ord.map(([i, j]) => nm(i, j)),
    };
  });

  const edgeMap = new Map();
  for (const tri of raw) {
    for (let e = 0; e < 3; e++) {
      const [i0, j0] = tri[e];
      const [i1, j1] = tri[(e + 1) % 3];
      const k0 = `${i0},${j0}`;
      const k1 = `${i1},${j1}`;
      const key = k0 < k1 ? `${k0}|${k1}` : `${k1}|${k0}`;
      const existing = edgeMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        const n0 = nm(i0, j0);
        const n1 = nm(i1, j1);
        const { partIdx, side } = classifyEdgeNames(n0, n1);
        edgeMap.set(key, {
          a: pt(i0, j0),
          b: pt(i1, j1),
          names: [n0, n1],
          partIdx,
          side,
          bend: bends[partIdx],
          count: 1,
        });
      }
    }
  }

  const edges = [...edgeMap.values()].map((ed) => ({
    a: ed.a,
    b: ed.b,
    names: ed.names,
    partIdx: ed.partIdx,
    side: ed.side,
    bend: ed.bend,
    boundary: ed.count === 1,
  }));

  const rimCoords = [
    [m - 1, n],
    [m, n],
    [m + 1, n],
    [m - 1, n + 1],
    [m, n + 1],
    [m + 1, n + 1],
  ];
  const corners = rimCoords.map(([i, j]) => ({ i, j, pt: pt(i, j), name: nm(i, j) }));

  // Pick one clean label position per class {A, B, C, D}, preferring interior-ish corners nearest centroid
  const labelCorners = {};
  for (const c of corners) {
    const d2 = (c.pt[0] - best.cx) ** 2 + (c.pt[1] - best.cy) ** 2;
    if (!labelCorners[c.name] || d2 < labelCorners[c.name].d2 - 1e-9) {
      labelCorners[c.name] = { ...c, d2 };
    }
  }

  const outline = [pt(m - 1, n), pt(m + 1, n), pt(m + 1, n + 1), pt(m - 1, n + 1)];
  let area = 0;
  for (const t of tris) {
    area += 0.5 * Math.abs(det2(sub2(t.pts[1], t.pts[0]), sub2(t.pts[2], t.pts[0])));
  }

  return {
    tris,
    outline,
    edges,
    corners,
    labelCorners,
    centroid: [best.cx, best.cy],
    area,
  };
}
