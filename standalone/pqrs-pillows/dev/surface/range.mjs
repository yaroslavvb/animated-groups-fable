// range.mjs: the model over the sliders' range: cold starts on a grid of states, then drags of Twist and Length.
import { createSurfaceModel } from '../../src/surface-model.js';
const engineState = (orders, L, tw = 0) => ({ k: orders.join(''), perm: [0, 1, 2, 3], orders, L, tw, b: 0, tau: 0, thetas: [0, 0, 0, 0], print: null });
const finite = (fr) => { for (let i = 0; i < fr.positions.length; i++) if (!Number.isFinite(fr.positions[i])) return false; return true; };
const pct = (x) => `${(100 * x).toFixed(2)}%`;
let worstCold = 0, bad = 0;
for (const orders of [[3, 3, 3, 3], [2, 3, 5, 4], [3, 2, 2, 2], [4, 4, 4, 4], [6, 6, 6, 6], [2, 9, 9, 9], [2, 2, 3, 3]]) {
  const row = [];
  for (const L of [0.4, 1, 2.6, 5, 7]) for (const tw of [0, 0.3, -0.5]) {
    const sm = createSurfaceModel({ nVertices: 2600 }), t0 = performance.now();
    sm.set(engineState(orders, L, tw));
    const ms = performance.now() - t0, f0 = sm.frame(0), f2 = sm.frame(2), ok = finite(f0) && finite(f2) && finite(sm.frame(1.5));
    if (!ok) bad++;
    worstCold = Math.max(worstCold, f0.stats.strainMean);
    row.push(`${L}/${tw}:${ok ? '' : 'NaN!'}${pct(f0.stats.strainMean)}${f0.exact ? '' : '*'}(${ms.toFixed(0)}ms)`);
  }
  console.log(orders.join(''), row.join('  '));
}
console.log('cold starts: worst mean stretch', pct(worstCold), 'not finite:', bad, ' (* = peaks past the rim)');
// drags of 3333 from the default
{
  const st = engineState([3, 3, 3, 3], 2.6339157938496336, 0), sm = createSurfaceModel({ nVertices: 2600 });
  sm.set(st);
  let worst = 0, okAll = true, ms = 0, n = 0;
  const step = (L, tw) => { const t0 = performance.now(); sm.update({ ...st, L, tw }, 4); ms += performance.now() - t0; n++; const fr = sm.frame(0); okAll = okAll && finite(fr); worst = Math.max(worst, fr.stats.strainMean); return fr; };
  for (let i = 1; i <= 100; i++) step(st.L, 0.5 * i / 100);
  for (let i = 99; i >= -100; i--) step(st.L, 0.5 * i / 100);
  let fr = step(st.L, -0.5);
  console.log(`Twist drag 0 -> 0.5 -> -0.5 in steps of 0.005 (4 ms each): finite ${okAll}, worst mean stretch on the way ${pct(worst)}, at the end ${pct(fr.stats.strainMean)}, ${(ms / n).toFixed(1)} ms a frame (update + frame)`);
  worst = 0;
  for (let i = 1; i <= 120; i++) step(st.L + (0.4 - st.L) * i / 120, -0.5);
  fr = step(0.4, -0.5);
  console.log(`Length drag 2.63 -> 0.4 in 120 steps: finite ${okAll}, worst mean stretch on the way ${pct(worst)}, at the end ${pct(fr.stats.strainMean)}, radius ${fr.frame.radius.toFixed(2)}`);
  worst = 0;
  for (let i = 1; i <= 240; i++) step(0.4 + (7 - 0.4) * i / 240, -0.5 + 0.6 * i / 240);
  fr = step(7, 0.1);
  const before = fr.stats.strainMean, r0 = sm.restarts;
  for (let i = 0; i < 30; i++) { sm.settle(8); fr = sm.frame(0); okAll = okAll && finite(fr); }
  console.log(`Length drag 0.4 -> 7 with Twist -0.5 -> 0.1 in 240 steps: finite ${okAll}, worst mean stretch on the way ${pct(worst)}, at the end ${pct(before)}; cold restarts during the drags ${r0}; after 30 idle settle(8) calls ${pct(fr.stats.strainMean)} (worst edge ${pct(fr.stats.strainMax)}), restarts ${sm.restarts}, grid ${sm.mesh.nTheta} x ${sm.mesh.nS}, radius ${fr.frame.radius.toFixed(2)}`);
}
// 2222 drags
{
  const st = engineState([2, 2, 2, 2], 1, 0), sm = createSurfaceModel({ nVertices: 2600 });
  sm.set(st);
  let okAll = true, ms = 0, n = 0;
  for (let i = -100; i <= 100; i++) for (const L of [0.5, 1, 1.4, 2]) { const t0 = performance.now(); sm.update({ ...st, L, tw: 0.5 * i / 100 }, 4); const fr = sm.frame(0); ms += performance.now() - t0; n++; okAll = okAll && finite(fr) && finite(sm.frame(1.6)); }
  console.log(`2222: 804 states over L 0.5..2, Twist -0.5..0.5: finite ${okAll}, ${(ms / n).toFixed(2)} ms a frame (update + frame)`);
}
