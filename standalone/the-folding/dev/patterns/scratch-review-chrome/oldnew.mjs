// (live-index.html is not kept, 355 kB: make it with
//    git show HEAD:standalone/the-folding/dist/index.html > dev/patterns/scratch-review-chrome/live-index.html
//  and delete it afterwards, so it is never committed)
// scratch-review-chrome/oldnew.mjs — the LIVE page (git HEAD's dist, saved as live-index.html next to this file) beside
// the BUILT page, scene by scene: old Comma (the sheet) vs new Comma (the print), and the old default vs the new one.
// A scene is id@t[@p<preset>]. Each row: [old page, pattern A] [new page, pattern B] for each pair --pairs 'comma:comma,checker:paisley'.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-review-chrome/oldnew.mjs --out <png> --scenes 'xx@1,o@1' [--clip fold|stage]
//        [--pairs comma:comma] [--w 1000 --h 700] [--disp 330]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OLD = 'dev/patterns/scratch-review-chrome/live-index.html', NEW = 'dist/index.html';
const scenes = (opt.scenes || 'xx@1').split(','), pairs = (opt.pairs || 'comma:comma').split(',').map((p) => p.split(':'));
const W = +opt.w || 1000, H = +opt.h || 700, disp = +opt.disp || 330;
const clipSel = { fold: '#pane-fold', plane: '#pane-plane', stage: '#stage' }[opt.clip || 'fold'];
const B = await openBrowser({ root });
const msgs = [];
try {
  const ctx = await B.browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const pages = {};
  for (const [k, p] of [['old', OLD], ['new', NEW]]) {
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') msgs.push(`${k} ${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => msgs.push(`${k} pageerror: ${e.message}`));
    await page.goto(B.url(p) + '#g=333', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
    await page.evaluate(() => window.__folding.ready);
    pages[k] = page;
  }
  const rows = [];
  for (const s of scenes) {
    const [id, t, ...rest] = s.split('@');
    const preset = rest.find((r) => r[0] === 'p') ? +rest.find((r) => r[0] === 'p').slice(1) : 0;
    const cells = [];
    for (const [a, b] of pairs) for (const [k, pat] of [['old', a], ['new', b]]) {
      const page = pages[k];
      await page.bringToFront();
      const st = await page.evaluate(([g, pat, tt, pr]) => { const F = window.__folding; F.setPattern(pat); F.setGroup(g); if (pr) F.setPreset(pr); F.setT(tt); F.resetView(); const s = F.getState(); return { pattern: s.pattern, print: s.print }; }, [id, pat, +t, preset]);
      await page.waitForTimeout(450);
      const box = await page.locator(clipSel).boundingBox();
      cells.push({ cap: `${k} page · ${st.pattern}: ${st.print || 'sheet'}`, b64: (await page.screenshot({ clip: box })).toString('base64') });
    }
    rows.push({ s, cells });
  }
  const n = 2 * pairs.length;
  const sheet = await ctx.newPage();
  await sheet.setViewportSize({ width: n * (disp + 6) + 24, height: 600 });
  await sheet.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:8px;font:12px system-ui;background:#fff}.g{display:grid;grid-template-columns:repeat(${n},${disp}px);gap:5px;margin-bottom:6px}figure{margin:0;border:1px solid #ddd}img{display:block;width:100%}figcaption{padding:1px 4px}</style>${rows.map((r) => `<div style="font-weight:600">${r.s}</div><div class="g">${r.cells.map((c) => `<figure><img src="data:image/png;base64,${c.b64}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`);
  await sheet.waitForTimeout(150);
  const out = path.resolve(opt.out || 'oldnew.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sheet.screenshot({ path: out, fullPage: true });
  console.log('WROTE ' + out);
} finally { await B.close(); }
console.log('console messages: ' + (msgs.length ? msgs.join(' | ') : 'none'));
