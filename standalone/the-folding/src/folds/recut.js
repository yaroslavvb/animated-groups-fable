// folds/recut.js — "re-cut first": the motion for the two shapes that pass through themselves, the Klein bottle (xx)
// and the cross-cap (22x). 13 Nov 2026, the owner, after the 22x lab (lab22x/, its motion "Re-cut first"): "for the
// motion use 'Re-cut first' in the cases where there is a self-intersection of the surface".
//
// The closed shape of these two groups crosses itself along a line. Folded as ONE sheet, a tile whose inside holds
// both sheets that cross there has to pass paper through paper on the way (dev/recut/probe-direct.mjs measures it:
// every cut but the default one, and every wavy cut). The group's DEFAULT cut is the tile whose own cut runs along the
// lines that land on the double line — the Pocket of 22x, the Rectangle of xx — so it closes with nothing passing
// through anything: its rims MEET on the double line. So every other tile is first re-cut into that one:
//
//   stage 1   the tile is cut along the copies of the home tile's rim. Each piece is carried to its place in the home
//             tile by the element of the group that takes it there, one piece after another: a half-turn swings it
//             about a 2-fold centre, a translation slides it, a glide turns it over its axis while it slides along it
//             (so a piece carried by a glide shows the paper's back from then on: the print is two-sided). The pieces
//             hop over the paper; nothing passes through anything.
//   stage 2   the home tile folds, exactly as the default cut does (the fold module's own motion).
//
// The pieces are the parts of the tile in the copies e^-1(P) of the home tile P; each is rigid in stage 1. The print
// (src/pattern.js) is a pattern of the group, so the pieces arrive in register. At t = 1 the map is the home fold's
// closed map, which every element of the group leaves as it is: the tile's own seams (still drawn in their colours on
// the pieces that carry them) close, and the closed shape is the same for every cut.
//
// WHICH COPY OF THE HOME. With opts.anchor (the app always gives one: the seed of the preset last chosen) the home is
// the copy h(P) whose seed is nearest the ANCHOR, so it stays put while the cut is dragged or made wavy (SPEC 7); the
// presets' anchors all give P itself. Without an anchor it is the copy nearest the tile's own seed ("anchor = seed").
// Ties go to the identity, then to a copy that is not turned over. Stage 2 is then h o (home fold) o h^-1.
//
// The mesh that comes back is the tile's own mesh (the direct fold's, so it is as fine where the shape bends as the
// direct fold wants it), cut along the copies of the home's rim, with no vertex shared between two pieces:
//   n, xy, cell, tri, m, triCell     as mesh.js; `cell` / `triCell` index `cells` ("tags": a piece AND the piece of
//                                    the home mesh its points ride on in stage 2)
//   cells[tag]                       { index, part, home, g (the element that carries the piece to its place), parity,
//                                      area, parent: -1, depth: 0, hinge: null, poly: null }
//   boundary                         as mesh.js: one entry per edge of the tile, each sample with its tag
//   boundaryRuns                     the same lines cut where the piece changes (each run rides on one piece; the
//                                    app draws these, so no line stretches between two pieces that are apart)
//   creases                          the home fold's creases, on the pieces: [{ a, b, pts: [x1, y1, x2, y2] }]
//   cuts                             the home tile's rim, on the pieces (where the tile is cut): [{ part, pts, cells }]
//                                    (the parts that run along the tile's own boundary are left out)
//   locate(x, y)                     the tag of a plane point of the tile
// The fold (SPEC 5.3: mesh, stops, duration, at) also has
//   recut        { home: { name, poly, element }, pieces: [{ part, type, text, area, from, to, moves, element, poly }],
//                  movers, tau0, seconds, foldSeconds }   (from / to: the piece's window in t; tau0: when stage 2
//                  starts; poly: the piece on the paper, its part of the tile's outline; element carries it to its place)
//   foldFrom     = recut.tau0
//   creaseAlpha(t), cutStyle(t), stage(t), doubleLine(t), homeFold, base (the tile's direct fold), anchor
//
// No DOM. `direct` and `meshOptions` are handed in by src/folds/index.js (this module must not import it).

import { buildDomain, makeWarp } from '../domain.js';
import { buildMesh } from '../mesh.js';
import { elementsNear } from '../groups.js';
import { inverse, compose, classify, clipHalfPlane, det } from '../geom.js';

/** The fold types that are re-cut: the shapes with a line of self-intersection. */
export const RECUT_FOLDS = new Set(['klein', 'crosscap']);
/** Seconds a large piece takes to its place; a speck takes MOVE_MIN of it; all the moves together at most RECUT_MAX_SECONDS. */
export const MOVE_SECONDS = 1.15, MOVE_MIN = 0.14, RECUT_MAX_SECONDS = 5;
/** A piece of this share of the tile (or more) takes the full MOVE_SECONDS; the time grows with the cube root of the share. */
export const MOVE_FULL_SHARE = 0.12;
/** A piece smaller than this share of the tile is left out (a speck nobody can see; the sheet has a pinhole there). */
export const DROP_SHARE = 5e-5;
/** How high a piece hops (a translation, a half-turn), and how far a turned-over piece clears the paper: tile sizes. */
export const HOP = 0.07, CLEAR = 0.05;

const PI = Math.PI;
const smooth = (q) => (q <= 0 ? 0 : q >= 1 ? 1 : q * q * (3 - 2 * q));
const smoother = (q) => (q <= 0 ? 0 : q >= 1 ? 1 : q * q * q * (q * (6 * q - 15) + 10));
const IDENTITY = (x, y, cell, out) => { out[0] = x; out[1] = y; out[2] = 0; return out; };
const isIdent = (g, eps = 1e-9) => Math.abs(g.a - 1) < eps && Math.abs(g.b) < eps && Math.abs(g.c) < eps && Math.abs(g.d - 1) < eps && Math.abs(g.tx) < eps && Math.abs(g.ty) < eps;

/** Does the group have a re-cut (a home tile)? */
export function canRecut(group) { return !!group && RECUT_FOLDS.has(group.fold) && Array.isArray(group.presets) && group.presets.length > 0; }

const homes = new WeakMap();
/**
 * The home tile of a group: its default cut (presets[0]) with its fold, built once per group.
 * -> { name, seed, anchor, domain, fold, mesh (the fold's), poly, planes [[nx, ny, c] unit], centroid, radius }
 */
export function recutHome(group, direct, meshOptions = {}) {
  let H = homes.get(group);
  if (H) return H;
  const preset = group.presets[0], an = preset.anchor || preset.seed;
  const domain = buildDomain(group, { seed: preset.seed, metric: preset.metric, warp: makeWarp(group, 0) });
  const fold = direct(group, domain, buildMesh(group, domain, meshOptions), { anchor: [an[0], an[1]] });
  const poly = domain.poly.map((p) => [p[0], p[1]]);
  const planes = domain.edges.map((e) => { const l = Math.hypot(e.nx, e.ny) || 1; return [e.nx / l, e.ny / l, e.c / l]; });
  let cx = 0, cy = 0;
  for (const p of poly) { cx += p[0] / poly.length; cy += p[1] / poly.length; }
  let radius = 0;
  for (const p of poly) radius = Math.max(radius, Math.hypot(p[0] - cx, p[1] - cy));
  H = { name: preset.name, seed: [domain.seed[0], domain.seed[1]], anchor: [an[0], an[1]], metric: preset.metric, domain, fold, mesh: fold.mesh, poly, planes, centroid: [cx, cy], radius };
  homes.set(group, H);
  return H;
}

/** What an element of the group does to a piece of paper, in words. */
export function moveText(c) {
  if (c.type === 'rotation') return c.order === 2 ? 'a half-turn about a 2-fold centre' : `a turn about a ${c.order}-fold centre`;
  if (c.type === 'glide') return 'a glide: over its axis and along it';
  if (c.type === 'translation') return 'a translation';
  if (c.type === 'reflection') return 'a reflection: over the mirror';
  return 'stays';
}

/**
 * The rigid motion of space that carries a piece from the paper (z = 0) to its image under an element, at progress s
 * in [0, 1]:  (X, Y, Z) = M (x, y, 1),  M = [m00, m01, tx, m10, m11, ty, m20, m21, tz].  At s = 0 the identity, at
 * s = 1 the element (in the plane). A translation and a turn hop over the paper (c.hop); a glide or a reflection turns
 * the piece over its axis, the axis lifted (c.lift) so that the whole piece stays above the paper.
 * c: classify(element) with turn (rotation: the signed angle), sigma and lift (glide, reflection), hop.
 */
export function carry(c, s, out = new Float64Array(9)) {
  const up = Math.sin(PI * s), hop = c.hop || 0;
  if (c.type === 'translation') {
    out[0] = 1; out[1] = 0; out[2] = s * c.vec[0]; out[3] = 0; out[4] = 1; out[5] = s * c.vec[1]; out[6] = 0; out[7] = 0; out[8] = hop * up;
  } else if (c.type === 'rotation') {
    const ang = s * c.turn, co = Math.cos(ang), si = Math.sin(ang), cx = c.center[0], cy = c.center[1];
    out[0] = co; out[1] = -si; out[2] = cx - co * cx + si * cy; out[3] = si; out[4] = co; out[5] = cy - si * cx - co * cy;
    out[6] = 0; out[7] = 0; out[8] = hop * up;
  } else if (c.type === 'glide' || c.type === 'reflection') {
    const ux = c.dir[0], uy = c.dir[1], ax = c.point[0], ay = c.point[1], d = c.type === 'glide' ? c.dist : 0, co = Math.cos(PI * s);
    // alpha = (p - a).u, beta = (p - a).n with n = (-uy, ux):  P = a + (alpha + s d) u + beta co n,  Z = (sigma beta + lift) up
    const m00 = ux * ux + co * uy * uy, m01 = ux * uy - co * uy * ux, m10 = uy * ux - co * ux * uy, m11 = uy * uy + co * ux * ux;
    out[0] = m00; out[1] = m01; out[2] = ax + s * d * ux - (m00 * ax + m01 * ay);
    out[3] = m10; out[4] = m11; out[5] = ay + s * d * uy - (m10 * ax + m11 * ay);
    out[6] = c.sigma * -uy * up; out[7] = c.sigma * ux * up; out[8] = (c.lift - c.sigma * (-uy * ax + ux * ay)) * up;
  } else {
    out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0; out[4] = 1; out[5] = 0; out[6] = 0; out[7] = 0; out[8] = 0;
  }
  return out;
}

/** The copy h(P) of the home whose seed is nearest `ref`: h. Ties: the identity, then a copy not turned over. */
function nearestCopy(group, H, ref, size) {
  let best = null, bd = Infinity;
  const rank = (g) => (isIdent(g) ? 0 : det(g) > 0 ? 1 : 2);
  for (let R = 2.5 * size; !best && R <= 160 * size; R *= 2) {
    for (const g of elementsNear(group, ref[0], ref[1], R, H.seed[0], H.seed[1])) {
      const d = Math.hypot(g.a * H.seed[0] + g.b * H.seed[1] + g.tx - ref[0], g.c * H.seed[0] + g.d * H.seed[1] + g.ty - ref[1]);
      const tie = Math.abs(d - bd) <= 1e-9 * size;
      if (d < bd - 1e-9 * size || (tie && (rank(g) < rank(best) || (rank(g) === rank(best) && (g.tx < best.tx - 1e-12 || (Math.abs(g.tx - best.tx) <= 1e-12 && g.ty < best.ty)))))) {
        best = g; if (!tie) bd = d;
      }
    }
  }
  return best || { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
}

/**
 * The fold "re-cut first" of the tile `domain` (its mesh `mesh`, or null).
 *   direct(group, domain, mesh, opts) -> Fold     the group's own fold module (through src/folds/index.js)
 *   meshOptions                                    foldMeshOptions(group): how the home's mesh is built
 */
export default function createRecut(group, domain, mesh, opts, direct, meshOptions = {}) {
  opts = opts || {};
  const H = recutHome(group, direct, meshOptions);
  const base = direct(group, domain, mesh, opts);     // the tile's own fold: its mesh is the one that is cut
  const B = base.mesh;
  const size = Math.sqrt(group.domainArea), tiny = 1e-9 * size;
  const sA = domain.seedActual || domain.seed;
  const an = opts.anchor && opts.anchor.length >= 2 && Number.isFinite(+opts.anchor[0]) && Number.isFinite(+opts.anchor[1]) ? [+opts.anchor[0], +opts.anchor[1]] : null;
  const h = nearestCopy(group, H, an || sA, size), hi = inverse(h), plainH = isIdent(h);
  const P = H.poly, planes = H.planes, np = planes.length;
  const home = H.fold, HM = H.mesh;
  const manyHome = HM.cells && HM.cells.length > 1 && typeof HM.locate === 'function';

  // ---- the elements e whose copy e^-1(P) of the home meets the tile, and the tile's triangles in each ------------
  const n0 = B.n, X = B.xy, T = B.tri, m0 = (T.length / 3) | 0;
  let rT = 0;
  for (let v = 0; v < n0; v++) rT = Math.max(rT, Math.hypot(X[2 * v] - sA[0], X[2 * v + 1] - sA[1]));
  const bb = [Infinity, Infinity, -Infinity, -Infinity];
  for (let v = 0; v < n0; v++) { const x = X[2 * v], y = X[2 * v + 1]; if (x < bb[0]) bb[0] = x; if (y < bb[1]) bb[1] = y; if (x > bb[2]) bb[2] = x; if (y > bb[3]) bb[3] = y; }
  const pb = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of P) { if (p[0] < pb[0]) pb[0] = p[0]; if (p[1] < pb[1]) pb[1] = p[1]; if (p[0] > pb[2]) pb[2] = p[0]; if (p[1] > pb[3]) pb[3] = p[1]; }
  const els = [];
  for (const e of elementsNear(group, H.centroid[0], H.centroid[1], rT + H.radius + 1e-6 * size, sA[0], sA[1])) {
    // the box of e(tile) against the box of P
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of [[bb[0], bb[1]], [bb[2], bb[1]], [bb[2], bb[3]], [bb[0], bb[3]]]) {
      const u = e.a * x + e.b * y + e.tx, v = e.c * x + e.d * y + e.ty;
      if (u < x0) x0 = u; if (u > x1) x1 = u; if (v < y0) y0 = v; if (v > y1) y1 = v;
    }
    if (x0 > pb[2] + tiny || x1 < pb[0] - tiny || y0 > pb[3] + tiny || y1 < pb[1] - tiny) continue;
    els.push(e);
  }

  // The tile's outline as one polygon (the boundary's own samples: the same for the draft mesh and the full one). The
  // AREA, the middle and the reach of every piece are taken from it, clipped by the piece's copy of the home — never from
  // the triangles — so the pieces, their order and their timing do not depend on how the tile is meshed.
  const outline = [];
  for (const b of (B.boundary || []).slice().sort((p, q) => p.edge - q.edge)) {
    if (!b || !b.pts) continue;
    for (let j = 0; j + 1 < b.pts.length; j += 2) {
      const x = b.pts[j], y = b.pts[j + 1], L = outline.length;
      if (L && Math.abs(outline[L - 1][0] - x) + Math.abs(outline[L - 1][1] - y) < 1e-12) continue;
      outline.push([x, y]);
    }
  }
  if (outline.length > 1 && Math.abs(outline[0][0] - outline[outline.length - 1][0]) + Math.abs(outline[0][1] - outline[outline.length - 1][1]) < 1e-12) outline.pop();
  /** The part of the outline polygon in the copy e^-1(P): { area, centroid, pts } on the paper (null: nothing of it). */
  const outlinePart = (e, ei) => {
    let poly = outline.map((q) => [e.a * q[0] + e.b * q[1] + e.tx, e.c * q[0] + e.d * q[1] + e.ty]);
    for (let i = 0; i < np && poly.length >= 3; i++) poly = clipHalfPlane(poly, planes[i][0], planes[i][1], planes[i][2], 0);
    if (poly.length < 3) return null;
    let a2 = 0, cx = 0, cy = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], w = p[0] * q[1] - p[1] * q[0];
      a2 += w; cx += (p[0] + q[0]) * w; cy += (p[1] + q[1]) * w;
    }
    const area = Math.abs(a2) / 2;
    if (!(area > 0)) return null;
    const ux = cx / (3 * a2), uy = cy / (3 * a2);
    return { area, centroid: [ei.a * ux + ei.b * uy + ei.tx, ei.c * ux + ei.d * uy + ei.ty], pts: poly.map((q) => [ei.a * q[0] + ei.b * q[1] + ei.tx, ei.c * q[0] + ei.d * q[1] + ei.ty]) };
  };

  // per element: its part of the mesh. Whole triangles keep the mesh's own vertices (local id = the vertex); a clipped
  // one brings new points (local id >= n0), welded by position.
  const parts = [];
  const hu = new Float64Array(n0), hv = new Float64Array(n0), sd = new Float64Array(n0);
  const inside = new Uint8Array(n0);
  for (const e of els) {
    let anyIn = false;
    for (let v = 0; v < n0; v++) {
      const u = e.a * X[2 * v] + e.b * X[2 * v + 1] + e.tx, w = e.c * X[2 * v] + e.d * X[2 * v + 1] + e.ty;
      hu[v] = u; hv[v] = w;
      let s = -Infinity;
      for (let i = 0; i < np; i++) { const d = planes[i][0] * u + planes[i][1] * w - planes[i][2]; if (d > s) s = d; }
      sd[v] = s; inside[v] = s <= tiny ? 1 : 0;
      if (s < -tiny) anyIn = true;
    }
    const ei = inverse(e);
    // the piece by the outline: too small to see, or none at all -> no piece (its triangles, if any, are left out)
    const OP = outline.length >= 3 ? outlinePart(e, ei) : null;
    if (outline.length >= 3 && !(OP && OP.area > DROP_SHARE * group.domainArea)) continue;
    const tris = [], cellsOf = [], extra = [], extraKey = new Map();
    let area = 0, ax = 0, ay = 0;
    const cellAt = (u, w) => (manyHome ? HM.locate(u, w) : 0);
    const add = (a, b, c, cu, cw, ar) => { tris.push(a, b, c); cellsOf.push(cellAt(cu, cw)); area += ar; };
    const newPoint = (u, w) => {
      // a point of the clipped triangle, in the home's coordinates -> its place on the paper
      const x = ei.a * u + ei.b * w + ei.tx, y = ei.c * u + ei.d * w + ei.ty;
      const key = Math.round(x * 4e6 / size) + ',' + Math.round(y * 4e6 / size);
      let id = extraKey.get(key);
      if (id === undefined) { id = n0 + extra.length / 2; extra.push(x, y); extraKey.set(key, id); }
      return id;
    };
    for (let t = 0; t < m0; t++) {
      const a = T[3 * t], b = T[3 * t + 1], c = T[3 * t + 2];
      const ar2 = (X[2 * b] - X[2 * a]) * (X[2 * c + 1] - X[2 * a + 1]) - (X[2 * b + 1] - X[2 * a + 1]) * (X[2 * c] - X[2 * a]);
      if (inside[a] && inside[b] && inside[c]) {
        // wholly in this copy (a triangle that only lies along its rim has its middle on the rim: not this copy's)
        const cu = (hu[a] + hu[b] + hu[c]) / 3, cw = (hv[a] + hv[b] + hv[c]) / 3;
        let s = -Infinity;
        for (let i = 0; i < np; i++) { const d = planes[i][0] * cu + planes[i][1] * cw - planes[i][2]; if (d > s) s = d; }
        if (s < -tiny || (sd[a] < -tiny || sd[b] < -tiny || sd[c] < -tiny)) { add(a, b, c, cu, cw, 0.5 * Math.abs(ar2)); ax += 0.5 * Math.abs(ar2) * (X[2 * a] + X[2 * b] + X[2 * c]) / 3; ay += 0.5 * Math.abs(ar2) * (X[2 * a + 1] + X[2 * b + 1] + X[2 * c + 1]) / 3; }
        continue;
      }
      if (!anyIn) continue;
      // beyond one of the home's sides altogether?
      let out = false;
      for (let i = 0; i < np && !out; i++) {
        const pl = planes[i];
        if (pl[0] * hu[a] + pl[1] * hv[a] - pl[2] >= -tiny && pl[0] * hu[b] + pl[1] * hv[b] - pl[2] >= -tiny && pl[0] * hu[c] + pl[1] * hv[c] - pl[2] >= -tiny) out = true;
      }
      if (out) continue;
      let poly = [[hu[a], hv[a], a], [hu[b], hv[b], b], [hu[c], hv[c], c]];
      for (let i = 0; i < np && poly.length >= 3; i++) {
        // (clipHalfPlane makes fresh points for the crossings; the triangle's own corners keep their third entry)
        poly = clipHalfPlane(poly, planes[i][0], planes[i][1], planes[i][2], tiny);
      }
      if (poly.length < 3) continue;
      const ids = poly.map((p) => (p.length > 2 ? p[2] : newPoint(p[0], p[1])));
      const px = (id) => (id < n0 ? X[2 * id] : extra[2 * (id - n0)]), py = (id) => (id < n0 ? X[2 * id + 1] : extra[2 * (id - n0) + 1]);
      for (let k = 1; k + 1 < ids.length; k++) {
        const i0 = ids[0], i1 = ids[k], i2 = ids[k + 1];
        if (i0 === i1 || i1 === i2 || i0 === i2) continue;
        const f2 = (px(i1) - px(i0)) * (py(i2) - py(i0)) - (py(i1) - py(i0)) * (px(i2) - px(i0));
        if (!(f2 > 1e-14 * size * size)) continue;
        const cu = (poly[0][0] + poly[k][0] + poly[k + 1][0]) / 3, cw = (poly[0][1] + poly[k][1] + poly[k + 1][1]) / 3;
        add(i0, i1, i2, cu, cw, 0.5 * f2);
        ax += 0.5 * f2 * (px(i0) + px(i1) + px(i2)) / 3; ay += 0.5 * f2 * (py(i0) + py(i1) + py(i2)) / 3;
      }
    }
    if (!cellsOf.length || !(area > 0)) continue;
    parts.push({ e, ei, tris, cellsOf, extra, area: OP ? OP.area : area, centroid: OP ? OP.centroid : [ax / area, ay / area], reach: OP ? OP.pts : null });
  }
  if (!parts.length) return base;                    // (never seen: the copies of the home cover the plane)

  // ---- the motion of each piece: by g = h o e, classified ---------------------------------------------------------
  const hc = [h.a * H.centroid[0] + h.b * H.centroid[1] + h.tx, h.c * H.centroid[0] + h.d * H.centroid[1] + h.ty];   // the middle of the home copy
  for (const p of parts) {
    const g = plainH ? p.e : compose(h, p.e), c = classify(g);
    p.g = g; p.c = c; p.moves = c.type !== 'identity';
    c.hop = HOP * size;
    // the piece's reach on the paper: the corners of its part of the outline (else its triangles' corners)
    let pts = p.reach;
    if (!pts) {
      pts = [];
      const seen = new Set();
      for (const id of p.tris) { if (seen.has(id)) continue; seen.add(id); pts.push(id < n0 ? [X[2 * id], X[2 * id + 1]] : [p.extra[2 * (id - n0)], p.extra[2 * (id - n0) + 1]]); }
    }
    if (c.type === 'rotation') {
      // turn the way that swings the piece round the outside of the home
      const dx = p.centroid[0] - c.center[0], dy = p.centroid[1] - c.center[1];
      const mid = (sg) => { const a = sg * Math.abs(c.angle) / 2, co = Math.cos(a), si = Math.sin(a); return Math.hypot(c.center[0] + co * dx - si * dy - hc[0], c.center[1] + si * dx + co * dy - hc[1]); };
      c.turn = (mid(1) >= mid(-1) ? 1 : -1) * Math.abs(c.angle);
      p.travel = 2 * Math.hypot(dx, dy) * Math.abs(Math.sin(c.angle / 2));
    } else if (c.type === 'glide' || c.type === 'reflection') {
      // the side that rises is the side most of the piece lies on; the axis is lifted by the reach of the other side
      const nx = -c.dir[1], ny = c.dir[0];
      let lo = Infinity, hi2 = -Infinity;
      for (const q of pts) { const b = (q[0] - c.point[0]) * nx + (q[1] - c.point[1]) * ny; if (b < lo) lo = b; if (b > hi2) hi2 = b; }
      const mean = (p.centroid[0] - c.point[0]) * nx + (p.centroid[1] - c.point[1]) * ny;
      c.sigma = mean >= 0 ? 1 : -1;
      c.lift = Math.max(0, c.sigma > 0 ? -lo : hi2) + CLEAR * size;
      p.travel = Math.hypot(c.type === 'glide' ? c.dist : 0, 2 * mean);
    } else if (c.type === 'translation') p.travel = Math.hypot(c.vec[0], c.vec[1]);
    else p.travel = 0;
  }
  // the piece that stays first; then the movers: half-turns, translations, glides; larger pieces first
  const rank = (p) => (!p.moves ? 0 : p.c.type === 'rotation' ? 1 : p.c.type === 'translation' ? 2 : 3);
  parts.sort((a, b) => rank(a) - rank(b) || b.area - a.area);
  const movers = parts.filter((p) => p.moves), K = movers.length;
  let recutSeconds = 0;
  for (const p of movers) {
    const big = Math.min(1, Math.cbrt(p.area / (MOVE_FULL_SHARE * group.domainArea)));
    p.seconds = MOVE_SECONDS * (MOVE_MIN + (1 - MOVE_MIN) * big) * Math.max(0.85, Math.min(1.3, p.travel / (1.1 * size)));
    recutSeconds += p.seconds;
  }
  if (recutSeconds > RECUT_MAX_SECONDS) { const k = RECUT_MAX_SECONDS / recutSeconds; for (const p of movers) p.seconds *= k; recutSeconds = RECUT_MAX_SECONDS; }
  const foldSeconds = home.duration, duration = foldSeconds + recutSeconds, tau0 = K ? recutSeconds / duration : 0;
  {
    let acc = 0;
    for (const p of movers) { p.from = (acc + 0.04 * p.seconds) / duration; p.to = (acc + 0.97 * p.seconds) / duration; acc += p.seconds; }
  }

  // ---- the mesh: every piece's triangles, no vertex shared between two tags -----------------------------------------
  const tags = [], tagOf = new Map();
  const tagFor = (part, cell) => {
    const key = part * 4096 + cell;
    let id = tagOf.get(key);
    if (id === undefined) {
      id = tags.length; tagOf.set(key, id);
      const p = parts[part];
      tags.push({ index: id, part, home: cell, g: p.g, parity: det(p.g) > 0 ? 0 : 1, area: 0, parent: -1, depth: 0, hinge: null, poly: null });
    }
    return id;
  };
  const xs = [], cs = [], tri = [], tc = [];
  parts.forEach((p, k) => {
    const vid = new Map();
    const vert = (id, tag) => {
      const key = id * 4096 + tag;
      let v = vid.get(key);
      if (v === undefined) {
        v = cs.length; vid.set(key, v); cs.push(tag);
        if (id < n0) xs.push(X[2 * id], X[2 * id + 1]); else xs.push(p.extra[2 * (id - n0)], p.extra[2 * (id - n0) + 1]);
      }
      return v;
    };
    for (let t = 0; t < p.cellsOf.length; t++) {
      const tag = tagFor(k, p.cellsOf[t]);
      const a = vert(p.tris[3 * t], tag), b = vert(p.tris[3 * t + 1], tag), c = vert(p.tris[3 * t + 2], tag);
      tri.push(a, b, c); tc.push(tag);
      tags[tag].area += 0.5 * Math.abs((xs[2 * b] - xs[2 * a]) * (xs[2 * c + 1] - xs[2 * a + 1]) - (xs[2 * b + 1] - xs[2 * a + 1]) * (xs[2 * c] - xs[2 * a]));
    }
    p.part = k;
  });
  const n = cs.length;

  // ---- where a point of the tile is: its piece, its tag ----------------------------------------------------------
  /** How far outside the home the point e(x, y) is (<= 0 inside). */
  const depthIn = (p, x, y) => {
    const u = p.e.a * x + p.e.b * y + p.e.tx, w = p.e.c * x + p.e.d * y + p.e.ty;
    let s = -Infinity;
    for (let i = 0; i < np; i++) { const d = planes[i][0] * u + planes[i][1] * w - planes[i][2]; if (d > s) s = d; }
    return s;
  };
  /** The piece (index into parts) of the plane point: the copy of the home it lies deepest in. */
  const partAt = (x, y) => {
    let best = 0, bs = Infinity;
    for (let k = 0; k < parts.length; k++) { const s = depthIn(parts[k], x, y); if (s < bs) { bs = s; best = k; } }
    return best;
  };
  const tagAt = (x, y, k = partAt(x, y)) => {
    if (!manyHome) return tagFor(k, 0);
    const e = parts[k].e;
    return tagFor(k, HM.locate(e.a * x + e.b * y + e.tx, e.c * x + e.d * y + e.ty));
  };
  const locate = (x, y) => tagAt(x, y);

  // ---- the tile's boundary: every sample with its tag; and cut into runs, each on one piece ---------------------------
  const nudge = 1e-6 * size;
  const boundary = [], boundaryRuns = [];
  for (const b of B.boundary || []) {
    if (!b || !b.pts || b.pts.length < 4) { if (b) boundary.push(b); continue; }
    const pts = b.pts, m = pts.length >> 1, cells = new Uint16Array(m), pk = new Int32Array(m);
    // the side of the boundary the tile is on: its left (the outline runs counter-clockwise)
    const inward = (j) => {
      const i0 = Math.max(0, j - 1), i1 = Math.min(m - 1, j + 1);
      const dx = pts[2 * i1] - pts[2 * i0], dy = pts[2 * i1 + 1] - pts[2 * i0 + 1], l = Math.hypot(dx, dy) || 1;
      return [pts[2 * j] - (nudge * dy) / l, pts[2 * j + 1] + (nudge * dx) / l];
    };
    for (let j = 0; j < m; j++) { const q = inward(j); pk[j] = partAt(q[0], q[1]); cells[j] = tagAt(q[0], q[1], pk[j]); }
    boundary.push({ edge: b.edge, cls: b.cls, kind: b.kind, pts, cells });
    // the runs: where the piece changes between two samples, the point where the line leaves the first piece's copy
    let run = { x: [], c: [] };
    const flush = () => { if (run.c.length >= 2) boundaryRuns.push({ edge: b.edge, cls: b.cls, kind: b.kind, part: tags[run.c[0]].part, pts: Float32Array.from(run.x), cells: Uint16Array.from(run.c) }); run = { x: [], c: [] }; };
    for (let j = 0; j < m; j++) {
      run.x.push(pts[2 * j], pts[2 * j + 1]); run.c.push(cells[j]);
      if (j + 1 < m && pk[j + 1] !== pk[j]) {
        const a = inward(j), c = inward(j + 1);
        let lo = 0, hi2 = 1;
        for (let it = 0; it < 40; it++) { const mid = (lo + hi2) / 2; if (partAt(a[0] + mid * (c[0] - a[0]), a[1] + mid * (c[1] - a[1])) === pk[j]) lo = mid; else hi2 = mid; }
        const u = (lo + hi2) / 2, qx = pts[2 * j] + u * (pts[2 * j + 2] - pts[2 * j]), qy = pts[2 * j + 1] + u * (pts[2 * j + 3] - pts[2 * j + 1]);
        const ix = a[0] + u * (c[0] - a[0]), iy = a[1] + u * (c[1] - a[1]);
        run.x.push(qx, qy); run.c.push(tagAt(ix, iy, pk[j]));
        flush();
        // (a sliver of a third piece between the two samples is skipped: it is shorter than a sample step)
        run.x.push(qx, qy); run.c.push(tagAt(ix, iy, pk[j + 1]));
      }
    }
    flush();
  }

  // ---- lines of the home (its creases, its rim) on the pieces --------------------------------------------------------
  const warp = domain.warp, tmp = [0, 0];
  /** Is the paper point in the tile (a little inside its outline counts as in)? */
  const inTile = (x, y, eps = 1e-9 * size) => { if (warp && warp.amp > 0) warp.inv(x, y, tmp); else { tmp[0] = x; tmp[1] = y; } return domain.contains(tmp[0], tmp[1], eps); };
  /** The piece that holds the home point (u, w): the element whose copy of the tile it lies in; -1 if none is found. */
  const partOfHome = (u, w) => {
    for (let k = 0; k < parts.length; k++) { const ei = parts[k].ei; if (inTile(ei.a * u + ei.b * w + ei.tx, ei.c * u + ei.d * w + ei.ty)) return k; }
    return -1;
  };
  /**
   * Cut the home segment (u0, w0) -> (u1, w1) into runs that lie in one piece: [{ k, t0, t1 }]. `side` nudges the
   * probe to one side of the segment (the home's rim is probed just inside the home).
   */
  const SAMPLES = 48;
  const runsOnHome = (u0, w0, u1, w1, side = null) => {
    const at = (t) => { const u = u0 + t * (u1 - u0), w = w0 + t * (w1 - w0); return side ? partOfHome(u + side[0], w + side[1]) : partOfHome(u, w); };
    const out = [];
    let t0 = 0, k0 = at(0.5 / SAMPLES), tp = 0.5 / SAMPLES;
    for (let j = 1; j < SAMPLES; j++) {
      const t = (j + 0.5) / SAMPLES, k = at(t);
      if (k === k0) { tp = t; continue; }
      let lo = tp, hi2 = t;
      for (let it = 0; it < 30; it++) { const mid = (lo + hi2) / 2; if (at(mid) === k0) lo = mid; else hi2 = mid; }
      const tx = (lo + hi2) / 2;
      if (k0 >= 0) out.push({ k: k0, t0, t1: tx });
      t0 = tx; k0 = k; tp = t;
    }
    if (k0 >= 0) out.push({ k: k0, t0, t1: 1 });
    return out;
  };
  const onPaper = (k, u, w, out) => { const ei = parts[k].ei; out[0] = ei.a * u + ei.b * w + ei.tx; out[1] = ei.c * u + ei.d * w + ei.ty; return out; };

  const creases = [];
  for (const c of HM.creases || []) {
    if (!c || !c.pts || c.pts.length < 4) continue;
    const cell = c.b != null ? c.b : (c.a != null ? c.a : 0);
    for (const r of runsOnHome(c.pts[0], c.pts[1], c.pts[2], c.pts[3])) {
      if (!(r.t1 - r.t0 > 1e-6)) continue;
      const p0 = [0, 0], p1 = [0, 0];
      onPaper(r.k, c.pts[0] + r.t0 * (c.pts[2] - c.pts[0]), c.pts[1] + r.t0 * (c.pts[3] - c.pts[1]), p0);
      onPaper(r.k, c.pts[0] + r.t1 * (c.pts[2] - c.pts[0]), c.pts[1] + r.t1 * (c.pts[3] - c.pts[1]), p1);
      const tag = tagFor(r.k, cell);
      creases.push({ a: tag, b: tag, pts: Float64Array.of(p0[0], p0[1], p1[0], p1[1]) });
    }
  }

  // the rim of the home, on the pieces: where the tile is cut. A part of the rim that runs along the tile's own
  // boundary is no cut (a seam of the tile is already drawn there).
  const cuts = [];
  const step = size / 60;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(L > 1e-9 * size)) continue;
    const inx = -planes[i][0] * 1e-6 * size, iny = -planes[i][1] * 1e-6 * size;        // just inside the home
    for (const r of runsOnHome(a[0], a[1], b[0], b[1], [inx, iny])) {
      if (!(r.t1 - r.t0 > 1e-6)) continue;
      const m = Math.max(2, Math.ceil(((r.t1 - r.t0) * L) / step) + 1);
      const ei = parts[r.k].ei;
      // across the line, on the paper: the tile on both sides means a cut through the tile
      const nxp = ei.a * planes[i][0] + ei.b * planes[i][1], nyp = ei.c * planes[i][0] + ei.d * planes[i][1];
      let run = null;
      const q = [0, 0];
      const flush = () => { if (run && run.x.length >= 4) cuts.push({ part: r.k, edge: i, pts: Float32Array.from(run.x), cells: Uint16Array.from(run.c) }); run = null; };
      for (let j = 0; j < m; j++) {
        const t = r.t0 + ((r.t1 - r.t0) * j) / (m - 1);
        const u = a[0] + t * (b[0] - a[0]), w = a[1] + t * (b[1] - a[1]);
        onPaper(r.k, u, w, q);
        const through = inTile(q[0] + 2e-4 * size * nxp, q[1] + 2e-4 * size * nyp, 0) && inTile(q[0] - 2e-4 * size * nxp, q[1] - 2e-4 * size * nyp, 0);
        if (!through) { flush(); continue; }
        if (!run) run = { x: [], c: [] };
        run.x.push(q[0], q[1]);
        run.c.push(manyHome ? tagFor(r.k, HM.locate(u + inx, w + iny)) : tagFor(r.k, 0));
      }
      flush();
    }
  }

  const cells = tags;                               // (tagFor may still add tags: `cells` is the same array)
  const M = {
    n, xy: Float32Array.from(xs), cell: Uint16Array.from(cs), tri: Uint32Array.from(tri), m: tc.length, triCell: Uint16Array.from(tc),
    cells, root: 0, locate, boundary, boundaryRuns, creases, cuts, bbox: B.bbox ? B.bbox.slice() : bb,
    recut: true,
  };

  // ---- the motion ------------------------------------------------------------------------------------------------
  const tFold = (t) => (t >= 1 ? 1 : (t - tau0) / (1 - tau0));
  const lift3 = (F) => (plainH ? F : (u, w, cell, out) => { F(u, w, cell, out); const x = out[0], y = out[1]; out[0] = h.a * x + h.b * y + h.tx; out[1] = h.c * x + h.d * y + h.ty; return out; });
  const at = (t) => {
    if (!(t > 0)) return IDENTITY;
    if (t < tau0) {
      const M9 = parts.map((p) => carry(p.c, p.moves ? smoother((t - p.from) / (p.to - p.from)) : 0));
      return (x, y, cell, out) => {
        const tg = tags[cell], m = M9[tg ? tg.part : 0];
        out[0] = m[0] * x + m[1] * y + m[2]; out[1] = m[3] * x + m[4] * y + m[5]; out[2] = m[6] * x + m[7] * y + m[8];
        return out;
      };
    }
    const F = lift3(home.at(tFold(t)));
    return (x, y, cell, out) => {
      const tg = tags[cell] || tags[0], e = parts[tg.part].e;
      return F(e.a * x + e.b * y + e.tx, e.c * x + e.d * y + e.ty, tg.home, out);
    };
  };

  const stops = [{ t: 0, label: 'flat' }];
  if (K) stops.push({ t: tau0, label: 're-cut into the ' + H.name });
  for (const s of home.stops) if (s.t > 0 && s.t < 1) stops.push({ t: tau0 + (1 - tau0) * s.t, label: s.label });
  stops.push({ t: 1, label: home.stops[home.stops.length - 1].label });

  // the creases of the home: there once the fold begins, gone as the home fold says
  const T0 = home.times, cw = T0 && Number.isFinite(T0.hingeEnd) && Number.isFinite(T0.halfEnd) && T0.halfEnd > 0.5 * T0.hingeEnd ? [0.5 * T0.hingeEnd, T0.halfEnd] : null;
  const pieces = parts.map((p) => ({ part: p.part, type: p.c.type, text: p.moves ? moveText(p.c) : 'stays', area: p.area, from: p.moves ? p.from : 0, to: p.moves ? p.to : 0, moves: p.moves, travel: p.travel, element: p.g,
    poly: p.reach ? p.reach.map((q) => [q[0], q[1]]) : null }));

  return {
    mesh: M, type: 'recut', stops, duration,
    at,
    /** The double line of the home fold, from the moment stage 2 begins. */
    doubleLine(t) {
      if (!(t >= tau0) || typeof home.doubleLine !== 'function') return [];
      const L = home.doubleLine(tFold(t));
      const lines = ArrayBuffer.isView(L) ? [L] : Array.isArray(L) ? L : [];
      if (plainH) return lines;
      return lines.map((ln) => { const o = Float32Array.from(ln); for (let i = 0; i + 2 < o.length; i += 3) { const x = o[i], y = o[i + 1]; o[i] = h.a * x + h.b * y + h.tx; o[i + 1] = h.c * x + h.d * y + h.ty; } return o; });
    },
    anchor: an,
    foldFrom: tau0,
    recut: {
      home: { name: H.name, element: h, poly: P.map((p) => [h.a * p[0] + h.b * p[1] + h.tx, h.c * p[0] + h.d * p[1] + h.ty]) },
      pieces, movers: K, tau0, seconds: recutSeconds, foldSeconds,
    },
    /** Opacity of the home's creases at t: none before the fold begins, then as the home fold has them. */
    creaseAlpha(t) {
      if (!(t > tau0)) return 0;
      const f = tFold(t), fadeIn = smooth(f / 0.03);
      return cw ? fadeIn * (1 - smooth((f - cw[0]) / (cw[1] - cw[0]))) : fadeIn * (1 - smooth((f - 0.2) / 0.27));
    },
    /**
     * How the cut lines are drawn at t: { alpha, width (1 = a thin line), dashed }. On the flat tile: dashed, where it
     * will be cut. While the pieces move and until the home's seams close: the pieces' own edges. Folded up, the home's
     * rim lies on the double line: thin and faint.
     */
    cutStyle(t) {
      if (!(t > 0)) return { alpha: 0.9, width: 1, dashed: true };
      const open = K ? smooth(t / (0.04 * tau0 + 1e-9)) : 1;
      const shut = t >= tau0 ? smooth((tFold(t) - 0.82) / 0.18) : 0;
      return { alpha: 0.9 - 0.5 * shut, width: 1 + 0.6 * open * (1 - shut), dashed: open < 0.5 || shut > 0.5 };
    },
    /** Where the motion is at t: { stage: 'flat' | 'recut' | 'fold' | 'closed', piece (1-based), of, text }. */
    stage(t) {
      if (!(t > 0)) return { stage: 'flat', piece: 0, of: K, text: '' };
      if (t >= 1) return { stage: 'closed', piece: 0, of: K, text: '' };
      if (t < tau0) {
        let i = movers.findIndex((p) => t < p.to);
        if (i < 0) i = K - 1;
        return { stage: 'recut', piece: i + 1, of: K, text: moveText(movers[i].c), part: movers[i].part };
      }
      return { stage: 'fold', piece: 0, of: K, text: '' };
    },
    homeFold: home, base, times: T0 || null, frame: home.frame || null,
  };
}
