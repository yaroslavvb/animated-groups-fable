// lab/patch-sweep.mjs — one-off: a single comma's tail that ends in a corner still winds round its partner (>= 1.3 rad);
// a pair's may wind less; a glide along a mirror is no partner (its partner's head lies across the mirror).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), file = path.resolve(here, '../design.js');
let s = fs.readFileSync(file, 'utf8');
const rep = (a, b) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error('pattern found ' + n + ' times: ' + a.slice(0, 80)); s = s.replace(a, () => b); };
rep(`  pinSweep: [0.6, 5.5],         // ... after winding this far round the partner's head`,
    `  pinSweep: [1.3, 5.0],         // ... after winding this far round the partner's head (a pair: pinSweepPair)
  pinSweepPair: [0.6, 5.5],`);
rep(`        const wa = pinOf(a, b, qa, sgn, u, K), wb = wa && pinOf(b, a, qb, sgn, u, K);`,
    `        const wa = pinOf(a, b, qa, sgn, u, PK), wb = wa && pinOf(b, a, qb, sgn, u, PK);`);
rep(`  const W = wallsOf(T), pins = pinsOf(T, K, u);
  // the least head`, `  const W = wallsOf(T), pins = pinsOf(T, K, u), PK = { pinSweep: K.pinSweepPair };
  // the least head`);
rep(`      if (isReflection(g, 1e-7 * u) || isTranslation(g)) continue;`,
    `      if (isReflection(g, 1e-7 * u) || isTranslation(g) || isMirrorGlide(group, g)) continue;`);
rep(`const isTranslation = (g) =>`, `/** A glide whose axis is a mirror of the group (in ** and the like): no partner, its head lies across the mirror. */
const isMirrorGlide = (group, g) => {
  if (g.a * g.d - g.b * g.c > 0) return false;
  const vx = (g.a * g.tx + g.b * g.ty + g.tx) / 2, vy = (g.c * g.tx + g.d * g.ty + g.ty) / 2;     // half of g o g: the glide's own shift
  return contains(group, { a: g.a, b: g.b, c: g.c, d: g.d, tx: g.tx - vx, ty: g.ty - vy }, 1e-6);
};
const isTranslation = (g) =>`);
fs.writeFileSync(file, s);
console.log('patched');
