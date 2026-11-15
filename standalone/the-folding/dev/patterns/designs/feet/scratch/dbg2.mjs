// scratch: one group at one place, its frames in tile sizes
import { BY_ID } from '../../../../../src/groups.js';
import { buildDomain } from '../../../../../src/domain.js';
import { find } from '../design.js';
const findWith = (g) => find(g);
import { moved } from './moved.mjs';
const [id, ang, s, tx, ty] = process.argv.slice(2);
const g0 = BY_ID[id], g = ang === undefined ? g0 : moved(g0, +ang, +s, [+tx, +ty]);
const ts = Math.sqrt(g.domainArea);
const r = findWith(g, {});
console.log(id, 'ts', ts, 'cover', r.info.coverage, 'feet', r.info.feet.length, 'frames', r.info.frames.length);
for (const f of r.info.frames) {
  const c = f.poly[0];
  console.log('  toe', f.toe, 'heel', f.heel, 'poly', f.poly.map((p) => `(${((p[0] - c[0]) / ts).toFixed(4)},${((p[1] - c[1]) / ts).toFixed(4)})`).join(' '));
}
const d = buildDomain(g, { seed: g.center });
console.log('  domain of the centre:', d.poly.length, 'vertices', d.poly.map((p) => `(${((p[0] - d.poly[0][0]) / ts).toFixed(5)},${((p[1] - d.poly[0][1]) / ts).toFixed(5)})`).join(' '));
