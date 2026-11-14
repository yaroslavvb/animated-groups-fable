#!/usr/bin/env node
// tile-film.mjs — one picture of the Tile step (the plane's replication): N frames of the plane pane of dist/index.html
// in a grid, u from u0 to u1. Made for the owner's comments of 13 Nov 2026 (the copies that turn over come from under
// the paper); tools/filmstrip.mjs does the same for the fold.
//
//   node dev/flip-under/tile-film.mjs --g '**' [--pat checker] [--preset 0] [--amp 1] [--u0 0 --u1 0.3] [--frames 12]
//        [--cols 6] [--w 1280 --h 720] [--out qa/film/tile-ss.png] [--phases]
//
// --phases  print the plan's phases (wave, u0, u1, words) and use the first two phases' span when u0/u1 are not given.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../tools/browser.mjs';

const args = process.argv.slice(2);
const opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : '1';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const g = opt.g || '**', pat = opt.pat || 'checker';
const frames = Number(opt.frames || 12), cols = Number(opt.cols || 6);
const W = Number(opt.w || 1280), H = Number(opt.h || 720);
const out = path.resolve(root, opt.out || path.join('qa', 'film', `tile-${g.replace(/\*/g, 's')}-${pat}.png`));

const B = await openBrowser({ root });
let errors = 0;
try {
  const page = await (await B.browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  page.on('console', (m) => { if (m.type() === 'error') { errors++; console.log('CONSOLE ERROR', m.text()); } });
  page.on('pageerror', (e) => { errors++; console.log('PAGE ERROR', e.message); });
  await page.goto(B.url('dist/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 15000 });
  const plan = await page.evaluate((s) => {
    const F = window.__folding;
    F.setGroup(s.g); F.setPattern(s.pat);
    if (s.preset !== null) F.setPreset(s.preset);
    if (s.amp !== null) F.setAmp(s.amp);
    F.setTile(0);
    return F.tilePlan();
  }, { g, pat, preset: opt.preset === undefined ? null : Number(opt.preset), amp: opt.amp === undefined ? null : Number(opt.amp) });
  for (const p of plan.phases) console.log(`PHASE wave ${p.wave} u ${p.t0.toFixed(3)}-${p.t1.toFixed(3)} x${p.count}: ${p.text}`);
  const u0 = opt.u0 !== undefined ? Number(opt.u0) : plan.phases[0].t0;
  const u1 = opt.u1 !== undefined ? Number(opt.u1) : plan.phases[Math.min(1, plan.phases.length - 1)].t1;
  const shots = [];
  for (let i = 0; i < frames; i++) {
    const u = frames === 1 ? u0 : u0 + ((u1 - u0) * i) / (frames - 1);
    await page.evaluate((uu) => window.__folding.setTile(uu), u);
    await page.waitForTimeout(60);
    const box = await page.locator('#pane-plane').boundingBox();
    shots.push({ u, b64: (await page.screenshot({ clip: box })).toString('base64') });
  }
  const sheet = await B.browser.newPage({ viewport: { width: 1600, height: 900 } });
  const cellW = Math.floor(1560 / cols);
  await sheet.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{margin:16px;font:13px -apple-system,system-ui,sans-serif;color:#1a1a1f;background:#fff}
    h1{font-size:15px;margin:0 0 10px}
    .g{display:grid;grid-template-columns:repeat(${cols},${cellW}px);gap:6px}
    figure{margin:0;border:1px solid #e5e5ea} img{display:block;width:100%} figcaption{padding:2px 6px;font-variant-numeric:tabular-nums;color:#52514a}
  </style><h1>Tile step · ${g} · ${pat}${opt.preset ? ' · preset ' + opt.preset : ''}${opt.amp ? ' · wavy ' + opt.amp : ''}</h1><div class="g">${shots.map((s) => `<figure><img src="data:image/png;base64,${s.b64}"><figcaption>u = ${s.u.toFixed(3)}</figcaption></figure>`).join('')}</div>`);
  await sheet.waitForTimeout(150);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sheet.screenshot({ path: out, fullPage: true });
  console.log('WROTE ' + out);
} finally {
  await B.close();
}
process.exit(errors ? 1 : 0);
