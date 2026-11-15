// scratch (review-correct): the shipped prints flat, as tone() gives them (the page's printFor), panels of P px over
// 3.2 cells' width around each group's centre, the lattice cell drawn in grey: dark = the paper's front dark teal.
//   node render.mjs <out.png> <key:id> [<key:id> ...] [--cols 4] [--px 300]
import fs from 'node:fs';
import { BY_ID } from '../../../src/groups.js';
import { printFor } from '../../../src/pattern.js';
import { encodePNG } from '../scratch-review-math/png.mjs';

const argv = process.argv.slice(2), out = argv[0];
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? +argv[i + 1] : d; };
const COLS = opt('--cols', 4), PX = opt('--px', 300), GAP = 6;
const items = argv.slice(1).filter((a, i, all) => a.includes(':') && !(all[i - 1] || '').startsWith('--'));
const rows = Math.ceil(items.length / COLS), W = COLS * PX + (COLS + 1) * GAP, H = rows * PX + (rows + 1) * GAP;
const img = new Uint8Array(W * H * 4).fill(255);
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const LIGHT = hex('#9ad5cc'), DARK = hex('#4fa397'), LINE = [90, 90, 90];
items.forEach((it, n) => {
  const [key, id] = it.split(':'), g = BY_ID[id], P = printFor(g, key);
  const ox = GAP + (n % COLS) * (PX + GAP), oy = GAP + Math.floor(n / COLS) * (PX + GAP);
  const side = 3.2 * Math.sqrt(g.cellArea), s = side / PX, [cx, cy] = g.center;
  const d = g.e1[0] * g.e2[1] - g.e1[1] * g.e2[0];
  for (let j = 0; j < PX; j++) for (let i = 0; i < PX; i++) {
    const x = cx + (i + 0.5 - PX / 2) * s, y = cy - (j + 0.5 - PX / 2) * s;
    let c = P ? (P.tone(x, y) ? DARK : LIGHT) : [255, 0, 0];
    // the lattice cell's sides (lattice coordinates near a whole number)
    const a = (x * g.e2[1] - y * g.e2[0]) / d, b = (g.e1[0] * y - g.e1[1] * x) / d, tol = 0.6 * s / Math.sqrt(g.cellArea);
    if (Math.abs(a - Math.round(a)) < tol || Math.abs(b - Math.round(b)) < tol) c = LINE;
    const k = 4 * ((oy + j) * W + ox + i);
    img[k] = c[0]; img[k + 1] = c[1]; img[k + 2] = c[2]; img[k + 3] = 255;
  }
});
fs.writeFileSync(out, encodePNG(img, W, H));
console.log(`${out}: ${items.join(', ')} (${W} x ${H})`);
