// designs/spiral/robust.mjs — the construction on tiles it was not tuned for: every preset of every group and some
// random Dirichlet tiles (pentagons, hexagons, trapezoids, slivers). For each: does spiralIn() return an outline that
// does not cross itself, stays inside the tile by the margin, and covers a sane share?
//   node dev/patterns/designs/spiral/robust.mjs [seeds per group, default 10]
import { GROUPS } from '../../../../src/groups.js';
import { buildDomain } from '../../../../src/domain.js';
import { spiralIn, KNOBS } from './design.js';

const per = +process.argv[2] || 10;
let seed = 12345;
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
const cross = (a, b, c, d) => {
  const d1 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]), d2 = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
  const d3 = (d[0] - c[0]) * (a[1] - c[1]) - (d[1] - c[1]) * (a[0] - c[0]), d4 = (d[0] - c[0]) * (b[1] - c[1]) - (d[1] - c[1]) * (b[0] - c[0]);
  return d1 * d2 < 0 && d3 * d4 < 0;
};
const rows = [];
let worstMs = 0, bad = 0, total = 0;
for (const g of GROUPS) {
  const ts = Math.sqrt(g.domainArea);
  const tiles = g.presets.map((p) => ({ name: p.name, d: buildDomain(g, { seed: p.seed, metric: p.metric }) }));
  for (let i = 0; i < per; i++) tiles.push({ name: 'random ' + i, d: buildDomain(g, { seed: [g.center[0] + (rnd() - 0.5) * 2 * g.viewHalf, g.center[1] + (rnd() - 0.5) * 2 * g.viewHalf] }) });
  const row = { id: g.id, tiles: tiles.length, fails: 0, crossed: 0, outside: 0, darkMin: 1, darkMax: 0, wedgeMax: 0, vertsMax: 0, msMax: 0, shallow: 0, sides: '' };
  const sides = new Set();
  for (const t of tiles) {
    total++;
    sides.add(t.d.poly.length);
    try {
      const t0 = performance.now();
      const sp = spiralIn(t.d.poly.map((p) => [p[0], p[1]]), ts, KNOBS);
      const ms = performance.now() - t0;
      row.msMax = Math.max(row.msMax, ms); worstMs = Math.max(worstMs, ms);
      const p = sp.pts, n = p.length;
      let A = 0, x = 0, out = 0;
      for (let k = 0; k < n; k++) { const a = p[k], b = p[(k + 1) % n]; A += a[0] * b[1] - b[0] * a[1]; if (!t.d.contains(a[0], a[1], -0.9 * KNOBS.margin * ts)) out++; }
      for (let k = 0; k < n; k++) for (let j = k + 2; j < n; j++) { if (k === 0 && j === n - 1) continue; if (cross(p[k], p[(k + 1) % n], p[j], p[(j + 1) % n])) x++; }
      const dark = Math.abs(A) / 2 / g.domainArea;
      row.darkMin = Math.min(row.darkMin, dark); row.darkMax = Math.max(row.darkMax, dark);
      row.wedgeMax = Math.max(row.wedgeMax, sp.info.wedge); row.vertsMax = Math.max(row.vertsMax, n);
      if (!sp.info.deep) row.shallow++;
      if (x) { row.crossed++; bad++; console.log('CROSSED', g.id, t.name, x, JSON.stringify(sp.info)); }
      if (out) { row.outside++; bad++; console.log('OUTSIDE', g.id, t.name, out, JSON.stringify(sp.info)); }
      if (!(dark > 0.3 && dark < 0.7) || !p.every((q) => Number.isFinite(q[0]) && Number.isFinite(q[1]))) { bad++; console.log('ODD', g.id, t.name, dark.toFixed(3), JSON.stringify(sp.info)); }
    } catch (e) { row.fails++; bad++; console.log('FAILED', g.id, t.name, String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); }
  }
  const r3 = (v) => Math.round(v * 1000) / 1000;
  row.darkMin = r3(row.darkMin); row.darkMax = r3(row.darkMax); row.msMax = r3(row.msMax); row.sides = [...sides].sort().join(',');
  rows.push(row);
}
console.table(rows);
console.log(total, 'tiles,', bad, 'problems, slowest', worstMs.toFixed(1), 'ms');
