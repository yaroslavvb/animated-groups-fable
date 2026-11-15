// node dev/seedtile.mjs <id> — the default tile from presets[0] and from the SEED table (as find() builds it for a group
// without presets), vertex by vertex in tile sizes from the centre.
import { BY_ID, latticeCoords } from '../../../../../src/groups.js';
import { buildDomain } from '../../../../../src/domain.js';

const g = BY_ID[process.argv[2] || '632'], s = Math.sqrt(g.domainArea);
const p0 = g.presets[0], st = latticeCoords(g, p0.seed[0] - g.center[0], p0.seed[1] - g.center[1]);
console.log('preset seed in lattice coords from the centre:', st.map((x) => x.toFixed(6)).join(', '));
const strip = { id: g.id, e1: g.e1, e2: g.e2, reps: g.reps, cellArea: g.cellArea, domainArea: g.domainArea, center: g.center };
const seed = [g.center[0] + st[0] * g.e1[0] + st[1] * g.e2[0], g.center[1] + st[0] * g.e1[1] + st[1] * g.e2[1]];
for (const [name, grp, sd] of [['preset', g, p0.seed], ['no presets', strip, seed]]) {
  const d = buildDomain(grp, { seed: sd });
  console.log(name, 'seed', d.seed.map((x) => x.toFixed(5)).join(','), 'poly', d.poly.map((p) => `(${((p[0] - g.center[0]) / s).toFixed(4)},${((p[1] - g.center[1]) / s).toFixed(4)})`).join(' '));
}
