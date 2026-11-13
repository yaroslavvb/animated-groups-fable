// probe-motions.mjs — every cut x motion: areas, the closed shape against The Folding's, continuity, crossing length over t.
import { CUTS, MOTIONS, buildSheet, positionsAt, GROUP } from '../src/motions.js';
import { createSelfX, jitterPlane } from '../src/selfx.js';
import { buildDomain, makeWarp } from '../../src/domain.js';
import { buildMesh } from '../../src/mesh.js';
import createFold from '../../src/folds/crosscap.js';

const N = Number(process.argv[2] || 100);
const size = Math.sqrt(GROUP.domainArea);
for (const cut of CUTS) {
  // the reference: The Folding's own fold of this cut, closed
  const dom = buildDomain(GROUP, { seed: cut.seed, warp: makeWarp(GROUP, 0) });
  const ref = createFold(GROUP, dom, buildMesh(GROUP, dom, {}), { anchor: cut.seed });
  const F1 = ref.at(1);
  for (const m of MOTIONS) {
    const t0 = performance.now();
    const S = buildSheet(cut.index, m.key);
    const buildMs = performance.now() - t0;
    // area on the paper, and orientation there
    let area = 0, neg = 0;
    const pp = [0, 0], P = new Float64Array(2 * S.n);
    for (let i = 0; i < S.n; i++) { const g = S.paperAffine(S.tag[i]); P[2 * i] = g.a * S.uv[2 * i] + g.b * S.uv[2 * i + 1] + g.tx; P[2 * i + 1] = g.c * S.uv[2 * i] + g.d * S.uv[2 * i + 1] + g.ty; }
    for (let t = 0; t < S.tri.length; t += 3) {
      const a = S.tri[t], b = S.tri[t + 1], c = S.tri[t + 2];
      const ar = ((P[2 * b] - P[2 * a]) * (P[2 * c + 1] - P[2 * a + 1]) - (P[2 * b + 1] - P[2 * a + 1]) * (P[2 * c] - P[2 * a])) / 2;
      area += ar; if (ar < 0) neg++;
    }
    // t = 0 is the paper; t = 1 is The Folding's closed shape
    const pos = new Float32Array(3 * S.n), prev = new Float32Array(3 * S.n);
    positionsAt(S, 0, S.uv, S.tag, pos);
    let e0 = 0, e1 = 0;
    for (let i = 0; i < S.n; i++) e0 = Math.max(e0, Math.hypot(pos[3 * i] - P[2 * i], pos[3 * i + 1] - P[2 * i + 1], pos[3 * i + 2]));
    positionsAt(S, 1, S.uv, S.tag, pos);
    const o = [0, 0, 0];
    for (let i = 0; i < S.n; i++) { F1(P[2 * i], P[2 * i + 1], ref.mesh.locate(P[2 * i], P[2 * i + 1]), o); e1 = Math.max(e1, Math.hypot(pos[3 * i] - o[0], pos[3 * i + 1] - o[1], pos[3 * i + 2] - o[2])); }
    // continuity and crossings
    const J = jitterPlane(S.uv, S.tri, S.triTag), X = createSelfX(S.tri), dp = new Float32Array(3 * S.n);
    let step = 0, stepAt = 0, minZ = Infinity, maxZ = -Infinity;
    const row = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      positionsAt(S, t, S.uv, S.tag, pos);
      if (k) for (let i = 0; i < S.n; i++) { const d = Math.hypot(pos[3 * i] - prev[3 * i], pos[3 * i + 1] - prev[3 * i + 1], pos[3 * i + 2] - prev[3 * i + 2]); if (d > step) { step = d; stepAt = t; } }
      for (let i = 0; i < S.n; i++) { if (pos[3 * i + 2] < minZ) minZ = pos[3 * i + 2]; if (pos[3 * i + 2] > maxZ) maxZ = pos[3 * i + 2]; }
      prev.set(pos);
      positionsAt(S, t, J, S.tag, dp);
      row.push(X.compute(dp, size).length / size);
    }
    const bar = row.map((L) => (L < 0.005 ? '.' : L < 0.05 ? ':' : L < 0.2 ? '-' : L < 0.5 ? '=' : L < 1 ? '#' : '@')).join('');
    console.log(`${cut.name.padEnd(8)} ${m.key.padEnd(6)} n ${S.n} tris ${S.tri.length / 3} parts ${S.parts} lines ${S.lines.length} build ${buildMs.toFixed(0)} ms  area ${(area / GROUP.domainArea).toFixed(6)} (cw ${neg})  |t=0 - paper| ${e0.toExponential(1)}  |t=1 - The Folding| ${e1.toExponential(1)}  largest step ${(step / size).toFixed(4)} at ${stepAt.toFixed(2)}  z ${(minZ / size).toFixed(2)}..${(maxZ / size).toFixed(2)}  dur ${S.duration.toFixed(1)} stops ${S.stops.map((s) => s.t.toFixed(2)).join('/')}`);
    console.log('   ' + bar);
    if (S.map.moves.length) console.log('   moves: ' + S.map.moves.map((mv) => `${mv.part}: ${mv.text}`).join(' | '));
  }
}
