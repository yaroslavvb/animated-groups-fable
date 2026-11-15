// lab/dbg-field.mjs — the field of a chamber's pair: at points of the chamber, the distances and the rule's terms.
import { BY_ID } from '../../../../../src/groups.js';
import * as D from '../design.js';
const id = process.argv[2] || '*632';
const g = BY_ID[id], u = Math.sqrt(g.domainArea);
const b = D.build(g), T = b.tile;
const K = { ...D.KNOBS, reach: 3 };
// rebuild the sites as build() does
const s = b.seat;
console.log('seat', JSON.stringify({ a: s.a.map((v) => +(v / u).toFixed(3)), b: s.b.map((v) => +(v / u).toFixed(3)), r0: +(s.r0 / u).toFixed(3) }));
const F = D.field(g, [{ x: Float64Array.from(b.site.x.slice(0, 30)), y: Float64Array.from(b.site.y.slice(0, 30)), r: Float64Array.from(b.site.r.slice(0, 30)), n: 30, r0: b.site.r[0], cx: b.site.cx, cy: b.site.cy, R: b.site.R }, { x: Float64Array.from(b.site.x.slice(30)), y: Float64Array.from(b.site.y.slice(30)), r: Float64Array.from(b.site.r.slice(30)), n: 30, r0: b.site.r[30], cx: b.site.cx, cy: b.site.cy, R: b.site.R }], K, T);
console.log('grid', F.nx, F.ny, 'copies', F.copies);
// points: the chamber's corners pulled 25% toward the centroid
const c = T.reduce((q, p) => [q[0] + p[0] / T.length, q[1] + p[1] / T.length], [0, 0]);
for (const p of T) {
  const x = p[0] + 0.25 * (c[0] - p[0]), y = p[1] + 0.25 * (c[1] - p[1]);
  const { ox, oy, ux, uy, vx, vy } = F.fr;
  const i = Math.round(((x - ox) * ux + (y - oy) * uy) / F.h), j = Math.round(((x - ox) * vx + (y - oy) * vy) / F.h), q = j * F.nx + i;
  const f = (v) => (v / u).toFixed(3);
  console.log('point', f(x), f(y), 'own', [0, 1].map((k) => 'D ' + F.own[k][q].toFixed(3) + ' E ' + f(F.eown[k][q])).join(' | '), 'other D', F.oth[q].toFixed(3), 'E', f(F.eoth[q]));
}
