import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {primitiveCell, cellToLattice, latticeToCell, latticeToPhysical, physicalToLattice} from '../cell-geometry.mjs';

const read = name => JSON.parse(fs.readFileSync(new URL(`../data/${name}`, import.meta.url)));
const strict = read('overlay-translations.json');
const approximate = read('overlay-near-translations.json');
const close = (actual, expected, message = '') => assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} ≠ ${expected}`);
const closeVector = (actual, expected, message = '') => actual.forEach((entry, i) => close(entry, expected[i], message));
const integerVector = (vector, message) => vector.forEach(entry => close(entry, Math.round(entry), message));
const determinant = ([a, b]) => a[0] * b[1] - a[1] * b[0];
const length = vector => Math.hypot(...vector);

function audit(record) {
  const cell = primitiveCell({family: record.family, translations: record.translations});
  assert.equal(cell.index, record.translations.length);
  close(determinant(cell.basis), 1 / cell.index, 'primitive lattice area');
  assert.ok(determinant(cell.physicalBasis) > 0, 'positive physical orientation');
  const [a, b] = cell.physicalBasis;
  close(length(a), cell.sideLength, 'first edge length');
  close(length(b), cell.sideLength, 'second edge length');
  close((a[0] * b[0] + a[1] * b[1]) / cell.sideLength ** 2, record.family === 'p6' ? -.5 : 0, 'cell edge angle');
  close(cell.physicalArea, determinant(cell.physicalBasis), 'physical area');
  assert.ok(cell.angle >= 0 && cell.angle < (record.family === 'p6' ? Math.PI / 3 : Math.PI / 2), 'canonical basis angle');
  for (const item of [...record.translations, {v: [1, 0]}, {v: [0, 1]}]) {
    integerVector(latticeToCell(item.v, cell), 'every supplied translation is an integer cell displacement');
  }
  for (const point of [[0, 0], [1, 0], [0, 1], [.17, -.81], [17.4, 9.1]]) {
    closeVector(latticeToCell(cellToLattice(point, cell), cell), point, 'cell mapping round trip');
    closeVector(physicalToLattice(latticeToPhysical(point, record.family), record.family), point, 'physical mapping round trip');
  }
  const rotate = record.family === 'p6' ? ([u, v]) => [u - v, u] : ([u, v]) => [-v, u];
  for (const point of [[1, 0], [0, 1], [.19, .72]]) {
    closeVector(latticeToCell(rotate(cellToLattice(point, cell)), cell), rotate(point), 'normalization preserves generator rotation');
  }
  // Reordering data and choosing another integer representative cannot change
  // the cell orientation or its exact physical correspondence to the field.
  const reordered = primitiveCell({family: record.family, translations: [...record.translations].reverse().map(({v}) => [v[0] + 3, v[1] - 4])});
  for (let i = 0; i < 2; i++) closeVector(reordered.basis[i], cell.basis[i], 'deterministic cell basis');
}

test('all 207 saved strict translation groups have correctly scaled primitive cells', () => {
  assert.equal(Object.keys(strict.orbits).length, 207);
  for (const record of Object.values(strict.orbits)) audit(record);
});

test('all 30 approximate repeat groups have separate valid geometry containing their strict lattice', () => {
  assert.equal(Object.keys(approximate.orbits).length, 30);
  for (const [id, record] of Object.entries(approximate.orbits)) {
    assert.equal(record.classification, 'approximate-only');
    audit(record);
    const cell = primitiveCell({family: record.family, translations: record.translations});
    const strictRecord = strict.orbits[id];
    assert.ok(cell.index > strictRecord.translations.length);
    for (const item of strictRecord.translations) integerVector(latticeToCell(item.v, cell), 'approximate lattice includes every strict period');
  }
});

test('the reported Q12 and Q31 examples scale by their actual repeat lattices', () => {
  const q12 = Object.entries(strict.orbits).find(([id]) => id.startsWith('saved:g247-') && id.includes('-Q12-'))[1];
  const q31 = Object.entries(approximate.orbits).find(([id]) => id.startsWith('saved:g247-') && id.includes('-Q31-'))[1];
  const exactCell = primitiveCell({family: 'p6', translations: q12.translations});
  const approximateCell = primitiveCell({family: 'p6', translations: q31.translations});
  closeVector(exactCell.basis[0], [1 / 3, 1 / 6]);
  closeVector(exactCell.basis[1], [-1 / 6, 1 / 6]);
  close(exactCell.sideLength, 1 / Math.sqrt(12));
  closeVector(approximateCell.basis[0], [6 / 31, 5 / 31]);
  closeVector(approximateCell.basis[1], [-5 / 31, 1 / 31]);
  close(approximateCell.sideLength, 1 / Math.sqrt(31));
});

test('the identity groups preserve the original square and triangular coordinate bases', () => {
  for (const family of ['p4', 'p6']) {
    const cell = primitiveCell({family});
    assert.deepEqual(cell.basis, [[1, 0], [0, 1]]);
    assert.deepEqual(cell.inverse, [[1, 0], [0, 1]]);
    assert.equal(cell.index, 1);
    assert.equal(cell.sideLength, 1);
  }
});

test('incomplete or non-rotational period sets are rejected instead of fabricating cells', () => {
  assert.throws(() => primitiveCell({translations: [[1 / 3, 0]]}), /complete finite group/);
  assert.throws(() => primitiveCell({translations: [[.5, 0]]}), /rotation invariant/);
  assert.throws(() => primitiveCell({family: 'p6', translations: [[.5, .5]]}), /rotation invariant/);
  assert.throws(() => primitiveCell({translations: [[Infinity, 0]]}), /finite coordinate pairs/);
  assert.throws(() => primitiveCell({family: 'p3'}), /Unsupported cell family/);
});
