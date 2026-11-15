// dev/extra.mjs — does the print have MORE symmetry than its group? For each group, the tone is compared at a few
// thousand points with the tone at their images under candidate isometries that are not in the group: the elements
// of the group's kaleidoscope / warp supergroup (src/groups.js kaleido.group, warp), the half lattice translations,
// and the half-turns and quarter-turns about the group's own rotation centres and the lattice cell's centre.
// A candidate that keeps (almost) every point is reported.   node extra.mjs
import { GROUPS, elementsNear, contains, symmetryElements } from '../../../../../src/groups.js';
import { makeShapePrint } from '../../../../../src/shapes.js';
import fs from 'node:fs';
import { find as findDesign, motifOf } from '../design.js';
// node extra.mjs lab  -> the specs of out/lab.json instead (each group of the file, every spec)
const LAB = process.argv[2] === 'lab' ? JSON.parse(fs.readFileSync(new URL('./out/lab.json', import.meta.url))) : null;
const jobs = LAB ? Object.entries(LAB).flatMap(([id, l]) => l.map((s) => [id, s])) : null;

const rot = (cx, cy, a) => ({ a: Math.cos(a), b: -Math.sin(a), c: Math.sin(a), d: Math.cos(a), tx: cx - Math.cos(a) * cx + Math.sin(a) * cy, ty: cy - Math.sin(a) * cx - Math.cos(a) * cy });
const refl = (px, py, ang) => { const c = Math.cos(2 * ang), s = Math.sin(2 * ang); return { a: c, b: s, c: s, d: -c, tx: px - c * px - s * py, ty: py - s * px + c * py }; };
let worst = 0;
for (const [g, spec] of jobs ? jobs.map(([id, s]) => [GROUPS.find((x) => x.id === id), s]) : GROUPS.map((x) => [x, null])) {
  const shapes = spec ? motifOf(g, spec).shapes : findDesign(g).shapes;
  if (spec) process.stdout.write((spec._name || '') + ': ');
  const print = makeShapePrint(g, { key: 'hook', name: 'hook', shapes });
  const size = Math.sqrt(g.domainArea), cands = [];
  for (const sup of [g.kaleido && g.kaleido.group, g.warp]) if (sup) for (const e of elementsNear(sup, g.center[0], g.center[1], 2 * size)) if (!contains(g, e)) cands.push(['super ' + sup.id + ' rep ' + e.rep, e]);
  for (const [s, t] of [[0.5, 0], [0, 0.5], [0.5, 0.5]]) cands.push([`translate ${s} e1 + ${t} e2`, { a: 1, b: 0, c: 0, d: 1, tx: s * g.e1[0] + t * g.e2[0], ty: s * g.e1[1] + t * g.e2[1] }]);
  const sym = symmetryElements(g, g.center[0], g.center[1], 1.5 * size);
  for (const p of [...sym.centers, { x: g.center[0], y: g.center[1] }]) for (const k of [2, 3, 4, 6]) {
    const e = rot(p.x, p.y, (2 * Math.PI) / k); if (!contains(g, e)) cands.push([`turn 1/${k} at (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`, e]);
  }
  for (const p of [...sym.centers, { x: g.center[0], y: g.center[1] }]) for (let k = 0; k < 12; k++) {
    const e = refl(p.x, p.y, (k * Math.PI) / 12); if (!contains(g, e)) cands.push([`mirror ${k * 15} deg at (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`, e]);
  }
  let best = 0, bestName = '';
  for (const [name, e] of cands) {
    let same = 0, n = 0;
    for (let i = 0; i < 1500; i++) {
      const x = g.center[0] + (((i * 0.6180339887) % 1) - 0.5) * 3 * size, y = g.center[1] + (((i * 0.7548776662) % 1) - 0.5) * 3 * size;
      if (print.margin(x, y) < 0.01 * size) continue;
      n++; if (print.tone(x, y) === print.tone(e.a * x + e.b * y + e.tx, e.c * x + e.d * y + e.ty)) same++;
    }
    if (same / n > best) { best = same / n; bestName = name; }
  }
  worst = Math.max(worst, best);
  console.log(g.id.padEnd(6), `${cands.length} candidates; the best keeps ${(100 * best).toFixed(1)} % of the points (${bestName})${best > 0.97 ? '  <-- EXTRA SYMMETRY?' : ''}`);
}
console.log('largest share kept by an isometry outside the group:', (100 * worst).toFixed(1), '%');
