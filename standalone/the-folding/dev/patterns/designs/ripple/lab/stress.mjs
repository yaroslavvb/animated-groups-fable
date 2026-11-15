// designs/ripple/lab/stress.mjs — the rule on lattices the page does not have: every group whose lattice can be stretched
// (o, 2222, **, xx, *x, 22x, 22*, *2222, 2*22) under a few linear maps that its point group allows (for o and 2222 any
// map, for the others a stretch along the mirror or glide axes), handed over as a test would (no presets). Prints the
// numbers of kit.measure and whether a hard rule breaks.   node dev/patterns/designs/ripple/lab/stress.mjs [--png <file>]
import fs from 'node:fs';
import { BY_ID } from '../../../../../src/groups.js';
import { normalize } from '../../../kit.js';
import { fastMeasure } from './raster.mjs';
import { find } from '../design.js';

const maps = [[1, 0, 0, 1], [1.6, 0, 0, 1], [1, 0, 0, 1.6], [2.6, 0, 0, 1], [1, 0, 0, 2.6], [0.55, 0, 0, 1], [1, 0, 0, 0.45]];
const free = [[1, 0.5, 0, 1], [1, 0, 0.7, 1], [1.4, 0.9, -0.2, 0.8]];
const mapped = (g, L) => {
  const ap = (v) => [L[0] * v[0] + L[1] * v[1], L[2] * v[0] + L[3] * v[1]];
  const e1 = ap(g.e1), e2 = ap(g.e2), cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  const reps = g.reps.map((r) => { const t = ap([r.tx, r.ty]); return { a: r.a, b: r.b, c: r.c, d: r.d, tx: t[0], ty: t[1] }; });
  return { id: g.id, e1, e2, reps, cellArea, domainArea: cellArea / reps.length, center: ap(g.center) };
};
let bad = 0, n = 0;
const worst = { cov: [1, 0], bare: 0, solid: 0, ms: 0 };
for (const id of ['o', '2222', '**', 'xx', '*x', '22x', '22*', '*2222', '2*22']) {
  for (const L of id === 'o' || id === '2222' ? maps.concat(free) : maps) {
    const g = mapped(BY_ID[id], L);
    let line = `${id.padEnd(6)} L=[${L.join(',')}]`.padEnd(30);
    try {
      const t0 = performance.now(), res = find(g), ms = performance.now() - t0;
      const N = normalize(res.shapes), m = fastMeasure(g, N);
      const flags = [];
      if (m.overlap > 0.004) flags.push('OVERLAP');
      if (m.exact < 0.4 || m.exact > 0.62) flags.push('dark');
      if (m.emptyDisc > 0.45) flags.push(m.emptyDisc > 0.6 ? 'BARE' : 'bare');
      if (m.darkDisc > 0.7) flags.push('SOLID');
      if (N.verts > 2400) flags.push('VERTS');
      if (flags.length) bad++;
      n++;
      worst.cov = [Math.min(worst.cov[0], m.exact), Math.max(worst.cov[1], m.exact)]; worst.bare = Math.max(worst.bare, m.emptyDisc); worst.solid = Math.max(worst.solid, m.darkDisc); worst.ms = Math.max(worst.ms, ms);
      line += ` ${ms.toFixed(0).padStart(4)} ms dark ${m.exact} bare ${m.emptyDisc} solid ${m.darkDisc} pts ${N.verts} | ${res.info.seat} r ${res.info.r} sig ${res.info.sigma} A ${res.info.stretch} ${flags.join(' ')}`;
    } catch (e) { bad++; line += ' ERROR ' + String(e && e.message); }
    console.log(line);
  }
}
console.log(`${n} lattices, ${bad} with a number out of range; dark ${worst.cov.join(' .. ')}, bare <= ${worst.bare}, solid <= ${worst.solid}, ${worst.ms.toFixed(0)} ms at most`);
