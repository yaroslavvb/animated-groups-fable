/** Primitive repeat-cell geometry; this module does not certify field symmetries.
 *
 * The caller supplies a complete finite group of same-time translations modulo
 * the simulation lattice. Approximate evidence may be passed for a separately
 * labelled approximate cell, but must never be relabelled as exact evidence.
 */
const EPSILON = 1e-8;
const SQRT3 = Math.sqrt(3);
const mod = (value, period = 1) => ((value % period) + period) % period;
const clean = value => Math.abs(value) < 1e-14 ? 0 : value;
const apply = (matrix, point) => matrix.map(row => row[0] * point[0] + row[1] * point[1]);

export function latticeToPhysical([u, v], family = 'p4') {
  if (family === 'p4') return [u, v];
  if (family === 'p6') return [u - v / 2, SQRT3 * v / 2];
  throw new Error(`Unsupported cell family: ${family}`);
}

export function physicalToLattice([x, y], family = 'p4') {
  if (family === 'p4') return [x, y];
  if (family === 'p6') return [x + y / SQRT3, 2 * y / SQRT3];
  throw new Error(`Unsupported cell family: ${family}`);
}

/** B is stored as two columns: original lattice position = B * cell position. */
export function cellToLattice([u, v], cell) {
  return cell.basis[0].map((entry, i) => entry * u + cell.basis[1][i] * v);
}

export function latticeToCell(point, cell) {
  return apply(cell.inverse, point);
}

/** Return a shortest positively oriented square / 120-degree rhombic basis.
 *
 * A rotation-invariant lattice of index n has shortest length 1/sqrt(n).
 * The first basis vector has the smallest nonnegative physical angle, within
 * one 90-degree (p4) or 60-degree (p6) sector. Thus the identity group returns
 * [[1,0],[0,1]], and no shear or anisotropic stretch is introduced.
 */
export function primitiveCell({family = 'p4', translations = []} = {}) {
  latticeToPhysical([0, 0], family); // Validate even when translations are empty.
  const unique = new Map();
  for (const item of [[0, 0], ...translations]) {
    const vector = Array.isArray(item) ? item : item?.v;
    if (!Array.isArray(vector) || vector.length !== 2 || !vector.every(Number.isFinite)) {
      throw new Error('Cell translations must be finite coordinate pairs.');
    }
    const wrapped = vector.map(value => {
      const result = mod(value);
      return result < EPSILON || 1 - result < EPSILON ? 0 : result;
    });
    unique.set(wrapped.map(value => Math.round(value * 1e9)).join(','), wrapped);
  }
  const index = unique.size;
  if (index > 4096) throw new Error('Cell translation group is too large.');

  // Every element of a finite group of order n has denominator dividing n.
  // Integer numerators provide exact closure and membership checks, avoiding
  // false missing periods caused by roundoff in rational coordinates.
  const numerators = [...unique.values()].map(vector => vector.map(value => {
    const numerator = Math.round(value * index);
    if (Math.abs(value - numerator / index) > EPSILON) {
      throw new Error('Cell translations must form a complete finite group.');
    }
    return mod(numerator, index);
  }));
  const key = vector => vector.map(value => mod(value, index)).join(',');
  const members = new Set(numerators.map(key));
  const rotation = family === 'p6' ? [[1, -1], [1, 0]] : [[0, -1], [1, 0]];
  for (const a of numerators) {
    if (!members.has(key(apply(rotation, a)))) throw new Error('Cell translation group is not rotation invariant.');
    for (const b of numerators) {
      if (!members.has(key(a.map((value, i) => value + b[i])))) {
        throw new Error('Cell translations must form a complete finite group.');
      }
    }
  }

  const sector = family === 'p6' ? Math.PI / 3 : Math.PI / 2;
  const expectedLengthSquared = 1 / index;
  const candidates = [];
  for (const [nu, nv] of numerators) for (let i = -2; i <= 1; i++) for (let j = -2; j <= 1; j++) {
    const vector = [nu / index + i, nv / index + j];
    const physical = latticeToPhysical(vector, family);
    const lengthSquared = physical[0] ** 2 + physical[1] ** 2;
    if (Math.abs(lengthSquared - expectedLengthSquared) > EPSILON / index) continue;
    let angle = Math.atan2(physical[1], physical[0]);
    if (Math.abs(angle) < EPSILON) angle = 0;
    if (angle >= 0 && angle < sector - EPSILON) candidates.push({vector, angle});
  }
  candidates.sort((a, b) => a.angle - b.angle || a.vector[0] - b.vector[0] || a.vector[1] - b.vector[1]);
  if (!candidates.length) throw new Error('No square or triangular primitive cell exists for these translations.');
  const first = candidates[0].vector.map(clean);
  const second = (family === 'p6' ? [-first[1], first[0] - first[1]] : [-first[1], first[0]]).map(clean);
  const basis = [first, second];
  const areaRatio = first[0] * second[1] - first[1] * second[0];
  if (Math.abs(areaRatio - 1 / index) > EPSILON / index) throw new Error('Cell basis has the wrong primitive area.');
  return {
    family,
    index,
    basis,
    inverse: [[second[1] / areaRatio, -second[0] / areaRatio], [-first[1] / areaRatio, first[0] / areaRatio]].map(row => row.map(clean)),
    physicalBasis: basis.map(vector => latticeToPhysical(vector, family)),
    areaRatio,
    physicalArea: areaRatio * (family === 'p6' ? SQRT3 / 2 : 1),
    sideLength: 1 / Math.sqrt(index),
    angle: candidates[0].angle,
    angleDegrees: candidates[0].angle * 180 / Math.PI,
  };
}
