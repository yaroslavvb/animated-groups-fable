import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {FIELD_BYTES, FRAMES, GRID_SIZE, INITIAL_PHASE, LOOP_SECONDS, MAX_SCALE, MIN_SCALE, TEXTURE_SIZE, TILE_PIXELS, VALUE_RANGE, createGovernor, createView, cubicWeights, frameAt, halfSampleKernel, scaleFor, upsample2, upsampledVolume} from '../plume/renderer.mjs';

const saved = await readFile(new URL('../data/orbits/g96-F0p00395000-k0p02000000-N48-M128.f32', import.meta.url));
const shipped = await readFile(new URL('../plume/field.f32', import.meta.url));
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

test('frameAt reproduces saved frames exactly and blends between them with Catmull–Rom weights', () => {
  const volume = upsampledVolume(planar), plane = TEXTURE_SIZE * TEXTURE_SIZE;
  for (const frame of [0, 1, 77, FRAMES - 1]) {
    assert.deepEqual(frameAt(volume, frame / FRAMES), volume.subarray(frame * plane, (frame + 1) * plane));
  }
  // Between frames 127 and 0 the blend wraps around the period.
  const between = frameAt(volume, (FRAMES - 0.6) / FRAMES), [w0, w1, w2, w3] = cubicWeights(0.4);
  for (const i of [0, 4321, plane - 1]) {
    const expected = w0 * volume[126 * plane + i] + w1 * volume[127 * plane + i] + w2 * volume[i] + w3 * volume[plane + i];
    assert.ok(Math.abs(between[i] - expected) < 1e-6);
  }
  assert.ok(Math.abs(cubicWeights(0.3).reduce((a, b) => a + b, 0) - 1) < 1e-12, 'weights sum to one');
  assert.deepEqual(frameAt(volume, 1), frameAt(volume, 0), 'phase 1 is phase 0');
});

test('the view pans endlessly, zooms about the pointer, and returns home', () => {
  const view = createView();
  const size = [1440, 1000];
  assert.equal(view.scale(...size), TILE_PIXELS);
  assert.equal(view.scale(390, 844), 195, 'responsive default until the viewer zooms');
  assert.deepEqual(view.center, [0, 0], '(1, 1) wraps to the origin');
  assert.ok(view.isHome());
  view.panBy(380, -190, ...size);
  assert.deepEqual(view.center.map(v => +v.toFixed(9)), [0, 0.5], 'dragging right by one repeat changes nothing; up by half a repeat moves the centre down');
  assert.ok(!view.isHome());
  const point = [100, 900], before = view.latticeAt(point, ...size);
  view.zoomAt(2.5, point, ...size);
  const after = view.latticeAt(point, ...size);
  const same = (a, b) => Math.abs(a - b - Math.round(a - b)) < 1e-9; // equal up to whole repeats
  assert.ok(same(before[0], after[0]) && same(before[1], after[1]), 'the lattice point under the pointer stays put');
  assert.equal(view.scale(...size), 2.5 * TILE_PIXELS);
  assert.equal(view.scale(390, 844), 2.5 * TILE_PIXELS, 'a zoomed scale no longer follows the canvas size');
  view.zoomAt(1e9, [0, 0], ...size);
  assert.equal(view.scale(...size), MAX_SCALE);
  view.zoomAt(1e-9, [0, 0], ...size);
  assert.equal(view.scale(...size), MIN_SCALE);
  const snapshot = view.snapshot();
  view.reset();
  assert.ok(view.isHome()); assert.equal(view.scale(390, 844), 195);
  view.restore(snapshot);
  assert.equal(view.scale(...size), MIN_SCALE);
  const fixed = createView({tilePixels: 500, minScale: 100, maxScale: 1000, center: [0.25, 2.75]});
  assert.equal(fixed.scale(390, 844), 500, 'scale= fixes the initial scale');
  assert.deepEqual(fixed.center, [0.25, 0.75]);
  fixed.zoomAt(4, [0, 0], ...size); assert.equal(fixed.scale(...size), 1000);
  fixed.reset(); assert.equal(fixed.scale(...size), 500); assert.ok(fixed.isHome());
});

test('a two-finger gesture keeps the anchored lattice point under the moving midpoint while scaling', () => {
  const view = createView(), size = [390, 844];
  const anchor = view.latticeAt([150, 400], ...size), scale0 = view.scale(...size);
  view.pin(anchor, [200, 300], scale0 * 2, ...size);
  assert.equal(view.scale(...size), 2 * scale0);
  const moved = view.latticeAt([200, 300], ...size);
  const same = (a, b) => Math.abs(a - b - Math.round(a - b)) < 1e-9;
  assert.ok(same(moved[0], anchor[0]) && same(moved[1], anchor[1]));
  view.pin(anchor, [50, 50], undefined, ...size);
  assert.equal(view.scale(...size), 2 * scale0, 'a one-finger pin leaves the scale alone');
});

test('the adaptive-resolution governor lowers quality only when it speeds the cadence up, and climbs back', () => {
  const run = (governor, count, interval, start) => { for (let i = 0; i < count; i++) governor.tick(start + i * interval, true); return start + count * interval; };
  // A 120 Hz display (measured while idle) whose GPU only manages every other frame at full resolution.
  let g = createGovernor({display: 8.33}), now = 0;
  now = run(g, 46, 16.7, now);
  assert.ok(Math.abs(g.quality - 0.85) < 1e-9, 'late frames start a probe');
  now = run(g, 46, 8.33, now);
  assert.ok(Math.abs(g.quality - 0.85) < 1e-9, 'the faster cadence confirms the probe');
  now = run(g, 46 * 6, 8.33, now + 3000);
  assert.equal(g.quality, 1, 'quality climbs back after frames stay on time');
  // A display that simply runs at 60 Hz never triggers a probe.
  g = createGovernor(); now = run(g, 46 * 4, 16.7, 0); assert.equal(g.quality, 1); assert.ok(Math.abs(g.display - 16.7) < 1e-9);
  // A requested probe (a touch) that does not help is reverted after two steps.
  g.probeSoon(now); now = run(g, 46, 16.7, now); const first = g.quality; assert.ok(first < 1, 'probe step one');
  now = run(g, 46, 16.7, now); assert.ok(g.quality < first, 'probe step two');
  now = run(g, 46, 16.7, now); assert.equal(g.quality, 1, 'reverted');
  g.probeSoon(now); now = run(g, 46 * 2, 16.7, now); assert.equal(g.quality, 1, 'requests are limited to one per 30 s');
  // A probe abandoned by a pause is reverted immediately.
  g = createGovernor({display: 8.33}); now = run(g, 46, 16.7, 0); assert.ok(g.quality < 1); g.tick(now + 50, false); assert.equal(g.quality, 1);
  // Sporadic draws never adapt; a pinned pixel ratio disables the governor.
  g = createGovernor(); for (let i = 0; i < 200; i++) g.tick(i * 50, false); assert.equal(g.quality, 1);
  g = createGovernor({enabled: false}); run(g, 200, 33, 0); assert.equal(g.quality, 1);
});
