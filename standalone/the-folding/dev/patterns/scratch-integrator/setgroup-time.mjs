// dev/patterns/scratch-integrator/setgroup-time.mjs — how long a group change takes on the page's thread, per pattern and
// group, in a real Chrome (the pool on the mini): COLD (nothing made ahead: __folding.warmer.stop() at once, so every
// group's print is made inside its setGroup) and WARM (the page left idle until the warmer has made the other groups'
// prints: a group change finds its print in printFor's cache). Also what the warmer spent per group.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-integrator/setgroup-time.mjs [--page dev/app-demo.html] [--pats paisley,soft,tomoe]
//        [--reps 2] [--json <file>]   (each group once per page; the smaller of two pages per group with --reps 2)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const pats = (opt.pats || 'paisley,soft,tomoe').split(','), pagePath = opt.page || 'dev/app-demo.html';
const IDS = ['o', '2222', '**', 'xx', '*x', '333', '22x', '22*', '*2222', '2*22', '442', '632', '3*3', '*333', '4*2', '*442', '*632'];
const B = await openBrowser({ root });
const out = { page: pagePath, where: B.where, rows: {} };
try {
  const reps = +opt.reps || 2;
  for (const pat of pats) {
    const res = { cold: {}, warm: {}, warmer: null }, all = { cold: {}, warm: {} };
    for (let rep = 0; rep < reps; rep++) for (const mode of ['cold', 'warm']) {
      const ctx = await B.browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
      // the page opens on *632 with the pattern (its own print made at load), then every group in the picker's order
      await page.goto(B.url(pagePath) + `#g=%2A632&pat=${pat}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
      await page.evaluate(() => window.__folding.ready);
      if (mode === 'cold') await page.evaluate(() => window.__folding.warmer.stop());
      else {
        // left alone until the warmer is done (or 30 s)
        const t0 = Date.now();
        while (Date.now() - t0 < 30000) {
          const w = await page.evaluate(() => window.__folding.getState().warm);
          if (w && w.key === pat && w.left === 0 && w.made + w.skipped >= 16) break;
          await page.waitForTimeout(250);
        }
        res.warmer = await page.evaluate(() => window.__folding.getState().warm);
      }
      for (const id of IDS.filter((g) => g !== '*632')) {
        const ms = await page.evaluate((g) => { const t0 = performance.now(); window.__folding.setGroup(g); return performance.now() - t0; }, id);
        const st = await page.evaluate(() => { const s = window.__folding.getState(); return { pattern: s.pattern, kind: s.printKind, errors: s.errors }; });
        if (st.pattern !== pat || !st.kind || st.errors) errs.push(`${id}: ${JSON.stringify(st)}`);
        (all[mode][id] = all[mode][id] || []).push(ms);
        // (the same pause in both modes: the zoom's glide home, 0.35 s, is over before the next change; the warmer is
        // stopped in the cold page and done in the warm one)
        await page.waitForTimeout(400);
      }
      if (errs.length) console.log(`${pat} ${mode}: ` + errs.slice(0, 4).join(' | '));
      await ctx.close();
    }
    for (const mode of ['cold', 'warm']) for (const [id, v] of Object.entries(all[mode])) { const s = v.slice().sort((a, b) => a - b); res[mode][id] = +s[(s.length - 1) >> 1].toFixed(1); }
    out.rows[pat] = res;
    const ids = Object.keys(res.cold), med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
    const c = ids.map((g) => res.cold[g]), w = ids.map((g) => res.warm[g]);
    console.log(`${pat.padEnd(8)} setGroup cold: median ${med(c).toFixed(1)} ms, max ${Math.max(...c).toFixed(1)} (${ids[c.indexOf(Math.max(...c))]});  warm: median ${med(w).toFixed(1)}, max ${Math.max(...w).toFixed(1)} (${ids[w.indexOf(Math.max(...w))]});  warmer: ${JSON.stringify(res.warmer)}`);
    console.log('   ' + ids.map((g) => `${g} ${res.cold[g]}/${res.warm[g]}`).join('  '));
  }
} finally { await B.close(); }
if (opt.json) { fs.mkdirSync(path.dirname(path.resolve(opt.json)), { recursive: true }); fs.writeFileSync(path.resolve(opt.json), JSON.stringify(out, null, 1)); console.log('WROTE ' + opt.json); }
