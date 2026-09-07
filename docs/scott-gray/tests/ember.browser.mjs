import assert from 'node:assert/strict';
const runtime = '/Users/yaroslavvb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ?? `${runtime}playwright/index.mjs`);
const {PNG} = (await import(process.env.PNGJS_MODULE ?? `${runtime}pngjs/lib/png.js`)).default;
const base = (process.argv[2] ?? 'http://localhost:8934/scott-gray/ember/').replace(/\/?$/, '/');
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
  await page.screenshot({path: `/tmp/ember-${label}-desktop.png`});

  // Resizing must reveal/crop repeats, without stretching or zooming them.
  await page.setViewportSize({width: 760, height: 760});
  const square = await pixels();
  assert.ok(averageDifference(large, square, 680, 240, 0, 0, 1520, 1300) < 1, 'center crop retains exact scale');
  // Three repeats across 760 CSS pixels: compare regions 760 device px apart
  // at DPR 2 (1.5 lattice lengths). Use a full three-repeat period instead.
  await page.setViewportSize({width: 1520, height: 1000});
  const repeated = await pixels();
  assert.ok(averageDifference(repeated, repeated, 0, 0, 1520, 0, 1400, 1600) < 1, 'periodic tiling has no seam or orientation change');

  await page.setViewportSize({width: 390, height: 844});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth && document.documentElement.scrollHeight === innerHeight), 'mobile fills viewport without scrolling');
  const bounds = await page.locator('#controls').boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, 'mobile controls fit');
  await page.screenshot({path: `/tmp/ember-${label}-mobile.png`});

  await page.setViewportSize({width: 1280, height: 800});
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
  console.log(`${label}: retina rendering, fixed scale, seamless tiling, mobile layout, pause/play, idle controls, fullscreen, GPU recovery, and reduced motion passed`);
} finally {await browser.close();}
