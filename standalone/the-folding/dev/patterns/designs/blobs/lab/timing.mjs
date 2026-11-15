// lab/timing.mjs — find() on every group: ms, vertices, and the kit's own numbers (slow: the kit measures polygons).
//   node lab/timing.mjs [--ids o,442] [--measure 1] [--strokes file.json]
import fs from 'node:fs';
import { GROUPS, BY_ID } from '../../../../../src/groups.js';
import { find, STROKES } from '../design.js';
import { normalize, measure } from '../../../kit.js';
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
if (opt.strokes) Object.assign(STROKES, JSON.parse(fs.readFileSync(opt.strokes, 'utf8')));
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);
for (const id of ids) {
  const g = BY_ID[id];
  find(g);
  const t0 = performance.now(); let res;
  for (let k = 0; k < 5; k++) res = find(g);
  const ms = (performance.now() - t0) / 5, N = normalize(res.shapes);
  let minSeg = Infinity, maxSeg = 0, maxTurn = 0;
  for (const P of N.polys) { const p = P.pts, n = p.length / 2; for (let i = 0; i < n; i++) { const j = (i + 1) % n, k = (i + 2) % n; const ax = p[2 * j] - p[2 * i], ay = p[2 * j + 1] - p[2 * i + 1], bx = p[2 * k] - p[2 * j], by = p[2 * k + 1] - p[2 * j + 1]; const L = Math.hypot(ax, ay) / Math.sqrt(g.domainArea); minSeg = Math.min(minSeg, L); maxSeg = Math.max(maxSeg, L); maxTurn = Math.max(maxTurn, Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by))); } }
  const row = { id, ms: +ms.toFixed(1), polys: N.polys.length, verts: N.verts, minSeg: +minSeg.toFixed(4), maxSeg: +maxSeg.toFixed(4), maxTurn: +maxTurn.toFixed(3), info: res.info };
  if (opt.measure === '1') Object.assign(row, measure(g, N));
  console.log(JSON.stringify(row));
}
