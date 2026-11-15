// designs/spiral/check.mjs — fast checks of a design without a browser (plain node, about a second):
//   per group: vertices, ms of find(), dark share (area of the motif / area of the tile: exact while copies are disjoint),
//   self-crossings of the outline, shortest and longest segment, sharpest turn, distance of the motif from the rim of
//   the default tile (so copies are at least twice that apart), smallest distance between the motif and its nearest
//   copies (brute force on the outline's vertices against the copies' segments).
//   node dev/patterns/designs/spiral/check.mjs [design.js] [ids]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { GROUPS, BY_ID, elementsNear } from '../../../../src/groups.js';
import { normalize, tileOf } from '../../kit.js';

const file = process.argv[2] || 'design.js';
const ids = process.argv[3] ? process.argv[3].split(',') : GROUPS.map((g) => g.id);
const mod = await import(pathToFileURL(path.resolve(path.dirname(new URL(import.meta.url).pathname), file)).href);

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function cross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
const r3 = (v) => Math.round(v * 1000) / 1000;
const rows = [];
for (const id of ids) {
  const g = BY_ID[id], ts = Math.sqrt(g.domainArea);
  mod.find(g);                                             // warm
  const t0 = performance.now();
  const res = mod.find(g);
  const ms = performance.now() - t0;
  const N = normalize(res.shapes);
  let area = 0, minSeg = Infinity, maxSeg = 0, maxTurn = 0, selfX = 0, rim = Infinity;
  const tile = tileOf(g);
  for (const P of N.polys) {
    const p = P.pts, n = p.length / 2;
    area += (P.hole ? -1 : 1) * P.area;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, k = (i + 2) % n;
      const l = Math.hypot(p[2 * j] - p[2 * i], p[2 * j + 1] - p[2 * i + 1]);
      minSeg = Math.min(minSeg, l); maxSeg = Math.max(maxSeg, l);
      const a1 = Math.atan2(p[2 * j + 1] - p[2 * i + 1], p[2 * j] - p[2 * i]), a2 = Math.atan2(p[2 * k + 1] - p[2 * j + 1], p[2 * k] - p[2 * j]);
      let d = Math.abs(a2 - a1); if (d > Math.PI) d = 2 * Math.PI - d;
      maxTurn = Math.max(maxTurn, d);
      // distance to the rim of the default tile (inside: positive)
      let dr = Infinity;
      for (let e = 0; e < tile.poly.length; e++) { const a = tile.poly[e], b = tile.poly[(e + 1) % tile.poly.length]; dr = Math.min(dr, segDist(p[2 * i], p[2 * i + 1], a[0], a[1], b[0], b[1])); }
      if (!tile.domain.contains(p[2 * i], p[2 * i + 1], 0)) dr = -dr;
      rim = Math.min(rim, dr);
    }
    if (n < 4000) for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const i2 = (i + 1) % n, j2 = (j + 1) % n;
      if (cross(p[2 * i], p[2 * i + 1], p[2 * i2], p[2 * i2 + 1], p[2 * j], p[2 * j + 1], p[2 * j2], p[2 * j2 + 1])) selfX++;
    }
  }
  // nearest copies
  let gap = Infinity;
  const els = elementsNear(g, N.cx, N.cy, 2 * N.R + 0.1 * ts, N.cx, N.cy).filter((e) => !(Math.abs(e.a - 1) < 1e-9 && Math.abs(e.d - 1) < 1e-9 && Math.abs(e.tx) < 1e-9 && Math.abs(e.ty) < 1e-9));
  const P0 = N.polys[0].pts, n0 = P0.length / 2, stride = Math.max(1, Math.floor(n0 / 400));
  for (const e of els) {
    const q = new Float64Array(P0.length);
    for (let i = 0; i < n0; i++) { q[2 * i] = e.a * P0[2 * i] + e.b * P0[2 * i + 1] + e.tx; q[2 * i + 1] = e.c * P0[2 * i] + e.d * P0[2 * i + 1] + e.ty; }
    for (let i = 0; i < n0; i += stride) for (let j = 0; j < n0; j++) { const k = (j + 1) % n0; const d = segDist(P0[2 * i], P0[2 * i + 1], q[2 * j], q[2 * j + 1], q[2 * k], q[2 * k + 1]); if (d < gap) gap = d; }
  }
  rows.push({ id, verts: N.verts, ms: r3(ms), dark: r3(area / g.domainArea), selfX, minSeg: r3(minSeg / ts), maxSeg: r3(maxSeg / ts), maxTurnDeg: r3((maxTurn * 180) / Math.PI), rim: r3(rim / ts), gap: r3(gap / ts), info: JSON.stringify(res.info) });
}
console.table(rows);
