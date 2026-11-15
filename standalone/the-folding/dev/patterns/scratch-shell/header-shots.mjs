// scratch (shell, 14 Nov 2026): the header and the legend at six widths (and a phone on its side) with each pattern
// selected, and the pill alone at 1x and 3x — contact sheets made in the same browser.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-shell/header-shots.mjs [out-dir] [page] [group]
// out-dir default ~/drive.unsynced/artifacts/the-folding-patterns/shell/hdr; page default the dev page with the designs.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openBrowser } from '../../../tools/browser.mjs';

const OUT = path.resolve(process.argv[2] || path.join(os.homedir(), 'drive.unsynced/artifacts/the-folding-patterns/shell/hdr'));
const PAGE = process.argv[3] || 'dev/patterns/app.html?designs=paisley,tomoe,blobs';
const GROUP = process.argv[4] || '333';
const PATTERNS = ['paisley', 'soft', 'tomoe', 'checker', 'rings', 'comma'];
const SIZES = [[320, 568], [360, 640], [390, 780], [560, 760], [720, 900], [1280, 720], [667, 375]];
fs.mkdirSync(OUT, { recursive: true });

const B = await openBrowser({ quiet: true });
const errors = [];
const b64 = (buf) => 'data:image/png;base64,' + buf.toString('base64');
async function sheet(ctx, title, rows, file, width) {
  // rows: [{ label, imgs: [{ src, w, h }] }] -> one picture
  const p = await ctx.newPage();
  const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:10px;font:13px system-ui;background:#fff;color:#1a1a1f}
    h1{font-size:14px;margin:0 0 8px} .r{display:flex;gap:10px;align-items:flex-start;margin:0 0 8px} .l{width:70px;flex:none;color:#52514a}
    img{display:block;border:1px solid #e5e5ea}</style><h1>${title}</h1>` +
    rows.map((r) => `<div class="r"><div class="l">${r.label}</div>${r.imgs.map((i) => `<img src="${i.src}" style="width:${i.w}px;height:${i.h}px">`).join('')}</div>`).join('');
  await p.setViewportSize({ width, height: 400 });
  await p.setContent(html, { waitUntil: 'load' });
  await p.screenshot({ path: file, fullPage: true });
  await p.close();
  console.log('WROTE', file);
}
try {
  // the header and the legend, dpr 2
  const ctx = await B.browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  await page.goto(B.url(PAGE + '#g=' + encodeURIComponent(GROUP)), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready && (!window.__designs || window.__designs.ready), null, { timeout: 30000 });
  const reg = await page.evaluate(() => (window.__designs ? window.__designs.registered.map((r) => r.key) : []));
  console.log('registered:', reg.join(', '), '| options:', await page.evaluate(() => [...document.querySelectorAll('#pattern option')].map((o) => o.value + '=' + o.textContent).join(', ')));
  const facts = [];
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    const rows = [];
    for (const key of PATTERNS) {
      await page.evaluate(([g, k]) => { const F = window.__folding; F.setGroup(g); F.setPattern(k); F.setT(0); }, [GROUP, key]);
      await page.waitForTimeout(120);
      const st = await page.evaluate(() => {
        const q = (s) => document.querySelector(s), B = (e) => e.getBoundingClientRect();
        const shown = (e) => !!e && getComputedStyle(e).display !== 'none' && B(e).width > 0;
        const sw = [...document.querySelectorAll('#pattern-box .pat-sw')].filter(shown).map((e) => e.getAttribute('class').replace('pat-sw ', ''));
        const hb = B(q('#header')), cb = B(q('#caption')), lg = B(q('#legend'));
        return { pattern: q('#app').getAttribute('data-pattern'), print: q('#app').getAttribute('data-print'), sw, label: shown(q('#pattern-label')) ? q('#pattern-label').textContent : '', paper: shown(q('#legend [data-paper]')),
          pill: Math.round(B(q('#pattern-box .pat-pill')).width), chip: Math.round(B(q('#chip')).width),
          top: Math.ceil(Math.max(hb.bottom, cb.bottom)), lgTop: Math.floor(lg.top), lgBottom: Math.ceil(lg.bottom) };
      });
      facts.push({ size: `${w}x${h}`, key, ...st });
      const head = await page.screenshot({ clip: { x: 0, y: 0, width: w, height: st.top + 2 } });
      const leg = await page.screenshot({ clip: { x: 0, y: st.lgTop - 2, width: w, height: Math.min(h, st.lgBottom) - st.lgTop + 2 } });
      fs.writeFileSync(path.join(OUT, `${w}x${h}-${key}-head.png`), head);
      rows.push({ label: `${key}<br>${st.print || '(no print)'}`, imgs: [{ src: b64(head), w, h: st.top + 2 }, { src: b64(leg), w, h: Math.min(h, st.lgBottom) - st.lgTop + 2 }] });
    }
    await sheet(ctx, `header and legend at ${w} x ${h} (group ${GROUP}), dpr 2`, rows, path.join(OUT, `sheet-${w}x${h}.png`), Math.min(2 * w + 120, 2800));
  }
  fs.writeFileSync(path.join(OUT, 'facts.json'), JSON.stringify(facts, null, 1));
  for (const f of facts) console.log(`${f.size.padEnd(9)} ${f.key.padEnd(8)} pattern=${f.pattern} print=${f.print} swatch=${f.sw.join('|')} label="${f.label}" paper=${f.paper} pill=${f.pill} chip=${f.chip}`);
  await ctx.close();
  // the pill alone at 1x and 3x, all six side by side (a laptop window: the name shows; a phone: the swatch alone)
  for (const [w, h, tag] of [[1280, 720, 'laptop'], [390, 780, 'phone']]) {
    const imgs = {};
    for (const d of [1, 3]) {
      const c2 = await B.browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: d });
      const p2 = await c2.newPage();
      p2.on('pageerror', (e) => errors.push(e.message));
      await p2.goto(B.url(PAGE + '#g=' + encodeURIComponent(GROUP)), { waitUntil: 'load' });
      await p2.waitForFunction(() => window.__folding && window.__folding.ready && (!window.__designs || window.__designs.ready), null, { timeout: 30000 });
      imgs[d] = [];
      for (const key of PATTERNS) {
        await p2.evaluate((k) => window.__folding.setPattern(k), key);
        await p2.waitForTimeout(80);
        const pill = p2.locator('#pattern-box .pat-pill');
        const bb = await pill.boundingBox();
        imgs[d].push({ src: b64(await pill.screenshot()), w: Math.round(bb.width), h: Math.round(bb.height) });
      }
      await c2.close();
    }
    const c3 = await B.browser.newContext({ viewport: { width: 1200, height: 400 }, deviceScaleFactor: 3 });
    await sheet(c3, `the pill, ${tag} window (${w} x ${h}): 1x above, 3x below — ${PATTERNS.join(', ')}`,
      [{ label: '1x', imgs: imgs[1] }, { label: '3x', imgs: imgs[3] }], path.join(OUT, `pill-${tag}.png`), 1000);
    await c3.close();
  }
} finally { await B.close(); }
console.log(errors.length ? 'PAGE ERRORS / WARNINGS:\n  ' + [...new Set(errors)].join('\n  ') : 'no page error');
