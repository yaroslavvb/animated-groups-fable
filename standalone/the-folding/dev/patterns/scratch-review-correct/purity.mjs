// scratch (review-correct, 15 Nov 2026): are the four shipped finds (src/patterns/) pure and deterministic?
//   node purity.mjs            the checks below, then three fresh processes (forward, reverse, shuffled order of the
//                              groups and the patterns) whose motifs must hash the same
//   node purity.mjs --child <fwd|rev|shuffle>   one such process: prints a SHA-256 per pattern of every group's motif
// The checks in this process, per pattern and group:
//   * find does not write into the group it is given (a deep copy of the group compared after; and a deep-FROZEN copy
//     of the group, so a write throws in a module, which is strict code)
//   * two calls give equal motifs that share no array (a caller may change one without changing the other) and changing
//     the first call's points does not change what a third call gives
//   * every coordinate a finite number
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { GROUPS } from '../../../src/groups.js';
import { SHAPE_PATTERNS } from '../../../src/patterns/index.js';

const KEYS = SHAPE_PATTERNS.map((p) => p.meta.key);
const findOf = (k) => SHAPE_PATTERNS.find((p) => p.meta.key === k).find;
const canon = (r) => JSON.stringify(r.shapes.map((s) => ({ hole: !!s.hole, pts: Array.from(s.pts || s, (p) => (Array.isArray(p) || ArrayBuffer.isView(p) ? Array.from(p) : p)) })));

const i = process.argv.indexOf('--child');
if (i >= 0) {
  const mode = process.argv[i + 1];
  let gs = GROUPS.slice(), ks = KEYS.slice();
  if (mode === 'rev') { gs.reverse(); ks.reverse(); }
  if (mode === 'shuffle') {
    let a = 12345;
    const rnd = () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; };
    const sh = (arr) => { for (let j = arr.length - 1; j > 0; j--) { const k = Math.floor(rnd() * (j + 1)); [arr[j], arr[k]] = [arr[k], arr[j]]; } return arr; };
    gs = sh(gs); ks = sh(ks);
  }
  // groups and patterns interleaved in the order given (patterns outer for fwd, groups outer otherwise)
  const res = {};
  for (const k of KEYS) res[k] = {};
  if (mode === 'fwd') { for (const k of ks) for (const g of gs) res[k][g.id] = canon(findOf(k)(g)); }
  else for (const g of gs) for (const k of ks) res[k][g.id] = canon(findOf(k)(g));
  const out = {};
  for (const k of KEYS) out[k] = createHash('sha256').update(GROUPS.map((g) => res[k][g.id]).join('|')).digest('hex').slice(0, 16);
  console.log(JSON.stringify(out));
  process.exit(0);
}

function deepFreeze(o, seen = new Set()) {
  if (o === null || typeof o !== 'object' || seen.has(o)) return o;
  seen.add(o);
  if (ArrayBuffer.isView(o)) return o;                  // (a typed array cannot be frozen)
  for (const v of Object.values(o)) deepFreeze(v, seen);
  return Object.freeze(o);
}
const problems = [];
for (const k of KEYS) {
  const find = findOf(k);
  for (const g of GROUPS) {
    const label = `${k} ${g.id}`;
    try {
      const before = structuredClone(g);
      const r1 = find(g);
      assert.deepStrictEqual(g, before, `${label}: find wrote into the group`);
      const fz = deepFreeze(structuredClone(g));
      let rf;
      try { rf = find(fz); } catch (e) { problems.push(`${label}: find on a frozen copy of the group threw: ${e.message.split('\n')[0]}`); }
      if (rf && canon(rf) !== canon(r1)) problems.push(`${label}: a copy of the group gives another motif`);
      const r2 = find(g);
      if (canon(r2) !== canon(r1)) problems.push(`${label}: two calls differ`);
      // shared arrays between calls
      let shared = 0;
      r1.shapes.forEach((s, j) => { const a = s.pts || s, b = r2.shapes[j].pts || r2.shapes[j]; if (a === b) shared++; else if (a[0] && a[0] === b[0]) shared++; });
      if (shared) problems.push(`${label}: ${shared} point lists are shared between two calls`);
      for (const s of r1.shapes) for (const p of (s.pts || s)) for (const v of (Array.isArray(p) || ArrayBuffer.isView(p) ? p : [p])) if (!Number.isFinite(v)) { problems.push(`${label}: a coordinate is ${v}`); break; }
      const c1 = canon(r1);
      const pts = r1.shapes[0].pts || r1.shapes[0];
      if (Array.isArray(pts[0])) pts[0][0] += 0.25; else pts[0] += 0.25;
      const r3 = find(g);
      if (canon(r3) !== c1) problems.push(`${label}: changing what one call gave changed what the next one gives`);
    } catch (e) { problems.push(`${label}: ${e.message.split('\n')[0]}`); }
  }
}
console.log(`in-process checks: ${problems.length ? problems.length + ' problems' : 'none'}`);
for (const p of problems) console.log('  ' + p);
const me = fileURLToPath(import.meta.url), hashes = {};
for (const mode of ['fwd', 'rev', 'shuffle']) {
  const r = spawnSync(process.execPath, [me, '--child', mode], { encoding: 'utf8' });
  if (r.status !== 0) { console.log(mode, 'failed', r.stderr.slice(0, 400)); continue; }
  hashes[mode] = JSON.parse(r.stdout.trim().split('\n').pop());
  console.log(mode.padEnd(8), JSON.stringify(hashes[mode]));
}
const same = KEYS.every((k) => hashes.fwd && hashes.rev && hashes.shuffle && hashes.fwd[k] === hashes.rev[k] && hashes.fwd[k] === hashes.shuffle[k]);
console.log(same ? 'order: the same motifs in all three orders' : 'order: THE MOTIFS DEPEND ON THE ORDER');
