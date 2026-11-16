// dev/turntable/webkit.mjs — the turntable in Playwright's WebKit, Safari's engine, on the built page: mouse drags in
// every direction stay level, the tilt is held at straight down, and Safari's own trackpad gestures (gesturestart /
// gesturechange with rotation and scale, which only WebKit sends) turn the table and zoom at once without a roll.
// WebKit is on the M5: from the mini, `bash dev/turntable/webkit.sh` (copies the page there, runs this, cleans up).
//   node dev/turntable/webkit.mjs <dir holding index.html>
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const PW = process.env.PLAYWRIGHT_MJS || process.env.HOME + '/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const { webkit } = await import(PW);
const dir = path.resolve(process.argv[2] || '.');
let failed = 0, passed = 0, browser;
const check = (ok, what, detail = '') => { if (ok) passed++; else failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${detail ? '  — ' + detail : ''}`); };
try {
  browser = await webkit.launch();
  const page = await (await browser.newContext({ viewport: { width: 1180, height: 760 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  await page.goto(pathToFileURL(path.join(dir, 'index.html')).href + '#g=22x&t=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
  await page.evaluate(() => window.__folding.ready);
  const viewOf = () => page.evaluate(() => {
    const v = window.__folding.renderer.getView(), [x, y, z, w] = v.q;
    return { az: v.az, el: v.el, zoom: v.zoom, level: Math.abs(2 * (x * z + w * y)), webgl: window.__folding.renderer.ok };
  });
  let v = await viewOf();
  check(v.webgl && Math.abs(v.el - 55) < 1e-9, 'WebGL 2 on; the default view', JSON.stringify(v));
  const b = await page.locator('#fold-canvas').boundingBox(), cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  let worst = 0;
  for (let k = 0; k < 12; k++) {
    const a = k * 75 * Math.PI / 180, len = 60 + 20 * (k % 5);
    await page.mouse.move(cx - len * Math.cos(a) / 2, cy - len * Math.sin(a) / 2); await page.mouse.down();
    await page.mouse.move(cx + len * Math.cos(a) / 2, cy + len * Math.sin(a) / 2, { steps: 14 });
    await page.waitForTimeout(150); await page.mouse.up();
    v = await viewOf(); worst = Math.max(worst, v.level);
  }
  check(worst < 1e-9, '12 mouse drags in every direction: never a roll', worst.toExponential(1));
  for (let i = 0; i < 2; i++) {
    await page.mouse.move(cx, b.y + 10); await page.mouse.down(); await page.mouse.move(cx, b.y + b.height - 10, { steps: 30 }); await page.waitForTimeout(150); await page.mouse.up();
  }
  v = await viewOf();
  check(v.el === 90 && v.level < 1e-12, 'held at straight down', String(v.el));
  // Safari's trackpad: rotation (degrees, clockwise > 0, since the gesture began) and scale, as WebKit sends them
  await page.evaluate(() => window.__folding.resetView());
  const v0 = await viewOf();
  await page.evaluate(() => {
    const c = document.getElementById('fold-canvas');
    const fire = (type, scale, rotation) => { const e = new Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(e, 'scale', { value: scale }); Object.defineProperty(e, 'rotation', { value: rotation }); c.dispatchEvent(e); return e.defaultPrevented; };
    window.__gest = [fire('gesturestart', 1, 0), fire('gesturechange', 1.2, 10), fire('gesturechange', 1.4, 24), fire('gestureend', 1.4, 24)];
  });
  await page.waitForTimeout(600);
  v = await viewOf();
  const taken = await page.evaluate(() => window.__gest);
  check(taken.every(Boolean), 'the gesture events are taken (the page does not zoom itself)', JSON.stringify(taken));
  check(Math.abs(v.az - (v0.az + 24)) < 1e-6 && Math.abs(v.el - v0.el) < 1e-9 && v.level < 1e-12, 'a clockwise trackpad rotation of 24 degrees turns the table 24 degrees: no tilt, no roll', `${v0.az} -> ${v.az}, el ${v.el}`);
  check(Math.abs(v.zoom - 1.4) < 0.02, 'and its pinch zooms at the same time', String(v.zoom));
  check(errors.length === 0, 'no page error', JSON.stringify(errors));
} catch (e) { failed++; console.log('FAILED ' + (e && e.stack || e)); } finally { if (browser) await browser.close(); }
console.log(failed ? `${failed} FAILED, ${passed} passed` : `all ${passed} passed`);
process.exit(failed ? 1 : 0);
