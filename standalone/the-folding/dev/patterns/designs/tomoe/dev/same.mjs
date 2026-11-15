import { GROUPS } from '../../../../../src/groups.js';
import { find } from '../design.js';
import { find as find1 } from '../design.v1.js';
for (const g of GROUPS) { const A = find(g).shapes, B = find1(g).shapes; let d = 0, ok = A.length === B.length; for (let k = 0; ok && k < A.length; k++) { if (A[k].pts.length !== B[k].pts.length) { ok = false; break; } for (let i = 0; i < A[k].pts.length; i++) d = Math.max(d, Math.hypot(A[k].pts[i][0] - B[k].pts[i][0], A[k].pts[i][1] - B[k].pts[i][1])); } console.log(g.id.padEnd(6), ok ? 'max diff ' + d.toExponential(1) : 'DIFFERENT SHAPE'); }
