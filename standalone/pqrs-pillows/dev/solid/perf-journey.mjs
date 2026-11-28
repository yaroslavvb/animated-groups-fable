// perf-journey.mjs — script time of slider frames while the solid is parted (j = 1) and opened (j = 2)
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const PW = `${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`;
const { chromium } = await import(pathToFileURL(PW).href);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  for (const sig of ['3333', '2345', '2222']) {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(pathToFileURL(resolve(here, '../../site/index.html')).href + `#k=${sig}&tw=0.05`, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const r = await page.evaluate(async () => {
      const P = window.__pqrs, out = {};
      for (const j of [1, 2]) {
        P.journey(j, 0);
        await new Promise((f) => requestAnimationFrame(f));
        P.perfReset();
        for (let i = 1; i <= 40; i++) { P.set({ tw: 0.05 + 0.005 * i }, { key: '01|23', dragging: true }); await new Promise((f) => requestAnimationFrame(f)); }
        const d = P.perf().drag;
        out[`j=${j}`] = { n: d.n, mean: +(d.total / d.n).toFixed(1), worst: +d.worst.toFixed(1), model: +(d.model / d.n).toFixed(1), surface: +(d.surface / d.n).toFixed(1), bake: +(d.bake / d.n).toFixed(1), chart: +(d.chart / d.n).toFixed(1), pane: +(d.pane / d.n).toFixed(1), pattern: +(d.pattern / d.n).toFixed(1) };
        P.set({ tw: 0.05 }, { key: '01|23' });
      }
      return out;
    });
    console.log(sig, JSON.stringify(r), errors.length ? 'ERRORS ' + errors.slice(0, 2).join(' | ') : '');
    await page.close();
  }
} finally { await browser.close(); }
