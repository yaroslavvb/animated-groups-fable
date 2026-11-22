// The symbol guide (docs/correspondence-symbols.html) in a real browser engine:
// the 21 figures build and draw, they animate only while on screen, every
// control does what it says, the motif and the crystal can be dragged, a deep
// link from a plate's visual index lands on its card, the phone layout holds,
// and the correspondence pages link here.
//
// Usage: node tools/check_symbol_guide.browser.mjs [base-url] [label]
//        BROWSER=webkit runs the same checks in Playwright's WebKit.
//        SHOT_DIR=… writes screenshots somewhere you can look at them.
//        CHROME=… names a Chrome binary (default: Playwright's "chrome" channel).
//        PLAYWRIGHT_MODULE=… names Playwright's index.mjs (default: the Codex runtime's).
//
// The geometry the figures draw is checked without a browser by
// tools/check_symbol_guide.mjs.
import assert from 'node:assert/strict';

const runtime = `${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/`;
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? `${runtime}playwright/index.mjs`);
const engine = process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
const base = (process.argv[2] ?? 'http://localhost:8936/').replace(/\/?$/, '/');
const label = `${process.argv[3] ?? 'local'} (${engine})`;
const shots = process.env.SHOT_DIR;
const GUIDE = new URL('correspondence-symbols.html', base).href;

const notes = [];
let failures = 0;
async function section(name, body) {
  const started = Date.now();
  try { await body(); notes.push(`  ok   ${name} (${Date.now() - started} ms)`); }
  catch (error) { failures++; notes.push(`  FAIL ${name}: ${error.message}`); if (process.env.VERBOSE) notes.push(String(error.stack)); }
}

const browser = engine === 'webkit'
  ? await playwright.webkit.launch({ headless: true })
  : await playwright.chromium.launch(process.env.CHROME
    ? { executablePath: process.env.CHROME, headless: true }
    : { channel: 'chrome', headless: true });

async function open(url, { width = 1280, height = 900, reducedMotion } = {}) {
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => errors.push(`failed: ${request.url()}`));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.classList.contains('symbol-figures-ready')
    || !document.querySelector('[data-symbol-figure]'), null, { timeout: 15000 });
  return { context, page, errors };
}

const figure = (page, id) => page.locator(`[data-symbol-figure][data-symbol="${id}"]`);
const state = (host) => host.evaluate((el) => {
  const s = el.symbolFigure.state;
  return { k: s.k, u: s.u, dir: s.dir, phase: s.phase, playing: s.playing, yaw: s.yaw, pitch: s.pitch,
    everything: s.everything, x: s.seed.x, y: s.seed.y };
});
/** Wait for a figure's state to satisfy `test` (a function body over `s`), however slow the
 *  frames are: a loaded machine draws few of them, and the animation keeps to its frames. */
const until = (host, test, arg, what) => host.evaluate((el, { test, arg }) => new Promise((resolve, reject) => {
  const ok = new Function('s', 'arg', `return (${test});`);
  const started = performance.now();
  const poll = () => {
    if (ok(el.symbolFigure.state, arg)) resolve();
    else if (performance.now() - started > 20000) reject(new Error('timed out'));
    else setTimeout(poll, 40);
  };
  poll();
}), { test, arg }).catch((error) => { throw new Error(`${what}: ${error.message.split('\n')[0]}`); });
/** How many different colours a canvas shows on a coarse grid: a blank one shows one. */
const colours = (canvas) => canvas.evaluate((el) => {
  const ctx = el.getContext('2d');
  const seen = new Set();
  for (let i = 1; i < 24; i += 1) {
    for (let j = 1; j < 24; j += 1) {
      const [r, g, b, a] = ctx.getImageData(Math.round((el.width * i) / 24), Math.round((el.height * j) / 24), 1, 1).data;
      seen.add(`${r >> 3},${g >> 3},${b >> 3},${a >> 6}`);
    }
  }
  return seen.size;
});

const ALL = [
  'translation',
  'rotation-2-0', 'rotation-2-1', 'rotation-3-0', 'rotation-3-1', 'rotation-3-2',
  'rotation-4-0', 'rotation-4-1', 'rotation-4-2', 'rotation-4-3',
  'rotation-6-0', 'rotation-6-1', 'rotation-6-2', 'rotation-6-3', 'rotation-6-4', 'rotation-6-5',
  'plane-m', 'plane-axial', 'plane-c', 'plane-n', 'plane-d',
];

await section('the page: 21 cards, each with a drawn crystal and a drawn plate', async () => {
  const { context, page, errors } = await open(GUIDE);
  const ids = await page.$$eval('[data-symbol-figure]', (els) => els.map((el) => el.dataset.symbol));
  assert.deepEqual(ids, ALL, 'the cards are the 21 symbols of the visual index, in its order');
  for (const id of ids) {
    const host = figure(page, id);
    assert.equal(await host.locator('canvas').count(), 2, `${id}: two canvases`);
    for (const view of ['crystal', 'plate']) {
      const seen = await colours(host.locator(`.symbol-view--${view} canvas`));
      assert.ok(seen >= 4, `${id}: the ${view} view is drawn before it is scrolled to (${seen} colours)`);
    }
    assert.ok(await page.locator(`#${id} .symbol-card-glyph svg`).count(), `${id}: the card shows its mark`);
  }
  // the key: one link per card, and the cards' own links stay on the site
  const key = await page.$$eval('.symbol-key a.symbol-key-mark', (as) => as.map((a) => a.getAttribute('href').slice(1)));
  assert.deepEqual([...key].sort(), [...ALL].sort(), 'the key table links every card once');
  const places = await page.$$eval('.symbol-card dd a', (as) => as.map((a) => a.getAttribute('href')));
  assert.ok(places.length >= 100, `the cards name the plates that draw each symbol (${places.length} links)`);
  assert.ok(places.every((href) => /^correspondence-[a-z0-9]+\.html#g\d+$/.test(href)), 'each is an entry of the correspondence');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.equal(overflow, 0, 'no sideways scroll');
  assert.deepEqual(errors, [], 'no console errors');
  if (shots) await page.screenshot({ path: `${shots}/symbol-guide-${engine}-top.png` });
  await context.close();
});

await section('a figure runs while it is on screen and rests while it is not', async () => {
  const { context, page, errors } = await open(GUIDE);
  const near = figure(page, 'translation');
  const far = figure(page, 'plane-d');
  await near.scrollIntoViewIfNeeded();
  const first = await state(near);
  const rest = await state(far);
  assert.ok(first.playing, 'figures start playing');
  await until(near, 's.k !== arg.k || Math.abs(s.u - arg.u) > 0.05', first, 'the figure on screen moves on');
  assert.deepEqual(await state(far), rest, 'a figure far below the screen has not');
  await far.scrollIntoViewIfNeeded();
  await until(far, 's.k !== arg.k || Math.abs(s.u - arg.u) > 0.05', rest, 'it starts once it is scrolled to');
  assert.deepEqual(errors, []);
  await context.close();
});

await section('pause, step, and the two senses of a screw', async () => {
  const { context, page, errors } = await open(GUIDE);
  const host = figure(page, 'rotation-4-1');
  await host.scrollIntoViewIfNeeded();
  await host.getByRole('button', { name: 'Pause' }).click();
  const paused = await state(host);
  assert.equal(paused.playing, false);
  await page.waitForTimeout(500);
  assert.deepEqual(await state(host), paused, 'paused means still, wherever the tile is');
  // A step finishes the move in hand, or starts one from the copy the tile rests on
  // (which is the next one already when it has just arrived).
  const next = (paused.k + (paused.u >= 1 ? 2 : 1)) % 4;
  await host.getByRole('button', { name: 'Step' }).click();
  await until(host, '!s.once && s.u === 0 && s.k === arg', next, 'a step ends resting on the next copy');
  const stepped = await state(host);
  await page.waitForTimeout(400);
  assert.deepEqual(await state(host), stepped, 'and stays there');
  await host.getByRole('button', { name: 'Step' }).click();
  await until(host, '!s.once && s.u === 0 && s.k === arg', (next + 1) % 4, 'a second step goes one copy on');
  Object.assign(stepped, await state(host));
  // clockwise about the same axis: 3c/4 per turn, and the tile stays where it is
  const clockwise = host.getByRole('button', { name: /^Clockwise turn/ });
  assert.match(await clockwise.getAttribute('aria-label'), /rising 3c\/4/);
  await clockwise.click();
  const turned = await state(host);
  assert.equal(turned.dir, -1);
  assert.equal(turned.k, (4 - stepped.k) % 4, 'the same copy, counted the other way round');
  assert.equal(await clockwise.getAttribute('aria-pressed'), 'true');
  assert.equal(await host.getByRole('button', { name: /^Counter-clockwise turn/ }).getAttribute('aria-pressed'), 'false');
  await host.getByRole('button', { name: 'Play' }).click();
  assert.ok((await state(host)).playing, 'play resumes');
  await until(host, 's.u > 0.05 || s.k !== arg', turned.k, 'and the tile moves again');
  // a left-handed screw starts with its clockwise turn, the one that rises less
  const left = figure(page, 'rotation-4-3');
  assert.equal((await state(left)).dir, -1);
  const gentle = left.locator('.symbol-sense[aria-pressed="true"]');
  assert.match(await gentle.getAttribute('aria-label'), /^Clockwise turn, rising c\/4$/);
  assert.equal((await state(figure(page, 'rotation-6-2'))).dir, 1);
  assert.equal((await state(figure(page, 'rotation-6-3'))).dir, 1);
  // an axis with no rise, and a plane, have no senses to choose
  assert.equal(await figure(page, 'rotation-4-0').locator('.symbol-senses').count(), 0);
  assert.equal(await figure(page, 'plane-c').locator('.symbol-senses').count(), 0);
  assert.equal(await figure(page, 'rotation-6-2').locator('.symbol-sense').count(), 2);
  assert.deepEqual(errors, []);
  await context.close();
});

await section('looking down the axis turns the crystal into its plate, and back', async () => {
  const { context, page, errors } = await open(GUIDE);
  const host = figure(page, 'rotation-3-1');
  await host.scrollIntoViewIfNeeded();
  const before = await state(host);
  await host.getByRole('button', { name: 'Look down the axis' }).click();
  await until(host, '!s.glide && Math.abs(s.pitch - Math.PI / 2) < 1e-6 && Math.abs(s.yaw) < 1e-6', null,
    'the view ends straight down, plate way up');
  if (shots) await host.screenshot({ path: `${shots}/symbol-guide-${engine}-down.png` });
  await host.getByRole('button', { name: 'Back to the side view' }).click();
  await until(host, '!s.glide && Math.abs(s.pitch - arg.pitch) < 1e-6 && Math.abs(s.yaw - arg.yaw) < 1e-6', before,
    'and comes back to the side view');
  // every tile at once
  const all = host.getByRole('button', { name: 'Move every tile' });
  await all.click();
  assert.equal((await state(host)).everything, true);
  assert.equal(await all.getAttribute('aria-pressed'), 'true');
  await page.waitForTimeout(600);
  if (shots) await host.screenshot({ path: `${shots}/symbol-guide-${engine}-every.png` });
  assert.deepEqual(errors, []);
  await context.close();
});

await section('the crystal turns and the motif moves under the pointer and the keys', async () => {
  const { context, page, errors } = await open(GUIDE);
  const host = figure(page, 'plane-n');
  await host.scrollIntoViewIfNeeded();
  await host.getByRole('button', { name: 'Pause' }).click();
  const before = await state(host);
  const canvas = await host.locator('.symbol-view--crystal canvas').boundingBox();
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width / 2 + 80, canvas.y + canvas.height / 2 + 30, { steps: 5 });
  await page.mouse.up();
  const turned = await state(host);
  assert.ok(turned.yaw > before.yaw + 0.3, 'a drag to the right turns it');
  assert.ok(turned.pitch > before.pitch + 0.05, 'a drag down tips it towards the viewer');
  // the handle sits on the ringed tile, and dragging it moves the motif by the same distance
  const handle = host.locator('.symbol-seed');
  const box = await handle.boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44, 'the handle is a fair target');
  const scale = await host.evaluate((el) => el.symbolFigure.views[1].s);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 30, box.y + box.height / 2 - 45, { steps: 5 });
  await page.mouse.up();
  const dragged = await state(host);
  assert.ok(Math.abs(dragged.x - (before.x - 30 / scale)) < 0.02, `the motif follows the pointer sideways (${dragged.x})`);
  assert.ok(Math.abs(dragged.y - (before.y + 45 / scale)) < 0.02, `and up the plate (${dragged.y})`);
  const moved = await handle.boundingBox();
  assert.ok(Math.abs(moved.x - (box.x - 30)) < 2 && Math.abs(moved.y - (box.y - 45)) < 2, 'the handle stays on it');
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  const keyed = await state(host);
  assert.ok(keyed.x > dragged.x && keyed.y < dragged.y, 'the arrow keys move it too');
  for (let i = 0; i < 30; i += 1) await page.keyboard.press('Shift+ArrowUp');
  const top = await state(host);
  assert.ok(top.y <= 1.61, `it cannot leave the floor (${top.y})`);
  if (shots) await host.screenshot({ path: `${shots}/symbol-guide-${engine}-dragged.png` });
  assert.deepEqual(errors, []);
  await context.close();
});

await section('with reduced motion nothing moves until asked', async () => {
  const { context, page, errors } = await open(GUIDE, { reducedMotion: true });
  const host = figure(page, 'translation');
  await host.scrollIntoViewIfNeeded();
  const first = await state(host);
  assert.equal(first.playing, false);
  await page.waitForTimeout(900);
  assert.deepEqual(await state(host), first);
  assert.ok(await colours(host.locator('.symbol-view--crystal canvas')) >= 4, 'the still figure is drawn');
  await host.getByRole('button', { name: 'Step' }).click();
  await until(host, '!s.once && s.u === 0 && s.k === arg', first.k + 1, 'a step still steps');
  assert.deepEqual(errors, []);
  await context.close();
});

await section('a link to one symbol lands on its card', async () => {
  for (const [width, height] of [[1280, 900], [390, 780]]) {
    const { context, page, errors } = await open(`${GUIDE}#rotation-6-3`, { width, height });
    await page.waitForTimeout(600);
    const top = await page.locator('#rotation-6-3').evaluate((el) => el.getBoundingClientRect().top);
    assert.ok(top > 40 && top < 140, `the card is just under the header at ${width}px (top ${Math.round(top)})`);
    assert.ok(await colours(figure(page, 'rotation-6-3').locator('.symbol-view--crystal canvas')) >= 4);
    assert.deepEqual(errors, []);
    await context.close();
  }
});

await section('the phone layout', async () => {
  const { context, page, errors } = await open(GUIDE, { width: 390, height: 780 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.equal(overflow, 0, 'no sideways scroll at 390px');
  const host = figure(page, 'rotation-6-1');
  await host.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const crystal = await host.locator('.symbol-view--crystal canvas').boundingBox();
  const plate = await host.locator('.symbol-view--plate canvas').boundingBox();
  assert.ok(plate.y >= crystal.y + crystal.height - 1, 'the plate sits under the crystal');
  assert.ok(crystal.width > 300 && plate.width > 280, 'both keep a useful size');
  const text = await page.locator('#rotation-6-1 .symbol-card-text').boundingBox();
  assert.ok(text.y > plate.y, 'the figure comes before the words');
  for (const button of await host.locator('.symbol-controls button').all()) {
    const box = await button.boundingBox();
    assert.ok(box.height >= 36, 'buttons are tall enough to tap');
    assert.ok(box.x >= 0 && box.x + box.width <= 390, 'and stay on the screen');
  }
  if (shots) await page.screenshot({ path: `${shots}/symbol-guide-${engine}-phone.png` });
  assert.deepEqual(errors, []);
  await context.close();
});

await section('the correspondence pages link to the guide', async () => {
  for (const path of ['correspondence.html', 'correspondence-p6.html']) {
    const { context, page } = await open(new URL(path, base).href);
    const link = page.locator('.diagram-symbol-teaser a.diagram-symbol-guide');
    assert.equal(await link.getAttribute('href'), 'correspondence-symbols.html', `${path}: the card links to the guide`);
    await page.locator('[data-diagram-symbol-open]').click();
    const hrefs = await page.$$eval('#diagram-symbol-index .diagram-symbol-item', (items) => items.map((item) => [
      item.dataset.legendSymbol, item.querySelector('.diagram-symbol-explanation strong a')?.getAttribute('href')]));
    assert.equal(hrefs.length, 21, `${path}: 21 symbols in the visual index`);
    for (const [id, href] of hrefs) assert.equal(href, `correspondence-symbols.html#${id}`, `${path}: ${id} opens its card`);
    assert.deepEqual(hrefs.map(([id]) => id), ALL, 'the guide follows the order of the index');
    if (path === 'correspondence.html') {
      await link.click();
      await page.waitForURL(/correspondence-symbols\.html$/);
      assert.match(await page.locator('h1').innerText(), /diagram symbol/i);
    }
    await context.close();
  }
});

await browser.close();
console.log(`symbol guide — ${label}`);
console.log(notes.join('\n'));
if (failures) { console.error(`${failures} section(s) failed`); process.exit(1); }
