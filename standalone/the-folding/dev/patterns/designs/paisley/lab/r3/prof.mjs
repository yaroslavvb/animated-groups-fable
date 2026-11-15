// lab/r3/prof.mjs — where find() spends its time (polish round, 14 Nov 2026).
//   node --cpu-prof --cpu-prof-dir=<dir> lab/r3/prof.mjs run [ids] [design]
//   node lab/r3/prof.mjs read <dir>
import fs from 'node:fs';
import path from 'node:path';
if (process.argv[2] === 'run') {
  const { GROUPS, BY_ID } = await import('../../../../../../src/groups.js');
  const { find } = await import('../../' + (process.argv[4] || 'design.js'));
  const ids = process.argv[3] && process.argv[3] !== 'all' ? process.argv[3].split(',') : GROUPS.map((g) => g.id);
  for (let r = 0; r < 2; r++) for (const id of ids) find(BY_ID[id]);
} else {
  const dir = process.argv[3], f = fs.readdirSync(dir).filter((n) => n.endsWith('.cpuprofile')).sort().pop();
  const prof = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const self = new Map(), byId = new Map(prof.nodes.map((n) => [n.id, n]));
  const dt = prof.timeDeltas, total = dt.reduce((a, b) => a + b, 0);
  prof.samples.forEach((id, i) => { const n = byId.get(id), k = n.callFrame.functionName + ':' + (n.callFrame.lineNumber + 1); self.set(k, (self.get(k) || 0) + dt[i]); });
  const rows = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
  for (const [k, v] of rows) console.log((100 * v / total).toFixed(1).padStart(5) + '%  ' + k);
  console.log('total ms', (total / 1000).toFixed(0));
}
