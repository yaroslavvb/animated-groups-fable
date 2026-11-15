// lab/check.mjs — the hard rules, on the polygons find() returns (not on the grid): the kit's own numbers, the least
// distance between two copies of the motif, self-crossings, the vertex count, the segments, the mark inside the tile.
//   node lab/check.mjs [--ids o,442] [--per 56] [--json out.json]
import fs from 'node:fs';
import { GROUPS, BY_ID, elementsNear } from '../../../../../src/groups.js';
import { find } from '../design.js';
import { normalize, measure, tileOf, GAP_MIN, MAX_VERTS } from '../../../kit.js';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);

function segDist(ax, ay, bx, by, cx, cy, dx, dy) {            // distance between the segments ab and cd
  const pd = (px, py, qx, qy, rx, ry) => { const ex = rx - qx, ey = ry - qy, t = Math.min(1, Math.max(0, ((px - qx) * ex + (py - qy) * ey) / (ex * ex + ey * ey || 1))); return Math.hypot(px - qx - t * ex, py - qy - t * ey); };
  const o = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  if (o(ax, ay, bx, by, cx, cy) * o(ax, ay, bx, by, dx, dy) < 0 && o(cx, cy, dx, dy, ax, ay) * o(cx, cy, dx, dy, bx, by) < 0) return 0;
  return Math.min(pd(ax, ay, cx, cy, dx, dy), pd(bx, by, cx, cy, dx, dy), pd(cx, cy, ax, ay, bx, by), pd(dx, dy, ax, ay, bx, by));
}
const rows = [];
let broken = 0;
for (const id of ids) {
  const g = BY_ID[id], size = Math.sqrt(g.domainArea);
  find(g);
  const t0 = performance.now(), res = find(g), ms = performance.now() - t0;
  const N = normalize(res.shapes), m = measure(g, N, { per: +opt.per || 56 });
  // segments and turning
  let minSeg = Infinity, maxSeg = 0, maxTurn = 0, length = 0, selfX = 0;
  const flat = N.polys.map((P) => P.pts);
  for (const p of flat) {
    const n = p.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, k = (i + 2) % n, ax = p[2 * j] - p[2 * i], ay = p[2 * j + 1] - p[2 * i + 1], bx = p[2 * k] - p[2 * j], by = p[2 * k + 1] - p[2 * j + 1];
      const L = Math.hypot(ax, ay) / size;
      minSeg = Math.min(minSeg, L); maxSeg = Math.max(maxSeg, L); maxTurn = Math.max(maxTurn, Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by)));
    }
    for (let i = 0; i < n; i += 3) for (let j = i + 3; j < n; j += 3) length = Math.max(length, Math.hypot(p[2 * i] - p[2 * j], p[2 * i + 1] - p[2 * j + 1]) / size);
    // self-crossings: two sides that are not neighbours and cross
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const i2 = (i + 1) % n, j2 = (j + 1) % n;
      if (segDist(p[2 * i], p[2 * i + 1], p[2 * i2], p[2 * i2 + 1], p[2 * j], p[2 * j + 1], p[2 * j2], p[2 * j2 + 1]) === 0) selfX++;
    }
  }
  // the least distance between the motif and another copy of it (and between two polygons of the motif)
  let gap = Infinity;
  const els = elementsNear(g, N.cx, N.cy, 2 * N.R + size, N.cx, N.cy);
  const far = (P, Q, d) => P[0] > Q[2] + d || Q[0] > P[2] + d || P[1] > Q[3] + d || Q[1] > P[3] + d;
  for (const e of els) {
    const ident = Math.abs(e.a - 1) < 1e-9 && Math.abs(e.b) < 1e-9 && Math.abs(e.tx) < 1e-9 && Math.abs(e.ty) < 1e-9 && e.a * e.d - e.b * e.c > 0;
    for (let a = 0; a < N.polys.length; a++) for (let b = 0; b < N.polys.length; b++) {
      if (ident && b <= a) continue;
      const p = flat[a], q0 = flat[b], nq = q0.length / 2, q = new Float64Array(2 * nq), box = [Infinity, Infinity, -Infinity, -Infinity];
      for (let i = 0; i < nq; i++) { const x = e.a * q0[2 * i] + e.b * q0[2 * i + 1] + e.tx, y = e.c * q0[2 * i] + e.d * q0[2 * i + 1] + e.ty; q[2 * i] = x; q[2 * i + 1] = y; box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y); }
      if (far(N.polys[a].box, box, Math.min(gap, 0.5 * size))) continue;
      const np = p.length / 2;
      for (let i = 0; i < np; i++) {
        const i2 = (i + 1) % np, x0 = Math.min(p[2 * i], p[2 * i2]), x1 = Math.max(p[2 * i], p[2 * i2]), y0 = Math.min(p[2 * i + 1], p[2 * i2 + 1]), y1 = Math.max(p[2 * i + 1], p[2 * i2 + 1]);
        if (x0 > box[2] + gap || x1 < box[0] - gap || y0 > box[3] + gap || y1 < box[1] - gap) continue;
        for (let j = 0; j < nq; j++) {
          const j2 = (j + 1) % nq;
          if (Math.min(q[2 * j], q[2 * j2]) > x1 + gap || Math.max(q[2 * j], q[2 * j2]) < x0 - gap || Math.min(q[2 * j + 1], q[2 * j2 + 1]) > y1 + gap || Math.max(q[2 * j + 1], q[2 * j2 + 1]) < y0 - gap) continue;
          gap = Math.min(gap, segDist(p[2 * i], p[2 * i + 1], p[2 * i2], p[2 * i2 + 1], q[2 * j], q[2 * j + 1], q[2 * j2], q[2 * j2 + 1]));
        }
      }
    }
  }
  gap /= size;
  // the main mark in the default tile: the least signed distance of its vertices from the tile's sides (negative: outside)
  let inside = Infinity;
  if (g.presets && N.polys.length) {
    const T = tileOf(g).poly, p = flat[0];
    for (let i = 0; i < p.length; i += 2) for (let k = 0; k < T.length; k++) {
      const a = T[k], b = T[(k + 1) % T.length], ex = b[0] - a[0], ey = b[1] - a[1];
      inside = Math.min(inside, (ex * (p[i + 1] - a[1]) - ey * (p[i] - a[0])) / Math.hypot(ex, ey) / size);
    }
  }
  const bad = [];
  if (m.overlap > 0.004) bad.push('copies overlap');
  if (gap < GAP_MIN) bad.push(`copies ${gap.toFixed(3)} apart`);
  if (N.verts > MAX_VERTS) bad.push(`${N.verts} vertices`);
  if (selfX) bad.push(`${selfX} self-crossings`);
  if (m.coverage < 0.4 || m.coverage > 0.62) bad.push(`dark ${m.coverage}`);
  if (m.emptyDisc > 0.6) bad.push(`bare ${m.emptyDisc}`);
  if (m.darkDisc > 0.7) bad.push(`solid ${m.darkDisc}`);
  if (ms > 120) bad.push(`${ms.toFixed(0)} ms`);
  if (res.info.symmetric) bad.push('a symmetric blob');
  if (!res.info.bounded) bad.push('an endless blob');
  if (bad.length) broken++;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const row = { id, ms: r3(ms), polys: N.polys.length, verts: N.verts, coverage: m.coverage, bare: m.emptyDisc, solid: m.darkDisc, overlap: m.overlap, gap: r3(gap), length: r3(length), inTile: r3(inside), minSeg: r3(minSeg), maxSeg: r3(maxSeg), maxTurn: r3(maxTurn), level: r3(res.info.level), bad };
  rows.push(row);
  console.log(`${id.padEnd(6)} ${String(row.ms).padStart(5)} ms ${String(N.verts).padStart(4)} pts  dark ${m.coverage.toFixed(3)}  bare ${m.emptyDisc.toFixed(3)}  solid ${m.darkDisc.toFixed(3)}  gap ${gap.toFixed(3)}  long ${length.toFixed(2)}  in tile ${inside.toFixed(3)}  seg ${minSeg.toFixed(3)}..${maxSeg.toFixed(3)} turn ${maxTurn.toFixed(2)}  level ${row.level}${bad.length ? '   !! ' + bad.join(', ') : ''}`);
}
const W = (k, f) => f(...rows.map((r) => r[k]));
console.log(`worst: dark ${W('coverage', Math.min)}..${W('coverage', Math.max)}  bare ${W('bare', Math.max)}  solid ${W('solid', Math.max)}  gap ${W('gap', Math.min)}  verts ${W('verts', Math.max)}  ms ${W('ms', Math.max)}  overlap ${W('overlap', Math.max)}; ${broken} group(s) break a rule`);
if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(rows, null, 1));
