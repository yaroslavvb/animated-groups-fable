// scratch: the default tile and the symmetry elements of every group, in world units and in tile sizes
import { GROUPS, symmetryElements } from '../../../../../src/groups.js';
import { tileOf } from '../../../kit.js';

const f = (v) => (Math.round(v * 1000) / 1000).toFixed(3);
for (const g of GROUPS) {
  const ts = Math.sqrt(g.domainArea);
  const t = tileOf(g);
  console.log(`\n== ${g.id}  e1=(${g.e1.map(f)}) e2=(${g.e2.map(f)}) reps=${g.reps.length} ts=${f(ts)} center=(${g.center.map(f)}) viewHalf=${g.viewHalf}`);
  console.log('  seed', t.seed.map(f).join(','), ' tile:', t.poly.map((p) => `(${f(p[0])},${f(p[1])})`).join(' '));
  const xs = t.poly.map((p) => p[0]), ys = t.poly.map((p) => p[1]);
  console.log(`  bbox ${f(Math.max(...xs) - Math.min(...xs))} x ${f(Math.max(...ys) - Math.min(...ys))}  = ${f((Math.max(...xs) - Math.min(...xs)) / ts)} x ${f((Math.max(...ys) - Math.min(...ys)) / ts)} ts`);
  console.log('  edges:', t.domain.edges.map((e) => `${e.kind}${e.halfTurn ? '(2)' : ''}:${f(e.len / ts)}`).join(' '));
  const S = symmetryElements(g, t.seed[0], t.seed[1], 1.2 * ts);
  console.log('  centres:', S.centers.map((c) => `${c.order}@(${f(c.x)},${f(c.y)})${c.onMirror ? 'm' : ''}`).join(' '));
  console.log('  mirrors:', S.mirrors.map((m) => `(${f(m.px)},${f(m.py)})dir(${f(m.ux)},${f(m.uy)})`).join(' '));
  console.log('  glides:', S.glides.map((m) => `(${f(m.px)},${f(m.py)})dir(${f(m.ux)},${f(m.uy)})d=${f(m.dist)}`).join(' '));
}
