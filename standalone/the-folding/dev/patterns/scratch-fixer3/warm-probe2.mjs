// dev/patterns/scratch-fixer3/warm-probe2.mjs — the fixer (15 Nov 2026): browser-check's last laptop steps (a drag of the
// cut in the plane, the mouse left over it), then a fresh load of #g=2222 in the same page; every 250 ms for 5 s the
// warmer, the app's draws, the frames Chrome makes (a rAF counter) and the idle slots it gives. Then the mouse moved off.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-fixer3/warm-probe2.mjs [page]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const pagePath = process.argv[2] || 'dev/app-demo.html';
const B = await openBrowser({ root });
try {
  const ctx = await B.browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await page.addInitScript(() => {
    window.__idle = []; window.__frames = 0;
    const ric = window.requestIdleCallback;
    if (ric) window.requestIdleCallback = (cb, o) => ric((d) => { window.__idle.push(Math.round(d.timeRemaining() * 10) / 10); if (window.__idle.length > 400) window.__idle.shift(); cb(d); }, o);


  });
  const ready = () => page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 }).then(() => page.evaluate(() => window.__folding.ready));
  await page.goto(B.url(pagePath) + '#g=xx&cut=1&t=0.1', { waitUntil: 'load' });
  await ready();
  const box = await page.locator('#plane-canvas').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 25, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  await page.goto(B.url(pagePath) + '#g=2222', { waitUntil: 'load' });
  await page.reload({ waitUntil: 'load' });
  await ready();
  const probe = async (label, n) => {
    for (let i = 0; i < n; i++) {
      const r = await page.evaluate(() => { const s = window.__folding.getState(); const id = window.__idle.splice(0); const f = window.__frames; window.__frames = 0; return { made: s.warm.made, left: s.warm.left, passed: s.warm.passed, draws: window.__folding.counters.draws, frames: f, idle: id.length, idleMax: id.length ? Math.max(...id) : null, hover: document.querySelectorAll(':hover').length, cursor: getComputedStyle(document.getElementById('plane-canvas')).cursor }; });
      console.log(label, i * 250, JSON.stringify(r));
      await page.waitForTimeout(250);
    }
  };
  await probe('mouse over the plane', 12);
  await page.mouse.move(5, 5);
  await probe('mouse moved off', 8);
} finally { await B.close(); }
