import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {bicubicRGB, BOUNDARY_SPEED, colourAt, createGovernor, cubicWeights, FALLBACK_INTERVAL, FIELD_BYTES, FIELD_SHA256, FRAMES, frameAt, framesAt, GRID_SIZE, LOOP_SECONDS, MAX_SCALE, MAX_TAA_LAYERS, MOTION_PIXELS, NO_MOTION, PALETTE, patternMotion, SHUTTER, shutterOffsets, shutterPhases, SMEAR_PIXELS, snapAngle, TAA_LAYERS, THIRD, turn120, turn240, uVolume, valuesAt, viewDelta, viewMotion, wrap} from '../triskele/renderer.mjs';

const N = GRID_SIZE, S = N * N;
const shipped = await readFile(new URL('../triskele/field.f32', import.meta.url));
const planar = new Float32Array(shipped.buffer, shipped.byteOffset, shipped.byteLength / 4);
const U = uVolume(planar);
const mod = (value, n) => ((value % n) + n) % n;
/** The saved sample of channel `c` at lattice node (x, y) in frame `t`. */
const at = (c, x, y, t) => planar[mod(t, FRAMES) * 2 * S + c * S + mod(y, N) * N + mod(x, N)];
/** An integer 2×2 matrix in lattice coordinates, applied to a node. */
const map = ([[a, b], [c, d]], x, y) => [a * x + b * y, c * x + d * y];
// The point group of the triangular lattice in lattice coordinates, with the
// time shifts the atlas certifies for this orbit (wallpaper:g247:8fcde9…).
const ROTATIONS = [
  {name: '60°', M: [[1, -1], [1, 0]], tau: 5 / 6},
  {name: '120°', M: [[0, -1], [1, -1]], tau: 2 / 3},
  {name: '180°', M: [[-1, 0], [0, -1]], tau: 1 / 2},
  {name: '240°', M: [[-1, 1], [-1, 0]], tau: 1 / 3},
  {name: '300°', M: [[0, 1], [-1, 1]], tau: 1 / 6},
];
const R = ROTATIONS[1].M;
/** The three values compared by the colouring at a saved node: U(R^k x, t). */
function triple(x, y, t) {
  const out = [];
  let p = [x, y];
  for (let k = 0; k < 3; k++) { out.push(at(0, p[0], p[1], t)); p = map(R, p[0], p[1]); }
  return out;
}
const colourOf = (x, y, t) => { const [a, b, c] = triple(x, y, t); return a >= b && a >= c ? 0 : b >= c ? 1 : 2; };
/** The three nodes fixed by the 120° turn: the threefold centres of the lattice. */
const FIXED = [[0, 0], [N / 3, 2 * N / 3], [2 * N / 3, N / 3]];
const isFixed = (x, y) => FIXED.some(([a, b]) => mod(x, N) === a && mod(y, N) === b);

test('the shipped field is the atlas orbit, byte for byte', async () => {
  const source = await readFile(new URL('../p6/data/orbits/g247-diversity-q1-mixed-L512-F00406-F0p00406000-k0p02000000-L512-N66-M96.f32', import.meta.url));
  assert.deepEqual(shipped, source, 'field.f32 differs from the atlas orbit file');
  assert.equal(createHash('sha256').update(shipped).digest('hex'), FIELD_SHA256);
  assert.equal(shipped.byteLength, FIELD_BYTES);
  assert.equal(FIELD_BYTES, FRAMES * 2 * S * 4);
  assert.equal(THIRD, FRAMES / 3);
  assert.ok(Number.isInteger(THIRD), 'a third of a period is a whole number of saved frames');
});

test('every turn about the origin is a rotating wave, exactly on the saved samples', () => {
  for (const {name, M, tau} of ROTATIONS) {
    const shift = tau * FRAMES;
    assert.ok(Number.isInteger(shift), `${name}: the time shift is a whole number of frames`);
    let worst = 0, mismatches = 0;
    for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const [rx, ry] = map(M, x, y);
      for (let c = 0; c < 2; c++) {
        // U(M x, t + tau T) = U(x, t), the atlas convention.
        const left = at(c, rx, ry, t + shift), right = at(c, x, y, t);
        if (left !== right) mismatches++;
        worst = Math.max(worst, Math.abs(left - right));
      }
    }
    assert.equal(mismatches, 0, `${name} with a ${tau} period shift: ${mismatches} samples differ (max ${worst})`);
  }
});

test('the 120° turn is exactly a third-period time shift of the field', () => {
  // U(R^k x, t) = U(x, t + k T/3): the identity the three-colour rule rests on.
  let worst = 0;
  for (let t = 0; t < FRAMES; t += 1) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const [rx, ry] = map(R, x, y);
    worst = Math.max(worst, Math.abs(at(0, rx, ry, t) - at(0, x, y, t + THIRD)));
  }
  assert.equal(worst, 0, `max absolute error ${worst}`);
});

test('no reflection, glide or time reversal is a symmetry, exactly or nearly', () => {
  // Why this matters: a reflection acts on the three colours as a swap, so if
  // the orbit had one the colour action could not be purely cyclic.
  // Part one is a complete search for an EXACT symmetry over every element of
  // the triangular point group, every one of the 4 356 lattice translations
  // (so glide reflections are included, not only mirrors through the origin),
  // every saved time shift, and both directions of time. The translation never
  // has to be enumerated: each frame attains its maximum at a single node, and
  // an exact symmetry must carry the peak of frame t onto the peak of the frame
  // it maps to, which pins the translation down from t = 0 alone.
  const FLIP = [[0, 1], [1, 0]];
  const ROTATION_MATRICES = [[[1, 0], [0, 1]], ...ROTATIONS.map(r => r.M)];
  const product = (A, B) => [0, 1].map(i => [0, 1].map(j => A[i][0] * B[0][j] + A[i][1] * B[1][j]));
  const peak = [];
  for (let t = 0; t < FRAMES; t++) {
    let best = -Infinity, bx = 0, by = 0, count = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const value = at(0, x, y, t);
      if (value > best) { best = value; bx = x; by = y; count = 1; } else if (value === best) count++;
    }
    assert.equal(count, 1, `frame ${t} must peak at a single node for the search to pin the translation`);
    peak.push([bx, by]);
  }
  const found = [];
  for (const M of [...ROTATION_MATRICES, ...ROTATION_MATRICES.map(A => product(A, FLIP))]) {
    const reflection = M[0][0] * M[1][1] - M[0][1] * M[1][0] < 0;
    for (const direction of [1, -1]) for (let shift = 0; shift < FRAMES; shift++) {
      const [px, py] = peak[0], [qx, qy] = peak[mod(shift, FRAMES)];
      const [mpx, mpy] = map(M, px, py);
      const vx = qx - mpx, vy = qy - mpy;
      let holds = true;
      search: for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const [mx, my] = map(M, x, y);
        for (let c = 0; c < 2; c++) {
          if (at(c, mx + vx, my + vy, direction * t + shift) !== at(c, x, y, t)) { holds = false; break search; }
        }
      }
      if (holds) found.push({reflection, direction, tau: shift / FRAMES, translated: mod(vx, N) !== 0 || mod(vy, N) !== 0});
    }
  }
  assert.equal(found.length, 6, `expected exactly the six turns about the origin, found ${found.length}`);
  assert.ok(!found.some(f => f.reflection), 'a reflection or glide reflection is an exact symmetry');
  assert.ok(!found.some(f => f.direction === -1), 'time reversal is an exact symmetry');
  assert.ok(!found.some(f => f.translated), 'an exact symmetry needs a translation off the lattice origin');
  assert.deepEqual(found.map(f => f.tau).sort((a, b) => a - b), [0, 1 / 6, 1 / 3, 1 / 2, 2 / 3, 5 / 6]);

  // Part two measures how far the nearest mirror is, in both directions of
  // time, against the field's own RMS about its mean. (The translation is fixed
  // at zero here; the full-translation version of this residual search is done
  // offline with an FFT and quoted in the README.)
  const MIRRORS = [[[0, 1], [1, 0]], [[1, 0], [1, -1]], [[-1, 1], [0, 1]], [[0, -1], [-1, 0]], [[-1, 0], [-1, 1]], [[1, -1], [0, -1]]];
  let mean = 0;
  for (let t = 0; t < FRAMES; t++) for (let i = 0; i < S; i++) mean += U[t * S + i];
  mean /= FRAMES * S;
  let spread = 0;
  for (let t = 0; t < FRAMES; t++) for (let i = 0; i < S; i++) spread += (U[t * S + i] - mean) ** 2;
  spread = Math.sqrt(spread / (FRAMES * S));
  const closest = {1: Infinity, '-1': Infinity};
  for (const M of MIRRORS) {
    const index = new Int32Array(S);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const [mx, my] = map(M, x, y);
      index[y * N + x] = mod(my, N) * N + mod(mx, N);
    }
    for (const direction of [1, -1]) for (let shift = 0; shift < FRAMES; shift++) {
      let sum = 0;
      for (let t = 0; t < FRAMES; t++) {
        const a = t * S, b = mod(direction * t + shift, FRAMES) * S;
        for (let i = 0; i < S; i++) { const d = U[b + index[i]] - U[a + i]; sum += d * d; }
      }
      closest[direction] = Math.min(closest[direction], Math.sqrt(sum / (FRAMES * S)));
    }
  }
  assert.ok(closest[1] > spread, `the closest mirror leaves an RMS residual of ${closest[1].toFixed(5)}, against a field spread of ${spread.toFixed(5)}`);
  assert.ok(closest['-1'] > spread, `the closest time-reversed mirror leaves ${closest['-1'].toFixed(5)}, against a field spread of ${spread.toFixed(5)}`);
});

test('a 120° turn and a T/3 shift each cycle the three colours the same way', () => {
  let turned = 0, shifted = 0, combined = 0, ties = 0;
  for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const here = colourOf(x, y, t);
    const [rx, ry] = map(R, x, y);
    if (isFixed(x, y)) { ties++; continue; }
    // A turn by R steps the colour back one place: colour(R x, t) = colour(x, t) − 1.
    if (colourOf(rx, ry, t) !== mod(here - 1, 3)) turned++;
    // So does waiting a third of a period.
    if (colourOf(x, y, t + THIRD) !== mod(here - 1, 3)) shifted++;
    // Together they are the identity.
    if (colourOf(rx, ry, t + 2 * THIRD) !== here) combined++;
  }
  assert.equal(turned, 0, 'the 120° turn cycles the colours by −1 at every node');
  assert.equal(shifted, 0, 'the T/3 shift cycles the colours by −1 at every node');
  assert.equal(combined, 0, 'turn plus 2T/3 leaves every colour where it was');
  assert.equal(ties, 3 * FRAMES, 'only the three threefold centres tie');
  // The combination is the identity even at the tied centres.
  for (const [x, y] of FIXED) for (let t = 0; t < FRAMES; t++) {
    const [rx, ry] = map(R, x, y);
    assert.equal(colourOf(rx, ry, t + 2 * THIRD), colourOf(x, y, t));
  }
});

test('the three colours share the plane equally at every instant', () => {
  const free = (S - 3) / 3;
  for (let t = 0; t < FRAMES; t++) {
    const counts = [0, 0, 0];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!isFixed(x, y)) counts[colourOf(x, y, t)]++;
    assert.deepEqual(counts, [free, free, free], `frame ${t}: ${counts}`);
  }
  // And on the continuum the viewer actually draws: a fine sweep of one repeat.
  const plane = frameAt(U, 0.137);
  const counts = [0, 0, 0], steps = 240;
  for (let j = 0; j < steps; j++) for (let i = 0; i < steps; i++) counts[colourAt(plane, [(i + 0.5) / steps, (j + 0.5) / steps])]++;
  for (const count of counts) assert.ok(Math.abs(count / (steps * steps) - 1 / 3) < 0.004, `colour areas ${counts.map(c => (c / (steps * steps)).toFixed(4))}`);
});

test('the reconstruction the shader uses carries the same two identities', () => {
  const plane = frameAt(U, 0.137);
  const points = [[0.31, 0.12], [0.8, 0.47], [0.02, 0.93], [0.5, 0.5], [0.61, 0.29]];
  for (const point of points) {
    const here = valuesAt(plane, point);
    const turned = valuesAt(plane, turn120(point));
    const back = valuesAt(plane, turn240(point));
    for (let k = 0; k < 3; k++) {
      // w_k(R x) = w_{k+1}(x), exactly but for the order of three additions.
      assert.ok(Math.abs(turned[k] - here[(k + 1) % 3]) < 1e-9, `turn at ${point}: ${turned} vs ${here}`);
      assert.ok(Math.abs(back[k] - here[(k + 2) % 3]) < 1e-9, `back-turn at ${point}: ${back} vs ${here}`);
    }
    assert.ok(Math.max(...here) - Math.min(...here) > 1e-4, 'the three values are genuinely different');
  }
  // A third of a period renames channel k as channel k + 1, exactly.
  const later = frameAt(U, 0.137 + 1 / 3);
  for (let i = 0; i < S; i++) for (let k = 0; k < 3; k++) assert.equal(later[4 * i + k], plane[4 * i + (k + 1) % 3]);
  // ...so the reconstructed values cycle with it.
  for (const point of points) {
    const here = valuesAt(plane, point), next = valuesAt(later, point);
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(next[k] - here[(k + 1) % 3]) < 1e-12);
  }
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
  const one = bicubicRGB(plane, [0.25, 0.75]);
  assert.equal(one.length, 3);
  assert.ok(one.every(Number.isFinite));
});

// ---- the shutter (temporal anti-aliasing) ----
// Each displayed frame is integrated over a shutter of SHUTTER × the frame
// interval, as TAA_LAYERS sub-samples whose colours the shader averages. The
// symmetrised kernel runs per sub-sample, so every layer obeys both identities
// exactly and the shutter can only ever blend pictures the rule already made.
test('the shutter integrates a frame without touching the rule', () => {
  assert.equal(TAA_LAYERS, 3);
  assert.equal(MAX_TAA_LAYERS, 5);
  // The default shutter is three tenths of a frame (the user's crispness
  // choice); a full frame interval, exercised below with shutter = 1, is the box
  // filter under which consecutive frames' sub-phases tile with no gap.
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

  // Both identities hold per sub-phase, so the shutter cannot perturb the
  // symmetry: it averages three pictures each of which already obeys them.
  for (const phase of shutterPhases(0.137, TAA_LAYERS)) {
    const here = frameAt(U, phase), later = frameAt(U, phase + 1 / 3);
    for (const point of [[0.21, 0.63], [0.77, 0.08], [0.31, 0.12]]) {
      const colour = colourAt(here, point);
      assert.equal(colourAt(here, turn120(point)), mod(colour - 1, 3), `the turn, at sub-phase ${phase}`);
      assert.equal(colourAt(later, point), mod(colour - 1, 3), `the wait, at sub-phase ${phase}`);
      assert.equal(colourAt(later, turn240(point)), colour, `and together they are the identity, at sub-phase ${phase}`);
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

test('the picture moves at the speed BOUNDARY_SPEED names, measured on the lattice edges', () => {
  // The six nearest neighbours of a node: ±a1, ±a2 and ±(a1 + a2), all one
  // spacing apart. (1, −1) = a1 − a2 is √3 times as far — a second neighbour,
  // not an edge — so the three directions that cover every edge exactly once
  // are (1, 0), (0, 1) and (1, 1).
  const EDGES = [[1, 0], [0, 1], [1, 1]];
  const distance = ([u, v]) => Math.hypot(u - v / 2, Math.sqrt(3) * v / 2);
  for (const step of EDGES) assert.ok(Math.abs(distance(step) - 1) < 1e-12, `${step} is a lattice edge`);
  assert.ok(Math.abs(distance([1, -1]) - Math.sqrt(3)) < 1e-12, '(1, −1) is a second neighbour, not an edge');
  const colours = new Int8Array(FRAMES * S);
  for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) colours[t * S + y * N + x] = colourOf(x, y, t);
  let edges = 0, boundary = 0, changes = 0;
  for (let t = 0; t < FRAMES; t++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const here = colours[t * S + y * N + x];
    for (const [dx, dy] of EDGES) { edges++; if (colours[t * S + mod(y + dy, N) * N + mod(x + dx, N)] !== here) boundary++; }
    if (colours[mod(t + 1, FRAMES) * S + y * N + x] !== here) changes++;
  }
  const density = boundary / edges, perPeriod = FRAMES * changes / (FRAMES * S);
  assert.equal(density.toFixed(4), '0.1076', 'boundary density over lattice edges');
  assert.equal(perPeriod.toFixed(2), '3.00', 'colour changes per node per period');
  // Those two together are the speed of the picture: 3.00 crossings a period
  // over 66 × 0.1076 = 7.10 boundaries per lattice length. That is the constant
  // the renderer turns into an on-screen speed when it decides whether the
  // shutter is worth paying for.
  const speed = perPeriod / (N * density);
  assert.equal(speed.toFixed(3), '0.422', 'lattice lengths per period');
  assert.ok(Math.abs(speed - BOUNDARY_SPEED) < 0.01, `BOUNDARY_SPEED = ${BOUNDARY_SPEED} against the measured ${speed.toFixed(3)}`);
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
  // The climb-back must not offer a quality level that has already been
  // measured as too slow, or the two sides of a cost step alternate for ever.
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

test('a cadence measured under load is never mistaken for the display’s', () => {
  // The frame interval the governor is told about is measured from idle frames
  // before drawing starts, and on a warm cache there may be none to measure. It
  // must not then take the cadence of a page already in trouble for the screen's
  // refresh rate: a page drawing at 5 fps would decide that 5 Hz IS the target,
  // find every frame on time, and hold on to the shutter for ever at 5 fps.
  // A software renderer on a 60 Hz screen: 200 ms a frame with the shutter,
  // 67 ms without it, and a quarter of the pixels would be four times faster.
  // Intervals that long are frames, not a hidden tab coming back, so a window
  // made only of shorter ones would never fill in the first place.
  function simulate({display = null, seconds = 60, refresh = 1000 / 60, shuttered = 200, plain = 67} = {}) {
    const governor = createGovernor({display});
    let now = 0, first = null, last = 0, seed = null;
    while (now < seconds * 1000) {
      const layers = governor.shutter ? 3 : 1;
      const dt = Math.max(refresh, Math.ceil((layers > 1 ? shuttered : plain) * governor.quality ** 2 / refresh) * refresh);
      now += dt; last = dt; first ??= dt;
      governor.tick(now, true, layers > 1);
      if (seed === null && governor.display !== null) seed = governor.display; // what it first believed
    }
    return {governor, first, last, seed};
  }
  const struggling = simulate();
  assert.equal(struggling.governor.shutter, false, 'the shutter is the first thing given up');
  assert.ok(struggling.seed <= FALLBACK_INTERVAL + 1e-9, `an unmeasured display is assumed ordinary, not 5 Hz (${struggling.seed} ms)`);
  assert.ok(struggling.governor.display > FALLBACK_INTERVAL, `and what the page can really hold is learnt from there (${struggling.governor.display.toFixed(1)} ms)`);
  assert.ok(struggling.governor.quality < 1, `and the resolution follows it down (quality ${struggling.governor.quality})`);
  assert.ok(struggling.last <= 2 * FALLBACK_INTERVAL, `a page that began at ${(1000 / struggling.first).toFixed(0)} fps ends at ${(1000 / struggling.last).toFixed(0)} fps`);
  // Told the cadence it could not measure, it does the same thing — the seed is
  // a starting point, not a different policy.
  const told = simulate({display: FALLBACK_INTERVAL});
  assert.deepEqual([told.governor.shutter, told.governor.quality < 1, told.last <= 2 * FALLBACK_INTERVAL], [false, true, true]);
  // A display that really is slow is believed, once lowering the resolution has
  // been tried and has not helped: a 25 Hz screen with a GPU to spare keeps
  // every pixel it has, and the excursion that learnt this is over in seconds.
  const slowScreen = createGovernor({display: null});
  const refresh = 1000 / 25;
  let clock = 0, quality = 1, changes = 0;
  for (let i = 0; i < 6000 && clock < 120000; i++) {
    clock += Math.max(refresh, Math.ceil(6 * slowScreen.quality ** 2 / refresh) * refresh);
    slowScreen.tick(clock, true, slowScreen.shutter);
    if (slowScreen.quality !== quality) { changes++; quality = slowScreen.quality; }
  }
  assert.ok(Math.abs(slowScreen.display - refresh) < 1, `the display's own cadence is learnt (${slowScreen.display} ms)`);
  assert.equal(slowScreen.quality, 1, 'and the resolution it never needed is given back');
  assert.ok(changes <= 4, `${changes} resolution changes while learning a 25 Hz screen`);
  assert.equal(slowScreen.shutter, true, 'a screen that is merely slow keeps its motion blur');
});

test('a cadence the resolution cannot fix is not probed for ever', () => {
  // The GPU sits on the edge: a third of its frames land on the vsync, so the
  // fastest fifth of every window still reads 60 Hz, while the mean reads late
  // — and lowering the resolution does not change either. The governor may try
  // once, but each failed probe must wait longer than the last, or the canvas
  // is reallocated every few seconds for the rest of the afternoon.
  const governor = createGovernor({display: 1000 / 60});
  let now = 0, quality = 1, i = 0;
  const starts = [];
  while (now < 300000) {
    now += i++ % 3 === 0 ? 1000 / 60 : 28;
    governor.tick(now, true, false);
    if (governor.quality !== quality) {
      if (quality === 1) starts.push(now / 1000);
      quality = governor.quality;
    }
  }
  assert.ok(starts.length <= 8, `${starts.length} probe excursions in 300 s: ${starts.map(s => s.toFixed(0)).join(', ')} s`);
  const gaps = starts.slice(1).map((s, k) => s - starts[k]);
  assert.ok(gaps.length >= 2, 'it does try more than once — the load may well have changed');
  assert.ok(gaps[gaps.length - 1] > 4 * gaps[0], `the wait doubles: gaps ${gaps.map(g => g.toFixed(0)).join(', ')} s`);
  assert.equal(governor.quality, 1, 'and a probe that did not pay for itself is reverted');
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
  // frame, which is why the shutter stays off there; the judder it is for
  // starts around 860 px per repeat.
  assert.equal(patternMotion(380, FALLBACK_INTERVAL).toFixed(3), '0.333');
  assert.ok(patternMotion(380, FALLBACK_INTERVAL) < MOTION_PIXELS, 'the home framing does not pay for a shutter');
  assert.ok(patternMotion(900, FALLBACK_INTERVAL) > MOTION_PIXELS, 'a zoomed-in framing does');
  assert.equal((MOTION_PIXELS / (BOUNDARY_SPEED * FALLBACK_INTERVAL / (1000 * LOOP_SECONDS))).toFixed(0), '857', 'the shutter switches on at 857 CSS px per repeat');
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
  assert.deepEqual(PALETTE, ['#c9563e', '#57979a', '#e2be68']);
});

test('the page announces itself as Triskele and links its own assets', async () => {
  const page = await readFile(new URL('../triskele/index.html', import.meta.url), 'utf8');
  assert.match(page, /<title>Triskele — Three-colour rotating wave<\/title>/);
  assert.match(page, /<span class="name">Triskele<\/span>/);
  for (const tag of ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card', 'twitter:image']) {
    assert.ok(page.includes(`"${tag}"`), `missing ${tag}`);
  }
  assert.match(page, /<canvas id="pattern"/);
  assert.match(page, /\.\/app\.mjs/);
  const manifest = JSON.parse(await readFile(new URL('../triskele/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.short_name, 'Triskele');
});
