// lab/search-all.mjs — search.mjs for every group (or --ids a,b), several at once; prints ALL {json} with every result.
//   node lab/search-all.mjs [--ids o,2222] [--jobs 14] [--seeds 2] [... every other option goes to search.mjs]
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROUPS } from '../../../../../src/groups.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), opt = {}, pass = [];
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) { const k = args[i].slice(2), v = args[++i]; if (['ids', 'jobs', 'seeds', 'seed0'].includes(k)) opt[k] = v; else pass.push('--' + k, v); }
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);
const jobs = +opt.jobs || Math.max(1, os.cpus().length - 2), seeds = +opt.seeds || 1;
const queue = [];
for (let s = 1; s <= seeds; s++) for (const id of ids) queue.push({ id, seed: s + (+opt.seed0 || 0) });
const results = {}, every = [];
let running = 0, done = 0;
await new Promise((resolve) => {
  const pump = () => {
    while (running < jobs && queue.length) {
      const job = queue.shift();
      running++;
      const ch = spawn(process.execPath, [path.join(here, 'search.mjs'), '--id', job.id, '--seed', String(job.seed), ...pass], { stdio: ['ignore', 'pipe', 'inherit'] });
      let out = '';
      ch.stdout.on('data', (d) => { out += d; });
      ch.on('close', () => {
        const line = out.split('\n').find((l) => l.startsWith('RESULT '));
        if (line) { const r = JSON.parse(line.slice(7)); every.push({ ...r, seed: job.seed }); if (!results[r.id] || r.score < results[r.id].score) results[r.id] = r; console.error(`${r.id} seed ${job.seed}: score ${r.score} bare ${r.m.bare} gap ${r.m.gap} cover ${r.m.cover} inTile ${r.m.inTile} asym ${r.m.asym} nose ${r.m.nose} evals ${r.evals}`); }
        else console.error(`${job.id} seed ${job.seed}: no result\n${out.slice(-400)}`);
        running--; done++;
        if (!queue.length && !running) resolve(); else pump();
      });
    }
  };
  pump();
});
console.log('ALL ' + JSON.stringify(results));
console.log('EVERY ' + JSON.stringify(every));
