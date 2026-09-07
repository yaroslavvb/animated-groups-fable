import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalMotionCatalog, localMotionCentreKey} from '../local-motion.mjs';
import {makeWallpaperCellView} from '../wallpaper-cell.mjs';

const HASH = 'ab'.repeat(32), OTHER_HASH = 'cd'.repeat(32);
const record = {id: 'saved:motion-fixture', groupId: 'g95', fieldSha256: HASH, config: {N: 32, M: 96}};
const group = {id: 'g95', lattice: 'square', basis: [[1, 0], [0, 1]]};
const camera = {originalToScreen: ([x, y]) => [x, y]};
const measurement = (changes = {}) => ({centre: [0.25, 0.5], sign: 1, status: 'rotation', confidence: 'high', evidence: {agreement: 0.99, annuli: [0.06, 0.09]}, ...changes});
const entry = (changes = {}) => ({id: record.id, fieldSha256: HASH, N: 32, M: 96, lattice: 'square', centres: [measurement()], ...changes});
const artifact = (records = [entry()]) => ({schema: 'scott-gray-local-motion-v1', methodVersion: 'polar-motion-v1', records});
const get = (catalog, r = record, g = group, view = camera) => catalog.forRecord(r, g, view).get('0.25,0.5');

test('physical rotation directions follow actual square and triangular cameras in both framings', () => {
  for (const lattice of ['square', 'triangular']) for (const framing of ['cells', 'simulation']) {
    const g = {id: group.id, lattice};
    const view = makeWallpaperCellView({lattice, framing, count: 2, translations: [[0, 0], [0.5, 0.5]]});
    for (const sign of [1, -1]) {
      const catalog = createLocalMotionCatalog(artifact([entry({lattice, centres: [measurement({sign})]})]));
      const expected = (lattice === 'square' ? sign : -sign) > 0 ? 'clockwise' : 'counterclockwise';
      assert.equal(get(catalog, record, g, view).direction, expected, `${lattice} ${framing} sign=${sign}`);
    }
  }
});

test('camera and physical-basis reflections each reverse screen direction', () => {
  const catalog = createLocalMotionCatalog(artifact());
  const reflected = {originalToScreen: ([x, y]) => [3 + x, 4 - y]};
  const reversedBasis = {...group, basis: [[1, 0], [0, -1]]};
  assert.equal(get(catalog).direction, 'clockwise');
  assert.equal(get(catalog, record, group, reflected).direction, 'counterclockwise');
  assert.equal(get(catalog, record, reversedBasis).direction, 'counterclockwise');
  assert.equal(get(catalog, record, reversedBasis, reflected).direction, 'clockwise');
  assert.equal(get(catalog, record, group, {latticeToScreen: camera.originalToScreen}).direction, 'clockwise');
});

test('periodic centres, negative coordinates, and rounded seams use the same keys', () => {
  for (const point of [[-0.75, 1.5], [0.25, 0.5], [2.25, -2.5]]) assert.equal(localMotionCentreKey(point), '0.25,0.5');
  for (const point of [[1, -1], [-1e-12, 1 + 1e-12], [0.9999999999, 0]]) assert.equal(localMotionCentreKey(point), '0,0');
  assert.equal(localMotionCentreKey([1 / 3, 2 / 3]), '0.333333333,0.666666667');
  for (const point of [null, [NaN, 0], [Infinity, 0], ['0', 0], [0], [0, 0, 0]]) assert.equal(localMotionCentreKey(point), null);
  const catalog = createLocalMotionCatalog(artifact([entry({centres: [measurement({centre: [-0.75, 1.5]})]})]));
  assert.equal(get(catalog).direction, 'clockwise');
  assert.deepEqual(get(catalog).centre, [0.25, 0.5]);
});

test('metadata is bound to the exact record, field bytes, dimensions, and lattice', () => {
  const catalog = createLocalMotionCatalog(artifact());
  for (const r of [null, {...record, id: 'other'}, {...record, fieldSha256: OTHER_HASH}, {...record, fieldSha256: ''},
    {...record, fieldSha256: [HASH]}, {...record, fieldSha256: HASH + '\n'},
    {...record, config: {...record.config, N: 64}}, {...record, config: {...record.config, M: 48}},
    {...record, N: 64}, {...record, lattice: 'triangular'}, {...record, groupId: 'g96'}]) {
    assert.equal(catalog.forRecord(r, group, camera).size, 0);
  }
  assert.equal(catalog.forRecord(record, {...group, lattice: 'triangular'}, camera).size, 0);
  assert.equal(catalog.forRecord(record, null, camera).size, 0);
  assert.equal(get(catalog, {...record, fieldSha256: HASH.toUpperCase()}).direction, 'clockwise');
  assert.equal(get(catalog, {id: record.id, fieldSha256: HASH, N: 32, M: 96}).direction, 'clockwise');
});

test('ambiguous, weak, mixed, and under-resolved measurements never draw arrows', () => {
  for (const status of ['no-clear-rotation', 'mixed-motion', 'under-resolved', 'ambiguous']) {
    const catalog = createLocalMotionCatalog(artifact([entry({centres: [measurement({status})]})]));
    assert.equal(get(catalog).status, status);
    assert.equal(get(catalog).direction, null);
  }
  for (const changes of [{sign: null}, {sign: 0}, {sign: '1'}, {confidence: 'unknown'}, {confidence: 0.99},
    {status: 'spinning'}, {evidence: null}, {evidence: []}, {evidence: {bad: Infinity}}]) {
    const catalog = createLocalMotionCatalog(artifact([entry({centres: [measurement(changes)]})]));
    assert.equal(get(catalog).status, 'ambiguous');
    assert.equal(get(catalog).direction, null);
  }
});

test('missing, malformed, and duplicate record metadata fail closed', () => {
  for (const data of [null, {}, artifact(null), {...artifact(), schema: 'other'}, {...artifact(), methodVersion: ''},
    artifact([entry({fieldSha256: 'not-a-hash'})]), artifact([entry({fieldSha256: [HASH]})]), artifact([entry({fieldSha256: HASH + '\n'})]),
    artifact([entry({N: '32'})]), artifact([entry({M: 0})]),
    artifact([entry({lattice: 'unknown'})]), artifact([entry({centres: null})]), artifact([entry(), entry()]),
    artifact([entry({fieldSha256: OTHER_HASH}), entry()])]) {
    assert.equal(createLocalMotionCatalog(data).forRecord(record, group, camera).size, 0);
  }
  const catalog = createLocalMotionCatalog(artifact([entry({centres: [null, measurement({centre: [NaN, 0]})]})]));
  assert.equal(catalog.forRecord(record, group, camera).size, 0);
});

test('conflicting periodic aliases are ambiguous while duplicate agreeing measurements remain consistent', () => {
  const aliased = measurement({centre: [-0.75, 1.5]});
  const agreeing = createLocalMotionCatalog(artifact([entry({centres: [measurement(), aliased]})]));
  assert.equal(agreeing.forRecord(record, group, camera).size, 1);
  assert.equal(get(agreeing).direction, 'clockwise');
  const conflicting = createLocalMotionCatalog(artifact([entry({centres: [measurement(), {...aliased, sign: -1}, measurement()]})]));
  assert.equal(get(conflicting).status, 'ambiguous');
  assert.equal(get(conflicting).direction, null);
});

test('unknown, singular, or throwing camera orientations do not invent a direction', () => {
  const catalog = createLocalMotionCatalog(artifact());
  for (const view of [null, {}, {originalToScreen: () => [0, 0]}, {originalToScreen: () => [NaN, 0]},
    {originalToScreen: () => {throw Error('no camera');}}]) assert.equal(get(catalog, record, group, view).direction, null);
  for (const basis of [[], [[1, 0], [2, 0]], [[NaN, 0], [0, 1]]]) {
    assert.equal(get(catalog, record, {...group, basis}).direction, null);
  }
});

test('catalog snapshots its evidence and returns maps that cannot mutate subsequent lookups', () => {
  const data = artifact(), catalog = createLocalMotionCatalog(data);
  data.records[0].centres[0].sign = -1;
  data.records[0].centres[0].evidence.annuli[0] = 99;
  const first = catalog.forRecord(record, group, camera), item = first.get('0.25,0.5');
  assert.equal(item.direction, 'clockwise');
  assert.equal(item.evidence.annuli[0], 0.06);
  assert.throws(() => {item.evidence.annuli[0] = 42;}, TypeError);
  assert.throws(() => {item.direction = 'counterclockwise';}, TypeError);
  first.clear();
  assert.equal(get(catalog).direction, 'clockwise');
});

test('lookup never reads movie samples or recomputes motion', () => {
  const catalog = createLocalMotionCatalog(artifact());
  const withoutReadableField = {...record};
  Object.defineProperty(withoutReadableField, 'field', {get() {throw Error('Movie samples must not be read.');}});
  assert.equal(get(catalog, withoutReadableField).direction, 'clockwise');
});
