// dev/recut/browser-check.mjs — the pattern selector and the re-cut, in a real Chrome, on the built page (or any page):
// the selector through the native <select>, the URL (pat=), a reload, a pasted link, the words over the fold pane, a
// play to the end, the colours that reach the screen, the idle making of the other groups' prints (made after the load,
// held back while Fold plays and while the page is hidden; 15 Nov 2026), a phone.
//   node dev/recut/browser-check.mjs [--page dist/index.html] [--out <dir for pictures>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..');
const pagePath = opt.page || 'dist/index.html', outDir = opt.out ? path.resolve(opt.out) : null;
if (outDir) fs.mkdirSync(outDir, { recursive: true });

let failed = 0, passed = 0;
const check = (ok, what, detail = '') => { if (ok) passed++; else failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${detail ? '  — ' + detail : ''}`); };

const B = await openBrowser({ root });
try {
  const ctx = await B.browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  let errors = 0;
  page.on('console', (m) => { if (m.type() === 'error') { errors++; console.log('CONSOLE ERROR', m.text()); } });
  page.on('pageerror', (e) => { errors++; console.log('PAGE ERROR', e.message); });
  const ready = () => page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 20000 }).then(() => page.evaluate(() => window.__folding.ready));
  const state = () => page.evaluate(() => { const s = window.__folding.getState(); return { g: s.groupId, pattern: s.pattern, print: s.print, cut: s.cut, t: s.t, recut: s.recut, caption: s.foldCaption, url: s.url, hash: s.hash, seamGap: s.seamGap, errors: s.errors, playing: s.playing }; });
  const shot = async (name) => { if (outDir) await page.screenshot({ path: path.join(outDir, name + '.png') }); };
  /** Shares of the fold canvas near each of the given colours (0..255 triples), read from a screenshot of the pane. */
  const colours = async (cols, tol = 26) => {
    const box = await page.locator('#fold-canvas').boundingBox();
    const png = await page.screenshot({ clip: box });
    return page.evaluate(async ([b64, cs, tl]) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const g = cv.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, cv.width, cv.height).data, n = d.length / 4, out = cs.map(() => 0);
      for (let i = 0; i < d.length; i += 4) cs.forEach((c, k) => { if (Math.abs(d[i] - c[0]) < tl && Math.abs(d[i + 1] - c[1]) < tl && Math.abs(d[i + 2] - c[2]) < tl) out[k]++; });
      return out.map((v) => v / n);
    }, [png.toString('base64'), cols, tol]);
  };

  await page.goto(B.url(pagePath) + '#g=2222', { waitUntil: 'load' });
  await ready();
  let s = await state();
  // (since the pattern round of 14 Nov 2026 the default is Paisley; it was the checkerboard)
  check(s.pattern === 'paisley' && s.print === 'paisley', 'a fresh page shows Paisley', JSON.stringify([s.pattern, s.print]));
  check(await page.evaluate(() => document.getElementById('app').getAttribute('data-pattern') === 'paisley' && document.getElementById('app').getAttribute('data-print') === 'shapes' && document.getElementById('pattern').value === 'paisley' && document.getElementById('pattern-label').textContent === 'Paisley'), 'the selector shows it');
  check(!/pat=/.test(s.url), 'the default pattern is not in the URL', s.url);
  check(await page.evaluate(() => [...document.querySelectorAll('#pattern option')].map((o) => o.value).join() === 'paisley,soft,tomoe,checker,rings,comma'), 'the selector lists the six in order');
  // the flat paper: both tones of the front on screen (the shader's print, lit: looser match), none of the back
  await page.evaluate(() => window.__folding.setView(0, 89.5));
  await page.waitForTimeout(250);
  let c = await colours([[154, 213, 204], [79, 163, 151], [245, 230, 198], [216, 189, 133]], 42);
  check(c[0] > 0.03 && c[1] > 0.03, 'the flat sheet shows the two teal tones of the front', c.map((v) => v.toFixed(3)).join(' '));
  await shot('check-2222-flat');
  await page.evaluate(() => { window.__folding.resetView(); window.__folding.setT(1); });
  await page.waitForTimeout(300);
  c = await colours([[154, 213, 204], [79, 163, 151], [245, 230, 198], [216, 189, 133]], 48);
  check(c[2] + c[3] > 0.03, 'folded, the pillow shows the paper\'s back (sand)', c.map((v) => v.toFixed(3)).join(' '));
  await shot('check-2222-folded');

  // the native select
  await page.selectOption('#pattern', 'rings');
  await page.waitForTimeout(350);
  s = await state();
  check(s.pattern === 'rings' && s.print === 'rings' && s.t === 1, 'choosing Rings in the selector changes the print and keeps t', JSON.stringify([s.pattern, s.print, s.t]));
  check(/[#&]pat=rings(&|$)/.test(s.hash), 'the address carries pat=rings', s.hash);
  await page.selectOption('#pattern', 'comma');
  await page.waitForTimeout(350);
  s = await state();
  // the Comma is a print since 14 Nov 2026 (the owner's page comment 88289462: the checkerboard's two shades for all)
  check(s.pattern === 'comma' && s.print === 'comma' && /pat=comma/.test(s.hash), 'Comma: a print in the paper\'s two shades, pat=comma', JSON.stringify([s.print, s.hash]));
  c = await colours([[154, 213, 204], [79, 163, 151], [245, 230, 198], [216, 189, 133]], 48);
  check(c[2] + c[3] > 0.03, 'the Comma on the folded pillow: the paper\'s back (sand)', c.map((v) => v.toFixed(3)).join(' '));
  await shot('check-2222-comma');
  // the three new patterns through the select, and an old name in a link
  for (const [key, label] of [['soft', 'Soft commas'], ['tomoe', 'Tomoe'], ['paisley', 'Paisley']]) {
    await page.selectOption('#pattern', key);
    await page.waitForTimeout(300);
    s = await state();
    const shown = await page.evaluate(() => [document.getElementById('pattern-label').textContent, document.getElementById('app').getAttribute('data-print')]);
    check(s.pattern === key && s.print === key && shown[0] === label && shown[1] === 'shapes', `${label}: a shape print, its name in the pill`, JSON.stringify([s.pattern, s.print, shown]));
  }
  await page.selectOption('#pattern', 'comma');
  await page.waitForTimeout(300);
  // a reload keeps the pattern
  await page.reload({ waitUntil: 'load' });
  await ready();
  s = await state();
  check(s.pattern === 'comma' && s.g === '2222' && s.t === 1, 'a reload brings the pattern back', JSON.stringify([s.g, s.pattern, s.t]));
  // a link of the pattern round that names Soft commas by its design folder; a link of the checkerboard
  for (const [h, want] of [['#g=333&pat=blobs', 'soft'], ['#g=333&pat=checker', 'checker'], ['#g=333&pat=nosuch', 'paisley']]) {
    await page.goto(B.url(pagePath) + h, { waitUntil: 'load' });
    await page.reload({ waitUntil: 'load' });
    await ready();
    s = await state();
    check(s.pattern === want && s.g === '333', `the link ${h} opens ${want}`, JSON.stringify([s.g, s.pattern, s.hash]));
  }
  await page.goto(B.url(pagePath) + '#g=2222&pat=comma&t=1', { waitUntil: 'load' });
  await page.reload({ waitUntil: 'load' });
  await ready();
  // the keyboard: the select is a real control in the tab order, and the pill shows where the focus is
  await page.focus('#pattern');
  const foc = await page.evaluate(() => ({ active: document.activeElement && document.activeElement.id, tab: document.getElementById('pattern').tabIndex,
    ring: getComputedStyle(document.querySelector('#pattern-box > .pat-pill')).outlineStyle, name: document.getElementById('pattern').getAttribute('aria-label') }));
  check(foc.active === 'pattern' && foc.tab === 0 && foc.ring === 'solid' && /Pattern/.test(foc.name), 'the selector is a native control: focusable, labelled, with a focus ring on its pill', JSON.stringify(foc));
  await page.selectOption('#pattern', 'checker');
  await page.waitForTimeout(300);

  // a pasted link: a re-cut cut of 22x, rings, half way
  await page.goto(B.url(pagePath) + '#g=22x&pat=rings&cut=2&t=0.15', { waitUntil: 'load' });
  await page.reload({ waitUntil: 'load' });
  await ready();
  s = await state();
  check(s.g === '22x' && s.pattern === 'rings' && s.cut === 2 && Math.abs(s.t - 0.15) < 1e-9, 'a pasted link: group, pattern, cut and t', JSON.stringify([s.g, s.pattern, s.cut, s.t]));
  check(s.recut && s.recut.home === 'Pocket' && s.recut.movers >= 2, 'the Hexagon of 22x is re-cut into the Pocket', JSON.stringify(s.recut && [s.recut.home, s.recut.movers, s.recut.tau0]));
  check(/^re-cut, piece \d of \d: /.test(s.caption), 'the words over the fold pane say which piece moves', s.caption);
  check(await page.evaluate(() => (document.getElementById('app').getAttribute('data-features') || '').split(' ').includes('recut')), '#app[data-features] names the re-cut');
  await shot('check-22x-recut');
  await page.selectOption('#pattern', 'checker');
  await page.evaluate(() => window.__folding.setT(0));
  await page.waitForTimeout(300);
  s = await state();
  check(/re-cuts the tile into the Pocket/.test(s.caption), 'flat: the words say what Fold will do', s.caption);
  // play to the end with the real button
  await page.click('#fold-btn');
  await page.waitForFunction(() => !window.__folding.getState().playing && window.__folding.getState().t >= 1, null, { timeout: 30000 });
  s = await state();
  check(s.t === 1 && s.seamGap < 1e-6 && s.caption === '', 'Fold plays the re-cut and the fold to the end: seams closed, no words left', JSON.stringify([s.t, s.seamGap, s.caption]));
  await shot('check-22x-closed');
  // the home cut needs no re-cut
  await page.evaluate(() => { window.__folding.setPreset(0); window.__folding.setT(0.3); });
  await page.waitForTimeout(250);
  s = await state();
  check(s.recut === null && s.caption === '', 'the Pocket itself: no re-cut, no words', JSON.stringify([s.recut, s.caption]));
  // xx
  await page.evaluate(() => { window.__folding.setGroup('xx'); window.__folding.setPreset(1); window.__folding.setT(0.1); });
  await page.waitForTimeout(300);
  s = await state();
  check(s.recut && s.recut.home === 'Rectangle' && /^re-cut, piece/.test(s.caption), 'the Hexagon of xx is re-cut into the Rectangle', JSON.stringify([s.recut && s.recut.home, s.caption]));
  // a drag in the plane while half-way keeps working (the re-cut is rebuilt per frame)
  const box = await page.locator('#plane-canvas').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 25, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  s = await state();
  check(s.errors === 0 && s.recut && s.recut.movers >= 1, 'dragging the cut of a re-cut tile rebuilds it without an error', JSON.stringify([s.errors, s.recut && s.recut.movers]));

  // the idle making of the other groups' prints (src/patterns/warm.js; the review of 15 Nov 2026: nothing tested the
  // page's wiring of it — a rebuild that never told the warmer, frames that never poked it, kept every test green)
  await page.goto(B.url(pagePath) + '#g=2222', { waitUntil: 'load' });
  await page.reload({ waitUntil: 'load' });
  await ready();
  const warm = () => page.evaluate(() => window.__folding.getState().warm);
  // (polled every 100 ms: Playwright's default polls on every animation frame, and a page that draws frames gets no
  // idle slot long enough for a print — the warmer would wait out the whole poll)
  const warmDone = (key) => page.waitForFunction((k) => { const w = window.__folding.getState().warm; return w.key === k && w.left === 0; }, key, { timeout: 30000, polling: 100 }).then(warm, warm);
  let w = await warmDone('paisley');
  check(w.key === 'paisley' && w.left === 0 && w.made === 16 && w.errors.length === 0, 'after the load the 16 other groups\' Paisley prints are made while the page is idle, one per slot', JSON.stringify(w));
  // a play draws a frame after another: every frame pokes the warmer, so nothing is made while it plays; the rest after
  await page.evaluate(() => { window.__folding.setT(0); window.__folding.setPattern('soft'); window.__folding.play(); });
  await page.waitForTimeout(1300);
  const during = await page.evaluate(() => ({ playing: window.__folding.getState().playing, warm: window.__folding.getState().warm }));
  check(during.playing && during.warm.key === 'soft' && during.warm.made === w.made && during.warm.left === 16, 'while Fold plays (1.3 s in), no print is made: the frames keep the warmer back', JSON.stringify(during));
  await page.waitForFunction(() => !window.__folding.getState().playing, null, { timeout: 30000, polling: 100 });
  const w2 = await warmDone('soft');
  check(w2.made === w.made + 16 && w2.errors.length === 0, 'once the play is over, the 16 other groups\' Soft commas prints are made', JSON.stringify(w2));
  // a frame drawn now and then with idle time between (the fold drawn again at the same t every 250 ms, no input; a
  // play's frames come too fast for an idle slot anyway): each frame pokes the warmer — drawFold does, and the renderer's
  // change listener does when it draws (each pokes once per redraw: either alone holds the warmer back) — so it waits
  // out QUIET_MS again every time
  const framed = await page.evaluate(() => new Promise((resolve) => {
    const F = window.__folding;
    F.setT(0.5);
    F.setPattern('comma');
    const m0 = F.getState().warm.made, d0 = F.counters.draws;
    let k = 0;
    const id = setInterval(() => { F.setT(0.5); if (++k === 8) { clearInterval(id); resolve({ m0, draws: F.counters.draws - d0, w: F.getState().warm }); } }, 250);
  }));
  check(framed.w.key === 'comma' && framed.draws >= 8 && framed.w.made === framed.m0 && framed.w.left === 16, 'a frame drawn every 250 ms for 2 s (no input, nothing moving): no print is made — every drawn frame pokes the warmer', JSON.stringify(framed));
  const wc = await warmDone('comma');
  check(wc.made === framed.m0 + 16 && wc.errors.length === 0, '... and the Comma\'s 16 are made once the frames stop', JSON.stringify(wc));
  // a hidden page (another tab in front) makes nothing; shown again, it goes on (the review of 15 Nov 2026)
  await page.evaluate(() => {
    window.__setHidden = (h) => {
      Object.defineProperty(document, 'hidden', { value: h, configurable: true });
      Object.defineProperty(document, 'visibilityState', { value: h ? 'hidden' : 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    window.__setHidden(true);
    window.__folding.setPattern('tomoe');
  });
  await page.waitForTimeout(1500);
  const hiddenW = await warm();
  check(hiddenW.key === 'tomoe' && hiddenW.made === wc.made && hiddenW.left === 16, 'hidden: the Tomoe prints of the other groups wait (1.5 s, nothing made)', JSON.stringify(hiddenW));
  await page.evaluate(() => window.__setHidden(false));
  const w3 = await warmDone('tomoe');
  check(w3.made === wc.made + 16 && w3.errors.length === 0, 'shown again: they are made', JSON.stringify(w3));
  console.log(`  (the warmer's longest slot in this page: ${w3.maxMs} ms; ${w3.slots} slots used, ${w3.passed} passed over)`);
  check(errors === 0, 'no console error, no page error', String(errors));

  // a phone: the header holds the selector, nothing overflows, the tap target is 44 px
  const phone = await B.browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const pp = await phone.newPage();
  let perr = 0;
  pp.on('pageerror', () => { perr++; });
  await pp.goto(B.url(pagePath) + '#g=22x&cut=2&t=0.1', { waitUntil: 'load' });
  await pp.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 20000 });
  await pp.waitForTimeout(400);
  const m = await pp.evaluate(() => {
    const r = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; };
    return { box: r('pattern-box'), chip: r('chip'), hdr: r('header'), cap: r('fold-caption'), capText: document.getElementById('fold-caption').textContent, pane: r('pane-fold'),
      scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, scrollH: document.documentElement.scrollHeight, innerH: window.innerHeight,
      label: getComputedStyle(document.getElementById('pattern-label')).display };
  });
  check(m.scrollW <= m.innerW && m.scrollH <= m.innerH, 'phone: nothing scrolls', `${m.scrollW} x ${m.scrollH} in ${m.innerW} x ${m.innerH}`);
  check(m.box[2] >= 44 && m.box[3] >= 44 && m.box[0] + m.box[2] <= m.innerW + 0.5 && m.box[0] >= m.chip[0] + m.chip[2] - 0.5, 'phone: the selector is a 44 px target at the right of the header, clear of the orbifold chip', JSON.stringify([m.box, m.chip]));
  check(m.label === 'none', 'phone: the swatch alone (the name is hidden)');
  check(/^re-cut \d\/\d: /.test(m.capText) && m.cap[0] >= m.pane[0] && m.cap[0] + m.cap[2] <= m.pane[0] + m.pane[2] + 0.5 && m.cap[3] <= 26, 'phone: the short words fit the fold pane on one line', JSON.stringify([m.capText, m.cap]));
  if (outDir) await pp.screenshot({ path: path.join(outDir, 'check-phone-22x.png') });
  check(perr === 0, 'phone: no page error');
} finally { await B.close(); }
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
