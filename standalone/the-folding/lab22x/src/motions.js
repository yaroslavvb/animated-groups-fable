// motions.js — the ways the 22x tile closes into the cross-cap that the lab shows. Pure (no DOM).
//
//   CUTS            the three cuts of 22x in The Folding: Pocket, Bowl, Hexagon
//   MOTIONS         [{ key, label, note }]:
//     'acts'    one piece, as in The Folding: the hinges fold the tile onto half of the pillow, then the three acts
//               (pinch, roll, fold back) of src/folds/crosscap.js
//     'twist'   one piece, the first design of stage 2: the near part twists through the far part
//     'recut'   the tile is first re-cut into the Pocket (its pieces are carried there by elements of the group: a
//               half-turn turns a piece about a 2-fold centre, a glide turns it over its axis while it slides), then
//               the Pocket folds. The Pocket's own cut runs along the lines that become the double line, so in this
//               motion no piece of paper ever passes through another.
//   buildSheet(cutIndex, motionKey) -> Sheet
//
// A Sheet is everything a view needs, independent of how it is drawn:
//   key, cut, domain (the cut's tile, with seam colours), size
//   n, uv (Float64Array 2n), tag (Uint16Array n), tri (Uint32Array 3m), triTag (Uint16Array m)
//                         the sheet as triangles. (u, v) are the coordinates the motion folds: the tile's own plane
//                         coordinates for one piece, the Pocket's for 'recut'. A tag names the rigid unit a point rides on.
//   tags                  [{ part, cell, k }]: part = the colour index of the unit (0 .. parts - 1)
//   parts, partNames
//   at(t)                 -> f(u, v, tag, out): where the point is at time t in [0, 1]
//   paperAffine(tag)      -> the isometry (u, v) -> the tile's own plane ("paper") coordinates
//   lines                 [{ kind: 'seam' | 'rim' | 'crease', color, uv, tag, style(t) -> { width, alpha, dashed } | null }]
//   cones                 [{ u, v, tag, label }]
//   axis(t)               the fold's own double line (polylines), for reference
//   duration, stops, clipFrom, foldFrom      seconds for a play; [{ t, label }]; when the closing starts; when folding starts
//   map                   what the plane picture shows: { tile, pieces: [{ part, poly }], cuts: [[x1,y1,x2,y2]],
//                         midlines: [[x1,y1,x2,y2]], pocket: poly | null, moves: [{ part, text }] }
//                         (all in paper coordinates)

import { BY_ID, elementsNear } from '../../src/groups.js';
import { buildDomain, makeWarp } from '../../src/domain.js';
import { buildMesh } from '../../src/mesh.js';
import createCrosscap from '../../src/folds/crosscap.js';
import { assignEdgeColors } from '../../src/plane.js';
import { inverse, classify, clipHalfPlane, polyArea } from '../../src/geom.js';
import { classColor, hexToRgb } from '../../src/palette.js';

export const GROUP = BY_ID['22x'];
export const CUTS = GROUP.presets.map((p, i) => ({ index: i, name: p.name, seed: p.seed.slice() }));
export const MOTIONS = [
  { key: 'acts', label: 'One piece', note: 'The tile folds as one sheet, as in The Folding.' },
  { key: 'twist', label: 'One piece, twisted', note: 'One sheet; the near part twists through the far part.' },
  { key: 'recut', label: 'Re-cut first', note: 'The tile is re-cut into the Pocket, then folds. Nothing passes through anything.' },
];

const PI = Math.PI;
const smooth = (q) => (q <= 0 ? 0 : q >= 1 ? 1 : q * q * (3 - 2 * q));
const smoother = (q) => (q <= 0 ? 0 : q >= 1 ? 1 : q * q * q * (q * (6 * q - 15) + 10));
const SEAM_WIDTH = 4.5, RIM_WIDTH = 3, CREASE_WIDTH = 1.6;
const CREASE_SAMPLES = 24;
const RIM_RGB = hexToRgb('#52514a'), CREASE_RGB = hexToRgb('#9a9aa3');
/** Seconds one piece takes to move to its place in 'recut'. */
export const MOVE_SECONDS = 1.15;

const ap = (g, x, y, out) => { out[0] = g.a * x + g.b * y + g.tx; out[1] = g.c * x + g.d * y + g.ty; return out; };

/** The part of the convex polygon `poly` inside the convex polygon Q (either orientation). */
export function clipByConvex(poly, Q) {
  const ccw = polyArea(Q) > 0;
  let P = poly;
  for (let i = 0; i < Q.length && P.length >= 3; i++) {
    const a = Q[i], b = Q[(i + 1) % Q.length];
    let nx = b[1] - a[1], ny = a[0] - b[0];              // outward normal of a counter-clockwise polygon
    if (!ccw) { nx = -nx; ny = -ny; }
    P = clipHalfPlane(P, nx, ny, nx * a[0] + ny * a[1]);
  }
  return P.length >= 3 ? P : [];
}

/** Is (x, y) inside the convex polygon Q (either orientation), within eps? */
export function insideConvex(Q, x, y, eps = 1e-9) {
  const ccw = polyArea(Q) > 0;
  for (let i = 0; i < Q.length; i++) {
    const a = Q[i], b = Q[(i + 1) % Q.length];
    const s = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (ccw ? s < -eps : s > eps) return false;
  }
  return true;
}

/** The part [t0, t1] of the segment a -> b inside the convex polygon Q, or null. */
function clipSegment(a, b, Q) {
  const ccw = polyArea(Q) > 0;
  let t0 = 0, t1 = 1;
  for (let i = 0; i < Q.length; i++) {
    const p = Q[i], q = Q[(i + 1) % Q.length];
    let nx = q[1] - p[1], ny = p[0] - q[0];
    if (!ccw) { nx = -nx; ny = -ny; }
    const sa = nx * (a[0] - p[0]) + ny * (a[1] - p[1]), sb = nx * (b[0] - p[0]) + ny * (b[1] - p[1]);
    if (sa > 1e-12 && sb > 1e-12) return null;
    if (sa > 1e-12) t0 = Math.max(t0, sa / (sa - sb)); else if (sb > 1e-12) t1 = Math.min(t1, sa / (sa - sb));
  }
  return t1 - t0 > 1e-9 ? [t0, t1] : null;
}

function centroid(poly) {
  let x = 0, y = 0;
  for (const p of poly) { x += p[0]; y += p[1]; }
  return [x / poly.length, y / poly.length];
}

/** The cut's tile, with its seams coloured as The Folding colours them. */
function tileOf(cutIndex) {
  const preset = GROUP.presets[cutIndex];
  const domain = buildDomain(GROUP, { seed: preset.seed, warp: makeWarp(GROUP, 0) });
  assignEdgeColors(domain, null);
  return domain;
}

function foldOf(domain, anchor, opts) {
  const mesh = buildMesh(GROUP, domain, {});
  return createCrosscap(GROUP, domain, mesh, { anchor, ...opts });
}

/** The lines of the plane that the fold lays on the double line: the middle lines of the kaleidoscope's cells, in `poly`. */
function midlinesIn(poly) {
  const T = GROUP.kaleido.cell;
  let y0 = Infinity, y1 = -Infinity, X0 = Infinity, X1 = -Infinity, Y0 = Infinity, Y1 = -Infinity;
  for (const p of T) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  for (const p of poly) { X0 = Math.min(X0, p[0]); X1 = Math.max(X1, p[0]); Y0 = Math.min(Y0, p[1]); Y1 = Math.max(Y1, p[1]); }
  const h = y1 - y0, out = [];
  for (let k = Math.floor((Y0 - y0) / h) - 1; k <= Math.ceil((Y1 - y0) / h) + 1; k++) {
    const y = y0 + h / 2 + k * h;
    const s = clipSegment([X0 - 1, y], [X1 + 1, y], poly);
    if (s) out.push([X0 - 1 + s[0] * (X1 - X0 + 2), y, X0 - 1 + s[1] * (X1 - X0 + 2), y]);
  }
  return out;
}

function nearestSampleCell(boundary, x, y) {
  let cell = 0, best = Infinity;
  for (const b of boundary) for (let j = 0; j < b.cells.length; j++) {
    const d = Math.hypot(b.pts[2 * j] - x, b.pts[2 * j + 1] - y);
    if (d < best) { best = d; cell = b.cells[j]; }
  }
  return cell;
}

/** The creases' opacity window of The Folding (app.js creaseFade) for a cross-cap fold. */
function creaseWindow(fold) {
  const T = fold.times;
  return [0.5 * T.hingeEnd, T.halfEnd];
}

// ---------------------------------------------------------------------------------------------------------------
// One piece: the fold of The Folding (src/folds/crosscap.js), with options
// ---------------------------------------------------------------------------------------------------------------

function onePiece(cutIndex, key, opts) {
  const preset = GROUP.presets[cutIndex];
  const domain = tileOf(cutIndex);
  const fold = foldOf(domain, preset.seed, opts);
  const M = fold.mesh, size = domain.size || Math.sqrt(GROUP.domainArea);
  const tags = M.cells.map((c, i) => ({ part: i, cell: i, k: 0 }));
  const lines = [];
  for (const b of M.boundary) {
    if (!b || !b.pts || b.pts.length < 4) continue;
    const e = domain.edges[b.edge];
    lines.push({ kind: 'seam', edge: b.edge, color: hexToRgb(classColor(e.color === undefined ? e.cls : e.color)), uv: Float64Array.from(b.pts), tag: Uint16Array.from(b.cells),
      style: () => ({ width: SEAM_WIDTH, alpha: 1, dashed: false }) });
  }
  const cw = creaseWindow(fold);
  for (const c of M.creases || []) {
    if (!c || !c.pts || c.pts.length < 4) continue;
    const uv = new Float64Array(2 * CREASE_SAMPLES);
    for (let k = 0; k < CREASE_SAMPLES; k++) {
      const u = k / (CREASE_SAMPLES - 1);
      uv[2 * k] = (1 - u) * c.pts[0] + u * c.pts[2]; uv[2 * k + 1] = (1 - u) * c.pts[1] + u * c.pts[3];
    }
    const cell = c.b != null ? c.b : (c.a != null ? c.a : 0);
    lines.push({ kind: 'crease', color: CREASE_RGB, uv, tag: new Uint16Array(CREASE_SAMPLES).fill(cell),
      style: (t) => { const a = 1 - smooth((t - cw[0]) / (cw[1] - cw[0])); return a > 0.004 ? { width: CREASE_WIDTH, alpha: a, dashed: true } : null; } });
  }
  const cones = (domain.conePoints || []).map((c) => ({ u: c.x, v: c.y, tag: nearestSampleCell(M.boundary, c.x, c.y), label: String(c.order) }));
  const pieces = M.cells.map((c, i) => ({ part: i, poly: c.poly ? clipByConvex(domain.poly, c.poly) : domain.poly.map((p) => p.slice()) })).filter((p) => p.poly.length >= 3);
  const ident = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
  return {
    key, cut: CUTS[cutIndex], domain, size, fold,
    n: M.n, uv: Float64Array.from(M.xy), tag: Uint16Array.from(M.cell), tri: M.tri, triTag: M.triCell,
    tags, parts: M.cells.length, partNames: M.cells.map((c, i) => (i === 0 ? 'the piece that stays' : 'flap ' + i)),
    at: (t) => fold.at(t),
    paperAffine: () => ident,
    lines, cones,
    axis: (t) => { const a = fold.doubleLine(t); return a && a.length >= 6 ? [a] : []; },
    duration: fold.duration, stops: fold.stops.map((s) => ({ ...s })), clipFrom: fold.times.zipStart, foldFrom: 0,
    map: { tile: domain.poly, pieces, cuts: [], midlines: midlinesIn(domain.poly), pocket: null, moves: [] },
    frame: fold.frame,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Re-cut first: the tile's pieces are carried into the Pocket by elements of the group, then the Pocket folds
// ---------------------------------------------------------------------------------------------------------------

/** What an element of the group does to a piece of paper, in words. */
function moveText(c) {
  if (c.type === 'rotation') return 'a half-turn about a 2-fold centre';
  if (c.type === 'glide') return 'a glide: over its axis, and along it';
  if (c.type === 'translation') return 'a translation';
  if (c.type === 'reflection') return 'a reflection';
  return 'stays';
}

/**
 * The rigid motion of space that carries a piece from the paper (z = 0) to its image under g, at progress s in [0, 1]:
 * -> M = [m00, m01, tx, m10, m11, ty, m20, m21, tz] with (X, Y, Z) = M (x, y, 1). At s = 0 the identity, at s = 1 g
 * (in the plane). A translation and a half-turn hop over the paper (hop); a glide turns the piece over its axis, the
 * axis lifted so that the whole piece stays above the paper.
 */
export function carry(c, s, piecePaper, hop, out = new Float64Array(9)) {
  const up = Math.sin(PI * s);
  if (c.type === 'translation') {
    out[0] = 1; out[1] = 0; out[2] = s * c.vec[0]; out[3] = 0; out[4] = 1; out[5] = s * c.vec[1]; out[6] = 0; out[7] = 0; out[8] = hop * up;
  } else if (c.type === 'rotation') {
    const ang = s * c.turn, co = Math.cos(ang), si = Math.sin(ang), cx = c.center[0], cy = c.center[1];
    out[0] = co; out[1] = -si; out[2] = cx - co * cx + si * cy; out[3] = si; out[4] = co; out[5] = cy - si * cx - co * cy;
    out[6] = 0; out[7] = 0; out[8] = hop * up;
  } else if (c.type === 'glide' || c.type === 'reflection') {
    const ux = c.dir[0], uy = c.dir[1], ax = c.point[0], ay = c.point[1], d = c.type === 'glide' ? c.dist : 0, co = Math.cos(PI * s);
    // alpha = (p - a).u, beta = (p - a).n with n = (-uy, ux);  P = a + (alpha + s d) u + beta co n;  Z = (sigma beta + B) up
    const m00 = ux * ux + co * uy * uy, m01 = ux * uy - co * uy * ux, m10 = uy * ux - co * ux * uy, m11 = uy * uy + co * ux * ux;
    out[0] = m00; out[1] = m01; out[2] = ax + s * d * ux - (m00 * ax + m01 * ay);
    out[3] = m10; out[4] = m11; out[5] = ay + s * d * uy - (m10 * ax + m11 * ay);
    out[6] = c.sigma * -uy * up; out[7] = c.sigma * ux * up; out[8] = (c.lift - c.sigma * (-uy * ax + ux * ay)) * up;
  } else {
    out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0; out[4] = 1; out[5] = 0; out[6] = 0; out[7] = 0; out[8] = 0;
  }
  return out;
}

function recut(cutIndex) {
  const H = tileOf(cutIndex), size = H.size || Math.sqrt(GROUP.domainArea);
  const pocketSeed = GROUP.presets[0].seed;
  const P = tileOf(0);
  const fold = foldOf(P, pocketSeed, {});
  const MP = fold.mesh;
  const cP = centroid(P.poly);

  // the pieces: P is tiled by the parts of the copies g(H) that reach into it
  const q = [0, 0];
  let pieces = [];
  for (const g of elementsNear(GROUP, cP[0], cP[1], 4 * size, H.seed[0], H.seed[1])) {
    const Q = H.poly.map((p) => ap(g, p[0], p[1], [0, 0]));
    const R = clipByConvex(P.poly, Q);
    const area = R.length >= 3 ? Math.abs(polyArea(R)) : 0;
    if (!(area > 1e-7 * size * size)) continue;
    const ginv = inverse(g), c = classify(g);
    const paper = R.map((p) => ap(ginv, p[0], p[1], [0, 0]));     // the piece where it lies in the tile
    if (c.type === 'rotation') {
      // turn the way that swings the piece round the outside of the pocket
      const pc = centroid(paper), dx = pc[0] - c.center[0], dy = pc[1] - c.center[1];
      const mid = (sg) => Math.hypot(c.center[0] - sg * dy - cP[0], c.center[1] + sg * dx - cP[1]);
      c.turn = (mid(1) >= mid(-1) ? 1 : -1) * Math.abs(c.angle);
    } else if (c.type === 'glide' || c.type === 'reflection') {
      // the side that rises is the side most of the piece lies on; the axis is lifted by the reach of the other side
      const nx = -c.dir[1], ny = c.dir[0];
      let lo = Infinity, hi = -Infinity, mean = 0;
      for (const p of paper) { const b = (p[0] - c.point[0]) * nx + (p[1] - c.point[1]) * ny; lo = Math.min(lo, b); hi = Math.max(hi, b); mean += b / paper.length; }
      c.sigma = mean >= 0 ? 1 : -1;
      c.lift = Math.max(0, c.sigma > 0 ? -lo : hi) + 0.05 * size;
    }
    pieces.push({ g, ginv, R, paper, area, c, moves: c.type !== 'identity' });
  }
  // the piece that stays first; then the movers: half-turns before glides, larger pieces first
  const rank = (p) => (!p.moves ? 0 : p.c.type === 'rotation' ? 1 : p.c.type === 'translation' ? 2 : 3);
  pieces.sort((a, b) => rank(a) - rank(b) || b.area - a.area);
  const movers = pieces.filter((p) => p.moves);
  const K = movers.length;
  const moveSeconds = K * MOVE_SECONDS, duration = fold.duration + moveSeconds, tau0 = K ? moveSeconds / duration : 0;
  movers.forEach((p, i) => { p.from = (i + 0.06) / K * tau0; p.to = (i + 0.96) / K * tau0; });
  const hop = 0.07 * size;

  // the Pocket's mesh, split along the borders of the pieces
  const tagOf = new Map(), tags = [];
  const tagFor = (cell, k) => {
    const key = cell * 64 + k;
    let id = tagOf.get(key);
    if (id === undefined) { id = tags.length; tags.push({ part: k, cell, k }); tagOf.set(key, id); }
    return id;
  };
  const boxes = pieces.map((p) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const v of p.R) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); } return [x0, y0, x1, y1]; });
  const uvs = [], vtag = [], tri = [], triTag = [], vid = new Map();
  const vertex = (x, y, tg) => {
    const key = Math.round(x * 4e6) + ',' + Math.round(y * 4e6) + ',' + tg;
    let id = vid.get(key);
    if (id === undefined) { id = vtag.length; uvs.push(x, y); vtag.push(tg); vid.set(key, id); }
    return id;
  };
  const X = MP.xy, T = MP.tri, eps2 = 1e-12 * size * size;
  for (let t = 0; t < T.length / 3; t++) {
    const a = T[3 * t], b = T[3 * t + 1], c = T[3 * t + 2];
    const tp = [[X[2 * a], X[2 * a + 1]], [X[2 * b], X[2 * b + 1]], [X[2 * c], X[2 * c + 1]]];
    const bx0 = Math.min(tp[0][0], tp[1][0], tp[2][0]), bx1 = Math.max(tp[0][0], tp[1][0], tp[2][0]);
    const by0 = Math.min(tp[0][1], tp[1][1], tp[2][1]), by1 = Math.max(tp[0][1], tp[1][1], tp[2][1]);
    for (let k = 0; k < pieces.length; k++) {
      const B = boxes[k];
      if (bx0 > B[2] || bx1 < B[0] || by0 > B[3] || by1 < B[1]) continue;
      const poly = clipByConvex(tp, pieces[k].R);
      if (poly.length < 3) continue;
      const tg = tagFor(MP.triCell[t], k);
      const flip = pieces[k].g.a * pieces[k].g.d - pieces[k].g.b * pieces[k].g.c < 0;   // counter-clockwise on the PAPER
      const v0 = vertex(poly[0][0], poly[0][1], tg);
      for (let i = 1; i + 1 < poly.length; i++) {
        const ar = (poly[i][0] - poly[0][0]) * (poly[i + 1][1] - poly[0][1]) - (poly[i][1] - poly[0][1]) * (poly[i + 1][0] - poly[0][0]);
        if (!(Math.abs(ar) > eps2)) continue;
        const v1 = vertex(poly[i][0], poly[i][1], tg), v2 = vertex(poly[i + 1][0], poly[i + 1][1], tg);
        if (v0 === v1 || v1 === v2 || v0 === v2) continue;
        if (flip) tri.push(v0, v2, v1); else tri.push(v0, v1, v2);
        triTag.push(tg);
      }
    }
  }
  // drop the vertices no triangle uses (corners of slivers that were skipped)
  {
    const slot = new Int32Array(vtag.length).fill(-1);
    let m = 0;
    for (const i of tri) if (slot[i] < 0) slot[i] = m++;
    if (m < vtag.length) {
      const u2 = new Array(2 * m), t2 = new Array(m);
      for (let i = 0; i < vtag.length; i++) if (slot[i] >= 0) { u2[2 * slot[i]] = uvs[2 * i]; u2[2 * slot[i] + 1] = uvs[2 * i + 1]; t2[slot[i]] = vtag[i]; }
      for (let k = 0; k < tri.length; k++) tri[k] = slot[tri[k]];
      uvs.length = 0; vtag.length = 0;
      for (const x of u2) uvs.push(x);
      for (const x of t2) vtag.push(x);
    }
  }
  const n = vtag.length;

  /** The piece (index into `pieces`) that holds the Pocket point (x, y), tried a little toward the Pocket's centre first. */
  const pieceAt = (x, y) => {
    const ex = cP[0] - x, ey = cP[1] - y, el = Math.hypot(ex, ey) || 1, nx = x + 1e-6 * size * ex / el, ny = y + 1e-6 * size * ey / el;
    for (let k = 0; k < pieces.length; k++) if (insideConvex(pieces[k].R, nx, ny, 0)) return k;
    let best = 0, bd = Infinity;
    for (let k = 0; k < pieces.length; k++) { const c = centroid(pieces[k].R), d = Math.hypot(c[0] - x, c[1] - y); if (insideConvex(pieces[k].R, x, y, 1e-6 * size) && d < bd) { bd = d; best = k; } }
    return best;
  };
  /** Cut a polyline of Pocket points into runs that lie on one piece (each run reaches one sample into the next). */
  const runs = (pts, cells) => {
    const m = pts.length >> 1, out = [];
    let start = 0, k0 = pieceAt(pts[0], pts[1]);
    for (let j = 1; j <= m; j++) {
      const k = j < m ? pieceAt(pts[2 * j], pts[2 * j + 1]) : -1;
      if (k === k0) continue;
      const end = Math.min(m, j + 1), len = end - start;
      if (len >= 2) {
        const uv = new Float64Array(2 * len), tag = new Uint16Array(len);
        for (let i = 0; i < len; i++) { uv[2 * i] = pts[2 * (start + i)]; uv[2 * i + 1] = pts[2 * (start + i) + 1]; tag[i] = tagFor(cells ? cells[start + i] : MP.locate(uv[2 * i], uv[2 * i + 1]), k0); }
        out.push({ uv, tag, k: k0 });
      }
      start = j; k0 = k;
    }
    return out;
  };

  const lines = [];
  const step = size / 120;
  const landed = (k) => (pieces[k].moves ? pieces[k].to : 0);
  // the tile's own seams, each on the piece that carries it: closed one by one as the pieces arrive
  for (let i = 0; i < H.poly.length; i++) {
    const a = H.poly[i], b = H.poly[(i + 1) % H.poly.length], e = H.edges[i];
    const color = hexToRgb(classColor(e.color === undefined ? e.cls : e.color));
    for (let k = 0; k < pieces.length; k++) {
      const s = clipSegment(a, b, pieces[k].paper);
      if (!s) continue;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) * (s[1] - s[0]), m = Math.max(2, Math.ceil(len / step) + 1);
      const uv = new Float64Array(2 * m), tag = new Uint16Array(m);
      for (let j = 0; j < m; j++) {
        const u = s[0] + (s[1] - s[0]) * j / (m - 1);
        ap(pieces[k].g, a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1]), q);
        uv[2 * j] = q[0]; uv[2 * j + 1] = q[1]; tag[j] = tagFor(MP.locate(q[0], q[1]), k);
      }
      lines.push({ kind: 'seam', edge: i, color, uv, tag, style: () => ({ width: SEAM_WIDTH, alpha: 1, dashed: false }) });
    }
  }
  // the Pocket's rim: the new cut. Dashed on the tile, a rim once its piece has left, thin once the fold has closed it
  const tFold = (t) => (t - tau0) / (1 - tau0);
  for (const b of MP.boundary) {
    if (!b || !b.pts || b.pts.length < 4) continue;
    for (const r of runs(b.pts, b.cells)) {
      const half = !!P.edges[b.edge].halfTurn, closeAt = half ? fold.times.hingeEnd : 1;
      lines.push({ kind: 'rim', color: RIM_RGB, uv: r.uv, tag: r.tag,
        style: (t) => {
          if (t <= 0) return { width: 1.8, alpha: 0.9, dashed: true };
          const open = K ? smooth(t / (0.04 * tau0 + 1e-9)) : 1;                       // the cuts open as the first piece leaves
          const shut = smooth((tFold(t) - 0.9 * closeAt) / (0.1 * closeAt));          // ... and close when the fold glues them
          return { width: 1.8 + (RIM_WIDTH - 1.8) * open * (1 - shut), alpha: 0.9, dashed: open < 0.5 || shut > 0.5 };
        } });
    }
  }
  const cw = creaseWindow(fold);
  for (const c of MP.creases || []) {
    if (!c || !c.pts || c.pts.length < 4) continue;
    const pts = new Float64Array(2 * CREASE_SAMPLES);
    for (let k = 0; k < CREASE_SAMPLES; k++) { const u = k / (CREASE_SAMPLES - 1); pts[2 * k] = (1 - u) * c.pts[0] + u * c.pts[2]; pts[2 * k + 1] = (1 - u) * c.pts[1] + u * c.pts[3]; }
    const cell = c.b != null ? c.b : (c.a != null ? c.a : 0);
    for (const r of runs(pts, new Uint16Array(CREASE_SAMPLES).fill(cell))) {
      lines.push({ kind: 'crease', color: CREASE_RGB, uv: r.uv, tag: r.tag,
        style: (t) => { const f = tFold(t); if (!(f > 0)) return null; const a = smooth(f / 0.03) * (1 - smooth((f - cw[0]) / (cw[1] - cw[0]))); return a > 0.004 ? { width: CREASE_WIDTH, alpha: a, dashed: true } : null; } });
    }
  }
  const cones = (P.conePoints || []).map((c) => ({ u: c.x, v: c.y, tag: tagFor(nearestSampleCell(MP.boundary, c.x, c.y), pieceAt(c.x, c.y)), label: String(c.order) }));

  // the map: the pieces on the paper, and the lines along which the tile is cut (the Pocket's rim, carried back)
  const cuts = [];
  for (let k = 0; k < pieces.length; k++) {
    const R = pieces[k].R;
    for (let i = 0; i < R.length; i++) {
      const a = R[i], b = R[(i + 1) % R.length], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      // a side of the piece that lies on the Pocket's rim (not on a seam of the tile)
      let onRim = false;
      for (let j = 0; j < P.poly.length && !onRim; j++) {
        const p = P.poly[j], r = P.poly[(j + 1) % P.poly.length], l = Math.hypot(r[0] - p[0], r[1] - p[1]);
        if (Math.abs((r[0] - p[0]) * (my - p[1]) - (r[1] - p[1]) * (mx - p[0])) / l < 1e-7 * size) onRim = true;
      }
      if (!onRim) continue;
      const pa = ap(pieces[k].ginv, a[0], a[1], [0, 0]), pb = ap(pieces[k].ginv, b[0], b[1], [0, 0]);
      // drop the parts that run along the tile's own boundary
      const mid = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
      let onEdge = false;
      for (let j = 0; j < H.poly.length && !onEdge; j++) {
        const p = H.poly[j], r = H.poly[(j + 1) % H.poly.length], l = Math.hypot(r[0] - p[0], r[1] - p[1]);
        if (Math.abs((r[0] - p[0]) * (mid[1] - p[1]) - (r[1] - p[1]) * (mid[0] - p[0])) / l < 1e-7 * size) onEdge = true;
      }
      if (!onEdge) cuts.push([pa[0], pa[1], pb[0], pb[1]]);
    }
  }

  const M9 = pieces.map(() => new Float64Array(9));
  const at = (t) => {
    if (!(t > 0) || !(t < tau0)) {
      if (!(t > 0)) return (u, v, tag, out) => { ap(pieces[tags[tag].k].ginv, u, v, q); out[0] = q[0]; out[1] = q[1]; out[2] = 0; return out; };
      const F = fold.at(t >= 1 ? 1 : tFold(t));
      return (u, v, tag, out) => F(u, v, tags[tag].cell, out);
    }
    for (let k = 0; k < pieces.length; k++) {
      const p = pieces[k];
      carry(p.c, p.moves ? smoother((t - p.from) / (p.to - p.from)) : 0, p.paper, hop, M9[k]);
    }
    return (u, v, tag, out) => {
      const k = tags[tag].k, m = M9[k];
      ap(pieces[k].ginv, u, v, q);
      out[0] = m[0] * q[0] + m[1] * q[1] + m[2]; out[1] = m[3] * q[0] + m[4] * q[1] + m[5]; out[2] = m[6] * q[0] + m[7] * q[1] + m[8];
      return out;
    };
  };

  const stops = [{ t: 0, label: 'flat' }];
  if (K) stops.push({ t: tau0, label: 're-cut into the Pocket' });
  stops.push({ t: tau0 + (1 - tau0) * fold.times.halfStop, label: 'glide seams open' }, { t: 1, label: 'cross-cap' });
  return {
    key: 'recut', cut: CUTS[cutIndex], domain: H, size, fold, pocket: P, pieces,
    n, uv: Float64Array.from(uvs), tag: Uint16Array.from(vtag), tri: Uint32Array.from(tri), triTag: Uint16Array.from(triTag),
    tags, parts: pieces.length, partNames: pieces.map((p) => (p.moves ? moveText(p.c) : 'stays')),
    at,
    paperAffine: (tag) => pieces[tags[tag].k].ginv,
    lines, cones,
    axis: (t) => { if (!(t > tau0)) return []; const a = fold.doubleLine(t >= 1 ? 1 : tFold(t)); return a && a.length >= 6 ? [a] : []; },
    duration, stops, clipFrom: tau0 + (1 - tau0) * fold.times.zipStart, foldFrom: tau0,
    map: { tile: H.poly, pieces: pieces.map((p, k) => ({ part: k, poly: p.paper })), cuts, midlines: midlinesIn(H.poly), pocket: P.poly,
      moves: pieces.map((p, k) => ({ part: k, text: p.moves ? moveText(p.c) : 'stays', from: p.from || 0, to: p.to || 0 })) },
    frame: fold.frame,
  };
}

const cache = new Map();
/** The sheet of a cut (0 Pocket, 1 Bowl, 2 Hexagon) and a motion ('acts' | 'twist' | 'recut'). Cached. */
export function buildSheet(cutIndex, motionKey) {
  const ci = Math.max(0, Math.min(CUTS.length - 1, cutIndex | 0));
  const mk = MOTIONS.some((m) => m.key === motionKey) ? motionKey : 'acts';
  const key = ci + '|' + mk;
  if (!cache.has(key)) cache.set(key, mk === 'recut' ? recut(ci) : onePiece(ci, mk, mk === 'twist' ? { stage2: 'twist' } : {}));
  return cache.get(key);
}

/** Positions of points (uv, tag) at time t: out = Float32Array(3k). A point the motion returns as non-finite stays flat. */
export function positionsAt(sheet, t, uv, tag, out) {
  const F = sheet.at(t), o = [0, 0, 0], k = tag.length;
  for (let i = 0; i < k; i++) {
    o[0] = o[1] = o[2] = NaN;
    F(uv[2 * i], uv[2 * i + 1], tag[i], o);
    if (!Number.isFinite(o[0] + o[1] + o[2])) { o[0] = uv[2 * i]; o[1] = uv[2 * i + 1]; o[2] = 0; }
    out[3 * i] = o[0]; out[3 * i + 1] = o[1]; out[3 * i + 2] = o[2];
  }
  return out;
}
