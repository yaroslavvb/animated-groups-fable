// scratch-review-chrome/bake-probe.mjs — what is left of a warm group change under a shape print: the same groups
// visited twice after the warmer made every print. The first visit bakes the 3D texture (src/shapes.js bakeShapes keeps
// the last BAKE_KEEP = 6); the second, within 6 groups, finds it baked. The difference is the bake's share.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-review-chrome/bake-probe.mjs [--pats paisley,checker]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const pats = (opt.pats || 'paisley,soft,checker').split(',');
const ids = ['442', '632', '2222', '**', '2*22'];
const B = await openBrowser({ root });
try {
  for (const pat of pats) {
    const ctx = await B.browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    await page.goto(B.url('dist/index.html') + (pat === 'paisley' ? '#g=333' : `#g=333&pat=${pat}`), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
    await page.evaluate(() => window.__folding.ready);
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) { const w = await page.evaluate(() => window.__folding.getState().warm); if (w.left === 0 && w.made + w.skipped >= 16) break; await page.waitForTimeout(300); }
    const r = { first: [], second: [], uploads: [] };
    for (const pass of ['first', 'second']) {
      for (const id of ids) {
        const ms = await page.evaluate((g) => { const t0 = performance.now(); window.__folding.setGroup(g); return performance.now() - t0; }, id);
        r[pass].push(Math.round(ms * 10) / 10);
        await page.waitForTimeout(450);
      }
      r.uploads.push(await page.evaluate(() => window.__folding.renderer.stats.printUploads));
    }
    const sum = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10;
    console.log(`${pat.padEnd(8)} first visit (warm print, texture baked now) mean ${sum(r.first)} ms ${JSON.stringify(r.first)}; second visit mean ${sum(r.second)} ms ${JSON.stringify(r.second)}; texture uploads after each pass ${r.uploads}`);
    await ctx.close();
  }
} finally { await B.close(); }
