// dev/recut/ss-live-bottle.mjs — the owner's link, https://spacesheep.dev/@yaroslavvb/the-folding#g=xx&t=1, on the REAL
// spacesheep viewer after the classic bottle of 14 Nov 2026: the closed shape is the new fold (its stops, its words,
// the seam closed), the fold plays through its three moves, a phone shows the short words. Pictures with --out <dir>.
//   node dev/recut/ss-live-bottle.mjs [--out <dir>] [--base https://spacesheep.dev/@yaroslavvb/the-folding]
import fs from 'node:fs';
import path from 'node:path';
import { openBrowser } from '../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const BASE = opt.base || 'https://spacesheep.dev/@yaroslavvb/the-folding';
const outDir = opt.out ? path.resolve(opt.out) : null;
if (outDir) fs.mkdirSync(outDir, { recursive: true });
let failed = 0;
const check = (ok, what, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${detail ? '  — ' + detail : ''}`); };
const B = await openBrowser();
async function appFrame(page) {
  for (let i = 0; i < 200; i++) {
    for (const f of page.frames()) {
      if (f === page.mainFrame()) continue;
      try { if (await f.evaluate(() => !!(window.__folding && window.__folding.ready))) return f; } catch { /* loading */ }
    }
    await page.waitForTimeout(200);
  }
  throw new Error('no app frame');
}
const pick = (s) => ({ g: s.groupId, t: +(+s.t).toFixed(3), stops: s.stops.map((x) => x.label), caption: s.foldCaption, gap: s.seamGap, recut: s.recut && s.recut.home, errors: s.errors, nonFinite: s.nonFinite });
try {
  const ctx = await B.browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '#g=xx&t=1', { waitUntil: 'load' });
  const f = await appFrame(page);
  await page.waitForTimeout(1500);
  const s = pick(await f.evaluate(() => window.__folding.getState()));
  check(s.g === 'xx' && s.t === 1 && s.errors === 0 && s.nonFinite === 0, 'the link opens xx, closed', JSON.stringify(s));
  check(JSON.stringify(s.stops) === JSON.stringify(['flat', 'folded over', 'tube in a tube', 'Klein bottle']), 'it is the classic bottle (the three moves are its stops)');
  check(/sewn through the wall/.test(s.caption), 'the closed shape says what the dashed curve is', s.caption);
  check(s.gap !== null && s.gap < 1e-6 && s.recut === null, 'the seams are closed; the default cut needs no re-cut', String(s.gap));
  if (outDir) await page.screenshot({ path: path.join(outDir, 'live-xx-t1.png') });
  for (const [t, want] of [[0.15, /folds over/], [0.45, /tube inside a tube/], [0.8, /hooks round/]]) {
    await f.evaluate((t) => window.__folding.setT(t), t);
    await page.waitForTimeout(700);
    const c = await f.evaluate(() => window.__folding.getState().foldCaption);
    check(want.test(c), `t = ${t}: the words of the move`, c);
    if (outDir) await page.screenshot({ path: path.join(outDir, `live-xx-t${Math.round(100 * t)}.png`) });
  }
  // the translucent Comma: the neck inside shows through the wall; the address bar carries it
  await f.evaluate(() => { window.__folding.setT(1); window.__folding.setPattern('comma'); window.__folding.flushHash(); });
  await page.waitForTimeout(900);
  check(/g=xx/.test(page.url()) && /pat=comma/.test(page.url()) && /t=1/.test(page.url()), 'the address bar follows', page.url());
  if (outDir) await page.screenshot({ path: path.join(outDir, 'live-xx-comma.png') });
  // a phone
  const phone = await (await B.browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  await phone.goto(BASE + '#g=xx&t=0.8', { waitUntil: 'load' });
  const pf = await appFrame(phone);
  await phone.waitForTimeout(1500);
  const pc = await pf.evaluate(() => ({ cap: window.__folding.getState().foldCaption, words: document.getElementById('app').hasAttribute('data-words'), wide: document.documentElement.scrollWidth - innerWidth }));
  check(pc.cap === 'the neck hooks round to the wall' && pc.words && pc.wide <= 0, 'phone: the short words, their strip, no sideways scroll', JSON.stringify(pc));
  if (outDir) await phone.screenshot({ path: path.join(outDir, 'live-xx-phone.png') });
} catch (e) { failed++; console.log('FAIL ' + (e && e.stack || e)); } finally { await B.close(); }
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
