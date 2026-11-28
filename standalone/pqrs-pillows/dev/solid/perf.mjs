// perf.mjs — script time of slider frames on the built page (one headless Chrome): a Twist drag and a Length drag of 60 steps each
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const PW = `${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`;
const { chromium } = await import(pathToFileURL(PW).href);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  for (const sig of ['3333', '2345', '2222']) {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })).newPage();
    await page.goto(pathToFileURL(resolve(here, '../../site/index.html')).href + `#k=${sig}`, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const r = await page.evaluate(async () => {
      const P = window.__pqrs, out = {};
      for (const [name, key] of [['twist of card 1', '01|23'], ['twist of card 3', '03|12']]) {
        P.perfReset();
        for (let i = 1; i <= 60; i++) { P.set({ tw: 0.004 * i }, { key, dragging: true }); await new Promise((f) => requestAnimationFrame(f)); }
        const d = P.perf().drag;
        out[name] = { n: d.n, mean: +(d.total / d.n).toFixed(2), worst: +d.worst.toFixed(1), pattern: +(d.pattern / d.n).toFixed(2), cards: +(d.cards / d.n).toFixed(2), model: +(d.model / d.n).toFixed(2), bake: +(d.bake / d.n).toFixed(2), chart: +(d.chart / d.n).toFixed(2), pane: +(d.pane / d.n).toFixed(2), rest: +(d.rest / d.n).toFixed(2) };
      }
      return out;
    });
    console.log(sig, JSON.stringify(r));
    await page.close();
  }
} finally { await browser.close(); }
