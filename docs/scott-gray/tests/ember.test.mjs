import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {GRID_SIZE, LOOP_SECONDS, INITIAL_PHASE, TILE_PIXELS} from '../ember/renderer.mjs';

const saved = await readFile(new URL('../data/equation-orbits/3ba87ed68bc2e4d16cd6.f32', import.meta.url));
const seed = await readFile(new URL('../ember/field.f32', import.meta.url));

test('standalone seed is the exact first frame of the requested verified orbit', () => {
  assert.equal(createHash('sha256').update(saved).digest('hex'), '3ba87ed68bc2e4d16cd689d679d041b50eedcf4d77ec6dc3caab6019c4bee818');
  assert.equal(seed.length, 2 * GRID_SIZE * GRID_SIZE * 4);
  assert.deepEqual(seed, saved.subarray(0, seed.length));
});

test('continuous phase rotation reproduces both channels of every saved frame', () => {
  const count = GRID_SIZE * GRID_SIZE;
  let maximum = 0;
  for (let frame = 0; frame < 32; frame++) {
    const angle = frame * 2 * Math.PI / 32, c = Math.cos(angle), s = Math.sin(angle);
    for (let i = 0; i < count; i++) {
      const u = seed.readFloatLE(4*i), v = seed.readFloatLE(4*(i+count));
      const offset = frame * count * 2;
      maximum = Math.max(maximum, Math.abs(u*c + v*s - saved.readFloatLE(4*(offset+i))), Math.abs(v*c - u*s - saved.readFloatLE(4*(offset+count+i))));
    }
  }
  assert.ok(maximum < 1.1e-7, `maximum sample error ${maximum}`);
  assert.equal(LOOP_SECONDS, 8 / 2, 'source speed=2');
  assert.equal(TILE_PIXELS * 3, 760, 'source desktop framing=simulation&tiles=3');
  assert.equal(INITIAL_PHASE, 0.552387499999992);
});
