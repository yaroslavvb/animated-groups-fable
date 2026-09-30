// worker.mjs — the search, off the UI thread.
// It posts the current initial frame and the residual after every Newton step, and a
// cheap progress ping every few trajectory integrations, so the page can show the cost
// of the search as it happens.
import {
  G227, DEFAULTS, makeMesh, makeFlow, makeCharacter, characterStarSeed, projectKernel,
  movieFromState, spaceTimeProject, symmetryError, firstHarmonic, findVortices,
  rotationCentres, counters, resetCounters, timestep,
} from './core.mjs';
import { makeResidual, newtonKrylov } from './newton.mjs';

let cancelled = false;

self.onmessage = ev => {
  const msg = ev.data;
  if (msg.cmd === 'cancel') { cancelled = true; return; }
  if (msg.cmd === 'run') { cancelled = false; run(msg); }
};

function run({ amp = 0.5, N = DEFAULTS.N, M = DEFAULTS.M, maxiter = 40, innerMaxiter = 30, reduced = true }) {
  const L = DEFAULTS.L;
  const p = { a: DEFAULTS.a, b: DEFAULTS.b, Du: DEFAULTS.Du, Dv: DEFAULTS.Dv, h: L / N };
  const mesh = makeMesh(N), ch = makeCharacter(G227, N), n = mesh.n, m = 2 * n;
  const flow = makeFlow(mesh, p);
  const t0 = performance.now();
  resetCounters();

  const seed = characterStarSeed(ch, p, { N, L, amplitude: amp });
  const res0 = makeResidual(mesh, ch, p, { reduced, qRef: seed.seed });
  // wrap the residual so the page can watch the trajectory count climb inside GMRES
  let lastPing = 0;
  const res = { ...res0, residual: (z, out) => {
    const r = res0.residual(z, out);
    const now = performance.now();
    if (now - lastPing > 120) { lastPing = now; self.postMessage({ type: 'progress', flows: counters.flowCalls, rk4Steps: counters.rk4Steps, seconds: (now - t0) / 1000 }); }
    return r;
  } };

  self.postMessage({
    type: 'setup', N, M, L, params: p, dt: timestep(p),
    kernelOrbits: ch.reduction.count, unknowns: res.dim, generator: ch.generator,
    order: ch.order, centres: rotationCentres(G227),
    seed: {
      amplitude: amp, wave: seed.wave, waves: seed.waves, surviving: seed.surviving,
      norms: seed.norms, T0: seed.T0, omega: seed.omega, growth: seed.growth, lam: seed.lam,
      k2: seed.k2, shells: seed.shells,
    },
    seedField: Float32Array.from(seed.seed.subarray(0, n)),
    seedPhase: { re: Float32Array.from(seed.psi.re), im: Float32Array.from(seed.psi.im) },
  });

  const z0 = res.pack(projectKernel(ch, seed.seed), seed.T0);
  let last = null;
  for (const info of newtonKrylov(res, z0, { maxiter, innerMaxiter })) {
    last = info;
    const field = res.unpackField(info.z);
    self.postMessage({
      type: 'step', iteration: info.iteration, residualRms: info.residualRms, T: info.T,
      inner: info.inner, step: info.step, flows: counters.flowCalls, rk4Steps: counters.rk4Steps,
      rhsCalls: counters.rhsCalls, seconds: (performance.now() - t0) / 1000,
      converged: !!info.converged,
      field: Float32Array.from(field.subarray(0, n)),
    });
    if (cancelled) { self.postMessage({ type: 'cancelled' }); return; }
    if (info.converged) break;
  }
  const solve = { seconds: (performance.now() - t0) / 1000, flows: counters.flowCalls, rk4Steps: counters.rk4Steps, rhsCalls: counters.rhsCalls };

  // one more independent period, saved as M frames, then the repository's space-time
  // projection (what the site's exporter does before writing float32)
  const q0 = res.unpackField(last.z);
  const frames = spaceTimeProject(movieFromState(flow, q0, last.T, M, m), ch, M);
  const sym = symmetryError(frames, ch, M);
  const A = firstHarmonic(frames, n, 1);
  const vortices = findVortices(A, N);
  const u = new Float32Array(M * n);
  frames.forEach((f, i) => u.set(f.subarray(0, n), i * n));
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < u.length; i++) { if (u[i] < lo) lo = u[i]; if (u[i] > hi) hi = u[i]; }
  self.postMessage({
    type: 'movie', M, N, period: last.T, residualRms: last.residualRms, converged: !!last.converged,
    iterations: last.iteration, symmetryMax: sym, vortices, uRange: [lo, hi],
    harmonic: { re: Float32Array.from(A.re), im: Float32Array.from(A.im) },
    solve, total: { seconds: (performance.now() - t0) / 1000, flows: counters.flowCalls, rk4Steps: counters.rk4Steps, rhsCalls: counters.rhsCalls },
    frames: u,
  }, [u.buffer]);
}
