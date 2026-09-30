// node_run.mjs — the same modules the page runs, driven from the command line, so the
// browser result can be compared with the Python lab.  Not part of the page.
//
//   node node_run.mjs [--seed 1] [--tol 1e-5] [--out state.f64]
import { writeFileSync } from 'node:fs';
import { createRun, selfTest, PUBLISHED_PERIOD } from './glue.mjs';
import { G227, DEFAULTS, makeMesh, makeFlow, makeCharacter, movieFromState, symmetryError, firstHarmonic, findVortices, rotationCentres, spaceTimeProject } from '../newton/core.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const seed = Number(arg('--seed', 1));
const tol = Number(arg('--tol', 1e-5));
const out = arg('--out', null);

console.log('selfTest', JSON.stringify(await selfTest(36)));

const t0 = Date.now();
const run = createRun({ seed, tol });
console.log('glue', JSON.stringify(run.glue.summary()), 'T0', run.T0);
while (!run.done) {
  run.advance(336);
  const d = run.delays[run.delays.length - 1];
  const dr = run.drift[run.drift.length - 1];
  if (d) console.log(`period ${String(d.periods).padStart(3)}  t=${run.t.toFixed(2)}  T=${d.T.toFixed(9)}  dT=${(d.deltaT ?? NaN).toExponential(2)}  drift=${(dr ? dr.driftRms : NaN).toExponential(2)}`);
}
const wall = (Date.now() - t0) / 1000;
console.log('stopped:', run.stopReason, 'T =', run.T, 'periods', run.periods, 'wall', wall.toFixed(2), 's',
  'rhsCalls', run.counters.rhsCalls, 'nodeEvals', run.counters.nodeEvals);
console.log('relative period error vs published:', (run.T - PUBLISHED_PERIOD) / PUBLISHED_PERIOD);

// the full torus field, then one independent RK4 period with core.mjs (unprojected)
const N = DEFAULTS.N, n = N * N, M = DEFAULTS.M, L = DEFAULTS.L;
const q = run.field();
const mesh = makeMesh(N), ch = makeCharacter(G227, N);
const p = { a: 1, b: 2.3, Du: 1, Dv: 1, h: L / N };
const flow = makeFlow(mesh, p);
const frames = movieFromState(flow, q, run.T, M, 2 * n);
console.log('symmetryMax (raw, unprojected RK4 replay):', symmetryError(frames, ch, M));
const A = firstHarmonic(frames, n, 1);
const vort = findVortices(A, N);
const centres = rotationCentres(G227);
const charges = centres.map(c => {
  const x = Math.round(c.lattice[0] * N) % N, y = Math.round(c.lattice[1] * N) % N;
  const hit = vort.find(v => Math.round(v.lattice[0] * N) === x && Math.round(v.lattice[1] * N) === y);
  return { lattice: c.lattice.map(v => +v.toFixed(4)), k: c.k, predicted: c.predictedWinding, measured: hit ? hit.charge : 0 };
});
console.log('charges', JSON.stringify(charges));
console.log('vortices', vort.length, 'total charge', vort.reduce((s, v) => s + v.charge, 0));

if (out) {
  const buf = Buffer.alloc(8 * 2 * n);
  for (let i = 0; i < 2 * n; i++) buf.writeDoubleLE(q[i], 8 * i);
  writeFileSync(out, buf);
  writeFileSync(out.replace(/\.f64$/, '') + '.json', JSON.stringify({
    seed, tol, period: run.T, periods: run.periods, stopReason: run.stopReason,
    wallSeconds: wall, steps: run.steps, rhsCalls: run.counters.rhsCalls,
    nodeEvals: run.counters.nodeEvals, historySamples: run.history.samples,
    publishedPeriod: PUBLISHED_PERIOD,
    relativePeriodError: (run.T - PUBLISHED_PERIOD) / PUBLISHED_PERIOD,
    delays: run.delays, drift: run.drift, charges,
    symmetryMaxRaw: symmetryError(frames, ch, M),
    glue: run.glue.summary(), N, L, M,
  }, null, 1));
  console.log('wrote', out);
}
