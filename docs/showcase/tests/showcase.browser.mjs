// The Showcase in a real browser engine: the page, the eighteen sections and
// their counts, the mount budget, the video budget, the kind filter, the
// reader's place in the page, the phone layout — and the one assertion that
// keeps 4 138 links from rotting silently: following a card lands on a page
// that has actually selected the picture the card drew.
//
// Usage: node docs/showcase/tests/showcase.browser.mjs [base-url] [label]
//        BROWSER=webkit runs the same checks in Playwright's WebKit.
//        SHOT_DIR=… writes the screenshots somewhere you can look at them.
//
// The manifest and the previews are fetched from whatever copy of the site is
// being tested, so a live deployment is checked against its own data.
import assert from 'node:assert/strict';

const runtime = '/Users/yaroslavvb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? `${runtime}playwright/index.mjs`);
const engine = process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
const base = (process.argv[2] ?? 'http://localhost:8934/').replace(/\/?$/, '/');
const label = `${process.argv[3] ?? 'local'} (${engine})`;
const shots = process.env.SHOT_DIR ?? '/tmp';
const SHOWCASE = new URL('showcase/', base);
const BATCH = 240;
const MOUNT_CAP = 1000;
const VIDEO_CAP = 48;

const notes = [];
let failures = 0;
async function section(name, body) {
  const started = Date.now();
  try { await body(); notes.push(`  ok   ${name} (${Date.now() - started} ms)`); }
  catch (error) { failures++; notes.push(`  FAIL ${name}: ${error.message}`); if (process.env.VERBOSE) notes.push(String(error.stack)); }
}

// ---- the manifest, read in Node first ---------------------------------------
// Everything below is checked against this, so a stale page and a stale
// manifest cannot agree with each other and pass.
const doc = await (await fetch(new URL('data/showcase.json', SHOWCASE))).json();
assert.equal(doc.schema, 'showcase-v1');
assert.ok(doc.rows.length >= 1000, `at least a thousand pictures (${doc.rows.length})`);
const byFamily = new Map();
for (const row of doc.rows) {
  if (!byFamily.has(row.family)) byFamily.set(row.family, []);
  byFamily.get(row.family).push(row);
}
const ids = new Set(doc.rows.map(row => row.id));
assert.equal(ids.size, doc.rows.length, 'every row id is unique');
const byPreview = new Map();
for (const row of doc.rows) {
  assert.match(row.preview, /^previews\/(ember|colour|mono|viewer)\/[\w.-]+\.mp4$/, `${row.id} preview path`);
  assert.equal(row.poster, row.preview.replace(/\.mp4$/, '.webp'), `${row.id} poster beside its clip`);
  assert.ok(row.href, `${row.id} has a link`);
  // The monochrome explorer frames by its own `homeTiles` and overwrites any
  // `tiles` in the hash, so a mono link that carried one stated a framing the
  // address bar never kept. The other two kinds are honoured and do carry it.
  if (row.kind === 'mono') {
    assert.ok(!/[?&]tiles=/.test(row.href), `${row.id} asks for no tile count`);
  } else if (row.kind !== 'viewer') {
    assert.match(row.href, /[?&]tiles=2(&|$)/, `${row.id} opens at the framing its clip drew`);
  }
  if (!byPreview.has(row.preview)) byPreview.set(row.preview, []);
  byPreview.get(row.preview).push(row);
}
assert.equal(byPreview.size, doc.counts.clips, 'counts.clips is the number of distinct pictures');
// A card is a PLACEMENT of a record, and one monochrome entry is carded under
// as many as twelve families. Adding the cards up published 4 167 records where
// the three catalogs hold 2 973 — counting the very thing `alsoIn` exists to
// stop the reader counting twice, on the page that makes a point of counting
// honestly. The nine viewers are pages, not catalogue rows.
{
  const records = new Set();
  for (const row of doc.rows) {
    if (row.kind === 'viewer') continue;
    records.add(`${row.kind}:${row.id.split('@')[0]}`);
    for (const sibling of row.siblings ?? []) records.add(`${row.kind}:${sibling}`);
  }
  assert.equal(doc.counts.records, records.size,
               `counts.records is the distinct records, not the cards (${records.size})`);
  assert.ok(doc.counts.records < doc.counts.total, 'and there are fewer of them than cards');
}
// One picture, carded under every group that hosts it, says so on every card:
// 4 138 cards over 2 632 pictures is a thing the page has to admit.
for (const [preview, rows] of byPreview) {
  for (const row of rows) {
    const others = rows.filter(other => other.family !== row.family).map(other => other.family);
    assert.deepEqual(new Set(row.alsoIn ?? []), new Set(others),
                     `${row.id} names the other groups carding ${preview}`);
  }
}

const browser = engine === 'webkit'
  ? await playwright.webkit.launch({headless: true})
  : await playwright.chromium.launch({channel: 'chrome', headless: true});

/** The showcase, opened with its console errors collected. */
async function open({width = 1440, height = 1000, hash = '', reducedMotion} = {}) {
  const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: 1,
                                            ...(reducedMotion ? {reducedMotion} : {})});
  const page = await context.newPage();
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  // A detached preview is deliberately aborted — `removeAttribute('src')` then
  // `load()` is what frees the decoder — and the engine reports that abort as a
  // failed request. Everything else that fails to load is a real defect.
  // (WebKit files the abort under a different resource type from Chromium, so
  // the URL and the cancellation, not the type, are what identify it.)
  page.on('requestfailed', request => {
    const aborted = /ERR_ABORTED|cancel/i.test(request.failure()?.errorText ?? '');
    if (!(aborted && /\/previews\/.*\.mp4$/.test(request.url()))) {
      errors.push(`request failed: ${request.url()} (${request.failure()?.errorText})`);
    }
  });
  await page.goto(new URL(hash, SHOWCASE).href, {waitUntil: 'load'});
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, {timeout: 30000});
  return {context, page, errors};
}

const count = (page, selector) => page.locator(selector).count();

// ---- 1 · it loads, with every section and every count ------------------------

await section('the page loads with eighteen sections and the catalogs’ own counts', async () => {
  const {context, page, errors} = await open();
  assert.equal(await count(page, '.showcase-section'), 18, 'the viewers and the seventeen families');
  const order = await page.$$eval('.showcase-section', nodes => nodes.map(node => node.id));
  assert.deepEqual(order, ['viewers', ...doc.families.map(family => family.id)],
                   'the canonical order, viewers first');
  for (const family of doc.families) {
    const text = await page.locator(`#${family.id} .n`).textContent();
    assert.match(text, new RegExp(`^${family.counts.total} loops`),
                 `${family.id} says how many it holds`);
    const grid = page.locator(`.loop-grid[data-family="${family.id}"]`);
    assert.equal(Number(await grid.getAttribute('data-total')), family.counts.total,
                 `${family.id} grid knows its total`);
  }
  assert.equal(await count(page, '#rail a'), 18, 'a rail anchor per section');
  assert.equal(await count(page, '#viewers .loop-card'), doc.counts.viewer, 'the pinned viewers');
  assert.equal(await count(page, '.loop-card'), BATCH + doc.counts.viewer,
               'the first batch plus the viewers is what first paint mounts');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth),
               await page.evaluate(() => document.documentElement.clientWidth),
               'nothing overflows sideways at 1440');
  await page.screenshot({path: `${shots}/showcase-desktop.png`});
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// ---- 2 · the served HTML is the manifest, before a byte of JSON --------------

await section('the served HTML already holds the first batch, with no script', async () => {
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}, javaScriptEnabled: false});
  const page = await context.newPage();
  await page.goto(SHOWCASE.href, {waitUntil: 'load'});
  assert.equal(await count(page, '.showcase-section'), 18, 'the sections are in the markup');
  assert.equal(await count(page, '.loop-card'), BATCH + doc.counts.viewer, 'and so are the first cards');
  assert.equal(await count(page, '.loop-card .art img'), BATCH + doc.counts.viewer,
               'every one of them carries a poster, so nothing is an empty box');
  const first = await page.$$eval('.loop-card', nodes => nodes.slice(0, 8).map(node => node.dataset.id));
  const wanted = [...byFamily.get('viewers'), ...doc.rows.filter(row => row.family !== 'viewers')]
    .slice(0, 8).map(row => row.id);
  assert.deepEqual(first, wanted, 'in the manifest’s own order');
  await context.close();
});

// The grid's hardest promise: no two cards in one section may read the same.
// A section holds many pictures of one wave — several rules reading one
// two-colour film, several colourings of one colour orbit, several saved orbits
// of one parameter set — and they agree about name, group, equation, parameters
// and size. Ten p6 cards once read "Sel'kov sel-a on g247 · Sel'kov · a .1 b .6
// · 36²×96" over ten different pictures, with nothing anywhere on the card to
// tell them apart. Checked in BOTH layouts, because the phone drops the group
// and equation line and that is sometimes the line that differs.
await section('no two cards in one section read the same, on either layout', async () => {
  const keepWhere = new Set(doc.families.filter(family => family.keepWhere).map(f => f.id));
  const detail = row => {
    const head = [row.reading, row.params, row.dims].filter(Boolean).join(' · ');
    return head + (row.siblings?.length ? `${head ? ' · ' : ''}+${row.siblings.length}` : '');
  };
  for (const phone of [false, true]) {
    const seen = new Map();
    for (const row of doc.rows) {
      const where = (!phone || keepWhere.has(row.family) || row.family === 'viewers')
        ? [row.groupId, row.equation].join('|') : '';
      const key = [row.family, row.name, where, detail(row)].join('¦');
      seen.set(key, [...(seen.get(key) ?? []), row.id]);
    }
    const same = [...seen.values()].filter(group => group.length > 1);
    assert.deepEqual(same.slice(0, 3), [],
                     `${phone ? 'phone' : 'desktop'}: ${same.length} labels are shared`);
  }
});

// A two-colour section holds many readings of one wave — same name, same group,
// same equation, same parameters, different picture — so the rule is the only
// thing on the card that tells them apart, and it has to be on BOTH the card
// Python served and the card JavaScript mounted. The two renderers are written
// twice, in two languages, and this is what keeps them one card.
await section('a two-colour card names its reading, served and mounted alike', async () => {
  const {context, page, errors} = await open();
  const rows = new Map(doc.rows.map(row => [row.id, row]));
  const mono = doc.rows.filter(row => row.kind === 'mono');
  assert.ok(mono.every(row => row.reading), 'every two-colour row carries a reading');
  const colour = doc.rows.filter(row => row.kind === 'colour');
  assert.ok(colour.every(row => /^(Gyre|Trefoil)\b/.test(row.reading ?? '')),
            'and every three-colour row names its colouring, which the badge does not');
  // Several readings of one wave really are in one section, agreeing about
  // everything a card shows except the rule.
  const seen = new Map();
  for (const row of mono) {
    const key = [row.family, row.name, row.equation, row.params].join('|');
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  assert.ok(Math.max(...seen.values()) > 1,
            'and a section really does hold several readings of one wave');

  // A served card (in the HTML before a byte of JSON) and a mounted one (drawn
  // by showcase.mjs when the reader asks for the family) must read the same.
  const read = handle => handle.evaluate(node => ({
    id: node.dataset.id,
    detail: node.querySelector('.det')?.textContent ?? '',
    title: node.getAttribute('title') ?? '',
  }));
  const served = await page.$('.loop-card[data-kind="mono"]');
  assert.ok(served, 'the served HTML reaches a two-colour card');
  await page.locator('.show-all[data-family="p6"]').click();
  await page.waitForTimeout(400);
  const mounted = await page.$('#p6 .loop-card[data-kind="mono"]');
  assert.ok(mounted, 'and p6 mounts some');
  for (const [where, handle] of [['served', served], ['mounted', mounted]]) {
    const card = await read(handle);
    const row = rows.get(card.id);
    assert.ok(row, `${where}: ${card.id} is a manifest row`);
    assert.ok(card.detail.startsWith(row.reading),
              `${where}: the detail line leads with the reading ("${card.detail}")`);
    assert.ok(card.detail.includes(row.dims), `${where}: and still carries the size`);
    assert.ok(card.title.includes(row.reading), `${where}: so does the tooltip`);
  }
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// ---- 3 · Load more, and the thousand-card ceiling ----------------------------

await section('Load more adds a batch and never passes a thousand mounted', async () => {
  const {context, page, errors} = await open();
  const before = await count(page, '.loop-card');
  await page.locator('#global-more button').click();
  await page.waitForTimeout(250);
  assert.equal(await count(page, '.loop-card'), before + BATCH, 'exactly one batch more');
  for (let i = 0; i < 8; i++) {
    if (await page.locator('#global-more').isHidden()) break;
    await page.locator('#global-more button').click();
    await page.waitForTimeout(150);
    const mounted = await count(page, '.loop-card');
    // Every card in the document, the nine pinned viewers included: they are
    // cards, they hold posters, and the page's own readout counts them. The
    // ceiling used to be tested without them while the readout printed them, so
    // a full walk ended with "1009 of 4138 mounted" directly above the line
    // promising a thousand.
    assert.ok(mounted <= MOUNT_CAP,
              `at most ${MOUNT_CAP} cards are mounted (saw ${mounted})`);
    const readout = await page.locator('#mounted').textContent();
    assert.equal(readout.match(/^(\d+) of/)?.[1], String(mounted),
                 `and the page says so (${readout})`);
  }
  assert.ok(await count(page, '.loop-card') > BATCH, 'and the page did grow');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth),
               await page.evaluate(() => document.documentElement.clientWidth), 'still no sideways scroll');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// The load button used to restart its walk at the first grid, so it re-asked
// for the cards an eviction had just taken out and ping-ponged between p1 and
// p2 for ever: p31m, p6 and p6m — 523 cards — were unreachable by it.
await section('Load more always advances, and does reach the last family', async () => {
  const {context, page, errors} = await open();
  const left = () => page.evaluate(() =>
    Number(document.getElementById('budget').textContent.match(/^(\d+) more/)?.[1] ?? -1));
  let previous = await left();
  let clicks = 0;
  // A batch a click, plus slack for the clicks the mount cap serves short: the
  // bound has to be read off the manifest, because the broad tier took the card
  // set from 1 738 to 4 138 and a hard 25 would have failed on arithmetic
  // rather than on anything being wrong.
  const most = Math.ceil(doc.rows.length / BATCH) + 10;
  while (!(await page.locator('#global-more').isHidden()) && clicks < most) {
    await page.locator('#global-more button').click();
    await page.waitForTimeout(160);
    clicks += 1;
    const now = await left();
    assert.ok(now < previous, `click ${clicks} advanced (${previous} → ${now} left)`);
    previous = now;
  }
  assert.ok(clicks < most, `the button finishes (${clicks} clicks of at most ${most})`);
  assert.equal(previous, 0, 'and nothing is left to load');
  const held = await count(page, '.loop-card');
  assert.ok(held <= MOUNT_CAP, `and the walk left at most ${MOUNT_CAP} in the document (${held})`);
  // Every family has been reached: it is either in the document or unloaded to
  // save memory, which is a state it can come back from.
  const reached = await page.$$eval('.loop-grid[data-family]', nodes => nodes
    .filter(node => !node.querySelector('.loop-card') && !node.dataset.unloaded)
    .map(node => node.dataset.family));
  assert.deepEqual(reached, [], 'no family was walked past');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

await section('an evicted family says so, and comes back when you scroll to it', async () => {
  const {context, page, errors} = await open();
  const biggest = [...doc.families].sort((a, b) => b.counts.total - a.counts.total).slice(0, 4);
  for (const family of biggest) {
    await page.locator(`.show-all[data-family="${family.id}"]`).click();
    await page.waitForTimeout(350);
  }
  const holes = await page.$$eval('.loop-grid[data-unloaded]', nodes => nodes.map(node => ({
    family: node.dataset.family, height: node.offsetHeight,
    note: node.querySelector('.remount-note')?.textContent ?? '',
  })));
  assert.ok(holes.length > 0, 'the mount cap did evict something');
  for (const hole of holes) {
    assert.ok(hole.height > 100, `${hole.family} keeps its height, so the scrollbar is still`);
    assert.match(hole.note, /unloaded to save memory/,
                 `${hole.family} says what happened instead of being a blank hole`);
  }
  const back = holes[0].family;
  await page.evaluate(id => document.getElementById(id).scrollIntoView({behavior: 'instant'}), back);
  await page.waitForTimeout(900);
  assert.ok(await count(page, `.loop-grid[data-family="${back}"] .loop-card`) > 0,
            `${back} comes back on its own`);
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// A rail jump into an evicted family used to remount it, evict it again and
// remount it once more — the grid was full at 200 ms, empty at 400 and 800, and
// full again at 1 600. A jump mounts from wherever the reader is standing, so
// for a beat the target is the furthest grid on the page; it is now exempt, and
// a grid with any part of it on screen is never the furthest anyway.
await section('a rail jump into an evicted family fills it and keeps it filled', async () => {
  const {context, page, errors} = await open();
  const biggest = [...doc.families].sort((a, b) => b.counts.total - a.counts.total).slice(0, 4);
  for (const family of biggest) {
    await page.locator(`.show-all[data-family="${family.id}"]`).click();
    await page.waitForTimeout(350);
  }
  const gone = await page.$$eval('.loop-grid[data-unloaded]', nodes => nodes.map(n => n.dataset.family));
  assert.ok(gone.length > 0, 'the mount cap did evict something');
  for (const family of gone.slice(0, 3)) {
    await page.locator(`.group-rail a[href="#${family}"]`).click();
    const seen = [];
    for (const wait of [200, 200, 400, 800]) {
      await page.waitForTimeout(wait);
      seen.push(await count(page, `.loop-grid[data-family="${family}"] .loop-card`));
    }
    assert.ok(seen.every(n => n > 0),
              `#${family} never flickers back to empty (${seen.join(' → ')})`);
  }
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

await section('Show all mounts one family in full', async () => {
  const {context, page, errors} = await open();
  const family = doc.families.reduce((a, b) => (a.counts.total > b.counts.total ? a : b)).id;
  await page.locator(`.show-all[data-family="${family}"]`).click();
  await page.waitForTimeout(400);
  const shown = await count(page, `.loop-grid[data-family="${family}"] .loop-card`);
  assert.equal(shown, byFamily.get(family).length, `${family} is all there`);
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// ---- 4 · the video budget ----------------------------------------------------

await section('at most 48 videos exist, all of them playing, and a card off screen holds none',
              async () => {
  const {context, page, errors} = await open();
  const seen = [];
  for (const y of [0, 1500, 4000, 8000, 1500, 0]) {
    await page.evaluate(offset => scrollTo(0, offset), y);
    await page.waitForTimeout(700);
    const state = await page.evaluate(() => {
      const videos = [...document.querySelectorAll('video')];
      return {
        videos: videos.length,
        paused: videos.filter(video => video.paused).length,
        offscreen: videos.filter(video => {
          const box = video.getBoundingClientRect();
          return box.bottom < -900 || box.top > innerHeight + 900;
        }).length,
        sourceless: videos.filter(video => !video.getAttribute('src')).length,
      };
    });
    seen.push(state.videos);
    assert.ok(state.videos <= VIDEO_CAP, `at most ${VIDEO_CAP} videos (saw ${state.videos} at y=${y})`);
    assert.equal(state.sourceless, 0, 'no video is left without a source');
    assert.equal(state.offscreen, 0, `no video far off screen (saw ${state.offscreen} at y=${y})`);
    assert.ok(state.paused <= 2, `every attached video is playing (${state.paused} paused at y=${y})`);
  }
  assert.ok(Math.max(...seen) > 0, 'videos were attached at all');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

await section('prefers-reduced-motion attaches no video, and the switch turns them back on', async () => {
  const {context, page, errors} = await open({reducedMotion: 'reduce'});
  await page.evaluate(() => scrollTo(0, 1200));
  await page.waitForTimeout(700);
  assert.equal(await count(page, 'video'), 0, 'a poster grid, and nothing more');
  await page.locator('#play-previews').check();
  await page.waitForTimeout(700);
  assert.ok(await count(page, 'video') > 0, 'the switch is the way back');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// ---- 5 · the kind filter -----------------------------------------------------

await section('the kind filter shows one kind at a time and says how many', async () => {
  const {context, page, errors} = await open();
  // The first batch reaches only the square families, so mount the triangular
  // ones too: a filter test that cannot see a three-colour card proves nothing.
  for (const family of ['p3', 'p6']) {
    await page.locator(`.show-all[data-family="${family}"]`).click();
    await page.waitForTimeout(250);
  }
  for (const kind of ['ember', 'colour', 'mono', 'viewer']) {
    await page.locator(`.kind-bar button[data-kind="${kind}"]`).click();
    await page.waitForTimeout(250);
    const wrong = await page.$$eval('.loop-card', (nodes, k) =>
      nodes.filter(node => node.offsetParent !== null && node.dataset.kind !== k).length, kind);
    assert.equal(wrong, 0, `only ${kind} cards are visible`);
    assert.ok(await count(page, `.loop-card[data-kind="${kind}"]`) > 0, `and there are some`);
    assert.match(await page.evaluate(() => location.hash), new RegExp(`kind=${kind}`),
                 'the filter is in the link');
  }
  await page.locator('.kind-bar button[data-kind="all"]').click();
  await page.waitForTimeout(200);
  const hidden = await page.$$eval('.loop-card', nodes => nodes.filter(n => n.offsetParent === null).length);
  assert.equal(hidden, 0, 'All brings them all back');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// The filter used to hide and mount nothing, so "Three-colour" — whose 423
// pictures all live in the last five sections, past the 240 the HTML carries —
// drew a page with eleven empty headings and not one picture on it.
await section('choosing a kind mounts that kind, wherever in the page it lives', async () => {
  const {context, page, errors} = await open();
  for (const kind of ['colour', 'mono', 'ember']) {
    await page.locator(`.kind-bar button[data-kind="${kind}"]`).click();
    await page.waitForTimeout(600);
    const have = doc.rows.filter(row => row.kind === kind).length;
    const drawn = await page.$$eval('.loop-card', (nodes, k) =>
      nodes.filter(node => node.offsetParent !== null && node.dataset.kind === k).length, kind);
    assert.ok(drawn >= Math.min(BATCH, have) * 0.9,
              `${kind}: a page of pictures, not an empty one (${drawn} of ${have})`);
    // A visible section with no card in it must at least offer the way to one.
    const stranded = await page.$$eval('.showcase-section', nodes => nodes
      .filter(node => !node.hidden && !node.querySelector('.loop-card')
                      && !node.querySelector('.load-more:not([hidden]) .show-all'))
      .map(node => node.id));
    assert.deepEqual(stranded, [], `${kind}: no dead section`);
    // A section the catalog has none of this kind in is gone, not an empty heading.
    const emptyFamilies = await page.$$eval('.showcase-section:not([hidden])',
                                            nodes => nodes.map(node => node.id));
    for (const id of emptyFamilies) {
      if (id === 'viewers') continue;
      assert.ok((byFamily.get(id) ?? []).some(row => row.kind === kind),
                `${kind}: ${id} is shown only because it holds some`);
    }
  }
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

await section('a filtered section counts and offers what the filter will do', async () => {
  const {context, page, errors} = await open();
  await page.locator('.kind-bar button[data-kind="mono"]').click();
  await page.waitForTimeout(500);
  const family = doc.families.filter(f => f.counts.mono && f.counts.mono < f.counts.total)
    .reduce((a, b) => (a.counts.total > b.counts.total ? a : b));
  const readout = await page.locator(`#${family.id} .n`).textContent();
  assert.equal(readout, `${family.counts.mono} black & white`,
               `${family.id} counts what is on, not what the page holds`);
  const button = page.locator(`.show-all[data-family="${family.id}"]`);
  if (await button.count()) {
    assert.equal(await button.textContent(),
                 `Show all ${family.counts.mono} black & white in ${family.id}`,
                 'and the button promises the same number');
  }
  await page.locator('.kind-bar button[data-kind="all"]').click();
  await page.waitForTimeout(300);
  assert.match(await page.locator(`#${family.id} .n`).textContent(),
               new RegExp(`^${family.counts.total} loops`), 'and All puts the real count back');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// ---- 6 · the reader's place --------------------------------------------------

await section('a deep link mounts its section, and scrolling writes the place back', async () => {
  const {context, page, errors} = await open({hash: '#p6m'});
  await page.waitForTimeout(1200);
  const mounted = await count(page, '.loop-grid[data-family="p6m"] .loop-card');
  assert.equal(mounted, byFamily.get('p6m').length, '#p6m arrives full, never empty');
  const top = await page.evaluate(() => document.getElementById('p6m').getBoundingClientRect().top);
  assert.ok(Math.abs(top) < 200, `and the page is at it (top ${Math.round(top)})`);
  await page.evaluate(() => document.getElementById('p3').scrollIntoView({behavior: 'instant'}));
  await page.waitForTimeout(700);
  assert.match(await page.evaluate(() => location.hash), /^#p3/, 'the hash follows the reader');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

await section('a reload at #p4 returns to p4 with the filter it was left with', async () => {
  const {context, page, errors} = await open({hash: '#p4?kind=mono'});
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => document.body.dataset.kind), 'mono', 'the filter came back');
  const visible = await page.$$eval('#p4 .loop-card', nodes =>
    nodes.filter(node => node.offsetParent !== null).map(node => node.dataset.kind));
  assert.ok(visible.length > 0 && visible.every(kind => kind === 'mono'), 'and it is applied');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// ---- 7 · the links ------------------------------------------------------------
//
// The one assertion that keeps the whole manifest honest. A card is followed
// for real and the page it lands on must have selected that very picture: the
// family and colour explorers both write their live selection back into the
// hash once the field is loaded, so the hash naming the card's id is proof that
// the selection took — not that the link merely resolved.

const missingPages = new Set();
for (const family of doc.families.map(f => f.id)) {
  const response = await fetch(new URL(`monochrome/${family}/`, base)).catch(() => null);
  if (!response || !response.ok) missingPages.add(family);
}

function sample(kind, n) {
  const rows = doc.rows.filter(row => row.kind === kind);
  const step = Math.max(1, Math.floor(rows.length / n));
  return Array.from({length: Math.min(n, rows.length)}, (_, i) => rows[i * step]);
}

for (const kind of ['ember', 'colour', 'mono', 'viewer']) {
  await section(`following five ${kind} cards opens the right picture`, async () => {
    const context = await browser.newContext({viewport: {width: 1280, height: 900}});
    const page = await context.newPage();
    const checked = [];
    for (const row of sample(kind, 5)) {
      if (kind === 'mono' && missingPages.has(row.family)) continue;
      const target = new URL(row.href, SHOWCASE).href;
      const errors = [];
      const onError = error => errors.push(error.message);
      page.on('pageerror', onError);
      const response = await page.goto(target, {waitUntil: 'load'});
      if (response) assert.ok(response.ok(), `${row.id}: ${target} resolves (${response.status()})`);
      if (kind === 'viewer') {
        assert.ok(await page.locator('canvas, svg, main').first().count() > 0,
                  `${row.id}: the viewer page rendered something`);
      } else {
        await page.waitForFunction(
          () => /ready|Ready/.test(document.getElementById('status')?.textContent ?? ''),
          null, {timeout: 25000});
        const hash = decodeURIComponent(await page.evaluate(() => location.hash));
        const wanted = row.id.split('@')[0];
        assert.ok(hash.includes(`pattern=${wanted}`),
                  `${row.id}: the page selected it (hash ${hash.slice(0, 90)})`);
        const caption = await page.locator('#caption').textContent();
        assert.ok(caption.includes(row.name.split(' · ')[0]),
                  `${row.id}: and says so — "${caption.slice(0, 60)}"`);
      }
      page.off('pageerror', onError);
      assert.deepEqual(errors, [], `${row.id}: no page error`);
      checked.push(row.id);
    }
    if (!checked.length) {
      notes.push(`       (skipped: no ${kind} target page is published yet — `
                 + `${[...missingPages].join(' ')} missing)`);
    } else {
      notes.push(`       ${checked.length} followed: ${checked.slice(0, 2).join(', ')}…`);
    }
    await context.close();
  });
}

await section('every preview and poster the first batch names is really there', async () => {
  const shown = [...byFamily.get('viewers'),
                 ...doc.rows.filter(row => row.family !== 'viewers')].slice(0, BATCH + 8);
  const bad = [];
  for (const row of shown) {
    for (const rel of [row.preview, row.poster]) {
      const response = await fetch(new URL(rel, SHOWCASE));
      if (!response.ok) bad.push(`${rel} (${response.status})`);
      else {
        const size = Number(response.headers.get('content-length') ?? 0);
        if (rel.endsWith('.mp4') && size > 200000) bad.push(`${rel} is ${size} bytes`);
        if (rel.endsWith('.webp') && size > 40000) bad.push(`${rel} is ${size} bytes`);
      }
    }
  }
  assert.deepEqual(bad, [], 'every clip and poster of the first batch');
});

// ---- 8 · the phone -----------------------------------------------------------

await section('the phone layout fits, scrolls its rail, and keeps a stricter video budget', async () => {
  const {context, page, errors} = await open({width: 390, height: 844});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth),
               await page.evaluate(() => document.documentElement.clientWidth),
               'nothing overflows sideways at 390');
  const rail = await page.evaluate(() => {
    const node = document.getElementById('rail');
    return {scrollWidth: node.scrollWidth, clientWidth: node.clientWidth,
            overflow: getComputedStyle(node).overflowX};
  });
  assert.equal(rail.overflow, 'auto', 'the rail is a scrolling row');
  assert.ok(rail.scrollWidth > rail.clientWidth, 'and it really does overflow, so it can scroll');
  const columns = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.loop-grid[data-family]')).gridTemplateColumns.split(' ').length);
  assert.ok(columns >= 2, `at least two columns (${columns})`);
  await page.evaluate(() => scrollTo(0, 2000));
  await page.waitForTimeout(800);
  const videos = await count(page, 'video');
  assert.ok(videos <= 12, `a phone gets at most twelve videos (${videos})`);
  await page.screenshot({path: `${shots}/showcase-phone.png`});
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

await browser.close();
console.log(`showcase — ${label}`);
console.log(notes.join('\n'));
if (failures) { console.error(`${failures} section(s) failed`); process.exit(1); }
console.log('all sections passed');
