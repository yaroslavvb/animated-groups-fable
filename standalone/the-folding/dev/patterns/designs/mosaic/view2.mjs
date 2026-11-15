// view2.mjs — variants side by side (dev): each variant is a JSON object of knob overrides (STYLE keys), plus
//   "T": { id: [9 numbers] }   a TABLE row (the group's frame: lattice coordinates from the anchor)
//   "L": { id: [hx, hy, dir, len, t0, t1, rad, pow?] }   the comma in the CELL's own frame: origin p, the world axes,
//        unit = the tile size, heading from the world x axis (what one reads off cell.mjs)
// applied to every listed group. A variant '@file.json' is { L: the file } (a candidate file of cand.mjs).
//   node view2.mjs <out.png> <ids> <zoom> <px> '<json variant>' ['<json variant>' ...] [--back] [--cols n]
// One row per variant, one column per group; the numbers of each on stdout.
import fs from 'node:fs';
import { build, knobsFor, TABLE, frameOf, toWorld, toFrame } from './design.js';
import { BY_ID, normalize, measureFast, writeSheet } from './lab.mjs';
const args = process.argv.slice(2), back = args.includes('--back'), ci = args.indexOf('--cols'), colsArg = ci >= 0 ? +args[ci + 1] : 0;
const rest = args.filter((a, i) => a !== '--back' && i !== ci && i !== ci + 1 || ci < 0 && a !== '--back');
const out = rest[0], ids = rest[1].split(','), zoom = +rest[2] || 1, px = +rest[3] || 360, variants = rest.slice(4).map((s) => (s.startsWith('@') ? { L: JSON.parse(fs.readFileSync(s.slice(1), 'utf8')) } : JSON.parse(s)));
if (!variants.length) variants.push({});
export function localToRow(g, row, L) {
  const F = frameOf(g), p = toWorld(g, F.A, [row[0], row[1]]);
  const w = [p[0] + F.size * L[0], p[1] + F.size * L[1]], h = toFrame(g, F.A, w);
  return [row[0], row[1], h[0], h[1], L[2] - F.e1ang, L[3], L[4], L[5], L[6]];
}
const items = [];
for (const v of variants) {
  for (const id of ids) {
    const g = BY_ID[id], saved = TABLE[id];
    if (v.T && v.T[id]) TABLE[id] = v.T[id];
    if (v.L && v.L[id]) TABLE[id] = localToRow(g, TABLE[id], v.L[id]);
    const K = { ...knobsFor(g), ...v };
    if (v.L && v.L[id] && v.L[id][7]) K.light[0].pow = v.L[id][7];
    delete K.T; delete K.L;
    const t0 = Date.now(), r = build(g, K), ms = Date.now() - t0, m = measureFast(g, normalize(r.shapes));
    TABLE[id] = saved;
    console.log(JSON.stringify(v).slice(0, 50).padEnd(50), id.padEnd(6), 'dark', m.coverage, 'bare', m.emptyDisc, 'solid', m.darkDisc, 'verts', m.verts, 'ms', ms, 'loops', r.info.loops, 'tail', r.info.tail.join(','), 'commas', r.info.commas);
    items.push({ group: g, shapes: r.shapes });
  }
}
writeSheet(out, items, { px, cols: colsArg || ids.length, zoom, back });
