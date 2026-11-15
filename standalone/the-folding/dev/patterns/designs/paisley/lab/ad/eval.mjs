// lab/ad/eval.mjs — one table for a round of the second version: per group the marks (length, head), find()'s own dark
// share and bare disc, the production check (validateShapes of src/shapes.js: ok, smallest gap), the exact dark share
// and the time (the best of three calls, in node on this Mac: the mini's Chrome is about three times faster).
//   node dev/patterns/designs/paisley/lab/ad/eval.mjs [--design ../../design.js] [--ids o,2222] [--bare 1] [--knobs '{"floor":0.3}']
import { GROUPS, BY_ID } from '../../../../../../src/groups.js';
import { makeShapePrint, validateShapes } from '../../../../../../src/shapes.js';
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const mod = await import(opt.design || '../../design.js');
if (opt.knobs) { for (const [k, v] of Object.entries(JSON.parse(opt.knobs))) { if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(mod.KNOBS[k], v); else mod.KNOBS[k] = v; } if (mod.resetShapes) mod.resetShapes(); }
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);
const W = { cmin: 1, cmax: 0, bare: 0, gap: 9, ms: 0, verts: 0, small: 0, marks: 0, main: 9, bad: 0, five: 0 };
for (const id of ids) {
  const G0 = BY_ID[id], G = opt.bare ? { id: G0.id, e1: G0.e1, e2: G0.e2, reps: G0.reps, cellArea: G0.cellArea, domainArea: G0.domainArea, center: G0.center } : G0;
  let res, ms = Infinity;
  for (let r = 0; r < 3; r++) { const t0 = performance.now(); res = mod.find(G); ms = Math.min(ms, performance.now() - t0); }
  const I = res.info || {};
  let v = { ok: false, gap: 0, problems: ['no shapes'], stabilizer: 1 }, exact = 0, verts = 0;
  if (res.shapes.length) {
    const print = makeShapePrint(G0, { key: 'paisley', name: 'paisley', shapes: res.shapes });
    v = validateShapes(print);
    exact = print.polys.reduce((a, P) => a + (P.hole ? -P.area : P.area), 0) / (v.stabilizer * G0.domainArea);
    verts = print.verts;
  }
  const long = I.long || [], head = I.head || [];
  const small = long.filter((l, k) => l < 0.3 || head[k] < 0.13).length;
  W.cmin = Math.min(W.cmin, exact); W.cmax = Math.max(W.cmax, exact); W.bare = Math.max(W.bare, I.bare || 9); W.gap = Math.min(W.gap, v.gap); W.ms = Math.max(W.ms, ms);
  W.verts = Math.max(W.verts, verts); W.small += small; W.marks += long.length; W.main = Math.min(W.main, long[0] || 0); if (!v.ok) W.bad++; if (long.length > 4) W.five++;
  console.log(id.padEnd(6), v.ok ? 'ok ' : 'BAD', `dark ${exact.toFixed(3)} bare ${(I.bare ?? 0).toFixed(3)} gap ${v.gap.toFixed(3)} n ${long.length}`.padEnd(46),
    long.map((l, k) => `${l.toFixed(2)}/${(head[k] ?? 0).toFixed(2)}${I.st ? (I.st[k] ? 's' : 'l') : ''}${I.e ? '@' + I.e[k] : ''}`).join(' ').padEnd(60), `${ms.toFixed(0)}ms`.padStart(6), `${verts}v`, I.stop || '', (I.tried || []).length + ' starts', v.ok ? '' : v.problems.join(' | '));
}
console.log(`worst: dark ${W.cmin.toFixed(3)}..${W.cmax.toFixed(3)}  bare ${W.bare.toFixed(3)}  gap ${W.gap.toFixed(3)}  ms ${W.ms.toFixed(0)}  verts ${W.verts}  marks ${W.marks} (small ${W.small}, groups with 5+ ${W.five})  main >= ${W.main.toFixed(2)}  bad ${W.bad}`);
