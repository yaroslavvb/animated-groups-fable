// lab/prof.mjs — where find() spends its time: run under  node --cpu-prof --cpu-prof-dir=<dir>  and read the profile.
//   node --cpu-prof --cpu-prof-dir=/tmp/x dev/patterns/designs/paisley/lab/prof.mjs run
//   node dev/patterns/designs/paisley/lab/prof.mjs read /tmp/x
import fs from 'node:fs';
import path from 'node:path';
if (process.argv[2] === 'run') {
  const { GROUPS } = await import('../../../../../src/groups.js');
  const { find } = await import('../design.js');
  for (let r = 0; r < 3; r++) for (const g of GROUPS) find(g);
} else {
  const dir = process.argv[3], f = fs.readdirSync(dir).filter((n) => n.endsWith('.cpuprofile')).sort().pop();
  const prof = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const self = new Map(), byId = new Map(prof.nodes.map((n) => [n.id, n]));
  const dt = prof.timeDeltas, total = dt.reduce((a, b) => a + b, 0);
  prof.samples.forEach((id, i) => { const n = byId.get(id), k = n.callFrame.functionName + ':' + n.callFrame.lineNumber; self.set(k, (self.get(k) || 0) + dt[i]); });
  const rows = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);
  for (const [k, v] of rows) console.log((100 * v / total).toFixed(1).padStart(5) + '%  ' + k);
  console.log('total ms', (total / 1000).toFixed(0));
}
