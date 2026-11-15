// dev/ad-probe.mjs — is a point dark? The tone of a candidate's print along a ray from a world point.
//   node ad-probe.mjs '<id>@<cand prefix>' x y angleDeg [steps]
import { BY_ID } from '../../../../../src/groups.js';
import { makeShapePrint } from '../../../../../src/shapes.js';
import { motifOf } from '../design.js';
import { CANDS } from './ad-cands.mjs';

const [item, xs, ys, as, ns] = process.argv.slice(2);
const [id, name] = item.split('@');
const g = BY_ID[id], size = Math.sqrt(g.domainArea);
const spec = CANDS[id]().find(([n]) => n.startsWith(name))[1];
const m = motifOf(g, spec);
const p = makeShapePrint(g, { key: 'hook', name: 'hook', shapes: m.shapes });
const a = (+as * Math.PI) / 180, n = +ns || 20;
let line = '';
for (let k = 0; k <= n; k++) {
  const t = (k / n) * 0.6 * size, x = +xs + t * Math.cos(a), y = +ys + t * Math.sin(a);
  line += p.tone(x, y) ? '#' : '.';
}
console.log(id, name, 'from', xs, ys, 'at', as, 'deg, 0..0.6 tile sizes:', line, ' plain', m.plain, 'apart', m.apart.toFixed(3), 'loops', m.shapes.length);
for (const s of m.shapes) console.log('  loop', s.pts.length, 'pts', s.hole ? 'hole' : '');
