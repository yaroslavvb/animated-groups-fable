// dev/patterns/scratch-fixer3/warm-probe3.mjs — the fixer (15 Nov 2026): who pokes the warmer while the fold is drawn
// again at the same t every 250 ms? __folding.warmer.poke is wrapped to count its calls (the page's poke() looks it up
// at each call) with the stack's first app frame; the idle slots Chrome gives are recorded too.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-fixer3/warm-probe3.mjs [root] [page]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';

const root = path.resolve(process.argv[2] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'));
const pagePath = process.argv[3] || 'dev/app-demo.html';
const B = await openBrowser({ root });
try {
  const ctx = await B.browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await page.addInitScript(() => {
    window.__idle = [];
    const ric = window.requestIdleCallback;
    if (ric) window.requestIdleCallback = (cb, o) => ric((d) => { window.__idle.push(Math.round(d.timeRemaining() * 10) / 10); cb(d); }, o);
  });
  await page.goto(B.url(pagePath) + '#g=2222', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000, polling: 100 });
  await page.evaluate(() => window.__folding.ready);
  await page.waitForTimeout(2500);                 // Paisley's prints made, everything settled
  const r = await page.evaluate(() => new Promise((resolve) => {
    const F = window.__folding, W = F.warmer, orig = W.poke.bind(W), who = {};
    let pokes = 0;
    W.poke = () => { pokes++; const s = (new Error().stack || '').split('\n').slice(2, 5).map((l) => l.trim().replace(/\(.*\//, '(')).join(' < '); who[s] = (who[s] || 0) + 1; orig(); };
    F.setT(0.5);
    F.setPattern('comma');
    window.__idle.length = 0;
    const m0 = F.getState().warm.made, d0 = F.counters.draws, p0 = pokes;
    let k = 0;
    const id = setInterval(() => {
      F.setT(0.5);
      if (++k === 8) { clearInterval(id); const idle = window.__idle.splice(0); resolve({ m0, made: F.getState().warm.made, left: F.getState().warm.left, draws: F.counters.draws - d0, pokes: pokes - p0, who, idle: idle.length, idleLong: idle.filter((x) => x >= 30).length, idleMax: Math.max(0, ...idle) }); }
    }, 250);
  }));
  console.log(JSON.stringify(r, null, 1));
} finally { await B.close(); }
