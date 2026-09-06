/**
 * Complete rotation-centre overlays for the p4 and p6 phase-character groups.
 * All coordinates are lattice coordinates. Certified translations supplied by
 * the caller preserve the field at the SAME time; phase-shifting translations
 * must remain in `ops` instead.
 */
const EPS = 1e-8;
const IDENTITY = [[1, 0], [0, 1]];
const mod = (x, n = 1) => ((x % n) + n) % n;
const clean = x => Math.abs(x - Math.round(x)) < EPS ? Math.round(x) : Number(x.toFixed(12));
const wrap = x => {const value = mod(x); return value < EPS || value > 1 - EPS ? 0 : clean(value);};
const mv = (M, v) => M.map(row => row[0] * v[0] + row[1] * v[1]);
const mm = (A, B) => A.map(row => [row[0] * B[0][0] + row[1] * B[1][0], row[0] * B[0][1] + row[1] * B[1][1]]);
const pointKey = centre => centre.map(value => Number(wrap(value).toFixed(9))).join(',');

/** Stable fragment-safe identity before URL encoding; names remain readable. */
export const markerKey = (name, centre) => `${name}@${pointKey(centre)}`;
export const centreKey = pointKey;

function operation(op) {
  const M = op.M ?? op.matrix, v = op.v ?? op.translation;
  if (!Array.isArray(M) || M.length !== 2 || M.some(row => !Array.isArray(row) || row.length !== 2 || row.some(x => !Number.isInteger(x))) ||
      !Array.isArray(v) || v.length !== 2 || v.some(x => !Number.isFinite(x)) || !Number.isFinite(op.tau ?? 0)) {
    throw new Error('Rotation centres require finite affine lattice operations.');
  }
  if (op.s !== undefined && op.s !== 1) throw new Error('Time-reversing operations are not supported.');
  if (M[0][0] * M[1][1] - M[0][1] * M[1][0] !== 1) throw new Error('Only orientation-preserving lattice rotations are supported.');
  return {M, v: v.map(wrap), tau: wrap(op.tau ?? 0)};
}

const operationKey = op => `${op.M.flat().join(',')}|${pointKey(op.v)}|${Number(wrap(op.tau).toFixed(9))}`;

function canonicalOperations(namedGenerators, supplied) {
  const identity = {M: IDENTITY, v: [0, 0], tau: 0};
  if (supplied) {
    const unique = new Map([[operationKey(identity), identity]]);
    for (const item of supplied) {const op = operation(item); unique.set(operationKey(op), op);}
    return [...unique.values()];
  }
  const generators = namedGenerators.map(operation), result = [identity], seen = new Set([operationKey(identity)]);
  for (let at = 0; at < result.length; at++) for (const left of generators) {
    const right = result[at], rotated = mv(left.M, right.v);
    const op = {M: mm(left.M, right.M), v: rotated.map((x, i) => wrap(x + left.v[i])), tau: wrap(left.tau + right.tau)};
    const key = operationKey(op);
    if (!seen.has(key)) {
      if (result.length >= 128) throw new Error('Named generators do not close to a finite rotation group.');
      seen.add(key); result.push(op);
    }
  }
  return result;
}

const gcd = (a, b) => b ? gcd(b, a % b) : a;

/** Close the admitted, finite-grid translation subgroup, including conjugates. */
function translationGroup(translations, ops) {
  if (!Array.isArray(translations)) throw new Error('Certified translations must be an array.');
  let denominator = 1;
  const inputs = translations.map(item => {
    const v = item.v ?? item.translation ?? item;
    if (!Array.isArray(v) || v.length !== 2 || v.some(x => !Number.isFinite(x))) throw new Error('Invalid certified translation.');
    for (const x of v) {
      let q = 1;
      while (q <= 4096 && Math.abs(x * q - Math.round(x * q)) > EPS) q++;
      if (q > 4096) throw new Error('Certified translations must lie on a finite rational grid.');
      denominator = denominator / gcd(denominator, q) * q;
      if (denominator > 65536) throw new Error('Certified translation grid is too large.');
    }
    return v;
  });
  const generators = new Map();
  for (const v of inputs) for (const op of ops) {
    const point = mv(op.M, v).map(x => mod(Math.round(x * denominator), denominator));
    if (point.some(Boolean)) generators.set(point.join(','), point);
  }
  const integerPoints = [[0, 0]], seen = new Set(['0,0']);
  for (let at = 0; at < integerPoints.length; at++) for (const generator of generators.values()) {
    const p = integerPoints[at].map((x, i) => mod(x + generator[i], denominator)), key = p.join(',');
    if (!seen.has(key)) {
      if (integerPoints.length >= 4096) throw new Error('Certified translation subgroup is too large for an overlay.');
      seen.add(key); integerPoints.push(p);
    }
  }
  return {
    points: integerPoints.map(p => p.map(x => x / denominator)),
    generators: [...generators.values()].map(p => p.map(x => x / denominator)),
  };
}

function screenAngle(M, family) {
  // The first lattice basis vector is horizontal in both coordinate systems.
  // Its image supplies the Euclidean rotation angle, without a matrix inverse.
  const x = family === 'p6' ? M[0][0] - M[1][0] / 2 : M[0][0];
  const y = family === 'p6' ? -Math.sqrt(3) * M[1][0] / 2 : M[1][0];
  return clean(Math.atan2(y, x) * 180 / Math.PI);
}

function fixedTranslation(M, centre) {
  const rotated = mv(M, centre);
  return centre.map((x, i) => clean(x - rotated[i]));
}

function fixedPoints(M, v) {
  const A = [[1 - M[0][0], -M[0][1]], [-M[1][0], 1 - M[1][1]]];
  const determinant = A[0][0] * A[1][1] - A[0][1] * A[1][0];
  if (!determinant) throw new Error('A named rotation must have an isolated fixed point.');
  const bounds = A.map((row, i) => [
    Math.ceil(row.reduce((sum, x) => sum + Math.min(0, x), 0) - v[i] - EPS),
    Math.floor(row.reduce((sum, x) => sum + Math.max(0, x), 0) - v[i] + EPS),
  ]);
  const result = new Map();
  for (let i = bounds[0][0]; i <= bounds[0][1]; i++) for (let j = bounds[1][0]; j <= bounds[1][1]; j++) {
    const a = v[0] + i, b = v[1] + j;
    const c = [(A[1][1] * a - A[0][1] * b) / determinant, (-A[1][0] * a + A[0][0] * b) / determinant];
    if (c.every(x => x >= -EPS && x <= 1 + EPS)) {
      const wrapped = c.map(wrap); result.set(pointKey(wrapped), wrapped);
    }
  }
  return [...result.values()];
}

function samePhase(a, b) {return Math.abs(wrap(a - b)) < EPS;}

/**
 * Return all maximal rotation centres in one coordinate cell.
 *
 * First complete the three original centre orbits. With certified translations
 * present, solve (I-M)c = v + d + n, n in Z², for every named rotation and every
 * admitted translation d. This finds additional fixed points that merely
 * translating/conjugating the three original centres would miss.
 */
export function rotationCentres({namedGenerators, ops, family = 'p4', translations = []} = {}) {
  if (!Array.isArray(namedGenerators) || !namedGenerators.length) throw new Error('Named rotation generators are required.');
  if (family !== 'p4' && family !== 'p6') throw new Error('Unknown rotation-centre lattice.');
  for (const generator of namedGenerators) {
    operation(generator);
    if (!Number.isInteger(generator.order) || generator.order < 2 || !Array.isArray(generator.centre) || generator.centre.length !== 2 || generator.centre.some(x => !Number.isFinite(x))) {
      throw new Error('Each named rotation requires an order and a finite centre.');
    }
  }
  const canonical = canonicalOperations(namedGenerators, ops);
  const turn = family === 'p6' ? [[1, -1], [1, 0]] : [[0, -1], [1, 0]], allowed = new Set();
  let power = IDENTITY;
  for (let i = 0; i < (family === 'p6' ? 6 : 4); i++) {allowed.add(power.flat().join(',')); power = mm(turn, power);}
  for (const M of [...canonical.map(op => op.M), ...namedGenerators.map(source => source.matrix)]) {
    if (!allowed.has(M.flat().join(','))) throw new Error('Unsupported rotation for this lattice.');
  }
  const translation = translationGroup(translations, canonical);
  const base = new Map(), candidates = new Map();

  for (let index = 0; index < namedGenerators.length; index++) {
    const source = namedGenerators[index];
    for (const op of canonical) {
      const centre = mv(op.M, source.centre).map((x, i) => wrap(x + op.v[i])), key = pointKey(centre);
      const earlier = base.get(key);
      if (!earlier || earlier.source.order < source.order) base.set(key, {source, index, centre, glyphAngle: screenAngle(op.M, family)});
    }
    for (const d of translation.points) for (const centre of fixedPoints(source.matrix, source.translation.map((x, i) => x + d[i]))) {
      const key = pointKey(centre), previous = candidates.get(key);
      if (!previous || source.order > previous.order) {
        candidates.set(key, {centre, order: source.order, tau: source.tau, templates: [index], assigned: null});
      } else if (source.order === previous.order) {
        if (!samePhase(source.tau, previous.tau)) throw new Error('Certified translations identify incompatible rotation phases.');
        if (!previous.templates.includes(index)) previous.templates.push(index);
      }
    }
  }

  // Preserve every surviving canonical marker, including its named conjugacy
  // class, even if extra translations merge two previously separate classes.
  const queue = [];
  for (const [key, item] of base) {
    const candidate = candidates.get(key);
    if (candidate && candidate.order === item.source.order && samePhase(candidate.tau, item.source.tau)) {
      candidate.assigned = {source: item.source, glyphAngle: item.glyphAngle, extra: false};
      queue.push(candidate);
    }
  }
  const moves = [
    ...canonical.map(op => ({...op, angle: screenAngle(op.M, family)})),
    ...translation.generators.map(v => ({M: IDENTITY, v, tau: 0, angle: 0})),
  ];
  function propagate() {
    for (let at = 0; at < queue.length; at++) {
      const from = queue[at];
      for (const move of moves) {
        const centre = mv(move.M, from.centre).map((x, i) => wrap(x + move.v[i]));
        const target = candidates.get(pointKey(centre));
        if (!target || target.order !== from.order || !samePhase(target.tau, from.tau)) throw new Error('Rotation centres do not close under the admitted symmetries.');
        if (!target.assigned) {
          target.assigned = {source: from.assigned.source, glyphAngle: clean(from.assigned.glyphAngle + move.angle), extra: true};
          queue.push(target);
        }
      }
    }
    queue.length = 0;
  }
  propagate();
  const ordered = [...candidates.values()].sort((a, b) => b.order - a.order || a.centre[0] - b.centre[0] || a.centre[1] - b.centre[1]);
  for (const candidate of ordered) if (!candidate.assigned) {
    // A new conjugacy class need not intersect an old named centre. Its glyph
    // orientation has a free initial choice, then is propagated equivariantly.
    candidate.assigned = {source: namedGenerators[candidate.templates[0]], glyphAngle: 0, extra: true};
    queue.push(candidate); propagate();
  }
  return ordered.map(candidate => {
    const {source, glyphAngle, extra} = candidate.assigned, centre = candidate.centre;
    return {...source, centre, translation: fixedTranslation(source.matrix, centre), glyphAngle: clean(mod(glyphAngle, 360)), extra, key: markerKey(source.name, centre)};
  });
}
