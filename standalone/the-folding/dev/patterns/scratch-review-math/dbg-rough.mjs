// dbg-rough.mjs — why does a rosette with one vertex 1e-5 tile sizes off pass validateShapes in *333?
import { makeShapePrint, validateShapes } from '../../../src/shapes.js';
import { BY_ID, rosette, roomAt, symmetryElements } from './lib.mjs';

for (const id of ['*333', '3*3', '*632']) {
  const g = BY_ID[id], size = Math.sqrt(g.domainArea), L = Math.hypot(...g.e1) + Math.hypot(...g.e2);
  const c = symmetryElements(g, g.center[0], g.center[1], L).centers.find((q) => q.order === 3 && q.onMirror);
  if (!c) continue;
  const room = roomAt(g, c.x, c.y), o = rosette(g, [c.x, c.y], 0.3 * room, 240, { amp: 0.08, seed: 11 });
  for (const k of [7, 8, 30, 61]) for (const dir of [[1, 0], [0, 1]]) {
    const p = o.pts[k], q = o.pts[(k + 1) % 240], r = o.pts[(k + 239) % 240];
    const tx = q[0] - r[0], ty = q[1] - r[1], tl = Math.hypot(tx, ty), perp = Math.abs(dir[0] * -ty + dir[1] * tx) / tl;
    const pts = o.pts.map((pp, j) => (j === k ? [pp[0] + 1e-5 * size * dir[0], pp[1] + 1e-5 * size * dir[1]] : pp));
    const V = validateShapes(makeShapePrint(g, { shapes: [{ pts }] }));
    console.log(id, 'vertex', k, 'moved', dir, 'perpendicular part', (1e-5 * perp).toExponential(2), 'tile sizes ->', V.ok ? `ok, stab ${V.stabilizer}` : V.problems[0].slice(0, 90));
  }
}
