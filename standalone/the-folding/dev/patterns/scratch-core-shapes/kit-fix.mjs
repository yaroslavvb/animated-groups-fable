// scratch: a replacement for kit.js's stabilizerOrder (and for the coverage of its measure), tried against src/shapes.js.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GROUPS, BY_ID, elementsNear } from '../../../src/groups.js';
import { normalize, stabilizerOrder } from '../kit.js';
import { makeShapePrint, validateShapes } from '../../../src/shapes.js';
import { commaShapes, blobShapes, symmetricShapes } from './motifs.js';

// ---- the proposed replacement (drop-in for dev/patterns/kit.js lines 196-199) ----
/** How many elements of the group map the motif onto itself (1 for a motif at a generic place). */
export function stabilizerOrderFixed(group, N) {
  const tol = 1e-6 * Math.sqrt(group.domainArea);
  const onOutline = (x, y) => {
    for (const P of N.polys) for (let i = 0, n = P.pts.length / 2, j = n - 1; i < n; j = i++) {
      const ax = P.pts[2 * j], ay = P.pts[2 * j + 1], ex = P.pts[2 * i] - ax, ey = P.pts[2 * i + 1] - ay, l2 = ex * ex + ey * ey;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2)) : 0;
      if (Math.hypot(x - ax - t * ex, y - ay - t * ey) <= tol) return true;
    }
    return false;
  };
  let k = 0;
  for (const g of elementsNear(group, N.cx, N.cy, 2 * N.R, N.cx, N.cy)) {
    let same = true;
    for (const P of N.polys) for (let i = 0; i < P.pts.length && same; i += 2) same = onOutline(g.a * P.pts[i] + g.b * P.pts[i + 1] + g.tx, g.c * P.pts[i] + g.d * P.pts[i + 1] + g.ty);
    if (same) k++;
  }
  return Math.max(1, k);
}
// ----

const toPts = (shapes) => shapes.map((s) => { const src = s.pts || s, pts = []; if (typeof src[0] === 'number') for (let i = 0; i + 1 < src.length; i += 2) pts.push([src[i], src[i + 1]]); else for (const p of src) pts.push([p[0], p[1]]); return { pts, hole: !!s.hole }; });
let n = 0, bad = 0, kitWrong = 0, ms = 0;
const tryOne = (label, g, shapes) => {
  const N = normalize(toPts(shapes)), V = validateShapes(makeShapePrint(g, { shapes }));
  const t0 = performance.now(), f = stabilizerOrderFixed(g, N); ms += performance.now() - t0;
  const k = stabilizerOrder(g, N);
  n++;
  if (f !== V.stabilizer) { bad++; console.log(`${label}: the replacement says ${f}, shapes.js ${V.stabilizer}`); }
  if (k !== V.stabilizer) { kitWrong++; console.log(`${label}: kit.js as it is says ${k}, right is ${V.stabilizer}`); }
};
for (const g of GROUPS) {
  tryOne(`${g.id} comma`, g, commaShapes(g));
  tryOne(`${g.id} blob`, g, blobShapes(g).shapes);
  for (const kind of ['centre', 'mirror']) { const s = symmetricShapes(g, kind); if (s) tryOne(`${g.id} ${kind}`, g, s.shapes); }
}
// the planted blind spot: a triangle whose box is centred on a 2-fold centre
tryOne('2222 triangle with its box on a 2-fold centre', BY_ID['2222'], [{ pts: [[-0.3, -0.2], [0.3, -0.2], [0.09, 0.2]] }]);
// the designs as they are now
const here = path.dirname(fileURLToPath(import.meta.url)), dir = path.resolve(here, '../designs');
for (const key of fs.readdirSync(dir).sort()) {
  const f = path.join(dir, key, 'design.js');
  if (!fs.existsSync(f)) continue;
  let mod; try { mod = await import(pathToFileURL(f).href); } catch { continue; }
  for (const g of GROUPS) { let res; try { res = mod.find(g); } catch { continue; } if (res && res.shapes) tryOne(`${key} ${g.id}`, g, res.shapes); }
}
console.log(`${n} motifs: the replacement differs from shapes.js in ${bad}; kit.js as it is is wrong in ${kitWrong}; the replacement took ${ms.toFixed(0)} ms in all`);
