// lab/moved.mjs — find() on groups carried to another place (turned, scaled, shifted; only { id, e1, e2, reps, cellArea,
// domainArea, center } handed over, as test/pattern.test.js does): the motif must be the same motif, carried along.
//   node lab/moved.mjs [--ids o,442] [--n 4] [--measure 1]
import { GROUPS, BY_ID } from '../../../../../src/groups.js';
import { find } from '../design.js';
import { normalize, measure } from '../../../kit.js';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
function moved(g, th, sc, v) {
  const co = sc * Math.cos(th), si = sc * Math.sin(th), A = [co, -si, si, co], d = co * co + si * si, Ai = [co / d, si / d, -si / d, co / d];
  const mul = (M, p) => [M[0] * p[0] + M[1] * p[1], M[2] * p[0] + M[3] * p[1]];
  const mm = (M, N) => [M[0] * N[0] + M[1] * N[2], M[0] * N[1] + M[1] * N[3], M[2] * N[0] + M[3] * N[2], M[2] * N[1] + M[3] * N[3]];
  const reps = g.reps.map((r) => {
    const L = mm(mm(A, [r.a, r.b, r.c, r.d]), Ai), Lv = mul(L, v), At = mul(A, [r.tx, r.ty]);
    return { a: L[0], b: L[1], c: L[2], d: L[3], tx: -Lv[0] + At[0] + v[0], ty: -Lv[1] + At[1] + v[1] };
  });
  const e1 = mul(A, g.e1), e2 = mul(A, g.e2), cen = mul(A, g.center), cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  return { g: { id: g.id, e1, e2, reps, cellArea, domainArea: cellArea / reps.length, center: [cen[0] + v[0], cen[1] + v[1]] }, map: (p) => { const q = mul(A, p); return [q[0] + v[0], q[1] + v[1]]; } };
}
let seed = 7;
const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id), n = +opt.n || 4;
let worstAll = 0, bad = 0;
for (const id of ids) {
  const g = BY_ID[id], base = find(g), size = Math.sqrt(g.domainArea);
  let worst = 0, note = '';
  for (let k = 0; k < n; k++) {
    const th = k === 0 ? 0.3 : rnd() * 2 * Math.PI, sc = k === 0 ? 1 : 0.4 + 2.2 * rnd(), v = k === 1 ? [0, 0] : [3 * rnd() - 1.5, 3 * rnd() - 1.5];
    const M = moved(g, th, sc, v), res = find(M.g);
    if (res.shapes.length !== base.shapes.length) { note += ` [${k}: ${res.shapes.length} shapes, not ${base.shapes.length}]`; worst = Infinity; continue; }
    res.shapes.forEach((sh, i) => {
      const b = base.shapes[i].pts.map(M.map);
      if (sh.pts.length !== b.length) note += ` [${k}: shape ${i} has ${sh.pts.length} points, not ${b.length}]`;
      // every vertex of the moved motif lies on the outline of the carried one (the distance to its nearest side)
      for (const p of sh.pts) {
        let dmin = Infinity;
        for (let j = 0; j < b.length; j++) {
          const a = b[j], e = b[(j + 1) % b.length], ex = e[0] - a[0], ey = e[1] - a[1];
          const t = Math.min(1, Math.max(0, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / (ex * ex + ey * ey)));
          dmin = Math.min(dmin, Math.hypot(p[0] - a[0] - t * ex, p[1] - a[1] - t * ey));
        }
        worst = Math.max(worst, dmin / (sc * size));
      }
    });
    if (opt.measure === '1' && k === n - 1) { const m = measure(M.g, normalize(res.shapes)); note += ` moved: cover ${m.coverage} bare ${m.emptyDisc} solid ${m.darkDisc} overlap ${m.overlap}`; }
  }
  worstAll = Math.max(worstAll, worst);
  if (worst > 2e-3) bad++;
  console.log(`${id.padEnd(6)} ${base.shapes.length} shape(s), ${base.shapes.reduce((s, x) => s + x.pts.length, 0)} points; moved copies differ by at most ${worst.toExponential(2)} tile sizes${note}`);
}
console.log(bad ? `${bad} group(s) are NOT carried along exactly` : `all carried along (worst ${worstAll.toExponential(2)} tile sizes)`);
