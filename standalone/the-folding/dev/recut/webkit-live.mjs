// dev/recut/webkit-live.mjs — the LIVE page on spacesheep in Playwright's WebKit, Safari's engine: does the app start in
// its frame, is WebGL 2 there, does the print's shader compile and draw, do the plane's canvas calls (even-odd fills
// and clips) work? WebKit is on the M5, not on the mini: run it there, the script on stdin —
//   ssh m5 '~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --input-type=module -' < dev/recut/webkit-live.mjs
//   scp 'm5:/tmp/folding-webkit-check/*.png' <a folder>     (then remove /tmp/folding-webkit-check on the M5)
// 13 Nov 2026: both sizes start, WebGL 2 on, no error, the checkerboard, the rings and the re-cut draw as in Chrome.
// The same evening it found what Chrome cannot: Safari counted the invisible native select's own text as page width.
import fs from 'node:fs';
const { webkit } = await import(process.env.HOME + '/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const BASE = 'https://spacesheep.dev/@yaroslavvb/the-folding';
const out = '/tmp/folding-webkit-check';
fs.mkdirSync(out, { recursive: true });
async function appFrame(page) {
  for (let i = 0; i < 150; i++) {
    for (const f of page.frames()) {
      if (f === page.mainFrame()) continue;
      try { if (await f.evaluate(() => !!(window.__folding && window.__folding.ready))) return f; } catch { /* loading */ }
    }
    await page.waitForTimeout(200);
  }
  throw new Error('no app frame');
}
let browser;
try {
  browser = await webkit.launch();
  for (const [name, vp] of [['laptop', { width: 1180, height: 760 }], ['phone', { width: 390, height: 780 }]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: name === 'phone' ? 2 : 1 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push('PAGE ' + String(e && e.message).slice(0, 200)));
    await page.goto(BASE + '#g=22x&cut=2&t=0.2', { waitUntil: 'load' });
    const f = await appFrame(page);
    await page.waitForTimeout(1200);
    const s = await f.evaluate(() => { const st = window.__folding.getState(); return { g: st.groupId, webgl: st.webgl, pattern: st.pattern, print: st.print, recut: st.recut && st.recut.home, caption: st.foldCaption, errors: st.errors, appErrors: window.__folding.errors.slice(0, 3) }; });
    console.log(name + ' ' + JSON.stringify(s));
    await page.screenshot({ path: `${out}/webkit-${name}-22x.png` });
    // the words of the re-cut: on a phone a strip of their own under the picture (a container query); on a laptop over its foot
    const L = await f.evaluate(() => {
      const r = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
      const c = document.getElementById('fold-canvas');
      return { pane: r('pane-fold'), canvas: r('fold-canvas'), words: r('fold-caption'), text: document.getElementById('fold-caption').textContent, drawn: [c.width, c.height], container: getComputedStyle(document.getElementById('pane-fold')).containerName };
    });
    // the page is as wide as its window (Safari counted the invisible select's own text: 42 px more on a phone)
    const wide = await f.evaluate(() => { window.__folding.setPattern('checker'); const h = document.getElementById('header'); return [document.documentElement.scrollWidth - innerWidth, h.scrollWidth - h.clientWidth, document.getElementById('pattern').value]; });
    console.log(`${wide[0] <= 0 && wide[1] <= 0 ? 'PASS' : 'FAIL'} ${name}: the page is no wider than its window (page +${wide[0]} px, header +${wide[1]} px, pattern ${wide[2]})`);
    const small = L.pane[2] <= 449 || L.pane[3] <= 449, above = L.canvas[1] + L.canvas[3] <= L.words[1];
    console.log(`${small === above ? 'PASS' : 'FAIL'} ${name}: the pane is ${L.pane[2]} x ${L.pane[3]}, the picture ends ${above ? 'above' : 'under'} the words  ${JSON.stringify(L)}`);
    await f.evaluate(() => { window.__folding.setGroup('333'); window.__folding.setPattern('rings'); window.__folding.setT(0.6); });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/webkit-${name}-333-rings.png` });
    await f.evaluate(() => { window.__folding.setGroup('*x'); window.__folding.setPattern('checker'); window.__folding.setT(1); window.__folding.setTile(0.4); });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/webkit-${name}-sx-tile.png` });
    const s2 = await f.evaluate(() => { const st = window.__folding.getState(); return { g: st.groupId, print: st.print, errors: st.errors, appErrors: window.__folding.errors.slice(0, 3), tile: st.tile, url: st.url }; });
    console.log(name + ' ' + JSON.stringify(s2) + ' page errors: ' + JSON.stringify(errs.slice(0, 5)) + ' top: ' + page.url());
    await ctx.close();
  }
  // a narrow phone (360 px): the title gives way, the chip keeps the whole name of *333; the legend has "front · back"
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(BASE + '#g=%2A333', { waitUntil: 'load' });
    const f = await appFrame(page);
    await page.waitForTimeout(1200);
    const N = await f.evaluate(() => {
      const m = document.getElementById('chip-meta'), t = document.querySelector('.title').getBoundingClientRect(), paper = document.querySelector('#legend .lg[data-paper]');
      return { g: window.__folding.getState().groupId, w: innerWidth, text: m.textContent, cut: m.scrollHeight > m.clientHeight + 1 || m.scrollWidth > m.clientWidth + 1, title: Math.round(t.width), paper: getComputedStyle(paper).display, scroll: document.documentElement.scrollWidth };
    });
    const ok = N.g === '*333' && !N.cut && N.title <= 2 && N.paper !== 'none' && N.scroll <= N.w;
    console.log(`${ok ? 'PASS' : 'FAIL'} narrow phone: ${JSON.stringify(N)}`);
    await page.screenshot({ path: `${out}/webkit-360-s333.png` });
    await ctx.close();
  }
} catch (e) { console.log('FAILED ' + (e && e.message)); } finally { if (browser) await browser.close(); }
