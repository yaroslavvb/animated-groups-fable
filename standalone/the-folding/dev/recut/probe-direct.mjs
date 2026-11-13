// dev/recut/probe-direct.mjs — how much of the sheet passes through itself, over the whole motion, for the DIRECT folds
// of the two shapes that cross themselves (xx, 22x), cut by cut. Uses the lab's detector (lab22x/src/selfx.js).
//   node dev/recut/probe-direct.mjs
import { BY_ID } from '../../src/groups.js';
import { buildDomain, makeWarp } from '../../src/domain.js';
import { buildMesh } from '../../src/mesh.js';
import { createFold, foldMeshOptions } from '../../src/folds/index.js';
import { createSelfX, jitterPlane } from '../../lab22x/src/selfx.js';

const STEPS = 120, NONE = 0.004;
for (const id of ['xx', '22x']) {
  const group = BY_ID[id], size = Math.sqrt(group.domainArea);
  for (const [i, p] of group.presets.entries()) {
    for (const amp of [0, 1]) {
      const domain = buildDomain(group, { seed: p.seed, metric: p.metric, warp: makeWarp(group, amp) });
      const mesh = buildMesh(group, domain, foldMeshOptions(group));
      const fold = createFold(group, domain, mesh, { anchor: p.anchor || p.seed });
      const M = fold.mesh, n = M.n;
      const uv = jitterPlane(M.xy, M.tri, M.triCell);
      const X = createSelfX(M.tri), pos = new Float32Array(3 * n), o = [0, 0, 0];
      let first = null, last = null, max = 0, at = 0;
      for (let s = 0; s <= STEPS; s++) {
        const t = s / STEPS, F = fold.at(t);
        for (let v = 0; v < n; v++) { F(uv[2 * v], uv[2 * v + 1], M.cell[v], o); pos[3 * v] = o[0]; pos[3 * v + 1] = o[1]; pos[3 * v + 2] = o[2]; }
        const L = X.compute(pos, size).length / size;
        if (L >= NONE) { if (first === null) first = t; last = t; }
        if (L > max) { max = L; at = t; }
      }
      console.log(`${id} ${p.name.padEnd(10)} amp ${amp}: ${first === null ? 'never crosses' : `crosses from t = ${first.toFixed(3)} to ${last.toFixed(3)}`}; max ${max.toFixed(3)} tile widths at t = ${at.toFixed(3)}  (${M.tri.length / 3} triangles)`);
    }
  }
}
