// probe-selfx.mjs — how long is the self-intersection of the 22x fold at each t, for each cut and stage-2 design?
//   node lab22x/dev/probe-selfx.mjs [steps=100]
import { BY_ID } from '../../src/groups.js';
import { buildDomain, makeWarp } from '../../src/domain.js';
import { buildMesh } from '../../src/mesh.js';
import createFold from '../../src/folds/crosscap.js';
import { createSelfX, chainSegments, jitterPlane } from '../src/selfx.js';

const N = Number(process.argv[2] || 100);
const g = BY_ID['22x'];
const size = Math.sqrt(g.domainArea);
const variants = [
  { name: 'acts/under', opts: {} },
  { name: 'twist', opts: { stage2: 'twist' } },
];
for (const [pi, preset] of g.presets.entries()) {
  for (const v of variants) {
    const domain = buildDomain(g, { seed: preset.seed, warp: makeWarp(g, 0) });
    const mesh = buildMesh(g, domain, {});
    const fold = createFold(g, domain, mesh, { anchor: preset.seed, ...v.opts });
    const M = fold.mesh;
    const X = createSelfX(M.tri);
    const JIT = process.env.NOJIT ? M.xy : jitterPlane(M.xy, M.tri, M.triCell);
    const pos = new Float32Array(3 * M.n), out = [0, 0, 0];
    const row = [];
    let t0 = performance.now(), worst = 0;
    for (let k = 0; k <= N; k++) {
      const t = k / N, F = fold.at(t);
      for (let i = 0; i < M.n; i++) { F(JIT[2 * i], JIT[2 * i + 1], M.cell[i], out); pos[3 * i] = out[0]; pos[3 * i + 1] = out[1]; pos[3 * i + 2] = out[2]; }
      const c0 = performance.now();
      const r = X.compute(pos, size);
      worst = Math.max(worst, performance.now() - c0);
      row.push(r.length / size);
    }
    const ms = (performance.now() - t0) / (N + 1);
    // a compact picture: one character per sample
    const bar = row.map((L) => (L < 0.005 ? '.' : L < 0.05 ? ':' : L < 0.2 ? '-' : L < 0.5 ? '=' : L < 1 ? '#' : '@')).join('');
    const max = Math.max(...row), kmax = row.indexOf(max);
    const F1 = fold.at(1);
    for (let i = 0; i < M.n; i++) { F1(JIT[2 * i], JIT[2 * i + 1], M.cell[i], out); pos[3 * i] = out[0]; pos[3 * i + 1] = out[1]; pos[3 * i + 2] = out[2]; }
    const r1 = X.compute(pos, size), lines = chainSegments(r1.segs, r1.count, 1e-4 * size);
    console.log(`${preset.name.padEnd(8)} ${v.name.padEnd(11)} tris ${String(M.tri.length / 3).padStart(5)} pieces ${M.cells.length}  ${ms.toFixed(1)} ms/step (selfx worst ${worst.toFixed(1)})  max L ${max.toFixed(2)} at t=${(kmax / N).toFixed(2)}  L(1) ${row[N].toFixed(3)} in ${lines.length} polylines (${r1.count} segs)  times ${JSON.stringify(fold.times)}`);
    console.log('   ' + bar);
  }
}
