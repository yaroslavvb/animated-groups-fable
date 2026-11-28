// seal-compare.mjs: cold starts of 3333 (Twist 0.125) and 2345 with and without the cold-start seal straightening.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSurfaceModel } from '../../src/surface-model.js';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const eng = (k, perm, orders, L, tw = 0) => ({ k, perm, orders, L, tw, b: 0, tau: 0, thetas: [0, 0, 0, 0], print: null });
const tint = [[0.60, 0.84, 0.80], [0.96, 0.90, 0.78]], back = [[0.35, 0.55, 0.52], [0.62, 0.55, 0.40]];
const scene = { title: 'cold starts: seal straightening off (left of each pair) | on for the first 0.8 of the sweeps (right): 3333 at Twist 0.125, then 2345', note: '', meshes: [], lines: [], marks: [], views: [{ az: -20, el: 14, zoom: 2.6 }, { az: 70, el: 20, zoom: 2.6 }], cols: 1 };
let dy = 0;
for (const st of [eng('3333', [0, 1, 2, 3], [3, 3, 3, 3], 2.6339157938496336, 0.125), eng('2345', [0, 1, 3, 2], [2, 3, 5, 4], 2.535705814997194)]) for (const w of [0, 0.3]) {
  const sm = createSurfaceModel({ nVertices: 2600, solver: { sealBendCold: w } }); sm.set(st);
  const fr = sm.frame(0), n = fr.nVertices, pos = new Array(3 * n);
  for (let v = 0; v < n; v++) { pos[3 * v] = fr.positions[3 * v]; pos[3 * v + 1] = fr.positions[3 * v + 1] + dy; pos[3 * v + 2] = fr.positions[3 * v + 2]; }
  const tri = [[], []];
  for (let t = 0; t < fr.triangles.length / 3; t++) tri[fr.pillow[t]].push(fr.triangles[3 * t], fr.triangles[3 * t + 1], fr.triangles[3 * t + 2]);
  for (let k = 0; k < 2; k++) scene.meshes.push({ positions: pos, triangles: tri[k], color: tint[k], backColor: back[k] });
  for (const c of fr.curves) { const pts = []; for (const v of c.chain) pts.push(pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]); scene.lines.push({ points: pts, color: c.id === 'loop' ? [0.1, 0.1, 0.12] : c.id === 'seal0' ? [0, 0.447, 0.698] : [0.835, 0.369, 0], width: c.id === 'loop' ? 2.5 : 4, closed: c.closed }); }
  scene.note += `${scene.note ? '  |  ' : ''}${st.k} w=${w}: ${(100 * fr.stats.strainMean).toFixed(2)} % / ${(100 * fr.stats.strainMax).toFixed(1)} %`;
  dy += 2.0 * fr.frame.radius;
}
fs.writeFileSync(path.join(HERE, 'scene-sealcompare.json'), JSON.stringify(scene));
console.log(scene.note);
