// scratch-review-chrome/drag.mjs — Wavy and a dragged cut on the BUILT page under each pattern, in Chrome: the Wavy
// slider moved by the mouse, a drag of the cut in the plane (real mouse events, about 40 moves), the frame intervals
// while it lasts, the page's own count of draws and rebuilds, errors, and a picture of the result per pattern (the stage),
// with t = 0.5 so the fold of the dragged and waved tile shows. Groups: --ids (default o, 333, 22x, xx, *x, 2*22).
//   FOLDING_BROWSER=mini node dev/patterns/scratch-review-chrome/drag.mjs --out-dir <dir> [--pats ...] [--ids ...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const pagePath = opt.page || 'dist/index.html', outDir = path.resolve(opt['out-dir'] || '.');
const pats = (opt.pats || 'paisley,soft,tomoe,checker,rings,comma').split(',');
const ids = (opt.ids || 'o,333,22x,xx,*x,2*22').split(',');
fs.mkdirSync(outDir, { recursive: true });
const B = await openBrowser({ root });
const msgs = [];
let bad = 0;
const rows = [];
try {
  const ctx = await B.browser.newContext({ viewport: { width: 1100, height: 700 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') msgs.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => msgs.push('pageerror: ' + e.message));
  await page.goto(B.url(pagePath) + '#g=333', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
  await page.evaluate(() => window.__folding.ready);
  for (const id of ids) {
    const shots = [];
    for (const pat of pats) {
      await page.evaluate(([g, k]) => { const F = window.__folding; F.setPattern(k); F.setGroup(g); F.setT(0.5); F.warmer.stop(); }, [id, pat]);
      await page.waitForTimeout(500);
      // the Wavy slider, by the mouse: from its left end to 70 %
      const wv = await page.locator('#wavy').boundingBox();
      await page.mouse.move(wv.x + 6, wv.y + wv.height / 2);
      await page.mouse.down();
      await page.mouse.move(wv.x + 0.7 * wv.width, wv.y + wv.height / 2, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      const a = await page.evaluate(() => { const s = window.__folding.getState(); return { amp: s.amp, draft: s.draft, errors: s.errors, print: s.print }; });
      // a drag of the cut: from the tile's handle (the plane's centre) along a curve, timing the frames meanwhile
      const pb = await page.locator('#plane-canvas').boundingBox();
      const cx = pb.x + pb.width / 2, cy = pb.y + pb.height / 2;
      await page.evaluate(() => {
        window.__drag = { gaps: [], last: performance.now(), on: true, r0: window.__folding.counters.rebuilds, d0: window.__folding.counters.draws };
        const tick = () => { const n = performance.now(); window.__drag.gaps.push(n - window.__drag.last); window.__drag.last = n; if (window.__drag.on) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      });
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      for (let i = 1; i <= 40; i++) { const f = i / 40; await page.mouse.move(cx + 70 * Math.sin(Math.PI * f) + 30 * f, cy + 45 * f - 25 * Math.sin(2 * Math.PI * f)); }
      await page.mouse.up();
      await page.waitForTimeout(400);
      const d = await page.evaluate(() => {
        window.__drag.on = false;
        const F = window.__folding, s = F.getState(), g = window.__drag.gaps.slice(1).sort((x, y) => x - y);
        return { gap: g[g.length >> 1], gap90: g[Math.floor(g.length * 0.9)], gapMax: g[g.length - 1], frames: g.length, rebuilds: F.counters.rebuilds - window.__drag.r0, draws: F.counters.draws - window.__drag.d0,
          seed: s.seed, preset: s.presetIndex, draft: s.draft, errors: s.errors, print: s.print, pattern: s.pattern, hash: s.hash, recut: s.recut && s.recut.movers };
      });
      const row = { id, pat, wavy: a, drag: d };
      rows.push(row);
      const ok = a.amp > 0.4 && !a.errors && a.print && d.preset === -1 && !d.draft && !d.errors && d.print && d.pattern === pat && /seed=/.test(d.hash) && /wavy=/.test(d.hash);
      if (!ok) { bad++; console.log(`PROBLEM ${id} ${pat}: ${JSON.stringify(row)}`); }
      console.log(`${id.padEnd(5)} ${pat.padEnd(8)} wavy ${a.amp}  drag: ${d.rebuilds} rebuilds, ${d.draws} draws, frame ${d.gap?.toFixed(1)} ms (p90 ${d.gap90?.toFixed(1)}, max ${d.gapMax?.toFixed(1)})${d.recut ? ', re-cut ' + d.recut : ''}`);
      const box = await page.locator('#stage').boundingBox();
      shots.push({ pat, b64: (await page.screenshot({ clip: box })).toString('base64') });
    }
    const sheet = await ctx.newPage();
    await sheet.setViewportSize({ width: 3 * 528 + 30, height: 600 });
    await sheet.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:8px;font:12px system-ui;background:#fff}.g{display:grid;grid-template-columns:repeat(3,520px);gap:6px}figure{margin:0;border:1px solid #ddd}img{display:block;width:100%}figcaption{padding:1px 4px}</style><div style="font-weight:600">${id}: Wavy 0.7 and a dragged cut, t = 0.5</div><div class="g">${shots.map((x) => `<figure><img src="data:image/png;base64,${x.b64}"><figcaption>${x.pat}</figcaption></figure>`).join('')}</div>`);
    await sheet.waitForTimeout(150);
    const out = path.join(outDir, `drag-${id.replace(/[*]/g, 'S')}.png`);
    await sheet.screenshot({ path: out, fullPage: true });
    await sheet.close();
    console.log('WROTE ' + out);
  }
} finally { await B.close(); }
fs.writeFileSync(path.join(outDir, 'drag.json'), JSON.stringify({ rows, msgs }, null, 1));
console.log('console messages: ' + (msgs.length ? msgs.slice(0, 12).join(' | ') : 'none'));
console.log(`done, ${bad} problems`);
process.exit(bad ? 1 : 0);
