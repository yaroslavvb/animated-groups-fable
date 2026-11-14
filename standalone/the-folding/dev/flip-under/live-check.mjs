#!/usr/bin/env node
// live-check.mjs — the deployed page, on the real spacesheep viewer: *x's 2 : 1 tile, the Moebius band's stretch, and a
// mirror's copy coming from under the paper in the Tile step of ** and 22* (pictures of the plane pane mid-flip).
//   node dev/flip-under/live-check.mjs [--out <dir>] [--base https://spacesheep.dev/@yaroslavvb/the-folding]
import fs from 'node:fs';
import path from 'node:path';
import { openBrowser } from '../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const BASE = opt.base || 'https://spacesheep.dev/@yaroslavvb/the-folding';
const outDir = opt.out ? path.resolve(opt.out) : null;
if (outDir) fs.mkdirSync(outDir, { recursive: true });
let failed = 0;
const check = (ok, what, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${detail ? '  — ' + detail : ''}`); };
const B = await openBrowser();
try {
  const page = await (await B.browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await page.goto(BASE + '#g=%2Ax', { waitUntil: 'load' });
  let f = null;
  for (let i = 0; i < 200 && !f; i++) {
    for (const fr of page.frames()) {
      if (fr === page.mainFrame()) continue;
      try { if (await fr.evaluate(() => !!(window.__folding && window.__folding.ready))) { f = fr; break; } } catch { /* loading */ }
    }
    if (!f) await page.waitForTimeout(200);
  }
  if (!f) throw new Error('no app frame');
  const sx = await f.evaluate(() => { const F = window.__folding; F.setGroup('*x'); F.setT(1); const s = F.scene(); return { e1: s.group.e1, e2: s.group.e2, stretch: s.fold && s.fold.params ? s.fold.params.stretch : null, errors: F.getState().errors }; });
  check(Math.abs(sx.e1[0] - 1.2) < 1e-9 && Math.abs(Math.abs(sx.e1[1]) - 0.6) < 1e-9, '*x: the tile is 1.2 x 0.6', JSON.stringify(sx));
  if (outDir) await page.screenshot({ path: path.join(outDir, 'live-sx.png') });
  for (const id of ['**', '22*']) {
    const r = await f.evaluate((g) => {
      const F = window.__folding; F.setGroup(g); F.setT(0);
      const ph = F.tilePlan().phases[0];
      F.setTile(ph.t0 + 0.72 * (ph.t1 - ph.t0));
      return { text: ph.text, errors: F.getState().errors };
    }, id);
    check(/reflection/.test(r.text) && r.errors === 0, `${id}: the Tile step's first phase is a reflection, drawn without an error`, JSON.stringify(r));
    await page.waitForTimeout(700);
    if (outDir) await page.screenshot({ path: path.join(outDir, `live-${id.replace(/\*/g, 's')}-flip.png`) });
  }
} finally { await B.close(); }
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
