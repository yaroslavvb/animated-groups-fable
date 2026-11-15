// designs-validate.mjs — every design of dev/patterns/designs/ through the PRODUCTION code (src/shapes.js) for all 17
// groups: does makeShapePrint take it, does validateShapes pass it, and what kit.js's rules say (review-math, 13 Nov 2026).
//   node dev/patterns/scratch-review-math/designs-validate.mjs [--designs a,b] [--ids 'o,*632'] [--measure 1] [--per 40] [--out f.json]
import { readdirSync, existsSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { makeShapePrint, validateShapes, measureShapes, MAX_VERTS } from '../../../src/shapes.js';
import * as kit from '../kit.js';
import { GROUPS, BY_ID } from './lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = new URL('../designs/', import.meta.url).pathname;
const only = arg('--designs', '').split(',').filter(Boolean), ids = arg('--ids', '').split(',').filter(Boolean);
const MEASURE = +arg('--measure', 0), PER = +arg('--per', 40), OUT = arg('--out', null);
const keys = readdirSync(DIR).filter((k) => existsSync(DIR + k + '/design.js') && (!only.length || only.includes(k)));
const groups = ids.length ? ids.map((i) => BY_ID[i]) : GROUPS;
const rows = [];
for (const key of keys) {
  let mod;
  try { mod = await import(pathToFileURL(DIR + key + '/design.js').href + '?t=' + Date.now()); } catch (e) { rows.push({ key, load: String(e.message).split('\n')[0] }); console.log(key, 'LOAD FAILS', String(e.message).split('\n')[0]); continue; }
  const meta = mod.meta || {};
  for (const g of groups) {
    const row = { key, meta: meta.key, label: meta.label, g: g.id };
    const t0 = performance.now();
    let res;
    try { res = mod.find(g); } catch (e) { row.find = String(e.message).split('\n')[0].slice(0, 120); rows.push(row); continue; }
    row.findMs = +(performance.now() - t0).toFixed(1);
    let P;
    try { P = makeShapePrint(g, { key, shapes: res.shapes }); } catch (e) { row.make = String(e.message).slice(0, 120); rows.push(row); continue; }
    const t1 = performance.now(), V = validateShapes(P);
    Object.assign(row, { validMs: +(performance.now() - t1).toFixed(1), ok: V.ok, stab: V.stabilizer, gap: +V.gap.toFixed(4), verts: P.verts, polys: P.polys.length, problems: V.problems.map((s) => s.slice(0, 140)) });
    // kit's view (what proto.mjs printed for the designer)
    const N = kit.normalize(res.shapes);
    row.kitVerts = N.verts;
    row.kitStab = kit.stabilizerOrder(g, N);
    // kit's windingAt looks at 5 x 5 translates in (e1, e2) coordinates: is the motif small enough for that?
    const D = Math.abs(g.e1[0] * g.e2[1] - g.e1[1] * g.e2[0]), hmin = D / Math.max(Math.hypot(...g.e1), Math.hypot(...g.e2));
    row.kitReach = +(N.R / (2.5 * hmin)).toFixed(3);       // > 1: kit's W may miss copies
    if (MEASURE) {
      const t2 = performance.now(), M = measureShapes(P, { per: PER, center: g.center }), K = kit.measure(g, N, { per: PER });
      Object.assign(row, { measureMs: +(performance.now() - t2).toFixed(0), cov: M.coverage, covExact: M.coverageExact == null ? null : +M.coverageExact.toFixed(3), kitCov: K.coverage, overlap: M.overlap, kitOverlap: K.overlap, empty: M.emptyDisc, kitEmpty: K.emptyDisc, dark: M.darkDisc, kitDark: K.darkDisc });
    }
    rows.push(row);
  }
}
for (const r of rows) {
  const flag = r.load || r.find || r.make ? 'REFUSED' : r.ok ? 'ok' : 'PROBLEMS';
  console.log(`${String(r.key).padEnd(9)} ${String(r.g).padEnd(6)} ${flag.padEnd(8)} ${r.load || r.find || r.make || ''}${r.ok != null ? `stab ${r.stab}/kit ${r.kitStab} gap ${r.gap} verts ${r.verts}${r.verts !== r.kitVerts ? '/kit ' + r.kitVerts : ''} polys ${r.polys} find ${r.findMs} ms valid ${r.validMs} ms kitReach ${r.kitReach}` : ''}${r.cov != null ? ` | cov ${r.cov} exact ${r.covExact} kit ${r.kitCov}; overlap ${r.overlap}/kit ${r.kitOverlap}; empty ${r.empty}/kit ${r.kitEmpty}; dark ${r.dark}/kit ${r.kitDark} (${r.measureMs} ms)` : ''}${r.problems && r.problems.length ? '\n      ' + r.problems.join('\n      ') : ''}`);
}
if (OUT) writeFileSync(OUT, JSON.stringify(rows, null, 1));
