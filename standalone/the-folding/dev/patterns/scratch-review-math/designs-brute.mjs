// designs-brute.mjs — the real designs against the reviewer's brute force: W, margin, the nonzero fill, and the two
// invariance checks of pattern.js (invariantUnder, exactlyInvariant), every group (review-math, 13 Nov 2026).
//   node dev/patterns/scratch-review-math/designs-brute.mjs [--designs a,b] [--pts 60]
import { readdirSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { makeShapePrint, fillShapes } from '../../../src/shapes.js';
import { invariantUnder, exactlyInvariant } from '../../../src/pattern.js';
import { GROUPS, prng, flatMotif, bruteW, bruteMargin, recorder, windingOf, elementsNear } from './lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = new URL('../designs/', import.meta.url).pathname, only = arg('--designs', '').split(',').filter(Boolean), NP = +arg('--pts', 60);
const keys = readdirSync(DIR).filter((k) => existsSync(DIR + k + '/design.js') && (!only.length || only.includes(k)));
const t0 = Date.now();
for (const key of keys) {
  const mod = await import(pathToFileURL(DIR + key + '/design.js').href);
  const tally = { pts: 0, w: 0, m: 0, f: 0, inv: 0, sieve: 0, sharp: 0, threw: [] };
  for (const g of GROUPS) {
    let res;
    try { res = mod.find(g); } catch (e) { tally.threw.push(g.id + ': ' + String(e.message).slice(0, 80)); continue; }
    const P = makeShapePrint(g, { shapes: res.shapes }), F = flatMotif(res.shapes.map((s) => ({ pts: s.pts, hole: s.hole }))), size = P.size, rnd = prng(7);
    const L = Math.max(Math.hypot(...g.e1), Math.hypot(...g.e2)), c = recorder();
    fillShapes(c, P, (x, y, o) => { o[0] = x; o[1] = y; return o; }, [g.center[0] - 1.2 * L, g.center[1] - 1.2 * L, g.center[0] + 1.2 * L, g.center[1] + 1.2 * L], '#000');
    const els = elementsNear(g, g.center[0], g.center[1], 3 * L);
    for (let i = 0; i < NP; i++) {
      const x = g.center[0] + (2 * rnd() - 1) * L, y = g.center[1] + (2 * rnd() - 1) * L, bm = bruteMargin(g, F, x, y, 0.3 * size), m = P.margin(x, y);
      if (Math.abs(bm - m) > 1e-9 * size && !(bm >= 0.3 * size && m >= 0.3 * size)) tally.m++;
      if (bm < 1e-9 * size) continue;
      tally.pts++;
      const W = P.winding(x, y);
      if (W !== bruteW(g, F, x, y)) tally.w++;
      if (windingOf(c.fills[0].path, x, y) !== W) tally.f++;
      const e = els[(rnd() * els.length) | 0];
      if (P.tone(e.a * x + e.b * y + e.tx, e.c * x + e.d * y + e.ty) !== P.tone(x, y)) tally.inv++;
    }
    if (!invariantUnder(g, P, 240, 11)) tally.sieve++;
    if (!exactlyInvariant(g, P, 40, 13)) tally.sharp++;
  }
  console.log(`${key.padEnd(9)} points ${tally.pts}: W vs brute ${tally.w}, margin vs brute ${tally.m}, fill winding vs W ${tally.f}, tone under elements ${tally.inv}; invariantUnder false in ${tally.sieve} groups, exactlyInvariant false in ${tally.sharp}${tally.threw.length ? '; find threw: ' + tally.threw.join('; ') : ''}`);
}
console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s`);
