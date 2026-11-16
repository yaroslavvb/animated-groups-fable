// tiling3d.js — the PATTERN in the 3D pane: the copies of the tile round it, made and gathered as the plane makes them
// (15 Nov 2026). Pure: no DOM, no WebGL; src/app.js hands what it computes to the renderer.
//
// The owner, 15 Nov 2026: "Normally, the folded part is just the surface, but here [*632] there is a bit of confusion
// about which part lies in the folding and which part lies in the tiling. Unify those two. Also, maybe the Unfold and
// Tile buttons should be in the same place so I can first unfold and then tile."
//
// So the 3D pane shows the whole journey of src/journey.js in one view: the surface unfolds into the flat tile (the
// fold modules), and then the tile makes its copies round it IN THE SAME VIEW — the same copies, at the same moments,
// as the plane's tiling (the plan of src/replicate.js, read from the plane: P.getPlan()). Each copy comes out of its
// parent by the rigid motion of SPACE whose view from above the plane draws:
//   translation   slides over the paper                        (a hair above it: OVER)
//   rotation      turns about its centre, over the paper       (the same)
//   reflection    turns over its mirror line, UNDER the paper: a half-turn of space about the line — it hangs below
//                 the plane half way and comes up on the far side with its BACK up (the sand side)
//   glide         a half screw about its axis, UNDER the paper too: the half-turn while it slides along the axis — and,
//                 because its tile lies on both sides of the axis (half of it would rise through the paper), it sinks
//                 by its own half-width while it turns and comes back up as it lands (a turn and a shift: rigid)
// A kaleidoscope's pattern therefore unfolds from its tile like a paper snowflake, and folds back onto it, with the
// very motion of every other group's tiling: what is folded is always the tile alone, the copies are always the
// pattern.
//
// The paper's colours need nothing here: the renderer paints a sheet by the side the eye sees (front teal, back sand),
// and a copy that was turned over lies with its back up. Every copy is the paper itself, in its full tones, as the
// tile is (a paler copy sliding off the tile would wash the tile out while it leaves: the owner's page comments of 13
// Nov 2026 on the plane's cards); the tile is known among them by its bold edges and its marked points.
//
//   tilingPatch(plan, centre, radius, limits)    which copies of the plan the 3D pane shows: a round patch about the tile
//   buildTiling3D(group, domain, plan, opts)     -> T: the mesh of all those copies (positions for mapTiling3D to fill)
//   mapTiling3D(T, u)                            fills T.pos, the outlines' points and T.frame for the progress u
//   copyPlace(plan, c, tau, size)                where one copy is at time tau: null (not made yet) or
//                                                { A, kind, s, axis, lift }; placePoint(pl, x, y, out) -> [X, Y, Z]

import { buildMesh } from './mesh.js';
import { copyState } from './replicate.js';

/**
 * What the 3D pane shows of the plan: the copies whose centre lies within `reach` tile radii of the tile's centre — a
 * round patch, so the tile stays readable when the camera has backed off to hold it — and at most `copies` of them
 * (a smaller patch if there are more). `near`: copies this many tile radii away or nearer are always shown (the tile's
 * own neighbours).
 */
export const T3_LIMITS = Object.freeze({ copies: 64, reach: 4.4, near: 2.1 });
/** How high a copy that turns or slides over the paper is lifted while it moves, in tile sizes (sqrt of the area). */
export const OVER = 0.014;
/** Copies that move at once are lifted to slightly different heights (this share more per step, 5 steps): no two coplanar. */
const OVER_STEP = 0.22;
/**
 * A copy is in the picture once its motion has come this far (eased s; about 2 % of its time): before that it lies on
 * its parent to within a hair, and a second sheet on the same spot only makes the nearly opaque paper denser there.
 */
export const START_S = 1e-4;
/** A copy's outline is drawn with every LINE_STEP-th boundary sample of the tile (and each edge's last). */
const LINE_STEP = 3;
/** The mesh of a copy: mesh.js densities for a tile that stays flat (a kaleidoscope cell's N; the roll groups' grid). */
export const COPY_DENSITY = Object.freeze({ kaleido: 4, grid: 8 });

/**
 * The copies of the plan in the 3D pane's patch (the tile first, then in the plan's order): every copy the window's
 * layers hold (c.phase >= 0) whose centre is within the patch's radius AND whose parent is in the patch too (a copy
 * comes out of its parent: without it there is nothing for it to come out of). The radius is `reach` tile radii, less
 * when that holds more than `copies` copies (never less than `near`).
 */
export function tilingPatch(plan, centre, radius, limits = T3_LIMITS) {
  const dist = new Float64Array(plan.copies.length);
  for (const c of plan.copies) {
    const g = c.g, x = g.a * centre[0] + g.b * centre[1] + g.tx, y = g.c * centre[0] + g.d * centre[1] + g.ty;
    dist[c.index] = Math.hypot(x - centre[0], y - centre[1]);
  }
  const within = (rho) => {
    const inPatch = new Uint8Array(plan.copies.length), out = [];
    for (const c of plan.copies) {                              // (parents come before their children in the plan)
      if (c.index === 0) { inPatch[0] = 1; out.push(c); continue; }
      if (c.phase < 0 || !inPatch[c.parent] || dist[c.index] > rho * radius + 1e-9) continue;
      inPatch[c.index] = 1; out.push(c);
    }
    return out;
  };
  let rho = limits.reach, list = within(rho);
  for (let i = 0; i < 24 && list.length > limits.copies + 1 && rho > limits.near; i++) { rho = Math.max(limits.near, rho * 0.94); list = within(rho); }
  return list;
}

/**
 * Where the copy c of the plan is at time tau (seconds): null before it is made (its phase has not begun, or it has
 * not left its parent yet: START_S), else
 *   { A, kind, s, lift, axis }
 *   A      the affine map (tile -> plane) that is its view from above: its own element once it has landed, parent ∘ m(s)
 *          on its way (replicate.js copyState)
 *   kind   'rest' (landed), 'over' (a turn or a slide: it moves in the plane, lifted by `lift`), 'under' (a
 *          reflection or a glide: it turns about `axis`, below the plane)
 *   s      how far its motion has come (eased), 0 .. 1
 *   axis   for 'under': { px, py, nx, ny, dip } in TILE coordinates — a point of the mirror line / glide axis and
 *          the unit normal n. The height of the tile point q, d = (q - p) . n from the axis, is
 *            a mirror   -sin(π s) |d|          (its tile lies on one side of the line: all of it goes down)
 *            a glide    -sin(π s) (d + dip)    dip = dipOf(motion) >= the tile's largest |d|: the half-turn about the
 *                                              axis, sunk by dip sin(π s), so no part of it rises through the paper
 *   dipOf  (motion) -> that dip for a glide (buildTiling3D measures it on the tile); none: 0, the bare half screw
 */
export function copyPlace(plan, c, tau, size = 1, dipOf = null) {
  const st = copyState(plan, c, tau);
  if (st.phase === 'hidden' || (st.phase === 'moving' && !(st.s > START_S))) return null;
  if (st.phase !== 'moving') return { A: c.g, kind: 'rest', s: 1, lift: 0, axis: null };
  const m = c.motion;
  if (m.kind === 'reflection' || m.kind === 'glide') {
    const ax = m.axis, h = plan.copies[c.parent].g;
    // the axis as the plane has it: its direction made to point right (or straight up), so that the sense of the
    // half-turn does not depend on how the side pairing happens to be written
    let ux = h.a * ax.u[0] + h.b * ax.u[1], uy = h.c * ax.u[0] + h.d * ax.u[1];
    if (ux < -1e-9 || (Math.abs(ux) <= 1e-9 && uy < 0)) { ux = -ux; uy = -uy; }
    const wx = -uy, wy = ux;                                   // the plane's normal to it
    // ... pulled back to tile coordinates: d_plane(q) = (h(q) - h(p)) . w = (q - p) . (h_lin^T w)
    const nx = h.a * wx + h.c * wy, ny = h.b * wx + h.d * wy;
    return { A: st.A, kind: 'under', s: st.s, lift: 0, axis: { px: ax.p[0], py: ax.p[1], nx, ny, dip: m.kind === 'glide' ? (dipOf ? dipOf(m) : 0) : -1 } };
  }
  // a turn or a slide: over the paper, each copy at its own small height (two that cross are never coplanar)
  const bump = Math.sin(Math.PI * st.s);
  return { A: st.A, kind: 'over', s: st.s, lift: OVER * size * (1 + OVER_STEP * (c.index % 5)) * Math.sqrt(bump > 0 ? bump : 0), axis: null };
}

/** The point of space where the placement pl puts the tile point (x, y). */
export function placePoint(pl, x, y, out = [0, 0, 0]) {
  const A = pl.A;
  out[0] = A.a * x + A.b * y + A.tx;
  out[1] = A.c * x + A.d * y + A.ty;
  if (pl.kind === 'under') {
    const ax = pl.axis, d = (x - ax.px) * ax.nx + (y - ax.py) * ax.ny;
    out[2] = -Math.sin(Math.PI * pl.s) * (ax.dip < 0 ? Math.abs(d) : d + ax.dip);
  } else out[2] = pl.lift;
  return out;
}

/**
 * The mesh of the pattern for the 3D pane: the tile (copy 0) and the copies of `plan` in a round patch about it
 * (tilingPatch), every one a copy of ONE flat mesh of the tile.
 *   opts.limits   T3_LIMITS overrides
 *   opts.edges    the tile's boundary edge by edge: [{ edge, mirror, color, pts: Float32Array(2k) }] (src/app.js
 *                 buildScene's scene.edges); the copies' outlines are made of every LINE_STEP-th point of them
 * -> T = {
 *   plan, layers, copies: [the plan's copies shown, the tile first], nv (vertices of one copy), n, m,
 *   pos: Float32Array(3 n), tri: Uint32Array(3 m), uv: Float32Array(2 n) (every vertex's point of the paper),
 *   outlines: [{ copy (index into copies), edge, mirror, color, pts, out: Float32Array(3k), shown, moving, under, depth }],
 *   centre, radius (the tile's), size, frame, shown (how many copies are in the picture), u
 * }
 */
export function buildTiling3D(group, domain, plan, opts = {}) {
  const limits = { ...T3_LIMITS, ...(opts.limits || {}) };
  const mesh = buildMesh(group, domain, { density: group.kaleido ? COPY_DENSITY.kaleido : COPY_DENSITY.grid });
  const nv = mesh.n, mt = mesh.tri.length / 3, xy = mesh.xy;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let v = 0; v < nv; v++) { const x = xy[2 * v], y = xy[2 * v + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const centre = [(x0 + x1) / 2, (y0 + y1) / 2];
  let radius = 0;
  for (let v = 0; v < nv; v++) radius = Math.max(radius, Math.hypot(xy[2 * v] - centre[0], xy[2 * v + 1] - centre[1]));
  const size = Math.sqrt(group.domainArea);
  const copies = tilingPatch(plan, centre, radius, limits);
  const layers = copies.reduce((k, c) => Math.max(k, c.depth), 0);
  const K = copies.length, n = K * nv, m = K * mt;
  const pos = new Float32Array(3 * n), tri = new Uint32Array(3 * m), uv = new Float32Array(2 * n);
  for (let k = 0; k < K; k++) {
    const b = k * nv;
    uv.set(xy.length === 2 * nv ? xy : xy.subarray(0, 2 * nv), 2 * b);
    for (let i = 0, o = 3 * k * mt; i < 3 * mt; i++) tri[o + i] = mesh.tri[i] + b;
  }
  // the copies' outlines: the tile's edges, thinned
  const edges = [];
  for (const e of opts.edges || []) {
    const p = e.pts, k = p.length >> 1;
    if (k < 2) continue;
    const idx = [];
    for (let i = 0; i < k; i += LINE_STEP) idx.push(i);
    if (idx[idx.length - 1] !== k - 1) idx.push(k - 1);
    const pts = new Float32Array(2 * idx.length);
    idx.forEach((i, j) => { pts[2 * j] = p[2 * i]; pts[2 * j + 1] = p[2 * i + 1]; });
    edges.push({ edge: e.edge, mirror: !!e.mirror, color: e.color, pts });
  }
  const outlines = [];
  for (let k = 1; k < K; k++) for (const e of edges) outlines.push({ copy: k, edge: e.edge, mirror: e.mirror, color: e.color, pts: e.pts, out: new Float32Array(3 * (e.pts.length >> 1)), shown: false, moving: false, under: false, depth: copies[k].depth });
  // a glide's copy sinks by the tile's half-width across its axis while it turns (copyPlace): measured per side pairing
  const dips = new Map();
  for (const c of copies) {
    const mo = c.motion;
    if (!mo || mo.kind !== 'glide' || dips.has(mo)) continue;
    const ax = mo.axis, nx = -ax.u[1], ny = ax.u[0];
    let h = 0;
    for (let v = 0; v < nv; v++) h = Math.max(h, Math.abs((xy[2 * v] - ax.p[0]) * nx + (xy[2 * v + 1] - ax.p[1]) * ny));
    dips.set(mo, h);
  }
  const dipOf = (mo) => dips.get(mo) || 0;
  return { group, plan, layers, copies, nv, n, m, pos, tri, uv, xy, outlines, centre, radius, size, dipOf, frame: null, shown: 0, u: -1 };
}

/**
 * The pattern at progress u (replicate.js's u: 0 the tile alone, 1 every copy made): fills T.pos, every outline's
 * `out` (and whether it is in the picture, on its way, under the paper) and T.frame = the bounding sphere of what is
 * shown. A copy that is not made yet is drawn as nothing: all its vertices on one point of the tile.
 */
export function mapTiling3D(T, u) {
  const { plan, copies, nv, pos, xy, size, dipOf } = T;
  const tau = Math.max(0, Math.min(1, u)) * plan.T, out = [0, 0, 0];
  const places = new Array(copies.length);
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity, shown = 0;
  const hx = T.centre[0], hy = T.centre[1];
  for (let k = 0; k < copies.length; k++) {
    const c = copies[k], pl = c.index === 0 ? REST0 : copyPlace(plan, c, tau, size, dipOf);
    places[k] = pl;
    let o = 3 * k * nv;
    if (!pl) { for (let v = 0; v < nv; v++, o += 3) { pos[o] = hx; pos[o + 1] = hy; pos[o + 2] = 0; } continue; }
    shown++;
    for (let v = 0; v < nv; v++, o += 3) {
      placePoint(pl, xy[2 * v], xy[2 * v + 1], out);
      const X = out[0], Y = out[1], Z = out[2];
      pos[o] = X; pos[o + 1] = Y; pos[o + 2] = Z;
      if (X < x0) x0 = X; if (X > x1) x1 = X;
      if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
      if (Z < z0) z0 = Z; if (Z > z1) z1 = Z;
    }
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
  let r2 = 0;
  for (let k = 0; k < copies.length; k++) {
    if (!places[k]) continue;
    for (let v = 0, o = 3 * k * nv; v < nv; v++, o += 3) {
      const dx = pos[o] - cx, dy = pos[o + 1] - cy, dz = pos[o + 2] - cz, d = dx * dx + dy * dy + dz * dz;
      if (d > r2) r2 = d;
    }
  }
  T.frame = { center: [cx, cy, cz], radius: Math.sqrt(r2) || T.radius };
  for (const L of T.outlines) {
    const pl = places[L.copy];
    L.shown = !!pl;
    if (!pl) continue;
    L.moving = pl.kind !== 'rest'; L.under = pl.kind === 'under';
    const p = L.pts, q = L.out;
    for (let i = 0, k = p.length >> 1; i < k; i++) { placePoint(pl, p[2 * i], p[2 * i + 1], out); q[3 * i] = out[0]; q[3 * i + 1] = out[1]; q[3 * i + 2] = out[2]; }
  }
  T.shown = shown; T.u = u;
  return T;
}
const REST0 = Object.freeze({ A: Object.freeze({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }), kind: 'rest', s: 1, lift: 0, axis: null });
