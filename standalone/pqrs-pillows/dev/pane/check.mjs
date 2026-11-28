#!/usr/bin/env node
// check.mjs — the pane on the harness page in headless Chrome: showFrame, turn, reduced motion, the wheel, times.
//   node check.mjs            (writes check.out.json and shots/turn-*.png)
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const PW = `${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const { chromium } = await import(pathToFileURL(PW).href);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--ignore-gpu-blocklist', '--enable-webgl'] });
const out = { when: new Date().toISOString(), checks: [], errors: [] };
const ok = (name, pass, detail) => { out.checks.push({ name, pass: !!pass, detail }); console.log((pass ? 'ok   ' : 'FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); };
const url = pathToFileURL(path.join(HERE, 'index.html')).href;
const markAt = (page, id) => page.evaluate((i) => { const q = window.__h.pane.markAt(i); return q ? [+q[0].toFixed(2), +q[1].toFixed(2)] : null; }, id);
const labelAt = (page, text) => page.evaluate((t) => { const e = [...document.querySelectorAll('.r3d-label')].find((x) => x.textContent === t && x.style.display !== 'none'); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; }, text);
const dist = (a, b) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : NaN);
try {
  // ---- desktop
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 800 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => out.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') out.errors.push(m.text()); });
  await page.goto(url + '#k=3333&mode=open', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__h && window.__h.ready);
  await page.waitForTimeout(700);
  ok('WebGL2 up', await page.evaluate(() => window.__h.pane.ok));
  const labels = await page.evaluate(() => window.__h.labels());
  ok('labels P3 Q3 R3 S3', ['P3', 'Q3', 'R3', 'S3'].every((l) => labels.includes(l)), labels);
  const colors = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.r3d-label')].map((e) => [e.textContent, getComputedStyle(e).color])));
  ok('labels in their pair\'s colour', colors.P3 === 'rgb(0, 114, 178)' && colors.R3 === 'rgb(176, 77, 0)', colors);
  const view = await page.evaluate(() => { const v = window.__h.pane.getView(); return [Math.round(v.az), Math.round(v.el), v.zoom]; });
  ok('home view az 70, el 14', view[0] === 70 && view[1] === 14, view);   // (the integrator, 27 Nov: was -20; state.js DEFAULT_UI says why)

  // ---- showFrame: a mesh is laid only when the version or the chart changed
  const sf = await page.evaluate(() => {
    const h = window.__h, st = h.state(), R = h.pane.R;
    const f = h.frame(), uv = h.p3.chartOf(f.corners);
    const a = h.pane.showFrame(f, { uv });                       // the same frame, the same chart
    const b = h.pane.showFrame(f);                               // no uv handed over: the chart is kept
    const uv2 = Float32Array.from(uv); uv2[0] += 1e-3;
    const c = h.pane.showFrame(f, { uv: uv2 });                  // another chart
    const d = h.pane.showFrame({ ...f, version: f.version + 1000 }, { uv: uv2 });   // another version
    const e = h.pane.showFrame(f, { uv: null });                 // no print
    const g = h.pane.showFrame(f, { uv });
    return { a: a.fresh, b: b.fresh, c: c.fresh, d: d.fresh, e: e.fresh, g: g.fresh, tris: R.stats.triangles, st: st.k };
  });
  ok('showFrame: same version + same chart moves positions only; a new chart or version lays the mesh', sf.a === false && sf.b === false && sf.c === true && sf.d === true && sf.e === true && sf.g === true, sf);

  // ---- turn
  const rest = await markAt(page, 'P');
  const started = await page.evaluate(() => window.__h.turn(90, 'x', 0.6));
  const at0 = await markAt(page, 'P'), turning0 = await page.evaluate(() => window.__h.pane.turning);
  await page.waitForTimeout(280);
  await (await page.$('.surf-box')).screenshot({ path: path.join(HERE, 'shots', 'turn-mid.png') });
  const mid = await markAt(page, 'P');
  await page.waitForTimeout(700);
  const end = await markAt(page, 'P'), turning1 = await page.evaluate(() => window.__h.pane.turning);
  ok('turn: starts turned, ends as the model has it', started === true && turning0 === true && turning1 === false && dist(at0, rest) > 60 && dist(end, rest) < 0.5, { rest, at0, mid, end, dist0: dist(at0, rest), distMid: dist(mid, rest), distEnd: dist(end, rest) });
  ok('turn: on its way between', dist(mid, rest) > 3 && dist(mid, rest) < dist(at0, rest), { distMid: dist(mid, rest) });
  // a turn given as surface-model gives it (old pose -> new pose) with { inverse: true } starts from the inverse rotation
  const inv = await page.evaluate(() => { const h = window.__h, c = Math.cos(1), s = Math.sin(1); const M = [c, -s, 0, s, c, 0, 0, 0, 1]; h.pane.turn(M, 5); return 0; });
  const zPlus = await markAt(page, 'P');
  await page.evaluate(() => { const c = Math.cos(1), s = Math.sin(1); window.__h.pane.turn([c, -s, 0, s, c, 0, 0, 0, 1], 5, { inverse: true }); });
  const zMinus = await markAt(page, 'P');
  await page.evaluate(() => window.__h.pane.turn(null));
  const back = await markAt(page, 'P');
  ok('turn: { inverse } turns the other way; turn(null) ends it at once', dist(zPlus, zMinus) > 40 && dist(back, rest) < 0.5, { zPlus, zMinus, back });

  // ---- the wheel turns the view; a wheel that scrolls the page is the page's
  const box = await (await page.$('#view')).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width / 2 + 9, box.y + box.height / 2 + 9);
  const v0 = await page.evaluate(() => { const v = window.__h.pane.getView(); return [v.az, v.el, v.zoom, window.scrollY]; });
  await page.mouse.wheel(60, 0);
  await page.waitForTimeout(150);
  const v1 = await page.evaluate(() => { const v = window.__h.pane.getView(); return [v.az, v.el, v.zoom, window.scrollY]; });
  ok('a wheel on the pane turns the view, the page stays', Math.abs(v1[0] - v0[0]) > 2 && v1[2] === v0[2] && v1[3] === v0[3], { before: v0, after: v1 });
  const head = await (await page.$('h1')).boundingBox();
  await page.mouse.move(head.x + 40, head.y + 10);
  await page.mouse.wheel(0, 60);
  await page.waitForTimeout(60);
  await page.mouse.wheel(0, 60);
  await page.waitForTimeout(200);
  const v2 = await page.evaluate(() => { const v = window.__h.pane.getView(); return [v.az, v.el, v.zoom, window.scrollY]; });
  ok('a wheel that scrolls the page leaves the view alone', v2[3] > v1[3] && Math.abs(v2[0] - v1[0]) < 1e-6 && Math.abs(v2[1] - v1[1]) < 1e-6 && v2[2] === v1[2], { before: v1, after: v2 });
  await page.evaluate(() => window.scrollTo(0, 0));

  // ---- the REAL surface model: its frame through showFrame, and a flip through turn (no jump at the start)
  for (const [k, i, j] of [['3333', 0, 2], ['2345', 0, 3], ['2222', 0, 2]]) {
    const shown = await page.evaluate(([kk]) => { const r = window.__h.show({ k: kk, mode: 'model', tw: kk === '2222' ? 0.2 : 0.1, j: 0 }); return { tris: r.triangles, print: !!r.print, labels: window.__h.labels() }; }, [k]);
    await page.waitForTimeout(250);
    await (await page.$('.surf-box')).screenshot({ path: path.join(HERE, 'shots', `model-${k}.png`) });
    const fl = await page.evaluate(([a, b]) => window.__h.flip(a, b, 0.6), [i, j]);
    const turning = await page.evaluate(() => window.__h.pane.turning);
    await page.waitForTimeout(900);
    const done = await page.evaluate(() => window.__h.pane.turning);
    await (await page.$('.surf-box')).screenshot({ path: path.join(HERE, 'shots', `model-${k}-flipped.png`) });
    const worst = Math.max(...(fl.jumpAtStart || [NaN]).filter((x) => Number.isFinite(x)));
    ok(`model ${k}: frame shown with its print and labels; flip to (${i}, ${j}): the marks stay put at the start of the turn`, shown.print && shown.labels.length === 4 && !fl.error && (fl.cold || (fl.started && turning && !done && worst < 20)), { shown, worstJumpPx: worst, fl, turning, done });   // (the rest of the jump is the model's carry, which is not rigid: see NOTES)
  }
  for (const jj of [1, 2]) {
    await page.evaluate((v) => window.__h.show({ k: '3333', mode: 'model', tw: 0.1, j: v }), jj);
    await page.waitForTimeout(250);
    await (await page.$('.surf-box')).screenshot({ path: path.join(HERE, 'shots', `model-3333-j${jj}.png`) });
  }

  // ---- times in this browser
  out.bench = {};
  for (const [k, mode] of [['3333', 'open'], ['2345', 'open'], ['2222', 'open'], ['2223', 'open']]) {
    await page.evaluate(([kk, mm]) => window.__h.show({ k: kk, mode: mm, pattern: false }), [k, mode]);
    out.bench[k] = await page.evaluate(() => window.__h.bench());
    console.log('bench', k, JSON.stringify(out.bench[k]));
  }
  await ctx.close();

  // ---- reduced motion: no turn
  const ctx2 = await browser.newContext({ viewport: { width: 1400, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', (e) => out.errors.push(String(e)));
  await p2.goto(url + '#k=3333&mode=open', { waitUntil: 'load' });
  await p2.waitForFunction(() => window.__h && window.__h.ready);
  await p2.waitForTimeout(600);
  const r0 = await markAt(p2, 'P');
  const st2 = await p2.evaluate(() => window.__h.turn(90, 'x', 0.6));
  const r1 = await markAt(p2, 'P');
  ok('reduced motion: turn() does nothing (the new pose at once)', st2 === false && dist(r0, r1) < 0.5, { started: st2, r0, r1 });
  await ctx2.close();

  // ---- the pane's own `chart` option: no uv is handed over, the chart is asked when the corners change
  const ctx4 = await browser.newContext({ viewport: { width: 1400, height: 800 }, deviceScaleFactor: 1 });
  const p4 = await ctx4.newPage();
  p4.on('pageerror', (e) => out.errors.push(String(e)));
  await p4.goto(url + '#k=3333&mode=model&chart=1', { waitUntil: 'load' });
  await p4.waitForFunction(() => window.__h && window.__h.ready);
  await p4.waitForTimeout(500);
  const own = await p4.evaluate(() => {
    const h = window.__h, f = h.frame(), charted = h.pane.charted;
    const again = h.pane.showFrame(f);                                  // the same frame: the chart is kept, nothing laid
    const moved = h.pane.showFrame({ ...f, cornersVersion: f.cornersVersion + 1 });   // corners "changed" (to the same): asked anew, equal, nothing laid
    const r = h.show({ tw: 0.13, mode: 'model' });                      // another state: a new chart
    return { charted, again: again.fresh, moved: moved.fresh, next: r.mesh.fresh, chartedAfter: h.pane.charted };
  });
  ok('chart option: the pane charts by itself; the same corners lay nothing, a new state lays the mesh', own.charted && own.again === false && own.moved === false && own.next === true && own.chartedAfter, own);
  await ctx4.close();

  // ---- a phone-size context: the pane draws, labels there
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p3 = await ctx3.newPage();
  p3.on('pageerror', (e) => out.errors.push(String(e)));
  await p3.goto(url + '#k=2345&mode=solved', { waitUntil: 'load' });
  await p3.waitForFunction(() => window.__h && window.__h.ready);
  await p3.waitForTimeout(900);
  const l3 = await p3.evaluate(() => window.__h.labels());
  ok('phone context: labels P2 Q3 R4 S5', ['P2', 'Q3', 'R4', 'S5'].every((l) => l3.includes(l)), l3);
  await (await p3.$('.hpanes')).screenshot({ path: path.join(HERE, 'shots', 'phone-2345.png') });
  await ctx3.close();
  ok('no page error', out.errors.length === 0, out.errors.slice(0, 4));
} finally {
  await browser.close();
  fs.writeFileSync(path.join(HERE, 'check.out.json'), JSON.stringify(out, null, 1));
}
const failed = out.checks.filter((c) => !c.pass).length;
console.log(`${out.checks.length - failed} of ${out.checks.length} checks pass`);
process.exit(failed ? 1 : 0);
