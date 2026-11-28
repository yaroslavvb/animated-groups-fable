#!/usr/bin/env node
// measure.mjs — the integrator's numbers on site/index.html, one headless Chrome (1280x900, dpr 2):
//   · script time of a slider frame, part by part (pattern, cards, surface: model / bake / chart / pane), from
//     window.__pqrs.perf(): a Twist drag of 80 steps of 0.005 and a Length drag of 60 steps, each step drawn
//     (window.__pqrs.set(…, { dragging: true }) + flush), on each preset;
//   · the same drag paced by requestAnimationFrame: frames a second as the page saw them;
//   · an activation: script time, and how far the four marks of the Surface pane stand, at the first frame of the
//     turn, from where they stood before (pane.markAt: css px) — the turn should START where the solid was.
//   node dev/integration/measure.mjs [--phone]
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const PW = `${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const phone = process.argv.includes('--phone');
const file = resolve(here, '../../site/index.html');
const { chromium } = await import(pathToFileURL(PW).href);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--ignore-gpu-blocklist', '--enable-webgl'] });
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
try {
  const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 }, deviceScaleFactor: 2, isMobile: phone, hasTouch: phone });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  console.log(`# ${phone ? 'phone 390x844' : 'desktop 1280x900'}, dpr 2, headless Chrome`);
  for (const sig of ['3333', '2345', '2223', '4444', '2222']) {
    await page.goto(`${pathToFileURL(file).href}#k=${sig}`, { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(1500);
    // ---- slider frames, each drawn ----
    const drag = await page.evaluate(async () => {
      const q = window.__pqrs, s0 = q.state(), out = {};
      const run = (name, n, step) => {
        q.perfReset();
        const t0 = performance.now();
        for (let i = 1; i <= n; i++) q.set(step(i), { dragging: true });
        const wall = performance.now() - t0, d = q.perf().drag;
        out[name] = { n: d.n, wall: wall / n, total: d.total / d.n, worst: d.worst, pattern: d.pattern / d.n, cards: d.cards / d.n, surface: d.surface / d.n, model: d.model / d.n, bake: d.bakes ? d.bake / d.bakes : 0, bakes: d.bakes, chart: d.chart / d.n, pane: d.pane / d.n, rest: d.rest / d.n };
      };
      run('twist', 80, (i) => ({ tw: s0.tw + 0.005 * i }));
      q.set({ tw: s0.tw });
      await new Promise((r) => setTimeout(r, 600));
      const flat = s0.kind === 'E';
      run('length', 60, (i) => ({ L: s0.L * (1 + (flat ? 0.006 : 0.012) * i) }));
      q.set({ L: s0.L });
      await new Promise((r) => setTimeout(r, 600));
      // ---- the same Twist drag, one step an animation frame ----
      const fps = await new Promise((done) => {
        let i = 0; const t0 = performance.now(); let worst = 0, last = t0;
        const tick = () => {
          const t = performance.now(); worst = Math.max(worst, t - last); last = t;
          if (i >= 90) { done({ fps: (1000 * i) / (t - t0), worstGap: worst }); return; }
          i += 1; q.set({ tw: s0.tw + 0.004 * i }, { dragging: true });
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      q.set({ tw: s0.tw });
      const sf = q.surface();
      return { out, fps, restarts: q.model() ? q.model().restarts : null, stats: sf.stats && { mean: 100 * sf.stats.strainMean, worst: 100 * sf.stats.strainMax } };
    });
    for (const [name, d] of Object.entries(drag.out)) {
      console.log(`${sig} ${name} drag, ${d.n} frames: ${f2(d.total)} ms a frame (worst ${f2(d.worst)}) = pattern ${f2(d.pattern)} + cards ${f2(d.cards)} + surface ${f2(d.surface)} [model ${f2(d.model)}, bake ${f2(d.bake)} x ${d.bakes}, chart ${f2(d.chart)}, pane ${f2(d.pane)}] + table/address ${f2(d.rest)}`);
    }
    console.log(`${sig} twist drag paced by animation frames: ${f2(drag.fps.fps)} frames a second, longest gap ${f2(drag.fps.worstGap)} ms; cold restarts so far ${drag.restarts}`);
    await page.waitForTimeout(900);
    // ---- activations: script time, and the marks at the first frame of the turn ----
    for (const key of ['02|13', '03|12', '01|23']) {
      const r = await page.evaluate(async (k) => {
        const q = window.__pqrs, pane = q.pane();
        if (q.state().key === k) return null;
        const ids = ['P', 'Q', 'R', 'S'], before = ids.map((id) => pane.markAt(id));
        const t0 = performance.now();
        q.activate(k);
        const ms = performance.now() - t0, first = ids.map((id) => pane.markAt(id)), turning = !!pane.turning;
        await new Promise((res) => setTimeout(res, 1400));
        const after = ids.map((id) => pane.markAt(id));
        const d = (a, b) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : NaN);
        return { ms, turning, last: q.perf().last, jump: ids.map((_, i) => d(before[i], first[i])), moved: ids.map((_, i) => d(before[i], after[i])), w: pane.R && pane.R.stats ? null : null };
      }, key);
      if (!r) continue;
      console.log(`${sig} activate ${key}: ${f2(r.ms)} ms of script (pattern ${f2(r.last.pattern)}, cards ${f2(r.last.cards)}, surface ${f2(r.last.surface)}: model ${f2(r.last.model)}, bake ${f2(r.last.bake)}); turning ${r.turning}; marks at the first frame of the turn stand ${r.jump.map((x) => x.toFixed(1)).join(', ')} px from before; the flip itself moves them ${r.moved.map((x) => x.toFixed(0)).join(', ')} px`);
    }
  }
  if (errors.length) console.log('page errors / warnings:', errors.slice(0, 8).join(' | ')); else console.log('no console error or warning, no page error');
} finally {
  await browser.close();
}
