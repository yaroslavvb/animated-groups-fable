#!/usr/bin/env node
// journey-film.mjs — one picture of the JOURNEY (src/journey.js): N frames from the surface (j = 0) through the flat
// tile to the pattern (j = 1), of the 3D pane, the plane pane or the whole stage of dist/index.html. Made on 15 Nov
// 2026, when the fold and the tiling became one journey (the owner: "first unfold and then tile").
//
//   node dev/unify/journey-film.mjs --g '*632' [--pat paisley] [--preset 0] [--amp 1] [--j0 0 --j1 1] [--frames 12]
//        [--cols 6] [--pane fold|plane|stage] [--w 1280 --h 720] [--az 0 --el 55] [--out qa/u/journey-s632.png]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../tools/browser.mjs';

const args = process.argv.slice(2);
const opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : '1';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const g = opt.g || '333';
const frames = Number(opt.frames || 12), cols = Number(opt.cols || 6);
const W = Number(opt.w || 1280), H = Number(opt.h || 720);
const j0 = Number(opt.j0 || 0), j1 = Number(opt.j1 === undefined ? 1 : opt.j1);
const pane = { fold: '#pane-fold', plane: '#pane-plane', stage: '#stage' }[opt.pane || 'fold'];
const out = path.resolve(root, opt.out || path.join('qa', 'u', `journey-${g.replace(/\*/g, 's')}-${opt.pane || 'fold'}.png`));

const B = await openBrowser({ root });
let errors = 0;
try {
  const page = await (await B.browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  page.on('console', (m) => { if (m.type() === 'error') { errors++; console.log('CONSOLE ERROR', m.text()); } });
  page.on('pageerror', (e) => { errors++; console.log('PAGE ERROR', e.message); });
  await page.goto(B.url('dist/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 15000 });
  const st0 = await page.evaluate((s) => {
    const F = window.__folding;
    F.setGroup(s.g);
    if (s.pat) F.setPattern(s.pat);
    if (s.preset !== null) F.setPreset(s.preset);
    if (s.amp !== null) F.setAmp(s.amp);
    if (s.az !== null || s.el !== null) F.setView(s.az === null ? 0 : s.az, s.el === null ? 55 : s.el);
    const q = F.getState();
    return { tile: q.journeyTile, errors: q.errors, plan: (F.tilePlan() || { phases: [] }).phases.map((p) => `wave ${p.wave} u ${p.t0.toFixed(3)}-${p.t1.toFixed(3)} x${p.count}: ${p.text}`) };
  }, { g, pat: opt.pat || null, preset: opt.preset === undefined ? null : Number(opt.preset), amp: opt.amp === undefined ? null : Number(opt.amp),
    az: opt.az === undefined ? null : Number(opt.az), el: opt.el === undefined ? null : Number(opt.el) });
  console.log(`the tile sits at j = ${st0.tile}; errors ${st0.errors}`);
  if (opt.phases) for (const l of st0.plan) console.log('PHASE ' + l);
  const shots = [];
  for (let i = 0; i < frames; i++) {
    const j = frames === 1 ? j0 : j0 + ((j1 - j0) * i) / (frames - 1);
    const s = await page.evaluate((jj) => { const q = window.__folding.setJourney(jj); return { t: q.t, tile: q.tile, stop: q.journeyStop, errors: q.errors, nonFinite: q.nonFinite, button: q.button, next: q.nextButton }; }, j);
    await page.waitForTimeout(450);                      // (the camera frame eases)
    const box = await page.locator(pane).boundingBox();
    shots.push({ j, s, b64: (await page.screenshot({ clip: box })).toString('base64') });
    if (s.errors || s.nonFinite) console.log(`j = ${j.toFixed(3)}: errors ${s.errors}, not finite ${s.nonFinite}`);
  }
  const sheet = await B.browser.newPage({ viewport: { width: 1600, height: 900 } });
  const cellW = Math.floor(1560 / cols);
  const cap = (x) => `j = ${x.j.toFixed(3)} · ${x.s.t > 0 ? 't = ' + x.s.t.toFixed(2) : 'tile = ' + x.s.tile.toFixed(2)}${x.s.stop ? ' · ' + x.s.stop : ''}`;
  await sheet.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{margin:16px;font:13px -apple-system,system-ui,sans-serif;color:#1a1a1f;background:#fff}
    h1{font-size:15px;margin:0 0 10px}
    .g{display:grid;grid-template-columns:repeat(${cols},${cellW}px);gap:6px}
    figure{margin:0;border:1px solid #e5e5ea} img{display:block;width:100%} figcaption{padding:2px 6px;font-variant-numeric:tabular-nums;color:#52514a}
  </style><h1>The journey · ${g}${opt.pat ? ' · ' + opt.pat : ''}${opt.preset ? ' · preset ' + opt.preset : ''}${opt.amp ? ' · wavy ' + opt.amp : ''} · ${opt.pane || 'fold'} pane</h1><div class="g">${shots.map((x) => `<figure><img src="data:image/png;base64,${x.b64}"><figcaption>${cap(x)}</figcaption></figure>`).join('')}</div>`);
  await sheet.waitForTimeout(150);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sheet.screenshot({ path: out, fullPage: true });
  console.log('WROTE ' + out);
} finally {
  await B.close();
}
process.exit(errors ? 1 : 0);
