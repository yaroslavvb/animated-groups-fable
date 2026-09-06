import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GROUP_DISPLAY} from '../overlay.mjs';
import {rotationCentres, markerKey, centreKey} from '../rotation-centres.mjs';
import {overlayTranslations} from '../overlay-data.mjs';

const p4 = JSON.parse(fs.readFileSync(new URL('../groups.json', import.meta.url))).map(group => ({...group, ...GROUP_DISPLAY[group.id], family: 'p4'}));
const p6 = JSON.parse(fs.readFileSync(new URL('../p6/groups.json', import.meta.url)));
const groups = [...p4, ...p6];
const mod = (x, n = 1) => ((x % n) + n) % n;
const close = (a, b, period = null) => period === null ? Math.abs(a - b) < 1e-8 : Math.min(mod(a - b, period), mod(b - a, period)) < 1e-8;
const apply = (M, x, v = [0, 0]) => M.map((row, i) => row[0] * x[0] + row[1] * x[1] + v[i]);
const build = (group, translations = [], omitOps = false) => rotationCentres({namedGenerators: group.namedGenerators, ...(omitOps ? {} : {ops: group.render.ops}), family: group.family, translations});

function counts(centres) {
  return ['α', 'β', 'γ'].map(name => centres.filter(centre => centre.name === name).length);
}

function angle(M, family) {
  const x = family === 'p6' ? M[0][0] - M[1][0] / 2 : M[0][0];
  const y = family === 'p6' ? -Math.sqrt(3) * M[1][0] / 2 : M[1][0];
  return Math.atan2(y, x) * 180 / Math.PI;
}

function audit(group, centres, translations = [[0, 0]]) {
  const byCentre = new Map(centres.map(centre => [centreKey(centre.centre), centre]));
  assert.equal(byCentre.size, centres.length, 'only the maximal rotation appears at each centre');
  for (const centre of centres) {
    assert.ok(apply(centre.matrix, centre.centre, centre.translation).every((x, i) => close(x, centre.centre[i])), `${centre.key} fixes its actual centre`);
    assert.ok(group.render.ops.some(op => JSON.stringify(op.M) === JSON.stringify(centre.matrix) && close(op.tau, centre.tau, 1) && translations.some(d => op.v.every((v, i) => close(v + d[i], centre.translation[i], 1)))), `${centre.key} is a canonical operation composed with a certified translation`);
    for (const op of group.render.ops) for (const d of translations) {
      const mapped = apply(op.M, centre.centre, op.v.map((v, i) => v + d[i]));
      const target = byCentre.get(centreKey(mapped));
      assert.ok(target, `${group.id} ${centre.key} has every conjugate`);
      assert.equal(target.order, centre.order);
      assert.ok(close(target.tau, centre.tau, 1), 'conjugacy preserves the phase character');
      assert.ok(close(target.glyphAngle, centre.glyphAngle + angle(op.M, group.family), 360 / centre.order), `${group.id} ${centre.key} glyph is equivariant`);
    }
  }
}

test('all twelve groups include every base rotation centre, with equivariant glyphs and exact affine operations', () => {
  for (const group of groups) {
    const centres = build(group);
    assert.deepEqual(counts(centres), group.family === 'p6' ? [1, 2, 3] : ['g98', 'g99'].includes(group.id) ? [2, 2, 4] : [1, 1, 2], group.id);
    assert.ok(centres.every(centre => centre.extra === false));
    audit(group, centres);
  }
});

test('omitted canonical operations are reconstructed from the three named generators', () => {
  for (const group of groups) {
    const expected = build(group), actual = build(group, [], true);
    assert.deepEqual(actual.map(centre => centre.key), expected.map(centre => centre.key), group.id);
    for (let i = 0; i < actual.length; i++) assert.ok(close(actual[i].glyphAngle, expected[i].glyphAngle, 360 / actual[i].order));
    audit(group, actual);
  }
});

test('original surviving markers preserve their labels, phases, outlines, and glyph orientations', () => {
  for (const group of groups) for (const source of group.namedGenerators) {
    const centre = build(group).find(item => centreKey(item.centre) === centreKey(source.centre));
    assert.equal(centre.name, source.name);
    assert.equal(centre.path, source.path);
    assert.ok(close(centre.tau, source.tau, 1));
    assert.ok(close(centre.glyphAngle, 0, 360 / source.order));
  }
});

test('shell-3 translations reveal three sixfold, six threefold, and nine twofold centres', () => {
  const group = p6.find(item => item.id === 'g248');
  const translations = [[0, 0], [1 / 3, 2 / 3], [2 / 3, 1 / 3]];
  const centres = build(group, [{v: translations[1], rms: 1e-8, max: 1e-7}]);
  assert.deepEqual(counts(centres), [3, 6, 9]);
  audit(group, centres, translations);
  for (const oldBeta of build(group).filter(item => item.name === 'β')) {
    const replacement = centres.find(item => centreKey(item.centre) === centreKey(oldBeta.centre));
    assert.equal(replacement.name, 'α', 'old threefold centre is subsumed by a newly detected sixfold centre');
    assert.equal(replacement.order, 6);
    assert.equal(replacement.extra, true);
    assert.ok(close(replacement.tau, 1 / 6));
  }
  assert.ok(centres.filter(item => item.name === 'β').every(item => item.extra));
  assert.ok(centres.filter(item => item.name === 'β').every(item => close(item.tau, 1 / 3)));
  assert.ok(centres.filter(item => item.name === 'γ').every(item => close(item.tau, 1 / 2)));
});

test('fixed-point enumeration finds ninth-coordinate centres that conjugating old centres misses', () => {
  const group = p6.find(item => item.id === 'g248');
  // Conjugating (1/3,1/3) by R60 generates the full index-nine translation group.
  const translations = Array.from({length: 9}, (_, i) => [Math.floor(i / 3) / 3, i % 3 / 3]);
  const centres = build(group, [{v: [1 / 3, 1 / 3]}]);
  assert.deepEqual(counts(centres), [9, 18, 27]);
  assert.ok(centres.some(item => item.name === 'β' && item.centre.some(x => close(x, 1 / 9) || close(x, 2 / 9))));
  audit(group, centres, translations);
});

test('extra square-lattice centres retain the distinct quarter-period phases', () => {
  for (const id of ['g96', 'g97', 'g99']) {
    const group = p4.find(item => item.id === id), translations = [[0, 0], [1 / 3, 0], [2 / 3, 0], [0, 1 / 3], [0, 2 / 3], [1 / 3, 1 / 3], [1 / 3, 2 / 3], [2 / 3, 1 / 3], [2 / 3, 2 / 3]];
    const centres = build(group, [{v: [1 / 3, 0]}]);
    assert.equal(centres.length, build(group).length * 9);
    audit(group, centres, translations);
  }
});

test('marker keys are stable across cell translates and avoid negative zero', () => {
  assert.equal(markerKey('α', [-0, 1]), 'α@0,0');
  assert.equal(markerKey('β', [-1 / 3, -2 / 3]), 'β@0.666666667,0.333333333');
  assert.equal(markerKey('γ', [1.5, -.5]), 'γ@0.5,0.5');
});

test('phase-changing translations cannot be silently relabelled as same-time translations', () => {
  const group = p4.find(item => item.id === 'g98');
  assert.throws(() => build(group, [{v: [.5, .5]}]), /incompatible rotation phases/);
});

test('glyph rotations are only inferred from rotations supported by the lattice', () => {
  assert.throws(() => rotationCentres({namedGenerators: p4[0].namedGenerators, ops: [{M: [[1, 1], [0, 1]], v: [0, 0], tau: 0}]}), /Unsupported rotation/);
});

test('every published field has complete, phase-correct centres and equivariant glyphs using its own translation certificate', () => {
  const index = JSON.parse(fs.readFileSync(new URL('../data/overlay-translations.json', import.meta.url)));
  const records = [
    ...JSON.parse(fs.readFileSync(new URL('../data/precomputed-atlas.json', import.meta.url))).orbits,
    ...JSON.parse(fs.readFileSync(new URL('../p6/data/precomputed-atlas.json', import.meta.url))).orbits,
  ];
  assert.equal(records.length, 207);
  for (const record of records) {
    const group = groups.find(item => item.id === record.groupId);
    const translations = overlayTranslations(index, record);
    assert.equal(translations.length, index.orbits[record.id].translations.length, record.id);
    assert.ok(translations.length > 0, record.id);
    const centres = build(group, translations);
    audit(group, centres, translations.map(item => item.v));
    assert.equal(centres.length, build(group).length * translations.length, record.id);
  }
});
