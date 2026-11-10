#!/usr/bin/env node
// qa-matrix.mjs — the built page in ONE headless Chrome: every group folded and unfolded at laptop and phone size,
// the picker, every cut, and (with --interact) a scripted session with real mouse, keyboard and touch input.
// OWNER: integrator.
//
//   node tools/qa-matrix.mjs [--page dist/index.html] [--out qa/matrix] [--groups 333,22x] [--interact] [--only-interact]
//                            [--limit 300] [--dpr 1]
//
// For every group (SPEC 5.12):   t = 0, 0.5, 1 at 1280 x 720   ->  <out>/<id>-1280-<t>.png
//                                t = 0, 1      at  390 x 780   ->  <out>/<id>-390-<t>.png
// then the picker open at both sizes (<out>/picker-1280.png, picker-390.png), with a node picked by a real click;
// then five more window sizes (<out>/size-<w>x<h>.png: big laptop, tablet, phone on its side, two small phones);
// then every preset of every group, straight and wavy, at t = 0.5 and t = 1 (numbers only), with one picture of the
// wavy default cut folded shut per group that has a cut (<out>/<id>-1280-wavy.png), and the time a drag step takes.
// In file names "s" stands for "*" (s632 = *632, 22s = 22*, ss = **, sx = *x), which is kinder to shells.
//
// --interact adds (pictures <out>/interact-*.png, touch-390.png, frame-1280.png):
//   mouse and keys   drag the cut, preset chips, the Wavy slider, turn the 3D view and see that nothing but
//                    "reset view" resets its orientation, Fold / Pause / Unfold, Space, the scrubber's soft magnets,
//                    the seams sliding over the folded shape, the wheel (the zoom stays within a group and glides
//                    back to 1 on a group change), the URL (SPEC 7: every parameter in the hash, a reload brings the
//                    state back, legacy #<id> links, a hash that names nothing), arrow keys, the anchor (SPEC 7)
//                    through all of it, the kaleidoscopes (nothing to cut: no hint, no drag; SPEC 8 C1, C2)
//   touch            the same page in a phone-sized context with touch input and devicePixelRatio 2: a finger drags
//                    the cut, turns the view, scrubs, taps Fold and the picker; two fingers zoom; nothing scrolls;
//                    a finger on a kaleidoscope's plane changes nothing
//   frame            the page inside dev/app-frame.html (a stand-in of the spacesheep viewer: a frame of its own
//                    origin under a 50 px bar; dist runs there in the strictest, opaque-origin sandbox): the host's
//                    address follows the state (ss-hash), and that address opened afresh shows the same state
//
// Beyond the pictures, every shot is measured in the page, so that a blank canvas or a broken layout fails the run
// without anybody looking:
//   fold     share of the 3D canvas that is not background (read back from the drawing buffer right after a render)
//   plane    share of the 2D canvas that is not white
//   labels   visible cone-point labels
//   seam     the largest gap between glued boundary points, in tile sizes (must be < 1e-6 at t = 1)
//   layout   nothing scrolls, nothing leaves the window, panes and controls do not overlap, tap targets >= 44 px
// Console errors, uncaught page errors and whatever the app caught itself (window.__folding.errors) are printed
// and counted. <out>/report.json has the numbers of every shot. Exit code 0 only if nothing failed.
//
// The page is served over http from an ephemeral local port by this process itself, for the length of the run
// (as tools/shot.mjs does). Never run this while another tools/shot.mjs or qa-matrix.mjs is running.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from './browser.mjs';
import { GROUPS } from '../src/groups.js';
import { decodeHash, presetState } from '../src/app.js';

const PLAYWRIGHT = process.env.PLAYWRIGHT_MJS ||
  '/Users/yaroslavvb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const args = process.argv.slice(2);
const opt = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (!a.startsWith('--')) continue;
  const k = a.slice(2);
  if (['interact', 'only-interact', 'help'].includes(k)) opt[k] = true; else opt[k] = args[++i];
}
if (opt.help) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 26).join('\n')); process.exit(0); }

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const pagePath = opt.page || 'dist/index.html';
const outDir = path.resolve(root, opt.out || 'qa/matrix');
const LIMIT = Number(opt.limit || 300) * 1000;
const DESKTOP = { width: 1280, height: 720 }, PHONE = { width: 390, height: 780 };
const fileId = (id) => id.replace(/\*/g, 's');

if (!fs.existsSync(path.join(root, pagePath.split('#')[0].split('?')[0]))) {
  console.error(`qa-matrix: ${pagePath} does not exist (node build.mjs builds dist/index.html)`);
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

// The browser: a Chrome of the pool on the mini when one is free, else one on this Mac (tools/browser.mjs).
const B = await openBrowser({ root });
const browser = B.browser;
const url = B.url(pagePath);
console.log('browser: ' + B.where);

const consoleErrors = [], pageErrors = [], problems = [], shots = [], checks = [], pictures = [], report = {};
const t0 = Date.now();
let finished = false;
const watchdog = setTimeout(async () => {
  if (finished) return;
  console.log(`WATCHDOG: the run took longer than ${LIMIT / 1000} s: stopping the browser (${shots.length} shots written)`);
  await B.close();
  process.exit(2);
}, LIMIT);

// ---- what is measured in the page after every step ------------------------------------------------------------------
const MEASURE = `(() => {
  const F = window.__folding, st = F.getState();
  const R = F.renderer;
  let fold = null;
  try {
    R.render();
    const gl = R.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let n = 0;
    const r0 = px[0], g0 = px[1], b0 = px[2], a0 = px[3];
    for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - r0) + Math.abs(px[i + 1] - g0) + Math.abs(px[i + 2] - b0) + Math.abs(px[i + 3] - a0) > 24) n++;
    fold = n / (w * h);
  } catch (e) { fold = 'error: ' + e.message; }
  let plane = null;
  try {
    const c = document.getElementById('plane-canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 720) n++;
    plane = n / (c.width * c.height);
  } catch (e) { plane = 'error: ' + e.message; }
  // (a copy of an orbifold point carries an invisible tag in its label text, and fades: src/app.js sceneMarkers)
  const labels = [...document.querySelectorAll('#fold-labels .r3d-label')].filter((n) => n.style.display !== 'none' && !(Number(n.style.opacity || 1) < 0.05))
    .map((n) => n.textContent.replace(/\\u200b/g, ''));
  const shown = (id) => { const n = document.getElementById(id); return !!n && !n.hidden && n.getClientRects().length > 0 && getComputedStyle(n).display !== 'none'; };
  // layout
  const vw = window.innerWidth, vh = window.innerHeight, issues = [];
  const rect = (node) => { const r = node.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
  const doc = document.documentElement;
  if (doc.scrollWidth > vw + 0.5 || doc.scrollHeight > vh + 0.5 || document.body.scrollHeight > vh + 0.5) issues.push('the page scrolls (' + doc.scrollWidth + ' x ' + doc.scrollHeight + ' in ' + vw + ' x ' + vh + ')');
  const ids = ['header', 'caption', 'pane-plane', 'plane-controls', 'pane-fold', 'fold-controls', 'legend'];
  const boxes = ids.map((id) => [id, rect(document.getElementById(id))]);
  for (const [id, b] of boxes) if (b.x < -0.5 || b.y < -0.5 || b.r > vw + 0.5 || b.b > vh + 0.5) issues.push('#' + id + ' leaves the window');
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i][1], b = boxes[j][1];
    const ox = Math.min(a.r, b.r) - Math.max(a.x, b.x), oy = Math.min(a.b, b.b) - Math.max(a.y, b.y);
    if (ox > 1 && oy > 1) issues.push('#' + boxes[i][0] + ' overlaps #' + boxes[j][0]);
  }
  const pp = rect(document.getElementById('pane-plane')), pf = rect(document.getElementById('pane-fold'));
  if (pp.w < 150 || pp.h < 150) issues.push('the plane pane is ' + Math.round(pp.w) + ' x ' + Math.round(pp.h));
  if (pf.w < 150 || pf.h < 150) issues.push('the fold pane is ' + Math.round(pf.w) + ' x ' + Math.round(pf.h));
  for (const node of document.querySelectorAll('#app button, #app a[href], #app [data-scrub]')) {
    if (!node.getClientRects().length) continue;
    const b = rect(node);
    if (b.w < 43.5 || b.h < 43.5) issues.push('tap target ' + (node.id ? '#' + node.id : node.textContent.trim().slice(0, 14)) + ' is ' + Math.round(b.w) + ' x ' + Math.round(b.h));
    if (b.x < -0.5 || b.r > vw + 0.5 || b.b > vh + 0.5) { if (!node.closest('#presets')) issues.push('control ' + (node.id || node.textContent.trim().slice(0, 14)) + ' leaves the window'); }
  }
  for (const id of ['chip-symbol', 'caption']) { const n = document.getElementById(id); if (n.scrollWidth > n.clientWidth + 1) issues.push('#' + id + ' is cut off'); }
  if (!document.getElementById('chip-symbol').textContent || !document.getElementById('caption').textContent) issues.push('chip or caption is empty');
  const pressed = [...document.querySelectorAll('#presets .chip')].map((c) => c.getAttribute('aria-pressed') === 'true');
  return { state: st, fold, plane, labels, issues, panes: [Math.round(pp.w), Math.round(pp.h), Math.round(pf.w), Math.round(pf.h)],
    pressed, hintHidden: document.getElementById('hint').hidden, hint: document.getElementById('hint').textContent,
    chip: document.getElementById('chip-symbol').textContent + ' ' + document.getElementById('chip-meta').textContent,
    caption: document.getElementById('caption').textContent, wavyDisabled: document.getElementById('wavy').disabled,
    foldAttr: document.getElementById('app').dataset.fold, features: document.getElementById('app').dataset.features,
    cutNote: shown('cut-note'), presetsShown: shown('presets'), wavyShown: shown('wavy-field'), turnHint: shown('turn-hint'),
    appErrors: F.errors.slice(), stats: R.stats ? { triangles: R.stats.triangles, cpuMs: R.stats.cpuMs } : null };
})()`;

const note = (what) => { problems.push(what); console.log('PROBLEM ' + what); };
const check = (name, ok, detail = '') => {
  checks.push({ name, ok: !!ok, detail });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  — ' + detail : ''));
  if (!ok) problems.push('interaction: ' + name + (detail ? ' (' + detail + ')' : ''));
};

let page;
try {
  const ctx = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: Number(opt.dpr || 1) });
  page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') { consoleErrors.push(m.text()); console.log('CONSOLE ERROR ' + m.text()); }
  });
  page.on('pageerror', (e) => { pageErrors.push(e.message); console.log('PAGE ERROR ' + e.message); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
  const first = await page.evaluate(() => window.__folding.ready);
  console.log(`loaded ${pagePath}: group ${first.groupId}, webgl ${first.webgl}, ${Date.now() - t0} ms`);
  if (!first.webgl) note('WebGL2 is not available in this Chrome: the 3D pane is empty');
  const ids = GROUPS.map((g) => g.id);                      // display order: o first, *632 last
  const groups = opt.groups ? opt.groups.split(',').map((s) => s.trim()).map((s) => ids.find((id) => id === s || fileId(id) === s)).filter(Boolean) : ids;
  if (!groups.length) note(`--groups ${opt.groups}: no such group (known: ${ids.map(fileId).join(' ')})`);

  const settle = async (ms = 60) => {
    await page.evaluate(() => new Promise((r) => { let done = false; const fin = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(() => requestAnimationFrame(fin)); setTimeout(fin, 400); }));
    if (ms) await page.waitForTimeout(ms);
  };
  const measure = () => page.evaluate(MEASURE);

  async function shoot(id, size, t) {
    const file = `${fileId(id)}-${size.width}-${t}.png`;
    const st = await page.evaluate(([g, tt]) => { const F = window.__folding; if (F.getState().groupId !== g) F.setGroup(g); return F.setT(tt); }, [id, t]);
    await settle();
    const m = await measure();
    await page.screenshot({ path: path.join(outDir, file) });
    const rec = { file, id, w: size.width, h: size.height, t, seam: m.state.seamGap, nonFinite: m.state.nonFinite, fold: m.fold, plane: m.plane,
      labels: m.labels, panes: m.panes, issues: m.issues, triangles: m.state.triangles, appErrors: m.appErrors.length, cpuMs: m.stats && m.stats.cpuMs };
    shots.push(rec);
    const where = `${id} ${size.width} t=${t}`;
    if (st.groupId !== id) note(`${where}: the group is ${st.groupId}`);
    if (Math.abs(m.state.t - t) > 1e-9) note(`${where}: t is ${m.state.t}`);
    if (!(typeof m.fold === 'number' && m.fold > 0.02)) note(`${where}: the 3D canvas is blank (${m.fold})`);
    if (!(typeof m.plane === 'number' && m.plane > 0.03)) note(`${where}: the plane canvas is blank (${m.plane})`);
    if (m.state.nonFinite) note(`${where}: ${m.state.nonFinite} points are not finite`);
    if (t === 1 && m.state.seamGap !== null && !(m.state.seamGap < 1e-6)) note(`${where}: the seams are open at t = 1 (${m.state.seamGap} tile sizes)`);
    if (t === 0 && m.state.seamGap !== null && !(m.state.seamGap > 1e-3)) note(`${where}: the seam readout says closed at t = 0`);
    for (const i of m.issues) note(`${where}: ${i}`);
    if (m.appErrors.length) note(`${where}: the app caught ${m.appErrors.length} errors: ${m.appErrors[m.appErrors.length - 1]}`);
    // the URL (SPEC 7): the hash this state writes names the group, and the address has it within the throttle
    const u = decodeHash(m.state.url);
    if (!u || u.legacy || u.g !== id || Math.abs(u.t - t) > 5e-4) note(`${where}: the state's hash is ${m.state.url}`);
    const follows = await page.waitForFunction(() => location.hash === window.__folding.getState().url, null, { timeout: 1500 }).then(() => true, () => false);
    if (!follows) note(`${where}: the address does not follow: ${await page.evaluate(() => location.hash)} for ${m.state.url}`);
    return rec;
  }

  if (!opt['only-interact']) {
    // ---- the matrix: laptop, then phone (one resize) ----------------------------------------------------------------
    for (const id of groups) for (const t of [0, 0.5, 1]) await shoot(id, DESKTOP, t);
    console.log(`laptop: ${shots.length} shots, ${Date.now() - t0} ms`);
    // the picker, opened by a real click on the chip; a node picked by a real click
    {
      await page.evaluate(() => { window.__folding.setGroup('333'); });
      await settle();
      const chip = await page.evaluate(() => { const r = document.getElementById('chip').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      await page.mouse.click(chip[0], chip[1]);
      await page.waitForTimeout(450);
      const open = await page.evaluate(() => ({ open: window.__folding.picker.isOpen(), nodes: document.querySelectorAll('.hasse-node').length,
        current: (document.querySelector('.hasse-node.hasse-current') || { getAttribute: () => null }).getAttribute('data-id') }));
      await page.screenshot({ path: path.join(outDir, 'picker-1280.png') });
      shots.push({ file: 'picker-1280.png', picker: open });
      if (!open.open || open.nodes !== 17 || open.current !== '333') note(`picker 1280: ${JSON.stringify(open)}`);
      const node = await page.evaluate(() => { const r = document.querySelector('.hasse-node[data-id="2*22"] .hasse-pill').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      await page.mouse.click(node[0], node[1]);
      await page.waitForTimeout(350);
      const after = await page.evaluate(() => { const s = window.__folding.getState(); return { open: s.pickerOpen, group: s.groupId, t: s.t, preset: s.presetIndex, hash: s.hash, url: s.url }; });
      if (after.open || after.group !== '2*22' || after.t !== 0 || after.preset !== 0 || after.hash !== after.url || !after.hash.startsWith('#g=2%2A22')) note(`picker 1280: after a click on 2*22: ${JSON.stringify(after)}`);
      else console.log('picker 1280: opened from the chip, 17 nodes, current 333; a click on 2∗22 switched the group and the hash');
    }
    await page.setViewportSize(PHONE);
    await settle(250);
    for (const id of groups) for (const t of [0, 1]) await shoot(id, PHONE, t);
    console.log(`phone: ${shots.length} shots in all, ${Date.now() - t0} ms`);
    {
      await page.evaluate(() => { window.__folding.setGroup('22x'); });
      await settle();
      const open = await page.evaluate(() => { window.__folding.openPicker(); return true; });
      await page.waitForTimeout(450);
      const info = await page.evaluate(() => ({ open: window.__folding.picker.isOpen(), nodes: document.querySelectorAll('.hasse-node').length,
        current: (document.querySelector('.hasse-node.hasse-current') || { getAttribute: () => null }).getAttribute('data-id'),
        card: (() => { const r = document.querySelector('.hasse-card').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; })() }));
      await page.screenshot({ path: path.join(outDir, 'picker-390.png') });
      shots.push({ file: 'picker-390.png', picker: info });
      if (!open || !info.open || info.nodes !== 17 || info.current !== '22x' || info.card[0] < 0 || info.card[0] + info.card[2] > 390.5) note(`picker 390: ${JSON.stringify(info)}`);
      const node = await page.evaluate(() => { const r = document.querySelector('.hasse-node[data-id="*632"] .hasse-pill').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      await page.mouse.click(node[0], node[1]);
      await page.waitForTimeout(350);
      const after = await page.evaluate(() => { const s = window.__folding.getState(); return { open: s.pickerOpen, group: s.groupId, hash: s.hash, url: s.url }; });
      if (after.open || after.group !== '*632' || after.hash !== after.url || !after.hash.startsWith('#g=%2A632')) note(`picker 390: after a click on *632: ${JSON.stringify(after)}`);
      else console.log('picker 390: 17 nodes, current 22×; a click on ∗632 switched the group and the hash');
    }
    // ---- other windows: a big laptop, a tablet upright, a phone on its side, two small phones (the group with the
    //      most preset chips, half folded): the same layout checks, one picture each
    if (!opt.groups) {
      for (const [w, h] of [[1440, 900], [768, 1024], [844, 390], [360, 640], [320, 568]]) {
        await page.setViewportSize({ width: w, height: h });
        await page.evaluate(() => { const F = window.__folding; F.setGroup('632'); F.setT(0.5); });
        await settle(200);
        const m = await measure();
        const file = `size-${w}x${h}.png`;
        await page.screenshot({ path: path.join(outDir, file) });
        shots.push({ file, size: [w, h], panes: m.panes, fold: m.fold, plane: m.plane, issues: m.issues });
        if (!(m.fold > 0.02) || !(m.plane > 0.03)) note(`${w} x ${h}: a canvas is blank (fold ${m.fold}, plane ${m.plane})`);
        for (const i of m.issues) note(`${w} x ${h}: ${i}`);
        console.log(`window ${w} x ${h}: plane ${m.panes[0]} x ${m.panes[1]}, fold ${m.panes[2]} x ${m.panes[3]}${m.issues.length ? '  ISSUES: ' + m.issues.join('; ') : ''}`);
      }
    }
    await page.setViewportSize(DESKTOP);
    await settle(250);

    // ---- every cut: each preset of each group, straight and wavy, half folded and folded shut (numbers, no picture);
    //      then one picture of the wavy default cut, folded, for every group that has a cut
    {
      let n = 0, worst = 0;
      for (const g of GROUPS.filter((x) => groups.includes(x.id))) {
        for (let i = 0; i < g.presets.length; i++) {
          for (const amp of [0, 1]) {
            const r = await page.evaluate(([id, pi, a]) => {
              const F = window.__folding;
              if (F.getState().groupId !== id) F.setGroup(id);
              F.setPreset(pi); F.setAmp(a);
              const mid = F.setT(0.5), end = F.setT(1);
              return { mid: [mid.nonFinite, mid.seamGap], end: [end.nonFinite, end.seamGap], preset: end.presetIndex, amp: end.amp, group: end.groupId, errors: F.errors.length };
            }, [g.id, i, amp]);
            n++;
            const where = `${g.id} cut "${g.presets[i].name}" wavy ${amp}`;
            if (r.group !== g.id || r.preset !== i || r.amp !== amp) note(`${where}: the state is ${JSON.stringify(r)}`);
            if (r.mid[0] || r.end[0]) note(`${where}: points that are not finite (${r.mid[0]} at t = 0.5, ${r.end[0]} at t = 1)`);
            if (r.end[1] !== null && !(r.end[1] < 1e-6)) note(`${where}: the seams are open at t = 1 (${r.end[1]} tile sizes)`);
            if (r.errors) note(`${where}: the app caught ${r.errors} errors`);
            if (typeof r.end[1] === 'number' && r.end[1] > worst) worst = r.end[1];
          }
        }
        if (g.fold !== 'snowflake') {
          await page.evaluate(() => { const F = window.__folding; F.setPreset(0); F.setAmp(1); F.setT(1); });
          await settle();
          const m = await measure();
          const file = `${fileId(g.id)}-1280-wavy.png`;
          await page.screenshot({ path: path.join(outDir, file) });
          shots.push({ file, wavy: g.id, seam: m.state.seamGap, fold: m.fold, plane: m.plane, labels: m.labels, issues: m.issues });
          if (!(typeof m.fold === 'number' && m.fold > 0.02)) note(`${g.id} wavy: the 3D canvas is blank (${m.fold})`);
          for (const i of m.issues) note(`${g.id} wavy: ${i}`);
        }
        await page.evaluate(() => { window.__folding.setAmp(0); });
      }
      console.log(`cuts: ${n} cuts (every preset, straight and wavy) folded shut; worst seam gap at t = 1: ${worst.toExponential(1)} tile sizes; ${Date.now() - t0} ms`);
      // what one step of a drag costs: rebuild tile, mesh and fold, redraw both panes (the 3D pane half folded)
      const perf = await page.evaluate(() => {
        const F = window.__folding, out = {};
        for (const id of ['xx', 'o', '2222', '22x', '333', '632']) {      // (a kaleidoscope takes no seed: nothing to cut)
          F.setGroup(id); F.setT(0.6);
          const s0 = F.scene().domain.seed, N = 24;
          const a = performance.now();
          for (let k = 1; k <= N; k++) F.setSeed(s0[0] + 0.004 * k, s0[1] + 0.003 * k);
          out[id] = Math.round(((performance.now() - a) / N) * 10) / 10;
        }
        F.setGroup('333');
        return out;
      });
      report.dragStepMs = perf;
      console.log('one drag step (rebuild + both panes), ms: ' + Object.entries(perf).map(([k, v]) => `${k} ${v}`).join(', '));
      for (const [k, v] of Object.entries(perf)) if (!(v < 80)) note(`a drag step takes ${v} ms for ${k}`);
    }
  }

  // ---- one scripted session with real input ---------------------------------------------------------------------------
  if (opt.interact || opt['only-interact']) {
    const F = (fn, arg) => page.evaluate(fn, arg);
    const state = () => F(() => window.__folding.getState());
    const center = (sel) => F((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width, r.height, r.left, r.top]; }, sel);
    const drag = async (from, to, steps = 12) => {
      await page.mouse.move(from[0], from[1]);
      await page.mouse.down();
      await page.mouse.move(to[0], to[1], { steps });
      await page.waitForTimeout(60);
      await page.mouse.up();
      await settle(40);
    };
    const near = (a, b, eps) => Math.abs(a - b) <= eps;
    const viewOf = (s) => `az ${s.view.az} el ${s.view.el}`;
    // the anchor (SPEC 7): the seed of the preset last chosen, whatever the drag and the wave did since
    const presetSeed = (id, i = 0) => GROUPS.find((g) => g.id === id).presets[i].seed;
    const sameXY = (a, b) => !!a && !!b && a.length === 2 && near(a[0], b[0], 1e-12) && near(a[1], b[1], 1e-12);

    await F(() => { window.__folding.setGroup('2222'); window.__folding.resetView(); });
    await settle();
    let s0 = await state();
    check('start: 2222, preset 0 lit, t = 0, default view', s0.groupId === '2222' && s0.presetIndex === 0 && s0.t === 0 && near(s0.view.az, 0, 0.1) && near(s0.view.el, 55, 0.1), viewOf(s0));
    let m = await measure();
    check('the hint shows before the first drag', m.hintHidden === false && m.hint === 'drag to move the cut');

    // 1. drag in the plane: the cut moves, no chip is lit, the hint goes
    const pc = await center('#plane-canvas');
    await drag([pc[0] + 40, pc[1] + 30], [pc[0] + 85, pc[1] - 10]);
    let s1 = await state();
    m = await measure();
    check('dragging in the plane moves the seed', Math.hypot(s1.seed[0] - s0.seed[0], s1.seed[1] - s0.seed[1]) > 0.02, `${s0.seed.map((v) => v.toFixed(3))} -> ${s1.seed.map((v) => v.toFixed(3))}`);
    check('a dragged cut lights no preset chip', s1.presetIndex === -1 && m.pressed.every((p) => !p));
    check('the hint is gone after the first drag', m.hintHidden === true);
    check('the anchor is the seed of the preset chosen, and a drag leaves it there', sameXY(s0.anchor, presetSeed('2222', 0)) && sameXY(s1.anchor, s0.anchor),
      `${JSON.stringify(s0.anchor)} -> ${JSON.stringify(s1.anchor)}`);
    await page.screenshot({ path: path.join(outDir, 'interact-1-dragged.png') }); pictures.push('interact-1-dragged.png');
    // a fast drag: many pointer moves between two frames must not mean as many rebuilds
    await F(() => { const W = window; W.__frames = 0; W.__count = true; const tick = () => { W.__frames++; if (W.__count) requestAnimationFrame(tick); }; requestAnimationFrame(tick); W.__r0 = W.__folding.counters.rebuilds; });
    await page.mouse.move(pc[0] + 85, pc[1] - 10);
    await page.mouse.down();
    await page.mouse.move(pc[0] - 60, pc[1] + 50, { steps: 150 });
    await page.mouse.up();
    await settle(40);
    const thr = await F(() => { window.__count = false; return { frames: window.__frames, rebuilds: window.__folding.counters.rebuilds - window.__r0 }; });
    check('a drag with the mouse never rebuilds more often than frames come (150 pointer moves)', thr.rebuilds >= 2 && thr.rebuilds <= thr.frames + 1, `${thr.rebuilds} rebuilds in ${thr.frames} frames`);
    // (Chrome hands real pointer moves to the page once per frame anyway.) A burst of forty moves inside one task,
    // as a fast mouse or a busy page produces them: one rebuild, at the last position
    const burst = await F(async () => {
      const c = document.getElementById('plane-canvas'), r = c.getBoundingClientRect(), W = window;
      const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: 77, pointerType: 'mouse', button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true, cancelable: true }));
      const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2, before = W.__folding.counters.rebuilds, s0 = W.__folding.getState().seed;
      ev('pointerdown', x0, y0);
      for (let i = 1; i <= 40; i++) ev('pointermove', x0 + i, y0 - i / 2);
      const during = W.__folding.counters.rebuilds - before;
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      const after = W.__folding.counters.rebuilds - before, s1 = W.__folding.getState().seed;
      ev('pointerup', x0 + 40, y0 - 20);
      const scale = W.__folding.plane.getView().s;
      return { during, after, moved: [(s1[0] - s0[0]) * scale, (s1[1] - s0[1]) * scale] };
    });
    check('forty pointer moves inside one task give one rebuild, at the last position', burst.during === 0 && burst.after === 1 && Math.abs(burst.moved[0] - 40) < 1.5 && Math.abs(burst.moved[1] - 20) < 1.5,
      `${burst.after} rebuild, the seed moved ${burst.moved.map((v) => v.toFixed(1)).join(', ')} px`);

    // 2. a preset chip
    const chip1 = await center('#presets .chip:nth-child(2)');
    await page.mouse.click(chip1[0], chip1[1]);
    await settle();
    let s2 = await state();
    m = await measure();
    check('a click on the second preset chip selects it and lights it', s2.presetIndex === 1 && m.pressed[1] === true && m.pressed.filter(Boolean).length === 1, `preset ${s2.preset}`);
    check('a preset chip moves the anchor to its seed', sameXY(s2.anchor, presetSeed('2222', 1)), JSON.stringify(s2.anchor));
    // seam colours: steady under the finger (a seam keeps its colour while the cut is dragged), and a named cut
    // always comes back in the same colours, whatever was shown before
    const colours = () => F(() => { const sc = window.__folding.scene(); return sc.edges.map((e) => e.color.map((v) => Math.round(v * 255)).join()).join(' | '); });
    const seamColours = () => F(() => { const sc = window.__folding.scene(); const out = {}; sc.domain.edges.forEach((e, i) => { if (e.kind === 'cut') out[e.seam] = sc.edges.find((l) => l.edge === i).color.join(); }); return out; });
    const fresh = await F(() => { window.__folding.setGroup('333'); return true; }).then(colours);
    let steady = true, changes = 0, prevSeams = await seamColours();
    for (let k = 1; k <= 40; k++) {
      await F((kk) => { window.__folding.setSeed(0.5 + 0.3 * Math.cos(kk * 0.157) - 0.3, 0.3 * Math.sin(kk * 0.157)); }, k);
      const now = await seamColours();
      for (const key of Object.keys(now)) { if (key in prevSeams && prevSeams[key] !== now[key]) steady = false; if (!(key in prevSeams)) changes++; }
      prevSeams = now;
    }
    check('while the seed moves round a circle no seam changes its colour (seams come and go: ' + changes + ' new ones)', steady && changes > 0);
    const again = await F(() => { window.__folding.setPreset(0); return true; }).then(colours);
    check('a named cut comes back in the same colours', again === fresh, again);
    await F(() => { window.__folding.setGroup('2222'); window.__folding.setPreset(1); });

    // 3. the Wavy slider, dragged with the mouse
    const wv = await center('#wavy');
    await drag([wv[4] + 12, wv[1]], [wv[4] + wv[2] * 0.7, wv[1]], 10);
    await page.waitForTimeout(120);
    let s3 = await state();
    check('dragging the Wavy slider sets the amplitude', s3.amp > 0.4 && s3.amp < 0.95, `amp ${s3.amp}`);
    check('the wave leaves the anchor where it is', sameXY(s3.anchor, presetSeed('2222', 1)), JSON.stringify(s3.anchor));
    check('the wavy tile still folds shut', (await F(() => window.__folding.setT(1))).seamGap < 1e-6);
    await page.screenshot({ path: path.join(outDir, 'interact-2-wavy-folded.png') }); pictures.push('interact-2-wavy-folded.png');
    await F(() => window.__folding.setT(0));

    // 4. rotate the 3D view with the mouse; it keeps its orientation through everything but "reset view"
    const fc = await center('#fold-canvas');
    await drag([fc[0], fc[1]], [fc[0] + 130, fc[1] - 45], 14);
    await page.waitForTimeout(700);                                   // let the momentum die
    let v1 = await state();
    check('dragging in the 3D pane turns the view', Math.abs(v1.view.az) > 5 || Math.abs(v1.view.el - 55) > 5, viewOf(v1));
    const same = (a, b) => near(a.view.az, b.view.az, 0.15) && near(a.view.el, b.view.el, 0.15) && near(a.view.zoom, b.view.zoom, 0.002);
    let v2 = await F(() => window.__folding.setT(0.5));
    check('the view is kept when t changes', same(v1, v2), viewOf(v2));
    v2 = await F(() => window.__folding.setPreset(0));
    check('the view is kept when the preset changes', same(v1, v2), viewOf(v2));
    v2 = await F(() => window.__folding.setGroup('442'));
    check('the view is kept when the group changes', same(v1, v2) && v2.groupId === '442' && v2.t === 0 && v2.presetIndex === 0, viewOf(v2));
    v2 = await F(() => window.__folding.setAmp(0.3));
    check('the view is kept when the wave changes', same(v1, v2), viewOf(v2));
    await page.screenshot({ path: path.join(outDir, 'interact-3-rotated.png') }); pictures.push('interact-3-rotated.png');

    // 5. Fold: the button flips, the motion is smooth, the view is still kept
    const fb = await center('#fold-btn');
    await F(() => {
      const W = window; W.__trace = [];
      const tick = () => { W.__trace.push([performance.now(), W.__folding.timeline.get()]); if (W.__trace.length < 2000 && !W.__traceStop) requestAnimationFrame(tick); };
      W.__traceStop = false; requestAnimationFrame(tick);
    });
    await page.mouse.click(fb[0], fb[1]);
    await page.waitForTimeout(250);
    let p1 = await state();
    check('a click on Fold starts the play and the button reads Pause', p1.playing === true && p1.button === 'Pause' && p1.t > 0 && p1.t < 1, `t ${p1.t.toFixed(3)}`);
    await page.waitForFunction(() => !window.__folding.getState().playing, null, { timeout: 20000 });
    let p2 = await state();
    const trace = await F(() => { window.__traceStop = true; return window.__trace; });
    let maxDt = 0, back = 0, frames = 0;
    for (let i = 1; i < trace.length; i++) { const d = trace[i][1] - trace[i - 1][1]; if (d > maxDt) maxDt = d; if (d < -1e-12) back++; if (d > 0) frames++; }
    check('the fold plays to t = 1 and the button reads Unfold', p2.t === 1 && p2.button === 'Unfold' && p2.seamGap < 1e-6, `seam gap ${p2.seamGap}`);
    check('the play is smooth: t never goes back and no frame jumps more than a twentieth of the way', back === 0 && maxDt < 0.05 && frames > 20, `${frames} moving frames, largest step ${maxDt.toFixed(4)}`);
    check('the view is kept while playing', same(v1, p2), viewOf(p2));
    await page.screenshot({ path: path.join(outDir, 'interact-4-folded.png') }); pictures.push('interact-4-folded.png');
    await page.mouse.click(fb[0], fb[1]);
    await page.waitForTimeout(200);
    let p3 = await state();
    check('a click on Unfold plays back', p3.playing === true && p3.t < 1);
    await page.mouse.click(fb[0], fb[1]);
    await page.waitForTimeout(120);
    let p4 = await state();
    check('a click while it plays pauses it where it is', p4.playing === false && p4.t > 0 && p4.t < 1 && p4.button === 'Unfold', `t ${p4.t.toFixed(3)}, button ${p4.button}`);
    await F(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    let p5 = await state();
    check('Space toggles the play', p5.playing === true);
    await page.waitForFunction(() => !window.__folding.getState().playing, null, { timeout: 20000 });
    let p6 = await state();
    check('unfolded again: t = 0 and the button reads Fold', p6.t === 0 && p6.button === 'Fold');

    // 6. the scrubber: continuous, with soft magnets (no jump to a tick)
    await F(() => window.__folding.setGroup('o'));                 // three stops: 0, 0.45, 1
    await settle();
    const sc = await center('#scrub');
    const x0 = sc[4] + 14, x1 = sc[4] + sc[2] - 14;
    await page.mouse.move(x0, sc[1]);
    await page.mouse.down();
    const ts = [];
    for (let i = 0; i <= 120; i++) {
      await page.mouse.move(x0 + ((x1 - x0) * i) / 120, sc[1]);
      ts.push(await F(() => window.__folding.getState().t));
    }
    await page.mouse.up();
    // one mouse step is 1/120 of the track. Far from the stops t moves by as much; next to the inner stop (0.45) the
    // map flattens (the magnet: slope 0 at the stop itself) and at the edge of its zone it is steeper (slope 1.6)
    const unit = 1 / 120;
    let mono = true, big = 0, slowest = Infinity, plain = [];
    for (let i = 1; i < ts.length; i++) {
      const d = ts[i] - ts[i - 1], mid = (ts[i] + ts[i - 1]) / 2;
      if (d <= 0 && ts[i] > 0 && ts[i] < 1) mono = false;
      if (d > big) big = d;
      if (Math.abs(mid - 0.45) < 0.02 && d < slowest) slowest = d;
      if ((mid > 0.12 && mid < 0.36) || (mid > 0.55 && mid < 0.9)) plain.push(d);
    }
    const plainMin = Math.min(...plain), plainMax = Math.max(...plain);
    check('scrubbing is continuous: t follows the thumb strictly monotonically from 0 to 1, no step larger than twice the mouse step', mono && big < 2.2 * unit && ts[0] < 0.02 && ts[120] > 0.98,
      `largest step ${(big / unit).toFixed(2)} mouse steps`);
    check('away from the stops t is the thumb position (one mouse step = one step of t)', plainMin > 0.85 * unit && plainMax < 1.15 * unit, `${(plainMin / unit).toFixed(2)} to ${(plainMax / unit).toFixed(2)} mouse steps`);
    check('a slight magnet at the inner stop: t slows down next to it, and never sticks', slowest < 0.6 * unit && slowest > 0, `slowest step ${(slowest / unit).toFixed(2)} mouse steps`);
    const vs = await state();
    check('the view is kept while scrubbing and across groups', same(v1, vs), viewOf(vs));

    // 7. folded shut, drag the seed: t stays, the seams stay closed and slide over the shape
    await F(() => { window.__folding.setGroup('333'); window.__folding.setT(1); });
    await settle();
    // the seams in 3D: every boundary point of every edge (how far they slid = the largest distance from a point of
    // the new outline to the old outline; the corners at rotation centres stay where they are, so no single edge will do)
    const SEAMS = () => { const sc2 = window.__folding.scene(); const pts = []; for (const e of sc2.edges) for (let i = 0; i < e.out.length; i += 3) pts.push([e.out[i], e.out[i + 1], e.out[i + 2]]); return pts; };
    const before = await F((src) => { const sc2 = window.__folding.scene(); return { seed: sc2.domain.seed.slice(), frame: sc2.frame, seams: (0, eval)(src)() }; }, `(${SEAMS})`);
    const pc2 = await center('#plane-canvas');
    await page.mouse.move(pc2[0], pc2[1]);
    await page.mouse.down();
    const gaps = [];
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(pc2[0] + 4 * i, pc2[1] - 2.5 * i);
      await page.waitForTimeout(35);
      gaps.push(await F(() => { const s = window.__folding.getState(); return [s.t, s.seamGap, s.playing]; }));
    }
    await page.mouse.up();
    await settle();
    const after = await F((src) => { const sc2 = window.__folding.scene(); return { seed: sc2.domain.seed.slice(), frame: sc2.frame, seams: (0, eval)(src)() }; }, `(${SEAMS})`);
    const moved = Math.hypot(after.seed[0] - before.seed[0], after.seed[1] - before.seed[1]);
    let edgeMoved = 0;
    for (const p of after.seams) { let d = Infinity; for (const q of before.seams) d = Math.min(d, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])); edgeMoved = Math.max(edgeMoved, d); }
    const frameMoved = Math.hypot(after.frame.center[0] - before.frame.center[0], after.frame.center[1] - before.frame.center[1], after.frame.center[2] - before.frame.center[2]);
    check('dragging the seed with the shape folded keeps t = 1 and the seams closed at every step', gaps.every((g) => g[0] === 1 && g[1] < 1e-6), `largest gap ${Math.max(...gaps.map((g) => g[1])).toExponential(1)}`);
    check('the seams slide over the shape while the shape stays where it is', moved > 0.02 && edgeMoved > 0.01 && frameMoved < 0.02 && near(after.frame.radius, before.frame.radius, 0.02), `seed moved ${moved.toFixed(3)}, a seam point ${edgeMoved.toFixed(3)}, the shape's centre ${frameMoved.toFixed(4)}`);
    await page.screenshot({ path: path.join(outDir, 'interact-5-seams-slid.png') }); pictures.push('interact-5-seams-slid.png');

    // 8. the wheel zooms; the zoom stays through preset, seed, wave and t; another group keeps the orientation and
    //    glides the zoom back to 1 (a zoom carried into another shape could overflow the pane); "reset view" resets
    await page.mouse.move(fc[0], fc[1]);
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(500);
    const z1 = await state();
    check('the wheel zooms the 3D view', Math.abs(z1.view.zoom - v1.view.zoom) > 0.03, `zoom ${v1.view.zoom} -> ${z1.view.zoom}`);
    const zk = await F(() => { const W = window.__folding, z = [W.setPreset(1).view.zoom, W.setSeed(0.42, 0.11).view.zoom, W.setAmp(0.4).view.zoom, W.setT(0.5).view.zoom]; W.setAmp(0); return z; });
    check('the zoom is kept when the preset, the seed, the wave or t change', zk.every((z) => near(z, z1.view.zoom, 0.002)), `${z1.view.zoom}: ${zk.join(' ')}`);
    const glide = await F(() => new Promise((resolve) => {        // every animation frame of the glide, read in the page
      const W = window.__folding, out = [], t0 = performance.now();
      W.setGroup('442');
      const tick = () => { const v = W.getState().view; out.push([v.zoom, v.az, v.el]); if (performance.now() - t0 < 800) requestAnimationFrame(tick); else resolve(out); };
      tick();
    }));
    const zs = glide.map((r) => r[0]), onTheWay = zs.filter((z) => z < z1.view.zoom - 0.002 && z > 1.002).length;
    let down = true;
    for (let i = 1; i < zs.length; i++) if (zs[i] > zs[i - 1] + 1e-9) down = false;
    check('another group keeps the orientation and glides the zoom back to 1: never back, several frames on the way',
      near(zs[0], z1.view.zoom, 0.002) && near(zs[zs.length - 1], 1, 0.002) && down && onTheWay >= 3 && glide.every((r) => near(r[1], z1.view.az, 0.15) && near(r[2], z1.view.el, 0.15)),
      `${zs.length} frames, ${onTheWay} on the way: zoom ${zs[0]} -> ${zs[zs.length - 1]}, ${viewOf(z1)}`);
    const sv = await F(() => new Promise((resolve) => {             // the view set by a script while it glides
      const W = window.__folding;
      W.setView(10, 40, 2.4); W.setGroup('2222'); W.setView(-25, 35);
      setTimeout(() => {
        const a = W.getState().view;
        W.setView(5, 50, 2.2); W.setGroup('442'); W.setView(5, 50, 1.7);
        setTimeout(() => resolve({ a, b: W.getState().view }), 600);
      }, 700);
    }));
    check('during the glide a script that only turns the view lets the zoom reach 1; one that sets a zoom wins',
      near(sv.a.zoom, 1, 0.002) && near(sv.a.az, -25, 0.15) && near(sv.a.el, 35, 0.15) && near(sv.b.zoom, 1.7, 0.002) && !sv.b.gliding, JSON.stringify(sv));
    await page.mouse.move(fc[0], fc[1]);
    await page.mouse.wheel(0, -240);                               // zoomed again, so that "reset view" has a zoom to reset
    await page.waitForTimeout(500);
    const rv = await center('#reset-view');
    await page.mouse.click(rv[0], rv[1]);
    await page.waitForTimeout(800);
    const z2 = await state();
    check('"reset view" brings back the default orientation and zoom', near(z2.view.az, 0, 0.2) && near(z2.view.el, 55, 0.2) && near(z2.view.zoom, 1, 0.01), viewOf(z2) + ' zoom ' + z2.view.zoom);

    // 9. the URL (SPEC 7). A legacy link typed into the address: the group, and the address rewritten to the new form
    await F(() => { window.location.hash = '#*632'; });
    await page.waitForFunction(() => window.__folding.getState().groupId === '*632' && location.hash === window.__folding.getState().url, null, { timeout: 2500 }).catch(() => {});
    const h1 = await state();
    m = await measure();
    check('a legacy #<id> in the address switches the group and is rewritten to the new form', h1.groupId === '*632' && h1.t === 0 && h1.hash === h1.url && h1.hash.startsWith('#g=%2A632'), h1.hash);
    check('a kaleidoscope: nothing to cut — no hint, the static note instead of the presets and Wavy (SPEC 8 C1)',
      m.hintHidden === true && m.cutNote === true && m.presetsShown === false && m.wavyShown === false && m.foldAttr === 'snowflake' && m.features === 'mirrors corners',
      JSON.stringify({ hint: m.hintHidden, note: m.cutNote, presets: m.presetsShown, wavy: m.wavyShown, fold: m.foldAttr, features: m.features }));
    {
      const k0 = await state(), pk = await center('#plane-canvas');
      await drag([pk[0], pk[1]], [pk[0] + 70, pk[1] + 25]);
      await F(() => document.getElementById('plane-canvas').focus());
      await page.keyboard.press('ArrowUp');
      await settle();
      const k1 = await state();
      check('a kaleidoscope: a drag or an arrow key on the plane changes nothing (SPEC 8 C2)', JSON.stringify(k1.seed) === JSON.stringify(k0.seed) && k1.presetIndex === 0 && k1.url === k0.url, `${k0.seed} -> ${k1.seed}`);
    }
    // every parameter in the hash; a reload brings the same state back
    await F(() => { const W = window.__folding; W.setGroup('4*2'); W.setPreset(1); W.setSeed(0.31, 0.47); W.setAmp(0.4); W.setT(0.63); W.setView(-35, 22, 1.4); });
    // the address follows within the page's throttle: 250 ms, but up to ~1.25 s after many writes in the last 30 s
    // (src/app.js hashInterval, the history budget); a fixed 450 ms wait failed after a busy session (round-3 check)
    await page.waitForFunction(() => location.hash === window.__folding.getState().url, null, { timeout: 3000 }).catch(() => {});
    const u1 = await state();
    check('every parameter is in the address: g, cut, seed, wavy, t, view', u1.hash === u1.url && ['g=4%2A2', 'cut=1', 'seed=0.31/0.47', 'wavy=0.4', 't=0.63', 'view=-35/22/1.4'].every((k) => u1.hash.includes(k)), u1.hash);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
    const u2 = await F(() => window.__folding.ready);
    check('a reload brings back the group, cut, anchor, seed, wavy, t and view',
      u2.groupId === '4*2' && u2.cut === 1 && u2.presetIndex === -1 && sameXY(u2.anchor, presetState(GROUPS.find((g) => g.id === '4*2'), 1).anchor) &&
      near(u2.seed[0], 0.31, 1e-9) && near(u2.seed[1], 0.47, 1e-9) && u2.amp === 0.4 && u2.t === 0.63 && near(u2.view.az, -35, 0.06) && near(u2.view.el, 22, 0.06) && near(u2.view.zoom, 1.4, 0.002) && u2.hash === u1.hash,
      `${u2.hash}: ${JSON.stringify({ g: u2.groupId, cut: u2.cut, anchor: u2.anchor, seed: u2.seed, amp: u2.amp, t: u2.t, view: u2.view })}`);
    // a hash that names nothing leaves the picture alone and is rewritten to what is shown (finding 52)
    await F(() => { window.location.hash = '#nonsense'; });
    await page.waitForFunction((h) => location.hash === h, u1.hash, { timeout: 3000 }).catch(() => {});
    const u3 = await state();
    check('a hash that names nothing: the picture stays, the address is rewritten to it', u3.groupId === '4*2' && u3.t === 0.63 && u3.hash === u1.hash, u3.hash);
    await F(() => { window.location.hash = '#*632'; });               // as before this section: the kaleidoscope, at t = 0
    await page.waitForTimeout(300);
    const h2 = await state();
    check('the anchor follows the group of the hash', sameXY(h1.anchor, presetSeed('*632', 0)) && sameXY(h2.anchor, presetSeed('*632', 0)), `${JSON.stringify(h1.anchor)}, ${JSON.stringify(h2.anchor)}`);

    // 10. keys: arrows on the scrubber step it; arrows on the plane move the seed
    await F(() => { window.__folding.setGroup('22*'); document.getElementById('scrubber').focus(); });
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    const k1 = await state();
    check('arrow keys on the scrubber step t', k1.t > 0.005 && k1.t < 0.05, `t ${k1.t.toFixed(4)}`);
    await F(() => { document.getElementById('plane-canvas').focus(); });
    await page.keyboard.press('ArrowUp');
    await settle();
    const k2 = await state();
    check('arrow keys on the plane move the seed', k2.presetIndex === -1 && k2.seed[1] > k1.seed[1], `${k1.seed[1].toFixed(3)} -> ${k2.seed[1].toFixed(3)}`);

    const fin = await measure();
    check('no exception anywhere: nothing caught by the app, no console error, no page error', fin.appErrors.length === 0 && consoleErrors.length === 0 && pageErrors.length === 0,
      `${fin.appErrors.length} / ${consoleErrors.length} / ${pageErrors.length}`);
    for (const i of fin.issues) note(`after the session: ${i}`);

    // ---- the page in dev/app-frame.html, the stand-in of the spacesheep viewer (SPEC 6, SPEC 7) ----------------------
    //      dist: the strictest sandbox (opaque origin, no storage); the unbundled page: a frame of its own origin, as the
    //      viewer serves a space (it loads its modules, which an opaque origin could not)
    {
      const opaque = pagePath.startsWith('dist/');
      const hostPage = opaque ? 'dev/app-frame.html?page=dist&opaque' : 'dev/app-frame.html?page=' + encodeURIComponent(pagePath.split('#')[0] + (pagePath.includes('?') ? '&' : '?') + 'bridge');
      const findFrame = async (pg) => {
        for (let i = 0; i < 150; i++) {
          for (const f of pg.frames()) {
            if (f === pg.mainFrame()) continue;
            try { if (await f.evaluate(() => !!(window.__folding && window.__folding.ready))) { await f.evaluate(() => window.__folding.ready); return f; } } catch { /* not yet */ }
          }
          await pg.waitForTimeout(100);
        }
        return null;
      };
      await page.goto(url.replace(pagePath, hostPage) + '#3*3', { waitUntil: 'load' });
      const frame = await findFrame(page);
      if (!frame) check('frame: the page loads in the host frame', false, 'no frame');
      else {
        const st = await frame.evaluate(() => window.__folding.ready);
        const env = await frame.evaluate(() => ({ origin: window.origin, storage: (() => { try { window.localStorage.getItem('x'); return 'available'; } catch (e) { return 'blocked'; } })(), top: window.top !== window }));
        const hostOrigin = await page.evaluate(() => window.origin);
        check(opaque ? 'frame: the page starts in a sandboxed iframe (opaque origin, no storage) and takes the group from the hash'
          : 'frame: the page starts in a frame of its own origin (the viewer\'s sandbox) and takes the group from the hash',
        st.groupId === '3*3' && st.webgl && env.top && (opaque ? env.origin === 'null' && env.storage === 'blocked' : env.origin !== hostOrigin && env.origin !== 'null'),
        `group ${st.groupId}, origin ${env.origin} (host ${hostOrigin}), storage ${env.storage}`);
        await page.waitForTimeout(400);
        const a0 = await page.evaluate(() => location.hash);
        check('frame: the host\'s address takes the new form of the legacy link (ss-hash)', a0 === '#g=3%2A3', a0);
        const r = await frame.evaluate(() => { const F = window.__folding; F.setGroup('22x'); F.setT(1); F.flushHash(); return { s: F.getState(), errors: F.errors.slice() }; });
        await page.waitForTimeout(150);
        const a1 = await page.evaluate(() => location.hash);
        check('frame: switching the group works there; the hash and the host\'s address follow', r.s.groupId === '22x' && r.s.hash === '#g=22x&t=1' && a1 === r.s.hash && r.errors.length === 0 && r.s.seamGap < 1e-6,
          `hash ${r.s.hash}, host ${a1}, ${r.errors.length} errors${r.errors.length ? ': ' + r.errors[0] : ''}`);
        await page.waitForTimeout(200);
        const fm = await frame.evaluate(MEASURE);
        check('frame: under a 50 px host bar nothing scrolls, overlaps or leaves the frame; both panes are drawn', fm.issues.length === 0 && fm.fold > 0.02 && fm.plane > 0.03,
          fm.issues.join('; ') || `panes ${fm.panes.join(' x ').replace(' x ', ' x ')}`);
        await page.screenshot({ path: path.join(outDir, 'frame-1280.png') });
        pictures.push('frame-1280.png');
        // the host's address, opened afresh: the same state
        const hostUrl = page.url();
        await page.goto('about:blank');
        await page.goto(hostUrl, { waitUntil: 'load' });
        const frame2 = await findFrame(page);
        const s2 = frame2 ? await frame2.evaluate(() => window.__folding.getState()) : null;
        check('frame: the host\'s address opened afresh shows the same state', !!s2 && s2.groupId === '22x' && s2.t === 1 && s2.hash === r.s.hash && (await page.evaluate(() => location.hash)) === r.s.hash,
          s2 ? `${hostUrl} -> ${s2.groupId} t ${s2.t} ${s2.hash}` : 'no frame');
      }
    }

    // ---- a phone and a finger: touch input, devicePixelRatio 2 ----------------------------------------------------
    {
      const tctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
      const tp = await tctx.newPage();
      tp.on('console', (msg) => { if (msg.type() === 'error') { consoleErrors.push(msg.text()); console.log('CONSOLE ERROR (touch) ' + msg.text()); } });
      tp.on('pageerror', (e) => { pageErrors.push(e.message); console.log('PAGE ERROR (touch) ' + e.message); });
      await tp.goto(url + '#2222', { waitUntil: 'load' });
      await tp.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
      await tp.evaluate(() => window.__folding.ready);
      const cdp = await tctx.newCDPSession(tp);
      const pts = (list) => list.map((q, i) => ({ x: q[0], y: q[1], id: i + 1, radiusX: 8, radiusY: 8, force: 1 }));
      const touch = (type, ...list) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : pts(list) });
      const swipe = async (a, b, steps = 10) => {
        await touch('touchStart', a);
        for (let i = 1; i <= steps; i++) { await touch('touchMove', [a[0] + ((b[0] - a[0]) * i) / steps, a[1] + ((b[1] - a[1]) * i) / steps]); await tp.waitForTimeout(12); }
        await touch('touchEnd');
        await tp.waitForTimeout(120);
      };
      const tstate = () => tp.evaluate(() => window.__folding.getState());
      const box = (sel) => tp.evaluate((q) => { const r = document.querySelector(q).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }, sel);
      await tp.evaluate(() => { window.__seen = { cancel: 0, kinds: new Set() }; addEventListener('pointercancel', () => { window.__seen.cancel++; }, true); addEventListener('pointerdown', (e) => { window.__seen.kinds.add(e.pointerType); }, true); });
      const a0 = await tstate();
      check('touch: a phone-sized page at devicePixelRatio 2 starts with the group of the hash', a0.groupId === '2222' && a0.webgl && (await tp.evaluate(() => window.devicePixelRatio)) === 2);
      const pb = await box('#plane-canvas');
      await swipe([pb.cx - 20, pb.cy + 30], [pb.cx + 30, pb.cy - 10]);
      const a1 = await tstate();
      check('touch: a finger dragged over the plane moves the cut', a1.presetIndex === -1 && Math.hypot(a1.seed[0] - a0.seed[0], a1.seed[1] - a0.seed[1]) > 0.05,
        `${a0.seed.map((v) => v.toFixed(3))} -> ${a1.seed.map((v) => v.toFixed(3))}`);
      const fbx = await box('#fold-canvas');
      await swipe([fbx.cx, fbx.cy], [fbx.cx + 90, fbx.cy + 40]);
      await tp.waitForTimeout(600);
      const a2 = await tstate();
      check('touch: a finger dragged over the 3D pane turns the view', Math.abs(a2.view.az - a1.view.az) > 5 || Math.abs(a2.view.el - a1.view.el) > 5, `az ${a2.view.az} el ${a2.view.el}`);
      // two fingers moving apart: zoom in
      await touch('touchStart', [fbx.cx - 30, fbx.cy], [fbx.cx + 30, fbx.cy]);
      for (let i = 1; i <= 10; i++) { await touch('touchMove', [fbx.cx - 30 - 5 * i, fbx.cy], [fbx.cx + 30 + 5 * i, fbx.cy]); await tp.waitForTimeout(12); }
      await touch('touchEnd');
      await tp.waitForTimeout(500);
      const a3 = await tstate();
      check('touch: two fingers moving apart zoom in', a3.view.zoom > a2.view.zoom + 0.1, `zoom ${a2.view.zoom} -> ${a3.view.zoom}`);
      const sb = await box('#scrub');
      await swipe([sb.x + 16, sb.cy], [sb.x + sb.w * 0.62, sb.cy], 12);
      const a4 = await tstate();
      check('touch: a finger scrubs', a4.t > 0.4 && a4.t < 0.8 && !a4.playing, `t ${a4.t.toFixed(3)}`);
      check('touch: the view is kept while scrubbing', Math.abs(a4.view.az - a3.view.az) < 0.2 && Math.abs(a4.view.el - a3.view.el) < 0.2 && Math.abs(a4.view.zoom - a3.view.zoom) < 0.01);
      const wb = await box('#wavy');
      await swipe([wb.x + 10, wb.cy], [wb.x + wb.w * 0.6, wb.cy], 8);
      await tp.waitForTimeout(150);
      const a5 = await tstate();
      check('touch: a finger moves the Wavy slider', a5.amp > 0.3 && a5.amp < 0.9, `amp ${a5.amp}`);
      const bb = await box('#fold-btn');
      await tp.touchscreen.tap(bb.cx, bb.cy);
      await tp.waitForTimeout(250);
      const a6 = await tstate();
      check('touch: a tap on Fold plays', a6.playing === true && a6.button === 'Pause');
      await tp.waitForFunction(() => !window.__folding.getState().playing, null, { timeout: 20000 });
      const a7 = await tstate();
      check('touch: it folds shut', a7.t === 1 && a7.seamGap < 1e-6 && a7.button === 'Unfold', `seam gap ${a7.seamGap}`);
      await tp.screenshot({ path: path.join(outDir, 'touch-390.png') });
      pictures.push('touch-390.png');
      const cb = await box('#chip');
      await tp.touchscreen.tap(cb.cx, cb.cy);
      await tp.waitForTimeout(450);
      const open = await tp.evaluate(() => window.__folding.picker.isOpen());
      const nb = await box('.hasse-node[data-id="4*2"] .hasse-hit');
      await tp.touchscreen.tap(nb.cx, nb.cy);
      await tp.waitForTimeout(400);
      const a8 = await tstate();
      check('touch: a tap on the chip opens the picker, a tap on a node picks it (and the address names it at once)', open && a8.groupId === '4*2' && !a8.pickerOpen && a8.t === 0 && a8.hash.startsWith('#g=4%2A2'), `group ${a8.groupId}, ${a8.hash}`);
      await tp.waitForFunction(() => !window.__folding.getState().view.gliding, null, { timeout: 3000 });
      await tp.waitForFunction(() => location.hash === window.__folding.getState().url, null, { timeout: 2000 }).catch(() => {});
      const a9 = await tstate();
      check('touch: after the zoom glide the address has the whole state', a9.hash === a9.url && a9.hash.includes('view='), `${a9.hash} | ${a9.url}`);
      check('touch: the group change keeps the orientation and glides the pinch zoom back to 1',
        a3.view.zoom > 1.1 && Math.abs(a9.view.az - a3.view.az) < 0.2 && Math.abs(a9.view.el - a3.view.el) < 0.2 && Math.abs(a9.view.zoom - 1) < 0.002,
        `az ${a3.view.az} -> ${a9.view.az}, el ${a3.view.el} -> ${a9.view.el}, zoom ${a3.view.zoom} -> ${a9.view.zoom}`);
      const seen = await tp.evaluate(() => ({ cancel: window.__seen.cancel, kinds: [...window.__seen.kinds], scroll: [window.scrollX, window.scrollY, document.documentElement.scrollTop], scale: window.visualViewport ? window.visualViewport.scale : 1 }));
      check('touch: the input was touch, no gesture was taken away by the browser, the page neither scrolled nor zoomed', seen.kinds.join() === 'touch' && seen.cancel === 0 && seen.scroll.every((v) => v === 0) && seen.scale === 1, JSON.stringify(seen));
      const tm = await tp.evaluate(MEASURE);
      check('touch: layout at phone size and devicePixelRatio 2: nothing scrolls, overlaps or is too small to tap; both panes are drawn', tm.issues.length === 0 && tm.fold > 0.02 && tm.plane > 0.03 && tm.appErrors.length === 0, tm.issues.join('; '));
      await tp.screenshot({ path: path.join(outDir, 'touch-390-4s2.png') });
      pictures.push('touch-390-4s2.png');
      // a kaleidoscope on a phone: nothing to cut — no hint over the plane, the static note in the cut controls, and
      // a finger on the plane changes nothing (SPEC 8 C1, C2)
      const k0 = await tp.evaluate(() => window.__folding.setGroup('*442'));
      await tp.waitForTimeout(150);
      const km = await tp.evaluate(MEASURE);
      const pk = await box('#plane-canvas');
      await swipe([pk.cx - 30, pk.cy + 20], [pk.cx + 40, pk.cy - 25]);
      const k1 = await tstate();
      check('touch: a kaleidoscope has nothing to cut — no hint, the static note, and a finger on the plane changes nothing',
        km.hintHidden && km.cutNote && !km.presetsShown && !km.wavyShown && JSON.stringify(k1.seed) === JSON.stringify(k0.seed) && k1.presetIndex === 0 && k1.url === k0.url,
        JSON.stringify({ hint: km.hintHidden, note: km.cutNote, presets: km.presetsShown, wavy: km.wavyShown, seed: [k0.seed, k1.seed] }));
      await tctx.close();
    }
    check('no console error and no page error in the frame and touch sessions either', consoleErrors.length === 0 && pageErrors.length === 0, `${consoleErrors.length} / ${pageErrors.length}`);
  }
} catch (e) {
  note('the run itself failed: ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e));
} finally {
  finished = true;
  clearTimeout(watchdog);
  await B.close();
}

// ---- report -----------------------------------------------------------------------------------------------------------
const pct = (v) => (typeof v === 'number' ? (100 * v).toFixed(1).padStart(5) + '%' : String(v));
const rows = shots.filter((s) => s.id);
if (rows.length) {
  console.log('\nfile                     fold    plane  labels     seam gap   triangles  panes');
  for (const s of rows) {
    console.log(s.file.padEnd(22), pct(s.fold), pct(s.plane), String(s.labels.join(' ') || '-').padEnd(11),
      (s.seam === null ? 'no seam' : typeof s.seam === 'number' ? s.seam.toExponential(1) : String(s.seam)).padStart(9), String(s.triangles).padStart(8), '  ' + s.panes.join(' '));
  }
}
Object.assign(report, { page: pagePath, when: new Date().toISOString(), seconds: (Date.now() - t0) / 1000, shots, pictures, checks, consoleErrors, pageErrors, problems });
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
console.log(`\n${shots.length + pictures.length} pictures in ${path.relative(root, outDir)}/ (${report.seconds.toFixed(1)} s)` +
  (checks.length ? `; interaction: ${checks.filter((c) => c.ok).length} of ${checks.length} checks passed` : ''));
console.log(`console errors: ${consoleErrors.length}   page errors: ${pageErrors.length}   problems: ${problems.length}`);
for (const p of problems) console.log('  - ' + p);
process.exit(problems.length || consoleErrors.length || pageErrors.length ? 1 : 0);
