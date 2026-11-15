// r6/frames.mjs — the frame of each group (design.js frameOf): the lattice and the default tile in frame coordinates,
// the rotation centres and mirrors near the tile. node r6/frames.mjs [--ids a,b]
import { GROUPS, BY_ID, symmetryElements } from '../../../../../src/groups.js';
import { frameOf } from '../design.js';
import { tileInFrame } from '../lab/measure.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);
const r = (v) => Math.round(v * 1000) / 1000;
for (const id of ids) {
  const g = BY_ID[id], F = frameOf(g), tile = tileInFrame(g, F);
  let cx = 0, cy = 0;
  for (const p of tile) { cx += p[0] / tile.length; cy += p[1] / tile.length; }
  const wc = F.toW(cx, cy), sym = symmetryElements(g, wc[0], wc[1], 1.5 * F.s);
  const cen = sym.centers.map((c) => { const f = F.toF(c.x, c.y); return `${c.order}${c.onMirror ? '*' : ''}@(${r(f[0])},${r(f[1])})`; });
  const mir = sym.mirrors.map((m) => { const p = F.toF(m.px, m.py); const ang = Math.atan2(-m.ux * F.uy + m.uy * F.ux, m.ux * F.ux + m.uy * F.uy) * 180 / Math.PI; return `(${r(p[0])},${r(p[1])})@${Math.round(ang)}`; });
  console.log(`${id}: E1 ${F.E1.map(r)} E2 ${F.E2.map(r)}  tile ${tile.map((p) => `(${r(p[0])},${r(p[1])})`).join(' ')}`);
  console.log(`   centres ${cen.slice(0, 14).join(' ')}`);
  if (mir.length) console.log(`   mirrors ${mir.slice(0, 10).join(' ')}`);
}
