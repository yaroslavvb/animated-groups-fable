// dev/ad-info.mjs — the art director's look at a group's geometry: lattice, tile size, frame origin, mirrors and centres
// near the frame origin, the default tile.   node ad-info.mjs '*632' '*x' ...
import { BY_ID, symmetryElements } from '../../../../../src/groups.js';
import { tileOf } from '../../../kit.js';
import { frameOrigin } from '../design.js';

const f = (v) => (Array.isArray(v) ? '[' + v.map((x) => (+x).toFixed(4)).join(', ') + ']' : (+v).toFixed(4));
for (const id of process.argv.slice(2)) {
  const g = BY_ID[id], s = Math.sqrt(g.domainArea), O = frameOrigin(g);
  console.log(`== ${id}  e1 ${f(g.e1)} e2 ${f(g.e2)} size ${f(s)} cellArea ${f(g.cellArea)} reps ${g.reps.length} center ${f(g.center)} O ${f(O)}`);
  const sym = symmetryElements(g, O[0], O[1], 1.2 * s);
  for (const c of sym.centers) console.log('  centre', c.order, f([c.x, c.y]), c.onMirror ? 'on mirror' : '');
  for (const m of sym.mirrors) console.log('  mirror through', f([m.px, m.py]), 'dir', f([m.ux, m.uy]));
  for (const m of sym.glides) console.log('  glide through', f([m.px, m.py]), 'dir', f([m.ux, m.uy]), 'dist', f(m.dist));
  const t = tileOf(g);
  console.log('  tile', t.poly.map((p) => f(p)).join(' '), 'seed', f(t.seed));
}
