// designs-measure.test.js — the heavy half of the review of the designs (review-math, 13 Nov 2026). Runs on the mini:
//   bash dev/patterns/suite.sh dev/patterns/scratch-review-math/designs-measure.test.js
// and writes its table to ~/drive.unsynced/artifacts/the-folding-review-math/designs-measure-<time>.json THERE (fetch it
// with scp). Per design and group: production validateShapes and measureShapes against kit.js measure (what proto.html
// showed the designer); the 1024 texture (bake time, its sign against the tone away from outlines, the dark share read
// from it against the exact share); the thinnest features of the motif in texels; the vertices of one plane fill.
import test from 'node:test';
import { readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { makeShapePrint, validateShapes, measureShapes, bakeShapes, shapeElements, BAKE_SIZE } from '../../../src/shapes.js';
import { sdfSample } from '../../../src/sdf.js';
import * as kit from '../kit.js';
import { GROUPS } from '../../../src/groups.js';

function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function segSeg(ax, ay, bx, by, cx, cy, dx, dy) {
  const ps = (x, y, px, py, qx, qy) => { const ex = qx - px, ey = qy - py, l2 = ex * ex + ey * ey; let t = l2 > 0 ? ((x - px) * ex + (y - py) * ey) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(x - px - t * ex, y - py - t * ey); };
  const o = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = o(cx, cy, dx, dy, ax, ay), d2 = o(cx, cy, dx, dy, bx, by), d3 = o(ax, ay, bx, by, cx, cy), d4 = o(ax, ay, bx, by, dx, dy);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
  return Math.min(ps(ax, ay, cx, cy, dx, dy), ps(bx, by, cx, cy, dx, dy), ps(cx, cy, ax, ay, bx, by), ps(dx, dy, ax, ay, bx, by));
}
/** The thinnest neck of one polygon: the nearest two non-neighbouring edges, where the outline between them (the
 *  shorter way) is more than 3 times as long as their distance: a dark stroke or a light slit, not a smooth bend. */
function neck(p) {
  const n = p.length >> 1, arc = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; arc[i + 1] = arc[i] + Math.hypot(p[2 * j] - p[2 * i], p[2 * j + 1] - p[2 * i + 1]); }
  const per = arc[n];
  let best = Infinity;
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    const i1 = (i + 1) % n, j1 = (j + 1) % n;
    const d = segSeg(p[2 * i], p[2 * i + 1], p[2 * i1], p[2 * i1 + 1], p[2 * j], p[2 * j + 1], p[2 * j1], p[2 * j1 + 1]);
    if (d >= best) continue;
    const a = Math.max(0, arc[j] - arc[i + 1]), along = Math.min(a, per - a - (arc[i + 1] - arc[i]) - (arc[j + 1] - arc[j]));
    if (along > 3 * d) best = d;
  }
  return best;
}
function between(P, Q) {
  let best = Infinity;
  const p = P.pts, q = Q.pts, n = p.length >> 1, m = q.length >> 1;
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const i1 = (i + 1) % n, j1 = (j + 1) % m; const d = segSeg(p[2 * i], p[2 * i + 1], p[2 * i1], p[2 * i1 + 1], q[2 * j], q[2 * j + 1], q[2 * j1], q[2 * j1 + 1]); if (d < best) best = d; }
  return best;
}

test('review-math: every design through the production code, measured', { timeout: 900000 }, async (t) => {
  const DIR = new URL('../designs/', import.meta.url).pathname;
  const keys = readdirSync(DIR).filter((k) => existsSync(DIR + k + '/design.js'));
  const rows = [];
  for (const key of keys) {
    let mod;
    try { mod = await import(pathToFileURL(DIR + key + '/design.js').href); } catch (e) { rows.push({ key, load: String(e.message).split('\n')[0] }); continue; }
    for (const g of GROUPS) {
      const row = { key, g: g.id };
      rows.push(row);
      let res, P;
      try { const t0 = performance.now(); res = mod.find(g); row.findMs = +(performance.now() - t0).toFixed(1); } catch (e) { row.find = String(e.message).split('\n')[0]; continue; }
      try { P = makeShapePrint(g, { key, shapes: res.shapes }); } catch (e) { row.make = String(e.message); continue; }
      const size = P.size, V = validateShapes(P);
      Object.assign(row, { ok: V.ok, problems: V.problems, stab: V.stabilizer, gap: V.gap, verts: P.verts });
      try {
        const M = measureShapes(P, { per: 40, center: g.center }), N = kit.normalize(res.shapes), K = kit.measure(g, N, { per: 40 });
        Object.assign(row, { cov: M.coverage, covExact: M.coverageExact, kitCov: K.coverage, overlap: M.overlap, kitOverlap: K.overlap, empty: M.emptyDisc, kitEmpty: K.emptyDisc, dark: M.darkDisc, kitDark: K.darkDisc, kitStab: K.stabilizer });
      } catch (e) { row.measure = String(e.message); }
      // the texture of the page (1024)
      const t1 = performance.now(), T = bakeShapes(P, BAKE_SIZE);
      row.bakeMs = +(performance.now() - t1).toFixed(1);
      row.pitch = T.pitch / size;                                       // a texel in tile sizes
      const rnd = prng(99), diag = (Math.hypot(T.e1[0] + T.e2[0], T.e1[1] + T.e2[1]) + Math.hypot(T.e1[0] - T.e2[0], T.e1[1] - T.e2[1])) / (2 * T.size);
      let bad = 0, n = 0;
      for (let i = 0; i < 3000; i++) {
        const s = rnd(), u = rnd(), x = T.origin[0] + s * T.e1[0] + u * T.e2[0], y = T.origin[1] + s * T.e1[1] + u * T.e2[1];
        if (P.margin(x, y) <= diag) continue;
        n++;
        if ((sdfSample(T.data, T.size, s, u) < 128 ? 1 : 0) !== P.tone(x, y)) bad++;
      }
      Object.assign(row, { texN: n, texBad: bad });
      // the dark share as the texture holds it (its bilinear zero set), against the exact share: what thin parts lose
      let dk = 0, tot = 0, dkExact = 0;
      const G = 700;
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
        const s = (i + 0.31) / G, u = (j + 0.73) / G;
        tot++;
        if (sdfSample(T.data, T.size, s, u) < 128) dk++;
        if (P.tone(T.origin[0] + s * T.e1[0] + u * T.e2[0], T.origin[1] + s * T.e1[1] + u * T.e2[1])) dkExact++;
      }
      Object.assign(row, { texShare: dk / tot, exactShare: dkExact / tot });
      // the thinnest parts, in texels of the 1024 texture
      let nk = Infinity, bt = Infinity;
      for (const Q of P.polys) nk = Math.min(nk, neck(Q.pts));
      for (let i = 0; i < P.polys.length; i++) for (let j = i + 1; j < P.polys.length; j++) bt = Math.min(bt, between(P.polys[i], P.polys[j]));
      Object.assign(row, { neckTexels: nk / T.pitch, betweenTexels: bt / T.pitch, gapTexels: (V.gap * size) / T.pitch });
      // one plane fill of the default window (the plane fills it twice and the tile once per draw)
      const h = 1.4 * g.viewHalf, box = [g.center[0] - h, g.center[1] - h, g.center[0] + h, g.center[1] + h];
      const els = shapeElements(P, box);
      Object.assign(row, { fillCopies: els.length, fillVerts: els.length * P.verts });
    }
  }
  const dir = homedir() + '/drive.unsynced/artifacts/the-folding-review-math';
  mkdirSync(dir, { recursive: true });
  const file = `${dir}/designs-measure-${Date.now()}.json`;
  writeFileSync(file, JSON.stringify(rows, null, 1));
  t.diagnostic('written ' + file);
  console.log('REVIEW-MATH-OUT ' + file);
});
