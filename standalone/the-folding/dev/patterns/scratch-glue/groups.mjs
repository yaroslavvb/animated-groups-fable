import { GROUPS } from '../../../src/groups.js';
for (const g of GROUPS) {
  const l1 = Math.hypot(...g.e1), l2 = Math.hypot(...g.e2), dot = g.e1[0] * g.e2[0] + g.e1[1] * g.e2[1];
  const ang = Math.acos(dot / (l1 * l2)) * 180 / Math.PI;
  console.log(g.id.padEnd(6), 'e1', g.e1.map((v) => v.toFixed(3)).join(','), 'e2', g.e2.map((v) => v.toFixed(3)).join(','), '|e1|', l1.toFixed(3), '|e2|', l2.toFixed(3), 'angle', ang.toFixed(1),
    'reps', g.reps.length, 'size', Math.sqrt(g.domainArea).toFixed(3), 'center', g.center.map((v) => v.toFixed(3)).join(','), 'viewHalf', g.viewHalf, 'fold', g.fold, 'presets', g.presets.map((p) => p.name).join('/'));
}
