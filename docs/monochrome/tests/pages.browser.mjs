// The Monochrome category in a real browser engine: the landing, the seventeen
// explorer pages, the five-rung ladder, the pixels the shader actually draws
// against an independent CPU reconstruction of the same rule, the generator
// marks, the phone layout, and the one contract the whole category rests on —
// that inside the strict tier the rule chips change the sentence and not the
// picture.
//
// Usage: node docs/monochrome/tests/pages.browser.mjs [base-url] [label]
//        BROWSER=webkit runs the same checks in Playwright's WebKit, which is
//        where the `gesture*` events and the SVG mark layer behave differently.
//        FAST=1 checks three family pages instead of all seventeen.
//        SHOT_DIR=… writes the 1440 and 390 screenshots.
//
// The catalog and the field bytes are fetched from whatever copy of the site is
// being tested, so a live deployment is checked against its own data.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import {createMonoCatalog, FAMILY_ORDER} from '../mono-atlas.mjs';
import {LATTICES, bicubic, frameAt, ruleVolume} from '../mono-renderer.mjs';
import {plan as planMarks} from '../mono-marks.mjs';
import {normalize, readViewState, writeViewHash} from '../mono-view-state.mjs';

const runtime = '/Users/yaroslavvb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? `${runtime}playwright/index.mjs`);
const {PNG} = (await import(process.env.PNGJS_MODULE ?? `${runtime}pngjs/lib/png.js`)).default;
const engine = process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
const base = (process.argv[2] ?? 'http://localhost:8934/').replace(/\/?$/, '/');
const label = `${process.argv[3] ?? 'local'} (${engine})`;
const shots = process.env.SHOT_DIR ?? null;
const fast = process.env.FAST === '1';
const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');

const notes = [];
let failures = 0;
async function section(name, body) {
  const started = Date.now();
  try { await body(); notes.push(`  ok   ${name} (${Date.now() - started} ms)`); }
  catch (error) { failures++; notes.push(`  FAIL ${name}: ${error.message}`); if (process.env.VERBOSE) notes.push(String(error.stack)); }
}

// ---- the catalog, loaded in Node through the page's own loader ---------------
// The first assertion of the suite: the shipped catalog passes every gate in
// mono-atlas.mjs. If it did not, the pages would refuse to render.
const catalog = createMonoCatalog(
  await (await fetch(new URL('monochrome/data/monochrome-atlas.json', base))).json(),
  {
    groups: (await (await fetch(new URL('scott-gray/wallpaper-groups.json', base))).json()).groups,
    families: (await (await fetch(new URL('scott-gray/wallpaper-groups.json', base))).json()).families,
    baseUrl: new URL('monochrome/', base),
  },
);
assert.ok(catalog.all().length >= 300, `the catalog carries its pictures (${catalog.all().length})`);
for (const family of FAMILY_ORDER) {
  assert.ok(catalog.all(family).length > 0, `every one of the seventeen families is populated (${family})`);
}
const families = fast ? ['p4', 'p6', 'pg'] : FAMILY_ORDER;

const browser = engine === 'webkit'
  ? await playwright.webkit.launch({headless: true})
  : await playwright.chromium.launch({channel: 'chrome', headless: true});

/** A page with its console errors collected. */
async function open(path, {width = 1440, height = 1000, dpr = 1, mobile = false, hash = ''} = {}) {
  const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: dpr, isMobile: mobile && engine === 'chromium', hasTouch: mobile});
  const page = await context.newPage();
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', request => errors.push(`requestfailed: ${request.url()}`));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(new URL(path, base).href + hash, {waitUntil: 'domcontentloaded'});
  return {context, page, errors};
}
const ready = page => page.waitForSelector('canvas[data-ready="true"]', {timeout: 60000});
/** One PNG of the canvas as the compositor shows it. Reading the WebGL canvas
 * back through a 2D context does NOT work: the drawing buffer is not preserved,
 * so `drawImage` hands back a cleared black square. */
const grab = async page => PNG.sync.read(await page.locator('#pattern').screenshot());
const meanDiff = (a, b) => {
  if (a.width !== b.width || a.height !== b.height) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.data.length; i += 4) sum += Math.abs(a.data[i] - b.data[i]);
  return 4 * sum / a.data.length;
};
/** The same comparison, allowing the element to have moved a pixel or two on the
 * page between the two shots.
 *
 * Choosing a rule chip rewrites the paragraph above the viewer, the paragraph
 * changes height by a fraction of a line, and the canvas below it lands on a
 * different device-pixel row — so an element screenshot of an unchanged picture
 * comes back shifted by one row, which on a hard-edged black-and-white pattern
 * scores 8 on the naive difference and 0 here. What is being tested is that the
 * PICTURE did not change, not that the page did not reflow. */
const alignedDiff = (a, b, radius = 2) => {
  if (a.width !== b.width || a.height !== b.height) return Infinity;
  let best = Infinity;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      let sum = 0, count = 0;
      for (let y = radius; y < a.height - radius; y++) {
        for (let x = radius; x < a.width - radius; x++) {
          sum += Math.abs(a.data[4 * (y * a.width + x)]
            - b.data[4 * ((y + dy) * b.width + (x + dx))]);
          count++;
        }
      }
      best = Math.min(best, sum / count);
    }
  }
  return best;
};

// ---- 1 · every page loads, with no console errors ---------------------------

await section('the landing and the family pages load with no console errors', async () => {
  const {context, page, errors} = await open('monochrome/');
  await page.waitForSelector('.family-card');
  assert.equal(await page.locator('.family-card').count(), 17, 'the landing shows one card per wallpaper group');
  assert.equal(await page.locator('.classic').count(), 2, 'and the two named classics');
  const counts = await page.locator('[data-picture-count]').allTextContents();
  assert.ok(counts.every(text => /^\d+ pictures?$/.test(text)), `every card carries its count (${counts.join(' | ')})`);
  // Every card's still is lazy, so it has to be scrolled into view before it is
  // a picture at all — WebKit, unlike Chrome, really does leave one below the
  // fold undecoded, and reading `naturalWidth` straight after load measured the
  // scroll position rather than the thumbnails.
  await page.evaluate(async () => {
    for (const img of document.querySelectorAll('.family-card img')) {
      img.loading = 'eager';
      img.scrollIntoView({block: 'center'});
    }
    await Promise.all([...document.querySelectorAll('.family-card img')]
      .map(img => (img.complete ? null : img.decode().catch(() => null))));
    scrollTo(0, 0);
  });
  await page.waitForFunction(
    () => [...document.querySelectorAll('.family-card img')].every(img => img.naturalWidth > 0),
    null, {timeout: 20000});
  const stills = await page.locator('.family-card img')
    .evaluateAll(list => list.map(img => `${img.naturalWidth}x${img.naturalHeight}`));
  assert.equal(new Set(stills).size, 1, `every still decoded at one size (${stills.join(' ')})`);
  // The seventeen covers must be seventeen different pictures: ∗333 and ∗632
  // once shipped the same hexagon-and-ring tiling side by side in the directory
  // whose whole job is to tell the groups apart.
  const covers = await page.locator('.family-card img').evaluateAll(list => list.map(img => img.src));
  assert.equal(new Set(covers).size, covers.length, 'and no two cards show the same one');
  if (shots) await page.screenshot({path: `${shots}/mono-landing-1440.png`, fullPage: true});
  assert.deepEqual(errors, [], 'the landing logs no errors');
  await context.close();
});

// ---- 1b · the landing's live counts really are live -------------------------
//
// `mono-directory.mjs` downloads the whole 4.4 MB catalog to refresh the
// stamped counts. It once gated on `schema === 'monochrome-atlas-v1'` while the
// file said v2, so it fetched all of it and dropped it on the floor — and
// nothing looked wrong, because the stamp happened to be current. The only way
// to catch that is to assert the module WROTE something.

await section('the landing rewrites its counts from the live catalog', async () => {
  const {context, page, errors} = await open('monochrome/');
  await page.waitForSelector('.family-card');
  await page.waitForFunction(() =>
    document.querySelector('.family-card[data-empty]') !== null, null, {timeout: 20000});
  const titles = await page.locator('[data-readings]').evaluateAll(list => list.map(el => el.title));
  assert.ok(titles.every(title => /\w+ \d+/.test(title)),
    `every card gained its per-equation breakdown (${titles[0]})`);
  const summary = await page.locator('#atlas-summary').textContent();
  assert.match(summary, /equations —/, `the summary is the live one, not the stamp (${summary})`);
  const strict = catalog.all().filter(entry => entry.tier === 'strict').length;
  assert.match(summary, new RegExp(`\\(${strict} where`), `and counts the strict tier (${summary})`);
  assert.deepEqual(errors, [], 'no errors while refreshing the counts');
  await context.close();
});

for (const family of families) {
  await section(`${family} · loads, renders and names what it chose`, async () => {
    const {context, page, errors} = await open(`monochrome/${family}/`);
    await ready(page);
    const status = await page.locator('#status').textContent();
    assert.match(status, / — ready\.$/, `the status line ends in ready (${status})`);
    assert.ok(status.startsWith(await page.locator('#groups .group[aria-pressed="true"]').getAttribute('data-group-id')),
      `and names the film group it chose (${status})`);
    assert.ok(await page.locator('#groups .group').count() >= 1, 'rung 1 lists the hosting film groups');
    assert.ok(await page.locator('#rules .rule').count() === 6, 'rung 2 offers all six rule kinds');
    assert.ok(await page.locator('#rules .rule[aria-pressed="true"]').count() === 1, 'exactly one rule chip is pressed');
    assert.ok(await page.locator('#rule-tiers .tier').count() === 3, 'and the three measured tiers');
    assert.ok(await page.locator('#equations .equation:not([disabled])').count() >= 1, 'rung 3 offers an equation');
    assert.ok(await page.locator('.pattern-thumb').count() >= 1, 'rung 5 offers a picture');
    assert.ok(await page.locator('#two-colour-rows tr').count() >= 2, 'the measured two-colour table has rows');
    assert.ok(await page.locator('#two-colour-rows tr.swap').count() >= 1
      || await page.locator('#rules .rule[data-rule="threshold"][aria-pressed="true"]').count() === 1,
    'and shows the swapping half, unless the control is on screen');
    assert.match(await page.locator('#provenance').textContent(), /field sha256/, 'the numerical record carries its provenance');
    assert.deepEqual(errors, [], `${family} logs no errors`);
    await context.close();
  });
}

// ---- 2 · the pixels, against an independent CPU reconstruction ---------------

await section('the canvas is not blank, and agrees with a CPU render of the same rule', async () => {
  for (const family of ['p4', 'p3']) {
    const {context, page, errors} = await open(`monochrome/${family}/`, {hash: '#?v=1&play=0&phase=0.25&framing=simulation&palette=mono&marks=0'});
    await ready(page);
    await page.waitForTimeout(400);
    const state = await page.evaluate(() => {
      const hash = location.hash;
      const canvas = document.getElementById('pattern');
      const box = canvas.getBoundingClientRect();
      return {hash, width: box.width, height: box.height};
    });
    const id = decodeURIComponent(state.hash.match(/pattern=([^&]*)/)[1]);
    const tiles = Number(state.hash.match(/tiles=(\d+)/)[1]);
    const phase = Number(state.hash.match(/phase=([\d.]+)/)[1]);
    const entry = catalog.get(id);
    assert.ok(entry, `the hash names a catalog entry (${id})`);
    const record = await catalog.load(id);
    const volume = ruleVolume(record.field, {
      N: record.N, M: record.M, channels: 2, channel: 0,
      kind: record.kind, S: record.S, v: record.v,
    });
    const plane = frameAt(volume, 2 * record.N, record.M, phase);
    const png = await grab(page);
    // Non-blank: both inks are present in quantity.
    let white = 0, black = 0;
    for (let i = 0; i < png.data.length; i += 4) { if (png.data[i] > 200) white++; else if (png.data[i] < 55) black++; }
    const total = png.data.length / 4;
    assert.ok(white / total > 0.2 && black / total > 0.2,
      `the canvas shows both inks (white ${(white / total).toFixed(2)}, black ${(black / total).toFixed(2)})`);
    // And it shows exactly two of them: an anti-aliased band, and nothing else.
    let mid = 0;
    for (let i = 0; i < png.data.length; i += 4) { const v = png.data[i]; if (v >= 55 && v <= 200) mid++; }
    assert.ok(mid / total < 0.12, `the picture is two tones with an anti-aliased band (${(mid / total).toFixed(3)} between them)`);
    // The fixed frame is exactly `tiles` lattice lengths across the shorter side,
    // centred on the entry's home centre, unrotated — so every screen pixel has
    // a closed-form lattice coordinate and the CPU twin can be asked for its
    // sign directly.
    const scale = Math.min(state.width, state.height) / tiles;
    const lattice = LATTICES[record.lattice];
    const [cx, cy] = record.view.centre;
    let checked = 0, agreed = 0;
    const grid = 26;
    for (let k = 0; k < grid * grid; k++) {
      const px = (k % grid + 0.5) / grid * state.width, py = (Math.floor(k / grid) + 0.5) / grid * state.height;
      const o = [(px - state.width / 2) / scale, (py - state.height / 2) / scale];
      const q = lattice.fromPlane(o);
      const value = bicubic(plane, 2 * record.N, [cx + q[0], cy + q[1]]);
      const x = Math.min(png.width - 1, Math.round(px * png.width / state.width));
      const y = Math.min(png.height - 1, Math.round(py * png.height / state.height));
      const shown = png.data[4 * (y * png.width + x)];
      // Only samples away from the contour are compared: within about a device
      // pixel of it the shader is deliberately blending the two inks.
      if (Math.abs(value) < 0.02 * (record.metrics.amplitude ?? 1)) continue;
      checked++;
      if ((value > 0) === (shown > 127)) agreed++;
    }
    assert.ok(checked >= 250, `enough samples land away from the contour (${checked} of ${grid * grid})`);
    assert.ok(agreed / checked > 0.985,
      `${family}: the drawn pixels agree with the CPU reconstruction (${agreed}/${checked})`);
    assert.deepEqual(errors, [], 'no errors while rendering');
    await context.close();
  }
});

// ---- 3 · the contract of step 2 ---------------------------------------------

await section('a folded rule chip changes the sentence and not the picture; threshold changes both', async () => {
  const {context, page, errors} = await open('monochrome/p4/', {hash: '#?v=1&play=0&phase=0.25&framing=simulation&tier=strict'});
  await ready(page);
  await page.waitForTimeout(400);
  const before = await grab(page);
  const law = await page.locator('#rule-law').textContent();
  const kinds = await page.locator('#rules .rule:not([disabled])').evaluateAll(list => list.map(b => b.dataset.rule));
  const folded = kinds.filter(kind => !['half-period', 'threshold'].includes(kind));
  assert.ok(folded.length >= 1, `the strict picture offers a spatial reading (${kinds.join(', ')})`);
  for (const kind of folded) {
    await page.locator(`#rules .rule[data-rule="${kind}"]`).click();
    await page.waitForTimeout(350);
    // Not byte equality: a re-composite can differ by a hair of anti-aliasing
    // on the contour, and the paragraph above the viewer changing length moves
    // the canvas a device-pixel row. A mean channel difference under a tenth of
    // a level, once that row is allowed for, is the same picture; a different
    // picture scores fifty either way.
    const moved = alignedDiff(before, await grab(page));
    assert.ok(moved < 0.1, `${kind} draws literally the same picture (mean difference ${moved})`);
    assert.match(await page.evaluate(() => location.hash), new RegExp(`rule=${kind}`), `${kind} is in the link`);
  }
  assert.notEqual(await page.locator('#rule-law').textContent(), law, 'and the sentence under the chips did change');
  await page.locator('#rules .rule[data-rule="threshold"]').click();
  await ready(page);
  await page.waitForTimeout(600);
  assert.ok(alignedDiff(before, await grab(page)) > 5, 'the threshold control is a genuinely different picture');
  assert.deepEqual(errors, [], 'no errors while switching rules');
  await context.close();
});

// ---- 3b · the rule sentence agrees with the entry's own measured laws -------
//
// Two prose defects this page shipped, each on a majority of its tier, and each
// contradicted by the measured table three paragraphs below it:
//
//   * every broad reading was told "waiting half a period does not — the
//     residual is 0.00e+0, not zero" and "this is ... not a spacetime one", on
//     837 readings whose own `laws.halfPeriod` is exact;
//   * every folded strict chip was told the involution holds "at residual 0 ...
//     the same function", on 225 of the 923 readings where it holds only to the
//     search's tolerance and 61 where the drawn inks really do differ.
//
// So the sentence is checked against the record, not merely rendered.

await section('the rule sentence says what the entry measured, on both tiers', async () => {
  const swapsAfterAWait = catalog.all().find(entry =>
    entry.tier === 'broad' && entry.laws?.halfPeriod?.[1] === 1 && entry.spatial);
  const stillOnly = catalog.all().find(entry =>
    entry.tier === 'broad' && entry.laws?.halfPeriod?.[1] !== 1 && entry.spatial);
  const inexact = catalog.all().find(entry =>
    entry.tier === 'strict' && entry.strictReadings.some(reading => !reading.drawnExact));
  assert.ok(swapsAfterAWait && stillOnly && inexact, 'the catalog holds one of each case');

  const visit = async entry => {
    const family = entry.families[0];
    const hash = `#${entry.groupIds[0]}?v=1&play=0&tier=all&rule=${entry.kind}`
      + `&pattern=${encodeURIComponent(entry.id)}`;
    const {context, page, errors} = await open(`monochrome/${family}/`, {hash});
    await ready(page);
    await page.waitForTimeout(250);
    const text = await page.locator('#rule-law').textContent();
    assert.deepEqual(errors, [], `${entry.id} logs no errors`);
    await context.close();
    return text;
  };

  const yes = await visit(swapsAfterAWait);
  assert.doesNotMatch(yes, /not a spacetime one/,
    `a broad reading whose halfPeriod is exact is not called "not a spacetime one": ${yes}`);
  assert.doesNotMatch(yes, /residual is 0\.00e\+0, not zero/, `and is not told 0 is not zero: ${yes}`);
  assert.match(yes, /Waiting half a period exchanges them as well/, yes);

  const no = await visit(stillOnly);
  assert.match(no, /Waiting half a period does not/, no);
  assert.match(no, /not a spacetime one/, no);

  // The folded chips of a strict entry whose readings are not all perfect: the
  // page must print the measurement rather than a literal zero.
  const family = inexact.families[0];
  const worst = inexact.strictReadings.find(reading => !reading.drawnExact);
  const {context, page, errors} = await open(`monochrome/${family}/`, {
    hash: `#${inexact.groupIds[0]}?v=1&play=0&tier=strict&rule=${worst.kind}`
      + `&pattern=${encodeURIComponent(inexact.id)}`,
  });
  await ready(page);
  await page.waitForTimeout(250);
  await page.locator(`#rules .rule[data-rule="${worst.kind}"]`).click();
  await page.waitForTimeout(300);
  const folded = await page.locator('#rule-law').textContent();
  assert.doesNotMatch(folded, /at residual 0 —/, `no hard-coded zero residual: ${folded}`);
  assert.match(folded, /not\s+be?\s*exchanged|are not\s+exchanged|not all perfect/,
    `the panel owns up to the samples that do not exchange: ${folded}`);
  assert.deepEqual(errors, [], 'no errors on the inexact strict entry');
  await context.close();
});

// ---- 4 · the marks are off by default ---------------------------------------

await section('the generator marks are off by default and on with the checkbox', async () => {
  const {context, page, errors} = await open('monochrome/p4/');
  await ready(page);
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#show-marks').isChecked(), false, 'the checkbox is unchecked on a cold load');
  assert.equal(await page.locator('#marks').evaluate(node => getComputedStyle(node).display), 'none', 'the mark layer is not displayed');
  assert.equal(await page.locator('#marks .mono-mark').count(), 0, 'and has no glyphs in it');
  assert.match(await page.evaluate(() => location.hash), /marks=0/, 'the link says so');
  await page.locator('#show-marks').check();
  await page.waitForTimeout(300);
  assert.ok(await page.locator('#marks .mono-mark').count() > 0, 'ticking the box draws the operations');
  assert.equal(await page.locator('#marks').evaluate(node => getComputedStyle(node).display), 'block', 'and shows the layer');
  assert.match(await page.evaluate(() => location.hash), /marks=1/, 'and the link follows');
  // G toggles, and an explicit ?marks=1 overrides a stored 0.
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('g');
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#show-marks').isChecked(), false, 'G toggles the marks off again');
  await page.goto(new URL('monochrome/p4/', base).href + '#?v=1&marks=1', {waitUntil: 'domcontentloaded'});
  await ready(page);
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#show-marks').isChecked(), true, 'an explicit marks=1 overrides the remembered 0');
  assert.deepEqual(errors, [], 'no errors while toggling the marks');
  await context.close();
});

// ---- 5 · the ladder selects, and the link follows ---------------------------

await section('every rung selects and updates the link', async () => {
  const {context, page, errors} = await open('monochrome/p4/');
  await ready(page);
  const hash = () => page.evaluate(() => location.hash);
  const first = await hash();
  // rung 1 · a different film group
  const tiles = await page.locator('#groups .group:not([aria-pressed="true"])').first();
  if (await tiles.count()) {
    const id = await tiles.getAttribute('data-group-id');
    await tiles.click();
    await ready(page);
    assert.ok((await hash()).startsWith(`#${id}?`), `choosing a film group puts it in the link (${id})`);
  }
  // rung 2 · the tier chips
  await page.locator('#rule-tiers .tier[data-tier="strict"]').click();
  await ready(page);
  assert.match(await hash(), /tier=strict/, 'the tier chip is in the link');
  // rung 3 · an equation
  const other = page.locator('#equations .equation:not([disabled]):not([aria-pressed="true"])').first();
  if (await other.count()) {
    const model = await other.getAttribute('data-model');
    await other.click();
    await ready(page);
    assert.match(await hash(), new RegExp(`model=${model}`), `choosing an equation puts it in the link (${model})`);
  }
  // rung 5 · a thumbnail
  const thumb = page.locator('.pattern-thumb:not([aria-pressed="true"])').first();
  if (await thumb.count()) {
    const id = await thumb.getAttribute('data-pattern-id');
    await thumb.click();
    await ready(page);
    assert.ok((await hash()).includes(encodeURIComponent(id)), 'choosing a picture puts it in the link');
    assert.equal(await page.locator('.pattern-thumb[aria-pressed="true"]').count(), 1, 'and exactly one card is pressed');
  }
  assert.notEqual(await hash(), first, 'the link moved');
  // and a captured link restores what it names
  const captured = await hash();
  await page.goto(new URL('monochrome/p4/', base).href + captured, {waitUntil: 'domcontentloaded'});
  await ready(page);
  await page.waitForTimeout(300);
  const restored = readViewState(await hash()), asked = readViewState(captured);
  for (const key of ['groupId', 'model', 'patternId', 'rule', 'tier', 'framing', 'tiles', 'palette']) {
    assert.deepEqual(restored[key], asked[key], `the link restores ${key}`);
  }
  assert.deepEqual(errors, [], 'no errors while walking the ladder');
  await context.close();
});

// ---- 6 · the phone ----------------------------------------------------------

await section('the phone layout has no horizontal scroll and reads in ladder order', async () => {
  for (const family of ['p4', 'p6']) {
    const {context, page, errors} = await open(`monochrome/${family}/`, {width: 390, height: 844, mobile: true});
    await ready(page);
    await page.waitForTimeout(300);
    const [scrollWidth, clientWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    assert.equal(scrollWidth, clientWidth, `${family} does not scroll sideways at 390 (${scrollWidth} vs ${clientWidth})`);
    const wide = await page.evaluate(() => [...document.querySelectorAll('main *')]
      .filter(node => node.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
      .slice(0, 3).map(node => `${node.tagName.toLowerCase()}.${node.className}`.slice(0, 60)));
    assert.deepEqual(wide, [], `nothing overflows the viewport (${wide.join(', ')})`);
    // The ladder must read 1 → 2 → … → the viewer → the evidence.
    const order = await page.evaluate(() => {
      const top = selector => { const node = document.querySelector(selector); return node ? node.getBoundingClientRect().top + scrollY : Infinity; };
      return {groups: top('#groups'), rules: top('#rules'), panel: top('.atlas-panel'), viewer: top('.viewer'), record: top('.numerical-record')};
    });
    assert.ok(order.groups < order.rules, 'rung 1 before rung 2');
    assert.ok(order.rules < order.panel, 'rung 2 before rungs 3–5');
    assert.ok(order.panel < order.viewer, 'the ladder before the picture');
    assert.ok(order.viewer < order.record, 'and the picture before the evidence');
    // The two-colour table is in its stacked-card form.
    const head = await page.locator('.two-colour thead').evaluate(node => getComputedStyle(node).position);
    assert.equal(head, 'absolute', 'the table head is visually hidden and each row is a card');
    if (shots && family === 'p4') await page.screenshot({path: `${shots}/mono-${family}-390.png`, fullPage: true});
    assert.deepEqual(errors, [], `${family} logs no errors at 390`);
    await context.close();
  }
});

// ---- 6b · the endless camera ------------------------------------------------

await section('the endless framing pans, and the link carries the camera', async () => {
  const {context, page, errors} = await open('monochrome/p4/', {hash: '#?v=1&framing=endless&play=0&phase=0.25'});
  await ready(page);
  await page.waitForTimeout(400);
  const before = await grab(page);
  // The canvas sits below the fold on a 1000 px viewport, and a mouse event at a
  // y outside the viewport reaches nothing at all — the first version of this
  // check "dragged" into empty space and then asserted the camera had not moved.
  await page.locator('#pattern').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const box = await page.locator('#pattern').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // Paced, because the viewer measures a release velocity from the timestamps of
  // the moves: eight synthetic moves in the same millisecond are not a drag any
  // real finger could make, and WebKit's synthetic mouse delivers them that way.
  for (let k = 1; k <= 8; k++) {
    await page.mouse.move(box.x + box.width / 2 - 12 * k, box.y + box.height / 2 - 7 * k);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  // The link is written when the GLIDE settles, not when the finger lifts, so
  // the hash is polled for the camera rather than slept at: a fixed wait caught
  // it mid-throw and compared a camera that had not been written yet.
  await page.waitForFunction(() => /[?&]x=0?\.[1-9]/.test(location.hash), null, {timeout: 8000});
  assert.ok(meanDiff(before, await grab(page)) > 1, 'a drag moves the picture');
  const hash = await page.evaluate(() => location.hash);
  assert.match(hash, /framing=endless/, 'the framing is in the link');
  assert.match(hash, /[?&]x=/, 'and so is the camera');
  // The same link, reloaded, puts the camera back.
  await page.goto(new URL('monochrome/p4/', base).href + hash, {waitUntil: 'domcontentloaded'});
  await ready(page);
  await page.waitForTimeout(500);
  const restored = readViewState(await page.evaluate(() => location.hash));
  const asked = readViewState(hash);
  for (const key of ['x', 'y', 'angle']) assert.ok(Math.abs(restored[key] - asked[key]) < 1e-3, `the camera's ${key} is restored (${restored[key]} vs ${asked[key]})`);
  assert.ok(Math.abs(restored.scale - asked.scale) / asked.scale < 1e-3, 'and its scale');
  assert.deepEqual(errors, [], 'no errors while panning');
  await context.close();
});

// ---- 6c · every link on the new pages resolves ------------------------------

await section('every link the new pages carry resolves', async () => {
  const seen = new Map();
  for (const path of ['monochrome/', ...families.map(family => `monochrome/${family}/`)]) {
    const {context, page, errors} = await open(path);
    await page.waitForSelector('main');
    const hrefs = await page.evaluate(() => [...document.querySelectorAll('a[href]')]
      .map(a => a.href).filter(href => href.startsWith(location.origin)));
    for (const href of new Set(hrefs)) {
      if (seen.has(href)) continue;
      const response = await fetch(href, {method: 'GET'});
      seen.set(href, response.status);
    }
    assert.deepEqual(errors, [], `${path} logs no errors`);
    await context.close();
  }
  const broken = [...seen.entries()].filter(([, status]) => status >= 400);
  assert.deepEqual(broken, [], `every link resolves (${broken.map(([href, status]) => `${status} ${href}`).join(', ')})`);
  assert.ok(seen.size > 20, `and there were links to check (${seen.size})`);
});

// ---- 7 · reduced motion, the appearance selector and the channel ------------

await section('reduced motion opens paused; appearance and channel redraw', async () => {
  const context = await browser.newContext({viewport: {width: 1200, height: 900}, reducedMotion: 'reduce'});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  await page.goto(new URL('monochrome/p4/', base).href, {waitUntil: 'domcontentloaded'});
  await ready(page);
  await page.waitForTimeout(400);
  assert.match(await page.locator('#play').textContent(), /Play/, 'a reader who asked for reduced motion gets a still picture');
  const still = await grab(page);
  await page.selectOption('#palette', 'ember');
  await page.waitForTimeout(600);
  assert.ok(meanDiff(still, await grab(page)) > 5, 'Ember shows the wave the rule is reading');
  await page.selectOption('#palette', 'mono');
  await page.waitForTimeout(500);
  assert.ok(meanDiff(still, await grab(page)) < 0.1, 'and going back gives the same two tones');
  const vOption = await page.locator('#channel option[value="v"]').isDisabled();
  if (!vOption) {
    await page.selectOption('#channel', 'v');
    await ready(page);
    await page.waitForTimeout(600);
    assert.match(await page.locator('#channel-note').textContent(), /lag/, 'the V channel prints its measured lag');
    assert.match(await page.evaluate(() => location.hash), /channel=v/, 'and the link carries it');
  }
  assert.deepEqual(errors, [], 'no errors while changing the appearance');
  await context.close();
});

// ---- 8 · the pages are a fresh stamp of the template ------------------------

await section('every page is byte-identical to a fresh stamp of the template', async () => {
  const script = resolve(repo, 'docs/monochrome/tools/make-family-pages.py');
  if (!existsSync(script)) { notes.push('  (the stamping script is not in this tree; skipped)'); return; }
  const out = execFileSync('python3', [script, '--check'], {cwd: repo, encoding: 'utf8'});
  assert.match(out, /pages match a fresh stamp/, out.trim());
});

// ---- 8b · the nav, on every page of the site, not only the new ones ---------
//
// `add-nav.py --check` re-derives the finished header for all 88 pages that
// carry one and names any that differ; `--verify` additionally resolves every
// href in every nav against the tree.  Running the script itself, rather than
// a second copy of its rules, is what keeps the stamped pages and the other 69
// from drifting apart.

await section('the whole site carries the finished nav, and every nav link resolves', async () => {
  const script = resolve(repo, 'docs/monochrome/tools/add-nav.py');
  if (!existsSync(script)) { notes.push('  (the nav script is not in this tree; skipped)'); return; }
  let out;
  try {
    out = execFileSync('python3', [script, 'docs', '--check', '--verify'], {cwd: repo, encoding: 'utf8'});
  } catch (error) {
    // A non-zero exit is the script naming the pages that are stale or whose
    // nav links do not resolve; that list is the useful failure message.
    assert.fail(`add-nav.py --check --verify:\n${(error.stdout ?? '').trim()}`);
  }
  const match = out.match(/^(\d+)\/(\d+) pages carry the finished nav$/m);
  assert.ok(match, out.trim());
  assert.equal(match[1], match[2], out.trim());
  assert.ok(Number(match[2]) >= 88, `at least the 88 pages with a site header (${match[2]})`);
  notes.push(`       ${match[2]} pages, every nav href resolved`);
});

// ---- 9 · the URL state module, on its own -----------------------------------

await section('the link format round-trips and a hand-edited link never throws', async () => {
  const state = {groupId: 'g97', rule: 'half-turn', tier: 'strict', model: 'gray-scott',
    patternId: 'mono:half-turn:470ec64e6ba1:R1800.0', channel: 'v', framing: 'endless',
    tiles: 6, palette: 'ember', speed: 2, marks: true, notation: true, phase: 0.32, play: false,
    x: 0.5, y: 0.25, scale: 380, angle: 30};
  const back = readViewState(writeViewHash(state));
  for (const key of Object.keys(state)) {
    if (['x', 'y', 'scale', 'angle', 'phase'].includes(key)) assert.ok(Math.abs(back[key] - state[key]) < 1e-3, `${key} round-trips`);
    else assert.deepEqual(back[key], state[key], `${key} round-trips`);
  }
  assert.equal(readViewState('#g97?v=9&rule=half-turn').rule, null, 'an unknown version keeps only the film group');
  assert.equal(readViewState('#g97?v=9').groupId, 'g97', '…and keeps that');
  assert.equal(normalize({}).marks, false, 'marks default to off');
  assert.equal(normalize({tiles: 99}).tiles, 2, 'an out-of-range tile count clamps to the default');
  for (const junk of ['', '#', '#nonsense', '#g1?v=1&tiles=NaN&phase=zzz&x=&scale=-4&rule=nope']) {
    assert.doesNotThrow(() => writeViewHash(readViewState(junk)), `a hand-edited link never throws (${junk})`);
  }
});

// ---- 10 · the marks are the measured group ----------------------------------

await section('the marks planned for an entry are its own measured operations', async () => {
  for (const entry of [catalog.all('p4')[0], catalog.all('p3')[0], catalog.all('pg')[0]]) {
    const marks = planMarks(entry);
    assert.ok(marks.length > 0, `${entry.id} has marks to draw`);
    assert.ok(marks.length <= 8, 'and no more than eight of them');
    for (const mark of marks) {
      const row = entry.symmetries.find(item => item.op === mark.op
        && item.v[0] === mark.v[0] && item.v[1] === mark.v[1] && item.frames === mark.frames);
      assert.ok(row, `${entry.id}: the mark ${mark.op} is a measured row of the two-colour group`);
      assert.equal(mark.keep, row.keep, 'and it is drawn with the colour behaviour that was measured');
    }
    assert.ok(new Set(marks.map(mark => mark.op)).size >= Math.min(3, new Set(entry.symmetries.map(row => row.op)).size),
      'the sample reaches several point operations before repeating one');
  }
});

await browser.close();
console.log(`monochrome pages — ${label}`);
for (const note of notes) console.log(note);
console.log(failures ? `${failures} failing` : 'all checks passed');
process.exit(failures ? 1 : 0);
