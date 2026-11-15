// lab/r5/frame-reps.mjs — the coset representatives of a group in its own frame, classified (to seat strokes by hand).
//   node lab/r5/frame-reps.mjs '*x'
import { BY_ID, classify } from '../../../../../../src/groups.js';
import { frameOf } from '../../design.js';

const id = process.argv[2], g = BY_ID[id], F = frameOf(g);
const r3 = (v) => Math.round(v * 1000) / 1000;
console.log(id, 'E1', F.E1.map(r3), 'E2', F.E2.map(r3));
for (const r of F.reps) {
  const k = classify(r);
  console.log(JSON.stringify({ a: r3(r.a), b: r3(r.b), c: r3(r.c), d: r3(r.d), tx: r3(r.tx), ty: r3(r.ty) }), k.type, k.point ? k.point.map(r3) : '', k.dir ? k.dir.map(r3) : '', k.order || '', k.dist !== undefined ? r3(k.dist) : '');
}
