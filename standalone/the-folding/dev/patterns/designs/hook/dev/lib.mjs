// dev/lib.mjs — helpers for the Hooks design's own tools (not used by the page): a coarse measure of a spec without a browser.
import { BY_ID, elementsNear } from '../../../../../src/groups.js';
import { motifOf, SPEC } from '../design.js';
import { normalize, windingAt } from '../../../kit.js';

export { BY_ID, SPEC };

function edt(on, w, h) {
  const INF = 1e20, m = Math.max(w, h), f = new Float64Array(m), d = new Float64Array(w * h), v = new Int32Array(m), z = new Float64Array(m + 1);
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
  for (let x = 0; x < w; x++) { const col = new Float64Array(h); for (let y = 0; y < h; y++) col[y] = on[y * w + x] ? 0 : INF; pass(h, (i) => col[i], (i, val) => { d[i * w + x] = val; }); }
  for (let y = 0; y < h; y++) { const row = d.slice(y * w, y * w + w); pass(w, (i) => row[i], (i, val) => { d[y * w + i] = val; }); }
  for (let i = 0; i < d.length; i++) d[i] = Math.sqrt(d[i]);
  return d;
}

/** Coverage, bare and solid disc (diameters, tile sizes) of a motif's orbit, on a grid of `per` points per tile size. */
export function coarse(group, shapes, { per = 26 } = {}) {
  const N = normalize(shapes), size = Math.sqrt(group.domainArea), h = size / per;
  const L = Math.max(Math.hypot(...group.e1), Math.hypot(...group.e2));
  const half = Math.min(0.6 * L + 0.8 * size, 2.4 * size), pad = 0.8 * size;
  const w = Math.ceil((2 * (half + pad)) / h), x0 = group.center[0] - half - pad, y0 = group.center[1] - half - pad;
  const dark = new Uint8Array(w * w), light = new Uint8Array(w * w);
  let nd = 0, inner = 0, over = 0;
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    const x = x0 + (i + 0.5) * h, y = y0 + (j + 0.5) * h, W = windingAt(group, N, x, y), t = W > 0 ? 1 : 0;
    dark[j * w + i] = t; light[j * w + i] = 1 - t;
    if (Math.abs(x - group.center[0]) <= half && Math.abs(y - group.center[1]) <= half) { inner++; nd += t; if (W > 1) over++; }
  }
  const dD = edt(dark, w, w), dL = edt(light, w, w);
  let eR = 0, sR = 0, ex = 0, ey = 0;
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    const x = x0 + (i + 0.5) * h, y = y0 + (j + 0.5) * h;
    if (Math.abs(x - group.center[0]) > half || Math.abs(y - group.center[1]) > half) continue;
    if (dD[j * w + i] > eR) { eR = dD[j * w + i]; ex = x; ey = y; }
    sR = Math.max(sR, dL[j * w + i]);
  }
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return { coverage: r3(nd / inner), bare: r3((2 * eR * h) / size), solid: r3((2 * sR * h) / size), overlap: r3(over / inner), verts: N.verts, bareAt: [r3(ex), r3(ey)] };
}

export function run(group, spec, opts) {
  const t0 = performance.now();
  const m = motifOf(group, spec);
  const ms = performance.now() - t0;
  return { ms: Math.round(ms), loops: m.shapes.length, trimmed: Math.round(m.trimmed * 1000) / 1000, plain: m.plain, apart: Math.round(m.apart * 1000) / 1000, ...coarse(group, m.shapes, opts), shapes: m.shapes };
}
