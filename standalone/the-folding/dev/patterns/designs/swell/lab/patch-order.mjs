// lab/patch-order.mjs — one-off: round a partner of a rotation of order n the tail need only wind most of the angle
// between neighbouring heads (2 pi / n); the cap of the dark share where a bare place is closed is 0.62.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), file = path.resolve(here, '../design.js');
let s = fs.readFileSync(file, 'utf8');
const rep = (a, b) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error('pattern found ' + n + ' times: ' + a.slice(0, 80)); s = s.replace(a, () => b); };
rep(`      for (const q of pins) for (let sgn = 1; sgn >= -1; sgn -= 2) {
        const w = pinOf(h, p, q, sgn, u, K);`, `      const ang = Math.abs(Math.atan2(g.c, g.a)), order = g.a * g.d - g.b * g.c > 0 && ang > 1e-6 ? Math.round((2 * Math.PI) / ang) : Infinity;
      const PS = { pinSweep: [Math.min(K.pinSweep[0], (K.pinTurn * 2 * Math.PI) / order), K.pinSweep[1]] };
      for (const q of pins) for (let sgn = 1; sgn >= -1; sgn -= 2) {
        const w = pinOf(h, p, q, sgn, u, PS);`);
rep(`  pinSweepPair: [0.6, 5.5],`, `  pinSweepPair: [0.6, 5.5],
  pinTurn: 0.9,        // ... round the head of a rotation partner of order n, at least this share of 2 pi / n`);
rep(`  cap: 0.6,            // ... and the most it may be where LAMBDA is raised to close a bare place`,
    `  cap: 0.62,           // ... and the most it may be where LAMBDA is raised to close a bare place`);
fs.writeFileSync(file, s);
console.log('patched');
