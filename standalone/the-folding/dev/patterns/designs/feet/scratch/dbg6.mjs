// scratch: the registry group's frame, the sole's box, the node version
import { BY_ID } from '../../../../../src/groups.js';
import { tileOf } from '../../../kit.js';
import { find } from '../design.js';
const id = process.argv[2] || '*442';
const g = BY_ID[id], r = find(g), t = tileOf(g);
console.log(process.version, id);
console.log('tile ', t.poly.map((p) => `(${p[0].toFixed(6)},${p[1].toFixed(6)})`).join(' '));
for (const f of r.info.frames) console.log('frame', f.poly.map((p) => `(${p[0].toFixed(6)},${p[1].toFixed(6)})`).join(' '), 'toe', f.toe, 'heel', f.heel);
for (const s of r.shapes) {
  const xs = s.pts.map((p) => p[0]), ys = s.pts.map((p) => p[1]);
  console.log('  poly', s.pts.length, `x ${Math.min(...xs).toFixed(5)}..${Math.max(...xs).toFixed(5)}  y ${Math.min(...ys).toFixed(5)}..${Math.max(...ys).toFixed(5)}`, ' min(y - x)', Math.min(...s.pts.map((p) => p[1] - p[0])).toFixed(5));
}
console.log(JSON.stringify(r.info.feet));
