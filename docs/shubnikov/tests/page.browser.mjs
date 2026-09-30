// The Shubnikov page in a real browser engine: the three levels of tabs, the
// lazy grid of cards, the viewer dialog and its links, the filters, the phone
// layout, the CPU fallback — and the one check the whole page rests on, that the
// pixels the browser draws are the colours the arithmetic says they are.
//
// That last section is the interesting one.  It pauses the viewer at a known
// time, reads the stage back, maps each sampled device pixel to the lattice
// coordinate the fragment shader saw, evaluates Psi there in Node through the
// page's own shub-field.mjs (imported as a file, never run in the browser),
// takes the phase sector, and asks for the grey of that sector.  Pixels within a
// few device pixels of a sector boundary are skipped: there the renderer
// anti-aliases between two inks on purpose, and there is no single right answer
// to compare against.
//
// Usage: node docs/shubnikov/tests/page.browser.mjs [base-url] [label]
//
//        node docs/shubnikov/tests/page.browser.mjs \
//          https://yaroslavvb.github.io/animated-groups-fable/ live
//
//        PLAYWRIGHT_MODULE=…  where to import Playwright from
//        CHROME_CHANNEL=…     browser channel (default `chrome`; falls back to
//                             Playwright's bundled Chromium if it is missing)
//        SHOT_DIR=…           write the desktop, dialog and phone screenshots
//        SHUB_GRID=15         samples per side in the shader/arithmetic check
//        SHUB_RENDERER=cpu    run that check against the CPU twin as well
//        VERBOSE=1            print stacks for failures
//
// The census is fetched from whatever copy of the site is under test, so a live
// deployment is checked against its own data.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  indexCensus, expandClass, filmGeometry, viewWidth, sector,
} from '../shub-field.mjs';
import { MAX_WAVES, inkBytes } from '../shub-render.mjs';

const runtime = '/Users/yaroslavvb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? `${runtime}playwright/index.mjs`);
const base = (process.argv[2] ?? 'http://localhost:8934/').replace(/\/?$/, '/');
const label = process.argv[3] ?? 'local';
const shots = process.env.SHOT_DIR ?? null;
const GRID = Number(process.env.SHUB_GRID ?? 15);
if (shots) mkdirSync(shots, { recursive: true });
const url = (path = '') => new URL(`shubnikov/${path}`, base).href;

console.log(`shubnikov page — ${label} (${base})`);

let failures = 0;
const consoleTrouble = [];
async function section(name, body) {
  const started = Date.now();
  try {
    await body();
    console.log(`ok   ${name} (${Date.now() - started} ms)`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${name}: ${error.message}`);
    if (process.env.VERBOSE) console.log(String(error.stack));
  }
}
const note = (text) => console.log(`       ${text}`);

// ---- the census, read from the site under test -------------------------------

const response = await fetch(url('data/census.json'));
assert.ok(response.ok, `the census is served (${response.status})`);
const census = indexCensus(await response.json());
assert.equal(census.classes.length, 990, 'the census carries the 990 colourings');
assert.equal(Object.keys(census.films).length, 68, 'over the 68 forward film groups');
assert.equal(census.order.length, 17, 'grouped by the 17 wallpaper groups');

const NS = [2, 3, 4, 6];
const familyOf = (gid) => census.films[gid].family;
const classesOf = (gid, n = null, keys = null) => census.classes.filter((cls) => (
  cls.gid === gid && (n === null || cls.n === n) && (keys === null || keys.includes(cls.key))));
/** How many classes a family holds under a given pair of filters. */
const expectedCount = (family, filterN, filterKey) => census.classes.filter((cls) => (
  familyOf(cls.gid) === family
  && (filterN === 'all' || cls.n === filterN)
  && (filterKey === 'all' || cls.key === filterKey)
)).length;
/** A film to test on: the named one when this census still has it, else the
 * largest, so the suite keeps working if the census is ever rebuilt. */
const film = (preferred) => (census.films[preferred] ? preferred
  : Object.keys(census.films).sort((a, b) => classesOf(b).length - classesOf(a).length)[0]);
const classId = (preferred, gid, n) => (census.byId.has(preferred) ? preferred : classesOf(gid, n)[0].id);

// ---- the browser -------------------------------------------------------------

const channel = process.env.CHROME_CHANNEL ?? 'chrome';
let browser;
try {
  browser = await playwright.chromium.launch({ channel, headless: true });
} catch (error) {
  note(`the ${channel} channel is not installed; using Playwright's Chromium`);
  browser = await playwright.chromium.launch({ headless: true });
}

/** A page whose console errors, page errors and bad responses are collected. */
async function open(path = '', {
  width = 1440, height = 900, mobile = false, reducedMotion = 'no-preference', where = path || '/',
} = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: mobile ? 3 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion,
  });
  const page = await context.newPage();
  const errors = [];
  const keep = (text) => { errors.push(text); consoleTrouble.push(`${where}: ${text}`); };
  page.on('console', (message) => { if (message.type() === 'error') keep(`console: ${message.text()}`); });
  page.on('pageerror', (error) => keep(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => keep(`requestfailed: ${request.url()} ${request.failure()?.errorText}`));
  page.on('response', (res) => { if (res.status() >= 400) keep(`${res.status()} ${res.url()}`); });
  await page.goto(url(path), { waitUntil: 'load' });
  // shub-app.mjs stamps the renderer it settled on once the census is in
  await page.waitForSelector('main[data-ready]', { timeout: 60000 });
  return { context, page, errors };
}
const clean = (errors) => assert.equal(errors.length, 0, `console is clean:\n  ${errors.slice(0, 5).join('\n  ')}`);
const shoot = async (page, name) => { if (shots) await page.screenshot({ path: join(shots, `${name}.png`) }); };
/** The film section (not its tab) and the cards inside it. */
const filmBox = (gid) => `[data-film="${gid}"]:not([role="tab"])`;

// ---- page-side helpers (each one self-contained: no closures) ----------------

/** Grey levels, plateaus (levels holding >=0.5% of the picture) and alpha of a canvas. */
const readCanvas = ({ selector, index = 0 }) => {
  const canvas = document.querySelectorAll(selector)[index];
  if (!canvas) throw new Error(`no canvas matches ${selector} [${index}]`);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(`${selector} is not a 2D canvas`);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const counts = new Map();
  let alpha = 0;
  for (let i = 0; i < data.length; i += 4) {
    counts.set(data[i], (counts.get(data[i]) ?? 0) + 1);
    alpha += data[i + 3];
  }
  const pixels = data.length / 4;
  return {
    width: canvas.width,
    height: canvas.height,
    alphaMean: alpha / pixels,
    levels: [...counts.keys()].sort((a, b) => a - b),
    plateaus: [...counts.entries()]
      .filter(([, count]) => count / pixels >= 0.005)
      .map(([level, count]) => [level, count / pixels])
      .sort((a, b) => a[0] - b[0]),
  };
};

/** Every card of a film: where it is, and whether anything was ever drawn in it. */
const readCards = ({ scope }) => {
  const box = document.querySelector(scope);
  if (!box) throw new Error(`no ${scope}`);
  const rows = [];
  for (const figure of box.querySelectorAll('[data-class]')) {
    const rect = figure.getBoundingClientRect();
    const canvas = figure.querySelector('canvas');
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let alpha = 0;
    const levels = new Set();
    for (let i = 0; i < data.length; i += 4) { alpha += data[i + 3]; levels.add(data[i]); }
    rows.push({
      id: figure.dataset.class,
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      drawn: alpha > 0,
      levels: levels.size,
    });
  }
  return {
    rows,
    innerHeight: window.innerHeight,
    onScreen: window.shubnikov?.state?.onScreen?.size ?? null,
    mounted: window.shubnikov?.state?.cards?.size ?? null,
  };
};

/** Fraction of the pixels of a canvas that move over `ms` milliseconds. */
const canvasChurn = async ({ selector, ms }) => {
  const canvas = document.querySelector(selector);
  if (!canvas) throw new Error(`no canvas matches ${selector}`);
  const grab = () => canvas.getContext('2d')
    .getImageData(0, 0, canvas.width, canvas.height).data.slice();
  const before = grab();
  await new Promise((resolve) => setTimeout(resolve, ms));
  const after = grab();
  let moved = 0;
  for (let i = 0; i < before.length; i += 4) if (Math.abs(before[i] - after[i]) > 8) moved += 1;
  return moved / (before.length / 4);
};

/** Anything sticking out past the right edge that is not inside a scroller. */
const readOverflow = () => {
  const inScroller = (el) => {
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.overflowX === 'auto' || style.overflowX === 'scroll') return true;
    }
    return false;
  };
  return {
    scrollWidth: document.scrollingElement.scrollWidth,
    inner: window.innerWidth,
    wide: [...document.querySelectorAll('main *')]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && !inScroller(el))
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`)
      .slice(0, 4),
  };
};

/** Open one class in the viewer, pause it at a known time, and sample the stage.
 *
 * `scrub` is the transport's own 0…1000 position, so the time is exactly
 * (scrub / 1000) * m film periods however the slider is moved.  The samples are
 * read twice: if the picture moved between the two reads the viewer is not
 * really paused and the comparison would be meaningless.  With the CPU twin the
 * samples are snapped to the centres of its blocks, which it scales up smoothly.
 */
const sampleViewer = async ({ cid, family, gid, scrub, grid }) => {
  const app = window.shubnikov;
  if (app && typeof app.openViewer === 'function') app.openViewer(cid, { push: false });
  else location.hash = `#${family}/${gid}/${cid}`;
  const settle = () => new Promise((resolve) => setTimeout(resolve, 200));
  const stage = () => document.querySelector('[data-viewer-canvas]');
  for (let tries = 0; tries < 30 && !stage()?.closest('dialog')?.open; tries++) await settle();
  const canvas = stage();
  const dialog = canvas?.closest('dialog');
  if (!dialog?.open) throw new Error(`the viewer never opened for ${cid}`);
  await settle();
  const play = dialog.querySelector('[data-viewer-play]');
  if (play && play.getAttribute('aria-pressed') !== 'false') play.click();
  const slider = dialog.querySelector('[data-viewer-scrub]');
  if (!slider) throw new Error('the viewer has no time slider');
  slider.value = String(scrub);
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  slider.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
  const size = canvas.width;
  const cpu = document.querySelector('main').dataset.ready === 'cpu';
  // the twin's block size is its own maxEdge, not a number copied from it
  const maxEdge = app?.renderer?.maxEdge || 48;
  const step = cpu ? size / Math.max(16, Math.min(maxEdge, Math.round(size / 3))) : 1;
  const read = () => canvas.getContext('2d').getImageData(0, 0, size, size).data;
  const columns = [];
  for (let i = 0; i < grid; i++) {
    const exact = ((i + 0.5) / grid) * size - 0.5;
    columns.push(step > 1
      ? Math.round((Math.floor(exact / step) + 0.5) * step - 0.5)
      : Math.round(exact));
  }
  const first = read();
  const points = [];
  for (const col of columns) for (const row of columns) points.push([col, row, first[4 * (row * size + col)]]);
  await settle();
  const second = read();
  let moved = 0;
  for (const [col, row] of points) if (second[4 * (row * size + col)] !== first[4 * (row * size + col)]) moved += 1;
  const card = app?.viewer?.card ?? null;
  return {
    size,
    step,
    points,
    moved,
    scrub: Number(slider.value),
    t: app?.viewer?.t ?? null,
    view: app?.state?.view ?? null,
    width: card?.width ?? null,
    toLattice: card?.geom?.toLattice ?? null,
    kind: document.querySelector('main').dataset.ready,
  };
};

// ---- 1 · the page comes up, with a renderer and the test handle --------------

await section('the page loads, picks a renderer and exposes the test handle', async () => {
  const { context, page, errors } = await open();
  const ready = await page.getAttribute('main[data-ready]', 'data-ready');
  assert.ok(['webgl', 'cpu'].includes(ready), `a renderer was chosen (${ready})`);
  const handle = await page.evaluate(() => {
    const app = window.shubnikov;
    return app ? {
      renderer: app.renderer?.kind,
      openViewer: typeof app.openViewer,
      playing: app.state?.playing,
      classes: app.state?.census?.classes?.length,
      family: app.state?.family,
    } : null;
  });
  assert.ok(handle, 'window.shubnikov is there for the tests');
  assert.equal(handle.renderer, ready, 'and names the same renderer as the markup');
  assert.equal(handle.openViewer, 'function', 'and can open a class');
  assert.equal(handle.classes, 990, 'and holds the whole census');
  assert.equal(handle.family, census.order[0], `the first family is selected (${census.order[0]})`);
  assert.equal(handle.playing, true, 'and the page starts playing');
  assert.equal(await page.getAttribute('[data-status]', 'role'), 'status', 'the running count is a live region');
  await page.waitForTimeout(600);
  clean(errors);
  await shoot(page, 'desktop-top');
  note(`renderer: ${ready}`);
  await context.close();
});

// ---- 2 · the seventeen wallpaper tabs ---------------------------------------

await section('seventeen wallpaper tabs, one panel at a time, arrows and Home/End', async () => {
  const { context, page, errors } = await open();
  assert.equal(await page.locator('[role="tab"][data-family]').count(), 17, 'one tab per wallpaper group');
  assert.equal(await page.locator('[role="tabpanel"][data-family]').count(), 17, 'and one panel each');
  const shape = await page.evaluate(() => [...document.querySelectorAll('[role="tab"][data-family]')].map((tab) => ({
    family: tab.dataset.family,
    id: tab.id,
    inTablist: Boolean(tab.closest('[role="tablist"]')),
    controls: tab.getAttribute('aria-controls'),
    selected: tab.getAttribute('aria-selected'),
    tabIndex: tab.tabIndex,
    count: tab.querySelector('[data-tabcount]')?.textContent,
    panelHidden: document.getElementById(tab.getAttribute('aria-controls'))?.hidden,
    labelled: document.getElementById(tab.getAttribute('aria-controls'))?.getAttribute('aria-labelledby'),
  })));
  assert.deepEqual(shape.map((tab) => tab.family), census.order, 'in the census order');
  for (const tab of shape) {
    assert.ok(tab.inTablist, `${tab.family} lives in a tablist`);
    assert.equal(tab.panelHidden, tab.family !== census.order[0], `only ${census.order[0]} is showing (${tab.family})`);
    assert.equal(tab.labelled, tab.id, `${tab.family}'s panel points back at its tab`);
    assert.equal(tab.count, String(expectedCount(tab.family, 'all', 'all')), `${tab.family} carries its count`);
    assert.equal(tab.tabIndex, tab.family === census.order[0] ? 0 : -1, `roving tabindex (${tab.family})`);
    assert.equal(tab.selected, String(tab.family === census.order[0]), `aria-selected (${tab.family})`);
  }

  const active = () => page.evaluate(() => {
    const el = document.activeElement;
    return {
      family: el?.dataset?.family ?? null,
      selected: el?.getAttribute?.('aria-selected'),
      others: [...document.querySelectorAll('[role="tab"][data-family]')]
        .filter((tab) => tab !== el).map((tab) => tab.tabIndex),
      shown: [...document.querySelectorAll('[role="tabpanel"][data-family]')]
        .filter((panel) => !panel.hidden).map((panel) => panel.dataset.family),
    };
  });
  await page.locator('[role="tab"][data-family]').first().focus();
  for (const [key, want] of [
    ['ArrowRight', census.order[1]],
    ['ArrowDown', census.order[2]],
    ['ArrowLeft', census.order[1]],
    ['End', census.order.at(-1)],
    ['Home', census.order[0]],
  ]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(250);
    const state = await active();
    assert.equal(state.family, want, `${key} moves the focus to ${want}`);
    assert.equal(state.selected, 'true', `${key} selects it`);
    assert.deepEqual(state.shown, [want], `${key} shows only that panel`);
    assert.deepEqual([...new Set(state.others)], [-1], `${key} leaves the other tabs out of the tab order`);
    assert.ok(page.url().includes(`#${want}/`), `${key} writes the hash (${page.url()})`);
  }
  clean(errors);
  await context.close();
});

// ---- 3 · the film sub-tabs --------------------------------------------------

await section('film sub-tabs switch the film and remount its cards', async () => {
  const family = census.order.find((hm) => census.families[hm].films.length > 2);
  const films = census.families[family].films;
  const { context, page, errors } = await open(`#${family}/${films[0]}`, { where: `#${family}` });
  const panel = page.locator(`[role="tabpanel"][data-family="${family}"]`);
  const filmTabs = panel.locator('[role="tab"][data-film]');
  assert.equal(await filmTabs.count(), films.length, `${family} shows its ${films.length} films`);
  const shown = () => page.evaluate((hm) => {
    const box = document.querySelector(`[role="tabpanel"][data-family="${hm}"]`);
    return {
      selected: [...box.querySelectorAll('[role="tab"][data-film]')]
        .filter((tab) => tab.getAttribute('aria-selected') === 'true').map((tab) => tab.dataset.film),
      visible: [...box.querySelectorAll('[data-film]:not([role="tab"])')]
        .filter((part) => !part.hidden).map((part) => part.dataset.film),
      mounted: [...box.querySelectorAll('[data-class]')].map((card) => card.dataset.class.split('-')[0]),
    };
  }, family);
  assert.deepEqual((await shown()).selected, [films[0]], 'the first film is selected');

  await filmTabs.nth(1).click();
  await page.waitForTimeout(600);
  let state = await shown();
  assert.deepEqual(state.selected, [films[1]], `clicking selects ${films[1]}`);
  assert.deepEqual(state.visible, [films[1]], 'and shows only that film');
  assert.ok(state.mounted.length > 0, 'its cards are mounted');
  assert.deepEqual([...new Set(state.mounted)], [films[1]], 'and no other film keeps cards');
  assert.ok(page.url().endsWith(`#${family}/${films[1]}`), `the hash follows (${page.url()})`);

  await filmTabs.nth(1).focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(600);
  state = await shown();
  assert.deepEqual(state.selected, [films[2]], `Arrow moves to ${films[2]}`);
  assert.deepEqual(state.visible, [films[2]], 'and shows it');
  assert.deepEqual([...new Set(state.mounted)], [films[2]], 'and the film before it was torn down');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.film), films[2], 'the focus travels with it');
  clean(errors);
  note(`${family}: ${films.join(' → ')}`);
  await context.close();
});

// ---- 4 · two colours open, the rest closed ----------------------------------

await section('two colours is open, three four and six are closed until asked', async () => {
  const { context, page, errors } = await open();
  const sections = await page.evaluate(() => [...document.querySelectorAll('details[data-n]')]
    .map((details) => ({ n: Number(details.dataset.n), open: details.open, empty: details.dataset.empty === 'true' })));
  assert.equal(sections.length, 68 * 4, 'four colour counts under each of the 68 films');
  assert.equal(sections.filter((s) => s.empty).length, 0, 'no colour count is empty in this census');
  for (const n of NS) {
    const mine = sections.filter((s) => s.n === n);
    assert.equal(mine.length, 68, `${n} colours appears once per film`);
    assert.equal(mine.filter((s) => s.open).length, n === 2 ? 68 : 0,
      `${n} colours starts ${n === 2 ? 'open' : 'closed'}`);
  }
  // the open section is mounted, a closed one is not…
  const gid = census.families[census.order[0]].films[0];
  assert.equal(await page.locator(`${filmBox(gid)} details[data-n="2"] [data-class]`).count(),
    classesOf(gid, 2).length, 'the two-colour cards are built');
  assert.equal(await page.locator(`${filmBox(gid)} details[data-n="3"] [data-class]`).count(),
    0, 'a closed section holds no cards');
  // …and opening it with the pointer builds it
  await page.locator(`${filmBox(gid)} details[data-n="3"] > summary`).click();
  await page.waitForTimeout(800);
  assert.ok(await page.locator(`${filmBox(gid)} details[data-n="3"]`).evaluate((el) => el.open),
    'the summary opens the section');
  assert.equal(await page.locator(`${filmBox(gid)} details[data-n="3"] [data-class]`).count(),
    classesOf(gid, 3).length, `and mounts the ${classesOf(gid, 3).length} three-colour cards of ${gid}`);
  clean(errors);
  await context.close();
});

// ---- 5 · cards mount only when they can be seen -----------------------------

await section('a card draws only once it is on screen, and then shows several greys', async () => {
  const gid = film('g128');
  const { context, page, errors } = await open(`#${familyOf(gid)}/${gid}`, { where: `#${gid}` });
  await page.evaluate((scope) => {
    for (const details of document.querySelectorAll(`${scope} details[data-n]`)) details.open = true;
  }, filmBox(gid));
  await page.waitForTimeout(600);
  // the grid starts below the lede: bring its first row up before looking
  await page.locator(`${filmBox(gid)} [data-class]`).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  const report = await page.evaluate(readCards, { scope: filmBox(gid) });
  assert.equal(report.rows.length, classesOf(gid).length, `all ${classesOf(gid).length} cards of ${gid} are built`);
  const visible = report.rows.filter((row) => row.bottom > 0 && row.top < report.innerHeight);
  const below = report.rows.filter((row) => row.top > report.innerHeight + 300);
  assert.ok(visible.length > 0 && below.length > 0, 'some cards are on screen and some are far below');
  assert.deepEqual(visible.filter((row) => !row.drawn).map((row) => row.id), [], 'every visible card is drawn');
  assert.deepEqual(below.filter((row) => row.drawn).map((row) => row.id), [], 'no card below the fold is drawn');
  assert.ok(report.onScreen < report.mounted,
    `fewer cards animate than are built (${report.onScreen} of ${report.mounted})`);

  // the same card, once you scroll to it
  const last = report.rows.at(-1);
  await page.locator(`[data-class="${last.id}"]`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  const woken = await page.evaluate(readCanvas, { selector: `[data-class="${last.id}"] canvas` });
  assert.equal(woken.alphaMean, 255, `${last.id} draws once it is on screen`);
  assert.ok(woken.levels.length >= 3, `and is not one flat colour (${woken.levels.length} levels)`);
  assert.ok(woken.levels.at(-1) - woken.levels[0] > 100,
    `spanning dark to light (${woken.levels[0]}…${woken.levels.at(-1)})`);
  clean(errors);
  await shoot(page, 'desktop-cards');
  note(`${gid}: ${visible.length} cards on screen, ${below.length} waiting below the fold`);
  await context.close();
});

// ---- 6 · the cards move, and stop when asked --------------------------------

await section('the cards animate, and stop dead when paused', async () => {
  const gid = film('g130');
  const { context, page, errors } = await open(`#${familyOf(gid)}/${gid}`, { where: `#${gid}` });
  const canvas = `${filmBox(gid)} [data-class] canvas`;
  await page.locator(`${filmBox(gid)} [data-class]`).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  assert.equal(await page.getAttribute('[data-play-all]', 'aria-pressed'), 'true', 'the page starts playing');
  const moving = await page.evaluate(canvasChurn, { selector: canvas, ms: 900 });
  assert.ok(moving > 0.02, `the picture moves (${(moving * 100).toFixed(1)}% of pixels in 0.9 s)`);
  await page.click('[data-play-all]');
  assert.equal(await page.getAttribute('[data-play-all]', 'aria-pressed'), 'false', 'Pause all presses');
  await page.waitForTimeout(600);
  const still = await page.evaluate(canvasChurn, { selector: canvas, ms: 900 });
  assert.equal(still, 0, `and then nothing moves (${(still * 100).toFixed(2)}%)`);
  const frozen = await page.evaluate(readCanvas, { selector: canvas });
  assert.ok(frozen.levels.length >= 2, `the paused card still shows its frame (${frozen.levels.length} levels)`);
  await page.click('[data-play-all]');
  await page.waitForTimeout(400);
  const again = await page.evaluate(canvasChurn, { selector: canvas, ms: 1200 });
  assert.ok(again > 0.02, `Play all starts it again (${(again * 100).toFixed(1)}%)`);
  clean(errors);
  note(`moving ${(moving * 100).toFixed(1)}% → paused ${(still * 100).toFixed(2)}% → ${(again * 100).toFixed(1)}%`);
  await context.close();
});

// ---- 7 · the greys, and the one-colour view --------------------------------

// A six-colour class that is invisible to the clock is the honest test of the
// palette: some symmetry of the plane pattern itself advances the colour by one,
// so all six colours hold the same area in every single frame.
await section('six greys in the greys view, exactly two inks in one colour', async () => {
  const sixes = census.classes.filter((cls) => cls.n === 6 && cls.key === 'ct0');
  const cls = sixes.find((row) => row.gid === 'g243') ?? sixes[0];
  const gid = cls.gid;
  const { context, page, errors } = await open(`#${familyOf(gid)}/${gid}`, { where: `#${gid}` });
  await page.evaluate((scope) => {
    const six = document.querySelector(`${scope} details[data-n="6"]`);
    six.open = true;
    six.scrollIntoView({ block: 'center' });
  }, filmBox(gid));
  await page.waitForTimeout(1500);
  const card = `[data-class="${cls.id}"] canvas`;
  const greysView = await page.evaluate(readCanvas, { selector: card });
  const sixGreys = inkBytes(6, 'greys').map((rgb) => rgb[0]);
  const area = (view, ink) => view.plateaus.filter(([level]) => Math.abs(level - ink) <= 2)
    .reduce((sum, [, part]) => sum + part, 0);
  for (const ink of sixGreys) {
    assert.ok(area(greysView, ink) > 0.02,
      `the grey ${ink} covers real area (${(area(greysView, ink) * 100).toFixed(1)}%) — plateaus ${JSON.stringify(greysView.plateaus)}`);
  }
  assert.ok(greysView.plateaus.every(([level]) => sixGreys.some((ink) => Math.abs(level - ink) <= 2)),
    `and no seventh ink holds any (${JSON.stringify(greysView.plateaus)})`);

  await page.click('[data-view="one"]');
  await page.waitForTimeout(900);
  assert.equal(await page.getAttribute('[data-view="one"]', 'aria-pressed'), 'true', 'the one-colour chip presses');
  const oneView = await page.evaluate(readCanvas, { selector: card });
  const [dark, light] = inkBytes(6, 'one').map((rgb) => rgb[0]);
  assert.ok(oneView.plateaus.every(([level]) => Math.abs(level - dark) <= 6 || Math.abs(level - light) <= 6),
    `one colour is two inks and nothing else (${JSON.stringify(oneView.plateaus)})`);
  const black = area(oneView, dark);
  const white = area(oneView, light);
  assert.ok(black > 0.02, `colour 0 is there in black (${(black * 100).toFixed(1)}%)`);
  assert.ok(white > 0.3, `and the other five are white (${(white * 100).toFixed(1)}%)`);
  await page.click('[data-view="greys"]');
  assert.equal(await page.getAttribute('[data-view="greys"]', 'aria-pressed'), 'true', 'and back to the greys');
  clean(errors);
  note(`${cls.id}: six inks at ${sixGreys.map((ink) => `${Math.round(area(greysView, ink) * 100)}%`).join('/')}; `
    + `one colour ${Math.round(black * 100)}% black, ${Math.round(white * 100)}% white`);
  await context.close();
});

// ---- 8 · the deep link, Escape, Back and Forward ----------------------------

await section('a deep link opens the viewer; Escape, Back and Forward agree about it', async () => {
  const cid = classId('g130-n4-2', film('g130'), 4);
  const cls = census.byId.get(cid);
  const home = `#${familyOf(cls.gid)}/${cls.gid}`;
  const { context, page, errors } = await open(`${home}/${cid}`, { where: `${home}/${cid}` });
  const dialog = page.locator('dialog:has([data-viewer-canvas])');
  await dialog.waitFor({ state: 'visible', timeout: 20000 });
  assert.ok(await dialog.evaluate((el) => el.open), 'the deep link opens the viewer');
  assert.ok(await dialog.evaluate((el) => el.matches(':modal')), 'as a modal dialog');
  const title = await page.evaluate(() => {
    const box = document.querySelector('[data-viewer-canvas]').closest('dialog');
    return document.getElementById(box.getAttribute('aria-labelledby'))?.textContent ?? '';
  });
  assert.ok(title.includes(cls.gid), `the title names the film group (${title})`);
  assert.ok(title.includes(String(cls.n)), 'and the number of colours');
  assert.equal(await page.locator(`details[data-n="${cls.n}"][open] [data-class="${cid}"]`).count(), 1,
    'the colour-count section holding the card was opened behind it');
  await page.waitForTimeout(900);
  const stage = await page.evaluate(readCanvas, { selector: '[data-viewer-canvas]' });
  assert.ok(stage.levels.length >= 3, `the stage draws (${stage.levels.length} levels)`);
  await shoot(page, 'desktop-dialog');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  assert.equal(await dialog.evaluate((el) => el.open), false, 'Escape closes it');
  assert.ok(page.url().endsWith(home), `and drops the class from the link (${page.url()})`);
  await page.goBack();
  await page.waitForTimeout(700);
  assert.ok(page.url().endsWith(cid), `Back returns to the class link (${page.url()})`);
  assert.equal(await dialog.evaluate((el) => el.open), true, 'and reopens the viewer');
  await page.goForward();
  await page.waitForTimeout(700);
  assert.ok(page.url().endsWith(home), `Forward leaves it again (${page.url()})`);
  assert.equal(await dialog.evaluate((el) => el.open), false, 'and closes the viewer');
  clean(errors);
  await context.close();
});

// ---- 9 · the filters --------------------------------------------------------

await section('the filters rewrite every count and hide the rest', async () => {
  const gid = film('g64');
  const { context, page, errors } = await open(`#${familyOf(gid)}/${gid}`, { where: `#${gid}` });
  const counts = () => page.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('[role="tab"][data-family]')]
      .map((tab) => [tab.dataset.family, Number(tab.querySelector('[data-tabcount]').textContent)]),
  ));
  const live = () => page.evaluate((scope) => {
    const box = document.querySelector(scope);
    return [...box.querySelectorAll('details[data-n]')].filter((d) => !d.hidden).map((details) => ({
      n: Number(details.dataset.n),
      open: details.open,
      badge: Number(details.querySelector('summary b')?.textContent),
      keys: [...details.querySelectorAll('[data-key]')].filter((g) => !g.hidden).map((g) => g.dataset.key),
    }));
  }, filmBox(gid));

  for (const [filterN, filterKey] of [[6, 'all'], [6, 'ct0'], ['all', 'ctne'], ['all', 'all']]) {
    await page.click(`[data-filter-n="${filterN}"]`);
    await page.click(`[data-filter-key="${filterKey}"]`);
    await page.waitForTimeout(500);
    assert.equal(await page.getAttribute(`[data-filter-n="${filterN}"]`, 'aria-pressed'), 'true', `n=${filterN} presses`);
    assert.equal(await page.getAttribute(`[data-filter-key="${filterKey}"]`, 'aria-pressed'), 'true', `${filterKey} presses`);
    const want = Object.fromEntries(census.order.map((hm) => [hm, expectedCount(hm, filterN, filterKey)]));
    assert.deepEqual(await counts(), want, `every tab count is the census count for n=${filterN}, ${filterKey}`);
    const sections = await live();
    // a clock group with no classes is never stamped, and a colour count with
    // nothing left to show is hidden altogether
    const keys = filterKey === 'all' ? ['ct0', 'ctne'] : [filterKey];
    const wantedNs = (filterN === 'all' ? NS : [filterN])
      .filter((n) => classesOf(gid, n, keys).length > 0);
    assert.deepEqual(sections.map((s) => s.n), wantedNs,
      `the colour counts of ${gid} on show for n=${filterN}, ${filterKey}`);
    for (const part of sections) {
      assert.deepEqual(part.keys, keys.filter((key) => classesOf(gid, part.n, [key]).length > 0),
        `the clock groups on show under n=${part.n}`);
      assert.equal(part.badge, classesOf(gid, part.n, keys).length, `${gid} n=${part.n} counts its own classes`);
    }
    // only what is open, shown and unfiltered is mounted
    const mounted = await page.locator(`${filmBox(gid)} [data-class]`).count();
    const expected = sections.filter((s) => s.open)
      .reduce((sum, s) => sum + classesOf(gid, s.n, keys).length, 0);
    assert.equal(mounted, expected, `${expected} cards mounted under n=${filterN}, ${filterKey}`);
  }
  clean(errors);
  await context.close();
});

// ---- 10 · prefers-reduced-motion -------------------------------------------

await section('prefers-reduced-motion starts the page paused', async () => {
  const gid = film('g130');
  const { context, page, errors } = await open(`#${familyOf(gid)}/${gid}`,
    { reducedMotion: 'reduce', where: 'reduced-motion' });
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => window.shubnikov.state.playing), false, 'the clock is not running');
  assert.equal(await page.getAttribute('[data-play-all]', 'aria-pressed'), 'false', 'the control says so');
  assert.match(await page.textContent('[data-play-all]'), /play/i, 'and offers to play');
  const canvas = `${filmBox(gid)} [data-class] canvas`;
  await page.locator(`${filmBox(gid)} [data-class]`).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  const first = await page.evaluate(readCanvas, { selector: canvas });
  assert.equal(first.alphaMean, 255, 'a card still paints its first frame');
  assert.ok(first.levels.length >= 2, `which is a real picture (${first.levels.length} levels)`);
  const churn = await page.evaluate(canvasChurn, { selector: canvas, ms: 900 });
  assert.equal(churn, 0, `and it does not move (${(churn * 100).toFixed(2)}%)`);
  clean(errors);
  await context.close();
});

// ---- 11 · the CPU fallback --------------------------------------------------

await section('?renderer=cpu draws the page without WebGL', async () => {
  const gid = film('g130');
  const { context, page, errors } = await open(`?renderer=cpu#${familyOf(gid)}/${gid}`,
    { width: 900, height: 700, where: '?renderer=cpu' });
  assert.equal(await page.getAttribute('main[data-ready]', 'data-ready'), 'cpu', 'the CPU twin was chosen');
  assert.equal(await page.evaluate(() => window.shubnikov.renderer.kind), 'cpu', 'and it is the renderer in use');
  const canvas = `${filmBox(gid)} [data-class] canvas`;
  await page.locator(`${filmBox(gid)} [data-class]`).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  const drawn = await page.evaluate(readCanvas, { selector: canvas });
  assert.equal(drawn.alphaMean, 255, 'a card is painted');
  assert.ok(drawn.levels.length >= 2, `with more than one ink (${drawn.levels.length} levels)`);
  assert.ok(drawn.levels.at(-1) - drawn.levels[0] > 100, `dark and light (${drawn.levels[0]}…${drawn.levels.at(-1)})`);
  const churn = await page.evaluate(canvasChurn, { selector: canvas, ms: 1000 });
  assert.ok(churn > 0.01, `and it animates (${(churn * 100).toFixed(1)}%)`);
  clean(errors);
  await context.close();
});

// ---- 12 · the phone --------------------------------------------------------

await section('nothing hangs off the side of a 390x844 phone', async () => {
  const { context, page, errors } = await open('', { width: 390, height: 844, mobile: true, where: 'phone' });
  await page.waitForTimeout(1000);
  let width = await page.evaluate(readOverflow);
  assert.ok(width.scrollWidth <= width.inner,
    `the landing fits (${width.scrollWidth} > ${width.inner}: ${width.wide.join(', ')})`);
  assert.deepEqual(width.wide, [], 'and no element outside a scroller reaches past the viewport');
  await shoot(page, 'mobile-top');

  // the widest family: several films, and several cards to a row
  const crowd = [...census.order].sort((a, b) => expectedCount(b, 'all', 'all') - expectedCount(a, 'all', 'all'))[0];
  await page.click(`[role="tab"][data-family="${crowd}"]`);
  await page.waitForTimeout(700);
  await page.locator('[data-class]').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1400);
  width = await page.evaluate(readOverflow);
  assert.ok(width.scrollWidth <= width.inner,
    `${crowd} fits too (${width.scrollWidth} > ${width.inner}: ${width.wide.join(', ')})`);
  assert.deepEqual(width.wide, [], `and nothing in ${crowd} reaches past it`);
  const phoneCard = await page.evaluate(readCanvas, { selector: '[data-class] canvas' });
  assert.equal(phoneCard.alphaMean, 255, 'the cards draw on a phone');
  assert.ok(phoneCard.levels.length >= 2, `and are a picture (${phoneCard.levels.length} levels)`);
  await shoot(page, 'mobile-cards');

  await page.locator('[data-class]').first().click();
  await page.waitForTimeout(1000);
  const dialog = page.locator('dialog:has([data-viewer-canvas])');
  assert.ok(await dialog.evaluate((el) => el.open), 'a card opens the viewer by touch');
  const fits = await page.evaluate(() => {
    const box = document.querySelector('[data-viewer-canvas]').closest('dialog').getBoundingClientRect();
    return { width: Math.ceil(box.width), inner: window.innerWidth };
  });
  assert.ok(fits.width <= fits.inner, `and the viewer fits the phone (${fits.width} > ${fits.inner})`);
  await shoot(page, 'mobile-dialog');
  clean(errors);
  note(`landing ${width.scrollWidth} ≤ ${width.inner} CSS px; ${crowd} checked with the cards up`);
  await context.close();
});

// ---- 13 · the picture against the arithmetic --------------------------------

// Five classes — square, hexagonal and centred lattices, all four colour counts,
// a coloured film that closes after one period and ones that take two, three and
// six — each paused at three times.  What is compared is the picture the browser
// actually produced against the same sum of plane waves evaluated here in Node:
// no GPU, no shader, no float32, no anti-aliasing.
await section('the pixels the browser draws are the colours the arithmetic says', async () => {
  const ids = ['g1-n2-2', 'g130-n4-2', 'g227-n3-1', 'g268-n6-1', 'g64-n6-1']
    .filter((id) => census.byId.has(id));
  assert.ok(ids.length >= 4, `the sampled classes are in this census (${ids.join(', ')})`);
  const asked = process.env.SHUB_RENDERER === 'cpu' ? '?renderer=cpu' : '';
  const { context, page, errors } = await open(asked, { where: `picture-vs-arithmetic${asked}` });
  const kind = await page.getAttribute('main[data-ready]', 'data-ready');
  let judged = 0;
  let disagreed = 0;
  for (const cid of ids) {
    const cls = census.byId.get(cid);
    const movie = census.films[cls.gid];
    const field = expandClass(census, cls);
    const geom = filmGeometry(movie);
    const width = viewWidth(census, movie);
    const inks = inkBytes(cls.n, 'greys').map((rgb) => rgb[0]);
    const count = Math.min(field.count, MAX_WAVES);   // what the shader can hold
    for (const scrub of [0, 250, 617]) {
      const shot = await page.evaluate(sampleViewer,
        { cid, family: movie.family, gid: cls.gid, scrub, grid: GRID });
      assert.equal(shot.moved, 0, `${cid} holds still while it is read (${shot.moved} samples moved)`);
      assert.equal(shot.scrub, scrub, `${cid} sits at the asked-for slider position`);
      const t = (scrub / 1000) * cls.m;
      if (shot.t !== null) assert.ok(Math.abs(shot.t - t) < 1e-9, `${cid} is at t = ${t} (page says ${shot.t})`);
      if (shot.view !== null) assert.equal(shot.view, 'greys', 'with the greys on show');
      if (shot.width !== null) assert.ok(Math.abs(shot.width - width) < 1e-9,
        `${cid} shows ${width} lattice units across (page says ${shot.width})`);
      if (shot.toLattice) {
        for (const i of [0, 1]) {
          for (const j of [0, 1]) {
            assert.ok(Math.abs(shot.toLattice[i][j] - geom.toLattice[i][j]) < 1e-9,
              `${cid} uses the film's own lattice map`);
          }
        }
      }

      // The lattice point a device pixel of the stage stands for.  The shader
      // reads uv = (col + 0.5, size - row - 0.5) / size and the CPU twin walks
      // the same square, so one formula serves both.
      const colourAtPixel = (col, row) => {
        const cx = ((col + 0.5) / shot.size - 0.5) * width;
        const cy = (0.5 - (row + 0.5) / shot.size) * width;
        const x0 = geom.toLattice[0][0] * cx + geom.toLattice[0][1] * cy;
        const x1 = geom.toLattice[1][0] * cx + geom.toLattice[1][1] * cy;
        let re = 0;
        let im = 0;
        for (let j = 0; j < count; j++) {
          const angle = 2 * Math.PI * (field.px[j] * x0 + field.py[j] * x1 + field.nu[j] * t);
          const c = Math.cos(angle);
          const s = Math.sin(angle);
          re += field.re[j] * c - field.im[j] * s;
          im += field.re[j] * s + field.im[j] * c;
        }
        return sector(re, im, cls.n);
      };
      // Only judge pixels whose whole neighbourhood is one sector: the rest are
      // the anti-aliased boundaries, where two inks are meant to be mixed.
      const pad = Math.max(3, shot.step > 1 ? shot.step : shot.size / 200);
      const ring = [];
      for (let a = 0; a < 8; a++) ring.push([pad * Math.cos((a * Math.PI) / 4), pad * Math.sin((a * Math.PI) / 4)]);
      let interior = 0;
      let bad = 0;
      const worst = [];
      for (const [col, row, observed] of shot.points) {
        const k = colourAtPixel(col, row);
        if (ring.some(([dx, dy]) => colourAtPixel(col + dx, row + dy) !== k)) continue;
        interior += 1;
        if (Math.abs(observed - inks[k]) > 4) {
          bad += 1;
          if (worst.length < 3) worst.push(`(${col},${row}) drew ${observed}, colour ${k} is ${inks[k]}`);
        }
      }
      const points = shot.points.length;
      const floor = shot.step > 1 ? 0.25 : 0.4;     // the CPU twin's blocks are coarse
      assert.ok(interior >= floor * points,
        `${cid} at t=${t}: enough of the picture is clear of a sector boundary (${interior}/${points})`);
      assert.ok(bad <= Math.max(1, Math.round(0.01 * interior)),
        `${cid} at t=${t}: ${bad} of ${interior} interior pixels disagree — ${worst.join('; ')}`);
      judged += interior;
      disagreed += bad;
    }
    note(`${cid}: ${familyOf(cls.gid)}, ${cls.n} colours, ${field.count} waves, m=${cls.m} — agrees`);
  }
  assert.ok(judged > 1000, `enough pixels were judged (${judged})`);
  clean(errors);
  note(`${judged} interior pixels judged against Node, ${disagreed} disagreed (renderer: ${kind})`);
  await context.close();
});

// ---- 14 · the whole run -----------------------------------------------------

await section('not one console error anywhere in the run', () => {
  assert.equal(consoleTrouble.length, 0, `\n  ${consoleTrouble.slice(0, 8).join('\n  ')}`);
});

await browser.close();
console.log(failures ? `${failures} failing` : 'all checks passed');
process.exit(failures ? 1 : 0);
