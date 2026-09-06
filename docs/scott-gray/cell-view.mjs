/** A camera for an exact n × n block of primitive repeat cells.
 *
 * The same affine map is used by saved-field playback and all overlays. This
 * module only changes presentation: it neither changes field samples nor
 * upgrades an approximate translation into a verified symmetry.
 */
import {cellToLattice} from './cell-geometry.mjs';
import {viewTransform, latticePointToScreen, screenPointToLattice} from './view-transform.mjs';

export const CELL_VIEW_PADDING = .055;
const EPSILON = 1e-8;
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const format = number => Number(number.toFixed(8)).toString();
const apply = (matrix, point) => matrix.map(row => row[0] * point[0] + row[1] * point[1]);
const multiply = (left, right) => left.map(row => [row[0] * right[0][0] + row[1] * right[1][0], row[0] * right[0][1] + row[1] * right[1][1]]);

export function cellCountLabel(count) {
  if (![1, 2, 3].includes(count)) throw new Error('Cell count must be 1, 2 or 3.');
  return count === 1 ? '1 cell' : `${count} × ${count} cells`;
}

/** `cell.basis` stores columns in the original saved-field lattice.
 *
 * The canonical p4 cell retains its original downward second screen axis;
 * p6 retains its Euclidean 120° lattice angle. The camera rotates an oblique
 * primitive cell onto this canonical orientation, without anisotropic scaling.
 * Pass {view:'simulation'} to retain the old renderer's simulation-width mode.
 */
export function makeCellView(cell, count = 1, {padding = CELL_VIEW_PADDING, view = 'cells'} = {}) {
  if (view === 'simulation') return null;
  if (view !== 'cells') throw new Error('Unknown cell framing mode.');
  const countLabel = cellCountLabel(count);
  if (!cell || !['p4', 'p6'].includes(cell.family)) throw new Error('A square or triangular primitive cell is required.');
  if (!Number.isFinite(padding) || padding < 0 || padding >= .5) throw new Error('Cell padding must be between zero and one half.');
  if (!Array.isArray(cell.basis) || cell.basis.length !== 2 || cell.basis.some(column => !Array.isArray(column) || column.length !== 2 || !column.every(Number.isFinite))) throw new Error('Cell basis must contain two finite columns.');
  const basis = [[cell.basis[0][0], cell.basis[1][0]], [cell.basis[0][1], cell.basis[1][1]]];
  const determinant = basis[0][0] * basis[1][1] - basis[0][1] * basis[1][0];
  if (!(determinant > 1e-15)) throw new Error('Cell basis must have positive area.');
  const inverse = [[basis[1][1] / determinant, -basis[0][1] / determinant], [-basis[1][0] / determinant, basis[0][0] / determinant]];
  // C maps cell coordinates to canonical Cartesian coordinates (x right, y up).
  const canonicalInverse = cell.family === 'p6' ? [[1, 1 / Math.sqrt(3)], [0, 2 / Math.sqrt(3)]] : [[1, 0], [0, -1]];
  const scale = count * (cell.family === 'p6' ? 1.5 : 1) / (1 - 2 * padding);
  const viewMatrix = multiply(basis, canonicalInverse).map(row => row.map(value => value * scale));
  const viewOrigin = cellToLattice([count / 2, count / 2], cell);
  const transform = viewTransform({family: cell.family, viewMatrix, viewOrigin});
  const originalToScreen = point => latticePointToScreen(point, transform);
  const screenToOriginal = point => screenPointToLattice(point, transform);
  const cellToScreen = point => originalToScreen(cellToLattice(point, cell));
  const cellCorners = [[0, 0], [count, 0], [count, count], [0, count]];
  const originalCorners = cellCorners.map(point => cellToLattice(point, cell));
  const corners = originalCorners.map(originalToScreen);
  const clipPath = `polygon(${corners.map(point => point.map(value => `${format(100 * value)}%`).join(' ')).join(', ')})`;
  const contains = point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)
    && apply(inverse, point).every(value => value >= -EPSILON && value <= count + EPSILON);
  const result = {
    cell, count, countLabel, padding, scale, viewOptions: {viewMatrix, viewOrigin},
    originalToScreen, latticeToScreen: originalToScreen, screenToOriginal, cellToScreen,
    contains, cellCorners, originalCorners, corners, clipPath,
    latticeBounds: {
      min: [0, 1].map(axis => Math.min(...originalCorners.map(point => point[axis]))),
      max: [0, 1].map(axis => Math.max(...originalCorners.map(point => point[axis]))),
    },
    glyphAngleOffset: (cell.family === 'p6' ? 1 : -1) * cell.angleDegrees,
  };
  result.guideMarkup = cellGuideMarkup(result);
  return result;
}

/** Cell boundaries are separate from the optional generator overlay. */
export function cellGuideMarkup(view, {size = 768} = {}) {
  if (!view) return '';
  if (!Number.isFinite(size) || size <= 0) throw new Error('Guide size must be positive and finite.');
  const position = point => view.cellToScreen(point).map(value => format(size * value)).join(' ');
  const outer = view.cellCorners.map((point, index) => `${index ? 'L' : 'M'}${position(point)}`).join(' ') + ' Z';
  const divisions = [];
  for (let i = 1; i < view.count; i++) {
    divisions.push(`M${position([i, 0])} L${position([i, view.count])}`);
    divisions.push(`M${position([0, i])} L${position([view.count, i])}`);
  }
  return `<path class="cell-boundary" data-cell-boundary="outer" d="${outer}" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`
    + (divisions.length ? `<path class="cell-divisions" data-cell-divisions="${2 * (view.count - 1)}" d="${divisions.join(' ')}" fill="none" stroke="rgba(255,255,255,.65)" stroke-width="1" vector-effect="non-scaling-stroke"/>` : '');
}

/** Render into a dedicated SVG layer; no marker or application state is touched. */
export function renderCellGuide(svg, view, {size = 768} = {}) {
  if (!svg || svg.namespaceURI !== SVG_NAMESPACE) throw new Error('Cell guide requires an SVG element.');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.style.pointerEvents = 'none';
  svg.innerHTML = cellGuideMarkup(view, {size});
  svg.toggleAttribute('hidden', !view);
}
