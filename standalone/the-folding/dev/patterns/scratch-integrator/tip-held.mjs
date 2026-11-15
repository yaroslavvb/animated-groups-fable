// dev/patterns/scratch-integrator/tip-held.mjs — how much of the comma's tail the 3D view shows: the comma of motif.js
// as a print (its tail a needle) against the Comma print (src/patterns/comma.js: the tail kept 2 texels thick to a
// round end). Along the tail's middle line, from its tip inward, the 3D texture is read as the shader reads it
// (render3d.js sdfRead, bilinear; dark where sd < 0); "lost" is the length of the tail's end where it reads light, in
// texels of the texture.
//   node dev/patterns/scratch-integrator/tip-held.mjs
import { GROUPS } from '../../../src/groups.js';
import { motifFor } from '../../../src/motif.js';
import { makeShapePrint, bakeShapes } from '../../../src/shapes.js';
import { printFor } from '../../../src/pattern.js';
import { sdfRead } from '../../../src/render3d.js';
import { TIP_TEXELS } from '../../../src/patterns/comma.js';

const rows = [];
for (const g of GROUPS) {
  const m = motifFor(g), [sx, sy] = m.scale, ca = Math.cos(m.angle), sa = Math.sin(m.angle);
  const world = (x, y) => [m.at[0] + ca * sx * x - sa * sy * y, m.at[1] + sa * sx * x + ca * sy * y];
  const old = makeShapePrint(g, { key: 'old', shapes: m.polylines.map((p) => Array.from(p)) }), now = printFor(g, 'comma');
  const res = {};
  for (const [name, P] of [['needle', old], ['round', now]]) {
    const tex = bakeShapes(P), [e1x, e1y] = tex.e1, [e2x, e2y] = tex.e2, d = e1x * e2y - e1y * e2x, pitch = tex.pitch;
    const read = (x, y) => { const u = x - tex.origin[0], v = y - tex.origin[1]; return sdfRead(tex, (u * e2y - v * e2x) / d, (e1x * v - e1y * u) / d); };
    const w = name === 'round' ? (TIP_TEXELS * pitch) / Math.min(sx, sy) : 0;
    // the tail's middle line: half way between the back (the unit circle) and the hollow, f from the tip inward
    let lostTo = 0, arc = 0, prev = null, n = 0;
    for (let f = 0; f <= 1.2; f += 0.0005) {
      const t = 1 - Math.cos(f / 2), T = w > 0 ? Math.pow(t ** 4 + w ** 4, 0.25) : t, r = 1 - T / 2;
      const p = world(r * Math.sin(f / 2), r * Math.cos(f / 2));
      if (prev) arc += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      prev = p;
      if (P.tone(p[0], p[1]) !== 1) continue;                       // (not in the comma itself: none)
      n++;
      if (read(p[0], p[1]) >= 0) lostTo = arc;                      // the texture reads light here
    }
    res[name] = { lost: lostTo / pitch, n };
  }
  rows.push(`${g.id.padEnd(6)} needle: the 3D view loses the last ${res.needle.lost.toFixed(1).padStart(5)} texels of the tail   round end: ${res.round.lost.toFixed(1).padStart(4)} texels`);
}
for (const r of rows) console.log(r);
