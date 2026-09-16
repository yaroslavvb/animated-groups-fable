import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {FRAMES, GRID_SIZE, STYLES, TEXTURE_SIZE, upsampledVolume} from '../plume-monochrome/renderer.mjs';

const shipped = await readFile(new URL('../plume-monochrome/field.f32', import.meta.url));
const planar = new Float32Array(shipped.buffer, shipped.byteOffset, shipped.byteLength / 4);

test('the monochrome folder shares the viewer byte for byte with Plume', async () => {
  for (const name of ['app.mjs', 'renderer.mjs', 'field.f32']) {
    assert.deepEqual(await readFile(new URL(`../plume-monochrome/${name}`, import.meta.url)), await readFile(new URL(`../plume/${name}`, import.meta.url)), name);
  }
  const page = await readFile(new URL('../plume-monochrome/index.html', import.meta.url), 'utf8');
  assert.match(page, /<canvas id="pattern" data-style="monochrome"/);
  assert.deepEqual(STYLES, ['ember', 'monochrome']);
});

test('the monochrome volume is the half-turn antisymmetric part of U', () => {
  const n = TEXTURE_SIZE, plane = n * n;
  const ember = upsampledVolume(planar, 'ember'), mono = upsampledVolume(planar, 'monochrome');
  for (const frame of [0, 19, FRAMES - 1]) for (const [x, y] of [[0, 0], [1, 0], [7, 40], [48, 48], [95, 3]]) {
    const turned = ((n - y) % n) * n + (n - x) % n;
    assert.equal(mono[frame * plane + y * n + x], Math.fround(ember[frame * plane + y * n + x] - ember[frame * plane + turned]));
  }
  assert.throws(() => upsampledVolume(planar, 'sepia'));
});

test('half turn, half-period shift and quarter turn with quarter-period shift act as described', () => {
  const n = TEXTURE_SIZE, plane = n * n, mono = upsampledVolume(planar, 'monochrome');
  const w = (frame, x, y) => mono[(((frame % FRAMES) + FRAMES) % FRAMES) * plane + (((y % n) + n) % n) * n + (((x % n) + n) % n)];
  let reversal = 0, shift = 0, rotation = 0, spread = 0;
  for (let frame = 0; frame < FRAMES; frame += 5) for (let y = 0; y < n; y += 3) for (let x = 0; x < n; x += 3) {
    const value = w(frame, x, y);
    spread = Math.max(spread, Math.abs(value));
    reversal = Math.max(reversal, Math.abs(w(frame, -x, -y) + value));
    shift = Math.max(shift, Math.abs(w(frame + FRAMES / 2, x, y) + value));
    rotation = Math.max(rotation, Math.abs(w(frame + FRAMES / 4, -y, x) - value));
  }
  assert.ok(spread > 0.1, 'the antisymmetric part is not negligible');
  assert.ok(reversal < 1e-6 && shift < 1e-6 && rotation < 1e-6, `errors ${reversal} ${shift} ${rotation}`);
  assert.equal(GRID_SIZE * 2, TEXTURE_SIZE);
});
