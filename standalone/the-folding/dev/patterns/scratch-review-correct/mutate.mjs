// scratch (review-correct, 15 Nov 2026): do the tests catch what they claim to? Faults planted one at a time into
// throwaway copies of the workspace (never into W itself: this runs on a lab box, in remote.sh's copy), each copy's
// targeted test files run with node --test; a fault no test fails is a SURVIVOR. The unplanted tree runs first (the
// baseline: every targeted file must pass there, else the counts mean nothing).
//   node dev/patterns/scratch-review-correct/mutate.mjs [name ...]       (cwd: the copy's root; output also ../out/mutate.json)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const W = process.cwd(), MUT = path.resolve(W, '../mut'), OUTD = path.resolve(W, '../out');
const T_WARM = ['test/patterns-warm.test.js'];
const T_PAT = ['test/pattern.test.js', 'test/patterns-warm.test.js', 'test/app-url.test.js'];
const T_SHIP = ['test/patterns-shipped.test.js'];
const T_URL = ['test/app-url.test.js'];
const T_APP = ['test/app-url.test.js', 'test/shell.test.js', 'test/plane-print.test.js', 'test/patterns-warm.test.js'];

const M = [
  // ---- src/patterns/warm.js: the warmer
  ['W1-no-cancel-on-pattern-change', 'src/patterns/warm.js', '        drop();\n        key = k;', '        key = k;', T_WARM],
  ['W2-old-queue-kept-on-pattern-change', 'src/patterns/warm.js', '        queue = at < 0 ? order.slice()', '        if (!queue.length) queue = at < 0 ? order.slice()', T_WARM],
  ['W3-shown-group-not-taken-out', 'src/patterns/warm.js', '      } else queue = queue.filter((id) => id !== shownId);', '      }', T_WARM],
  ['W4-quiet-ignored', 'src/patterns/warm.js', 'if (now() - last < quiet || left < minSlot)', 'if (left < minSlot)', T_WARM],
  ['W5-short-slot-used', 'src/patterns/warm.js', 'if (now() - last < quiet || left < minSlot)', 'if (now() - last < quiet)', T_WARM],
  ['W6-all-groups-in-one-slot', 'src/patterns/warm.js', '    if (queue.length) {\n      const id = queue.shift(), t0 = now();', '    while (queue.length) {\n      const id = queue.shift(), t0 = now();', T_WARM],
  ['W7-made-prints-cost-a-slot', 'src/patterns/warm.js', '    while (queue.length && ready(queue[0], key)) { queue.shift(); st.skipped++; }', '', T_WARM],
  ['W8-shown-group-queued', 'src/patterns/warm.js', 'order.slice(at + 1).concat(order.slice(0, at))', 'order.slice(at).concat(order.slice(0, at))', T_WARM],
  ['W9-stop-leaves-slot', 'src/patterns/warm.js', 'stop() { stopped = true; drop(); queue = []; key = null; }', 'stop() { stopped = true; queue = []; key = null; }', T_WARM],
  ['W10-errors-swallowed', 'src/patterns/warm.js', 'if (st.errors.length < 20) st.errors.push(', 'if (false) st.errors.push(', T_WARM],
  ['W11-fallback-deadline-unbounded', 'src/patterns/warm.js', 'timeRemaining: () => Math.max(0, IDLE_FALLBACK.slot - (clock() - t0))', 'timeRemaining: () => 10 * IDLE_FALLBACK.slot', T_WARM],
  ['W12-never-native', 'src/patterns/warm.js', "if (win && typeof win.requestIdleCallback === 'function' && typeof win.cancelIdleCallback === 'function') {", 'if (false) {', T_WARM],
  ['W13-groups-before-first', 'src/patterns/warm.js', 'order.slice(at + 1).concat(order.slice(0, at))', 'order.slice(0, at).concat(order.slice(at + 1))', T_WARM],
  ['W14-poke-does-nothing', 'src/patterns/warm.js', '    poke() { last = now(); },', '    poke() {},', T_WARM],
  ['W15-stop-is-forever', 'src/patterns/warm.js', '    warm(k, shownId) {\n      stopped = false;', '    warm(k, shownId) {', T_WARM],
  ['W16-double-slots', 'src/patterns/warm.js', '    if (handle !== null || stopped || !queue.length) return;', '    if (stopped || !queue.length) return;', T_WARM],
  ['W17-same-key-rebuilds-queue', 'src/patterns/warm.js', '      if (k !== key) {\n        drop();', '      if (true) {\n        drop();', T_WARM],
  // ---- src/pattern.js
  ['P1-printCached-never', 'src/pattern.js', '  return !!m && m.has(k);', '  return false;', T_PAT],
  ['P2-printCached-any-key', 'src/pattern.js', '  return !!m && m.has(k);', '  return !!m;', T_PAT],
  ['P3-null-not-kept', 'src/pattern.js', "  if (!m.has(k)) m.set(k, (k === 'checker'", "  if (!m.has(k) || !m.get(k)) m.set(k, (k === 'checker'", T_PAT],
  ['P4-blobs-alias-gone', 'src/pattern.js', "  if (s === 'blobs' || s === 'blob' || s === 'soft-commas' || s === 'softcommas') return 'soft';\n", '', T_PAT],
  ['P5-default-checker', 'src/pattern.js', "export const DEFAULT_PATTERN = 'paisley';", "export const DEFAULT_PATTERN = 'checker';", [...T_PAT, ...T_SHIP]],
  ['P6-order-soft-tomoe', 'src/pattern.js', "  builtIn('paisley'), builtIn('soft'), builtIn('tomoe'),", "  builtIn('paisley'), builtIn('tomoe'), builtIn('soft'),", [...T_PAT, ...T_SHIP]],
  ['P7-sharp-check-blind-for-shapes', 'src/pattern.js', "    return done >= samples;\n  }\n  if (print.kind === 'linear') {", "    return true;\n  }\n  if (print.kind === 'linear') {", [...T_PAT, ...T_SHIP]],
  ['P7b-sharp-check-never-fails-for-shapes', 'src/pattern.js', '      if (!keeps(x + nx, y + ny) || !keeps(x - nx, y - ny)) return false;\n', '', [...T_PAT, ...T_SHIP]],
  ['P7c-sharp-check-one-side', 'src/pattern.js', '      if (!keeps(x + nx, y + ny) || !keeps(x - nx, y - ny)) return false;', '      if (!keeps(x + nx, y + ny)) return false;', [...T_PAT, ...T_SHIP]],
  ['P8-rules-not-asked', 'src/pattern.js', '    if (!v.ok) throw new Error(`the motif breaks', '    if (false) throw new Error(`the motif breaks', T_PAT],
  ['P9-sheet-resolves', 'src/pattern.js', "  if (s === 'commas' || s === 'motif') return 'comma';", "  if (s === 'commas' || s === 'motif') return 'comma';\n  if (s === 'sheet') return 'sheet';", T_PAT],
  ['P10-printCached-unknown-false', 'src/pattern.js', '  if (!group || !k) return true;', '  if (!group || !k) return false;', T_PAT],
  ['P11-label-not-resolved', 'src/pattern.js', '  for (const p of PATTERNS) if (p.key === s || p.label.toLowerCase() === s) return p.key;', '  for (const p of PATTERNS) if (p.key === s) return p.key;', T_PAT],
  // ---- src/patterns/comma.js
  ['C1-tail-a-needle', 'src/patterns/comma.js', 'export const TIP_TEXELS = 2;', 'export const TIP_TEXELS = 0;', T_SHIP],
  ['C2-tail-one-texel', 'src/patterns/comma.js', 'export const TIP_TEXELS = 2;', 'export const TIP_TEXELS = 1;', T_SHIP],
  ['C3-comma-turned-wrong-way', 'src/patterns/comma.js', 'return [ax + ca * X - sa * Y, ay + sa * X + ca * Y];', 'return [ax + ca * X + sa * Y, ay - sa * X + ca * Y];', T_SHIP],
  ['C4-no-round-end', 'src/patterns/comma.js', '  if (w > 0) for (let k = 0; k < CAP_POINTS - 1; k++)', '  if (false) for (let k = 0; k < CAP_POINTS - 1; k++)', T_SHIP],
  ['C5-comma-mirrored', 'src/patterns/comma.js', 'const X = sx * x, Y = sy * y;', 'const X = -sx * x, Y = sy * y;', T_SHIP],
  // ---- the three designs as they ship
  ['S1-paisley-knob-tipAbs', 'src/patterns/paisley.js', '  tipAbs: 0.02, searchHead', '  tipAbs: 0.022, searchHead', T_SHIP],
  ['S2-paisley-winner-row-o', 'src/patterns/paisley.js', '  [1, 0, 0, 2, 0, 0, 0.25, -0.74,', '  [1, 0, 0, 0, 0, 0, 0.25, -0.74,', T_SHIP],
  ['S3-soft-label', 'src/patterns/soft.js', "label: 'Soft commas'", "label: 'Soft Commas'", T_SHIP],
  ['S4-soft-eye-smaller', 'src/patterns/soft.js', 'export const EYE = 0.065;', 'export const EYE = 0.06;', T_SHIP],
  ['S5-tomoe-knob-between', 'src/patterns/tomoe.js', 'margin: 0.03, between: 0.05,', 'margin: 0.03, between: 0.055,', T_SHIP],
  ['S6-index-order', 'src/patterns/index.js', '[paisley, soft, tomoe, comma]', '[paisley, tomoe, soft, comma]', T_SHIP],
  // ---- src/app.js
  ['A1-default-pat-written', 'src/app.js', "  if (pat && pat !== DEFAULT_PATTERN) parts.push('pat=' + pat);", "  if (pat) parts.push('pat=' + pat);", T_APP],
  ['A2-warmer-never-told', 'src/app.js', '    warmer.warm(state.pattern, state.groupId);', '', T_APP],
  ['A3-frames-do-not-poke', 'src/app.js', '    poke();                                                     // (a frame', '    //                                                     // (a frame', T_APP],
  ['A4-buildScene-default-comma-print', 'src/app.js', '  const patternKey = (pattern !== SHEET_PATTERN && resolvePattern(pattern)) || SHEET_PATTERN;', "  const patternKey = resolvePattern(pattern) || 'comma';", T_APP],
  ['A5-data-print-never-set', 'src/app.js', "    else if (el.app.getAttribute('data-print') !== kind) el.app.setAttribute('data-print', kind);", '', T_APP],
  ['A6-unknown-pat-kept', 'src/app.js', "if (k) out.pat = k; else drop('pat');", "if (k) out.pat = k;", T_APP],
  // ---- the shell's template
  ['T1-template-options-swapped', 'src/index.template.html', '        <option value="soft">Soft commas</option>\n        <option value="tomoe">Tomoe</option>', '        <option value="tomoe">Tomoe</option>\n        <option value="soft">Soft commas</option>', T_SHIP],
];

const check = process.argv.includes('--check');
const only = process.argv.slice(2).filter((a) => a !== '--check');
const list = only.length ? M.filter((m) => only.some((o) => m[0].startsWith(o))) : M;
if (check) {
  // only: does every fault's text occur exactly once in the tree as it is? (nothing is copied or run)
  for (const [name, file, from] of list) {
    const n = fs.readFileSync(path.join(W, file), 'utf8').split(from).length - 1;
    console.log(`${n === 1 ? 'ok ' : 'BAD'} ${name} (${n})`);
  }
  process.exit(0);
}
fs.mkdirSync(MUT, { recursive: true }); fs.mkdirSync(OUTD, { recursive: true });
const skip = (src) => /\/(\.git|node_modules|qa)(\/|$)/.test(src) || /\/dev\/patterns\/scratch-[^/]+(\/|$)/.test(src);

function plant(name, file, from, to) {
  const dir = path.join(MUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(W, dir, { recursive: true, filter: (s) => !skip(s) });
  if (file) {
    const f = path.join(dir, file), txt = fs.readFileSync(f, 'utf8'), n = txt.split(from).length - 1;
    if (n !== 1) return { dir, error: `the text to replace occurs ${n} times in ${file}` };
    fs.writeFileSync(f, txt.replace(from, () => to));
  }
  return { dir };
}
function run(dir, tests) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ['--test', '--test-reporter=tap', '--test-concurrency=1', ...tests], { cwd: dir });
    let out = '';
    p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
    const timer = setTimeout(() => p.kill('SIGKILL'), 420000);
    p.on('close', (code) => {
      clearTimeout(timer);
      const num = (k) => { const m = out.match(new RegExp(`^# ${k} (\\d+)`, 'm')); return m ? +m[1] : null; };
      const fails = [...out.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1].slice(0, 110));
      resolve({ code, pass: num('pass'), fail: num('fail'), fails: fails.slice(0, 4) });
    });
  });
}

const results = [];
// the baseline: every test file any fault targets, on the tree as it is
const allTests = [...new Set(list.flatMap((m) => m[4]))];
{
  const { dir } = plant('BASELINE', null);
  const r = await run(dir, allTests);
  results.push({ name: 'BASELINE', ...r });
  console.log(`BASELINE  pass ${r.pass} fail ${r.fail} ${r.fails.join(' | ')}`);
  fs.rmSync(dir, { recursive: true, force: true });
}
const POOL = 6;
let next = 0;
async function worker() {
  while (next < list.length) {
    const [name, file, from, to, tests] = list[next++];
    const pl = plant(name, file, from, to);
    let row;
    if (pl.error) row = { name, plant: pl.error };
    else row = { name, tests, ...(await run(pl.dir, tests)) };
    fs.rmSync(pl.dir, { recursive: true, force: true });
    results.push(row);
    const verdict = row.plant ? 'NOT PLANTED' : row.fail > 0 ? 'caught' : 'SURVIVED';
    console.log(`${verdict.padEnd(11)} ${name.padEnd(40)} fail ${row.fail} pass ${row.pass}  ${(row.fails || []).slice(0, 2).join(' | ')}${row.plant ? row.plant : ''}`);
  }
}
await Promise.all(Array.from({ length: POOL }, worker));
fs.writeFileSync(path.join(OUTD, 'mutate.json'), JSON.stringify(results, null, 1));
console.log(`survivors: ${results.filter((r) => r.name !== 'BASELINE' && !r.plant && !(r.fail > 0)).map((r) => r.name).join(', ') || 'none'}`);
