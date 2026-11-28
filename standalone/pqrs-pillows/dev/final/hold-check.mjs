#!/usr/bin/env node
// hold-check.mjs: in a real Chrome, on the built page: activating another partition must not turn the solid.
// Measures where the four cone points are drawn (css px in the Surface canvas) before and after each activation
// (after the solver has settled), and the reset button's re-level. Prints one line per step; exit 1 on a failure.
//   node dev/final/hold-check.mjs [site/index.html] [--shots]
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const PW = `${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const file = resolve(here, process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '../../site/index.html');
const shots = process.argv.includes('--shots');
const { chromium } = await import(pathToFileURL(PW).href);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--ignore-gpu-blocklist', '--enable-webgl'] });
let failed = 0;
const ok = (good, text) => { console.log(`${good ? 'ok' : 'FAIL'} ${text}`); if (!good) failed++; };
try {
  for (const [hash, keys] of [['#k=3333&tw=0.15', ['02|13', '03|12', '01|23']], ['#k=2345&tw=0.1', ['03|12', '02|13', '01|23']], ['#k=2222&tw=0.2', ['02|13', '03|12', '01|23']]]) {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(pathToFileURL(file).href + hash, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const marks = () => page.evaluate(() => { const p = window.__pqrs.pane(); const o = {}; for (const id of ['P', 'Q', 'R', 'S']) { const a = p.markAt(id); o[id] = a ? [a[0], a[1]] : null; } return o; });
    const far = (a, b) => Math.max(...['P', 'Q', 'R', 'S'].map((id) => (a[id] && b[id] ? Math.hypot(a[id][0] - b[id][0], a[id][1] - b[id][1]) : Infinity)));
    let before = await marks();
    const first = before;
    if (shots) await page.locator('#surf-wrap').screenshot({ path: resolve(here, `shots/hold-${hash.slice(3, 7)}-0.png`) });
    let n = 0;
    for (const key of keys) {
      await page.evaluate((k) => window.__pqrs.activate(k), key);
      const mid = await (async () => { await page.waitForTimeout(250); return marks(); })();
      await page.waitForTimeout(2000);
      const after = await marks();
      ok(far(before, mid) < 12 && far(before, after) < 12, `${hash} activate ${key}: cone points moved on screen by at most ${far(before, mid).toFixed(1)} px a quarter second in, ${far(before, after).toFixed(1)} px when settled`);
      if (shots) await page.locator('#surf-wrap').screenshot({ path: resolve(here, `shots/hold-${hash.slice(3, 7)}-${++n}.png`) });
      before = after;
    }
    ok(far(first, before) < 12, `${hash} after three activations round, the cone points stand within ${far(first, before).toFixed(1)} px of where they started`);
    // the reset button lays the active cut level again (the one place the solid turns)
    await page.evaluate((k) => window.__pqrs.activate(k), keys[0]);
    await page.waitForTimeout(1500);
    const held = await marks();
    await page.click('#reset-view');
    await page.waitForTimeout(1200);
    const lv = await marks();
    const hold = await page.evaluate(() => { const m = window.__pqrs.model(); return m ? m.hold : 'n/a'; });
    ok(hold === null, `${hash} reset: the hold is dropped (cone points moved ${far(held, lv).toFixed(1)} px as the solid turned level)`);
    ok(errors.length === 0, `${hash} no page error${errors.length ? ': ' + errors.slice(0, 2).join(' | ') : ''}`);
    await page.close();
  }
} finally { await browser.close(); }
console.log(failed ? `${failed} FAIL` : 'all ok');
process.exit(failed ? 1 : 0);
