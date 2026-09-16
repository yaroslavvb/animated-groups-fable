import assert from 'node:assert/strict';
const runtime = '/Users/yaroslavvb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ?? `${runtime}playwright/index.mjs`);
const {PNG} = (await import(process.env.PNGJS_MODULE ?? `${runtime}pngjs/lib/png.js`)).default;
const base = (process.argv[2] ?? 'http://localhost:8934/scott-gray/plume/').replace(/\/?$/, '/');
const label = process.argv[3] ?? 'local';
const browser = await chromium.launch({channel: 'chrome', headless: true});
const errors = [];
const context = await browser.newContext({viewport: {width: 1440, height: 1000}, deviceScaleFactor: 2});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);});
const ready = () => page.waitForSelector('canvas[data-ready="true"]');
async function pixels() { return PNG.sync.read(await page.locator('canvas').screenshot()); }
function averageDifference(a, b, x1 = 0, y1 = 0, x2 = 0, y2 = 0, width = a.width, height = a.height) {
  let total = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let c = 0; c < 3; c++) {
    total += Math.abs(a.data[4*((y+y1)*a.width+x+x1)+c] - b.data[4*((y+y2)*b.width+x+x2)+c]);
  }
  return total / (width * height * 3);
}
try {
  await page.goto(`${base}?play=0`); await ready();
  assert.deepEqual(await page.locator('canvas').evaluate(c => [c.width, c.height]), [2880, 2000], 'native retina resolution');
  assert.equal(await page.locator('#notice').isVisible(), false);
  const large = await pixels();
  assert.ok(new Set(large.data).size > 200, 'nonblank rendered image');
  await page.screenshot({path: `/tmp/plume-${label}-desktop.png`});

  // Resizing must reveal/crop repeats, without stretching or zooming them.
  await page.setViewportSize({width: 760, height: 760});
  const square = await pixels();
  assert.ok(averageDifference(large, square, 680, 240, 0, 0, 1520, 1300) < 1, 'center crop retains exact scale');
  // Two repeats across 760 CSS pixels: one lattice length is 760 device px at DPR 2.
  await page.setViewportSize({width: 1520, height: 1000});
  const repeated = await pixels();
  assert.ok(averageDifference(repeated, repeated, 0, 0, 760, 0, 2200, 1600) < 1, 'periodic tiling has no seam or orientation change');
  assert.ok(averageDifference(repeated, repeated, 0, 0, 0, 760, 3000, 1000) < 1, 'periodic tiling repeats vertically');

  await page.setViewportSize({width: 390, height: 844});
  // Narrow screens keep two repeats across: 195 CSS px = 390 device px per lattice length at DPR 2.
  const phone = await pixels();
  assert.ok(averageDifference(phone, phone, 0, 0, 390, 0, 390, 1400) < 1, 'phone view repeats every 195 CSS px');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth && document.documentElement.scrollHeight === innerHeight), 'mobile fills viewport without scrolling');
  const bounds = await page.locator('#controls').boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, 'mobile controls fit');
  await page.screenshot({path: `/tmp/plume-${label}-mobile.png`});

  // Dragging pans the endless pattern: a 95 CSS px drag (190 device px, a
  // quarter repeat) shifts the image exactly, and the reset button appears.
  await page.setViewportSize({width: 1280, height: 800});
  const beforeDrag = await pixels();
  assert.equal(await page.locator('#reset').isVisible(), false, 'reset hidden at home');
  await page.mouse.move(640, 300); await page.mouse.down();
  await page.mouse.move(700, 300, {steps: 4}); await page.mouse.move(735, 300, {steps: 4});
  await page.waitForTimeout(200); // A pause before release means no fling.
  await page.mouse.up();
  await page.waitForTimeout(300);
  const afterDrag = await pixels();
  assert.ok(averageDifference(beforeDrag, afterDrag, 0, 0, 190, 0, 2200, 1200) < 1.5, 'the pattern moved with the pointer');
  assert.ok(averageDifference(beforeDrag, afterDrag, 0, 0, 0, 0, 2200, 1200) > 5, 'and it moved');
  assert.equal(await page.locator('#reset').isVisible(), true, 'reset shown after panning');
  // A quick release keeps the pattern gliding for a moment, then it settles.
  await page.mouse.move(640, 500); await page.mouse.down();
  await page.mouse.move(540, 500, {steps: 3}); await page.mouse.up();
  await page.waitForTimeout(120);
  const gliding = await pixels();
  await page.waitForTimeout(250);
  assert.ok(averageDifference(gliding, await pixels()) > 3, 'inertia keeps panning after release');
  await page.waitForTimeout(1600);
  const settled = await pixels();
  await page.waitForTimeout(200);
  assert.equal(averageDifference(settled, await pixels()), 0, 'and it comes to rest');
  // The wheel zooms in about the pointer (Chrome scales the delta by the device pixel ratio, so only the direction is checked here).
  await page.keyboard.press('s');
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(300);
  const wheelScale = Number((await page.locator('#stats').textContent()).match(/(\d+) px per repeat/)[1]);
  assert.ok(wheelScale > 380 && wheelScale < 760, `wheel zoomed in to ${wheelScale} px per repeat`);
  await page.keyboard.press('0');
  // The + key zooms 1.25× about the centre: a repeat is then 475 CSS px, 950 device px.
  await page.keyboard.press('+');
  await page.waitForTimeout(300);
  assert.match(await page.locator('#stats').textContent(), /475 px per repeat/);
  await page.keyboard.press('s');
  const zoomed = await pixels();
  assert.ok(averageDifference(zoomed, zoomed, 0, 0, 950, 0, 1000, 1000) < 1, 'zoomed tiling repeats every 950 device px');
  assert.ok(averageDifference(zoomed, zoomed, 0, 0, 760, 0, 1000, 1000) > 5, 'and no longer every 760');
  await page.keyboard.press('0');
  await page.waitForTimeout(300);
  assert.equal(averageDifference(beforeDrag, await pixels()), 0, 'the 0 key restores the home view exactly');
  assert.equal(await page.locator('#reset').isVisible(), false);
  // A two-finger pinch (touch, via the devtools protocol) zooms in as well.
  const touch = await context.newCDPSession(page);
  await touch.send('Emulation.setTouchEmulationEnabled', {enabled: true});
  const fingers = (x1, x2) => [{x: x1, y: 400, id: 1}, {x: x2, y: 400, id: 2}];
  await touch.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: fingers(600, 680)});
  for (let i = 1; i <= 5; i++) await touch.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: fingers(600 - 8 * i, 680 + 8 * i)});
  await touch.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await touch.send('Emulation.setTouchEmulationEnabled', {enabled: false});
  await page.waitForTimeout(300);
  const pinched = await pixels();
  assert.ok(averageDifference(pinched, pinched, 0, 0, 1520, 0, 1000, 1000) < 1, 'pinching the fingers apart doubled the repeat');
  assert.equal(await page.locator('#reset').isVisible(), true);
  await page.locator('#reset').click();
  await page.waitForTimeout(300);
  assert.equal(averageDifference(beforeDrag, await pixels()), 0, 'the reset button restores the home view');
  // The stats readout appears on the S key and names the render size.
  await page.keyboard.press('s');
  assert.match(await page.locator('#stats').textContent(), /2560×1600 px · quality 1\.00 · 380 px per repeat · (9|16) taps/);
  await page.keyboard.press('s');
  assert.equal(await page.locator('#stats').isVisible(), false);
  const paused = await pixels();
  assert.equal(averageDifference(paused, await pixels()), 0, 'paused frame is stable');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelector('#pause').getAttribute('aria-label') === 'Pause animation');
  await page.waitForTimeout(350);
  assert.ok(averageDifference(paused, await pixels()) > 5, 'animation advances');
  await page.mouse.move(2, 2);
  await page.waitForFunction(() => document.body.classList.contains('quiet'), null, {timeout: 6000});
  await page.mouse.move(20, 20);
  assert.equal(await page.locator('body').evaluate(b => b.classList.contains('quiet')), false);
  await page.getByRole('button', {name: 'Enter fullscreen', exact: true}).click();
  await page.waitForFunction(() => !!document.fullscreenElement);
  await page.waitForFunction(() => document.body.classList.contains('quiet'), null, {timeout: 6000});
  await page.keyboard.press('f');
  await page.waitForFunction(() => !document.fullscreenElement);
  await page.keyboard.press('Space');

  // A restored GPU context must redraw and permit playback without reloading.
  await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2');
    const extension = gl.getExtension('WEBGL_lose_context');
    extension.loseContext();
    setTimeout(() => extension.restoreContext(), 250);
  });
  await page.waitForFunction(() => document.querySelector('#notice').hidden && !document.querySelector('#pause').disabled);

  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto(base); await ready();
  assert.equal(await page.locator('#pause').getAttribute('aria-label'), 'Play animation');
  await page.goto(`${base}?play=1`); await ready();
  assert.equal(await page.locator('#pause').getAttribute('aria-label'), 'Pause animation');
  assert.deepEqual(errors, [], 'no browser errors or missing assets');
  console.log(`${label}: retina rendering, fixed scale, seamless tiling, mobile layout, drag pan, wheel zoom, pinch zoom, reset, stats, pause/play, idle controls, fullscreen, GPU recovery, and reduced motion passed`);
} finally {await browser.close();}
