#!/usr/bin/env node
// shots.mjs: scene files of the surface model for ../../../../../drive.unsynced/.../proto/common/shot.mjs.
//   node shots.mjs            writes dev/surface/scene-*.json ; then  bash make-shots.sh  renders them
// Each scene is a row of shapes side by side (along x), seen from the page's view (az -20, el 14) and from above.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSurfaceModel } from '../../src/surface-model.js';
import { flip } from '../../src/flips.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NV = Number(process.env.NV || 2600);
const engineState = (k, perm, orders, L, tw = 0) => ({ k, perm, orders, L, tw, b: 0, tau: 0, thetas: [0, 0, 0, 0], print: null });
const S3333 = engineState('3333', [0, 1, 2, 3], [3, 3, 3, 3], 2.6339157938496336);
const S2345 = engineState('2345', [0, 1, 3, 2], [2, 3, 5, 4], 2.535705814997194);
const S2223 = engineState('2223', [3, 0, 1, 2], [3, 2, 2, 2], 1.3169578969248166);
const S2222 = engineState('2222', [0, 1, 2, 3], [2, 2, 2, 2], 1, 0);
const tint = [[0.60, 0.84, 0.80], [0.96, 0.90, 0.78]], back = [[0.35, 0.55, 0.52], [0.62, 0.55, 0.40]];
const BLUE = [0, 0.447, 0.698], ORANGE = [0.835, 0.369, 0], INK = [0.1, 0.1, 0.12];

/** Add a frame to a scene at offset dx along y (left to right in the page's view); turn: undo this rotation first. */
function add(scene, fr, dx, label, turn = null, shift = null) {
  const n = fr.nVertices, pos = new Array(3 * n);
  for (let v = 0; v < n; v++) {
    let x = fr.positions[3 * v], y = fr.positions[3 * v + 1], z = fr.positions[3 * v + 2];
    if (turn) { const a = x - shift[0], b = y - shift[1], c = z - shift[2]; x = turn[0] * a + turn[3] * b + turn[6] * c; y = turn[1] * a + turn[4] * b + turn[7] * c; z = turn[2] * a + turn[5] * b + turn[8] * c; }
    pos[3 * v] = x; pos[3 * v + 1] = y + dx; pos[3 * v + 2] = z;
  }
  const tri = [[], []];
  for (let t = 0; t < fr.triangles.length / 3; t++) tri[fr.pillow[t]].push(fr.triangles[3 * t], fr.triangles[3 * t + 1], fr.triangles[3 * t + 2]);
  for (let k = 0; k < 2; k++) if (tri[k].length) scene.meshes.push({ positions: pos, triangles: tri[k], color: tint[k], backColor: back[k] });
  for (const c of fr.curves) {
    const pts = []; for (const v of c.chain) pts.push(pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]);
    scene.lines.push({ points: pts, color: c.id === 'loop' ? INK : c.id === 'seal0' ? BLUE : ORANGE, width: c.id === 'loop' ? 2.5 : 4, closed: c.closed });
  }
  for (const m of fr.marks) scene.marks.push({ p: [pos[3 * m.vertex], pos[3 * m.vertex + 1], pos[3 * m.vertex + 2]], label: m.id, color: m.pair ? ORANGE : BLUE, size: m.pair ? 6 : 8 });
  if (label) scene.note += `${scene.note ? '   |   ' : ''}${label}`;
}
const blank = (title) => ({ title, note: '', meshes: [], lines: [], marks: [], views: [{ az: -20, el: 14, zoom: 2.6 }, { az: -20, el: 62, zoom: 2.6 }], cols: 1 });
const write = (name, scene) => { fs.writeFileSync(path.join(HERE, `scene-${name}.json`), JSON.stringify(scene)); console.log(name, '—', scene.note); };
const pct = (x) => `${(100 * x).toFixed(2)} %`;

// 1. Twist: 3333 at 0, 0.125, 0.25 (a drag from 0, 25 steps each, then rest)
{
  const sm = createSurfaceModel({ nVertices: NV }); sm.set(S3333);
  const scene = blank('3333 at the default Length, Twist 0, 0.125, 0.25 (warm steps from 0); page view and from above');
  let dx = 0, tw = 0;
  for (const target of [0, 0.125, 0.25]) {
    while (tw < target - 1e-9) { tw = Math.min(target, tw + 0.005); sm.update({ ...S3333, tw }, 3); }
    for (let i = 0; i < 30; i++) sm.update({ ...S3333, tw }, 3);
    const fr = sm.frame(0);
    add(scene, fr, dx, `Twist ${target}: stretch mean ${pct(fr.stats.strainMean)}, worst ${pct(fr.stats.strainMax)}`);
    dx += 2.1 * fr.frame.radius;
  }
  write('twist-3333', scene);
}
// 2. The journey, for each signature: j = 0, 1, 1.5, 2
for (const [name, st] of [['3333', S3333], ['2345', S2345], ['2223', S2223], ['2222', S2222]]) {
  const sm = createSurfaceModel({ nVertices: NV }); sm.set(st);
  const scene = blank(`${name}: the journey, j = 0 (surface), 1 (two pillows), 1.5, 2 (open crowns)`);
  let dx = 0;
  for (const j of [0, 1, 1.5, 2]) { const fr = sm.frame(j); add(scene, fr, dx, j === 0 ? `${name}: stretch mean ${pct(fr.stats.strainMean)}, worst ${pct(fr.stats.strainMax)}, gap ${fr.gap.toFixed(3)}, radius ${fr.frame.radius.toFixed(3)}` : ''); dx += 2.1 * fr.frame.radius; }
  write(`journey-${name}`, scene);
}
// 3. A flip: before; after, turned back to the old pose (should look the same); after, in the new pose
for (const [name, st, key] of [['3333', { ...S3333, tw: 0.1 }, '02|13'], ['3333d', { ...S3333, tw: 0.1 }, '03|12'], ['2345', S2345, '02|13'], ['2222', { ...S2222, tw: 0.15 }, '03|12']]) {
  const sm = createSurfaceModel({ nVertices: NV }); sm.set(st);
  const scene = blank(`${name.replace('d', '')} flip to ${key}: before | after, turned back to the old pose | after, in the new pose`);
  const f0 = sm.frame(0);
  add(scene, f0, 0, `before: L ${st.L.toFixed(3)}, Twist ${st.tw}, stretch ${pct(f0.stats.strainMean)}`);
  const r = flip(st, key), res = sm.flip(r.state, { invQ: r.invQ, before: st }), f1 = sm.frame(0);
  add(scene, f1, 2.1 * f0.frame.radius, `after: L ${r.state.L.toFixed(3)}, Twist ${r.state.tw.toFixed(3)}, cold ${res.cold}, stretch ${pct(f1.stats.strainMean)}`, res.turn, res.shift);
  add(scene, f1, 4.2 * f0.frame.radius, '');
  write(`flip-${name}-${key.replace('|', '-')}`, scene);
}

// 4. 2222 with a Twist: the grid as it comes | the grid moved onto the solid's creases
{
  const scene = blank('2222, L = 1, Twist 0.25 (the tetrahedron with square seals): grid as it comes | vertices moved onto the creases');
  let dx = 0;
  for (const follow of [false, true]) {
    const sm = createSurfaceModel({ nVertices: NV, followCreases: follow }); sm.set({ ...S2222, tw: 0.25 });
    const fr = sm.frame(0), C = fr.corners;
    let folded = 0, sides = 0;
    for (let t = 0; t < fr.triangles.length / 3; t++) for (let c = 0; c < 3; c++) {
      const c2 = (c + 1) % 3, a = fr.triangles[3 * t + c], b = fr.triangles[3 * t + c2];
      const plane = Math.hypot(C[9 * t + 3 * c] - C[9 * t + 3 * c2], C[9 * t + 3 * c + 1] - C[9 * t + 3 * c2 + 1]);
      const chord = Math.hypot(fr.positions[3 * a] - fr.positions[3 * b], fr.positions[3 * a + 1] - fr.positions[3 * b + 1], fr.positions[3 * a + 2] - fr.positions[3 * b + 2]);
      sides++; if (plane - chord > 1e-6) folded++;
    }
    add(scene, fr, dx, `${follow ? 'on the creases' : 'as it comes'}: ${folded} of ${sides} triangle sides cross a crease`);
    dx += 2.3 * fr.frame.radius;
  }
  scene.views = [{ az: -20, el: 14, zoom: 1.7 }, { az: 60, el: 30, zoom: 1.7 }];
  write('crease-2222', scene);
}
// 5. The same flip as two scenes with one camera: before, and after turned back to the old pose (they should agree)
{
  const st = { ...S3333, tw: 0.1 };
  const sm = createSurfaceModel({ nVertices: NV }); sm.set(st);
  const views = [{ az: -20, el: 14, zoom: 1.25 }, { az: 70, el: 14, zoom: 1.25 }, { az: -20, el: 62, zoom: 1.25 }];
  const a = blank('3333, Twist 0.1, BEFORE the flip to 03|12 (three views)'); a.views = views; a.cols = 3;
  const f0 = sm.frame(0); add(a, f0, 0, `before: stretch ${pct(f0.stats.strainMean)}`);
  write('flipA-before', a);
  const r = flip(st, '03|12'), res = sm.flip(r.state, { invQ: r.invQ, before: st }), f1 = sm.frame(0);
  const b = blank('3333 AFTER the flip to 03|12, turned back to the old pose (same three views): the same surface, the new pillows'); b.views = views; b.cols = 3;
  add(b, f1, 0, `after: L ${r.state.L.toFixed(3)}, Twist ${r.state.tw.toFixed(3)}, cold ${res.cold}, stretch ${pct(f1.stats.strainMean)}`, res.turn, res.shift);
  write('flipB-after-turned-back', b);
  const c = blank('3333 AFTER the flip to 03|12, in the new pose (same three views)'); c.views = views; c.cols = 3;
  add(c, f1, 0, 'new pose: the new first pair below, its seal along y');
  write('flipC-after-new-pose', c);
}
