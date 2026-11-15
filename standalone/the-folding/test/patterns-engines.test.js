// test/patterns-engines.test.js — the shipped shape patterns are the same pattern in every browser (15 Nov 2026, the
// fixer, after the WebKit review of the pattern round: Paisley's search turned the LAST BIT of Math.cos, sin, hypot, acos,
// … — which WebKit's libm gives otherwise for 4 to 38 % of their arguments, and Chrome's V8 now and then otherwise than
// node's — into other marks in all 17 groups: in WebKit a mark of 4*2 sat 0.28 tile sizes away and *632 had another
// arrangement; SPEC 11).
//   * ulp chaos: while Math.cos, sin, hypot, acos, atan, atan2, asin, tan, cbrt, exp and pow return the next double for a
//     third of their arguments (as another engine's libm does now and then), the find of Paisley, Soft commas, Tomoe and
//     the Comma gives the same motif in all 17 groups: the same outlines to a billionth of a tile size, or, where an
//     outline was thinned to other points (a step that keeps a point or not by a comparison), within a ten-thousandth;
//   * a fingerprint: per group, every outline's signed area and centroid (in tile sizes from the group's centre, 6
//     decimals), stored in test/patterns-fingerprint.json: a suite run on another CPU or in another engine's node-like
//     runtime catches a motif that drifted, and a change that moves a motif is a change the fingerprint must be made for.
//     FOLDING_FINGERPRINT=write node --test test/patterns-engines.test.js     writes it again (after a deliberate change)
//   node --test test/patterns-engines.test.js        (a few seconds)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GROUPS } from '../src/groups.js';
import * as paisley from '../src/patterns/paisley.js';
import * as soft from '../src/patterns/soft.js';
import * as tomoe from '../src/patterns/tomoe.js';
import * as comma from '../src/patterns/comma.js';

const MODS = { paisley, soft, tomoe, comma };
const FP_FILE = new URL('./patterns-fingerprint.json', import.meta.url);
const FNS = ['cos', 'sin', 'hypot', 'acos', 'atan', 'atan2', 'asin', 'tan', 'cbrt', 'exp', 'pow'];

/** A fresh copy of a group (the per-group caches of src/motif.js and the like are keyed by the object: they miss it). */
const fresh = (g) => ({ ...g });
/** The motif of a pattern for a group, from scratch (Paisley's cache of unit commas emptied first): [Float64Array]. */
function motifOf(M, g) {
  if (typeof M.resetShapes === 'function') M.resetShapes();
  return M.find(fresh(g)).shapes.map((s) => Float64Array.from(typeof s.pts.flat === 'function' ? s.pts.flat() : s.pts));
}

/** Math with the last bit moved: the next double away from zero for about a third of the arguments (chosen by the first
 *  argument's own bits, so the same call always gives the same answer); exact results (0, ±1, ±π, ±π/2, ±π/4) and the
 *  arguments 0 and ±1 are left alone. Runs f, then puts Math back. */
function withUlpChaos(f) {
  const orig = Object.fromEntries(FNS.map((k) => [k, Math[k]]));
  const f64 = new Float64Array(1), u64 = new BigUint64Array(f64.buffer);
  const EXACT = new Set([0, 1, -1, Math.PI, -Math.PI, Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4]);
  for (const k of FNS) {
    Math[k] = function (...a) {
      const y = orig[k].apply(Math, a);
      if (!Number.isFinite(y) || EXACT.has(y) || a.some((v) => v === 0 || v === 1 || v === -1)) return y;
      f64[0] = a[0];
      if (u64[0] % 3n !== 0n) return y;
      f64[0] = y; u64[0] += 1n; return f64[0];
    };
  }
  try { return f(); } finally { for (const k of FNS) Math[k] = orig[k]; }
}

/** The largest distance from a vertex of the closed outline A to the closed outline B. */
function farthest(A, B) {
  let worst = 0;
  const nb = B.length / 2;
  for (let i = 0; i < A.length; i += 2) {
    const x = A[i], y = A[i + 1];
    let best = Infinity;
    for (let k = 0, l = nb - 1; k < nb; l = k++) {
      const ax = B[2 * l], ay = B[2 * l + 1], ex = B[2 * k] - ax, ey = B[2 * k + 1] - ay, l2 = ex * ex + ey * ey;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2)) : 0;
      const d = Math.hypot(ax + t * ex - x, ay + t * ey - y);
      if (d < best) best = d;
    }
    if (best > worst) worst = best;
  }
  return worst;
}

/** How two motifs of one group differ: null when they are the same (see the top of the file), else words. */
function differ(a, b, size) {
  if (a.length !== b.length) return `${a.length} outlines against ${b.length}`;
  const notes = [];
  for (let j = 0; j < a.length; j++) {
    const P = a[j], Q = b[j];
    if (P.length === Q.length) {
      let mx = 0;
      for (let k = 0; k < P.length; k++) mx = Math.max(mx, Math.abs(P[k] - Q[k]));
      if (mx > 1e-9 * size) notes.push(`outline ${j}: a point moved ${(mx / size).toExponential(1)} tile sizes`);
    } else {
      const h = Math.max(farthest(P, Q), farthest(Q, P));
      if (h > 1e-4 * size) notes.push(`outline ${j}: ${P.length / 2} points against ${Q.length / 2}, ${(h / size).toExponential(1)} tile sizes apart`);
    }
  }
  return notes.length ? notes.join('; ') : null;
}

test('engines: ulp chaos — the last bit of Math moved, every shipped shape pattern gives the same motif in all 17 groups (Paisley\'s page tiles draw a table of the marks its search grew)', (t) => {
  const moved = [];
  for (const [key, M] of Object.entries(MODS)) {
    const base = GROUPS.map((g) => motifOf(M, g));
    const nudged = withUlpChaos(() => GROUPS.map((g) => motifOf(M, g)));
    const again = GROUPS.map((g) => motifOf(M, g));
    let n = 0;
    GROUPS.forEach((g, i) => {
      const size = Math.sqrt(g.domainArea);
      assert.equal(differ(base[i], again[i], size), null, `${key} ${g.id}: the same motif twice without chaos`);
      const d = differ(base[i], nudged[i], size);
      if (d) { moved.push(`${key} ${g.id}: ${d}`); n++; }
    });
    t.diagnostic(`${key}: ${n} of 17 groups change when the last bit moves`);
  }
  assert.deepEqual(moved, [], `the motif follows the last bit of Math in ${moved.length} cases: another engine would show another pattern`);
});

/** Every outline's signed area and centroid, in tile sizes from the group's centre, rounded to 6 decimals. */
function fingerprint(M, g) {
  const u = Math.sqrt(g.domainArea), r6 = (v) => Math.round(v * 1e6) / 1e6 + 0;
  return motifOf(M, g).map((P) => {
    let A = 0, cx = 0, cy = 0;
    for (let i = 0, n = P.length / 2; i < n; i++) {
      const j = (i + 1) % n, x0 = (P[2 * i] - g.center[0]) / u, y0 = (P[2 * i + 1] - g.center[1]) / u, x1 = (P[2 * j] - g.center[0]) / u, y1 = (P[2 * j + 1] - g.center[1]) / u;
      const c = x0 * y1 - x1 * y0;
      A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
    }
    return [r6(A / 2), r6(cx / (3 * A)), r6(cy / (3 * A))];
  });
}

test('engines: the fingerprint — every shipped shape pattern\'s outlines in all 17 groups have the stored areas and centroids (test/patterns-fingerprint.json), to 3e-6 tile sizes', (t) => {
  const now = {};
  for (const [key, M] of Object.entries(MODS)) { now[key] = {}; for (const g of GROUPS) now[key][g.id] = fingerprint(M, g); }
  if (process.env.FOLDING_FINGERPRINT === 'write') {
    const rows = Object.entries(now).map(([key, per]) => `  ${JSON.stringify(key)}: {\n` + Object.entries(per).map(([id, v]) => `    ${JSON.stringify(id)}: ${JSON.stringify(v)}`).join(',\n') + '\n  }');
    fs.writeFileSync(FP_FILE, '{\n' + rows.join(',\n') + '\n}\n');
    t.diagnostic(`written: ${FP_FILE.pathname}`);
  }
  const want = JSON.parse(fs.readFileSync(FP_FILE, 'utf8'));
  const bad = [];
  for (const key of Object.keys(MODS)) {
    assert.ok(want[key], `the fingerprint has ${key}`);
    for (const g of GROUPS) {
      const a = now[key][g.id], b = want[key][g.id];
      if (!b) { bad.push(`${key} ${g.id}: not in the fingerprint`); continue; }
      if (a.length !== b.length) { bad.push(`${key} ${g.id}: ${a.length} outlines, the fingerprint has ${b.length}`); continue; }
      a.forEach((v, j) => {
        const d = Math.max(...v.map((x, k) => Math.abs(x - b[j][k])));
        if (d > 3e-6) bad.push(`${key} ${g.id} outline ${j}: area, centroid ${JSON.stringify(v)} against ${JSON.stringify(b[j])}`);
      });
    }
  }
  assert.deepEqual(bad, [], `${bad.length} outlines are not where the fingerprint has them (made on another machine or engine, or a change that moved a motif: FOLDING_FINGERPRINT=write after a deliberate one)`);
});
