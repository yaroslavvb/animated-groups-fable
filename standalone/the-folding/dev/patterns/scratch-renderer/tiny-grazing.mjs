// scratch: the small sheet turning, seen at low elevations (the footprint is long and thin there): flicker and mean
// against the ideal picture and the unfiltered one, as the 'tiny' section of tex-demo.mjs does at el 55 and 90.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-renderer/tiny-grazing.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../../..');
const pad = (s, n) => String(s).padEnd(n);
const B = await openBrowser({ root });
let worst = 0;
try {
  for (const dpr of [1, 2]) {
    const ctx = await B.browser.newContext({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: dpr });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
    await page.goto(B.url('dev/patterns/tex-demo.html?size=256&range=4'), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__tex && window.__tex.ready, null, { timeout: 120000 });
    console.log(`dpr ${dpr}\n   el  sheet px  pixels |  mean gpu (spread)   ideal (spread) |  flicker gpu  ideal   point  | gpu / ideal`);
    for (const el of [30, 20, 12, 6]) for (const sheetPx of [320, 160, 80, 40]) {
      const t = await page.evaluate(([o]) => window.__tex.tiny(o), [{ sheetPx, el, frames: 13, stepDeg: 1 }]);
      const ratio = t.gpu.flicker / Math.max(1e-9, t.ideal.flicker);
      if (t.pixelsPerFrame > 50) worst = Math.max(worst, ratio);
      console.log(`   ${pad(el, 3)} ${pad(sheetPx, 9)} ${pad(t.pixelsPerFrame, 6)} |  ${pad(t.gpu.mean, 6)} (${pad(t.gpu.meanSpread, 6)})  ${pad(t.ideal.mean, 6)} (${pad(t.ideal.meanSpread, 6)}) |  ${pad(t.gpu.flicker, 11)}  ${pad(t.ideal.flicker, 6)}  ${pad(t.point.flicker, 6)} | ${ratio.toFixed(2)}`);
    }
    await ctx.close();
  }
} finally { await B.close(); }
console.log(`largest flicker of the GPU's picture relative to the ideal one's (views with more than 50 pixels): ${worst.toFixed(2)}`);
