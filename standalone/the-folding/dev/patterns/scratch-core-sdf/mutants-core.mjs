// scratch-core-sdf/mutants-core.mjs — do the tests of test/sdf.test.js have teeth? Each MUTANT is src/sdf.js with one
// planted fault; the copy of the test file that imports it must fail. Run on the mini through the suite script:
//   bash dev/patterns/suite.sh dev/patterns/scratch-core-sdf/mutants-run.mjs       every mutant must be killed (and the clean copy pass)
//   bash dev/patterns/suite.sh dev/patterns/scratch-core-sdf/mutants-report.mjs    fails ON PURPOSE: its "not ok" lines are the table
// (The names avoid node's default test patterns, so a plain `node --test` in the workspace never picks these up.)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), W = path.resolve(here, '../../..');
const SRC = fs.readFileSync(path.join(W, 'src/sdf.js'), 'utf8'), TEST = fs.readFileSync(path.join(W, 'test/sdf.test.js'), 'utf8');

const swap = (a, b) => (s) => { assert.ok(s.includes(a), `the source no longer holds: ${a}`); return s.replace(a, b); };

/** [name, mutate, mustDie]. (mustDie false would be a fault no finite test can be expected to notice: there is none left.) */
export const MUTANTS = [
  ['no end margins', swap('-(HS[k] + tau), LN[k] + HS[j] + tau, LN[k], idet, flatA);', '-tau, LN[k] + tau, LN[k], idet, flatA);'), true],
  ['half the end margins', swap('-(HS[k] + tau), LN[k] + HS[j] + tau, LN[k], idet, flatA);', '-(0.5 * HS[k] + tau), LN[k] + 0.5 * HS[j] + tau, LN[k], idet, flatA);'), true],
  ['the margins of the wrong vertices', swap('-(HS[k] + tau), LN[k] + HS[j] + tau, LN[k], idet, flatA);', '-(HS[j] + tau), LN[k] + HS[k] + tau, LN[k], idet, flatA);'), true],
  ['distance to the line, not to the segment', swap('const over = t < 0 ? t : t > L ? t - L : 0;', 'const over = 0;'), true],
  ['only the start of the edge is clamped', swap('const over = t < 0 ? t : t > L ? t - L : 0;', 'const over = t < 0 ? t : 0;'), true],
  ['the sign trusts the direction of the points', swap('const w = (area2 > 0) === !P.hole ? 1 : -1;', 'const w = P.hole ? -1 : 1;'), true],
  ['the hole flag is ignored', swap('const w = (area2 > 0) === !P.hole ? 1 : -1;', 'const w = area2 > 0 ? 1 : -1;'), true],
  ['crossing: the texel LEFT of it', swap('const c = Math.ceil(u0 + ((r - v0) / dv) * du);', 'const c = Math.floor(u0 + ((r - v0) / dv) * du);'), true],
  ['rising edges count their top row too', swap('fb = Math.ceil(v1) - 1; s = -s;', 'fb = Math.floor(v1); s = -s;'), true],
  ['falling edges count their top row too', swap('{ fa = Math.ceil(v1); fb = Math.ceil(v0) - 1; }', '{ fa = Math.ceil(v1); fb = Math.floor(v0); }'), true],
  ['rising and falling edges count alike', swap('fb = Math.ceil(v1) - 1; s = -s;', 'fb = Math.ceil(v1) - 1;'), true],
  ['texel centres half a texel off along the rows', swap('U[k] = m11 * x + m12 * y - 0.5;', 'U[k] = m11 * x + m12 * y;'), true],
  ['texel centres half a texel off across the rows', swap('V[k] = m21 * x + m22 * y - 0.5;', 'V[k] = m21 * x + m22 * y;'), true],
  ['nonzero rule: a lone hole is dark', swap('out[idx] = w > 0 ? 128.5 - lv : 128.5 + lv;', 'out[idx] = w !== 0 ? 128.5 - lv : 128.5 + lv;'), true],
  ['the last edge wins, not the nearest', swap('if (d2 < dist[idx]) dist[idx] = d2;', 'if (d2 < 1) dist[idx] = d2;'), true],
  ['rows of the rectangle: its width forgotten', swap('const kA = -pA * idet, kP = Math.abs(cA * idet),', 'const kA = -pA * idet, kP = 0,'), true],
  ['rows of the rectangle: its length forgotten', swap('r0 = kA * LO, r1 = kA * HI;', 'r0 = 0, r1 = 0;'), true],
  ['a crossing right of the row spills into the next', swap('if (c < size) wind[', 'if (c <= size) wind['), true],
  ['a crossing left of the row is dropped', swap('if (c < size) wind[r * size + (c > 0 ? c | 0 : 0)] += s;', 'if (c < size && c >= 0) wind[r * size + (c | 0)] += s;'), true],
  ['polygons without area are kept', swap('if (!(Math.abs(area2) > SLIVER * per * per)) continue;', ''), true],
  ['repeated points are kept', swap('if (n > 0 && x === X[n - 1] && y === Y[n - 1]) continue;', ''), true],
  ['the closing point is kept', swap('while (n > 1 && X[n - 1] === X[0] && Y[n - 1] === Y[0]) n--;', ''), true],
  ['W counted in a byte', swap('const wind = new Int16Array(size * size);', 'const wind = new Int8Array(size * size);'), true],
  ['edge lengths not in units of the range', swap('LN[k] = L / range;', 'LN[k] = L;'), true],
  ['the band only half as wide', swap('if (q > 0) { pLo = base - q; pHi = base + q; } else { pLo = base + q; pHi = base - q; }', 'if (q > 0) { pLo = base - 0.5 * q; pHi = base + 0.5 * q; } else { pLo = base + 0.5 * q; pHi = base - 0.5 * q; }'), true],
  ['the bounds along the edge not sorted', swap('if (x1 < x2) { aLo = base + x1; aHi = base + x2; } else { aLo = base + x2; aHi = base + x1; }', 'aLo = base + x1; aHi = base + x2;'), true],
  ['the bounds across the edge not sorted', swap('if (q > 0) { pLo = base - q; pHi = base + q; } else { pLo = base + q; pHi = base - q; }', 'pLo = base - q; pHi = base + q;'), true],
  ['skew forgotten across the edge', swap('dx * ay - dy * ax, dx * by - dy * bx,', 'dx * ay - dy * ax, dx * Math.hypot(bx, by),'), true],
  ['saturated one step too far', swap('lv = d2 < 1 ? 127 * Math.sqrt(d2) : 127;', 'lv = d2 < 1 ? 127 * Math.sqrt(d2) : 128;'), true],
  ['the byte is cut, not rounded', swap('out[idx] = w > 0 ? 128.5 - lv : 128.5 + lv;', 'out[idx] = w > 0 ? 128 - lv : 128 + lv;'), true],
  ['the scale is 128 a range', swap('lv = d2 < 1 ? 127 * Math.sqrt(d2) : 127;', 'lv = d2 < 1 ? 128 * Math.sqrt(d2) : 127;'), true],
  ['sdfSample does not wrap the columns', swap('const i1 = i0 + 1 < size ? i0 + 1 : 0,', 'const i1 = i0 + 1,'), true],
  ['sdfSample does not wrap the rows', swap('r1 = (j0 + 1 < size ? j0 + 1 : 0) * size;', 'r1 = (j0 + 1 < size ? j0 + 1 : j0) * size;'), true],
  ['sdfSample: texel centres at the corners', swap('const x = s * size - 0.5, y = t * size - 0.5;', 'const x = s * size, y = t * size;'), true],
  ['sdfSample: negative coordinates not wrapped', swap('if (i0 < 0) i0 += size;', ''), true],
  ['sdfDistance: 128 steps a range', swap('return ((value - 128) / 127) * range;', 'return ((value - 128) / 128) * range;'), true],
  ['size is not checked', swap('if (!Number.isInteger(size) || size < 1 || size > MAX_SIZE) throw', 'if (false) throw'), true],
  ['points are not checked', swap("if (!(x - x === 0 && y - y === 0)) throw new TypeError('bakeSDF: a polygon has a point that is not a finite number');", ''), true],
  // the one guard against rounding: the slack at the ends of an edge (test: a vertex in the middle of a straight side)
  ['no slack at the ends of an edge', swap('const tau = Math.max(1e-7 * Math.max(Math.hypot(ax, ay), Math.hypot(bx, by)), 1e-12);', 'const tau = 0;'), true],
];

const short = (name) => name.split(/[:(,]/)[0].trim().split(' ').slice(0, 4).join(' ');

function runCopy(tag, src) {
  const dir = path.join(here, '.mut', tag);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, 't'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src/sdf.js'), src);
  fs.writeFileSync(path.join(dir, 't/check.mjs'), TEST);
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', path.join(dir, 't/check.mjs')], { encoding: 'utf8', env, timeout: 180000 });
  fs.rmSync(dir, { recursive: true, force: true });
  const out = r.stdout || '';
  const failed = (out.match(/^not ok \d+ - .*$/gm) || []).map((l) => l.replace(/^not ok \d+ - /, ''));
  const passed = (out.match(/^ok \d+ - .*$/gm) || []).length;
  return { status: r.status, failed, passed, out, err: r.stderr || '' };
}

export function define(report, from = 0, to = MUTANTS.length) {
  if (report) {
    // the outcome goes into the NAME of a test that fails on purpose: the suite script prints those lines
    for (let k = from; k < to && k < MUTANTS.length; k++) {
      const [name, mutate] = MUTANTS[k], src = mutate(SRC), r = runCopy(`m${k + 1}`, src), ran = r.passed + r.failed.length;
      const line = src === SRC ? 'THE MUTATION CHANGED NOTHING' : ran < 18 ? `DID NOT RUN (${ran} tests)` : `${r.failed.length ? 'killed' : 'ALIVE'} by ${r.failed.length} of ${ran}: ${r.failed.map(short).join(' | ')}`;
      test(`${k + 1} ${name} -> ${line}`, () => assert.fail('a line of the report'));
    }
    return;
  }
  test('the clean copy passes', () => {
    const r = runCopy('clean', SRC);
    assert.equal(r.status, 0, `the unmutated copy fails: ${r.failed.join(' | ')}\n${r.err.slice(0, 600)}`);
    assert.ok(r.passed >= 18, `${r.passed} tests ran`);
  });
  MUTANTS.forEach(([name, mutate, mustDie], k) => {
    test(`mutant ${k + 1}: ${name}`, () => {
      const src = mutate(SRC);
      assert.notEqual(src, SRC, 'the mutation changed nothing');
      const r = runCopy(`m${k + 1}`, src);
      assert.ok(r.passed + r.failed.length >= 18, `the copy did not run: ${r.err.slice(0, 600)}`);
      if (mustDie) assert.ok(r.failed.length > 0, `no test notices: ${name}`);
    });
  });
}
