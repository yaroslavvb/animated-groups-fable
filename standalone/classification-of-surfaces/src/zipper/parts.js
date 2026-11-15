// parts.js — the moving pieces of tab 3 (Zip it up), each built on the Scene of geo/scene.js.
//
//   addCornerPoly   a flat polygon given by its corners (which may move): the pieces before any self-zip
//   addInflate      Figure 8.1: a polygon is a disc is a sphere with a hole. The flat piece bulges into a dome,
//                   closes round a ball and rolls over until its rim, now the rim of a small hole, faces you
//   addPurse        a hole whose two zips are mirror images closes like a purse; arcs of rim that are NOT zipped
//                   (the "gaps" of Figure 8.6) are left as small eyelets at the ends of the seam
//   addStrap        a hole whose two zips run the same way but with rim left between them (Figure 8.7): two flaps
//                   grow from the two lips and meet over the hole, each having turned a quarter turn. A hole with a
//                   half-twisted strap across it is a crosscap with a hole beside it: a punched Moebius band

import { addCell } from '../geo/scene.js';
import { cross, norm, rotate, smooth } from '../geo/vec.js';

const TAU = 2 * Math.PI;
const mod = (a, n) => ((a % n) + n) % n;

/** Corners of the flat picture of a word of m edges: a regular m-gon, edge 0 on top, listed clockwise. */
export function regularCorners(m, R) {
  if (m >= 3) return { pts: Array.from({ length: m }, (_, i) => { const a = Math.PI / 2 + Math.PI / m - (TAU * i) / m; return [R * Math.cos(a), R * Math.sin(a)]; }), per: 1 };
  const C = 24, per = C / m;     // one or two edges: a round disc
  return { pts: Array.from({ length: C }, (_, i) => { const a = Math.PI / 2 + Math.PI / Math.max(m, 1) - (TAU * i) / C; return [0.8 * R * Math.cos(a), 0.8 * R * Math.sin(a)]; }), per };
}

/**
 * A flat polygon in the plane of `site`. corners() -> array of [x, y] (closed, clockwise seen from the front);
 * K samples along each side; hub() -> [x, y], the point the fan is drawn from (the corners must be visible from it).
 * Word edge k of m lies on fractions [k / m, (k + 1) / m] of the ring.
 */
export function addCornerPoly(scene, { site, corners, K = 10, hub = () => [0, 0], rings = 3 }) {
  const C = corners().length, n = C * K, base = scene.alloc((rings + 1) * n);
  const idx = (i, j) => base + i * n + mod(j, n);
  for (let i = 0; i < rings; i++) for (let j = 0; j < n; j++) {
    const a = idx(i, j), b = idx(i + 1, j), c = idx(i + 1, j + 1), d = idx(i, j + 1);
    scene.tri(a, c, b); scene.tri(a, d, c);            // samples run clockwise: wound so the front is on top
  }
  scene.onUpdate((P) => {
    const cs = corners(), h = hub();
    for (let j = 0; j < n; j++) {
      const i = Math.floor(j / K), t = (j % K) / K, p = cs[i], q = cs[(i + 1) % C];
      const x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t;
      for (let r = 0; r <= rings; r++) { const w = r / rings; site.toWorld(h[0] + (x - h[0]) * w, h[1] + (y - h[1]) * w, 0, P, 3 * idx(r, j)); }
    }
  });
  return { n, ring: (j) => idx(rings, j) };
}

/**
 * Figure 8.1 as a motion. progress() 0: the flat m-gon of radius R at `center`; 1: the ball of radius R at
 * `center` with a hole of chart radius rh at the site (frame n0, e1, e2), its rim sample f * n exactly where the
 * ball's hole rim sample is. In between: caps of spheres, the pole turning from "up" to the far side of the ball.
 */
export function addInflate(scene, { center, R, m, n0, e1, e2, rh, n = 120, rings = 30, progress }) {
  const base = scene.alloc((rings + 1) * n);
  const idx = (i, j) => base + i * n + mod(j, n);
  for (let i = 0; i < rings; i++) for (let j = 0; j < n; j++) {
    const a = idx(i, j), b = idx(i + 1, j), c = idx(i + 1, j + 1), d = idx(i, j + 1);
    scene.tri(a, c, b); scene.tri(a, d, c);
  }
  const p1 = [-n0[0], -n0[1], -n0[2]], Z = [0, 0, 1];
  let axis = cross(Z, p1);
  const sA = Math.hypot(axis[0], axis[1], axis[2]), theta = Math.atan2(sA, p1[2]);
  axis = sA > 1e-6 ? [axis[0] / sA, axis[1] / sA, axis[2] / sA] : [1, 0, 0];
  const t10 = rotate(e1, axis, -theta), t20 = rotate(e2, axis, -theta), psi1 = Math.atan2(t10[1], t10[0]);
  // the flat outline, sampled by fraction of the word
  const { pts, per } = regularCorners(m, R), C = pts.length, K = n / C;
  const flat = [];
  let mean = 0;
  for (let j = 0; j < n; j++) {
    const x = j / K, i = Math.floor(x + 1e-9), t = x - i, p = pts[i % C], q = pts[(i + 1) % C];
    const px = p[0] + (q[0] - p[0]) * t, py = p[1] + (q[1] - p[1]) * t, rad = Math.hypot(px, py);
    let az0 = psi1 - Math.atan2(py, px);                   // azimuth about the pole, in the pole's own frame
    const az1 = (TAU * j) / n;
    az0 -= TAU * Math.round((az0 - az1) / TAU);            // the nearest turn
    flat.push({ rad, az0, az1 });
    mean += rad / n;
  }
  // all samples must swing the same way round: keep az0 - az1 continuous along the ring
  for (let j = 1; j < n; j++) { const d = (flat[j].az0 - flat[j].az1) - (flat[j - 1].az0 - flat[j - 1].az1); flat[j].az0 -= TAU * Math.round(d / TAU); }
  const alpha1 = Math.PI - rh / R;
  scene.onUpdate((P) => {
    const s = smooth(Math.min(1, Math.max(0, progress())));
    const alpha = Math.max(1e-4, alpha1 * s), Lbar = mean + (R * alpha1 - mean) * s, rs = Lbar / alpha;
    const p = rotate(Z, axis, theta * s), t1 = rotate(t10, axis, theta * s), t2 = rotate(t20, axis, theta * s);
    const Q = [center[0] + s * R * p[0], center[1] + s * R * p[1], center[2] + s * R * p[2]];
    for (let j = 0; j < n; j++) {
      const F = flat[j], Lj = F.rad + (R * alpha1 - F.rad) * s, az = F.az0 + (F.az1 - F.az0) * s, ca = Math.cos(az), sa = Math.sin(az);
      const dx = ca * t1[0] + sa * t2[0], dy = ca * t1[1] + sa * t2[1], dz = ca * t1[2] + sa * t2[2];
      for (let i = 0; i <= rings; i++) {
        const phi = ((i / rings) * Lj) / rs, lat = rs * Math.sin(phi), drop = rs * (1 - Math.cos(phi)), q = 3 * idx(i, j);
        P[q] = Q[0] + lat * dx - drop * p[0]; P[q + 1] = Q[1] + lat * dy - drop * p[1]; P[q + 2] = Q[2] + lat * dz - drop * p[2];
      }
    }
  });
  return { n, ring: (j) => idx(rings, j), K: K * per };
}

/**
 * The purse. The rim is read in fractions g of a turn from the axis (axisFrac): the gap W (width gW, 0 for none)
 * is centred at g = 0, then the zip z up to the gap U (width gU) centred at g = 1/2, then the mate z' back to W.
 * As it closes, z and z' fall onto one straight seam and each gap that is there curls into a small round eyelet.
 */
export function addPurse(scene, L, s, { r, axisFrac = 0, gU = 0, gW = 0, progress, eyelet = 0.3 }) {
  const { site, boundary } = L.sites[s], n = L.n, alpha = TAU * axisFrac, ca = Math.cos(alpha), sa = Math.sin(alpha);
  const rU = gU > 0 ? eyelet * r : 0, rW = gW > 0 ? eyelet * r : 0, xR = r - 2 * rW, xL = -r + 2 * rU;
  const zLen = 0.5 - gU / 2 - gW / 2;
  const target = (g) => {       // where rim fraction g ends up, in axis coordinates
    if (g < gW / 2 || g > 1 - gW / 2) { const u = mod(g + gW / 2, 1) / gW, ph = Math.PI + TAU * u; return [xR + rW + rW * Math.cos(ph), rW * Math.sin(ph)]; }
    if (g <= 0.5 - gU / 2) { const v = (g - gW / 2) / zLen; return [xR + (xL - xR) * v, 0]; }
    if (g < 0.5 + gU / 2) { const u = (g - (0.5 - gU / 2)) / gU, ph = TAU * u; return [xL - rU + rU * Math.cos(ph), rU * Math.sin(ph)]; }
    const v = (g - (0.5 + gU / 2)) / zLen; return [xL + (xR - xL) * v, 0];
  };
  const cell = addCell(scene, {
    site, boundary, Rs: L.Rs, ni: 6,
    hole: (j, th, out) => {
      const e = smooth(Math.min(1, Math.max(0, progress()))), g = mod(j / n - axisFrac, 1), T = target(g);
      const x0 = r * Math.cos(th), y0 = r * Math.sin(th), x1 = T[0] * ca - T[1] * sa, y1 = T[0] * sa + T[1] * ca;
      out[0] = x0 + (x1 - x0) * e; out[1] = y0 + (y1 - y0) * e;
    },
  });
  return cell;
}

/**
 * The twisted strap. cell: a round hole of radius r at `site`; z lies on rim samples jz - hw .. jz + hw and its
 * mate on the opposite samples. Each flap is 2 hw columns wide and grows to the middle of the hole, turning a
 * quarter turn about the line from lip to lip; they meet edge to edge, standing upright, front against back.
 */
export function addStrap(scene, cell, site, { r, n, jz, hw, bump, progress, m = 10 }) {
  const cols = 2 * hw, w = (TAU * hw) / n, phi = (TAU * jz) / n;
  const yx = Math.cos(phi), yy = Math.sin(phi), xx = Math.sin(phi), xy = -Math.cos(phi);      // strap axes in the chart
  const half = r * Math.sin(w), reach = r * Math.cos(w);
  // S(u, s) in strap coordinates (x', y', z): a chord strap from lip to lip with a half twist, eased onto the round lips
  const chord = (u, s) => { const k = (2 * u - 1) * half, c = Math.cos(Math.PI * s), sn = Math.sin(Math.PI * s); return [-k * c, reach * (1 - 2 * s), bump * sn + k * sn]; };
  const lip0 = (u) => { const b = w * (1 - 2 * u); return [r * Math.sin(b), r * Math.cos(b), 0]; };
  const lip1 = (u) => { const b = w * (1 - 2 * u); return [-r * Math.sin(b), -r * Math.cos(b), 0]; };
  const S = (u, s) => {
    const p = chord(u, s), a = lip0(u), a0 = chord(u, 0), b = lip1(u), b0 = chord(u, 1), ka = (1 - s) ** 3, kb = s ** 3;
    return [p[0] + ka * (a[0] - a0[0]) + kb * (b[0] - b0[0]), p[1] + ka * (a[1] - a0[1]) + kb * (b[1] - b0[1]), p[2] + ka * (a[2] - a0[2]) + kb * (b[2] - b0[2])];
  };
  const flaps = [0, 1].map((side) => {
    const base = scene.alloc(m * (cols + 1));
    const foot = (c) => cell.rim(side === 0 ? jz - hw + c : jz + n / 2 - hw + c);
    const idx = (k, c) => (k === 0 ? foot(c) : base + (k - 1) * (cols + 1) + c);
    for (let k = 0; k < m; k++) for (let c = 0; c < cols; c++) { const a = idx(k, c), b = idx(k, c + 1), d = idx(k + 1, c + 1), e = idx(k + 1, c); scene.tri(a, b, d); scene.tri(a, d, e); }
    scene.onUpdate((P) => {
      const e = smooth(Math.min(1, Math.max(0, progress())));
      for (let k = 1; k <= m; k++) {
        const s = side === 0 ? (e / 2) * (k / m) : 1 - (e / 2) * (k / m);
        for (let c = 0; c <= cols; c++) { const q = S(c / cols, s); site.toWorld(q[0] * xx + q[1] * yx, q[0] * xy + q[1] * yy, q[2], P, 3 * idx(k, c)); }
      }
    });
    return { end: (c) => idx(m, c), edge: (k, c) => idx(k, c), cols, m };
  });
  return { flaps };
}

export { norm };
