/** Look up offline motion measurements without reading or analysing movie samples.
 * Missing or inconsistent metadata never supplies an arrow. A positive sign is
 * rotation in the positive physical-plane orientation; its screen direction is
 * determined by the current camera, independently of a generator's phase shift.
 */
const SCHEMA = 'scott-gray-local-motion-v1';
const HASH = /^[a-f0-9]{64}$/i;
const validHash = value => typeof value === 'string' && value.length === 64 && HASH.test(value);
const STATUSES = new Set(['rotation', 'no-clear-rotation', 'mixed-motion', 'under-resolved', 'ambiguous']);
const LATTICES = new Set(['square', 'triangular']);
const INVALID = Symbol('invalid metadata');
const point = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const wrap = value => Number((((value % 1) + 1) % 1).toFixed(9)) % 1;

/** Periodic aliases and the rounded seam share exactly one lookup key. */
export function localMotionCentreKey(centre) {
  return point(centre) ? centre.map(wrap).join(',') : null;
}

function snapshot(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : INVALID;
  if (!value || typeof value !== 'object' || ancestors.has(value) || ancestors.size >= 64) return INVALID;
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return INVALID;
  ancestors.add(value);
  const entries = Object.entries(value).map(([key, item]) => [key, snapshot(item, ancestors)]);
  ancestors.delete(value);
  if (entries.some(([, item]) => item === INVALID)) return INVALID;
  return Object.freeze(Array.isArray(value) ? entries.map(([, item]) => item) : Object.fromEntries(entries));
}

function unknown(centre, evidence = null) {
  return Object.freeze({centre: Object.freeze(centre), status: 'ambiguous', sign: null, confidence: 'unknown', evidence});
}

function centreEntry(source) {
  const key = localMotionCentreKey(source?.centre);
  if (key === null) return null;
  const centre = key.split(',').map(Number);
  const evidence = source.evidence && !Array.isArray(source.evidence) && typeof source.evidence === 'object'
    ? snapshot(source.evidence) : INVALID;
  const validSign = source.sign === null || source.sign === 1 || source.sign === -1;
  const validConfidence = source.confidence === 'high' || source.confidence === 'unknown';
  if (!STATUSES.has(source.status) || !validSign || !validConfidence || evidence === INVALID
    || source.status === 'rotation' && (source.confidence !== 'high' || source.sign === null)) {
    return [key, unknown(centre, evidence === INVALID ? null : evidence)];
  }
  return [key, Object.freeze({centre: Object.freeze(centre), status: source.status, sign: source.sign,
    confidence: source.confidence, evidence})];
}

function orientation(a, b) {
  if (!point(a) || !point(b)) return 0;
  const an = Math.hypot(...a), bn = Math.hypot(...b);
  if (!Number.isFinite(an) || !Number.isFinite(bn) || !an || !bn) return 0;
  const determinant = a[0] / an * (b[1] / bn) - a[1] / an * (b[0] / bn);
  return Math.abs(determinant) > 1e-12 ? Math.sign(determinant) : 0;
}

function cameraOrientation(group, cellView) {
  const basis = group.basis ?? (group.lattice === 'triangular' ? [[1, 0], [-0.5, Math.sqrt(3) / 2]] : [[1, 0], [0, 1]]);
  if (!Array.isArray(basis) || basis.length !== 2) return 0;
  const physical = orientation(...basis);
  const project = cellView?.originalToScreen ?? cellView?.latticeToScreen;
  if (!physical || typeof project !== 'function') return 0;
  try {
    const origin = project.call(cellView, [0, 0]), x = project.call(cellView, [1, 0]), y = project.call(cellView, [0, 1]);
    if (![origin, x, y].every(point)) return 0;
    const screen = orientation(x.map((value, i) => value - origin[i]), y.map((value, i) => value - origin[i]));
    // det(physical→screen) = det(lattice→screen) / det(lattice→physical).
    return screen * physical;
  } catch {
    return 0;
  }
}

function recordMatches(source, record, group) {
  const N = record?.config?.N ?? record?.N, M = record?.config?.M ?? record?.M;
  if (!record || !group || source.id !== record.id || !validHash(record.fieldSha256)
    || source.fieldSha256 !== record.fieldSha256.toLowerCase() || source.N !== N || source.M !== M
    || source.lattice !== group.lattice) return false;
  if (group.id !== undefined && record.groupId !== undefined && group.id !== record.groupId) return false;
  for (const candidate of [record, record.config]) {
    if (candidate?.lattice !== undefined && candidate.lattice !== source.lattice) return false;
    if (candidate?.N !== undefined && candidate.N !== source.N) return false;
    if (candidate?.M !== undefined && candidate.M !== source.M) return false;
  }
  return true;
}

export function createLocalMotionCatalog(data) {
  const records = new Map();
  const methodVersion = typeof data?.methodVersion === 'string' && data.methodVersion.trim()
    && data.methodVersion.length <= 128 ? data.methodVersion : null;
  if (data?.schema === SCHEMA && methodVersion && Array.isArray(data.records)) {
    for (const entry of data.records) {
      if (typeof entry?.id !== 'string' || !entry.id) continue;
      // Duplicate IDs have no unambiguous metadata provenance, even if one is valid.
      if (records.has(entry.id)) { records.set(entry.id, null); continue; }
      records.set(entry.id, null);
      if (!validHash(entry.fieldSha256) || !Number.isSafeInteger(entry.N) || entry.N < 1
        || !Number.isSafeInteger(entry.M) || entry.M < 1 || !LATTICES.has(entry.lattice)
        || !Array.isArray(entry.centres)) continue;
      const centres = new Map();
      for (const source of entry.centres) {
        const normalized = centreEntry(source);
        if (!normalized) continue;
        const [key, value] = normalized, previous = centres.get(key);
        if (previous && (previous.status !== value.status || previous.sign !== value.sign || previous.confidence !== value.confidence)) {
          centres.set(key, unknown([...value.centre]));
        } else if (!previous) centres.set(key, value);
      }
      records.set(entry.id, Object.freeze({id: entry.id, fieldSha256: entry.fieldSha256.toLowerCase(),
        N: entry.N, M: entry.M, lattice: entry.lattice, centres}));
    }
  }
  return Object.freeze({
    methodVersion,
    forRecord(record, group, cellView) {
      const source = records.get(record?.id), result = new Map();
      if (!source || !recordMatches(source, record, group)) return result;
      const handedness = cameraOrientation(group, cellView);
      for (const [key, value] of source.centres) {
        const trustedRotation = value.status === 'rotation' && value.confidence === 'high'
          && (value.sign === 1 || value.sign === -1);
        const direction = trustedRotation && handedness
          ? value.sign * handedness > 0 ? 'clockwise' : 'counterclockwise' : null;
        result.set(key, Object.freeze({...value, direction, methodVersion}));
      }
      return result;
    },
  });
}
