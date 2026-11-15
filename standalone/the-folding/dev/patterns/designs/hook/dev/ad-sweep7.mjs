// dev/ad-sweep7.mjs — a small sweep of the "seven" (tail, two bends, a head toward the third side) in one kaleidoscope:
// coarse numbers only, sorted by how far they miss the targets.   node ad-sweep7.mjs '*442' [order]
import { BY_ID, run } from './lib.mjs';
import { inset } from './cands.mjs';
import { path } from './ad-cands.mjs';

const S3 = Math.sqrt(3);
const CH = {
  '*632': [[0, 0], [-0.5, -S3 / 6], [-0.25, -S3 / 4]],
  '*333': [[0, 0], [0.5, S3 / 6], [0.5, -S3 / 6]],
  '*442': [[0, 0], [0.5, 0.5], [0, 0.5]],
};
const id = process.argv[2], order = process.argv[3] || '012';
const g = BY_ID[id], s = Math.sqrt(g.domainArea), V = order.split('').map((k) => CH[id][+k]);
const lerp = (P, Q, f) => [P[0] + (Q[0] - P[0]) * f, P[1] + (Q[1] - P[1]) * f];
const rows = [];
for (const r of [0.15, 0.17, 0.19]) for (const hr of [0.2, 0.24]) for (const hf of [0.4, 0.55]) for (const hin of [0.34, 0.42]) {
  const D = 0.085 * s, [V0, V1, V2] = V;
  const a = inset(V0, V1, V2, D), b = inset(V1, V0, V2, D), c = inset(V2, V0, V1, D);
  const m = lerp(V2, V0, hf), L = Math.hypot(V0[0] - V2[0], V0[1] - V2[1]), nx = -(V0[1] - V2[1]) / L, ny = (V0[0] - V2[0]) / L;
  const sg = Math.sign(nx * (V1[0] - m[0]) + ny * (V1[1] - m[1])), H = [m[0] + sg * nx * hin * s, m[1] + sg * ny * hin * s];
  const spec = path(id, [[...a, r * 0.8], [...b, r], [...c, r], [...H, hr]], { r, fil: [0.04, 0.1], gap: id === '*632' ? 0.09 : 0.12, rd: 0.03 });
  const q = run(g, spec, { per: 20 });
  const miss = Math.max(0, q.bare - 0.45) * 3 + Math.max(0, 0.42 - q.coverage) + Math.max(0, q.coverage - 0.6) + (q.loops > 1 ? 0.2 : 0);
  rows.push({ r, hr, hf, hin, cov: q.coverage, bare: q.bare, solid: q.solid, loops: q.loops, miss });
}
rows.sort((p, q) => p.miss - q.miss);
for (const x of rows.slice(0, 10)) console.log(JSON.stringify(x));
