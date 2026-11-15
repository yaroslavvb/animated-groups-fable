// lab/patch-pools.mjs — one-off: two pools of seats (free tails, tails in a corner), each kept to its topN by area.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), file = path.resolve(here, '../design.js');
let s = fs.readFileSync(file, 'utf8');
const rep = (a, b, all = false) => {
  const n = s.split(a).length - 1;
  if (!n || (!all && n !== 1)) throw new Error('pattern found ' + n + ' times: ' + a.slice(0, 80));
  s = all ? s.split(a).join(b) : s.replace(a, () => b);
};
// single
rep(`  let floor = -1;             // the area of the topN-th seat so far: a seat that cannot beat it is not measured
  const all = [];
  const keep = (c) => { all.push(c); if (all.length >= 4 * K.topN) { all.sort((a, b) => b.area - a.area); all.length = K.topN; floor = all[K.topN - 1].area; } };
  const tryOne = (h, g, sweep, rw, m, sgn, copies, prune = false) => {`,
`  // two pools of seats, each kept to its topN by area: 0 free tails, 1 tails that end in a corner of the tile (a seat
  // that cannot beat the topN-th of its pool is not measured)
  const pools = [[], []], floors = [-1, -1];
  const keep = (c, k) => { const P = pools[k]; P.push(c); if (P.length >= 4 * K.topN) { P.sort((a, b) => b.area - a.area); P.length = K.topN; floors[k] = P[K.topN - 1].area; } };
  const tryOne = (h, g, sweep, rw, m, sgn, copies, prune = -1) => {`);
rep(`    if (prune && strokeArea(pr, X, Y, 0.5 * D) / A <= floor) return null;`, `    if (prune >= 0 && strokeArea(pr, X, Y, 0.5 * D) / A <= floors[prune]) return null;`);
rep(`        const c = tryOne(h, g, sweep, rw, m, sgn, near, true);
        if (c) { c.near = near; keep(c); }`, `        const c = tryOne(h, g, sweep, rw, m, sgn, near, 0);
        if (c) { c.near = near; keep(c, 0); }`);
rep(`        if (w) for (const m of K.pinMs) { const c = tryOne(h, g, w.sweep, w.rw, m, sgn, near, true); if (c) { c.near = near; keep(c); } }`,
    `        if (w) for (const m of K.pinMs) { const c = tryOne(h, g, w.sweep, w.rw, m, sgn, near, 1); if (c) { c.near = near; keep(c, 1); } }`);
rep(`  if (!all.length) return null;
  all.sort((a, b) => b.area - a.area);
  // 2. the best by area, weighed by the bare place they leave`, `  const all = pools.flatMap((P) => P.sort((a, b) => b.area - a.area).slice(0, K.topN));
  if (!all.length) return null;
  // 2. the best of each pool by area, weighed by the bare place they leave`);
rep(`  for (const c of all.slice(0, K.topN)) { scoreOf(c); if (!best || c.score > best.score + 1e-9) best = c; }
  // 3. refinement: the head moved`, `  for (const c of all) { scoreOf(c); if (!best || c.score > best.score + 1e-9) best = c; }
  // 3. refinement: the head moved`);
// pair
rep(`  let floor = -1;
  const all = [];
  const keep = (c) => { all.push(c); if (all.length >= 4 * K.topN) { all.sort((x, y) => y.area - x.area); all.length = K.topN; floor = all[K.topN - 1].area; } };
  const tryOne = (a, b, sa, sb, ra, rb, m, sgn, prune = false) => {`,
`  const pools = [[], []], floors = [-1, -1];
  const keep = (c, k) => { const P = pools[k]; P.push(c); if (P.length >= 4 * K.topN) { P.sort((x, y) => y.area - x.area); P.length = K.topN; floors[k] = P[K.topN - 1].area; } };
  const tryOne = (a, b, sa, sb, ra, rb, m, sgn, prune = -1) => {`);
rep(`    if (prune && (strokeArea(pr, XA, YA, r0) + strokeArea(pr, XB, YB, r0, beta)) / A <= floor) return null;`,
    `    if (prune >= 0 && (strokeArea(pr, XA, YA, r0) + strokeArea(pr, XB, YB, r0, beta)) / A <= floors[prune]) return null;`);
rep(`      const c = tryOne(a, b, s, s, rw, rw, m, sgn, true);
      if (c) keep(c);`, `      const c = tryOne(a, b, s, s, rw, rw, m, sgn, 0);
      if (c) keep(c, 0);`);
rep(`        if (wb) for (const m of K.pinMs) { const c = tryOne(a, b, wa.sweep, wb.sweep, wa.rw, wb.rw, m, sgn, true); if (c) keep(c); }`,
    `        if (wb) for (const m of K.pinMs) { const c = tryOne(a, b, wa.sweep, wb.sweep, wa.rw, wb.rw, m, sgn, 1); if (c) keep(c, 1); }`);
rep(`  if (!all.length) return null;
  all.sort((x, y) => y.area - x.area);`, `  const all = pools.flatMap((P) => P.sort((x, y) => y.area - x.area).slice(0, K.topN));
  if (!all.length) return null;`);
rep(`  for (const c of all.slice(0, K.topN)) { scoreOf(c); if (!best || c.score > best.score + 1e-9) best = c; }
  const le = hyp(`, `  for (const c of all) { scoreOf(c); if (!best || c.score > best.score + 1e-9) best = c; }
  const le = hyp(`);
fs.writeFileSync(file, s);
console.log('patched');
