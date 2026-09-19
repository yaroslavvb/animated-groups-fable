/** The Monochrome catalog loader.
 *
 * `data/monochrome-atlas.json` (the shipped file is `monochrome-atlas-v2`; v1
 * still loads) is a build
 * artifact of `tools/build-monochrome-catalog.py`: for every saved orbit of the
 * wallpaper atlas it records the two-colour pictures of that field — one entry
 * per (rule kind, field, operation, channel) — with the measured antisymmetry
 * laws, the measured two-colour group and the legibility metrics. This module
 * loads it, **gates** it, and hands the page frozen entries. It never re-derives
 * a law or a group: it reads them, checks their shape, and refuses the file if
 * anything is inconsistent — a broken catalog must not render.
 *
 * Every field the page reads is pulled out in `describe()`, so the rest of the
 * code never reaches into the raw JSON shape. Fields the design's §0.5 asks the
 * builder to add — `tier`, `view.tiles`, `quality`, the channel lag — are read
 * defensively with a measured fallback, so a v1 catalog still renders. On the
 * shipped v2 file no fallback fires: every entry carries a tier, a framing, a
 * doubled-grid quality block, a `channelV` and, where strict, its
 * `strictReadings` with the per-reading measurement of each.
 *
 * Only the selected field is downloaded, through the site's one download path
 * (`scott-gray/precomputed-catalog.mjs`), which checks the byte length and the
 * SHA-256 before the bytes are decoded.
 */
import {downloadOrbitBytes} from '../scott-gray/precomputed-catalog.mjs?v=20260905-gallery-fix';
import {LATTICES, STRAND_PIXELS, tilesFor} from './mono-renderer.mjs?v=20260919-mono-v1';

/** Both shapes the builder has shipped. v2 adds an explicit `tier`, a per-entry
 * `view.tiles` and `quality` measured on the doubled grid the viewer draws, a
 * `channelV` block in place of `rule.altChannel`, and `rule.strictReadings`; v1
 * carried none of them and the page measures the same things itself. Everything
 * v2-only is read through a fallback, so either file renders. */
const SCHEMAS = new Set(['monochrome-atlas-v1', 'monochrome-atlas-v2']);
const HASH = /^[a-f0-9]{64}$/i;
const ID = /^[A-Za-z0-9:._|,+-]{1,512}$/;
/** The canonical order of the seventeen wallpaper groups, which is the order the
 * landing page, the pager and every count in the catalog use. */
export const FAMILY_ORDER = Object.freeze(['p1', 'p2', 'pm', 'pg', 'cm', 'pmm', 'pmg', 'pgg', 'cmm', 'p4', 'p4m', 'p4g', 'p3', 'p3m1', 'p31m', 'p6', 'p6m']);
/** The order step 2 offers the rules in: the four spatial readings, then the
 * universal one, then the control. */
export const RULE_ORDER = Object.freeze(['half-turn', 'mirror', 'glide', 'half-shift', 'half-period', 'threshold']);
/** The short label each chip carries. The catalog's `ruleKinds` supplies the
 * sentence and the blurb; this is only the two words on the chip. */
export const RULE_LABELS = Object.freeze({
  'half-turn': 'Half turn', mirror: 'Mirror', glide: 'Glide',
  'half-shift': 'Half slide', 'half-period': 'Half period', threshold: 'Threshold',
});
/** How many lattice lengths the fixed frame may show. The v2 builder's own
 * framing gate reaches 8: the finest pictures show ten strands at two cells
 * across and the coarsest show one, so a fixed tile count cannot serve both. */
export const MAX_TILES = 8;
export const TILE_CHOICES = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);

const freeze = value => {
  if (value && typeof value === 'object' && !ArrayBuffer.isView(value)) {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
};
const integers = value => Array.isArray(value) && value.every(Number.isInteger);
const matrix = value => Array.isArray(value) && value.length === 2 && value.every(row => integers(row) && row.length === 2);
const mod = (value, n) => ((value % n) + n) % n;
const bad = (id, why) => { throw Error(`Monochrome catalog entry ${id}: ${why}`); };

/** `x ↦ S x + v` composed with itself, in whole nodes. An involution of the
 * torus needs `S² = I` and `S v + v ≡ 0 (mod N)`; both are integer statements,
 * which is what makes the antisymmetry a theorem rather than a tolerance. */
export function isInvolution(S, v, N) {
  const S2 = [
    [S[0][0] * S[0][0] + S[0][1] * S[1][0], S[0][0] * S[0][1] + S[0][1] * S[1][1]],
    [S[1][0] * S[0][0] + S[1][1] * S[1][0], S[1][0] * S[0][1] + S[1][1] * S[1][1]],
  ];
  if (S2[0][0] !== 1 || S2[0][1] !== 0 || S2[1][0] !== 0 || S2[1][1] !== 1) return false;
  return mod(S[0][0] * v[0] + S[0][1] * v[1] + v[0], N) === 0
      && mod(S[1][0] * v[0] + S[1][1] * v[1] + v[1], N) === 0;
}

/** Where `x ↦ S x + v/N` fixes a point, in lattice coordinates — for a rotation
 * a single point modulo the lattice, and for a reflection or a translation
 * nothing (it fixes a line, or moves everything). Printing `v` as a location
 * would be wrong: `v` is the translation part, not a place. */
export function fixedPoint(S, v, N) {
  const a = 1 - S[0][0], b = -S[0][1], c = -S[1][0], d = 1 - S[1][1];
  const det = a * d - b * c;
  if (!det) return null;
  const p = [(d * v[0] - b * v[1]) / det / N, (-c * v[0] + a * v[1]) / det / N];
  return [p[0] - Math.floor(p[0]), p[1] - Math.floor(p[1])];
}

/** `frames / M` of a period, in lowest terms: "T/2", "3T/4", "0". */
export function timeText(frames, M) {
  if (!frames) return '0';
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const g = gcd(Math.abs(frames), M);
  const num = frames / g, den = M / g;
  return `${num === 1 ? '' : num}T${den === 1 ? '' : `/${den}`}`;
}

/** `k` nodes of `n` as a cell fraction: the builder's own `_cellfrac`. */
export function cellFraction(k, n) {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const whole = mod(k, n);
  if (!whole) return '0';
  const g = gcd(whole, n);
  const num = whole / g, den = n / g;
  return den === 1 ? String(num) : `${num}/${den}`;
}

/** Which of the three tiers an entry is in. v2 says so outright; on v1 the
 * working discriminator is the measured half-period law, and the threshold is
 * the control by construction. */
export function tierOf(entry) {
  if (entry.tier === 'strict' || entry.tier === 'broad' || entry.tier === 'control') return entry.tier;
  if (entry.kind === 'threshold' || entry.rule?.antisymmetric === false) return 'control';
  return entry.laws?.halfPeriod?.[1] === 1 ? 'strict' : 'broad';
}

/** Everything the pages read off one catalog entry, in one place. */
function describe(entry, field, {groups, models, ops, ruleKinds, kindByCode, notes, thumbBase, baseUrl}) {
  const r = entry.rule, lattice = field.lattice;
  const table = ops[lattice]?.ops ?? [];
  const opName = index => table[index]?.name ?? String(index);
  const opMatrix = index => table[index]?.M ?? [[1, 0], [0, 1]];
  const N = field.N, M = field.M;
  const tier = tierOf(entry);
  const spatial = !!ruleKinds[entry.kind] && entry.kind !== 'half-period' && entry.kind !== 'threshold';
  /** The strand as a fraction of a lattice length — what the framing is chosen
   * from and what the scale label prints. v2 measures it on the doubled grid the
   * viewer actually draws; v1's `runLengthNodes` is the saved node grid. */
  const strandCells = Number.isFinite(entry.quality?.strandCells)
    ? entry.quality.strandCells
    : (entry.metrics?.runLengthNodes ?? 0) / N;
  return {
    id: entry.id,
    kind: entry.kind,
    fieldKey: entry.field,
    // --- the field
    N, M, L: field.L, period: field.period, lattice,
    latticeSpec: LATTICES[lattice] ?? LATTICES.square,
    model: field.model,
    modelName: models[field.model]?.name ?? field.model,
    params: field.params,
    name: field.names?.[0] ?? `Picture ${entry.field}`,
    names: field.names ?? [],
    fieldSha256: field.sha256,
    shortSha: String(field.sha256 ?? '').slice(0, 12),
    byteLength: field.byteLength,
    valueCount: 2 * N * N * M,
    fieldUrl: new URL(`../${field.fieldUrl}`, baseUrl).href,
    atlasIds: field.atlasIds ?? [],
    groupIds: field.groupIds ?? [],
    families: field.families ?? [],
    origin: field.origin ?? 'atlas',
    fieldSymmetries: field.fieldSymmetries ?? null,
    // --- the rule
    channel: r.channel === 'v' ? 'v' : 'u',
    channelIndex: r.channel === 'v' ? 1 : 0,
    op: r.op, S: r.M, v: r.v,
    ruleDescription: r.description ?? '',
    antisymmetric: r.antisymmetric !== false,
    spatial,
    ruleTitle: ruleKinds[entry.kind]?.title ?? entry.kind,
    ruleFormula: ruleKinds[entry.kind]?.rule ?? '',
    ruleBlurb: ruleKinds[entry.kind]?.blurb ?? '',
    /** The same rule read on the other channel: V is the U picture at a lag, not
     * a second picture, so it is `?channel=v` on this entry rather than an entry
     * of its own. v1 carried a bare `[channel, score, boundaryDensity]`. */
    channelV: entry.channelV && typeof entry.channelV === 'object' ? entry.channelV
      : Array.isArray(r.altChannel) && r.altChannel[0] ? {channel: r.altChannel[0], score: r.altChannel[1], boundaryDensity: r.altChannel[2]}
        : null,
    /** Other rules of this field that draw this same picture, unpacked from
     * `[ruleKindCode, pointOpIndex, vx, vy, noteCode, dt, dy, dx, sign]` (v1
     * stopped at `noteCode`). Inside the strict tier these are not "similar
     * pictures": they are the same function, node-frame by node-frame, and the
     * note says which reason applies. */
    sameAs: (r.sameAs ?? []).map(([kindCode, opIndex, vx, vy, noteCode, dt = 0, dy = 0, dx = 0, sign = 0]) => ({
      kind: kindByCode[kindCode] ?? String(kindCode),
      title: ruleKinds[kindByCode[kindCode]]?.title ?? kindByCode[kindCode] ?? String(kindCode),
      op: opName(opIndex), M: opMatrix(opIndex), v: [vx, vy],
      note: notes[noteCode] ?? '',
      shift: [dt, dy, dx], sign,
      negated: sign === -1 || noteCode === 3 || noteCode === 5,
    })),
    /** Every involution whose `(s, T/2)` is an exact symmetry of the field, so
     * every one of them computes THIS function. Present on a strict entry of a
     * v2 catalog; on v1 the `sameAs` list is the nearest thing.
     *
     * Each one carries its OWN measurement, because each one is a chip the
     * reader can pick and so a claim the page makes on its own: `residual` is
     * the relative size of `w(s x, t) + w(x, t)`, `exact` says it was bit-exact,
     * and `drawnDiffers` is the fraction of node-frames where the two inks are
     * not in fact exchanged. `(s, T/2)` holds on the saved float32 samples to
     * the search's residual and not to the last bit, so these are not all zero,
     * and the page prints what was measured instead of asserting a zero.
     * `laws.strictEach` is omitted exactly when every row would be perfect. */
    strictReadings: (r.strictReadings ?? []).map(([kindCode, opIndex, vx, vy], i) => {
      const measured = entry.laws?.strictEach?.[i] ?? [0, 1, 0, 1];
      return {
        kind: kindByCode[kindCode] ?? String(kindCode),
        title: ruleKinds[kindByCode[kindCode]]?.title ?? kindByCode[kindCode] ?? String(kindCode),
        op: opName(opIndex), M: opMatrix(opIndex), v: [vx, vy],
        residual: measured[0], exact: measured[1] === 1,
        drawnDiffers: measured[2], drawnExact: measured[3] === 1,
      };
    }),
    /** The whole saved frames at which `s` is itself a symmetry of the field, or
     * −1 where it is a symmetry at no shift at all — which is exactly what makes
     * the involution free and the tier broad. */
    sIsFieldSymmetryAt: Number.isInteger(r.sIsFieldSymmetryAt) ? r.sIsFieldSymmetryAt : null,
    // --- the measured laws and group
    laws: entry.laws ?? {},
    tier,
    strict: tier === 'strict',
    control: tier === 'control',
    preserve: entry.group?.preserve ?? 0,
    swap: entry.group?.swap ?? 0,
    keepGroup: entry.group?.keepGroup ?? null,
    picGroup: entry.group?.picGroup ?? null,
    pointOpsPreserving: entry.group?.pointOpsPreserving ?? [],
    pointOpsSwapping: entry.group?.pointOpsSwapping ?? [],
    /** The packed two-colour table, unpacked once: `x ↦ M x + v`, `t ↦ t +
     * frames`, and whether the pair keeps the two inks or exchanges them. */
    symmetries: (entry.symmetries ?? []).map(([opIndex, vx, vy, frames, keep]) => ({
      op: opName(opIndex), M: opMatrix(opIndex), v: [vx, vy], frames, keep: keep === 1,
      centre: fixedPoint(opMatrix(opIndex), [vx, vy], N),
    })),
    metrics: entry.metrics ?? {},
    /** Measured on the spectrally doubled grid the viewer draws, with the same
     * boolean `w > 0`: the numbers the quality gate is actually about. On the
     * saved node grid the exact zero set along a colour-reversing mirror reads
     * as speckle and the published speckle-free Weave scores 0.084. */
    quality: entry.quality ?? null,
    strandCells,
    featured: !!entry.featured,
    featuredWhy: entry.featuredWhy ?? null,
    shippedPage: entry.shippedPage ?? null,
    thumbnail: new URL(`${thumbBase}${entry.id.replace(/:/g, '-')}.png`, baseUrl).href,
    /** §0.3 of the design: the framing follows the measured strand width, not a
     * fixed tile count. A v2 catalog is expected to carry `view.tiles`; until it
     * does, the same rule is applied here to the strand the builder measured. */
    view: {
      tiles: Number.isInteger(entry.view?.tiles) && entry.view.tiles >= 1 && entry.view.tiles <= MAX_TILES
        ? entry.view.tiles
        : tilesFor({strandCells, choices: TILE_CHOICES, target: STRAND_PIXELS}),
      strandPixels: Number.isFinite(entry.view?.strandPixels) ? entry.view.strandPixels : null,
      centre: Array.isArray(entry.view?.centre) && entry.view.centre.length === 2 ? entry.view.centre : [0, 0],
    },
    /** The group whose tile is pressed when nothing else says: the first film
     * group the field is filed under. */
    primaryGroup: (field.groupIds ?? [])[0] ?? null,
    raw: entry, rawField: field,
    field: null,
  };
}

/** Loads, gates and indexes one `monochrome-atlas-v1` manifest.
 *
 * `groups` is `scott-gray/wallpaper-groups.json`'s group list, used for each
 * film group's signature and lattice; `baseUrl` is `docs/monochrome/`. */
export function createMonoCatalog(manifest, {groups = [], families = [], baseUrl = new URL('./', import.meta.url), fetcher = globalThis.fetch, maxCachedOrbits = 2} = {}) {
  if (!SCHEMAS.has(manifest?.schema) || !Array.isArray(manifest.entries)) throw Error(`Unsupported monochrome atlas ${manifest?.schema ?? '(none)'}.`);
  if (typeof fetcher !== 'function') throw Error('A field fetcher is required.');
  const canonical = new Map(groups.map(group => [group.id, group]));
  const familyMeta = new Map((families.length ? families : manifest.families ?? []).map(item => [item.id, item]));
  const models = manifest.models ?? {};
  const ruleKinds = manifest.ruleKinds ?? {};
  const ops = manifest.pointOps ?? {};
  const notes = Array.isArray(manifest.notes) ? manifest.notes : [];
  // `ruleKindCodes` is name → code; the packed `sameAs` rows need the inverse.
  const kindByCode = Object.fromEntries(Object.entries(manifest.ruleKindCodes ?? {}).map(([name, code]) => [code, name]));
  const thumbBase = manifest.thumbs?.base ?? 'data/thumbs/';
  const fields = new Map(Object.entries(manifest.fields ?? {}));
  const warnings = [];

  // ---- the fields the entries index into -----------------------------------
  for (const [key, field] of fields) {
    const say = why => { throw Error(`Monochrome catalog field ${key}: ${why}`); };
    if (!HASH.test(field.sha256 ?? '')) say('the field sha256 is not 64 hex digits');
    if (!String(field.sha256).startsWith(key)) say('the key is not the head of its own sha256');
    if (typeof field.fieldUrl !== 'string' || !field.fieldUrl) say('no field url');
    if (!Number.isInteger(field.N) || field.N < 4) say('invalid grid');
    // An odd frame count has no T/2, so the universal rule would not exist.
    if (!Number.isInteger(field.M) || field.M < 4 || field.M % 2) say('the frame count must be even');
    if (field.byteLength !== 8 * field.N * field.N * field.M) say('the byte length does not match the grid');
    if (!Number.isFinite(field.period) || field.period <= 0) say('invalid period');
    if (!LATTICES[field.lattice]) say(`unknown lattice ${field.lattice}`);
    if (!models[field.model]) say(`unknown equation ${field.model}`);
    for (const name of models[field.model].parameters ?? []) if (!Number.isFinite(field.params?.[name])) say(`parameter ${name} is not a number`);
    for (const name of models[field.model].diffusion ?? []) if (!(field.params?.[name] > 0)) say(`diffusion ${name} must be positive`);
    if (!Array.isArray(field.families) || !field.families.length) say('no wallpaper family');
    for (const id of field.groupIds ?? []) {
      if (!canonical.has(id)) say(`unknown film group ${id}`);
      // The lattice the shader draws on comes from the field; a film group on
      // the other lattice would host a picture it cannot be drawn in.
      if (canonical.get(id).lattice !== field.lattice) say(`film group ${id} is not on the ${field.lattice} lattice`);
    }
    if (!(field.groupIds ?? []).length) say('no hosting film group');
  }

  // ---- the entries ---------------------------------------------------------
  const entries = new Map(), byFamily = new Map(), byField = new Map();
  for (const source of manifest.entries) {
    const entry = structuredClone(source), id = entry.id, r = entry.rule ?? {};
    if (typeof id !== 'string' || !ID.test(id) || entries.has(id)) throw Error('Monochrome entries need unique, URL-safe ids.');
    if (!ruleKinds[entry.kind]) bad(id, `unknown rule ${entry.kind}`);
    const field = fields.get(entry.field);
    if (!field) bad(id, `unknown field ${entry.field}`);
    const N = field.N;
    if (!matrix(r.M)) bad(id, 'the rule needs an integer 2 × 2 matrix');
    if (!integers(r.v) || r.v.length !== 2) bad(id, 'the rule translation must be whole nodes');
    const det = r.M[0][0] * r.M[1][1] - r.M[0][1] * r.M[1][0];
    if (Math.abs(det) !== 1) bad(id, 'the rule matrix is not unimodular');
    // Every published rule is an involution of the torus in integer arithmetic;
    // that is what makes `w(s x, t) = −w(x, t)` algebra rather than a tolerance.
    if (!isInvolution(r.M, r.v, N)) bad(id, 'the rule operation is not an involution of the saved cell');
    if (!Array.isArray(entry.symmetries) || !entry.symmetries.length) bad(id, 'no measured two-colour group');
    const table = ops[field.lattice]?.ops ?? [];
    for (const row of entry.symmetries) {
      if (!integers(row) || row.length !== 5) bad(id, 'a two-colour row is not five whole numbers');
      if (!table[row[0]]) bad(id, `a two-colour row names point operation ${row[0]}, which this lattice has not got`);
      if (row[4] !== 0 && row[4] !== 1) bad(id, 'a two-colour row neither keeps nor swaps');
      if (!(row[3] >= 0 && row[3] < field.M)) bad(id, 'a two-colour row waits outside the saved period');
    }
    const preserve = entry.group?.preserve, swap = entry.group?.swap;
    if (!Number.isInteger(preserve) || !Number.isInteger(swap)) bad(id, 'the two-colour counts are not whole numbers');
    if (preserve + swap !== entry.symmetries.length) bad(id, 'the two-colour counts do not match the measured rows');
    // An antisymmetry group has index exactly 2, so an unequal pair is a bug —
    // and the threshold control, which carries no antisymmetry at all, must
    // swap nothing.
    if (r.antisymmetric !== false && preserve !== swap) bad(id, 'the colour-preserving half is not an index-2 subgroup');
    if (r.antisymmetric === false && swap !== 0) bad(id, 'a rule with no antisymmetry cannot swap the inks');
    const white = entry.metrics?.white;
    // Congruence forces one half each, so anything far from it is a measurement
    // bug rather than a lesser picture.
    if (!(white > 0.30 && white < 0.70)) bad(id, `the white share is ${white}, which is outside the congruence band`);
    if (!(entry.metrics?.amplitude > 0)) bad(id, 'the picture is flat: the difference field has no amplitude');
    const view = describe(entry, field, {groups: canonical, models, ops, ruleKinds, kindByCode, notes, thumbBase, baseUrl});
    freeze(view);
    entries.set(id, view);
    if (!byField.has(view.fieldKey)) byField.set(view.fieldKey, []);
    byField.get(view.fieldKey).push(view);
    for (const family of view.families) {
      if (!byFamily.has(family)) byFamily.set(family, []);
      byFamily.get(family).push(view);
    }
  }
  const all = Object.freeze([...entries.values()]);
  for (const list of byFamily.values()) Object.freeze(list);
  for (const list of byField.values()) Object.freeze(list);
  if (manifest.counts?.entries !== undefined && manifest.counts.entries !== all.length) {
    warnings.push(`the manifest counts ${manifest.counts.entries} entries and ships ${all.length}`);
  }

  // The cache is keyed by the FIELD, not by the entry: up to nine entries read
  // one download, and the download is the expensive part (up to 7 MB). Switching
  // rules on a picture must not fetch its bytes again.
  const loaded = new Map(), inflight = new Map(), branded = new WeakSet();
  const bytesOf = summary => {
    const key = summary.fieldKey;
    if (loaded.has(key)) { const field = loaded.get(key); loaded.delete(key); loaded.set(key, field); return Promise.resolve(field); }
    if (inflight.has(key)) return inflight.get(key);
    const promise = (async () => {
      const bytes = await downloadOrbitBytes(summary.fieldUrl, {fetcher, byteLength: summary.byteLength, fieldSha256: summary.fieldSha256});
      const view = new DataView(bytes), field = new Float32Array(summary.valueCount);
      for (let i = 0; i < field.length; i++) {
        field[i] = view.getFloat32(4 * i, true);
        if (!Number.isFinite(field[i])) throw Error('The downloaded field contains a non-finite value.');
      }
      loaded.set(key, field);
      while (loaded.size > maxCachedOrbits) loaded.delete(loaded.keys().next().value);
      return field;
    })();
    inflight.set(key, promise);
    promise.then(() => inflight.delete(key), () => inflight.delete(key));
    return promise;
  };
  const load = async id => {
    const summary = entries.get(id);
    if (!summary) throw Error('Unknown monochrome picture.');
    const field = await bytesOf(summary);
    const record = Object.freeze({...summary, field});
    branded.add(record);
    return record;
  };

  const familyList = FAMILY_ORDER.filter(id => familyMeta.has(id));
  return Object.freeze({
    manifest: freeze(structuredClone({
      schema: manifest.schema, generated: manifest.generated, scope: manifest.scope,
      shape: manifest.shape ?? {}, counts: manifest.counts ?? {}, provenance: manifest.provenance ?? {},
      thumbs: manifest.thumbs ?? {}, gates: manifest.gates ?? {}, notes,
    })),
    models: freeze(structuredClone(models)),
    ruleKinds: freeze(structuredClone(ruleKinds)),
    /** The three tiers and their prose, from the catalog rather than from a
     * constant here, so a rewritten descriptor reaches the page by data alone.
     * A v1 catalog carries none, and these are the sentences the design writes. */
    tiers: freeze(structuredClone(manifest.tiers ?? {
      strict: {title: 'the involution is a symmetry of the field', short: 'strict', law: 'U(s x, t + T/2) = U(x, t)',
        blurb: 'The involution is an exact spacetime symmetry of the field, so it alone swaps black and white, waiting half a period alone swaps them, and the two together put the picture back.'},
      // The tier is a fact about the involution against the field, not about
      // the picture: a free involution's film is very often a two-colour
      // spacetime pattern as well, and `laws.halfPeriod` is where that is read.
      broad: {title: 'the involution is free', short: 'broad', law: 'w(s x, t) = −w(x, t)',
        blurb: 'The involution is free: it exchanges the inks by an identity of subtraction and by nothing else, not because it is a symmetry of the field. Whether waiting half a period also exchanges them is measured separately, per reading.'},
      control: {title: 'no antisymmetry', short: 'control', law: 'w(x, t) = U(x, t) − median U',
        blurb: 'The plain threshold. Nothing swaps black and white; it is here so the other two tiers can be compared with the picture you get for free.'},
    })),
    /** The two named pictures the site already publishes as their own pages. */
    classics: freeze(structuredClone(manifest.classics ?? {})),
    pointOps: freeze(structuredClone(ops)),
    families: Object.freeze(familyList.map(id => familyMeta.get(id))),
    familyMeta: id => familyMeta.get(id) ?? null,
    groupMeta: id => canonical.get(id) ?? null,
    warnings: Object.freeze([...warnings]),
    get: id => entries.get(id) ?? null,
    all: family => (family === undefined ? all : byFamily.get(family) ?? []),
    ofField: key => byField.get(key) ?? [],
    fields: freeze(structuredClone(Object.fromEntries(fields))),
    size: family => (family === undefined ? all.length : (byFamily.get(family) ?? []).length),
    load,
    isVerified: record => branded.has(record),
  });
}

/** Fetches the manifest and the canonical groups, then builds the catalog. */
export async function loadMonoCatalog({baseUrl = new URL('./', import.meta.url), version = '', fetcher = globalThis.fetch} = {}) {
  const query = version ? `?v=${version}` : '';
  const [atlas, groups] = await Promise.all([
    fetcher(new URL(`data/monochrome-atlas.json${query}`, baseUrl)),
    fetcher(new URL(`../scott-gray/wallpaper-groups.json${query}`, baseUrl)),
  ]);
  if (!atlas.ok || !groups.ok) throw Error('The monochrome catalog could not be loaded.');
  const [manifest, metadata] = await Promise.all([atlas.json(), groups.json()]);
  return createMonoCatalog(manifest, {groups: metadata.groups, families: metadata.families, baseUrl, fetcher});
}
