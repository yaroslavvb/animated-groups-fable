// dev/turntable/check.mjs — the 3D view's turntable (15 Nov 2026, the owner: "use a fixed turntable mode for rotation
// UI") in a real Chrome: real mouse drags in every direction, a closed loop of the hand, the tilt held at straight down
// with its turn in the address, a two-finger twist from the browser's own touch input, the arrow keys, an old link
// with a roll, a phone. Every view is read from the renderer (window.__folding.renderer.getView()) and checked level:
// the screen's x axis has no z, the plane's normal never points down-screen.
//   node dev/turntable/check.mjs [--page dist/index.html]                      the build, served from this folder
//   node dev/turntable/check.mjs --live https://spacesheep.dev/@yaroslavvb/the-folding   the deployed page, in its frame
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../tools/browser.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..');
let failed = 0, passed = 0;
const check = (ok, what, detail = '') => { if (ok) passed++; else failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${detail ? '  — ' + detail : ''}`); };

const B = await openBrowser({ root });
/** The frame that runs the app (the page itself, or the viewer's frame on spacesheep). */
async function appFrame(page) {
  for (let i = 0; i < 200; i++) {
    for (const f of page.frames()) {
      try { if (await f.evaluate(() => !!(window.__folding && window.__folding.ready))) { await f.evaluate(() => window.__folding.ready); return f; } } catch { /* loading */ }
    }
    await page.waitForTimeout(150);
  }
  throw new Error('no app frame');
}
async function open(ctx, hash = '') {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  const url = opt.live ? opt.live + hash : B.url((opt.page || 'dist/index.html') + hash);
  await page.goto(url, { waitUntil: 'load' });
  const f = await appFrame(page);
  await page.waitForTimeout(400);
  return { page, f };
}
/** The view as the renderer has it, and how level it is. */
const viewOf = (f) => f.evaluate(() => {
  const v = window.__folding.renderer.getView(), [x, y, z, w] = v.q;
  const xz = 2 * (x * z + w * y), yz = 2 * (y * z - w * x);          // z of the screen's x axis, of its y axis
  const s = window.__folding.getState();
  return { az: v.az, el: v.el, zoom: v.zoom, level: Math.abs(xz), up: yz, q: v.q, url: s.url, hashView: (s.url.match(/view=([^&]*)/) || [])[1] || '', roll: s.view.roll, errors: s.errors };
});
const angle = (a, b) => { const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]); return 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI; };
/** Where the fold pane is in the page (inside the viewer's frame, too). */
async function paneBox(page, f) {
  const r = await f.evaluate(() => { const b = document.getElementById('fold-canvas').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
  const fe = await f.frameElement().catch(() => null), off = fe ? await fe.boundingBox() : { x: 0, y: 0 };
  return { x: r[0] + (off ? off.x : 0), y: r[1] + (off ? off.y : 0), w: r[2], h: r[3] };
}
async function mouseDrag(page, from, to, steps = 18) {
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  await page.mouse.move(to[0], to[1], { steps });
  await page.waitForTimeout(160);                    // held still before the release: no flick
  await page.mouse.up();
  await page.waitForTimeout(60);
}

try {
  // ---- a laptop: the mouse ------------------------------------------------------------------------------------------
  const ctx = await B.browser.newContext({ viewport: { width: 1280, height: 760 } });
  const { page, f } = await open(ctx, '#g=2222&t=1');
  let v = await viewOf(f);
  check(Math.abs(v.az) < 1e-9 && Math.abs(v.el - 55) < 1e-9 && v.level < 1e-12, 'a fresh page: the default turntable view, level', JSON.stringify([v.az, v.el, v.level]));
  const P = await paneBox(page, f), cx = P.x + P.w / 2, cy = P.y + P.h / 2;
  // drags in every direction, long and short; after each the view is level
  let worst = 0, n = 0;
  for (let k = 0; k < 16; k++) {
    const a = (k * 67.5) * Math.PI / 180, len = 40 + 25 * (k % 7);
    await mouseDrag(page, [cx - 0.5 * len * Math.cos(a), cy - 0.5 * len * Math.sin(a)], [cx + 0.5 * len * Math.cos(a), cy + 0.5 * len * Math.sin(a)]);
    v = await viewOf(f); worst = Math.max(worst, v.level); n++;
    if (!(v.level < 1e-9 && v.up >= -1e-12 && v.el >= -90 && v.el <= 90)) { check(false, `drag ${k} at ${(k * 67.5) % 360} degrees: the view is level`, JSON.stringify(v)); break; }
  }
  check(worst < 1e-9 && v.roll === 0, `${n} mouse drags in every direction: the view never rolls (worst |z of the screen's x axis| ${worst.toExponential(1)})`);
  // a closed loop of the hand comes back to the same view
  const q0 = (await viewOf(f)).q;
  const loop = [[cx, cy], [cx + 120, cy], [cx + 120, cy + 60], [cx - 40, cy + 60], [cx, cy]];
  await page.mouse.move(loop[0][0], loop[0][1]); await page.mouse.down();
  for (let i = 1; i < loop.length; i++) await page.mouse.move(loop[i][0], loop[i][1], { steps: 12 });
  await page.waitForTimeout(160); await page.mouse.up(); await page.waitForTimeout(60);
  v = await viewOf(f);
  check(angle(q0, v.q) < 1e-6, 'a closed loop of the mouse brings the view back exactly (a trackball would have rolled)', angle(q0, v.q).toExponential(2) + ' degrees');
  // straight down: the tilt is held, a drag across turns the picture under the eye, and the address keeps the turn
  await mouseDrag(page, [cx, P.y + 20], [cx, P.y + P.h - 20], 30);
  await mouseDrag(page, [cx, P.y + 20], [cx, P.y + P.h - 20], 30);
  v = await viewOf(f);
  check(v.el === 90, 'dragging down and down: held at straight down, never over the top', String(v.el));
  const azDown = v.az;
  await mouseDrag(page, [cx - 60, cy], [cx + 60, cy]);
  v = await viewOf(f);
  check(v.el === 90 && Math.abs(v.az - azDown) > 5, 'straight down, a drag across turns the table', `${azDown.toFixed(1)} -> ${v.az.toFixed(1)}`);
  await f.evaluate(() => window.__folding.flushHash());
  v = await viewOf(f);
  const want = (Math.round(v.az * 10) / 10).toString();
  check(new RegExp(`^${want.replace('.', '\\.')}/90/1$`).test(v.hashView), 'the address writes the turn as az (no roll)', v.hashView);
  // a flick coasts on
  await page.mouse.move(cx - 80, cy); await page.mouse.down();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(cx - 80 + 30 * i, cy - 10 * i); await page.waitForTimeout(8); }
  const before = (await viewOf(f)).az;
  await page.mouse.up();
  await page.waitForTimeout(400);
  v = await viewOf(f);
  check(Math.abs(v.az - before) > 2 && v.level < 1e-9, 'a flick coasts on, level', `${before.toFixed(1)} -> ${v.az.toFixed(1)}`);
  // the keys
  await f.evaluate(() => { window.__folding.resetView(); document.getElementById('fold-canvas').focus(); });
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(700);
  v = await viewOf(f);
  check(Math.abs(v.az - 9) < 1e-6 && Math.abs(v.el - 55) < 1e-9, 'ArrowLeft turns the table 9 degrees', `${v.az} / ${v.el}`);
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(700);
  v = await viewOf(f);
  check(Math.abs(v.az - 9) < 1e-6 && Math.abs(v.el - 64) < 1e-6, 'ArrowDown tilts it 9 degrees (the eye rises)', `${v.az} / ${v.el}`);
  // an old link with a roll is shown upright, and the address loses the roll (in a context of its own: the
  // spacesheep viewer brings back what a context showed last, over a link opened in it)
  const octx = await B.browser.newContext({ viewport: { width: 1280, height: 760 } });
  const old = await open(octx, '#g=2222&t=1&view=10/40/1.5/25');
  v = await viewOf(old.f);
  check(Math.abs(v.az - 10) < 1e-9 && Math.abs(v.el - 40) < 1e-9 && Math.abs(v.zoom - 1.5) < 1e-9 && v.level < 1e-12, 'an old link with a roll: the same eye, upright', JSON.stringify([v.az, v.el, v.zoom]));
  await old.f.evaluate(() => window.__folding.flushHash());
  v = await viewOf(old.f);
  check(v.hashView === '10/40/1.5', 'its address is written without the roll', v.hashView);
  await octx.close();
  const errs = (await viewOf(f)).errors;
  check(errs === 0, 'no error in the app', String(errs));
  await page.close();

  // ---- a phone: two fingers, from the browser's own touch input (Chrome's DevTools protocol) --------------------------
  const pctx = await B.browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const ph = await open(pctx, '#g=22x&t=1');
  const PB = await paneBox(ph.page, ph.f), px = PB.x + PB.w / 2, py = PB.y + PB.h / 2;
  const cdp = await pctx.newCDPSession(ph.page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i + 1, radiusX: 2, radiusY: 2, force: 1 })) });
  const r = 60, at = (deg) => [px + r * Math.cos(deg * Math.PI / 180), py + r * Math.sin(deg * Math.PI / 180)];
  const a0 = await viewOf(ph.f);
  await touch('touchStart', [[px - r, py], at(0)]);
  for (let d = 5; d <= 40; d += 5) { await touch('touchMove', [[px - r, py], at(d)]); await ph.page.waitForTimeout(16); }
  await ph.page.waitForTimeout(150);
  await touch('touchEnd', []);
  await ph.page.waitForTimeout(500);
  v = await viewOf(ph.f);
  // (the first finger holds still at the left, the second turns about the middle: the pair turns by about 20 degrees)
  check(v.az > a0.az + 8 && Math.abs(v.el - a0.el) < 1e-6 && v.level < 1e-12, 'phone: a clockwise twist of two fingers turns the table (no tilt, no roll)', `${a0.az.toFixed(1)} -> ${v.az.toFixed(1)}, el ${v.el.toFixed(2)}`);
  // one finger: turn and tilt
  await touch('touchStart', [[px - 40, py - 40]]);
  for (let i = 1; i <= 10; i++) { await touch('touchMove', [[px - 40 + 9 * i, py - 40 + 7 * i]]); await ph.page.waitForTimeout(16); }
  await ph.page.waitForTimeout(150);
  await touch('touchEnd', []);
  await ph.page.waitForTimeout(500);
  const v2 = await viewOf(ph.f);
  check(v2.az < v.az - 5 && v2.el > v.el + 5 && v2.level < 1e-12, 'phone: one finger right and down turns the table and raises the eye, level', `${v.az.toFixed(1)}/${v.el.toFixed(1)} -> ${v2.az.toFixed(1)}/${v2.el.toFixed(1)}`);
  const scroll = await ph.f.evaluate(() => [window.scrollX, window.scrollY]);
  check(scroll[0] === 0 && scroll[1] === 0 && (await viewOf(ph.f)).errors === 0, 'phone: nothing scrolled, no error');
} finally { await B.close(); }
console.log(failed ? `${failed} FAILED, ${passed} passed` : `all ${passed} passed`);
process.exit(failed ? 1 : 0);
