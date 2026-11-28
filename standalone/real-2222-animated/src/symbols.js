// symbols.js — pure geometry for "The real 2222 animated":
// fixed aspect ratio/size (FIXED_ELL = REG_ELL), four unique 180-deg symmetric colored emblems
// carved seamlessly into the four faces (zero z-fighting), and three continuous twist animations
// where each pairing holds its first pair fixed in 3D while rotating only the other pair.

import {
  REG_ELL,
  clamp,
  mod,
  sub2,
  det2,
  dot2,
  mul2,
  add3,
  sub3,
  mul3,
  dot3,
  cross3,
  norm3,
  unit3,
  basisFromPair,
  pairVectors,
  solidFromBasis,
  createModel,
  activatePartition,
} from '../../real-2222/src/real2222.js';

export const FIXED_ELL = REG_ELL; // (4/3)^(1/4) = 1.07456993...
export const ANIM_PERIOD = 1.0;   // one full 360-deg rotation of the second pair returns all corners identically
export const BASE_TURNS_PER_SEC = 0.22;
export const REG_HALF_AXIS = Math.sqrt(1 / Math.sqrt(3)) / 2;
export const PAIR_SPLITS = [
  [['A', 'B'], ['C', 'D']],
  [['A', 'C'], ['B', 'D']],
  [['A', 'D'], ['B', 'C']],
];

export const FEATURES = {
  A: { name: 'A', label: 'Star', tint: 4, palIdx: 0, light: '#0072B2', dark: '#4DB6F5' },
  B: { name: 'B', label: 'Diamond', tint: 5, palIdx: 1, light: '#D55E00', dark: '#FF7B54' },
  C: { name: 'C', label: 'Cross', tint: 6, palIdx: 2, light: '#009E73', dark: '#2DD49F' },
  D: { name: 'D', label: 'Circle', tint: 7, palIdx: 3, light: '#8841B8', dark: '#C084FC' },
};

export const FEATURE_LIST = [FEATURES.A, FEATURES.B, FEATURES.C, FEATURES.D];

function makeSymbolPolys() {
  // A: 4-pointed star (8 vertices, strictly C4 / 180-deg symmetric)
  const star = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const r = i % 2 === 0 ? 0.27 : 0.102;
    star.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  // B: Elongated diamond (4 vertices, strictly C2 / 180-deg symmetric)
  const diamond = [
    [0.27, 0],
    [0, 0.16],
    [-0.27, 0],
    [0, -0.16],
  ];
  // C: Swiss cross (12 vertices, strictly C4 / 180-deg symmetric)
  const L = 0.23;
  const W = 0.076;
  const cross = [
    [L, -W],
    [L, W],
    [W, W],
    [W, L],
    [-W, L],
    [-W, W],
    [-L, W],
    [-L, -W],
    [-W, -W],
    [-W, -L],
    [W, -L],
    [W, -W],
  ];
  // D: Smooth circle (24-gon, strictly circular / 180-deg symmetric)
  const circle = [];
  for (let i = 0; i < 24; i++) {
    const a = (i * 2 * Math.PI) / 24;
    circle.push([0.195 * Math.cos(a), 0.195 * Math.sin(a)]);
  }
  return { A: star, B: diamond, C: cross, D: circle };
}

export const SYMBOL_POLYS = makeSymbolPolys();

/** Unique point where ray from origin at angle `th` exits star-shaped CCW polygon `poly`. */
export function rayPolyPoint(poly, th) {
  const dx = Math.cos(th);
  const dy = Math.sin(th);
  let bestT = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-13) continue;
    const t = (a[0] * ey - a[1] * ex) / denom;
    const u = (a[0] * dy - a[1] * dx) / denom;
    if (t > 1e-10 && u >= -1e-9 && u <= 1 + 1e-9 && t < bestT) bestT = t;
  }
  return [bestT * dx, bestT * dy];
}

/** Ordered CCW boundary points along `poly` across angular wedge [th0, th1]. */
export function wedgeRim(poly, th0, th1) {
  const span = th1 - th0;
  const pStart = rayPolyPoint(poly, th0);
  const pEnd = rayPolyPoint(poly, th1);
  const inside = [];
  for (const v of poly) {
    const rel = mod(Math.atan2(v[1], v[0]) - th0, 2 * Math.PI);
    if (rel > 1e-7 && rel < span - 1e-7) inside.push({ rel, p: v });
  }
  inside.sort((u, v) => u.rel - v.rel);
  return [pStart, ...inside.map((x) => x.p), pEnd];
}

/** Ear-clipping triangulation of a simple CCW 2D polygon; returns index triples. */
export function earClip(pts) {
  const idx = pts.map((_, i) => i);
  const tris = [];
  const inTri = (p, a, b, c) => {
    const d1 = det2(sub2(b, a), sub2(p, a));
    const d2 = det2(sub2(c, b), sub2(p, b));
    const d3 = det2(sub2(a, c), sub2(p, c));
    return d1 >= -1e-12 && d2 >= -1e-12 && d3 >= -1e-12;
  };
  let guard = idx.length * idx.length + 10;
  while (idx.length > 3 && guard-- > 0) {
    let cut = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length];
      const ib = idx[i];
      const ic = idx[(i + 1) % idx.length];
      const a = pts[ia];
      const b = pts[ib];
      const c = pts[ic];
      if (det2(sub2(b, a), sub2(c, a)) <= 1e-12) continue;
      let hasInside = false;
      for (let j = 0; j < idx.length; j++) {
        const k = idx[j];
        if (k === ia || k === ib || k === ic) continue;
        if (inTri(pts[k], a, b, c)) {
          hasInside = true;
          break;
        }
      }
      if (!hasInside) {
        tris.push([ia, ib, ic]);
        idx.splice(i, 1);
        cut = true;
        break;
      }
    }
    if (!cut) throw new Error(`earClip stalled with ${idx.length} vertices`);
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}

/**
 * Intrinsic rigid frame attached to the active pairing's first (pinned) pair in stage coords.
 * Axis w uses S.ex/S.ey/S.ez directly so it stays unit-length even at flat degenerate states.
 */
export function intrinsicPairFrame(S, activeIdx) {
  const [[p0, p1]] = PAIR_SPLITS[activeIdx];
  const V = S.stage;
  const mid = mul3(0.5, add3(V[p0], V[p1]));
  const u = unit3(sub3(V[p1], V[p0]));
  const w = activeIdx === 0 ? [0, 0, S.ex] : activeIdx === 1 ? [S.ey, 0, 0] : [0, S.ez, 0];
  const v = cross3(w, u);
  return { mid, u, v, w };
}

function mapPointBetweenFrames(q, src, dst) {
  const d = sub3(q, src.mid);
  const cu = dot3(d, src.u);
  const cv = dot3(d, src.v);
  const cw = dot3(d, src.w);
  return [
    dst.mid[0] + cu * dst.u[0] + cv * dst.v[0] + cw * dst.w[0],
    dst.mid[1] + cu * dst.u[1] + cv * dst.v[1] + cw * dst.w[1],
    dst.mid[2] + cu * dst.u[2] + cv * dst.v[2] + cw * dst.w[2],
  ];
}

function mapDirBetweenFrames(dir, src, dst) {
  const cu = dot3(dir, src.u);
  const cv = dot3(dir, src.v);
  const cw = dot3(dir, src.w);
  return [
    cu * dst.u[0] + cv * dst.v[0] + cw * dst.w[0],
    cu * dst.u[1] + cv * dst.v[1] + cw * dst.w[1],
    cu * dst.u[2] + cv * dst.v[2] + cw * dst.w[2],
  ];
}

export function worldCornersFromState(e, activeIdx, pinFrame, { minConorm = 4e-4 } = {}) {
  const S = solidFromBasis(e, { minConorm });
  if (!pinFrame) return { S, V: S.stage };
  const src = intrinsicPairFrame(S, activeIdx);
  const V = {};
  for (const name of ['A', 'B', 'C', 'D']) {
    V[name] = mapPointBetweenFrames(S.stage[name], src, pinFrame);
  }
  return { S, V };
}

/**
 * Exact non-overlapping carved disphenoid mesh for "The real 2222 animated":
 * each corner feature carves its 180-deg symmetric emblem out of each incident triangle face
 * (tint = 4..7) while the remaining background interior stays tint = 0 (Paisley print).
 */
export function buildSymbolPillowMesh(
  e,
  activeFrame,
  { minConorm = 4e-4, activeIdx = 0, pinFrame = null } = {}
) {
  const { S, V } = worldCornersFromState(e, activeIdx, pinFrame, { minConorm });
  const pv = pairVectors(e, activeFrame);
  const toPair = (p) => [dot2(p, pv.vh), dot2(p, pv.nh)];

  const vertsPos = [];
  const vertsUv = [];
  const vertsTint = [];
  const indices = [];

  const pushTri = (pts3, ptsUv, tintVal) => {
    const base = vertsPos.length / 3;
    for (let k = 0; k < 3; k++) {
      const p3 = pts3[k];
      const u = ptsUv[k];
      vertsPos.push(p3[0], p3[1], p3[2]);
      vertsUv.push(u[0], u[1]);
      vertsTint.push(tintVal);
    }
    indices.push(base, base + 1, base + 2);
  };

  for (const tr of S.tris) {
    // Work in global plane coordinates tr.pts so corner emblems never jump/spin on active pair switch
    const V2 = tr.pts;
    const V3 = tr.names.map((n) => V[n]);
    const d2 = det2(sub2(V2[1], V2[0]), sub2(V2[2], V2[0]));
    const to3d = (q) => {
      const w0 = det2(sub2(V2[1], q), sub2(V2[2], q)) / d2;
      const w1 = det2(sub2(V2[2], q), sub2(V2[0], q)) / d2;
      const w2 = 1 - w0 - w1;
      return [
        w0 * V3[0][0] + w1 * V3[1][0] + w2 * V3[2][0],
        w0 * V3[0][1] + w1 * V3[1][1] + w2 * V3[2][1],
        w0 * V3[0][2] + w1 * V3[1][2] + w2 * V3[2][2],
      ];
    };

    const bgBoundary = [];
    for (let k = 0; k < 3; k++) {
      const name = tr.names[k];
      const vk = V2[k];
      const vNext = V2[(k + 1) % 3];
      const vPrev = V2[(k + 2) % 3];
      const th0 = Math.atan2(vNext[1] - vk[1], vNext[0] - vk[0]);
      let th1 = Math.atan2(vPrev[1] - vk[1], vPrev[0] - vk[0]);
      while (th1 <= th0) th1 += 2 * Math.PI;

      const rimRel = wedgeRim(SYMBOL_POLYS[name], th0, th1);
      const rimAbs = rimRel.map((p) => [vk[0] + p[0], vk[1] + p[1]]);
      const tintVal = FEATURES[name].tint;
      const vk3 = V3[k];
      const vkUv = toPair(vk);

      for (let j = 0; j < rimAbs.length - 1; j++) {
        const pA = rimAbs[j];
        const pB = rimAbs[j + 1];
        pushTri([vk3, to3d(pA), to3d(pB)], [vkUv, toPair(pA), toPair(pB)], tintVal);
      }

      // Walk corner rim in reverse around interior cavity so overall background polygon is CCW
      for (let j = rimAbs.length - 1; j >= 0; j--) bgBoundary.push(rimAbs[j]);
    }

    const bgTris = earClip(bgBoundary);
    for (const [ia, ib, ic] of bgTris) {
      const p0 = bgBoundary[ia];
      const p1 = bgBoundary[ib];
      const p2 = bgBoundary[ic];
      pushTri([to3d(p0), to3d(p1), to3d(p2)], [toPair(p0), toPair(p1), toPair(p2)], 0);
    }
  }

  const edgePairs = [
    { idx: 0, segs: [[V.A, V.B], [V.C, V.D]], bend: S.bends[0] },
    { idx: 1, segs: [[V.A, V.C], [V.B, V.D]], bend: S.bends[1] },
    { idx: 2, segs: [[V.A, V.D], [V.B, V.C]], bend: S.bends[2] },
  ];

  return {
    S,
    pv,
    positions: new Float32Array(vertsPos),
    uv: new Float32Array(vertsUv),
    tint: new Uint8Array(vertsTint),
    indices: new Uint32Array(indices),
    triangles: indices.length / 3,
    edgePairs,
    corners: V,
    ca: mul2(2, toPair(S.va)),
    cb: mul2(2, toPair(S.vb)),
  };
}

// ---- Animation State Machine ----

export function createAnimModel({ activeIdx = 0, t = 0.25, ell = FIXED_ELL, playing = true, speed = 1 } = {}) {
  const safeEll = clamp(Number.isFinite(ell) ? ell : FIXED_ELL, 0.5, 2.0);
  const safeT = mod(Number.isFinite(t) ? t : 0.25, ANIM_PERIOD);
  const base = createModel({ ell: safeEll, t: 0, activeIdx: 0 });
  if (activeIdx === 1 || activeIdx === 2) activatePartition(base, activeIdx, null);
  const angDeg = pairVectors(base.e, base.activeFrame).ang;
  base.e = basisFromPair(safeEll, safeT, base.activeFrame, angDeg);
  const S0 = solidFromBasis(base.e, { minConorm: 4e-4 });
  return {
    ...base,
    animEll: safeEll,
    animT: safeT,
    playing: !!playing,
    speed: Number.isFinite(speed) && speed > 0 ? speed : 1,
    glide: null,
    pinFrame: intrinsicPairFrame(S0, base.activeIdx),
    midGlide: null,
  };
}

export function switchAnimPair(state, nextIdx, paisleyFns = null) {
  if (nextIdx < 0 || nextIdx > 2 || nextIdx === state.activeIdx) return state;

  // Snapshot exact current 3D world pose and new pair's perpendicular axis before switching frames
  const S = solidFromBasis(state.e, { minConorm: 4e-4 });
  const srcOld = intrinsicPairFrame(S, state.activeIdx);
  const dstOld = state.pinFrame || srcOld;
  const W = {};
  for (const name of ['A', 'B', 'C', 'D']) {
    W[name] = mapPointBetweenFrames(S.stage[name], srcOld, dstOld);
  }
  const rawW = mapDirBetweenFrames(intrinsicPairFrame(S, nextIdx).w, srcOld, dstOld);
  const [[p0, p1]] = PAIR_SPLITS[nextIdx];
  const newMid = mul3(0.5, add3(W[p0], W[p1]));
  const newU = unit3(sub3(W[p1], W[p0]));
  const newW = unit3(sub3(rawW, mul3(dot3(rawW, newU), newU)));
  const newV = cross3(newW, newU);
  state.pinFrame = { mid: newMid, u: newU, v: newV, w: newW };

  const idealMid = mul3(-REG_HALF_AXIS, newW);
  state.midGlide = norm3(sub3(newMid, idealMid)) > 1e-4
    ? { from: newMid.slice(), to: idealMid, elapsed: 0, dur: 0.35 }
    : null;

  activatePartition(state, nextIdx, paisleyFns);
  const pv = pairVectors(state.e, state.activeFrame);
  state.animEll = pv.ell;
  state.animT = mod(pv.t, ANIM_PERIOD);
  state.glide = Math.abs(pv.ell - FIXED_ELL) > 1e-4
    ? { fromEll: pv.ell, toEll: FIXED_ELL, elapsed: 0, dur: 0.35 }
    : null;
  if (!state.glide) {
    state.animEll = FIXED_ELL;
    state.e = basisFromPair(FIXED_ELL, state.animT, state.activeFrame, pv.ang);
  }
  return state;
}

export function stepAnim(state, dtSec) {
  const dt = clamp(Number.isFinite(dtSec) ? dtSec : 0, 0, 0.1);
  if (state.glide) {
    const g = state.glide;
    g.elapsed += dt;
    const u = clamp(g.elapsed / g.dur, 0, 1);
    const ease = u * u * (3 - 2 * u);
    state.animEll = g.fromEll + (g.toEll - g.fromEll) * ease;
    if (u >= 1) {
      state.animEll = g.toEll;
      state.glide = null;
    }
  }
  if (state.midGlide && state.pinFrame) {
    const g = state.midGlide;
    g.elapsed += dt;
    const u = clamp(g.elapsed / g.dur, 0, 1);
    const ease = u * u * (3 - 2 * u);
    state.pinFrame.mid = [
      g.from[0] + (g.to[0] - g.from[0]) * ease,
      g.from[1] + (g.to[1] - g.from[1]) * ease,
      g.from[2] + (g.to[2] - g.from[2]) * ease,
    ];
    if (u >= 1) {
      state.pinFrame.mid = g.to.slice();
      state.midGlide = null;
    }
  }
  if (state.playing) {
    state.animT = mod(state.animT + dt * BASE_TURNS_PER_SEC * state.speed, ANIM_PERIOD);
  }
  const angDeg = pairVectors(state.e, state.activeFrame).ang;
  state.e = basisFromPair(state.animEll, state.animT, state.activeFrame, angDeg);
  return state;
}

export function scrubAnimTwist(state, newT) {
  state.animT = mod(Number.isFinite(newT) ? newT : 0, ANIM_PERIOD);
  state.animEll = state.glide ? state.animEll : FIXED_ELL;
  const angDeg = pairVectors(state.e, state.activeFrame).ang;
  state.e = basisFromPair(state.animEll, state.animT, state.activeFrame, angDeg);
  return state;
}
