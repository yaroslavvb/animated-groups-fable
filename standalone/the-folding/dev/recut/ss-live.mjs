// dev/recut/ss-live.mjs — the deployed page, on the REAL spacesheep viewer (not the stand-in): the pattern selector, the
// address bar (pat=, through the viewer's ss-hash), a pasted link, the re-cut's words; pictures at a laptop and a phone.
//   node dev/recut/ss-live.mjs [--out <dir>] [--base https://spacesheep.dev/@yaroslavvb/the-folding]
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
const pick = (s) => ({ g: s.groupId, pattern: s.pattern, print: s.print, cut: s.cut, t: +(+s.t).toFixed(3), recut: s.recut && s.recut.home, caption: s.foldCaption, errors: s.errors });
try {
  const ctx = await B.browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  const f = await appFrame(page);
  let s = pick(await f.evaluate(() => window.__folding.getState()));
  check(s.pattern === 'checker' && !!s.print && s.errors === 0, 'the live page opens on the checkerboard', JSON.stringify(s));
  check(await f.evaluate(() => !!document.getElementById('pattern') && !!document.getElementById('fold-caption')), 'it is the new build (the selector and the fold caption are there)');
  check(await f.evaluate(() => getComputedStyle(document.getElementById('pane-fold')).containerName === 'fold'), 'it is the build with the phone fixes (the 3D pane is a size container)');
  await f.evaluate(() => { const F = window.__folding; F.setGroup('22x'); F.setPreset(2); F.setPattern('rings'); F.setT(0.15); F.flushHash(); });
  await page.waitForTimeout(2500);
  s = pick(await f.evaluate(() => window.__folding.getState()));
  const top = page.url();
  check(/pat=rings/.test(top) && /g=22x/.test(top) && /cut=2/.test(top), 'the address bar of the viewer follows: group, pattern, cut', top);
  check(s.recut === 'Pocket' && /^re-cut, piece/.test(s.caption), 're-cut first, with its words', JSON.stringify(s));
  if (outDir) await page.screenshot({ path: path.join(outDir, 'live-22x-recut.png') });
  // the copied address, opened afresh
  const page2 = await (await B.browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await page2.goto(top, { waitUntil: 'load' });
  const f2 = await appFrame(page2);
  await page2.waitForTimeout(1200);
  const s2 = pick(await f2.evaluate(() => window.__folding.getState()));
  check(JSON.stringify(s2) === JSON.stringify(s), 'the copied address restores the same state', JSON.stringify(s2));
  // the default view of the complaint: *x, covered
  await f2.evaluate(() => { const F = window.__folding; F.setGroup('*x'); F.setPattern('checker'); F.setT(1); F.flushHash(); });
  await page2.waitForTimeout(1500);
  if (outDir) await page2.screenshot({ path: path.join(outDir, 'live-sx-closed.png') });
  // a phone
  const pp = await (await B.browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  await pp.goto(BASE + '#g=xx&cut=1&t=0.1', { waitUntil: 'load' });
  const f3 = await appFrame(pp);
  await pp.waitForTimeout(1500);
  const s3 = pick(await f3.evaluate(() => window.__folding.getState()));
  check(s3.g === 'xx' && s3.cut === 1 && s3.recut === 'Rectangle' && /^re-cut \d\/\d/.test(s3.caption), 'phone: a pasted link, the short words', JSON.stringify(s3));
  const strip = await f3.evaluate(() => { const c = document.getElementById('fold-canvas').getBoundingClientRect(), w = document.getElementById('fold-caption').getBoundingClientRect(), p = document.getElementById('pane-fold').getBoundingClientRect(); return [Math.round(c.bottom), Math.round(w.top), Math.round(p.width), Math.round(p.height)]; });
  check(strip[0] <= strip[1], 'phone: the picture ends above the words (they have a strip of their own)', JSON.stringify(strip));
  if (outDir) await pp.screenshot({ path: path.join(outDir, 'live-phone-xx.png') });
  // a narrow phone: the chip keeps "hm · shape" whole (the title gives way under 370 px)
  const pn = await (await B.browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  await pn.goto(BASE + '#g=%2A333', { waitUntil: 'load' });
  const f4 = await appFrame(pn);
  await pn.waitForTimeout(1200);
  const chip = await f4.evaluate(() => { const m = document.getElementById('chip-meta'); return { g: window.__folding.getState().groupId, text: m.textContent, cut: m.scrollHeight > m.clientHeight + 1 || m.scrollWidth > m.clientWidth + 1, w: innerWidth }; });
  check(chip.g === '*333' && chip.text === 'p3m1 · equilateral triangle' && !chip.cut, 'narrow phone: the chip shows the whole name of *333', JSON.stringify(chip));
  if (outDir) await pn.screenshot({ path: path.join(outDir, 'live-phone-360-s333.png') });
} finally { await B.close(); }
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
