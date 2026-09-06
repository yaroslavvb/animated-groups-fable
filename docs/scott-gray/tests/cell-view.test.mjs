import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {primitiveCell, cellToLattice} from '../cell-geometry.mjs';
import {makeCellView, cellCountLabel, cellGuideMarkup, CELL_VIEW_PADDING} from '../cell-view.mjs';
import {screenPointToLattice, viewTransform} from '../view-transform.mjs';

const read = name => JSON.parse(fs.readFileSync(new URL(`../data/${name}`, import.meta.url)));
const strict = read('overlay-translations.json');
const near = read('overlay-near-translations.json');
const close = (actual, expected, message = '') => assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} ≠ ${expected}`);
const vectorClose = (actual, expected, message = '') => actual.forEach((value, axis) => close(value, expected[axis], message));

function audit(record) {
  const cell = primitiveCell({family: record.family, translations: record.translations});
  const unchanged = JSON.stringify(cell);
  for (const count of [1, 2, 3]) {
    const view = makeCellView(cell, count);
    const transform = viewTransform(view.viewOptions);
    assert.equal(view.countLabel, count === 1 ? '1 cell' : `${count} × ${count} cells`);
    vectorClose(view.originalToScreen(view.viewOptions.viewOrigin), [.5, .5], 'camera centred on entire requested cell block');
    for (const point of [[0, 0], [count, 0], [0, count], [count, count], [.17 * count, .81 * count], [-.13, .42], [count + .5, count + 1]]) {
      const original = cellToLattice(point, cell), screen = view.originalToScreen(original);
      vectorClose(view.screenToOriginal(screen), original, 'overlay-to-field camera round trip');
      vectorClose(screenPointToLattice(screen, transform), original, 'overlay point reaches exactly the same original field coordinate');
      vectorClose(view.cellToScreen(point), screen, 'cell boundaries and markers use the same camera');
      assert.equal(view.contains(original), point.every(value => value >= 0 && value <= count), 'only centres in the selected cell block are admitted');
    }
    close(Math.min(...view.corners.map(point => point[0])), CELL_VIEW_PADDING, 'left edge fits the requested complete cells');
    close(Math.max(...view.corners.map(point => point[0])), 1 - CELL_VIEW_PADDING, 'right edge fits the requested complete cells');
    assert.ok(view.corners.flat().every(value => value >= CELL_VIEW_PADDING - 1e-8 && value <= 1 - CELL_VIEW_PADDING + 1e-8), 'all four boundary corners are on screen');
    const first = view.cellToScreen([1, 0]).map((value, axis) => value - view.cellToScreen([0, 0])[axis]);
    const second = view.cellToScreen([0, 1]).map((value, axis) => value - view.cellToScreen([0, 0])[axis]);
    close(Math.hypot(...first), Math.hypot(...second), 'cell aspect ratio is physically correct');
    close((first[0] * second[0] + first[1] * second[1]) / Math.hypot(...first) ** 2, record.family === 'p6' ? -.5 : 0, 'correct lattice angle after camera rotation');
    assert.equal(Math.sign(first[0] * second[1] - first[1] * second[0]), record.family === 'p6' ? -1 : 1, 'original display chirality is unchanged');
    close(view.glyphAngleOffset, cell.angleDegrees * (record.family === 'p6' ? 1 : -1), 'glyphs rotate with the camera');
    assert.match(view.clipPath, /^polygon\((?:[-\d.]+% [-\d.]+%, ){3}[-\d.]+% [-\d.]+%\)$/);
    assert.equal((view.guideMarkup.match(/data-cell-boundary=/g) ?? []).length, 1, 'one outer boundary');
    if (count === 1) assert.doesNotMatch(view.guideMarkup, /data-cell-divisions/);
    else assert.match(view.guideMarkup, new RegExp(`data-cell-divisions="${2 * (count - 1)}"`));
    const smaller = makeCellView(cell, 1);
    close(Math.hypot(...first), Math.hypot(...smaller.cellToScreen([1, 0]).map((value, axis) => value - smaller.cellToScreen([0, 0])[axis])) / count, 'dropdown count scales both fields and generators uniformly');
  }
  assert.equal(JSON.stringify(cell), unchanged, 'view construction does not mutate cell geometry');
}

test('all 207 admitted fields have matching cell, field and generator cameras at every dropdown scale', () => {
  assert.equal(Object.keys(strict.orbits).length, 207);
  for (const record of Object.values(strict.orbits)) audit(record);
});

test('all 30 approximate cells use identical geometry without modifying their classification', () => {
  assert.equal(Object.keys(near.orbits).length, 30);
  for (const record of Object.values(near.orbits)) {
    const unchanged = JSON.stringify(record);
    audit(record);
    assert.equal(JSON.stringify(record), unchanged);
    assert.equal(record.classification, 'approximate-only');
  }
});

test('one cell occupies one bounded parallelogram and rejects the surrounding cropped field', () => {
  const view = makeCellView(primitiveCell({family: 'p6'}), 1);
  assert.equal(view.contains(view.screenToOriginal([.05, .05])), false);
  assert.equal(view.contains(view.screenToOriginal([.5, .5])), true);
  vectorClose(view.cellToScreen([1, 1]).map((value, axis) => value + view.cellToScreen([0, 0])[axis]), [1, 1]);
  assert.match(cellGuideMarkup(view, {size: 100}), /M35\.16666667 75\.69208698/);
});

test('legacy simulation framing bypasses the cell camera and clears its guide', () => {
  assert.equal(makeCellView(null, 1, {view: 'simulation'}), null);
  assert.equal(cellGuideMarkup(null), '');
});

test('invalid counts and degenerate geometry are rejected', () => {
  const cell = primitiveCell();
  for (const count of [0, 1.5, 4, NaN]) assert.throws(() => cellCountLabel(count), /Cell count/);
  assert.throws(() => makeCellView(cell, 1, {padding: .5}), /padding/);
  assert.throws(() => makeCellView(cell, 1, {view: 'unknown'}), /framing/);
  assert.throws(() => makeCellView({...cell, basis: [[1, 0], [0, 0]]}), /positive area/);
});
