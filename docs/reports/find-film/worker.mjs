import { noise, project, sweep, TOL } from './engine.mjs';

let q, T = 6.355, count = 0, running = false, generation = 0, complete = false;

function step() {
  if (!q || complete) return;
  try {
    const s = sweep(q, T);
    ++count;
    q = s.qnext; T = s.Tnext; complete = s.done || count >= 399;
    self.postMessage({ type: 'sweep', sweep: count, T: s.T, Tnext: s.Tnext,
      residual: s.residual, correction: s.correction, rawCorrection: s.rawCorrection,
      done: s.done, exhausted: !s.done && count >= 399, q0: s.q0, qnext: s.qnext,
      input: s.input, third: s.third, twoThirds: s.twoThirds, aligned1: s.aligned1,
      aligned2: s.aligned2, lag: s.lag, speed: s.speed });
  } catch (error) {
    running = false; complete = true;
    self.postMessage({ type: 'error', message: error.message });
  }
}

function run(token) {
  if (!running || complete || token !== generation) return;
  step();
  if (running && !complete) setTimeout(() => run(token), 0);
  else running = false;
}

self.onmessage = ({ data }) => {
  if (data.type === 'start') {
    ++generation; running = false; complete = false; count = 0;
    T = Number.isFinite(data.T) && data.T > 0 ? data.T : 6.355;
    const initial = noise(data.seed ?? 1);
    q = project(initial);
    self.postMessage({ type: 'ready', seed: data.seed ?? 1, q, initial, T, sweep: 0, tol: TOL });
  } else if (data.type === 'step') {
    ++generation; running = false; step();
  } else if (data.type === 'run' && !running && !complete) {
    running = true; run(++generation);
  } else if (data.type === 'pause') {
    ++generation; running = false;
    self.postMessage({ type: 'paused', sweep: count });
  }
};
