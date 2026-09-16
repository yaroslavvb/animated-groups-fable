import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {FIELD_BYTES, FRAMES, GRID_SIZE, INITIAL_PHASE, LOOP_SECONDS, TEXTURE_SIZE, TILE_PIXELS, VALUE_RANGE, halfSampleKernel, scaleFor, upsample2, upsampledVolume} from '../p2-ember/renderer.mjs';

const saved = await readFile(new URL('../data/orbits/g96-F0p00395000-k0p02000000-N48-M128.f32', import.meta.url));
const shipped = await readFile(new URL('../p2-ember/field.f32', import.meta.url));
const planar = new Float32Array(shipped.buffer, shipped.byteOffset, shipped.byteLength / 4);
const count = GRID_SIZE * GRID_SIZE;
const at = (frame, x, y) => planar[frame * 2 * count + (((y % GRID_SIZE) + GRID_SIZE) % GRID_SIZE) * GRID_SIZE + (((x % GRID_SIZE) + GRID_SIZE) % GRID_SIZE)];

test('the shipped field is the verified orbit, byte for byte', () => {
  assert.equal(createHash('sha256').update(saved).digest('hex'), '731aa45654d4d690f202dc48818e47c8fe023bfd5462284a8601f4bed6563483');
  assert.equal(shipped.length, FIELD_BYTES);
  assert.deepEqual(shipped, saved);
});

test('the source view constants are reproduced', () => {
  assert.equal(LOOP_SECONDS, 8, 'source speed=1');
  assert.equal(TILE_PIXELS * 2, 760, 'source desktop framing=simulation&tiles=2');
  assert.equal(INITIAL_PHASE, 0);
  assert.equal(scaleFor(1440, 1000), TILE_PIXELS);
  assert.equal(scaleFor(390, 844), 195, 'two repeats across a narrow screen');
  let low = Infinity, high = -Infinity;
  for (let frame = 0; frame < FRAMES; frame++) for (let i = 0; i < count; i++) { const u = planar[frame * 2 * count + i]; low = Math.min(low, u); high = Math.max(high, u); }
  assert.deepEqual(VALUE_RANGE, [low, high], 'ranges.u of the saved orbit');
});

test('the saved orbit carries the quarter-turn time-shift symmetry exactly', () => {
  let maximum = 0;
  for (let frame = 0; frame < FRAMES; frame++) for (let y = 0; y < GRID_SIZE; y++) for (let x = 0; x < GRID_SIZE; x++) {
    maximum = Math.max(maximum, Math.abs(at((frame + FRAMES / 4) % FRAMES, -y, x) - at(frame, x, y)));
  }
  assert.equal(maximum, 0);
});

test('spectral doubling keeps every saved sample and matches a direct Fourier evaluation', () => {
  const n = 12, grid = Float64Array.from({length: n * n}, (_, i) => Math.sin(i * .37) + .3 * Math.cos((i % n) * 1.9) + ((i * 7919) % 13) / 13);
  const doubled = upsample2(grid, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) assert.ok(Math.abs(doubled[2 * y * 2 * n + 2 * x] - grid[y * n + x]) < 1e-6);
  // Reference: zero-padded spectrum with the Nyquist bin split half and half.
  const weight = k => Math.abs(k) === n / 2 ? .5 : 1;
  let maximum = 0;
  for (const [X, Y] of [[1, 0], [3, 5], [7, 7], [22, 13]]) {
    let value = 0;
    for (let ky = -n / 2; ky <= n / 2; ky++) for (let kx = -n / 2; kx <= n / 2; kx++) {
      let re = 0, im = 0;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const angle = -2 * Math.PI * (kx * x + ky * y) / n; re += grid[y * n + x] * Math.cos(angle); im += grid[y * n + x] * Math.sin(angle); }
      const angle = 2 * Math.PI * (kx * X + ky * Y) / (2 * n);
      value += weight(kx) * weight(ky) * (re * Math.cos(angle) - im * Math.sin(angle));
    }
    maximum = Math.max(maximum, Math.abs(doubled[Y * 2 * n + X] - value / (n * n)));
  }
  assert.ok(maximum < 1e-6, `maximum error ${maximum}`);
  assert.ok(Math.abs(halfSampleKernel(GRID_SIZE).reduce((a, b) => a + b, 0) - 1) < 1e-12, 'constant fields are preserved');
});

test('the GPU volume is every upsampled frame in x, y, time order', () => {
  const volume = upsampledVolume(planar);
  const plane = TEXTURE_SIZE * TEXTURE_SIZE;
  assert.equal(volume.length, plane * FRAMES);
  for (const frame of [0, 37, FRAMES - 1]) for (const [x, y] of [[0, 0], [5, 17], [47, 47]]) {
    assert.equal(volume[frame * plane + 2 * y * TEXTURE_SIZE + 2 * x], at(frame, x, y));
  }
  assert.ok(volume.every(Number.isFinite));
});
