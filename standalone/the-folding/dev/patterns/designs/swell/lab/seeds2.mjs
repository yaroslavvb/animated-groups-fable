// lab/seeds2.mjs — the SEED table of design.js at full precision (the default seeds sit on special lines: a rounded
// seed gives a tile with dust edges)
import { GROUPS, latticeCoords } from '../../../../../src/groups.js';
const out = [];
for (const g of GROUPS) { const s = g.presets[0].seed, st = latticeCoords(g, s[0] - g.center[0], s[1] - g.center[1]); out.push(`'${g.id}': [${st[0] + 0}, ${st[1] + 0}]`); }
console.log(out.join(', '));
