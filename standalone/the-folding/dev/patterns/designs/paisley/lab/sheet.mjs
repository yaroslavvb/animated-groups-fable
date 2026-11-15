// lab/sheet.mjs — a quick local look at the design (no browser): the plane around the default tile for some groups.
//   node dev/patterns/designs/paisley/lab/sheet.mjs --out <png> [--ids o,2222] [--px 360] [--cols 4] [--zoom 1] [--bare 1] [--side back]
//                                                   [--knobs '{"channel":0.08}']
// --bare 1 hands find() the group WITHOUT presets (as the tests do). Prints find()'s own numbers and the time.
import { GROUPS, BY_ID, elementsNear, symmetryElements } from '../../../../../src/groups.js';
import { tileOf } from '../../../kit.js';
import { find, KNOBS, resetShapes } from '../design.js';
import { Canvas, hex } from './raster.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);
if (opt.knobs) { for (const [k, v] of Object.entries(JSON.parse(opt.knobs))) { if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(KNOBS[k], v); else KNOBS[k] = v; } resetShapes(); }
const px = +opt.px || 360, cols = +opt.cols || Math.min(4, ids.length), zoom = +opt.zoom || 1, back = opt.side === 'back';
const rows = Math.ceil(ids.length / cols);
const cv = new Canvas(cols * (px + 8), rows * (px + 8), 2);
const FRONT = [hex('#9ad5cc'), hex('#4fa397')], BACK = [hex('#f5e6c6'), hex('#d8bd85')], INK = hex('#1a1a1f'), ACC = hex('#0f766e');
const mix = (c, a) => c.map((v) => 1 + (v - 1) * a);

ids.forEach((id, k) => {
  const group = BY_ID[id];
  const ox = (k % cols) * (px + 8) + 4, oy = Math.floor(k / cols) * (px + 8) + 4;
  const arg = opt.bare ? { id: group.id, e1: group.e1, e2: group.e2, reps: group.reps, cellArea: group.cellArea, domainArea: group.domainArea, center: group.center } : group;
  let res, ms;
  try { find(arg); const t0 = performance.now(); res = find(arg); ms = performance.now() - t0; } catch (e) { console.log(id, 'ERROR', e.stack); return; }
  const tile = tileOf(group);
  const half = group.viewHalf / zoom, fx = zoom > 1 ? tile.seed[0] : group.center[0], fy = zoom > 1 ? tile.seed[1] : group.center[1], s = px / (2 * half);
  const map = (x, y) => [ox + (x - fx) * s + px / 2, oy + px / 2 - (y - fy) * s];
  const inBox = (p) => p[0] > ox - 40 && p[0] < ox + px + 40 && p[1] > oy - 40 && p[1] < oy + px + 40;
  const clipBox = (poly) => {                                  // Sutherland-Hodgman against the cell's square
    let P = poly;
    for (const [nx, ny, c] of [[1, 0, ox + px], [-1, 0, -ox], [0, 1, oy + px], [0, -1, -oy]]) {
      const out = [];
      for (let i = 0; i < P.length; i++) {
        const p = P[i], q = P[(i + 1) % P.length], sp = nx * p[0] + ny * p[1] - c, sq = nx * q[0] + ny * q[1] - c;
        if (sp <= 0) out.push(p);
        if ((sp <= 0) !== (sq <= 0)) { const t = sp / (sp - sq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
      }
      P = out;
      if (P.length < 3) return null;
    }
    return P;
  };
  const els = elementsNear(group, fx, fy, half * 1.5 + 2.5 * Math.sqrt(group.domainArea), tile.seed[0], tile.seed[1]);
  const polysOf = (g) => res.shapes.map((sh) => sh.pts.map(([x, y]) => map(g.a * x + g.b * y + g.tx, g.c * x + g.d * y + g.ty))).filter((p) => p.some(inBox)).map(clipBox).filter(Boolean);
  // the tile, light
  const tp = clipBox(tile.poly.map(([x, y]) => map(x, y)));
  if (tp) cv.fill([tp], (back ? BACK : FRONT)[0]);
  for (const g of els) {
    const flip = g.a * g.d - g.b * g.c < 0, ident = Math.abs(g.a - 1) < 1e-9 && Math.abs(g.d - 1) < 1e-9 && Math.abs(g.tx) < 1e-9 && Math.abs(g.ty) < 1e-9;
    const P = polysOf(g);
    if (!P.length) continue;
    // the copies whose centre lies in the tile are drawn full; the others pale (a rough stand-in for the page's clipping)
    cv.fill(P, flip ? mix(BACK[1], 0.55) : mix(FRONT[1], 0.42));
    void ident;
  }
  // full tone inside the tile: redraw all copies clipped to the tile polygon (convex): clip each polygon to the tile
  const clipTo = (poly, T) => {
    let P = poly;
    const n = T.length;
    let A = 0; for (let i = 0; i < n; i++) { const p = T[i], q = T[(i + 1) % n]; A += p[0] * q[1] - q[0] * p[1]; }
    const sg = A > 0 ? 1 : -1;
    for (let e = 0; e < n; e++) {
      const a = T[e], b = T[(e + 1) % n], nx = sg * (b[1] - a[1]), ny = -sg * (b[0] - a[0]), c = nx * a[0] + ny * a[1];
      const out = [];
      for (let i = 0; i < P.length; i++) {
        const p = P[i], q = P[(i + 1) % P.length], sp = nx * p[0] + ny * p[1] - c, sq = nx * q[0] + ny * q[1] - c;
        if (sp <= 0) out.push(p);
        if ((sp <= 0) !== (sq <= 0)) { const t = sp / (sp - sq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
      }
      P = out;
      if (P.length < 3) return null;
    }
    return P;
  };
  if (tp) for (const g of els) for (const P of polysOf(g)) { const Q = clipTo(P, tp); if (Q) cv.fill([Q], (back ? BACK : FRONT)[1]); }
  const sym = symmetryElements(group, fx, fy, half * 1.6);
  const seg = (m) => { const a = map(m.px - 9 * m.ux, m.py - 9 * m.uy), b = map(m.px + 9 * m.ux, m.py + 9 * m.uy); const P = clipBox([a, b, [b[0] + 0.01, b[1] + 0.01]]); return P && P.length >= 2 ? [P[0], P[Math.floor(P.length / 2)]] : null; };
  for (const m of sym.mirrors) { const a = map(m.px - 9 * m.ux, m.py - 9 * m.uy), b = map(m.px + 9 * m.ux, m.py + 9 * m.uy); const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), nx = -dy / l * 0.6, ny = dx / l * 0.6; const P = clipBox([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]); if (P) cv.fill([P], INK); }
  for (const m of sym.glides) { const a = map(m.px - 9 * m.ux, m.py - 9 * m.uy), b = map(m.px + 9 * m.ux, m.py + 9 * m.uy); const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), nx = -dy / l * 0.3, ny = dx / l * 0.3; const P = clipBox([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]); if (P) cv.fill([P], [0.45, 0.45, 0.5]); }
  void seg;
  for (const p of sym.centers) { const q = map(p.x, p.y); if (q[0] > ox && q[0] < ox + px && q[1] > oy && q[1] < oy + px) cv.dot(q[0], q[1], 1.2 + 0.45 * p.order, INK); }
  if (tp) cv.line(tp, ACC, 2, 1, true);
  cv.line([[ox, oy], [ox + px, oy], [ox + px, oy + px], [ox, oy + px]], [0.85, 0.85, 0.88], 1, 1, true);
  const verts = res.shapes.reduce((a, sh) => a + sh.pts.length, 0);
  console.log(id.padEnd(6), 'ms', ms.toFixed(1).padStart(6), 'verts', String(verts).padStart(4), JSON.stringify(res.info));
});
cv.save(opt.out);
console.log('WROTE', opt.out);
