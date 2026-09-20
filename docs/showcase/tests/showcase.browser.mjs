// The Showcase in a real browser engine: the page, the eighteen sections and
// their counts, the per-section quota, the look-alike fold, the mount budget,
// the video budget, the kind filter, the reader's place in the page, the phone
// layout — and the one assertion that keeps 4 138 links from rotting silently:
// following a card lands on a page that has actually selected the picture the
// card drew.
//
// Two invariants this file exists to hold on to, because both are written twice
// and in two languages:
//
//   A served card and a mounted card of the same row are the SAME markup.
//   `card_html()` in make-manifest.py and `cardElement()` in showcase.mjs draw
//   it, and one section here evicts a family, brings it back and compares the
//   two outerHTMLs attribute for attribute.
//
//   Every count the page prints is the manifest's. The summary spans, the
//   eighteen headings, the rail pills, the grids' data-distinct and the
//   sections' own buttons all say how many pictures are there, how many of them
//   look different and how many are folded behind the rest — and all of them
//   are checked against `data/showcase.json` rather than against each other.
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
// The quota every section opens with, and the step its "Show N more" takes.
// `make-manifest.py --per-section` and `QUOTA` in showcase.mjs are the same 50.
const QUOTA = 50;
const MOUNT_CAP = 1000;
const VIDEO_CAP = 48;
const KIND_LABEL = {ember: 'field', colour: 'three-colour', mono: 'black & white',
                    viewer: 'viewer'};

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
const rowById = new Map(doc.rows.map(row => [row.id, row]));
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

// ---- the fold, as the manifest states it -------------------------------------
// A folded row has to be reachable: its representative must be in the SAME
// section, must carry the same cluster, and must count it. Without this a row
// could be in the manifest, out of the page's default view, and behind no chip
// at all — which would be the one thing the fold is not allowed to do.
{
  const bad = [];
  let folded = 0;
  for (const [family, rows] of byFamily) {
    const here = new Map(rows.map(row => [row.id, row]));
    const behind = new Map();
    for (const row of rows) {
      if (!row.alikeOf) continue;
      folded += 1;
      const rep = here.get(row.alikeOf);
      if (!rep) { bad.push(`${row.id}: its rep is not in ${family}`); continue; }
      if (rep.alikeOf) bad.push(`${row.id}: folded behind a folded card`);
      if (!row.look || row.look !== rep.look) bad.push(`${row.id}: a different cluster from its rep`);
      if (row.kind !== rep.kind) bad.push(`${row.id}: folded across kinds`);
      if (row.equation !== rep.equation) bad.push(`${row.id}: folded across equations`);
      behind.set(rep.id, (behind.get(rep.id) ?? 0) + 1);
    }
    for (const row of rows) {
      const n = behind.get(row.id) ?? 0;
      if ((row.alike ?? 0) !== n) bad.push(`${row.id}: says ${row.alike ?? 0} alike, ${n} are`);
      if (row.alike && !row.look) bad.push(`${row.id}: a rep with no cluster`);
    }
  }
  assert.deepEqual(bad.slice(0, 5), [], `${bad.length} rows break the fold`);
  assert.equal(doc.counts.folded, folded, 'counts.folded is what is folded');
  // The viewers are in `distinct`: nothing is ever folded behind them, and
  // leaving them out made the summary line print three numbers that did not add
  // up — 1 657 + 2 472 against 4 138 cards, nine short.
  assert.equal(doc.counts.distinct, doc.rows.filter(row => !row.alikeOf).length,
               'counts.distinct is what is not');
  assert.equal(doc.counts.distinct + doc.counts.folded, doc.counts.total,
               'and the two are a partition of the cards');
  assert.ok(doc.counts.folded > 0,
            'the page is being tested with a fold in it — build with --look-alikes');
  for (const family of doc.families) {
    assert.equal(family.counts.distinct,
                 byFamily.get(family.id).filter(row => !row.alikeOf).length,
                 `${family.id}.counts.distinct`);
  }
}

// ---- the fold, as the CLIPS state it -----------------------------------------
// The fold's one promise to the eye, checked against the clustering the page
// was built from: no card is hidden behind a card further away than the
// threshold, and no two cards a section SHOWS are within it of each other.
// Single linkage chains, so a cluster can hold two plainly different pictures
// joined by intermediates; `fold_look_alikes` splits a family's members into as
// many chips as it takes, and this is what says it really did.
{
  const look = await (await fetch(new URL('data/look-alikes.json', SHOWCASE))).json();
  assert.equal(look.schema, 'showcase-look-alikes-v1');
  const byClip = new Map();
  for (const cluster of look.clusters) {
    const n = cluster.members.length;
    assert.equal(cluster.dists.length, n * (n - 1) / 2, `${cluster.id} carries its matrix`);
    const at = new Map(cluster.members.map((clip, i) => [clip, i]));
    cluster.at = (a, b) => {
      let [i, j] = [at.get(a), at.get(b)];
      if (i === j) return 0;
      if (i > j) [i, j] = [j, i];
      return cluster.dists[i * n - (i * (i + 1)) / 2 + (j - i - 1)];
    };
    for (const clip of cluster.members) byClip.set(clip, cluster);
  }
  const clipOf = row => row.preview.replace(/\.mp4$/, '');
  const far = [];
  for (const row of doc.rows) {
    if (!row.alikeOf) continue;
    const rep = rowById.get(row.alikeOf);
    const cluster = byClip.get(clipOf(row));
    assert.ok(cluster && cluster === byClip.get(clipOf(rep)),
              `${row.id} and its rep are one cluster`);
    const d = cluster.at(clipOf(row), clipOf(rep));
    if (d > look.threshold + 1e-9) far.push(`${row.id} is ${d.toFixed(3)} from ${rep.id}`);
  }
  assert.deepEqual(far.slice(0, 3), [],
                   `${far.length} folded cards are further than ${look.threshold} from the card shown`);
  const near = [];
  for (const [family, rows] of byFamily) {
    const shown = rows.filter(row => !row.alikeOf && byClip.has(clipOf(row)));
    const groups = new Map();
    for (const row of shown) {
      const id = byClip.get(clipOf(row)).id;
      groups.set(id, [...(groups.get(id) ?? []), row]);
    }
    for (const mine of groups.values()) {
      const cluster = byClip.get(clipOf(mine[0]));
      for (let i = 0; i < mine.length; i++) {
        for (let j = i + 1; j < mine.length; j++) {
          const d = cluster.at(clipOf(mine[i]), clipOf(mine[j]));
          if (d <= look.threshold + 1e-9) {
            near.push(`${family}: ${mine[i].id} and ${mine[j].id} are ${d.toFixed(3)} apart`);
          }
        }
      }
    }
  }
  assert.deepEqual(near.slice(0, 3), [],
                   `${near.length} pairs of shown cards are inside the threshold`);
  // The site's own picks. The design asked for every featured row to stay
  // default-visible; the fold keeps the guarantee that matters instead — a
  // featured row is never folded behind an UNfeatured one, so the card on
  // screen is always the site's own pick of that picture. Showing both would
  // put two cards of one picture side by side, which is the complaint the fold
  // answers, and would break the promise asserted just above.
  const hidden = doc.rows.filter(row => row.featured && row.alikeOf);
  const under = hidden.filter(row => !rowById.get(row.alikeOf)?.featured);
  assert.deepEqual(under.map(row => row.id).slice(0, 3), [],
                   `${under.length} featured rows are folded behind an unfeatured card`);
  notes.push(`       fold: every hidden card within ${look.threshold} of the card shown, `
             + `no two shown cards inside it (${doc.counts.folded} folded, `
             + `${hidden.length} featured behind another featured card)`);
}

const distinctOf = family => (byFamily.get(family) ?? []).filter(row => !row.alikeOf).length;
const servedOf = family => Math.min(QUOTA, distinctOf(family));
const SERVED = doc.counts.viewer
  + doc.families.reduce((n, family) => n + servedOf(family.id), 0);
/** The served ids, section by section: the viewers, then every family's first
 * `QUOTA` representatives in the manifest's own order. */
const servedIds = [
  ...byFamily.get('viewers').map(row => row.id),
  ...doc.families.flatMap(family => byFamily.get(family.id)
    .filter(row => !row.alikeOf).slice(0, QUOTA).map(row => row.id)),
];

/** `heading_text()` in make-manifest.py, and `updateSectionCounts()` in
 * showcase.mjs, said a third time — the point being that all three agree. */
function headingText(family) {
  const counts = family.counts;
  const breakdown = ['ember', 'colour', 'mono'].filter(kind => counts[kind])
    .map(kind => `${counts[kind]} ${KIND_LABEL[kind]}`).join(' · ');
  const head = counts.distinct < counts.total
    ? `${counts.distinct} distinct of ${counts.total} loops` : `${counts.total} loops`;
  return breakdown ? `${head} · ${breakdown}` : head;
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
  // failed request. A poster still in flight when a card is unmounted, or when
  // the reader follows a link off the page, is cancelled the same way. Neither
  // is a defect; everything else that fails to load is.
  // (WebKit files the abort under a different resource type from Chromium, so
  // the URL and the cancellation, not the type, are what identify it.)
  page.on('requestfailed', request => {
    const aborted = /ERR_ABORTED|cancel/i.test(request.failure()?.errorText ?? '');
    if (!(aborted && /\/previews\/.*\.(mp4|webp)$/.test(request.url()))) {
      errors.push(`request failed: ${request.url()} (${request.failure()?.errorText})`);
    }
  });
  await page.goto(new URL(hash, SHOWCASE).href, {waitUntil: 'load'});
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, {timeout: 30000});
  return {context, page, errors};
}

const count = (page, selector) => page.locator(selector).count();
const inFamily = (page, family, extra = '') =>
  count(page, `.loop-grid[data-family="${family}"] .loop-card${extra}`);

// ---- 1 · it loads, with every section and every count ------------------------

await section('the page loads with eighteen sections and the catalogs’ own counts', async () => {
  const {context, page, errors} = await open();
  assert.equal(await count(page, '.showcase-section'), 18, 'the viewers and the seventeen families');
  const order = await page.$$eval('.showcase-section', nodes => nodes.map(node => node.id));
  assert.deepEqual(order, ['viewers', ...doc.families.map(family => family.id)],
                   'the canonical order, viewers first');
  for (const family of doc.families) {
    assert.equal(await page.locator(`#${family.id} .n`).textContent(), headingText(family),
                 `${family.id} says how many it holds and how many of them look different`);
    const grid = page.locator(`.loop-grid[data-family="${family.id}"]`);
    assert.equal(Number(await grid.getAttribute('data-total')), family.counts.total,
                 `${family.id} grid knows its total`);
    assert.equal(Number(await grid.getAttribute('data-distinct')), family.counts.distinct,
                 `${family.id} grid knows how many of them are distinct-looking`);
  }
  assert.equal(await count(page, '#rail a'), 18, 'a rail anchor per section');
  assert.equal(await count(page, '#viewers .loop-card'), doc.counts.viewer, 'the pinned viewers');
  assert.equal(await count(page, '.loop-card'), SERVED,
               `${QUOTA} distinct-looking of every group, plus the viewers, is first paint`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth),
               await page.evaluate(() => document.documentElement.clientWidth),
               'nothing overflows sideways at 1440');
  await page.screenshot({path: `${shots}/showcase-desktop.png`});
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// The complaint this whole feature answers: the reader opened the page and the
// first twelve p1 cards were the same picture twelve times, while p4g, p3 and
// p6 were empty headings under a button. Every section now opens with fifty of
// its own, and no two of those fifty look alike.
await section('every section serves its first 50 distinct-looking cards, and no folded one',
              async () => {
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}, javaScriptEnabled: false});
  const page = await context.newPage();
  await page.goto(SHOWCASE.href, {waitUntil: 'load'});
  for (const family of doc.families) {
    const want = servedOf(family.id);
    assert.equal(await inFamily(page, family.id), want,
                 `${family.id} serves min(${QUOTA}, ${family.counts.distinct})`);
    assert.equal(await inFamily(page, family.id, '[data-alike-of]'), 0,
                 `${family.id} serves no folded card`);
  }
  assert.equal(await count(page, '.loop-card[data-alike-of]'), 0, 'and neither does any other');
  const empty = doc.families.filter(family => family.counts.total === 0);
  assert.deepEqual(empty, [], 'no family is empty in the first place');
  // Every section that still owes the reader cards offers both ways to them.
  for (const family of doc.families) {
    const pending = family.counts.distinct - servedOf(family.id);
    const wrapper = page.locator(`.load-more[data-family="${family.id}"]`);
    // The `hidden` attribute, not visibility: with the script off the <noscript>
    // block takes every one of these bars off the screen, because none of them
    // could be honoured. What is under test here is the markup the script will
    // find when it does run.
    assert.equal(await wrapper.evaluate(node => node.hidden), pending === 0,
                 `${family.id}: the buttons are there exactly when something is`);
    if (pending === 0) continue;
    // …and each of them says what pressing it will do. p2 with 22 left under a
    // button promising 50 is the same lie as "Show all 76" bringing in 42.
    assert.equal(await wrapper.locator('.show-more').textContent(),
                 `Show ${Math.min(QUOTA, pending)} more`,
                 `${family.id}: the step is what is left, when that is under ${QUOTA}`);
    assert.equal(await wrapper.locator('.show-all').textContent(),
                 `Show all ${family.counts.distinct}`);
    // …and where the step and "all" would mount the same cards, only "all" is
    // SERVED. The builder used to stamp both and leave `updateSectionCounts()`
    // to take one away, so seven sections painted two buttons that did the same
    // thing until the script's first pass ran: a flicker, and for as long as it
    // lasted a page contradicting itself. The rule is `showcase.mjs`'s, spelled
    // here in Python's half.
    assert.equal(await wrapper.locator('.show-more').evaluate(node => node.hidden),
                 pending <= QUOTA,
                 `${family.id}: the step is served hidden exactly when "all" repeats it`);
  }
  await context.close();
});

// ---- 2 · the served HTML is the manifest, before a byte of JSON --------------

await section('the served HTML already holds every section, with no script', async () => {
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}, javaScriptEnabled: false});
  const page = await context.newPage();
  await page.goto(SHOWCASE.href, {waitUntil: 'load'});
  assert.equal(await count(page, '.showcase-section'), 18, 'the sections are in the markup');
  assert.equal(await count(page, '.loop-card'), SERVED, 'and so are the cards');
  assert.equal(await count(page, '.loop-card .art img'), SERVED,
               'every one of them carries a poster, so nothing is an empty box');
  const seen = await page.$$eval('.loop-card', nodes => nodes.map(node => node.dataset.id));
  assert.deepEqual(seen, servedIds, 'in the manifest’s own order, section by section');
  // The whole card is one link, and the chip is a button beside it rather than
  // inside it — which is the reason a card is a <div> now.
  assert.equal(await count(page, '.loop-card > a.open'), SERVED, 'one stretched link a card');
  assert.equal(await count(page, 'a .loop-card, a button.alike'), 0, 'and no button inside a link');
  // …and every control that needs the script is taken away rather than left on
  // screen pressing nothing. There used to be 34 load buttons, 357 chips, five
  // filters and a status line reading "Loading the manifest…" for ever.
  const dead = await page.$$eval('.kind-bar, .load-more, .loop-card .alike, #status, #budget',
                                 nodes => nodes.filter(n => n.offsetParent !== null).length);
  assert.equal(dead, 0, `no control the script would have to honour is on screen (${dead})`);
  assert.ok(await page.locator('.noscript-note').isVisible(),
            'and one line says what the page is instead');
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

  const read = handle => handle.evaluate(node => ({
    id: node.dataset.id,
    detail: node.querySelector('.det')?.textContent ?? '',
    title: node.getAttribute('title') ?? '',
  }));
  const served = await page.$('.loop-card[data-kind="mono"]');
  assert.ok(served, 'the served HTML reaches a two-colour card');
  await page.locator('.show-all[data-family="p6"]').click();
  await page.waitForTimeout(500);
  const mounted = await page.$('#p6 .loop-card[data-kind="mono"]');
  assert.ok(mounted, 'and p6 mounts some');
  for (const [where, handle] of [['served', served], ['mounted', mounted]]) {
    const card = await read(handle);
    const row = rowById.get(card.id);
    assert.ok(row, `${where}: ${card.id} is a manifest row`);
    assert.ok(card.detail.startsWith(row.reading),
              `${where}: the detail line leads with the reading ("${card.detail}")`);
    assert.ok(card.detail.includes(row.dims), `${where}: and still carries the size`);
    assert.ok(card.title.includes(row.reading), `${where}: so does the tooltip`);
  }
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// The one assertion that keeps two renderers written in two languages from
// drifting: a card the builder served and the same card the script mounted,
// compared attribute for attribute. The family is evicted by the mount cap and
// then brought back, which is the only path that rebuilds a served card from
// the manifest.
await section('a served card and a mounted card of one row are the same markup', async () => {
  const noJs = await browser.newContext({viewport: {width: 1440, height: 1000}, javaScriptEnabled: false});
  const plain = await noJs.newPage();
  await plain.goto(SHOWCASE.href, {waitUntil: 'load'});
  const served = new Map(await plain.$$eval('.loop-card',
                                            nodes => nodes.map(n => [n.dataset.id, n.outerHTML])));
  await noJs.close();
  assert.equal(served.size, SERVED, 'every served card is in hand');

  const {context, page, errors} = await open();
  const biggest = [...doc.families].sort((a, b) => b.counts.distinct - a.counts.distinct).slice(0, 3);
  for (const family of biggest) {
    await page.locator(`.show-all[data-family="${family.id}"]`).click();
    await page.waitForTimeout(400);
  }
  // Whichever section the cap took out; which one that is depends on where the
  // engine left the scroll, and the point is the round trip, not the section.
  const gone = await page.$$eval('.loop-grid[data-unloaded]', nodes => nodes.map(n => n.dataset.family));
  const back = gone.find(family => servedOf(family) >= 4);
  assert.ok(back, `the mount cap evicted a section with cards to compare (${gone.join(' ') || 'none'})`);
  // Dispatched, not pointed at: the spacer can come to rest under the sticky
  // site header, and the round trip is what is under test here, not hit testing.
  await page.locator(`.loop-grid[data-family="${back}"] .remount-note`)
    .evaluate(node => node.click());
  await page.waitForTimeout(900);
  const mounted = new Map(await page.$$eval(`#${back} .loop-card`,
                                            nodes => nodes.map(n => [n.dataset.id, n.outerHTML])));
  // `data-index` is written on to a served card at start-up and by the element
  // builder on a mounted one, `data-observed` by the video budget on both, and
  // a <video> is whatever the budget is doing this frame. None of the three is
  // markup either renderer decides.
  const tidy = html => html
    .replace(/\s+data-index="\d+"/g, '')
    .replace(/\s+data-observed="1"/g, '')
    .replace(/<video\b[^>]*>\s*<\/video>/g, '')
    .replace(/\s+/g, ' ').trim();
  let compared = 0;
  for (const [id, html] of mounted) {
    const was = served.get(id);
    if (!was) continue;                      // mounted past the served quota
    assert.equal(tidy(html), tidy(was), `${id}: mounted markup is the served markup`);
    compared += 1;
  }
  assert.ok(compared >= 4, `${compared} cards compared (of ${mounted.size} in ${back})`);
  notes.push(`       ${compared} served/mounted cards compared byte for byte`);
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// ---- 3 · the per-section quota -----------------------------------------------

await section('Show 50 more adds at most fifty, to that section and no other', async () => {
  const {context, page, errors} = await open();
  const before = await page.$$eval('.loop-grid[data-family]', nodes =>
    Object.fromEntries(nodes.map(n => [n.dataset.family, n.querySelectorAll('.loop-card').length])));
  await page.locator('.show-more[data-family="p6"]').click();
  await page.waitForTimeout(500);
  const after = await page.$$eval('.loop-grid[data-family]', nodes =>
    Object.fromEntries(nodes.map(n => [n.dataset.family, n.querySelectorAll('.loop-card').length])));
  const wanted = Math.min(QUOTA, distinctOf('p6') - QUOTA);
  assert.equal(after.p6 - before.p6, wanted, `p6 grew by ${wanted}`);
  assert.equal(await inFamily(page, 'p6', '[data-alike-of]'), 0, 'and none of them is folded');
  const grew = Object.keys(after).filter(id => id !== 'p6' && after[id] > before[id]);
  assert.deepEqual(grew, [], 'no other section moved');
  assert.match(await page.evaluate(() => location.hash), /more=p6:100/, 'the quota is in the link');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

await section('Show all mounts every representative of one section', async () => {
  const {context, page, errors} = await open();
  const family = doc.families.reduce((a, b) => (a.counts.distinct > b.counts.distinct ? a : b)).id;
  await page.locator(`.show-all[data-family="${family}"]`).click();
  await page.waitForTimeout(900);
  assert.equal(await inFamily(page, family), distinctOf(family), `${family} is all there`);
  assert.equal(await inFamily(page, family, '[data-alike-of]'), 0, 'and still nothing folded');
  assert.match(await page.evaluate(() => location.hash), new RegExp(`more=${family}:all`),
               'and "all" is what the link says');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// ---- 4 · the look-alike chip -------------------------------------------------

/** A served card with at least two clips folded behind it, in a section the
 * QUOTA is holding something back from.
 *
 * It used to be "the first one anywhere", which is always p1 — and p1 has
 * eleven representatives against a quota of fifty, so its whole section is
 * mounted before the click and there is no card left for a chip that mounts one
 * too many to pull in. A deliberate regression that added one extra
 * REPRESENTATIVE whenever a chip was open passed the whole suite. Inside a
 * quota-limited section it cannot. */
function aChip() {
  const ordered = [...doc.families].sort(
    (a, b) => (b.counts.distinct > QUOTA) - (a.counts.distinct > QUOTA));
  for (const family of ordered) {
    const reps = byFamily.get(family.id).filter(row => !row.alikeOf).slice(0, QUOTA);
    const rep = reps.find(row => (row.alike ?? 0) >= 2);
    if (rep) return {family: family.id, rep, limited: family.counts.distinct > QUOTA};
  }
  return null;
}

/** The ids the chip on `rep` should mount, in order: this family's rows folded
 * behind that very card, as the manifest lists them. */
function behind(family, rep) {
  return byFamily.get(family).filter(row => row.alikeOf === rep.id).map(row => row.id);
}

await section('the chip opens its look-alikes right behind the card, and folds them back',
              async () => {
  const pick = aChip();
  assert.ok(pick, 'some served card has look-alikes behind it');
  const {family, rep, limited} = pick;
  assert.ok(limited, `${family} is a section the quota is holding cards back from`);
  const {context, page, errors} = await open({hash: `#${family}`});
  await page.waitForTimeout(600);
  const chip = page.locator(`#${family} .loop-card[data-id="${CSS_escape(rep.id)}"] .alike`);
  assert.equal(await chip.textContent(), `+${rep.alike} alike`, 'the chip counts them');
  assert.equal(await chip.getAttribute('aria-expanded'), 'false', 'and starts closed');
  const before = await inFamily(page, family);
  await chip.click();
  await page.waitForTimeout(400);
  assert.equal(await inFamily(page, family), before + rep.alike, `${rep.alike} cards arrived`);
  assert.equal(await chip.getAttribute('aria-expanded'), 'true');
  assert.equal(await chip.textContent(), `fold ${rep.alike}`, 'and the chip is the way back');

  // They are directly behind their card, in that order, and each is a card of
  // its own: its own row, its own parameters and its own link.
  const run = await page.$$eval(`#${family} .loop-card`, (nodes, id) => {
    const at = nodes.findIndex(node => node.dataset.id === id);
    return nodes.slice(at, at + 40).map(node => ({
      id: node.dataset.id, of: node.dataset.alikeOf ?? '',
      href: node.querySelector('a.open')?.getAttribute('href') ?? '',
      word: node.querySelector('.alike-word')?.textContent ?? '',
      dashed: getComputedStyle(node).borderStyle,
    }));
  }, rep.id);
  const folded = run.slice(1, 1 + rep.alike);
  assert.equal(folded.length, rep.alike, 'the run is as long as the chip promised');
  // The exact rows, not just the right number of them: a chip that pulled in a
  // neighbouring representative as well would still count right.
  assert.deepEqual(folded.map(card => card.id), behind(family, rep),
                   'and they are this cluster’s own rows in this family, in order');
  assert.equal(await inFamily(page, family, ':not([data-alike-of])'),
               Math.min(QUOTA, distinctOf(family)),
               'and the section still shows exactly its quota of representatives');
  for (const card of folded) {
    assert.equal(card.of, rep.id, `${card.id} is folded behind ${rep.id}`);
    assert.equal(rowById.get(card.id)?.family, family, 'and belongs to this section');
    assert.equal(card.word, 'alike', 'and says so in its own words');
    assert.equal(card.dashed, 'dashed', 'and is drawn quieter than the card before it');
  }
  const hrefs = new Set([run[0].href, ...folded.map(card => card.href)]);
  assert.equal(hrefs.size, folded.length + 1, 'every one of them opens its own picture');
  if (run.length > 1 + rep.alike) {
    assert.equal(run[1 + rep.alike].of, '', 'and the run ends where the next card begins');
  }

  await chip.click();
  await page.waitForTimeout(400);
  assert.equal(await inFamily(page, family), before, 'folding puts the section back');
  assert.equal(await chip.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

await section('Fold look-alikes, unticked, shows them all — and reticked, hides them again',
              async () => {
  const {context, page, errors} = await open();
  assert.equal(await count(page, '.loop-card[data-alike-of]'), 0, 'nothing folded is on screen');
  assert.ok(await page.locator('#fold-alike').isChecked(), 'the box starts ticked');
  await page.locator('#fold-alike').uncheck();
  await page.waitForTimeout(900);
  assert.ok(await count(page, '.loop-card[data-alike-of]') > 0, 'the look-alikes are on the page');
  assert.equal(await page.evaluate(() => document.body.dataset.unfold), '1', 'the page says so');
  assert.match(await page.evaluate(() => location.hash), /unfold=1/, 'and so does the link');
  // With the fold off there are no representatives to count, so the quota
  // counts CARDS. Counting representatives there gave p2 fifty of them and 193
  // cards, and one click on this box spent the whole thousand-card budget on
  // the top of the page: seven sections stood empty under "unloaded to save
  // memory", which is a reader who asked for MORE and got eight groups of
  // nothing.
  const held = await page.$$eval('.loop-grid[data-family]', nodes => nodes.map(node => ({
    family: node.dataset.family,
    cards: node.querySelectorAll(':scope > .loop-card').length,
    unloaded: Boolean(node.dataset.unloaded),
  })));
  for (const {family, cards, unloaded} of held) {
    const all = (byFamily.get(family) ?? []).length;
    assert.equal(cards, Math.min(QUOTA, all),
                 `${family} holds its quota of cards, not of representatives`);
    assert.ok(!unloaded, `${family} is not blanked by the budget when the fold comes off`);
  }
  // …and the button beside them names the number the press will really leave in
  // the grid. It used to read "Show all 72" and bring in 253.
  const big = held.map(one => one.family)
    .sort((a, b) => byFamily.get(b).length - byFamily.get(a).length)[0];
  const all = page.locator(`.show-all[data-family="${big}"]`);
  const promised = Number((await all.textContent()).match(/\d+/)[0]);
  assert.equal(promised, byFamily.get(big).length, `${big}'s button counts every card`);
  await all.click();
  await page.waitForTimeout(900);
  assert.equal(await inFamily(page, big), promised,
               `and pressing it leaves exactly ${promised} cards`);
  await page.locator('#fold-alike').check();
  await page.waitForTimeout(900);
  assert.equal(await count(page, '.loop-card[data-alike-of]'), 0, 'and they all leave again');
  assert.ok(!/unfold=1/.test(await page.evaluate(() => location.hash)), 'the link forgets it');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// With the fold off the chip is hidden — a control that does nothing is worse
// than no control — and the stylesheet's own comment says the count it carried
// is still in the tooltip. It was not: `cardTitle()` and `card_title()` built
// the title out of name, reading, equation, group, size, parameters, siblings
// and alsoIn and never mentioned `alike`, so in the unfolded state a run of
// dashed cards had nothing anywhere saying how many belonged together.
await section('a card with look-alikes behind it says how many in its own tooltip', async () => {
  const {context, page, errors} = await open();
  const read = () => page.$$eval('.loop-card[data-alike]', nodes => nodes.map(node => ({
    id: node.dataset.id, alike: Number(node.dataset.alike),
    title: node.getAttribute('title') ?? '',
    chip: getComputedStyle(node.querySelector('.alike')).display,
  })));
  const served = await read();
  assert.ok(served.length > 20, `the served page has chipped cards (${served.length})`);
  for (const card of served.slice(0, 40)) {
    const want = `${card.alike} more card${card.alike === 1 ? '' : 's'} in this group `
      + `look${card.alike === 1 ? 's' : ''} like this one`;
    assert.ok(card.title.endsWith(want), `${card.id}: its title ends "${want}"`);
  }
  // …and it is still there once the chip is not, which is the state the comment
  // is about.
  await page.locator('#fold-alike').uncheck();
  await page.waitForTimeout(900);
  const off = await read();
  assert.ok(off.length > 0, 'there are still chipped cards mounted');
  assert.ok(off.every(card => card.chip === 'none'), 'and their chips are gone');
  assert.ok(off.every(card => / like this one$/.test(card.title)),
            'while every one of them still says how many look like it');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// A chip is a control that says what it will do, and it has to keep saying it
// after the page rebuilds the card under it. Every path that rebuilds a card —
// the kind filter there and back, an eviction and a remount — goes through
// `cardElement()`, which always writes a CLOSED chip: an opened run therefore
// came back saying "+10 alike" over ten look-alikes that were already on
// screen, and the next click folded them instead of opening them. Three clicks
// to reach, in both engines, and the suite walked past it.
await section('an opened chip still says so after the kind filter rebuilds its card',
              async () => {
  const pick = aChip();
  const {family, rep} = pick;
  const {context, page, errors} = await open({hash: `#${family}`});
  await page.waitForTimeout(600);
  const chip = page.locator(`#${family} .loop-card[data-id="${CSS_escape(rep.id)}"] .alike`);
  await chip.click();
  await page.waitForTimeout(400);
  const opened = await inFamily(page, family, '[data-alike-of]');
  assert.ok(opened >= rep.alike, 'the run is open');
  // Out of this kind and back into it, which destroys and rebuilds every card.
  const other = rep.kind === 'ember' ? 'mono' : 'ember';
  await page.locator(`.kind-bar button[data-kind="${other}"]`).click();
  await page.waitForTimeout(600);
  await page.locator('.kind-bar button[data-kind="all"]').click();
  await page.waitForTimeout(800);
  const again = page.locator(`#${family} .loop-card[data-id="${CSS_escape(rep.id)}"] .alike`);
  assert.equal(await inFamily(page, family, '[data-alike-of]'), opened,
               'the look-alikes are still on screen');
  assert.equal(await again.getAttribute('aria-expanded'), 'true',
               'and the chip still says the run is open');
  assert.equal(await again.textContent(), `fold ${rep.alike}`, 'in its label as well');
  // …so one press folds them, which is what the label promises.
  await again.click();
  await page.waitForTimeout(400);
  assert.equal(await inFamily(page, family, '[data-alike-of]'), 0, 'and pressing it folds them');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// The other path that rebuilds a card, and the one the defect was first found
// on: the mount cap takes the whole family out of the document and scrolling
// back brings it in again through `fill()`. `cardElement()` writes a closed chip
// whatever the state, so the run came back on screen under a chip that offered
// to add it — and the next press took it away.
await section('an opened chip still says so after the mount cap evicts and remounts it',
              async () => {
  const {family, rep} = aChip();
  const {context, page, errors} = await open({hash: `#${family}`});
  await page.waitForTimeout(600);
  const chip = () => page.locator(`#${family} .loop-card[data-id="${CSS_escape(rep.id)}"] .alike`);
  await chip().click();
  await page.waitForTimeout(400);
  assert.equal(await chip().textContent(), `fold ${rep.alike}`, 'the run is open');
  // A jump target is exempt from eviction for three seconds, which is exactly
  // the exemption this section has to wait out before it can evict the family.
  await page.waitForTimeout(3200);
  // From the bottom of the page, the section this chip is in is the furthest
  // grid from the viewport — so filling one of the big ones is what pushes it
  // out. Pressure is applied until it goes.
  await page.evaluate(() => document.getElementById('p6m').scrollIntoView({behavior: 'instant'}));
  await page.waitForTimeout(500);
  let gone = [];
  for (const big of ['p6', 'p3', 'p4', 'p4g', 'pmg']) {
    if (big === family) continue;
    await page.locator(`.show-all[data-family="${big}"]`).click();
    await page.waitForTimeout(600);
    gone = await page.$$eval('.loop-grid[data-unloaded]', ns => ns.map(n => n.dataset.family));
    if (gone.includes(family)) break;
  }
  assert.ok(gone.includes(family),
            `the cap evicted ${family} (it took out ${gone.join(' ') || 'nothing'})`);
  assert.equal(await inFamily(page, family), 0, 'and its cards really are out of the document');
  await page.evaluate(id => document.getElementById(id).scrollIntoView({behavior: 'instant'}), family);
  await page.waitForTimeout(1400);
  const seen = await page.$$eval(`#${family} .loop-card[data-alike-of]`,
                                 nodes => nodes.map(node => node.dataset.id));
  assert.deepEqual(seen, behind(family, rep), 'the same run came back with the section');
  assert.equal(await chip().getAttribute('aria-expanded'), 'true',
               'and the remounted chip says the run is open');
  assert.equal(await chip().textContent(), `fold ${rep.alike}`, 'in its label as well');
  await chip().click();
  await page.waitForTimeout(400);
  assert.equal(await inFamily(page, family, '[data-alike-of]'), 0,
               'so one press folds them, which is what it promised');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// The fold's plainest claim — "they mount directly after their representative"
// — and the one way the page could break it: the mount cap cutting a section in
// half. `fill()` used to walk `want` in MANIFEST order, and 821 of the folded
// rows sit BEFORE their representative there, so a cut mounted the member and
// dropped the card it belongs behind; `insertRows()` then put that orphan where
// the display order says, which is immediately after a card it has nothing to
// do with. Five dashed cards reading ALIKE under strangers, in both engines,
// and the suite walked past it because it only ever checked fully mounted
// sections. The state that finds it: every chip open AND every section asked
// for all of itself, which is far more than the budget can hold.
await section('a folded card is never mounted without the card it is folded behind',
              async () => {
  const {context, page, errors} = await open();
  await page.evaluate(() => {
    for (const chip of document.querySelectorAll('.loop-card > .alike')) chip.click();
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    for (const button of document.querySelectorAll('.load-more .show-all')) button.click();
  });
  await page.waitForTimeout(1500);
  /** Every mounted folded card whose representative is not in the same grid,
   * and every one that is not drawn in its own run. */
  const scan = () => page.$$eval('.loop-grid[data-family]', nodes => {
    const bad = [];
    for (const grid of nodes) {
      const cards = [...grid.querySelectorAll(':scope > .loop-card')];
      const here = new Set(cards.map(card => card.dataset.id));
      cards.forEach((card, at) => {
        const of = card.dataset.alikeOf;
        if (!of) return;
        if (!here.has(of)) { bad.push(`${grid.dataset.family}: ${card.dataset.id} behind nothing`); return; }
        const before = cards[at - 1];
        if (before?.dataset.id !== of && before?.dataset.alikeOf !== of) {
          bad.push(`${grid.dataset.family}: ${card.dataset.id} is not in its own run`);
        }
      });
    }
    return bad;
  });
  const cut = await page.$$eval('.loop-grid[data-unloaded]', nodes => nodes.length);
  assert.ok(cut > 0, 'the budget really did have to cut sections short (nothing to test if not)');
  assert.deepEqual((await scan()).slice(0, 3), [],
                   `${(await scan()).length} folded cards are mounted away from their card`);
  // …and again from the bottom of the page, where the eviction has moved on and
  // the grids have been filled a second time. WebKit found the orphans here.
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1600);
  assert.deepEqual((await scan()).slice(0, 3), [],
                   'and none after a scroll to the bottom refills them');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// "Show all N" is a promise about the screen, so it counts the cards the press
// will leave there — including the look-alikes riding along behind a chip the
// reader has already opened. It counted representatives alone, so p2 with one
// chip open read "Show all 80" and left 89.
await section('“Show all” counts the run an open chip has already brought in', async () => {
  const {family, rep} = aChip();
  const {context, page, errors} = await open({hash: `#${family}`});
  await page.waitForTimeout(600);
  const all = page.locator(`.show-all[data-family="${family}"]`);
  assert.equal(await all.textContent(), `Show all ${distinctOf(family)}`, 'closed, it is the reps');
  await page.locator(`#${family} .loop-card[data-id="${CSS_escape(rep.id)}"] .alike`).click();
  await page.waitForTimeout(500);
  const promised = Number((await all.textContent()).match(/\d+/)[0]);
  assert.equal(promised, distinctOf(family) + rep.alike,
               'open, it is the reps plus the run the chip brought in');
  await all.click();
  await page.waitForTimeout(1400);
  const unloaded = Number(await page.getAttribute(
    `.loop-grid[data-family="${family}"]`, 'data-unloaded') ?? 0);
  assert.equal(await inFamily(page, family) + unloaded, promised,
               `and the press asks for exactly ${promised} cards`);
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// Every "Show all" empties its own bar, and a bar that hides itself under the
// reader's finger takes the focus to <body> with it: in WebKit the next Tab
// restarted at the skip link of a 47 000 px page. The focus goes to the FIRST
// card the press brought in — the card that took the bar's own place on the
// screen — so the reader carries on from where the button was rather than from
// the far end of a section that may now be forty screens long.
await section('“Show all” by keyboard leaves the focus on the first card it brought in',
              async () => {
  const {context, page, errors} = await open();
  const short = doc.families.filter(family => family.counts.distinct > QUOTA)
    .sort((a, b) => a.counts.distinct - b.counts.distinct)[0].id;
  // The (QUOTA+1)-th representative of that section: the first row the press
  // adds, since the served page holds the first QUOTA of them.
  const first = byFamily.get(short).filter(row => !row.alikeOf)[QUOTA];
  await page.locator(`.load-more[data-family="${short}"] .show-all`).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  const where = await page.evaluate(() => {
    const node = document.activeElement;
    const card = node?.closest?.('.loop-card');
    return {tag: node?.tagName ?? '', cls: node?.className ?? '',
            section: node?.closest?.('.showcase-section')?.id ?? '',
            card: card?.dataset.id ?? '', body: node === document.body};
  });
  assert.ok(await page.locator(`.load-more[data-family="${short}"]`).isHidden(),
            'the bar did empty itself');
  assert.ok(!where.body, `the focus is not on <body> (it is on ${where.tag})`);
  assert.equal(where.section, short, 'it is still inside the section that just filled');
  assert.equal(`${where.tag}.${where.cls}`, 'A.open', 'and it is a card’s own link');
  assert.equal(where.card, first.id, 'the first card the press mounted');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// Two buttons that mount the same cards are one button and a decision made for
// nothing: under fifty left, "Show 50 more" and "Show all N" do the same thing,
// so only the one that says the real number is drawn — in the served markup as
// well as after the script's first pass, which is asserted with the script off
// in section 1.
await section('under fifty pending, the section offers “Show all N” alone', async () => {
  const {context, page, errors} = await open();
  const small = doc.families.find(family => {
    const pending = family.counts.distinct - servedOf(family.id);
    return pending > 0 && pending <= QUOTA;
  });
  assert.ok(small, 'some section is holding fewer than fifty cards back');
  const bar = page.locator(`.load-more[data-family="${small.id}"]`);
  assert.ok(await bar.isVisible(), `${small.id} still offers its rest`);
  assert.ok(await bar.locator('.show-more').isHidden(),
            `${small.id} has ${small.counts.distinct - servedOf(small.id)} left: no "more" button`);
  assert.equal(await bar.locator('.show-all').textContent(), `Show all ${small.counts.distinct}`);
  // …while a section with more than fifty to come keeps both, and the step is
  // the step.
  const big = doc.families.find(f => f.counts.distinct - servedOf(f.id) > QUOTA);
  const bigBar = page.locator(`.load-more[data-family="${big.id}"]`);
  assert.ok(await bigBar.locator('.show-more').isVisible(), `${big.id} keeps both buttons`);
  assert.equal(await bigBar.locator('.show-more').textContent(), `Show ${QUOTA} more`);
  // One press of the step, and what is left is under fifty: the button that
  // would repeat "Show all" takes itself away, and the focus with it.
  // Counted from the presses, not from the DOM: the mount cap is allowed to
  // hold cards back, and what is under test is the quota the presses raised.
  const presses = Math.min(Math.ceil((big.counts.distinct - servedOf(big.id)) / QUOTA) - 1, 6);
  for (let i = 0; i < presses; i++) {
    await bigBar.locator('.show-more').click();
    await page.waitForTimeout(400);
  }
  const left = big.counts.distinct - QUOTA * (1 + presses);
  assert.ok(left > 0 && left <= QUOTA, `${big.id} is down to ${left}, which is the case to test`);
  assert.ok(await bigBar.locator('.show-more').isHidden(),
            `${big.id} has ${left} left and drops the step`);
  assert.equal(await bigBar.locator('.show-all').textContent(),
               `Show all ${big.counts.distinct}`);
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// ---- 5 · the reader's place, carried by the hash ------------------------------

await section('a hash carrying a kind, two quotas and the fold round-trips', async () => {
  const hash = '#p4g?kind=mono&more=p4g:100,p6:all&unfold=1';
  const {context, page, errors} = await open({hash});
  await page.waitForTimeout(1400);
  assert.equal(await page.evaluate(() => document.body.dataset.kind), 'mono', 'the kind came back');
  assert.equal(await page.evaluate(() => document.body.dataset.unfold), '1', 'so did the fold');
  assert.equal(await page.locator('#fold-alike').isChecked(), false, 'and the box agrees');
  // The page writes the state back out of `state.quota`, so an unchanged hash
  // is proof that both quotas were read, kept and understood.
  assert.equal(await page.evaluate(() => location.hash), hash, 'and the link is unchanged');
  // The quota counts what the fold state makes a card: with `unfold=1` on, that
  // is every row and not one per cluster, so a raised quota of 100 is 100 cards.
  const mono = byFamily.get('p4g').filter(row => row.kind === 'mono').length;
  assert.equal(await inFamily(page, 'p4g'), Math.min(100, mono),
               'p4g is mounted to its raised quota');
  assert.ok(await inFamily(page, 'p4g', '[data-alike-of]') > 0,
            'with the look-alikes among them, because the fold is off');
  assert.ok(await inFamily(page, 'p4g', '[data-kind="ember"]') === 0, 'and only its two-colour cards');
  const top = await page.evaluate(() => document.getElementById('p4g').getBoundingClientRect().top);
  assert.ok(Math.abs(top) < 220, `and the page is at it (top ${Math.round(top)})`);
  // p6 asked for all of them; the mount cap may hold some back, but scrolling
  // to it must never find it holding only the default fifty.
  await page.evaluate(() => document.getElementById('p6').scrollIntoView({behavior: 'instant'}));
  await page.waitForTimeout(1200);
  assert.ok(await inFamily(page, 'p6') > QUOTA,
            'p6 opens past its default quota, because the link said all of it');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// The folded cards need an address too: without one, the link a reader
// shares after opening a chip comes back with the run closed, and the card they
// meant to point at is the one thing on the page the hash cannot reach.
await section('an opened chip is in the hash, and a reload opens it again', async () => {
  const {family, rep} = aChip();
  const first = await open({hash: `#${family}`});
  await first.page.waitForTimeout(600);
  await first.page.locator(`#${family} .loop-card[data-id="${CSS_escape(rep.id)}"] .alike`).click();
  await first.page.waitForTimeout(400);
  const hash = await first.page.evaluate(() => location.hash);
  assert.match(hash, new RegExp(`open=${family}/`), `the open chip is in the link (${hash})`);
  assert.deepEqual(first.errors, [], 'console');
  await first.context.close();

  const {context, page, errors} = await open({hash});
  await page.waitForTimeout(900);
  const run = await page.$$eval(`#${family} .loop-card[data-alike-of]`,
                                nodes => nodes.map(node => node.dataset.id));
  assert.deepEqual(run, behind(family, rep), 'the same run is open on the reload');
  const chip = page.locator(`#${family} .loop-card[data-id="${CSS_escape(rep.id)}"] .alike`);
  assert.equal(await chip.getAttribute('aria-expanded'), 'true', 'and the chip says so');
  assert.equal(await page.evaluate(() => location.hash), hash, 'and the link is unchanged');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

await section('junk in the hash costs a default, not a broken page', async () => {
  const {context, page, errors} = await open({hash: '#nowhere?kind=purple&more=p4g:-3,nope:all,p2:x&unfold=yes'});
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => document.body.dataset.kind), 'all', 'the kind falls back');
  assert.ok(!await page.evaluate(() => document.body.dataset.unfold), 'the fold stays on');
  assert.equal(await inFamily(page, 'p4g'), servedOf('p4g'), 'and every quota is the default');
  assert.equal(await inFamily(page, 'p2'), servedOf('p2'));
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

await section('a deep link mounts its section, and scrolling writes the place back', async () => {
  const {context, page, errors} = await open({hash: '#p6m'});
  await page.waitForTimeout(1200);
  assert.equal(await inFamily(page, 'p6m'), servedOf('p6m'), '#p6m arrives full, never empty');
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
  await page.waitForTimeout(700);
  assert.equal(await page.evaluate(() => document.body.dataset.kind), 'mono', 'the filter came back');
  const visible = await page.$$eval('#p4 .loop-card', nodes =>
    nodes.filter(node => node.offsetParent !== null).map(node => node.dataset.kind));
  assert.ok(visible.length > 0 && visible.every(kind => kind === 'mono'), 'and it is applied');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// ---- 6 · the thousand-card ceiling -------------------------------------------

await section('Show all on the three largest never leaves more than a thousand mounted',
              async () => {
  const {context, page, errors} = await open();
  const biggest = [...doc.families].sort((a, b) => b.counts.distinct - a.counts.distinct).slice(0, 3);
  for (const family of biggest) {
    await page.locator(`.show-all[data-family="${family.id}"]`).click();
    await page.waitForTimeout(600);
    const mounted = await count(page, '.loop-card');
    // Every card in the document, the nine pinned viewers included: they are
    // cards, they hold posters, and the page's own readout counts them. The
    // ceiling used to be tested without them while the readout printed them, so
    // a full walk ended with "1009 of 4138 mounted" directly above the line
    // promising a thousand.
    assert.ok(mounted <= MOUNT_CAP,
              `at most ${MOUNT_CAP} cards after ${family.id} (saw ${mounted})`);
    const readout = await page.locator('#mounted').textContent();
    assert.equal(readout.match(/^(\d+) of/)?.[1], String(mounted),
                 `and the page says so (${readout})`);
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
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth),
               await page.evaluate(() => document.documentElement.clientWidth), 'still no sideways scroll');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

await section('an evicted family comes back when you scroll to it', async () => {
  const {context, page, errors} = await open();
  const biggest = [...doc.families].sort((a, b) => b.counts.distinct - a.counts.distinct).slice(0, 3);
  for (const family of biggest) {
    await page.locator(`.show-all[data-family="${family.id}"]`).click();
    await page.waitForTimeout(450);
  }
  const holes = await page.$$eval('.loop-grid[data-unloaded]', nodes => nodes.map(n => n.dataset.family));
  assert.ok(holes.length > 0, 'the mount cap did evict something');
  const back = holes[0];
  await page.evaluate(id => document.getElementById(id).scrollIntoView({behavior: 'instant'}), back);
  await page.waitForTimeout(1000);
  assert.ok(await inFamily(page, back) > 0, `${back} comes back on its own`);
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
  const biggest = [...doc.families].sort((a, b) => b.counts.distinct - a.counts.distinct).slice(0, 3);
  for (const family of biggest) {
    await page.locator(`.show-all[data-family="${family.id}"]`).click();
    await page.waitForTimeout(450);
  }
  const gone = await page.$$eval('.loop-grid[data-unloaded]', nodes => nodes.map(n => n.dataset.family));
  assert.ok(gone.length > 0, 'the mount cap did evict something');
  for (const family of gone.slice(0, 3)) {
    // Dispatched rather than pointed at: the rail is sticky under a sticky site
    // header, and in WebKit the header owns the pixel Playwright would aim for.
    // What is under test is the jump, not the hit testing.
    await page.locator(`.group-rail a[href="#${family}"]`).evaluate(node => node.click());
    const seen = [];
    for (const wait of [200, 200, 400, 800]) {
      await page.waitForTimeout(wait);
      seen.push(await inFamily(page, family));
    }
    assert.ok(seen.every(n => n > 0),
              `#${family} never flickers back to empty (${seen.join(' → ')})`);
  }
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// ---- 7 · the video budget ----------------------------------------------------

await section('at most 48 videos exist, all of them playing, and a card off screen holds none',
              async () => {
  const {context, page, errors} = await open();
  const measure = () => page.evaluate(() => {
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
  const seen = [];
  for (const y of [0, 1500, 4000, 8000, 1500, 0]) {
    await page.evaluate(offset => scrollTo(0, offset), y);
    // The site scrolls smoothly and the observer is the engine's to schedule,
    // so the budget is allowed to be mid-flight for a moment; the ceiling is
    // not, and it is checked at every look. What is asserted is where the page
    // comes to REST, which is where the reader is.
    let state = await measure();
    for (let waited = 0; waited < 3000; waited += 250) {
      assert.ok(state.videos <= VIDEO_CAP,
                `at most ${VIDEO_CAP} videos (saw ${state.videos} at y=${y})`);
      if (state.offscreen === 0 && state.sourceless === 0 && state.paused <= 2) break;
      await page.waitForTimeout(250);
      state = await measure();
    }
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

// ---- 8 · the kind filter -----------------------------------------------------

await section('the kind filter shows one kind at a time and says how many', async () => {
  const {context, page, errors} = await open();
  for (const kind of ['ember', 'colour', 'mono', 'viewer']) {
    await page.locator(`.kind-bar button[data-kind="${kind}"]`).click();
    await page.waitForTimeout(500);
    const wrong = await page.$$eval('.loop-card', (nodes, k) =>
      nodes.filter(node => node.offsetParent !== null && node.dataset.kind !== k).length, kind);
    assert.equal(wrong, 0, `only ${kind} cards are visible`);
    assert.ok(await count(page, `.loop-card[data-kind="${kind}"]`) > 0, `and there are some`);
    assert.match(await page.evaluate(() => location.hash), new RegExp(`kind=${kind}`),
                 'the filter is in the link');
  }
  await page.locator('.kind-bar button[data-kind="all"]').click();
  await page.waitForTimeout(400);
  const hidden = await page.$$eval('.loop-card', nodes => nodes.filter(n => n.offsetParent === null).length);
  assert.equal(hidden, 0, 'All brings them all back');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// The filter used to hide and mount nothing, so "Three-colour" — whose 423
// pictures all live in the last five sections, past the 240 the HTML carried —
// drew a page with eleven empty headings and not one picture on it. Every
// section now gets its own quota of the kind that is on.
await section('choosing a kind gives every section up to fifty of it', async () => {
  const {context, page, errors} = await open();
  for (const kind of ['colour', 'mono', 'ember']) {
    await page.locator(`.kind-bar button[data-kind="${kind}"]`).click();
    await page.waitForTimeout(900);
    const shown = await page.$$eval('.showcase-section:not([hidden])', nodes => nodes.map(node => ({
      id: node.id,
      cards: node.querySelectorAll('.loop-card').length,
      unloaded: Boolean(node.querySelector('.loop-grid[data-unloaded]')),
    })));
    for (const {id, cards, unloaded} of shown) {
      if (id === 'viewers') continue;
      const rows = byFamily.get(id) ?? [];
      const reps = rows.filter(row => row.kind === kind && !row.alikeOf).length;
      assert.ok(rows.some(row => row.kind === kind),
                `${kind}: ${id} is shown only because it holds some`);
      assert.ok(cards <= QUOTA, `${kind}: ${id} shows at most ${QUOTA} (saw ${cards})`);
      assert.ok(cards > 0 || unloaded,
                `${kind}: ${id} holds ${reps} of this kind and shows none of them`);
    }
    const seen = shown.filter(s => s.id !== 'viewers').map(s => s.id);
    const expected = doc.families.filter(f => byFamily.get(f.id).some(r => r.kind === kind))
      .map(f => f.id);
    assert.deepEqual(seen, expected, `${kind}: exactly the sections that hold some`);
  }
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

await section('a filtered section counts and offers what the filter will do', async () => {
  const {context, page, errors} = await open();
  await page.locator('.kind-bar button[data-kind="mono"]').click();
  await page.waitForTimeout(700);
  const family = doc.families.filter(f => f.counts.mono && f.counts.mono < f.counts.total)
    .reduce((a, b) => (a.counts.total > b.counts.total ? a : b));
  const rows = byFamily.get(family.id).filter(row => row.kind === 'mono');
  const distinct = rows.filter(row => !row.alikeOf).length;
  const wanted = distinct < rows.length
    ? `${distinct} distinct of ${rows.length} black & white` : `${rows.length} black & white`;
  assert.equal(await page.locator(`#${family.id} .n`).textContent(), wanted,
               `${family.id} counts what is on, not what the page holds`);
  const button = page.locator(`.show-all[data-family="${family.id}"]`);
  if (await button.isVisible()) {
    assert.equal(await button.textContent(), `Show all ${distinct}`,
                 'and the button promises the same number');
  }
  await page.locator('.kind-bar button[data-kind="all"]').click();
  await page.waitForTimeout(500);
  assert.equal(await page.locator(`#${family.id} .n`).textContent(), headingText(family),
               'and All puts the real count back, word for word');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// ---- 9 · every count on the page is the manifest's ----------------------------

await section('the summary, the headings, the rail and the manifest agree', async () => {
  const {context, page, errors} = await open();
  const num = text => Number(text.replace(/[^\d]/g, ''));
  const summary = await page.$$eval('.showcase-summary span',
                                    nodes => Object.fromEntries(nodes.map(
                                      n => [n.dataset.n, n.querySelector('b').textContent])));
  for (const key of ['clips', 'total', 'distinct', 'folded', 'records', 'ember', 'colour',
                     'mono', 'viewer', 'equations']) {
    assert.equal(num(summary[key]), doc.counts[key], `the summary's ${key}`);
  }
  // From the manifest, like every other number on that line. A literal 17 on
  // both sides of this check was the one figure that would have survived an
  // eighteenth family being carded, railed and headed below it.
  assert.equal(num(summary.groups), doc.families.length, 'and the wallpaper groups it cards');
  assert.equal(doc.counts.distinct + doc.counts.folded, doc.counts.total,
               'distinct + folded is every card, with nothing left over');
  // …and the span says which of them it is counting. "1 657 distinct-looking"
  // with no noun, two spans after "2 632 pictures", was a card count being read
  // as a picture count.
  const labels = await page.$$eval('.showcase-summary span', nodes => Object.fromEntries(
    nodes.map(n => [n.dataset.n, {text: n.textContent, title: n.getAttribute('title') ?? ''}])));
  assert.match(labels.distinct.text, /distinct-looking cards$/, 'the noun is on the span');
  assert.equal(num(labels.distinct.title), doc.counts.distinctClips,
               'and its title carries the picture-level figure');
  assert.ok(doc.counts.distinctClips < doc.counts.distinct,
            'which is the smaller of the two, because one picture is carded several times');

  // A pill is `<b><signature></b><span>count</span>`, and the signature is a
  // span of its own so p1's lone ring can be drawn larger — so `a span` finds
  // the signature first. Writing the count into that one put a number where
  // every orbifold symbol on the rail used to be.
  const readRail = () => page.$$eval('.group-rail a', nodes => nodes.map(node => ({
    href: node.getAttribute('href'), sign: node.querySelector('b').textContent,
    n: node.querySelector(':scope > span').textContent,
    title: node.getAttribute('title') ?? '',
  })));
  const rail = await readRail();
  for (const family of doc.families) {
    const pill = rail.find(a => a.href === `#${family.id}`);
    assert.ok(pill, `${family.id} has a rail pill`);
    assert.equal(Number(pill.n), family.counts.distinct,
                 `${family.id}'s pill counts what the section will show`);
    assert.equal(pill.sign, family.orbifold, `${family.id}'s pill keeps its signature`);
    assert.ok(pill.title.includes(String(family.counts.total)),
              `${family.id}'s pill names the total it stands for ("${pill.title}")`);
    assert.equal(await page.locator(`#${family.id} .n`).textContent(), headingText(family),
                 `${family.id}'s heading`);
  }
  // …and it still does after a round trip through the filter, which is what
  // rewrites the pill.
  await page.locator('.kind-bar button[data-kind="mono"]').click();
  await page.waitForTimeout(600);
  for (const pill of await readRail()) {
    const id = pill.href.slice(1);
    if (id === 'viewers') continue;
    const family = doc.families.find(f => f.id === id);
    assert.equal(pill.sign, family.orbifold, `${id} keeps its signature under a filter`);
    const mine = byFamily.get(id).filter(row => row.kind === 'mono');
    assert.equal(Number(pill.n), mine.filter(row => !row.alikeOf).length,
                 `${id}'s pill counts the filtered distinct`);
  }
  await page.locator('.kind-bar button[data-kind="all"]').click();
  await page.waitForTimeout(500);
  assert.deepEqual(await readRail(), rail, 'and All puts the whole rail back');
  const readout = await page.locator('#mounted').textContent();
  assert.equal(readout.match(/^(\d+) of (\d+)/)?.[2], String(doc.counts.total),
               `the mount readout counts every card (${readout})`);
  assert.match(await page.locator('#status').textContent(),
               /distinct-looking, .* folded behind them/, 'and the status line says both');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// ---- 10 · the links ------------------------------------------------------------
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

// …and clicked for real, not navigated to: the card is a <div> now, and if the
// stretched link inside it ever stopped covering the card, every one of these
// 4 138 links would be a picture nobody can open.
await section('clicking a card follows its own link', async () => {
  const {context, page, errors} = await open();
  const card = page.locator('#p1 .loop-card').first();
  const id = await card.getAttribute('data-id');
  const href = await card.locator('a.open').getAttribute('href');
  // The card's own middle, which is a point inside the poster — not the link's
  // text, which there is none of. A card whose link stopped filling it would
  // swallow this click and stay put.
  const wanted = new URL(href, new URL('index.html', SHOWCASE)).pathname;
  await Promise.all([
    page.waitForURL(url => new URL(url).pathname === wanted, {timeout: 25000}),
    card.click(),
  ]);
  assert.equal(new URL(page.url()).pathname, wanted,
               `clicking ${id} went where the card said`);
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

await section('every preview and poster the served page names is really there', async () => {
  // Eight from every section, which is 145 cards over all eighteen: enough to
  // catch a whole kind or a whole family missing without fetching 1 640 files.
  const shown = [byFamily.get('viewers').slice(0, 8),
                 ...doc.families.map(family => byFamily.get(family.id)
                   .filter(row => !row.alikeOf).slice(0, 8))].flat();
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
  assert.deepEqual(bad, [], `every clip and poster of the ${shown.length} sampled cards`);
});

// ---- 11 · the chip's geometry, and the phone ----------------------------------

/** No chip may overlap its card's signature or leave its card's art.
 *
 * A 117 px card cannot hold "+4 alike" (65 px) and "*²2²2²2²2" (71 px) on one
 * row, and the chip is the one drawn second: left where the desktop puts it, it
 * ate the signature's first two characters on 194 of the chipped cards and left
 * the card showing a group that does not exist. The phone answers that by
 * taking the row above — but the check lived inside the phone section and
 * nowhere else, so the desktop and tablet placement, where the chip and the
 * signature really do share the bottom strip of the art, had no guard at all. */
async function checkChipGeometry(page, width) {
  const collisions = await page.$$eval('.loop-card', nodes => nodes.flatMap(card => {
    const chip = card.querySelector('.alike'), sig = card.querySelector('.sig');
    if (!chip || !sig || getComputedStyle(chip).display === 'none') return [];
    const c = chip.getBoundingClientRect(), s = sig.getBoundingClientRect();
    const art = card.querySelector('.art').getBoundingClientRect();
    const over = c.right > s.left && c.top < s.bottom && c.bottom > s.top;
    const out = art.height && (c.top < art.top || c.bottom > art.bottom + 0.5);
    return over || out ? [`${card.dataset.id}: ${chip.textContent} / ${sig.textContent}`] : [];
  }));
  assert.deepEqual(collisions.slice(0, 3), [],
                   `at ${width}: ${collisions.length} chips overlap a signature or leave the art`);
  return collisions.length;
}

await section('no chip overlaps a signature or leaves its art, at any width', async () => {
  for (const width of [1440, 1024, 760]) {
    const {context, page, errors} = await open({width, height: 1000});
    // The longest chips and the longest signatures are in the big sections, and
    // most of them are past the served quota — so one is opened out first.
    await page.locator('.show-all[data-family="pmm"]').click();
    await page.waitForTimeout(700);
    await page.$$eval('#pmm .loop-card .alike', nodes => nodes.slice(0, 40).forEach(n => n.click()));
    await page.waitForTimeout(700);
    const seen = await count(page, '#pmm .loop-card');
    assert.ok(seen > QUOTA, `pmm is opened out at ${width} (${seen} cards)`);
    await checkChipGeometry(page, width);
    assert.deepEqual(errors, [], 'console');
    await context.close();
  }
});

// ---- 12 · the phone -----------------------------------------------------------

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
  // A thumb wants 44 px and a 112 px card cannot spare that much ink, so the
  // pill is 36 px of real chip and the last 8 px are a halo UNDER it. It used
  // to be a 24 px pill inside a halo of `inset: -10px` all round, on the
  // argument that nothing else on the card was listening there: `a.open` was,
  // and the halo sat on the card's own link over 27 % of the picture, so a tap
  // seven pixels above the chip folded the look-alikes instead of opening the
  // card.
  const chip = await page.evaluate(() => {
    const node = document.querySelector('.loop-card .alike');
    if (!node) return null;
    const box = node.getBoundingClientRect();
    const halo = getComputedStyle(node, '::after');
    const px = value => (value === 'auto' ? 0 : parseFloat(value) || 0);
    return {height: box.height, content: halo.content,
            top: px(halo.top), bottom: px(halo.bottom),
            left: px(halo.left), right: px(halo.right)};
  });
  assert.ok(chip, 'a chip is on the phone page too');
  assert.ok(chip.height >= 36, `the pill is at least 36 px tall (${Math.round(chip.height)})`);
  assert.ok(chip.content && chip.content !== 'none', 'and it carries a halo');
  // The halo grows only away from the picture's middle: down, into the strip
  // between the chip and the signature, and nowhere else. A negative `top` is
  // the halo standing on the art above the pill, which is the defect.
  assert.ok(chip.top >= 0, `the halo never reaches above the pill (top ${chip.top})`);
  assert.ok(chip.left >= 0 && chip.right >= 0,
            `nor to either side of it (${chip.left} / ${chip.right})`);
  assert.ok(chip.bottom <= 0, `it grows downward (bottom ${chip.bottom})`);
  const tap = chip.height - chip.top - chip.bottom;
  assert.ok(tap >= 44, `and the tap box is a thumb's 44 px (${Math.round(tap)})`);
  // Measured with `elementFromPoint`, which only answers inside the viewport —
  // so the cards are scrolled to first, and the sweep is made to prove itself
  // by finding the chip where the chip really is.
  await page.locator('.loop-card[data-alike]').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const taps = await page.$$eval('.loop-card[data-alike]', nodes => {
    const bad = [], above = [];
    let onChip = 0, onLink = 0, cards = 0;
    const px = value => (value === 'auto' ? 0 : parseFloat(value) || 0);
    for (const card of nodes) {
      const box = card.getBoundingClientRect();
      if (box.top < 0 || box.bottom > innerHeight) continue;       // not on screen
      cards += 1;
      const chip = card.querySelector('.alike');
      const art = card.querySelector('.art').getBoundingClientRect();
      const pill = chip.getBoundingClientRect();
      // The tap box is the pill plus its halo, and the halo's own insets say
      // how far it reaches: a negative one grows the box on that side.
      const halo = getComputedStyle(chip, '::after');
      // …with a pixel of slack: a chip whose top edge falls at y = 44.8 answers
      // to a tap at 44, and the defect this is watching for is a ten-pixel
      // halo over the picture, not a rounded edge.
      const seat = {left: pill.left - px(halo.left) - 1, right: pill.right + px(halo.right) + 1,
                    top: pill.top - px(halo.top) - 1, bottom: pill.bottom - px(halo.bottom) + 1};
      for (let y = art.top + 2; y < art.bottom - 1; y += 2) {
        for (let x = art.left + 2; x < art.right - 1; x += 2) {
          const hit = document.elementFromPoint(x, y);
          const mine = Boolean(hit && hit.closest('.alike'));
          const inside = x >= seat.left && x <= seat.right && y >= seat.top && y <= seat.bottom;
          const where = `${card.dataset.id} at ${Math.round(x - art.left)},`
            + `${Math.round(y - art.top)}`;
          if (mine && inside) onChip += 1;
          else if (mine && y < pill.top - 1) above.push(where);   // over the picture itself
          else if (mine) bad.push(where);
          else if (hit && hit.closest('a.open')) onLink += 1;
        }
      }
    }
    return {bad, above, onChip, onLink, cards};
  });
  assert.ok(taps.cards >= 2, `chipped cards are on screen to measure (${taps.cards})`);
  assert.ok(taps.onChip > 50, `the sweep finds the chip where it is (${taps.onChip} points)`);
  assert.ok(taps.onLink > taps.onChip * 2,
            `and most of the picture still opens the card (${taps.onLink} against ${taps.onChip})`);
  assert.deepEqual(taps.above.slice(0, 3), [],
                   `${taps.above.length} points of the picture ABOVE the chip answer to it`);
  assert.deepEqual(taps.bad.slice(0, 3), [],
                   `${taps.bad.length} points of the picture outside the tap box answer to the chip`);
  await checkChipGeometry(page, 390);
  const buttons = await page.$$eval('.load-more:not([hidden]) button:not([hidden])',
                                    nodes => nodes.map(n => Math.round(n.getBoundingClientRect().height)));
  assert.ok(buttons.length && buttons.every(h => h >= 44),
            `both section buttons are thumb-sized (${buttons.slice(0, 2).join(', ')})`);
  await page.evaluate(() => scrollTo(0, 2000));
  await page.waitForTimeout(800);
  const videos = await count(page, 'video');
  assert.ok(videos <= 12, `a phone gets at most twelve videos (${videos})`);
  await page.screenshot({path: `${shots}/showcase-phone.png`});
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// The halo's edge, measured by a REAL tap rather than by `elementFromPoint`.
// The two disagree: the pill's bottom lands on a fractional pixel (356.63), and
// WebKit rounds that boundary outward where Chromium rounds it in — so with the
// halo at 8 px a tap exactly 8 px below the chip opened the card in one engine
// and folded the look-alikes in the other. The pill is 38 px and the halo 6 now,
// which is the same 44 px tap box and a boundary both engines agree on.
await section('on the phone, a tap below the chip’s halo follows the card', async () => {
  const {context, page, errors} = await open({width: 390, height: 844});
  await page.locator('.loop-card[data-alike]').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const spot = await page.evaluate(() => {
    for (const card of document.querySelectorAll('.loop-card[data-alike]')) {
      const box = card.getBoundingClientRect();
      if (box.top < 0 || box.bottom > innerHeight) continue;
      const pill = card.querySelector('.alike').getBoundingClientRect();
      return {x: pill.left + pill.width / 2, bottom: pill.bottom,
              href: card.querySelector('a.open').getAttribute('href')};
    }
    return null;
  });
  assert.ok(spot, 'a chipped card is on screen');
  await page.mouse.click(spot.x, spot.bottom + 8);
  await page.waitForTimeout(700);
  assert.equal(await count(page, '.loop-card[data-alike-of]'), 0,
               'a tap 8 px below the pill does not fold anything');
  assert.ok(!page.url().includes('/showcase/'),
            `it follows the card instead (${page.url().slice(-40)})`);
  // No console assertion: the tap navigates, so whatever the card's own page
  // logs would arrive on this listener and it is not what is under test.
  void errors;
  await context.close();
});

await browser.close();
console.log(`showcase — ${label}`);
console.log(notes.join('\n'));
if (failures) { console.error(`${failures} section(s) failed`); process.exit(1); }
console.log('all sections passed');

/** `CSS.escape` for a selector built in Node, where there is no `CSS`. A row id
 * holds colons and at-signs, and an attribute selector needs them quoted. */
function CSS_escape(value) {
  return value.replace(/["\\]/g, '\\$&');
}
