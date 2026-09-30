// worker.mjs — the delayed-glue run, off the UI thread.
//
// It posts the expanded torus field every few RK4 steps (so the page can paint the
// self-assembly), the delay and the drift once per period, and — when the delay has
// stopped moving — the final state plus an optional two-step Newton polish that reuses
// ../newton/newton.mjs unchanged.

import { createRun, selfTest, PUBLISHED_PERIOD, GLUE_DEFAULTS } from './glue.mjs';
import {
  G227, DEFAULTS, makeMesh, makeCharacter, makeFlow, movieFromState, symmetryError,
  firstHarmonic, findVortices, rotationCentres, projectKernel, counters, resetCounters,
} from '../newton/core.mjs';
import { makeResidual, newtonKrylov } from '../newton/newton.mjs';

let cancelled = false;
let ackResolve = null;

// The worker integrates far faster than the page can paint.  Without flow control it races
// ahead and the canvas replays a backlog; with it, one frame is drawn per animation frame
// and the speed control means what it says.
const waitForAck = () => new Promise(r => {
  ackResolve = r;
  setTimeout(() => { if (ackResolve === r) { ackResolve = null; r(); } }, 250);
});

self.onmessage = ev => {
  const msg = ev.data;
  if (msg.cmd === 'ack') { const r = ackResolve; ackResolve = null; if (r) r(); return; }
  if (msg.cmd === 'cancel') { cancelled = true; const r = ackResolve; ackResolve = null; if (r) r(); return; }
  if (msg.cmd === 'selftest') { selfTest(36).then(r => self.postMessage({ type: 'selftest', ...r })); return; }
  if (msg.cmd === 'run') { cancelled = false; run(msg).catch(e => self.postMessage({ type: 'error', message: String(e && e.stack || e) })); }
};

const yieldToLoop = () => new Promise(r => setTimeout(r, 0));

async function run({ seed = 1, tol = 1e-5, relax = GLUE_DEFAULTS.relax, stepsPerChunk = 14, polish = true, maxPeriods = 90 }) {
  const N = DEFAULTS.N, L = DEFAULTS.L, n = N * N, M = DEFAULTS.M;
  const t0 = performance.now();
  const runner = createRun({ seed, tol, relax, maxPeriods });
  const full = new Float64Array(2 * n);
  const uOut = new Float32Array(n);

  self.postMessage({
    type: 'setup', N, L, M, seed, tol, relax, stepsPerChunk,
    glue: runner.glue.summary(), T0: runner.T0, dt: runner.dt,
    published: PUBLISHED_PERIOD, dim: runner.dim,
    stepsPerPeriod: runner.glue.m * runner.options.stepsPerThird,
  });

  let lastDelays = 0, computeMs = 0;
  while (!runner.done) {
    const tc = performance.now();
    runner.advance(stepsPerChunk);
    runner.field(full);
    computeMs += performance.now() - tc;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) { const u = full[i]; uOut[i] = u; if (u < lo) lo = u; if (u > hi) hi = u; }
    const payload = {
      type: 'frame', t: runner.t, T: runner.T, periods: runner.periods, steps: runner.steps,
      seconds: (performance.now() - t0) / 1000, rhsCalls: runner.counters.rhsCalls,
      uRange: [lo, hi], field: uOut.slice(),
    };
    if (runner.delays.length !== lastDelays) {
      lastDelays = runner.delays.length;
      payload.delays = runner.delays.slice();
      payload.drift = runner.drift.slice();
    }
    self.postMessage(payload, [payload.field.buffer]);
    if (cancelled) { self.postMessage({ type: 'cancelled' }); return; }
    await waitForAck();
  }

  const glueSeconds = (performance.now() - t0) / 1000;
  runner.field(full);

  // one independent, unprojected RK4 period of the full torus — the same replay the
  // repository's exporter does — then the structure the clockwork symbol forces
  const mesh = makeMesh(N), ch = makeCharacter(G227, N);
  const p = { a: DEFAULTS.a, b: DEFAULTS.b, Du: DEFAULTS.Du, Dv: DEFAULTS.Dv, h: L / N };
  const flow = makeFlow(mesh, p);
  const frames = movieFromState(flow, full, runner.T, M, 2 * n);
  const A = firstHarmonic(frames, n, 1);
  // The glue's forced zeros sit at a relative amplitude of about 1.5e-6 rather
  // than the 1e-16 of a Newton-polished orbit, so the default 1e-6 cut-off no
  // longer skips the rings that pass through a core and each neighbour of a core
  // registers a spurious +/-1.  1e-3 is safely above the cores and far below the
  // regular field, and it reproduces the six charged centres the symbol forces.
  const vortices = findVortices(A, N, 1e-3);
  const centres = rotationCentres(G227).map(c => {
    const x = ((Math.round(c.lattice[0] * N) % N) + N) % N, y = ((Math.round(c.lattice[1] * N) % N) + N) % N;
    const hit = vortices.find(v => Math.round(v.lattice[0] * N) === x && Math.round(v.lattice[1] * N) === y);
    const mag = Math.hypot(A.re[y * N + x], A.im[y * N + x]);
    let maxMag = 0; for (let i = 0; i < n; i++) maxMag = Math.max(maxMag, Math.hypot(A.re[i], A.im[i]));
    return {
      lattice: c.lattice, k: c.k, predicted: c.predictedWinding,
      measured: hit ? hit.charge : 0, relativeAmplitude: mag / maxMag,
      agrees: (hit ? hit.charge : 0) === c.predictedWinding,
    };
  });

  self.postMessage({
    type: 'assembled',
    T: runner.T, periods: runner.periods, steps: runner.steps, stopReason: runner.stopReason,
    lastDeltaT: runner.lastDeltaT, seconds: glueSeconds, computeSeconds: computeMs / 1000,
    rhsCalls: runner.counters.rhsCalls, nodeEvals: runner.counters.nodeEvals,
    historySamples: runner.history.samples,
    published: PUBLISHED_PERIOD,
    relativePeriodError: (runner.T - PUBLISHED_PERIOD) / PUBLISHED_PERIOD,
    symmetryMaxRaw: symmetryError(frames, ch, M),
    vortices: vortices.length, totalCharge: vortices.reduce((s, v) => s + v.charge, 0),
    centres, delays: runner.delays.slice(), drift: runner.drift.slice(),
    state: Float64Array.from(full),          // the page keeps this for the Python cross-check
  });

  if (!polish || cancelled) { self.postMessage({ type: 'end' }); return; }

  // ---- Newton appears only here, as a two-iteration polish
  resetCounters();
  const tP = performance.now();
  const res = makeResidual(mesh, ch, p, { reduced: true, qRef: full });
  let z = res.pack(projectKernel(ch, full), runner.T), last = null;
  for (const info of newtonKrylov(res, z, { maxiter: 6, innerMaxiter: 30 })) {
    last = info;
    self.postMessage({
      type: 'newton', iteration: info.iteration, residualRms: info.residualRms, T: info.T,
      seconds: (performance.now() - tP) / 1000, flows: counters.flowCalls,
      rhsCalls: counters.rhsCalls, converged: !!info.converged,
    });
    if (cancelled || info.converged) break;
    await yieldToLoop();
  }
  if (last) {
    const solveRhs = counters.rhsCalls, solveFlows = counters.flowCalls;
    const solveSeconds = (performance.now() - tP) / 1000;
    const q0 = res.unpackField(last.z);
    const pf = movieFromState(flow, q0, last.T, M, 2 * n);
    self.postMessage({
      type: 'polished', T: last.T, iterations: last.iteration, residualRms: last.residualRms,
      seconds: solveSeconds, rhsCalls: solveRhs, flows: solveFlows,
      totalRhsCalls: counters.rhsCalls,        // the 48-frame replay afterwards is extra
      published: PUBLISHED_PERIOD,
      relativePeriodError: (last.T - PUBLISHED_PERIOD) / PUBLISHED_PERIOD,
      symmetryMaxRaw: symmetryError(pf, ch, M),
      state: Float64Array.from(q0),
    });
  }
  self.postMessage({ type: 'end' });
}
