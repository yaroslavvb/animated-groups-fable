// the seed of every group's default tile (presets[0]) in lattice coordinates relative to group.center
import { GROUPS, latticeCoords } from '../../../../../src/groups.js';
const out = {};
for (const g of GROUPS) {
  const s = g.presets[0].seed, st = latticeCoords(g, s[0] - g.center[0], s[1] - g.center[1]);
  out[g.id] = st.map((v) => Math.round(v * 1e6) / 1e6);
  if (g.presets[0].metric) out[g.id].push('metric');
}
console.log(JSON.stringify(out));
