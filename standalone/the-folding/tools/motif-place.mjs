#!/usr/bin/env node
// motif-place.mjs — the placement table of the big comma: writes src/groupdata/motif.js from the group data.
//
//   node tools/motif-place.mjs                  regenerate src/groupdata/motif.js (about 30-60 s on one core)
//   node tools/motif-place.mjs --check          write nothing; exit 1 when the file on disk is not what this would write
//   node tools/motif-place.mjs --groups 333,o   search only these groups and print them (writes nothing)
//
// WHEN TO RUN IT. After any change of the group data (src/groupdata/*.js, src/groups.js: a lattice, the coset
// representatives, viewHalf, the default preset's seed, metric or anchor), of the default tile (src/domain.js), of the
// rules in src/motif.js (FILL_TARGET, FILL_GAP, FILL_RCAP, FILL_STRETCH, SEARCH_OUTLINE, DRAWN_OUTLINE), of this file,
// or of the shape a fold gives the default tile at t = 1 (src/folds/*.js, src/mesh.js) or of the renderer's default
// view (src/render3d.js). test/motif.test.js fails while the table is stale: every entry carries
//   key   placementKey(group) (src/motif.js), a hash of the group data and rules the size search reads, and
//   view  viewKey(group) (below), a hash of the default view and of where the fold puts the default tile at t = 1,
// and the table carries PLACEMENT_SOURCE, a hash of this file. Deterministic: no randomness, fixed grids, a fixed
// order, so the same inputs give the same file byte for byte.
//
// THE SEARCH (the fill judge's dev/fill-judge/tools/bigcomma.mjs, qa/fill-judge.md, ported; exact shares and the view
// tie-break added by the fix-up of 10 Nov 2026, notes/fill.md). For every group except the seam groups (xx: src/motif.js
// places its comma across the glide seam by rule), with sigma = FILL_STRETCH[id]:
//   * the comma at centre (x, y), turned by `angle`, scaled by s across and s * sigma along its head -> tail axis, must
//     stay FILL_GAP * sqrt(domainArea) away from every copy of itself under the group, outline to outline
//     (commaApart in src/motif.js; while searching on the outline SEARCH_OUTLINE, a little coarser than the one drawn,
//     and at the end on the comma's curve itself, FINE_UNIT, 4 x as fine as the drawn outline: the verifier measured
//     *x's comma 0.0694 from its mirror image on a fine curve when the search had kept 0.07 on its coarse outline), and
//     its bounding radius s * sigma is at most FILL_RCAP * viewHalf (and 1.2 * sqrt(domainArea));
//   * candidates: the centres of a 15 x 15 grid over the default tile's bounding box that lie in the tile (a fundamental
//     domain: every orbit has a point there) x 12 turns; for each, the largest s that keeps the gap (bisection); the
//     best grid candidate is refined by a pattern search over (x, y, angle);
//   * the order of preference, first to last:
//       0. (the folds in STILL.folds: the cross-cap) a HARD rule: the comma holds still. It may only lie where no
//          preset's fold turns the sheet over (the normal stays within STILL.turn degrees of +z all through the play;
//          stillOf, below), so its scale is also capped by that (stillScale) and is not the target's: 22x's comma fills
//          the far half of the cell C0 (29 %). The owner's complaint of 10 Nov 2026 and the measurements:
//          notes/crosscap-paint.md, and the comment at STILL;
//       1. size, up to the goal: the target scale sT (the comma that covers FILL_TARGET of the tile; with GOAL_MARGIN,
//          so the drawn outline keeps it) or, for the strips whose cap comes first (o, **: they cannot reach the
//          target), the largest the cap and the gap allow;
//       2. (groups that reach the target) the share of the comma inside the default tile, up to SHARE_OK (98 %, the
//          judge's bar), measured EXACTLY: the comma's curve (FINE_UNIT) clipped by the tile's edges (it was an 18 x 18
//          grid sample, which put 22*'s comma at 97.8 % when it lay 97.3 % inside: the verifier's finding 1);
//       3. the share of the default 3D view at t = 1 that is comma (seenShare, below).
//     Items 1 and 2 leave real ties: a strip's comma can slide along its strip without changing size (the translations
//     along the strip commute with the group: o anywhere, ** along y, *x along x), and many placements lie wholly in a
//     tile. Without item 3 the first tie the grid met was kept, and whether the comma then showed on the near face of
//     the folded shape or on its far face or underside was luck (the verifier's findings 2 and 3: an equally large o
//     comma can roll onto the torus's underside; *x was the emptiest shape). With it, among the ties, the comma goes
//     where the default camera sees most of it: of what one sees (seen), o 24 -> 48 %, ** 37 -> 51 %, *x 20 -> 29 %,
//     2222 27 -> 44 %, 22x 25 -> 47 %, 2*22 20 -> 36 %, 442 36 -> 49 %, 632 28 -> 36 % (none less than before).
//     (22x has since gone to 8 %: item 0 holds its comma to the sheet that stays put, which ends underneath.)
//     The kaleidoscopes (snowflake) have no item 3: folded, every layer's comma lies on the tile's.
//   * the ties: the grid candidates as good as the best in items 1 and 2, the best grid candidate and the STARTS (12)
//     best grid candidates that are not neighbours, each refined by a pattern search on items 1 and 2 (a group whose
//     grid has no candidate at the in-tile bar, like 22*, still gets several places to choose from), and the refined
//     best slid along the strip's free directions; the most seen of them is refined again by a pattern search that
//     keeps items 1 and 2;
//   * the result is rounded (6 decimals) and its largest scale `fit` is measured again AT the rounded place on the
//     comma's curve (FINE_UNIT), so the table's own numbers keep the gap as drawn; s = min(fit, sT) (and for the folds in
//     STILL.folds also min with `stillFit`, the largest scale that holds still there, on the curve and STILL_INNER;
//     `turn` = the largest turn of the stored comma's sheet over the presets, degrees); `inTile` and `seen` are measured
//     at the stored place.
//
// seenShare: the default scene as the app builds it (preset 0, its anchor, Wavy 0), folded at t = 1, seen through the
// renderer's own camera (its default view, viewFromAzEl(); the laptop's 3D pane, perspective), rasterised with the
// VIEW.layers front-most layers per pixel; every layer weighs what shows through the ones in front of it
// (SURFACE_OPACITY per layer, as the translucent surface is drawn). The share is that weight on points of the plane that
// lie in the comma (any copy) over all of it. test/motif-view.test.js measures the same quantity apart, on the mesh the
// app draws, checks the table's `seen` against it, and keeps every shape's comma in view.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROUPS, elementsNear } from '../src/groups.js';
import { buildDomain, makeWarp } from '../src/domain.js';
import { buildMesh } from '../src/mesh.js';
import { createFold, foldMeshOptions, foldOptions } from '../src/folds/index.js';
import { viewFromAzEl, __test as R3 } from '../src/render3d.js';
import { SURFACE_OPACITY } from '../src/palette.js';
import { FILL_TARGET, FILL_GAP, FILL_RCAP, FILL_STRETCH, SEAM_GROUPS, SEARCH_UNIT, DRAWN_UNIT, DRAWN_OUTLINE, commaOutline,
  commaPoints, largestApart, nearElements, placementKey, fnv1a } from '../src/motif.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
export const TABLE_FILE = path.join(ROOT, 'src', 'groupdata', 'motif.js');
export const SOURCE_FILE = fileURLToPath(import.meta.url);

const GRID = 14, TURNS = 12, ROUNDS = 30, ROUNDS_VIEW = 20, STARTS = 12;
/** Item 2's cap: a comma at least this much inside the default tile counts as whole (the judge: "98 to 100 %"). */
export const SHARE_OK = 0.98;
/** Item 1's goal for the groups that reach the target: sT x (1 + GOAL_MARGIN) on the search outline, so that the
 *  largest scale measured at the end on the comma's curve (0.3 % smaller at most) still reaches sT: the cover is
 *  FILL_TARGET exactly. */
const GOAL_MARGIN = 0.006;
/** Two strip commas below their goal whose sizes differ by less than this (relative) are tied: the bisection's own
 *  resolution is 6e-5, and sliding along the strip changes the size by no more than that. */
const TIE = 2e-4;
/** The default 3D view: the laptop's 3D pane (css px), the raster's width, the layers kept per pixel, their opacity.
 *  The orientation is the renderer's default (viewFromAzEl() with no arguments: az 0, el 55 today). */
export const VIEW = Object.freeze({ w: 622, h: 550, px: 200, layers: 4, alpha: SURFACE_OPACITY });
const r6 = (v) => Math.round(v * 1e6) / 1e6 + 0;
const floor6 = (v) => Math.floor(v * 1e6) / 1e6;

function insideTile(D, x, y) {
  for (const e of D.edges) if (e.nx * x + e.ny * y - e.c > 0) return false;
  return true;
}

// ---- item 2: the share of the comma inside the default tile, exactly ---------------------------------------------
/** The comma's curve, 4 x as finely sampled as the drawn outline (its chords lie within 2e-5 of the curve, a 16th of
 *  the drawn outline's): the final gap and the in-tile share are measured on it, so they hold for the curve itself,
 *  not only for the drawn polygon. */
export const FINE_UNIT = commaOutline({ head: DRAWN_OUTLINE.head, nBack: 4 * DRAWN_OUTLINE.nBack, nHollow: 4 * DRAWN_OUTLINE.nHollow, nHead: 4 * DRAWN_OUTLINE.nHead });
const NF = FINE_UNIT.length / 2 - 1;
const FP = new Float64Array(2 * NF);
let clipA = new Float64Array(4 * NF + 64), clipB = new Float64Array(4 * NF + 64);
function shoelace(P, n) {
  let s = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) s += P[2 * j] * P[2 * i + 1] - P[2 * i] * P[2 * j + 1];
  return s / 2;
}
/**
 * Share of the area of the comma (centre (cx, cy), turn ang, scales s across and s * sig along; its curve, FINE_UNIT)
 * that lies in the convex tile D: the outline clipped by each edge's half-plane (Sutherland–Hodgman; the comma need
 * not be convex, the tile is, and the clipped outline's area is exact even where it runs along a tile edge twice).
 */
export function exactShare(D, cx, cy, ang, s, sig) {
  commaPoints(FINE_UNIT, NF, cx, cy, ang, s, sig, FP);
  const whole = Math.abs(shoelace(FP, NF));
  if (!(whole > 0)) return 0;
  let n = NF;
  if (clipA.length < 2 * n) clipA = new Float64Array(4 * n);
  clipA.set(FP.subarray(0, 2 * n));
  let A = clipA, B = clipB;
  for (const e of D.edges) {
    if (B.length < 4 * n + 8) B = new Float64Array(4 * n + 8);
    let m = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const px = A[2 * j], py = A[2 * j + 1], qx = A[2 * i], qy = A[2 * i + 1];
      const sp = e.c - (e.nx * px + e.ny * py), sq = e.c - (e.nx * qx + e.ny * qy);
      if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); B[2 * m] = px + t * (qx - px); B[2 * m + 1] = py + t * (qy - py); m++; }
      if (sq >= 0) { B[2 * m] = qx; B[2 * m + 1] = qy; m++; }
    }
    const T = A; A = B; B = T;
    n = m;
    if (!n) break;
  }
  clipA = A; clipB = B;
  return n ? Math.min(1, Math.abs(shoelace(A, n)) / whole) : 0;
}

// ---- item 3: how much of the default 3D view at t = 1 is comma --------------------------------------------------
const viewCache = new Map();
/**
 * The default scene of a group folded at t = 1, seen as the app shows it first: { samples, total, box, key }, or null
 * for a kaleidoscope. samples = [x, y, w, ...]: for each pixel of the raster and each of its VIEW.layers front-most
 * layers, the PLANE point of the default tile drawn there and its weight (what shows through the layers in front of
 * it); total = the sum of the weights; box = the plane box of the tile. key = viewKey's hash.
 */
export function viewOf(G) {
  if (viewCache.has(G.id)) return viewCache.get(G.id);
  let V = null;
  if (G.fold !== 'snowflake') {
    const p0 = G.presets[0];
    const D = buildDomain(G, { seed: p0.seed, metric: p0.metric, warp: makeWarp(G, 0) });
    const tile = buildMesh(G, D, foldMeshOptions(G));
    const fold = createFold(G, D, tile, foldOptions({ anchor: p0.anchor || p0.seed }));
    const M = fold.mesh, F = fold.at(1), o = [0, 0, 0], n = M.n;
    const pos = new Float64Array(3 * n);
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let v = 0; v < n; v++) {
      o[0] = o[1] = o[2] = NaN;
      F(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], o);
      if (!Number.isFinite(o[0] + o[1] + o[2])) { o[0] = M.xy[2 * v]; o[1] = M.xy[2 * v + 1]; o[2] = 0; }
      pos[3 * v] = o[0]; pos[3 * v + 1] = o[1]; pos[3 * v + 2] = o[2];
      if (o[0] < x0) x0 = o[0]; if (o[0] > x1) x1 = o[0]; if (o[1] < y0) y0 = o[1]; if (o[1] > y1) y1 = o[1]; if (o[2] < z0) z0 = o[2]; if (o[2] > z1) z1 = o[2];
    }
    // the app's frame (mapScene): the box's centre, the farthest vertex
    const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    let r2 = 0;
    for (let v = 0; v < n; v++) r2 = Math.max(r2, (pos[3 * v] - c[0]) ** 2 + (pos[3 * v + 1] - c[1]) ** 2 + (pos[3 * v + 2] - c[2]) ** 2);
    const q = viewFromAzEl().q;                                     // the renderer's default view
    const cam = R3.cameraMatrices(q, 1, c, Math.sqrt(r2), VIEW.w / VIEW.h, R3.makeCamera());
    const pv = cam.pv, k = VIEW.px / VIEW.w, NX = VIEW.px, NY = Math.ceil(VIEW.h * k), L = VIEW.layers;
    const sx = new Float64Array(n), sy = new Float64Array(n), sw = new Float64Array(n);
    for (let v = 0; v < n; v++) {
      const x = pos[3 * v], y = pos[3 * v + 1], z = pos[3 * v + 2];
      const w = pv[3] * x + pv[7] * y + pv[11] * z + pv[15];
      sx[v] = ((pv[0] * x + pv[4] * y + pv[8] * z + pv[12]) / w * 0.5 + 0.5) * NX;
      sy[v] = (0.5 - (pv[1] * x + pv[5] * y + pv[9] * z + pv[13]) / w * 0.5) * NY;
      sw[v] = w;                                                    // distance along the view: smaller is nearer
    }
    const cnt = new Uint8Array(NX * NY), dep = new Float64Array(NX * NY * L), px = new Float64Array(NX * NY * L), py = new Float64Array(NX * NY * L);
    const tri = M.tri, xy = M.xy;
    for (let i = 0; i < tri.length; i += 3) {
      const a = tri[i], b = tri[i + 1], cc = tri[i + 2];
      const ax = sx[a], ay = sy[a], bx = sx[b], by = sy[b], cx = sx[cc], cy = sy[cc];
      const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (!(Math.abs(den) > 1e-12)) continue;
      const i0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), i1 = Math.min(NX - 1, Math.ceil(Math.max(ax, bx, cx)));
      const j0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), j1 = Math.min(NY - 1, Math.ceil(Math.max(ay, by, cy)));
      for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
        const qx = ii + 0.5, qy = j + 0.5;
        const l1 = ((by - cy) * (qx - cx) + (cx - bx) * (qy - cy)) / den, l2 = ((cy - ay) * (qx - cx) + (ax - cx) * (qy - cy)) / den, l3 = 1 - l1 - l2;
        if (l1 < 0 || l2 < 0 || l3 < 0) continue;
        const d = l1 * sw[a] + l2 * sw[b] + l3 * sw[cc], p = j * NX + ii, base = p * L;
        let m = cnt[p];
        if (m === L) { if (d >= dep[base + L - 1]) continue; m = L - 1; } else cnt[p]++;
        let q = m;
        while (q > 0 && dep[base + q - 1] > d) { dep[base + q] = dep[base + q - 1]; px[base + q] = px[base + q - 1]; py[base + q] = py[base + q - 1]; q--; }
        dep[base + q] = d;
        px[base + q] = l1 * xy[2 * a] + l2 * xy[2 * b] + l3 * xy[2 * cc];
        py[base + q] = l1 * xy[2 * a + 1] + l2 * xy[2 * b + 1] + l3 * xy[2 * cc + 1];
      }
    }
    const samples = [];
    let total = 0, bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (let p = 0; p < NX * NY; p++) {
      let w = VIEW.alpha;
      for (let l = 0; l < cnt[p]; l++) {
        const x = px[p * L + l], y = py[p * L + l];
        samples.push(x, y, w); total += w; w *= 1 - VIEW.alpha;
        if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
      }
    }
    // the fingerprint: the view, and where the fold puts a fixed set of points of the default tile at t = 1
    const size = Math.sqrt(G.domainArea), probe = [];
    const pts = [...D.poly];
    let gx0 = Infinity, gy0 = Infinity, gx1 = -Infinity, gy1 = -Infinity;
    for (const q of D.poly) { gx0 = Math.min(gx0, q[0]); gx1 = Math.max(gx1, q[0]); gy0 = Math.min(gy0, q[1]); gy1 = Math.max(gy1, q[1]); }
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      const x = gx0 + ((gx1 - gx0) * (i + 0.5)) / 7, y = gy0 + ((gy1 - gy0) * (j + 0.5)) / 7;
      if (D.contains(x, y, -1e-6 * size)) pts.push([x, y]);
    }
    const cxm = D.poly.reduce((s, q) => s + q[0], 0) / D.poly.length, cym = D.poly.reduce((s, q) => s + q[1], 0) / D.poly.length;
    for (const [x0p, y0p] of pts) {
      const x = x0p + 1e-6 * (cxm - x0p), y = y0p + 1e-6 * (cym - y0p);       // nudged inward: one piece
      o[0] = o[1] = o[2] = NaN;
      F(x, y, typeof M.locate === 'function' ? M.locate(x, y) : 0, o);
      for (let k3 = 0; k3 < 3; k3++) probe.push(Math.round((o[k3] / size) * 1e4) / 1e4 + 0);
    }
    const camera = { q: Array.from(q, (v) => Math.round(v * 1e9) / 1e9 + 0), fov: R3.FOV_Y, fit: R3.FIT_MARGIN };
    const key = fnv1a(JSON.stringify({ view: VIEW, camera, fold: G.fold, probe }));
    V = { samples: Float64Array.from(samples), total, box: [bx0, by0, bx1, by1], key };
  }
  viewCache.set(G.id, V);
  return V;
}

/** The view fingerprint a table entry must carry to be fresh (null for a kaleidoscope: no view term). */
export function viewKey(G) { const V = viewOf(G); return V ? V.key : null; }

const RN = 256;
let raster = new Uint8Array(RN * RN);
const ND = DRAWN_UNIT.length / 2 - 1;
const CP = new Float64Array(2 * ND), CQ = new Float64Array(2 * ND);
/**
 * The share of the default view at t = 1 that is comma, for the comma at (cx, cy), turned by ang, scales s and s * sig:
 * the comma's copies near the tile are drawn into a RN x RN raster over the tile's plane box (even-odd scanlines), and
 * every sample of viewOf(G) looks itself up there. 0 for a kaleidoscope.
 */
export function seenShare(G, cx, cy, ang, s, sig) {
  const V = viewOf(G);
  if (!V) return 0;
  const [bx0, by0, bx1, by1] = V.box, cw = (bx1 - bx0) / RN || 1, ch = (by1 - by0) / RN || 1;
  raster.fill(0);
  commaPoints(DRAWN_UNIT, ND, cx, cy, ang, s, sig, CP);
  const R = s * Math.max(1, sig);
  const mx = (bx0 + bx1) / 2, my = (by0 + by1) / 2, Rb = Math.hypot(bx1 - bx0, by1 - by0) / 2;
  const ys = [];
  for (const g of elementsNear(G, mx, my, Rb + R * 1.01, cx, cy)) {
    let qx0 = Infinity, qy0 = Infinity, qx1 = -Infinity, qy1 = -Infinity;
    for (let i = 0; i < ND; i++) {
      const x = g.a * CP[2 * i] + g.b * CP[2 * i + 1] + g.tx, y = g.c * CP[2 * i] + g.d * CP[2 * i + 1] + g.ty;
      CQ[2 * i] = x; CQ[2 * i + 1] = y;
      if (x < qx0) qx0 = x; if (x > qx1) qx1 = x; if (y < qy0) qy0 = y; if (y > qy1) qy1 = y;
    }
    if (qx1 < bx0 || qx0 > bx1 || qy1 < by0 || qy0 > by1) continue;
    const j0 = Math.max(0, Math.floor((qy0 - by0) / ch)), j1 = Math.min(RN - 1, Math.floor((qy1 - by0) / ch));
    for (let j = j0; j <= j1; j++) {
      const yc = by0 + (j + 0.5) * ch;
      ys.length = 0;
      for (let i = 0, k = ND - 1; i < ND; k = i++) {
        const ya = CQ[2 * k + 1], yb = CQ[2 * i + 1];
        if ((ya > yc) !== (yb > yc)) ys.push(CQ[2 * k] + ((yc - ya) * (CQ[2 * i] - CQ[2 * k])) / (yb - ya));
      }
      ys.sort((a, b) => a - b);
      for (let q = 0; q + 1 < ys.length; q += 2) {
        const i0 = Math.max(0, Math.ceil((ys[q] - bx0) / cw - 0.5)), i1 = Math.min(RN - 1, Math.floor((ys[q + 1] - bx0) / cw - 0.5));
        for (let i = i0; i <= i1; i++) raster[j * RN + i] = 1;
      }
    }
  }
  const S = V.samples;
  let hit = 0;
  for (let k = 0; k < S.length; k += 3) {
    let i = Math.floor((S[k] - bx0) / cw), j = Math.floor((S[k + 1] - by0) / ch);
    i = i < 0 ? 0 : i >= RN ? RN - 1 : i; j = j < 0 ? 0 : j >= RN ? RN - 1 : j;
    if (raster[j * RN + i]) hit += S[k + 2];
  }
  return hit / V.total;
}

// ---- item 0 (the cross-cap): the paint holds still --------------------------------------------------------------
/**
 * THE PAINT HOLDS STILL (the owner, 10 Nov 2026: "crosscap vis is weird, It's like the surface, the painting jumped from
 * one side of the surface to another at one point. Fix that."; notes/crosscap-paint.md). For the folds in STILL.folds
 * the comma may only lie where the sheet never turns over while ANY preset folds (each with its anchor, as the app folds
 * it): at every point of the comma the surface normal stays within STILL.turn degrees of where it started (+z), over
 * the whole play. Measured: in 22x every preset turns the sheet over by 140-180 degrees everywhere except on the band
 * y in [b/4, b/2] (mod b/2: the far half of the cell C0 the closed shape sits on, the far-lower sheet of the pillow),
 * which turns by at most 90 degrees (the puff makes the pillow's sides vertical; the zip) and moves at most 0.33 tile
 * sizes; the round-3 comma lay on the Pocket's flap and swept, mirrored, across the default view as the flap passed
 * edge-on (t 0.23). The rule is HARD and comes before item 1: the cross-cap's comma is the largest that fits that band
 * (29 % of the tile, not the 30 % target). With flaps that lift toward +z (round 3) the sheet that stays put is the
 * BOTTOM sheet of the closed shape and the comma was seen through the top sheet (seen 8 %, front 0); since the final fix
 * of 10 Nov 2026 the cross-cap's flaps tuck under (src/folds/crosscap.js FLAPS = 'under'; a mirror in z = 0 keeps every
 * normal's z-component, so this field is the same either way) and the same comma is on top (front 53 %, seen 39 %;
 * test/motif-view.test.js holds 22x to the floors of every shape). notes/crosscap-paint.md has the measurements.
 * test/crosscap-paint.test.js checks, apart from this, that the comma holds still and is on top.
 *   folds  the fold types the rule applies to
 *   turn   the largest turn of the normal (degrees) a point of the comma may make
 *   steps  times sampled over the play (0, 1/steps, ..., 1)
 *   cell   spacing of the grid the turn is sampled on, in units of sqrt(domainArea)
 */
export const STILL = Object.freeze({ folds: Object.freeze(['crosscap']), turn: 120, steps: 32, cell: 0.006 });
const isIdentity = (g) => Math.abs(g.a - 1) < 1e-12 && Math.abs(g.d - 1) < 1e-12 && Math.abs(g.b) < 1e-12 && Math.abs(g.c) < 1e-12 && Math.abs(g.tx) < 1e-12 && Math.abs(g.ty) < 1e-12;
/** Points inside the unit comma (spacing 0.15 of its radius): with the outline they are what the rule checks. */
export const STILL_INNER = (() => {
  const P = DRAWN_UNIT, n = P.length / 2 - 1, out = [];
  const inside = (x, y) => {
    let c = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const yi = P[2 * i + 1], yj = P[2 * j + 1];
      if ((yi > y) !== (yj > y) && x < ((P[2 * j] - P[2 * i]) * (y - yi)) / (yj - yi) + P[2 * i]) c = !c;
    }
    return c;
  };
  for (let x = -0.45; x <= 1; x += 0.15) for (let y = -0.95; y <= 1; y += 0.15) if (inside(x, y)) out.push(x, y);
  return Float64Array.from(out);
})();

const stillCache = new Map();
/**
 * The turn field of a group whose fold is in STILL.folds, or null: for a grid over the default tile D0 (spacing
 * STILL.cell sqrt(domainArea)), the largest turn of the sheet's normal over every preset's fold, at the copy of the
 * grid point in that preset's tile. -> { turnAt(x, y): degrees at the copy in D0 of the plane point (Infinity if none),
 * presets }. A field of the plane modulo the group, so any point is first carried into D0.
 */
export function stillOf(G) {
  if (stillCache.has(G.id)) return stillCache.get(G.id);
  let S = null;
  if (STILL.folds.includes(G.fold)) {
    const size = Math.sqrt(G.domainArea), p0 = G.presets[0];
    const D0 = buildDomain(G, { seed: p0.seed, metric: p0.metric });
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const q of D0.poly) { bx0 = Math.min(bx0, q[0]); bx1 = Math.max(bx1, q[0]); by0 = Math.min(by0, q[1]); by1 = Math.max(by1, q[1]); }
    const c0x = (bx0 + bx1) / 2, c0y = (by0 + by1) / 2, R0 = Math.hypot(bx1 - bx0, by1 - by0) / 2;
    // cell-centred samples ((i + 1/2) h from the box's corner): no sample lies on a tile's edge, where a point has two copies
    const h = STILL.cell * size, nx = Math.ceil((bx1 - bx0) / h), ny = Math.ceil((by1 - by0) / h);
    const field = new Float32Array(nx * ny);
    const K = STILL.steps, dh = 1e-4 * size, o = [0, 0, 0], a = [0, 0, 0], b = [0, 0, 0], q = [0, 0];
    for (const p of G.presets) {
      const D = buildDomain(G, { seed: p.seed, metric: p.metric, warp: makeWarp(G, 0) });
      const M = buildMesh(G, D, foldMeshOptions(G));
      const fold = createFold(G, D, M, foldOptions({ anchor: p.anchor || p.seed }));
      const Fs = [];
      for (let k = 1; k <= K; k++) Fs.push(fold.at(k / K));
      let tx0 = Infinity, ty0 = Infinity, tx1 = -Infinity, ty1 = -Infinity;
      for (const v of D.poly) { tx0 = Math.min(tx0, v[0]); tx1 = Math.max(tx1, v[0]); ty0 = Math.min(ty0, v[1]); ty1 = Math.max(ty1, v[1]); }
      // the elements that carry a point of D0's box into this preset's tile
      const els = elementsNear(G, (tx0 + tx1) / 2, (ty0 + ty1) / 2, Math.hypot(tx1 - tx0, ty1 - ty0) / 2 + 1.5 * R0 + h, c0x, c0y);
      const loc = fold.mesh && typeof fold.mesh.locate === 'function' ? fold.mesh.locate : M.locate;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const x = bx0 + (i + 0.5) * h, y = by0 + (j + 0.5) * h;
        let hit = false;
        for (const g of els) {
          q[0] = g.a * x + g.b * y + g.tx; q[1] = g.c * x + g.d * y + g.ty;
          if (D.contains(q[0], q[1], -1e-9)) { hit = true; break; }
        }
        let worst = hit ? 0 : 180;
        if (hit) {
          const cell = loc(q[0], q[1]);
          for (const F of Fs) {
            F(q[0], q[1], cell, o); F(q[0] + dh, q[1], cell, a); F(q[0], q[1] + dh, cell, b);
            const ux = a[0] - o[0], uy = a[1] - o[1], uz = a[2] - o[2], vx = b[0] - o[0], vy = b[1] - o[1], vz = b[2] - o[2];
            const nxv = uy * vz - uz * vy, nyv = uz * vx - ux * vz, nzv = ux * vy - uy * vx, l = Math.hypot(nxv, nyv, nzv);
            if (!(l > 1e-14 * dh * dh)) continue;                       // a pinch point: no normal
            const ang = (Math.acos(Math.max(-1, Math.min(1, nzv / l))) * 180) / Math.PI;
            if (ang > worst) worst = ang;
          }
        }
        const k = j * nx + i;
        if (worst > field[k]) field[k] = worst;
      }
    }
    // carrying a plane point into D0: every g that moves D0's centre by at most 2 R0 + the comma's reach, which is enough
    // for any point of a comma centred in D0 (g(P) in D0 needs |g(c0) - c0| <= |P - c0| + R0)
    const back = elementsNear(G, c0x, c0y, 2 * R0 + 1.2 * size + 2 * FILL_RCAP * G.viewHalf, c0x, c0y);
    const one = back.find(isIdentity);
    const carry = one ? [one, ...back.filter((g) => g !== one)] : back;
    const turnAt = (x, y) => {
      for (const g of carry) {
        const u = g.a * x + g.b * y + g.tx, v = g.c * x + g.d * y + g.ty;
        if (!D0.contains(u, v, 1e-9)) continue;
        const i = Math.min(nx - 1, Math.max(0, Math.floor((u - bx0) / h))), j = Math.min(ny - 1, Math.max(0, Math.floor((v - by0) / h)));
        return field[j * nx + i];
      }
      return Infinity;
    };
    S = { turnAt, presets: G.presets.length, grid: [nx, ny] };
  }
  stillCache.set(G.id, S);
  return S;
}

/** The largest turn over the comma's outline (`unit`'s points) and its inner points (STILL_INNER), in degrees. */
export function stillTurn(S, cx, cy, ang, s, sig, unit = SEARCH_UNIT) {
  const nu = unit.length / 2 - 1, ni = STILL_INNER.length / 2, ca = Math.cos(ang), sa = Math.sin(ang);
  let worst = 0;
  for (let i = 0; i < nu + ni; i++) {
    const ux = i < nu ? unit[2 * i] : STILL_INNER[2 * (i - nu)], uy = i < nu ? unit[2 * i + 1] : STILL_INNER[2 * (i - nu) + 1];
    const x = s * ux, y = s * sig * uy, t = S.turnAt(cx + ca * x - sa * y, cy + sa * x + ca * y);
    if (t > worst) { worst = t; if (worst > STILL.turn) return worst; }
  }
  return worst;
}
/** The largest scale s <= sHi at which the comma holds still (stillTurn <= STILL.turn); bisection, 14 steps. */
export function stillScale(S, cx, cy, ang, sig, sHi, unit = SEARCH_UNIT) {
  if (stillTurn(S, cx, cy, ang, sHi, sig, unit) <= STILL.turn) return sHi;
  let lo = 0, hi = sHi;
  for (let it = 0; it < 14; it++) { const m = (lo + hi) / 2; if (stillTurn(S, cx, cy, ang, m, sig, unit) <= STILL.turn) lo = m; else hi = m; }
  return lo;
}

// ---- the search -------------------------------------------------------------------------------------------------
/** The directions the comma can slide in without changing its size: the vectors every rep's linear part fixes. */
export function freeDirections(G) {
  // A translation by u commutes with x -> Lx + t exactly when Lu = u, so the comma's copies all move with it and its
  // largest size stays. The common fixed space of the point group: R^2 (o), a line (one mirror direction: **, *x, xx), 0.
  let dirs = [[1, 0], [0, 1]];
  for (const g of G.reps) {
    if (Math.abs(g.a - 1) < 1e-9 && Math.abs(g.d - 1) < 1e-9 && Math.abs(g.b) < 1e-9 && Math.abs(g.c) < 1e-9) continue;
    if (g.a * g.d - g.b * g.c > 0) return [];                       // a rotation fixes no direction
    // a reflection fixes the line of (b, 1 - a) (or of (1 - d, c) when that is 0)
    const v = Math.hypot(g.b, 1 - g.a) > 1e-9 ? [g.b, 1 - g.a] : [1 - g.d, g.c], l = Math.hypot(v[0], v[1]);
    const u = [v[0] / l, v[1] / l];
    if (dirs.length === 2) dirs = [u];
    else if (Math.abs(dirs[0][0] * u[1] - dirs[0][1] * u[0]) > 1e-9) return [];
  }
  return dirs;
}

/** The placement of one group's comma: the table entry. */
export function searchGroup(G) {
  const p0 = G.presets[0];
  const D = buildDomain(G, { seed: p0.seed, metric: p0.metric });
  const size = Math.sqrt(G.domainArea), gap = FILL_GAP * size;
  const sig = FILL_STRETCH[G.id] || 1;
  const sHi = Math.min(1.2 * size, FILL_RCAP * G.viewHalf) / sig;                 // radius s * sig within the caps
  const sT = Math.sqrt((FILL_TARGET * G.domainArea) / ((Math.PI / 2) * sig));    // covers FILL_TARGET of the tile
  const reach = sHi >= sT, goal = reach ? Math.min(sHi, sT * (1 + GOAL_MARGIN)) : sHi;
  const coverOf = (s) => ((Math.PI / 2) * s * s * sig) / G.domainArea;
  const hasView = !!viewOf(G);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of D.poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  // item 0 (STILL.folds only): the comma also holds still; its scale is the smaller of the two bisections
  const still = stillOf(G);
  const stillHi = (x, y, ang, unit = SEARCH_UNIT) => (still ? stillScale(still, x, y, ang, sig, sHi, unit) : sHi);
  const gapFit = (x, y, ang, hi, unit = SEARCH_UNIT) => largestApart(nearElements(G, x, y, hi * sig, gap), x, y, ang, sig, gap, hi, unit);
  const fitAt = (x, y, ang, unit = SEARCH_UNIT) => gapFit(x, y, ang, stillHi(x, y, ang, unit), unit);
  // items 1 and 2: below the goal the size; at the goal 1 + the in-tile share up to SHARE_OK (strips: 1)
  // (the bar is SHARE_OK + 2e-5, so that rounding the place to 6 decimals cannot take the stored share below SHARE_OK)
  const scoreOf = (x, y, ang, s) => (s < goal ? s / goal : 1 + (reach ? Math.min(SHARE_OK + 2e-5, exactShare(D, x, y, ang, sT, sig)) : 0));
  const seenOf = (c) => (c.seen === undefined ? (c.seen = seenShare(G, c.x, c.y, c.ang, Math.min(c.s, sT), sig)) : c.seen);
  const grid = [];
  let best = { score: -1 };
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      const x = x0 + ((x1 - x0) * (i + 0.5)) / (GRID + 1), y = y0 + ((y1 - y0) * (j + 0.5)) / (GRID + 1);
      if (!insideTile(D, x, y)) continue;
      const els = nearElements(G, x, y, sHi * sig, gap);
      for (let a = 0; a < TURNS; a++) {
        const ang = (2 * Math.PI * a) / TURNS + 0.13;
        const s = largestApart(els, x, y, ang, sig, gap, stillHi(x, y, ang));
        const c = { x, y, ang, s, score: scoreOf(x, y, ang, s) };
        grid.push(c);
        if (c.score > best.score) best = c;
      }
    }
  }
  const MOVES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [1, 1, 0], [-1, -1, 0], [1, -1, 0], [-1, 1, 0]];
  const step0 = Math.max(x1 - x0, y1 - y0) / (GRID + 1), astep0 = Math.PI / TURNS;
  /** Pattern search over (x, y, angle) on items 1 and 2 from the candidate c. */
  const refine = (c) => {
    let b = c, step = step0, astep = astep0;
    for (let it = 0; it < ROUNDS; it++) {
      let moved = false;
      for (const [dx, dy, da] of MOVES) {
        const x = b.x + dx * step, y = b.y + dy * step, ang = b.ang + da * astep;
        if (!insideTile(D, x, y)) continue;
        const s = fitAt(x, y, ang);
        const score = scoreOf(x, y, ang, s);
        if (score > b.score * (1 + 1e-6) + 1e-9) { b = { x, y, ang, s, score }; moved = true; }
      }
      if (!moved) { step /= 2; astep /= 2; }
    }
    return b;
  };
  // the groups with a view refine the STARTS best grid candidates that are not neighbours of each other (a group whose
  // grid has few or no candidates as good as the best in items 1 and 2 still gets a choice of places for item 3)
  const starts = [];
  if (hasView) {
    const order = grid.map((c, i) => i).sort((i, j) => grid[j].score - grid[i].score || i - j);
    for (const i of order) {
      const c = grid[i];
      if (starts.some((d) => Math.abs(d.x - c.x) < 1.01 * step0 && Math.abs(d.y - c.y) < 1.01 * step0 &&
        Math.abs(((d.ang - c.ang + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) < 2.01 * astep0)) continue;
      starts.push(c);
      if (starts.length === STARTS) break;
    }
  }
  const refined = [refine(best), ...starts.filter((c) => c !== best).map(refine)];
  best = refined[0];
  for (const c of refined) if (c.score > best.score * (1 + 1e-6) + 1e-9) best = c;
  // item 3, among the ties of items 1 and 2: below the goal (a strip limited by its gap) within the bisection's noise;
  // at the goal exactly (the share is exact, so SHARE_OK is a hard bar)
  if (hasView) {
    const bar = best.score < 1 ? best.score * (1 - TIE) : best.score - 1e-12;
    const ties = [best, ...refined.filter((c) => c.score >= bar), ...grid.filter((c) => c.score >= bar)];
    const dirs = freeDirections(G);
    if (dirs.length === 2) {
      for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
        const x = x0 + ((x1 - x0) * (i + 0.5)) / 16, y = y0 + ((y1 - y0) * (j + 0.5)) / 16;
        if (!insideTile(D, x, y)) continue;
        const s = fitAt(x, y, best.ang), score = scoreOf(x, y, best.ang, s);
        if (score >= bar) ties.push({ x, y, ang: best.ang, s, score });
      }
    } else if (dirs.length === 1) {
      const [ux, uy] = dirs[0];
      let u0 = Infinity, u1 = -Infinity;
      for (const p of D.poly) { const u = p[0] * ux + p[1] * uy; u0 = Math.min(u0, u); u1 = Math.max(u1, u); }
      const ub = best.x * ux + best.y * uy;
      for (let k = 0; k < 48; k++) {
        const d = u0 + ((u1 - u0) * (k + 0.5)) / 48 - ub, x = best.x + d * ux, y = best.y + d * uy;
        if (!insideTile(D, x, y)) continue;
        const s = fitAt(x, y, best.ang), score = scoreOf(x, y, best.ang, s);
        if (score >= bar) ties.push({ x, y, ang: best.ang, s, score });
      }
    }
    let top = ties[0];
    for (const c of ties) if (seenOf(c) > seenOf(top)) top = c;
    let step = step0, astep = astep0;
    for (let it = 0; it < ROUNDS_VIEW; it++) {
      let moved = false;
      for (const [dx, dy, da] of MOVES) {
        const x = top.x + dx * step, y = top.y + dy * step, ang = top.ang + da * astep;
        if (!insideTile(D, x, y)) continue;
        const s = fitAt(x, y, ang), score = scoreOf(x, y, ang, s);
        if (score < bar) continue;
        const c = { x, y, ang, s, score };
        if (seenOf(c) > seenOf(top) * (1 + 1e-6) + 1e-9) { top = c; moved = true; }
      }
      if (!moved) { step /= 2; astep /= 2; }
    }
    best = top;
  }
  // round, and measure the largest scale again at the rounded place ON THE COMMA'S CURVE (FINE_UNIT), so the stored
  // numbers themselves keep the gap as drawn, and as the curve the drawing samples
  const at = [r6(best.x), r6(best.y)];
  const angle = r6(((best.ang % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
  // `fit` is the gap's alone (as before); a cross-cap's comma is also held to the still band (item 0): stillFit
  const fit = floor6(gapFit(at[0], at[1], angle, sHi, FINE_UNIT));
  const stillFit = still ? floor6(stillScale(still, at[0], at[1], angle, sig, sHi, FINE_UNIT)) : Infinity;
  const s = floor6(Math.min(fit, sT, stillFit));
  const entry = {
    key: placementKey(G), view: viewKey(G), at, angle, s, stretch: sig, fit,
    cover: +coverOf(s).toFixed(4), coverFit: +coverOf(fit).toFixed(4),
    inTile: +exactShare(D, at[0], at[1], angle, s, sig).toFixed(4), seen: +seenShare(G, at[0], at[1], angle, s, sig).toFixed(4),
    radius: r6(s * sig),
  };
  // item 0: the scale at which it still holds still, and the largest turn of its sheet over the presets (degrees)
  if (still) { entry.stillFit = stillFit; entry.turn = +stillTurn(still, at[0], at[1], angle, s, sig, FINE_UNIT).toFixed(1); }
  return entry;
}

/** The groups the table holds: all but the seam groups, in display order. */
export function tableGroups() { return GROUPS.filter((g) => !SEAM_GROUPS.has(g.id)); }

/** The text of src/groupdata/motif.js for a table { id: entry }. */
export function renderTable(table) {
  const src = fs.readFileSync(SOURCE_FILE, 'utf8');
  return [
    '// groupdata/motif.js — WRITTEN BY tools/motif-place.mjs: do not edit by hand. Regenerate it with',
    '//   node tools/motif-place.mjs',
    '// after any change of the group data (lattice, coset representatives, viewHalf, the default preset), of the default',
    '// tile (src/domain.js), of the rules in src/motif.js, of a fold\'s shape at t = 1 or of the default view; test/motif.test.js',
    '// fails while it is stale. One big comma per group (src/motif.js motifFor; qa/fill-judge.md): the unit comma',
    '// (commaOutline) scaled by s across and s * stretch along its head -> tail axis, turned by `angle` (radians), centred',
    '// at `at`. Its copies under the group stay FILL_GAP * sqrt(domainArea) apart, outline to outline (as drawn); `fit` is',
    '// the largest s that keeps that gap there; it covers `cover` of the tile (FILL_TARGET, or `coverFit` when that is less);',
    '// `inTile` of it lies inside the default preset\'s tile (exactly); `seen` is the share of the default 3D view at t = 1',
    '// that is comma; radius = s * stretch. key = placementKey(group) of the data it was computed from, view = viewKey(group)',
    '// of the folded default tile it was seen on (null: a kaleidoscope); PLACEMENT_SOURCE = fnv1a of tools/motif-place.mjs.',
    '// The cross-cap (22x) holds still (tools/motif-place.mjs STILL): its comma lies where no preset\'s fold turns the sheet',
    '// over; stillFit = the largest s that does there, turn = how far (degrees) its sheet\'s normal turns at most.',
    '// The seam groups (xx) are placed by rule in src/motif.js.',
    `export const PLACEMENT_SOURCE = '${fnv1a(src)}';`,
    'export const PLACEMENTS = {',
    ...Object.keys(table).map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(table[id])},`),
    '};',
    '',
  ].join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const opt = {};
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('--')) continue;
    const k = args[i].slice(2);
    if (i + 1 < args.length && !args[i + 1].startsWith('--')) opt[k] = args[++i]; else opt[k] = true;
  }
  const want = typeof opt.groups === 'string' ? opt.groups.split(',') : null;
  const table = {};
  const t00 = Date.now();
  for (const G of tableGroups()) {
    if (want && !want.includes(G.id)) continue;
    const t0 = Date.now();
    const e = searchGroup(G);
    table[G.id] = e;
    console.log(`${G.id.padEnd(6)} ${G.fold.padEnd(9)} cover ${(100 * e.cover).toFixed(1)} % (fit ${(100 * e.coverFit).toFixed(1)} %)  in the default tile ${(100 * e.inTile).toFixed(1)} %  seen at t = 1 ${(100 * e.seen).toFixed(1)} %  radius ${(e.radius / G.viewHalf).toFixed(3)} viewHalf  ${Date.now() - t0} ms`);
  }
  if (want) { console.log(JSON.stringify(table, null, 1)); return 0; }
  const text = renderTable(table);
  const old = fs.existsSync(TABLE_FILE) ? fs.readFileSync(TABLE_FILE, 'utf8') : '';
  if (opt.check) {
    if (old === text) { console.log(`src/groupdata/motif.js is up to date (${Date.now() - t00} ms)`); return 0; }
    console.log('src/groupdata/motif.js is STALE: run node tools/motif-place.mjs');
    return 1;
  }
  fs.writeFileSync(TABLE_FILE, text);
  console.log(`${old === text ? 'unchanged' : 'WROTE'} ${path.relative(ROOT, TABLE_FILE)} (${Date.now() - t00} ms)`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SOURCE_FILE) process.exit(main());
