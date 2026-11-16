#!/usr/bin/env node
// drag-cost.mjs — what a drag of the cut costs per frame with the pattern in the 3D pane (15 Nov 2026): a real mouse
// drag across the plane, at the pattern (the 3D pane re-makes its patch of copies every frame), at the lone tile and
// at the surface. Prints the rebuilds per second the page kept up and the time of one rebuild.
//   node dev/unify/drag-cost.mjs [--groups 333,632,*x,o,22x]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../tools/browser.mjs';
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..');
const B = await openBrowser({ root });
try {
  const page = await (await B.browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await page.goto(B.url('dist/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 15000 });
  for (const g of (opt.groups || '333,632,*x,o,22x,2*22').split(',')) {
    const row = [];
    for (const where of ['pattern', 'tile', 'surface']) {
      await page.evaluate(([id, w]) => { const F = window.__folding; F.setGroup(id); if (w === 'tile') F.setTile(0); if (w === 'surface') F.setT(1); }, [g, where]);
      await page.waitForTimeout(300);
      const box = await page.locator('#plane-canvas').boundingBox();
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      const c0 = await page.evaluate(() => ({ r: window.__folding.counters.rebuilds, t: performance.now() }));
      await page.mouse.move(cx, cy); await page.mouse.down();
      for (let i = 1; i <= 90; i++) { await page.mouse.move(cx + 40 * Math.sin(i / 14), cy + 28 * Math.sin(i / 9)); await page.waitForTimeout(8); }
      const c1 = await page.evaluate(() => ({ r: window.__folding.counters.rebuilds, t: performance.now() }));
      await page.mouse.up();
      // one rebuild, timed alone (the same cut again: the full mesh)
      const one = await page.evaluate(() => { const F = window.__folding, s = F.getState().seed; const t0 = performance.now(); for (let k = 0; k < 5; k++) F.setSeed(s[0] + 0.001 * k, s[1]); return (performance.now() - t0) / 5; });
      row.push(`${where}: ${((c1.r - c0.r) / ((c1.t - c0.t) / 1000)).toFixed(0)} rebuilds/s in the drag, a full rebuild ${one.toFixed(1)} ms`);
    }
    console.log(g.padEnd(5), row.join(' | '));
  }
} finally { await B.close(); }
