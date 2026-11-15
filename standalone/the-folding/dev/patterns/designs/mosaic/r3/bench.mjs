// bench.mjs — run 3's bench (dev): variants side by side, any number of commas per cell.
//   node r3/bench.mjs <out.png> <ids> <zoom> <px> '<variant json>' ... [--back] [--cols n]
// A variant: { "style": { chan, round, ... }, "C": { id: [[x, y, dir, len, t0, t1, rad, pow, q, free], ...] } }
//   (q: the late-curl power, 1 = the run-2 spine; free: > 0 = the tail ends inside the tile, that far off the grout)
//   C: the commas of that group in the CELL's own frame (origin p, the world axes, unit = the tile size, heading from
//   the world x axis), replacing the table's; a group without an entry keeps the design's own commas.
// One row per variant, one column per group; the numbers on stdout (kit.measure's, from lab.mjs's fast raster).
import { build, knobsFor, frameOf, toWorld, toFrame } from '../design.js';
import { BY_ID, normalize, measureFast, writeSheet } from '../lab.mjs';

const args = process.argv.slice(2), back = args.includes('--back'), ci = args.indexOf('--cols');
const cols = ci >= 0 ? +args[ci + 1] : 0;
const rest = args.filter((a, i) => a !== '--back' && (ci < 0 || (i !== ci && i !== ci + 1)));
const out = rest[0], ids = rest[1].split(','), zoom = +rest[2] || 1, px = +rest[3] || 360;
const variants = rest.slice(4).map((s) => JSON.parse(s));
if (!variants.length) variants.push({});

export function cellToLight(g, p, L) {
  const F = frameOf(g), w = [p[0] + F.size * L[0], p[1] + F.size * L[1]], h = toFrame(g, F.A, w);
  return { h, dir: L[2] - F.e1ang, len: L[3], t0: L[4], t1: L[5], rad: L[6], pow: L[7] || 1, q: L[8] || 1, free: L[9] || 0 };
}

const items = [];
for (const v of variants) {
  for (const id of ids) {
    const g = BY_ID[id], K = { ...knobsFor(g), ...(v.style || {}) };
    if (v.C && v.C[id]) { const F = frameOf(g), p = toWorld(g, F.A, K.p); K.light = v.C[id].map((L) => cellToLight(g, p, L)); }
    // every comma of every group: "all": { free, pow, powMul, lenMul, rad }
    if (v.all) K.light = K.light.map((s) => ({ ...s, ...(v.all.free !== undefined ? { free: v.all.free } : {}), ...(v.all.pow ? { pow: v.all.pow } : {}),
      ...(v.all.powMul ? { pow: (s.pow || 1) * v.all.powMul } : {}), ...(v.all.lenMul ? { len: s.len * v.all.lenMul } : {}), ...(v.all.rad ? { rad: v.all.rad } : {}) }));
    const t0 = Date.now(), r = build(g, K), ms = Date.now() - t0, m = measureFast(g, normalize(r.shapes));
    console.log(JSON.stringify(v).slice(0, 44).padEnd(44), id.padEnd(6), 'dark', m.coverage, 'bare', m.emptyDisc, 'solid', m.darkDisc, 'verts', m.verts, 'ms', ms, 'loops', r.info.loops, 'heads', r.info.head.join(','), 'tails', r.info.tail.join(','));
    items.push({ group: g, shapes: r.shapes });
  }
}
writeSheet(out, items, { px, cols: cols || ids.length, zoom, back });
console.log('wrote', out);
