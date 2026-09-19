// The shipped three-colour catalog, checked against its own bytes.
//
//   node --test docs/colour/tests/            (sampled: every entry, 8 phases)
//   COLOUR_FULL=1 node --test docs/colour/tests/   (every entry, every phase)
//
// No dependencies: node's own test runner, fs and crypto. Everything the
// catalog asserts about a picture is re-derived HERE, in JavaScript, from the
// Float32 field the page will load — the colouring itself, every measured
// symmetry, and every generator mark. A catalog that merely agrees with itself
// would prove nothing; this file is the reason the numbers in it can be read as
// measurements rather than as claims.
//
// The conventions, once, because everything below depends on them:
//
//   field     frame-major, planar channel 0 then channel 1, x fastest:
//             U(t, y, x) = raw[((t * 2 + 0) * N + y) * N + x].
//             y indexes the a2 direction, x the a1 direction.
//   symmetry  colour(M x + v, t + frames) = perm(colour(x, t)), with v in whole
//             saved nodes and frames a whole saved frame — so every claim is an
//             integer comparison with no interpolation anywhere.
//   gyre      colour(x, t) = argmax_k U(g^k x, t + k M/3), g x = S x + w.
//   trefoil   colour(x, t) = argmax_k U(x + k b, t), b = (N/3, 2N/3) nodes.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLOUR = path.resolve(HERE, '..');
const DOCS = path.resolve(COLOUR, '..');
const FULL = process.env.COLOUR_FULL === '1';
/** Phases sampled per entry when not running the full sweep. Eight is enough to
 * catch a law that holds at t = 0 and nowhere else, which is the failure a
 * one-frame check would miss. */
const PHASE_SAMPLES = 8;
/** How many entries get their field re-hashed. SHA-256 over 58 MB of orbits
 * would dominate the run; a rotating sample keeps the cost bounded and still
 * fails loudly on a truncated or swapped file. */
const SHA_SAMPLES = 12;

const catalog = JSON.parse(fs.readFileSync(path.join(COLOUR, 'data', 'colour-atlas.json'), 'utf8'));
const entries = catalog.entries;

// ---------------------------------------------------------------- the twelve point ops

/** The point group of the triangular lattice, in lattice coordinates — the same
 * twelve matrices the builder enumerates, by the same names. */
const POINT_OPS = {
  '1': [[1, 0], [0, 1]], R60: [[1, -1], [1, 0]], R120: [[0, -1], [1, -1]],
  R180: [[-1, 0], [0, -1]], R240: [[-1, 1], [-1, 0]], R300: [[0, 1], [-1, 1]],
  Ma: [[0, 1], [1, 0]], Mb: [[1, 0], [1, -1]], Mc: [[-1, 1], [0, 1]],
  Md: [[0, -1], [-1, 0]], Me: [[-1, 0], [-1, 1]], Mf: [[1, -1], [0, -1]],
};
const S = POINT_OPS.R240;                       // Gyre's third-turn, the builder's S

const mod = (a, n) => ((a % n) + n) % n;
const apply = (M, x, y) => [M[0][0] * x + M[0][1] * y, M[1][0] * x + M[1][1] * y];

// ---------------------------------------------------------------- fields and colours

const fieldCache = new Map();

function loadU(entry) {
  const {fieldSha256: sha, N, M} = entry.source;
  if (fieldCache.has(sha)) return fieldCache.get(sha);
  const file = path.join(DOCS, entry.source.fieldUrl);
  const buf = fs.readFileSync(file);
  assert.equal(buf.length, 4 * 2 * N * N * M,
    `${entry.id}: ${entry.source.fieldUrl} is ${buf.length} bytes`);
  const all = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  // Channel 0 only, copied out frame by frame: that is what both rules read.
  const u = new Float32Array(N * N * M);
  for (let t = 0; t < M; t++) u.set(all.subarray((t * 2) * N * N, (t * 2 + 1) * N * N), t * N * N);
  if (fieldCache.size > 3) fieldCache.clear();
  fieldCache.set(sha, u);
  return u;
}

/** One colour frame of an entry, at saved phase t, as an Int8Array[y * N + x].
 *
 * `argmax` here breaks a tie the way numpy's does — the lowest index wins — and
 * that is exactly why the catalog refuses any entry with a tie: the tie-break is
 * not carried along by a relabelling, so a tied node-frame silently breaks the
 * law rather than loudly failing it. */
function colourFrame(entry, u, t) {
  const {N, M} = entry.source;
  const out = new Int8Array(N * N);
  const at = (tt, yy, xx) => u[(mod(tt, M) * N + mod(yy, N)) * N + mod(xx, N)];
  if (entry.kind === 'gyre') {
    const [wx, wy] = entry.colouring.w;
    const third = M / 3;
    const [sx, sy] = apply(S, wx, wy);
    const offs = [[0, 0], [wx, wy], [wx + sx, wy + sy]];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let best = -Infinity, arg = 0;
      // S applied k times, then the offset — written out rather than folded, so
      // it reads like the definition of the rule.
      for (let k = 0; k < 3; k++) {
        let qx = x, qy = y;
        for (let i = 0; i < k; i++) [qx, qy] = apply(S, qx, qy);
        const val = at(t + k * third, qy + offs[k][1], qx + offs[k][0]);
        if (val > best) { best = val; arg = k; }
      }
      out[y * N + x] = arg;
    }
  } else {
    const bx = N / 3, by = (2 * N) / 3;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let best = -Infinity, arg = 0;
      for (let k = 0; k < 3; k++) {
        const val = at(t, y + k * by, x + k * bx);
        if (val > best) { best = val; arg = k; }
      }
      out[y * N + x] = arg;
    }
  }
  return out;
}

const phasesOf = entry => {
  const M = entry.source.M;
  if (FULL) return Array.from({length: M}, (_, t) => t);
  const step = Math.max(1, Math.floor(M / PHASE_SAMPLES));
  return Array.from({length: PHASE_SAMPLES}, (_, i) => (i * step) % M);
};

/** How many of the sampled node-frames break colour(M x + v, t + frames) =
 * perm(colour(x, t)). */
function violations(entry, u, op, phases) {
  const {N, M} = entry.source;
  const Mat = op.turn ?? op.M ?? POINT_OPS[op.name ?? op.op];
  const [vx, vy] = op.v;
  const perm = op.perm;
  const frames = op.frames;
  let bad = 0;
  const cache = new Map();
  const frameAt = t => {
    const key = mod(t, M);
    if (!cache.has(key)) cache.set(key, colourFrame(entry, u, key));
    return cache.get(key);
  };
  for (const t of phases) {
    const src = frameAt(t);
    const dst = frameAt(t + frames);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const [qx, qy] = apply(Mat, x, y);
      if (dst[mod(qy + vy, N) * N + mod(qx + vx, N)] !== perm[src[y * N + x]]) bad++;
    }
  }
  return bad;
}

const isPermutation = p => Array.isArray(p) && p.length === 3
  && [...p].sort().join('') === '012';

// ---------------------------------------------------------------- the manifest

test('manifest: schema, palette, models and colourings', () => {
  assert.equal(catalog.schema, 'colour-atlas-v1');
  assert.equal(catalog.gateVersion, 'colour-offline-v1');
  assert.equal(catalog.palette.length, 3);
  for (const hex of catalog.palette) assert.match(hex, /^#[0-9a-f]{6}$/);
  assert.ok(Object.keys(catalog.models).length >= 3, 'at least three equations');
  assert.equal(Object.keys(catalog.pointOps).length, 12, 'the twelve point operations');
  for (const [name, mat] of Object.entries(catalog.pointOps)) {
    assert.deepEqual(mat, POINT_OPS[name], `pointOps.${name}`);
  }
  assert.ok(catalog.failureLabels.length >= 1, 'failureLabels');
  for (const key of ['symmetryRow', 'failureRow', 'hoisted', 'floats']) {
    assert.ok(catalog.shape[key], `shape.${key} missing — the compaction is undocumented`);
  }
  for (const key of ['atlas', 'record']) assert.ok(catalog.gates[key], `gates.${key}`);
  for (const [id, model] of Object.entries(catalog.models)) {
    for (const key of ['name', 'axes', 'labels', 'parameters', 'diffusion', 'channels',
                       'equation', 'description']) {
      assert.ok(model[key] !== undefined, `models.${id}.${key} missing`);
    }
    assert.equal(model.axes.length, 2, `models.${id}.axes must name two parameters`);
    for (const axis of model.axes) assert.ok(model.parameters.includes(axis));
    for (const d of model.diffusion) assert.ok(model.parameters.includes(d));
    assert.equal(model.channels.length, 2);
    assert.ok(model.description.length > 120, `models.${id}.description is a paragraph`);
  }
  for (const key of ['gyre', 'trefoil']) {
    assert.ok(catalog.colourings[key], `colourings.${key} missing`);
    assert.ok(catalog.colourings[key].rule.includes('argmax'));
  }
});

test('manifest: the counts block agrees with the entries', () => {
  const c = catalog.counts;
  assert.equal(c.all.entries, entries.length);
  assert.equal(c.all.gyre + c.all.trefoil, entries.length);
  assert.equal(c.existing.entries + c.new.entries, entries.length);
  assert.equal(c.all.featured, entries.filter(e => e.featured).length);
  const seen = {};
  for (const e of entries) {
    const key = `${e.kind}|${e.source.model}|${e.source.groupId}`;
    seen[key] = (seen[key] ?? 0) + 1;
  }
  assert.deepEqual(c.byKindModelGroup, Object.fromEntries(Object.entries(seen).sort()));
});

test('catalog: ids unique and the order deterministic', () => {
  const ids = entries.map(e => e.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate entry id');
  const key = e => [e.kind, e.source.groupId, e.source.model,
                    (e.metrics.boundaryDensity ?? 9).toFixed(6), e.id].join(' ');
  const sorted = [...entries].map(key).sort();
  assert.deepEqual(entries.map(key), sorted, 'entries are not in the builder’s sort order');
});

test('catalog: the diversity the explorer pages need', () => {
  // Gyre lives on any hexagonal film group; Trefoil needs the host field to
  // carry an exact symmetry h with h b = -b, which on this lattice only the p6
  // groups g247 and g248 supply — so two film groups is all there can be, and
  // asserting three would be asserting something false about the mathematics.
  const wantGroups = {gyre: 3, trefoil: 2};
  for (const kind of ['gyre', 'trefoil']) {
    const of = entries.filter(e => e.kind === kind);
    assert.ok(of.length >= 8, `${kind}: ${of.length} entries, want at least 8`);
    assert.ok(new Set(of.map(e => e.source.groupId)).size >= wantGroups[kind],
      `${kind}: fewer than ${wantGroups[kind]} film groups`);
    assert.ok(new Set(of.map(e => e.source.model)).size >= 3, `${kind}: fewer than 3 equations`);
    assert.ok(of.some(e => e.featured), `${kind}: nothing featured`);
  }
  // Both chiralities of at least one orbit, and both colourings of at least one
  // field, so the pages have a pair to put side by side.
  assert.ok(entries.some(e => e.source.chirality), 'no chirality pair in the catalog');
  const byField = new Map();
  for (const e of entries) byField.set(e.source.fieldSha256,
    (byField.get(e.source.fieldSha256) ?? 0) + 1);
  assert.ok([...byField.values()].some(n => n === 2), 'no field carries both colourings');
});

test('catalog: featured chirality pairs are whole, and counts.chiralityPairs counts pairs', () => {
  // A featured blurb may say the mirror is in the catalog, and the pages badge
  // `mirror partner <group>` only when the partner is shipped — so a trim that
  // keeps one half of a featured pair makes the page contradict itself. The
  // builder protects the partner of anything featured; this is that promise.
  const shipped = new Map(entries.map(e => [`${e.kind}|${e.source.fieldSha256}`, e]));
  for (const e of entries) {
    if (!e.featured || !e.source.chirality) continue;
    assert.ok(shipped.has(`${e.kind}|${e.source.chirality.partnerSha256}`),
      `${e.id} is featured and names a chirality partner the catalog does not ship`);
  }
  // counts.chiralityPairs is a count of PAIRS the pages can put side by side:
  // two shipped entries of one kind naming each other. The search's own links
  // can dangle (the partner was trimmed) or be one-way (two entries naming one
  // mirror), and those are counted apart, in chiralityUnpaired.
  const pairs = new Set();
  let carried = 0;
  for (const e of entries) {
    if (!e.source.chirality) continue;
    carried += 1;
    const mate = shipped.get(`${e.kind}|${e.source.chirality.partnerSha256}`);
    if (mate?.source.chirality?.partnerSha256 === e.source.fieldSha256) {
      pairs.add([e.id, mate.id].sort().join(' '));
    }
  }
  assert.equal(catalog.counts.chiralityPairs, pairs.size, 'counts.chiralityPairs');
  assert.equal(catalog.counts.chiralityUnpaired, carried - 2 * pairs.size,
    'counts.chiralityUnpaired');
  assert.ok(pairs.size >= 1, 'no whole chirality pair in the catalog');
});

// ---------------------------------------------------------------- per-entry schema

test('entries: schema gates', () => {
  for (const e of entries) {
    const where = `${e.id}`;
    assert.ok(['gyre', 'trefoil'].includes(e.kind), `${where}: kind`);
    const s = e.source;
    for (const key of ['origin', 'model', 'groupId', 'params', 'N', 'M', 'period', 'L',
                       'fieldUrl', 'fieldSha256', 'gate', 'provenance']) {
      assert.ok(s[key] !== undefined && s[key] !== null, `${where}: source.${key} missing`);
    }
    assert.ok(['atlas', 'record'].includes(s.origin), `${where}: source.origin`);
    assert.ok(catalog.models[s.model], `${where}: model ${s.model} is not in the models table`);
    for (const name of catalog.models[s.model].parameters) {
      assert.ok(Number.isFinite(s.params[name]), `${where}: params.${name} not finite`);
    }
    for (const name of catalog.models[s.model].diffusion) {
      assert.ok(s.params[name] > 0, `${where}: diffusion ${name} must be positive`);
    }
    assert.equal(s.params.stencil, 'triangular-six', `${where}: stencil`);
    assert.match(s.fieldSha256, /^[0-9a-f]{64}$/, `${where}: fieldSha256`);
    assert.equal(s.fieldByteLength, 4 * 2 * s.N * s.N * s.M, `${where}: byteLength`);
    assert.equal(s.fieldValueCount, 2 * s.N * s.N * s.M, `${where}: valueCount`);
    assert.equal(s.N % 3, 0, `${where}: N must be divisible by 3`);
    assert.equal(s.M % 3, 0, `${where}: M must be divisible by 3`);
    assert.ok(s.period > 0, `${where}: period`);
    assert.equal(s.gate.gateVersion, catalog.gateVersion, `${where}: gate version`);
    assert.equal(s.gate.passed, true, `${where}: gate did not pass`);
    if (s.origin === 'record') {
      assert.ok(s.provenance.job, `${where}: provenance.job`);
      assert.ok(s.provenance.batch, `${where}: provenance.batch`);
      assert.equal(s.provenance.kind, 'equation-search');
      assert.equal(s.fieldUrl, `colour/data/orbits/${s.fieldSha256}.f32`);
    }
    assert.equal(e.metrics.ties, 0, `${where}: ${e.metrics.ties} argmax ties`);
    assert.ok(e.exactSymmetryCount >= 1, `${where}: no exact symmetry`);
    assert.equal(e.symmetries.length, e.exactSymmetryCount, `${where}: symmetry count`);
    for (const row of e.symmetries) {
      assert.equal(row.agreement, 1, `${where}: a "symmetry" with agreement < 1`);
      assert.ok(isPermutation(row.perm), `${where}: bad perm ${row.perm}`);
      assert.ok(POINT_OPS[row.name], `${where}: unknown point op ${row.name}`);
      // The matrix itself is hoisted: the row names the operation and the
      // manifest holds the twelve matrices once.
      assert.deepEqual(catalog.pointOps[row.name], POINT_OPS[row.name],
        `${where}: manifest pointOps.${row.name} disagrees with the point group`);
      assert.ok(Number.isInteger(row.frames) && row.frames >= 0 && row.frames < s.M);
      assert.ok(row.v.every(Number.isInteger), `${where}: v must be whole nodes`);
    }
    for (const row of e.failures ?? []) {
      assert.ok(row.agreement < 1, `${where}: a "failure" with agreement 1`);
      assert.ok(catalog.failureLabels[row.label] !== undefined,
        `${where}: failure label ${row.label} is not in failureLabels`);
    }
    if (e.kind === 'gyre') {
      assert.ok(e.colouring.w.every(Number.isInteger), `${where}: w must be whole nodes`);
      assert.equal(s.M % 3, 0);
    } else {
      assert.deepEqual(e.colouring.bNodes, [s.N / 3, (2 * s.N) / 3], `${where}: bNodes`);
      assert.equal(e.colourGroup, 'S3', `${where}: Trefoil must reach S3`);
    }
  }
});

test('entries: every thumbnail exists and is under the size ceiling', () => {
  for (const e of entries) {
    const file = path.join(COLOUR, e.thumbnail);
    assert.ok(fs.existsSync(file), `${e.id}: ${e.thumbnail} missing`);
    const bytes = fs.statSync(file).size;
    assert.ok(bytes <= 40000, `${e.id}: thumbnail is ${bytes} bytes, ceiling is 40000`);
    assert.ok(bytes > 200, `${e.id}: thumbnail is empty`);
  }
});

test('catalog: the JSON stays small enough to ship', () => {
  // The builder's own default ceiling, which it enforces by trimming the
  // selection until it holds. Asserting the same number here is what stops the
  // ceiling from quietly becoming advisory.
  const bytes = fs.statSync(path.join(COLOUR, 'data', 'colour-atlas.json')).size;
  assert.ok(bytes <= 4.5e6, `colour-atlas.json is ${(bytes / 1e6).toFixed(3)} MB, ceiling 4.5 MB`);
  // Fields are never inline: the whole catalog must stay well under what one
  // orbit weighs on disk.
  for (const e of entries) {
    assert.equal(typeof e.source.fieldUrl, 'string');
    assert.ok(e.field === undefined && e.source.field === undefined,
      `${e.id}: a field is inlined in the catalog`);
  }
});

// ---------------------------------------------------------------- generators

test('entries: generator marks are well formed', () => {
  for (const e of entries) {
    const where = e.id;
    assert.ok(Array.isArray(e.generators) && e.generators.length >= 2, `${where}: no generators`);
    assert.ok(e.symbol && e.symbol.unicode && e.symbol.html && e.symbol.ascii, `${where}: symbol`);
    const names = new Set();
    for (const g of e.generators) {
      assert.ok(!names.has(g.name), `${where}: duplicate generator ${g.name}`);
      names.add(g.name);
      assert.ok(['rotation', 'translation'].includes(g.kind), `${where}/${g.name}: kind`);
      assert.ok(isPermutation(g.perm), `${where}/${g.name}: perm ${g.perm}`);
      assert.equal(g.violations, 0, `${where}/${g.name}: ${g.violations} violations recorded`);
      assert.ok(g.masterRule, `${where}/${g.name}: fails sigma(c) = (-1)^m c - j`);
      assert.ok(g.v.every(Number.isInteger), `${where}/${g.name}: v must be whole nodes`);
      assert.ok(Number.isInteger(g.frames) && g.frames >= 0 && g.frames < e.source.M);
      assert.ok(typeof g.symbol === 'string' && g.symbol.length, `${where}/${g.name}: symbol`);
      assert.ok(typeof g.base === 'string', `${where}/${g.name}: base`);
      assert.ok(g.sup === null || typeof g.sup === 'string', `${where}/${g.name}: sup`);
      assert.ok(g.sub === null || typeof g.sub === 'string', `${where}/${g.name}: sub`);
      assert.ok(g.reading.length > 30, `${where}/${g.name}: reading is not a sentence`);
      assert.equal(g.cycle, cycleOf(g.perm), `${where}/${g.name}: cycle notation`);
      if (g.kind === 'rotation') {
        assert.ok([2, 3, 6].includes(g.order), `${where}/${g.name}: order ${g.order}`);
        assert.equal(g.degrees % 60, 0, `${where}/${g.name}: degrees`);
        assert.equal(g.frames * g.order, g.k * e.source.M, `${where}/${g.name}: k`);
        assert.deepEqual(g.turn, POINT_OPS[g.op], `${where}/${g.name}: turn matrix`);
        // v = (I - R) c, exactly, in whole nodes.
        const c = g.centreExact.map(([p, q]) => p / q);
        const [rx, ry] = apply(g.turn, c[0], c[1]);
        const vx = Math.round((c[0] - rx) * e.source.N), vy = Math.round((c[1] - ry) * e.source.N);
        assert.equal(mod(vx, e.source.N), mod(g.v[0], e.source.N), `${where}/${g.name}: v vs centre`);
        assert.equal(mod(vy, e.source.N), mod(g.v[1], e.source.N), `${where}/${g.name}: v vs centre`);
      } else {
        assert.deepEqual(g.turn, [[1, 0], [0, 1]], `${where}/${g.name}: a slide does not turn`);
        const [ux, uy] = g.vectorExact.map(([p, q]) => p / q);
        assert.equal(mod(Math.round(ux * e.source.N), e.source.N), mod(g.v[0], e.source.N));
        assert.equal(mod(Math.round(uy * e.source.N), e.source.N), mod(g.v[1], e.source.N));
      }
    }
    // The symbol is exactly the marks, in order.
    const turns = e.generators.filter(g => g.kind === 'rotation').map(g => g.symbol).join(' ');
    const slides = e.generators.filter(g => g.kind === 'translation').map(g => g.symbol).join(' ');
    assert.equal(e.symbol.unicode, turns + (turns && slides ? ' · ' : '') + slides,
      `${where}: symbol does not match the marks`);
  }
});

test('entries: the generator relation closes, in motion, time and colour', () => {
  for (const e of entries) {
    const rel = e.generatorRelation;
    assert.ok(rel, `${e.id}: no generator relation`);
    assert.equal(rel.holds, true, `${e.id}: ${rel.product} is not the identity`);
    assert.deepEqual(rel.perm, [0, 1, 2], `${e.id}: the colour moves do not undo one another`);
    assert.equal(rel.periods, Math.round(rel.periods),
      `${e.id}: the waits add to ${rel.periods} periods, not a whole number`);
  }
});

test('entries: the periodic centre classes are consistent with the marks', () => {
  for (const e of entries) {
    const cls = e.centres;
    assert.ok(cls && Array.isArray(cls.classes) && cls.classes.length >= 1, `${e.id}: no centres`);
    assert.equal(cls.truncated, 0, `${e.id}: ${cls.truncated} centre classes dropped`);
    const seen = new Set();
    for (const c of cls.classes) {
      const key = c.at.join(',');
      assert.ok(!seen.has(key), `${e.id}: repeated centre ${key}`);
      seen.add(key);
      assert.ok([2, 3, 6].includes(c.order), `${e.id}: centre of order ${c.order}`);
      assert.equal(c.rows.length, c.order - 1, `${e.id}: centre of order ${c.order} has ${c.rows.length} rows`);
      for (const [msix, frames, perm, j] of c.rows) {
        assert.ok(msix >= 1 && msix <= 5, `${e.id}: m = ${msix}`);
        assert.ok(Number.isInteger(frames) && frames >= 0 && frames < e.source.M);
        const sigma = [...perm].map(Number);
        assert.ok(isPermutation(sigma), `${e.id}: centre perm ${perm}`);
        for (let c0 = 0; c0 < 3; c0++) {
          assert.equal(sigma[c0], mod((msix % 2 ? -c0 : c0) - j, 3),
            `${e.id}: centre at ${key} breaks sigma(c) = (-1)^m c - j`);
        }
      }
    }
    // Every rotation mark must appear among the centre classes.
    for (const g of e.generators.filter(g => g.kind === 'rotation')) {
      const at = g.centre.map(x => Number(x)).join(',');
      const found = cls.classes.find(c => c.at.join(',') === at);
      assert.ok(found, `${e.id}: the centre of ${g.name} is not in the periodic set`);
      const row = found.rows.find(r => r[0] === g.msixths);
      assert.ok(row, `${e.id}: ${g.name} is not a row of its own centre`);
      assert.equal(row[1], g.frames, `${e.id}: ${g.name} frames disagree with the centre class`);
      assert.equal(row[2], g.perm.join(''), `${e.id}: ${g.name} perm disagrees with the centre class`);
    }
  }
});

function cycleOf(perm) {
  const seen = new Set();
  let out = '';
  for (let start = 0; start < 3; start++) {
    if (seen.has(start)) continue;
    if (perm[start] === start) { seen.add(start); continue; }
    const cyc = [];
    let c = start;
    while (!seen.has(c)) { seen.add(c); cyc.push(c); c = perm[c]; }
    out += `(${cyc.join('')})`;
  }
  return out;
}

// ---------------------------------------------------------------- the bytes

test('fields: a sample of orbits hashes to the sha the catalog names', () => {
  const step = Math.max(1, Math.floor(entries.length / SHA_SAMPLES));
  const seen = new Set();
  for (let i = 0; i < entries.length; i += step) {
    const e = entries[i];
    if (seen.has(e.source.fieldSha256)) continue;
    seen.add(e.source.fieldSha256);
    const file = path.join(DOCS, e.source.fieldUrl);
    const buf = fs.readFileSync(file);
    assert.equal(buf.length, e.source.fieldByteLength, `${e.id}: ${e.source.fieldUrl} length`);
    assert.equal(crypto.createHash('sha256').update(buf).digest('hex'), e.source.fieldSha256,
      `${e.id}: ${e.source.fieldUrl} does not hash to its recorded sha256`);
  }
  assert.ok(seen.size >= Math.min(SHA_SAMPLES, entries.length) - 2, 'too few fields sampled');
});

test('fields: every fieldUrl resolves and has the right byte length', () => {
  const seen = new Set();
  for (const e of entries) {
    if (seen.has(e.source.fieldUrl)) continue;
    seen.add(e.source.fieldUrl);
    const file = path.join(DOCS, e.source.fieldUrl);
    assert.ok(fs.existsSync(file), `${e.id}: ${e.source.fieldUrl} does not exist`);
    assert.equal(fs.statSync(file).size, e.source.fieldByteLength,
      `${e.id}: ${e.source.fieldUrl} is the wrong length`);
  }
});

// ---------------------------------------------------------------- the laws

// Entries are visited field by field, so one orbit is read from disk once
// however many colourings it carries.
const byField = new Map();
for (const e of entries) {
  if (!byField.has(e.source.fieldUrl)) byField.set(e.source.fieldUrl, []);
  byField.get(e.source.fieldUrl).push(e);
}

test('laws: every measured symmetry holds on the sampled phases, re-derived in JS', () => {
  for (const group of byField.values()) {
    for (const e of group) {
      const u = loadU(e);
      const phases = phasesOf(e);
      // The whole measured table for small entries; a spread of it for large
      // ones, so an entry with 450 symmetries does not dominate the run.
      const rows = e.symmetries.length <= 24 || FULL ? e.symmetries
        : e.symmetries.filter((_, i) => i % Math.ceil(e.symmetries.length / 24) === 0);
      for (const row of rows) {
        assert.equal(violations(e, u, row, phases), 0,
          `${e.id}: ${row.name} v=${row.v} +${row.frames} perm=${row.perm} fails`);
      }
    }
  }
});

test('laws: every generator mark holds on the sampled phases, re-derived in JS', () => {
  for (const group of byField.values()) {
    for (const e of group) {
      const u = loadU(e);
      const phases = phasesOf(e);
      for (const g of e.generators) {
        assert.equal(violations(e, u, g, phases), 0,
          `${e.id}: generator ${g.name} (${g.symbol}) fails on the samples`);
      }
    }
  }
});

test('laws: the colouring rule itself has no ties on the sampled phases', () => {
  for (const group of byField.values()) {
    for (const e of group) {
      const u = loadU(e);
      const {N, M} = e.source;
      const at = (tt, yy, xx) => u[(mod(tt, M) * N + mod(yy, N)) * N + mod(xx, N)];
      let ties = 0;
      for (const t of phasesOf(e)) {
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const vals = [];
          if (e.kind === 'gyre') {
            const [wx, wy] = e.colouring.w;
            const [sx, sy] = apply(S, wx, wy);
            const offs = [[0, 0], [wx, wy], [wx + sx, wy + sy]];
            for (let k = 0; k < 3; k++) {
              let qx = x, qy = y;
              for (let i = 0; i < k; i++) [qx, qy] = apply(S, qx, qy);
              vals.push(at(t + (k * M) / 3, qy + offs[k][1], qx + offs[k][0]));
            }
          } else {
            for (let k = 0; k < 3; k++) {
              vals.push(at(t, y + (k * 2 * N) / 3, x + (k * N) / 3));
            }
          }
          const sorted = [...vals].sort((a, b) => a - b);
          if (sorted[2] === sorted[1]) ties++;
        }
      }
      assert.equal(ties, 0, `${e.id}: ${ties} tied node-frames among the sampled phases`);
    }
  }
});

test('laws: the colour shares the catalog records are the ones the bytes give', () => {
  for (const group of byField.values()) {
    for (const e of group) {
      const u = loadU(e);
      const {N} = e.source;
      const counts = [0, 0, 0];
      const phases = phasesOf(e);
      for (const t of phases) {
        const frame = colourFrame(e, u, t);
        for (let i = 0; i < frame.length; i++) counts[frame[i]]++;
      }
      const total = phases.length * N * N;
      for (let k = 0; k < 3; k++) {
        const share = counts[k] / total;
        assert.ok(Math.abs(share - e.metrics.areaFractions[k]) < 0.06,
          `${e.id}: colour ${k} holds ${share.toFixed(4)} of the sampled frames, `
          + `the catalog says ${e.metrics.areaFractions[k]}`);
        assert.ok(share > 0.15 && share < 0.55, `${e.id}: colour ${k} share ${share.toFixed(4)}`);
      }
    }
  }
});
