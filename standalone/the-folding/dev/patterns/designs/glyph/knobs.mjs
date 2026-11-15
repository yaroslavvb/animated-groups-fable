// dev/patterns/designs/glyph/knobs.mjs — the critic's (13 Nov 2026) quick look: the kit's numbers for all 17 with knobs
// changed (JSON merged into K), without a browser.   node dev/patterns/designs/glyph/knobs.mjs '{"patchBare":9}' [per=30] [ids=a,b]
import { GROUPS, BY_ID } from '../../../../src/groups.js';
import { normalize, measure } from '../../kit.js';
import { find, K } from './design.js';
Object.assign(K, JSON.parse(process.argv[2] || '{}'));
const arg = Object.fromEntries(process.argv.slice(3).map((a) => a.split('=')));
const per = +arg.per || 30, ids = arg.ids ? arg.ids.split(',') : GROUPS.map((g) => g.id);
let worst = 0;
for (const id of ids) {
  const g = BY_ID[id], res = find(g), N = normalize(res.shapes), m = measure(g, N, { per });
  worst = Math.max(worst, m.emptyDisc);
  console.log(id.padEnd(6), 'dark', m.coverage.toFixed(3), 'bare', m.emptyDisc.toFixed(3), 'solid', m.darkDisc.toFixed(3), 'pts', String(N.verts).padStart(4), ' ', res.info.kind, res.info.corner, (res.info.dots || []).join('+'), 'w', res.info.weight, 'stem', res.info.stem, 'arm', res.info.arm);
}
console.log('worst bare', worst.toFixed(3));
