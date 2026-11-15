// scratch-core-sdf/scene.mjs — what a caller of bakeSDF does: the copies of a kit motif that reach one lattice cell.
// (The SDF agent's own scratch: the print module of the round has its own, real version of this.)
import { orbitElements } from '../kit.js';

/** The cell of the group that is centred on its view centre. */
export function cellOf(group) {
  const { e1, e2, center } = group;
  return { origin: [center[0] - (e1[0] + e2[0]) / 2, center[1] - (e1[1] + e2[1]) / 2], e1: e1.slice(), e2: e2.slice() };
}

/** Every copy g(P) of the motif N (kit.normalize) that can come within `range` of the cell. Mirrored copies keep the motif's order of points. */
export function cellPolys(group, N, cell, range) {
  const { origin, e1, e2 } = cell;
  const xs = [origin[0], origin[0] + e1[0], origin[0] + e2[0], origin[0] + e1[0] + e2[0]];
  const ys = [origin[1], origin[1] + e1[1], origin[1] + e2[1], origin[1] + e1[1] + e2[1]];
  const box = [Math.min(...xs) - range, Math.min(...ys) - range, Math.max(...xs) + range, Math.max(...ys) + range];
  const polys = [];
  for (const g of orbitElements(group, N, box)) {
    for (const P of N.polys) {
      const n = P.pts.length / 2, pts = new Float64Array(2 * n);
      for (let i = 0; i < n; i++) {
        const x = P.pts[2 * i], y = P.pts[2 * i + 1];
        pts[2 * i] = g.a * x + g.b * y + g.tx; pts[2 * i + 1] = g.c * x + g.d * y + g.ty;
      }
      polys.push({ pts, hole: P.hole });
    }
  }
  return polys;
}

export const edgesOf = (polys) => polys.reduce((s, P) => s + P.pts.length / 2, 0);

/** The synthetic scene of test/sdf.test.js's speed test: 64 wobbly blobs of 94 edges in the unit cell. */
export function blobs() {
  let a = 4242 >>> 0;
  const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const polys = [], TAU = 2 * Math.PI;
  for (let b = 0; b < 64; b++) {
    const cx = ((b % 8) + 0.5 + 0.2 * (rnd() - 0.5)) / 8, cy = (Math.floor(b / 8) + 0.5 + 0.2 * (rnd() - 0.5)) / 8;
    const n = 94, ph = rnd() * TAU, lobes = 2 + Math.floor(rnd() * 4), amp = 0.1 + 0.25 * rnd(), pts = new Float64Array(2 * n);
    for (let k = 0; k < n; k++) { const t = (TAU * k) / n, r = 0.045 * (1 + amp * Math.cos(lobes * t + ph)); pts[2 * k] = cx + r * Math.cos(t); pts[2 * k + 1] = cy + r * Math.sin(t); }
    polys.push({ pts, hole: false });
  }
  return polys;
}
