import test from 'node:test';
import assert from 'node:assert/strict';
import { readViewState, writeViewHash } from '../view-state.mjs';

const defaults = {
  groupId: null, patternId: null, palette: 'ember', tiles: 2, speed: 1,
  generator: null, overlay: false, phase: 0, play: true,
};

test('legacy links in both families retain autoplay and default controls', () => {
  for (const groupId of ['g95', 'g248']) {
    assert.deepEqual(readViewState(`#${groupId}`), { ...defaults, groupId });
  }
  for (const hash of ['', '#', null, undefined, '#not-a-group']) {
    assert.deepEqual(readViewState(hash), defaults);
  }
});

test('selected pattern and every view control round-trip without phase rounding', () => {
  const view = {
    groupId: 'g248', patternId: 'saved:g248-F0.02-k0.05-N64-M96',
    palette: 'ceramic', tiles: 3, speed: 0.5, generator: 'β',
    overlay: true, phase: 0.1371234567890123, play: false,
  };
  const hash = writeViewHash(view);
  assert.equal(hash, '#g248?v=1&pattern=saved%3Ag248-F0.02-k0.05-N64-M96&palette=ceramic&tiles=3&speed=0.5&generator=%CE%B2&overlay=1&phase=0.1371234567890123&play=0');
  assert.deepEqual(readViewState(hash), view);
  assert.equal(writeViewHash(readViewState(hash)), hash);
});

test('Unicode and reserved characters in stable pattern IDs survive URL encoding', () => {
  const patternId = 'saved:g95 α / β?phase=0.8&play=1#fragment+%';
  const view = { ...defaults, groupId: 'g95', patternId, generator: 'γ', play: false };
  const hash = writeViewHash(view);
  assert.deepEqual(readViewState(hash), view);
  assert.equal(new URL(`https://example.org/scott-gray/${hash}`).hash, hash);
});

test('unknown or missing schema versions preserve only the valid group', () => {
  for (const query of ['v=2&play=0&tiles=3', 'v=garbage&pattern=saved%3Ax', 'play=0&tiles=3']) {
    assert.deepEqual(readViewState(`#g96?${query}`), { ...defaults, groupId: 'g96' });
  }
});

test('invalid controls fall back independently while valid controls survive', () => {
  assert.deepEqual(readViewState('#g97?v=1&pattern=&palette=unknown&tiles=99&speed=0&generator=x&overlay=true&phase=Infinity&play=false'), { ...defaults, groupId: 'g97' });
  assert.deepEqual(readViewState('#g98?v=1&palette=concentration&tiles=1&speed=2&generator=%CE%B1&overlay=1&phase=0.75&play=0'), {
    ...defaults, groupId: 'g98', palette: 'concentration', tiles: 1, speed: 2,
    generator: 'α', overlay: true, phase: 0.75, play: false,
  });
  assert.deepEqual(readViewState('#g95?v=1&pattern=%20%20&tiles=&speed=&phase=&overlay=&play='), { ...defaults, groupId: 'g95' });
});

test('invalid phase inputs cannot produce nonfinite playback; one wraps to zero', () => {
  for (const phase of ['-1', '1.1', 'NaN', 'Infinity', '-Infinity', 'wat', '1']) {
    const state = readViewState(`#g95?v=1&phase=${phase}`);
    assert.equal(state.phase, 0);
  }
  assert.equal(readViewState('#g95?v=1&phase=1e-12').phase, 1e-12);
});

test('pattern identifiers are bounded while catalog membership is left to the gallery', () => {
  assert.equal(readViewState(`#g95?v=1&pattern=${'x'.repeat(513)}`).patternId, null);
  assert.equal(readViewState(`#g95?v=1&pattern=${'x'.repeat(512)}`).patternId.length, 512);
  // Syntactically valid IDs are deliberately left for the catalog to validate.
  assert.equal(readViewState('#g95?v=1&pattern=removed-pattern').patternId, 'removed-pattern');
});

test('writer handles default, empty, and malformed states safely', () => {
  assert.equal(writeViewHash(null), '');
  assert.equal(writeViewHash({ groupId: 'g95?x=1' }), '');
  assert.equal(writeViewHash({ groupId: 'g95' }), '#g95?v=1&palette=ember&tiles=2&speed=1&overlay=0&phase=0&play=1');
  assert.deepEqual(readViewState(writeViewHash({ groupId: 'g95', tiles: '3', speed: '0.5', phase: NaN, play: false })), {
    ...defaults, groupId: 'g95', tiles: 3, speed: 0.5, play: false,
  });
});

test('malformed percent escapes do not throw or change unrelated controls', () => {
  const state = readViewState('#g95?v=1&generator=%E0%A4%A&palette=ceramic&play=0');
  assert.equal(state.generator, null);
  assert.equal(state.palette, 'ceramic');
  assert.equal(state.play, false);
});
