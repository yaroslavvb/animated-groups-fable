// dev/recut/probe-recut.mjs — the re-cut fold, cut by cut: its pieces, the areas, the seams at t = 1, the largest step,
// and how much of the sheet passes through itself over the whole motion (the lab's detector).
//   node dev/recut/probe-recut.mjs [seeds]
import { BY_ID } from '../../src/groups.js';
import { buildDomain, makeWarp } from '../../src/domain.js';
import { buildMesh } from '../../src/mesh.js';
import { createFold, foldMeshOptions } from '../../src/folds/index.js';
import { inverse, apply } from '../../src/geom.js';
import { createSelfX, jitterPlane, rimTriangles } from '../../src/selfx.js';

const SEEDS = +process.argv[2] || 0;
const STEPS = 160, NONE = 0.004;
function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
for (const id of ['22x', 'xx']) {
  const group = BY_ID[id], size = Math.sqrt(group.domainArea);
  const cases = group.presets.map((p, i) => ({ label: p.name, seed: p.seed, metric: p.metric, anchor: p.anchor || p.seed }));
  const rnd = prng(11);
  for (let k = 0; k < SEEDS; k++) cases.push({ label: 'random ' + k, seed: [group.center[0] + (2 * rnd() - 1) * 0.6 * group.viewHalf, group.center[1] + (2 * rnd() - 1) * 0.6 * group.viewHalf], anchor: group.presets[0].seed });
  for (const c of cases) for (const amp of [0, 1]) {
    const t0 = performance.now();
    const domain = buildDomain(group, { seed: c.seed, metric: c.metric, warp: makeWarp(group, amp) });
    const mesh = buildMesh(group, domain, foldMeshOptions(group));
    const fold = createFold(group, domain, mesh, { anchor: c.anchor, recut: true });
    const ms = performance.now() - t0;
    const M = fold.mesh, n = M.n;
    let area = 0;
    for (let i = 0; i < M.tri.length; i += 3) { const a = M.tri[i], b = M.tri[i + 1], d = M.tri[i + 2]; area += 0.5 * ((M.xy[2 * b] - M.xy[2 * a]) * (M.xy[2 * d + 1] - M.xy[2 * a + 1]) - (M.xy[2 * b + 1] - M.xy[2 * a + 1]) * (M.xy[2 * d] - M.xy[2 * a])); }
    // seams at t = 1
    const F1 = fold.at(1), o = [0, 0, 0], o2 = [0, 0, 0], q = [0, 0];
    let gap = 0;
    const byEdge = new Map(M.boundary.map((b) => [b.edge, b]));
    domain.edges.forEach((e, i) => {
      if (e.kind !== 'cut') return;
      const b = byEdge.get(i), gi = inverse(e.g);
      for (let k = 0; k < b.cells.length; k++) {
        const x = b.pts[2 * k], y = b.pts[2 * k + 1];
        apply(gi, x, y, q);
        F1(x, y, b.cells[k], o); F1(q[0], q[1], M.locate(q[0], q[1]), o2);
        gap = Math.max(gap, Math.hypot(o[0] - o2[0], o[1] - o2[1], o[2] - o2[2]));
      }
    });
    // crossing, and the largest step
    const uv = jitterPlane(M.xy, M.tri, M.triCell);
    const X = createSelfX(M.tri, { skip: rimTriangles(M.tri, n, { xy: M.xy, within: 0.03 * size }) }), pos = new Float32Array(3 * n), prev = new Float32Array(3 * n);
    let first = null, last = null, max = 0, at = 0, step = 0;
    for (let s = 0; s <= STEPS; s++) {
      const t = s / STEPS, F = fold.at(t);
      for (let v = 0; v < n; v++) { F(uv[2 * v], uv[2 * v + 1], M.cell[v], o); pos[3 * v] = o[0]; pos[3 * v + 1] = o[1]; pos[3 * v + 2] = o[2]; }
      if (s) for (let v = 0; v < n; v++) step = Math.max(step, Math.hypot(pos[3 * v] - prev[3 * v], pos[3 * v + 1] - prev[3 * v + 1], pos[3 * v + 2] - prev[3 * v + 2]));
      prev.set(pos);
      const L = X.compute(pos, size).length / size;
      if (L >= NONE) { if (first === null) first = t; last = t; }
      if (L > max) { max = L; at = t; }
    }
    const R = fold.recut;
    console.log(`${id} ${c.label.padEnd(10)} amp ${amp}: ${R ? R.pieces.length + ' pieces [' + R.pieces.map((p) => p.type[0] + (100 * p.area / group.domainArea).toFixed(0)).join(' ') + '] tau0 ' + R.tau0.toFixed(3) + ' ' + fold.duration.toFixed(1) + ' s' : 'direct'}; area ${(area / group.domainArea).toFixed(6)}; seam gap ${(gap / size).toExponential(1)}; step ${(step / size).toFixed(3)}; ${first === null ? 'never crosses' : `CROSSES t ${first.toFixed(3)}..${last.toFixed(3)} max ${max.toFixed(3)} at ${at.toFixed(3)}`}; ${M.tri.length / 3} tri, ${ms.toFixed(0)} ms`);
  }
}
