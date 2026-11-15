// dev/check.mjs — the coarse numbers of the specs in design.js, without a browser:  node check.mjs [ids,comma,separated] [per]
// bareAt: the centre of the largest bare disc, carried into the default tile; `near` = the tile's vertex (v<i>) or side
// (s<i>) nearest to it and how far that is, in tile sizes.
import { BY_ID, SPEC, run } from './lib.mjs';
import { GROUPS, elementsNear } from '../../../../../src/groups.js';
import { tileOf } from '../../../kit.js';

const ids = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : GROUPS.map((g) => g.id).filter((id) => SPEC[id]);
const per = +process.argv[3] || 22;
function where(g, p) {
  const t = tileOf(g), size = Math.sqrt(g.domainArea);
  let q = p;
  for (const e of elementsNear(g, t.seed[0], t.seed[1], 3 * size, p[0], p[1])) { const x = e.a * p[0] + e.b * p[1] + e.tx, y = e.c * p[0] + e.d * p[1] + e.ty; if (t.domain.contains(x, y, 1e-6)) { q = [x, y]; break; } }
  let best = '', bd = Infinity;
  t.poly.forEach((v, i) => {
    const w = t.poly[(i + 1) % t.poly.length], d = Math.hypot(q[0] - v[0], q[1] - v[1]) / size;
    if (d < bd) { bd = d; best = 'v' + i; }
    const ex = w[0] - v[0], ey = w[1] - v[1], L = Math.hypot(ex, ey), s = ((q[0] - v[0]) * ex + (q[1] - v[1]) * ey) / L, dd = Math.abs((q[0] - v[0]) * ey - (q[1] - v[1]) * ex) / L / size;
    if (s > 0 && s < L && dd < bd - 0.03) { bd = dd; best = 's' + i + '@' + (s / size).toFixed(2); }
  });
  return `(${q[0].toFixed(3)}, ${q[1].toFixed(3)}) near ${best} ${bd.toFixed(2)}`;
}
for (const id of ids) {
  const g = BY_ID[id];
  if (!SPEC[id]) { console.log(id.padEnd(6), 'no spec'); continue; }
  try {
    const r = run(g, SPEC[id], { per });
    const flag = [r.coverage < 0.4 || r.coverage > 0.62 ? 'COV' : '', r.bare > 0.45 ? 'BARE' : '', r.solid > 0.7 ? 'SOLID' : '', r.overlap > 0.004 ? 'OVERLAP' : '', r.ms > 100 ? 'SLOW' : '', r.plain ? 'PLAIN(apart ' + r.apart + ')' : ''].filter(Boolean).join(' ');
    console.log(id.padEnd(6), `dark ${r.coverage.toFixed(2)}  bare ${r.bare.toFixed(2)}  solid ${r.solid.toFixed(2)}  verts ${String(r.verts).padStart(4)}  loops ${r.loops}  ${String(r.ms).padStart(3)} ms  bareAt ${where(g, r.bareAt)}  ${flag}`);
  } catch (e) { console.log(id.padEnd(6), 'ERROR', e.message); }
}
