// lab/view.mjs — a quick contact sheet of strokes, drawn straight from u (no browser).
//   node lab/view.mjs --out <png> [--ids o,2222,442,333] [--strokes file.json] [--px 330] [--cols 4] [--zoom 1] [--beads 1] [--poly 1] [--back 1]
// --strokes: a JSON { id: stroke } that overrides the table of design.js. --poly 1 also draws the outline find() returns.
import fs from 'node:fs';
import { GROUPS, BY_ID, symmetryElements, elementsNear } from '../../../../../src/groups.js';
import { buildDomain } from '../../../../../src/domain.js';
import { STROKES, solve, find, strokeBeads } from '../design.js';
import { analyse, score } from './measure.mjs';
import { Raster } from './png.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const px = +opt.px || 330, cols = +opt.cols || 4, zoom = +opt.zoom || 1;
let ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);
let over = opt.strokes ? JSON.parse(fs.readFileSync(opt.strokes, 'utf8')) : {};
let variants = null;
if (Array.isArray(over)) { variants = over; ids = variants.map((v) => v.id); over = {}; }      // [{ id, stroke, label }]: one panel each
const rows = Math.ceil(ids.length / cols), capH = 30, pad = 8;
const R = new Raster(cols * (px + pad) + pad, rows * (px + capH + pad) + pad);
const back = opt.back === '1';
const LIGHT = back ? [245, 230, 198] : [154, 213, 204], DARK = back ? [216, 189, 133] : [79, 163, 151], PALE = [205, 229, 225], INK = [26, 26, 31], ACC = [15, 118, 110];

ids.forEach((id, n) => {
  const group = BY_ID[id], stroke = variants ? variants[n].stroke : (over[id] && over[id].stroke) || over[id] || STROKES[id] || STROKES.default;
  const X0 = pad + (n % cols) * (px + pad), Y0 = pad + Math.floor(n / cols) * (px + capH + pad), clip = [X0, Y0, X0 + px, Y0 + px];
  const S = solve(group, stroke, { h: 0.0125, settle: opt.settle !== '0' }), { F, fld, c } = S, { N1, N2, U } = fld;
  const m = analyse(group, stroke, { h: 0.02 });
  const tile = buildDomain(group, { seed: group.presets[0].seed, metric: group.presets[0].metric });
  const half = group.viewHalf / zoom, fx = zoom > 1 ? tile.seed[0] : group.center[0], fy = zoom > 1 ? tile.seed[1] : group.center[1], sc = px / (2 * half);
  const toPx = (x, y) => [X0 + (x - fx) * sc + px / 2, Y0 + px / 2 - (y - fy) * sc];
  const f = [0, 0];
  // which hand the copy of the tile under a frame point has: +1 (the tile's own), -1 (mirrored), 0 (not found)
  const tf = tile.poly.map((p) => F.toF(p[0], p[1]));
  let tcx = 0, tcy = 0;
  for (const p of tf) { tcx += p[0] / tf.length; tcy += p[1] / tf.length; }
  const inTf = (x, y) => { for (let i = 0; i < tf.length; i++) { const a = tf[i], b = tf[(i + 1) % tf.length]; if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < -1e-9) return false; } return true; };
  const handAt = (x, y) => {
    for (const r of F.reps) {
      const dx = x - r.tx, dy = y - r.ty, zx = r.a * dx + r.c * dy, zy = r.b * dx + r.d * dy;      // r^-1 (x)
      const s0 = Math.round(((zx - tcx) * F.E2[1] - (zy - tcy) * F.E2[0]) / fld.det * N1 / N1), t0 = Math.round((F.E1[0] * (zy - tcy) - F.E1[1] * (zx - tcx)) / fld.det * N2 / N2);
      for (let m = s0 - 1; m <= s0 + 1; m++) for (let n = t0 - 1; n <= t0 + 1; n++) if (inTf(zx - m * F.E1[0] - n * F.E2[0], zy - m * F.E1[1] - n * F.E2[1])) return r.a * r.d - r.b * r.c > 0 ? 1 : -1;
    }
    return 0;
  };
  const PALE_T = [220, 237, 234], PALE_S = [239, 227, 204];
  for (let py = 0; py < px; py++) for (let qx = 0; qx < px; qx++) {
    const x = fx + (qx + 0.5 - px / 2) / sc, y = fy - (py + 0.5 - px / 2) / sc;
    F.toF(x, y, f);
    let gi = (N1 * (f[0] * F.E2[1] - f[1] * F.E2[0])) / fld.det, gj = (N2 * (F.E1[0] * f[1] - F.E1[1] * f[0])) / fld.det;
    const i0 = Math.floor(gi), j0 = Math.floor(gj), fi = gi - i0, fj = gj - j0;
    const w = (I, J) => U[(((J % N2) + N2) % N2) * N1 + (((I % N1) + N1) % N1)];
    const u = (1 - fi) * (1 - fj) * w(i0, j0) + fi * (1 - fj) * w(i0 + 1, j0) + (1 - fi) * fj * w(i0, j0 + 1) + fi * fj * w(i0 + 1, j0 + 1);
    const inT = tile.contains(x, y);
    R.set(X0 + qx, Y0 + py, u > c ? (inT ? DARK : opt.hands === '0' ? PALE : handAt(f[0], f[1]) < 0 ? PALE_S : PALE_T) : (inT ? LIGHT : [255, 255, 255]));
  }
  const sym = symmetryElements(group, fx, fy, half * 1.6);
  for (const g of sym.glides) { const a = toPx(g.px - 9 * g.ux, g.py - 9 * g.uy), b = toPx(g.px + 9 * g.ux, g.py + 9 * g.uy); R.line(a[0], a[1], b[0], b[1], [120, 120, 128], 1, 0.8, [4, 3], clip); }
  for (const g of sym.mirrors) { const a = toPx(g.px - 9 * g.ux, g.py - 9 * g.uy), b = toPx(g.px + 9 * g.ux, g.py + 9 * g.uy); R.line(a[0], a[1], b[0], b[1], INK, 1.4, 1, null, clip); }
  for (const p of sym.centers) { const a = toPx(p.x, p.y); R.dot(a[0], a[1], 1.2 + 0.45 * p.order, INK, clip); }
  tile.poly.forEach((p, k) => { const q = tile.poly[(k + 1) % tile.poly.length], a = toPx(p[0], p[1]), b = toPx(q[0], q[1]); R.line(a[0], a[1], b[0], b[1], ACC, 2, 1, null, clip); });
  if (opt.disc !== '0' && m.bareAt) {                       // the largest bare disc (red) and the fattest dark place (blue), every lattice translate
    for (const [at, d, col] of [[m.bareAt, m.bare, [220, 30, 30]], [m.solidAt, m.solid, [30, 60, 220]]]) {
      for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) {
        const w = F.toW(at[0] + a * F.E1[0] + b * F.E2[0], at[1] + a * F.E1[1] + b * F.E2[1]), c0 = toPx(w[0], w[1]), r = (d / 2) * F.s * sc;
        if (c0[0] < X0 - r || c0[0] > X0 + px + r || c0[1] < Y0 - r || c0[1] > Y0 + px + r) continue;
        for (let k = 0; k < 48; k++) { const t0 = (k / 48) * 2 * Math.PI, t1 = ((k + 1) / 48) * 2 * Math.PI; R.line(c0[0] + r * Math.cos(t0), c0[1] + r * Math.sin(t0), c0[0] + r * Math.cos(t1), c0[1] + r * Math.sin(t1), col, 1.2, 0.9, null, clip); }
      }
    }
  }
  if (opt.beads === '1') {
    const beads = strokeBeads(stroke), w = [0, 0];
    for (let b = 0; b < beads.length; b += 4) { F.toW(beads[b], beads[b + 1], w); const a = toPx(w[0], w[1]); R.dot(a[0], a[1], b ? 1 : 2.5, [200, 60, 20], clip); }
  }
  if (opt.poly === '1') {
    const res = find({ ...group, id: group.id });
    const use = over[id] ? null : res;
    if (use) {
      for (const sh of use.shapes) {
        let cx = 0, cy = 0;
        for (const p of sh.pts) { cx += p[0]; cy += p[1]; }
        cx /= sh.pts.length; cy /= sh.pts.length;
        for (const g of elementsNear(group, fx, fy, half * 1.5 + 2, cx, cy)) {
          sh.pts.forEach((p, k) => {
            const q = sh.pts[(k + 1) % sh.pts.length];
            const a = toPx(g.a * p[0] + g.b * p[1] + g.tx, g.c * p[0] + g.d * p[1] + g.ty), b = toPx(g.a * q[0] + g.b * q[1] + g.tx, g.c * q[0] + g.d * q[1] + g.ty);
            R.line(a[0], a[1], b[0], b[1], [20, 20, 90], 1, 0.9, null, clip);
          });
        }
      }
    }
  }
  const r2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '-');
  R.text(X0, Y0 + px + 3, `${variants && variants[n].label ? variants[n].label : id} c${Math.round(100 * m.cover)} b${r2(m.bare)} s${r2(m.solid)} g${r2(m.gap)} t${r2(m.thin)}`, INK, 2);
  R.text(X0, Y0 + px + 16, `in${r2(m.inTile)} d${r2(m.dent)} a${r2(m.asym)} l${r2(m.length)} m${m.marks} ${m.valid ? '' : '!bad '}sc${r2(score(m))}`, m.valid ? INK : [180, 60, 0], 2);
  console.log(id, JSON.stringify({ ...m, ms: Math.round(m.ms), score: +score(m).toFixed(3) }));
});
R.write(opt.out || 'view.png');
console.log('WROTE', opt.out);
