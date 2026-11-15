// lab/patch-ramp.mjs — one-off: a chamber's channels narrow toward its corners; a thin tile goes straight to its seat.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), file = path.resolve(here, '../design.js');
let s = fs.readFileSync(file, 'utf8');
const rep = (a, b) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error('pattern found ' + n + ' times: ' + a.slice(0, 80)); s = s.replace(a, () => b); };
rep(`  return { own, eown, iwo, oth, eoth, iwt, m, nx, ny, h, fr: { ox: gx, oy: gy, ux, uy, vx, vy }, copies: copies.length, near };`,
`  // a chamber: each node's distance to the nearest corner of it (the channels narrow toward the corners: rule)
  let dv = null;
  if (cover) {
    dv = new Float32Array(N);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const px = gx + i * h * ux + j * h * vx, py = gy + i * h * uy + j * h * vy;
      let d = Infinity;
      for (const p of cover) { const v = (px - p[0]) ** 2 + (py - p[1]) ** 2; if (v < d) d = v; }
      dv[j * nx + i] = Math.sqrt(d);
    }
  }
  return { own, eown, iwo, oth, eoth, iwt, m, nx, ny, h, fr: { ox: gx, oy: gy, ux, uy, vx, vy }, copies: copies.length, near, dv };`);
rep(`    v -= 0.5 * R.w;`, `    v -= 0.5 * (F.dv ? R.w * Math.min(1, Math.max(R.rampMin, F.dv[q] / R.ramp)) : R.w);`);
rep(`  let sites, seat = chamber ? null : seatSingle(group, T, K), pair = !seat;`,
`  // a tile thinner than this (the strip of *x) has room neither for a comma that winds round its partner's head nor
  // for a pair: it goes straight to the long comma below
  let inr = Infinity;
  { const c = polyCentroid(T); for (const w of wallsOf(T)) inr = Math.min(inr, w[2] - w[0] * c[0] - w[1] * c[1]); }
  const thin = !chamber && inr < K.thinBelow * size;
  let sites, seat = chamber || thin ? null : seatSingle(group, T, K), pair = !seat && !thin;`);
rep(`  if (pair) seat = seatPair(group, T, K);`, `  if (pair) seat = seatPair(group, T, K);
  if (thin) pair = false;`);
fs.writeFileSync(file, s);
console.log('patched');
