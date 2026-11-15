// crit/roomeq.mjs — is the room of a moved group the moved room? node crit/roomeq.mjs <id>
import { BY_ID, latticeCoords } from '../../../../../src/groups.js';
import { compose, inverse, iso } from '../../../../../src/geom.js';
import { roomOf } from '../design.js';
const g = BY_ID[process.argv[2] || '**'];
function moved(g, ang, k, tx, ty) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const P = (v) => [k * (c * v[0] - s * v[1]), k * (s * v[0] + c * v[1])], T = (p) => { const q = P(p); return [q[0] + tx, q[1] + ty]; };
  const R = iso(c, -s, s, c, 0, 0), Ri = inverse(R);
  const reps = g.reps.map((r) => { const L = compose(R, compose(iso(r.a, r.b, r.c, r.d, 0, 0), Ri)); const o = T([0, 0]); const r0 = T([r.tx, r.ty]); return { a: L.a, b: L.b, c: L.c, d: L.d, tx: r0[0] - (L.a * o[0] + L.b * o[1]), ty: r0[1] - (L.c * o[0] + L.d * o[1]) }; });
  return { id: g.id, e1: P(g.e1), e2: P(g.e2), reps, cellArea: g.cellArea * k * k, domainArea: g.domainArea * k * k, center: T(g.center) };
}
const bare = { id: g.id, e1: g.e1, e2: g.e2, reps: g.reps, cellArea: g.cellArea, domainArea: g.domainArea, center: g.center };
for (const G of [bare, moved(g, (37 * Math.PI) / 180, 1.7, 3.1, -2.2), moved(g, (-112 * Math.PI) / 180, 0.4, -50, 80)]) {
  const r = roomOf(G);
  console.log(r.poly.map((p) => latticeCoords(G, p[0] - G.center[0], p[1] - G.center[1]).map((v) => v.toFixed(6)).join('/')).join('  '));
}
