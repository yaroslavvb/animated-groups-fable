// designs/ripple/lab/timing.mjs — find() timed in node, best of 3, with the knobs given (the critique of 13 Nov 2026):
//   node dev/patterns/designs/ripple/lab/timing.mjs '<ids>' '<json knobs>' ['<json knobs>' ...]
import { BY_ID, GROUPS } from '../../../../../src/groups.js';
import { find } from '../design.js';
const ids = process.argv[2] === 'all' ? GROUPS.map((g) => g.id) : process.argv[2].split(',');
for (const kn of process.argv.slice(3).length ? process.argv.slice(3) : ['{}']) {
  const k = JSON.parse(kn), row = [];
  let total = 0;
  for (const id of ids) {
    let best = Infinity;
    for (let i = 0; i < 3; i++) { const t0 = performance.now(); find(BY_ID[id], k); best = Math.min(best, performance.now() - t0); }
    total += best; row.push(`${id} ${best.toFixed(0)}`);
  }
  console.log(kn.padEnd(30), 'total', total.toFixed(0), 'ms |', row.join('  '));
}
