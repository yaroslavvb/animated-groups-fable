// Trefoil: a three-colour rule whose colour group is S₃ — not cyclic — checked
// on the saved samples in exact integer arithmetic, on the continuum the shader
// draws, and through the shutter that integrates each displayed frame.
//
//     colour(x, t) = argmax over k in {0,1,2} of U(x + k b, t),   b = (1/3, 2/3),
//
// and the two laws the page is named for:
//
//     colour(x + b, t)    = colour(x, t) − 1   (mod 3)     purely spatial
//     colour(−x, t + T/2) = −colour(x, t)      (mod 3)     ENTANGLED
//
// The first is free — a non-cyclic colour group forces some recolouring to be
// purely spatial, so the 3-cycle can be read off a frozen screenshot. The second
// is the swap that fixes terracotta and exchanges teal and sand, and none of its
// three parts is a symmetry: not the half-turn at any centre with any
// recolouring, not half a period with any translation and any recolouring, and
// not the two of them without the swap. The last test group covers the viewer's
// inertia, which has no field in it at all.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {bicubic, BOUNDARY_SPEED, colourAt, createGovernor, cubicWeights, FALLBACK_INTERVAL, FIELD_BYTES, FIELD_SHA256, FRAMES, frameAt, framesAt, GRID_SIZE, HALF, halfTurn, LOOP_SECONDS, MAX_SCALE, MAX_TAA_LAYERS, MIN_SCALE, MOTIF_PIXELS, MOTION_PIXELS, NO_MOTION, OFFSET, OFFSET_NODES, offsetBy, PALETTE, patternMotion, scaleFor, SHUTTER, shutterOffsets, shutterPhases, SIXTH, SMEAR_PIXELS, snapAngle, SQRT3, TAA_LAYERS, THIRD, TILE_PIXELS, toPlane, turn120, turn240, uVolume, valuesAt, viewDelta, viewMotion, wrap, wrapAngle} from '../trefoil/renderer.mjs';
import {
  advanceFling, createFling, elasticProfile, ELASTIC_GIVE, ELASTIC_MS, estimateVelocity,
  MAX_PAN_SPEED, MAX_STEP, MAX_TURN_RATE, MAX_ZOOM_RATE, MIN_PAN_SPEED, MIN_SPAN_MS,
  NO_THROW, PAN_TAU, SNAP_MS, STALE_MS, STOP_PAN, trimSamples, TURN_CATCH, turnTargetFor, TURN_TAU, WINDOW_MS, ZOOM_TAU,
} from '../trefoil/momentum.mjs';

const N = GRID_SIZE, S = N * N;
const shipped = await readFile(new URL('../trefoil/field.f32', import.meta.url));
const planar = new Float32Array(shipped.buffer, shipped.byteOffset, shipped.byteLength / 4);
const U = uVolume(planar);
const mod = (value, n) => ((value % n) + n) % n;
/** The saved U sample at lattice node (x, y) in frame `t`. */
const at = (x, y, t) => U[mod(t, FRAMES) * S + mod(y, N) * N + mod(x, N)];
/** b on the saved nodes. 66 is divisible by 3, so b = (1/3, 2/3) is a whole
 * (22, 44) nodes and nothing below needs interpolation. */
const [BX, BY] = OFFSET_NODES;
/** The three values the colouring compares at a saved node, and the winner. */
const triple = (x, y, t) => [0, 1, 2].map(k => at(x + k * BX, y + k * BY, t));
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
/** The twelve point operations of the triangular lattice, in lattice
 * coordinates: six rotations and six mirrors. */
const OPS = {
  '1': [[1, 0], [0, 1]], R60: [[1, -1], [1, 0]], R120: [[0, -1], [1, -1]],
  R180: [[-1, 0], [0, -1]], R240: [[-1, 1], [-1, 0]], R300: [[0, 1], [-1, 1]],
  Ma: [[0, 1], [1, 0]], Mb: [[1, 0], [1, -1]], Mc: [[-1, 1], [0, 1]],
  Md: [[0, -1], [-1, 0]], Me: [[-1, 0], [-1, 1]], Mf: [[1, -1], [0, -1]],
};
const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
const IDENTITY = [0, 1, 2], MINUS = [2, 0, 1], PLUS = [1, 2, 0];
const SWAP12 = [0, 2, 1], SWAP02 = [2, 1, 0], SWAP01 = [1, 0, 2];
const ORIGIN = [0, 0];

test('the shipped field is the atlas orbit, byte for byte — the very file Gyre and Triskele paint', async () => {
  const source = await readFile(new URL('../p6/data/orbits/g247-diversity-q1-mixed-L512-F00406-F0p00406000-k0p02000000-L512-N66-M96.f32', import.meta.url));
  assert.deepEqual(shipped, source, 'field.f32 differs from the atlas orbit file');
  // The same bytes both sibling pages ship: one rule apart, not one field apart.
  assert.deepEqual(shipped, await readFile(new URL('../gyre/field.f32', import.meta.url)), 'field.f32 differs from ../gyre/field.f32');
  assert.deepEqual(shipped, await readFile(new URL('../triskele/field.f32', import.meta.url)), 'field.f32 differs from ../triskele/field.f32');
  assert.equal(createHash('sha256').update(shipped).digest('hex'), FIELD_SHA256);
  assert.equal(FIELD_SHA256, '8fcde9bc1178d93d9d92aae2387cd0dc864c37755dab0ce08a263f007056536c');
  assert.equal(shipped.byteLength, FIELD_BYTES);
  assert.equal(FIELD_BYTES, FRAMES * 2 * S * 4);
  // T/6, T/3 and T/2 are all whole numbers of saved frames, so every law below
  // is exact in time as well as in space.
  assert.deepEqual([SIXTH, THIRD, HALF], [16, 32, 48]);
});

test('the field carries a sixfold screw, bit-exactly, and that is the engine of the swap', () => {
  // U(R₆₀ⱼ x, t + (6−j)T/6) = U(x, t) for j = 1…5, with max|diff| exactly 0 on
  // the saved samples. The half-turn member of that family — U(−x, t + T/2) =
  // U(x, t) — is what reverses the list of three compared numbers and so turns
  // the colour cycle into a transposition.
  for (const [name, shift] of [['R60', 5 * SIXTH], ['R120', 4 * SIXTH], ['R180', 3 * SIXTH], ['R240', 2 * SIXTH], ['R300', SIXTH]]) {
    const [[a, b], [c, d]] = OPS[name];
    let worst = 0;
    for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      worst = Math.max(worst, Math.abs(at(a * x + b * y, c * x + d * y, t + shift) - at(x, y, t)));
    }
    assert.equal(worst, 0, `U(${name} x, t + ${shift}/${FRAMES}) = U(x, t) is not bit-exact`);
  }
});

test('b steps from one threefold centre to the next, and the turns act on the colours by ±1', () => {
  assert.deepEqual(OFFSET, [1 / 3, 2 / 3]);
  assert.deepEqual(OFFSET_NODES, [22, 44]);
  assert.equal(OFFSET_NODES[0], N / 3);
  // 3b = a₁ + 2a₂ is a lattice vector, so L′ = L + ℤb has index 3 and the three
  // sampled positions are one coset each.
  const three = offsetBy(offsetBy(offsetBy([0, 0])));
  for (const [i, want] of [[0, 1], [1, 2]]) assert.ok(Math.abs(three[i] - want) < 1e-15, `3b = ${three}`);
  // |b| = 1/√3 of a lattice length: the three samples are never close together,
  // so unlike ../gyre/ nothing collapses anywhere in the plane.
  const [px, py] = toPlane(OFFSET);
  assert.ok(Math.abs(Math.hypot(px, py) - 1 / SQRT3) < 1e-15, `|b| = ${Math.hypot(px, py)}`);
  // How each turn moves b modulo L is the whole of the colour action:
  // R₁₂₀ b ≡ +b (the colours are kept), R₁₈₀ b = −b (they are reversed).
  const times3 = ([u, v]) => [Math.round(3 * u), Math.round(3 * v)];
  const b3 = times3(OFFSET);
  const congruent = (image, sign) => image.every((value, i) => mod(value - sign * b3[i], 3) === 0);
  for (const [name, sign] of [['R60', -1], ['R120', 1], ['R180', -1], ['R240', 1], ['R300', -1]]) {
    const [[a, b], [c, d]] = OPS[name];
    assert.ok(congruent([a * b3[0] + b * b3[1], c * b3[0] + d * b3[1]], sign), `${name} b ≡ ${sign > 0 ? '+' : '−'}b (mod L)`);
  }
  // R₁₂₀ fixes this superlattice and permutes the other three index-3 ones
  // cyclically, which is why b = (1/3, 2/3) is the only choice that keeps the
  // threefold structure of the picture.
  const fixedByR120 = ([u, v]) => [1, 2].some(sign => mod(-v - sign * u, 3) === 0 && mod(u - v - sign * v, 3) === 0);
  assert.deepEqual([[1, 0], [0, 1], [1, 1], [1, 2]].map(fixedByR120), [false, false, false, true]);
  // And the turns are what they say they are.
  assert.deepEqual(turn120([5, -2]), [2, 7]);
  assert.deepEqual(turn240(turn120([5, -2])), [5, -2]);
  assert.deepEqual(halfTurn([5, -2]), [-5, 2]);
});

test('both laws hold at every one of the 418 176 node-frames, with no ties', () => {
  let cycleBreaks = 0, swapBreaks = 0, ties = 0;
  for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const here = colourAtNode(x, y, t);
    // colour(x + b, t) = colour(x, t) − 1, with no time shift at all.
    if (colourAtNode(x + BX, y + BY, t) !== mod(here - 1, 3)) cycleBreaks++;
    // colour(−x, t + T/2) = −colour(x, t): the swap that fixes 0 and exchanges
    // 1 and 2, and needs all three of the turn, the wait and the recolouring.
    if (colourAtNode(-x, -y, t + HALF) !== mod(-here, 3)) swapBreaks++;
    // A tie in the argmax would leave the labelling ambiguous; there are none.
    const sorted = triple(x, y, t).slice().sort((a, b) => b - a);
    if (sorted[0] === sorted[1]) ties++;
  }
  assert.equal(cycleBreaks, 0, `${cycleBreaks} of ${FRAMES * S} node-frames break the 3-cycle law`);
  assert.equal(swapBreaks, 0, `${swapBreaks} of ${FRAMES * S} node-frames break the entangled law`);
  assert.equal(ties, 0, 'no argmax anywhere is a tie');
  // The whole colour group, as generators: the translations by b and 2b cycle,
  // the three odd rotations swap, the two even ones keep the colours.
  assert.equal(agreement(OPS['1'], [BX, BY], 0, MINUS), 1, 'translation by b steps the colours back one');
  assert.equal(agreement(OPS['1'], [2 * BX % N, 2 * BY % N], 0, PLUS), 1, 'translation by 2b steps them forward');
  assert.equal(agreement(OPS.R180, ORIGIN, HALF, SWAP12), 1, 'the half-turn with T/2 swaps teal and sand');
  assert.equal(agreement(OPS.R60, ORIGIN, 5 * SIXTH, SWAP12), 1, 'and so do R60 with 5T/6');
  assert.equal(agreement(OPS.R300, ORIGIN, SIXTH, SWAP12), 1, 'and R300 with T/6');
  assert.equal(agreement(OPS.R120, ORIGIN, 2 * THIRD, IDENTITY), 1, 'R120 with 2T/3 keeps the colours');
  assert.equal(agreement(OPS.R240, ORIGIN, THIRD, IDENTITY), 1, 'R240 with T/3 keeps them too');
  // The swap about the threefold centre one b away exchanges the OTHER pair, so
  // no colour is globally privileged — only relative to a chosen centre.
  assert.equal(agreement(OPS.R180, [BX, BY], HALF, SWAP02), 1, 'about the next centre it is terracotta ↔ sand');
});

test('none of the three parts of the entangled law is a symmetry', () => {
  // All six relabellings of colour(−x, t + T/2) against colour(x, t): one is
  // the law, three are chance, and two agree nowhere at all.
  const relabelled = PERMS.map(perm => agreement(OPS.R180, ORIGIN, HALF, perm));
  assert.deepEqual(relabelled.map(v => v.toFixed(6)),
    ['0.333333', '1.000000', '0.000000', '0.333333', '0.333333', '0.000000'],
    'identity / (1 2) / (0 1) / +1 / −1 / (0 2)');
  // Take away the recolouring: exactly chance, 1/3. Take the wrong swap: zero.
  assert.equal(agreement(OPS.R180, ORIGIN, HALF, IDENTITY).toFixed(6), '0.333333');
  assert.equal(agreement(OPS.R180, ORIGIN, HALF, PLUS).toFixed(6), '0.333333');
  assert.equal(agreement(OPS.R180, ORIGIN, HALF, MINUS).toFixed(6), '0.333333');
  assert.equal(agreement(OPS.R180, ORIGIN, HALF, SWAP01), 0, 'the swap (0 1) agrees nowhere');
  assert.equal(agreement(OPS.R180, ORIGIN, HALF, SWAP02), 0, 'nor does (0 2)');
  // Take away the wait: 0.494447 at best over all six relabellings. Take away
  // the turn instead and it is the same number, for the same reason the two
  // halves of ../gyre/'s law are: colour(−x, t) = −colour(x, t − T/2) puts the
  // two statistics in bijection, so the halves stand or fall together.
  const turnAlone = PERMS.map(perm => agreement(OPS.R180, ORIGIN, 0, perm));
  const waitAlone = PERMS.map(perm => agreement(OPS['1'], ORIGIN, HALF, perm));
  assert.deepEqual(turnAlone.map(v => v.toFixed(6)), ['0.333333', '0.011105', '0.494447', '0.333333', '0.333333', '0.494447']);
  assert.deepEqual(waitAlone.map(v => v.toFixed(6)), ['0.011105', '0.333333', '0.333333', '0.494447', '0.494447', '0.333333']);
  assert.equal(Math.max(...turnAlone).toFixed(6), '0.494447');
  assert.equal(Math.max(...waitAlone).toFixed(6), '0.494447');
  // Waiting alone does nothing at any of the six sixths of the period, either:
  // the recolourings reachable by waiting form the trivial group here.
  for (const [shift, best] of [[SIXTH, '0.540375'], [2 * SIXTH, '0.415397'], [3 * SIXTH, '0.494447'], [4 * SIXTH, '0.415397'], [5 * SIXTH, '0.540375']]) {
    assert.equal(Math.max(...PERMS.map(perm => agreement(OPS['1'], ORIGIN, shift, perm))).toFixed(6), best, `a pure shift of ${shift}/96`);
  }
});

test('the 3-cycle is purely spatial — which a non-cyclic colour group forces', () => {
  // Corollary B of the theorem in the README: the time shift is a homomorphism
  // (there is no time reversal), so it induces a map from the colour group onto
  // a finite subgroup of a circle, which is cyclic. A non-cyclic colour group
  // therefore cannot have every recolouring entangled — its commutator
  // subgroup, here A₃, is realised with no time shift at all. And it is:
  assert.equal(agreement(OPS['1'], [BX, BY], 0, MINUS), 1, 'translation by b, no time shift, cycles the colours');
  // Seen from the other side: the same translation with any other relabelling
  // agrees nowhere or by chance, so the 3-cycle it realises is exactly one.
  assert.deepEqual(PERMS.map(perm => agreement(OPS['1'], [BX, BY], 0, perm)).map(v => v.toFixed(6)),
    ['0.000000', '0.333333', '0.333333', '0.000000', '1.000000', '0.333333']);
  // The transpositions are the entangled ones, and the measurement below says
  // no cleverness can remove their time shift.
});

test('no other operation of the lattice maps the picture to itself', () => {
  // Exhaustive: all 12 point operations of the triangular lattice × all 4 356
  // lattice translations × all 96 time shifts × all 6 colour permutations =
  // 30 108 672 combinations, each tested for exactness (and abandoned at its
  // first disagreeing node, which is what makes the sweep cheap).
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
  // Exactly eighteen: six rotations × three translation cosets {0, b, 2b}, and
  // no mirror. All six colour permutations occur, so the colour group is the
  // whole of S₃.
  assert.deepEqual(found.sort(), [
    '1 v=(0,0) time 0/96 colour 012',
    '1 v=(22,44) time 0/96 colour 201',
    '1 v=(44,22) time 0/96 colour 120',
    'R120 v=(0,0) time 64/96 colour 012',
    'R120 v=(22,44) time 64/96 colour 201',
    'R120 v=(44,22) time 64/96 colour 120',
    'R180 v=(0,0) time 48/96 colour 021',
    'R180 v=(22,44) time 48/96 colour 210',
    'R180 v=(44,22) time 48/96 colour 102',
    'R240 v=(0,0) time 32/96 colour 012',
    'R240 v=(22,44) time 32/96 colour 201',
    'R240 v=(44,22) time 32/96 colour 120',
    'R300 v=(0,0) time 16/96 colour 021',
    'R300 v=(22,44) time 16/96 colour 210',
    'R300 v=(44,22) time 16/96 colour 102',
    'R60 v=(0,0) time 80/96 colour 021',
    'R60 v=(22,44) time 80/96 colour 210',
    'R60 v=(44,22) time 80/96 colour 102',
  ]);
  const realised = new Set(found.map(row => row.slice(-3)));
  assert.equal(realised.size, 6, 'all six colour permutations occur: the colour group is S₃');
  // The colour-preserving subgroup is {1 @ 0, R₂₄₀ @ T/3, R₁₂₀ @ 2T/3} together
  // with the coarse lattice L — p3 with the 3₁ screw, the catalogue's g225,
  // which is byte for byte ../gyre/'s own film group. The full film group is p6
  // with the 6₅ screw, g247, on the finer lattice L′ = L + ℤb; the index is
  // 6 = 2 (point) × 3 (translation), and 1/6 of it keeps the colours.
  assert.deepEqual(found.filter(row => row.endsWith('012')).sort(), [
    '1 v=(0,0) time 0/96 colour 012',
    'R120 v=(0,0) time 64/96 colour 012',
    'R240 v=(0,0) time 32/96 colour 012',
  ]);
  assert.equal(found.filter(row => row.startsWith('M')).length, 0, 'no mirror survives: the field is chiral');
  assert.equal(found.length / found.filter(row => row.endsWith('012')).length, 6, 'index 6');
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

test('the theorem, measured: no transposition is ever available without a time shift', () => {
  const SWAPS = [1, 2, 5]; // the indices of (1 2), (0 1), (0 2) in PERMS
  const exact = [], top = {};
  const describe = (name, vx, vy, shift, perm) => `${name} v=(${vx},${vy}) time ${shift}/${FRAMES} colour ${PERMS[perm].join('')}`;
  for (const [name, matrix] of Object.entries(OPS)) {
    const value = agreementsFor(matrix);
    const mirror = name.startsWith('M');
    const best = (key, v, vx, vy, shift, perm) => { if (!top[key] || v > top[key][0]) top[key] = [v, describe(name, vx, vy, shift, perm)]; };
    for (let shift = 0; shift < FRAMES; shift++) for (let vy = 0; vy < N; vy++) for (let vx = 0; vx < N; vx++) {
      for (let perm = 0; perm < 6; perm++) {
        const here = value(vx, vy, shift, perm);
        if (here > 1 - 1e-9) { exact.push(describe(name, vx, vy, shift, perm)); continue; }
        best('any', here, vx, vy, shift, perm);
        if (mirror) best('mirror', here, vx, vy, shift, perm);
        // Γ = Θ(H) = (T/3)ℤ is the set of time shifts the colour-preserving
        // subgroup can absorb; a transposition realised with a shift in Γ would
        // be a transposition realised with no shift at all.
        if (SWAPS.includes(perm) && (shift === 0 || shift === THIRD || shift === 2 * THIRD)) best('swap-in-gamma', here, vx, vy, shift, perm);
        if (SWAPS.includes(perm) && shift === 0) best('swap-now', here, vx, vy, shift, perm);
        if (name !== '1' && shift === 0) best('rotation-now', here, vx, vy, shift, perm);
        if (name === 'R180' && shift === HALF) best('half-turn-elsewhere', here, vx, vy, shift, perm);
      }
    }
  }
  // The same eighteen symmetries the brute-force sweep found, by a method that
  // shares nothing with it but the colours themselves.
  assert.equal(exact.length, 18);
  assert.deepEqual(exact.sort().slice(0, 3), ['1 v=(0,0) time 0/96 colour 012', '1 v=(22,44) time 0/96 colour 201', '1 v=(44,22) time 0/96 colour 120']);
  // THE claim of the page, at the strongest strength available: searching all
  // 12 point operations, all 4 356 node translations (by (i/66) a₁ + (j/66) a₂,
  // since a whole lattice vector acts trivially on the stored torus) and every time shift
  // the colour-preserving subgroup could absorb, nothing realises a colour
  // transposition better than 54 %. The entanglement of the swap is forced by
  // group theory, not by a lucky field.
  assert.equal(top['swap-now'][0].toFixed(6), '0.540375', top['swap-now'][1]);
  assert.equal(top['swap-in-gamma'][0].toFixed(6), '0.540375', top['swap-in-gamma'][1]);
  assert.equal(top['rotation-now'][0].toFixed(6), '0.540375', top['rotation-now'][1]);
  // That 0.540375 is the field's own T/6 relation seen sideways: R₆₀ alone with
  // the swap says the same thing as a pure T/6 shift with the colours kept,
  // since colour(R₆₀ x, t) = −colour(x, t + T/6).
  const identityOp = agreementsFor(OPS['1']);
  assert.equal(identityOp(0, 0, SIXTH, 0).toFixed(6), '0.540375');
  // No mirror survives anywhere, at any centre, shift or relabelling: the field
  // is chiral, and this construction cannot manufacture a mirror.
  assert.equal(top.mirror[0].toFixed(6), '0.477531', top.mirror[1]);
  // The honest form of the exactness claim: the law is not isolated. Move the
  // half-turn centre half a node and 89.9 % of the picture still agrees, and
  // the nearest miss of all is the identity one saved frame off — one frame in
  // 96 changes the picture by 3 %, so any exact symmetry composed with it keeps
  // 97 %. Which is why the table's test is exactness, never agreement.
  assert.equal(top['half-turn-elsewhere'][0].toFixed(6), '0.898703', top['half-turn-elsewhere'][1]);
  assert.equal(top.any[0].toFixed(6), '0.969310', top.any[1]);
  assert.equal(top.any[1], '1 v=(0,0) time 1/96 colour 012');
  // The correlation agrees with the direct count wherever it is asked.
  const value = agreementsFor(OPS.R180);
  for (const [vx, vy, shift, perm] of [[0, 0, HALF, 1], [0, 0, HALF, 0], [22, 44, HALF, 5], [13, 7, 30, 3], [61, 2, 5, 2]]) {
    assert.ok(Math.abs(value(vx, vy, shift, perm) - agreement(OPS.R180, [vx, vy], shift, PERMS[perm])) < 1e-9,
      `the correlation and the direct count agree at v=(${vx},${vy}) shift ${shift} perm ${PERMS[perm]}`);
  }
});

test('each colour owns exactly a third of every single frame', () => {
  const counts = [0, 0, 0];
  let low = 1, high = 0;
  for (let t = 0; t < FRAMES; t++) {
    const frame = [0, 0, 0];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) frame[colourAtNode(x, y, t)]++;
    for (let k = 0; k < 3; k++) { counts[k] += frame[k]; low = Math.min(low, frame[k] / S); high = Math.max(high, frame[k] / S); }
  }
  // Translation by b is an area-preserving bijection of the plane at a FIXED
  // instant that carries the region of each colour onto the next, so the shares
  // are equal in every frame — not merely over the loop, as on ../gyre/, whose
  // per-frame shares range over [0.3124, 0.3506]. This exactness is a dividend
  // of the theorem: the spatial 3-cycle a non-cyclic colour group forces on us
  // is precisely what balances each frame.
  assert.deepEqual(counts, [FRAMES * S / 3, FRAMES * S / 3, FRAMES * S / 3]);
  assert.deepEqual(counts, [139392, 139392, 139392]);
  assert.equal(low, 1 / 3);
  assert.equal(high, 1 / 3);
  // And on the continuum the viewer actually draws: a fine sweep of one repeat.
  const plane = frameAt(U, 0.137);
  const sweep = [0, 0, 0], steps = 240;
  for (let j = 0; j < steps; j++) for (let i = 0; i < steps; i++) sweep[colourAt(plane, [(i + 0.5) / steps, (j + 0.5) / steps])]++;
  for (const count of sweep) assert.ok(Math.abs(count / (steps * steps) - 1 / 3) < 0.01, `colour areas ${sweep.map(c => (c / (steps * steps)).toFixed(4))}`);
});

test('at the half-turn centre the law is left with nothing but the swap', () => {
  // The half-turn fixes the origin, so there the law says only
  // colour(0, t + T/2) = −colour(0, t). Colour 0 is the fixed point of that
  // swap, so if the origin were ever terracotta it would be terracotta for
  // ever — and it never is. It alternates teal and sand instead, three times a
  // loop: six changes, one every T/6, which is the period T/3 the third row
  // below asserts.
  const sequence = Array.from({length: 12}, (_, k) => colourAt(frameAt(U, k / 12), ORIGIN));
  assert.deepEqual(sequence, [1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1]);
  assert.ok(!sequence.includes(0), 'the origin is never terracotta');
  const fine = Array.from({length: 48}, (_, k) => colourAt(frameAt(U, k / 48), ORIGIN));
  for (let k = 0; k < 48; k++) {
    assert.equal(mod(fine[(k + 24) % 48] + fine[k], 3), 0, `phase ${k}/48: c(0, t + T/2) = −c(0, t)`);
    assert.equal(fine[(k + 16) % 48], fine[k], `phase ${k}/48: c(0, t + T/3) = c(0, t)`);
  }
  // And, unlike ../gyre/, there is no degenerate neighbourhood anywhere: the
  // three samples stay |b| = 1/√3 apart everywhere in the plane, so the colour
  // is not flat around the centre — the picture has no disc that moves faster
  // than the rest of it.
  const plane = frameAt(U, 0.1);
  for (const radius of [0.02, 0.05]) {
    const seen = new Set(Array.from({length: 12}, (_, j) => {
      const angle = j * Math.PI / 6;
      return colourAt(plane, [radius * Math.cos(angle), radius * Math.sin(angle)]);
    }));
    assert.ok(seen.size > 1, `the ring of radius ${radius} about the centre shows more than one colour`);
  }
});

test('the reconstruction the shader uses carries both headline laws off the nodes', () => {
  // b is a whole number of nodes, so plain Catmull–Rom is translation-exact;
  // the kernel is even in each coordinate, so it is point-reflection-exact as
  // well. Both laws therefore survive the interpolation to double round-off —
  // no symmetrised kernel is needed, unlike ../triskele/.
  let worstCycle = 0, worstSwap = 0, cycleBreaks = 0, swapBreaks = 0, checked = 0;
  let seed = 7;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (const phase of [0, 0.017, 0.123, 0.5, 0.77, 0.9999]) {
    const here = frameAt(U, phase), later = frameAt(U, phase + 0.5);
    for (let i = 0; i < 400; i++) {
      const point = [random() * 6 - 3, random() * 6 - 3];
      const a = valuesAt(here, point);
      const cycled = valuesAt(here, offsetBy(point));
      for (let k = 0; k < 3; k++) worstCycle = Math.max(worstCycle, Math.abs(cycled[k] - a[(k + 1) % 3]));
      if (colourAt(here, offsetBy(point)) !== mod(colourAt(here, point) - 1, 3)) cycleBreaks++;
      const swapped = valuesAt(later, halfTurn(point));
      for (let k = 0; k < 3; k++) worstSwap = Math.max(worstSwap, Math.abs(swapped[k] - a[mod(-k, 3)]));
      if (colourAt(later, halfTurn(point)) !== mod(-colourAt(here, point), 3)) swapBreaks++;
      checked++;
    }
  }
  assert.equal(cycleBreaks, 0, `${cycleBreaks} of ${checked} interpolated points break the 3-cycle law`);
  assert.equal(swapBreaks, 0, `${swapBreaks} of ${checked} interpolated points break the entangled law`);
  assert.ok(worstCycle < 1e-12, `the two sides of the 3-cycle law agree to ${worstCycle.toExponential(2)}`);
  assert.ok(worstSwap < 1e-12, `the two sides of the entangled law agree to ${worstSwap.toExponential(2)}`);
  // The threefold laws are exact on the saved nodes but only approximate
  // between them, because a tensor-product kernel is not invariant under a 120°
  // turn. The error is 1.8e−4 — 0.55 % of the field's standard deviation, about
  // a fifth of one 8-bit level, which displaces a boundary by a fraction of a
  // device pixel. That is the reason this page ships plain Catmull–Rom instead
  // of paying three times the fetches for a symmetrised kernel.
  let worstTurn = 0;
  for (const phase of [0, 0.123, 0.77]) {
    const here = frameAt(U, phase), later = frameAt(U, phase + 2 / 3);
    for (let i = 0; i < 400; i++) {
      const point = [random() * 6 - 3, random() * 6 - 3];
      const a = valuesAt(here, point), b = valuesAt(later, turn120(point));
      for (let k = 0; k < 3; k++) worstTurn = Math.max(worstTurn, Math.abs(b[k] - a[k]));
    }
  }
  assert.ok(worstTurn > 1e-6 && worstTurn < 5e-4, `the threefold law off the nodes: ${worstTurn.toExponential(2)}`);
  // Value k is the field at x + k b, and nothing else: three positions, one
  // instant, which is exactly what the fragment shader's `weights` does.
  const plane = frameAt(U, 0.4275);
  for (const point of [[0.31, 0.12], [0.8, 0.47], [0.02, 0.93], ORIGIN]) {
    const values = valuesAt(plane, point);
    let q = point;
    for (let k = 0; k < 3; k++) { assert.equal(values[k], bicubic(plane, q)); q = offsetBy(q); }
  }
  assert.ok(Math.max(...valuesAt(plane, [0.31, 0.12])) - Math.min(...valuesAt(plane, [0.31, 0.12])) > 1e-4, 'the three values are genuinely different');
});

test('the texture is the field at one instant, and half a period turns it over exactly', () => {
  const phase = 0.4275, plane = frameAt(U, phase);
  assert.equal(plane.length, S, 'one number per node — the rule reads a single instant');
  const t = wrap(phase) * FRAMES, k = Math.floor(t), w = cubicWeights(t - k);
  for (const i of [0, 1, 1000, S - 1]) {
    let expected = 0;
    for (let j = 0; j < 4; j++) expected += w[j] * U[mod(k + j - 1, FRAMES) * S + i];
    assert.ok(Math.abs(plane[i] - expected) < 1e-7, `node ${i}: ${plane[i]} against ${expected}`);
  }
  // T/2 is a whole 48 saved frames, so the blend at φ + 1/2 uses the same four
  // weights on the four frames half a period later — and the field's own
  // half-period half-turn is bit-exact on those, so the turned-over plane is
  // bit-identical to this one. That is why the entangled law needs no tolerance
  // in time either.
  const later = frameAt(U, phase + 0.5);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    assert.equal(later[mod(-y, N) * N + mod(-x, N)], plane[y * N + x], `node (${x}, ${y})`);
  }
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
    for (const [j, p] of phases.entries()) assert.deepEqual([...volume.subarray(j * S, (j + 1) * S)], [...frameAt(U, p)]);
  }
  assert.ok(Math.abs(FALLBACK_INTERVAL / (1000 * LOOP_SECONDS) - 1 / 480) < 1e-9, 'one 60 Hz frame is a 480th of the loop');

  // Both laws hold per sub-phase, so the shutter cannot perturb the symmetry: it
  // averages three pictures each of which obeys them.
  for (const phase of shutterPhases(0.137, TAA_LAYERS)) {
    const here = frameAt(U, phase), later = frameAt(U, phase + 0.5);
    for (const point of [[0.21, 0.63], [0.77, 0.08], [0.02, 0.44]]) {
      assert.equal(colourAt(here, offsetBy(point)), mod(colourAt(here, point) - 1, 3), `the 3-cycle at sub-phase ${phase}`);
      assert.equal(colourAt(later, halfTurn(point)), mod(-colourAt(here, point), 3), `the swap at sub-phase ${phase}`);
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
  const distance = ([u, v]) => Math.hypot(...toPlane([u, v]));
  for (const step of EDGES) assert.ok(Math.abs(distance(step) - 1) < 1e-12, `${step} is a lattice edge`);
  assert.ok(Math.abs(distance([1, -1]) - SQRT3) < 1e-12, '(1, −1) is a second neighbour, not an edge');
  // The two siblings' colourings of the same field, for comparison: Triskele's
  // argmax_k U(R^k x, t) with no time shift at all, and Gyre's
  // argmax_k U(g^k x, t + k T/3) about a point that is a symmetry centre of
  // nothing.
  const build = value => {
    const out = new Int8Array(FRAMES * S);
    for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const [a, b, c] = value(x, y, t);
      out[t * S + y * N + x] = a >= b && a >= c ? 0 : b >= c ? 1 : 2;
    }
    return out;
  };
  const triskele = build((x, y, t) => {
    const values = [];
    let p = [x, y];
    for (let k = 0; k < 3; k++) { values.push(at(p[0], p[1], t)); p = turn120(p); }
    return values;
  });
  const gyre = build((x, y, t) => {
    const values = [];
    let p = [x, y];
    for (let k = 0; k < 3; k++) { values.push(at(p[0], p[1], t + k * THIRD)); p = [p[1] - p[0], -p[0] + 11]; }
    return values;
  });
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
  const mine = measure(colours), tri = measure(triskele), gy = measure(gyre);
  assert.equal(mine.boundary.toFixed(4), '0.1013', 'boundary density over lattice edges');
  assert.equal(gy.boundary.toFixed(4), '0.1037', "Gyre's colouring of the same field");
  assert.equal(tri.boundary.toFixed(4), '0.1076', "Triskele's colouring of the same field");
  assert.ok(mine.boundary < gy.boundary && mine.boundary < tri.boundary, 'this page paints the chunkiest of the three colourings');
  assert.equal(mine.speckle.toExponential(1), '8.6e-5', 'nodes disagreeing with all six neighbours');
  assert.equal(mine.changes.toFixed(3), '2.946', 'colour changes per node per period');
  // Those two together are the speed of the picture: 2.946 crossings a period
  // over 66 × 0.1013 = 6.69 boundaries per lattice length. That is the constant
  // the renderer turns into an on-screen speed when it decides whether the
  // shutter is worth paying for.
  const speed = mine.changes / (N * mine.boundary);
  assert.equal(speed.toFixed(3), '0.441', 'lattice lengths per period');
  assert.ok(Math.abs(speed - BOUNDARY_SPEED) < 0.01, `BOUNDARY_SPEED = ${BOUNDARY_SPEED} against the measured ${speed.toFixed(3)}`);
  // Decisiveness: the winner leads the runner-up by about one standard
  // deviation of the field, so boundaries are sharp rather than marginal.
  let lead = 0;
  for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const sorted = triple(x, y, t).sort((a, b) => b - a);
    lead += sorted[0] - sorted[1];
  }
  let total = 0, totalSquare = 0;
  for (let i = 0; i < U.length; i++) { total += U[i]; totalSquare += U[i] * U[i]; }
  const sd = Math.sqrt(totalSquare / U.length - (total / U.length) ** 2);
  assert.equal((lead / (FRAMES * S) / sd).toFixed(3), '0.973', 'mean winner-minus-runner-up over the field’s standard deviation');
  // And it is genuinely a different picture from both siblings, not a
  // relabelling of either: the best of the six relabellings still misses.
  const bestAgainst = other => Math.max(...PERMS.map(perm => {
    let same = 0;
    for (let i = 0; i < colours.length; i++) if (perm[other[i]] === colours[i]) same++;
    return same / colours.length;
  }));
  assert.equal(bestAgainst(gyre).toFixed(4), '0.5691', "best agreement with Gyre's colouring of the same field");
  assert.equal(bestAgainst(triskele).toFixed(4), '0.5273', "best agreement with Triskele's colouring of the same field");
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
  const slower = run({shuttered: 60, plain: 40});
  assert.equal(slower.shutter, false);
  assert.ok(slower.quality < 1, `the resolution follows when the shutter is not enough (quality ${slower.quality.toFixed(3)})`);
  const fast = run({shuttered: 5, plain: 2});
  assert.deepEqual([fast.shutter, fast.quality, fast.switches, fast.late], [true, 1, 0, 0]);
  // The climb-back must not offer a quality level already measured as too slow,
  // or the two sides of a cost step alternate for ever.
  const governor = createGovernor({display: 1000 / 60});
  let now = 0;
  const feed = (interval, windows) => { for (let i = 0; i < windows * 46; i++) { now += interval; governor.tick(now, true, false); } };
  feed(1000 / 60, 1);
  assert.equal(governor.quality, 1);
  feed(33, 1);
  assert.ok(governor.quality < 1, `the resolution drops (quality ${governor.quality})`);
  const dropped = governor.quality;
  feed(1000 / 60, 8);
  assert.equal(governor.quality, dropped, 'it does not climb back into the level it measured as late');
  feed(1000 / 60, 20);
  assert.equal(governor.quality, 1, 'and it does try again later');
});

test('the shutter is spent only where the picture actually moves', () => {
  for (const layers of [1, 2, 3, 5]) {
    const offsets = shutterOffsets(layers, SHUTTER);
    assert.equal(offsets.length, layers);
    assert.ok(Math.abs(offsets.reduce((a, b) => a + b, 0)) < 1e-15, `centred: ${offsets}`);
    assert.ok(Math.max(...offsets.map(Math.abs)) <= SHUTTER / 2 + 1e-15, 'inside the shutter');
  }
  assert.deepEqual(shutterOffsets(1, SHUTTER), [0], 'one sub-sample is the frame itself');
  for (const [j, offset] of shutterOffsets(3, 1).entries()) assert.ok(Math.abs(offset - (j - 1) / 3) < 1e-15, `thirds of a frame apart: ${offset}`);
  for (const offset of shutterOffsets(3, 0)) assert.equal(Math.abs(offset), 0, 'a zero-width shutter samples one instant three times');
  // A view step is the shorter way round the periodic plane, so a pan across
  // the wrap is the small step it looks like and not a jump of a whole repeat.
  const still = {center: [0.2, 0.3], scale: TILE_PIXELS, angle: 0};
  assert.deepEqual(viewDelta(still, still), {center: [0, 0], zoom: 0, angle: 0});
  const wrapped = viewDelta({center: [0.98, 0.5], scale: 380, angle: 0}, {center: [0.02, 0.5], scale: 380, angle: 0});
  assert.ok(Math.abs(wrapped.center[0] - 0.04) < 1e-12, `a pan across the wrap reads ${wrapped.center[0]}`);
  const zoomed = viewDelta(still, {center: [0.2, 0.3], scale: TILE_PIXELS * 1.05, angle: 0.02});
  assert.ok(Math.abs(zoomed.zoom - Math.log(1.05)) < 1e-12 && Math.abs(zoomed.angle - 0.02) < 1e-12);
  assert.equal(viewMotion({center: [1, 0], zoom: 0, angle: 0}, 380, 1000, 600), 380);
  assert.ok(viewMotion({center: [0, 0], zoom: 0, angle: 0.01}, 380, 1000, 600) > 0, 'a turn moves the corners');
  assert.equal(viewMotion(NO_MOTION, 380, 1000, 600), 0);
  // The pattern's own motion: at the home framing it is 0.6 of a pixel a frame,
  // which is why the shutter stays off there. The gate is on the SMEAR the
  // shutter would draw — travel × shutter — so the travel it takes to engage is
  // motion / shutter: 2.5 px a frame at the shipped 0.3 shutter, which the
  // pattern reaches at about 2730 CSS px per lattice length (1575 px per
  // motif), and 0.75 px a frame with ?shutter=1, which it reaches at 818.
  const gateScale = shutter => MOTION_PIXELS / (shutter * BOUNDARY_SPEED * FALLBACK_INTERVAL / (1000 * LOOP_SECONDS));
  assert.equal(patternMotion(TILE_PIXELS, FALLBACK_INTERVAL).toFixed(3), '0.603');
  assert.ok(patternMotion(TILE_PIXELS, FALLBACK_INTERVAL) * SHUTTER < MOTION_PIXELS, 'the home framing does not pay for a shutter');
  assert.ok(patternMotion(gateScale(SHUTTER) * 1.01, FALLBACK_INTERVAL) * SHUTTER > MOTION_PIXELS, 'a zoomed-in framing does');
  assert.equal((MOTION_PIXELS / SHUTTER).toFixed(2), '2.50', 'the shipped shutter asks for 2.5 CSS px of travel a frame');
  assert.equal(gateScale(SHUTTER).toFixed(0), '2727', 'which the pattern reaches at 2730 CSS px per lattice length');
  assert.equal((gateScale(SHUTTER) / SQRT3).toFixed(0), '1575', 'or 1575 px per motif — inside the zoom range');
  assert.equal(gateScale(1).toFixed(0), '818', 'and the full box filter engages at 818, as on the sibling pages');
  assert.ok(gateScale(SHUTTER) < MAX_SCALE, 'the pattern engages the shutter by itself before the zoom limit');
  assert.equal(MOTION_PIXELS, 0.75);
  // The other end: the view's smear is integrated over at most SMEAR_PIXELS per
  // sub-sample, so a hard fling stays a blur instead of becoming a comb.
  assert.equal(SMEAR_PIXELS, 6);
  assert.ok(SMEAR_PIXELS * TAA_LAYERS > patternMotion(MAX_SCALE, FALLBACK_INTERVAL) * SHUTTER,
    'the pattern’s own motion never reaches that width, even at the deepest zoom, so the cap bounds panning only');
});

test('the home framing puts one motif across 380 CSS pixels, and turns snap to sixths', () => {
  // `scale` counts CSS pixels per lattice length of the COARSE lattice L, as on
  // every sibling page — but what the eye reads as the motif is the finer
  // lattice L′ = L + ℤb, which is 1/√3 as long. So the home framing is
  // 380 × √3 px per lattice length, and the motif measures the same 380 px the
  // siblings use.
  assert.equal(MOTIF_PIXELS, 380);
  assert.ok(Math.abs(TILE_PIXELS - 380 * SQRT3) < 1e-12);
  assert.ok(Math.abs(TILE_PIXELS - 658.1794) < 1e-3, `${TILE_PIXELS}`);
  assert.equal(scaleFor(1440, 900), TILE_PIXELS, 'a desktop window shows the home scale');
  assert.ok(Math.abs(scaleFor(390, 844) / SQRT3 - 195) < 1e-9, 'a phone keeps two motifs across its short side');
  assert.ok(MIN_SCALE < TILE_PIXELS && TILE_PIXELS < MAX_SCALE);
  const degrees = angle => Math.round(snapAngle(angle * Math.PI / 180) * 180 / Math.PI);
  assert.equal(degrees(58), 60);
  assert.equal(degrees(62), 60);
  assert.equal(degrees(53), 53);
  assert.equal(degrees(119), 120);
  assert.equal(degrees(-61), -60);
  assert.equal(degrees(2), 0);
  assert.equal(degrees(89), 89, 'a quarter turn is not a lattice symmetry here');
  // Here the snap is the picture's own symmetry and not merely the lattice's:
  // all six rotations about the origin are symmetries of the coloured picture,
  // three keeping the colours and three swapping a pair.
  assert.deepEqual(PALETTE, ['#c9563e', '#57979a', '#e2be68']);
});

test('the page announces itself as Trefoil and links its own assets', async () => {
  const page = await readFile(new URL('../trefoil/index.html', import.meta.url), 'utf8');
  assert.match(page, /<title>Trefoil — Turn, wait, swap two colours<\/title>/);
  assert.match(page, /<span class="name">Trefoil<\/span>/);
  for (const tag of ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card', 'twitter:image']) {
    assert.ok(page.includes(`"${tag}"`), `missing ${tag}`);
  }
  assert.match(page, /<canvas id="pattern"/);
  assert.match(page, /\.\/app\.mjs/);
  const manifest = JSON.parse(await readFile(new URL('../trefoil/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.short_name, 'Trefoil');
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
  // The code ../gyre/ shipped before momentum, verbatim, against the module
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
