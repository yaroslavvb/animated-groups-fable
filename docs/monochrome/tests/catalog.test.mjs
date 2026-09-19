/**
 * The monochrome catalog, re-derived in JavaScript from the bytes the pages load.
 *
 *   node --test docs/monochrome/tests/catalog.test.mjs        # ~60 s, sampled
 *   MONO_SAMPLE=40 node --test docs/monochrome/tests/catalog.test.mjs
 *   MONO_FULL=1 node --test docs/monochrome/tests/catalog.test.mjs   # every entry
 *
 * Nothing here trusts the catalog.  For every sampled entry the rule is rebuilt
 * from the field file; the swap law, the half-period law, the preserving law and
 * (on a strict entry) the strict law are re-measured; the whole metrics block is
 * recomputed; the measured U/V lag is searched for again; a sample of the claimed
 * two-colour symmetries is re-tested at every saved node-frame; and every
 * `rule.sameAs` claim with a shift is re-applied node-frame by node-frame.  The
 * quality gate, which is the one thing measured on the doubled reconstruction
 * grid rather than on the saved nodes, is re-derived there too -- including the
 * Weave's published zero speckle, with a band-limited upsample written here.
 *
 * A catalog that only agreed with itself would prove nothing.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const DOCS = new URL('../../', import.meta.url);
const HERE = new URL('../', import.meta.url);
const atlas = JSON.parse(await readFile(new URL('data/monochrome-atlas.json', HERE), 'utf8'));
const wallpaper = JSON.parse(
  await readFile(new URL('scott-gray/data/wallpaper-atlas.json', DOCS), 'utf8'));

const FULL = process.env.MONO_FULL === '1';
const SAMPLE = Number(process.env.MONO_SAMPLE || 90);

// --------------------------------------------------------------------------- helpers

const mod = (a, n) => ((a % n) + n) % n;

/** Both channels of a field as {u, v}: Float64Array of M*N*N, x fastest. */
async function loadField(url, n, m) {
  const buf = await readFile(new URL(url, DOCS));
  assert.equal(buf.byteLength, m * 2 * n * n * 4, `${url}: byte length`);
  const raw = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  const out = { u: new Float64Array(m * n * n), v: new Float64Array(m * n * n) };
  for (let t = 0; t < m; t++) {
    for (let i = 0; i < n * n; i++) {
      out.u[t * n * n + i] = raw[(t * 2 + 0) * n * n + i];
      out.v[t * n * n + i] = raw[(t * 2 + 1) * n * n + i];
    }
  }
  return out;
}

/** field(P x + c, t + frames) as a new volume. */
function move(f, n, m, P, c, frames) {
  const out = new Float64Array(f.length);
  for (let t = 0; t < m; t++) {
    const src = mod(t + frames, m) * n * n;
    const dst = t * n * n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const qx = mod(P[0][0] * x + P[0][1] * y + c[0], n);
        const qy = mod(P[1][0] * x + P[1][1] * y + c[1], n);
        out[dst + y * n + x] = f[src + qy * n + qx];
      }
    }
  }
  return out;
}

function median(f) {
  const s = Float64Array.from(f).sort();
  const k = s.length >> 1;
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
}

function ruleVolume(entry, field, n, m) {
  const u = field[entry.rule.channel];
  const w = new Float64Array(u.length);
  if (entry.kind === 'threshold') {
    const med = median(u);
    for (let i = 0; i < u.length; i++) w[i] = u[i] - med;
    return w;
  }
  const image = entry.kind === 'half-period'
    ? move(u, n, m, [[1, 0], [0, 1]], [0, 0], m / 2)
    : move(u, n, m, entry.rule.M, entry.rule.v, 0);
  for (let i = 0; i < u.length; i++) w[i] = u[i] - image[i];
  return w;
}

/** The rule of a packed sameAs / strictReadings row, on a given channel. */
function rowVolume(row, entry, field, n, m, ops) {
  const kindOf = Object.fromEntries(Object.entries(atlas.ruleKindCodes).map(([k, v]) => [v, k]));
  const kind = kindOf[row[0]];
  const u = field[entry.rule.channel];
  const w = new Float64Array(u.length);
  if (kind === 'threshold') {
    const med = median(u);
    for (let i = 0; i < u.length; i++) w[i] = u[i] - med;
    return w;
  }
  const image = kind === 'half-period'
    ? move(u, n, m, [[1, 0], [0, 1]], [0, 0], m / 2)
    : move(u, n, m, ops[row[1]].M, [row[2], row[3]], 0);
  for (let i = 0; i < u.length; i++) w[i] = u[i] - image[i];
  return w;
}

const sign = w => { const s = new Int8Array(w.length); for (let i = 0; i < w.length; i++) s[i] = Math.sign(w[i]); return s; };
const drawnOf = w => { const s = new Int8Array(w.length); for (let i = 0; i < w.length; i++) s[i] = w[i] > 0 ? 1 : -1; return s; };
const maxAbs = w => { let b = 0; for (let i = 0; i < w.length; i++) b = Math.max(b, Math.abs(w[i])); return b; };

function relative(a, b, scale, negate) {
  let worst = 0;
  for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(negate ? a[i] + b[i] : a[i] - b[i]));
  return worst / scale;
}

const EDGES = { square: [[1, 0], [0, 1]], triangular: [[1, 0], [0, 1], [1, 1]] };
const NBRS = {
  square: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  triangular: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]],
};

function measure(w, n, m, lattice, uStd) {
  const size = w.length;
  let white = 0, black = 0, amp = 0;
  for (let i = 0; i < size; i++) { if (w[i] > 0) white++; else if (w[i] < 0) black++; amp += Math.abs(w[i]); }
  const drawn = i => (w[i] > 0 ? 1 : 0);
  const at = (t, y, x) => mod(t, m) * n * n + mod(y, n) * n + mod(x, n);
  const cross = EDGES[lattice].map(([dx, dy]) => {
    let c = 0;
    for (let t = 0; t < m; t++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
      if (drawn(at(t, y, x)) !== drawn(at(t, y + dy, x + dx))) c++;
    return c / size;
  });
  let speckle = 0, churn = 0;
  for (let t = 0; t < m; t++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const me = drawn(at(t, y, x));
    if (NBRS[lattice].every(([dx, dy]) => drawn(at(t, y + dy, x + dx)) !== me)) speckle++;
    if (drawn(at(t + 1, y, x)) !== me) churn++;
  }
  const boundary = cross.reduce((a, b) => a + b, 0) / cross.length;
  return {
    white: white / size, black: black / size,
    imbalance: Math.abs(white - black) / size,
    tieFraction: 1 - (white + black) / size,
    boundaryDensity: boundary,
    boundaryByDirection: cross,
    runLengthNodes: boundary > 0 ? 1 / boundary : null,
    speckle: speckle / size, churn: churn / size,
    amplitude: amp / size / uStd,
  };
}

function std(f) {
  let s = 0, q = 0;
  for (let i = 0; i < f.length; i++) s += f[i];
  const mean = s / f.length;
  for (let i = 0; i < f.length; i++) q += (f[i] - mean) ** 2;
  return Math.sqrt(q / f.length);
}

// --------------------------------------------------------------------------- doubled grid
//
// The quality gate is measured on the spectrally doubled grid, so the test has
// to reconstruct it rather than take the builder's word.  N is not a power of
// two (48, 36, 66, ...), so this is a plain O(n^2) DFT per line with a cached
// twiddle table -- slow, and only ever run on a handful of frames.

const twiddles = new Map();
function twiddle(n) {
  if (!twiddles.has(n)) {
    const c = new Float64Array(n * n), s = new Float64Array(n * n);
    for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) {
      c[k * n + j] = Math.cos(-2 * Math.PI * k * j / n);
      s[k * n + j] = Math.sin(-2 * Math.PI * k * j / n);
    }
    twiddles.set(n, { c, s });
  }
  return twiddles.get(n);
}

/** In-place 1-D DFT of `count` interleaved lines of length n, stride `stride`. */
function dftLines(re, im, n, count, stride, base, step, inverse) {
  const { c, s } = twiddle(n);
  const tr = new Float64Array(n), ti = new Float64Array(n);
  for (let line = 0; line < count; line++) {
    const o = base + line * step;
    for (let k = 0; k < n; k++) {
      let ar = 0, ai = 0;
      for (let j = 0; j < n; j++) {
        const wr = c[k * n + j], wi = inverse ? -s[k * n + j] : s[k * n + j];
        const xr = re[o + j * stride], xi = im[o + j * stride];
        ar += xr * wr - xi * wi;
        ai += xr * wi + xi * wr;
      }
      tr[k] = inverse ? ar / n : ar;
      ti[k] = inverse ? ai / n : ai;
    }
    for (let k = 0; k < n; k++) { re[o + k * stride] = tr[k]; im[o + k * stride] = ti[k]; }
  }
}

/** Band-limited periodic 2x upsample of one n x n frame, as the viewers do it. */
function upsample2(frame, n) {
  const big = 2 * n, h = n >> 1;
  const re = Float64Array.from(frame), im = new Float64Array(n * n);
  dftLines(re, im, n, n, 1, 0, n, false);          // rows
  dftLines(re, im, n, n, n, 0, 1, false);          // columns
  if (n % 2 === 0) {
    for (let i = 0; i < n; i++) {
      re[h * n + i] *= 0.5; im[h * n + i] *= 0.5;
      re[i * n + h] *= 0.5; im[i * n + h] *= 0.5;
    }
  }
  const R = new Float64Array(big * big), I = new Float64Array(big * big);
  const put = (ky, kx, sy, sx) => { R[sy * big + sx] = re[ky * n + kx]; I[sy * big + sx] = im[ky * n + kx]; };
  for (let ky = 0; ky <= h; ky++) {
    for (let kx = 0; kx <= h; kx++) put(ky, kx, ky, kx);
    for (let kx = n - h; kx < n; kx++) put(ky, kx, ky, big - n + kx);
  }
  for (let ky = n - h; ky < n; ky++) {
    for (let kx = 0; kx <= h; kx++) put(ky, kx, big - n + ky, kx);
    for (let kx = n - h; kx < n; kx++) put(ky, kx, big - n + ky, big - n + kx);
  }
  dftLines(R, I, big, big, 1, 0, big, true);
  dftLines(R, I, big, big, big, 0, 1, true);
  for (let i = 0; i < R.length; i++) R[i] *= 4;
  return R;
}

/** The gate's numbers on the doubled grid, over the given frames. */
function measureDoubled(w, n, m, lattice, frames) {
  const big = 2 * n;
  let cross = EDGES[lattice].map(() => 0), speckle = 0, white = 0, size = 0;
  for (const t of frames) {
    const up = upsample2(w.subarray(t * n * n, (t + 1) * n * n), n);
    const at = (y, x) => mod(y, big) * big + mod(x, big);
    const on = i => up[i] > 0;
    for (let i = 0; i < up.length; i++) if (up[i] > 0) white++;
    EDGES[lattice].forEach(([dx, dy], d) => {
      for (let y = 0; y < big; y++) for (let x = 0; x < big; x++)
        if (on(at(y, x)) !== on(at(y + dy, x + dx))) cross[d]++;
    });
    for (let y = 0; y < big; y++) for (let x = 0; x < big; x++) {
      const me = on(at(y, x));
      if (NBRS[lattice].every(([dx, dy]) => on(at(y + dy, x + dx)) !== me)) speckle++;
    }
    size += up.length;
  }
  const boundary = cross.reduce((a, b) => a + b, 0) / cross.length / size;
  return {
    white: white / size,
    boundaryDensity: boundary,
    speckle: speckle / size,
    strandNodes: boundary > 0 ? 1 / boundary / 2 : null,
    strandCells: boundary > 0 ? 1 / boundary / (2 * n) : null,
  };
}

// ---------------------------------------------------------------------------

const close = (a, b, tol = 2e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const thumbName = id => `${id.replaceAll(':', '-')}.png`;

/** A deterministic spread over the catalog: one of every kind on every lattice,
 *  every tier, every origin, the classics, a few featured, then a stride. */
function chosen() {
  if (FULL) return atlas.entries;
  const picked = new Map();
  for (const e of atlas.entries) {
    const f = atlas.fields[e.field];
    for (const key of [`kind:${e.kind}:${f.lattice}`, `tier:${e.tier}`,
                       `chan:${e.rule.channel}`, `origin:${f.origin}`,
                       `model:${f.model}`, `same:${e.rule.sameAs.length ? 'y' : 'n'}`,
                       `ship:${f.shippedPage ? f.shippedPage.name : ''}`]) {
      if (key.endsWith(':')) continue;
      if (!picked.has(key)) picked.set(key, e);
    }
  }
  const out = new Map([...picked.values()].map(e => [e.id, e]));
  for (const id of Object.values(atlas.provenance.classics)) {
    const e = atlas.entries.find(x => x.id === id);
    if (e) out.set(e.id, e);
  }
  for (const e of atlas.entries.filter(e => e.featured).slice(0, 6)) out.set(e.id, e);
  const stride = Math.max(1, Math.floor(atlas.entries.length / Math.max(1, SAMPLE)));
  for (let i = 0; i < atlas.entries.length && out.size < SAMPLE + picked.size; i += stride) {
    out.set(atlas.entries[i].id, atlas.entries[i]);
  }
  return [...out.values()];
}

// --------------------------------------------------------------------------- schema

test('the manifest says what it is, and its own counts are right', () => {
  assert.equal(atlas.schema, 'monochrome-atlas-v2');
  for (const key of ['provenance', 'shape', 'pointOps', 'ruleKinds', 'notes', 'ruleKindCodes',
                     'counts', 'fields', 'entries', 'refused', 'thumbs', 'sameOrbit',
                     'tiers', 'gates', 'classics', 'recordsOnDisk', 'models', 'families']) {
    assert.ok(atlas[key] !== undefined, `manifest has ${key}`);
  }
  const counts = atlas.counts;
  assert.equal(counts.entries, atlas.entries.length);
  assert.equal(counts.fields, new Set(atlas.entries.map(e => e.field)).size);
  assert.equal(counts.fields, Object.keys(atlas.fields).length);
  assert.equal(counts.featured, atlas.entries.filter(e => e.featured).length);

  for (const [name, keyfn] of [['byKind', e => [e.kind]], ['byTier', e => [e.tier]],
                               ['byModel', e => [atlas.fields[e.field].model]],
                               ['byFamily', e => atlas.fields[e.field].families],
                               ['byFamilyTierModel',
                                e => atlas.fields[e.field].families.map(
                                  f => `${f}|${e.tier}|${atlas.fields[e.field].model}`)]]) {
    const got = {};
    for (const e of atlas.entries) for (const k of keyfn(e)) got[k] = (got[k] || 0) + 1;
    assert.deepEqual(counts[name], Object.fromEntries(Object.entries(got).sort()),
      `counts.${name}`);
  }

  const ids = atlas.entries.map(e => e.id);
  assert.equal(new Set(ids).size, ids.length, 'entry ids are unique');
  for (const r of atlas.refused) {
    assert.ok(['already catalogued'].includes(r.reason), `a known refusal: ${r.reason}`);
  }
  // The ceiling the builder asserts, asserted again on the bytes that shipped.
  assert.ok(JSON.stringify(atlas).length <= 4.5e6, 'the catalog is inside 4.5 MB');
});

test('the tier vocabulary is complete and every entry uses it', () => {
  assert.deepEqual(Object.keys(atlas.tiers).sort(), ['broad', 'control', 'strict']);
  for (const t of Object.values(atlas.tiers)) {
    assert.ok(t.title && t.law && t.blurb.length > 80, 'a tier says what it claims');
  }
  const perField = new Map();
  for (const e of atlas.entries) {
    assert.ok(atlas.tiers[e.tier], `${e.id}: ${e.tier} is a known tier`);
    assert.equal(e.tier === 'control', e.kind === 'threshold',
      `${e.id}: the control tier is exactly the threshold rule`);
    if (e.tier === 'strict') {
      assert.equal(e.kind, 'half-period',
        `${e.id}: a strict picture IS the half-period picture`);
      assert.ok(e.rule.strictReadings.length > 0, `${e.id}: a strict entry names its readings`);
      assert.equal(e.laws.halfPeriod[1], 1, `${e.id}: T/2 swaps the inks exactly`);
      // The reading's s exchanges the inks too.  (s, T/2) holds on the saved
      // float32 samples only to the search's residual, so the difference field
      // need not cancel to the last bit -- but the drawn picture must.
      assert.ok(e.laws.strict[0] <= 1e-5,
        `${e.id}: the reading's s swaps w to ${e.laws.strict[0]}`);
      // The drawn inks are exchanged everywhere except, on some orbits, at a
      // handful of samples a frame where |w| is at the float32 noise floor.
      assert.ok(e.laws.strictDrawn[0] <= 0.01,
        `${e.id}: ${e.laws.strictDrawn[0]} of node-frames do not exchange the inks`);
      assert.equal(e.laws.strictDrawn[1], e.laws.strictDrawn[0] === 0 ? 1 : 0);
      // EVERY reading is measured, not only the first, because the page offers
      // every one of them as a chip and prints its numbers. The rows are
      // omitted exactly when they would all be perfect, so a missing block is
      // itself a claim: it says every reading is bit-exact.
      const each = e.laws.strictEach;
      if (each === undefined) {
        assert.deepEqual([e.laws.strict, e.laws.strictDrawn], [[0, 1], [0, 1]],
          `${e.id}: strictEach is omitted only when the first reading is perfect`);
      } else {
        assert.equal(each.length, e.rule.strictReadings.length,
          `${e.id}: one measured row per reading`);
        assert.ok(each.some(row => row[1] !== 1 || row[3] !== 1),
          `${e.id}: strictEach is shipped only when it has something to report`);
        assert.deepEqual(each[0], [...e.laws.strict, ...e.laws.strictDrawn],
          `${e.id}: the first row is strict + strictDrawn`);
        for (const row of each) {
          assert.equal(row.length, 4, `${e.id}: a strictEach row is four numbers`);
          assert.ok(row[0] <= 1e-5, `${e.id}: a reading swaps w to ${row[0]}`);
          assert.equal(row[1], row[0] === 0 ? 1 : 0, `${e.id}: the exact flag matches the residual`);
          assert.ok(row[2] <= 0.01, `${e.id}: a reading draws ${row[2]} of node-frames differently`);
          assert.equal(row[3], row[2] === 0 ? 1 : 0, `${e.id}: the drawn flag matches the fraction`);
        }
      }
      perField.set(e.field, (perField.get(e.field) || 0) + 1);
    } else {
      assert.equal(e.rule.strictReadings, undefined,
        `${e.id}: only a strict entry carries strictReadings`);
    }
    if (e.tier === 'broad' && !['half-period', 'threshold'].includes(e.kind)) {
      assert.equal(typeof e.rule.sIsFieldSymmetryAt, 'number',
        `${e.id}: sIsFieldSymmetryAt is an integer, never null`);
      assert.ok(e.rule.sIsFieldSymmetryAt === -1
        || (e.rule.sIsFieldSymmetryAt > 0
            && e.rule.sIsFieldSymmetryAt !== atlas.fields[e.field].M / 2),
        `${e.id}: a broad involution is a symmetry of the field at no shift, and never at T/2`);
    }
    if (['half-period', 'threshold'].includes(e.kind)) {
      assert.equal('sIsFieldSymmetryAt' in e.rule, false,
        `${e.id}: a rule with no spatial s does not pretend to have one`);
    }
  }
  for (const [field, n] of perField) {
    assert.equal(n, 1, `${field}: a field has at most one strict picture`);
  }
  assert.equal(atlas.counts.strictFields, perField.size);
  assert.equal(atlas.counts.byTier.strict, perField.size);
});

test('every entry names a field, a kind, a point operation and a model the manifest describes',
  () => {
    const families = new Set((atlas.families || []).map(f => f.id));
    assert.equal(families.size, 17, 'the manifest carries the seventeen families');
    for (const e of atlas.entries) {
      const f = atlas.fields[e.field];
      assert.ok(f, `${e.id} names a field in the table`);
      assert.ok(atlas.ruleKinds[e.kind], `${e.id} names a known rule kind`);
      assert.equal(e.kind, e.rule.kind);
      assert.ok(['u', 'v'].includes(e.rule.channel));
      assert.ok(atlas.models[f.model], `${e.id}: model ${f.model} is in the model table`);
      assert.ok(atlas.models[f.model].equation, `${f.model} prints an equation`);
      assert.ok(['square', 'triangular'].includes(f.lattice));
      const ops = atlas.pointOps[f.lattice].ops;
      assert.ok(ops.some(o => o.name === e.rule.op), `${e.id}: ${e.rule.op} is a point op`);
      for (const row of e.symmetries) {
        assert.ok(row[0] >= 0 && row[0] < ops.length, `${e.id}: point op index in range`);
        assert.ok(row[1] >= 0 && row[1] < f.N && row[2] >= 0 && row[2] < f.N);
        assert.ok(row[3] >= 0 && row[3] < f.M);
        assert.ok(row[4] === 0 || row[4] === 1);
      }
      assert.equal(e.symmetries.length, e.group.preserve + e.group.swap);
      assert.equal(e.symmetries.filter(r => r[4] === 1).length, e.group.preserve);
      for (const fam of f.families) assert.ok(families.has(fam), `${fam} is a known family`);
      for (const row of e.rule.sameAs) {
        assert.equal(row.length, 9, `${e.id}: a sameAs row is nine columns`);
        assert.ok(atlas.notes[row[4]], 'sameAs names a note');
        assert.ok([-1, 0, 1].includes(row[8]), 'sameAs sign is -1, 0 or +1');
      }
      for (const row of e.rule.strictReadings || []) {
        assert.equal(row.length, 4);
        assert.ok(row[1] >= 0 && row[1] < ops.length);
      }
    }
  });

test('the framing puts a strand in the band the two shipped pages sit in', () => {
  const [lo, hi] = atlas.gates.framing.band;
  let clamped = 0;
  for (const e of atlas.entries) {
    assert.ok(Number.isInteger(e.view.tiles) && e.view.tiles >= 1
      && e.view.tiles <= atlas.gates.framing.tilesMax, `${e.id}: view.tiles in range`);
    if (e.view.strandPixels === null) continue;
    // strandPixels is CSS pixels: strandCells * gates.framing.tilePixels / tiles.
    const q = e.quality;
    assert.ok(Math.abs(e.view.strandPixels
      - q.strandCells * atlas.gates.framing.tilePixels / e.view.tiles) < 0.1,
      `${e.id}: strandPixels is the framing arithmetic`);
    if (e.view.strandPixels < lo || e.view.strandPixels > hi) {
      // Only allowed at the clamps: a picture so coarse or so fine that no tile
      // count in 1..tilesMax lands it in the band.
      assert.ok(e.view.tiles === 1 || e.view.tiles === atlas.gates.framing.tilesMax,
        `${e.id}: ${e.view.strandPixels} px outside [${lo}, ${hi}] at tiles ${e.view.tiles}`);
      clamped++;
    }
  }
  assert.ok(clamped < atlas.entries.length * 0.1,
    `${clamped} of ${atlas.entries.length} entries could not be framed into the band`);
});

test('the quality gate is recorded for every entry and enforced where it is claimed to be',
  () => {
    assert.equal(atlas.gates.version, 'monochrome-doubled-grid-v1');
    const limits = atlas.gates.limits;
    for (const e of atlas.entries) {
      const q = e.quality;
      assert.ok(typeof q.speckle === 'number' && typeof q.strandNodes === 'number'
        && typeof q.strandCells === 'number' && typeof q.white === 'number',
        `${e.id}: the gate block is filled in`);
      assert.equal(q.grid, 2 * atlas.fields[e.field].N, `${e.id}: measured on the doubled grid`);
      assert.equal(q.passed, (q.failed || []).length ? 0 : 1);
      if (!['half-period', 'threshold'].includes(e.kind)) {
        assert.equal(q.passed, 1, `${e.id}: every broad entry passes the gate`);
        assert.ok(q.speckle <= limits.speckle, `${e.id}: speckle ${q.speckle}`);
        assert.ok(q.white > limits.white[0] && q.white < limits.white[1]);
      }
    }
  });

test('the fields table agrees with the wallpaper atlas it was mined from', () => {
  const orbits = new Map();
  for (const o of wallpaper.orbits) orbits.set(o.id, o);
  for (const [key, f] of Object.entries(atlas.fields)) {
    assert.equal(f.sha256.slice(0, 12), key, 'the key is the sha prefix');
    // A field may stand for several: `sameOrbit` lists the ones the motion test
    // found to be this one, and their atlas ids are carried here.
    const shas = new Set([f.sha256, ...(f.sameOrbit || []).map(r => r.sha256)]);
    for (const id of f.atlasIds) {
      const o = orbits.get(id);
      assert.ok(o, `${id} is in the wallpaper atlas`);
      assert.ok(shas.has(o.fieldSha256), `${id}: its field is this one or one collapsed onto it`);
      if (o.fieldSha256 === f.sha256) {
        assert.equal(o.config.N, f.N);
        assert.equal(o.config.M, f.M);
      }
      assert.ok(f.families.includes(o.family), `${id}: family ${o.family} is carried`);
      assert.ok(f.groupIds.includes(o.groupId), `${id}: group ${o.groupId} is carried`);
    }
    if (f.origin === 'atlas') assert.ok(f.atlasIds.length > 0);
  }
});

test('the records that were ingested resolve, and the ones left on disk are named', () => {
  const rows = atlas.recordsOnDisk.rows;
  assert.deepEqual(atlas.recordsOnDisk.columns,
    ['sha12', 'model', 'family', 'groupId', 'lattice', 'singleMode', 'bytes', 'dir']);
  const shipped = Object.values(atlas.fields).filter(f => f.origin === 'record');
  assert.ok(shipped.length > 0, 'the build ingested search records');
  for (const f of shipped) {
    assert.ok(f.fieldUrl.startsWith('monochrome/data/orbits/'),
      `${f.sha256.slice(0, 12)}: a record field is copied into the catalog's own folder`);
    assert.equal(f.fieldUrl, `monochrome/data/orbits/${f.sha256}.f32`);
    assert.ok(f.recordDir && f.recordDir.includes('research/'),
      'and says which search wrote it');
    assert.ok(typeof f.selectedBecause === 'string' && f.selectedBecause.length > 10,
      'and why it earned repository bytes');
    assert.ok(f.singleMode === 0 || f.singleMode === 1);
    assert.ok(atlas.models[f.model], `${f.model} is described`);
  }
  const onDisk = new Set(rows.map(r => r[0]));
  for (const f of shipped) {
    assert.equal(onDisk.has(f.sha256.slice(0, 12)), false,
      'a shipped field is not also listed as left on disk');
  }
  const budget = atlas.provenance.orbitBudget;
  assert.equal(budget.recordsShipped, shipped.length);
  assert.equal(budget.recordsOnDisk, rows.length);
  assert.ok(budget.bytesShipped <= budget.ceilingBytes,
    `${budget.bytesShipped} bytes of new orbits, ceiling ${budget.ceilingBytes}`);
  assert.equal(budget.bytesShipped,
    shipped.reduce((a, f) => a + f.byteLength, 0), 'the byte total is the files it names');
  // The Modal campaign's whole point: equations that had no orbit on the site.
  const models = new Set(shipped.map(f => f.model));
  for (const want of ['lambda-omega', 'cgl-quintic', 'lengyel-epstein', 'schnakenberg',
                      'fitzhugh-nagumo']) {
    assert.ok(models.has(want), `${want} arrived with the records`);
  }
});

test('one orbit reached twice is one picture, and it keeps every placement', () => {
  const kept = new Set(Object.keys(atlas.fields));
  for (const row of atlas.sameOrbit) {
    assert.ok(kept.has(row.kept), `${row.kept} survived`);
    assert.equal(kept.has(row.dropped), false, `${row.dropped} is not also a field`);
    assert.ok(row.relRms <= atlas.provenance.orbitClasses.tol, 'within the motion tolerance');
    const f = atlas.fields[row.kept];
    for (const g of row.groupIds) assert.ok(f.groupIds.includes(g),
      `${row.kept} carries ${row.dropped}'s film group ${g}`);
    for (const id of row.atlasIds) assert.ok(f.atlasIds.includes(id),
      `${row.kept} carries ${row.dropped}'s atlas id`);
    const ops = atlas.pointOps[f.lattice].ops;
    assert.ok(ops.some(o => o.name === row.op), `${row.op} is an op of this lattice`);
  }
  // The provenance count is over the whole corpus the motion test swept, which
  // includes record fields that were then left on disk; the list is the part of
  // it that hangs off a field the catalog ships.
  assert.ok(atlas.sameOrbit.length <= atlas.provenance.orbitClasses.collapsed,
    'the list is part of the sweep the provenance counts');
  assert.ok(atlas.sameOrbit.length > 0, 'the sweep found repeats, as it should');
});

test('the sort order and the featured flags are what the manifest claims', () => {
  const order = ['strict', 'broad', 'control'];
  const key = e => {
    const f = atlas.fields[e.field];
    return [(f.families[0] || 'zz'), order.indexOf(e.tier), f.model, e.kind, -e.metrics.score,
            e.id];
  };
  for (let i = 1; i < atlas.entries.length; i++) {
    const a = key(atlas.entries[i - 1]), b = key(atlas.entries[i]);
    let cmp = 0;
    for (let k = 0; k < a.length && cmp === 0; k++) cmp = a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0;
    assert.ok(cmp <= 0, `entries ${i - 1} and ${i} are in order`);
  }
  const fams = new Set();
  const perFamily = {};
  for (const e of atlas.entries) {
    if (!e.featured) continue;
    assert.ok(typeof e.featuredWhy === 'string' && e.featuredWhy.length > 10,
      `${e.id} says why it is featured`);
    for (const fam of atlas.fields[e.field].families) {
      fams.add(fam);
      perFamily[fam] = (perFamily[fam] || 0) + 1;
    }
  }
  const all = new Set(Object.values(atlas.fields).flatMap(f => f.families));
  for (const fam of all) {
    assert.ok(perFamily[fam] >= 2, `${fam} has at least two featured pictures`);
    // The judgement is two to four per family, but one picture is filed under
    // every film group that hosts its field, so a p4 field that is also a p4g one
    // counts twice.  The cap is on that inflated number.
    assert.ok(perFamily[fam] <= 16, `${fam}: ${perFamily[fam]} featured is too many`);
  }
  const featured = atlas.entries.filter(e => e.featured);
  assert.ok(featured.length >= 34 && featured.length <= 70,
    `${featured.length} featured pictures`);
  assert.ok(featured.filter(e => e.tier === 'strict').length >= featured.length / 2,
    'the strict tier is the spine of the featured set');
});

// --------------------------------------------------------------------------- thumbnails

test('every entry has a thumbnail, inside its ceiling, and it is a PNG', async () => {
  for (const e of chosen()) {
    const url = new URL(atlas.thumbs.base + thumbName(e.id), HERE);
    const info = await stat(url);
    assert.ok(info.size > 0 && info.size <= 40000, `${e.id}: thumbnail ${info.size} bytes`);
    const head = (await readFile(url)).subarray(0, 8);
    assert.deepEqual([...head], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'PNG magic');
  }
});

// --------------------------------------------------------------------------- the classics

test('the wave and the weave come out with their published groups', async () => {
  const want = {
    'the wave': { field: '731aa45654d4', page: 'Plume Monochrome', preserve: 16, swap: 16 },
    'the weave': { field: '459f00246aed', page: 'Weave Monochrome', preserve: 32, swap: 32 },
  };
  assert.deepEqual(Object.keys(atlas.classics).sort(), Object.keys(want).sort());
  for (const [name, w] of Object.entries(want)) {
    const c = atlas.classics[name];
    assert.equal(c.field, w.field);
    assert.equal(c.tier, 'strict');
    assert.equal(c.preserve, w.preserve);
    assert.equal(c.swap, w.swap);
    assert.deepEqual([c.measured.preserve, c.measured.swap], [w.preserve, w.swap],
      `${name}: measured group order equals the published one`);
    assert.equal(c.measured.speckle, 0, `${name} is published as speckle-free`);
    const field = atlas.fields[w.field];
    assert.ok(field, `${name}'s field is in the catalog`);
    assert.equal(field.shippedPage.name, w.page);
    assert.equal(field.shippedPage.classic, name);
    const e = atlas.entries.find(x => x.id === c.entry);
    assert.ok(e, `${name}'s entry ${c.entry} is in the catalog`);
    assert.equal(e.tier, 'strict');
    assert.equal(e.kind, 'half-period');
    assert.equal(e.group.preserve, w.preserve);
    assert.equal(e.group.swap, w.swap);
    assert.equal(e.shippedPage.matchesPublishedGroup, true);
    assert.equal(e.featured, true, `${name} is featured`);
  }
  // The weave's README says the half turn about the origin, the half-cell slide
  // along x and the half-period rule are the same function on that orbit.
  const weave = atlas.entries.find(e => e.id === atlas.classics['the weave'].entry);
  const kinds = weave.rule.strictReadings.map(r => r[0]);
  assert.ok(kinds.includes(atlas.ruleKindCodes['half-turn']), 'the half turn is a reading');
  assert.ok(kinds.includes(atlas.ruleKindCodes['half-shift']), 'the half-cell slide too');
  for (const row of weave.rule.sameAs) assert.equal(row[4], 0, 'and for the stated reason');
});

test("the weave's published strand width and zero speckle, re-measured on the doubled grid",
  async () => {
    const c = atlas.classics['the weave'];
    const e = atlas.entries.find(x => x.id === c.entry);
    const f = atlas.fields[e.field];
    const field = await loadField(f.fieldUrl, f.N, f.M);
    const w = ruleVolume(e, field, f.N, f.M);
    const frames = [0, 1, 2, 3, 4, 5, 6, 7].map(i => Math.floor(i * f.M / 8));
    const got = measureDoubled(w, f.N, f.M, f.lattice, frames);
    assert.equal(got.speckle, 0, 'no isolated node anywhere on the reconstruction grid');
    // README: 5.93 boundary crossings per cell along x, 48 / 5.93 = 8.09 nodes.
    assert.ok(Math.abs(got.strandNodes - 8.09) < 0.15,
      `strand ${got.strandNodes.toFixed(2)} nodes against the published 8.09`);
    assert.ok(Math.abs(got.strandNodes - e.quality.strandNodes) < 0.2,
      `the catalog says ${e.quality.strandNodes}`);
    assert.ok(Math.abs(got.white - 0.5) < 0.01, 'and a 50/50 split');
  });

// --------------------------------------------------------------------------- re-derivation

test('the rules, the laws, the metrics and the symmetries, re-derived from the field bytes',
  async t => {
    const sample = chosen();
    const byField = new Map();
    for (const e of sample) {
      if (!byField.has(e.field)) byField.set(e.field, []);
      byField.get(e.field).push(e);
    }
    console.log(`  ${sample.length} entries over ${byField.size} fields`);
    for (const [key, entries] of byField) {
      const f = atlas.fields[key];
      const field = await loadField(f.fieldUrl, f.N, f.M);
      const stds = { u: std(field.u), v: std(field.v) };
      const ops = atlas.pointOps[f.lattice].ops;
      for (const e of entries) {
        await t.test(e.id, () => {
          const { N: n, M: m, lattice } = f;
          const w = ruleVolume(e, field, n, m);
          const scale = maxAbs(w);
          assert.ok(scale > 0, 'the rule does not vanish identically');

          // The laws.
          if (e.laws.s) {
            const img = e.kind === 'half-period'
              ? move(w, n, m, [[1, 0], [0, 1]], [0, 0], m / 2)
              : move(w, n, m, e.rule.M, e.rule.v, 0);
            const rel = relative(img, w, scale, true);
            assert.ok(close(rel, e.laws.s[0], 1e-6), `swap law under s: ${rel} vs ${e.laws.s[0]}`);
            if (e.laws.s[1]) assert.equal(rel, 0, 'an exact swap law really is exact');
          }
          if (e.laws.halfPeriod) {
            const img = move(w, n, m, [[1, 0], [0, 1]], [0, 0], m / 2);
            const rel = relative(img, w, scale, true);
            assert.ok(close(rel, e.laws.halfPeriod[0], 1e-6), 'swap under T/2');
            assert.equal(rel === 0, Boolean(e.laws.halfPeriod[1]));
          }
          if (e.laws.both) {
            const img = move(move(w, n, m, [[1, 0], [0, 1]], [0, 0], m / 2),
                             n, m, e.rule.M, e.rule.v, 0);
            const rel = relative(img, w, scale, false);
            assert.ok(close(rel, e.laws.both[0], 1e-6), 'preserve under (s, T/2)');
            assert.equal(rel === 0, Boolean(e.laws.both[1]));
          }

          // The strict claim: every reading is an exact spacetime symmetry of the
          // FIELD, and therefore draws this very picture.
          if (e.tier === 'strict') {
            const u = field[e.rule.channel];
            // `strictEach` is what the page prints beside each chip, so each of
            // its rows is re-derived here rather than bounded. Where the block
            // is absent the claim is that every row would be [0, 1, 0, 1].
            const each = e.laws.strictEach
              ?? e.rule.strictReadings.map(() => [0, 1, 0, 1]);
            e.rule.strictReadings.forEach((row, index) => {
              const P = ops[row[1]].M, c = [row[2], row[3]];
              const img = move(u, n, m, P, c, m / 2);
              let worst = 0;
              for (let i = 0; i < u.length; i++) worst = Math.max(worst, Math.abs(img[i] - u[i]));
              assert.ok(worst <= atlas.gates.symmetryResidual,
                `${ops[row[1]].name} (${c}) with T/2 is a symmetry of the field: ${worst}`);
              const ws = new Float64Array(u.length);
              const si = move(u, n, m, P, c, 0);
              for (let i = 0; i < u.length; i++) ws[i] = u[i] - si[i];
              assert.ok(relative(ws, w, scale, false) <= 1e-5,
                'and so the reading computes this same difference, to that residual');
              // `strictEach` is the claim the chip makes: does THIS involution
              // exchange the inks of THIS picture — w(s x) = −w(x) — and on how
              // many samples does the drawn ink disagree.
              const sw = move(w, n, m, P, c, 0);
              const [residual, exact, drawn, drawnExact] = each[index];
              const rel = relative(sw, w, scale, true);
              assert.ok(close(rel, residual, 1e-6),
                `${e.id}[${index}]: published residual ${residual} against ${rel}`);
              assert.equal(rel === 0, Boolean(exact),
                `${e.id}[${index}]: the exact flag is the measurement`);
              let differ = 0;
              for (let i = 0; i < u.length; i++) if ((sw[i] > 0) !== (w[i] < 0)) differ++;
              assert.ok(Math.abs(differ / u.length - drawn) <= 1e-8,
                `${e.id}[${index}]: published ${drawn} of node-frames drawn differently, measured ${differ / u.length}`);
              assert.equal(differ === 0, Boolean(drawnExact),
                `${e.id}[${index}]: the drawn flag is the measurement`);
            });
          }

          // Every sameAs claim with a shift, re-applied node-frame by node-frame.
          // Notes 2-5 come from an exact correlation peak, so they must hold at
          // every sample.  Note 0 -- the collapse -- is an identity in the
          // continuum but rests on (s, T/2) holding on the saved float32 samples,
          // and at the fixed points of s it holds only to 1e-9; a handful of
          // nodes a frame may therefore come out the other colour.
          for (const row of e.rule.sameAs) {
            if (row[8] === 0) continue;                   // a conjugation, see the note
            const other = drawnOf(rowVolume(row, e, field, n, m, ops));
            const mine = drawnOf(w);
            const [dt, dy, dx, sg] = [row[5], row[6], row[7], row[8]];
            let differ = 0;
            for (let t2 = 0; t2 < m; t2++) {
              for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
                const a = other[mod(t2 + dt, m) * n * n + mod(y + dy, n) * n + mod(x + dx, n)];
                if (mine[t2 * n * n + y * n + x] !== sg * a) differ++;
              }
            }
            const slack = row[4] === 0 ? 0.01 * w.length : 0;
            assert.ok(differ <= slack,
              `${e.id}: sameAs row ${row} fails at ${differ} of ${w.length} node-frames`);
          }

          // The other channel: the same picture at the lag the catalog measured.
          if (e.channelV) {
            const other = e.channelV.channel;
            const alt = { ...e, rule: { ...e.rule, channel: other } };
            const wv = ruleVolume(alt, field, n, m);
            const a = drawnOf(w), b = drawnOf(wv);
            let bestK = -1, bestAgree = -1;
            const agreeAt = new Float64Array(m);
            for (let k = 0; k < m; k++) {
              let same = 0;
              for (let t2 = 0; t2 < m; t2++) {
                const oa = mod(t2 + k, m) * n * n, ob = t2 * n * n;
                for (let i = 0; i < n * n; i++) if (a[oa + i] === b[ob + i]) same++;
              }
              const agree = Math.max(same, a.length - same) / a.length;
              agreeAt[k] = agree;
              if (agree > bestAgree) { bestAgree = agree; bestK = k; }
            }
            // Two lags can tie exactly; the catalog must name one of the best.
            assert.equal(agreeAt[e.channelV.lagFrames], bestAgree,
              `${e.id}: lag ${e.channelV.lagFrames} agrees ${agreeAt[e.channelV.lagFrames]}, `
              + `the best is ${bestAgree} at ${bestK}`);
            assert.ok(close(bestAgree, e.channelV.agreement, 1e-5),
              `${e.id}: agreement ${bestAgree} vs ${e.channelV.agreement}`);
            assert.ok(Math.abs(e.channelV.lag - e.channelV.lagFrames / m) < 1e-6,
              'the lag as a fraction of T');
            if (e.channelV.sameFunction) {
              assert.equal(bestAgree, 1, 'sameFunction means every node-frame agrees');
            }
          }

          // Every number in the metrics block.
          const got = measure(w, n, m, lattice, stds[e.rule.channel]);
          for (const k of ['white', 'black', 'imbalance', 'tieFraction', 'boundaryDensity',
                           'speckle', 'churn', 'amplitude']) {
            assert.ok(close(got[k], e.metrics[k], 2e-6), `${k}: ${got[k]} vs ${e.metrics[k]}`);
          }
          if (e.metrics.runLengthNodes !== null) {
            assert.ok(close(got.runLengthNodes, e.metrics.runLengthNodes, 1e-3), 'run length');
          }
          got.boundaryByDirection.forEach((c, i) =>
            assert.ok(close(c, e.metrics.boundaryByDirection[i], 2e-6), 'boundary by direction'));
          assert.ok(e.metrics.imbalance <= 1e-9 || e.kind === 'threshold'
            || e.laws.s[1] !== 1, 'an exact swap law forces black and white to balance');

          // A sample of the claimed two-colour group, re-tested at every node-frame.
          const a = sign(w);
          const rows = e.symmetries.length <= 8 || FULL
            ? e.symmetries
            : [e.symmetries[0], e.symmetries[1], e.symmetries[e.symmetries.length - 1],
               e.symmetries[e.group.preserve] ?? e.symmetries[0]];
          for (const [op, vx, vy, frames, act] of rows) {
            const img = sign(move(w, n, m, ops[op].M, [vx, vy], frames));
            for (let i = 0; i < a.length; i++) {
              if (img[i] !== (act ? a[i] : -a[i])) {
                assert.fail(`${e.id}: ${ops[op].name} (${vx},${vy}) +${frames} `
                  + `${act ? 'preserve' : 'swap'} fails at ${i}`);
              }
            }
          }
          // And an operation that is NOT in the list must fail somewhere.
          const listed = new Set(e.symmetries.map(r => r.slice(0, 4).join(',')));
          for (let guess = 1; guess < n; guess++) {
            const keyRow = `0,${guess},0,0`;
            if (listed.has(keyRow)) continue;
            const img = sign(move(w, n, m, [[1, 0], [0, 1]], [guess, 0], 0));
            let same = true, negated = true;
            for (let i = 0; i < a.length && (same || negated); i++) {
              if (img[i] !== a[i]) same = false;
              if (img[i] !== -a[i]) negated = false;
            }
            assert.ok(!same && !negated, `an unlisted slide (${guess},0) is not a symmetry`);
            break;
          }
        });
      }
    }
  });

test('no two entries of one field are the same picture at another origin', async () => {
  // The dedupe's negative claim.  A shift of a drawn picture leaves the sorted
  // list of per-frame white counts alone, so that is a cheap exact filter; the
  // pairs it cannot separate get the full search over every time shift and every
  // node translation.
  const byField = new Map();
  for (const e of atlas.entries) {
    if (!byField.has(e.field)) byField.set(e.field, []);
    byField.get(e.field).push(e);
  }
  const keys = [...byField.keys()].filter(k => byField.get(k).length > 1);
  const stride = Math.max(1, Math.floor(keys.length / (FULL ? 1 : 6)));
  let pairs = 0, hard = 0;
  for (let i = 0; i < keys.length; i += stride) {
    const f = atlas.fields[keys[i]];
    const field = await loadField(f.fieldUrl, f.N, f.M);
    const { N: n, M: m } = f;
    const shown = byField.get(keys[i]).map(e => ({ e, a: drawnOf(ruleVolume(e, field, n, m)) }));
    const profile = x => {
      const counts = [];
      for (let t = 0; t < m; t++) {
        let c = 0;
        for (let j = 0; j < n * n; j++) if (x[t * n * n + j] > 0) c++;
        counts.push(c);
      }
      return counts.sort((p, q) => p - q).join(',');
    };
    const profiles = shown.map(s => [profile(s.a), profile(s.a.map(v => -v))]);
    for (let p = 0; p < shown.length; p++) {
      for (let q = p + 1; q < shown.length; q++) {
        pairs++;
        if (profiles[p][0] !== profiles[q][0] && profiles[p][0] !== profiles[q][1]) continue;
        hard++;
        const A = shown[p].a, B = shown[q].a;
        for (let dt = 0; dt < m; dt++) {
          for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) {
            let same = true, neg = true;
            outer:
            for (let t = 0; t < m && (same || neg); t++) {
              for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
                const va = A[mod(t + dt, m) * n * n + mod(y + dy, n) * n + mod(x + dx, n)];
                const vb = B[t * n * n + y * n + x];
                if (va !== vb) same = false;
                if (va !== -vb) neg = false;
                if (!same && !neg) break outer;
              }
            }
            assert.ok(!same && !neg,
              `${shown[p].e.id} and ${shown[q].e.id} are one picture at (${dt},${dy},${dx})`);
          }
        }
      }
    }
  }
  console.log(`  ${pairs} pairs, ${hard} needed the full shift search`);
});

test('field files are the length the catalog says, and a sample hashes to its sha256',
  async () => {
    const keys = Object.keys(atlas.fields);
    for (const key of keys) {
      const f = atlas.fields[key];
      const info = await stat(new URL(f.fieldUrl, DOCS));
      assert.equal(info.size, f.byteLength, `${key}: ${f.fieldUrl} byte length`);
      assert.equal(f.byteLength, f.M * 2 * f.N * f.N * 4, `${key}: layout`);
    }
    // A sample from each origin, because a record field is a byte-for-byte copy
    // the builder re-hashed on the way in and that is the claim worth testing.
    for (const origin of ['atlas', 'record']) {
      const mine = keys.filter(k => atlas.fields[k].origin === origin);
      const stride = Math.max(1, Math.floor(mine.length / 3));
      for (let i = 0; i < mine.length; i += stride) {
        const f = atlas.fields[mine[i]];
        const bytes = await readFile(new URL(f.fieldUrl, DOCS));
        assert.equal(createHash('sha256').update(bytes).digest('hex'), f.sha256,
          `${mine[i]}: sha256 of the field the pages load`);
      }
    }
  });
