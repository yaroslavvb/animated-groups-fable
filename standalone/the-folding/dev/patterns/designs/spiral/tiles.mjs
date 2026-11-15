// designs/spiral/tiles.mjs — a look at the 17 default tiles: polygon, sizes, inradius. Plain node, a fraction of a second.
import { GROUPS } from '../../../../src/groups.js';
import { buildDomain } from '../../../../src/domain.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4;
for (const g of GROUPS) {
  const t0 = performance.now();
  const d = buildDomain(g, { seed: g.presets[0].seed, metric: g.presets[0].metric });
  const ms = performance.now() - t0;
  const ts = Math.sqrt(g.domainArea);
  const P = d.poly, n = P.length;
  let per = 0; const sides = [];
  for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); per += l; sides.push(r4(l / ts) + (d.edges[i].kind === 'mirror' ? 'm' : '')); }
  const c = g.center, st = [(g.presets[0].seed[0] - c[0]), (g.presets[0].seed[1] - c[1])];
  const dd = g.e1[0] * g.e2[1] - g.e1[1] * g.e2[0];
  const la = [(st[0] * g.e2[1] - st[1] * g.e2[0]) / dd, (g.e1[0] * st[1] - g.e1[1] * st[0]) / dd];
  console.log(g.id.padEnd(6), 'ts', r4(ts), 'n', n, 'per/ts', r4(per / ts), 'seed', JSON.stringify(d.seed.map(r4)), 'seedLattice', JSON.stringify(la.map(r4)), 'ms', r4(ms));
  console.log('       poly', JSON.stringify(P.map((p) => p.map(r4))), 'sides', sides.join(' '));
}
