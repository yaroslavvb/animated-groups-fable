// lab/determinism.mjs — find() gives the same polygons whatever was asked before (twice, and in the reverse order).
import { GROUPS } from '../../../../../src/groups.js';
import { find } from '../design.js';
const key = (r) => JSON.stringify(r.shapes.map((s) => s.pts.map((p) => [Math.round(p[0] * 1e12), Math.round(p[1] * 1e12)])));
const first = new Map();
for (const g of GROUPS) first.set(g.id, key(find(g)));
let diff = 0;
for (const g of GROUPS) if (key(find(g)) !== first.get(g.id)) { diff++; console.log('differs on the second call:', g.id); }
for (const g of [...GROUPS].reverse()) if (key(find(g)) !== first.get(g.id)) { diff++; console.log('differs in reverse order:', g.id); }
// and the group object is not written to
const g0 = GROUPS[5], before = JSON.stringify({ e1: g0.e1, e2: g0.e2, reps: g0.reps, center: g0.center, presets: g0.presets });
find(g0);
if (JSON.stringify({ e1: g0.e1, e2: g0.e2, reps: g0.reps, center: g0.center, presets: g0.presets }) !== before) { diff++; console.log('the group was changed'); }
console.log(diff ? `NOT deterministic: ${diff}` : 'deterministic: the same polygons on every call, in any order; the group is left as it was');
