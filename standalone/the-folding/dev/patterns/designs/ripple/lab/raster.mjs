// designs/ripple/lab/raster.mjs — a small scanline rasteriser of a motif's orbit (winding numbers on a grid), the numbers
// of kit.measure computed with it (the same grid, the same numbers, a hundred times faster in node), and a group carried
// to a turned, scaled and shifted place as a test hands it over. Used by preview.mjs, stress.mjs.
import { orbitElements, stabilizerOrder, windingAt } from '../../../kit.js';

/** winding numbers of the orbit at the samples x = x0 + (i + 0.5) / s, y = y0 + (j + 0.5) / s */
export function windingRaster(group, N, x0, y0, s, W, H, polysOverride) {
  const acc = new Int16Array((W + 1) * H);
  const box = [x0, y0, x0 + W / s, y0 + H / s];
  const els = polysOverride ? [{ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }] : orbitElements(group, N, box);
  const polys = polysOverride || N.polys;
  for (const g of els) {
    const sgn = g.a * g.d - g.b * g.c > 0 ? 1 : -1;
    for (const P of polys) {
      const p = P.pts, n = p.length / 2;
      let ax = (g.a * p[2 * n - 2] + g.b * p[2 * n - 1] + g.tx - x0) * s - 0.5, ay = (g.c * p[2 * n - 2] + g.d * p[2 * n - 1] + g.ty - y0) * s - 0.5;
      for (let k = 0; k < n; k++) {
        const bx = (g.a * p[2 * k] + g.b * p[2 * k + 1] + g.tx - x0) * s - 0.5, by = (g.c * p[2 * k] + g.d * p[2 * k + 1] + g.ty - y0) * s - 0.5;
        if (ay !== by) {
          const lo = Math.min(ay, by), hi = Math.max(ay, by), dir = (by < ay ? 1 : -1) * sgn;
          const j0 = Math.max(0, Math.ceil(lo)), j1 = Math.min(H - 1, Math.ceil(hi) - 1);
          for (let j = j0; j <= j1; j++) {
            const x = ax + ((j - ay) * (bx - ax)) / (by - ay);
            let i = Math.ceil(x); if (i < 0) i = 0; if (i > W) i = W;
            acc[j * (W + 1) + i] += dir;
          }
        }
        ax = bx; ay = by;
      }
    }
  }
  const out = new Int16Array(W * H);
  for (let j = 0; j < H; j++) { let w = 0; for (let i = 0; i < W; i++) { w += acc[j * (W + 1) + i]; out[j * W + i] = w; } }
  return out;
}

export function edt(on, w, h) {
  const INF = 1e20, f = new Float64Array(Math.max(w, h)), d = new Float64Array(w * h), v = new Int32Array(Math.max(w, h)), z = new Float64Array(Math.max(w, h) + 1);
  const pass = (n, get, set) => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s;
      for (;;) { const p = v[k]; s = (get(q) + q * q - (get(p) + p * p)) / (2 * q - 2 * p); if (s <= z[k] && k > 0) k--; else break; }
      if (s <= z[k]) { v[k] = q; z[k] = -INF; z[k + 1] = INF; } else { k++; v[k] = q; z[k] = s; z[k + 1] = INF; }
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const p = v[k]; set(q, (q - p) * (q - p) + get(p)); }
  };
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = on[y * w + x] ? 0 : INF; const col = f.slice(0, h); pass(h, (i) => col[i], (i, val) => { d[i * w + x] = val; }); }
  for (let y = 0; y < h; y++) { const row = d.slice(y * w, y * w + w); pass(w, (i) => row[i], (i, val) => { d[y * w + i] = val; }); }
  for (let i = 0; i < d.length; i++) d[i] = Math.sqrt(d[i]);
  return d;
}

/**
 * kit.measure (as of 13 Nov 2026, 16:58: the dark share over exactly one lattice cell), with the tone of the big
 * window sampled by the rasteriser: the same grids, the same numbers. `exact` is the share from the polygons' areas.
 */
export function fastMeasure(group, N, per = 56) {
  const size = Math.sqrt(group.domainArea), h = size / per;
  const L = Math.max(Math.hypot(group.e1[0], group.e1[1]), Math.hypot(group.e2[0], group.e2[1]));
  const half = Math.min(1.1 * L + 1.2 * size, 3.4 * size), pad = 1.3 * size;
  const w = Math.ceil((2 * (half + pad)) / h), x0 = group.center[0] - half - pad, y0 = group.center[1] - half - pad;
  const Wn = windingRaster(group, N, x0, y0, 1 / h, w, w);
  const dark = new Uint8Array(w * w), light = new Uint8Array(w * w), stab = stabilizerOrder(group, N);
  let over = 0, inner = 0, nd = 0;
  for (let s = 0; s < w * w; s++) { const t = Wn[s] > 0 ? 1 : 0; dark[s] = t; light[s] = 1 - t; }
  {
    const m = Math.max(48, Math.min(260, Math.round(per * Math.sqrt(group.cellArea) / size)));
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
      const a = (i + 0.5) / m, b = (j + 0.5) / m;
      const W = windingAt(group, N, group.center[0] + (a - 0.5) * group.e1[0] + (b - 0.5) * group.e2[0], group.center[1] + (a - 0.5) * group.e1[1] + (b - 0.5) * group.e2[1]);
      inner++; if (W > 0) nd++; if (W > stab) over++;
    }
  }
  let net = 0;
  for (const P of N.polys) net += (P.hole ? -1 : 1) * P.area;
  const dD = edt(dark, w, w), dL = edt(light, w, w);
  let eR = 0, kR = 0;
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    const x = x0 + (i + 0.5) * h, y = y0 + (j + 0.5) * h;
    if (Math.abs(x - group.center[0]) > half || Math.abs(y - group.center[1]) > half) continue;
    eR = Math.max(eR, dD[j * w + i]); kR = Math.max(kR, dL[j * w + i]);
  }
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return { coverage: r3(nd / inner), exact: r3(net / group.domainArea), emptyDisc: r3((2 * eR * h) / size), darkDisc: r3((2 * kR * h) / size), overlap: r3(over / inner), verts: N.verts };
}

/** a turned, scaled and shifted copy of a group, as a test would hand it over: no presets, no kaleidoscope */
export function carried(group, ang, scale, shift) {
  const c = Math.cos(ang) * scale, s = Math.sin(ang) * scale, S = (x, y) => [c * x - s * y + shift[0], s * x + c * y + shift[1]];
  const lin = (v) => [c * v[0] - s * v[1], s * v[0] + c * v[1]];
  const reps = group.reps.map((r) => {
    // S r S^-1: linear part R r R^-1 (rotation by ang), translation S(r(S^-1 0))
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const a = ca * (r.a * ca + r.b * -sa) - sa * (r.c * ca + r.d * -sa), b = ca * (r.a * sa + r.b * ca) - sa * (r.c * sa + r.d * ca);
    const cc = sa * (r.a * ca + r.b * -sa) + ca * (r.c * ca + r.d * -sa), d = sa * (r.a * sa + r.b * ca) + ca * (r.c * sa + r.d * ca);
    // S^-1(0) = R^-1(-shift)/scale
    const ox = (ca * -shift[0] + sa * -shift[1]) / scale, oy = (-sa * -shift[0] + ca * -shift[1]) / scale;
    const t = S(r.a * ox + r.b * oy + r.tx, r.c * ox + r.d * oy + r.ty);
    return { a, b, c: cc, d, tx: t[0], ty: t[1] };
  });
  const e1 = lin(group.e1), e2 = lin(group.e2);
  const cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  return { id: group.id, e1, e2, reps, cellArea, domainArea: cellArea / reps.length, center: S(group.center[0], group.center[1]) };
}

