#!/usr/bin/env node
// try-solver.mjs: the baseline solver on a few states: numbers, a result file for metrics.mjs, a scene for shot.mjs.
//   node try-solver.mjs [nVertices=2600] [sweeps]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as P from '../../src/pillow.js';
import { createSurface } from '../../src/solver.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const nV = Number(process.argv[2] || 2600), sweeps = process.argv[3] ? Number(process.argv[3]) : undefined;
const states = [
  ['3333-tw0', [3, 3, 3, 3], 2.633916, 0],
  ['3333-tw0.125', [3, 3, 3, 3], 2.633916, 0.125],
  ['3333-tw0.25', [3, 3, 3, 3], 2.633916, 0.25],
  ['2345', [2, 3, 5, 4], 2.535706, 0],
  ['2223', [3, 2, 2, 2], 1.316958, 0],
];
const tint = [[0.56, 0.82, 0.78], [0.93, 0.85, 0.66]];
for (const [id, orders, L, tw] of states) {
  const g = P.suggestGrid(orders, L, nV);
  const surf = createSurface({ nTheta: g.nTheta, nS: g.nS, ...(sweeps ? { sweeps } : {}) });
  surf.set(orders, L, tw);
  const st = surf.stats(), m = surf.mesh, X = surf.positions;
  console.log(`${id}: grid ${g.nTheta} x ${g.nS}, ${m.nVertices} vertices, ${st.ms.toFixed(0)} ms, ${st.sweeps} sweeps, strain mean ${(100 * st.strainMean).toFixed(3)} %, max ${(100 * st.strainMax).toFixed(2)} %`);
  fs.writeFileSync(path.join(HERE, `solver-${id}.result.json`), JSON.stringify(surf.result()));
  const tri = [[], []];
  for (let t = 0; t < m.nTriangles; t++) tri[m.triPillow[t]].push(m.triangles[3 * t], m.triangles[3 * t + 1], m.triangles[3 * t + 2]);
  const line = (ids) => Array.from(ids).flatMap((v) => [X[3 * v], X[3 * v + 1], X[3 * v + 2]]);
  const pt = (v) => [X[3 * v], X[3 * v + 1], X[3 * v + 2]];
  const scene = {
    title: `baseline solver: ${id} (L ${L}, Twist ${tw}), ${m.nVertices} vertices`,
    note: `strain mean ${(100 * st.strainMean).toFixed(3)} %, max ${(100 * st.strainMax).toFixed(2)} %; ${st.ms.toFixed(0)} ms`,
    meshes: [0, 1].filter((k) => tri[k].length).map((k) => ({ positions: Array.from(X), triangles: tri[k], color: tint[k], backColor: k ? [0.6, 0.53, 0.38] : [0.35, 0.55, 0.52] })),
    lines: [
      { points: line(m.waist), color: [0.1, 0.1, 0.12], width: 3, closed: true },
      { points: line(m.seals[0].chain), color: [0, 0.447, 0.698], width: 4 },
      { points: line(m.seals[1].chain), color: [0.76, 0.31, 0.04], width: 4 },
    ],
    marks: ['P', 'Q', 'R', 'S'].map((nm) => ({ p: pt(m.cones[nm]), label: nm })),
    views: [{ az: -20, el: 14 }, { az: 70, el: 14 }, { az: 25, el: 14 }, { az: -20, el: 70 }],
  };
  fs.writeFileSync(path.join(HERE, `solver-${id}.scene.json`), JSON.stringify(scene));
}
