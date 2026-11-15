// dev/patterns/scratch-review-webkit/dbg-plane.mjs — why many of the plane's samples of 333 are neither tone (Chrome).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const B = await openBrowser({ root: path.join(here, 'stage'), where: 'mini' });
try {
  const ctx = await B.browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(B.url('index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready);
  await page.evaluate(() => window.__folding.ready);
  await page.evaluate(() => { const F = window.__folding; F.setGroup('333'); F.setPattern('paisley'); F.setT(0); });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const F = window.__folding, S = F.scene(), P = F.plane;
    P.render();
    const pc = document.getElementById('plane-canvas'), img = pc.getContext('2d').getImageData(0, 0, pc.width, pc.height).data;
    const k = pc.width / pc.clientWidth;
    const xy = S.M.xy, tri = S.M.tri, hist = new Map(), pts = [];
    for (let t = 0; t < tri.length / 3; t++) {
      const a = tri[3 * t], b = tri[3 * t + 1], c = tri[3 * t + 2];
      const u = (xy[2 * a] + xy[2 * b] + xy[2 * c]) / 3, v = (xy[2 * a + 1] + xy[2 * b + 1] + xy[2 * c + 1]) / 3;
      const p = P.toCss(u, v), X = Math.floor(p[0] * k), Y = Math.floor(p[1] * k), o = 4 * (Y * pc.width + X);
      const key = [img[o], img[o + 1], img[o + 2]].join(',');
      hist.set(key, (hist.get(key) || 0) + 1);
      if (pts.length < 10 && key === '154,159,178') pts.push([+u.toFixed(3), +v.toFixed(3), X, Y]);
    }
    const W = (x, y) => { const p = P.toCss(x, y); return [Math.round(p[0]), Math.round(p[1])]; };
    return { css: [pc.clientWidth, pc.clientHeight], dev: [pc.width, pc.height], hist: [...hist].sort((a, b) => b[1] - a[1]).slice(0, 12), pts,
      tileBox: (() => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let i = 0; i < xy.length; i += 2) { const p = P.toCss(xy[i], xy[i + 1]); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); } return [x0, y0, x1, y1].map(Math.round); })(),
      origin: W(0, 0), seed: S.domain.seed, dbg: P.debug ? Object.keys(P.debug()) : null };
  });
  console.log(JSON.stringify(r, null, 1));
  await page.locator('#pane-plane').screenshot({ path: '/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/review-webkit/dbg-plane-333.png' });
  await ctx.close();
} finally { await B.close(); }
