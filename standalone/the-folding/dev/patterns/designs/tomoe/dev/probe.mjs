// node dev/probe.mjs <id> <edge> — the tone along lines parallel to one edge of the default tile, at offsets across it
// (tile sizes; + is outward), sampled along the edge: a map of dark (#) and light (.) to see what lies at a seam.
import { BY_ID } from '../../../../../src/groups.js';
import { normalize, toneAt, tileOf } from '../../../kit.js';
import { find } from '../design.js';

const g = BY_ID[process.argv[2]], k = +process.argv[3] || 0, s = Math.sqrt(g.domainArea);
const N = normalize(find(g).shapes);
let P = tileOf(g).poly.map((p) => [p[0], p[1]]);
let A = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; A += p[0] * q[1] - p[1] * q[0]; }
if (A < 0) P.reverse();
const a = P[k % P.length], b = P[(k + 1) % P.length], e = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(...e), u = [e[0] / L, e[1] / L], n = [u[1], -u[0]];
console.log(`edge ${k}: length ${(L / s).toFixed(3)} tile sizes; rows: offset across (+ out), columns: along the edge`);
for (let off = 0.3; off >= -0.3001; off -= 0.03) {
  let row = '';
  for (let t = -0.1; t <= 1.1001; t += 0.02) {
    const x = a[0] + t * e[0] + off * s * n[0], y = a[1] + t * e[1] + off * s * n[1];
    row += toneAt(g, N, x, y) ? '#' : '.';
  }
  console.log(`${off >= 0 ? '+' : ''}${off.toFixed(2)} ${row}`);
}
