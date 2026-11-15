// lab/seeds.mjs — the default seed of every group (presets[0].seed) in lattice coordinates relative to group.center:
// the SEED table of design.js. Also prints each default tile's corners in tile sizes, with their interior angles.
import { GROUPS, latticeCoords } from '../../../../../src/groups.js';
import { tileOf } from '../../../kit.js';

const r = (v) => Math.round(v * 1e6) / 1e6 + 0;
const lines = [];
for (const g of GROUPS) {
  const s = g.presets[0].seed, st = latticeCoords(g, s[0] - g.center[0], s[1] - g.center[1]);
  lines.push(`  '${g.id}': [${r(st[0])}, ${r(st[1])}],`);
  const T = tileOf(g).poly, u = Math.sqrt(g.domainArea), n = T.length;
  const corners = T.map((p, i) => {
    const a = T[(i + n - 1) % n], b = T[(i + 1) % n];
    const ang = Math.acos(((a[0] - p[0]) * (b[0] - p[0]) + (a[1] - p[1]) * (b[1] - p[1])) / (Math.hypot(a[0] - p[0], a[1] - p[1]) * Math.hypot(b[0] - p[0], b[1] - p[1])));
    return `(${(p[0]).toFixed(3)},${(p[1]).toFixed(3)}):${Math.round((ang * 180) / Math.PI)}`;
  });
  console.log(g.id.padEnd(6), 'u=' + u.toFixed(3), 'metric=' + (g.presets[0].metric ? 'yes' : 'no'), corners.join(' '));
}
console.log(lines.join('\n'));
