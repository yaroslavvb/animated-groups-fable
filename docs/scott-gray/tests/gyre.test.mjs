// Gyre: the entangled three-colour rule, checked on the saved samples in exact
// integer arithmetic, on the continuum the shader draws, and through the
// shutter that integrates each displayed frame.
//
//     colour(x, t) = argmax over k in {0,1,2} of U(g^k x, t + k T/3),
//     g = the third-turn about p = (1/18, 1/9),
//
// and the law the page is named for:
//
//     colour(g x, t + T/3) = colour(x, t) − 1   (mod 3),
//
// which holds exactly while every proper part of it fails.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {bicubicRGB, BOUNDARY_SPEED, colourAt, createGovernor, cubicWeights, FALLBACK_INTERVAL, FIELD_BYTES, FIELD_SHA256, FRAMES, frameAt, framesAt, GRID_SIZE, gTurn, LOOP_SECONDS, MAX_SCALE, MAX_TAA_LAYERS, MOTION_PIXELS, NO_MOTION, PALETTE, patternMotion, SHUTTER, shutterOffsets, shutterPhases, SMEAR_PIXELS, snapAngle, TAA_LAYERS, THIRD, TILE_PIXELS, TURN_CENTRE, TURN_OFFSET, turn120, turn240, uVolume, valuesAt, viewDelta, viewMotion, wrap, wrapAngle} from '../gyre/renderer.mjs';
import {
  advanceFling, createFling, elasticProfile, ELASTIC_GIVE, ELASTIC_MS, estimateVelocity,
  MAX_PAN_SPEED, MAX_STEP, MAX_TURN_RATE, MAX_ZOOM_RATE, MIN_PAN_SPEED, MIN_SPAN_MS,
  NO_THROW, PAN_TAU, SNAP_MS, STALE_MS, STOP_PAN, trimSamples, TURN_CATCH, turnTargetFor, TURN_TAU, WINDOW_MS, ZOOM_TAU,
} from '../gyre/momentum.mjs';

const N = GRID_SIZE, S = N * N;
const shipped = await readFile(new URL('../gyre/field.f32', import.meta.url));
const planar = new Float32Array(shipped.buffer, shipped.byteOffset, shipped.byteLength / 4);
const U = uVolume(planar);
const mod = (value, n) => ((value % n) + n) % n;
/** The saved U sample at lattice node (x, y) in frame `t`. */
const at = (x, y, t) => U[mod(t, FRAMES) * S + mod(y, N) * N + mod(x, N)];
/** g on the saved nodes. w is a whole 11 of the 66 nodes, so g carries nodes to
 * nodes and nothing below needs interpolation. */
const W_NODES = Math.round(TURN_OFFSET[1] * N);
const gNode = (x, y) => [y - x + Math.round(TURN_OFFSET[0] * N), -x + W_NODES];
/** The three values the colouring compares at a saved node, and the winner. */
function triple(x, y, t) {
  const out = [];
  let p = [x, y];
  for (let k = 0; k < 3; k++) { out.push(at(p[0], p[1], t + k * THIRD)); p = gNode(p[0], p[1]); }
  return out;
}
function colourOf(x, y, t) {
  const [a, b, c] = triple(x, y, t);
  return a >= b && a >= c ? 0 : b >= c ? 1 : 2;
}
/** colour(x, t) at every saved node and frame, as one array. */
const colours = new Int8Array(FRAMES * S);
for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) colours[t * S + y * N + x] = colourOf(x, y, t);
const colourAtNode = (x, y, t) => colours[mod(t, FRAMES) * S + mod(y, N) * N + mod(x, N)];
/** How often colour(M x + v, t + shift) = perm[colour(x, t)] over all
 * 418 176 node-frames: 1 for a symmetry, 1/3 for chance. */
function agreement([[a, b], [c, d]], [vx, vy], shift, perm) {
  let same = 0;
  for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (colourAtNode(a * x + b * y + vx, c * x + d * y + vy, t + shift) === perm[colourAtNode(x, y, t)]) same++;
  }
  return same / (FRAMES * S);
}
const IDENTITY = [0, 1, 2], MINUS = [2, 0, 1], PLUS = [1, 2, 0];
// S = R240 = [[−1, 1], [−1, 0]] in lattice coordinates, the linear part of g.
const Smatrix = [[-1, 1], [-1, 0]];

test('the shipped field is the atlas orbit, byte for byte — the very file Triskele paints', async () => {
  const source = await readFile(new URL('../p6/data/orbits/g247-diversity-q1-mixed-L512-F00406-F0p00406000-k0p02000000-L512-N66-M96.f32', import.meta.url));
  assert.deepEqual(shipped, source, 'field.f32 differs from the atlas orbit file');
  // The same bytes the sibling page ships: one rule apart, not one field apart.
  assert.deepEqual(shipped, await readFile(new URL('../triskele/field.f32', import.meta.url)), 'field.f32 differs from ../triskele/field.f32');
  assert.equal(createHash('sha256').update(shipped).digest('hex'), FIELD_SHA256);
  assert.equal(FIELD_SHA256, '8fcde9bc1178d93d9d92aae2387cd0dc864c37755dab0ce08a263f007056536c');
  assert.equal(shipped.byteLength, FIELD_BYTES);
  assert.equal(FIELD_BYTES, FRAMES * 2 * S * 4);
  assert.equal(THIRD, FRAMES / 3);
  assert.ok(Number.isInteger(THIRD), 'a third of a period is a whole number of saved frames');
});

test('g is a third-turn about p, and it carries saved nodes to saved nodes', () => {
  // w = (I − S) p, so g fixes p...
  const [px, py] = TURN_CENTRE;
  const fixed = gTurn(TURN_CENTRE);
  assert.ok(Math.abs(fixed[0] - px) < 1e-15 && Math.abs(fixed[1] - py) < 1e-15, `g(p) = ${fixed}`);
  assert.deepEqual(TURN_CENTRE, [1 / 18, 1 / 9]);
  assert.deepEqual(TURN_OFFSET, [0, 1 / 6]);
  // ...and g³ is the identity, because I + S + S² = 0.
  const point = [0.3137, -0.812];
  let q = point;
  for (let k = 0; k < 3; k++) q = gTurn(q);
  for (let i = 0; i < 2; i++) assert.ok(Math.abs(q[i] - point[i]) < 1e-14, `g³ ${q} vs ${point}`);
  // The linear part is the 240° turn about the lattice origin, the other sense
  // from Triskele's R — on this chiral field a genuinely different picture.
  assert.deepEqual(turn240([5, -2]), [-7, -5]);
  assert.deepEqual(turn120(turn120([5, -2])), turn240([5, -2]));
  assert.deepEqual(gTurn([5, -2]), [-7 + TURN_OFFSET[0], -5 + TURN_OFFSET[1]]);
  // w is 11 of the 66 nodes, so every claim below is exact integer arithmetic.
  assert.equal(W_NODES, 11);
  assert.equal(TURN_OFFSET[1] * N, 11);
  assert.deepEqual(gNode(5, -2), [-7, -5 + 11]);
  // p is not a symmetry centre of the field: nearly a tenth of a lattice length
  // from the nearest threefold centre of the wave (0, 0), (1/3, 2/3), (2/3, 1/3).
  const distance = ([u, v]) => Math.hypot(u - v / 2, Math.sqrt(3) * v / 2);
  const nearest = Math.min(...[[0, 0], [1 / 3, 2 / 3], [2 / 3, 1 / 3], [1, 0], [0, 1], [1 / 3 - 1, 2 / 3], [2 / 3, 1 / 3 - 1]]
    .map(([u, v]) => distance([px - u, py - v])));
  assert.ok(nearest > 0.09, `p sits ${nearest.toFixed(4)} lattice lengths from the nearest threefold centre of the field`);
});

test('the entangled law holds at every one of the 418 176 node-frames, with no ties', () => {
  let violations = 0, ties = 0;
  for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const here = colourAtNode(x, y, t);
    const [gx, gy] = gNode(x, y);
    // colour(g x, t + T/3) = colour(x, t) − 1, exactly.
    if (colourAtNode(gx, gy, t + THIRD) !== mod(here - 1, 3)) violations++;
    // A tie in the argmax would leave the labelling ambiguous; there are none.
    const sorted = triple(x, y, t).slice().sort((a, b) => b - a);
    if (sorted[0] === sorted[1]) ties++;
  }
  assert.equal(violations, 0, `${violations} of ${FRAMES * S} node-frames break the law`);
  assert.equal(ties, 0, 'no argmax anywhere is a tie');
  // Nothing weaker works: the same operation with the colours left alone, or
  // stepped the other way, agrees with the picture nowhere at all.
  assert.equal(agreement(Smatrix, [0, W_NODES], THIRD, IDENTITY), 0, 'the turn and the wait without the recolouring');
  assert.equal(agreement(Smatrix, [0, W_NODES], THIRD, PLUS), 0, 'the turn and the wait with the colours stepped forward');
  assert.equal(agreement(Smatrix, [0, W_NODES], THIRD, MINUS), 1, 'and with the colours stepped back, everywhere');
  // g² carries 2T/3 and steps the colours the other way.
  assert.equal(agreement([[0, -1], [1, -1]], [W_NODES, W_NODES], 2 * THIRD, PLUS), 1, 'g² with 2T/3 steps the colours forward');
});

test('neither half of the law is a symmetry on its own', () => {
  // The turn alone, best over the three relabellings (chance is 1/3).
  const turnAlone = [IDENTITY, PLUS, MINUS].map(perm => agreement(Smatrix, [0, W_NODES], 0, perm));
  const shiftAlone = [IDENTITY, PLUS, MINUS].map(perm => agreement([[1, 0], [0, 1]], [0, 0], THIRD, perm));
  for (const [name, row] of [['g alone', turnAlone], ['T/3 alone', shiftAlone]]) {
    assert.ok(Math.max(...row) < 0.45, `${name} reaches ${Math.max(...row).toFixed(6)}, far from a symmetry`);
    assert.equal(Math.max(...row).toFixed(6), '0.428446', `${name}: ${row.map(v => v.toFixed(6))}`);
  }
  // The two rows are each other's mirror image, as the algebra demands:
  // colour(g x, t) = colour(x, t − T/3) − 1 puts them in bijection.
  assert.deepEqual(turnAlone.map(v => v.toFixed(6)), ['0.394140', '0.428446', '0.177413']);
  assert.deepEqual(shiftAlone.map(v => v.toFixed(6)), ['0.177413', '0.428446', '0.394140']);
  // Triskele's own relation — the 120° turn about the lattice origin with a
  // 2T/3 shift, colours unchanged — is not a symmetry of this picture either.
  assert.equal(agreement([[0, -1], [1, -1]], [0, 0], 2 * THIRD, IDENTITY).toFixed(6), '0.521233');
  // Nor is the field's own sixfold relation, the nearest miss of all: 60° with
  // 5T/6 reaches 0.7116, and only with a colour transposition — which this
  // picture's group, being onto ℤ₃ with the translations as kernel, can never do.
  for (const [v, perm] of [[[65, 0], [0, 2, 1]], [[12, 12], [1, 0, 2]]]) {
    assert.equal(agreement([[1, -1], [1, 0]], v, 5 * FRAMES / 6, perm).toFixed(6), '0.711619');
  }
});

test('no other operation of the lattice maps the picture to itself', () => {
  // Exhaustive: all 12 point operations of the triangular lattice × all 4 356
  // lattice translations × all 96 time shifts × all 6 colour permutations =
  // 30 108 672 combinations, each tested for exactness (and abandoned at its
  // first disagreeing node, which is what makes the sweep cheap).
  const OPS = {
    '1': [[1, 0], [0, 1]], R60: [[1, -1], [1, 0]], R120: [[0, -1], [1, -1]],
    R180: [[-1, 0], [0, -1]], R240: [[-1, 1], [-1, 0]], R300: [[0, 1], [-1, 1]],
    Ma: [[0, 1], [1, 0]], Mb: [[1, 0], [1, -1]], Mc: [[-1, 1], [0, 1]],
    Md: [[0, -1], [-1, 0]], Me: [[-1, 0], [-1, 1]], Mf: [[1, -1], [0, -1]],
  };
  const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const found = [];
  let combinations = 0;
  for (const [name, [[a, b], [c, d]]] of Object.entries(OPS)) {
    const mx = new Int32Array(S), my = new Int32Array(S);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      mx[y * N + x] = mod(a * x + b * y, N); my[y * N + x] = mod(c * x + d * y, N);
    }
    for (let shift = 0; shift < FRAMES; shift++) for (const perm of PERMS) {
      for (let vy = 0; vy < N; vy++) for (let vx = 0; vx < N; vx++) {
        combinations++;
        let holds = true;
        sweep: for (let t = 0; t < FRAMES; t++) {
          const src = t * S, dst = mod(t + shift, FRAMES) * S;
          for (let i = 0; i < S; i++) {
            const j = mod(my[i] + vy, N) * N + mod(mx[i] + vx, N);
            if (colours[dst + j] !== perm[colours[src + i]]) { holds = false; break sweep; }
          }
        }
        if (holds) found.push(`${name} v=(${vx},${vy}) time ${shift}/${FRAMES} colour ${perm.join('')}`);
      }
    }
  }
  assert.equal(combinations, 12 * S * FRAMES * 6);
  assert.equal(combinations, 30108672);
  // Exactly three, and they are the identity and the two cosets of g.
  assert.deepEqual(found.sort(), [
    '1 v=(0,0) time 0/96 colour 012',              // the identity
    'R120 v=(11,11) time 64/96 colour 120',        // g² with 2T/3, colours +1
    'R240 v=(0,11) time 32/96 colour 201',         // g with T/3, colours −1
  ]);
  // So: the colour-preserving subgroup is exactly the lattice translations (p1),
  // the group of the picture is p3 = the catalogue's g225, and the colour action
  // is onto ℤ₃ — a 3-cycle, never a transposition, so no mirror can survive.
});

// ---- how near the near misses come ----
// The sweep above settles exactness. How near everything *else* comes needs the
// agreement of every combination and not just whether it is 1, which is one
// cyclic correlation per point operation rather than 2.5 million sweeps each.
// With ω = e^(2πi/3) and colours in {0,1,2},
//
//     [c′ = π(c)] = (1/3) Σ_j ω^(j(c′ − π(c))),
//
// so over the whole volume, with A = ω^colour and P = ω^(−colour) ∘ M⁻¹,
//
//     count(v, τ, π) = (NT + 2 Re(f₁ Y + f₂ Z)) / 3,
//     Z(v, τ) = Σ A[t+τ][y+v] P[t][y],   Y(v, τ) = Σ A[t+τ][y+v] conj(P[t][y]),
//
// f₁, f₂ being the Fourier coefficients of c ↦ ω^(−π(c)). Z and Y are cyclic
// correlations, so each is two forward transforms and one inverse.
function plan(n) {
  const factors = [];
  let m = n;
  for (let p = 2; p <= m; p++) while (m % p === 0) { factors.push(p); m /= p; }
  const cos = new Float64Array(n), sin = new Float64Array(n);
  for (let k = 0; k < n; k++) { cos[k] = Math.cos(2 * Math.PI * k / n); sin[k] = Math.sin(2 * Math.PI * k / n); }
  return {n, factors, cos, sin, outRe: new Float64Array(n), outIm: new Float64Array(n), tmpRe: new Float64Array(16), tmpIm: new Float64Array(16)};
}
/** Mixed-radix Cooley–Tukey: the DFT of one strided line into `outRe`/`outIm`. */
function fftLine(re, im, inOff, inStride, n, level, p, sign, outRe, outIm, outOff) {
  if (n === 1) { outRe[outOff] = re[inOff]; outIm[outOff] = im[inOff]; return; }
  const radix = p.factors[level], m = n / radix, nn = p.n, step = nn / n, root = nn / radix;
  for (let j = 0; j < radix; j++) fftLine(re, im, inOff + j * inStride, inStride * radix, m, level + 1, p, sign, outRe, outIm, outOff + j * m);
  const {tmpRe, tmpIm, cos, sin} = p;
  for (let k = 0; k < m; k++) {
    for (let j = 0; j < radix; j++) {
      const index = outOff + j * m + k, a = outRe[index], b = outIm[index];
      const t = (j * k * step) % nn, c = cos[t], s = sign * sin[t];
      tmpRe[j] = a * c - b * s; tmpIm[j] = a * s + b * c;
    }
    for (let q = 0; q < radix; q++) {
      let sr = 0, si = 0;
      for (let j = 0; j < radix; j++) {
        const t = (j * q * root) % nn, c = cos[t], s = sign * sin[t];
        sr += tmpRe[j] * c - tmpIm[j] * s;
        si += tmpRe[j] * s + tmpIm[j] * c;
      }
      outRe[outOff + q * m + k] = sr; outIm[outOff + q * m + k] = si;
    }
  }
}
const planFrames = plan(FRAMES), planNodes = plan(N);
const lineStarts = [[], [], []];
for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) lineStarts[0].push(t * S + y * N);
for (let t = 0; t < FRAMES; t++) for (let x = 0; x < N; x++) lineStarts[1].push(t * S + x);
for (let i = 0; i < S; i++) lineStarts[2].push(i);
function axis(re, im, p, sign, stride, starts) {
  const {outRe, outIm, n} = p;
  for (const start of starts) {
    fftLine(re, im, start, stride, n, 0, p, sign, outRe, outIm, 0);
    for (let k = 0; k < n; k++) { re[start + k * stride] = outRe[k]; im[start + k * stride] = outIm[k]; }
  }
}
function fft3(re, im, sign) {
  axis(re, im, planNodes, sign, 1, lineStarts[0]);
  axis(re, im, planNodes, sign, N, lineStarts[1]);
  axis(re, im, planFrames, sign, S, lineStarts[2]);
}
const OMEGA = [0, 1, 2].map(k => [Math.cos(2 * Math.PI * k / 3), Math.sin(2 * Math.PI * k / 3)]);
const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
// f_l = (1/3) Σ_c ω^(−π(c)) ω^(−lc)
const COEFFICIENTS = PERMS.map(perm => [0, 1, 2].map(l => {
  let re = 0, im = 0;
  for (let c = 0; c < 3; c++) { const [x, y] = OMEGA[mod(-perm[c] - l * c, 3)]; re += x / 3; im += y / 3; }
  return [re, im];
}));
const NT = FRAMES * S;
const spectrum = (() => {
  const re = new Float64Array(NT), im = new Float64Array(NT);
  for (let i = 0; i < NT; i++) { [re[i], im[i]] = OMEGA[colours[i]]; }
  fft3(re, im, -1);
  return {re, im};
})();
const negated = new Int32Array(NT);
for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  negated[t * S + y * N + x] = mod(-t, FRAMES) * S + mod(-y, N) * N + mod(-x, N);
}
/** Agreement of every translation, time shift and colour permutation for one
 * point operation, as a function (vx, vy, shift, permutation index). */
function agreementsFor([[a, b], [c, d]]) {
  const determinant = a * d - b * c;
  const inverse = [[d / determinant, -b / determinant], [-c / determinant, a / determinant]];
  const pRe = new Float64Array(NT), pIm = new Float64Array(NT);
  for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const sx = mod(inverse[0][0] * x + inverse[0][1] * y, N), sy = mod(inverse[1][0] * x + inverse[1][1] * y, N);
    const [re, im] = OMEGA[colours[t * S + sy * N + sx]];
    pRe[t * S + y * N + x] = re; pIm[t * S + y * N + x] = -im;
  }
  fft3(pRe, pIm, -1);
  const zRe = new Float64Array(NT), zIm = new Float64Array(NT), yRe = new Float64Array(NT), yIm = new Float64Array(NT);
  for (let k = 0; k < NT; k++) {
    const j = negated[k], ar = spectrum.re[k], ai = spectrum.im[k];
    zRe[k] = ar * pRe[j] - ai * pIm[j]; zIm[k] = ar * pIm[j] + ai * pRe[j];
    yRe[k] = ar * pRe[k] + ai * pIm[k]; yIm[k] = ai * pRe[k] - ar * pIm[k];
  }
  fft3(zRe, zIm, 1); fft3(yRe, yIm, 1);
  return (vx, vy, shift, perm) => {
    const i = mod(shift, FRAMES) * S + mod(vy, N) * N + mod(vx, N), [, f1, f2] = COEFFICIENTS[perm];
    return (NT + 2 * (f1[0] * yRe[i] - f1[1] * yIm[i] + f2[0] * zRe[i] - f2[1] * zIm[i]) / NT) / 3 / NT;
  };
}

test('no near miss comes close, and the ones that do are the law itself, jogged', () => {
  const OPS = {
    '1': [[1, 0], [0, 1]], R60: [[1, -1], [1, 0]], R120: [[0, -1], [1, -1]],
    R180: [[-1, 0], [0, -1]], R240: [[-1, 1], [-1, 0]], R300: [[0, 1], [-1, 1]],
    Ma: [[0, 1], [1, 0]], Mb: [[1, 0], [1, -1]], Mc: [[-1, 1], [0, 1]],
    Md: [[0, -1], [-1, 0]], Me: [[-1, 0], [-1, 1]], Mf: [[1, -1], [0, -1]],
  };
  const exact = [], top = {};
  const describe = (name, vx, vy, shift, perm) => `${name} v=(${vx},${vy}) time ${shift}/${FRAMES} colour ${PERMS[perm].join('')}`;
  for (const [name, matrix] of Object.entries(OPS)) {
    const value = agreementsFor(matrix);
    const third = name === 'R120' || name === 'R240';
    const mirror = name.startsWith('M');
    // The exact symmetry's own translation, for "any OTHER centre".
    const centre = name === 'R120' ? [11, 11] : name === 'R240' ? [0, 11] : null;
    const best = (key, v, vx, vy, shift, perm) => { if (!top[key] || v > top[key][0]) top[key] = [v, describe(name, vx, vy, shift, perm)]; };
    for (let shift = 0; shift < FRAMES; shift++) for (let vy = 0; vy < N; vy++) for (let vx = 0; vx < N; vx++) {
      const own = centre !== null && vx === centre[0] && vy === centre[1];
      for (let perm = 0; perm < 6; perm++) {
        const here = value(vx, vy, shift, perm);
        if (here > 1 - 1e-9) { exact.push(describe(name, vx, vy, shift, perm)); continue; }
        if (!top.any || here > top.any[0]) best('any', here, vx, vy, shift, perm);
        if (third) {
          if (!top.third || here > top.third[0]) best('third', here, vx, vy, shift, perm);
          if (perm === 0 && (!top['third-preserving'] || here > top['third-preserving'][0])) best('third-preserving', here, vx, vy, shift, perm);
          if (!own && (!top['third-elsewhere'] || here > top['third-elsewhere'][0])) best('third-elsewhere', here, vx, vy, shift, perm);
        }
        if (mirror && (!top.mirror || here > top.mirror[0])) best('mirror', here, vx, vy, shift, perm);
        if (name === '1' && (!top.translation || here > top.translation[0])) best('translation', here, vx, vy, shift, perm);
      }
    }
  }
  // The same three symmetries the brute-force sweep found, by a method that
  // shares nothing with it but the colours themselves.
  assert.deepEqual(exact.sort(), [
    '1 v=(0,0) time 0/96 colour 012',
    'R120 v=(11,11) time 64/96 colour 120',
    'R240 v=(0,11) time 32/96 colour 201',
  ]);
  // A third-turn that keeps the colours is nowhere near a symmetry, whatever
  // its centre and whatever the shift: this is the bound the page claims.
  assert.equal(top['third-preserving'][0].toFixed(6), '0.566197', top['third-preserving'][1]);
  assert.match(top['third-preserving'][1], /v=\(23,9\) time 64\/96|v=\(14,23\) time 32\/96/);
  // A third-turn that DOES cycle the colours is not isolated, and saying so is
  // the honest form of the claim: move the centre half a node off p, or the
  // shift one saved frame off T/3, and most of the picture still agrees.
  assert.equal(top['third-elsewhere'][0].toFixed(6), '0.896316', top['third-elsewhere'][1]);
  assert.equal(top.third[0].toFixed(6), '0.969654', top.third[1]);
  assert.match(top.third[1], /v=\(11,11\) time 63\/96 colour 120|v=\(0,11\) time 31\/96 colour 201/);
  // …and the reason is no deeper than this: one saved frame of the loop changes
  // the picture by 3 %, so the exact law composed with a one-frame shift keeps
  // 97 % of it. The ridge is the law's own, which is why exactness — not
  // agreement — is what the table tests.
  assert.equal(top.translation[0].toFixed(6), '0.969654', top.translation[1]);
  assert.equal(top.translation[1], '1 v=(0,0) time 1/96 colour 012');
  assert.equal(top.third[0].toFixed(9), top.translation[0].toFixed(9));
  // No mirror survives anywhere, at any centre, shift or relabelling — which is
  // what makes the colour action a 3-cycle throughout. The field is chiral.
  assert.equal(top.mirror[0].toFixed(6), '0.476974', top.mirror[1]);
  // And the nearest miss of all is the field's own sixfold relation.
  assert.equal(top.any[0].toFixed(6), '0.969654');
  // The correlation agrees with the direct count wherever it is asked.
  const value = agreementsFor(Smatrix);
  for (const [vx, vy, shift, perm] of [[0, 11, THIRD, 4], [0, 11, THIRD, 0], [23, 9, 64, 0], [40, 20, 32, 4], [7, 61, 5, 2]]) {
    assert.ok(Math.abs(value(vx, vy, shift, perm) - agreement(Smatrix, [vx, vy], shift, PERMS[perm])) < 1e-9,
      `the correlation and the direct count agree at v=(${vx},${vy}) shift ${shift} perm ${PERMS[perm]}`);
  }
});

test('the three colours share space-time exactly, and every frame nearly', () => {
  const counts = [0, 0, 0];
  let low = 1, high = 0;
  for (let t = 0; t < FRAMES; t++) {
    const frame = [0, 0, 0];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) frame[colourAtNode(x, y, t)]++;
    for (let k = 0; k < 3; k++) { counts[k] += frame[k]; low = Math.min(low, frame[k] / S); high = Math.max(high, frame[k] / S); }
  }
  // Exactly a third each over the loop — the bijection (x, t) → (g x, t + T/3)
  // is measure preserving and sends each colour's region onto the next one's.
  assert.deepEqual(counts, [FRAMES * S / 3, FRAMES * S / 3, FRAMES * S / 3]);
  assert.deepEqual(counts, [139392, 139392, 139392]);
  // At a single instant the shares are close but not equal: no symmetry of this
  // picture carries a time shift of zero, so nothing forces them to be.
  assert.equal(low.toFixed(6), '0.312443');
  assert.equal(high.toFixed(6), '0.350551');
  assert.ok(high - low < 0.04, `per-frame shares span ${(high - low).toFixed(4)}`);
  // And on the continuum the viewer actually draws: a fine sweep of one repeat.
  const plane = frameAt(U, 0.137);
  const sweep = [0, 0, 0], steps = 240;
  for (let j = 0; j < steps; j++) for (let i = 0; i < steps; i++) sweep[colourAt(plane, [(i + 0.5) / steps, (j + 0.5) / steps])]++;
  for (const count of sweep) assert.ok(Math.abs(count / (steps * steps) - 1 / 3) < 0.04, `colour areas ${sweep.map(c => (c / (steps * steps)).toFixed(4))}`);
});

test('at the turn centre the law is left with nothing but the colour cycle', () => {
  // g fixes p, so there the law says only colour(p, t + T/3) = colour(p, t) − 1:
  // the symmetry with its spatial part switched off, stepping three times a loop.
  const sequence = Array.from({length: 12}, (_, k) => colourAt(frameAt(U, k / 12), TURN_CENTRE));
  assert.deepEqual(sequence, [2, 1, 1, 1, 1, 0, 0, 0, 0, 2, 2, 2]);
  for (let k = 0; k < 12; k++) assert.equal(mod(sequence[(k + 4) % 12] - sequence[k], 3), 2, `phase ${k}/12 steps back one place`);
  // The three sampled points collapse onto p there, so the colouring is flat in
  // a small disc around it — a few nodes across, invisible at the home framing.
  const plane = frameAt(U, 0.1);
  const middle = colourAt(plane, TURN_CENTRE);
  for (const radius of [0.01, 0.03]) {
    for (let j = 0; j < 12; j++) {
      const angle = j * Math.PI / 6;
      const point = [TURN_CENTRE[0] + radius * Math.cos(angle), TURN_CENTRE[1] + radius * Math.sin(angle)];
      assert.equal(colourAt(plane, point), middle, `the disc of radius ${radius} around p is one colour`);
    }
  }
});

test('the reconstruction the shader uses carries the law off the nodes too', () => {
  // Both sides of the law read the SAME channel at the SAME position, so plain
  // Catmull–Rom is exact — no symmetrised kernel, unlike ../triskele/.
  let worst = 0, violations = 0, checked = 0;
  let seed = 7;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (const phase of [0, 0.017, 0.123, 0.5, 0.77, 0.9999]) {
    const here = frameAt(U, phase), later = frameAt(U, phase + 1 / 3);
    for (let i = 0; i < 400; i++) {
      const point = [random() * 6 - 3, random() * 6 - 3];
      const a = valuesAt(here, point), b = valuesAt(later, gTurn(point));
      for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(b[k] - a[(k + 1) % 3]));
      if (colourAt(later, gTurn(point)) !== mod(colourAt(here, point) - 1, 3)) violations++;
      checked++;
    }
  }
  assert.equal(violations, 0, `${violations} of ${checked} interpolated points break the law`);
  assert.ok(worst < 1e-12, `the two sides agree to ${worst.toExponential(2)} — double-precision round-off, not interpolation error`);
  // Value k is channel k read at g^k x, and nothing else: three positions, one
  // channel each, which is exactly what the fragment shader's `weights` does.
  const plane = frameAt(U, 0.4275);
  for (const point of [[0.31, 0.12], [0.8, 0.47], [0.02, 0.93], [1 / 18, 1 / 9]]) {
    const values = valuesAt(plane, point);
    let q = point;
    for (let k = 0; k < 3; k++) { assert.equal(values[k], bicubicRGB(plane, q)[k]); q = gTurn(q); }
  }
  assert.ok(Math.max(...valuesAt(plane, [0.31, 0.12])) - Math.min(...valuesAt(plane, [0.31, 0.12])) > 1e-4, 'the three values are genuinely different');
});

test('the texture channels are the field at three instants a third of a period apart', () => {
  const phase = 0.4275, plane = frameAt(U, phase);
  for (const channel of [0, 1, 2]) {
    const t = wrap(phase + channel / 3) * FRAMES, k = Math.floor(t), w = cubicWeights(t - k);
    for (const i of [0, 1, 1000, S - 1]) {
      let expected = 0;
      for (let j = 0; j < 4; j++) expected += w[j] * U[mod(k + j - 1, FRAMES) * S + i];
      assert.ok(Math.abs(plane[4 * i + channel] - expected) < 1e-7);
    }
  }
  // A third of a period renames channel k as channel k + 1, exactly — which is
  // why the law needs no tolerance in time either.
  const later = frameAt(U, phase + 1 / 3);
  for (let i = 0; i < S; i++) for (let k = 0; k < 3; k++) assert.equal(later[4 * i + k], plane[4 * i + (k + 1) % 3]);
});

test('the shutter integrates a frame without touching the rule', () => {
  assert.equal(TAA_LAYERS, 3);
  assert.equal(MAX_TAA_LAYERS, 5);
  // The default shutter is three tenths of a frame (the user's crispness
  // choice); a full frame interval, exercised below with shutter = 1, is the box
  // filter under which consecutive frames' sub-phases tile the timeline with no
  // gap and no overlap.
  assert.equal(SHUTTER, 0.3);
  const tile = [...shutterPhases(0.5, 3, 16, 1), ...shutterPhases(0.5 + 16 / (1000 * LOOP_SECONDS), 3, 16, 1)];
  const gaps = tile.slice(1).map((p, j) => p - tile[j]);
  for (const gap of gaps) assert.ok(Math.abs(gap - gaps[0]) < 1e-15, `evenly spaced across two frames: ${gaps}`);
  // One layer is the frame's own instant, so ?taa=0 draws exactly what a viewer
  // without a shutter draws — which is what the pixel comparisons rely on.
  assert.deepEqual(shutterPhases(0.25, 1), [0.25]);
  assert.deepEqual([...framesAt(U, shutterPhases(0.42, 1))], [...frameAt(U, 0.42)]);
  for (const layers of [2, 3, 5]) {
    const phases = shutterPhases(0.25, layers, 16.667, SHUTTER);
    const span = SHUTTER * 16.667 / (1000 * LOOP_SECONDS);
    assert.equal(phases.length, layers);
    for (const [j, p] of phases.entries()) assert.ok(Math.abs(p - (0.25 + span * ((j + 0.5) / layers - 0.5))) < 1e-15, `layer ${j} of ${layers}`);
    assert.ok(Math.abs(phases.reduce((a, b) => a + b, 0) / layers - 0.25) < 1e-15, 'centred on the displayed frame');
    // Every layer is the plain frame at its own sub-phase, bit for bit.
    const volume = framesAt(U, phases);
    for (const [j, p] of phases.entries()) assert.deepEqual([...volume.subarray(j * 4 * S, (j + 1) * 4 * S)], [...frameAt(U, p)]);
  }
  assert.ok(Math.abs(FALLBACK_INTERVAL / (1000 * LOOP_SECONDS) - 1 / 480) < 1e-9, 'one 60 Hz frame is a 480th of the loop');

  // The law holds per sub-phase, so the shutter cannot perturb the symmetry: it
  // averages three pictures each of which obeys it.
  for (const phase of shutterPhases(0.137, TAA_LAYERS)) {
    const here = frameAt(U, phase), later = frameAt(U, phase + 1 / 3);
    for (const point of [[0.21, 0.63], [0.77, 0.08], [1 / 18, 1 / 9]]) {
      assert.equal(colourAt(later, gTurn(point)), mod(colourAt(here, point) - 1, 3), `sub-phase ${phase}`);
    }
  }

  // And the reason the shader averages the colours and never the field: at a
  // point a boundary crossed during the shutter the three sub-phases disagree,
  // so their colours average to a blend — while the mean of the three value
  // triples has a single argmax and is always one pure palette colour.
  const phases = shutterPhases(0.137, TAA_LAYERS, FALLBACK_INTERVAL, SHUTTER);
  const planes = phases.map(p => frameAt(U, p));
  const steps = 300, mixed = [];
  let swept = 0;
  for (let j = 0; j < steps; j++) for (let i = 0; i < steps; i++) {
    const point = [(i + 0.5) / steps, (j + 0.5) / steps];
    const seen = planes.map(plane => colourAt(plane, point));
    if (seen[0] !== seen.at(-1)) { swept++; if (mixed.length < 40) mixed.push(point); }
  }
  assert.ok(swept > 0, 'some points change colour inside a single shutter');
  assert.ok(swept / (steps * steps) < 0.01, `${(100 * swept / (steps * steps)).toFixed(3)}% of the plane changes colour inside one shutter`);
  for (const point of mixed) {
    const counts = [0, 0, 0];
    for (const plane of planes) counts[colourAt(plane, point)]++;
    assert.ok(Math.max(...counts) < TAA_LAYERS, 'the sub-phases disagree, so the average of the colours is a blend');
    const mean = [0, 0, 0];
    for (const plane of planes) { const w = valuesAt(plane, point); for (let k = 0; k < 3; k++) mean[k] += w[k] / TAA_LAYERS; }
    const argmax = mean[0] >= mean[1] && mean[0] >= mean[2] ? 0 : mean[1] >= mean[2] ? 1 : 2;
    assert.ok(counts[argmax] > 0 && counts[argmax] < TAA_LAYERS, 'the average of the field is one pure colour, never a blend');
  }
});

test('the picture is chunky, clean and quick, measured on the lattice edges', () => {
  // The six nearest neighbours of a node: ±a1, ±a2 and ±(a1 + a2), all one
  // spacing apart. (1, −1) = a1 − a2 is √3 times as far — a second neighbour,
  // not an edge — so the three directions that cover every edge exactly once
  // are (1, 0), (0, 1) and (1, 1).
  const SIX = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];
  const EDGES = [[1, 0], [0, 1], [1, 1]];
  const distance = ([u, v]) => Math.hypot(u - v / 2, Math.sqrt(3) * v / 2);
  for (const step of EDGES) assert.ok(Math.abs(distance(step) - 1) < 1e-12, `${step} is a lattice edge`);
  assert.ok(Math.abs(distance([1, -1]) - Math.sqrt(3)) < 1e-12, '(1, −1) is a second neighbour, not an edge');
  // Triskele's colouring of the same field, for comparison: argmax_k U(R^k x, t),
  // R the 120° turn about the lattice origin, with no time shift at all.
  const triskele = new Int8Array(FRAMES * S);
  for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const values = [];
    let p = [x, y];
    for (let k = 0; k < 3; k++) { values.push(at(p[0], p[1], t)); p = turn120(p); }
    triskele[t * S + y * N + x] = values[0] >= values[1] && values[0] >= values[2] ? 0 : values[1] >= values[2] ? 1 : 2;
  }
  function measure(colouring) {
    let edges = 0, boundary = 0, speckle = 0, changes = 0;
    for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const here = colouring[t * S + y * N + x];
      for (const [dx, dy] of EDGES) { edges++; if (colouring[t * S + mod(y + dy, N) * N + mod(x + dx, N)] !== here) boundary++; }
      if (SIX.every(([dx, dy]) => colouring[t * S + mod(y + dy, N) * N + mod(x + dx, N)] !== here)) speckle++;
      if (colouring[mod(t + 1, FRAMES) * S + y * N + x] !== here) changes++;
    }
    return {boundary: boundary / edges, speckle: speckle / (FRAMES * S), changes: FRAMES * changes / (FRAMES * S)};
  }
  const gyre = measure(colours), other = measure(triskele);
  assert.equal(gyre.boundary.toFixed(4), '0.1037', 'boundary density over lattice edges');
  assert.equal(other.boundary.toFixed(4), '0.1076', "Triskele's colouring of the same field");
  assert.ok(gyre.boundary < other.boundary, 'this page paints the chunkier regions of the two');
  assert.equal(gyre.speckle.toExponential(1), '7.9e-5', 'nodes disagreeing with all six neighbours');
  assert.equal(other.speckle.toExponential(1), '1.3e-4');
  assert.ok(gyre.speckle < other.speckle, 'and the cleaner');
  assert.equal(gyre.changes.toFixed(2), '2.91', 'colour changes per node per period');
  // Those two together are the speed of the picture: 2.91 crossings a period
  // over 66 × 0.1037 = 6.84 boundaries per lattice length. That is the constant
  // the renderer turns into an on-screen speed when it decides whether the
  // shutter is worth paying for.
  const speed = gyre.changes / (N * gyre.boundary);
  assert.equal(speed.toFixed(3), '0.426', 'lattice lengths per period');
  assert.ok(Math.abs(speed - BOUNDARY_SPEED) < 0.01, `BOUNDARY_SPEED = ${BOUNDARY_SPEED} against the measured ${speed.toFixed(3)}`);
  // Decisiveness: the winner leads the runner-up by about one standard
  // deviation of the field, so boundaries are sharp rather than marginal.
  let lead = 0;
  for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const sorted = triple(x, y, t).sort((a, b) => b - a);
    lead += sorted[0] - sorted[1];
  }
  // …against the field's own spread, over every saved sample.
  let total = 0, totalSquare = 0;
  for (let i = 0; i < U.length; i++) { total += U[i]; totalSquare += U[i] * U[i]; }
  const sd = Math.sqrt(totalSquare / U.length - (total / U.length) ** 2);
  assert.equal((lead / (FRAMES * S) / sd).toFixed(3), '1.004', 'mean winner-minus-runner-up over the field’s standard deviation');
  // And it is genuinely a different picture from Triskele's, not a relabelling.
  let same = 0;
  for (let i = 0; i < colours.length; i++) if (colours[i] === triskele[i]) same++;
  assert.equal((same / colours.length).toFixed(4), '0.5287', "agreement with Triskele's colouring of the same field");
});

test('the governor gives up the shutter before the resolution, and settles', () => {
  // A GPU that needs 27 ms a frame with the shutter and 10 ms without it, on a
  // 60 Hz display: the shutter must go, the resolution must not, and the page
  // must not spend the rest of the afternoon switching between the two.
  function run({seconds = 300, display = 1000 / 60, shuttered = 27, plain = 10, refresh = 1000 / 60} = {}) {
    const governor = createGovernor({display});
    let now = 0, switches = 0, late = 0, frames = 0, lowest = 1, wasOn = true;
    while (now < seconds * 1000) {
      const layers = governor.shutter ? 3 : 1;
      const cost = (layers > 1 ? shuttered : plain) * governor.quality ** 2;
      const dt = Math.max(refresh, Math.ceil(cost / refresh) * refresh); // the next vsync that can take it
      now += dt; frames++;
      if (dt > refresh) late++;
      governor.tick(now, true, layers > 1);
      if (governor.shutter !== wasOn) { switches++; wasOn = governor.shutter; }
      lowest = Math.min(lowest, governor.quality);
    }
    return {switches, late: late / frames, quality: governor.quality, lowest, shutter: governor.shutter};
  }
  const slow = run();
  assert.equal(slow.shutter, false, 'the shutter is what gives way');
  assert.equal(slow.quality, 1, 'and the resolution is left alone: dropping the shutter was enough');
  assert.equal(slow.lowest, 1, 'the resolution never had to move at all');
  assert.ok(slow.switches <= 8, `${slow.switches} shutter switches in 300 s — the retry interval doubles, so it settles`);
  assert.ok(slow.late < 0.03, `${(100 * slow.late).toFixed(1)} % of frames late`);
  // A GPU that cannot hold the cadence even without the shutter drops the
  // resolution too — in that order, never both at once.
  const slower = run({shuttered: 60, plain: 40});
  assert.equal(slower.shutter, false);
  assert.ok(slower.quality < 1, `the resolution follows when the shutter is not enough (quality ${slower.quality.toFixed(3)})`);
  // A GPU with room to spare keeps everything.
  const fast = run({shuttered: 5, plain: 2});
  assert.deepEqual([fast.shutter, fast.quality, fast.switches, fast.late], [true, 1, 0, 0]);
  // The old failure: the climb-back must not offer a quality level that has
  // already been measured as too slow, or the two sides of a cost step
  // alternate for ever. A governor that has just dropped from 1 stays below 1
  // until its 20 s cooling-off expires — and then does try again.
  const governor = createGovernor({display: 1000 / 60});
  let now = 0;
  const feed = (interval, windows) => { for (let i = 0; i < windows * 46; i++) { now += interval; governor.tick(now, true, false); } };
  feed(1000 / 60, 1);
  assert.equal(governor.quality, 1);
  feed(33, 1); // one window of frames arriving late, with no shutter to blame
  assert.ok(governor.quality < 1, `the resolution drops (quality ${governor.quality})`);
  const dropped = governor.quality;
  feed(1000 / 60, 8); // on time again — but only because the resolution is lower
  assert.equal(governor.quality, dropped, 'it does not climb back into the level it measured as late');
  feed(1000 / 60, 20); // …for twenty seconds, after which it is worth another try
  assert.equal(governor.quality, 1, 'and it does try again later');
});

test('the shutter is spent only where the picture actually moves', () => {
  // Sub-samples sit symmetrically about the frame's own instant and average to it.
  for (const layers of [1, 2, 3, 5]) {
    const offsets = shutterOffsets(layers, SHUTTER);
    assert.equal(offsets.length, layers);
    assert.ok(Math.abs(offsets.reduce((a, b) => a + b, 0)) < 1e-15, `centred: ${offsets}`);
    assert.ok(Math.max(...offsets.map(Math.abs)) <= SHUTTER / 2 + 1e-15, 'inside the shutter');
  }
  assert.deepEqual(shutterOffsets(1, SHUTTER), [0], 'one sub-sample is the frame itself');
  for (const [j, offset] of shutterOffsets(3, 1).entries()) assert.ok(Math.abs(offset - (j - 1) / 3) < 1e-15, `thirds of a frame apart: ${offset}`);
  for (const offset of shutterOffsets(3, 0)) assert.equal(Math.abs(offset), 0, 'a zero-width shutter samples one instant three times — which is why it collapses to one layer');
  // A view step is the shorter way round the periodic plane, so a pan across
  // the wrap is the small step it looks like and not a jump of a whole repeat.
  const still = {center: [0.2, 0.3], scale: 380, angle: 0};
  assert.deepEqual(viewDelta(still, still), {center: [0, 0], zoom: 0, angle: 0});
  const wrapped = viewDelta({center: [0.98, 0.5], scale: 380, angle: 0}, {center: [0.02, 0.5], scale: 380, angle: 0});
  assert.ok(Math.abs(wrapped.center[0] - 0.04) < 1e-12, `a pan across the wrap reads ${wrapped.center[0]}`);
  const zoomed = viewDelta(still, {center: [0.2, 0.3], scale: 380 * 1.05, angle: 0.02});
  assert.ok(Math.abs(zoomed.zoom - Math.log(1.05)) < 1e-12 && Math.abs(zoomed.angle - 0.02) < 1e-12);
  // On-screen travel: a pan of one lattice length at 380 px per repeat is 380 px.
  assert.equal(viewMotion({center: [1, 0], zoom: 0, angle: 0}, 380, 1000, 600), 380);
  assert.ok(viewMotion({center: [0, 0], zoom: 0, angle: 0.01}, 380, 1000, 600) > 0, 'a turn moves the corners');
  assert.equal(viewMotion(NO_MOTION, 380, 1000, 600), 0);
  // The pattern's own motion: at the home framing it is a third of a pixel a
  // frame, which is why the shutter stays off there. The gate is on the SMEAR
  // the shutter would draw — travel × shutter — so the travel it takes to
  // engage is motion / shutter: 2.5 px a frame at the shipped 0.3 shutter,
  // which the pattern reaches at about 2790 CSS px per repeat, and 0.75 px
  // a frame with ?shutter=1, which it reaches at 837.
  const gateScale = shutter => MOTION_PIXELS / (shutter * BOUNDARY_SPEED * FALLBACK_INTERVAL / (1000 * LOOP_SECONDS));
  assert.equal(patternMotion(380, FALLBACK_INTERVAL).toFixed(3), '0.340');
  assert.ok(patternMotion(380, FALLBACK_INTERVAL) * SHUTTER < MOTION_PIXELS, 'the home framing does not pay for a shutter');
  assert.ok(patternMotion(gateScale(SHUTTER) * 1.01, FALLBACK_INTERVAL) * SHUTTER > MOTION_PIXELS, 'a framing past the gate does');
  assert.ok(patternMotion(gateScale(SHUTTER) * 0.99, FALLBACK_INTERVAL) * SHUTTER < MOTION_PIXELS, 'and one just short of it does not');
  // 900 px per repeat used to engage it, when the gate read the travel rather
  // than the smear. At the shipped 0.3 shutter the smear there is 0.65 px.
  assert.ok(patternMotion(900, FALLBACK_INTERVAL) * SHUTTER < MOTION_PIXELS, 'the old 900 px framing no longer pays for one');
  assert.equal((MOTION_PIXELS / SHUTTER).toFixed(2), '2.50', 'the shipped shutter asks for 2.5 CSS px of travel a frame');
  assert.equal(gateScale(SHUTTER).toFixed(0), '2791', 'which the pattern reaches at about 2790 CSS px per repeat');
  assert.equal(gateScale(1).toFixed(0), '837', 'and the full box filter engages at 837, as on the sibling pages');
  assert.ok(gateScale(SHUTTER) < MAX_SCALE, 'the pattern engages the shutter by itself before the zoom limit');
  assert.equal(MOTION_PIXELS, 0.75);
  // The other end: the view's smear is integrated over at most SMEAR_PIXELS per
  // sub-sample, so three of them never spread the picture over more than 18 CSS
  // pixels and a hard fling stays a blur instead of becoming a comb of copies.
  assert.equal(SMEAR_PIXELS, 6);
  assert.ok(SMEAR_PIXELS * TAA_LAYERS > patternMotion(MAX_SCALE, FALLBACK_INTERVAL) * SHUTTER,
    'the pattern’s own motion never reaches that width, even at the deepest zoom, so the cap bounds panning only');
});

test('turns snap to a sixth of a turn and the palette is the documented one', () => {
  const degrees = angle => Math.round(snapAngle(angle * Math.PI / 180) * 180 / Math.PI);
  assert.equal(degrees(58), 60);
  assert.equal(degrees(62), 60);
  assert.equal(degrees(53), 53);
  assert.equal(degrees(119), 120);
  assert.equal(degrees(-61), -60);
  assert.equal(degrees(2), 0);
  assert.equal(degrees(89), 89, 'a quarter turn is not a lattice symmetry here');
  // The lattice is triangular, so the view snaps to sixths even though the
  // picture's own colour symmetry is only a third of a turn.
  assert.deepEqual(PALETTE, ['#c9563e', '#57979a', '#e2be68']);
});

test('the page announces itself as Gyre and links its own assets', async () => {
  const page = await readFile(new URL('../gyre/index.html', import.meta.url), 'utf8');
  assert.match(page, /<title>Gyre — Turn, wait, recolour<\/title>/);
  assert.match(page, /<span class="name">Gyre<\/span>/);
  for (const tag of ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card', 'twitter:image']) {
    assert.ok(page.includes(`"${tag}"`), `missing ${tag}`);
  }
  assert.match(page, /<canvas id="pattern"/);
  assert.match(page, /\.\/app\.mjs/);
  const manifest = JSON.parse(await readFile(new URL('../gyre/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.short_name, 'Gyre');
});

// ---------------------------------------------------------------- momentum
// The viewer's inertia, off the clock: the velocity a release is read at, and
// the glide that velocity turns into — pan, zoom and turn in one animation, an
// elastic give at the zoom limits, and the ease onto a sixth of a turn. None of
// this touches the field; it is checked here so that one command covers the
// whole page.

const DEG = Math.PI / 180;
/** A gesture's samples: `steps` readings `gap` ms apart, each moving the
 * midpoint by `pan` CSS px, the scale by `zoom` in log units and the turn by
 * `turn` radians. */
function gesture({steps = 8, gap = 12, pan = [0, 0], zoom = 0, turn = 0, scale = TILE_PIXELS, angle = 0, t0 = 1000} = {}) {
  return Array.from({length: steps}, (_, i) => ({
    time: t0 + i * gap,
    mid: [100 + pan[0] * i, 200 + pan[1] * i],
    logScale: Math.log(scale) + zoom * i,
    angle: wrapAngle(angle + turn * i),
  }));
}
const endOf = samples => samples[samples.length - 1].time;
/** Runs a glide to a standstill at a fixed frame interval, returning every step. */
function runGlide(state, {ms = 1000 / 60, limit = 2000} = {}) {
  const out = [];
  for (let i = 0; i < limit && state.live; i++) out.push(advanceFling(state, ms / 1000));
  return out;
}

test('momentum: a release is measured over the last 100 ms, first sample to last', () => {
  // 10 CSS px every 10 ms is 1000 px/s, and the sample 150 ms back is outside
  // the window, so it cannot drag the estimate down.
  const samples = [{time: 0, mid: [0, 0]}, ...Array.from({length: 11}, (_, i) => ({time: 150 + 10 * i, mid: [10 * i, 0]}))];
  const v = estimateVelocity(samples, endOf(samples));
  assert.equal(Math.round(v.pan[0]), 1000);
  assert.equal(v.pan[1], 0);
  assert.equal(v.span, WINDOW_MS);
  // The estimate divides by the time from the first sample to the release, so a
  // hesitation before letting go damps the throw rather than being ignored.
  const paused = estimateVelocity(samples, endOf(samples) + 50);
  assert.ok(Math.abs(paused.pan[0] - 1000 * 100 / 150) < 1, `${paused.pan[0]}`);
  // And a release long after the last movement throws nothing at all.
  assert.deepEqual(estimateVelocity(samples, endOf(samples) + STALE_MS + 1), NO_THROW);
});

test('momentum: slow releases throw nothing and fast ones are capped', () => {
  const slow = gesture({pan: [MIN_PAN_SPEED * 0.012 * 0.9, 0]});
  assert.deepEqual(estimateVelocity(slow, endOf(slow)).pan, [0, 0]);
  const burst = gesture({gap: 0.2, pan: [40, 0]});
  const fast = estimateVelocity(burst, endOf(burst));
  assert.ok(Math.abs(Math.hypot(...fast.pan) - MAX_PAN_SPEED) < 1e-9, `${Math.hypot(...fast.pan)}`);
});

test('momentum: a zoom velocity is a factor a second, and a turn is measured the short way round', () => {
  // The scale doubles over 84 ms: ln 2 / 0.084 = 8.25 log units a second, capped.
  const spread = gesture({zoom: Math.log(2) / 7});
  const v = estimateVelocity(spread, endOf(spread));
  assert.equal(v.zoom, MAX_ZOOM_RATE);
  assert.equal(v.turn, 0);
  const easy = gesture({zoom: Math.log(1.15) / 7});
  const gentle = estimateVelocity(easy, endOf(easy));
  assert.ok(Math.abs(gentle.zoom - Math.log(1.15) / 0.084) < 1e-9, `${gentle.zoom}`);
  // Two fingers crossing the atan2 seam step the angle by a whole turn; the
  // short way round is the one that happened.
  const seam = gesture({steps: 8, turn: 2 * DEG, angle: Math.PI - 7 * DEG});
  assert.ok(seam.some(s => s.angle < 0) && seam.some(s => s.angle > 0), 'the samples cross the seam');
  const turned = estimateVelocity(seam, endOf(seam));
  assert.ok(Math.abs(turned.turn - 14 * DEG / 0.084) < 1e-9, `${turned.turn / DEG}°/s`);
  assert.equal(estimateVelocity(gesture({turn: 9 * DEG}), endOf(gesture({turn: 9 * DEG}))).turn, MAX_TURN_RATE);
});

test('momentum: a scale or a turn needs more than two frames of movement to be measured', () => {
  const burst = gesture({steps: 6, gap: MIN_SPAN_MS / 10, pan: [30, 0], zoom: 0.2, turn: 5 * DEG});
  const v = estimateVelocity(burst, endOf(burst));
  assert.equal(v.zoom, 0);
  assert.equal(v.turn, 0);
  assert.ok(Math.hypot(...v.pan) > 0);
  const real = gesture({steps: 3, gap: 16, zoom: 0.1});
  assert.ok(real[2].time - real[0].time >= MIN_SPAN_MS);
  assert.ok(estimateVelocity(real, endOf(real)).zoom > 0);
});

test('momentum: gains and floors — the wheel gets a gentler version of the same estimate', () => {
  const samples = gesture({zoom: Math.log(1.15) / 7, turn: 3 * DEG});
  const full = estimateVelocity(samples, endOf(samples));
  const gentle = estimateVelocity(samples, endOf(samples), {zoomGain: 0.3, turnGain: 0});
  assert.ok(Math.abs(gentle.zoom - 0.3 * full.zoom) < 1e-12);
  assert.equal(gentle.turn, 0);
  assert.deepEqual(estimateVelocity(samples.slice(0, 2), endOf(samples.slice(0, 2)), {minEvents: 3}), NO_THROW);
});

test('momentum: trimming keeps the window measured back from the newest sample', () => {
  const samples = Array.from({length: 20}, (_, i) => ({time: i * 10, mid: [i, 0]}));
  trimSamples(samples, WINDOW_MS);
  assert.equal(samples.length, 11);
  assert.equal(endOf(samples) - samples[0].time, WINDOW_MS);
  trimSamples(samples, 0);
  assert.equal(samples.length, 1, 'a zero window keeps the newest sample rather than emptying the list');
});

test('momentum: the one-finger pan fling is exactly what the sibling pages shipped', () => {
  // The code this page shipped before momentum, verbatim, against the module
  // that replaced it.
  const legacy = (samples, time) => {
    const first = samples[0], last = samples[samples.length - 1], dt = (time - first.time) / 1000;
    if (time - last.time < 80 && dt > 0) {
      const velocity = [(last.mid[0] - first.mid[0]) / dt, (last.mid[1] - first.mid[1]) / dt];
      const speed = Math.hypot(...velocity);
      if (speed > 60) { const cap = Math.min(1, 6000 / speed); return {velocity: [velocity[0] * cap, velocity[1] * cap]}; }
    }
    return null;
  };
  const legacySteps = (fling, dt) => {
    const out = [];
    while (fling) {
      const decay = Math.exp(-dt / 0.35), travel = 0.35 * (1 - decay);
      out.push([fling.velocity[0] * travel, fling.velocity[1] * travel]);
      fling.velocity = [fling.velocity[0] * decay, fling.velocity[1] * decay];
      if (Math.hypot(...fling.velocity) < 20) fling = null;
    }
    return out;
  };
  for (const pan of [[9, 0], [-14, 6], [40, -40], [0.9, 0]]) {
    const samples = gesture({pan});
    const at = endOf(samples) + 8;
    const was = legacy(samples.map(s => ({time: s.time, mid: s.mid})), at);
    const now = estimateVelocity(samples, at, {zoomGain: 0, turnGain: 0});
    if (!was) { assert.deepEqual(now.pan, [0, 0]); continue; }
    assert.deepEqual(now.pan, was.velocity);
    const state = createFling(now, {});
    const mine = runGlide(state).map(step => step.pan);
    const theirs = legacySteps(was, 1 / 60);
    assert.deepEqual(mine, theirs, `${pan}: ${mine.length} steps against ${theirs.length}`);
  }
});

test('momentum: a glide travels velocity × τ and settles', () => {
  const state = createFling({pan: [0, 0], zoom: 1.2, turn: 0}, {logScale: 0, snap: false});
  const steps = runGlide(state);
  const total = steps[steps.length - 1].logScale;
  assert.ok(Math.abs(total - 1.2 * ZOOM_TAU) < 0.02, `${total} against ${1.2 * ZOOM_TAU}`);
  assert.ok(Math.exp(total) > 1.28 && Math.exp(total) < 1.31, `${Math.exp(total)}×`);
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i].logScale > steps[i - 1].logScale);
  const deltas = steps.map((s, i) => s.logScale - (i ? steps[i - 1].logScale : 0));
  for (let i = 1; i < deltas.length; i++) assert.ok(deltas[i] < deltas[i - 1] + 1e-12, `step ${i} did not decelerate`);
  assert.ok(steps.length < 60, `${steps.length} frames`);
  assert.equal(steps[steps.length - 1].live, false);
});

test('momentum: the zoom is integrated multiplicatively, so it feels the same at every zoom', () => {
  const factors = [24, TILE_PIXELS, 4000].map(scale => {
    const state = createFling({pan: [0, 0], zoom: 0.9, turn: 0}, {logScale: Math.log(scale), logMax: Math.log(1e9), snap: false});
    const steps = runGlide(state);
    return Math.exp(steps[steps.length - 1].logScale) / scale;
  });
  for (const factor of factors) assert.ok(Math.abs(factor - factors[0]) < 1e-9, `${factors}`);
  assert.ok(factors[0] > 1.2 && factors[0] < 1.25, `${factors[0]}×`);
});

test('momentum: the glide is the same however the frames fall', () => {
  const one = createFling({pan: [900, -300], zoom: 0.8, turn: 1}, {logScale: 0, snap: false});
  const many = createFling({pan: [900, -300], zoom: 0.8, turn: 1}, {logScale: 0, snap: false});
  const a = advanceFling(one, 0.1);
  let pan = [0, 0];
  for (let i = 0; i < 10; i++) { const step = advanceFling(many, 0.01); pan = [pan[0] + step.pan[0], pan[1] + step.pan[1]]; }
  assert.ok(Math.abs(pan[0] - a.pan[0]) < 1e-9 && Math.abs(pan[1] - a.pan[1]) < 1e-9, `${pan} against ${a.pan}`);
  assert.ok(Math.abs(many.logScale - one.logScale) < 1e-9);
  assert.ok(Math.abs(many.angle - one.angle) < 1e-9);
  const stalled = createFling({pan: [6000, 0], zoom: 0, turn: 0}, {});
  const far = advanceFling(stalled, 30);
  assert.ok(far.pan[0] <= 6000 * PAN_TAU + 1e-9 && far.pan[0] > 6000 * PAN_TAU * (1 - Math.exp(-MAX_STEP / PAN_TAU)) - 1e-9, `${far.pan[0]}`);
});

test('momentum: pan, zoom and turn are one glide', () => {
  const state = createFling({pan: [1200, 400], zoom: 0.7, turn: 1.4}, {logScale: Math.log(TILE_PIXELS), logMax: Math.log(MAX_SCALE), snap: false});
  const steps = runGlide(state);
  const moving = steps.filter(s => s.pan[0] !== 0 && s.zoomMoved && s.turnMoved);
  assert.ok(moving.length > 10, `${moving.length} frames moved all three at once`);
  const alone = createFling({pan: [1200, 400], zoom: 0, turn: 0}, {});
  const solo = runGlide(alone).map(s => s.pan);
  assert.deepEqual(steps.slice(0, solo.length).map(s => s.pan), solo);
  assert.equal(state.live, false);
  assert.deepEqual(state.velocity, [0, 0]);
  assert.equal(state.zoomRate, 0);
  assert.equal(state.turnRate, 0);
});

test('momentum: a glide into a zoom limit gives a few percent and springs back', () => {
  const logMax = Math.log(MAX_SCALE);
  const state = createFling({pan: [0, 0], zoom: MAX_ZOOM_RATE, turn: 0}, {logScale: logMax - 0.05, logMax, snap: false});
  const steps = runGlide(state);
  const over = steps.map(s => s.logScale - logMax);
  const peak = Math.max(...over);
  assert.ok(peak > 0, 'the limit is passed, not hit');
  assert.ok(peak <= ELASTIC_GIVE + 1e-12, `${peak} is past the give`);
  assert.ok(peak > 0.5 * ELASTIC_GIVE, `a hard arrival should bottom out the give, not ${peak}`);
  assert.ok(Math.exp(peak) < 1.05, `${(100 * (Math.exp(peak) - 1)).toFixed(1)}% past the limit`);
  const top = over.indexOf(peak);
  for (let i = 1; i <= top; i++) assert.ok(over[i] >= over[i - 1] - 1e-12);
  for (let i = top + 1; i < over.length; i++) assert.ok(over[i] <= over[i - 1] + 1e-12);
  assert.equal(steps[steps.length - 1].logScale, logMax);
  assert.equal(steps[steps.length - 1].live, false);
  const elastic = over.length - over.findIndex(o => o > 0);
  assert.ok(elastic * 1000 / 60 < ELASTIC_MS + 2 * 1000 / 60, `${elastic} frames`);
  const gentle = createFling({pan: [0, 0], zoom: 0.31, turn: 0}, {logScale: logMax - 0.05, logMax, snap: false});
  const dent = Math.max(...runGlide(gentle).map(s => s.logScale - logMax));
  assert.ok(dent > 0 && dent < peak / 2, `${dent} against ${peak}`);
});

test('momentum: the elastic also holds at the bottom of the zoom range, and leaves nothing behind', () => {
  const logMin = Math.log(GRID_SIZE);
  const state = createFling({pan: [0, 0], zoom: -MAX_ZOOM_RATE, turn: 0}, {logScale: logMin + 0.02, logMin, logMax: Math.log(MAX_SCALE), snap: false});
  const steps = runGlide(state);
  const under = steps.map(s => logMin - s.logScale);
  assert.ok(Math.max(...under) > 0 && Math.max(...under) <= ELASTIC_GIVE + 1e-12);
  assert.equal(steps[steps.length - 1].logScale, logMin);
  assert.equal(elasticProfile(0), 0);
  assert.equal(elasticProfile(1), 0);
  assert.equal(elasticProfile(1.4), 0);
  const samples = Array.from({length: 1001}, (_, i) => elasticProfile(i / 1000));
  assert.ok(Math.max(...samples) <= 1 + 1e-12 && Math.max(...samples) > 0.999);
  for (const value of samples) assert.ok(value >= -1e-12);
});

test('momentum: a turn glide eases onto the nearest sixth when it comes to rest', () => {
  const state = createFling({pan: [0, 0], zoom: 0, turn: 0.88}, {angle: 50 * DEG});
  const steps = runGlide(state);
  const end = steps[steps.length - 1].angle;
  assert.ok(Math.abs(wrapAngle(end - 60 * DEG)) < 1e-12, `${end / DEG}°`);
  assert.equal(end, snapAngle(end));
  const angles = steps.map(s => s.angle / DEG);
  // The glide is *aimed* at the sixth rather than corrected onto it afterwards,
  // so it arrives from the side it was turning and never passes it.
  assert.ok(Math.max(...angles) <= 60 + 1e-9, `the glide overshot to ${Math.max(...angles).toFixed(2)}°`);
  assert.ok(angles.every((a, i) => i === 0 || a >= angles[i - 1] - 1e-12), 'and never turns back');
  assert.ok(Math.max(...angles) > 59, `but does reach it: ${Math.max(...angles).toFixed(2)}°`);
  for (let i = 1; i < steps.length; i++) assert.ok(Math.abs(steps[i].angle - steps[i - 1].angle) < 8 * DEG, 'no jump');
  const snapFrames = steps.length - steps.findIndex(s => s.angle === Math.max(...steps.map(t => t.angle)));
  assert.ok(snapFrames * 1000 / 60 < SNAP_MS + 3 * 1000 / 60, `${snapFrames} frames of ease`);
  const free = createFling({pan: [0, 0], zoom: 0, turn: 1.1}, {angle: 20 * DEG});
  const rest = runGlide(free);
  const stopped = rest[rest.length - 1].angle;
  assert.ok(Math.abs(wrapAngle(stopped - 60 * DEG)) > 4 * DEG, `${stopped / DEG}°`);
  assert.equal(stopped, snapAngle(stopped));
  const loose = createFling({pan: [0, 0], zoom: 0, turn: 1.1}, {angle: 50 * DEG, snap: false});
  const kept = runGlide(loose);
  assert.notEqual(kept[kept.length - 1].angle, 60 * DEG);
});

test('momentum: a thrown turn aims at a sixth, within the throw and never backwards', () => {
  // Where a throw would land, and the sixth it is re-aimed at. The correction
  // may be no more than half a sixth (the most it could ever be) and no more
  // than the throw itself, and the sixth must lie the way the fingers turned.
  const landing = (angle, rate) => angle + rate * TURN_TAU;
  assert.equal(TURN_CATCH, Math.PI / 6);
  // A 49° flick from 40° would stop at 89°, 29° short of a sixth: caught, and
  // the throw is shortened rather than left crooked. This is the browser
  // suite's own thrown turn, which used to settle at 89°.
  const rate = 49 * DEG / TURN_TAU;
  assert.ok(Math.abs(landing(40 * DEG, rate) - 89 * DEG) < 1e-9);
  assert.ok(Math.abs(turnTargetFor(40 * DEG, rate) - 60 * DEG) < 1e-9, `${turnTargetFor(40 * DEG, rate) / DEG}°`);
  const thrown = runGlide(createFling({pan: [0, 0], zoom: 0, turn: rate}, {angle: 40 * DEG}));
  assert.ok(Math.abs(wrapAngle(thrown[thrown.length - 1].angle - 60 * DEG)) < 1e-12, `${thrown[thrown.length - 1].angle / DEG}°`);
  // A throw too small to reach the sixth it is nearest is left alone: a nudge is
  // never amplified into a turn the fingers did not make.
  const small = 5 * DEG / TURN_TAU;
  assert.equal(turnTargetFor(30 * DEG, small), null, 'a 5° nudge 25° from a sixth is not dragged there');
  const restAngle = runGlide(createFling({pan: [0, 0], zoom: 0, turn: small}, {angle: 30 * DEG})).at(-1).angle;
  assert.ok(restAngle > 30 * DEG && restAngle <= landing(30 * DEG, small) + 1e-12, `it lands where it was thrown: ${restAngle / DEG}°`);
  assert.ok(landing(30 * DEG, small) - restAngle < 2 * DEG, 'to within the last degree the decay gives up');
  // Nor is one ever pulled back to a sixth behind where the fingers let go.
  assert.equal(turnTargetFor(62 * DEG, 4 * DEG / TURN_TAU), null, 'a forward flick never turns back to the sixth behind it');
  // Both directions, and the pull-past as well as the pull-up short.
  assert.ok(Math.abs(turnTargetFor(-40 * DEG, -rate) + 60 * DEG) < 1e-9, 'anticlockwise is caught the same way');
  const past = turnTargetFor(0, 35 * DEG / TURN_TAU);
  assert.ok(Math.abs(past - 60 * DEG) < 1e-9, `a 35° throw is carried the last 25° onto the sixth: ${past / DEG}°`);
  // The cap is half a sixth: a throw landing exactly between two of them is
  // moved at most 30°, and one landing on a sixth is not moved at all.
  assert.ok(Math.abs(turnTargetFor(0, 90 * DEG / TURN_TAU) - 120 * DEG) <= 30 * DEG + 1e-9);
  assert.equal(turnTargetFor(0, 0), null, 'a glide with no turn has nothing to aim');
  // And the aiming is off when the caller says so, for the wheel's turn burst
  // and for the tests that measure the raw decay.
  assert.equal(createFling({pan: [0, 0], zoom: 0, turn: rate}, {angle: 40 * DEG, snap: false}).turnTarget, null);
  assert.equal(createFling({pan: [0, 0], zoom: 0, turn: rate}, {angle: 40 * DEG}).thrownTurn, rate, 'what the fingers threw is kept as it was measured');
});

test('momentum: a glide the page cannot have is never started, and the pan stops as it always did', () => {
  assert.equal(createFling(NO_THROW, {}), null);
  assert.equal(createFling({pan: [0, 0], zoom: 0, turn: 0}, {}), null);
  const state = createFling({pan: [0, 0], zoom: 0, turn: 0.5}, {});
  assert.equal(state.zoomPhase, 'done', 'a channel with no velocity is not in the glide');
  assert.equal(state.turnPhase, 'glide');
  state.live = false;
  const step = advanceFling(state, 1 / 60);
  assert.deepEqual(step.pan, [0, 0]);
  assert.equal(step.live, false);
  assert.equal(advanceFling(null, 1 / 60).live, false);
  const panned = createFling({pan: [MIN_PAN_SPEED + 1, 0], zoom: 0, turn: 0}, {});
  const steps = runGlide(panned);
  assert.ok(steps.length > 0 && steps.length < 40);
  assert.deepEqual(panned.velocity, [0, 0]);
  const travelled = steps.reduce((sum, s) => sum + s.pan[0], 0);
  const whole = (MIN_PAN_SPEED + 1) * PAN_TAU;
  assert.ok(travelled < whole && travelled > whole * (1 - STOP_PAN / (MIN_PAN_SPEED + 1)) - 1, `${travelled} of ${whole}`);
  const turned = createFling({pan: [0, 0], zoom: 0, turn: MAX_TURN_RATE}, {angle: 0, snap: false});
  const turnSteps = runGlide(turned);
  assert.ok(Math.abs(turnSteps[turnSteps.length - 1].angle - MAX_TURN_RATE * TURN_TAU) < 0.03, `${turnSteps[turnSteps.length - 1].angle}`);
  assert.ok(MAX_TURN_RATE * TURN_TAU < Math.PI / 2, 'the hardest possible flick turns less than a quarter turn');
});
