// scene.js — one surface for the renderer, assembled from PARTS whose vertices move while a zipper closes.
//
// A Scene owns a vertex count, a triangle list and a list of update functions. Building a part allocates its
// vertices, pushes its triangles (a part may use another part's vertices along a shared rim, so a tube foot and the
// hole it grows from are welded) and registers a function that writes the part's positions for the current state.
//
//   const S = new Scene();
//   const cell = addCell(S, {...});  addTubeHalf(S, {...});  addCrosscap(S, {...});
//   const { positions, indices } = S.finish();      // first full update, boundary welds applied
//   S.update()  -> positions                        // every animation frame
//   S.lines()   -> line specs for R.setLines        // built from the CURRENT positions, so rims ride the mesh
//
// Conventions (the renderer's): a triangle's FRONT is the side from which it is counter-clockwise. Cells are wound
// so the front is the outside of the body (the top of the flat patch). A tube half is wound to continue the cell it
// grows from; on a cross-handle the two halves therefore meet front to back, which is the whole point.

import { cross, sub, norm, dot, add, scale, addScaled, len } from './vec.js';

export class Scene {
  constructor() {
    this.count = 0;
    this.tris = [];
    this.updaters = [];
    this.lineFns = [];
    this.markerFns = [];
    this.weldRings = [];        // vertex indices to weld by position after the first update
    this.positions = null;
    this.indices = null;
  }
  alloc(n) { const base = this.count; this.count += n; return base; }
  tri(a, b, c) { this.tris.push(a, b, c); }
  quad(a, b, c, d) { this.tris.push(a, b, c, a, c, d); }
  onUpdate(fn) { this.updaters.push(fn); }
  addLines(fn) { this.lineFns.push(fn); }
  addMarkers(fn) { this.markerFns.push(fn); }
  weld(indices) { for (const i of indices) this.weldRings.push(i); }

  finish() {
    this.positions = new Float32Array(3 * this.count);
    this.update();
    const idx = Uint32Array.from(this.tris);
    if (this.weldRings.length) {
      const seen = new Map(), map = new Map();
      const P = this.positions;
      for (const i of this.weldRings) {
        const key = Math.round(P[3 * i] * 1e5) + ',' + Math.round(P[3 * i + 1] * 1e5) + ',' + Math.round(P[3 * i + 2] * 1e5);
        if (seen.has(key)) map.set(i, seen.get(key)); else seen.set(key, i);
      }
      if (map.size) for (let k = 0; k < idx.length; k++) { const m = map.get(idx[k]); if (m !== undefined) idx[k] = m; }
    }
    this.indices = idx;
    return { positions: this.positions, indices: this.indices };
  }
  update() {
    const P = this.positions;
    for (const fn of this.updaters) fn(P);
    return P;
  }
  point(i) { const P = this.positions; return [P[3 * i], P[3 * i + 1], P[3 * i + 2]]; }
  lines() { const out = []; for (const fn of this.lineFns) { const r = fn(this); if (Array.isArray(r)) out.push(...r); else if (r) out.push(r); } return out; }
  markers() { const out = []; for (const fn of this.markerFns) { const r = fn(this); if (Array.isArray(r)) out.push(...r); else if (r) out.push(r); } return out; }
}

const TAU = 2 * Math.PI;
const mod = (a, n) => ((a % n) + n) % n;

// ---------------------------------------------------------------------------------------------------------------
// A CELL: the piece of the bare sheet round one site, from its hole rim out to the cell's boundary.
//   boundary  n world points, counter-clockwise seen from outside, sample j roughly in the chart direction 2 pi j / n
//   Rs        the footprint radius: inside it the grid is radial in the site's chart
//   hole(j, theta, out)  writes the chart point (x, y) of rim sample j into out; called on every update, so a hole can
//             close, pinch or grow. A cell with no hole returns (0, 0).
export function addCell(scene, { site, boundary, Rs, ni = 4, no = 3, hole }) {
  const n = boundary.length, rings = ni + no + 1, base = scene.alloc(rings * n);
  const idx = (i, j) => base + i * n + mod(j, n);
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < n; j++) scene.quad(idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1));
  const h = [0, 0];
  scene.onUpdate((P) => {
    for (let j = 0; j < n; j++) {
      const th = (TAU * j) / n, fx = Rs * Math.cos(th), fy = Rs * Math.sin(th);
      hole(j, th, h);
      for (let i = 0; i <= ni; i++) { const w = i / ni; site.toWorld(h[0] + (fx - h[0]) * w, h[1] + (fy - h[1]) * w, 0, P, 3 * idx(i, j)); }
      const k0 = 3 * idx(ni, j), foot = [P[k0], P[k0 + 1], P[k0 + 2]];
      for (let k = 1; k <= no; k++) { const p = site.blend(foot, boundary[j], k / no); P[3 * idx(ni + k, j)] = p[0]; P[3 * idx(ni + k, j) + 1] = p[1]; P[3 * idx(ni + k, j) + 2] = p[2]; }
    }
  });
  const ring = [];
  for (let j = 0; j < n; j++) ring.push(idx(rings - 1, j));
  scene.weld(ring);
  return { n, site, rim: (j) => idx(0, j), edge: (j) => idx(rings - 1, j) };
}

export const noHole = (j, th, out) => { out[0] = 0; out[1] = 0; };
export const roundHole = (r) => (j, th, out) => { const rr = typeof r === 'function' ? r() : r; out[0] = rr * Math.cos(th); out[1] = rr * Math.sin(th); };

// ---------------------------------------------------------------------------------------------------------------
// HALF A TUBE, growing from a hole rim along a centre line. Two halves meet at the arc length `meet`: the zip.
//   curve     bezierChain; W the unit normal of the plane it lies in (ring angle psi runs from U = W x T toward W)
//   rt, f     tube radius and the radius of the fillet where the tube flares into the sheet (hole radius = rt + f)
//   from      'A': grows from arc length 0 up to `meet`; 'B': from curve.length down to `meet`
//   foot(c)   vertex index of the hole rim under column c (the cell's rim sample that ring angle 2 pi c / n lands on)
//   grow()    0 .. 1, how far the half has grown
//   orient    +1: front = (d/dpsi) x (d/dring); -1 the other side. Chosen by the caller to continue the cell.
//   end       optional (c) -> { psi, back }: at the meeting end column c sits at ring angle psi (instead of 2 pi c / n)
//             and stops `back` short of the meeting point. That leaves an eyelet where part of a rim is not zipped
//             (the gaping cases, Figures 8.8 and 8.9); the columns turn and shorten gradually along the tube.
export function addTubeHalf(scene, { curve, W, rt, f, n, m = 14, nf = 5, from, meet, foot, grow, orient = 1, open = null, end = null }) {
  const L = curve.length, s0 = from === 'A' ? 0 : L, span = from === 'A' ? meet : meet - L, half = Math.abs(span);
  const w = [0];
  for (let k = 1; k <= nf; k++) w.push((f * (1 - Math.cos((Math.PI / 2) * (k / nf)))) / half);
  for (let k = nf + 1; k <= m; k++) w.push((f + ((half - f) * (k - nf)) / (m - nf)) / half);
  const base = scene.alloc(m * n);
  const idx = (k, c) => (k === 0 ? foot(mod(c, n)) : base + (k - 1) * n + mod(c, n));
  for (let k = 0; k < m; k++) for (let c = 0; c < n; c++) {
    const a = idx(k, c), b = idx(k, c + 1), d = idx(k + 1, c + 1), e = idx(k + 1, c);
    if (orient > 0) { scene.tri(a, b, d); scene.tri(a, d, e); } else { scene.tri(a, d, b); scene.tri(a, e, d); }
  }
  const flare = (z) => (z < f ? f - Math.sqrt(Math.max(0, f * f - (f - z) * (f - z))) : 0);
  const ends = end ? Array.from({ length: n }, (_, c) => { const e = end(c), p0 = (TAU * c) / n; let d = e.psi - p0; d -= TAU * Math.round(d / TAU); return { d, back: e.back || 0 }; }) : null;
  const dirSign = span >= 0 ? 1 : -1;
  scene.onUpdate((P) => {
    const g = Math.min(1, Math.max(0, grow())), o = open ? open() : 1;   // o < 1: the hole is still opening, the tube is thinner
    for (let k = 1; k <= m; k++) {
      const sk = s0 + span * g * w[k], along = w[k] * w[k];
      let frame = ends ? null : curve.at(sk);
      for (let c = 0; c < n; c++) {
        let s = sk, psi = (TAU * c) / n;
        if (ends) { s = sk - dirSign * ends[c].back * along * along * g; psi += ends[c].d * along; frame = curve.at(s); }
        const { p, t } = frame, U = cross(W, t), rho = o * (rt + flare(s) + flare(L - s));
        const cu = rho * Math.cos(psi), cw = rho * Math.sin(psi), q = 3 * idx(k, c);
        P[q] = p[0] + cu * U[0] + cw * W[0]; P[q + 1] = p[1] + cu * U[1] + cw * W[1]; P[q + 2] = p[2] + cu * U[2] + cw * W[2];
      }
    }
  });
  return { n, end: (c) => idx(m, c), ring: (k, c) => idx(k, c), m };
}

// ---------------------------------------------------------------------------------------------------------------
// A CROSSCAP in the making: the collar of sheet round a hole, whose rim rises and is zipped to itself crosswise.
// Chart point of (t, theta), t = 0 the rim being zipped, t = 1 the cell's rim at radius rc:
//   open  (e = 0):  radius rh + (rc - rh) t, height 0                       a flat collar round a hole of radius rh
//   shut  (e = 1):  radius rc t, height (1 - t^2)^2 (H + k cos 2 theta)     the cross-cap: the rim lies on the vertical
//                   segment from H - k to H + k, each point of it met by FOUR rim points (two zipped pairs, crossing)
// In between the two are blended; the surface is a graph over the sheet until the last instant, when it meets itself.
export function addCrosscap(scene, { site, rc, rh, H, k, n, m = 14, rim, progress, axis = 0, open = null }) {
  const base = scene.alloc(m * n);
  const idx = (i, j) => (i === m ? rim(mod(j, n)) : base + i * n + mod(j, n));
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) scene.quad(idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1));
  scene.onUpdate((P) => {
    const e = Math.min(1, Math.max(0, progress())), r0 = rh * (open ? open() : 1);
    for (let i = 0; i < m; i++) {
      const t = i / m, g = Math.pow(1 - t * t, 1.6), rad = (1 - e) * (r0 + (rc - r0) * t) + e * rc * t;
      for (let j = 0; j < n; j++) {
        const th = (TAU * j) / n;
        site.toWorld(rad * Math.cos(th), rad * Math.sin(th), e * g * (H + k * crossProfile(th - axis)), P, 3 * idx(i, j));
      }
    }
  });
  return { n, seam: (j) => idx(0, j), ring: (i, j) => idx(i, j) };
}

/**
 * Height of the crosscap's seam in the chart direction th, from +1 (th = 0 or pi: the top of the crossing segment)
 * to -1 (th = +-pi/2: its bottom). cos 2 th would do; this one stays high over a wider fan of directions, so the two
 * lobes are full and the cleft between them is narrow, as in the book's drawing. Even and pi-periodic, as it must be:
 * th, -th, th + pi and pi - th land on the same point of the segment (two zipped pairs, crossing).
 */
export function crossProfile(th) { return 1 - 2 * Math.pow(Math.abs(Math.sin(th)), 3.2); }

// ---------------------------------------------------------------------------------------------------------------
// Lines that ride the mesh.

/** The polyline through ring(c) for c = c0 .. c1 (c1 may exceed n: it wraps), as a Float32Array for setLines. */
export function ringPoints(scene, ring, n, c0, c1) {
  const out = new Float32Array(3 * (c1 - c0 + 1)), P = scene.positions;
  for (let c = c0, o = 0; c <= c1; c++, o += 3) { const i = 3 * ring(mod(c, n)); out[o] = P[i]; out[o + 1] = P[i + 1]; out[o + 2] = P[i + 2]; }
  return out;
}

/**
 * An arrowhead on the ring at sample cm, pointing along the ring (sense +1: toward larger c). Its two barbs lie in
 * the plane of the ring's tangent and of `side`, the direction from the ring's centroid to the sample.
 * Returns null where the ring has collapsed (a zipped rim has no room for an arrow).
 */
export function chevron(scene, ring, n, cm, sense, size) {
  const p = scene.point(ring(mod(cm, n))), a = scene.point(ring(mod(cm - 1, n))), b = scene.point(ring(mod(cm + 1, n)));
  let t = sub(b, a);
  if (len(t) < 1e-6) return null;
  t = scale(norm(t), sense);
  const c = [0, 0, 0];
  for (let j = 0; j < n; j++) { const q = scene.point(ring(j)); c[0] += q[0] / n; c[1] += q[1] / n; c[2] += q[2] / n; }
  let side = sub(p, c);
  side = sub(side, scale(t, dot(side, t)));
  if (len(side) < 0.25 * size) return null;
  side = norm(side);
  const tip = addScaled(p, t, 0.55 * size), back = addScaled(p, t, -0.45 * size);
  const b1 = addScaled(back, side, 0.5 * size), b2 = addScaled(back, side, -0.5 * size);
  return Float32Array.from([...b1, ...tip, ...b2]);
}

export { TAU, mod, add };
