// scratch-review-chrome/scenes.mjs — one picture per SCENE of the built page with every pattern side by side, to compare
// the patterns on the same shape. A scene is  id@t[@p<preset>][@u<tile>][@v<az>/<el>/<zoom>]  e.g. 'xx@1', '22x@0.25@p2',
// '**@0@u0.5', 'o@1@v180/40/1'. The pane shot is --clip fold | plane | stage.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-review-chrome/scenes.mjs --out-dir <dir> --scenes 'xx@1,o@1'
//        [--pats paisley,soft,tomoe,checker,rings,comma] [--clip fold] [--w 1000 --h 700] [--cols 3] [--dpr 1] [--disp 330]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const pagePath = opt.page || 'dist/index.html', outDir = path.resolve(opt['out-dir'] || '.');
const pats = (opt.pats || 'paisley,soft,tomoe,checker,rings,comma').split(',');
const scenes = (opt.scenes || 'xx@1').split(',');
const W = +opt.w || 1000, H = +opt.h || 700, cols = +opt.cols || 3, dpr = +opt.dpr || 1, disp = +opt.disp || 330;
const clipSel = { fold: '#pane-fold', plane: '#pane-plane', stage: '#stage', page: 'body' }[opt.clip || 'fold'];
fs.mkdirSync(outDir, { recursive: true });
const parse = (s) => {
  const [id, t, ...rest] = s.split('@'), sc = { id, t: +t, preset: 0, tile: 1, view: null };
  for (const r of rest) { if (r[0] === 'p') sc.preset = +r.slice(1); else if (r[0] === 'u') sc.tile = +r.slice(1); else if (r[0] === 'v') sc.view = r.slice(1); }
  return sc;
};
const B = await openBrowser({ root });
const msgs = [];
let bad = 0;
try {
  const ctx = await B.browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') msgs.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => msgs.push('pageerror: ' + e.message));
  await page.goto(B.url(pagePath) + '#g=333', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
  await page.evaluate(() => window.__folding.ready);
  for (const s of scenes) {
    const sc = parse(s), shots = [];
    for (const pat of pats) {
      const st = await page.evaluate(([sc, pat]) => {
        const F = window.__folding;
        F.setPattern(pat); F.setGroup(sc.id);
        if (sc.preset) F.setPreset(sc.preset);
        F.setT(sc.t);
        if (sc.tile < 1) F.setTile(sc.tile);
        if (sc.view) { const [az, el, z] = sc.view.split('/').map(Number); F.setView(az, el, z); } else F.resetView();
        const s = F.getState();
        return { pattern: s.pattern, print: s.print, errors: s.errors, recut: s.recut && `${s.recut.home} ${s.recut.movers}`, caption: s.foldCaption, tileCaption: s.tileCaption, preset: s.preset };
      }, [sc, pat]);
      await page.waitForTimeout(500);
      let box = await page.locator(clipSel).boundingBox();
      if (+opt.crop > 0) { const c = +opt.crop; box = { x: box.x + box.width / 2 - c / 2, y: box.y + box.height / 2 - c / 2, width: c, height: c }; }
      const buf = await page.screenshot({ clip: box });
      shots.push({ pat, b64: buf.toString('base64'), st });
      if (st.pattern !== pat || !st.print || st.errors) { bad++; console.log(`PROBLEM ${s} ${pat}: ${JSON.stringify(st)}`); }
    }
    const sheetCtx = await B.browser.newContext({ viewport: { width: cols * (disp + 8) + 24, height: 600 }, deviceScaleFactor: 1 });
    const sheet = await sheetCtx.newPage();
    await sheet.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:8px;font:12px system-ui;background:#fff}.g{display:grid;grid-template-columns:repeat(${cols},${disp}px);gap:6px}figure{margin:0;border:1px solid #ddd}img{display:block;width:100%}figcaption{padding:1px 4px;color:#333}</style><div style="margin:0 0 4px;font-weight:600">${s} · ${shots[0].st.preset || ''}${shots[0].st.recut ? ' · re-cut ' + shots[0].st.recut : ''}${shots[0].st.caption ? ' · “' + shots[0].st.caption + '”' : ''}${shots[0].st.tileCaption ? ' · tile: “' + shots[0].st.tileCaption + '”' : ''}</div><div class="g">${shots.map((x) => `<figure><img src="data:image/png;base64,${x.b64}"><figcaption>${x.pat}: ${x.st.print || 'SHEET'}${x.st.errors ? ' ERRORS ' + x.st.errors : ''}</figcaption></figure>`).join('')}</div>`);
    await sheet.waitForTimeout(150);
    const out = path.join(outDir, `scene-${s.replace(/[*]/g, 'S').replace(/[@/]/g, '_')}-${opt.clip || 'fold'}.png`);
    await sheet.screenshot({ path: out, fullPage: true });
    await sheetCtx.close();
    console.log('WROTE ' + out);
  }
} finally { await B.close(); }
console.log('console messages: ' + (msgs.length ? msgs.join(' | ') : 'none'));
console.log(`done, ${bad} problems`);
process.exit(bad ? 1 : 0);
