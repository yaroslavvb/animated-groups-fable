// dev/patterns/designs/glyph/where.mjs — a working tool: WHERE the largest bare disc of the pattern is (its centre in
// the default tile), by brute force with the kit's own tone function, beside the design's own estimate (info.bare).
//   node dev/patterns/designs/glyph/where.mjs '632,3*3' [per=30]
import { BY_ID, GROUPS } from '../../../../src/groups.js';
import { normalize, toneAt, tileOf } from '../../kit.js';
import { find, K } from './design.js';
Object.assign(K, JSON.parse(process.argv[4] || '{}'));          // knobs to try, as JSON

const ids = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : GROUPS.map((g) => g.id);
const per = +(process.argv[3] || 'per=30').split('=')[1];
for (const id of ids) {
  const g = BY_ID[id], res = find(g), N = normalize(res.shapes), size = Math.sqrt(g.domainArea), h = size / per;
  const tile = tileOf(g);
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const p of tile.poly) { bx0 = Math.min(bx0, p[0]); by0 = Math.min(by0, p[1]); bx1 = Math.max(bx1, p[0]); by1 = Math.max(by1, p[1]); }
  const pad = 0.8 * size, x0 = bx0 - pad, y0 = by0 - pad, w = Math.ceil((bx1 - bx0 + 2 * pad) / h), hh = Math.ceil((by1 - by0 + 2 * pad) / h);
  const dark = new Uint8Array(w * hh);
  for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) dark[j * w + i] = toneAt(g, N, x0 + (i + 0.5) * h, y0 + (j + 0.5) * h);
  let best = { d: 0 };
  const R = Math.ceil(0.8 * per);
  for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
    const x = x0 + (i + 0.5) * h, y = y0 + (j + 0.5) * h;
    if (dark[j * w + i] || !tile.domain.contains(x, y, 1e-9)) continue;
    let d2 = R * R;
    for (let b = -R; b <= R; b++) { const jj = j + b; if (jj < 0 || jj >= hh || b * b >= d2) continue; for (let a = -R; a <= R; a++) { const ii = i + a; if (ii < 0 || ii >= w) continue; const q = a * a + b * b; if (q < d2 && dark[jj * w + ii]) d2 = q; } }
    const d = Math.sqrt(d2) * h;
    if (d > best.d) best = { d, x, y };
  }
  console.log(id.padEnd(6), 'bare', ((2 * best.d) / size).toFixed(3), 'est', res.info.bare, 'at', best.x.toFixed(3), best.y.toFixed(3), ' tile', JSON.stringify(tile.poly.map((p) => p.map((v) => +v.toFixed(2)))));
}
