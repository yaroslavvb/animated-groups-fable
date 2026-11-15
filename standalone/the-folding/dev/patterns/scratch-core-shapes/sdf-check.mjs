// scratch (core-shapes): copiesIn -> src/sdf.js bakeSDF (another agent's module, as it is now, read only). For a lattice
// cell of every group and three motifs: is every texel's byte the one that print.winding and print.margin give?
//   value = round(128 + 127 * clamp(sd / range, -1, 1)),  sd = -margin where dark, +margin where light
import { GROUPS } from '../../../src/groups.js';
import { makeShapePrint, copiesIn } from '../../../src/shapes.js';
import { bakeSDF } from '../../../src/sdf.js';
import { commaShapes, blobShapes, symmetricShapes } from './motifs.js';
const SIZE = 96;
let texels = 0, off1 = 0, bad = 0, polysTotal = 0, ms = 0;
for (const g of GROUPS) {
  const list = [['comma', commaShapes(g)], ['blob', blobShapes(g).shapes]];
  const c = symmetricShapes(g, 'centre') || symmetricShapes(g, 'mirror');
  if (c) list.push(['on a centre or mirror', c.shapes]);
  for (const [name, shapes] of list) {
    const P = makeShapePrint(g, { shapes }), range = 0.08 * P.size, e1 = g.e1, e2 = g.e2;
    const xs = [0, e1[0], e2[0], e1[0] + e2[0]], ys = [0, e1[1], e2[1], e1[1] + e2[1]];
    const box = [Math.min(...xs) - range, Math.min(...ys) - range, Math.max(...xs) + range, Math.max(...ys) + range];
    const polys = copiesIn(P, box);
    polysTotal += polys.length;
    const t0 = performance.now();
    const tex = bakeSDF({ origin: [0, 0], e1, e2, size: SIZE, range, polys });
    ms += performance.now() - t0;
    let worst = 0, badHere = 0;
    for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) {
      const s = (i + 0.5) / SIZE, t = (j + 0.5) / SIZE, x = s * e1[0] + t * e2[0], y = s * e1[1] + t * e2[1];
      const m = P.margin(x, y), sd = P.winding(x, y) > 0 ? -m : m, want = 128 + 127 * Math.max(-1, Math.min(1, sd / range)), got = tex[j * SIZE + i];
      texels++;
      const d = Math.abs(got - want);
      if (d > 0.5 + 1e-6) { if (d <= 1.5) off1++; else { bad++; badHere++; } }
      worst = Math.max(worst, d);
    }
    if (badHere) console.log(`${g.id} ${name}: ${badHere} texels differ by more than a step (worst ${worst.toFixed(2)})`);
  }
}
console.log(`${texels} texels of ${SIZE} x ${SIZE} textures: ${bad} differ from round(128 + 127 sd / range) by more than one step, ${off1} by one step (a tie in the rounding); ${polysTotal} polygons from copiesIn; bakeSDF took ${ms.toFixed(0)} ms in all`);
