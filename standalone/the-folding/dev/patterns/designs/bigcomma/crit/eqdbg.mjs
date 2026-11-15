// crit/eqdbg.mjs — where the motif of a moved group differs from the moved motif: node crit/eqdbg.mjs <id>
import { BY_ID } from '../../../../../src/groups.js';
import { compose, inverse, iso } from '../../../../../src/geom.js';
import { find, KNOBS } from '../design.js';
const id = process.argv[2] || '**';
KNOBS.debug = true;
const g = BY_ID[id];
function moved(g, ang, k, tx, ty) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const P = (v) => [k * (c * v[0] - s * v[1]), k * (s * v[0] + c * v[1])], T = (p) => { const q = P(p); return [q[0] + tx, q[1] + ty]; };
  const R = iso(c, -s, s, c, 0, 0), Ri = inverse(R);
  const reps = g.reps.map((r) => { const L = compose(R, compose(iso(r.a, r.b, r.c, r.d, 0, 0), Ri)); const o = T([0, 0]); const r0 = T([r.tx, r.ty]); return { a: L.a, b: L.b, c: L.c, d: L.d, tx: r0[0] - (L.a * o[0] + L.b * o[1]), ty: r0[1] - (L.c * o[0] + L.d * o[1]) }; });
  const Tinv = (p) => { const q = [(p[0] - tx) / k, (p[1] - ty) / k]; return [c * q[0] + s * q[1], -s * q[0] + c * q[1]]; };
  return { group: { id: g.id, e1: P(g.e1), e2: P(g.e2), reps, cellArea: g.cellArea * k * k, domainArea: g.domainArea * k * k, center: T(g.center) }, Tinv };
}
const bare = { id: g.id, e1: g.e1, e2: g.e2, reps: g.reps, cellArea: g.cellArea, domainArea: g.domainArea, center: g.center };
const a = find(bare);
const m = moved(g, (37 * Math.PI) / 180, 1.7, 3.1, -2.2), b = find(m.group);
const cen = (pts) => { let x = 0, y = 0; for (const p of pts) { x += p[0] / pts.length; y += p[1] / pts.length; } return [x, y]; };
console.log('bare  info', JSON.stringify({ ...a.info, log: undefined }));
console.log('moved info', JSON.stringify({ ...b.info, log: undefined }));
a.shapes.forEach((sh, i) => { const ca = cen(sh.pts), cb = cen((b.shapes[i] || sh).pts.map(m.Tinv)); console.log('shape', i, sh.hole ? 'hole' : '', 'bare', ca.map((v) => v.toFixed(4)).join(','), 'moved back', cb.map((v) => v.toFixed(4)).join(','), 'n', sh.pts.length, (b.shapes[i] || {}).pts?.length); });
for (const l of a.info.log || []) if (l.startsWith('grown')) console.log('A', l);
for (const l of b.info.log || []) if (l.startsWith('grown')) console.log('B', l);
