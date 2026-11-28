import { createSurfaceModel } from '../../src/surface-model.js';
const st = { k: '2223', perm: [3, 0, 1, 2], orders: [3, 2, 2, 2], L: 1.3169578969248166, tw: 0, b: 0, tau: 0, thetas: [0, 0, 0, 0], print: null };
const sm = createSurfaceModel({ nVertices: 1400 }); sm.set(st);
const f1 = sm.frame(1), f2 = sm.frame(2), fm = sm.frame(1.5), mesh = sm.mesh;
const at = (a, v) => [a[3 * v], a[3 * v + 1], a[3 * v + 2]], dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const rows = [];
for (let t = 0; t < f1.triangles.length / 3; t++) for (let c = 0; c < 3; c++) {
  const a = f1.triangles[3 * t + c], b = f1.triangles[3 * t + (c + 1) % 3];
  const d1 = dist(at(f1.positions, a), at(f1.positions, b)), d2 = dist(at(f2.positions, a), at(f2.positions, b)), dm = dist(at(fm.positions, a), at(fm.positions, b));
  rows.push({ t, a, b, d1, d2, dm, ratio: dm / Math.min(d1, d2), strip: t >= mesh.strip.triStart });
}
rows.sort((x, y) => x.ratio - y.ratio);
const nO = mesh.open.nVertices;
for (const r of rows.slice(0, 8)) {
  const info = (v) => (v >= nO ? `dup#${v - nO}` : `open s=${mesh.open.s[v].toFixed(3)} th=${mesh.open.theta[v].toFixed(3)}`);
  console.log(r.ratio.toFixed(3), 'tri', r.t, r.strip ? 'strip' : '', 'd1', r.d1.toFixed(4), 'dm', r.dm.toFixed(4), 'd2', r.d2.toFixed(4), '|', info(r.a), '|', info(r.b));
  console.log('    a: closed', at(f1.positions, r.a).map((v) => v.toFixed(3)).join(','), 'crown', at(f2.positions, r.a).map((v) => v.toFixed(3)).join(','), ' b: closed', at(f1.positions, r.b).map((v) => v.toFixed(3)).join(','), 'crown', at(f2.positions, r.b).map((v) => v.toFixed(3)).join(','));
}
console.log('count below 0.3:', rows.filter((r) => r.ratio < 0.3).length, 'of', rows.length);
