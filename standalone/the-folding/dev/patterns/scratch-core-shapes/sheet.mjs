// scratch (core-shapes): sheet.html as a PNG, drawn in a headless Chrome of the pool on the mini (tools/browser.mjs),
// plus its rows (how many grid points of the canvas differ from tone()) on stdout.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-core-shapes/sheet.mjs --out <png> [--ids 333,*x] [--px 232] [--cols 6] [--side back] [--design designs/<key>/design.js]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
if (!opt.out) { console.error('usage: node sheet.mjs --out <png> [--ids ..] [--px 232] [--cols 6] [--side back] [--design designs/<key>/design.js]'); process.exit(2); }
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../../..');
const px = +opt.px || 232, cols = +opt.cols || (opt.design ? 8 : 6);
const qs = new URLSearchParams({ px: String(px), cols: String(cols) });
for (const k of ['ids', 'side', 'design']) if (opt[k] !== undefined) qs.set(k, opt[k]);
const B = await openBrowser({ root });
let code = 0;
try {
  const page = await (await B.browser.newContext({ viewport: { width: cols * (px + 8) + 30, height: 900 }, deviceScaleFactor: 1 })).newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR', m.text()); });
  page.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); });
  await page.goto(B.url('dev/patterns/scratch-core-shapes/sheet.html?' + qs.toString()), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sheet && window.__sheet.ready, null, { timeout: 180000 });
  const res = await page.evaluate(() => window.__sheet);
  if (res.error) { console.log('ERROR ' + res.error); code = 1; }
  const out = path.resolve(opt.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, fullPage: true });
  let samples = 0, bad = 0;
  for (const r of res.rows) {
    if (r.error) { console.log('ROW ERROR ' + r.id + ' ' + r.motif + ' ' + r.error.split('\n')[0]); code = 1; continue; }
    samples += r.samples; bad += r.mismatches;
    if (r.mismatches || !r.ok) console.log('ROW', JSON.stringify({ id: r.id, motif: r.motif, mismatches: r.mismatches, samples: r.samples, problems: r.problems }));
  }
  console.log(`CHECK ${res.rows.length} canvases, ${samples} points compared with tone(), ${bad} differ`);
  console.log('WROTE ' + out + ' (' + B.where + ')');
} finally { await B.close(); }
process.exit(code);
