// scratch: in *442, which two edges does the check take for crossing under the diagonal mirror?
import { BY_ID } from '../../../../../src/groups.js';
import { normalize } from '../../../kit.js';
import { find } from '../design.js';
const g = BY_ID['*442'], N = normalize(find(g).shapes);
const e = g.reps.find((r) => Math.abs(r.b - 1) < 1e-9 && Math.abs(r.c - 1) < 1e-9 && Math.abs(r.tx) < 1e-9 && Math.abs(r.ty) < 1e-9);
console.log(process.version, 'element', JSON.stringify(e));
const o = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
let n = 0;
for (const P of N.polys) for (const Q of N.polys) {
  const p = P.pts, q = Q.pts, np = p.length / 2, nq = q.length / 2;
  for (let i = 0; i < np && n < 5; i++) for (let j = 0; j < nq && n < 5; j++) {
    const i2 = (i + 1) % np, j2 = (j + 1) % nq;
    const ax = p[2 * i], ay = p[2 * i + 1], bx = p[2 * i2], by = p[2 * i2 + 1];
    const cx = e.a * q[2 * j] + e.b * q[2 * j + 1] + e.tx, cy = e.c * q[2 * j] + e.d * q[2 * j + 1] + e.ty;
    const dx = e.a * q[2 * j2] + e.b * q[2 * j2 + 1] + e.tx, dy = e.c * q[2 * j2] + e.d * q[2 * j2 + 1] + e.ty;
    const o1 = o(ax, ay, bx, by, cx, cy), o2 = o(ax, ay, bx, by, dx, dy), o3 = o(cx, cy, dx, dy, ax, ay), o4 = o(cx, cy, dx, dy, bx, by);
    if (Math.sign(o1) !== Math.sign(o2) && Math.sign(o3) !== Math.sign(o4)) { n++; console.log('cross?', [ax, ay, bx, by], [cx, cy, dx, dy], [o1, o2, o3, o4]); }
  }
}
console.log(n, 'pairs');
