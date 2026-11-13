// dev/recut/browser-check.mjs — the pattern selector and the re-cut, in a real Chrome, on the built page (or any page):
// the selector through the native <select>, the URL (pat=), a reload, a pasted link, the words over the fold pane, a
// play to the end, the colours that reach the screen, a phone.
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
  check(s.pattern === 'checker' && s.print === 'checks', 'a fresh page shows the checkerboard', JSON.stringify([s.pattern, s.print]));
  check(await page.evaluate(() => document.getElementById('app').getAttribute('data-pattern') === 'checker' && document.getElementById('pattern').value === 'checker' && document.getElementById('pattern-label').textContent === 'Checkerboard'), 'the selector shows it');
  check(!/pat=/.test(s.url), 'the default pattern is not in the URL', s.url);
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
  check(s.pattern === 'comma' && s.print === null && /pat=comma/.test(s.hash), 'Comma: no print, pat=comma', s.hash);
  await shot('check-2222-comma');
  // a reload keeps the pattern
  await page.reload({ waitUntil: 'load' });
  await ready();
  s = await state();
  check(s.pattern === 'comma' && s.g === '2222' && s.t === 1, 'a reload brings the pattern back', JSON.stringify([s.g, s.pattern, s.t]));
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
