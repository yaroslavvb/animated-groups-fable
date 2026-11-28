// sweep2.mjs: knobs on several states against the shared metrics.  node sweep2.mjs '<json list of knob objects>'
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as P from '../../src/pillow.js';
import { createSurface } from '../../src/solver.js';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const METRICS = '/Users/solid/drive.unsynced/artifacts/pqrs-pillows/proto/common/metrics.mjs';
const variants = JSON.parse(process.argv[2] || '[{}]');
const states = [['3333 tw 0', [3, 3, 3, 3], 2.633916, 0], ['3333 tw .125', [3, 3, 3, 3], 2.633916, 0.125], ['2345', [2, 3, 5, 4], 2.535706, 0], ['2223', [3, 2, 2, 2], 1.316958, 0]];
for (const v of variants) {
  console.log(JSON.stringify(v));
  for (const [id, orders, L, tw] of states) {
    const g = P.suggestGrid(orders, L, 2600), surf = createSurface({ nTheta: g.nTheta, nS: g.nS, ...v });
    surf.set(orders, L, tw);
    const f = path.join(HERE, 'knob.result.json');
    fs.writeFileSync(f, JSON.stringify(surf.result()));
    const out = execFileSync('node', [METRICS, f]).toString().trim().replace(/^.*?: /, '').replace(/ \| euler.*$/, '');
    const m = surf.mesh, X = surf.positions, sl = m.seals.map((s2) => { const a = s2.chain[0], b = s2.chain[s2.chain.length - 1]; let len = 0; for (let k = 0; k + 1 < s2.chain.length; k++) len += Math.hypot(X[3 * s2.chain[k]] - X[3 * s2.chain[k + 1]], X[3 * s2.chain[k] + 1] - X[3 * s2.chain[k + 1] + 1], X[3 * s2.chain[k] + 2] - X[3 * s2.chain[k + 1] + 2]); return (Math.hypot(X[3 * a] - X[3 * b], X[3 * a + 1] - X[3 * b + 1], X[3 * a + 2] - X[3 * b + 2]) / len).toFixed(3); });
    console.log(`   ${id.padEnd(13)} ${out} | seal chord/length ${sl.join(', ')}`);
  }
}
