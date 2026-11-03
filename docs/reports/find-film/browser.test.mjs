/** Browser integration + responsive visual checks. Run with a local server:
 * FIND_FILM_URL=http://127.0.0.1:8936/reports/find-film/ node browser.test.mjs
 */
import strictAssert from 'node:assert/strict';
import { chromium } from '/Users/yaroslavvb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const url = process.env.FIND_FILM_URL || 'http://127.0.0.1:8936/reports/find-film/';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const errors = [], failedResponses = [], failedRequests = [];
const issues = [];
const soft = fn => (...args) => { try { fn(...args); } catch (error) { issues.push(typeof args.at(-1) === 'string' ? args.at(-1) : error.message.split('\n')[0]); } };
const assert = new Proxy(soft(strictAssert), { get: (_, name) => soft(strictAssert[name]) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`); });
page.on('requestfailed', request => failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`));
const canvasSignature = selector => page.locator(selector).evaluate(canvas => canvas.toDataURL());
async function setSlider(locator, value) {
  await locator.evaluate((input, value) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }, String(value));
}
try {
  await page.goto(url);
  await page.addStyleTag({ content: '* { scroll-behavior: auto !important; }' });
  await page.waitForSelector('body[data-ready="true"]', { timeout: 20000 });
  await page.waitForFunction(() => document.querySelector('#lab-status').textContent.includes('ready'));
  const lessons = await page.evaluate(() => window.__findFilm.lessons.map(({ id, kind }) => ({ id, kind })));
  assert.equal(lessons.length, 45, 'all 45 statements are available');

  for (let i = 0; i < lessons.length; ++i) {
    await page.locator(`.source-line[data-lesson="${i}"]`).first().click();
    const canvas = page.locator('#active-lesson canvas');
    assert.equal(await canvas.getAttribute('data-drawn'), 'true', `statement ${i + 1} rendered`);
    const pixels = await canvas.evaluate(canvas => {
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let visible = 0; const colors = new Set();
      for (let i = 0; i < data.length; i += 4) if (data[i + 3]) { ++visible; colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`); }
      return { visible, colors: colors.size };
    });
    assert(pixels.visible > 1000 && pixels.colors > 5, `statement ${i + 1} has a populated visualization`);
    const slider = page.locator('#active-lesson input[type="range"]');
    await setSlider(slider, await slider.getAttribute('min'));
    const low = await page.locator('#active-lesson output').textContent();
    const lowCanvas = await canvasSignature('#active-lesson canvas');
    await setSlider(slider, await slider.getAttribute('max'));
    const high = await page.locator('#active-lesson output').textContent();
    assert.notEqual(low, high, `statement ${i + 1} control updates its output`);
    assert.notEqual(await canvasSignature('#active-lesson canvas'), lowCanvas, `statement ${i + 1} control changes the visualization`);
  }

  await page.locator('#notebook').click();
  assert.equal(await page.locator('#all-lessons .lesson').count(), 45, 'annotated view contains every statement');
  for (let i = 0; i < 45; ++i) {
    const lesson = page.locator('#all-lessons .lesson').nth(i);
    await lesson.scrollIntoViewIfNeeded();
    await page.waitForFunction(index => document.querySelectorAll('#all-lessons canvas')[index].dataset.drawn === 'true', i);
  }
  await page.locator('#guided').click();

  await page.locator('#hero').scrollIntoViewIfNeeded();
  const originalHero = await canvasSignature('#hero');
  await page.locator('#hero-align').check();
  assert.notEqual(await canvasSignature('#hero'), originalHero, 'hero alignment changes the three frames');
  assert.match(await page.locator('#hero-caption').textContent(), /coincide|align|matching slide/i);
  await page.locator('#hero-play').click();
  assert.equal(await page.locator('#hero-play').getAttribute('aria-pressed'), 'true');
  const heroAtStart = await canvasSignature('#hero');
  await page.waitForTimeout(250);
  assert.notEqual(await canvasSignature('#hero'), heroAtStart, 'hero playback advances saved frames');
  await page.locator('#hero-play').click();

  await page.locator('#step').click();
  await page.waitForFunction(() => document.querySelector('#sweep-value').textContent === '1');
  assert.match(await page.locator('#lab-status').textContent(), /sweep 1/i);
  await page.locator('#run').click();
  await page.waitForFunction(() => document.querySelector('#lab-status').textContent.includes('Film found'), { timeout: 30000 });
  const completed = await page.locator('#sweep-value').textContent();
  assert.equal(completed, '25', 'real seed 1 worker converges in 25 sweeps');
  assert(Math.abs(Number(await page.locator('#period-value').textContent()) - 6.3901599185) < 1e-8);
  assert(Number(await page.locator('#residual-value').textContent()) < 1e-10);

  for (let i = 0; i < lessons.length; ++i) if (['loop', 'return'].includes(lessons[i].kind)) {
    await page.locator(`.source-line[data-lesson="${i}"]`).first().click();
    const slider = page.locator('#active-lesson input[type="range"]');
    await setSlider(slider, await slider.getAttribute('min'));
    const low = await page.locator('#active-lesson output').textContent();
    await setSlider(slider, await slider.getAttribute('max'));
    assert.notEqual(await page.locator('#active-lesson output').textContent(), low, `statement ${i + 1} scrubs measured sweeps after the solver runs`);
  }

  await setSlider(page.locator('#inspect'), 1);
  assert.match(await page.locator('#inspect-value').textContent(), /Sweep 1\b/);
  await page.locator('#use-inspected').check();
  const freeIndex = lessons.findIndex(lesson => lesson.kind === 'free');
  await page.locator(`.source-line[data-lesson="${freeIndex}"]`).first().click();
  const firstSweepDiagram = await canvasSignature('#active-lesson canvas');
  await setSlider(page.locator('#inspect'), 25);
  assert.notEqual(await canvasSignature('#active-lesson canvas'), firstSweepDiagram, 'inspect checkbox feeds earlier/later measured sweeps to diagrams');
  await page.locator('#use-inspected').uncheck();

  const seed1Canvas = await canvasSignature('#lab-field');
  await page.locator('#seed').fill('2');
  await page.locator('#restart').click();
  await page.waitForFunction(() => document.querySelector('#lab-status').textContent.startsWith('Seed 2: ready'));
  assert.equal(await page.locator('#sweep-value').textContent(), '0');
  const seed2Canvas = await canvasSignature('#lab-field');
  // A reset must display the newly generated state before the first sweep.
  await page.locator('#seed').fill('3');
  await page.locator('#restart').click();
  await page.waitForFunction(() => document.querySelector('#lab-status').textContent.startsWith('Seed 3: ready'));
  assert.notEqual(await canvasSignature('#lab-field'), seed2Canvas, 'reset with a new seed changes the visible starting field');
  assert.notEqual(seed1Canvas, seed2Canvas);
  await page.locator('#run').click();
  await page.waitForFunction(() => Number(document.querySelector('#sweep-value').textContent) > 0);
  await page.locator('#pause').click();
  await page.waitForFunction(() => document.querySelector('#lab-status').textContent.startsWith('Paused'));
  assert.equal(await page.locator('#pause').isDisabled(), true, 'pause returns the solver to an idle state');

  await page.locator('.source-line[data-lesson="33"]').first().click();
  await page.locator('#walkthrough').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/find-film-desktop.png', fullPage: true });
  await page.locator('#active-lesson').screenshot({ path: '/tmp/find-film-lesson.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await page.addStyleTag({ content: '* { scroll-behavior: auto !important; }' });
  await page.waitForSelector('body[data-ready="true"]');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile page has no horizontal overflow');
  const controlsOutside = await page.locator('.hero-controls button, .hero-controls label, .lab-controls button, .lab-controls label, .lesson-nav button, .mini-controls input').evaluateAll(elements => elements.map(el => ({ text: el.textContent.trim(), rect: el.getBoundingClientRect().toJSON() })).filter(({ rect }) => rect.width && (rect.left < -1 || rect.right > innerWidth + 1)));
  assert.deepEqual(controlsOutside, [], 'mobile controls fit their containers');
  await page.screenshot({ path: '/tmp/find-film-mobile.png', fullPage: true });
  await page.screenshot({ path: '/tmp/find-film-mobile-top.png' });
  await page.locator('#active-lesson').screenshot({ path: '/tmp/find-film-mobile-lesson.png' });

  const localLinks = await page.locator('a[href]').evaluateAll(anchors => [...new Set(anchors.map(a => a.href).filter(href => href.startsWith(location.origin) && !href.includes('#')))]);
  for (const link of localLinks) {
    const response = await page.request.get(link);
    assert(response.ok(), `local linked resource loads: ${link}`);
  }

  assert.deepEqual(errors, [], 'no browser console or uncaught JavaScript errors');
  assert.deepEqual(failedResponses, [], 'no HTTP 4xx/5xx responses');
  assert.deepEqual(failedRequests, [], 'no failed network requests');
  console.log(JSON.stringify({ url, statements: lessons.length, solverSweeps: Number(completed), desktop: '/tmp/find-film-desktop.png', mobile: '/tmp/find-film-mobile.png', errors, failedResponses, failedRequests, issues }, null, 2));
  strictAssert.deepEqual(issues, [], 'all browser checks pass');
} finally {
  await browser.close();
}
