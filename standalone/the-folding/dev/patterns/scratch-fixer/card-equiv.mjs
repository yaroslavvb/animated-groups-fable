// card-equiv.mjs (fixer, 13 Nov 2026) — a card of the Tile step under a shape print, drawn the two ways src/plane.js has
// had: fillPrint through the card's map (the old way, still node's) and one world-space Path2D under the card's own
// transform (the new way), on two canvases of the mini's Chrome; the pixels compared. Several cards: turned, flipped,
// shifted by fractions of a pixel, at dpr 1 and 2.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-fixer/card-equiv.mjs [--designs demo,stress] [--ids '*442,333']
import { openBrowser } from '../../../tools/browser.mjs';
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const designs = (opt.designs || 'demo,stress').split(','), ids = (opt.ids || '*442,333,22x').split(',');
const B = await openBrowser({ root: '/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding' });
try {
  const page = await (await B.browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
  await page.goto(B.url('dev/patterns/app.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__designs && window.__designs.ready, null, { timeout: 30000 });
  const rows = await page.evaluate(async ([ds, gids]) => {
    const S = await import('/src/shapes.js'), Pt = await import('/src/pattern.js'), G = await import('/src/groups.js');
    const out = [];
    for (const d of ds) {
      const M = await import(`/dev/patterns/designs/${d}/design.js`);
      for (const id of gids) {
        const g = G.BY_ID[id], print = S.makeShapePrint(g, { key: d, shapes: M.find(g).shapes });
        for (const dpr of [1, 2]) {
          const W = 420, H = 360, view = { W, H, s: 260, cx: g.center[0], cy: g.center[1], kx: dpr, ky: dpr };
          const X = (x) => view.W / 2 + (x - view.cx) * view.s, Y = (y) => view.H / 2 - (y - view.cy) * view.s;
          const tol = 0.25 / (view.s * dpr), half = 0.6 * Math.sqrt(g.domainArea);
          const box = [g.center[0] - half, g.center[1] - half, g.center[0] + half, g.center[1] + half];
          for (const [name, th, flip, dx, dy] of [['still', 0, 1, 0, 0], ['turned', 0.7, 1, 0.013, -0.021], ['flipped', 2.1, -1, -0.037, 0.008], ['shifted', 0, 1, 0.0013, 0.0007]]) {
            const A = { a: Math.cos(th), b: -Math.sin(th) * flip, c: Math.sin(th), d: Math.cos(th) * flip, tx: 0, ty: 0 };
            // turn about the box's middle, then shift
            const mx = g.center[0], my = g.center[1];
            A.tx = mx - (A.a * mx + A.b * my) + dx; A.ty = my - (A.c * mx + A.d * my) + dy;
            const make = () => { const cv = document.createElement('canvas'); cv.width = W * dpr; cv.height = H * dpr; const c = cv.getContext('2d', { willReadFrequently: true }); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); return c; };
            const c1 = make(), c2 = make();
            c1.globalAlpha = 0.8;
            Pt.fillPrint(c1, print, (x, y, o) => { o[0] = X(A.a * x + A.b * y + A.tx); o[1] = Y(A.c * x + A.d * y + A.ty); return o; }, box, 'rgba(79,163,151,0.2)', tol);
            const path = new Path2D(), into = { beginPath() {}, fill() {}, moveTo: (x, y) => path.moveTo(x, y), lineTo: (x, y) => path.lineTo(x, y), closePath: () => path.closePath() };
            Pt.fillPrint(into, print, (x, y, o) => { o[0] = x; o[1] = y; return o; }, box, null, tol);
            const s = view.s, kx = dpr, ky = dpr;
            c2.globalAlpha = 0.8; c2.fillStyle = 'rgba(79,163,151,0.2)';
            c2.save(); c2.setTransform(kx * s * A.a, -ky * s * A.c, kx * s * A.b, -ky * s * A.d, kx * (W / 2 + s * (A.tx - view.cx)), ky * (H / 2 - s * (A.ty - view.cy))); c2.fill(path, 'nonzero'); c2.restore();
            const a = c1.getImageData(0, 0, W * dpr, H * dpr).data, b = c2.getImageData(0, 0, W * dpr, H * dpr).data;
            let n = 0, max = 0, ink = 0;
            for (let i = 0; i < a.length; i += 4) {
              const m = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
              if (m) { n++; if (m > max) max = m; }
              if (a[i] < 250) ink++;
            }
            out.push({ d, id, dpr, card: name, differ: n, max, inked: ink });
          }
        }
      }
    }
    return out;
  }, [designs, ids]);
  for (const r of rows) console.log(JSON.stringify(r));
  console.log('worst: ' + Math.max(...rows.map((r) => r.max)) + ' levels; most pixels: ' + Math.max(...rows.map((r) => r.differ)));
} finally { await B.close(); }
