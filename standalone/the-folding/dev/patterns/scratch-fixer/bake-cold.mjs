// bake-cold.mjs (fixer, 13 Nov 2026) — the FIRST bake of a print in a fresh page (nothing JIT-warm, as a person meets
// it), at BAKE_SIZE, in the mini's Chrome; then a second print's bake (warm), printable() and find for the record.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-fixer/bake-cold.mjs [--designs stress,paisley] [--ids '*632,o']
import fs from 'node:fs';
import { openBrowser } from '../../../tools/browser.mjs';

const W = '/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding';
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const designs = (opt.designs || 'stress,paisley,bigcomma,ripple,demo').split(','), ids = (opt.ids || '*632,o').split(',');
const B = await openBrowser({ root: W });
const rows = [];
try {
  for (const d of designs) for (const id of ids) {
    const ctx = await B.browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    await page.goto(B.url('dev/patterns/app.html'), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__designs && window.__designs.ready && window.__folding && window.__folding.ready, null, { timeout: 30000 });
    const r = await page.evaluate(async ([key, gid]) => {
      const S = await import('/src/shapes.js'), G = await import('/src/groups.js'), M = await import(`/dev/patterns/designs/${key}/design.js`);
      const g = G.BY_ID[gid];
      let a = performance.now(); const f = M.find(g); const find = performance.now() - a;
      const p = S.makeShapePrint(g, { key, shapes: f.shapes });
      a = performance.now(); const v = S.printable(p); const check = performance.now() - a;
      a = performance.now(); const tex = S.bakeShapes(p); const first = performance.now() - a;
      const p2 = S.makeShapePrint(g, { key, shapes: f.shapes });
      a = performance.now(); S.bakeShapes(p2); const second = performance.now() - a;
      return { key, gid, verts: p.verts, size: tex.size, first: +first.toFixed(1), second: +second.toFixed(1), printable: +check.toFixed(1), ok: v.ok, find: +find.toFixed(1) };
    }, [d, id]);
    rows.push(r);
    console.log(JSON.stringify(r));
    await ctx.close();
  }
} finally { await B.close(); }
fs.writeFileSync('/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/fixer/bake-cold.json', JSON.stringify(rows, null, 1));
console.log('first bake, worst: ' + Math.max(...rows.map((r) => r.first)) + ' ms');
