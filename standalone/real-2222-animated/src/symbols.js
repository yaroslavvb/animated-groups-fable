// symbols.js — pure geometry for "The real 2222 animated":
// large overlapping 180-deg symmetric colored motifs carved cleanly via exact convex BSP partitioning
// with 15-color stained-glass overlap blending, and three twist animations holding each first pair fixed in 3D.

import {
  REG_ELL,
  clamp,
  mod,
  coords2,
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
export const PAIR_SPLITS = [
  [['A', 'B'], ['C', 'D']],
  [['A', 'C'], ['B', 'D']],
  [['A', 'D'], ['B', 'C']],
];
export const MAX_SYMBOL_RADIUS = 0.69;
export const OVERLAP_ALPHA_LIGHT = 0.76;
export const OVERLAP_ALPHA_DARK = 0.78;

export const FEATURES = {
  A: { name: 'A', label: 'Star', tint: 4, palIdx: 0, maskBit: 1, light: '#0072B2', dark: '#4DB6F5' },
  B: { name: 'B', label: 'Diamond', tint: 5, palIdx: 1, maskBit: 2, light: '#D55E00', dark: '#FF7B54' },
  C: { name: 'C', label: 'Cross', tint: 7, palIdx: 3, maskBit: 4, light: '#009E73', dark: '#2DD49F' },
  D: { name: 'D', label: 'Circle', tint: 11, palIdx: 7, maskBit: 8, light: '#8841B8', dark: '#C084FC' },
};

export const FEATURE_LIST = [FEATURES.A, FEATURES.B, FEATURES.C, FEATURES.D];

function makeSymbolData() {
  // A: Large 4-pointed star (R=0.64, inner corner (0.15, 0.15)) as union of 2 stretched diamonds
  const R = 0.64;
  const c = 0.15;
  const h = (R * c) / (R - c);
  const star = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const r = i % 2 === 0 ? R : c * Math.SQRT2;
    star.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  const starParts = [
    [[R, 0], [0, h], [-R, 0], [0, -h]],
    [[h, 0], [0, R], [-h, 0], [0, -R]],
  ];

  // B: Large diamond (0.68 x 0.56 half-axes so adjacent overlaps happen in both horizontal and vertical pairings)
  const diamond = [
    [0.68, 0],
    [0, 0.56],
    [-0.68, 0],
    [0, -0.56],
  ];

  // C: Large Swiss cross (arm L=0.60, half-width W=0.14) as union of 2 bars
  const L = 0.60;
  const W = 0.14;
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
  const crossParts = [
    [[L, -W], [L, W], [-L, W], [-L, -W]],
    [[W, -L], [W, L], [-W, L], [-W, -L]],
  ];

  // D: Large smooth circle (20-gon of radius 0.54)
  const circle = [];
  for (let i = 0; i < 20; i++) {
    const a = (i * 2 * Math.PI) / 20;
    circle.push([0.54 * Math.cos(a), 0.54 * Math.sin(a)]);
  }

  return {
    polys: { A: star, B: diamond, C: cross, D: circle },
    parts: { A: starParts, B: [diamond], C: crossParts, D: [circle] },
  };
}

const SYMBOL_DATA = makeSymbolData();
export const SYMBOL_POLYS = SYMBOL_DATA.polys;
export const SYMBOL_CONVEX_PARTS = SYMBOL_DATA.parts;

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function rgbToHex([r, g, b]) {
  return '#' + [r, g, b]
    .map((x) => Math.round(clamp(x, 0, 1) * 255).toString(16).padStart(2, '0'))
    .join('');
}

export function buildOverlapPalette(dark) {
  const groundHex = dark ? '#1f3532' : '#dceee9';
  const G = hexToRgb(groundHex);
  const alpha = dark ? OVERLAP_ALPHA_DARK : OVERLAP_ALPHA_LIGHT;
  const cols = FEATURE_LIST.map((f) => hexToRgb(dark ? f.dark : f.light));
  const palette = [];
  for (let mask = 1; mask <= 15; mask++) {
    const cur = G.slice();
    for (let i = 0; i < 4; i++) {
      if (!(mask & (1 << i))) continue;
      const M = cols[i];
      for (let c = 0; c < 3; c++) {
        cur[c] = dark
          ? 1 - (1 - cur[c]) * (1 - alpha * M[c])
          : cur[c] * ((1 - alpha) + alpha * M[c]);
      }
    }
    const hex = rgbToHex(cur);
    palette.push({ front: hex, back: hex });
  }
  return palette;
}

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

function polyArea2(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - p[1] * q[0];
  }
  return 0.5 * a;
}

function polyBBox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  return [x0, y0, x1, y1];
}

function splitConvexByLine(poly, ax, ay, bx, by) {
  const ex = bx - ax;
  const ey = by - ay;
  const n = poly.length;
  const side = new Array(n);
  let anyIn = false;
  let anyOut = false;
  for (let i = 0; i < n; i++) {
    const s = ex * (poly[i][1] - ay) - ey * (poly[i][0] - ax);
    side[i] = s;
    if (s > 1e-11) anyIn = true;
    else if (s < -1e-11) anyOut = true;
  }
  if (!anyOut) return [poly, null];
  if (!anyIn) return [null, poly];
  const inP = [];
  const outP = [];
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    const sp = side[i];
    const sq = side[(i + 1) % n];
    if (sp >= -1e-11) inP.push(p);
    if (sp <= 1e-11) outP.push(p);
    if ((sp > 1e-11 && sq < -1e-11) || (sp < -1e-11 && sq > 1e-11)) {
      const f = sp / (sp - sq);
      const mid = [p[0] + f * (q[0] - p[0]), p[1] + f * (q[1] - p[1])];
      inP.push(mid);
      outP.push(mid);
    }
  }
  return [
    inP.length >= 3 && polyArea2(inP) > 1e-10 ? inP : null,
    outP.length >= 3 && polyArea2(outP) > 1e-10 ? outP : null,
  ];
}

function partitionTriangleByMotifs(V2, S) {
  const tb = polyBBox(V2);
  const pad = MAX_SYMBOL_RADIUS + 0.05;
  const boxCorners = [
    [tb[0] - pad, tb[1] - pad],
    [tb[2] + pad, tb[1] - pad],
    [tb[2] + pad, tb[3] + pad],
    [tb[0] - pad, tb[3] + pad],
  ];
  let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
  for (const pt of boxCorners) {
    const [a, b] = coords2(pt, S.va, S.vb);
    if (a < aMin) aMin = a;
    if (a > aMax) aMax = a;
    if (b < bMin) bMin = b;
    if (b > bMax) bMax = b;
  }

  const shapes = [];
  for (let jb = Math.floor(bMin); jb <= Math.ceil(bMax); jb++) {
    for (let ia = Math.floor(aMin); ia <= Math.ceil(aMax); ia++) {
      const cx = ia * S.va[0] + jb * S.vb[0];
      const cy = ia * S.va[1] + jb * S.vb[1];
      if (cx + MAX_SYMBOL_RADIUS < tb[0] || cx - MAX_SYMBOL_RADIUS > tb[2] || cy + MAX_SYMBOL_RADIUS < tb[1] || cy - MAX_SYMBOL_RADIUS > tb[3]) {
        continue;
      }
      const idx = (ia & 1) + 2 * (jb & 1);
      const name = 'ABCD'[idx];
      const bit = 1 << idx;
      for (const basePoly of SYMBOL_CONVEX_PARTS[name]) {
        const poly = basePoly.map((p) => [cx + p[0], cy + p[1]]);
        const bb = polyBBox(poly);
        if (bb[2] < tb[0] || bb[0] > tb[2] || bb[3] < tb[1] || bb[1] > tb[3]) continue;
        shapes.push({ poly, bb, bit, order: poly.length });
      }
    }
  }
  shapes.sort((u, v) => u.order - v.order);

  let pieces = [{ poly: V2, bb: tb, mask: 0 }];
  for (const sh of shapes) {
    const next = [];
    const sb = sh.bb;
    for (const pc of pieces) {
      if ((pc.mask & sh.bit) !== 0 || pc.bb[2] < sb[0] || pc.bb[0] > sb[2] || pc.bb[3] < sb[1] || pc.bb[1] > sb[3]) {
        next.push(pc);
        continue;
      }
      let inside = pc.poly;
      for (let i = 0; i < sh.poly.length; i++) {
        const a = sh.poly[i];
        const b = sh.poly[(i + 1) % sh.poly.length];
        const [inP, outP] = splitConvexByLine(inside, a[0], a[1], b[0], b[1]);
        if (outP) next.push({ poly: outP, bb: polyBBox(outP), mask: pc.mask });
        if (!inP) {
          inside = null;
          break;
        }
        inside = inP;
      }
      if (inside) next.push({ poly: inside, bb: polyBBox(inside), mask: pc.mask | sh.bit });
    }
    pieces = next;
  }
  return pieces;
}

/**
 * Intrinsic rigid frame attached to the active pairing's first (pinned) pair in stage coords.
 * Uses the fixed unsigned stage axis w so there are no 180-deg flips when X/Y/Z cross 0 (ell >= sqrt(2)).
 */
export function intrinsicPairFrame(S, activeIdx) {
  const [[p0, p1]] = PAIR_SPLITS[activeIdx];
  const V = S.stage;
  const mid = mul3(0.5, add3(V[p0], V[p1]));
  const u = unit3(sub3(V[p1], V[p0]));
  const w = activeIdx === 0 ? [0, 0, 1] : activeIdx === 1 ? [1, 0, 0] : [0, 1, 0];
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
 * Exact non-overlapping carved disphenoid mesh with multi-motif overlap regions:
 * partitions each face by all overlapping 180-deg symmetric corner motifs via exact convex BSP,
 * assigning tint = 0 (Paisley ground) or 3 + mask (1..15 stained-glass overlap palette).
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
    // Work in global plane coordinates tr.pts so motifs never jump/spin on active pair switch
    const V2 = tr.pts;
    const V3 = tr.names.map((n) => V[n]);
    const d2 = det2([V2[1][0] - V2[0][0], V2[1][1] - V2[0][1]], [V2[2][0] - V2[0][0], V2[2][1] - V2[0][1]]);
    const to3d = (q) => {
      const w0 = det2([V2[1][0] - q[0], V2[1][1] - q[1]], [V2[2][0] - q[0], V2[2][1] - q[1]]) / d2;
      const w1 = det2([V2[2][0] - q[0], V2[2][1] - q[1]], [V2[0][0] - q[0], V2[0][1] - q[1]]) / d2;
      const w2 = 1 - w0 - w1;
      return [
        w0 * V3[0][0] + w1 * V3[1][0] + w2 * V3[2][0],
        w0 * V3[0][1] + w1 * V3[1][1] + w2 * V3[2][1],
        w0 * V3[0][2] + w1 * V3[1][2] + w2 * V3[2][2],
      ];
    };

    const pieces = partitionTriangleByMotifs(V2, S);
    for (const pc of pieces) {
      const poly = pc.poly;
      const tintVal = pc.mask === 0 ? 0 : 3 + pc.mask;
      const p03 = to3d(poly[0]);
      const p0uv = toPair(poly[0]);
      for (let k = 1; k < poly.length - 1; k++) {
        pushTri(
          [p03, to3d(poly[k]), to3d(poly[k + 1])],
          [p0uv, toPair(poly[k]), toPair(poly[k + 1])],
          tintVal
        );
      }
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

export function computeOrbitFrame(state) {
  const angDeg = pairVectors(state.e, state.activeFrame).ang;
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  const pts = [];
  for (let k = 0; k < 16; k++) {
    const e = basisFromPair(state.animEll, k / 16, state.activeFrame, angDeg);
    const { V } = worldCornersFromState(e, state.activeIdx, state.pinFrame, { minConorm: 4e-4 });
    for (const name of ['A', 'B', 'C', 'D']) {
      const p = V[name];
      pts.push(p);
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
      if (p[2] < minZ) minZ = p[2];
      if (p[2] > maxZ) maxZ = p[2];
    }
  }
  const center = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
  let r = 0;
  for (const p of pts) {
    const d = norm3(sub3(p, center));
    if (d > r) r = d;
  }
  return { center, radius: Math.max(0.86, r * 1.15) };
}

export function createAnimModel({ activeIdx = 0, t = 0.25, ell = FIXED_ELL, playing = true, speed = 1 } = {}) {
  const safeEll = clamp(Number.isFinite(ell) ? ell : FIXED_ELL, 0.2, 5.0);
  const safeT = mod(Number.isFinite(t) ? t : 0.25, ANIM_PERIOD);
  const base = createModel({ ell: safeEll, t: 0, activeIdx: 0 });
  if (activeIdx === 1 || activeIdx === 2) activatePartition(base, activeIdx, null);
  const angDeg = pairVectors(base.e, base.activeFrame).ang;
  base.e = basisFromPair(safeEll, safeT, base.activeFrame, angDeg);
  const S0 = solidFromBasis(base.e, { minConorm: 4e-4 });
  const state = {
    ...base,
    animEll: safeEll,
    animT: safeT,
    playing: !!playing,
    speed: Number.isFinite(speed) && speed > 0 ? speed : 1,
    pinFrame: intrinsicPairFrame(S0, base.activeIdx),
    orbitFrame: null,
  };
  state.orbitFrame = computeOrbitFrame(state);
  return state;
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

  activatePartition(state, nextIdx, paisleyFns);
  const pv = pairVectors(state.e, state.activeFrame);
  state.animEll = pv.ell;
  state.animT = mod(pv.t, ANIM_PERIOD);
  state.orbitFrame = computeOrbitFrame(state);
  return state;
}

export function stepAnim(state, dtSec) {
  const dt = clamp(Number.isFinite(dtSec) ? dtSec : 0, 0, 0.1);
  if (state.playing) {
    state.animT = mod(state.animT + dt * BASE_TURNS_PER_SEC * state.speed, ANIM_PERIOD);
  }
  const angDeg = pairVectors(state.e, state.activeFrame).ang;
  state.e = basisFromPair(state.animEll, state.animT, state.activeFrame, angDeg);
  return state;
}

export function scrubAnimTwist(state, newT) {
  state.animT = mod(Number.isFinite(newT) ? newT : 0, ANIM_PERIOD);
  const angDeg = pairVectors(state.e, state.activeFrame).ang;
  state.e = basisFromPair(state.animEll, state.animT, state.activeFrame, angDeg);
  return state;
}
