// lab/tiles.mjs — the default tile of every group in the group's own frame (tile sizes), to seat strokes by hand.
import { GROUPS } from '../../../../../src/groups.js';
import { frameOf } from '../design.js';
import { tileInFrame } from './measure.mjs';

const r = (v) => Math.round(v * 1000) / 1000;
for (const g of GROUPS) {
  const F = frameOf(g), t = tileInFrame(g, F);
  let cx = 0, cy = 0;
  for (const p of t) { cx += p[0]; cy += p[1]; }
  console.log(`${g.id.padEnd(6)} s=${r(F.s)} o=[${r(F.ox)},${r(F.oy)}] E1=[${F.E1.map(r)}] E2=[${F.E2.map(r)}] reps=${g.reps.length}`);
  console.log(`       tile ${t.map((p) => `(${r(p[0])},${r(p[1])})`).join(' ')}  centroid (${r(cx / t.length)},${r(cy / t.length)})`);
}
