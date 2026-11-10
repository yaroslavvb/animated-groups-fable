#!/usr/bin/env node
// filmstrip.mjs — one picture of a whole fold: N frames of the 3D pane of dist/index.html laid out in a grid.
// Use it to judge MOTION (pops, flips, collisions, ugly in-between states) without watching a video.
//
//   node tools/filmstrip.mjs --g 333 [--preset 2] [--seed 0.4,0.1] [--amp 1] [--frames 12] [--cols 6]
//        [--az 0 --el 55] [--t0 0 --t1 1] [--pane fold|plane|stage] [--w 900 --h 640] [--page dist/index.html]
//        [--out qa/film/333-p2.png]
//
// --g takes the group id ('*632', '22x', 'o', ...). One Chrome per run (it holds a machine-wide Chrome slot).
// Prints the state reported by window.__folding at the first and last frame, and any page/console error.

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
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(path.join(here, '..'));
const g = opt.g || '333';
const frames = Number(opt.frames || 12), cols = Number(opt.cols || 6);
const t0 = Number(opt.t0 || 0), t1 = Number(opt.t1 === undefined ? 1 : opt.t1);
const W = Number(opt.w || 900), H = Number(opt.h || 640);
const pane = { fold: '#pane-fold', plane: '#pane-plane', stage: '#stage' }[opt.pane || 'fold'];
const safe = g.replace(/\*/g, 's');
const out = path.resolve(opt.out || path.join(root, 'qa', 'film', `${safe}-p${opt.preset || 0}${opt.amp ? '-wavy' : ''}.png`));
const pagePath = opt.page || 'dist/index.html';

// The browser: a Chrome of the pool on the mini when one is free, else one on this Mac (tools/browser.mjs).
const B = await openBrowser({ root });
const browser = B.browser;
const url = B.url(pagePath);
let errors = 0;
try {
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  page.on('console', (m) => { if (m.type() === 'error') { errors++; console.log('CONSOLE ERROR', m.text()); } });
  page.on('pageerror', (e) => { errors++; console.log('PAGE ERROR', e.message); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 15000 });
  const setup = { g, preset: opt.preset === undefined ? null : Number(opt.preset), seed: opt.seed ? opt.seed.split(',').map(Number) : null,
    amp: opt.amp === undefined ? null : Number(opt.amp), az: opt.az === undefined ? null : Number(opt.az), el: opt.el === undefined ? null : Number(opt.el) };
  await page.evaluate((s) => {
    const F = window.__folding;
    F.setGroup(s.g);
    if (s.preset !== null) F.setPreset(s.preset);
    if (s.seed) F.setSeed(s.seed[0], s.seed[1]);
    if (s.amp !== null) F.setAmp(s.amp);
    if (s.az !== null || s.el !== null) F.setView(s.az === null ? 0 : s.az, s.el === null ? 55 : s.el);
  }, setup);
  const shots = [];
  for (let i = 0; i < frames; i++) {
    const t = frames === 1 ? t0 : t0 + ((t1 - t0) * i) / (frames - 1);
    const st = await page.evaluate((tt) => { window.__folding.setT(tt); return window.__folding.getState(); }, t);
    await page.waitForTimeout(90);
    const box = await page.locator(pane).boundingBox();
    const buf = await page.screenshot({ clip: box });
    shots.push({ t, b64: buf.toString('base64') });
    if (i === 0 || i === frames - 1) console.log(`STATE t=${t.toFixed(3)} ` + JSON.stringify({ preset: st.preset, seed: st.seed, amp: st.amp, seamGap: st.seamGap, nonFinite: st.nonFinite, errors: st.errors, view: st.view }));
  }
  const sheet = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const title = `${g} · preset ${setup.preset === null ? 0 : setup.preset}${setup.seed ? ' · seed ' + setup.seed.join(',') : ''}${setup.amp ? ' · wavy ' + setup.amp : ''}${setup.az !== null ? ' · az ' + setup.az + ' el ' + (setup.el === null ? 55 : setup.el) : ''}`;
  const cellW = Math.floor(1560 / cols);
  await sheet.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{margin:16px;font:13px -apple-system,system-ui,sans-serif;color:#1a1a1f;background:#fff}
    h1{font-size:15px;margin:0 0 10px}
    .g{display:grid;grid-template-columns:repeat(${cols},${cellW}px);gap:6px}
    figure{margin:0;border:1px solid #e5e5ea} img{display:block;width:100%} figcaption{padding:2px 6px;font-variant-numeric:tabular-nums;color:#52514a}
  </style><h1>${title}</h1><div class="g">${shots.map((s) => `<figure><img src="data:image/png;base64,${s.b64}"><figcaption>t = ${s.t.toFixed(3)}</figcaption></figure>`).join('')}</div>`);
  await sheet.waitForTimeout(150);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sheet.screenshot({ path: out, fullPage: true });
  console.log('WROTE ' + out);
} finally {
  await B.close();
}
process.exit(errors ? 1 : 0);
