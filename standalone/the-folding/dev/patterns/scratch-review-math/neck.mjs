// neck.mjs — where is the thinnest part of a design's motif, and what is it (a needle tip, a dark neck, a light slit)?
//   node dev/patterns/scratch-review-math/neck.mjs <design key> '<group id>' [--out picture.png]
// Lists the five thinnest places (two non-neighbouring edges nearer than a third of the outline between them), in
// texels of the 1024 texture, with the tone at the middle between them; draws the motif round the worst one, with the
// texture's own reading next to the exact tone.
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
import { makeShapePrint, bakeShapes } from '../../../src/shapes.js';
import { sdfSample } from '../../../src/sdf.js';
import { BY_ID } from './lib.mjs';
import { encodePNG } from './png.mjs';

const [key, id] = process.argv.slice(2);
const outI = process.argv.indexOf('--out'), OUT = outI > 0 ? process.argv[outI + 1] : null;
const mod = await import(pathToFileURL(new URL(`../designs/${key}/design.js`, import.meta.url).pathname).href);
const g = BY_ID[id], res = mod.find(g), P = makeShapePrint(g, { shapes: res.shapes }), T = bakeShapes(P);
const segSeg = (a, b, c, d) => {
  const ps = (p, q, r) => { const ex = r[0] - q[0], ey = r[1] - q[1], l2 = ex * ex + ey * ey; let t = l2 > 0 ? ((p[0] - q[0]) * ex + (p[1] - q[1]) * ey) / l2 : 0; t = Math.max(0, Math.min(1, t)); return [Math.hypot(p[0] - q[0] - t * ex, p[1] - q[1] - t * ey), [q[0] + t * ex, q[1] + t * ey]]; };
  let best = [Infinity];
  for (const [p, q, r] of [[a, c, d], [b, c, d], [c, a, b], [d, a, b]]) { const [dd, f] = ps(p, q, r); if (dd < best[0]) best = [dd, p, f]; }
  return best;
};
const found = [];
P.polys.forEach((Q, k) => {
  const p = Q.pts, n = p.length >> 1, pt = (i) => [p[2 * (i % n)], p[2 * (i % n) + 1]], arc = [0];
  for (let i = 0; i < n; i++) arc.push(arc[i] + Math.hypot(pt(i + 1)[0] - pt(i)[0], pt(i + 1)[1] - pt(i)[1]));
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    const [d, x, y] = segSeg(pt(i), pt(i + 1), pt(j), pt(j + 1));
    const a = arc[j] - arc[i + 1], along = Math.min(a, arc[n] - a - (arc[i + 1] - arc[i]) - (arc[j + 1] - arc[j]));
    if (along > 3 * d) found.push({ k, i, j, d, along, mid: [(x[0] + y[0]) / 2, (x[1] + y[1]) / 2], hole: Q.hole });
  }
});
found.sort((a, b) => a.d - b.d);
const seen = [];
for (const f of found) {
  if (seen.some((s) => Math.hypot(s.mid[0] - f.mid[0], s.mid[1] - f.mid[1]) < 30 * T.pitch)) continue;
  seen.push(f);
  if (seen.length >= 5) break;
}
for (const f of seen) console.log(`polygon ${f.k}${f.hole ? ' (hole)' : ''} edges ${f.i} and ${f.j}: ${(f.d / T.pitch).toFixed(3)} texels apart (${(f.d / P.size).toExponential(2)} tile sizes), the outline between them ${(f.along / T.pitch).toFixed(1)} texels; at (${f.mid.map((v) => v.toFixed(4))}) the tone is ${P.tone(f.mid[0], f.mid[1]) ? 'DARK (a neck)' : 'light (a slit)'}`);
if (OUT && seen.length) {
  // a picture round the worst one: left the exact tone, right the texture's bilinear reading; 40 texels across
  const f = seen[0], W = 360, half = (+(process.env.TEXELS || 40) / 2) * T.pitch, px = new Uint8Array(2 * W * W * 3 + 0);
  const det = T.e1[0] * T.e2[1] - T.e1[1] * T.e2[0];
  const img = new Uint8Array(W * 2 * W * 4);
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
    const x = f.mid[0] - half + ((i + 0.5) / W) * 2 * half, y = f.mid[1] + half - ((j + 0.5) / W) * 2 * half;
    const ex = P.tone(x, y), qx = x - T.origin[0], qy = y - T.origin[1];
    const s = (qx * T.e2[1] - qy * T.e2[0]) / det, t = (T.e1[0] * qy - T.e1[1] * qx) / det;
    const tx = sdfSample(T.data, T.size, s, t) < 128 ? 1 : 0;
    for (const [col, v] of [[i, ex], [W + i, tx]]) { const o = 4 * (j * 2 * W + col); const c = v ? [40, 110, 110] : [225, 235, 235]; img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; img[o + 3] = 255; }
  }
  writeFileSync(OUT, encodePNG(img, 2 * W, W));
  console.log('picture:', OUT, '(left: the exact tone; right: what the 1024 texture holds; 40 texels across)');
}
