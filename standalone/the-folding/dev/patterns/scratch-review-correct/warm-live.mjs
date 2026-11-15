// scratch (review-correct, 15 Nov 2026): the warmer in the real page (the sources, dev/app-demo.html, Chrome on the mini),
// read through the page's OWN pattern module (a dynamic import of the same URL is the same module instance):
//   1. after load: every group's Paisley print made, one per slot, none twice
//   2. two pattern changes in one task (soft, then tomoe): nothing of Soft commas is made but the shown group's
//   3. the same with 150 ms between them (the quiet after a rebuild must hold the slot back)
//   4. input: while the mouse moves (every 60 ms for 2.5 s) nothing is made; afterwards the rest is
//   5. hidden: another tab in front — is this one hidden, and does the warmer go on making prints there?
//   FOLDING_BROWSER=mini node dev/patterns/scratch-review-correct/warm-live.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const B = await openBrowser({ root });
const say = (...a) => console.log(...a);
try {
  const ctx = await B.browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGE ERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text()); });
  await page.goto(B.url('dev/app-demo.html') + '#g=333', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
  await page.evaluate(() => window.__folding.ready);
  await page.evaluate(async () => { window.__pm = await import('../src/pattern.js'); window.__G = await import('../src/groups.js'); });
  const cached = (key) => page.evaluate((k) => window.__G.GROUPS.filter((g) => window.__pm.printCached(g, k)).map((g) => g.id), key);
  const warm = () => page.evaluate(() => window.__folding.getState().warm);
  const waitDone = async (key, ms = 30000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const w = await warm(); if (w.key === key && w.left === 0) return { ...w, waited: Date.now() - t0 }; await page.waitForTimeout(150); }
    return { ...(await warm()), waited: 'TIMED OUT' };
  };
  const st = () => page.evaluate(() => { const s = window.__folding.getState(); return { pattern: s.pattern, print: s.print, kind: s.printKind, sel: document.getElementById('pattern').value, dp: document.getElementById('app').getAttribute('data-print'), hash: s.hash }; });

  // 1. after load
  let w = await waitDone('paisley');
  say('1 load:', JSON.stringify(w), '| paisley made for', (await cached('paisley')).length, 'groups |', JSON.stringify(await st()));
  // the cache answers at once now (a print asked again costs nothing)
  const again = await page.evaluate(() => window.__G.GROUPS.map((g) => { const t0 = performance.now(); window.__pm.printFor(g, 'paisley'); return performance.now() - t0; }));
  say('  printFor again, the slowest of 17:', Math.max(...again).toFixed(3), 'ms');

  // 2. two changes in one task
  let soft0 = await cached('soft');
  await page.evaluate(() => { window.__folding.setPattern('soft'); window.__folding.setPattern('tomoe'); });
  w = await waitDone('tomoe');
  let soft1 = await cached('soft');
  say('2 soft then tomoe in one task:', JSON.stringify(w), '| Soft commas made:', JSON.stringify(soft1.filter((x) => !soft0.includes(x))), '| tomoe made for', (await cached('tomoe')).length, '|', JSON.stringify(await st()));

  // 3. 150 ms apart (rings in between: a print of its own, no shape pattern)
  soft0 = await cached('soft');
  await page.evaluate(() => window.__folding.setPattern('soft'));
  await page.waitForTimeout(150);
  await page.evaluate(() => window.__folding.setPattern('comma'));
  w = await waitDone('comma');
  soft1 = await cached('soft');
  say('3 soft, 150 ms, comma:', JSON.stringify(w), '| Soft commas made:', JSON.stringify(soft1.filter((x) => !soft0.includes(x))), '|', JSON.stringify(await st()));

  // 4. input holds it back: a group change (the queue of the current pattern, Comma, is done; take Rings -> Soft commas)
  await page.evaluate(() => window.__folding.setPattern('soft'));
  const w0 = await warm();
  const box = await page.locator('#plane-canvas').boundingBox();
  for (let i = 0; i < 42; i++) { await page.mouse.move(box.x + 50 + (i % 20) * 5, box.y + 60 + (i % 7) * 4); await page.waitForTimeout(60); }
  const w1 = await warm();
  w = await waitDone('soft');
  say('4 moving the mouse 2.5 s:', `made ${w0.made} -> ${w1.made} while moving (passed ${w0.passed} -> ${w1.passed}); then ${JSON.stringify(w)}`);

  // 5. hidden: another tab in front
  await page.evaluate(() => window.__folding.setPattern('paisley'));      // done already: nothing to make
  await page.evaluate(() => { window.__folding.setGroup('442'); window.__folding.setPattern('tomoe'); window.__folding.setPattern('checker'); });
  const w2 = await warm();
  const other = await ctx.newPage();
  await other.goto(B.url('dev/app-demo.html') + '#g=o&pat=rings', { waitUntil: 'load' });
  await other.bringToFront();
  await page.waitForTimeout(300);
  const vis = await page.evaluate(() => [document.visibilityState, document.hidden]);
  await other.waitForTimeout(4000);
  const w3 = await warm();
  say('5 another tab in front: this one is', JSON.stringify(vis), `| warm before ${JSON.stringify(w2)} | 4 s later ${JSON.stringify(w3)}`);
  await other.close();
  say('errors / warnings:', errs.length ? errs.slice(0, 8).join(' || ') : 'none');
} finally { await B.close(); }
