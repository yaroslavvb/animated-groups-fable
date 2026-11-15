// lab/r2/glyphs.mjs — the comma family drawn: rows = cuts / knob sets, columns = curl e = 0 … 1, every glyph at the
// same head size, with its span (length / head diameter) and area (in head radii squared).
//   node dev/patterns/designs/paisley/lab/r2/glyphs.mjs --out <png> [--sets '[{"shape":{...}}, ...]']
import { Canvas, hex } from '../raster.mjs';
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const mod = await import('../../design.js');
const base = JSON.parse(JSON.stringify({ shape: mod.KNOBS.shape, stout: mod.KNOBS.stout }));
const sets = opt.sets ? JSON.parse(opt.sets) : [{}];
const rows = [];
for (const set of sets) for (const st of [0, 1]) rows.push({ set, st });
const es = [0, 0.25, 0.5, 0.75, 1], cell = 150, R = 18;
const cv = new Canvas(es.length * cell, rows.length * cell, 2);
const INK = hex('#4fa397');
rows.forEach((row, r) => {
  Object.assign(mod.KNOBS.shape, base.shape, row.set.shape || {});
  Object.assign(mod.KNOBS.stout, base.stout, row.set.stout || {});
  mod.resetShapes();
  const out = [];
  es.forEach((e, c) => {
    const g = mod.glyph(e, row.st), P = [];
    for (let i = 0; i < g.pts.length; i += 2) P.push([c * cell + 40 + R * g.pts[i], r * cell + cell - 30 - R * g.pts[i + 1]]);
    cv.fill([P], INK);
    out.push(`e${e}: span ${(g.span / 2).toFixed(2)}D area ${g.area.toFixed(2)}`);
  });
  console.log(`row ${r} ${row.st ? 'stout' : 'slender'} ${JSON.stringify(row.set)}  ${out.join(' | ')}`);
});
cv.save(opt.out);
console.log('WROTE', opt.out);
