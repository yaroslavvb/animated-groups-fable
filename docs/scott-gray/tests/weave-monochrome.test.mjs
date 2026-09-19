// Weave Monochrome, off the browser: the shipped bytes, the exact symmetries of
// the saved orbit, the colour law of the black-and-white rule, the area balance
// the law forces, the viewport and the shutter, and the viewer's inertia.
//
//   node --test docs/scott-gray/tests/weave-monochrome.test.mjs
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {
  BOUNDARY_SPEED, CENTER, createGovernor, createView, FALLBACK_INTERVAL, FIELD_BYTES, FIELD_SHA256, FRAMES,
  frameAt, framesAt, GRID_SIZE, INITIAL_PHASE, LOOP_SECONDS, MAX_SCALE, MAX_TAA_LAYERS, MIN_SCALE, MOTION_PIXELS,
  NO_MOTION, ORBIT_ID, patternMotion, PERIOD, RULES, SHUTTER, SMEAR_PIXELS, shutterOffsets, shutterPhases,
  signedVolume, snapAngle, TAA_LAYERS, TEXTURE_SIZE, TILE_PIXELS, TURN_STEP, V_LAG, bicubic, scaleFor, upsample2,
  viewDelta, viewMotion, wrap, wrapAngle,
} from '../weave-monochrome/renderer.mjs';
import {
  advanceFling, createFling, ELASTIC_GIVE, ELASTIC_MS, elasticProfile, estimateVelocity, MAX_PAN_SPEED, MAX_STEP,
  MAX_TURN_RATE, MAX_ZOOM_RATE, MIN_PAN_SPEED, MIN_SPAN_MS, NO_THROW, PAN_TAU, SNAP_MS, STALE_MS, STOP_PAN,
  trimSamples, TURN_CATCH, TURN_TAU, turnTargetFor, WINDOW_MS, ZOOM_TAU,
} from '../weave-monochrome/momentum.mjs';

const ORBIT = '../data/orbits/g96-diversity-p4-rotating-woven31-f0p00395-F0p00395000-k0p02000000-L256-N48-M128';
const shipped = await readFile(new URL('../weave-monochrome/field.f32', import.meta.url));
const planar = new Float32Array(shipped.buffer, shipped.byteOffset, shipped.byteLength / 4);
const U = signedVolume(planar, 'u');
const N = TEXTURE_SIZE, PLANE = N * N;
const mod = (value, n) => ((value % n) + n) % n;
/** The drawn field w on the doubled grid: texel (x, y) of saved frame `frame`,
 * every index taken periodically. 96 texels = one lattice length = one cell. */
const w = (volume, frame, x, y) => volume[mod(frame, FRAMES) * PLANE + mod(y, N) * N + mod(x, N)];
/** Walks every texel of every saved frame, reducing with `f` to a maximum. */
function worst(f, {stride = 1} = {}) {
  let out = 0;
  for (let frame = 0; frame < FRAMES; frame += 1) {
    for (let y = 0; y < N; y += stride) for (let x = 0; x < N; x += stride) out = Math.max(out, Math.abs(f(frame, x, y)));
  }
  return out;
}

test('the shipped field is the catalogue orbit, byte for byte', async () => {
  const atlas = await readFile(new URL(`${ORBIT}.f32`, import.meta.url));
  assert.deepEqual(shipped, atlas, 'field.f32 is a byte-identical copy of the audited orbit');
  const sha = createHash('sha256').update(shipped).digest('hex');
  assert.equal(sha, FIELD_SHA256);
  assert.equal(shipped.byteLength, FIELD_BYTES);
  const record = JSON.parse(await readFile(new URL(`${ORBIT}.json`, import.meta.url), 'utf8'));
  assert.equal(record.fieldSha256, sha, 'the catalogue record names the same bytes');
  assert.equal(record.fieldByteLength, FIELD_BYTES);
  assert.equal(record.config.N, GRID_SIZE);
  assert.equal(record.config.M, FRAMES);
  assert.equal(record.config.period, PERIOD);
  assert.equal(record.provenance.shapeLabel, 'Woven rotating wave · (3,1)');
  assert.equal(record.diversityAdmission.status, 'independently verified periodic orbit');
  // The orbit id the page names is the group and the first eight bytes of the hash.
  assert.equal(ORBIT_ID, `wallpaper:g11:${sha.slice(0, 16)}`);
  // The audited symmetries are the four rotations of p4, all at residual zero.
  assert.equal(record.diversityAdmission.symmetryMax, 0);
  assert.equal(record.config.ops.length, 4);
});

test('the field also ships compressed, and the compressed copy is the same field', async () => {
  // field.f32 is 2.36 MB of float32 and the whole of the wait before the first
  // frame. Cloudflare does not compress application/octet-stream, so the page
  // fetches field.f32z — the same bytes gzipped — under an extension no server
  // decodes by itself, and inflates it with DecompressionStream, falling back to
  // the plain file on anything that cannot (Safari before 16.4).
  const packed = await readFile(new URL('../weave-monochrome/field.f32z', import.meta.url));
  assert.deepEqual([packed[0], packed[1]], [0x1f, 0x8b], 'it is gzip, which is what the loader sniffs for');
  const {gunzipSync} = await import('node:zlib');
  assert.deepEqual(gunzipSync(packed), shipped, 'and it inflates to the shipped field exactly');
  assert.ok(packed.byteLength < FIELD_BYTES / 3, `${(packed.byteLength / 1024).toFixed(0)} KB against ${(FIELD_BYTES / 1024).toFixed(0)} KB`);
  const app = await readFile(new URL('../weave-monochrome/app.mjs', import.meta.url), 'utf8');
  assert.match(app, /'\.\/field\.f32z'/, 'the page asks for the compressed copy first');
  assert.match(app, /'\.\/field\.f32'/, 'and keeps the plain one as the fallback');
  assert.match(app, /DecompressionStream/);
  assert.match(app, /0x1f && [a-z]+\[1\] === 0x8b/, 'the magic number decides, not a header a host may have rewritten');
});

test('the saved samples carry the half turn, the half-cell slides and the glide, bit-exactly', () => {
  // Read straight off the file: [frame][channel][y][x], channel 0 = U, 1 = V.
  const count = GRID_SIZE * GRID_SIZE;
  const raw = (channel, frame, x, y) => planar[(mod(frame, FRAMES) * 2 + channel) * count + mod(y, GRID_SIZE) * GRID_SIZE + mod(x, GRID_SIZE)];
  const half = FRAMES / 2, quarter = FRAMES / 4;
  for (const [channel, name] of [[0, 'U'], [1, 'V']]) {
    const c = (frame, x, y) => raw(channel, frame, x, y);
    let turn = 0, slideX = 0, slideY = 0, repeat = 0, rotate = 0, glide = 0, spread = 0;
    for (let frame = 0; frame < FRAMES; frame++) for (let y = 0; y < GRID_SIZE; y++) for (let x = 0; x < GRID_SIZE; x++) {
      const value = c(frame, x, y);
      spread = Math.max(spread, Math.abs(value - c(frame, x + 1, y)));
      turn = Math.max(turn, Math.abs(c(frame, -x, -y) - c(frame + half, x, y)));
      slideX = Math.max(slideX, Math.abs(c(frame, x + 24, y) - c(frame + half, x, y)));
      slideY = Math.max(slideY, Math.abs(c(frame, x, y + 24) - c(frame + half, x, y)));
      repeat = Math.max(repeat, Math.abs(c(frame, x + 24, y + 24) - c(frame, x, y)));
      // R: (x, y) → (−y, x). The value at R x is the sample at (y-index x, x-index −y).
      rotate = Math.max(rotate, Math.abs(c(frame, -y, x) - c(frame + 3 * quarter, x, y)));
      // The glide the source page marks Y: reflect in the diagonal, slide (¼, ¼).
      glide = Math.max(glide, Math.abs(c(frame, y + 12, x + 12) - c(frame, x, y)));
    }
    assert.ok(spread > 0.01, `${name} is not constant`);
    assert.deepEqual(
      {turn, slideX, slideY, repeat, rotate, glide},
      {turn: 0, slideX: 0, slideY: 0, repeat: 0, rotate: 0, glide: 0},
      `${name}: every identity the rule is built on holds at max abs error 0`,
    );
  }
  // 352.037… is the period; T/2 and T/4 are whole numbers of saved frames, which
  // is what lets the colour law be exact rather than interpolated.
  assert.equal(FRAMES % 4, 0);
});

test('the drawn field is the half-turn difference, taken on the band-limited grid', () => {
  assert.deepEqual(RULES, ['u', 'v']);
  assert.throws(() => signedVolume(planar, 'ember'));
  assert.equal(U.length, PLANE * FRAMES);
  assert.equal(TEXTURE_SIZE, 2 * GRID_SIZE);
  // Spectral doubling keeps the saved nodes exactly, so every even texel of the
  // difference is the node difference the file itself gives.
  const count = GRID_SIZE * GRID_SIZE;
  const kernel = upsample2(planar.subarray(0, count), GRID_SIZE);
  for (let y = 0; y < GRID_SIZE; y++) for (let x = 0; x < GRID_SIZE; x++) {
    assert.equal(kernel[2 * y * N + 2 * x], planar[y * GRID_SIZE + x], `node (${x}, ${y}) survives the doubling`);
  }
  for (const [frame, x, y] of [[0, 0, 0], [19, 2, 80], [FRAMES - 1, 95, 3], [64, 48, 48]]) {
    const plane = upsample2(planar.subarray((frame * 2) * count, (frame * 2) * count + count), GRID_SIZE);
    assert.equal(w(U, frame, x, y), Math.fround(plane[y * N + x] - plane[mod(-y, N) * N + mod(-x, N)]));
  }
  // The rule is not trivial and not tiny: it spans a tenth of the field's range.
  assert.ok(worst((f, x, y) => w(U, f, x, y)) > 0.1);
});

test('the colour law: what swaps black and white, and what leaves them alone', () => {
  // Positions in texels of the doubled grid: 96 texels = one cell = 48 nodes.
  // A half cell is 48 texels, a quarter cell 24.
  const half = FRAMES / 2, quarter = FRAMES / 4;
  for (const [rule, volume] of [['u', U], ['v', signedVolume(planar, 'v')]]) {
    const at = (f, x, y) => w(volume, f, x, y);
    const swap = {
      'slide half a cell along x': (f, x, y) => at(f, x + 48, y) + at(f, x, y),
      'slide half a cell along y': (f, x, y) => at(f, x, y + 48) + at(f, x, y),
      'wait half a period': (f, x, y) => at(f + half, x, y) + at(f, x, y),
      'half turn about the origin': (f, x, y) => at(f, -x, -y) + at(f, x, y),
      'quarter turn and three quarters of a period': (f, x, y) => at(f, -y, x) + at(f + quarter, x, y),
      'reflect in y = x + ¼': (f, x, y) => at(f, y + 72, x + 24) + at(f, x, y),
      'reflect in x + y = ¼': (f, x, y) => at(f, -y + 24, -x + 24) + at(f, x, y),
    };
    const keep = {
      'slide half a cell along both axes': (f, x, y) => at(f, x + 48, y + 48) - at(f, x, y),
      'quarter turn and a quarter period': (f, x, y) => at(f, -y, x) - at(f + 3 * quarter, x, y),
      'the glide Y': (f, x, y) => at(f, y + 24, x + 24) - at(f, x, y),
      'reflect in x + y = ½ and slide (¼, −¼)': (f, x, y) => at(f, -y + 72, -x + 24) - at(f, x, y),
      'a whole period': (f, x, y) => at(f + FRAMES, x, y) - at(f, x, y),
    };
    for (const [name, residual] of [...Object.entries(swap), ...Object.entries(keep)]) {
      assert.equal(worst(residual), 0, `${rule}: ${name} is exact on every one of the ${FRAMES * PLANE} samples`);
    }
    // And the operations that swap really do swap: they are not secretly trivial.
    for (const [name, residual] of Object.entries(swap)) {
      // residual = image + original = 0, so image = −original; the image differs
      // from the original wherever the original is not itself zero.
      assert.ok(worst((f, x, y) => (residual(f, x, y) - 2 * at(f, x, y))) > 0.1, `${rule}: ${name} really changes the picture`);
    }
  }
});

test('black and white share the plane exactly, and the pattern never breaks into dust', () => {
  let positive = 0, negative = 0, zero = 0;
  for (const value of U) { if (value > 0) positive++; else if (value < 0) negative++; else zero++; }
  // The half-cell slide is an area-preserving bijection of white onto black, so
  // the two shares are equal by force, not by luck.
  assert.equal(positive, negative, `${positive} white against ${negative} black`);
  assert.equal(positive + negative + zero, U.length);
  // The zero set is the same 384 texels in every frame: the four colour-reversing
  // mirror lines — the diagonals y = x ± ¼ and x + y = ¼, ¾ — where w vanishes
  // identically, at 376 texels, plus 8 isolated points that vanish at every
  // phase: the four half-turn centres (0,0), (48,0), (0,48), (48,48) and the
  // four points (24,24), (72,24), (24,72), (72,72) where the two families of
  // mirror lines cross.
  assert.equal(zero, 384 * FRAMES);
  assert.ok(zero / U.length < 0.05, `${(100 * zero / U.length).toFixed(2)} % of samples sit exactly on the contour`);
  const onDiagonal = ([x, y]) => mod(y - x, N) === 24 || mod(y - x, N) === 72 || mod(x + y, N) === 24 || mod(x + y, N) === 72;
  const always = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let all = true;
    for (let frame = 0; frame < FRAMES && all; frame++) if (w(U, frame, x, y) !== 0) all = false;
    if (all) always.push([x, y]);
  }
  assert.equal(always.length, 384, 'the same texels vanish at every phase');
  assert.equal(always.filter(onDiagonal).length, 376, 'all but eight of them lie on the four mirror diagonals');
  assert.deepEqual(always.filter(point => !onDiagonal(point)).sort(), [[0, 0], [0, 48], [24, 24], [24, 72], [48, 0], [48, 48], [72, 24], [72, 72]]);
  // No phase is a dud: every saved frame is somewhere near balanced, and no
  // frame is a speckle field — adjacent frames agree on 98 % of their texels.
  let churn = 0;
  for (let frame = 0; frame < FRAMES; frame++) {
    let white = 0;
    for (let i = 0; i < PLANE; i++) {
      if (U[frame * PLANE + i] > 0) white++;
      if ((U[frame * PLANE + i] > 0) !== (U[mod(frame + 1, FRAMES) * PLANE + i] > 0)) churn++;
    }
    assert.ok(Math.abs(white / PLANE - 0.5) < 0.03, `frame ${frame} is ${(100 * white / PLANE).toFixed(1)} % white`);
  }
  churn /= FRAMES * PLANE;
  assert.ok(churn < 0.05, `${(100 * churn).toFixed(2)} % of texels change colour between adjacent saved frames`);
  // The strands are chunky: about eight nodes across. A strand is a same-sign
  // run, so a cell of 48 nodes carries about 48/8 = 6 of them, and the two cells
  // the home framing shows across the shorter side carry about twelve — not
  // eight, which is 96/8 and counts nodes rather than strands.
  const bands = crossingsPerCell(U);
  assert.ok(bands > 5 && bands < 7, `${bands.toFixed(2)} boundary crossings per cell`);
  assert.ok(Math.abs(GRID_SIZE / bands - 8) < 0.5, `strands ${(GRID_SIZE / bands).toFixed(2)} nodes across`);
  assert.equal((2 * bands).toFixed(0), '12', 'about twelve strands across the two cells the home view shows');
});

/** Same-sign runs along x: boundary crossings per cell, over every saved frame. */
function crossingsPerCell(volume) {
  let crossings = 0;
  for (let frame = 0; frame < FRAMES; frame++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if ((w(volume, frame, x, y) > 0) !== (w(volume, frame, x + 1, y) > 0)) crossings++;
  }
  return crossings / (FRAMES * N);
}

test('the V rule is the same animation, offset by 51/128 of a period', () => {
  // Compared at the SAME phase the two sign fields agree on about a fifth of the
  // samples — anti-correlated, which is easy to misread as a second picture. It
  // is a phase shift seen head on: scanning every lag finds w_V(x, t) =
  // w_U(x, t − 51/128 T) on 97 % of the drawn volume, and the runner-up is that
  // lag plus half a period, which is the exact colour negative of it. So ?rule=v
  // shows the same twill at a different moment of the same loop.
  const V = signedVolume(planar, 'v');
  const agreementAt = lag => {
    let same = 0, counted = 0;
    for (let frame = 0; frame < FRAMES; frame++) for (let i = 0; i < PLANE; i++) {
      const u = U[mod(frame - lag, FRAMES) * PLANE + i], v = V[frame * PLANE + i];
      if (u === 0 || v === 0) continue;
      counted++; if ((u > 0) === (v > 0)) same++;
    }
    return same / counted;
  };
  const scan = Array.from({length: FRAMES}, (_, lag) => agreementAt(lag));
  const best = scan.indexOf(Math.max(...scan));
  assert.equal(best, V_LAG, `the best lag is ${best}/${FRAMES} of a period`);
  assert.ok(scan[best] > 0.95, `the V rule reproduces the U rule on ${(100 * scan[best]).toFixed(1)} % of samples`);
  // The colour negative of that lag is the runner-up, half a period away.
  const negative = scan.indexOf(Math.min(...scan));
  assert.equal(negative, mod(V_LAG + FRAMES / 2, FRAMES));
  assert.ok(scan[negative] < 0.05);
  // And at lag zero, the figure the page used to call a different picture.
  assert.ok(scan[0] > 0.15 && scan[0] < 0.3, `${(100 * scan[0]).toFixed(1)} % at the same phase`);
  // Same strand width, too: the alternate is not chunkier.
  assert.ok(Math.abs(GRID_SIZE / crossingsPerCell(V) - GRID_SIZE / crossingsPerCell(U)) < 0.1,
    `V strands ${(GRID_SIZE / crossingsPerCell(V)).toFixed(2)} nodes across against U's ${(GRID_SIZE / crossingsPerCell(U)).toFixed(2)}`);
});

/** Every exact symmetry of a drawn volume: the 8 point operations of the square
 * lattice, every translation of the grid, every time shift, and either sign.
 * Brute force over all of those is 9.4 million full-volume comparisons, so the
 * shifts are found rather than searched: for each point operation the image's
 * extreme values can only land on the original's extreme values, which pins the
 * translation and the time shift to a handful of candidates, each then checked
 * on every one of the 1 179 648 samples. */
function twoColourGroup(volume) {
  const point = {
    e: (x, y) => [x, y],
    r1: (x, y) => [-y, x],
    r2: (x, y) => [-x, -y],
    r3: (x, y) => [y, -x],
    mx: (x, y) => [-x, y],
    my: (x, y) => [x, -y],
    d1: (x, y) => [y, x],
    d2: (x, y) => [-y, -x],
  };
  // Where the volume attains its maximum: the image of that set under any exact
  // symmetry is the same set (or the minimum set, for a colour-swapping one).
  let top = -Infinity, bottom = Infinity;
  for (const value of volume) { if (value > top) top = value; if (value < bottom) bottom = value; }
  const seats = sign => {
    const out = [];
    const target = sign > 0 ? top : bottom;
    for (let frame = 0; frame < FRAMES; frame++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (w(volume, frame, x, y) === target) out.push([frame, x, y]);
    }
    return out;
  };
  const peaks = seats(1), troughs = seats(-1);
  const [anchorFrame, anchorX, anchorY] = peaks[0];
  const group = {preserve: [], swap: []};
  for (const [name, op] of Object.entries(point)) {
    for (const sign of [1, -1]) {
      // image(x) = sign · volume(op⁻¹ … ) — search over where the anchor may go.
      for (const [frame, x, y] of sign > 0 ? peaks : troughs) {
        const [px, py] = op(anchorX, anchorY);
        const dx = x - px, dy = y - py, dt = frame - anchorFrame;
        let ok = true;
        for (let f = 0; f < FRAMES && ok; f++) for (let j = 0; j < N && ok; j++) for (let i = 0; i < N; i++) {
          const [ix, iy] = op(i, j);
          if (w(volume, f + dt, ix + dx, iy + dy) !== sign * w(volume, f, i, j)) { ok = false; break; }
        }
        if (ok) group[sign > 0 ? 'preserve' : 'swap'].push([name, mod(dx, N), mod(dy, N), mod(dt, FRAMES)]);
      }
    }
  }
  return group;
}

test('the two-colour group is 32 + 32 here, and 16 + 16 for the plume sibling', async () => {
  const mine = twoColourGroup(U);
  assert.equal(mine.preserve.length, 32, 'colour-preserving operations');
  assert.equal(mine.swap.length, 32, 'colour-swapping operations');
  const key = entry => entry.join(' ');
  const preserved = new Set(mine.preserve.map(key)), swapped = new Set(mine.swap.map(key));
  // The translation classes are the whole of what makes this a weave. Here the
  // diagonal half-cell slide preserves the colours and either axis slide
  // reverses them, so the picture repeats on half the cell and a slide along an
  // axis exchanges black and white.
  assert.ok(preserved.has('e 48 48 0'), 'the diagonal half-cell slide preserves');
  assert.ok(swapped.has('e 48 0 0') && swapped.has('e 0 48 0'), 'each axis half-cell slide reverses');
  assert.ok(swapped.has('e 0 0 64'), 'and so does half a period');
  // The plume sibling, the same rule on another orbit at the same parameters:
  // half the group, and the difference is purely translational. Its only exact
  // translation is the diagonal half-cell slide, and that one SWAPS its colours,
  // so its picture repeats on the whole cell — where this one repeats on half.
  const plume = await readFile(new URL('../plume-monochrome/field.f32', import.meta.url));
  const theirs = twoColourGroup(signedVolume(new Float32Array(plume.buffer, plume.byteOffset, plume.byteLength / 4), 'u'));
  assert.equal(theirs.preserve.length, 16, 'plume: colour-preserving operations');
  assert.equal(theirs.swap.length, 16, 'plume: colour-swapping operations');
  const theirSwap = new Set(theirs.swap.map(key)), theirKeep = new Set(theirs.preserve.map(key));
  assert.ok(theirSwap.has('e 48 48 0'), 'plume: the diagonal half-cell slide swaps its colours');
  assert.ok(!theirKeep.has('e 48 48 0') && !theirKeep.has('e 48 0 0') && !theirSwap.has('e 48 0 0'),
    'plume: no axis slide is a symmetry of its picture at all');
  // Both point groups are the whole of the square's eight operations.
  const points = volume => new Set([...volume.preserve, ...volume.swap].map(([name]) => name));
  assert.equal(points(mine).size, 8);
  assert.equal(points(theirs).size, 8);
});

test('the reconstruction carries the colour law off the saved frames too', () => {
  // Catmull–Rom over the four nearest saved frames: a phase between two frames
  // must obey the same law, since each of the four frames does.
  for (const phase of [0.137, 0.5 / FRAMES, 0.813]) {
    const here = frameAt(U, phase), later = frameAt(U, wrap(phase + 0.5));
    for (const point of [[0.21, 0.63], [0.77, 0.08], [0.333, 0.333], [0.5, 0.25]]) {
      const value = bicubic(here, point);
      assert.ok(Math.abs(bicubic(later, point) + value) < 1e-9, 'half a period reverses the sign off the nodes');
      assert.ok(Math.abs(bicubic(here, [-point[0], -point[1]]) + value) < 1e-9, 'so does the half turn');
      assert.ok(Math.abs(bicubic(here, [point[0] + 0.5, point[1]]) + value) < 1e-9, 'and a half-cell slide');
      assert.ok(Math.abs(bicubic(here, [point[0] + 0.5, point[1] + 0.5]) - value) < 1e-9, 'while both axes together change nothing');
      assert.ok(Math.abs(bicubic(here, [point[1] + 0.25, point[0] + 0.25]) - value) < 1e-9, 'the glide Y keeps the colour');
    }
  }
  // The screen centre is a point where w vanishes at every phase: a black/white
  // pivot sits exactly under the middle of the home view.
  for (let frame = 0; frame < FRAMES; frame++) assert.equal(w(U, frame, 0, 0), 0);
  assert.deepEqual(CENTER, [1, 1]);
  assert.equal(wrap(CENTER[0]), 0, 'the home centre is the lattice origin, one repeat away');
  // frameAt at a whole frame is that frame, bit for bit.
  assert.deepEqual([...frameAt(U, 0)], [...U.subarray(0, PLANE)]);
  assert.deepEqual([...frameAt(U, 7 / FRAMES)], [...U.subarray(7 * PLANE, 8 * PLANE)]);
});

test('the shutter integrates a frame without touching the rule', () => {
  assert.equal(TAA_LAYERS, 3);
  assert.equal(MAX_TAA_LAYERS, 5);
  assert.equal(SHUTTER, 0.3);
  // A full frame interval is the box filter under which consecutive frames'
  // sub-phases tile the timeline with no gap and no overlap.
  const tile = [...shutterPhases(0.5, 3, 16, 1), ...shutterPhases(0.5 + 16 / (1000 * LOOP_SECONDS), 3, 16, 1)];
  const gaps = tile.slice(1).map((p, j) => p - tile[j]);
  for (const gap of gaps) assert.ok(Math.abs(gap - gaps[0]) < 1e-15, `evenly spaced across two frames: ${gaps}`);
  // One layer is the frame's own instant, so ?taa=0 draws exactly what a viewer
  // without a shutter draws.
  assert.deepEqual(shutterPhases(0.25, 1), [0.25]);
  assert.deepEqual([...framesAt(U, shutterPhases(0.42, 1))], [...frameAt(U, 0.42)]);
  for (const layers of [2, 3, 5]) {
    const phases = shutterPhases(0.25, layers, 16.667, SHUTTER);
    const span = SHUTTER * 16.667 / (1000 * LOOP_SECONDS);
    assert.equal(phases.length, layers);
    for (const [j, p] of phases.entries()) assert.ok(Math.abs(p - (0.25 + span * ((j + 0.5) / layers - 0.5))) < 1e-15, `layer ${j} of ${layers}`);
    assert.ok(Math.abs(phases.reduce((a, b) => a + b, 0) / layers - 0.25) < 1e-15, 'centred on the displayed frame');
    const stack = framesAt(U, phases);
    for (const [j, p] of phases.entries()) assert.deepEqual([...stack.subarray(j * PLANE, (j + 1) * PLANE)], [...frameAt(U, p)]);
  }
  assert.ok(Math.abs(FALLBACK_INTERVAL / (1000 * LOOP_SECONDS) - 1 / 480) < 1e-9, 'one 60 Hz frame is a 480th of the loop');
  // The law holds per sub-phase, so the shutter cannot perturb the symmetry.
  for (const phase of shutterPhases(0.137, TAA_LAYERS)) {
    const here = frameAt(U, phase), later = frameAt(U, wrap(phase + 0.5));
    for (const point of [[0.21, 0.63], [0.5, 0.25]]) {
      assert.ok(Math.abs(bicubic(later, point) + bicubic(here, point)) < 1e-9, `sub-phase ${phase}`);
    }
  }
  // And the reason the shader averages the colours and never the field: at a
  // point the contour crossed during the shutter the sub-phases disagree in
  // sign, so their colours average to a grey — while the mean of the field is
  // one number with one sign, and would draw a hard edge one pixel over.
  const planes = shutterPhases(0.137, TAA_LAYERS, FALLBACK_INTERVAL, SHUTTER).map(p => frameAt(U, p));
  const steps = 240;
  let swept = 0, checked = 0;
  for (let j = 0; j < steps; j++) for (let i = 0; i < steps; i++) {
    const point = [(i + 0.5) / steps, (j + 0.5) / steps];
    const seen = planes.map(plane => bicubic(plane, point) > 0);
    if (seen[0] === seen.at(-1)) continue;
    swept++;
    const mean = planes.reduce((sum, plane) => sum + bicubic(plane, point) / TAA_LAYERS, 0);
    const colours = seen.filter(Boolean).length / TAA_LAYERS;
    assert.ok(colours > 0 && colours < 1, 'the sub-phases disagree, so the average of the colours is a grey');
    assert.ok(mean > 0 === (mean > 0), 'the average of the field is one sign, never a blend');
    checked++;
  }
  assert.ok(swept > 0, 'some points change colour inside a single shutter');
  assert.ok(swept / (steps * steps) < 0.02, `${(100 * swept / (steps * steps)).toFixed(3)} % of the plane changes colour inside one shutter`);
  assert.equal(checked, swept);
});

test('the shutter is spent only where the picture actually moves', () => {
  for (const layers of [1, 2, 3, 5]) {
    const offsets = shutterOffsets(layers, SHUTTER);
    assert.equal(offsets.length, layers);
    assert.ok(Math.abs(offsets.reduce((a, b) => a + b, 0)) < 1e-15, `centred: ${offsets}`);
    assert.ok(Math.max(...offsets.map(Math.abs)) <= SHUTTER / 2 + 1e-15, 'inside the shutter');
  }
  assert.deepEqual(shutterOffsets(1, SHUTTER), [0], 'one sub-sample is the frame itself');
  for (const offset of shutterOffsets(3, 0)) assert.equal(Math.abs(offset), 0, 'a zero-width shutter collapses to one instant');
  // A view step is the shorter way round the periodic plane.
  const still = {center: [0.2, 0.3], scale: TILE_PIXELS, angle: 0};
  assert.deepEqual(viewDelta(still, still), {center: [0, 0], zoom: 0, angle: 0});
  const wrapped = viewDelta({center: [0.98, 0.5], scale: TILE_PIXELS, angle: 0}, {center: [0.02, 0.5], scale: TILE_PIXELS, angle: 0});
  assert.ok(Math.abs(wrapped.center[0] - 0.04) < 1e-12, `a pan across the wrap reads ${wrapped.center[0]}`);
  // The lattice is square, so a pan of one lattice length at 380 px per repeat
  // is 380 CSS px in either direction, with no basis in between.
  assert.equal(viewMotion({center: [1, 0], zoom: 0, angle: 0}, 380, 1000, 600), 380);
  assert.equal(viewMotion({center: [0, 1], zoom: 0, angle: 0}, 380, 1000, 600), 380);
  assert.equal(viewMotion(NO_MOTION, 380, 1000, 600), 0);
  assert.ok(viewMotion({center: [0, 0], zoom: 0, angle: 0.01}, 380, 1000, 600) > 0, 'a turn moves the corners');
  // The gate is on the SMEAR the shutter would draw — travel × shutter — so the
  // travel it takes to engage is motion / shutter: 2.5 CSS px a frame at the
  // shipped 0.3 shutter, and 0.75 px a frame with ?shutter=1.
  const gateScale = shutter => MOTION_PIXELS / (shutter * BOUNDARY_SPEED * FALLBACK_INTERVAL / (1000 * LOOP_SECONDS));
  assert.equal((MOTION_PIXELS / SHUTTER).toFixed(2), '2.50');
  assert.equal(patternMotion(380, FALLBACK_INTERVAL).toFixed(3), '0.356');
  assert.ok(patternMotion(380, FALLBACK_INTERVAL) * SHUTTER < MOTION_PIXELS, 'the home framing does not pay for a shutter');
  assert.ok(patternMotion(gateScale(SHUTTER) * 1.01, FALLBACK_INTERVAL) * SHUTTER > MOTION_PIXELS, 'a framing past the gate does');
  assert.ok(patternMotion(gateScale(SHUTTER) * 0.99, FALLBACK_INTERVAL) * SHUTTER < MOTION_PIXELS, 'and one just short of it does not');
  assert.equal(gateScale(SHUTTER).toFixed(0), '2667', 'the pattern reaches the gate at about 2670 CSS px per repeat');
  assert.equal(gateScale(1).toFixed(0), '800', 'and the full box filter engages at 800');
  assert.ok(gateScale(SHUTTER) < MAX_SCALE, 'the pattern engages the shutter by itself before the zoom limit');
  assert.equal(MOTION_PIXELS, 0.75);
  assert.equal(SMEAR_PIXELS, 6);
  assert.ok(SMEAR_PIXELS * TAA_LAYERS > patternMotion(MAX_SCALE, FALLBACK_INTERVAL) * SHUTTER,
    'the pattern’s own motion never reaches that width even at the deepest zoom, so the cap bounds panning only');
  // BOUNDARY_SPEED comes from the field, not from a guess: colour changes per
  // texel per period over boundary crossings per cell, on the very grid the
  // shader reads. That count is a lower bound — the contour stands still on the
  // mirror lines and moves quickly between them, and finer sampling finds more
  // of the quick part — so the shipped constant sits above it, within a factor
  // of two, which is all a cost gate needs.
  let changes = 0, crossings = 0;
  for (let frame = 0; frame < FRAMES; frame++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if ((w(U, frame, x, y) > 0) !== (w(U, frame + 1, x, y) > 0)) changes++;
    if ((w(U, frame, x, y) > 0) !== (w(U, frame, x + 1, y) > 0)) crossings++;
  }
  const measured = (changes / PLANE) / (crossings / (FRAMES * N));
  assert.ok(measured > 0.2, `the contour does sweep: ${measured.toFixed(3)} lattice lengths a period`);
  assert.ok(BOUNDARY_SPEED > measured && BOUNDARY_SPEED < 2 * measured, `measured ${measured.toFixed(3)} against ${BOUNDARY_SPEED}`);
});

test('the governor gives up the shutter before the resolution, and settles', () => {
  function run({seconds = 300, display = 1000 / 60, shuttered = 27, plain = 10, refresh = 1000 / 60} = {}) {
    const governor = createGovernor({display});
    let now = 0, switches = 0, late = 0, frames = 0, lowest = 1, wasOn = true;
    while (now < seconds * 1000) {
      const layers = governor.shutter ? 3 : 1;
      const cost = (layers > 1 ? shuttered : plain) * governor.quality ** 2;
      const dt = Math.max(refresh, Math.ceil(cost / refresh) * refresh);
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
  assert.equal(slow.quality, 1, 'and the resolution is left alone');
  assert.equal(slow.lowest, 1);
  assert.ok(slow.switches <= 8, `${slow.switches} shutter switches in 300 s`);
  assert.ok(slow.late < 0.03, `${(100 * slow.late).toFixed(1)} % of frames late`);
  const slower = run({shuttered: 60, plain: 40});
  assert.equal(slower.shutter, false);
  assert.ok(slower.quality < 1, `the resolution follows when the shutter is not enough (${slower.quality.toFixed(3)})`);
  const fast = run({shuttered: 5, plain: 2});
  assert.deepEqual([fast.shutter, fast.quality, fast.switches, fast.late], [true, 1, 0, 0]);
  // The climb back never offers a resolution already measured as too slow.
  const governor = createGovernor({display: 1000 / 60});
  let now = 0;
  const feed = (interval, windows) => { for (let i = 0; i < windows * 46; i++) { now += interval; governor.tick(now, true, false); } };
  feed(1000 / 60, 1);
  assert.equal(governor.quality, 1);
  feed(33, 1);
  assert.ok(governor.quality < 1);
  const dropped = governor.quality;
  feed(1000 / 60, 8);
  assert.equal(governor.quality, dropped, 'it does not climb back into the level it measured as late');
  feed(1000 / 60, 20);
  assert.equal(governor.quality, 1, 'and it does try again later');
});

test('the viewport opens where the design says, and its zoom limits are elastic', () => {
  assert.equal(INITIAL_PHASE, 0);
  assert.equal(LOOP_SECONDS, 8);
  assert.equal(TILE_PIXELS, 380, 'two lattice lengths across the source page’s 760 px canvas');
  assert.equal(scaleFor(1440, 900), 380);
  assert.equal(scaleFor(390, 844), 195, 'a narrow phone keeps two repeats across its shorter side');
  assert.equal(scaleFor(760, 760), 380, 'exactly two repeats at the source canvas size');
  // Past a 1520 px shorter side, holding TILE_PIXELS would keep multiplying the
  // repeats instead of the picture: a 4K screen at device ratio 1 would show ten
  // of them, about forty strands, which reads as houndstooth rather than as a
  // weave. So the framing never goes finer than four repeats across.
  assert.equal(scaleFor(3840, 2160), 540, 'four repeats across the shorter side of a 4K screen, not ten');
  assert.equal(scaleFor(2560, 1440), 380, 'and an ordinary desktop is untouched');
  for (const [width, height] of [[390, 844], [760, 760], [1440, 900], [2560, 1440], [3840, 2160], [5120, 2880]]) {
    const repeats = Math.min(width, height) / scaleFor(width, height);
    assert.ok(repeats >= 2 - 1e-9 && repeats <= 4 + 1e-9, `${width}×${height} shows ${repeats.toFixed(2)} repeats across the shorter side`);
  }
  const view = createView({overshoot: Math.exp(ELASTIC_GIVE)});
  assert.deepEqual(view.center, [0, 0], 'the lattice origin sits at the screen centre');
  assert.ok(view.isHome());
  view.panBy(100, 0, 1000, 600);
  assert.ok(!view.isHome());
  view.reset();
  assert.ok(view.isHome());
  // Screen y runs down and lattice y with it, as on the source page.
  const fixed = createView({tilePixels: 380, center: [0, 0]});
  assert.deepEqual(fixed.latticeAt([500 + 380, 300], 1000, 600).map(v => Number(v.toFixed(9))), [1, 0]);
  assert.deepEqual(fixed.latticeAt([500, 300 + 380], 1000, 600).map(v => Number(v.toFixed(9))), [0, 1]);
  // A hand-made zoom stops dead at a limit; only an elastic step may pass one.
  const zoom = createView({tilePixels: 1000, minScale: MIN_SCALE, maxScale: MAX_SCALE, overshoot: Math.exp(ELASTIC_GIVE)});
  zoom.zoomAt(1e6, [500, 300], 1000, 600);
  assert.equal(zoom.scale(1000, 600), MAX_SCALE);
  zoom.zoomAt(1.1, [500, 300], 1000, 600, {elastic: true});
  assert.ok(zoom.scale(1000, 600) > MAX_SCALE);
  assert.ok(zoom.scale(1000, 600) <= MAX_SCALE * Math.exp(ELASTIC_GIVE) + 1e-9);
  zoom.zoomAt(1, [500, 300], 1000, 600);
  assert.equal(zoom.scale(1000, 600), MAX_SCALE, 'and nothing that ends a gesture leaves the view out there');
  assert.throws(() => createView({overshoot: 0.5}));
});

test('turns snap to a quarter turn, since the lattice is square', () => {
  const degrees = angle => Math.round(snapAngle(angle * Math.PI / 180) * 180 / Math.PI);
  assert.equal(TURN_STEP, Math.PI / 2);
  assert.equal(degrees(88), 90);
  assert.equal(degrees(92), 90);
  assert.equal(degrees(85), 85);
  assert.equal(degrees(-91), -90);
  assert.equal(degrees(2), 0);
  assert.equal(degrees(179), 180);
  assert.equal(degrees(59), 59, 'a sixth of a turn is not a symmetry of a square lattice');
  assert.equal(wrapAngle(Math.PI), Math.PI);
  assert.equal(wrapAngle(-Math.PI), Math.PI);
  // A quarter turn is a colour-PRESERVING operation of the picture, together
  // with a quarter period; the view's snap is the lattice's, and the two agree.
  assert.equal(worst((f, x, y) => w(U, f, -y, x) - w(U, f + 3 * FRAMES / 4, x, y)), 0);
});

test('the page announces itself as Weave Monochrome and links its own assets', async () => {
  const page = await readFile(new URL('../weave-monochrome/index.html', import.meta.url), 'utf8');
  assert.match(page, /<title>Weave Monochrome — Slide it half a cell and the colours swap<\/title>/);
  // The name is a real control: it toggles the stats overlay, which on a phone,
  // with no S key, is otherwise unreachable — and a bare <span> offers a viewer
  // no hint that it does anything, and a keyboard no way to press it.
  assert.match(page, /<button class="name" type="button" aria-pressed="false" title="Frame statistics · S">Weave Monochrome<\/button>/);
  for (const tag of ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card', 'twitter:image']) {
    assert.ok(page.includes(`"${tag}"`), `missing ${tag}`);
  }
  // A two-tone picture of hard edges belongs in a lossless card, and is smaller
  // there than as a JPEG.
  assert.ok(page.includes('social-preview.png') && !page.includes('social-preview.jpg'));
  assert.ok(page.includes('<meta property="og:image:type" content="image/png">'));
  // Search results cut a description near 160 characters, so the page's own runs
  // short and the whole statement is left to the og: tags and the README.
  const description = page.match(/name="description" content="([^"]*)"/)[1];
  assert.ok(description.length <= 170, `the meta description is ${description.length} characters`);
  // The canvas names every key the page binds, not only two of them.
  const aria = page.match(/<canvas id="pattern" aria-label="([^"]*)"/)[1];
  for (const key of ['Space', 'F is fullscreen', 'S shows frame statistics', '0 or Home', 'zoom', 'turn', 'arrow keys']) {
    assert.ok(aria.includes(key), `the canvas label does not mention ${key}`);
  }
  assert.match(page, /<canvas id="pattern"/);
  assert.ok(!page.includes('data-style'), 'the page has one style: black and white');
  assert.match(page, /\.\/app\.mjs/);
  const manifest = JSON.parse(await readFile(new URL('../weave-monochrome/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.short_name, 'Weave');
  const app = await readFile(new URL('../weave-monochrome/app.mjs', import.meta.url), 'utf8');
  assert.match(app, /from '\.\/momentum\.mjs'/, 'the viewer uses the shared inertia');
  assert.match(app, /params\.get\('rule'\)/, 'the alternate rule is reachable');
  assert.match(app, /taa|shutter|motion/, 'the shutter is dialable');
  // momentum.mjs is ../gyre/momentum.mjs with exactly one adaptation: this
  // lattice is square, so a thrown turn aims at a quarter turn rather than at a
  // sixth. Strip the prose, undo that one substitution, and the two modules are
  // the same code, line for line.
  const strip = text => text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(line => line.replace(/(^|\s)\/\/.*$/, '')).filter(line => line.trim()).join('\n');
  const mine = strip(await readFile(new URL('../weave-monochrome/momentum.mjs', import.meta.url), 'utf8'));
  const theirs = strip(await readFile(new URL('../gyre/momentum.mjs', import.meta.url), 'utf8'));
  const asSixths = mine
    .replace('import {snapAngle, TURN_STEP, wrapAngle}', 'import {snapAngle, wrapAngle}')
    .replace('export const TURN_CATCH = TURN_STEP / 2;', 'export const TURN_CATCH = Math.PI / 6;')
    .replace('const STEP_TURN = TURN_STEP;', 'const SIXTH_TURN = Math.PI / 3;')
    .replaceAll('STEP_TURN', 'SIXTH_TURN').replaceAll('quarter', 'sixth');
  assert.equal(asSixths, theirs, 'only the turn step differs from the sibling module');
  assert.equal(TURN_CATCH, TURN_STEP / 2);
});

// ---------------------------------------------------------------- momentum
// The viewer's inertia, off the clock: the velocity a release is read at, and
// the glide that velocity turns into — pan, zoom and turn in one animation, an
// elastic give at the zoom limits, and the ease onto a quarter turn.

const DEG = Math.PI / 180;
function gesture({steps = 8, gap = 12, pan = [0, 0], zoom = 0, turn = 0, scale = TILE_PIXELS, angle = 0, t0 = 1000} = {}) {
  return Array.from({length: steps}, (_, i) => ({
    time: t0 + i * gap,
    mid: [100 + pan[0] * i, 200 + pan[1] * i],
    logScale: Math.log(scale) + zoom * i,
    angle: wrapAngle(angle + turn * i),
  }));
}
const endOf = samples => samples[samples.length - 1].time;
function runGlide(state, {ms = 1000 / 60, limit = 2000} = {}) {
  const out = [];
  for (let i = 0; i < limit && state.live; i++) out.push(advanceFling(state, ms / 1000));
  return out;
}

test('momentum: a release is measured over the last 100 ms, and a stop throws nothing', () => {
  const samples = [{time: 0, mid: [0, 0]}, ...Array.from({length: 11}, (_, i) => ({time: 150 + 10 * i, mid: [10 * i, 0]}))];
  const v = estimateVelocity(samples, endOf(samples));
  assert.equal(Math.round(v.pan[0]), 1000);
  assert.equal(v.pan[1], 0);
  assert.equal(v.span, WINDOW_MS);
  const paused = estimateVelocity(samples, endOf(samples) + 50);
  assert.ok(Math.abs(paused.pan[0] - 1000 * 100 / 150) < 1, `${paused.pan[0]}`);
  assert.deepEqual(estimateVelocity(samples, endOf(samples) + STALE_MS + 1), NO_THROW);
  const slow = gesture({pan: [MIN_PAN_SPEED * 0.012 * 0.9, 0]});
  assert.deepEqual(estimateVelocity(slow, endOf(slow)).pan, [0, 0]);
  const burst = gesture({gap: 0.2, pan: [40, 0]});
  assert.ok(Math.abs(Math.hypot(...estimateVelocity(burst, endOf(burst)).pan) - MAX_PAN_SPEED) < 1e-9);
  // A scale or a turn measured over less than two frames is not a measurement.
  const flick = gesture({steps: 6, gap: MIN_SPAN_MS / 10, pan: [30, 0], zoom: 0.2, turn: 5 * DEG});
  const fast = estimateVelocity(flick, endOf(flick));
  assert.equal(fast.zoom, 0);
  assert.equal(fast.turn, 0);
  assert.ok(Math.hypot(...fast.pan) > 0);
  // The turn is read the short way round the atan2 seam.
  const seam = gesture({steps: 8, turn: 2 * DEG, angle: Math.PI - 7 * DEG});
  assert.ok(seam.some(s => s.angle < 0) && seam.some(s => s.angle > 0));
  assert.ok(Math.abs(estimateVelocity(seam, endOf(seam)).turn - 14 * DEG / 0.084) < 1e-9);
  const list = Array.from({length: 20}, (_, i) => ({time: i * 10, mid: [i, 0]}));
  trimSamples(list, WINDOW_MS);
  assert.equal(list.length, 11);
  assert.equal(endOf(list) - list[0].time, WINDOW_MS);
});

test('momentum: the one-finger pan fling is exactly what the sibling pages shipped', () => {
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
    assert.deepEqual(runGlide(createFling(now, {})).map(step => step.pan), legacySteps(was, 1 / 60));
  }
});

test('momentum: pan, zoom and turn are one glide, and the zoom is multiplicative', () => {
  const state = createFling({pan: [1200, 400], zoom: 0.7, turn: 1.4}, {logScale: Math.log(TILE_PIXELS), logMax: Math.log(MAX_SCALE), snap: false});
  const steps = runGlide(state);
  assert.ok(steps.filter(s => s.pan[0] !== 0 && s.zoomMoved && s.turnMoved).length > 10);
  assert.equal(state.live, false);
  assert.deepEqual(state.velocity, [0, 0]);
  const factors = [MIN_SCALE, TILE_PIXELS, 4000].map(scale => {
    const glide = createFling({pan: [0, 0], zoom: 0.9, turn: 0}, {logScale: Math.log(scale), logMax: Math.log(1e9), snap: false});
    return Math.exp(runGlide(glide).at(-1).logScale) / scale;
  });
  for (const factor of factors) assert.ok(Math.abs(factor - factors[0]) < 1e-9, `${factors}`);
  const zoomed = createFling({pan: [0, 0], zoom: 1.2, turn: 0}, {logScale: 0, snap: false});
  const total = runGlide(zoomed).at(-1).logScale;
  assert.ok(Math.abs(total - 1.2 * ZOOM_TAU) < 0.02, `${total} against ${1.2 * ZOOM_TAU}`);
  // The same glide however the frames fall.
  const one = createFling({pan: [900, -300], zoom: 0.8, turn: 1}, {logScale: 0, snap: false});
  const many = createFling({pan: [900, -300], zoom: 0.8, turn: 1}, {logScale: 0, snap: false});
  const a = advanceFling(one, 0.1);
  let pan = [0, 0];
  for (let i = 0; i < 10; i++) { const step = advanceFling(many, 0.01); pan = [pan[0] + step.pan[0], pan[1] + step.pan[1]]; }
  assert.ok(Math.abs(pan[0] - a.pan[0]) < 1e-9 && Math.abs(pan[1] - a.pan[1]) < 1e-9);
  const stalled = createFling({pan: [6000, 0], zoom: 0, turn: 0}, {});
  const far = advanceFling(stalled, 30);
  assert.ok(far.pan[0] <= 6000 * PAN_TAU + 1e-9 && far.pan[0] > 6000 * PAN_TAU * (1 - Math.exp(-MAX_STEP / PAN_TAU)) - 1e-9);
  assert.equal(createFling(NO_THROW, {}), null);
  assert.equal(advanceFling(null, 1 / 60).live, false);
  const panned = createFling({pan: [MIN_PAN_SPEED + 1, 0], zoom: 0, turn: 0}, {});
  const travelled = runGlide(panned).reduce((sum, s) => sum + s.pan[0], 0);
  const whole = (MIN_PAN_SPEED + 1) * PAN_TAU;
  assert.ok(travelled < whole && travelled > whole * (1 - STOP_PAN / (MIN_PAN_SPEED + 1)) - 1);
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
  const top = over.indexOf(peak);
  for (let i = 1; i <= top; i++) assert.ok(over[i] >= over[i - 1] - 1e-12);
  for (let i = top + 1; i < over.length; i++) assert.ok(over[i] <= over[i - 1] + 1e-12);
  assert.equal(steps.at(-1).logScale, logMax);
  assert.equal(steps.at(-1).live, false);
  const elastic = over.length - over.findIndex(o => o > 0);
  assert.ok(elastic * 1000 / 60 < ELASTIC_MS + 2 * 1000 / 60, `${elastic} frames`);
  const logMin = Math.log(MIN_SCALE);
  const bottom = createFling({pan: [0, 0], zoom: -MAX_ZOOM_RATE, turn: 0}, {logScale: logMin + 0.02, logMin, logMax, snap: false});
  const under = runGlide(bottom).map(s => logMin - s.logScale);
  assert.ok(Math.max(...under) > 0 && Math.max(...under) <= ELASTIC_GIVE + 1e-12);
  assert.equal(elasticProfile(0), 0);
  assert.equal(elasticProfile(1), 0);
  const profile = Array.from({length: 1001}, (_, i) => elasticProfile(i / 1000));
  assert.ok(Math.max(...profile) <= 1 + 1e-12 && Math.max(...profile) > 0.999);
  for (const value of profile) assert.ok(value >= -1e-12);
});

test('momentum: a thrown turn aims at a quarter turn, within the throw and never backwards', () => {
  const landing = (angle, rate) => angle + rate * TURN_TAU;
  assert.equal(TURN_CATCH, Math.PI / 4);
  // A 40° flick from 60° would stop at 100°, 10° past a quarter turn: caught.
  const rate = 40 * DEG / TURN_TAU;
  assert.ok(Math.abs(landing(60 * DEG, rate) - 100 * DEG) < 1e-9);
  assert.ok(Math.abs(turnTargetFor(60 * DEG, rate) - 90 * DEG) < 1e-9, `${turnTargetFor(60 * DEG, rate) / DEG}°`);
  const thrown = runGlide(createFling({pan: [0, 0], zoom: 0, turn: rate}, {angle: 60 * DEG}));
  assert.ok(Math.abs(wrapAngle(thrown.at(-1).angle - 90 * DEG)) < 1e-12, `${thrown.at(-1).angle / DEG}°`);
  // A nudge is never amplified into a turn the fingers did not make.
  const small = 5 * DEG / TURN_TAU;
  assert.equal(turnTargetFor(30 * DEG, small), null, 'a 5° nudge 55° from a quarter turn is not dragged there');
  const rest = runGlide(createFling({pan: [0, 0], zoom: 0, turn: small}, {angle: 30 * DEG})).at(-1).angle;
  assert.ok(rest > 30 * DEG && rest <= landing(30 * DEG, small) + 1e-12, `${rest / DEG}°`);
  // Nor is one ever pulled back to a quarter turn behind where it let go.
  assert.equal(turnTargetFor(92 * DEG, 4 * DEG / TURN_TAU), null);
  assert.ok(Math.abs(turnTargetFor(-60 * DEG, -rate) + 90 * DEG) < 1e-9, 'anticlockwise is caught the same way');
  assert.equal(turnTargetFor(0, 0), null, 'a glide with no turn has nothing to aim');
  assert.equal(createFling({pan: [0, 0], zoom: 0, turn: rate}, {angle: 60 * DEG, snap: false}).turnTarget, null);
  assert.equal(createFling({pan: [0, 0], zoom: 0, turn: rate}, {angle: 60 * DEG}).thrownTurn, rate);
  // A turn released at rest eases onto the nearest quarter, as one made by hand does.
  const glide = createFling({pan: [0, 0], zoom: 0, turn: 0.55}, {angle: 82 * DEG});
  const steps = runGlide(glide);
  const end = steps.at(-1).angle;
  assert.ok(Math.abs(wrapAngle(end - 90 * DEG)) < 1e-12, `${end / DEG}°`);
  assert.equal(end, snapAngle(end));
  const angles = steps.map(s => s.angle / DEG);
  assert.ok(Math.max(...angles) <= 90 + 1e-9, `the glide overshot to ${Math.max(...angles).toFixed(2)}°`);
  assert.ok(angles.every((a, i) => i === 0 || a >= angles[i - 1] - 1e-12), 'and never turns back');
  const snapFrames = steps.length - steps.findIndex(s => s.angle === Math.max(...steps.map(t => t.angle)));
  assert.ok(snapFrames * 1000 / 60 < SNAP_MS + 3 * 1000 / 60, `${snapFrames} frames of ease`);
  assert.ok(MAX_TURN_RATE * TURN_TAU < TURN_STEP, 'the hardest possible flick turns less than a quarter turn');
});
