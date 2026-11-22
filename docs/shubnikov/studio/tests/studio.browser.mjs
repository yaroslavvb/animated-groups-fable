// The Studio in a real browser: what the hand does, and whether the pixels are
// the film the arithmetic describes.
//
// Three kinds of check:
//   - the picture: the canvas is read back and compared, pixel by sampled
//     pixel, with studio-core.mjs evaluated in the page; then the group's law
//     is checked on the pixels alone — the frame a quarter loop on is the same
//     picture turned a quarter turn, the frame half a loop on is its negative;
//   - the hand: select by clicking a copy, drag it (a drag on a turned copy
//     moves the shape the turned way), handles, sliders, undo, the keyboard;
//   - the page: links carry the design, the dialogs, another class, a phone.
//
// Usage: node docs/shubnikov/studio/tests/studio.browser.mjs [base-url] [label]
//
//        PLAYWRIGHT_MODULE=…  where to import Playwright from
//        CHROME=…             a Chrome binary, when the `chrome` channel is absent
//        BROWSER=webkit       run in Playwright's WebKit instead
//        SHOT_DIR=…           write screenshots there
//        VERBOSE=1            print stacks for failures
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const runtime = `${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/`;
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? `${runtime}playwright/index.mjs`);
const base = (process.argv[2] ?? 'http://localhost:8936/').replace(/\/?$/, '/');
const label = process.argv[3] ?? 'local';
const shots = process.env.SHOT_DIR ?? null;
if (shots) mkdirSync(shots, { recursive: true });
const url = (path = '') => new URL(`shubnikov/studio/${path}`, base).href;

console.log(`studio — ${label} (${base})`);

let failures = 0;
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

const engine = process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
let browser;
if (engine === 'webkit') browser = await playwright.webkit.launch({ headless: true });
else {
  const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  try {
    browser = await playwright.chromium.launch({ channel: 'chrome', headless: true });
  } catch {
    browser = await playwright.chromium.launch(existsSync(chrome) ? { executablePath: chrome, headless: true } : { headless: true });
  }
}

async function open(path = '', { width = 1440, height = 900, mobile = false } = {}) {
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => errors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`));
  page.on('response', (res) => { if (res.status() >= 400 && !res.url().endsWith('favicon.ico')) errors.push(`${res.status()} ${res.url()}`); });
  await page.goto(url(path), { waitUntil: 'load' });
  await page.waitForSelector('main.studio[aria-busy="false"]', { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__studio), null, { timeout: 60000 });
  return { context, page, errors };
}
const clean = (errors) => assert.equal(errors.length, 0, `console is clean:\n  ${errors.slice(0, 5).join('\n  ')}`);
const shoot = async (page, name) => { if (shots) await page.screenshot({ path: join(shots, `${name}.png`) }); };

// ---- page-side helpers (self-contained: they are serialised into the page) ----

/** Draw the film at time t and compare sampled pixels with the arithmetic. */
const comparePixels = ({ t, grid }) => {
  const s = window.__studio;
  const size = 360;
  const canvas = s.renderer.canvas;
  const span = 2.3;
  const view = { cx: 0.13, cy: -0.07, upp: span / size };
  const frame = (() => { const keep = s.state.t; s.state.t = t; const f = s.frame(); s.state.t = keep; return f; })();
  s.renderer.render(frame, view, { port: [0, 0, size, size], quality: 512, palette: 'bw' });
  const px = s.renderer.read(0, 0, size, size);
  let bad = 0, n = 0, grey = 0;
  const step = size / grid;
  for (let a = 0; a < grid; a++) {
    for (let b = 0; b < grid; b++) {
      const i = Math.floor((a + 0.5) * step), j = Math.floor((b + 0.5) * step);
      const X = view.cx + (i + 0.5 - size / 2) * view.upp, Y = view.cy + (j + 0.5 - size / 2) * view.upp;
      const at = s.inkAt(X, Y, t);
      const lum = px[4 * (j * size + i)];
      if (at.ink === 0) {
        // ground nothing claims: grey, away from any stamp's or inverter's outline
        if (at.A > -0.015 || Math.abs(at.I) < 0.015 || Math.abs(at.G) > 1e-9) continue;
        n += 1; grey += 1;
        if (lum < 100 || lum > 156) bad += 1;
        continue;
      }
      if (at.margin < 0.02) continue;
      n += 1;
      if ((lum > 127 ? 1 : -1) !== at.ink) bad += 1;
    }
  }
  s.state.needsDraw = true;
  return { bad, n, grey, mode: s.renderer.mode };
};

/** The law in pixels: turn the frame at t, or take its negative, and compare with a later frame. */
const lawInPixels = ({ t }) => {
  const s = window.__studio;
  const size = 300, span = 2.2;
  const view = { cx: 0, cy: 0, upp: span / size };
  const shot = (time) => {
    const keep = s.state.t; s.state.t = time; const f = s.frame(); s.state.t = keep;
    s.renderer.render(f, view, { port: [0, 0, size, size], quality: 768, palette: 'bw' });
    return s.renderer.read(0, 0, size, size);
  };
  const a = shot(t), quarter = shot(t + 0.25), half = shot(t + 0.5);
  let turned = 0, negative = 0, same = 0, n = 0;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const v = a[4 * (j * size + i)];
      if (v > 40 && v < 215) continue;          // an edge pixel: it is a blend
      n += 1;
      // a quarter turn counter-clockwise about the middle carries (i, j) to (size-1-j, i)
      const q = quarter[4 * (i * size + (size - 1 - j))];
      if (Math.abs(q - v) > 90) turned += 1;
      if (Math.abs(half[4 * (j * size + i)] - (255 - v)) > 90) negative += 1;
      if (Math.abs(quarter[4 * (j * size + i)] - v) < 90) same += 1;
    }
  }
  s.state.needsDraw = true;
  return { n, turned, negative, same };
};

/** The handles drawn for the selection, in CSS pixels of the film, once a frame has been drawn. */
const readHandles = () => new Promise((resolve) => {
  const s = window.__studio;
  s.state.needsDraw = true;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const dpr = s.renderer.canvas.width / s.renderer.canvas.clientWidth;
    resolve(s.state.handles.map((h) => ({ kind: h.kind, k: h.k, x: h.x / dpr, y: h.y / dpr })));
  }));
});

const designState = () => {
  const s = window.__studio.state;
  return {
    layers: s.design.L.map((l) => ({ id: l.id, k: l.k, role: l.role, sh: l.sh, at: l.at, r: l.r, th: l.th, mv: l.mv, off: l.off })),
    sel: s.sel, grab: s.grab, undo: s.undo.length, redo: s.redo.length, playing: s.playing, t: s.t, cls: s.classId,
    vanish: [...s.vanish.entries()],
  };
};

/** Where on the page a copy of a layer is: {x, y} in CSS pixels, with its element and lattice step. */
const findCopy = ({ layerIndex, wantJ }) => {
  const s = window.__studio;
  const frame = s.frame();
  const layer = s.state.design.L[layerIndex];
  const shape = frame.shapes.find((sh) => sh.layer.id === layer.id);
  const rect = document.querySelector('#overlay').getBoundingClientRect();
  const P = s.state.group.P;
  let best = null;
  for (const copy of shape.copies) {
    if (wantJ !== null && copy.j !== wantJ) continue;
    for (let a = -3; a <= 3; a++) {
      for (let b = -3; b <= 3; b++) {
        const X = copy.ox + P[0][0] * a + P[0][1] * b, Y = copy.oy + P[1][0] * a + P[1][1] * b;
        const [sx, sy] = s.toScreen(X, Y);
        if (sx < 60 || sy < 70 || sx > rect.width - 60 || sy > rect.height - 60) continue;
        // not under another shape's copy, and not near this one's handles
        const d = Math.hypot(sx - rect.width / 2, sy - rect.height / 2);
        if (!best || d < best.d) best = { d, x: rect.left + sx, y: rect.top + sy, j: copy.j, m: [a, b], Mc: s.state.group.elements[copy.j].Mc };
      }
    }
  }
  return best;
};

// -------------------------------------------------------------------- checks --

await section('the page loads, draws with the cell renderer, and says what class it is in', async () => {
  const { context, page, errors } = await open('?paused=1&t=0.2');
  const info = await page.evaluate(() => ({
    mode: window.__studio.renderer.mode,
    chip: document.querySelector('#class-chip').textContent,
    layers: document.querySelectorAll('#layers li').length,
    rules: document.querySelectorAll('#group-card li').length,
    strip: document.querySelectorAll('#strip canvas').length,
    title: document.title,
    hidden: [...document.querySelectorAll('#export-menu, #fallback, #empty')].map((el) => getComputedStyle(el).display),
  }));
  assert.equal(info.chip, 'g95-n2-3');
  assert.ok(info.layers >= 1, 'the opening design has layers');
  assert.ok(info.rules >= 2, 'the class card states its rules');
  assert.equal(info.strip, 8);
  assert.deepEqual(info.hidden, ['none', 'none', 'none'], 'menus and notices start hidden');
  note(`renderer: ${info.mode}`);
  await shoot(page, 'desktop');
  clean(errors);
  await context.close();
});

for (const [name, path] of [['the opening design', '?paused=1'], ['stamps on a wave', '?paused=1#p=stars'], ['inverters', '?paused=1#p=lenses'],
  ['a path, and a soft flood', '?paused=1#p=courier'], ['soft floods', '?paused=1#p=dunes'], ['the census film', '?paused=1#p=census'], ['the single-pass renderer', '?paused=1&renderer=direct#p=stars']]) {
  await section(`pixels are the arithmetic: ${name}`, async () => {
    const { context, page, errors } = await open(path);
    let total = 0, bad = 0;
    for (const t of [0.05, 0.31, 0.62, 0.9]) {
      const r = await page.evaluate(comparePixels, { t, grid: 40 });
      total += r.n; bad += r.bad;
      if (path.includes('direct')) assert.equal(r.mode, 'direct');
    }
    assert.ok(total > 2500, `enough pixels compared (${total})`);
    assert.equal(bad, 0, `${bad} of ${total} sampled pixels disagree`);
    clean(errors);
    await context.close();
  });
}

await section('the law, read off the pixels: a quarter loop turns the picture, half a loop is its negative', async () => {
  for (const path of ['?paused=1', '?paused=1#p=sawblade', '?paused=1#p=windmill', '?paused=1#p=lenses', '?paused=1#p=stars']) {
    const { context, page, errors } = await open(path);
    const r = await page.evaluate(lawInPixels, { t: 0.137 });
    assert.ok(r.n > 60000, 'most pixels are flat ink');
    assert.ok(r.turned < 0.004 * r.n, `${path}: ${r.turned} of ${r.n} pixels break the quarter-turn law`);
    assert.ok(r.negative < 0.004 * r.n, `${path}: ${r.negative} of ${r.n} pixels break the half-loop law`);
    // and it is a law, not an accident: unturned, the later frame is a different picture
    assert.ok(r.same < 0.9 * r.n, `${path}: the film moves`);
    clean(errors);
    await context.close();
  }
});

await section('click a copy to select the shape; drag a turned copy and the shape moves the turned way', async () => {
  // t = 0.7: the star is there for half the loop, and both copies wanted are in theirs
  const { context, page, errors } = await open('?paused=1&t=0.7#p=stars');
  const layerIndex = 2;                              // the star stamp
  const before = await page.evaluate(designState);
  // a copy made by a quarter turn, so the drag has to be carried back through it
  const copy = await page.evaluate(findCopy, { layerIndex, wantJ: null });
  const turned = await page.evaluate(findCopy, { layerIndex, wantJ: (await page.evaluate(() => window.__studio.state.group.elements.findIndex((e) => e.M[0][0] === 0 && e.M[0][1] === -1 && e.M[1][0] === 1 && Math.abs(e.tau - 0.25) < 1e-9))) });
  assert.ok(copy && turned, 'copies of the star are on screen');
  await page.mouse.click(turned.x, turned.y);
  let now = await page.evaluate(designState);
  assert.equal(now.sel, before.layers[layerIndex].id, 'the click selected the star');
  assert.equal(now.grab.j, turned.j, 'through the copy that was clicked');
  assert.ok(await page.locator('#inspector h3').innerText().then((text) => /Star/.test(text)), 'the inspector shows it');
  const hud = await page.locator('#hud').innerText();
  assert.match(hud, /quarter turn/, `the status line says which copy this is ("${hud}")`);
  const dx = 46, dy = -30;
  await page.mouse.move(turned.x, turned.y);
  await page.mouse.down();
  await page.mouse.move(turned.x + dx / 2, turned.y + dy / 2, { steps: 4 });
  await page.keyboard.down('Alt');                 // no snapping: the arithmetic below is exact
  await page.mouse.move(turned.x + dx, turned.y + dy, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up('Alt');
  now = await page.evaluate(designState);
  const upp = await page.evaluate(() => { const s = window.__studio; const a = s.toWorld(0, 0), b = s.toWorld(1, 0); return b[0] - a[0]; });
  const world = [dx * upp, -dy * upp];
  // the seed moves by M^T (world displacement): a quarter turn back
  const expect = [turned.Mc[0][0] * world[0] + turned.Mc[1][0] * world[1], turned.Mc[0][1] * world[0] + turned.Mc[1][1] * world[1]];
  const moved = [now.layers[layerIndex].at[0] - before.layers[layerIndex].at[0], now.layers[layerIndex].at[1] - before.layers[layerIndex].at[1]];
  assert.ok(Math.hypot(moved[0] - expect[0], moved[1] - expect[1]) < 2.5 * upp, `moved by (${moved.map((v) => v.toFixed(4))}), expected (${expect.map((v) => v.toFixed(4))})`);
  assert.equal(now.undo, before.undo + 1, 'one drag is one undo step');
  await page.keyboard.press('Control+z');
  now = await page.evaluate(designState);
  assert.ok(Math.hypot(now.layers[layerIndex].at[0] - before.layers[layerIndex].at[0], now.layers[layerIndex].at[1] - before.layers[layerIndex].at[1]) < 1e-9, 'undo puts it back');
  await page.keyboard.press('Control+Shift+z');
  now = await page.evaluate(designState);
  assert.ok(Math.hypot(now.layers[layerIndex].at[0] - before.layers[layerIndex].at[0] - moved[0], now.layers[layerIndex].at[1] - before.layers[layerIndex].at[1] - moved[1]) < 1e-9, 'redo moves it again');
  // a click on the ground lets go
  await page.keyboard.press('Escape');
  assert.equal((await page.evaluate(designState)).sel, null);
  clean(errors);
  await context.close();
});

await section('a shape dropped by a rotation centre lands on it', async () => {
  const { context, page, errors } = await open('?paused=1&t=0.6#p=stars');
  const copy = await page.evaluate(findCopy, { layerIndex: 2, wantJ: 0 });
  await page.mouse.click(copy.x, copy.y);
  const target = await page.evaluate(() => {
    const s = window.__studio, layer = s.state.design.L[2];
    const rect = document.querySelector('#overlay').getBoundingClientRect();
    // the copy that is held, and where its anchor would have to go to sit on the 2-fold centre (1/2, 0)
    const st = s.frame().shapes.find((sh) => sh.layer.id === layer.id).copies.find((c) => c.j === 0);
    const lat = [0.5 + s.state.grab.m[0], 0 + s.state.grab.m[1]];
    const anchorNow = [layer.at[0] + s.state.grab.m[0], layer.at[1] + s.state.grab.m[1]];
    const [ax, ay] = s.toScreen(anchorNow[0], anchorNow[1]);
    const [tx, ty] = s.toScreen(lat[0], lat[1]);
    return { dx: tx - ax + 4, dy: ty - ay - 3, left: rect.left, top: rect.top, st: [st.ox, st.oy] };
  });
  await page.mouse.move(copy.x, copy.y);
  await page.mouse.down();
  await page.mouse.move(copy.x + target.dx, copy.y + target.dy, { steps: 6 });
  const hud = await page.locator('#hud').innerText();
  await page.mouse.up();
  const now = await page.evaluate(designState);
  const at = now.layers[2].at;
  assert.ok(Math.abs(at[0] - Math.round(at[0] * 2) / 2) < 1e-9 && Math.abs(at[1] - Math.round(at[1] * 2) / 2) < 1e-9, `the anchor snapped (${at})`);
  assert.match(hud, /rotation centre/);
  clean(errors);
  await context.close();
});

await section('the inspector: sliders keep the keyboard, roles and shapes change the film, the group cancels what it must', async () => {
  const { context, page, errors } = await open('?paused=1&t=0.2#p=turnstile');
  await page.locator('#layers li').first().click();
  let st = await page.evaluate(designState);
  assert.equal(st.sel, st.layers[0].id);
  const size = page.locator('#inspector label.field', { hasText: 'size' }).locator('input[type="range"]');
  await size.focus();
  const r0 = st.layers[0].r;
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  st = await page.evaluate(designState);
  assert.ok(st.layers[0].r > r0, 'arrow keys on the size slider grow the shape');
  assert.ok(await size.evaluate((el) => el === document.activeElement), 'and the slider still has the keyboard');
  assert.ok(st.undo >= 1);
  // a comma instead of a disc
  await page.locator('#inspector .shape-grid button[aria-label="Comma"]').click();
  st = await page.evaluate(designState);
  assert.equal(st.layers[0].sh, 'comma');
  // stamp it: with nothing for ground, the uncovered plane is grey
  await page.locator('#inspector .seg button', { hasText: 'Stamp' }).click();
  st = await page.evaluate(designState);
  assert.equal(st.layers[0].role, 's');
  assert.match(await page.locator('#layers-hint').innerText(), /grey/);
  const grey = await page.evaluate(comparePixels, { t: 0.2, grid: 30 });
  assert.ok(grey.grey > 100, 'unclaimed ground is drawn grey, and the arithmetic says so too');
  assert.equal(grey.bad, 0);
  // take its motion away: the group cancels it, and says so
  await page.locator('#inspector .seg button', { hasText: 'Flood' }).click();
  await page.locator('#inspector .move-head button').first().click();
  st = await page.evaluate(designState);
  assert.equal(st.layers[0].mv.length, 0);
  assert.equal(st.vanish[0][1], true, 'a still shape is cancelled');
  assert.ok(await page.locator('#layers li .flag').isVisible(), 'the layer is flagged');
  assert.ok(await page.locator('#inspector .warn').isVisible(), 'and the inspector says why');
  // a spin of half a turn would not help a comma; a full turn does
  await page.locator('#inspector .add-moves button', { hasText: 'Spin' }).click();
  st = await page.evaluate(designState);
  assert.equal(st.vanish[0][1], false, 'a comma turning once a loop is not cancelled');
  assert.ok(await page.locator('#inspector .warn').isHidden());
  clean(errors);
  await context.close();
});

await section('handles: the knob sets size and angle, the orbit handle its radius, path points drag', async () => {
  const { context, page, errors } = await open('?paused=1&t=0.2#p=courier');
  const rect = await page.locator('#overlay').boundingBox();
  // the disc with a path
  await page.locator('#layers li').first().click();
  let handles = await page.evaluate(readHandles);
  const kinds = new Set(handles.map((h) => h.kind));
  for (const kind of ['size', 'path', 'pathadd', 'pivot']) assert.ok(kinds.has(kind), `a ${kind} handle is drawn`);
  let st = await page.evaluate(designState);
  const pts0 = st.layers[0].mv[0].pts.map((p) => p.slice());
  const point = handles.find((h) => h.kind === 'path' && h.k === 1);
  await page.mouse.move(rect.x + point.x, rect.y + point.y);
  await page.mouse.down();
  await page.mouse.move(rect.x + point.x + 30, rect.y + point.y + 22, { steps: 5 });
  await page.mouse.up();
  st = await page.evaluate(designState);
  const pts1 = st.layers[0].mv[0].pts;
  assert.ok(Math.hypot(pts1[1][0] - pts0[1][0], pts1[1][1] - pts0[1][1]) > 0.02, 'the path point moved');
  assert.ok(Math.hypot(pts1[0][0] - pts0[0][0], pts1[0][1] - pts0[0][1]) < 1e-9, 'the others did not');
  // a small dot adds a point
  handles = await page.evaluate(readHandles);
  const add = handles.find((h) => h.kind === 'pathadd');
  await page.mouse.move(rect.x + add.x, rect.y + add.y);
  await page.mouse.down();
  await page.mouse.move(rect.x + add.x + 14, rect.y + add.y - 18, { steps: 4 });
  await page.mouse.up();
  st = await page.evaluate(designState);
  assert.equal(st.layers[0].mv[0].pts.length, pts0.length + 1, 'a point was added to the path');
  // the knob
  handles = await page.evaluate(readHandles);
  const knob = handles.find((h) => h.kind === 'size');
  const r0 = st.layers[0].r;
  await page.mouse.move(rect.x + knob.x, rect.y + knob.y);
  await page.mouse.down();
  await page.mouse.move(rect.x + knob.x + 26, rect.y + knob.y, { steps: 4 });
  await page.mouse.up();
  st = await page.evaluate(designState);
  assert.ok(Math.abs(st.layers[0].r - r0) > 0.01, 'the knob changed the size');
  // an orbit handle on another design
  await page.evaluate(() => { location.hash = '#p=turnstile'; });
  await page.waitForFunction(() => window.__studio.state.design.L.length === 1);
  await page.locator('#layers li').first().click();
  handles = await page.evaluate(readHandles);
  const orbit = handles.find((h) => h.kind === 'orbit');
  assert.ok(orbit, 'the orbit has a handle');
  const rad0 = (await page.evaluate(designState)).layers[0].mv[0].r;
  await page.mouse.move(rect.x + orbit.x, rect.y + orbit.y);
  await page.mouse.down();
  await page.mouse.move(rect.x + orbit.x + 40, rect.y + orbit.y, { steps: 5 });
  await page.mouse.up();
  const rad1 = (await page.evaluate(designState)).layers[0].mv[0].r;
  assert.ok(Math.abs(rad1 - rad0) > 0.03, `the orbit's radius changed (${rad0} -> ${rad1})`);
  await shoot(page, 'handles');
  clean(errors);
  await context.close();
});

await section('layers: add, duplicate, hide, remove; the keyboard', async () => {
  const { context, page, errors } = await open('?paused=1#p=turnstile');
  await page.locator('#add-shape').click();
  let st = await page.evaluate(designState);
  assert.equal(st.layers.length, 2);
  assert.equal(st.layers[1].role, 's', 'with a ground already there, a new shape is a stamp');
  assert.equal(st.sel, st.layers[1].id, 'and it is selected');
  await page.locator('#add-wave').click();
  st = await page.evaluate(designState);
  assert.equal(st.layers[2].k, 'w');
  await page.locator('#layers li').nth(1).click();
  await page.keyboard.press('d');
  st = await page.evaluate(designState);
  assert.equal(st.layers.length, 4, 'D duplicates');
  await page.locator('#layers li').nth(0).locator('button[aria-label="Hide layer"]').click();
  st = await page.evaluate(designState);
  assert.equal(st.layers[0].off, 1);
  await page.locator('#layers li').nth(2).click();
  await page.keyboard.press('Delete');
  st = await page.evaluate(designState);
  assert.equal(st.layers.length, 3, 'Delete removes the selected layer');
  assert.equal(st.playing, false);
  await page.locator('#overlay').hover({ position: { x: 5, y: 300 } });
  await page.keyboard.press('Space');
  assert.equal((await page.evaluate(designState)).playing, true, 'Space plays');
  await page.keyboard.press('Space');
  const t0 = (await page.evaluate(designState)).t;
  await page.keyboard.press('ArrowRight');
  const t1 = (await page.evaluate(designState)).t;
  assert.ok(Math.abs(((t1 - t0 + 1.5) % 1) - 0.5) < 0.012 && t1 !== t0, 'an arrow steps the loop');
  // double-click on the ground makes a shape there
  const n = (await page.evaluate(designState)).layers.length;
  await page.keyboard.press('Escape');
  const empty = await page.evaluate(() => {
    const s = window.__studio, rect = document.querySelector('#overlay').getBoundingClientRect();
    return { x: rect.left + 120, y: rect.top + rect.height - 140 };
  });
  await page.mouse.dblclick(empty.x, empty.y);
  assert.equal((await page.evaluate(designState)).layers.length, n + 1, 'a double-click on the ground adds a shape');
  clean(errors);
  await context.close();
});

await section('the address holds the design, and a fresh page opens the same film', async () => {
  const { context, page, errors } = await open('?paused=1#p=shuttle');
  await page.locator('#layers li').first().click();
  await page.locator('#inspector .seg button', { hasText: 'starts black' }).click();
  await page.waitForFunction(() => location.hash.startsWith('#d='));
  const href = await page.evaluate(() => location.href);
  const code = await page.evaluate(() => window.__studio.encode());
  assert.match(new URL(href).hash, /^#d=[A-Za-z0-9_-]+$/, 'only characters a link survives');
  const second = await context.newPage();
  await second.goto(href, { waitUntil: 'load' });
  await second.waitForSelector('main.studio[aria-busy="false"]');
  await second.waitForFunction(() => Boolean(window.__studio));
  assert.equal(await second.evaluate(() => window.__studio.encode()), code);
  const a = await page.evaluate(comparePixels, { t: 0.4, grid: 24 });
  const b = await second.evaluate(comparePixels, { t: 0.4, grid: 24 });
  assert.equal(a.bad + b.bad, 0);
  clean(errors);
  await context.close();
});

await section('the designs dialog shows every design moving, and opens one', async () => {
  const { context, page, errors } = await open('?paused=1');
  await page.locator('#presets').click();
  await page.waitForSelector('#designs-dialog[open]');
  await page.waitForTimeout(400);
  const thumbs = await page.evaluate(() => [...document.querySelectorAll('#designs canvas')].map((c) => {
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let dark = 0, light = 0;
    for (let i = 0; i < data.length; i += 16) { if (data[i] < 60) dark += 1; else if (data[i] > 195) light += 1; }
    return { dark, light };
  }));
  assert.ok(thumbs.length >= 9, `${thumbs.length} designs offered`);
  // all but the blank one are pictures in two inks
  const drawn = thumbs.filter((t) => t.dark > 300 && t.light > 300).length;
  assert.ok(drawn >= thumbs.length - 1, `${drawn} of ${thumbs.length} thumbnails are drawn`);
  await shoot(page, 'designs');
  await page.locator('#designs button[data-name="Turnstile"]').click();
  await page.waitForFunction(() => window.__studio.state.design.L.length === 1);
  assert.equal(await page.evaluate(() => document.querySelector('#designs-dialog').open), false);
  // the census film opens as its waves
  await page.locator('#presets').click();
  await page.locator('#designs button[data-name="Census film"]').click();
  const st = await page.evaluate(designState);
  assert.equal(st.layers.length, 9);
  assert.ok(st.layers.every((l) => l.k === 'w'));
  // and random designs are whole films
  await page.locator('#random').click();
  const r = await page.evaluate(comparePixels, { t: 0.3, grid: 30 });
  assert.equal(r.bad, 0);
  clean(errors);
  await context.close();
});

await section('another class takes the same design and keeps its own symmetry', async () => {
  const { context, page, errors } = await open('?paused=1&class=g244-n2-1#p=plume');
  let st = await page.evaluate(designState);
  assert.equal(st.cls, 'g244-n2-1');
  assert.equal(await page.locator('#class-chip').innerText(), 'g244-n2-1');
  let r = await page.evaluate(comparePixels, { t: 0.3, grid: 36 });
  assert.equal(r.bad, 0, `${r.bad} of ${r.n} pixels disagree in g244-n2-1`);
  // through the dialog, to a class where a lattice step swaps the inks
  await page.locator('#class-chip').click();
  await page.waitForSelector('#class-dialog[open]');
  const options = await page.locator('#class-select option').count();
  assert.equal(options, 307, 'every two-colour class of the census is offered');
  const swapping = await page.evaluate(() => window.__studio.state.census.classes.find((c) => c.n === 2 && (c.u[0] || c.u[1]) && c.ct === 1).id);
  await page.locator('#class-select').selectOption(swapping);
  st = await page.evaluate(designState);
  assert.equal(st.cls, swapping);
  await page.keyboard.press('Escape');
  r = await page.evaluate(comparePixels, { t: 0.55, grid: 36 });
  assert.equal(r.bad, 0, `${r.bad} of ${r.n} pixels disagree in ${swapping}`);
  await page.waitForFunction((id) => new URLSearchParams(location.search).get('class') === id, swapping);
  note(`also drawn: g244-n2-1 and ${swapping}`);
  clean(errors);
  await context.close();
});

await section('the census page offers the Studio for a two-colour class, and the link opens that class', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  await page.goto(new URL('shubnikov/#p4/g95/g95-n2-4', base).href, { waitUntil: 'load' });
  await page.waitForSelector('#shub-viewer[open]', { timeout: 60000 });
  const link = page.locator('#shub-viewer a[href^="studio/?class="]');
  assert.equal(await link.getAttribute('href'), 'studio/?class=g95-n2-4');
  await link.click();
  await page.waitForSelector('main.studio[aria-busy="false"]', { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__studio));
  assert.equal(await page.evaluate(() => window.__studio.state.classId), 'g95-n2-4');
  // a class with three or more colours is not offered: the Studio draws two inks
  await page.goto(new URL('shubnikov/#p4/g95/g95-n4-1', base).href, { waitUntil: 'load' });
  await page.waitForSelector('#shub-viewer[open]', { timeout: 60000 });
  assert.equal(await page.locator('#shub-viewer a[href^="studio/"]').count(), 0);
  clean(errors);
  await context.close();
});

await section('on a phone: no sideways scroll, the film first, the controls within reach', async () => {
  const { context, page, errors } = await open('?paused=1', { width: 390, height: 844, mobile: true });
  const m = await page.evaluate(() => {
    const film = document.querySelector('#viewport').getBoundingClientRect();
    const panel = document.querySelector('.panel').getBoundingClientRect();
    const small = [...document.querySelectorAll('.bar button, .playrow button, .card-head button, .strip button')]
      .filter((b) => b.offsetParent !== null)
      .map((b) => ({ id: b.id || b.textContent.trim(), w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height }))
      .filter((b) => b.h < 28 || b.w < 28);
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      filmTop: film.top, filmH: film.height, filmW: film.width, panelTop: panel.top, small,
      canvas: [document.querySelector('#film').width, document.querySelector('#film').height],
    };
  });
  assert.ok(m.overflow <= 0, `the page is ${m.overflow}px wider than the screen`);
  assert.ok(m.filmW > 380 && m.filmH > 300, `the film is ${m.filmW}×${m.filmH}`);
  assert.ok(m.panelTop > m.filmTop + m.filmH - 1, 'the design column is under the film');
  assert.deepEqual(m.small, [], 'no control is too small for a finger');
  // a tap selects, a drag moves
  const copy = await page.evaluate(findCopy, { layerIndex: 0, wantJ: null });
  await page.touchscreen.tap(copy.x, copy.y);
  assert.notEqual((await page.evaluate(designState)).sel, null, 'a tap selects a shape');
  await shoot(page, 'phone');
  clean(errors);
  await context.close();
});

await browser.close();
if (failures) {
  console.log(`\n${failures} section${failures === 1 ? '' : 's'} failed`);
  process.exit(1);
}
console.log('\nall sections passed');
