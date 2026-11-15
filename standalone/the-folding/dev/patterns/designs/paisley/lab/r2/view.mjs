// lab/r2/view.mjs — a quick look without a browser (node, the lab's software canvas): one or more groups, each drawn
// for every start of the big comma alone (KNOBS.onlyStart) or for find() as it is; the plane round the default tile,
// copies pale (sand where the copy is mirrored), the tile's own marks full tone, mirrors in ink.
//   node dev/patterns/designs/paisley/lab/r2/view.mjs --ids '*632' --out <png> [--starts 0-5] [--px 300] [--cols 3]
//                                                   [--zoom 1.3] [--knobs '{"bigMargin":0.03}'] [--design design.js]
import { BY_ID, elementsNear, symmetryElements } from '../../../../../../src/groups.js';
import { tileOf } from '../../../../kit.js';
import { Canvas, hex } from '../raster.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const mod = await import('../../' + (opt.design || 'design.js'));
const { find, KNOBS, resetShapes } = mod;
if (opt.knobs) { for (const [k, v] of Object.entries(JSON.parse(opt.knobs))) { if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(KNOBS[k], v); else KNOBS[k] = v; } resetShapes(); }
const ids = (opt.ids || '*632').split(',');
const panels = [];
for (const id of ids) {
  if (opt.starts) { const [a, b] = opt.starts.split('-').map(Number); for (let s = a; s <= (b ?? a); s++) panels.push({ id, start: s }); } else panels.push({ id, start: null });
}
const px = +opt.px || 300, cols = +opt.cols || Math.min(3, panels.length), zoom = +opt.zoom || 1.3, rows = Math.ceil(panels.length / cols);
const cv = new Canvas(cols * (px + 6), rows * (px + 6), 2);
const FRONT = [hex('#9ad5cc'), hex('#4fa397')], BACK = [hex('#f5e6c6'), hex('#d8bd85')], INK = hex('#1a1a1f'), ACC = hex('#0f766e');
const mix = (c, a) => c.map((v) => 1 + (v - 1) * a);
panels.forEach((P0, k) => {
  const group = BY_ID[P0.id];
  KNOBS.onlyStart = P0.start === null ? undefined : P0.start;
  const res = find(group);
  KNOBS.onlyStart = undefined;
  const ox = (k % cols) * (px + 6) + 3, oy = Math.floor(k / cols) * (px + 6) + 3;
  const tile = tileOf(group), half = group.viewHalf / zoom, fx = tile.seed[0], fy = tile.seed[1], s = px / (2 * half);
  const map = (x, y) => [ox + (x - fx) * s + px / 2, oy + px / 2 - (y - fy) * s];
  const box = (poly) => {
    let P = poly;
    for (const [nx, ny, c] of [[1, 0, ox + px], [-1, 0, -ox], [0, 1, oy + px], [0, -1, -oy]]) {
      const out = [];
      for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], sp = nx * p[0] + ny * p[1] - c, sq = nx * q[0] + ny * q[1] - c; if (sp <= 0) out.push(p); if ((sp <= 0) !== (sq <= 0)) { const t = sp / (sp - sq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); } }
      P = out; if (P.length < 3) return null;
    }
    return P;
  };
  const clipTo = (poly, T) => {
    let P = poly, A = 0;
    for (let i = 0; i < T.length; i++) { const p = T[i], q = T[(i + 1) % T.length]; A += p[0] * q[1] - q[0] * p[1]; }
    const sg = A > 0 ? 1 : -1;
    for (let e = 0; e < T.length; e++) {
      const a = T[e], b = T[(e + 1) % T.length], nx = sg * (b[1] - a[1]), ny = -sg * (b[0] - a[0]), c = nx * a[0] + ny * a[1], out = [];
      for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], sp = nx * p[0] + ny * p[1] - c, sq = nx * q[0] + ny * q[1] - c; if (sp <= 0) out.push(p); if ((sp <= 0) !== (sq <= 0)) { const t = sp / (sp - sq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); } }
      P = out; if (P.length < 3) return null;
    }
    return P;
  };
  const els = elementsNear(group, fx, fy, half * 1.5 + 2.5 * Math.sqrt(group.domainArea), fx, fy);
  const polysOf = (g) => res.shapes.map((sh) => sh.pts.map(([x, y]) => map(g.a * x + g.b * y + g.tx, g.c * x + g.d * y + g.ty)));
  const tp = box(tile.poly.map(([x, y]) => map(x, y)));
  if (tp) cv.fill([tp], FRONT[0]);
  for (const g of els) {
    const flip = g.a * g.d - g.b * g.c < 0, P = polysOf(g).map(box).filter(Boolean);
    if (P.length) cv.fill(P, flip ? mix(BACK[1], 0.6) : mix(FRONT[1], 0.45));
  }
  if (tp) for (const g of els) for (const P of polysOf(g)) { const Q = clipTo(P, tp); if (Q) cv.fill([Q], FRONT[1]); }
  const sym = symmetryElements(group, fx, fy, half * 1.6);
  for (const m of sym.mirrors) { const a = map(m.px - 9 * m.ux, m.py - 9 * m.uy), b = map(m.px + 9 * m.ux, m.py + 9 * m.uy); const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), nx = (-dy / l) * 0.5, ny = (dx / l) * 0.5; const P = box([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]); if (P) cv.fill([P], INK); }
  for (const p of sym.centers) { const q = map(p.x, p.y); if (q[0] > ox && q[0] < ox + px && q[1] > oy && q[1] < oy + px) cv.dot(q[0], q[1], 1 + 0.4 * p.order, INK); }
  if (tp) cv.line(tp, ACC, 1.6, 1, true);
  cv.line([[ox, oy], [ox + px, oy], [ox + px, oy + px], [ox, oy + px]], [0.8, 0.8, 0.84], 1, 1, true);
  const I = res.info, t = (I.tried || []).find((x) => x) || {};
  console.log(P0.id.padEnd(6), P0.start === null ? 'find' : 'start ' + P0.start, (I.tried || []).map((x) => `${x.kind}${x.e}`).join(' '), `bare ${I.bare} cover ${I.cover} marks ${I.marks}`, JSON.stringify(I.long), JSON.stringify(I.head), void t || '');
});
cv.save(opt.out);
console.log('WROTE', opt.out);
