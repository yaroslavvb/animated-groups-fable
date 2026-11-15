// dev/patterns/scratch-fixer3/warm-probe.mjs — the fixer (15 Nov 2026): a fresh page, then every 250 ms for 6 s the
// warmer's state, the app's draw counter, document.hidden and the length of the idle slots Chrome gives.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-fixer3/warm-probe.mjs [page] [hash]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const pagePath = process.argv[2] || 'dev/app-demo.html', hash = process.argv[3] || '#g=2222';
const B = await openBrowser({ root });
try {
  const ctx = await B.browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => console.log('CONSOLE', m.type(), m.text().slice(0, 200)));
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await page.addInitScript(() => {
    window.__idle = [];
    const ric = window.requestIdleCallback;
    if (ric) window.requestIdleCallback = (cb, o) => ric((d) => { window.__idle.push(Math.round(d.timeRemaining() * 10) / 10); if (window.__idle.length > 400) window.__idle.shift(); cb(d); }, o);
  });
  await page.goto(B.url(pagePath) + hash, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
  await page.evaluate(() => window.__folding.ready);
  for (let i = 0; i < 24; i++) {
    const r = await page.evaluate(() => { const s = window.__folding.getState(); const id = window.__idle.splice(0); return { w: s.warm, draws: window.__folding.counters.draws, hidden: document.hidden, vis: document.visibilityState, playing: s.playing, idle: id.length, idleMax: id.length ? Math.max(...id) : null, idleMin: id.length ? Math.min(...id) : null }; });
    console.log(i * 250, JSON.stringify(r));
    await page.waitForTimeout(250);
  }
} finally { await B.close(); }
