// perf.mjs (fixer, 13 Nov 2026) — what one plane draw costs under a print, in the mini's Chrome (1280 x 720 by default):
//   warm   P.render() + a 1-pixel read of the plane (nothing changed since the last draw)
//   cold   the first draw of the print after another one (its layers made anew): the plane's own JS time of that draw
//          (P.stats.ms, inside setPattern) + the flush of the plane's canvas right after (the 3D pane flushed first)
//   wavy   one frame of the Wavy slider (a draft rebuild, then both panes; the window stays): the whole setAmp + reads
//   tile   the Tile step at u = 0.5: P.render() + read
//   bake   the first bake of a print in this page (a fresh print: bakeShapes keys on the print object), at BAKE_SIZE
//   FOLDING_BROWSER=mini node dev/patterns/scratch-fixer/perf.mjs [--base dev/patterns/scratch-fixer/ws/] [--pats stress,paisley]
//        [--ids '*442,*632'] [--reps 7] [--vw 1280 --vh 720 --dpr 1] [--tag name]
import fs from 'node:fs';
import path from 'node:path';
import { openBrowser } from '../../../tools/browser.mjs';

const W = '/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding';
const OUT = '/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/fixer';
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const base = opt.base || '';
const pats = (opt.pats || 'checker,stress').split(',');
const designs = pats.filter((p) => !['checker', 'rings', 'comma'].includes(p));
const ids = opt.ids ? opt.ids.split(',') : ['o', '2222', 'xx', '*x', '333', '22x', '442', '632', '3*3', '*333', '4*2', '*442', '*632'];
const reps = +opt.reps || 7;

const B = await openBrowser({ root: W });
const res = { base, pats, ids, reps, rows: [] };
try {
  const ctx = await B.browser.newContext({ viewport: { width: +(opt.vw || 1280), height: +(opt.vh || 720) }, deviceScaleFactor: +(opt.dpr || 1), reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const msgs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') msgs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => msgs.push('PAGEERROR: ' + e.message));
  await page.goto(B.url(base + 'dev/patterns/app.html?designs=' + designs.join(',') + '#g=o'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__designs && window.__designs.ready && window.__folding && window.__folding.ready, null, { timeout: 30000 });
  await page.evaluate(() => window.__folding.ready);
  res.env = await page.evaluate(() => ({ plane: [document.getElementById('plane-canvas').width, document.getElementById('plane-canvas').height], dpr: devicePixelRatio,
    reduce: matchMedia('(prefers-reduced-motion: reduce)').matches }));
  console.log('env', JSON.stringify(res.env));
  for (const p of pats) {
    for (const id of ids) {
      const r = await page.evaluate(([pat, g, n]) => {
        const F = window.__folding, P = F.plane, cv = document.getElementById('plane-canvas'), c2 = cv.getContext('2d');
        const gl = F.renderer.gl, px = new Uint8Array(4);
        const med = (a) => { const s = a.slice().sort((x, y) => x - y); return Math.round(100 * s[s.length >> 1]) / 100; };
        const mx = (a) => Math.round(100 * Math.max(...a)) / 100;
        F.setTile(1); F.setGroup(g); F.setPattern(pat); F.setPreset(0); F.setAmp(0); F.setT(0);
        // warm
        const warm = [], warmJs = [];
        for (let i = 0; i < n; i++) { const a = performance.now(); P.render(); warmJs.push(performance.now() - a); c2.getImageData(0, 0, 1, 1); warm.push(performance.now() - a); }
        // cold: the print comes back after another one (its layers were dropped: made anew), the plane's draw inside
        // setPattern (P.stats.ms) + the flush of the plane's canvas (after the 3D pane's own work is flushed)
        const cold = [], coldJs = [];
        const other = pat === 'checker' ? 'rings' : 'checker';
        for (let i = 0; i < Math.min(n, 5); i++) {
          F.setPattern(other); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); c2.getImageData(0, 0, 1, 1);
          F.setPattern(pat);
          const js = P.stats.ms; gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          const a = performance.now(); c2.getImageData(0, 0, 1, 1); const flush = performance.now() - a;
          coldJs.push(js); cold.push(js + flush);
        }
        // wavy: one frame of the slider (draft rebuild + both panes)
        const wavy = [], wavyPlane = [];
        for (let i = 1; i <= n; i++) {
          const a = performance.now(); F.setAmp(0.05 * i, true); c2.getImageData(0, 0, 1, 1); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          wavy.push(performance.now() - a); wavyPlane.push(P.stats.ms);
        }
        F.setAmp(0);
        // the Tile step half way
        F.setTile(0.5);
        const tile = [];
        for (let i = 0; i < n; i++) { const a = performance.now(); P.render(); c2.getImageData(0, 0, 1, 1); tile.push(performance.now() - a); }
        F.setTile(1);
        const s = F.getState(), sc = F.scene();
        return { pat, g, kind: s.printKind, verts: sc.print && sc.print.verts, copies: P.stats.copies, layers: P.stats.printBuilds === undefined ? null : P.stats.printBuilds, layerMs: P.stats.printMs === undefined ? null : Math.round(100 * P.stats.printMs) / 100,
          warm: med(warm), warmMax: mx(warm), warmJs: med(warmJs), cold: med(cold), coldMax: mx(cold), coldJs: med(coldJs),
          wavy: med(wavy), wavyPlaneJs: med(wavyPlane), tile: med(tile), tileMax: mx(tile), errors: s.errors };
      }, [p, id, reps]);
      res.rows.push(r);
      console.log(JSON.stringify(r));
    }
  }
  if (designs.length && !opt.nobake) {
    res.bake = await page.evaluate(async ([ds, gids, b]) => {
      const S = await import('/' + b + 'src/shapes.js'), G = await import('/' + b + 'src/groups.js'), out = [];
      for (const d of ds) {
        const M = await import(`/${b}dev/patterns/designs/${d}/design.js`);
        for (const id of gids) {
          const g = G.BY_ID[id], p = S.makeShapePrint(g, { key: d, shapes: M.find(g).shapes });
          const a = performance.now(); const tex = S.bakeShapes(p); const ms = performance.now() - a;
          out.push({ d, id, verts: p.verts, bake: +ms.toFixed(1), size: tex.size });
        }
      }
      return out;
    }, [designs, ids, base]);
    for (const b of res.bake) console.log('bake', JSON.stringify(b));
  }
  res.messages = msgs;
  console.log('messages', JSON.stringify(msgs.slice(0, 20)));
} finally { await B.close(); }
const file = path.join(OUT, 'perf' + (opt.tag ? '-' + opt.tag : '') + '.json');
fs.writeFileSync(file, JSON.stringify(res, null, 1));
console.log('WROTE ' + file);
