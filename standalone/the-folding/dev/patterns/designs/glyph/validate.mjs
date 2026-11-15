// dev/patterns/designs/glyph/validate.mjs — the design through the production checks of src/shapes.js (another agent's
// module of the same round: validateShapes states the kit's rules exactly, with the gap measured outline to outline).
//   node dev/patterns/designs/glyph/validate.mjs [moved=1]
import { GROUPS } from '../../../../src/groups.js';
import { makeShapePrint, validateShapes, measureShapes } from '../../../../src/shapes.js';
import { find } from './design.js';

const arg = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
function moved(g, ang, sc, dx, dy) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const V = (v) => [sc * (c * v[0] - s * v[1]), sc * (s * v[0] + c * v[1])];
  const reps = g.reps.map((r) => {
    const a = r.a, b = r.b, cc = r.c, d = r.d;
    const la = c * (a * c - b * s) - s * (cc * c - d * s), lb = c * (a * s + b * c) - s * (cc * s + d * c);
    const lc = s * (a * c - b * s) + c * (cc * c - d * s), ld = s * (a * s + b * c) + c * (cc * s + d * c);
    const t = V([r.tx, r.ty]);
    return { a: la, b: lb, c: lc, d: ld, tx: t[0] + dx - (la * dx + lb * dy), ty: t[1] + dy - (lc * dx + ld * dy) };
  });
  const e1 = V(g.e1), e2 = V(g.e2), cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]), P = V(g.center);
  return { id: g.id, e1, e2, reps, cellArea, domainArea: cellArea / reps.length, center: [P[0] + dx, P[1] + dy] };
}
let bad = 0;
for (const g0 of GROUPS) {
  const g = arg.moved ? moved(g0, 1.234, 1.7, 0.4, -0.9) : g0;
  try {
    const res = find(g), P = makeShapePrint(g, { key: 'glyph', name: 'Letter F', shapes: res.shapes, info: res.info });
    const v = validateShapes(P);                               // v.gap: in tile sizes
    const m = arg.measure ? measureShapes(P, { per: 40 }) : {};
    if (!v.ok) bad++;
    console.log(g.id.padEnd(6), v.ok ? 'ok ' : 'BAD', 'gap', v.gap.toFixed(3), 'stab', v.stabilizer, v.problems.join(' | ').slice(0, 300), arg.measure ? JSON.stringify(m) : '');
  } catch (e) { bad++; console.log(g.id.padEnd(6), 'THROWS', String(e && e.message || e).slice(0, 300)); }
}
console.log(bad ? bad + ' groups fail' : 'all 17 pass validateShapes');
