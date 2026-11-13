// dev/recut/sheet.mjs — one picture of all 17 groups: the stage (plane and fold) of each at one t, one pattern.
//   node dev/recut/sheet.mjs --t 0.55 --pat checker --out <png> [--page dev/app-demo.html] [--w 760 --h 470] [--cols 3] [--ids a,b,c]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..');
const W = +opt.w || 760, H = +opt.h || 470, cols = +opt.cols || 3, t = opt.t === undefined ? 0.55 : +opt.t;
const B = await openBrowser({ root });
try {
  const page = await (await B.browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  let errors = 0;
  page.on('console', (m) => { if (m.type() === 'error') { errors++; console.log('CONSOLE ERROR', m.text()); } });
  page.on('pageerror', (e) => { errors++; console.log('PAGE ERROR', e.message); });
  await page.goto(B.url(opt.page || 'dev/app-demo.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 20000 });
  const ids = opt.ids ? opt.ids.split(',') : await page.evaluate(() => ['o', '2222', '**', 'xx', '*x', '333', '22x', '22*', '*2222', '2*22', '442', '632', '3*3', '*333', '4*2', '*442', '*632']);
  const shots = [];
  for (const id of ids) {
    const st = await page.evaluate(([g, pat, tt, preset]) => { const F = window.__folding; F.setGroup(g); if (preset) F.setPreset(+preset); F.setPattern(pat); F.setT(tt); const s = F.getState(); return { print: s.print, errors: s.errors, recut: s.recut && s.recut.movers }; }, [id, opt.pat || 'checker', t, opt.preset || 0]);
    await page.waitForTimeout(260);
    const buf = await page.screenshot({ fullPage: false });
    shots.push({ id, b64: buf.toString('base64'), st });
  }
  const sheet = await B.browser.newPage({ viewport: { width: cols * (W / 2 + 8) + 24, height: 900 } });
  await sheet.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:10px;font:12px system-ui;background:#fff}.g{display:grid;grid-template-columns:repeat(${cols},${W / 2}px);gap:8px}figure{margin:0;border:1px solid #ddd}img{display:block;width:100%}figcaption{padding:1px 5px;color:#555}</style><div class="g">${shots.map((s) => `<figure><img src="data:image/png;base64,${s.b64}"><figcaption>${s.id} · ${s.st.print || 'comma'} · t = ${t}${s.st.recut ? ' · re-cut ' + s.st.recut : ''}${s.st.errors ? ' · ERRORS ' + s.st.errors : ''}</figcaption></figure>`).join('')}</div>`);
  await sheet.waitForTimeout(200);
  const out = path.resolve(opt.out || 'sheet.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sheet.screenshot({ path: out, fullPage: true });
  console.log('WROTE ' + out + (errors ? ` (${errors} errors)` : ''));
} finally { await B.close(); }
