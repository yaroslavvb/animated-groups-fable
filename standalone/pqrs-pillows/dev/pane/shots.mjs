#!/usr/bin/env node
// shots.mjs — pictures of the harness page, one browser for all of them.
//   node shots.mjs name=hash [name=hash ...] [--size 1400x800] [--only surface|both] [--wait 900]
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const PW = `${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : dflt; };
const [w, h] = flag('--size', '1400x800').split('x').map(Number), only = flag('--only', 'both'), wait = Number(flag('--wait', 900));
const jobs = args.filter((a) => a.includes('=') && !a.startsWith('--')).map((a) => { const i = a.indexOf('='); return [a.slice(0, i), a.slice(i + 1)]; });
const { chromium } = await import(pathToFileURL(PW).href);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  const url = pathToFileURL(path.join(HERE, 'index.html')).href;
  let first = true;
  for (const [name, hash] of jobs) {
    if (first) { await page.goto(url + '#' + hash, { waitUntil: 'load' }); first = false; }
    else await page.evaluate((hh) => { location.hash = hh; }, hash);
    await page.waitForFunction(() => window.__h && window.__h.ready);
    await page.waitForTimeout(wait);
    const last = await page.evaluate(() => window.__h.last());
    const el = await page.$(only === 'surface' ? '.surf-box' : '.hpanes');
    await el.screenshot({ path: path.join(HERE, 'shots', name + '.png') });
    console.log(name, JSON.stringify({ bakeMs: last.bakeMs, chartMs: last.chartMs, showMs: last.showMs, frameMs: last.frameMs, tris: last.triangles, polys: last.print && last.print.polys, radius: last.print && +last.print.radius.toFixed(2), stats: last.stats, split: last.mesh && last.mesh.split }));
  }
  if (errors.length) console.log('PAGE ERRORS / WARNINGS:', errors.slice(0, 6).join(' | '));
} finally { await browser.close(); }
