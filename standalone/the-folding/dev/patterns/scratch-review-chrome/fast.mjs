// scratch-review-chrome/fast.mjs — fast switching on the BUILT page in Chrome: storms of group, pattern and t changes
// through the test handle and the native <select>, pattern changes in the middle of a Fold play and of a Tile play, the
// idle making of prints while patterns change faster than its quiet time; after each, the page must agree with itself
// (state, #app[data-pattern]/[data-print], the select, the pill's swatch, the address) and have no error.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-review-chrome/fast.mjs [--page dist/index.html] [--out <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const pagePath = opt.page || 'dist/index.html', outDir = opt.out ? path.resolve(opt.out) : null;
if (outDir) fs.mkdirSync(outDir, { recursive: true });
let failed = 0, passed = 0;
const check = (ok, what, detail = '') => { if (ok) passed++; else failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${detail ? '  — ' + detail : ''}`); };
const B = await openBrowser({ root });
const msgs = [];
// what the page says about itself, all of it, and whether it agrees
const CONSISTENT = () => {
  const F = window.__folding, s = F.getState(), app = document.getElementById('app');
  const shown = [...document.querySelectorAll('.pat-sw')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => [...e.classList].find((c) => c.startsWith('pat-sw-')).slice(7));
  const sc = F.scene();
  const problems = [];
  if (app.getAttribute('data-pattern') !== s.pattern) problems.push('data-pattern ' + app.getAttribute('data-pattern'));
  if (document.getElementById('pattern').value !== s.pattern) problems.push('select ' + document.getElementById('pattern').value);
  if (shown.join() !== s.pattern) problems.push('swatch ' + shown.join());
  if ((app.getAttribute('data-print') || null) !== (s.printKind || null)) problems.push('data-print ' + app.getAttribute('data-print') + ' vs ' + s.printKind);
  if (!sc || sc.group.id !== s.groupId) problems.push('scene group ' + (sc && sc.group.id));
  if (sc && sc.pattern !== s.pattern) problems.push('scene pattern ' + sc.pattern);
  if (['paisley', 'soft', 'tomoe', 'comma'].includes(s.pattern) && s.print !== s.pattern) problems.push('print ' + s.print);
  if (s.errors) problems.push('errors ' + s.errors + ': ' + F.errors.slice(-2).join(' / '));
  if (s.url !== s.hash) problems.push('url ' + s.url + ' vs hash ' + s.hash);
  return { problems, s: { g: s.groupId, pattern: s.pattern, print: s.print, t: s.t, hash: s.hash, warm: s.warm, playing: s.playing, tile: s.tile } };
};
try {
  const ctx = await B.browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') msgs.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => msgs.push('pageerror: ' + e.message));
  await page.goto(B.url(pagePath) + '#g=333', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
  await page.evaluate(() => window.__folding.ready);
  const settle = async (ms = 500) => { await page.waitForTimeout(ms); await page.evaluate(() => window.__folding.flushHash()); await page.waitForTimeout(100); return page.evaluate(CONSISTENT); };

  // A. a storm through the handle, synchronous: 300 changes, no frame in between
  const storm = await page.evaluate(() => {
    const F = window.__folding, ids = ['o', '2222', '**', 'xx', '*x', '333', '22x', '22*', '*2222', '2*22', '442', '632', '3*3', '*333', '4*2', '*442', '*632'];
    const pats = ['paisley', 'soft', 'tomoe', 'checker', 'rings', 'comma'];
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const ms = [];
    for (let i = 0; i < 300; i++) {
      const r = rnd(), t0 = performance.now();
      if (r < 0.4) F.setGroup(ids[Math.floor(rnd() * ids.length)]);
      else if (r < 0.75) F.setPattern(pats[Math.floor(rnd() * pats.length)]);
      else if (r < 0.9) F.setT(rnd());
      else F.setPreset(Math.floor(rnd() * 3));
      ms.push(performance.now() - t0);
    }
    ms.sort((a, b) => a - b);
    return { median: ms[150], p95: ms[285], max: ms[299] };
  });
  let c = await settle(800);
  check(!c.problems.length, 'A. 300 changes through the handle without a frame between them: the page agrees with itself', JSON.stringify(c.problems.length ? c : c.s));
  console.log('   per change: ' + JSON.stringify(storm));

  // B. the native select, fast, interleaved with group changes from the handle (no waits)
  for (let i = 0; i < 24; i++) {
    await page.selectOption('#pattern', ['soft', 'tomoe', 'paisley', 'comma', 'checker', 'rings'][i % 6]);
    if (i % 3 === 0) await page.evaluate((g) => window.__folding.setGroup(g), ['xx', '22x', '*632', 'o', '*x', '2*22', '333', '**'][i % 8]);
  }
  c = await settle(600);
  check(!c.problems.length && c.s.pattern === 'rings', 'B. 24 picks in the select between group changes: the last pick shows, all agree', JSON.stringify(c.problems.length ? c : c.s));

  // C. patterns changing faster than the warmer's quiet time (every 150 ms for 3 s), then the page left alone
  const before = await page.evaluate(() => window.__folding.getState().warm);
  for (let i = 0; i < 20; i++) { await page.evaluate((k) => window.__folding.setPattern(k), ['paisley', 'soft', 'tomoe', 'comma'][i % 4]); await page.waitForTimeout(150); }
  const during = await page.evaluate(() => window.__folding.getState().warm);
  check(during.made === before.made || during.made - before.made <= 1, 'C. while the pattern changes every 150 ms the warmer makes nothing (it waits for 400 ms of quiet)', JSON.stringify({ before: before.made, during: during.made, key: during.key }));
  let w = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) { w = await page.evaluate(() => window.__folding.getState().warm); if (w.left === 0) break; await page.waitForTimeout(300); }
  c = await settle(200);
  check(w.left === 0 && w.key === 'comma' && w.errors.length === 0 && !c.problems.length, 'C. left alone, the warmer makes the last pattern\'s prints of the other groups and stops', JSON.stringify({ w, secs: (Date.now() - t0) / 1000, problems: c.problems }));

  // D. a pattern change and a group change in the middle of a Fold play
  await page.evaluate(() => { const F = window.__folding; F.setGroup('xx'); F.setPattern('paisley'); F.setT(0); });
  const play = page.evaluate(() => window.__folding.play());
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__folding.setPattern('tomoe'));
  await page.waitForTimeout(700);
  const mid = await page.evaluate(() => window.__folding.getState());
  await page.evaluate(() => window.__folding.setPattern('soft'));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__folding.setGroup('22x'));
  await play;
  c = await settle(300);
  check(!c.problems.length, 'D. a Fold play through two pattern changes and a group change: no error, all agree', JSON.stringify({ mid: [mid.pattern, mid.t, mid.playing], end: c.s, problems: c.problems }));
  // ... and a full play under each new pattern on xx (the classic bottle), to the end
  for (const k of ['paisley', 'soft', 'tomoe', 'comma']) {
    await page.evaluate((kk) => { const F = window.__folding; F.setGroup('xx'); F.setPattern(kk); F.setT(0); }, k);
    const s = await page.evaluate(() => window.__folding.play());
    c = await settle(100);
    check(s.t === 1 && !c.problems.length && s.seamGap < 1e-6, `D. xx under ${k}: Fold plays to the closed bottle`, JSON.stringify({ t: s.t, gap: s.seamGap, cap: s.foldCaption, problems: c.problems }));
    if (outDir) { const box = await page.locator('#stage').boundingBox(); await page.screenshot({ path: path.join(outDir, `fast-xx-played-${k}.png`), clip: box }); }
  }

  // E. the Tile step playing while the pattern and then the group change
  await page.evaluate(() => { const F = window.__folding; F.setGroup('22*'); F.setPattern('paisley'); F.setT(0); F.setTile(0); });
  const tp = page.evaluate(() => window.__folding.playTile());
  await page.waitForTimeout(900);
  await page.evaluate(() => window.__folding.setPattern('soft'));
  await page.waitForTimeout(900);
  const midT = await page.evaluate(() => window.__folding.getState());
  if (outDir) { const box = await page.locator('#pane-plane').boundingBox(); await page.screenshot({ path: path.join(outDir, 'fast-tile-switched.png'), clip: box }); }
  await page.evaluate(() => window.__folding.setPattern('comma'));
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__folding.setGroup('*x'));
  await Promise.race([tp, page.waitForTimeout(15000)]);
  c = await settle(400);
  check(!c.problems.length && c.s.tile === 1, 'E. a Tile play through two pattern changes and a group change: no error, the tiling complete after the group change', JSON.stringify({ mid: [midT.pattern, midT.tile, midT.tilePlaying, midT.tileCaption], end: c.s, problems: c.problems }));

  // F. the picker: open it and pick through the dialog's own buttons (as a person does), under Soft commas
  await page.evaluate(() => window.__folding.setPattern('soft'));
  const picked = [];
  for (const g of ['*442', 'xx', 'o']) {
    await page.click('#chip');
    await page.waitForTimeout(250);
    const btn = page.locator(`[data-id="${g}"], [data-group="${g}"]`).first();
    if (await btn.count()) { await btn.click(); await page.waitForTimeout(300); picked.push(await page.evaluate(() => window.__folding.getState().groupId)); }
    else { picked.push('no button for ' + g); await page.keyboard.press('Escape'); }
  }
  c = await settle(300);
  check(!c.problems.length, 'F. groups picked in the Hasse picker under Soft commas: all agree', JSON.stringify({ picked, end: c.s, problems: c.problems }));
} finally { await B.close(); }
console.log('console messages: ' + (msgs.length ? '\n  ' + msgs.slice(0, 20).join('\n  ') : 'none'));
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
