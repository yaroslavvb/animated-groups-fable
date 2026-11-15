// scratch: which element of a moved group brings a copy of the motif onto the motif?
import { BY_ID, elementsNear, classify } from '../../../../../src/groups.js';
import { normalize } from '../../../kit.js';
import { find } from '../design.js';
import { moved } from './moved.mjs';
const [id, ang, s, tx, ty] = process.argv.slice(2);
const g = moved(BY_ID[id], +ang, +s, [+tx, +ty]), ts = Math.sqrt(g.domainArea);
const res = find(g), N = normalize(res.shapes);
console.log('frame', res.info.frames[0].poly.map((p) => `(${((p[0] - g.center[0]) / ts).toFixed(5)},${((p[1] - g.center[1]) / ts).toFixed(5)})`).join(' '));
const inside = (p, x, y) => { let inn = false; for (let i = 0, n = p.length / 2, j = n - 1; i < n; j = i++) { const yi = p[2 * i + 1], yj = p[2 * j + 1]; if ((yi > y) !== (yj > y) && x < p[2 * i] + ((y - yi) * (p[2 * j] - p[2 * i])) / (yj - yi)) inn = !inn; } return inn; };
let n = 0;
for (const e of elementsNear(g, N.cx, N.cy, 2 * N.R + 0.5 * ts, N.cx, N.cy)) {
  // does the image of a vertex of the sole fall inside the sole?
  const P = N.polys[0].pts;
  let hit = 0;
  for (let i = 0; i < P.length; i += 2) if (inside(P, e.a * P[i] + e.b * P[i + 1] + e.tx, e.c * P[i] + e.d * P[i + 1] + e.ty)) hit++;
  if (hit) { n++; const c = classify(e); console.log('hit', hit, 'of', P.length / 2, c.type, c.type === 'identity' ? '' : JSON.stringify(c), 'raw', e.a.toFixed(12), e.b.toFixed(12), e.tx, e.ty); }
}
console.log(n, 'elements bring the sole onto itself');
