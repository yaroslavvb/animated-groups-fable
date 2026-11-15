// node dev/gluedbg.mjs <id> — how many edges find() treats as mirrors on the page's group and on a copy without presets.
import { BY_ID, elementsNear } from '../../../../../src/groups.js';
import { find } from '../design.js';

const g = BY_ID[process.argv[2] || '632'];
const strip = { id: g.id, e1: g.e1, e2: g.e2, reps: g.reps, cellArea: g.cellArea, domainArea: g.domainArea, center: g.center };
for (const [name, grp] of [['page', g], ['no presets', strip]]) {
  const r = find(grp);
  console.log(name, 'mirrors', r.info.mirrors.length, 'rB', r.info.rB.toFixed(3), 'rA', r.info.rA.toFixed(3), 'a', r.info.a.map((x) => x.toFixed(4)).join(','), 'b', r.info.b.map((x) => x.toFixed(4)).join(','));
}
console.log('elementsNear with and without presets:', elementsNear(g, 0.5, 0.15, 1).length, elementsNear(strip, 0.5, 0.15, 1).length);
