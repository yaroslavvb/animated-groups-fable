// looks.js — the ways the lab draws a sheet (motions.js): the geometry each look needs, and the per-frame helpers
// (a plane that cuts the front off, slices, the crossing's preimage on the paper). Pure (no DOM).
//
//   LOOKS                         [{ key, label, note }]
//   baseGeometry(sheet)           the sheet's own triangles
//   piecesGeometry(sheet)         the same, no vertex shared between two rigid pieces; tint = 4 + the piece's colour
//   checkerGeometry(sheet, step)  the triangles split along a square grid printed on the paper; tint = 4 or 5
//   createCutter(tri, n)          -> cut(pos, y0): the surface with everything in front of the plane y = y0 removed
//   createSlicer(tri, n)          -> slice(pos, y0, dy): the curves in which the planes y = y0 + k dy meet the surface
//   clipPolylineY(points, y0)     the parts of a polyline with y >= y0
//   crossingOnPaper(...)          the two curves of the paper that meet along the crossing
//   PIECE_COLORS, PAPER, CHECKER, CROSS_RGB

import { inverse, clipHalfPlane } from '../../src/geom.js';
import { hexToRgb } from '../../src/palette.js';

export const LOOKS = [
  { key: 'xray', label: 'X-ray', note: 'translucent' },
  { key: 'paper', label: 'Two-sided', note: 'front teal, back sand' },
  { key: 'pieces', label: 'Pieces', note: 'one colour per rigid piece' },
  { key: 'checker', label: 'Checkerboard', note: 'a print on the paper' },
  { key: 'ribs', label: 'Slices', note: 'cross-sections' },
  { key: 'cutaway', label: 'Cutaway', note: 'the front removed' },
];

/** Where the sheet passes through itself: vermilion (Okabe-Ito), the one loud colour of the page. */
export const CROSS_HEX = '#D55E00';
export const CROSS_RGB = hexToRgb(CROSS_HEX);
const lighten = (c, k) => c.map((v) => v + (1 - v) * k);
/** Piece colours (front); the back is the same colour, paler. Light enough for the bold seam colours to read on them. */
export const PIECE_HEX = ['#8fcfc6', '#f0c987', '#c3b5e8', '#9cc4e8', '#d3cd7e', '#aed597', '#cfcfd6', '#e6b088', '#86bcd0', '#d9c2a0', '#b9c9a0', '#bdb2cc'];
export const PIECE_COLORS = PIECE_HEX.map((h) => { const f = hexToRgb(h); return { front: f, back: lighten(f, 0.5) }; });
/** Two-sided paper. */
export const PAPER = { front: hexToRgb('#5fb3a8'), back: hexToRgb('#eedab2') };
/** The checkerboard: [light, dark], each with a front and a back. */
export const CHECKER = [
  { front: hexToRgb('#9ad5cc'), back: hexToRgb('#f5e6c6') },
  { front: hexToRgb('#4fa397'), back: hexToRgb('#d8bd85') },
];

export function baseGeometry(sheet) {
  return { n: sheet.n, uv: sheet.uv, tag: sheet.tag, tri: sheet.tri, tint: null, src: null };
}

/** No vertex shared between two pieces, so each piece is one flat colour: tint = 4 + part. src = the sheet's vertex. */
export function piecesGeometry(sheet) {
  const m = sheet.tri.length / 3, T = sheet.tags.length;
  const id = new Map(), uv = [], tag = [], src = [], tint = [], tri = new Uint32Array(3 * m);
  for (let t = 0; t < m; t++) {
    const tg = sheet.triTag[t];
    for (let e = 0; e < 3; e++) {
      const v = sheet.tri[3 * t + e], key = v * T + tg;
      let i = id.get(key);
      if (i === undefined) {
        i = tag.length; id.set(key, i);
        uv.push(sheet.uv[2 * v], sheet.uv[2 * v + 1]); tag.push(tg); src.push(v); tint.push(4 + (sheet.tags[tg].part % PIECE_COLORS.length));
      }
      tri[3 * t + e] = i;
    }
  }
  return { n: tag.length, uv: Float64Array.from(uv), tag: Uint16Array.from(tag), tri, tint: Uint8Array.from(tint), src: Int32Array.from(src) };
}

/**
 * The sheet's triangles split along a square grid of side `step` on the PAPER (the tile's own plane), so the print
 * rides with the paper whatever the motion does: tint 4 on the squares with i + j even, 5 on the others.
 */
export function checkerGeometry(sheet, step) {
  const m = sheet.tri.length / 3;
  const id = new Map(), uv = [], tag = [], tint = [], tri = [];
  const invOf = new Map();
  const vertex = (u, v, tg, par) => {
    const key = Math.round(u * 4e6) + ',' + Math.round(v * 4e6) + ',' + tg + ',' + par;
    let i = id.get(key);
    if (i === undefined) { i = tag.length; id.set(key, i); uv.push(u, v); tag.push(tg); tint.push(4 + par); }
    return i;
  };
  const eps2 = 1e-14;
  for (let t = 0; t < m; t++) {
    const tg = sheet.triTag[t], A = sheet.paperAffine(tg);
    let B = invOf.get(tg);
    if (!B) { B = inverse(A); invOf.set(tg, B); }
    const P = [];
    for (let e = 0; e < 3; e++) {
      const v = sheet.tri[3 * t + e], x = sheet.uv[2 * v], y = sheet.uv[2 * v + 1];
      P.push([A.a * x + A.b * y + A.tx, A.c * x + A.d * y + A.ty]);
    }
    const i0 = Math.floor(Math.min(P[0][0], P[1][0], P[2][0]) / step), i1 = Math.floor(Math.max(P[0][0], P[1][0], P[2][0]) / step);
    const j0 = Math.floor(Math.min(P[0][1], P[1][1], P[2][1]) / step), j1 = Math.floor(Math.max(P[0][1], P[1][1], P[2][1]) / step);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      let poly = P;
      if (i0 !== i1 || j0 !== j1) {
        poly = clipHalfPlane(poly, -1, 0, -i * step); if (poly.length < 3) continue;
        poly = clipHalfPlane(poly, 1, 0, (i + 1) * step); if (poly.length < 3) continue;
        poly = clipHalfPlane(poly, 0, -1, -j * step); if (poly.length < 3) continue;
        poly = clipHalfPlane(poly, 0, 1, (j + 1) * step); if (poly.length < 3) continue;
      }
      const par = (((i + j) % 2) + 2) % 2;
      const ids = poly.map((p) => vertex(B.a * p[0] + B.b * p[1] + B.tx, B.c * p[0] + B.d * p[1] + B.ty, tg, par));
      for (let k = 1; k + 1 < poly.length; k++) {
        const ar = (poly[k][0] - poly[0][0]) * (poly[k + 1][1] - poly[0][1]) - (poly[k][1] - poly[0][1]) * (poly[k + 1][0] - poly[0][0]);
        if (!(Math.abs(ar) > eps2) || ids[0] === ids[k] || ids[k] === ids[k + 1] || ids[0] === ids[k + 1]) continue;
        tri.push(ids[0], ids[k], ids[k + 1]);
      }
    }
  }
  return { n: tag.length, uv: Float64Array.from(uv), tag: Uint16Array.from(tag), tri: Uint32Array.from(tri), tint: Uint8Array.from(tint), src: null };
}

/** Join segments whose ends carry exact keys (a mesh edge, a plane) into polylines. ends: Float64Array(2 * count). */
function chainByKeys(pts, keys, count) {
  const first = new Map(), second = new Map();
  for (let s = 0; s < count; s++) for (let e = 0; e < 2; e++) {
    const k = keys[2 * s + e], v = 2 * s + e;
    if (!first.has(k)) first.set(k, v); else if (!second.has(k)) second.set(k, v); else second.set(k, -2);   // three or more: a junction
  }
  const used = new Uint8Array(count), out = [];
  const other = (k, v) => { const a = first.get(k), b = second.get(k); return b === undefined || b === -2 ? -1 : (a === v ? b : a); };
  const walk = (s, e) => {
    // from the end e of segment s through the chain
    const line = [];
    let v = 2 * s + e;
    for (;;) {
      const seg = v >> 1, far = v ^ 1;
      used[seg] = 1;
      if (!line.length) line.push(pts[3 * v], pts[3 * v + 1], pts[3 * v + 2]);
      line.push(pts[3 * far], pts[3 * far + 1], pts[3 * far + 2]);
      const nx = other(keys[far], far);
      if (nx < 0 || used[nx >> 1]) break;
      v = nx;
    }
    out.push(Float32Array.from(line));
  };
  for (let s = 0; s < count; s++) for (let e = 0; e < 2; e++) {
    if (used[s]) continue;
    const k = keys[2 * s + e], b = second.get(k);
    if (b === undefined || b === -2) walk(s, e);            // an open end, or a junction: start here
  }
  for (let s = 0; s < count; s++) if (!used[s]) walk(s, 0);  // loops
  return out;
}

/**
 * cut(pos, y0) -> { positions, indices, section: [Float32Array] }: the surface with the part in front of the plane
 * y = y0 (y < y0) removed, and the curves along which it was cut. Vertices 0 .. n - 1 are the surface's own (the
 * removed ones stay in the array, unused), the cut points follow.
 */
export function createCutter(tri, n) {
  const m = tri.length / 3;
  let P = new Float32Array(3 * (n + 256)), I = new Uint32Array(6 * m), S = new Float32Array(6 * 256), K = new Float64Array(2 * 256);
  const edge = new Map();
  return function cut(pos, y0) {
    P.set(pos.subarray(0, 3 * n));
    edge.clear();
    let nv = n, ni = 0, ns = 0;
    const cutVertex = (a, b) => {
      const key = a < b ? a * n + b : b * n + a;
      let i = edge.get(key);
      if (i !== undefined) return i;
      if (3 * (nv + 1) > P.length) { const g = new Float32Array(2 * P.length); g.set(P); P = g; }
      const ya = pos[3 * a + 1], yb = pos[3 * b + 1], u = (y0 - ya) / (yb - ya);
      P[3 * nv] = pos[3 * a] + u * (pos[3 * b] - pos[3 * a]); P[3 * nv + 1] = y0; P[3 * nv + 2] = pos[3 * a + 2] + u * (pos[3 * b + 2] - pos[3 * a + 2]);
      edge.set(key, nv);
      return nv++;
    };
    const seg = (c1, c2) => {
      if (6 * (ns + 1) > S.length) { const g = new Float32Array(2 * S.length); g.set(S); S = g; const h = new Float64Array(2 * K.length); h.set(K); K = h; }
      S[6 * ns] = P[3 * c1]; S[6 * ns + 1] = P[3 * c1 + 1]; S[6 * ns + 2] = P[3 * c1 + 2];
      S[6 * ns + 3] = P[3 * c2]; S[6 * ns + 4] = P[3 * c2 + 1]; S[6 * ns + 5] = P[3 * c2 + 2];
      K[2 * ns] = c1; K[2 * ns + 1] = c2; ns++;
    };
    for (let t = 0; t < m; t++) {
      const a = tri[3 * t], b = tri[3 * t + 1], c = tri[3 * t + 2];
      const ka = pos[3 * a + 1] >= y0, kb = pos[3 * b + 1] >= y0, kc = pos[3 * c + 1] >= y0, k = ka + kb + kc;
      if (k === 3) { I[ni++] = a; I[ni++] = b; I[ni++] = c; continue; }
      if (k === 0) continue;
      // rotate so that the odd one out comes first
      let v0 = a, v1 = b, v2 = c;
      if (k === 1) { if (kb) { v0 = b; v1 = c; v2 = a; } else if (kc) { v0 = c; v1 = a; v2 = b; } }
      else if (!kb) { v0 = b; v1 = c; v2 = a; } else if (!kc) { v0 = c; v1 = a; v2 = b; }
      const c1 = cutVertex(v0, v1), c2 = cutVertex(v0, v2);
      if (k === 1) { I[ni++] = v0; I[ni++] = c1; I[ni++] = c2; }
      else { I[ni++] = c1; I[ni++] = v1; I[ni++] = v2; I[ni++] = c1; I[ni++] = v2; I[ni++] = c2; }
      seg(c1, c2);
    }
    return { positions: P.subarray(0, 3 * nv), indices: I.subarray(0, ni), section: chainByKeys(S, K, ns), vertices: nv };
  };
}

/**
 * slice(pos, y0, dy) -> { lines: [Float32Array], planes: [k] }: the curves in which the planes y = y0 + k dy (k any
 * integer) meet the surface, joined into polylines; planes[i] is the k of lines[i].
 */
export function createSlicer(tri, n) {
  const m = tri.length / 3;
  let S = new Float32Array(6 * 1024), K = new Float64Array(2 * 1024), Q = new Int32Array(1024);
  return function slice(pos, y0, dy) {
    let ns = 0;
    const N2 = n * n;
    for (let t = 0; t < m; t++) {
      const a = tri[3 * t], b = tri[3 * t + 1], c = tri[3 * t + 2];
      const ya = pos[3 * a + 1], yb = pos[3 * b + 1], yc = pos[3 * c + 1];
      const lo = Math.min(ya, yb, yc), hi = Math.max(ya, yb, yc);
      for (let k = Math.ceil((lo - y0) / dy); k <= Math.floor((hi - y0) / dy); k++) {
        const y = y0 + k * dy;
        // the two edges the plane crosses (a corner exactly on the plane counts as above it)
        const sa = ya >= y, sb = yb >= y, sc = yc >= y;
        if (sa === sb && sb === sc) continue;
        let p, q, r;                       // p is the corner alone on its side
        if (sa !== sb && sa !== sc) { p = a; q = b; r = c; } else if (sb !== sa && sb !== sc) { p = b; q = c; r = a; } else { p = c; q = a; r = b; }
        if (ns + 1 > Q.length) { const g = new Float32Array(2 * S.length); g.set(S); S = g; const h = new Float64Array(2 * K.length); h.set(K); K = h; const w = new Int32Array(2 * Q.length); w.set(Q); Q = w; }
        const yp = pos[3 * p + 1];
        let o = 6 * ns;
        for (const e of [q, r]) {
          const u = (y - yp) / (pos[3 * e + 1] - yp);
          S[o] = pos[3 * p] + u * (pos[3 * e] - pos[3 * p]); S[o + 1] = y; S[o + 2] = pos[3 * p + 2] + u * (pos[3 * e + 2] - pos[3 * p + 2]);
          K[2 * ns + (o === 6 * ns ? 0 : 1)] = (p < e ? p * n + e : e * n + p) + (k + 512) * N2;
          o += 3;
        }
        Q[ns] = k; ns++;
      }
    }
    return { lines: chainByKeys(S, K, ns), count: ns };
  };
}

/** The parts of the polyline `pts` (Float32Array 3k) with y >= y0, cut exactly at the plane. -> [Float32Array] */
export function clipPolylineY(pts, y0) {
  const k = pts.length / 3, out = [];
  let run = null;
  for (let i = 0; i < k; i++) {
    const x = pts[3 * i], y = pts[3 * i + 1], z = pts[3 * i + 2], keep = y >= y0;
    if (i > 0) {
      const px = pts[3 * i - 3], py = pts[3 * i - 2], pz = pts[3 * i - 1];
      if ((py >= y0) !== keep) {
        const u = (y0 - py) / (y - py), cx = px + u * (x - px), cz = pz + u * (z - pz);
        if (keep) run = [cx, y0, cz]; else { run.push(cx, y0, cz); if (run.length >= 6) out.push(Float32Array.from(run)); run = null; }
      }
    }
    if (keep) { if (!run) run = []; run.push(x, y, z); }
  }
  if (run && run.length >= 6) out.push(Float32Array.from(run));
  return out;
}

/**
 * The crossing, carried back to the paper: every segment of the crossing lies in two triangles of the sheet, so it
 * has two preimages, the two curves of the paper that meet there.
 *   r      the detector's result (selfx.js: segs, pairs, count)
 *   pos    the positions the detector was given (Float32Array 3n), uv their plane points (2n), tri, triTag
 * -> Float32Array(8 * count): two segments (x1, y1, x2, y2) of the paper per crossing segment
 */
export function crossingOnPaper(r, pos, uv, tri, triTag, sheet, out) {
  const need = 8 * r.count;
  if (!out || out.length < need) out = new Float32Array(Math.max(need, 256));
  const bary = [0, 0, 0];
  const solve = (T, px, py, pz) => {
    const a = 3 * tri[3 * T], b = 3 * tri[3 * T + 1], c = 3 * tri[3 * T + 2];
    const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2];
    const e2x = pos[c] - pos[a], e2y = pos[c + 1] - pos[a + 1], e2z = pos[c + 2] - pos[a + 2];
    const dx = px - pos[a], dy = py - pos[a + 1], dz = pz - pos[a + 2];
    const d11 = e1x * e1x + e1y * e1y + e1z * e1z, d12 = e1x * e2x + e1y * e2y + e1z * e2z, d22 = e2x * e2x + e2y * e2y + e2z * e2z;
    const b1 = dx * e1x + dy * e1y + dz * e1z, b2 = dx * e2x + dy * e2y + dz * e2z, det = d11 * d22 - d12 * d12 || 1;
    bary[1] = (b1 * d22 - b2 * d12) / det; bary[2] = (b2 * d11 - b1 * d12) / det; bary[0] = 1 - bary[1] - bary[2];
  };
  for (let s = 0; s < r.count; s++) {
    for (let w = 0; w < 2; w++) {
      const T = r.pairs[2 * s + w], A = sheet.paperAffine(triTag[T]);
      const i0 = tri[3 * T], i1 = tri[3 * T + 1], i2 = tri[3 * T + 2];
      for (let e = 0; e < 2; e++) {
        solve(T, r.segs[6 * s + 3 * e], r.segs[6 * s + 3 * e + 1], r.segs[6 * s + 3 * e + 2]);
        const u = bary[0] * uv[2 * i0] + bary[1] * uv[2 * i1] + bary[2] * uv[2 * i2], v = bary[0] * uv[2 * i0 + 1] + bary[1] * uv[2 * i1 + 1] + bary[2] * uv[2 * i2 + 1];
        out[8 * s + 4 * w + 2 * e] = A.a * u + A.b * v + A.tx; out[8 * s + 4 * w + 2 * e + 1] = A.c * u + A.d * v + A.ty;
      }
    }
  }
  return out;
}
