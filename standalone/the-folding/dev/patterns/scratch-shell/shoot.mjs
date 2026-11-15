// scratch: screenshot a page of the workspace at several device pixel ratios, one browser.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-shell/shoot.mjs <page> <out-prefix> [dprs=1,3] [w=1000] [h=700] [selector]
// writes <out-prefix>-<dpr>x.png (the whole page, or the element matching selector)
import { openBrowser } from '../../../tools/browser.mjs';
const [page0, out, dprs = '1,3', w = '1000', h = '700', sel = ''] = process.argv.slice(2);
const B = await openBrowser({ quiet: true });
try {
  for (const d of dprs.split(',').map(Number)) {
    const ctx = await B.browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: d });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
    await p.goto(B.url(page0), { waitUntil: 'load' });
    await p.waitForTimeout(250);
    const file = `${out}-${d}x.png`;
    if (sel) await p.locator(sel).first().screenshot({ path: file });
    else await p.screenshot({ path: file, fullPage: true });
    console.log('WROTE', file);
    await ctx.close();
  }
} finally { await B.close(); }
