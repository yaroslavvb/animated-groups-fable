// node dev/bendcheck.mjs [ids] [bends]  — kit.measure (dark, bare, solid) of the groups for a few values of the knob bend,
// plus validity and THIN at 1.5 texels. A few seconds; keep the lists short.
import { BY_ID } from '../../../../../src/groups.js';
import { normalize, measure } from '../../../kit.js';
import { findWith } from '../design.js';
import { makeShapePrint, validateShapes, thinParts, bakeShapes } from '../../../../../src/shapes.js';

const ids = (process.argv[2] || 'o,2222,xx,333,22x,442,632').split(','), bends = (process.argv[3] || '0.1,0.14,0.18').split(',').map(Number);
for (const id of ids) {
  const g = BY_ID[id], row = [];
  for (const b of bends) {
    const res = findWith(g, { bend: b }), P = makeShapePrint(g, { key: 'x', shapes: res.shapes }), V = validateShapes(P);
    const pitch = bakeShapes(P).pitch, thin = thinParts(P, 1.5 * pitch).filter((r) => r.length / pitch > 6).length;
    const m = measure(g, normalize(res.shapes), { per: 48 });
    row.push(`b${b}: ${V.ok ? '' : 'BAD '}dark ${m.coverage} bare ${m.emptyDisc} solid ${m.darkDisc}${thin ? ' THIN ' + thin : ''}`);
  }
  console.log(id.padEnd(5), row.join(' | '));
}
