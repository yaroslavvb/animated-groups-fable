// scratch: drives compare.html (the renderer before the texture mode against the renderer now) in a Chrome on the mini.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-renderer/compare.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../../..');
// the copy from before, as a module next to the page (its one import points back at src/)
const src = fs.readFileSync(path.join(here, 'render3d.before.js.txt'), 'utf8');
if (!src.includes(`from './palette.js'`)) throw new Error('the copy from before has no import of ./palette.js');
fs.writeFileSync(path.join(here, 'render3d-before.js'), src.replace(`from './palette.js'`, `from '../../../src/palette.js'`));
const B = await openBrowser({ root });
let code = 0;
try {
  for (const dpr of [1, 2]) {
    const ctx = await B.browser.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: dpr });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE ' + m.type() + ' ' + m.text()); });
    page.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); code = 1; });
    await page.goto(B.url('dev/patterns/scratch-renderer/compare.html'), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__cmp && window.__cmp.ready, null, { timeout: 120000 });
    const r = await page.evaluate(() => window.__cmp);
    if (r.error) { console.log('ERROR ' + r.error); code = 1; continue; }
    const worst = Math.max(...r.rows.map((x) => x.worst)), diff = r.rows.reduce((a, x) => a + x.differing, 0), empty = r.rows.filter((x) => x.ink < 2000).length;
    console.log(`dpr ${dpr} (${r.size.join(' x ')}, ${r.gpu}): ${r.rows.length} scenes; largest difference of a colour channel between the renderer before and now: ${worst} of 255; channel values that differ: ${diff}; scenes with (nearly) nothing in them: ${empty}`);
    for (const x of r.rows) if (x.worst > 0 || x.ink < 2000) console.log(`   ${x.name}: worst ${x.worst}, ${x.differing} values of ${4 * x.pixels} differ, ${x.ink} pixels drawn`);
    if (worst > 0 || empty) code = 1;
    await page.screenshot({ path: path.join(here, `compare-dpr${dpr}.png`) });
    await ctx.close();
  }
} finally { await B.close(); fs.rmSync(path.join(here, 'render3d-before.js'), { force: true }); }
process.exit(code);
