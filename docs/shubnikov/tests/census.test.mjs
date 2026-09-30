// node --test docs/shubnikov/tests/census.test.mjs
//
// Trusts nothing in data/census.json: the class list is re-derived from the
// week-38 census (cx_d2.json) and every picture is re-checked through the same
// module the page draws with (shub-field.mjs).  Zero dependencies.
//
//   SHUB_POINTS=24 node --test ...   more random points per class (default 8)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  indexCensus, expandClass, filmGeometry, psi, sector, applyOp, frac, greys, timeSlice,
} from '../shub-field.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const docs = join(here, '..', '..');
const census = indexCensus(JSON.parse(readFileSync(join(here, '..', 'data', 'census.json'), 'utf8')));
const cxd2 = JSON.parse(readFileSync(join(docs, 'reports', 'symmetry-meeting-notes-week-38',
  'verify', 'colour', 'cx_d2.json'), 'utf8'));
const NS = [2, 3, 4, 6];
const POINTS = Number(process.env.SHUB_POINTS ?? 8);
const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return Math.abs(a); };

// deterministic points
let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

test('the 990 are exactly the week-38 E_fwd classes, in order', () => {
  const want = [];
  for (const row of cxd2.rows) {
    for (const n of NS) {
      const cell = row.n[String(n)];
      let i = 0;
      for (const key of ['ct0', 'ctne']) {
        assert.equal(cell.reps[key].length, key === 'ct0' ? cell.cls_ct0 : cell.cls_ctne);
        for (const rep of cell.reps[key]) {
          i += 1;
          want.push({ id: `${row.id}-n${n}-${i}`, gid: row.id, n, key, size: rep.size, ct: rep.ct });
        }
      }
    }
  }
  assert.equal(want.length, 990);
  assert.equal(census.classes.length, 990);
  for (let i = 0; i < want.length; i++) {
    const got = census.classes[i];
    for (const k of ['id', 'gid', 'n', 'key', 'size', 'ct']) assert.equal(got[k], want[i][k], `${want[i].id}.${k}`);
  }
  const byN = Object.fromEntries(NS.map((n) => [n, census.classes.filter((c) => c.n === n).length]));
  assert.deepEqual(byN, { 2: 307, 3: 89, 4: 241, 6: 353 });
  assert.equal(census.classes.filter((c) => c.ct === 0).length, 324);
  assert.deepEqual(census.totals.byN, { 2: 307, 3: 89, 4: 241, 6: 353 });
  assert.equal(census.totals.all, 990);
});

test('family and film bookkeeping agrees with the classes', () => {
  let sum = 0;
  for (const fam of census.order) {
    const f = census.families[fam];
    const cls = census.classes.filter((c) => census.films[c.gid].family === fam);
    assert.equal(f.total, cls.length, fam);
    for (const n of NS) assert.equal(f.byN[n], cls.filter((c) => c.n === n).length, `${fam} n=${n}`);
    assert.equal(f.ct0, cls.filter((c) => c.ct === 0).length, fam);
    for (const gid of f.films) assert.equal(census.films[gid].family, fam);
    sum += f.total;
  }
  assert.equal(census.order.length, 17);
  assert.equal(sum, 990);
  assert.equal(Object.keys(census.films).length, 68);
  const p3 = NS.map((n) => Object.values(census.films).reduce((s, f) => s + f.countsP3[n], 0));
  assert.deepEqual(p3, [309, 93, 243, 361]);
});

test('m, d and the clock step are consistent', () => {
  for (const c of census.classes) {
    const m = c.ct === 0 ? 1 : c.n / gcd(c.ct, c.n);
    assert.equal(c.m, m, c.id);
    assert.equal(c.d, c.n / m, c.id);
    assert.equal(c.key === 'ct0', c.ct === 0, c.id);
    assert.ok(c.audit.ok, c.id);
    assert.equal(expandClass(census, c).count, c.audit.modes, `${c.id}: wave count`);
    assert.ok(c.audit.modes <= census.model.maxModes && c.audit.modes >= census.model.minModes, c.id);
    // distinct amplitudes per orbit (the audit relies on it)
    const mods = c.modes.map((w) => w[3]);
    assert.equal(new Set(mods).size, mods.length, `${c.id}: moduli not distinct`);
  }
});

function lawCheck(c, points) {
  const film = census.films[c.gid];
  const field = expandClass(census, c);
  const { ops } = filmGeometry(film);
  const n = c.n;
  // every coset representative, both lattice translations, and one period
  const moves = ops.map((op, i) => ({ op, s: c.c[i], what: `op${i}` }));
  moves.push({ op: { M: [[1, 0], [0, 1]], v: [1, 0], tau: 0 }, s: c.u[0], what: 'X' });
  moves.push({ op: { M: [[1, 0], [0, 1]], v: [0, 1], tau: 0 }, s: c.u[1], what: 'Y' });
  moves.push({ op: { M: [[1, 0], [0, 1]], v: [0, 0], tau: 1 }, s: c.ct, what: 't' });
  // named generators too (their v may lie outside the unit cell)
  for (const g of film.gens) {
    const op = { M: g.M, v: [frac(g.v[0]), frac(g.v[1])], tau: frac(g.timeShift) };
    moves.push({ op, s: c.col[g.name], what: g.name });
  }
  let worst = 0, sectorChecks = 0;
  for (let k = 0; k < points; k++) {
    const x0 = 4 * rand() - 2, x1 = 4 * rand() - 2, t = 3 * rand();
    const [a, b] = psi(field, x0, x1, t);
    const mag = Math.hypot(a, b);
    for (const { op, s, what } of moves) {
      const [y0, y1, u] = applyOp(op, x0, x1, t);
      const [p, q] = psi(field, y0, y1, u);
      const ang = 2 * Math.PI * s / n;
      const er = p - (a * Math.cos(ang) - b * Math.sin(ang));
      const ei = q - (a * Math.sin(ang) + b * Math.cos(ang));
      const rel = Math.hypot(er, ei) / Math.max(mag, 1e-300);
      worst = Math.max(worst, rel);
      assert.ok(rel < 1e-9, `${c.id}: Psi(${what}.z) != e^{2 pi i ${s}/${n}} Psi(z), rel ${rel}`);
      // colour law, away from sector boundaries
      let turn = Math.atan2(b, a) / (2 * Math.PI); if (turn < 0) turn += 1;
      const edge = Math.min(turn * n % 1, 1 - (turn * n % 1));
      if (mag > 1e-6 && edge > 1e-6) {
        assert.equal(sector(p, q, n), (sector(a, b, n) + s) % n, `${c.id}: colour law for ${what}`);
        sectorChecks++;
      }
    }
  }
  return { worst, sectorChecks };
}

test('every picture obeys its colour law exactly (all 990 classes)', () => {
  let worst = 0, checks = 0;
  for (const c of census.classes) {
    const r = lawCheck(c, POINTS);
    worst = Math.max(worst, r.worst);
    checks += r.sectorChecks;
  }
  assert.ok(checks > 990 * POINTS * 3);
  console.log(`# worst relative deviation ${worst.toExponential(2)} over ${checks} colour checks`);
});

test('each coloured film closes after exactly m periods, not before', () => {
  for (const c of census.classes) {
    const field = expandClass(census, c);
    const x0 = 0.3141, x1 = -0.2718, t = 0.577;
    const [a, b] = psi(field, x0, x1, t);
    for (let k = 1; k <= c.m; k++) {
      const [p, q] = psi(field, x0, x1, t + k);
      const ang = 2 * Math.PI * c.ct * k / c.n;
      const rel = Math.hypot(p - (a * Math.cos(ang) - b * Math.sin(ang)),
        q - (a * Math.sin(ang) + b * Math.cos(ang))) / Math.hypot(a, b);
      assert.ok(rel < 1e-9, `${c.id}: period ${k}`);
      const shift = (c.ct * k) % c.n;
      assert.equal(shift === 0, k === c.m, `${c.id}: colours return after ${k} periods`);
    }
  }
});

test('the time slice is the same field', () => {
  const c = census.byId.get('g94-n4-2');
  const f = expandClass(census, c);
  const packed = timeSlice(f, 0.37);
  let r = 0, i = 0;
  const x0 = 0.21, x1 = 0.66;
  for (let j = 0; j < f.count; j++) {
    const a = 2 * Math.PI * (packed[4 * j] * x0 + packed[4 * j + 1] * x1);
    r += packed[4 * j + 2] * Math.cos(a) - packed[4 * j + 3] * Math.sin(a);
    i += packed[4 * j + 2] * Math.sin(a) + packed[4 * j + 3] * Math.cos(a);
  }
  const [a, b] = psi(f, x0, x1, 0.37);
  assert.ok(Math.hypot(r - a, i - b) / Math.hypot(a, b) < 1e-5);
});

test('greys run from dark to light', () => {
  for (const n of NS) {
    const g = greys(n);
    assert.equal(g.length, n);
    for (let k = 1; k < n; k++) assert.ok(g[k] > g[k - 1]);
    assert.ok(g[0] < 40 && g[n - 1] > 230);
  }
});
