// dev/patterns/designs/glyph/check.mjs — a quick look at the design without a browser: time, vertices, the kit's numbers
// on a coarse grid.   node dev/patterns/designs/glyph/check.mjs [per=20] [ids=o,333] [moved=1]
import { GROUPS, BY_ID } from '../../../../src/groups.js';
import { normalize, measure, toneAt } from '../../kit.js';
import { find } from './design.js';

const arg = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
const per = +arg.per || 20;
const ids = arg.ids ? arg.ids.split(',') : GROUPS.map((g) => g.id);

function moved(g, ang, sc, dx, dy) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const P = (v) => [sc * (c * v[0] - s * v[1]) + dx, sc * (s * v[0] + c * v[1]) + dy];
  const V = (v) => [sc * (c * v[0] - s * v[1]), sc * (s * v[0] + c * v[1])];
  const reps = g.reps.map((r) => {
    // T r T^-1, T(x) = sc R x + d
    const a = r.a, b = r.b, cc = r.c, d = r.d;
    const la = c * (a * c - b * s) - s * (cc * c - d * s), lb = c * (a * s + b * c) - s * (cc * s + d * c);
    const lc = s * (a * c - b * s) + c * (cc * c - d * s), ld = s * (a * s + b * c) + c * (cc * s + d * c);
    const t = V([r.tx, r.ty]);
    return { a: la, b: lb, c: lc, d: ld, tx: t[0] + dx - (la * dx + lb * dy), ty: t[1] + dy - (lc * dx + ld * dy) };
  });
  const e1 = V(g.e1), e2 = V(g.e2);
  const cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  return { id: g.id, e1, e2, reps, cellArea, domainArea: cellArea / reps.length, center: P(g.center) };
}

let worst = { cov: [1, 0], bare: 0, solid: 0, ms: 0, verts: 0, overlap: 0 };
for (const id of ids) {
  let g = BY_ID[id];
  if (arg.moved) g = moved(g, 0.7, 1.7, 3.1, -2.2);
  const t0 = performance.now();
  let res;
  try { res = find(g); } catch (e) { console.log(id.padEnd(6), 'ERROR', e.stack.split('\n').slice(0, 3).join(' | ')); continue; }
  const ms = performance.now() - t0;
  const N = normalize(res.shapes);
  const m = per > 0 ? measure(g, N, { per }) : {};
  worst.cov = [Math.min(worst.cov[0], m.coverage ?? 1), Math.max(worst.cov[1], m.coverage ?? 0)];
  worst.bare = Math.max(worst.bare, m.emptyDisc ?? 0); worst.solid = Math.max(worst.solid, m.darkDisc ?? 0);
  worst.ms = Math.max(worst.ms, ms); worst.verts = Math.max(worst.verts, N.verts); worst.overlap = Math.max(worst.overlap, m.overlap ?? 0);
  let same = '';
  if (arg.same) {                                              // the same pattern without the presets (the rule's seed)?
    const bare = { id: g.id, e1: g.e1, e2: g.e2, reps: g.reps, cellArea: g.cellArea, domainArea: g.domainArea, center: g.center };
    const N2 = normalize(find(bare).shapes), size = Math.sqrt(g.domainArea);
    let diff = 0, all = 0;
    for (let j = 0; j < 70; j++) for (let i = 0; i < 70; i++) {
      const x = g.center[0] + (i / 70 - 0.5) * 3.1 * size + 0.0123 * size, y = g.center[1] + (j / 70 - 0.5) * 3.1 * size + 0.0071 * size;
      all++; if (toneAt(g, N, x, y) !== toneAt(g, N2, x, y)) diff++;
    }
    same = `  rule differs ${(100 * diff / all).toFixed(1)}%`;
  }
  console.log(id.padEnd(6), `ms ${ms.toFixed(1).padStart(5)}  pts ${String(N.verts).padStart(4)}  dark ${m.coverage ?? '-'}  bare ${m.emptyDisc ?? '-'}  solid ${m.darkDisc ?? '-'}  overlap ${m.overlap ?? '-'}${same}  `, JSON.stringify(res.info));
}
console.log('WORST', JSON.stringify(worst));
