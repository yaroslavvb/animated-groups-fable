// tile-sweep.mjs (fixer) — the Tile step frame by frame: P.render() + a 1-pixel read at u = 0, 0.01, ..., 1, per design
// and group, in the mini's Chrome at 1280 x 720 (dpr 1, or --dpr 2). Median, 95th percentile and worst.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-fixer/tile-sweep.mjs [--pats paisley,stress] [--ids '*632,4*2'] [--dpr 1]
import { openBrowser } from '../../../tools/browser.mjs';
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const pats = (opt.pats || 'checker,paisley,stress').split(','), ids = (opt.ids || '*632,4*2,333').split(',');
const designs = pats.filter((p) => !['checker', 'rings', 'comma'].includes(p));
const B = await openBrowser({ root: '/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding' });
try {
  const page = await (await B.browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: +(opt.dpr || 1) })).newPage();
  await page.goto(B.url('dev/patterns/app.html?designs=' + designs.join(',') + '#g=o'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__designs && window.__designs.ready && window.__folding && window.__folding.ready, null, { timeout: 30000 });
  for (const pat of pats) for (const g of ids) {
    const r = await page.evaluate(([p, gid]) => {
      const F = window.__folding, P = F.plane, c2 = document.getElementById('plane-canvas').getContext('2d');
      F.setGroup(gid); F.setPattern(p); F.setT(0); F.setTile(0); P.render(); c2.getImageData(0, 0, 1, 1);
      const ms = [];
      for (let k = 0; k <= 100; k++) { F.setTile(k / 100); const a = performance.now(); P.render(); c2.getImageData(0, 0, 1, 1); ms.push(performance.now() - a); }
      F.setTile(1);
      const s = ms.slice().sort((x, y) => x - y), q = (f) => Math.round(100 * s[Math.min(s.length - 1, Math.floor(f * s.length))]) / 100;
      return { pat: p, g: gid, median: q(0.5), p95: q(0.95), worst: q(1), over8: ms.filter((v) => v > 8).length };
    }, [pat, g]);
    console.log(JSON.stringify(r));
  }
} finally { await B.close(); }
