// scratch-review-chrome/perf.mjs — what the six patterns cost on the BUILT page in Chrome (the pool on the mini), each
// against the checkerboard:
//   load    a fresh page #g=333&pat=<key> (no pat for Paisley): navigation start -> the first scene built and drawn
//           (api.ready assigned, caught by an init script), -> first-contentful-paint, -> api.ready resolved (2 frames)
//   cold    F.setGroup over 16 groups with the warmer stopped (each print made inside its setGroup): the call's own ms and
//           the ms until two animation frames later (the picture on screen)
//   warm    the same after the page was left idle until the warmer had made the other groups' prints
//   plane   F.plane.render() x 10 on 333, *632, o (the cached layers), the layers' own build (plane.stats.printMs), and
//           with the Tile step at u = 0.5 (the cards: one Path2D each)
//   spin    60 frames of F.setView turning the 3D view (rAF intervals; renderer.stats.cpuMs) on 333 at t = 1 and o at 0.6
//   fold    F.setT over 0..1 in 40 steps: each call's ms (the fold's frame on the page's thread)
//   FOLDING_BROWSER=mini node dev/patterns/scratch-review-chrome/perf.mjs --json <file> [--pats a,b] [--reps 2] [--parts load,cold,warm,plane,spin,fold]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const pagePath = opt.page || 'dist/index.html';
const pats = (opt.pats || 'paisley,soft,tomoe,checker,rings,comma').split(',');
const parts = new Set((opt.parts || 'load,cold,warm,naive,plane,spin,fold').split(','));
const reps = +opt.reps || 2;
const IDS = ['o', '2222', '**', 'xx', '*x', '333', '22x', '22*', '*2222', '2*22', '442', '632', '3*3', '*333', '4*2', '*442', '*632'];
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[(s.length - 1) >> 1] : NaN; };
const r1 = (x) => Math.round(x * 10) / 10;
const INIT = () => {
  window.__perf = { api: null, built: null };
  let real;
  Object.defineProperty(window, '__folding', {
    configurable: true,
    get() { return real; },
    set(v) {
      real = v; window.__perf.api = performance.now();
      let rd = v.ready;
      try { Object.defineProperty(v, 'ready', { configurable: true, enumerable: true, get() { return rd; }, set(p) { if (window.__perf.built === null) window.__perf.built = performance.now(); rd = p; } }); } catch (e) { /* keep going */ }
    },
  });
};
const B = await openBrowser({ root });
const out = { page: pagePath, where: B.where, pats: {} };
const msgs = [];
async function fresh(hash, { init = false, w = 1280, h = 720 } = {}) {
  const ctx = await B.browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  if (init) await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') msgs.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => msgs.push('pageerror: ' + e.message));
  await page.goto(B.url(pagePath) + hash, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
  await page.evaluate(() => window.__folding.ready);
  return { ctx, page };
}
// (after: run right after the timed call, untimed: the cold pages stop the warmer again there, because every
// setGroup's rebuild calls warmer.warm(), which starts it again — a stop() before the loop holds for ONE group change)
const frameAfter = (page, fn, arg, after = '') => page.evaluate(([src, a, post]) => new Promise((resolve) => {
  const f = new Function('a', src), g = new Function('a', post);
  const t0 = performance.now();
  f(a);
  const t1 = performance.now();
  g(a);
  requestAnimationFrame(() => requestAnimationFrame(() => resolve([t1 - t0, performance.now() - t0])));
}), [fn, arg, after]);
try {
  for (const pat of pats) {
    const R = (out.pats[pat] = {});
    const ph = pat === 'paisley' ? '' : `&pat=${pat}`;
    if (parts.has('load')) {
      const rows = [];
      for (let rep = 0; rep < reps + 1; rep++) {
        const { ctx, page } = await fresh(`#g=333${ph}`, { init: true });
        const r = await page.evaluate(() => {
          const nav = performance.getEntriesByType('navigation')[0], fcp = performance.getEntriesByName('first-contentful-paint')[0];
          return { built: window.__perf.built, api: window.__perf.api, fcp: fcp ? fcp.startTime : null, dcl: nav ? nav.domContentLoadedEventEnd : null, resp: nav ? nav.responseEnd : null, pattern: window.__folding.getState().pattern };
        });
        if (r.pattern !== pat) msgs.push(`load ${pat}: opened with ${r.pattern}`);
        rows.push(r);
        await ctx.close();
      }
      R.load = { built: r1(med(rows.map((r) => r.built - r.resp))), fcp: r1(med(rows.map((r) => r.fcp))), builtAbs: r1(med(rows.map((r) => r.built))), rows };
      console.log(`${pat.padEnd(8)} load: response end -> first scene drawn ${R.load.built} ms (median of ${rows.length}); FCP ${R.load.fcp} ms; built at ${R.load.builtAbs} ms`);
    }
    for (const mode of ['cold', 'warm', 'naive']) {
      if (!parts.has(mode)) continue;
      const all = {}, frames = {};
      let warmer = null;
      for (let rep = 0; rep < (mode === 'naive' ? 1 : reps); rep++) {
        const { ctx, page } = await fresh(`#g=%2A632${ph}`);
        if (mode === 'cold' || mode === 'naive') await page.evaluate(() => window.__folding.warmer.stop());
        else {
          const t0 = Date.now();
          while (Date.now() - t0 < 30000) {
            const w = await page.evaluate(() => window.__folding.getState().warm);
            if (w && w.left === 0 && w.made + w.skipped >= 16) break;
            await page.waitForTimeout(250);
          }
          warmer = await page.evaluate(() => window.__folding.getState().warm);
        }
        for (const id of IDS.filter((g) => g !== '*632')) {
          // naive: the integrator's way (stop() once, before the loop); cold: stopped again after every change
          const [ms, fr] = await frameAfter(page, 'window.__folding.setGroup(a)', id, mode === 'cold' ? 'window.__folding.warmer.stop()' : '');
          (all[id] = all[id] || []).push(ms); (frames[id] = frames[id] || []).push(fr);
          const st = await page.evaluate(() => { const s = window.__folding.getState(); return { pattern: s.pattern, kind: s.printKind, errors: s.errors }; });
          if (st.pattern !== pat || !st.kind || st.errors) msgs.push(`${mode} ${pat} ${id}: ${JSON.stringify(st)}`);
          await page.waitForTimeout(400);
        }
        if (mode !== 'warm') warmer = await page.evaluate(() => window.__folding.getState().warm);
        await ctx.close();
      }
      const per = Object.fromEntries(Object.entries(all).map(([id, v]) => [id, r1(med(v))])), perF = Object.fromEntries(Object.entries(frames).map(([id, v]) => [id, r1(med(v))]));
      const vals = Object.values(per), fvals = Object.values(perF);
      R[mode] = { median: r1(med(vals)), max: r1(Math.max(...vals)), maxId: Object.keys(per)[vals.indexOf(Math.max(...vals))], frameMedian: r1(med(fvals)), frameMax: r1(Math.max(...fvals)), per, perF, warmer };
      console.log(`${pat.padEnd(8)} setGroup ${mode}: median ${R[mode].median} ms, max ${R[mode].max} (${R[mode].maxId}); to the 2nd frame: median ${R[mode].frameMedian}, max ${R[mode].frameMax}${warmer ? '; warmer ' + JSON.stringify({ made: warmer.made, ms: warmer.ms, maxMs: warmer.maxMs, passed: warmer.passed }) : ''}`);
    }
    if (parts.has('plane') || parts.has('spin') || parts.has('fold')) {
      const { ctx, page } = await fresh(`#g=333${ph}`);
      await page.evaluate(() => window.__folding.warmer.stop());
      if (parts.has('plane')) {
        R.plane = {};
        for (const id of ['333', '*632', 'o', 'xx']) {
          const r = await page.evaluate(async (g) => {
            const F = window.__folding;
            F.setGroup(g); F.setT(0);
            await new Promise((res) => setTimeout(res, 450));            // (the zoom's glide home)
            const P = F.plane, build = P.stats.printMs;
            const ms = [];
            for (let i = 0; i < 10; i++) { const t0 = performance.now(); P.render(); ms.push(performance.now() - t0); }
            F.setTile(0.5);
            const tile = [];
            for (let i = 0; i < 10; i++) { const t0 = performance.now(); P.render(); tile.push(performance.now() - t0); }
            F.setTile(1);
            ms.sort((a, b) => a - b); tile.sort((a, b) => a - b);
            return { layers: build, draw: ms[4], drawMax: ms[9], tile: tile[4], tileMax: tile[9] };
          }, id);
          R.plane[id] = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, r1(v)]));
        }
        console.log(`${pat.padEnd(8)} plane: ` + Object.entries(R.plane).map(([id, r]) => `${id} layers ${r.layers} draw ${r.draw} (max ${r.drawMax}) tile ${r.tile} (max ${r.tileMax})`).join(' | '));
      }
      if (parts.has('spin')) {
        R.spin = {};
        for (const [id, t] of [['333', 1], ['o', 0.6], ['xx', 1]]) {
          const r = await page.evaluate(([g, tt]) => new Promise((resolve) => {
            const F = window.__folding;
            F.setGroup(g); F.setT(tt);
            setTimeout(() => {
              const gaps = [], cpu = [];
              let last = performance.now(), k = 0;
              const step = () => {
                const now = performance.now();
                if (k > 0) gaps.push(now - last);
                last = now;
                F.setView(20 + k * 3, 25);
                cpu.push(F.renderer.stats.cpuMs);
                if (++k <= 60) requestAnimationFrame(step);
                else { gaps.sort((a, b) => a - b); cpu.sort((a, b) => a - b); resolve({ gap: gaps[gaps.length >> 1], gap90: gaps[Math.floor(gaps.length * 0.9)], gapMax: gaps[gaps.length - 1], cpu: cpu[cpu.length >> 1], cpuMax: cpu[cpu.length - 1] }); }
              };
              requestAnimationFrame(step);
            }, 450);
          }), [id, t]);
          R.spin[id + '@' + t] = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, r1(v)]));
        }
        console.log(`${pat.padEnd(8)} spin: ` + Object.entries(R.spin).map(([k, r]) => `${k} frame ${r.gap} ms (p90 ${r.gap90}, max ${r.gapMax}), cpu ${r.cpu} (max ${r.cpuMax})`).join(' | '));
      }
      if (parts.has('fold')) {
        R.fold = {};
        for (const id of ['333', 'xx', '22x', '*632']) {
          const r = await page.evaluate((g) => {
            const F = window.__folding;
            F.setGroup(g);
            const ms = [];
            for (let i = 0; i <= 40; i++) { const t0 = performance.now(); F.setT(i / 40); ms.push(performance.now() - t0); }
            ms.sort((a, b) => a - b);
            return { med: ms[20], max: ms[40] };
          }, id);
          R.fold[id] = { med: r1(r.med), max: r1(r.max) };
        }
        console.log(`${pat.padEnd(8)} fold setT: ` + Object.entries(R.fold).map(([id, r]) => `${id} ${r.med} (max ${r.max})`).join(' | '));
      }
      await ctx.close();
    }
  }
} finally { await B.close(); }
out.msgs = msgs;
console.log('console messages: ' + (msgs.length ? msgs.slice(0, 10).join(' | ') : 'none'));
if (opt.json) { fs.mkdirSync(path.dirname(path.resolve(opt.json)), { recursive: true }); fs.writeFileSync(path.resolve(opt.json), JSON.stringify(out, null, 1)); console.log('WROTE ' + opt.json); }
