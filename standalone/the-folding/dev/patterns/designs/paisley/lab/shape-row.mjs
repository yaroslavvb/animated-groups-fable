// lab/shape-row.mjs — a row of commas for a list of [L, turn, late, taper] (the cosine family), to compare by eye.
//   node dev/patterns/designs/paisley/lab/shape-row.mjs <out.png> "4.2,180,0.4,1.7;4.6,180,0.15,2"
import { Canvas, hex } from './raster.mjs';
import { denseShape } from './shape-study.mjs';
const out = process.argv[2], list = process.argv[3].split(';').map((s) => s.split(',').map(Number));
const cw = 300, ch = 300, cols = Math.min(6, list.length), rows = Math.ceil(list.length / cols);
const c = new Canvas(cw * cols, ch * rows, 2);
list.forEach(([L, Th, m, q], k) => {
  const g = denseShape(L, Th, { m, p: -q, rtip: 0.08 });
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of g.pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const R = 0.8 * Math.min(cw / (x1 - x0), ch / (y1 - y0)), ox = (k % cols) * cw + cw / 2 - (R * (x0 + x1)) / 2, oy = Math.floor(k / cols) * ch + ch / 2 + (R * (y0 + y1)) / 2;
  c.fill([g.pts.map(([x, y]) => [ox + R * x, oy - R * y])], hex('#4fa397'));
  // bounding circle fill: area over the disc on the largest pairwise distance
  let span = 0; for (let i = 0; i < g.pts.length; i += 4) for (let j = i + 4; j < g.pts.length; j += 4) span = Math.max(span, Math.hypot(g.pts[i][0] - g.pts[j][0], g.pts[i][1] - g.pts[j][1]));
  console.log(k, [L, Th, m, q].join(','), 'area', g.area.toFixed(2), 'span', span.toFixed(2), 'head/span', (2 / span).toFixed(2), 'fill of span disc', (g.area / (Math.PI * span * span / 4)).toFixed(2));
});
c.save(out);
