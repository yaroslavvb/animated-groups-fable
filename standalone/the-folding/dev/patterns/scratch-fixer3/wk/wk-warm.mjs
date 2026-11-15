// dev/patterns/scratch-fixer3/wk/wk-warm.mjs — the fixer (15 Nov 2026), run ON THE M5 by run-remote.sh: the warmer in
// WebKit (no requestIdleCallback: the timeout chain) on the built page next to it — per pattern, from a fresh page or a
// pattern change: how long until the other 16 groups' prints were made, the longest slot, the slots passed over; and
// a group change with nothing made ahead (the warmer stopped after every change). Writes out/warm-webkit.json.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = path.dirname(new URL(import.meta.url).pathname);
const PW = process.env.PLAYWRIGHT_MJS || process.env.HOME + '/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const { webkit } = await import(PW);
const url = pathToFileURL(path.join(dir, 'index.html')).href;
const IDS = ['o', '2222', '**', 'xx', '*x', '333', '22x', '22*', '*2222', '2*22', '442', '632', '3*3', '*333', '4*2', '*442', '*632'];
let browser;
const out = { rows: [] };
try {
  browser = await webkit.launch();
  out.version = browser.version();
  for (const pat of ['paisley', 'soft', 'tomoe']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
    await page.goto(url + '#g=333' + (pat === 'paisley' ? '' : '&pat=' + pat), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000, polling: 100 });
    await page.evaluate(() => window.__folding.ready);
    const ric = await page.evaluate(() => typeof window.requestIdleCallback);
    const t0 = Date.now();
    await page.waitForFunction(() => window.__folding.getState().warm.left === 0, null, { timeout: 60000, polling: 100 }).catch(() => {});
    const warm = await page.evaluate(() => window.__folding.getState().warm);
    // a group change with nothing made ahead: a fresh page, the warmer stopped after every change
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const p2 = await ctx2.newPage();
    await p2.goto(url + '#g=333' + (pat === 'paisley' ? '' : '&pat=' + pat), { waitUntil: 'load' });
    await p2.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000, polling: 100 });
    await p2.evaluate(() => window.__folding.ready);
    const cold = await p2.evaluate((ids) => {
      const F = window.__folding, ms = {};
      F.warmer.stop();
      for (const id of ids) { if (id === '333') continue; const t = performance.now(); F.setGroup(id); ms[id] = performance.now() - t; F.warmer.stop(); }
      return ms;
    }, IDS);
    const v = Object.values(cold).sort((a, b) => a - b);
    out.rows.push({ pat, ric, secs: (Date.now() - t0) / 1000, warm, coldMedian: +v[v.length >> 1].toFixed(1), coldMax: +v[v.length - 1].toFixed(1), errs });
    console.log(pat, 'requestIdleCallback:', ric, '| warmed in', ((Date.now() - t0) / 1000).toFixed(1), 's', JSON.stringify(warm), '| setGroup cold median', v[v.length >> 1].toFixed(1), 'max', v[v.length - 1].toFixed(1), '| errors', errs.length);
    await ctx.close(); await ctx2.close();
  }
  fs.mkdirSync(path.join(dir, 'out'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'out', 'warm-webkit.json'), JSON.stringify(out, null, 1));
} catch (e) { console.log('FAILED ' + (e && e.stack || e)); process.exitCode = 1; } finally { if (browser) await browser.close(); }
