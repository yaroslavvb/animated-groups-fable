// lab/geo.mjs — the geometry of each group, in tile sizes u = sqrt(domainArea): the lattice, the default tile, the
// rotation centres and mirrors near it. For planning seats.  node lab/geo.mjs [ids]
import { GROUPS, BY_ID, symmetryElements } from '../../../../../src/groups.js';
import { tileOf } from '../../../kit.js';

const ids = process.argv[2] ? process.argv[2].split(',') : GROUPS.map((g) => g.id);
const f = (v) => (Math.round(v * 1000) / 1000).toFixed(3);
for (const id of ids) {
  const g = BY_ID[id], u = Math.sqrt(g.domainArea);
  const T = tileOf(g).poly;
  let cx = 0, cy = 0; for (const p of T) { cx += p[0]; cy += p[1]; } cx /= T.length; cy /= T.length;
  const l1 = Math.hypot(...g.e1) / u, l2 = Math.hypot(...g.e2) / u;
  const ang = (Math.acos((g.e1[0] * g.e2[0] + g.e1[1] * g.e2[1]) / (Math.hypot(...g.e1) * Math.hypot(...g.e2))) * 180) / Math.PI;
  console.log(`== ${id}  reps ${g.reps.length}  |e1| ${f(l1)} |e2| ${f(l2)} angle ${ang.toFixed(1)}  seed ${g.presets[0].seed.map((v) => f(v / u))} tileC ${f(cx / u)},${f(cy / u)}`);
  console.log('   tile: ' + T.map((p) => '(' + f((p[0] - cx) / u) + ',' + f((p[1] - cy) / u) + ')').join(' '));
  const S = symmetryElements(g, cx, cy, 1.0 * u);
  const cs = S.centers.map((c) => `${c.order}${c.onMirror ? 'm' : ''}@(${f((c.x - cx) / u)},${f((c.y - cy) / u)})`);
  console.log('   centres: ' + cs.join(' '));
  console.log('   mirrors: ' + S.mirrors.map((m) => `[${f((m.px - cx) / u)},${f((m.py - cy) / u)} dir ${f(m.ux)},${f(m.uy)}]`).join(' '));
  console.log('   glides: ' + S.glides.map((m) => `[${f((m.px - cx) / u)},${f((m.py - cy) / u)} dir ${f(m.ux)},${f(m.uy)} d ${f(m.dist / u)}]`).join(' '));
}
