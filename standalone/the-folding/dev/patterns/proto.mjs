// dev/patterns/proto.mjs — the contact sheet of a pattern design (dev/patterns/proto.html) as a PNG, drawn in a headless
// Chrome of the pool on the mini (tools/browser.mjs), plus its numbers as JSON on stdout.
//   node dev/patterns/proto.mjs --design designs/<key>/design.js --out <png> [--ids 333,*x] [--px 330] [--cols 4]
//                               [--side back] [--zoom 1.6] [--measure 0] [--json <file>]
// --design is relative to dev/patterns/. One browser at a time per agent; a run takes a few seconds.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
if (!opt.design || !opt.out) { console.error('usage: node dev/patterns/proto.mjs --design designs/<key>/design.js --out <png> [--ids ..] [--px 330] [--cols 4] [--side back] [--zoom 1.6]'); process.exit(2); }
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..');
const px = +opt.px || 330, cols = +opt.cols || 4;
const qs = new URLSearchParams({ design: opt.design, px: String(px), cols: String(cols) });
for (const k of ['ids', 'side', 'zoom', 'measure']) if (opt[k] !== undefined) qs.set(k, opt[k]);

const B = await openBrowser({ root });
let code = 0;
try {
  const page = await (await B.browser.newContext({ viewport: { width: cols * (px + 10) + 30, height: 900 }, deviceScaleFactor: 1 })).newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR', m.text()); });
  page.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); });
  await page.goto(B.url('dev/patterns/proto.html?' + qs.toString()), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__proto && window.__proto.ready, null, { timeout: 600000 });
  const res = await page.evaluate(() => window.__proto);
  if (res.error) { console.log('ERROR ' + res.error); code = 1; }
  const out = path.resolve(opt.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, fullPage: true });
  for (const r of res.rows) {
    if (r.error) { console.log('ROW ERROR ' + r.id + ' ' + r.error.split('\n')[0]); code = 1; }
  }
  console.log('ROWS ' + JSON.stringify(res.rows.map((r) => ({ id: r.id, ms: r.ms, coverage: r.coverage, emptyDisc: r.emptyDisc, darkDisc: r.darkDisc, overlap: r.overlap, verts: r.verts, error: r.error ? r.error.split('\n')[0] : undefined }))));
  if (opt.json) fs.writeFileSync(path.resolve(opt.json), JSON.stringify(res.rows, null, 1));
  console.log('WROTE ' + out + ' (' + B.where + ')');
} finally { await B.close(); }
process.exit(code);
