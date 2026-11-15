// scratch: print the info of some groups
import { BY_ID } from '../../../../../src/groups.js';
import { find } from '../design.js';
const findWith = (g) => find(g);
const ids = (process.argv[2] || '*2222').split(',');
for (const id of ids) {
  const g = BY_ID[id], ts = Math.sqrt(g.domainArea), r = findWith(g, {});
  console.log(id, 'lean', r.info.lean, 'wider', r.info.wider, 'cover', r.info.coverage.toFixed(3), JSON.stringify(r.info.feet));
  for (const s of r.shapes) {
    const xs = s.pts.map((p) => p[0] / ts), ys = s.pts.map((p) => p[1] / ts);
    console.log('   poly', s.pts.length, 'pts  box', (Math.max(...xs) - Math.min(...xs)).toFixed(3), 'x', (Math.max(...ys) - Math.min(...ys)).toFixed(3));
  }
}
