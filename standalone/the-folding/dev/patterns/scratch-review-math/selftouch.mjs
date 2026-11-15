// selftouch.mjs — is validateShapes' "polygon k touches itself" a true finding for a design? Lists the pairs of
// non-neighbouring edges of each polygon that come within 1e-6 tile sizes, with their positions along the outline
// (review-math, 13 Nov 2026).   node dev/patterns/scratch-review-math/selftouch.mjs <design key> '<group id>'
import { pathToFileURL } from 'node:url';
import { makeShapePrint, validateShapes } from '../../../src/shapes.js';
import { BY_ID } from './lib.mjs';

const [key, id] = process.argv.slice(2);
const mod = await import(pathToFileURL(new URL(`../designs/${key}/design.js`, import.meta.url).pathname).href);
const g = BY_ID[id], res = mod.find(g), P = makeShapePrint(g, { shapes: res.shapes }), V = validateShapes(P), size = P.size;
console.log(`${key} ${id}: ${res.shapes.length} shapes given (${res.shapes.map((s) => (s.pts.length) + (s.hole ? 'h' : '')).join(', ')} points), ${P.polys.length} kept; ${V.problems.join(' | ') || 'ok'}`);
const ps = (x, y, ax, ay, bx, by) => { const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey; let t = l2 > 0 ? ((x - ax) * ex + (y - ay) * ey) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(x - ax - t * ex, y - ay - t * ey); };
P.polys.forEach((Q, k) => {
  const p = Q.pts, n = p.length >> 1, hits = [];
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    const a = [p[2 * i], p[2 * i + 1]], b = [p[2 * ((i + 1) % n)], p[2 * ((i + 1) % n) + 1]], c = [p[2 * j], p[2 * j + 1]], d = [p[2 * ((j + 1) % n)], p[2 * ((j + 1) % n) + 1]];
    const dist = Math.min(ps(...a, ...c, ...d), ps(...b, ...c, ...d), ps(...c, ...a, ...b), ps(...d, ...a, ...b));
    if (dist < 1e-6 * size) hits.push(`edges ${i}-${i + 1} and ${j}-${j + 1} of ${n}: ${(dist / size).toExponential(1)} tile sizes, at (${a.map((v) => v.toFixed(4))})->(${b.map((v) => v.toFixed(4))}) / (${c.map((v) => v.toFixed(4))})->(${d.map((v) => v.toFixed(4))})`);
  }
  if (hits.length) console.log(`  polygon ${k}${Q.hole ? ' (hole)' : ''}: ${hits.length} touching pairs\n    ${hits.slice(0, 6).join('\n    ')}`);
});
