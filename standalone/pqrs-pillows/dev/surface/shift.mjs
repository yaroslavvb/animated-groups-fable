// shift.mjs: how far the new pose's origin is from the old one's at a flip (the part of flip() a bare rotation drops).
import { createSurfaceModel } from '../../src/surface-model.js';
import { flip } from '../../src/flips.js';
import { stateFor } from '../../src/state.js';
for (const sig of ['3333', '2345', '2223', '4444', '2222']) for (const key of ['02|13', '03|12']) {
  const st = stateFor(sig), sm = createSurfaceModel({ nVertices: 2600 });
  sm.set(st);
  const r = flip(st, key), res = sm.flip(r.state, { invQ: r.invQ, before: st }), fr = sm.frame(0);
  const ang = (Math.acos(Math.max(-1, Math.min(1, (res.turn[0] + res.turn[4] + res.turn[8] - 1) / 2))) * 180) / Math.PI;
  console.log(sig, key, 'turn', ang.toFixed(1), 'deg, |shift|', Math.hypot(...res.shift).toFixed(3), '=', (Math.hypot(...res.shift) / fr.frame.radius).toFixed(3), 'of the frame radius, cold', res.cold);
}
