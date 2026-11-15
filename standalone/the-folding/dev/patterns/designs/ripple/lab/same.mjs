// designs/ripple/lab/same.mjs — does design.js with the first run's knobs give design.v1.js's motif? (the critique of
// 13 Nov 2026: the new steps are switchable, so the old field must come back exactly)
//   node dev/patterns/designs/ripple/lab/same.mjs
import { GROUPS } from '../../../../../src/groups.js';
import { find } from '../design.js';
import { find as find1 } from '../design.v1.js';
let worst = 0;
for (const g of GROUPS) {
  const a = find(g, { EXACT: false, BLUR: 0, PETAL0: 0.008 }).shapes, b = find1(g).shapes;
  let off = a.length === b.length ? 0 : Infinity;
  for (let i = 0; i < a.length && off < Infinity; i++) {
    if (a[i].pts.length !== b[i].pts.length || a[i].hole !== b[i].hole) { off = Infinity; break; }
    for (let k = 0; k < a[i].pts.length; k++) off = Math.max(off, Math.hypot(a[i].pts[k][0] - b[i].pts[k][0], a[i].pts[k][1] - b[i].pts[k][1]));
  }
  worst = Math.max(worst, off);
  console.log(g.id.padEnd(6), a.length, b.length, off === Infinity ? 'DIFFERENT' : 'off ' + off.toExponential(1));
}
console.log('worst', worst);
