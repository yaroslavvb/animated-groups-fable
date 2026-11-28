// sweep.mjs — the bake over the sliders' whole range: reach of the fold, what is baked, the time, and whether the two
// copies of the mesh's seal points read the same tone (a cheap sign that no needed copy is missing).
import { createPrint3d, RANGE_TEXELS } from '../../src/print3d.js';
import { FAMILIES, normalizeFamilyKey, centredFor, defaultCommas } from '../../../two-features-two-handles/src/handles.js';
import { orbifoldMesh } from '../../src/pillow.js';
import { sdfSample } from '../../../the-folding/src/sdf.js';
function stateFor(text, over = {}) {
  const k = normalizeFamilyKey(text), fam = k && FAMILIES[k];
  const perm = fam.defaultM.split('').map(Number);
  return { k, perm, orders: perm.map((c) => fam.baseOrders[c]), L: fam.defaultL, tw: fam.defaultTw, b: 0, tau: 0, thetas: defaultCommas(k).map((sp) => (sp ? sp.theta : 0)), print: null, ...over };
}
const app = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
const fermi = (s, th) => [Math.sinh(th) * Math.cosh(s), Math.sinh(s), Math.cosh(th) * Math.cosh(s)];
const NEAR = (127 * 2) / RANGE_TEXELS, size = Number(process.argv[2] || 512);
const keys = process.argv[3] ? process.argv[3].split(',') : ['3333', '2345', '2223', '4444', '2229'];
let worstMs = 0, bad = 0;
for (const key of keys) {
  for (const L of [0.4, 0.6, 1, 1.5, 2.6, 4, 5.5, 7]) {
    for (const tw of [0, 0.25, -0.5]) {
      const st = stateFor(key, { L, tw });
      let c;
      try { c = centredFor(st); } catch (err) { console.log(key, L, tw, 'engine: ' + err.message); continue; }
      const p3 = createPrint3d(), t0 = performance.now(), print = p3.bake(st, { size }), ms = performance.now() - t0;
      if (!print) { console.log(key, L, tw, 'NO PRINT'); bad++; continue; }
      const { origin, e1, e2 } = print, det = e1[0] * e2[1] - e1[1] * e2[0];
      const read = (u, v) => sdfSample(print.data, size, (e2[1] * (u - origin[0]) - e2[0] * (v - origin[1])) / det, (-e1[1] * (u - origin[0]) + e1[0] * (v - origin[1])) / det);
      const mesh = orbifoldMesh(st.orders, L, tw, { nTheta: 96, nS: 10 }), o = mesh.open, tri = new Float64Array(9);
      let rMax = 0;
      const valueAt = (s, th) => { const X = app(c.Pmat, fermi(s, th)); for (let k = 0; k < 9; k++) tri[k] = X[k % 3]; const uv = p3.chartOf(tri); rMax = Math.max(rMax, Math.hypot(uv[0], uv[1])); return read(uv[0], uv[1]); };
      let pairs = 0, counted = 0, wrong = 0, dark = 0, all = 0;
      const same = (va, vb) => { pairs++; if (Math.abs(va - 128) < NEAR || Math.abs(vb - 128) < NEAR) return; counted++; if ((va < 128) !== (vb < 128)) wrong++; };
      for (const sl of mesh.seals) for (let i = 0; i < sl.openA.length; i++) same(valueAt(o.s[sl.openA[i]], o.theta[sl.openA[i]]), valueAt(o.s[sl.openB[i]], o.theta[sl.openB[i]]));
      for (let v = 0; v < o.nVertices; v += 3) { const a = valueAt(o.s[v], o.theta[v]); all++; if (a < 128) dark++; same(a, valueAt(o.s[v], o.theta[v] + mesh.cuff)); }
      const dMax = 2 * Math.atanh(rMax), texel = (2 / size) * 2 * Math.cosh(dMax / 2) ** 2;      // hyperbolic length of a texel at the chart's rim
      worstMs = Math.max(worstMs, ms); if (wrong) bad++;
      console.log(`${key} L ${L} tw ${tw}: ${ms.toFixed(1)} ms, reach ${print.info.reach.toFixed(2)}, baked to ${print.info.radius.toFixed(2)}, ${print.info.polys} outlines, chart to disc r ${rMax.toFixed(3)} (d ${dMax.toFixed(2)}; a texel there is ${texel.toFixed(3)} long), dark ${(100 * dark / all).toFixed(0)} %, ${wrong} of ${counted} pairs differ`);
    }
  }
}
console.log('worst bake', worstMs.toFixed(1), 'ms; states with a fault:', bad);
