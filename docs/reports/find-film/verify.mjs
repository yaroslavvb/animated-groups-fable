/** Reproduce the numerical checks without a browser: node verify.mjs
 * Add --write-trace to regenerate trace.json from the actual solver.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { N, L, a, b, dt, noise, rest, rate, simulate, slide, turn,
  project, sweep, rms, difference, dot } from './engine.mjs';

const maxDifference = (p, q) => {
  let value = 0;
  for (let i = 0; i < p.length; ++i) value = Math.max(value, Math.abs(p[i] - q[i]));
  return value;
};
const initial = noise(1), untouched = initial.slice();
assert.equal(maxDifference(turn(turn(turn(initial))), initial), 0, 'R³ = identity');
assert.equal(maxDifference(slide(slide(slide(initial))), initial), 0, 'S³ = identity');
assert(maxDifference(project(project(initial)), project(initial)) < 1e-14, 'P is a projection');
assert(maxDifference(turn(project(initial)), project(initial)) < 1e-14, 'P imposes R symmetry');
assert(maxDifference(rate(turn(initial)), turn(rate(initial))) < 1e-14, 'rate commutes with R');
assert(maxDifference(rate(slide(initial)), slide(rate(initial))) < 1e-14, 'rate commutes with S');
assert(rms(rate(rest())) < 1e-14, 'homogeneous rest is stationary');
assert(maxDifference(simulate(turn(initial), 0.1), turn(simulate(initial, 0.1))) < 1e-14, 'RK4 preserves rotation equivariance');
assert(maxDifference(simulate(slide(initial), 0.1), slide(simulate(initial, 0.1))) < 1e-14, 'RK4 preserves translation equivariance');
assert.equal(maxDifference(initial, untouched), 0, 'operations do not mutate their input');

let q = project(initial), T = 6.355, final;
const history = [];
const started = performance.now();
for (let iteration = 1; iteration < 400; ++iteration) {
  final = sweep(q, T);
  history.push({ sweep: iteration, T, Tnext: final.Tnext, residual: final.residual,
    rawCorrection: final.rawCorrection, correction: final.correction });
  q = final.qnext; T = final.Tnext;
  if (final.done) break;
}
assert(final.done, 'seed 1 converges before the 399-sweep limit');
assert(Math.abs(T - 6.390159918584649) < 1e-8, 'period agrees with the published film');
const closureRms = rms(difference(simulate(q, T), q));
assert(closureRms < 1e-8, 'independently integrated full-period closure');
// Re-integrate the unprojected trajectory with half the maximum RK4 step.
// Check interior phases as well as closure, so endpoint cancellation cannot hide drift.
let halfStepTrajectoryRms = 0, halfStepTrajectoryMax = 0;
for (const phase of [1 / 3, 2 / 3, 1]) {
  const normal = simulate(q, T * phase), finer = simulate(q, T * phase, dt / 2);
  halfStepTrajectoryRms = Math.max(halfStepTrajectoryRms, rms(difference(finer, normal)));
  halfStepTrajectoryMax = Math.max(halfStepTrajectoryMax, maxDifference(finer, normal));
}
const halfStepClosureRms = rms(difference(simulate(q, T, dt / 2), q));
assert(halfStepTrajectoryMax < 1e-7, 'halving the RK4 step preserves the computed trajectory');
assert(halfStepClosureRms < 1e-8, 'full-period closure also holds with half the RK4 step');
assert(rms(rate(q)) > 0.01, 'the result is moving, rather than a stationary solution');
assert(rms(difference(q, rest())) > 0.1, 'the result is a nontrivial pattern');

const publishedUrl = new URL('../../scott-gray/data/equation-orbits/e47c12f9099fb9d2b6d4.f32', import.meta.url);
const bytes = await readFile(publishedUrl), data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const film0 = new Float64Array(2 * N * N);
for (let i = 0; i < film0.length; ++i) film0[i] = data.getFloat32(i * 4, true);
let phaseAligned = q, bestDifference = Infinity;
for (let j = 0; j < 24; ++j) {
  const candidate = simulate(q, T * j / 24 + 1e-12);
  const error = maxDifference(candidate, film0);
  if (error < bestDifference) { phaseAligned = candidate; bestDifference = error; }
}
for (let refinement = 0; refinement < 4; ++refinement) {
  const speed = rate(phaseAligned);
  const timeShift = dot(difference(film0, phaseAligned), speed) / dot(speed, speed);
  const wrappedShift = ((timeShift % T) + T) % T + 1e-12;
  phaseAligned = simulate(phaseAligned, wrappedShift);
}
const publishedMaxDifference = maxDifference(phaseAligned, film0);
assert(publishedMaxDifference < 3e-7, 'phase-aligned state agrees to Float32 precision');
const result = {
  description: 'Actual Float64 browser-engine run; no saved film is used during the search.',
  parameters: { N, L, a, b, dt, seed: 1, initialT: 6.355, tolerance: 1e-10 },
  rng: 'Mulberry32 uniform + Box–Muller Gaussian; differs from NumPy PCG64',
  sweeps: history.length, period: T, residual: final.residual, closureRms,
  publishedMaxDifference,
  halfStepCheck: { maxStep: dt / 2, fullPeriodClosureRms: halfStepClosureRms,
    trajectoryRms: halfStepTrajectoryRms, trajectoryMax: halfStepTrajectoryMax,
    sampledPhases: [1 / 3, 2 / 3, 1] },
  history,
};
if (process.argv.includes('--write-trace')) {
  await writeFile(new URL('./trace.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
}
console.log(JSON.stringify({ ...result, history: undefined, milliseconds: Math.round(performance.now() - started) }, null, 2));
console.log(`All numerical checks passed. Reference: ${fileURLToPath(publishedUrl)}`);
