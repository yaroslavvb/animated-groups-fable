// compare.mjs (fixer, 13 Nov 2026) — the plane pane of two copies of the app in the same state, pixel by pixel: the
// workspace (A: dev/patterns/app.html) against another tree (B: --base, a copy laid out as the workspace), one Chrome
// of the mini, two pages. Writes A, B and a diff picture per state into OUT/fixer/compare/<tag>/ and prints the counts.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-fixer/compare.mjs --base dev/patterns/scratch-fixer/ws/ --pats stress,paisley
//        [--ids o,333] [--tiles 1,0.5] [--t 0] [--clip plane|fold|stage] [--dpr 1] [--tag name]
import fs from 'node:fs';
import path from 'node:path';
import { openBrowser } from '../../../tools/browser.mjs';
import { readPNG, writePNG } from './pngdiff.mjs';

const W = '/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding';
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const OUT = path.join('/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/fixer/compare', opt.tag || 'run');
fs.mkdirSync(OUT, { recursive: true });
const pats = (opt.pats || 'stress').split(','), designs = pats.filter((p) => !['checker', 'rings', 'comma'].includes(p));
const ids = (opt.ids || 'o,*x,333,4*2,*632').split(','), tiles = (opt.tiles || '1').split(',').map(Number), t = +(opt.t || 0);
const sel = opt.clip === 'fold' ? '.pane-fold' : opt.clip === 'stage' ? '#stage' : '.pane-plane';

const B = await openBrowser({ root: W });
const rows = [];
try {
  const ctx = await B.browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: +(opt.dpr || 1), reducedMotion: 'reduce' });
  const open = async (base) => {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGE ERROR ' + base + ': ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR ' + base + ': ' + m.text()); });
    await page.goto(B.url(base + 'dev/patterns/app.html?designs=' + designs.join(',') + '#g=o'), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__designs && window.__designs.ready && window.__folding && window.__folding.ready, null, { timeout: 30000 });
    await page.evaluate(() => window.__folding.ready);
    return page;
  };
  if (!opt.base) throw new Error('compare.mjs: --base <a tree laid out as the workspace, relative to it> is needed');
  const pa = await open(''), pb = await open(opt.base);
  const shoot = async (page, st) => {
    await page.evaluate(([pat, g, tt, tile]) => { const F = window.__folding; F.setGroup(g); F.setPattern(pat); F.setTile(tile); F.setT(tt); }, st);
    await page.waitForTimeout(150);
    const box = await page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, sel);
    return page.screenshot({ clip: box });
  };
  for (const pat of pats) for (const g of ids) for (const tile of tiles) {
    const st = [pat, g, t, tile], tag = `${pat}-${g.replace(/\*/g, 's')}-u${String(tile).replace('.', '')}`;
    const fa = path.join(OUT, tag + '-A.png'), fb = path.join(OUT, tag + '-B.png');
    fs.writeFileSync(fa, await shoot(pa, st)); fs.writeFileSync(fb, await shoot(pb, st));
    const A = readPNG(fa), Bp = readPNG(fb);
    let n = 0, max = 0;
    const d = new Uint8Array(A.data.length);
    for (let i = 0; i < A.data.length; i += 4) {
      const m = Math.max(Math.abs(A.data[i] - Bp.data[i]), Math.abs(A.data[i + 1] - Bp.data[i + 1]), Math.abs(A.data[i + 2] - Bp.data[i + 2]));
      const grey = (A.data[i] + A.data[i + 1] + A.data[i + 2]) / 3;
      if (m > 0) { n++; if (m > max) max = m; }
      if (m > 8) { d[i] = 220; d[i + 1] = 30; d[i + 2] = 30; } else if (m > 0) { d[i] = 250; d[i + 1] = 170; d[i + 2] = 0; } else { d[i] = d[i + 1] = d[i + 2] = 160 + grey / 4; }
      d[i + 3] = 255;
    }
    let big = 0;
    for (let i = 0; i < A.data.length; i += 4) if (Math.max(Math.abs(A.data[i] - Bp.data[i]), Math.abs(A.data[i + 1] - Bp.data[i + 1]), Math.abs(A.data[i + 2] - Bp.data[i + 2])) > 8) big++;
    writePNG(path.join(OUT, tag + '-diff.png'), A.w, A.h, d);
    rows.push({ tag, px: A.w * A.h, differ: n, over8: big, max });
    console.log(`${tag}: ${n} of ${A.w * A.h} pixels differ (${big} by more than 8 levels), max ${max}`);
  }
} finally { await B.close(); }
fs.writeFileSync(path.join(OUT, 'compare.json'), JSON.stringify(rows, null, 1));
console.log('WROTE ' + OUT);
