// scratch-review-chrome/phone-perf.mjs — a phone, roughly: the BUILT page at 390 x 780, dpr 3, touch, with the CPU slowed
// down --rate times (Chrome's own throttling, CDP Emulation.setCPUThrottlingRate; 4 is the usual stand-in for a mid
// phone). Per pattern: the first drawn page (an init script catches api.ready being assigned), group changes cold
// (the warmer stopped after every change) and warm (after the warmer made the others), and what one warmer slot took
// (its longest: an input that comes during it waits that long).
//   FOLDING_BROWSER=mini node dev/patterns/scratch-review-chrome/phone-perf.mjs [--rate 4] [--pats paisley,checker] [--ids o,xx,22x,*632,2*22,442,333]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const pagePath = opt.page || 'dist/index.html', rate = +opt.rate || 4;
const pats = (opt.pats || 'paisley,soft,tomoe,checker,comma').split(',');
const ids = (opt.ids || 'o,xx,22x,*632,2*22,442,*x,22*').split(',');
const INIT = () => {
  window.__perf = { built: null };
  let real;
  Object.defineProperty(window, '__folding', { configurable: true, get() { return real; }, set(v) {
    real = v; let rd = v.ready;
    try { Object.defineProperty(v, 'ready', { configurable: true, enumerable: true, get() { return rd; }, set(p) { if (window.__perf.built === null) window.__perf.built = performance.now(); rd = p; } }); } catch (e) { /* */ }
  } });
};
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[(s.length - 1) >> 1]; };
const B = await openBrowser({ root });
const msgs = [];
try {
  for (const pat of pats) {
    const row = { pat };
    for (const mode of ['cold', 'warm']) {
      const ctx = await B.browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      await ctx.addInitScript(INIT);
      const page = await ctx.newPage();
      page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') msgs.push(`${m.type()}: ${m.text()}`); });
      page.on('pageerror', (e) => msgs.push('pageerror: ' + e.message));
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      await page.goto(B.url(pagePath) + (pat === 'paisley' ? '#g=333' : `#g=333&pat=${pat}`), { waitUntil: 'load' });
      await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 60000 });
      await page.evaluate(() => window.__folding.ready);
      if (mode === 'cold') {
        row.load = await page.evaluate(() => { const nav = performance.getEntriesByType('navigation')[0]; return Math.round(window.__perf.built - nav.responseEnd); });
        await page.evaluate(() => window.__folding.warmer.stop());
      } else {
        const t0 = Date.now();
        let w;
        while (Date.now() - t0 < 60000) { w = await page.evaluate(() => window.__folding.getState().warm); if (w.left === 0 && w.made + w.skipped >= 16) break; await page.waitForTimeout(400); }
        row.warmer = { made: w.made, ms: w.ms, maxMs: w.maxMs, secs: (Date.now() - t0) / 1000 };
      }
      const times = [];
      for (const id of ids) {
        const ms = await page.evaluate(([g, cold]) => { const F = window.__folding, t0 = performance.now(); F.setGroup(g); const d = performance.now() - t0; if (cold) F.warmer.stop(); return d; }, [id, mode === 'cold']);
        times.push(ms);
        await page.waitForTimeout(500);
      }
      row[mode] = { median: Math.round(med(times)), max: Math.round(Math.max(...times)), per: Object.fromEntries(ids.map((g, i) => [g, Math.round(times[i])])) };
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await ctx.close();
    }
    console.log(`${pat.padEnd(8)} x${rate}: first drawn ${row.load} ms after the response; setGroup cold median ${row.cold.median} max ${row.cold.max}; warm median ${row.warm.median} max ${row.warm.max}; warmer ${JSON.stringify(row.warmer)}`);
    console.log('         cold ' + JSON.stringify(row.cold.per) + '  warm ' + JSON.stringify(row.warm.per));
  }
} finally { await B.close(); }
console.log('console messages: ' + (msgs.length ? msgs.slice(0, 8).join(' | ') : 'none'));
