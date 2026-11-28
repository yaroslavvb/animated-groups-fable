#!/usr/bin/env node
// shot.mjs — pictures of the built page for a list of steps, in ONE headless Chrome.
//   node dev/solid/shot.mjs <steps.json | inline JSON> [--file site/index.html] [--out dev/solid/shots] [--width 1280] [--height 900] [--scale 1] [--dark]
// A step: { hash, do: [ ['set', { tw: 0.2 }, '02|13'] | ['activate', '03|12'] | ['journey', 1] | ['view', az, el] | ['wait', ms] | ['click', selector] ],
//           shot: 'name', of: 'page' | 'surface' | 'pattern' | 'panes' | 'cards' }   (the same page is kept while `hash` is absent)
// Prints one line a step, with the page's errors if any.
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const PW = process.env.PLAYWRIGHT_MJS || `${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const file = resolve(flag('--file', resolve(here, '../../site/index.html')));
const out = resolve(flag('--out', resolve(here, 'shots')));
const W = Number(flag('--width', 1280)), H = Number(flag('--height', 900)), SCALE = Number(flag('--scale', 1));
const raw = argv[0] && fs.existsSync(argv[0]) ? fs.readFileSync(argv[0], 'utf8') : argv[0];
const steps = JSON.parse(raw);
fs.mkdirSync(out, { recursive: true });
const SEL = { surface: '#surf-wrap', pattern: '#pat-wrap', panes: '.pq-panes', cards: '#cards', table: '.pq-pillows' };
const { chromium } = await import(pathToFileURL(PW).href);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE, colorScheme: argv.includes('--dark') ? 'dark' : 'light' });
let page = null;
const errors = [];
try {
  for (const st of steps) {
    if (st.hash !== undefined || !page) {
      if (page) await page.close();
      page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
      await page.goto(pathToFileURL(file).href + (st.hash || ''), { waitUntil: 'load' });
      await page.waitForTimeout(st.settle ?? 900);
    }
    for (const a of st.do || []) {
      if (a[0] === 'set') await page.evaluate(([n, k]) => window.__pqrs.set(n, k ? { key: k } : {}), [a[1], a[2] || null]);
      else if (a[0] === 'activate') await page.evaluate((k) => window.__pqrs.activate(k), a[1]);
      else if (a[0] === 'journey') await page.evaluate(([j, part]) => window.__pqrs.journey(j, part), [a[1], a[2] === undefined ? null : a[2]]);
      else if (a[0] === 'view') await page.evaluate(([az, el, zoom]) => { const p = window.__pqrs.pane(); p.setView({ az, el, zoom: zoom || 1 }); p.render(); }, [a[1], a[2], a[3]]);
      else if (a[0] === 'wait') await page.waitForTimeout(a[1]);
      else if (a[0] === 'click') await page.click(a[1]);
      else if (a[0] === 'eval') console.log('   eval:', JSON.stringify(await page.evaluate(a[1])));
    }
    await page.waitForTimeout(st.pause ?? 350);
    if (st.shot) {
      const path = resolve(out, `${st.shot}.png`), of = st.of || 'page';
      if (of === 'page') await page.screenshot({ path, fullPage: !!st.full }); else await page.locator(SEL[of] || of).screenshot({ path });
      const info = await page.evaluate(() => ({ hash: window.__pqrs.state().hash, surf: window.__pqrs.surface() }));
      console.log(`${st.shot}: ${info.hash}  surface ${JSON.stringify({ on: info.surf.on, err: info.surf.error, info: info.surf.info && { flat: info.surf.info.flat, swaps: info.surf.info.swaps, thick: +info.surf.info.thick.toFixed(3) } })}`);
    }
  }
} finally { await browser.close(); }
if (errors.length) console.log('PAGE ERRORS:\n  ' + [...new Set(errors)].slice(0, 12).join('\n  '));
