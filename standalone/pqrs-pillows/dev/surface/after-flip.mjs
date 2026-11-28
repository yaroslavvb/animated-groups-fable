// after-flip.mjs: how far the surface goes on moving in the idle frames after a flip (30 x settle(8)).
import { createSurfaceModel } from '../../src/surface-model.js';
import { flip } from '../../src/flips.js';
import { stateFor } from '../../src/state.js';
for (const [sig, key, tw] of [['3333', '02|13', 0.1], ['3333', '03|12', 0.1], ['2345', '02|13', 0], ['2223', '02|13', 0], ['4444', '03|12', 0.2]]) {
  const st = { ...stateFor(sig), tw }, sm = createSurfaceModel({ nVertices: 2600 });
  sm.set(st);
  const r = flip(st, key), res = sm.flip(r.state, { invQ: r.invQ, before: st });
  const f1 = sm.frame(0), p1 = Float32Array.from(f1.positions), s1 = f1.stats.strainMean;
  for (let i = 0; i < 30; i++) sm.settle(8);
  const f2 = sm.frame(0);
  let worst = 0, sum = 0;
  if (f2.nVertices === f1.nVertices) for (let v = 0; v < f1.nVertices; v++) { const d = Math.hypot(p1[3 * v] - f2.positions[3 * v], p1[3 * v + 1] - f2.positions[3 * v + 1], p1[3 * v + 2] - f2.positions[3 * v + 2]); worst = Math.max(worst, d); sum += d; }
  let tips = 0;
  for (const m of f1.marks) tips = Math.max(tips, Math.hypot(p1[3 * m.vertex] - f2.positions[3 * m.vertex], p1[3 * m.vertex + 1] - f2.positions[3 * m.vertex + 1], p1[3 * m.vertex + 2] - f2.positions[3 * m.vertex + 2]));
  console.log(`${sig} Twist ${tw} -> ${key}: cold ${res.cold}; stretch ${(100 * s1).toFixed(2)} % -> ${(100 * f2.stats.strainMean).toFixed(2)} %; in 30 idle frames a vertex moved up to ${(worst / f1.frame.radius).toFixed(3)} of the frame radius (mean ${(sum / f1.nVertices / f1.frame.radius).toFixed(4)}), a tip up to ${(tips / f1.frame.radius).toFixed(3)}; restarts ${sm.restarts}`);
}
