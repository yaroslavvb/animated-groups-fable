#!/usr/bin/env node
// live-check.mjs — the deployed page on the REAL spacesheep viewer, for the round of 15 Nov 2026 (notes/unify.md):
//   the owner's link #g=%2A632   the tile is the surface: Fold gathers the pattern onto it and has nothing left; Tile
//                                lays the pattern again; one row holds Fold, the scrubber and the Unfold / Tile button
//   a group with a zipper (o)    Fold goes from the pattern to the surface; Unfold stops at the flat tile; Tile goes on;
//                                the address bar of the viewer follows (t=1, tile=0, nothing)
//   no crystallographic name     for all 17 groups: the chip, its tooltip, the caption, the canvases' names, the picker
//   the Classification page      the caption's first words are a link to the matching part of
//                                https://spacesheep.dev/@yaroslavvb/classification-of-surfaces, and a click opens it there
//   a phone                      the same row, nothing cut
//   node dev/unify/live-check.mjs [--out <dir>] [--base https://spacesheep.dev/@yaroslavvb/the-folding]
//   node dev/unify/live-check.mjs --local 1          the built page (dist/index.html) without the viewer: a dry run
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..');
const LOCAL = !!opt.local;
const SURFACES = 'https://spacesheep.dev/@yaroslavvb/classification-of-surfaces';
const outDir = opt.out ? path.resolve(opt.out) : null;
if (outDir) fs.mkdirSync(outDir, { recursive: true });
let failed = 0, passed = 0;
const check = (ok, what, detail = '') => { if (ok) passed++; else failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${detail ? '  — ' + detail : ''}`); };
// the 17 Hermann–Mauguin names, long and short, as words of their own
const HM = /(^|[^A-Za-z0-9])(p1|p2|pm|pg|cm|pmm|p2mm|pmg|p2mg|pgg|p2gg|cmm|c2mm|p4|p4m|p4mm|p4g|p4gm|p3|p3m1|p31m|p6|p6m|p6mm)(?![A-Za-z0-9])/;

const B = await openBrowser(LOCAL ? { root } : undefined);
const BASE = LOCAL ? B.url('dist/index.html') : (opt.base || 'https://spacesheep.dev/@yaroslavvb/the-folding');
/** The frame the app runs in: the viewer's iframe, or the page itself (--local). */
async function appFrame(page) {
  for (let i = 0; i < 200; i++) {
    for (const f of page.frames()) {
      try { if (await f.evaluate(() => !!(window.__folding && window.__folding.ready))) return f; } catch { /* loading */ }
    }
    await page.waitForTimeout(200);
  }
  throw new Error('no app frame');
}
const stateOf = (f) => f.evaluate(() => {
  const s = window.__folding.getState(), id = (x) => document.getElementById(x);
  return { g: s.groupId, t: +s.t.toFixed(4), tile: +s.tile.toFixed(4), j: +s.journey.toFixed(4), stop: s.journeyStop, fold: s.button, next: s.nextButton, playing: s.playing, going: s.going, errors: s.errors,
    foldDisabled: id('fold-btn').disabled, chip: id('chip-symbol').textContent + ' ' + id('chip-meta').textContent, caption: id('caption').textContent };
});
const idle = async (f, page) => { await f.waitForFunction(() => { const s = window.__folding.getState(); return !s.playing && !s.going; }, null, { timeout: 40000 }); await page.waitForTimeout(120); return stateOf(f); };

try {
  // ---- the owner's link: *632 ------------------------------------------------------------------------------------
  const ctx = await B.browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  let errors = 0;
  page.on('pageerror', (e) => { errors++; console.log('PAGE ERROR', e.message); });
  await page.goto(BASE + '#g=%2A632', { waitUntil: 'load' });
  const f = await appFrame(page);
  await page.waitForTimeout(800);
  let s = await stateOf(f);
  const build = await f.evaluate(() => ({ next: !!document.getElementById('next-btn'), bar: !!document.getElementById('tile-bar') || !!document.getElementById('tile-btn'), journey: document.getElementById('scrub').classList.contains('scrub-journey') }));
  check(build.next && !build.bar && build.journey, 'it is the build of 15 Nov: one scrubber with a button at either end, no Tile bar in the plane pane', JSON.stringify(build));
  check(s.g === '*632' && s.stop === 'pattern' && s.fold === 'Fold' && !s.foldDisabled && s.next === 'Tile' && s.errors === 0, '#g=*632 opens at the pattern: Fold and Tile', JSON.stringify(s));
  check(s.chip === '∗632 disk' && s.caption === 'a punched sphere; its rim is a mirror with corners of order 6, 3, 2', '*632 is named as Conway names it: a disk — a punched sphere whose rim is a mirror', `${s.chip} / ${s.caption}`);
  const row = await f.evaluate(() => { const r = (x) => { const b = document.getElementById(x).getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; }; return { fold: r('fold-btn'), scrub: r('scrub'), next: r('next-btn') }; });
  const oneRow = (r) => r.fold[2] <= r.scrub[0] && r.scrub[2] <= r.next[0] && Math.abs(r.fold[1] - r.next[1]) <= 2 && r.scrub[1] < r.fold[3] && r.scrub[3] > r.fold[1];
  check(oneRow(row), 'Fold, the scrubber and the Tile button stand in one row, in that order', JSON.stringify(row));
  if (outDir) await page.screenshot({ path: path.join(outDir, 'live-s632-pattern.png') });
  await f.click('#fold-btn');
  s = await idle(f, page);
  check(s.stop === 'tile' && s.j === 0 && s.t === 0 && s.tile === 0 && s.foldDisabled && s.next === 'Tile', '*632: Fold gathers the pattern onto the tile, which is the surface; Fold has nothing left', JSON.stringify(s));
  await page.waitForTimeout(1200);
  check(/[#&]tile=0(&|$)/.test(page.url()) || LOCAL, 'the address bar of the viewer follows (tile=0)', page.url());
  if (outDir) await page.screenshot({ path: path.join(outDir, 'live-s632-tile.png') });
  await f.click('#next-btn');
  await page.waitForTimeout(1500);
  if (outDir) await page.screenshot({ path: path.join(outDir, 'live-s632-tiling.png') });
  s = await idle(f, page);
  check(s.stop === 'pattern' && s.tile === 1 && !s.foldDisabled, '*632: Tile lays the pattern again', JSON.stringify(s));

  // ---- a group with a zipper: the torus --------------------------------------------------------------------------
  await f.evaluate(() => { window.__folding.setGroup('o'); window.__folding.flushHash(); });
  await page.waitForTimeout(500);
  s = await stateOf(f);
  check(s.g === 'o' && s.stop === 'pattern' && s.chip === '○ torus' && s.caption === 'a sphere with a handle; no cone points, no mirrors', 'o: a torus — a sphere with a handle', `${s.chip} / ${s.caption}`);
  await f.click('#fold-btn');
  s = await idle(f, page);
  await page.waitForTimeout(1200);
  check(s.stop === 'surface' && s.t === 1 && s.tile === 0 && s.foldDisabled && s.next === 'Unfold' && (LOCAL || /[#&]t=1(&|$)/.test(page.url())), 'o: Fold goes from the pattern to the surface; the other button reads Unfold; the address says t=1', `${JSON.stringify(s)} ${page.url()}`);
  if (outDir) await page.screenshot({ path: path.join(outDir, 'live-o-surface.png') });
  await f.click('#next-btn');
  s = await idle(f, page);
  await page.waitForTimeout(1200);
  check(s.stop === 'tile' && s.t === 0 && s.tile === 0 && s.next === 'Tile' && (LOCAL || /[#&]tile=0(&|$)/.test(page.url())), 'o: Unfold stops at the flat tile; the same button now reads Tile', `${JSON.stringify(s)} ${page.url()}`);
  await f.click('#next-btn');
  s = await idle(f, page);
  await page.waitForTimeout(1200);
  check(s.stop === 'pattern' && s.tile === 1 && (LOCAL || !/tile=|[#&]t=/.test(page.url())), 'o: Tile goes on to the pattern; the address is bare again', `${JSON.stringify(s)} ${page.url()}`);

  // ---- no crystallographic name, anywhere, for any group -----------------------------------------------------------
  const words = await f.evaluate(async () => {
    const F = window.__folding, out = [];
    const texts = () => {
      const app = document.getElementById('app'), parts = [app.innerText];
      for (const n of app.querySelectorAll('[title], [aria-label]')) parts.push(n.getAttribute('title') || '', n.getAttribute('aria-label') || '');
      return parts.join(' \n ');
    };
    for (const g of ['o', '2222', '**', 'xx', '*x', '333', '22x', '22*', '*2222', '2*22', '442', '632', '3*3', '*333', '4*2', '*442', '*632']) {
      F.setGroup(g);
      const a = document.querySelector('#caption a.cap-link');
      out.push({ g, text: texts(), meta: document.getElementById('chip-meta').textContent, link: a ? a.getAttribute('href') : null, linkText: a ? a.textContent : null });
    }
    // the picker
    document.getElementById('chip').click();
    await new Promise((r) => setTimeout(r, 600));
    const mount = document.getElementById('picker-mount');
    const parts = [mount.innerText];
    for (const n of mount.querySelectorAll('[title], [aria-label]')) parts.push(n.getAttribute('title') || '', n.getAttribute('aria-label') || '');
    for (const n of mount.querySelectorAll('svg text, svg title')) parts.push(n.textContent);
    const picker = parts.join(' \n ');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return { groups: out, picker };
  });
  const hmIn = words.groups.filter((w) => HM.test(w.text)).map((w) => `${w.g}: ${(w.text.match(HM) || [])[2]}`);
  check(words.groups.length === 17 && hmIn.length === 0, 'no crystallographic name in the page for any of the 17 groups (text, tooltips, labels)', hmIn.join(', '));
  check(words.picker.length > 40 && !HM.test(words.picker), 'nor in the picker', (words.picker.match(HM) || []).slice(2, 3).join(''));
  const SURF = { sphere: 4, disk: 8, torus: 1, annulus: 1, 'Möbius band': 1, 'Klein bottle': 1, 'projective plane': 1 };
  const tally = {}; for (const w of words.groups) tally[w.meta] = (tally[w.meta] || 0) + 1;
  check(JSON.stringify(Object.entries(tally).sort()) === JSON.stringify(Object.entries(SURF).sort()), 'each chip names the surface plainly: 8 disks, 4 spheres, torus, annulus, Möbius band, Klein bottle, projective plane', JSON.stringify(tally));
  const AT = { o: 'name&k=torus', '**': 'name&k=annulus', xx: 'name&k=klein', '*x': 'name&k=mobius', '22x': 'zip&kind=crosscap', 2222: 'tidy', '*632': 'name&k=disk', '3*3': 'name&k=disk' };
  const wrong = words.groups.filter((w) => !w.link || !w.link.startsWith(SURFACES + '#') || (AT[w.g] && w.link !== SURFACES + '#' + AT[w.g])).map((w) => `${w.g}: ${w.link}`);
  check(wrong.length === 0, 'every caption opens with a link into the Classification of Surfaces page, at its matching part', wrong.join(', '));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // ---- the link, clicked: *x is "a punched crosscap", the Möbius band of the page's examples -----------------------
  await f.evaluate(() => { window.__folding.setGroup('*x'); window.__folding.flushHash(); });
  await page.waitForTimeout(400);
  if (outDir) await page.screenshot({ path: path.join(outDir, 'live-sx-pattern.png') });
  if (!LOCAL) {
    let pop = null;
    try { [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 10000 }), f.click('#caption a.cap-link')]); } catch (e) { console.log('no new page:', e.message.split('\n')[0]); }
    check(!!pop, 'a click on "a punched crosscap" opens a new page');
    if (pop) {
      await pop.waitForLoadState('load').catch(() => {});
      await pop.waitForTimeout(3500);
      const url = pop.url();
      check(url.startsWith(SURFACES) && /#name&k=mobius$/.test(url), 'it is the Classification of Surfaces page, at the Möbius band', url);
      let tab = null;
      for (let i = 0; i < 40 && !tab; i++) {
        for (const fr of pop.frames()) {
          try { const t = await fr.evaluate(() => { const b = document.querySelector('[role="tab"][aria-selected="true"]'); return b ? { tab: b.dataset.tab, hash: location.hash } : null; }); if (t) { tab = t; break; } } catch { /* loading */ }
        }
        if (!tab) await pop.waitForTimeout(250);
      }
      check(!!tab && tab.tab === 'name' && /k=mobius/.test(tab.hash), 'that page shows its example of the Möbius band (tab 4)', JSON.stringify(tab));
      if (outDir) await pop.screenshot({ path: path.join(outDir, 'live-surfaces-mobius.png') });
      await pop.close();
    }
  }
  check(errors === 0, 'no page error', String(errors));

  // ---- a phone ---------------------------------------------------------------------------------------------------------
  const pp = await (await B.browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  await pp.goto(BASE + '#g=%2A632', { waitUntil: 'load' });
  const f2 = await appFrame(pp);
  await pp.waitForTimeout(1200);
  let p = await stateOf(f2);
  const prow = await f2.evaluate(() => { const r = (x) => { const b = document.getElementById(x).getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; }; const cut = (x) => { const n = document.getElementById(x); return n.scrollWidth > n.clientWidth + 1; };
    return { fold: r('fold-btn'), scrub: r('scrub'), next: r('next-btn'), cut: cut('fold-btn') || cut('next-btn') || cut('chip-meta'), wide: document.documentElement.scrollWidth - innerWidth }; });
  check(p.g === '*632' && p.stop === 'pattern' && oneRow(prow) && !prow.cut && prow.wide <= 0, 'phone: the same row, nothing cut, the page does not scroll sideways', JSON.stringify(prow));
  if (outDir) await pp.screenshot({ path: path.join(outDir, 'live-phone-s632-pattern.png') });
  await f2.tap('#fold-btn');
  p = await idle(f2, pp);
  check(p.stop === 'tile' && p.foldDisabled && p.next === 'Tile', 'phone: a tap on Fold gathers the pattern onto the tile', JSON.stringify(p));
  if (outDir) await pp.screenshot({ path: path.join(outDir, 'live-phone-s632-tile.png') });
  await f2.tap('#next-btn');
  await pp.waitForTimeout(1600);
  if (outDir) await pp.screenshot({ path: path.join(outDir, 'live-phone-s632-tiling.png') });
  p = await idle(f2, pp);
  check(p.stop === 'pattern', 'phone: a tap on Tile lays the pattern again', JSON.stringify(p));
} finally { await B.close(); }
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
