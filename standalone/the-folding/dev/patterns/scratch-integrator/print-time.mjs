// dev/patterns/scratch-integrator/print-time.mjs — what a group change pays for its shape print when nothing was made
// ahead: printFor(group, key) the first time (find + makeShapePrint + printable), in the page's own module, in a real
// Chrome (the pool on the mini). That is the work src/patterns/warm.js moves into idle time. Fresh page per pattern,
// the warmer stopped; the groups in the picker's order (the first one pays for the JIT too).
//   FOLDING_BROWSER=mini node dev/patterns/scratch-integrator/print-time.mjs [--pats paisley,soft,tomoe,comma] [--json <file>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const pats = (opt.pats || 'paisley,soft,tomoe,comma').split(',');
const B = await openBrowser({ root });
const out = {};
try {
  for (const pat of pats) {
    const ctx = await B.browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    // the page opens with the CHECKERBOARD on *632, so no shape print is made at load
    await page.goto(B.url('dev/app-demo.html') + '#g=%2A632&pat=checker', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
    await page.evaluate(() => window.__folding.warmer.stop());
    const rows = await page.evaluate(async (key) => {
      const { printFor } = await import('../src/pattern.js'), { GROUPS } = await import('../src/groups.js');
      const r = {};
      for (const g of GROUPS) { const t0 = performance.now(); const P = printFor(g, key); r[g.id] = [+(performance.now() - t0).toFixed(1), P ? P.verts : null]; }
      return r;
    }, pat);
    const ms = Object.values(rows).map((v) => v[0]).sort((a, b) => a - b);
    out[pat] = { rows, median: ms[ms.length >> 1], max: ms[ms.length - 1], total: +ms.reduce((a, b) => a + b, 0).toFixed(1) };
    console.log(`${pat.padEnd(8)} printFor, first ask: median ${out[pat].median} ms, max ${out[pat].max}, all 17 ${out[pat].total} ms   ` + Object.entries(rows).map(([id, v]) => `${id} ${v[0]}`).join('  '));
    await ctx.close();
  }
} finally { await B.close(); }
if (opt.json) { fs.writeFileSync(path.resolve(opt.json), JSON.stringify(out, null, 1)); console.log('WROTE ' + opt.json); }
