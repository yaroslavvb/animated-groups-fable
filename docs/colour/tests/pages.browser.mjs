// The Colour category in a real browser engine: the landing page, the two
// explorer pages, the selection ladder, the pixels the shader actually draws
// against an independent CPU reconstruction of the same colouring, the
// generator marks, the Notation panel, the phone layout, the nav group across
// the site, and every link the new pages carry.
//
// Usage: node docs/colour/tests/pages.browser.mjs [base-url] [label]
//        BROWSER=webkit runs the same checks in Playwright's WebKit, which is
//        where the marks' tspan handling and the `gesture*` events live.
//
// The field bytes are fetched from whatever copy of the site is being tested,
// so a live deployment is checked against its own data.
import assert from 'node:assert/strict';
import {createColourCatalog} from '../colour-atlas.mjs';
import {colouringParams, DESCRIPTORS, frameAt, colourAt, fromPlane, uVolume} from '../colour-renderer.mjs';

const runtime = '/Users/yaroslavvb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? `${runtime}playwright/index.mjs`);
const {PNG} = (await import(process.env.PNGJS_MODULE ?? `${runtime}pngjs/lib/png.js`)).default;
const engine = process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
const base = (process.argv[2] ?? 'http://localhost:8934/').replace(/\/?$/, '/');
const label = `${process.argv[3] ?? 'local'} (${engine})`;
const shots = process.env.SHOT_DIR ?? '/tmp';
const PALETTE = [[0xc9, 0x56, 0x3e], [0x57, 0x97, 0x9a], [0xe2, 0xbe, 0x68]];

const notes = [];
let failures = 0;
async function section(name, body) {
  const started = Date.now();
  try { await body(); notes.push(`  ok   ${name} (${Date.now() - started} ms)`); }
  catch (error) { failures++; notes.push(`  FAIL ${name}: ${error.message}`); if (process.env.VERBOSE) notes.push(String(error.stack)); }
}

// ---- the catalog, loaded in Node through the page's own loader --------------
// This is the first assertion of the suite: the shipped catalog passes every
// gate in colour-atlas.mjs. If it did not, the pages would refuse to render.
const catalog = createColourCatalog(
  await (await fetch(new URL('colour/data/colour-atlas.json', base))).json(),
  {groups: (await (await fetch(new URL('scott-gray/wallpaper-groups.json', base))).json()).groups,
   baseUrl: new URL('colour/', base)},
);
const gyres = catalog.all('gyre'), trefoils = catalog.all('trefoil');
assert.ok(gyres.length >= 8, 'at least eight Gyre colourings');
assert.ok(trefoils.length >= 8, 'at least eight Trefoil colourings');
for (const [kind, list] of [['gyre', gyres], ['trefoil', trefoils]]) {
  const groups = new Set(list.map(entry => entry.groupId));
  const models = new Set(list.map(entry => entry.model));
  assert.ok(groups.size >= 2, `${kind} spans at least two film groups (${groups.size})`);
  assert.ok(models.size >= 2, `${kind} spans at least two equations (${models.size})`);
}

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
const ready = page => page.waitForSelector('canvas[data-ready="true"]', {timeout: 30000});

// ---- 1 · the three pages load, with no console errors ----------------------

await section('the three pages load with no console errors', async () => {
  for (const path of ['colour/', 'colour/gyre/', 'colour/trefoil/']) {
    const {context, page, errors} = await open(path);
    if (path === 'colour/') {
      await page.waitForSelector('.family-card');
      assert.equal(await page.locator('.family-card').count(), 3, 'the landing page shows three cards');
      const counts = await page.locator('[data-pattern-count]').allTextContents();
      assert.ok(counts.some(text => /\d+ verified colourings/.test(text)), `the landing cards carry their counts: ${counts.join(' | ')}`);
    } else {
      await ready(page);
      // The live region names what was just selected, not a bare "ready".
      const status = await page.locator('#status').textContent();
      assert.match(status, / — ready\.$/, `the status line ends in ready (${status})`);
      assert.ok(status.startsWith(await page.locator('#variants .group[aria-pressed="true"]').getAttribute('data-group-id')),
        `and names the film group it chose (${status})`);
      assert.ok(await page.locator('#variants .group').count() >= 2, 'step 1 lists the hosting film groups');
      assert.ok(await page.locator('#subvariants .subvariant').count() >= 2, 'step 1 carries its filter chips');
      assert.ok(await page.locator('#symmetry-rows tr.exact').count() >= 3, 'the measured symmetry table has its exact rows');
      assert.ok(await page.locator('#symmetry-rows tr.fails').count() >= 1, 'and the non-symmetries it is contrasted with');
    }
    assert.deepEqual(errors, [], `${path} console`);
    await context.close();
  }
});

// ---- 2 · every href on the new pages resolves ------------------------------

await section('every href on the three new pages resolves', async () => {
  const seen = new Map();
  for (const path of ['colour/', 'colour/gyre/', 'colour/trefoil/']) {
    const {context, page, errors} = await open(path);
    if (path !== 'colour/') await ready(page);
    const hrefs = await page.$$eval('a[href]', nodes => nodes.map(node => node.href));
    for (const href of hrefs) {
      if (!href.startsWith(base) || seen.has(href)) continue;
      const response = await fetch(href, {method: 'GET'});
      seen.set(href, response.status);
      assert.ok(response.status < 400, `${href} on ${path} is ${response.status}`);
    }
    assert.deepEqual(errors, [], `${path} console`);
    await context.close();
  }
  notes.push(`       ${seen.size} distinct local links checked`);
});

// ---- 3 · the nav group is on every page, including the two reports ---------

await section('the Colour nav group appears across the site', async () => {
  // The standalone viewers (`scott-gray/gyre/` and its siblings) carry no site
  // header at all — they are edge-to-edge immersive pages — so they are not in
  // the sample, and the insertion script skips them for the same reason.
  const sample = [
    'index.html', 'notation.html', 'scott-gray-groups.html', 'colourings-tutorial.html',
    'scott-gray/pg/', 'scott-gray/p6m/', 'scott-gray/index.html', 'correspondence-p6.html',
    'reports/', 'reports/space-time-color/', 'reports/symmetry-meeting-notes-week-38/',
    'colour/', 'colour/gyre/', 'colour/trefoil/',
  ];
  const {context, page} = await open('index.html');
  for (const path of sample) {
    await page.goto(new URL(path, base).href, {waitUntil: 'domcontentloaded'});
    const group = page.locator('.navgroup', {has: page.locator('.navgroup-label', {hasText: /^Colour$/})});
    assert.equal(await group.count(), 1, `${path} has exactly one Colour navgroup`);
    const links = group.locator('a');
    assert.equal(await links.count(), 3, `${path}: the Colour group has three links`);
    assert.deepEqual(await links.allTextContents(), ['Entangled colourings', 'Gyre', 'Trefoil'], `${path}: the Colour links`);
    for (const href of await links.evaluateAll(nodes => nodes.map(node => node.href))) {
      assert.ok((await fetch(href)).status < 400, `${path}: ${href} resolves`);
    }
    assert.ok(await page.locator('.navgroup a.here').count() <= 1, `${path}: at most one current link`);
  }
  await context.close();
});

// ---- 4 · the ladder selects, and the URL follows ---------------------------

await section('the ladder selects and updates the URL', async () => {
  const {context, page, errors} = await open('colour/gyre/');
  await ready(page);
  const hash = () => page.evaluate(() => location.hash);
  const caption = () => page.locator('#caption').textContent();

  // A filter chip.
  const before = await hash();
  await page.locator('#subvariants .subvariant', {hasText: 'All ('}).click();
  await ready(page);
  assert.notEqual(await hash(), before, 'a filter chip changes the hash');
  assert.match(await hash(), /sub=all/, 'and names the filter it chose');
  const groups = await page.locator('#variants .group:not(.is-empty)').count();
  assert.ok(groups >= 10, `every hosting film group is selectable under "All" (${groups})`);

  // A film group.
  const wasGroup = await hash();
  const pickId = await page.locator('#variants .group:not(.is-empty)[aria-pressed="false"]').first().getAttribute('data-group-id');
  await page.locator(`#variants .group[data-group-id="${pickId}"]`).click();
  await ready(page);
  assert.match(await hash(), new RegExp(`^#${pickId}\\?`), 'the fragment head is the film group');
  assert.notEqual(await hash(), wasGroup);
  assert.equal(await page.locator(`#variants .group[data-group-id="${pickId}"]`).getAttribute('aria-pressed'), 'true', 'the chosen group is pressed');

  // An equation pill. A disabled one must not be clickable.
  const disabled = page.locator('#equations .equation[disabled]');
  if (await disabled.count()) assert.ok(await disabled.first().isDisabled(), 'a disabled equation pill is not clickable');
  const enabled = page.locator('#equations .equation:not([disabled])');
  if (await enabled.count() > 1) {
    const other = enabled.nth(1), model = await other.getAttribute('data-model');
    const wasCaption = await caption();
    await other.click();
    await ready(page);
    assert.match(await hash(), new RegExp(`model=${model}`), 'the equation is in the hash');
    assert.notEqual(await caption(), wasCaption, 'and the viewer caption follows');
  }

  // A thumbnail.
  const thumbs = page.locator('.pattern-thumb');
  if (await thumbs.count() > 1) {
    const second = thumbs.nth(1), id = await second.getAttribute('data-pattern-id');
    const wasCaption = await caption();
    await second.click();
    await ready(page);
    assert.match(decodeURIComponent(await hash()), new RegExp(`pattern=${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), 'the pattern is in the hash');
    assert.notEqual(await caption(), wasCaption, 'and the caption follows the thumbnail');
    assert.equal(await second.getAttribute('aria-pressed'), 'true');
  }

  // A hand-edited hash never throws, and an unknown version keeps the group.
  await page.goto(`${new URL('colour/gyre/', base).href}#g248?v=99&pattern=nonsense&scale=banana`, {waitUntil: 'domcontentloaded'});
  await ready(page);
  assert.match(await hash(), /^#g248\?v=1/, 'an unknown version keeps only the film group');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// ---- 5 · the pixels agree with a CPU render of the same entry --------------

/** The lattice point the shader reads at CSS pixel (px, py), reproduced here
 * from the camera in the shared link — the same arithmetic as `latticeAt` in
 * the fragment shader and `view.latticeAt` in the renderer. */
function latticeAt(px, py, {cssW, cssH, centre, scale, angle}) {
  const ox = ((px + 0.5) / cssW - 0.5) * cssW / scale;
  const oy = ((py + 0.5) / cssH - 0.5) * cssH / scale;
  const c = Math.cos(angle), s = -Math.sin(angle);
  const p = [c * ox - s * oy, s * ox + c * oy];
  const [du, dv] = fromPlane(p);
  return [centre[0] + du, centre[1] + dv];
}

async function pixelCheck(kind, entryId) {
  const entry = catalog.get(entryId);
  const params = colouringParams(entry);
  const descriptor = DESCRIPTORS[kind];
  const config = {N: entry.N, M: entry.M};
  const bytes = await (await fetch(entry.fieldUrl)).arrayBuffer();
  const planar = new Float32Array(bytes);
  assert.equal(planar.length, entry.valueCount, 'the field has the length the catalog records');
  const volume = uVolume(planar, entry.N, entry.M, 0);

  const phase = 0.25;
  const hash = `#${entry.groupId}?v=1&sub=all&model=${entry.model}&pattern=${encodeURIComponent(entryId)}`
    + `&framing=endless&palette=colour&speed=1&marks=0&notation=0&phase=${phase}&play=0`;
  const {context, page, errors} = await open(`colour/${kind}/`, {hash});
  await ready(page);
  await page.waitForTimeout(250);
  const camera = await page.evaluate(() => {
    const parameters = new URLSearchParams(location.hash.slice(location.hash.indexOf('?') + 1));
    const canvas = document.querySelector('#pattern'), box = canvas.getBoundingClientRect();
    return {
      x: Number(parameters.get('x')), y: Number(parameters.get('y')),
      scale: Number(parameters.get('scale')), angle: Number(parameters.get('angle') ?? 0),
      phase: Number(parameters.get('phase')), play: parameters.get('play'),
      cssW: box.width, cssH: box.height,
    };
  });
  assert.equal(camera.play, '0', 'the link opened paused, so the phase is the one asked for');
  assert.ok(Number.isFinite(camera.scale) && camera.scale > 0, 'the shared link carries the camera');
  const view = {cssW: camera.cssW, cssH: camera.cssH, centre: [camera.x, camera.y], scale: camera.scale, angle: camera.angle * Math.PI / 180};

  const png = PNG.sync.read(await page.locator('#pattern').screenshot());
  assert.ok(png.width >= 200 && png.height >= 200, 'the canvas has a real size');
  const sx = png.width / camera.cssW, sy = png.height / camera.cssH;

  // Not blank: three well-separated colours, each holding a reasonable share.
  const counts = [0, 0, 0];
  let other = 0;
  for (let py = 4; py < png.height; py += 7) for (let px = 4; px < png.width; px += 7) {
    const i = 4 * (py * png.width + px);
    const rgb = [png.data[i], png.data[i + 1], png.data[i + 2]];
    let best = -1, bestDistance = Infinity;
    for (const [k, target] of PALETTE.entries()) {
      const distance = Math.hypot(rgb[0] - target[0], rgb[1] - target[1], rgb[2] - target[2]);
      if (distance < bestDistance) { bestDistance = distance; best = k; }
    }
    if (bestDistance <= 26) counts[best]++; else other++;
  }
  const total = counts[0] + counts[1] + counts[2] + other;
  assert.ok(total > 1000, 'enough samples');
  for (const [k, count] of counts.entries()) {
    const share = count / total;
    assert.ok(share > 0.18 && share < 0.46, `colour ${k} holds ${(100 * share).toFixed(1)} % of the picture`);
  }
  assert.ok(other / total < 0.2, `only ${(100 * other / total).toFixed(1)} % of samples are between two colours`);

  // …and the colours are the ones an independent CPU render of the same rule
  // at the same camera and the same instant names. Pixels near a boundary are
  // skipped: the shader softens the argmax over about one device pixel, so a
  // boundary pixel is a blend and says nothing about the law.
  const plane = frameAt(descriptor, volume, config, phase);
  let compared = 0, agreed = 0;
  for (let py = 10; py < camera.cssH - 10; py += 9) for (let px = 10; px < camera.cssW - 10; px += 9) {
    const here = colourAt(descriptor, plane, config, params, latticeAt(px, py, view));
    let interior = true;
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2]]) {
      if (colourAt(descriptor, plane, config, params, latticeAt(px + dx, py + dy, view)) !== here) { interior = false; break; }
    }
    if (!interior) continue;
    const i = 4 * (Math.round(py * sy) * png.width + Math.round(px * sx));
    const rgb = [png.data[i], png.data[i + 1], png.data[i + 2]];
    const target = PALETTE[here];
    compared++;
    if (Math.hypot(rgb[0] - target[0], rgb[1] - target[1], rgb[2] - target[2]) <= 26) agreed++;
  }
  assert.ok(compared > 200, `enough interior samples to compare (${compared})`);
  assert.ok(agreed / compared > 0.99, `the shader agrees with the CPU rule at ${agreed}/${compared} interior samples`);
  notes.push(`       ${kind} ${entryId}: ${agreed}/${compared} interior pixels agree with the CPU rule`);

  // The picture changes with the phase, and the fixed frame really is fixed.
  const first = await page.locator('#pattern').screenshot();
  await page.goto(page.url().replace(/phase=[\d.]+/, 'phase=0.5'), {waitUntil: 'domcontentloaded'});
  await ready(page);
  await page.waitForTimeout(200);
  const second = await page.locator('#pattern').screenshot();
  assert.notEqual(first.toString('base64'), second.toString('base64'), 'the picture changes between phase 0 and phase 0.5');

  await page.goto(`${new URL(`colour/${kind}/`, base).href}#${entry.groupId}?v=1&sub=all&pattern=${encodeURIComponent(entryId)}&framing=simulation&tiles=2&play=0&marks=0&phase=0.25`, {waitUntil: 'domcontentloaded'});
  await ready(page);
  await page.waitForTimeout(200);
  const fixedBefore = await page.locator('#pattern').screenshot();
  const box = await page.locator('#pattern').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2 - 60, {steps: 8});
  await page.mouse.up();
  await page.waitForTimeout(250);
  const fixedAfter = await page.locator('#pattern').screenshot();
  assert.equal(fixedBefore.toString('base64'), fixedAfter.toString('base64'), 'dragging does not move the fixed simulation-width frame');
  assert.match(await page.evaluate(() => location.hash), /framing=simulation/, 'and the framing stays in the link');
  assert.deepEqual(errors, [], 'console');
  await context.close();
}

await section('Gyre: the shader agrees with a CPU render of the same colouring', () => pixelCheck('gyre', 'colour:gyre:8fcde9bc1178'));
await section('Trefoil: the shader agrees with a CPU render of the same colouring', () => pixelCheck('trefoil', 'colour:trefoil:8fcde9bc1178'));

/** An orbit the offline equation search found rather than the wallpaper atlas:
 * a different equation on a different grid (36² rather than 24²…120²) with its
 * own frame count and its own period. The two checks above run on the field the
 * standalone viewers ship; these run on one the pages only know through the
 * catalog, so nothing about N, M, T or the equation can be hard-wired. */
const newEquation = kind => {
  const list = catalog.all(kind);
  const fromSearch = list.filter(entry => entry.origin === 'record' && entry.model !== 'gray-scott');
  // A catalog rebuilt without the search's records still has to prove the same
  // thing, so fall back to any equation that is not the atlas's own.
  const pool = fromSearch.length ? fromSearch : list.filter(entry => entry.model !== 'gray-scott');
  return (pool.find(entry => entry.featured && entry.N === 36) ?? pool.find(entry => entry.N === 36) ?? pool[0])?.id ?? null;
};
for (const kind of ['gyre', 'trefoil']) {
  const id = newEquation(kind);
  const entry = id ? catalog.get(id) : null;
  await section(`${kind}: a new-equation orbit plays at its own N, M and period`, async () => {
    assert.ok(entry, `the catalog carries a ${kind} orbit from the equation search`);
    await pixelCheck(kind, id);
    // …and the page states the grid, the frame count and the period it is
    // actually playing, rather than the atlas defaults.
    const {context, page, errors} = await open(`colour/${kind}/`, {hash: `#${entry.groupId}?v=1&sub=all&model=${entry.model}&pattern=${encodeURIComponent(id)}&play=0&marks=0&phase=0.25`});
    await ready(page);
    const engineLine = await page.locator('#engine-label').textContent();
    assert.match(engineLine, new RegExp(`${entry.N}² × ${entry.M}\\b`), `the engine line names this orbit's grid and frame count (${engineLine})`);
    assert.match(engineLine, new RegExp(`T ${entry.period.toFixed(2)}`), 'and its own period');
    const equation = await page.locator('#equation-description').textContent();
    assert.ok(equation.trim().length > 10, 'the equation is written out');
    assert.equal(equation.trim(), (catalog.models[entry.model].equation ?? '').trim(), 'and it is this equation, from the catalog’s models table');
    const values = await page.locator('#parameter-values').textContent();
    for (const name of catalog.models[entry.model].parameters ?? []) {
      assert.ok(values.includes(catalog.models[entry.model].labels?.[name] ?? name), `the readout names ${name}`);
    }
    assert.deepEqual(errors, [], 'console');
    await context.close();
    notes.push(`       ${kind} ${id}: ${entry.modelName} at ${entry.N}² × ${entry.M}, T ${entry.period.toFixed(2)}`);
  });
}

// ---- 5b · step 3 tells the saved parameter sets apart -----------------------

await section('every equation’s parameter sets are distinguishable, and the plane moves', async () => {
  // One group per (colouring, equation): the one holding the most entries. The
  // chooser must never print the same line twice — λ–ω holds λ₀ and λ₁ fixed at
  // 1 in every admitted orbit, so a chooser naming a model's first two
  // parameters would list four identical sets — and the parameter plane must be
  // drawn against dials that actually differ, or not at all.
  const combos = new Map();
  for (const entry of catalog.all()) {
    const key = `${entry.kind}|${entry.model}`;
    const groups = combos.get(key) ?? new Map();
    groups.set(entry.groupId, (groups.get(entry.groupId) ?? 0) + 1);
    combos.set(key, groups);
  }
  let planes = 0, strips = 0;
  for (const [key, groups] of combos) {
    const [kind, model] = key.split('|');
    const groupId = [...groups.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const {context, page, errors} = await open(`colour/${kind}/`, {hash: `#${groupId}?v=1&sub=all&model=${model}&play=0&marks=0&phase=0.25`});
    await ready(page);
    const step = await page.evaluate(() => ({
      options: [...document.querySelectorAll('#parameter-set option')].map(option => option.textContent),
      hidden: document.getElementById('parameter-map').parentElement.hidden,
      aria: document.getElementById('parameter-map').getAttribute('aria-label') ?? '',
      model: document.querySelector('#equations .equation[aria-pressed="true"]')?.dataset.model,
    }));
    assert.equal(step.model, model, `the equation pill for ${model} is the pressed one`);
    assert.ok(step.options.length, `${key} lists its saved parameter sets`);
    assert.equal(new Set(step.options).size, step.options.length,
      `${key} on ${groupId} names each saved set differently (${JSON.stringify(step.options)})`);
    if (!step.hidden) {
      assert.match(step.aria, /sets, (?:along .+ alone|.+ versus .+)\./, `the plane says what it is drawn against (${step.aria})`);
      if (/ alone\./.test(step.aria)) strips++; else planes++;
    }
    assert.deepEqual(errors, [], `console on ${key}`);
    await context.close();
  }
  notes.push(`       ${combos.size} colouring × equation pairs · ${planes} planes · ${strips} one-dial strips`);
});

// ---- 6 · the endless camera, and the link that carries it ------------------

await section('a shared link restores the camera a drag left behind', async () => {
  const {context, page, errors} = await open('colour/gyre/', {hash: '#g248?v=1&sub=all&framing=endless&play=0&marks=0&phase=0.125'});
  await ready(page);
  const box = await page.locator('#pattern').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 90, box.y + box.height / 2 + 40, {steps: 10});
  await page.mouse.up();
  await page.waitForTimeout(900); // let any glide finish and the hash settle
  const shared = await page.evaluate(() => location.hash);
  const before = await page.evaluate(() => {
    const parameters = new URLSearchParams(location.hash.slice(location.hash.indexOf('?') + 1));
    return [Number(parameters.get('x')), Number(parameters.get('y')), Number(parameters.get('scale')), Number(parameters.get('angle') ?? 0)];
  });
  await page.reload({waitUntil: 'domcontentloaded'});
  await ready(page);
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => {
    const parameters = new URLSearchParams(location.hash.slice(location.hash.indexOf('?') + 1));
    return [Number(parameters.get('x')), Number(parameters.get('y')), Number(parameters.get('scale')), Number(parameters.get('angle') ?? 0)];
  });
  assert.ok(Math.abs(before[0] - after[0]) * before[2] < 0.5, `the shared centre survives a reload (${shared})`);
  assert.ok(Math.abs(before[1] - after[1]) * before[2] < 0.5, 'in both axes');
  assert.ok(Math.abs(before[2] - after[2]) < 0.5, 'and so does the zoom');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// ---- 7 · the generator marks ------------------------------------------------

await section('generator marks appear wherever the catalog carries them', async () => {
  const withMarks = catalog.all().find(entry => entry.generators?.length);
  if (!withMarks) {
    // The catalog does not yet publish `entry.generators`. The contract the page
    // holds to in the meantime is that it draws NOTHING rather than guessing.
    const {context, page, errors} = await open('colour/gyre/');
    await ready(page);
    assert.equal(await page.locator('#marks .cc-marker, #marks .cc-translation').count(), 0, 'no marks are invented when the catalog has none');
    assert.ok(await page.locator('#show-marks').isDisabled(), 'and the marks checkbox says so');
    assert.deepEqual(errors, [], 'console');
    await context.close();
    notes.push('       skipped: no entry in the catalog carries `generators` yet');
    return;
  }
  // Both colourings, and both origins: an atlas orbit and one the equation
  // search found. The marks are read off `entry.generators` and nothing else,
  // so a Sel'kov orbit on a 36² grid must mark up exactly as a Gray–Scott one
  // on 96² does.
  const sample = [];
  for (const kind of ['gyre', 'trefoil']) {
    const marked = catalog.all(kind).filter(entry => entry.generators?.length);
    assert.ok(marked.length, `the catalog carries ${kind} marks`);
    for (const origin of ['atlas', 'record']) {
      const pick = marked.find(entry => entry.origin === origin && entry.model !== 'gray-scott')
        ?? marked.find(entry => entry.origin === origin);
      if (pick && !sample.includes(pick)) sample.push(pick);
    }
  }
  for (const entry of sample) {
    const {context, page, errors} = await open(`colour/${entry.kind}/`, {
      hash: `#${entry.groupId}?v=1&sub=all&pattern=${encodeURIComponent(entry.id)}&marks=1&play=0&phase=0`,
    });
    await ready(page);
    await page.waitForTimeout(250);
    const drawn = await page.locator('#marks .cc-marker, #marks .cc-translation').count();
    assert.ok(drawn >= entry.generators.length, `${entry.id}: every generator is drawn at least once (${drawn} for ${entry.generators.length})`);
    const perms = await page.$$eval('#marks .cc-marker, #marks .cc-translation', nodes => nodes.map(node => node.dataset.perm));
    for (const item of entry.generators) assert.ok(perms.includes(item.perm.join('')), `${entry.id}: the chip for ${item.name} carries the catalog's permutation`);
    const caption = await page.locator('#generator-description').textContent();
    assert.match(caption, /node-frames, 0 violations\.$/, `${entry.id}: the caption quotes the measured violations (${caption})`);
    assert.ok(!/not yet in the catalog/.test(caption), `${entry.id}: the caption is the marks' own reading, not the fallback`);
    assert.deepEqual(errors, [], `console on ${entry.id}`);
    await context.close();
  }
  notes.push(`       marks drawn for ${sample.map(entry => `${entry.kind}/${entry.model} (${entry.origin}, ${entry.N}²)`).join(', ')}`);

  const kind = withMarks.kind;
  const {context, page, errors} = await open(`colour/${kind}/`, {
    hash: `#${withMarks.groupId}?v=1&sub=all&pattern=${encodeURIComponent(withMarks.id)}&marks=1&play=0&phase=0`,
  });
  await ready(page);
  await page.waitForTimeout(250);
  // G toggles the layer, and zooming far out hides it.
  await page.keyboard.press('g');
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#marks').evaluate(node => node.style.display), 'none', 'G hides the marks');
  await page.keyboard.press('g');
  await page.waitForTimeout(150);
  assert.notEqual(await page.locator('#marks').evaluate(node => node.style.display), 'none', 'and brings them back');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// ---- 7b · the export carries the tables its entry indexes -------------------

await section('the exported record can be read without the catalog', async () => {
  const entry = catalog.all('trefoil').find(item => item.origin === 'record') ?? catalog.all('trefoil')[0];
  const {context, page, errors} = await open('colour/trefoil/', {
    hash: `#${entry.groupId}?v=1&sub=all&pattern=${encodeURIComponent(entry.id)}&play=0&marks=0&phase=0`,
  });
  await ready(page);
  const download = page.waitForEvent('download');
  await page.locator('#export').click();
  const file = await download;
  const payload = JSON.parse(await new Response(await file.createReadStream()).text());
  assert.equal(payload.schema, 'colour-verified-orbit-export-v1');
  assert.equal(payload.entry.id, entry.id, 'the entry itself is in the file');
  assert.equal(payload.field.valueCount, entry.valueCount, 'and every saved value of the field');
  assert.equal(payload.field.encoding, 'base64-float32-le');
  assert.equal(payload.field.sha256, entry.fieldSha256);
  // The sha the file carries is checkable against the bytes the file carries.
  const bytes = Buffer.from(payload.field.base64, 'base64');
  assert.equal(bytes.length, 4 * entry.valueCount, 'the decoded field is float32 of the right length');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  assert.equal([...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join(''), entry.fieldSha256,
    'and hashes to the sha256 the entry names');
  assert.ok(payload.catalog.shape?.symmetryRow, 'the convention for reading a symmetry row travels with it');
  // The hoisted tables: an entry alone carries indices, not sentences.
  assert.ok(payload.catalog.models[entry.model]?.equation, 'the equation it was solved from travels with it');
  assert.ok(payload.catalog.colourings[entry.kind]?.rule, 'and the colour law');
  for (const failure of payload.entry.failures ?? []) {
    if (failure.what) continue;
    assert.ok(payload.catalog.failureLabels[failure.label], `failure label ${failure.label} resolves inside the file`);
  }
  for (const sym of payload.entry.symmetries ?? []) {
    assert.ok(sym.name === '1' || payload.catalog.pointOps[sym.name], `the point operation ${sym.name} resolves inside the file`);
  }
  assert.deepEqual(errors, [], 'console');
  await context.close();
  notes.push(`       exported ${entry.id}: ${payload.field.valueCount} values as ${payload.field.encoding}, ${payload.entry.symmetries.length} measured symmetries`);
});

// ---- 8 · the Notation panel -------------------------------------------------

await section('the Notation panel opens, and closes', async () => {
  for (const kind of ['gyre', 'trefoil']) {
    const {context, page, errors} = await open(`colour/${kind}/`);
    await ready(page);
    assert.ok(await page.locator('#notation').isHidden(), 'it is closed by default on an explorer page');
    await page.locator('#notation-open').click();
    await page.waitForTimeout(120);
    assert.ok(await page.locator('#notation').isVisible(), 'the Notation button opens it');
    assert.equal(await page.locator('#notation-open').getAttribute('aria-expanded'), 'true');
    assert.ok(await page.locator('#notation .cc-anatomy').count() >= 1, 'the anatomy diagram is in it');
    assert.ok((await page.locator('#notation').textContent()).includes('The violet clock'), 'and the four readings of a mark');
    // It is a region, not a dialog: the picture behind it stays live.
    assert.equal(await page.locator('#notation').getAttribute('role'), 'region');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
    assert.ok(await page.locator('#notation').isHidden(), 'Escape closes it');
    await page.keyboard.press('n');
    await page.waitForTimeout(120);
    assert.ok(await page.locator('#notation').isVisible(), 'and N reopens it');
    await page.screenshot({path: `${shots}/colour-${kind}-notation-${engine}.png`, fullPage: false});
    assert.deepEqual(errors, [], 'console');
    await context.close();
  }
});

// ---- 9 · the phone layout ----------------------------------------------------

await section('the phone layout has no horizontal scroll and reads in order', async () => {
  for (const path of ['colour/', 'colour/gyre/', 'colour/trefoil/']) {
    const {context, page, errors} = await open(path, {width: 390, height: 844, dpr: 3, mobile: true});
    if (path !== 'colour/') await ready(page);
    else await page.waitForSelector('.family-card');
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(overflow, 0, `${path} at 390 px: scrollWidth === clientWidth`);
    // Anything inside a clipping box — the SVG mark layer, the canvas wrapper,
    // a horizontally scrolling table — is allowed past the edge; it is clipped
    // there and cannot widen the page. Everything else must fit.
    const wide = await page.evaluate(() => [...document.querySelectorAll('main *')]
      .filter(node => !node.closest('svg, .canvas-wrap, .table-scroll'))
      .filter(node => node.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
      .slice(0, 4).map(node => `${node.tagName}.${node.getAttribute('class') ?? ''}`));
    assert.deepEqual(wide, [], `${path}: nothing reaches past the right edge`);
    if (path !== 'colour/') {
      // The picture, then the ladder 1 → 2 → 3 → 4, then the evidence. On a
      // phone there is no second column, so putting the four rungs first buried
      // the first frame of the film 2,700 px down the page; the reader now
      // meets the thesis, what is showing, and the film, and then the rungs
      // that change it. Tab order stays the DOM's, which is the ladder's.
      const order = await page.evaluate(() => {
        const top = selector => { const n = document.querySelector(selector); return n ? n.getBoundingClientRect().top + scrollY : NaN; };
        return {
          header: top('.family-page-header'), showing: top('.selected'), viewer: top('.canvas-wrap'),
          step1: top('#variants'), step2: top('#equations'), step3: top('#parameter-set'),
          step4: top('#pattern-thumbnails'), record: top('.symmetry-record'), policy: top('.solution-policy'),
        };
      });
      assert.ok(order.header < order.showing, 'the page’s thesis first');
      assert.ok(order.showing < order.viewer, 'then what is showing');
      assert.ok(order.viewer < order.step1, 'then the picture, above the ladder');
      assert.ok(order.step1 < order.step2, 'step 1 before step 2');
      assert.ok(order.step2 < order.step3, 'step 2 before step 3');
      assert.ok(order.step3 < order.step4, 'step 3 before step 4');
      assert.ok(order.step4 < order.record, 'and the evidence after the chooser');
      assert.ok(order.record < order.policy, 'with the policy note last');
      // A regression guard on the one number the reorder exists for.
      assert.ok(order.viewer < 1100, `${path}: the film is within about a screen of the top (${Math.round(order.viewer)} px)`);
      // Tab order is the ladder's, not the page's: the controls come first in
      // the DOM on every width.
      const tabs = await page.evaluate(() => {
        const order = [...document.querySelectorAll('#equations .equation, #parameter-set, #pattern-thumbnails button, #pattern, .symmetry-record summary')];
        const at = selector => order.indexOf(document.querySelector(selector));
        return {step2: at('#equations .equation'), step3: at('#parameter-set'), canvas: at('#pattern'), evidence: at('.symmetry-record summary')};
      });
      assert.ok(tabs.step2 < tabs.step3 && tabs.step3 < tabs.canvas && tabs.canvas < tabs.evidence,
        `tab order is 2 → 3 → the viewer → the evidence (${JSON.stringify(tabs)})`);
      // The stacked-card form of the symmetry table, not four slivers.
      const stacked = await page.evaluate(() => getComputedStyle(document.querySelector('#symmetry-rows tr')).display);
      assert.equal(stacked, 'block', 'the symmetry table is the stacked-card form');
    }
    assert.deepEqual(errors, [], `${path} console`);
    await context.close();
  }
});

// ---- 9b · a lost WebGL context is reported, not hidden ----------------------

await section('a lost graphics context shows the error state and can be retried', async () => {
  // A GPU-process recycle is routine when a tab is backgrounded on Android or
  // iOS. Without a listener the canvas went flat black while #status still read
  // "ready", the engine line still named a backend, and the marks kept drawing
  // over the black.
  if (engine !== 'chromium') { notes.push('       skipped on WebKit: no WEBGL_lose_context handle'); return; }
  const {context, page, errors} = await open('colour/gyre/', {hash: '#g247?v=1&sub=all&play=0&marks=1&phase=0'});
  await ready(page);
  const lost = await page.evaluate(() => {
    const gl = document.querySelector('#pattern').getContext('webgl2');
    const handle = gl?.getExtension('WEBGL_lose_context');
    if (!handle) return false;
    handle.loseContext();
    return true;
  });
  if (!lost) { notes.push('       skipped: WEBGL_lose_context unavailable'); await context.close(); return; }
  await page.waitForTimeout(400);
  const state = await page.evaluate(() => ({
    emptyHidden: document.getElementById('empty-state').hidden,
    retryHidden: document.getElementById('retry-animation').hidden,
    status: document.getElementById('status').textContent,
    marks: document.getElementById('marks').style.display,
    ready: document.querySelector('#pattern').dataset.ready ?? null,
  }));
  assert.equal(state.emptyHidden, false, 'the error state is shown');
  assert.equal(state.retryHidden, false, 'with a Retry button');
  assert.match(state.status, /graphics context was lost/i, 'and the status says what happened');
  assert.equal(state.marks, 'none', 'the marks are not left drawn over a blank canvas');
  assert.equal(state.ready, null, 'and the readiness flag is cleared');
  // Retry starts from a fresh canvas element, because a lost context is never
  // handed back alive by getContext.
  await page.locator('#retry-animation').click();
  await ready(page);
  assert.ok(await page.locator('#empty-state').isHidden(), 'Retry brings the animation back');
  assert.deepEqual(errors.filter(text => !/WEBGL_lose_context|context lost/i.test(text)), [], 'console');
  await context.close();
});

// ---- 9c · Back undoes a selection -------------------------------------------

await section('Back undoes a ladder selection instead of leaving the page', async () => {
  const {context, page, errors} = await open('colour/gyre/', {hash: '#g247?v=1&sub=all&play=0&marks=0&phase=0'});
  await ready(page);
  const group = () => page.locator('#variants .group[aria-pressed="true"]').getAttribute('data-group-id');
  const first = await group();
  const other = await page.locator(`#variants .group:not(.is-empty)[aria-pressed="false"]`).first().getAttribute('data-group-id');
  await page.locator(`#variants .group[data-group-id="${other}"]`).click();
  await ready(page);
  assert.equal(await group(), other, 'the second group is selected');
  await page.goBack();
  await ready(page);
  assert.equal(await group(), first, 'Back returns to the first group');
  assert.match(await page.evaluate(() => location.pathname), /colour\/gyre\/$/, 'and stays on the page');
  await page.goForward();
  await ready(page);
  assert.equal(await group(), other, 'Forward redoes it');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

// ---- 9d · the entry's own colour group, and where a rotation turns ----------

await section('the page prints the measured colour group and the real turn centre', async () => {
  // Π is the entry's, not the colouring's: 12 of the 200 Gyre entries measure
  // S3, and the header used to say Z3 while the table footer said S3.
  const split = catalog.all('gyre').find(entry => entry.colourGroup !== 'Z3');
  const plain = catalog.all('gyre').find(entry => entry.colourGroup === 'Z3');
  for (const entry of [split, plain].filter(Boolean)) {
    const {context, page, errors} = await open('colour/gyre/', {
      hash: `#${entry.groupId}?v=1&sub=all&pattern=${encodeURIComponent(entry.id)}&play=0&marks=0&phase=0`,
    });
    await ready(page);
    const want = entry.colourGroup === 'S3' ? 'S₃' : 'Z₃';
    assert.equal((await page.locator('#selected-title').textContent()).trim(), want, `${entry.id}: the header names the measured colour group`);
    assert.match(await page.locator('#group-label').textContent(), new RegExp(`Π = ${want}$`), `${entry.id}: and so does the pill`);
    assert.match(await page.locator('#symmetry-foot').textContent(), new RegExp(`Colour group Π = ${want}`), `${entry.id}: and the table footer agrees`);
    // A rotation row names the fixed point of x ↦ M x + v/N, not v itself.
    const rows = await page.$$eval('#symmetry-rows tr.exact .sym-symbol', nodes => nodes.map(node => node.textContent));
    const ops = catalog.pointOps;
    for (const sym of entry.symmetries) {
      const M = ops[sym.name];
      if (sym.name === '1' || !M) continue;
      const a = 1 - M[0][0], b = -M[0][1], c = -M[1][0], d = 1 - M[1][1], det = a * d - b * c;
      if (!det) continue;
      const mod1 = value => ((value % 1) + 1) % 1;
      const p = [mod1((d * sym.v[0] - b * sym.v[1]) / det / entry.N), mod1((-c * sym.v[0] + a * sym.v[1]) / det / entry.N)];
      const text = `${sym.name} about (${p[0].toFixed(3)}, ${p[1].toFixed(3)})`;
      if (rows.includes(text)) {
        // Whatever v is, the printed centre is fixed by the row's own map.
        const back = [M[0][0] * p[0] + M[0][1] * p[1] + sym.v[0] / entry.N, M[1][0] * p[0] + M[1][1] * p[1] + sym.v[1] / entry.N];
        assert.ok(Math.abs(mod1(back[0]) - p[0]) < 2e-3 && Math.abs(mod1(back[1]) - p[1]) < 2e-3,
          `${entry.id}: the printed centre of ${sym.name} is fixed by the row's own map`);
      }
    }
    // The sample covers every point operation that occurs before it repeats one.
    const shown = await page.$$eval('#symmetry-rows tr.exact .sym-symbol', nodes => nodes.map(node => node.textContent.split(/[ ,]/)[0]));
    const occurring = new Set(entry.symmetries.map(sym => sym.name));
    if (entry.symmetries.length > shown.length) {
      const seen = new Set(shown.map(text => (text === 'the' || text === 'slide' ? '1' : text)));
      assert.equal(seen.size, occurring.size, `${entry.id}: the shown rows cover every point operation (${[...seen]} vs ${[...occurring]})`);
      assert.match(await page.locator('#symmetry-more').textContent(), /at least one for each of the/, 'and the note says so rather than claiming products');
    }
    assert.deepEqual(errors, [], `console on ${entry.id}`);
    await context.close();
  }
  notes.push(`       colour group checked on ${[split, plain].filter(Boolean).map(entry => `${entry.id} (${entry.colourGroup})`).join(', ')}`);
});

// ---- 9e · the refusal block carries numbers, not ellipses -------------------

await section('every refusal reason states its figures', async () => {
  for (const kind of ['gyre', 'trefoil']) {
    const {context, page, errors} = await open(`colour/${kind}/`, {hash: `#?v=1&sub=all&play=0&marks=0`});
    await ready(page);
    // The build record is fetched when the block is opened and not before, so
    // a reader who never opens it never pays the 253 kB.
    const beforeOpen = await page.locator('#refusal-list li').count();
    assert.equal(beforeOpen, 0, `${kind}: the refusal list is not built until it is opened`);
    await page.locator('#refusals summary').click();
    await page.waitForFunction(() => document.querySelectorAll('#refusal-list li').length > 0, null, {timeout: 15000});
    const items = await page.$$eval('#refusal-list li', nodes => nodes.map(node => node.textContent));
    assert.ok(items.length, `${kind} lists its refusals`);
    for (const text of items) assert.ok(!text.includes('…'), `${kind}: "${text.slice(0, 80)}" has no elided number`);
    notes.push(`       ${kind}: ${items.length} refusal reasons, e.g. ${items[0].slice(0, 90)}`);
    assert.deepEqual(errors, [], `console on ${kind}`);
    await context.close();
  }
});

// ---- 9f · a deep link is followed, never silently substituted ---------------

await section('a pattern in the link is followed even from another of its groups', async () => {
  // 47 entries sit in more than one film group. Asking for one by the group it
  // is NOT canonically filed under used to load a different pattern in silence.
  const multi = catalog.all().find(entry => entry.groupIds.length > 1);
  assert.ok(multi, 'the catalog has an entry in more than one film group');
  for (const groupId of multi.groupIds) {
    const {context, page, errors} = await open(`colour/${multi.kind}/`, {
      hash: `#${groupId}?v=1&sub=all&pattern=${encodeURIComponent(multi.id)}&play=0&marks=0&phase=0`,
    });
    await ready(page);
    assert.match(decodeURIComponent(await page.evaluate(() => location.hash)), new RegExp(`pattern=${multi.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      `the link to ${multi.id} under ${groupId} loads that pattern`);
    assert.equal(await page.locator('#variants .group[aria-pressed="true"]').getAttribute('data-group-id'), groupId,
      'and stays in the group the link named');
    assert.deepEqual(errors, [], `console on ${groupId}`);
    await context.close();
  }
  // And a featured-only filter does not drop it either.
  const filtered = catalog.all('gyre').find(entry => !entry.featured);
  const {context, page, errors} = await open('colour/gyre/', {
    hash: `#${filtered.groupId}?v=1&sub=featured&pattern=${encodeURIComponent(filtered.id)}&play=0&marks=0&phase=0`,
  });
  await ready(page);
  assert.match(decodeURIComponent(await page.evaluate(() => location.hash)), new RegExp(`pattern=${filtered.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    'a link to an entry the filter excludes widens the filter rather than dropping it');
  assert.deepEqual(errors, [], 'console');
  await context.close();
  notes.push(`       followed ${multi.id} in ${multi.groupIds.join(' and ')}, and ${filtered.id} past the featured filter`);
});

// ---- 10 · reduced motion -----------------------------------------------------

await section('prefers-reduced-motion opens paused', async () => {
  const context = await browser.newContext({viewport: {width: 1000, height: 900}, reducedMotion: 'reduce'});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('colour/gyre/', base).href, {waitUntil: 'domcontentloaded'});
  await ready(page);
  await page.waitForTimeout(300);
  assert.equal((await page.locator('#play').textContent()).trim(), '▶ Play', 'the page opens paused');
  assert.match(await page.evaluate(() => location.hash), /play=0/, 'and says so in the link');
  assert.deepEqual(errors, [], 'console');
  await context.close();
});

await browser.close();
console.log(`colour pages — ${label}`);
console.log(notes.join('\n'));
if (failures) { console.error(`${failures} section(s) failed`); process.exit(1); }
console.log('all sections passed');
