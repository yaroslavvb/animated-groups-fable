// scratch-review-chrome/sheets.mjs — the review's sheets of the BUILT page: for each pattern and each t, the stage (plane
// and fold) of all 17 groups, one picture; plus a JSON of what each group showed (print, kind, errors) and every console
// message. One browser connection for the whole run; a fresh page per pattern (its console counted on its own).
//   FOLDING_BROWSER=mini node dev/patterns/scratch-review-chrome/sheets.mjs --out-dir <dir> [--pats paisley,soft] [--ts 0,0.6,1]
//        [--ids o,xx] [--w 800 --h 500] [--cols 3] [--page dist/index.html] [--scale 0.5] [--tag name] [--preset 1]
//        [--view az/el/zoom]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const IDS = opt.ids ? opt.ids.split(',') : ['o', '2222', '**', 'xx', '*x', '333', '22x', '22*', '*2222', '2*22', '442', '632', '3*3', '*333', '4*2', '*442', '*632'];
const pats = (opt.pats || 'paisley,soft,tomoe,checker,rings,comma').split(',');
const ts = (opt.ts || '0,0.6,1').split(',').map(Number);
const W = +opt.w || 800, H = +opt.h || 500, cols = +opt.cols || 3, scale = +opt.scale || 0.5;
const outDir = path.resolve(opt['out-dir'] || '.');
const tag = opt.tag ? opt.tag + '-' : '';
fs.mkdirSync(outDir, { recursive: true });
const B = await openBrowser({ root });
const report = { page: opt.page || 'dist/index.html', where: B.where, w: W, h: H, pats: {} };
let bad = 0;
try {
  for (const pat of pats) {
    const ctx = await B.browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: +opt.dpr || 1, isMobile: !!opt.mobile, hasTouch: !!opt.mobile });
    const page = await ctx.newPage();
    const msgs = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') msgs.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => msgs.push('pageerror: ' + e.message));
    await page.goto(B.url(report.page) + `#g=o&pat=${pat}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
    await page.evaluate(() => window.__folding.ready);
    const rows = [];
    for (const t of ts) {
      const shots = [];
      for (const id of IDS) {
        const st = await page.evaluate(([g, pat, tt, preset, view]) => {
          const F = window.__folding, t0 = performance.now();
          F.setGroup(g);
          const ms = performance.now() - t0;
          if (preset) F.setPreset(+preset);
          F.setPattern(pat);
          F.setT(tt);
          if (view) { const [az, el, z] = view.split('/').map(Number); F.setView(az, el, z); }
          const s = F.getState();
          return { pattern: s.pattern, print: s.print, kind: s.printKind, errors: s.errors, recut: s.recut && s.recut.movers, ms: Math.round(ms * 10) / 10,
            dataPrint: document.getElementById('app').getAttribute('data-print'), caption: s.foldCaption };
        }, [id, pat, t, opt.preset || 0, opt.view || null]);
        await page.waitForTimeout(280);
        const box = await page.locator({ fold: '#pane-fold', plane: '#pane-plane', stage: '#stage' }[opt.clip || 'stage']).boundingBox();
        const buf = await page.screenshot({ clip: box });
        shots.push({ id, b64: buf.toString('base64'), st });
        rows.push({ id, t, ...st });
        if (st.pattern !== pat || !st.print || st.errors) { bad++; console.log(`PROBLEM ${pat} ${id} t=${t}: ${JSON.stringify(st)}`); }
      }
      const tw = Math.round(W * scale);
      const sheetCtx = await B.browser.newContext({ viewport: { width: cols * (tw + 8) + 24, height: 900 }, deviceScaleFactor: 1 });
      const sheet = await sheetCtx.newPage();
      await sheet.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:10px;font:12px system-ui;background:#fff}.g{display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:8px}figure{margin:0;border:1px solid #ddd}img{display:block;width:100%}figcaption{padding:1px 5px;color:#333}</style><h3 style="margin:0 0 6px">${pat} · t = ${t}${opt.preset ? ' · preset ' + opt.preset : ''}${opt.view ? ' · view ' + opt.view : ''}</h3><div class="g">${shots.map((s) => `<figure><img src="data:image/png;base64,${s.b64}"><figcaption>${s.id} · ${s.st.pattern}: ${s.st.print || 'SHEET (no print)'}${s.st.recut ? ' · re-cut ' + s.st.recut : ''}${s.st.errors ? ' · ERRORS ' + s.st.errors : ''}</figcaption></figure>`).join('')}</div>`);
      await sheet.waitForTimeout(150);
      const out = path.join(outDir, `${tag}${pat}-t${String(t).replace('.', '')}.png`);
      await sheet.screenshot({ path: out, fullPage: true });
      await sheetCtx.close();
      console.log('WROTE ' + out);
    }
    const st = await page.evaluate(() => window.__folding.getState());
    report.pats[pat] = { rows, msgs, warm: st.warm, errors: st.errors };
    console.log(`${pat}: ${msgs.length} console messages${msgs.length ? ': ' + msgs.slice(0, 3).join(' | ') : ''}; warm ${JSON.stringify(st.warm)}`);
    await ctx.close();
  }
} finally { await B.close(); }
fs.writeFileSync(path.join(outDir, `${tag}sheets.json`), JSON.stringify(report, null, 1));
console.log(`done, ${bad} problems`);
process.exit(bad ? 1 : 0);
