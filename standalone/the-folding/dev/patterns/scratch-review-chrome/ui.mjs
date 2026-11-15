// scratch-review-chrome/ui.mjs — the shell of the BUILT page as the owner meets it, in Chrome: the default (no hash, no
// pat), the selector through the native <select> on a laptop and a phone (390 x 780, dpr 3), the swatch shown per
// pattern (and that it is the only one shown), the pill's name, the box's title, the legend's paper item, the URL round
// trip (a fresh page from the written hash, a reload, a hashchange), old names, console messages. Pictures of the pill
// per pattern (laptop dpr 2, phone dpr 3) and a strip of the six swatches side by side.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-review-chrome/ui.mjs --out <dir> [--page dist/index.html]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const pagePath = opt.page || 'dist/index.html', outDir = path.resolve(opt.out || '.');
fs.mkdirSync(outDir, { recursive: true });
const PATS = [['paisley', 'Paisley'], ['soft', 'Soft commas'], ['tomoe', 'Tomoe'], ['checker', 'Checkerboard'], ['rings', 'Rings'], ['comma', 'Comma']];
let failed = 0, passed = 0;
const check = (ok, what, detail = '') => { if (ok) passed++; else failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${detail ? '  — ' + detail : ''}`); };
const B = await openBrowser({ root });
const allMsgs = [];
const watch = (page, tag) => {
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { allMsgs.push(`${tag} ${m.type()}: ${m.text()}`); } });
  page.on('pageerror', (e) => allMsgs.push(`${tag} pageerror: ${e.message}`));
};
const ready = async (page) => { await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 }); return page.evaluate(() => window.__folding.ready); };
const shell = (page) => page.evaluate(() => {
  const app = document.getElementById('app'), sel = document.getElementById('pattern');
  const shown = [...document.querySelectorAll('.pat-sw')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => [...e.classList].find((c) => c.startsWith('pat-sw-')));
  const paper = document.querySelector('.lg[data-paper]'), pr = paper.getBoundingClientRect();
  const lbl = document.getElementById('pattern-label');
  return { pattern: app.getAttribute('data-pattern'), print: app.getAttribute('data-print'), value: sel.value, options: [...sel.options].map((o) => o.value + ':' + o.textContent).join(','),
    label: lbl.textContent, labelShown: getComputedStyle(lbl).display !== 'none', swatches: shown, title: document.getElementById('pattern-box').title,
    paper: getComputedStyle(paper).display !== 'none' && pr.width > 0 ? paper.textContent.replace(/\s+/g, ' ').trim() : null, hash: location.hash,
    scrollW: document.documentElement.scrollWidth, innerW: innerWidth };
});
try {
  // ---- a laptop: the page with no hash at all ------------------------------------------------------------------
  const lap = await B.browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const page = await lap.newPage();
  watch(page, 'laptop');
  await page.goto(B.url(pagePath), { waitUntil: 'load' });
  await ready(page);
  await page.waitForTimeout(300);
  let s = await page.evaluate(() => window.__folding.getState());
  let sh = await shell(page);
  check(s.groupId === '333' && s.pattern === 'paisley' && s.print === 'paisley' && s.printKind === 'shapes', 'no hash: the page opens on 333 with Paisley', JSON.stringify([s.groupId, s.pattern, s.print, s.printKind]));
  check(!/pat=/.test(s.hash) && !/pat=/.test(s.url), 'no hash: no pat= written', s.hash);
  check(sh.pattern === 'paisley' && sh.value === 'paisley' && sh.label === 'Paisley' && sh.swatches.join() === 'pat-sw-paisley' && sh.labelShown, 'no hash: the pill shows Paisley (one swatch, its name)', JSON.stringify(sh));
  check(sh.options === 'paisley:Paisley,soft:Soft commas,tomoe:Tomoe,checker:Checkerboard,rings:Rings,comma:Comma', 'the six options in order', sh.options);
  check(!!sh.paper, 'the legend shows the paper item under Paisley', String(sh.paper));
  await page.screenshot({ path: path.join(outDir, 'laptop-default.png') });
  // the six through the native select
  for (const [key, label] of PATS) {
    await page.selectOption('#pattern', key);
    await page.waitForTimeout(350);
    s = await page.evaluate(() => window.__folding.getState());
    sh = await shell(page);
    const wantHash = key === 'paisley' ? !/pat=/.test(sh.hash) : new RegExp(`[#&]pat=${key}(&|$)`).test(sh.hash);
    check(s.pattern === key && s.print && sh.pattern === key && sh.print && sh.label === label && sh.swatches.join() === 'pat-sw-' + key && wantHash && !!sh.paper && sh.title.startsWith('Pattern: ' + label),
      `laptop: ${label} through the select (swatch, name, title, data-print, hash, paper)`, JSON.stringify({ print: s.print, kind: sh.print, sw: sh.swatches, hash: sh.hash, paper: sh.paper, title: sh.title.slice(0, 60) }));
    const box = await page.locator('#header').boundingBox();
    await page.screenshot({ path: path.join(outDir, `laptop-hdr-${key}.png`), clip: { x: box.x + box.width - 330, y: box.y, width: 330, height: box.height } });
  }
  // the URL round trip: each pattern on *x at t = 0.4 with a view, a fresh page from the written hash, then a reload
  for (const [key] of PATS) {
    await page.evaluate((k) => { const F = window.__folding; F.setGroup('*x'); F.setPattern(k); F.setPreset(1); F.setT(0.4); F.setView(30, 25, 1.2); F.flushHash(); }, key);
    await page.waitForTimeout(200);
    const h = await page.evaluate(() => location.hash);
    const p2 = await lap.newPage();
    watch(p2, 'roundtrip');
    await p2.goto(B.url(pagePath) + h, { waitUntil: 'load' });
    await ready(p2);
    let s2 = await p2.evaluate(() => window.__folding.getState());
    const ok1 = s2.groupId === '*x' && s2.pattern === key && Math.abs(s2.t - 0.4) < 1e-9 && s2.cut === 1 && s2.hash === h;
    await p2.reload({ waitUntil: 'load' });
    await ready(p2);
    s2 = await p2.evaluate(() => window.__folding.getState());
    const ok2 = s2.groupId === '*x' && s2.pattern === key && Math.abs(s2.t - 0.4) < 1e-9 && s2.cut === 1 && s2.hash === h;
    check(ok1 && ok2, `round trip ${key}: ${h}`, JSON.stringify([s2.groupId, s2.pattern, s2.t, s2.cut, s2.hash]));
    await p2.close();
  }
  // a hashchange on a live page (a pasted link in the viewer), and old or wrong names
  for (const [h, want, wantHash] of [['#g=xx&pat=tomoe&t=1', 'tomoe', /pat=tomoe/], ['#g=xx&pat=Soft%20commas&t=1', 'soft', /pat=soft/], ['#g=333&pat=blobs', 'soft', /pat=soft/],
    ['#g=333&pat=checkerboard', 'checker', /pat=checker/], ['#g=333&pat=PAISLEY', 'paisley', /^(?!.*pat=)/], ['#g=333&pat=sheet', 'paisley', /^(?!.*pat=)/], ['#g=333&pat=dev', 'paisley', /^(?!.*pat=)/],
    ['#g=333', 'paisley', /^(?!.*pat=)/], ['#*632', 'paisley', /^(?!.*pat=)/]]) {
    await page.evaluate((x) => { location.hash = x; }, h);
    await page.waitForTimeout(400);
    s = await page.evaluate(() => window.__folding.getState());
    sh = await shell(page);
    check(s.pattern === want && sh.pattern === want && wantHash.test(s.hash), `hashchange ${h} -> ${want}`, JSON.stringify([s.groupId, s.pattern, s.hash, sh.swatches]));
  }
  // the legend's paper item at narrow widths (shown from 360 px up) under each pattern
  for (const w of [1280, 390, 360, 359, 320]) {
    await page.setViewportSize({ width: w, height: 720 });
    await page.waitForTimeout(200);
    const row = [];
    for (const [key] of PATS) { await page.evaluate((k) => window.__folding.setPattern(k), key); await page.waitForTimeout(80); sh = await shell(page); row.push(`${key}:${sh.paper ? 'shown' : 'hidden'}`); }
    const want = w >= 360;
    check(row.every((r) => r.endsWith(want ? 'shown' : 'hidden')), `legend paper item at ${w} px: ${want ? 'shown' : 'hidden'} under all six`, row.join(' '));
  }
  await page.setViewportSize({ width: 1280, height: 720 });

  // ---- a phone, dpr 3 -----------------------------------------------------------------------------------------
  const ph = await B.browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const pp = await ph.newPage();
  watch(pp, 'phone');
  await pp.goto(B.url(pagePath), { waitUntil: 'load' });
  await ready(pp);
  await pp.waitForTimeout(300);
  sh = await shell(pp);
  check(sh.pattern === 'paisley' && sh.swatches.join() === 'pat-sw-paisley' && !sh.labelShown && sh.scrollW <= sh.innerW, 'phone: opens with Paisley, the swatch alone, nothing scrolls', JSON.stringify(sh));
  await pp.screenshot({ path: path.join(outDir, 'phone-default.png') });
  const pills = [];
  for (const [key, label] of PATS) {
    await pp.selectOption('#pattern', key);
    await pp.waitForTimeout(350);
    sh = await shell(pp);
    check(sh.pattern === key && sh.swatches.join() === 'pat-sw-' + key && !sh.labelShown && !!sh.paper && sh.scrollW <= sh.innerW, `phone: ${label} (its swatch alone, paper item, no scroll)`, JSON.stringify({ sw: sh.swatches, paper: sh.paper, scrollW: sh.scrollW }));
    const bx = await pp.locator('#pattern-box').boundingBox();
    const buf = await pp.screenshot({ clip: { x: bx.x - 4, y: bx.y - 2, width: bx.width + 8, height: bx.height + 4 } });
    pills.push({ key, label, b64: buf.toString('base64') });
    await pp.screenshot({ path: path.join(outDir, `phone-${key}.png`) });
  }
  // a strip: the six pills of the phone as a person sees them (dpr 3), and the same 4x larger
  const strip = await lap.newPage();
  await strip.setViewportSize({ width: 900, height: 400 });
  await strip.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:12px;font:13px system-ui;background:#fff}.r{display:flex;gap:18px;align-items:flex-end;margin-bottom:16px}figure{margin:0;text-align:center}figcaption{color:#444}</style>
    <div class="r">${pills.map((p) => `<figure><img src="data:image/png;base64,${p.b64}" style="width:${Math.round(57 / 1)}px"><figcaption>${p.label}</figcaption></figure>`).join('')}</div>
    <div class="r">${pills.map((p) => `<figure><img src="data:image/png;base64,${p.b64}" style="width:180px;image-rendering:auto"><figcaption>${p.label} (x3)</figcaption></figure>`).join('')}</div>`);
  await strip.waitForTimeout(200);
  await strip.screenshot({ path: path.join(outDir, 'phone-swatches.png'), fullPage: true });
} finally { await B.close(); }
console.log('\nconsole messages: ' + (allMsgs.length ? '\n  ' + allMsgs.join('\n  ') : 'none'));
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
