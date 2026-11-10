#!/usr/bin/env node
// shot.mjs — load a page from this workspace in headless Chrome and save screenshots. One Chrome per run.
//
//   node tools/shot.mjs --page dist/index.html --out qa/home.png [--w 1280] [--h 720] [--dpr 1] [--wait 500] [--eval "js"] [--full]
//   node tools/shot.mjs --page dist/index.html --steps qa/steps.json
//
// --root <dir>   directory served over http (default: the workspace root, i.e. the parent of tools/)
// --page <path>  page path relative to root (ES modules work, because the page is served over http)
// --steps <file> JSON array of steps run in order in ONE page:
//                [{ "eval": "js run in the page (may return a promise)", "wait": 300, "out": "qa/a.png",
//                   "w": 390, "h": 844, "full": false, "clip": {"x":0,"y":0,"width":400,"height":300},
//                   "drag": {"from":[x,y], "to":[x,y], "steps": 12}, "click": [x,y], "reload": false }, ...]
//                A step may have any subset of the keys; order within a step: resize, reload, eval, click, drag, wait, out.
// --probe        print whether WebGL2 is available and exit
// Console errors and uncaught page errors are printed; exit code 1 if any page error occurred (0 with --lenient).
// The result of every "eval" is printed as JSON on a line starting with "EVAL ".

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from './browser.mjs';

const PLAYWRIGHT = process.env.PLAYWRIGHT_MJS ||
  '/Users/yaroslavvb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const args = process.argv.slice(2);
const opt = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (!a.startsWith('--')) continue;
  const k = a.slice(2);
  if (['full', 'probe', 'lenient'].includes(k)) opt[k] = true;
  else opt[k] = args[++i];
}
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(opt.root || path.join(here, '..'));
const page0 = opt.page || 'dist/index.html';

// The browser: a Chrome of the pool on the mini when one is free, else one on this Mac (tools/browser.mjs).
const B = await openBrowser({ root });
const browser = B.browser;
const url = B.url(page0);
let pageErrors = 0;
try {
  const dpr = Number(opt.dpr || 1);
  const ctx = await browser.newContext({ viewport: { width: Number(opt.w || 1280), height: Number(opt.h || 720) }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR', m.text()); });
  page.on('pageerror', (e) => { pageErrors++; console.log('PAGE ERROR', e.message); });
  await page.goto(url, { waitUntil: 'load' });
  if (opt.probe) {
    const ok = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
    console.log('webgl2', ok);
  } else {
    const steps = opt.steps ? JSON.parse(fs.readFileSync(path.resolve(opt.steps), 'utf8'))
      : [{ eval: opt.eval, wait: Number(opt.wait || 500), out: opt.out, full: !!opt.full }];
    for (const s of steps) {
      if (s.w || s.h) await page.setViewportSize({ width: s.w || 1280, height: s.h || 720 });
      if (s.reload) await page.reload({ waitUntil: 'load' });
      if (s.eval) {
        const r = await page.evaluate(`(async () => { return (${s.eval}); })()`).catch((e) => ({ evalError: String(e) }));
        console.log('EVAL ' + JSON.stringify(r === undefined ? null : r));
      }
      if (s.click) await page.mouse.click(s.click[0], s.click[1]);
      if (s.drag) {
        await page.mouse.move(s.drag.from[0], s.drag.from[1]);
        await page.mouse.down();
        await page.mouse.move(s.drag.to[0], s.drag.to[1], { steps: s.drag.steps || 10 });
        await page.mouse.up();
      }
      if (s.wait) await page.waitForTimeout(s.wait);
      if (s.out) {
        const out = path.resolve(s.out);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        await page.screenshot({ path: out, fullPage: !!s.full, clip: s.clip });
        console.log('WROTE ' + out);
      }
    }
  }
} finally {
  await B.close();
}
process.exit(pageErrors && !opt.lenient ? 1 : 0);
