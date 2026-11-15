// lab/seat.mjs — slide a stroke to where its blob sits best inside the default tile, along the directions in which a
// slide changes nothing but the place of the pattern: any direction for o (the pattern slides with the stroke), along
// the mirrors of ** and *x, along the glide axes of xx. The blob then keeps the largest margin to the tile's rim.
//   node lab/seat.mjs <strokes.json in> <strokes.json out> [--ids o,xx,**,*x]
import fs from 'node:fs';
import { BY_ID, classify } from '../../../../../src/groups.js';
import { find, frameOf, STROKES } from '../design.js';
import { tileOf } from '../../../kit.js';

const [src, dst, ...rest] = process.argv.slice(2), opt = {};
for (let i = 0; i < rest.length; i++) if (rest[i].startsWith('--')) opt[rest[i].slice(2)] = rest[++i];
const strokes = JSON.parse(fs.readFileSync(src, 'utf8'));
for (const id of (opt.ids || 'o,xx,**,*x').split(',')) {
  const g = BY_ID[id], st = strokes[id] && (strokes[id].stroke || strokes[id]);
  if (!st) continue;
  STROKES[id] = st;
  const res = find(g), T = tileOf(g).poly, size = Math.sqrt(g.domainArea), F = frameOf(g);
  const pts = res.shapes[0].pts;
  // per side of the tile: the inward unit normal and the least distance of the blob from it
  const sides = T.map((a, k) => {
    const b = T[(k + 1) % T.length], ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey), nx = -ey / l, ny = ex / l;
    let d = Infinity;
    for (const p of pts) d = Math.min(d, (p[0] - a[0]) * nx + (p[1] - a[1]) * ny);
    return { nx, ny, d };
  });
  const margin = (vx, vy) => Math.min(...sides.map((s) => s.d + s.nx * vx + s.ny * vy));
  const r = g.reps.find((q) => q.a * q.d - q.b * q.c < 0), dir = r ? classify(r).dir : null;
  let best = [0, 0], bm = margin(0, 0);
  const before = bm;
  for (let i = -60; i <= 60; i++) for (let j = dir ? 0 : -60; j <= (dir ? 0 : 60); j++) {
    const v = dir ? [i * 0.005 * size * dir[0], i * 0.005 * size * dir[1]] : [i * 0.005 * size, j * 0.005 * size], m = margin(v[0], v[1]);
    if (m > bm + 1e-9) { bm = m; best = v; }
  }
  const o = F.toF(F.ox, F.oy), w = F.toF(F.ox + best[0], F.oy + best[1]), dx = w[0] - o[0], dy = w[1] - o[1];
  const p = st.p.map((v, k) => Math.round((v + (k % 2 ? dy : dx)) * 1e4) / 1e4);
  strokes[id] = { ...st, p };
  if (st.lobes) strokes[id].lobes = st.lobes.map(([x, y, rr]) => [x + dx, y + dy, rr]);
  console.log(`${id}: margin to the tile's rim ${(before / size).toFixed(3)} -> ${(bm / size).toFixed(3)} tile sizes (slid by ${dx.toFixed(3)}, ${dy.toFixed(3)} in the frame)`);
}
fs.writeFileSync(dst, JSON.stringify(strokes, null, 1));
