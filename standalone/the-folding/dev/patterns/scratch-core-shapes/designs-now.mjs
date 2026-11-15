// scratch (core-shapes): the designs of the round AS THEY ARE AT THIS MOMENT (their authors are still at work), through
// src/shapes.js: does makeShapePrint take them, what does validateShapes say, how long does it take, and is W the kit's?
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GROUPS } from '../../../src/groups.js';
import { normalize, windingAt, stabilizerOrder } from '../kit.js';
import { makeShapePrint, validateShapes } from '../../../src/shapes.js';

function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const here = path.dirname(fileURLToPath(import.meta.url)), dir = path.resolve(here, '../designs');
const only = process.argv[2] ? process.argv[2].split(',') : null;
const t00 = Date.now();
for (const key of fs.readdirSync(dir).sort()) {
  if (only && !only.includes(key)) continue;
  const f = path.join(dir, key, 'design.js');
  if (!fs.existsSync(f)) continue;
  let mod;
  try { mod = await import(pathToFileURL(f).href); } catch (e) { console.log(`${key}: does not load: ${String(e.message).split('\n')[0]}`); continue; }
  const rows = [];
  let okN = 0, diff = 0, pts = 0, tMake = 0, tVal = 0, kitStabWrong = 0, maxVerts = 0, tFind = 0;
  for (const g of GROUPS) {
    try {
      const t0 = performance.now();
      const res = mod.find(g);
      const t1 = performance.now();
      const P = makeShapePrint(g, { key, shapes: res.shapes });
      const t2 = performance.now();
      const V = validateShapes(P);
      const t3 = performance.now();
      tFind += t1 - t0; tMake += t2 - t1; tVal += t3 - t2; maxVerts = Math.max(maxVerts, P.verts);
      const N = normalize(res.shapes), rnd = prng(5), L = Math.hypot(...g.e1) + Math.hypot(...g.e2);
      for (let i = 0; i < 150; i++) {
        const x = g.center[0] + (2 * rnd() - 1) * L, y = g.center[1] + (2 * rnd() - 1) * L;
        if (P.margin(x, y) < 1e-7 * P.size) continue;
        pts++;
        if (P.winding(x, y) !== windingAt(g, N, x, y)) diff++;
      }
      const ks = stabilizerOrder(g, N);
      if (ks !== V.stabilizer) kitStabWrong++;
      if (V.ok) okN++;
      rows.push(`    ${g.id.padEnd(6)} ${String(P.verts).padStart(5)} pts ${P.polys.length} polys  W ${V.stabilizer}${ks !== V.stabilizer ? ' (kit says ' + ks + ')' : ''}  gap ${V.gap.toFixed(4)}  dark ${(100 * P.netArea / (V.stabilizer * g.domainArea)).toFixed(1)} %  ${V.ok ? 'ok' : V.problems.join(' | ')}`);
    } catch (e) { rows.push(`    ${g.id.padEnd(6)} THROWS ${String(e.message).split('\n')[0]}`); }
  }
  console.log(`${key}: ${okN} of 17 keep the rules; W differs from the kit at ${diff} of ${pts} points; find ${tFind.toFixed(0)} ms, makeShapePrint ${tMake.toFixed(1)} ms, validateShapes ${tVal.toFixed(1)} ms for all 17; up to ${maxVerts} vertices` + (kitStabWrong ? `; the kit's stabiliser differs in ${kitStabWrong} groups` : ''));
  if (process.argv[3] === 'rows' || okN < 17) for (const r of rows) console.log(r);
}
console.log('total', Date.now() - t00, 'ms');
