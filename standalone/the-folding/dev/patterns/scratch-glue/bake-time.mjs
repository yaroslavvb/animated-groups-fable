// bake-time.mjs — how long bakeShapes takes per group (node; the page's comma drawn with 2400 points, and the demo comma)
import { GROUPS } from '../../../src/groups.js';
import { motifFor, commaOutline } from '../../../src/motif.js';
import { makeShapePrint, bakeShapes, copiesIn, BAKE_SIZE } from '../../../src/shapes.js';
const unit = commaOutline({ nBack: 1200, nHollow: 600, nHead: 600 });
const rows = [];
for (const g of GROUPS) {
  const m = motifFor(g), co = Math.cos(m.angle), si = Math.sin(m.angle), pts = [];
  for (let i = 0; i + 2 < unit.length; i += 2) { const x = m.scale[0] * unit[i], y = m.scale[1] * unit[i + 1]; pts.push([m.at[0] + co * x - si * y, m.at[1] + si * x + co * y]); }
  const t = [];
  for (const size of [1024, 512, 2048]) {
    let best = Infinity, first = 0, T;
    for (let k = 0; k < 4; k++) {
      const P = makeShapePrint(g, { shapes: [pts] });       // a new print each time: no cache
      const t0 = performance.now(); T = bakeShapes(P, size); const dt = performance.now() - t0;
      if (!k) first = dt; best = Math.min(best, dt);
    }
    t.push(`${size}: first ${first.toFixed(1)} best ${best.toFixed(1)} ms`);
    if (size === 1024) rows.push(`${g.id.padEnd(6)} texture cell ${T.e1.map((v) => v.toFixed(2))} | ${T.e2.map((v) => v.toFixed(2))}  pitch ${(T.pitch / Math.sqrt(g.domainArea)).toFixed(5)} tiles  range ${(T.range / Math.sqrt(g.domainArea)).toFixed(4)} tiles`);
  }
  console.log(g.id.padEnd(6), pts.length, 'verts', t.join(' | '));
}
console.log(rows.join('\n'));
