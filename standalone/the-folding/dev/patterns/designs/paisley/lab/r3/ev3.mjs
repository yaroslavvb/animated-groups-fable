// lab/r3/ev3.mjs — the polish round's table (14 Nov 2026): per group the marks (length / head across / tip across, s =
// stout), the exact dark share, find()'s own largest bare disc, the production checks of src/shapes.js (validateShapes:
// ok and the smallest gap; printable; thinParts at 1.5 texels), the start that won, and the time (best of two, node on
// this Mac; the mini's Chrome is about twice as fast).
//   node lab/r3/ev3.mjs [--design design.js] [--ids o,2222] [--bare 1] [--knobs '{"floor":0.3}'] [--reps 2]
import { GROUPS, BY_ID } from '../../../../../../src/groups.js';
import { makeShapePrint, validateShapes, printable, thinParts, bakeShapes } from '../../../../../../src/shapes.js';
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const mod = await import('../../' + (opt.design || 'design.js'));
if (opt.knobs) { for (const [k, v] of Object.entries(JSON.parse(opt.knobs))) { if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(mod.KNOBS[k], v); else mod.KNOBS[k] = v; } if (mod.resetShapes) mod.resetShapes(); }
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id), reps = +(opt.reps || 2);
const W = { cmin: 1, cmax: 0, bare: 0, gap: 9, ms: 0, verts: 0, marks: 0, main: 9, bad: 0, four: 0, thin: 0, tip: 9, long: 9 };
for (const id of ids) {
  const G0 = BY_ID[id], G = opt.bare ? { id: G0.id, e1: G0.e1, e2: G0.e2, reps: G0.reps, cellArea: G0.cellArea, domainArea: G0.domainArea, center: G0.center } : G0;
  let res, ms = Infinity;
  for (let r = 0; r < reps; r++) { const t0 = performance.now(); res = mod.find(G); ms = Math.min(ms, performance.now() - t0); }
  const I = res.info || {};
  let v = { ok: false, gap: 0, problems: ['no shapes'] }, exact = 0, verts = 0, pr = null, thin = [];
  if (res.shapes.length) {
    const print = makeShapePrint(G0, { key: 'paisley', name: 'paisley', shapes: res.shapes });
    v = validateShapes(print);
    pr = printable(print);
    exact = print.polys.reduce((a, P) => a + (P.hole ? -P.area : P.area), 0) / ((v.stabilizer || 1) * G0.domainArea);
    verts = print.verts;
    const pitch = bakeShapes(print).pitch;
    thin = thinParts(print, 1.5 * pitch).filter((r) => r.length / pitch > 6);
  }
  const long = I.long || [], head = I.head || [], st = I.st || [], tip = I.tip || [];
  const desc = long.map((l, k) => `${l.toFixed(2)}/${(head[k] ?? 0).toFixed(2)}/${(tip[k] ?? 0).toFixed(3)}${st[k] ? 's' : ''}`);
  const win = I.tried ? I.tried.reduce((b, t, k) => (t.flaw < I.tried[b].flaw - 1e-9 ? k : b), 0) : -1;
  W.cmin = Math.min(W.cmin, exact); W.cmax = Math.max(W.cmax, exact); W.bare = Math.max(W.bare, I.bare || 9); W.gap = Math.min(W.gap, v.gap); W.ms = Math.max(W.ms, ms);
  W.verts = Math.max(W.verts, verts); W.marks += long.length; W.main = Math.min(W.main, long[0] || 0); if (!v.ok) W.bad++; if (long.length > 3) W.four++; if (thin.length) W.thin++;
  for (let k = 0; k < long.length; k++) { W.tip = Math.min(W.tip, tip[k] ?? 9); W.long = Math.min(W.long, long[k]); }
  console.log(id.padEnd(6), v.ok ? 'ok ' : 'BAD', pr && pr.ok === false ? 'UNPRINTABLE' : '', `dark ${exact.toFixed(3)} bare ${(I.bare ?? 0).toFixed(3)} gap ${v.gap.toFixed(3)} n ${long.length}`.padEnd(40),
    desc.join(' ').padEnd(78), `${ms.toFixed(0)}ms`.padStart(6), `${verts}v`, (I.stop || '').padEnd(6), `${(I.tried || []).length}st win ${win >= 0 ? I.tried[win].kind : '-'}`, thin.length ? `THIN ${thin.length}` : '', v.ok ? '' : v.problems.slice(0, 2).join(' | '));
}
console.log(`worst: dark ${W.cmin.toFixed(3)}..${W.cmax.toFixed(3)}  bare ${W.bare.toFixed(3)}  gap ${W.gap.toFixed(3)}  ms ${W.ms.toFixed(0)}  verts ${W.verts}  marks ${W.marks} (groups with 4: ${W.four})  shortest ${W.long.toFixed(2)}  thinnest tip ${W.tip.toFixed(3)}  main >= ${W.main.toFixed(2)}  bad ${W.bad}  thin groups ${W.thin}`);
