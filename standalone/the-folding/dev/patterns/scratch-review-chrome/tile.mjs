// scratch-review-chrome/tile.mjs — the Tile step of the BUILT page under each pattern: for each group, the first phase of
// its plan whose copies turn over (a reflection or a glide: SPEC 10.2, they swing UNDER the paper), shot at a few points
// of that phase, the plane pane only, every pattern side by side; and the words of the phase. One picture per group.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-review-chrome/tile.mjs --out-dir <dir> [--ids '**,*x,22*,xx,22x,2*22']
//        [--pats paisley,soft,tomoe,checker,comma] [--at 0.3,0.5,0.75] [--w 1000 --h 700]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const pagePath = opt.page || 'dist/index.html', outDir = path.resolve(opt['out-dir'] || '.');
const ids = (opt.ids || '**,*x,22*,xx,22x,2*22').split(',');
const pats = (opt.pats || 'paisley,soft,tomoe,checker,comma').split(',');
const at = (opt.at || '0.3,0.5,0.75').split(',').map(Number);
const W = +opt.w || 1000, H = +opt.h || 700, disp = +opt.disp || 250;
fs.mkdirSync(outDir, { recursive: true });
const B = await openBrowser({ root });
const msgs = [];
let bad = 0;
try {
  const ctx = await B.browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') msgs.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => msgs.push('pageerror: ' + e.message));
  await page.goto(B.url(pagePath) + '#g=333', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
  await page.evaluate(() => window.__folding.ready);
  for (const id of ids) {
    const plan = await page.evaluate((g) => { const F = window.__folding; F.setGroup(g); return F.tilePlan(); }, id);
    const ph = plan && plan.phases.find((p) => /reflection|mirror|glide/i.test(p.text || ''));
    if (!ph) { console.log(`${id}: no phase that turns over: ${JSON.stringify(plan && plan.phases.map((p) => p.text))}`); continue; }
    const us = at.map((a) => ph.t0 + a * (ph.t1 - ph.t0));
    const rows = [];
    for (const u of us) {
      const shots = [];
      for (const pat of pats) {
        const st = await page.evaluate(([g, pat, u]) => { const F = window.__folding; F.setPattern(pat); if (F.getState().groupId !== g) F.setGroup(g); F.setT(0); F.setTile(u); const s = F.getState(); return { pattern: s.pattern, print: s.print, errors: s.errors, cap: s.tileCaption, tile: s.tile }; }, [id, pat, u]);
        await page.waitForTimeout(200);
        const box = await page.locator('#pane-plane').boundingBox();
        shots.push({ pat, st, b64: (await page.screenshot({ clip: box })).toString('base64') });
        if (st.pattern !== pat || !st.print || st.errors) { bad++; console.log(`PROBLEM ${id} ${pat} u=${u}: ${JSON.stringify(st)}`); }
      }
      rows.push({ u, shots });
    }
    await page.evaluate(() => window.__folding.setTile(1));
    const sheet = await ctx.newPage();
    await sheet.setViewportSize({ width: pats.length * (disp + 6) + 24, height: 600 });
    await sheet.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:8px;font:12px system-ui;background:#fff}.g{display:grid;grid-template-columns:repeat(${pats.length},${disp}px);gap:5px;margin-bottom:8px}figure{margin:0;border:1px solid #ddd}img{display:block;width:100%}figcaption{padding:1px 4px;color:#333}</style><div style="font-weight:600;margin-bottom:4px">${id} · the phase “${ph.text}” (u ${ph.t0.toFixed(3)}–${ph.t1.toFixed(3)})</div>${rows.map((r) => `<div style="margin:2px 0">u = ${r.u.toFixed(3)} · “${r.shots[0].st.cap}”</div><div class="g">${r.shots.map((x) => `<figure><img src="data:image/png;base64,${x.b64}"><figcaption>${x.pat}</figcaption></figure>`).join('')}</div>`).join('')}`);
    await sheet.waitForTimeout(150);
    const out = path.join(outDir, `tile-${id.replace(/[*]/g, 'S')}.png`);
    await sheet.screenshot({ path: out, fullPage: true });
    await sheet.close();
    console.log(`WROTE ${out}  (${ph.text}; ${plan.phases.length} phases)`);
  }
} finally { await B.close(); }
console.log('console messages: ' + (msgs.length ? msgs.join(' | ') : 'none'));
console.log(`done, ${bad} problems`);
process.exit(bad ? 1 : 0);
