// designs-gate.test.js — a gate for shipping shape patterns (review-math, 13 Nov 2026): every design in
// dev/patterns/designs/*/design.js (or the keys in DESIGNS=a,b,c) gives a motif in all 17 groups that the PRODUCTION code
// takes and that keeps the rules (src/shapes.js validateShapes), through the same path the page uses (pattern.js
// registerPattern + printFor); a find slower than FIND_MS is reported as a diagnostic. Nothing in src/ re-checks a design
// before the page shows it (printFor does not call validateShapes), so this is the one place that would catch a design
// edited after its last app-sheet run. About 2-5 s.
//   bash dev/patterns/suite.sh dev/patterns/scratch-review-math/designs-gate.test.js
//   DESIGNS=paisley,ripple bash dev/patterns/suite.sh ...   (suite.sh passes the environment through ssh only if set there)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { GROUPS } from '../../../src/groups.js';
import { registerPattern, printFor, printUniforms } from '../../../src/pattern.js';
import { validateShapes } from '../../../src/shapes.js';

const DIR = new URL('../designs/', import.meta.url).pathname;
const wanted = (process.env.DESIGNS || '').split(',').filter(Boolean);
const keys = readdirSync(DIR).filter((k) => existsSync(DIR + k + '/design.js') && !['demo', 'stress'].includes(k) && (!wanted.length || wanted.includes(k)));
const FIND_MS = 250;                                     // a generous ceiling for the mini (kit.js asks "well under 100 ms")

for (const key of keys) {
  test(`design ${key}: a print in all 17 groups that keeps the rules`, async (t) => {
    const mod = await import(pathToFileURL(DIR + key + '/design.js').href);
    assert.equal(typeof mod.find, 'function', `${key}: exports find`);
    assert.ok(mod.meta && typeof mod.meta.key === 'string', `${key}: exports meta.key`);
    assert.ok(typeof mod.meta.label === 'string' && mod.meta.label.length <= 12, `${key}: a label of at most 12 characters (${JSON.stringify(mod.meta.label)})`);
    const reg = registerPattern({ key: 'gate-' + key, label: 'gate ' + key, hint: mod.meta.hint }, mod.find);
    const bad = [], slow = [];
    for (const g of GROUPS) {
      let threw = null;
      // (the time is a diagnostic, not a failure: the shared mini's load makes it vary by 2x from one minute to the next)
      try { const t0 = performance.now(); mod.find(g); const ms = performance.now() - t0; if (ms > FIND_MS) slow.push(`${g.id} ${ms.toFixed(0)} ms`); } catch (e) { threw = String(e.message).split('\n')[0]; }
      if (threw) { bad.push(`${g.id}: find threw: ${threw}`); continue; }
      const P = printFor(g, reg.key);
      if (!P) { bad.push(`${g.id}: printFor gave no print`); continue; }
      const V = validateShapes(P);
      if (!V.ok) bad.push(`${g.id}: ${V.problems.join(' | ')}`);
      const U = printUniforms(P);
      if (!(U.mode === 3 && U.tex && U.tex.data.length === U.tex.size * U.tex.size)) bad.push(`${g.id}: no texture`);
    }
    if (slow.length) t.diagnostic(`${key}: find slower than ${FIND_MS} ms in ${slow.join(', ')}`);
    assert.deepEqual(bad, [], `${key}:\n  ${bad.join('\n  ')}`);
  });
}
