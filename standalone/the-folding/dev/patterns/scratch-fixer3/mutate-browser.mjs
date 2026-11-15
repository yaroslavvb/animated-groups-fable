// dev/patterns/scratch-fixer3/mutate-browser.mjs — the fixer (15 Nov 2026): do browser-check's new warmer checks catch
// the faults the review planted (A2: rebuild never tells the warmer; A3: a drawn frame does not poke it) and the new
// visibility wiring's (V1: the warmer is never told the page is hidden; V2: no visibilitychange listener)? Each fault in
// its own copy of the workspace in the scratchpad (never in the workspace itself), browser-check run on the copy's
// sources (dev/app-demo.html) in the mini's Chrome, one after another.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-fixer3/mutate-browser.mjs [A2 A3 V1 V2]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SCR = '/Users/yaroslavvb/.ctmp/claude-501/-Users-yaroslavvb-git-animated-groups-fable/cc3b1316-130e-516c-9006-dc6da49f820b/scratchpad/mutants';
const M = {
  A2: ['src/app.js', '    warmer.warm(state.pattern, state.groupId);                 // (the other groups\' prints of this pattern, when idle)\n', ''],
  A3: ['src/app.js', '    poke();                                                     // (a frame: the idle making of prints waits)', '    // (no poke)'],
  // (A3 alone is equivalent: the renderer's change listener pokes once per redraw too; A3b takes both away)
  A3b: ['src/app.js', '    poke();                                                     // (a frame: the idle making of prints waits)', '    // (no poke)', '  R.onChange(() => {\n    poke();\n', '  R.onChange(() => {\n'],
  V1: ['src/app.js', '    hidden: () => doc.hidden === true,', '    hidden: () => false,'],
  V2: ['src/app.js', "  doc.addEventListener('visibilitychange', () => { if (doc.hidden !== true && state.groupId) warmer.warm(state.pattern, state.groupId); });\n", ''],
};
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(M);
fs.mkdirSync(SCR, { recursive: true });
for (const name of names) {
  const [file, ...pairs] = M[name], dir = path.join(SCR, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(W, dir, { recursive: true, filter: (s) => !/\/(\.git|node_modules|qa|dist)(\/|$)/.test(s) && !/\/dev\/patterns\/scratch-[^/]+(\/|$)/.test(s) && !/\/dev\/patterns\/designs(\/|$)/.test(s) });
  const f = path.join(dir, file);
  let txt = fs.readFileSync(f, 'utf8'), planted = true;
  for (let i = 0; i < pairs.length; i += 2) {
    const n = txt.split(pairs[i]).length - 1;
    if (n !== 1) { console.log(`${name}: NOT PLANTED (${n} matches of part ${i / 2})`); planted = false; break; }
    txt = txt.replace(pairs[i], () => pairs[i + 1]);
  }
  if (!planted) continue;
  fs.writeFileSync(f, txt);
  const r = spawnSync(process.execPath, [path.join(dir, 'dev/recut/browser-check.mjs'), '--page', 'dev/app-demo.html'], { cwd: dir, env: process.env, encoding: 'utf8', timeout: 600000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const fails = out.split('\n').filter((l) => /^FAIL/.test(l)).map((l) => l.slice(0, 150));
  const last = out.trim().split('\n').pop();
  console.log(`${name}: ${fails.length ? 'caught' : 'SURVIVED'} — ${last}`);
  for (const l of fails) console.log('   ' + l);
  fs.rmSync(dir, { recursive: true, force: true });
}
