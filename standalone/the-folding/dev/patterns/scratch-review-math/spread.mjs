// spread.mjs — how spread out is a design's motif, and what that costs (review-math, 13 Nov 2026):
// the polygons' centres in lattice coordinates, the bounding circle, kit.js's 5 x 5 reach, the copies one plane fill
// lists (shapeElements culls a whole copy by its bounding circle and box, not polygon by polygon), and tone() speed.
//   node dev/patterns/scratch-review-math/spread.mjs <design key> '<group id>' [...]
import { pathToFileURL } from 'node:url';
import { makeShapePrint, shapeElements, validateShapes } from '../../../src/shapes.js';
import * as kit from '../kit.js';
import { BY_ID } from './lib.mjs';

const [key, ...ids] = process.argv.slice(2);
const mod = await import(pathToFileURL(new URL(`../designs/${key}/design.js`, import.meta.url).pathname).href);
for (const id of ids) {
  const g = BY_ID[id], t0 = performance.now(), res = mod.find(g), t1 = performance.now(), P = makeShapePrint(g, { shapes: res.shapes });
  const D = g.e1[0] * g.e2[1] - g.e1[1] * g.e2[0], lc = (x, y) => [(x * g.e2[1] - y * g.e2[0]) / D, (g.e1[0] * y - g.e1[1] * x) / D];
  const cents = P.polys.map((Q) => { let x = 0, y = 0; const n = Q.pts.length >> 1; for (let i = 0; i < n; i++) { x += Q.pts[2 * i]; y += Q.pts[2 * i + 1]; } return lc(x / n, y / n).map((v) => +v.toFixed(2)); });
  const N = kit.normalize(res.shapes), hmin = Math.abs(D) / Math.max(Math.hypot(...g.e1), Math.hypot(...g.e2));
  const h = 1.4 * g.viewHalf, box = [g.center[0] - h, g.center[1] - h, g.center[0] + h, g.center[1] + h], els = shapeElements(P, box);
  // how many listed copies have at least one polygon whose (carried) box meets the window
  let useful = 0;
  for (const e of els) {
    let hit = false;
    for (const Q of P.polys) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < Q.pts.length; i += 2) { const x = e.a * Q.pts[i] + e.b * Q.pts[i + 1] + e.tx, y = e.c * Q.pts[i] + e.d * Q.pts[i + 1] + e.ty; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      if (!(x1 < box[0] || x0 > box[2] || y1 < box[1] || y0 > box[3])) hit = true;
    }
    if (hit) useful++;
  }
  const t2 = performance.now();
  let s = 0;
  for (let i = 0; i < 20000; i++) s += P.tone(g.center[0] + (i % 141) * 0.013, g.center[1] + ((i * 7) % 137) * 0.011);
  const t3 = performance.now(), V = validateShapes(P);
  console.log(`${key} ${id}: find ${(t1 - t0).toFixed(0)} ms; ${P.polys.length} polygons, centres in lattice coords ${JSON.stringify(cents)}; R ${P.R.toFixed(3)} (cell side ${Math.hypot(...g.e1).toFixed(3)}, ${Math.hypot(...g.e2).toFixed(3)}), kit reach ${(N.R / (2.5 * hmin)).toFixed(2)}; one plane fill lists ${els.length} copies (${els.length * P.verts} vertices), ${useful} of them reach the window; tone ${((t3 - t2) * 50).toFixed(1)} ns a call; valid ${V.ok}`);
}
