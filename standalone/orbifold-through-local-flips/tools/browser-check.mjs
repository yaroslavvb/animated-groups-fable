// browser-check.mjs — the built page, driven in Chrome: what the node tests cannot see.
//
//   node tools/browser-check.mjs                 the built site/index.html
//   node tools/browser-check.mjs --url <url>     a served or live copy (GitHub Pages, ...)
//
// It checks, in the page as a person gets it:
//   1. every entry of the page opens with no error, and its cuts are listed;
//   2. A FLIP MOVES NOTHING: the print drawn alone (no cuts, seams or marks) is the same picture before and after
//      every first flip and along a chain of six, pixel for pixel inside 0.8 of the pane;
//   3. Undo brings each earlier picture back exactly, flips and slider moves alike;
//   4. a slider moved in small steps changes the picture in small steps (the view does not jump);
//   5. the mouse: a handle of the diagram lights its cut everywhere and a click on it flips; a click on a cut drawn on
//      the pattern flips; typing a signature opens it and keeps it under "yours"; a signature with no pattern says why;
//   6. at 390 px nothing is wider than the screen, and the pattern stays in sight while the sliders pass under it.
//
// Needs Playwright and a Chrome: PLAYWRIGHT=<path to playwright/index.mjs> and CHROME=<binary>, or the defaults below.

import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt; };
const URL0 = arg('--url', pathToFileURL(path.join(here, '../site/index.html')).href);
const PW = process.env.PLAYWRIGHT || [path.join(process.env.HOME || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')].find((p) => fs.existsSync(p));
const CHROME = process.env.CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/opt/pw-browsers/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const { chromium } = PW ? await import(pathToFileURL(PW).href) : await import('playwright');

let failed = 0;
const ok = (cond, what) => { if (cond) console.log('  ok   ' + what); else { failed++; console.log('  FAIL ' + what); } };
const browser = await chromium.launch(CHROME && fs.statSync(CHROME).isFile() ? { executablePath: CHROME, headless: true } : { headless: true });

async function open(width, height, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ...opts });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL0, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__flips && window.__flips.state(), null, { timeout: 20000 });
  await page.evaluate(() => {
    const F = window.__flips;
    window.__grab = () => { const c = document.getElementById('pattern'); return c.getContext('2d').getImageData(0, 0, c.width, c.height); };
    window.__diff = (a, b, frac = 0.8, step = 1) => { const w = a.width, h = a.height, cx = w / 2, cy = h / 2, R = (Math.min(w, h) / 2) * frac; let n = 0, bad = 0; for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) { if ((x - cx) ** 2 + (y - cy) ** 2 > R * R) continue; n++; const i = 4 * (y * w + x); if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 90) bad++; } return bad / n; };
    window.__settle = () => new Promise((res) => { const t0 = performance.now(); const tick = () => { if (!F.view.state().fading && performance.now() - t0 > 120) { F.view.draw(); res(); } else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  });
  return { page, errors, ctx };
}

// ---- 1-4: the picture
{
  const { page, errors, ctx } = await open(900, 900);
  const entries = await page.evaluate(() => [...document.querySelectorAll('#presets .chip[data-k]')].map((c) => c.dataset.k));
  console.log(`\n${URL0}\n\n1. the ${entries.length} entries of the page`);
  const opened = await page.evaluate((entries) => entries.map((k) => { const done = window.__flips.open(k), s = window.__flips.state(); return { k, done, mode: s.mode, cuts: window.__flips.cuts().length, rows: document.querySelectorAll('#cuts .cut').length, tiles: window.__flips.view.state().drawn }; }), entries);
  ok(opened.every((o) => o.done && o.tiles > 0), 'each opens and draws: ' + opened.map((o) => `${o.k} ${o.mode[0]}${o.cuts}`).join(', '));
  ok(opened.every((o) => o.cuts === o.rows), 'each lists a row of sliders for every cut');
  for (const geometry of ['S', 'E', 'H']) ok(await page.evaluate((g) => [...document.querySelectorAll('#presets .chip[data-k]')].some((c) => { window.__flips.open(c.dataset.k); return window.__flips.state().cls.geometry === g; }), geometry), `an entry on the ${{ S: 'sphere', E: 'plane', H: 'hyperbolic plane' }[geometry]}`);

  console.log('\n2. a flip moves nothing');
  const withCuts = opened.filter((o) => o.cuts > 0).map((o) => o.k);
  let worst = 0, flips = 0, refusals = 0;
  for (const k of withCuts) {
    const r = await page.evaluate(async (k) => {
      const F = window.__flips, out = { first: [], chain: [], refused: 0 };
      F.open(k); F.view.setBare(true);
      const cuts = F.cuts().map((c) => ({ id: c.id, moves: c.moves.map((m) => m.kind) }));
      for (const c of cuts) for (const kind of c.moves) {
        F.open(k); await window.__settle();
        const a = window.__grab(), n = F.past();
        F.flip(c.id, kind);
        if (F.past() === n) { out.refused++; continue; }
        await window.__settle();
        out.first.push(window.__diff(a, window.__grab()));
      }
      F.open(k); await window.__settle();
      const a = window.__grab();
      for (let i = 0; i < 6; i++) {
        const cs = F.cuts().filter((c) => c.moves.length);
        if (!cs.length) break;
        const c = cs[i % cs.length], n = F.past();
        F.flip(c.id, c.moves[i % c.moves.length].kind);
        if (F.past() === n) { out.refused++; continue; }
        await window.__settle();
        out.chain.push(window.__diff(a, window.__grab()));
      }
      F.view.setBare(false);
      return out;
    }, k);
    for (const d of [...r.first, ...r.chain]) worst = Math.max(worst, d);
    flips += r.first.length + r.chain.length; refusals += r.refused;
  }
  ok(flips > 40 && worst < 0.002, `${flips} flips over ${withCuts.length} orbifolds: at worst ${(100 * worst).toFixed(2)} % of the print's pixels differ (${refusals} flips refused as too long)`);

  console.log('\n3. Undo');
  let undoWorst = 0, links = true, steps = 0;
  for (const k of withCuts) {
    const r = await page.evaluate(async (k) => {
      const F = window.__flips, imgs = [], hrefs = [], out = [];
      F.open(k); F.view.setBare(true);
      await window.__settle(); imgs.push(window.__grab()); hrefs.push(F.link());
      for (let i = 0; i < 4; i++) {
        const cs = F.cuts(), n = F.past();
        if (i % 2 === 0) { const able = cs.filter((x) => x.moves.length), c = able[(i / 2) % Math.max(1, able.length)]; if (!c) break; F.flip(c.id, c.moves[0].kind); if (F.past() === n) continue; }
        else { const c = cs[i % cs.length], el = document.getElementById(`s-${c.id}-len`); el.value = String(Math.max(0, Number(el.value) - 70)); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
        await window.__settle(); imgs.push(window.__grab()); hrefs.push(F.link());
      }
      for (let i = imgs.length - 2; i >= 0; i--) { F.undo(); await window.__settle(); out.push({ d: window.__diff(imgs[i], window.__grab()), link: F.link() === hrefs[i] }); }
      const end = { left: F.past(), off: document.getElementById('undo').disabled };
      F.view.setBare(false);
      return { out, end };
    }, k);
    for (const o of r.out) { undoWorst = Math.max(undoWorst, o.d); links = links && o.link; steps++; }
    if (r.end.left !== 0 || !r.end.off) links = false;
  }
  ok(steps > 30 && undoWorst < 0.002 && links, `${steps} steps undone: the picture and the address come back each time (at worst ${(100 * undoWorst).toFixed(2)} % of pixels differ)`);

  console.log('\n4. sliders');
  let jump = 0, moved = 0;
  for (const k of withCuts.slice(0, 8)) {
    const r = await page.evaluate(async (k) => {
      const F = window.__flips; F.open(k); F.view.setBare(true);
      const c = F.cuts()[0], out = [];
      for (const key of c.twist ? ['len', 'tw'] : ['len']) {
        F.open(k); F.view.draw();
        let prev = window.__grab(), sum = 0, top = 0;
        for (let i = 1; i <= 12; i++) { F.set(c.id, key, key === 'len' ? c.len * (1 + 0.02 * i) : 0.02 * i); F.view.draw(); const now = window.__grab(), d = window.__diff(prev, now, 0.7, 2); sum += d; top = Math.max(top, d); prev = now; }
        out.push({ mean: sum / 12, top });
      }
      F.view.setBare(false);
      return out;
    }, k);
    for (const o of r) { if (o.mean > 0.002) { moved++; jump = Math.max(jump, o.top / o.mean); } }
  }
  ok(moved > 6 && jump < 2.5, `${moved} sliders moved in 12 small steps: no step changes the picture more than ${jump.toFixed(1)} times the usual`);
  ok(errors.length === 0, 'no error on the console' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await ctx.close();
}

// ---- 5: the mouse and the keyboard
{
  console.log('\n5. mouse and keyboard, 1280 px');
  const { page, errors, ctx } = await open(1280, 900);
  await page.evaluate(() => { try { localStorage.clear(); } catch (err) { /* none */ } window.__flips.open('333*2x'); });
  const h = page.locator('#schematic .sch-handle.can').first();
  await h.hover();
  await page.waitForTimeout(150);
  const lit = await page.evaluate(() => ({ view: window.__flips.view.state().hover, rows: [...document.querySelectorAll('#cuts .cut.on')].map((e) => e.dataset.cut), sch: document.querySelectorAll('#schematic .on').length }));
  ok(lit.view && lit.rows.length === 1 && lit.rows[0] === lit.view && lit.sch >= 2, 'pointing at a handle of the diagram lights the cut on the pattern, in the diagram and in its row');
  await h.click();
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({ say: document.getElementById('say').textContent, cuts: window.__flips.cuts().map((c) => c.type), undo: !document.getElementById('undo').disabled, hash: location.hash }));
  ok(/The pattern has not moved/.test(after.say) && after.cuts.filter((t) => t === 'arc').length === 2 && after.undo, 'a click on it opens the mirror cuff into two arcs, and says so: ' + after.say);
  ok(after.hash.includes('k=333*2x') && after.hash.includes('d=') && after.hash.includes('p='), 'the address holds the cut and its numbers');
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => window.__flips.cuts().every((c) => c.type === 'cuff') && document.getElementById('undo').disabled), 'Undo from the keyboard closes them again');
  await page.evaluate(() => window.__flips.open('o33'));
  const pt = await page.evaluate(() => { const v = window.__flips.view; v.draw(); const r = document.getElementById('pattern').getBoundingClientRect(); for (let y = 80; y < r.height - 80; y += 6) for (let x = 80; x < r.width - 80; x += 6) { const id = v.cutAt(x, y, 3); if (id) return { x: r.left + x, y: r.top + y, id }; } return null; });
  await page.mouse.move(pt.x, pt.y); await page.waitForTimeout(120);
  await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(600);
  ok(await page.evaluate(() => /The pattern has not moved/.test(document.getElementById('say').textContent) && window.__flips.past() === 1), 'a click on a cut where it is drawn on the pattern flips it');
  const box = page.locator('#custom-in');
  await box.click(); await page.keyboard.type('2345'); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
  const typed = await page.evaluate(() => ({ text: window.__flips.state().text, box: document.getElementById('custom-in').value, yours: [...document.querySelectorAll('#recent-row .chip')].map((e) => e.dataset.k) }));
  ok(typed.text === '5432' && typed.box === '5432' && typed.yours.includes('5432'), 'typing 2345 opens it (spelled 5432) and keeps it under "yours"');
  await box.click(); await page.keyboard.type('23'); await page.waitForTimeout(250);
  const none = await page.evaluate(() => ({ pop: document.getElementById('custom-pop').hidden ? '' : document.getElementById('custom-pop').textContent, text: window.__flips.state().text, tries: document.querySelectorAll('#custom-pop .trylink').length }));
  ok(/no pattern/.test(none.pop) && none.tries > 0 && none.text === '5432', 'typing 23 says it has no pattern, offers the nearest that have one, and leaves what was on show');
  await page.keyboard.press('Escape');
  ok(errors.length === 0, 'no error on the console' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await ctx.close();
}

// ---- 6: a phone
{
  console.log('\n6. a phone, 390 px');
  const { page, errors, ctx } = await open(390, 844, { hasTouch: true });
  await page.evaluate(() => window.__flips.open('333*2x'));
  const wide = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: innerWidth }));
  ok(wide.doc <= wide.win, `nothing is wider than the screen (${wide.doc} px of ${wide.win})`);
  const first = await page.evaluate(() => { const r = document.getElementById('pattern').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: innerHeight }; });
  ok(first.top < first.h * 0.75, `the pattern begins on the first screen (at ${Math.round(first.top)} px of ${first.h})`);
  await page.locator('#cuts .cut').last().scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const pinned = await page.evaluate(() => { const r = document.getElementById('pattern').getBoundingClientRect(), s = document.querySelector('#cuts .cut:last-child').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, row: s.top, h: innerHeight }; });
  ok(pinned.top >= 0 && pinned.bottom < pinned.h && pinned.row > pinned.bottom - 4, 'with the last cut\'s sliders on the screen the pattern is still in sight above them');
  const handle = page.locator('#schematic .sch-handle.can').first();
  await handle.scrollIntoViewIfNeeded(); await handle.tap(); await page.waitForTimeout(600);
  ok(await page.evaluate(() => window.__flips.past() === 1), 'a tap on a handle of the diagram flips');
  ok(errors.length === 0, 'no error on the console' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await ctx.close();
}

await browser.close();
console.log(failed ? `\n${failed} check${failed === 1 ? '' : 's'} FAILED` : '\nall checks ok');
process.exit(failed ? 1 : 0);
