/** The supplied find_film algorithm, evaluated in Float64 on a 36 × 36 grid.
 * Fields have planar layout [u(y,x), v(y,x)], with x fastest.
 * The browser seed uses Mulberry32 + Box–Muller, not NumPy's PCG64 generator.
 */
export const N = 36, L = 40, a = 1, b = 2.3, dt = 0.02;
export const SIZE = N * N, LENGTH = 2 * SIZE, TOL = 1e-10;
const lapDenominator = 3 * (L / N) ** 2;
const neighbors = Array.from({ length: 6 }, () => new Uint16Array(SIZE));
const turnIndex = new Uint16Array(SIZE), slideIndex = new Uint16Array(SIZE);
const mod = n => (n % N + N) % N;
for (let y = 0; y < N; ++y) for (let x = 0; x < N; ++x) {
  const i = y * N + x;
  const offsets = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1]];
  offsets.forEach(([dy, dx], k) => { neighbors[k][i] = mod(y - dy) * N + mod(x - dx); });
  turnIndex[i] = mod(x - y) * N + mod(-y);
  slideIndex[i] = mod(y + N / 3) * N + mod(x + 2 * N / 3);
}

export function rest() {
  const q = new Float64Array(LENGTH);
  q.fill(a, 0, SIZE); q.fill(b / a, SIZE);
  return q;
}

/** Return rest + 0.1 × seeded Gaussian noise. */
export function noise(seed = 1) {
  let state = Number(seed) >>> 0;
  const uniform = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let z = Math.imul(state ^ state >>> 15, 1 | state);
    z ^= z + Math.imul(z ^ z >>> 7, 61 | z);
    return ((z ^ z >>> 14) >>> 0) / 4294967296;
  };
  const q = rest();
  for (let i = 0; i < LENGTH; i += 2) {
    const radius = Math.sqrt(-2 * Math.log(1 - uniform()));
    const angle = 2 * Math.PI * uniform();
    q[i] += 0.1 * radius * Math.cos(angle);
    q[i + 1] += 0.1 * radius * Math.sin(angle);
  }
  return q;
}

export function rate(q, out = new Float64Array(LENGTH)) {
  const [n0, n1, n2, n3, n4, n5] = neighbors;
  for (let i = 0; i < SIZE; ++i) {
    const j = SIZE + i, u = q[i], v = q[j], uuv = u * u * v;
    const lu = ((q[n0[i]] + q[n1[i]] + q[n2[i]] + q[n3[i]] + q[n4[i]] + q[n5[i]] - 6 * u) * 2) / lapDenominator;
    const lv = ((q[SIZE + n0[i]] + q[SIZE + n1[i]] + q[SIZE + n2[i]] + q[SIZE + n3[i]] + q[SIZE + n4[i]] + q[SIZE + n5[i]] - 6 * v) * 2) / lapDenominator;
    out[i] = lu + (a - (b + 1) * u + uuv);
    out[j] = lv + (b * u - uuv);
  }
  return out;
}

/** RK4 with ceil(t / maxStep) equal steps; the input is never mutated.
 * The solver uses dt=.02. maxStep is exposed for independent accuracy checks.
 */
export function simulate(input, t, maxStep = dt) {
  if (!Number.isFinite(t) || t < 0) throw new RangeError('Simulation time must be finite and nonnegative.');
  if (!Number.isFinite(maxStep) || maxStep <= 0) throw new RangeError('Maximum step must be finite and positive.');
  const q = new Float64Array(input);
  if (t === 0) return q;
  const n = Math.ceil(t / maxStep), h = t / n;
  const k1 = new Float64Array(LENGTH), k2 = new Float64Array(LENGTH);
  const k3 = new Float64Array(LENGTH), k4 = new Float64Array(LENGTH), temp = new Float64Array(LENGTH);
  for (let step = 0; step < n; ++step) {
    rate(q, k1);
    for (let i = 0; i < LENGTH; ++i) temp[i] = q[i] + h / 2 * k1[i];
    rate(temp, k2);
    for (let i = 0; i < LENGTH; ++i) temp[i] = q[i] + h / 2 * k2[i];
    rate(temp, k3);
    for (let i = 0; i < LENGTH; ++i) temp[i] = q[i] + h * k3[i];
    rate(temp, k4);
    for (let i = 0; i < LENGTH; ++i) q[i] = q[i] + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }
  return q;
}

function permute(q, indices) {
  const out = new Float64Array(LENGTH);
  for (let i = 0; i < SIZE; ++i) {
    out[i] = q[indices[i]]; out[SIZE + i] = q[SIZE + indices[i]];
  }
  return out;
}
export const slide = q => permute(q, slideIndex);
export const turn = q => permute(q, turnIndex);
export function project(q) {
  const r = turn(q), rr = turn(r), out = new Float64Array(LENGTH);
  for (let i = 0; i < LENGTH; ++i) out[i] = (q[i] + r[i] + rr[i]) / 3;
  return out;
}
export function rms(q) {
  let sum = 0; for (const x of q) sum += x * x;
  return Math.sqrt(sum / q.length);
}
export function difference(q, p) {
  const out = new Float64Array(q.length);
  for (let i = 0; i < q.length; ++i) out[i] = q[i] - p[i];
  return out;
}
export function dot(q, p) {
  let sum = 0; for (let i = 0; i < q.length; ++i) sum += q[i] * p[i];
  return sum;
}

/** One complete iteration, keeping the intermediates used by the tutorial.
 * T is the period used for this sweep. Tnext is the updated guess.
 * On convergence Python returns q0 and T before correcting or averaging.
 */
export function sweep(input, T = 6.355, { tol = TOL } = {}) {
  const q0 = simulate(input, T);
  const third = simulate(q0, T / 3), twoThirds = simulate(third, T / 3);
  const aligned1 = slide(third), aligned2 = slide(slide(twoThirds));
  const lag = difference(aligned1, q0), residual = rms(lag), speed = rate(q0);
  const done = residual < tol;
  const rawCorrection = 3 * dot(lag, speed) / dot(speed, speed);
  const correction = done ? 0 : Math.max(-0.1, Math.min(0.1, rawCorrection));
  const Tnext = T - correction, qnext = new Float64Array(LENGTH);
  for (let i = 0; i < LENGTH; ++i) qnext[i] = done ? q0[i] : (q0[i] + aligned1[i] + aligned2[i]) / 3;
  return { input, q0, third, twoThirds, aligned1, aligned2, lag, speed,
    correction, rawCorrection, T, Tnext, qnext, residual, done };
}
