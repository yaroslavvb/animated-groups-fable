// scratch: 2222 at a far place: the frame in lattice coordinates round the group's centre
import { BY_ID, latticeCoords } from '../../../../../src/groups.js';
import { find } from '../design.js';
const findWith = (g) => find(g);
import { moved } from './moved.mjs';
const [ang, s, tx, ty] = process.argv.slice(2).map(Number);
const g = moved(BY_ID['2222'], ang, s, [tx, ty]);
const r = findWith(g, {});
for (const f of r.info.frames) console.log(f.poly.map((p) => { const st = latticeCoords(g, p[0] - g.center[0], p[1] - g.center[1]); return `(${st[0].toFixed(4)},${st[1].toFixed(4)})`; }).join(' '), 'toe', f.toe, 'heel', f.heel);
