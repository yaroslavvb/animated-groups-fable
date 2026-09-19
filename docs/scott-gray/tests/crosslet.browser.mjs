// Crosslet in a real browser engine: the entangled three-colour law on the
// pixels the page actually draws, the shader against an independent
// reconstruction of the same rule, the viewer's gestures and layout, the
// shutter, and the generator marks — off until asked for, glued to the pattern
// when they are on.
//
// Usage: node tests/crosslet.browser.mjs [base-url] [label]
//        BROWSER=webkit runs the same checks in Playwright's WebKit.
import assert from 'node:assert/strict';
// The module under test also exposes the rule on the CPU, which is what the
// shader is compared against below. The field itself is fetched from whatever
// copy of the page is being tested, so a live deployment is checked against its
// own bytes.
import {colourAt, createView, frameAt, fromPlane, gTurn, MAX_SCALE, TILE_PIXELS, toPlane, TURN_CENTRE, uVolume, valuesAt} from '../crosslet/renderer.mjs';
import {byName, centreOf, MARK_SEPARATION, MAX_UNITS, SHARED_SHIFT} from '../crosslet/generators.mjs';
const runtime = '/Users/yaroslavvb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? `${runtime}playwright/index.mjs`);
const engine = process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
const {PNG} = (await import(process.env.PNGJS_MODULE ?? `${runtime}pngjs/lib/png.js`)).default;
const base = (process.argv[2] ?? 'http://localhost:8934/scott-gray/crosslet/').replace(/\/?$/, '/');
const label = `${process.argv[3] ?? 'local'} (${engine})`;
const shots = process.env.SHOT_DIR ?? '/tmp';
const fieldBytes = await (await fetch(new URL('field.f32', base))).arrayBuffer();
const volume = uVolume(new Float32Array(fieldBytes));
const browser = engine === 'webkit' ? await playwright.webkit.launch({headless: true}) : await playwright.chromium.launch({channel: 'chrome', headless: true});
const notes = [];
const errors = [];
const context = await browser.newContext({viewport: {width: 1440, height: 1000}, deviceScaleFactor: 2});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
const ready = () => page.waitForSelector('canvas[data-ready="true"]');
// The three colours the page paints, in the order the colouring numbers them.
const PALETTE = [[0xc9, 0x56, 0x3e], [0x57, 0x97, 0x9a], [0xe2, 0xbe, 0x68]];
// The rows the control bar covers, in device pixels, which carry no pattern.
const BAND = 220;
// The home framing in CSS pixels per lattice length.
const HOME = TILE_PIXELS;

async function pixels() { return PNG.sync.read(await page.locator('canvas').screenshot()); }
async function shot(query) { await page.goto(base + query); await ready(); await page.waitForTimeout(150); return pixels(); }
const statsText = async () => {
  const shown = await page.locator('#stats').isVisible();
  if (!shown) await page.keyboard.press('s');
  const text = await page.locator('#stats').textContent();
  if (!shown) await page.keyboard.press('s');
  return text;
};
const scaleOf = text => Number(text.match(/(\d+) px per repeat/)[1]);
const turnOf = text => Number(text.match(/turned (-?\d+)°/)?.[1] ?? 0);
function averageDifference(a, b, x1 = 0, y1 = 0, x2 = 0, y2 = 0, width = a.width, height = a.height) {
  let total = 0, count = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = 4 * ((y + y1) * a.width + x + x1), j = 4 * ((y + y2) * b.width + x + x2);
    if (i + 2 >= a.data.length || j + 2 >= b.data.length) continue;
    for (let c = 0; c < 3; c++) total += Math.abs(a.data[i + c] - b.data[j + c]);
    count += 3;
  }
  return count ? total / count : 0;
}
/** Every pixel as one of the three palette colours, with a flag saying whether
 * it is pure enough to be one of them (an antialiased edge is not). */
function classify(image) {
  const out = new Uint8Array(image.width * image.height), pure = new Uint8Array(image.width * image.height);
  for (let i = 0; i < out.length; i++) {
    let best = 0, distance = Infinity;
    for (const [k, [r, g, b]] of PALETTE.entries()) {
      const d = Math.hypot(image.data[4 * i] - r, image.data[4 * i + 1] - g, image.data[4 * i + 2] - b);
      if (d < distance) { distance = d; best = k; }
    }
    out[i] = best; pure[i] = distance < 12 ? 1 : 0;
  }
  return {colour: out, pure};
}
/** How often `after` shows colour (before + step) mod 3 at the same pixel. */
function cycleAgreement(before, after, step) {
  const a = classify(before), b = classify(after);
  let same = 0, total = 0;
  for (let y = 0; y < before.height - BAND; y++) for (let x = 0; x < before.width; x++) {
    const i = y * before.width + x;
    if (!a.pure[i] || !b.pure[i]) continue;
    total++; if ((a.colour[i] + step) % 3 === b.colour[i]) same++;
  }
  return same / total;
}
/** How often `after` shows, at each point, the colour `before` shows a turn of
 * `degrees` away about the screen centre — which at the home framing is the
 * turn centre p itself. Negative degrees is the picture turned clockwise. */
function turnAgreement(before, after, degrees, step, radius = 700) {
  const a = classify(before), b = classify(after);
  const t = degrees * Math.PI / 180, cos = Math.cos(t), sin = Math.sin(t);
  const cx = before.width / 2, cy = before.height / 2;
  let same = 0, total = 0;
  for (let y = -radius; y <= radius; y += 2) for (let x = -radius; x <= radius; x += 2) {
    if (x * x + y * y > radius * radius) continue;
    const sx = Math.round(cx + cos * x - sin * y), sy = Math.round(cy + sin * x + cos * y);
    if (sx < 0 || sy < 0 || sx >= before.width || sy >= before.height - BAND) continue;
    const dx = Math.round(cx + x), dy = Math.round(cy + y);
    if (dy >= after.height - BAND) continue;
    const i = sy * before.width + sx, j = dy * after.width + dx;
    if (!a.pure[i] || !b.pure[j]) continue;
    total++; if ((a.colour[i] + step) % 3 === b.colour[j]) same++;
  }
  return same / total;
}
/** The share of the picture each of the three colours holds. */
function areas(image) {
  const {colour, pure} = classify(image);
  const counts = [0, 0, 0];
  let total = 0;
  for (let y = 0; y < image.height - BAND; y++) for (let x = 0; x < image.width; x++) {
    const i = y * image.width + x;
    if (!pure[i]) continue;
    counts[colour[i]]++; total++;
  }
  return counts.map(c => c / total);
}

try {
  await page.goto(`${base}?play=0`); await ready();
  assert.deepEqual(await page.locator('canvas').evaluate(c => [c.width, c.height]), [2880, 2000], 'native retina resolution');
  assert.equal(await page.locator('#notice').isVisible(), false);
  const home = await pixels();
  assert.ok(new Set(home.data).size > 30, 'nonblank rendered image');
  // A FRESH VISIT IS THE PICTURE ALONE.
  assert.equal(await page.locator('#generators').evaluate(n => n.hasAttribute('hidden')), true, 'the pixel checks run with the marks off');
  await page.screenshot({path: `${shots}/crosslet-${label}-desktop.png`});
  // Three colours, each holding about a third of the plane.
  const share = areas(home);
  for (const value of share) assert.ok(Math.abs(value - 1 / 3) < 0.04, `colour areas ${share.map(v => v.toFixed(4))}`);

  // ---- the entangled colour symmetry, on the pixels the page draws ----
  // Wait a third of a period and the whole picture has turned a third of a turn
  // CLOCKWISE about the screen centre — which is p, the turn centre — with every
  // region taking the colour of the one before it.
  const third = await shot(`?play=0&phase=${1 / 3}`);
  assert.ok(turnAgreement(home, third, -120, 2) > 0.99, 'a third of a period turns the picture a third of a turn clockwise and steps every colour back one');
  notes.push(`turn + wait + recolour: ${(100 * turnAgreement(home, third, -120, 2)).toFixed(2)}% of the picture`);
  // Every proper part of that fails — and on THIS entry each of them fails by
  // coming close, which is the interesting thing about it: over nine tenths of
  // the picture the colour simply steps on one every third of a period wherever
  // you stand, so the turn alone and the wait alone both reach about 92 %. A
  // symmetry has to hold everywhere, so 92 % buys nothing; what the page is
  // about is the tenth that does not, and the gap between 92 % and the law's
  // 99.9 % is the whole measurement.
  const parts = [
    ['the turn and the wait without the recolouring', turnAgreement(home, third, -120, 0)],
    ['the turn and the wait with the colours the other way', turnAgreement(home, third, -120, 1)],
    ['the turn taken anticlockwise', Math.max(...[0, 1, 2].map(k => turnAgreement(home, third, 120, k)))],
    ['the turn alone, either way', Math.max(...[0, 1, 2].flatMap(k => [turnAgreement(home, home, -120, k), turnAgreement(home, home, 120, k)]))],
    ['the wait alone', Math.max(...[0, 1, 2].map(k => cycleAgreement(home, third, k)))],
  ];
  for (const [name, value] of parts) assert.ok(value < 0.95, `${name} reaches ${value.toFixed(5)} — too close to a symmetry to call it a failure`);
  assert.ok(Math.max(...parts.map(([, v]) => v)) > 0.85, 'and each of them is a NEAR miss, which is this entry’s character');
  assert.ok(averageDifference(home, third) > 5, 'a third of a period really does redraw the picture');
  notes.push(`the parts fail: best near miss ${(100 * Math.max(...parts.map(([, v]) => v))).toFixed(2)}% against the law's ${(100 * turnAgreement(home, third, -120, 2)).toFixed(2)}%`);
  // The sharpest statement of the law needs no resampling at all: turning the
  // VIEW a third of a turn clockwise about the same point draws, pixel for
  // pixel, the frame a third of a period later with its colours stepped back one.
  const turned = await shot('?play=0&angle=120');
  assert.ok(cycleAgreement(turned, third, 2) > 0.999, 'the view turned 120° clockwise is the frame at T/3 with the colours stepped back one');
  for (const step of [0, 1]) assert.ok(cycleAgreement(turned, third, step) < 0.1, `and it is nothing else (step ${step})`);
  const twoThirds = await shot(`?play=0&phase=${2 / 3}`);
  const back = await shot('?play=0&angle=240');
  assert.ok(cycleAgreement(back, twoThirds, 1) > 0.999, 'and two thirds of a turn matches the frame at 2T/3 with the colours stepped the other way');
  // A still frame on its own has no symmetry to find.
  for (const step of [0, 1, 2]) assert.ok(cycleAgreement(turned, home, step) < 0.95, `a single frame has no threefold symmetry (step ${step})`);

  // The turn centre is the free demonstration of the law: g fixes p, so the
  // colour of the middle pixel simply steps back one place every T/3.
  const centre = [];
  for (let k = 0; k < 12; k++) {
    const image = await shot(`?play=0&phase=${k / 12}`);
    const {colour} = classify(image);
    centre.push(colour[(image.height / 2) * image.width + image.width / 2]);
  }
  for (let k = 0; k < 12; k++) assert.equal((centre[k] - centre[(k + 4) % 12] + 3) % 3, 1, `the centre steps back exactly one colour every third of a period: ${centre}`);
  assert.equal(new Set(centre).size, 3, 'all three colours pass under the turn centre');
  notes.push(`the fixed point steps ${centre.join('')} over the loop`);

  // ---- the shader against an independent reconstruction of the same rule ----
  // Every check above is self-consistent: a shader with a half-texel offset, a
  // transposed lattice basis or the wrong sense of turn could still satisfy
  // them. So map each device pixel back through the shader's own documented
  // screen → plane → lattice chain and compare the colour it painted with the
  // one the module's CPU reconstruction computes there.
  {
    const plane = frameAt(volume, 0);
    let checked = 0, wrong = 0;
    for (const [scale, phase, cx, cy] of [[380, 0, TURN_CENTRE[0], TURN_CENTRE[1]], [1500, 0.41, 0.5, 0.5], [95, 0.77, 0.25, 0.75]]) {
      await page.goto(`${base}?play=0&scale=${scale}&phase=${phase}&x=${cx}&y=${cy}`); await ready();
      await page.waitForTimeout(150);
      const {cssWidth, cssHeight} = await page.locator('canvas').evaluate(c => ({cssWidth: c.clientWidth, cssHeight: c.clientHeight}));
      const image = await pixels();
      frameAt(volume, phase, plane);
      const {colour, pure} = classify(image);
      for (let y = 4; y < image.height - 4; y += 9) for (let x = 4; x < image.width - 4; x += 9) {
        const i = y * image.width + x;
        if (!pure[i]) continue; // antialiased pixels carry no single answer
        // gl_FragCoord counts from the bottom left; the PNG counts from the top.
        const screenX = (x + 0.5) / image.width - 0.5;
        const screenY = -((image.height - y - 0.5) / image.height - 0.5);
        const offset = fromPlane([screenX * cssWidth / scale, screenY * cssHeight / scale]);
        const point = [cx + offset[0], cy + offset[1]];
        const values = valuesAt(plane, point).slice().sort((a, b) => b - a);
        // Skip pixels too near a boundary for a half-pixel of sampling slack.
        if (values[0] - values[1] < 1e-3) continue;
        checked++; if (colourAt(plane, point) !== colour[i]) wrong++;
      }
    }
    assert.ok(checked > 20000, `enough pixels compared against the CPU reconstruction (${checked})`);
    assert.equal(wrong, 0, `the shader paints argmax_k U(g^k x, t + k T/3): ${wrong} of ${checked} pixels disagree with the CPU reconstruction`);
    notes.push(`shader matches the CPU reconstruction on ${checked} pixels`);
    // And the CPU reconstruction carries the law off the nodes, which is what
    // makes the comparison above a comparison with the rule and not with itself.
    const later = frameAt(volume, 1 / 3);
    for (const point of [[0.137, 0.62], [0.9, 0.04], TURN_CENTRE]) {
      assert.equal(colourAt(later, gTurn(point)), (colourAt(frameAt(volume, 0), point) + 2) % 3, `the law at ${point}`);
    }
  }

  // ---- framing, tiling and the endless pan ----
  await page.goto(`${base}?play=0`); await ready();
  assert.equal(scaleOf(await statsText()), HOME, 'the home framing is 380 CSS px per lattice length');
  await page.setViewportSize({width: 1520, height: 1000});
  await page.waitForTimeout(200);
  const repeated = await pixels();
  // The lattice repeats every lattice length along a1: 380 CSS px, 760 device px at DPR 2.
  assert.ok(averageDifference(repeated, repeated, 0, 0, 760, 0, 2200, 1500) < 1, 'periodic tiling has no seam or orientation change');

  await page.setViewportSize({width: 390, height: 844});
  await page.waitForTimeout(200);
  const phone = await pixels();
  // Narrow screens keep two repeats across: 195 CSS px = 390 device px per lattice length at DPR 2.
  assert.ok(averageDifference(phone, phone, 0, 0, 390, 0, 390, 1400) < 1, 'phone view repeats every 195 CSS px');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth && document.documentElement.scrollHeight === innerHeight), 'mobile fills viewport without scrolling');
  const bounds = await page.locator('#controls').boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, 'mobile controls fit');
  await page.screenshot({path: `${shots}/crosslet-${label}-mobile.png`});

  // Dragging pans the endless pattern, and the reset button appears.
  await page.setViewportSize({width: 1280, height: 800});
  await page.goto(`${base}?play=0`); await ready(); await page.waitForTimeout(150);
  const beforeDrag = await pixels();
  assert.equal(await page.locator('#reset').isVisible(), false, 'reset hidden at home');
  await page.mouse.move(640, 300); await page.mouse.down();
  await page.mouse.move(700, 300, {steps: 4}); await page.mouse.move(735, 300, {steps: 4});
  await page.waitForTimeout(250); // A pause before release means no fling.
  await page.mouse.up();
  await page.waitForTimeout(300);
  const afterDrag = await pixels();
  assert.ok(averageDifference(beforeDrag, afterDrag, 0, 0, 190, 0, 2200, 1200) < 1.5, 'a 95 CSS px drag shifts the picture by exactly 190 device px');
  assert.ok(averageDifference(beforeDrag, afterDrag, 0, 0, 0, 0, 2200, 1200) > 5, 'and it really did move');
  assert.equal(await page.locator('#reset').isVisible(), true, 'the reset button appears once the view has moved');
  await page.locator('#reset').click(); await page.waitForTimeout(250);
  assert.equal(await page.locator('#reset').isVisible(), false, 'and reset puts it back home');
  assert.ok(averageDifference(beforeDrag, await pixels()) < 1, 'exactly home');
  // The wheel zooms about the pointer, and the keys zoom about the middle.
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(300);
  const zoomed = scaleOf(await statsText());
  // Chrome scales the wheel delta by the device pixel ratio, so only the
  // direction and a rough size are checked here.
  assert.ok(zoomed > HOME * 1.2, `the wheel zoomed in to ${zoomed} px per repeat`);
  await page.keyboard.press('0'); await page.waitForTimeout(300);
  assert.equal(scaleOf(await statsText()), HOME);
  await page.keyboard.press('+'); await page.waitForTimeout(300);
  assert.equal(scaleOf(await statsText()), Math.round(HOME * 1.25), 'the keyboard zoom is a quarter');
  await page.keyboard.press(']'); await page.waitForTimeout(300);
  assert.equal(turnOf(await statsText()), 15, 'and ] turns the pattern 15°');
  await page.keyboard.press('0'); await page.waitForTimeout(300);
  assert.equal(turnOf(await statsText()), 0);

  // ---- the shutter ----
  // Standing still the shutter is off: nothing is moving, so there is nothing
  // to smear. Deep enough in, the pattern's own boundaries move fast enough to
  // pay for it, and the stats overlay says which state the last frame was in.
  await page.goto(`${base}?stats=1&play=0`); await ready(); await page.waitForTimeout(250);
  assert.match(await statsText(), /shutter off \(of 3\)/, 'a paused page never integrates');
  await page.goto(`${base}?stats=1&scale=3000`); await ready(); await page.waitForTimeout(700);
  assert.match(await statsText(), /shutter 3×0\.30 frame/, 'the pattern engages the shutter by itself when zoomed deep in');
  await page.goto(`${base}?stats=1`); await ready(); await page.waitForTimeout(700);
  assert.match(await statsText(), /shutter off \(of 3\)/, 'and the home framing does not pay for one');
  await page.goto(`${base}?stats=1&taa=1`); await ready(); await page.waitForTimeout(400);
  assert.match(await statsText(), /shutter off/, '?taa=1 turns it off altogether');
  notes.push('shutter engaged by the pattern only when deep in');

  // ---- the generator marks ----
  await page.setViewportSize({width: 1440, height: 1000});
  await page.goto(base); await ready();
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(base); await ready(); await page.waitForTimeout(250);
  const layerHidden = () => page.locator('#generators').evaluate(n => n.hasAttribute('hidden'));
  const unitCount = () => page.locator('#generators .cc-unit').count();
  const placed = async selector => (await page.$$eval(`#generators ${selector}`, nodes => nodes.map(node => {
    const m = node.getAttribute('transform').match(/translate\(([-\d.]+) ([-\d.]+)\)/);
    return [Number(m[1]), Number(m[2])];
  })));
  const near = (a, list, tolerance = 0.2) => list.some(b => Math.hypot(a[0] - b[0], a[1] - b[1]) < tolerance);

  assert.equal(await layerHidden(), true, 'the marks are off by default — a fresh visit is the picture alone');
  assert.equal(await page.locator('#generators-check').isChecked(), false, 'and the checkbox underneath says so');
  assert.equal(await unitCount(), 0, 'nothing is in the document to draw');
  assert.match(await statsText(), /marks off/);
  // The checkbox turns them on, and the choice is remembered.
  await page.locator('#generators-check').setChecked(true);
  await page.waitForTimeout(250);
  assert.equal(await layerHidden(), false, 'the checkbox draws them');
  const units = await unitCount();
  assert.ok(units >= 7 && units <= MAX_UNITS, `${units} repeats annotated at the home framing`);
  assert.equal(await page.locator('#generators .cc-marker').count(), 2 * units, 'two coins per repeat — g and g²');
  assert.equal(await page.locator('#generators .cc-translation').count(), 2 * units, 'and two slides');
  assert.equal(await page.locator('#generators').evaluate(n => getComputedStyle(n).pointerEvents), 'none',
    'the overlay must never take a pointer from the canvas');
  assert.match(await statsText(), new RegExp(`marks ${units}`), 'the stats overlay counts the repeats');
  // Two coins, ONE centre: g and g² are placed at the same point and pushed
  // apart only for legibility, with a tether back to the ring on the true centre.
  const gs = await placed('.cc-marker[data-name="g"]');
  const g2s = await placed('.cc-marker[data-name="gSquared"]');
  assert.equal(gs.length, units);
  for (const spot of gs) assert.ok(near(spot, g2s, 0.05), `g at ${spot} is not on a g² centre`);
  assert.equal(await page.locator('#generators .cc-marker[data-shared="true"]').count(), 2 * units, 'both coins know their centre is shared');
  assert.equal(await page.locator('#generators .cc-tether').count(), 2 * units, 'and each is tethered back to it');
  assert.ok(near([720, 500], gs, 0.05), 'the turn centre sits at the middle of the screen at the home view');
  // The marks sit where the camera puts them: turned back through the plane
  // basis by hand, every coin is a whole number of lattice steps from the one
  // in the middle of the screen. (The transforms are written to two decimals,
  // which is why the tolerance is 1e-4 of a lattice length and not zero.)
  {
    const origin = gs.reduce((a, b) => (Math.hypot(a[0] - 720, a[1] - 500) < Math.hypot(b[0] - 720, b[1] - 500) ? a : b));
    for (const spot of gs) {
      const [du, dv] = fromPlane([(spot[0] - origin[0]) / HOME, (spot[1] - origin[1]) / HOME]);
      assert.ok(Math.abs(du - Math.round(du)) < 1e-4 && Math.abs(dv - Math.round(dv)) < 1e-4,
        `the coin at ${spot} is not a whole lattice step from the middle one (${du}, ${dv})`);
    }
    // And the coin is |p| from the lattice node the two slides run out of,
    // which is the spacing the page measures its own crowding by.
    const tail = (await placed('.cc-translation'))[0];
    const [px, py] = toPlane(centreOf(byName('g')));
    assert.ok(near([tail[0] + HOME * px, tail[1] + HOME * py], gs, 0.05), 'the slides run out of the coins’ own cell corner');
    assert.ok(Math.abs(MARK_SEPARATION * HOME - 121.43) < 0.01, 'and |p| is 121.4 CSS px at the home framing');
  }
  // THE LABELS ARE MARKUP, NOT UNICODE. In WebKit — every browser on iOS — the
  // characters ₁ ⁽ ⁰ ⁾ have no glyph in the serif stack and each is given a
  // full-width fallback box, so a Unicode label shatters into fragments strewn
  // across the picture. Both engines must draw the same narrow boxes.
  const labels = await page.$$eval('#generators text', nodes => nodes.map(node => {
    const box = node.getBBox();
    return {text: node.textContent, width: box.width, height: box.height, tspans: node.querySelectorAll('tspan').length};
  }));
  const distinct = new Map(labels.map(item => [item.text, item]));
  assert.equal(distinct.size, 4, `four distinct labels, not ${[...distinct.keys()]}`);
  for (const item of distinct.values()) {
    assert.ok(!/[⁰-₟]/.test(item.text), `the label "${item.text}" is set in Unicode sub/superscripts`);
    assert.equal(item.tspans, item.text.startsWith('τ') ? 1 : 2, `"${item.text}" is not built of tspans`);
    assert.ok(item.width > 10 && item.width < 96, `the label "${item.text}" measures ${item.width.toFixed(1)} px — a fallback box?`);
    assert.ok(item.height < 40, `the label "${item.text}" is ${item.height.toFixed(1)} px tall`);
  }
  notes.push(`labels ${[...distinct.values()].map(l => `${l.text} ${l.width.toFixed(0)}px`).join(', ')}`);
  // Glued to the pattern: a pan carries every mark with it, to the pixel. The
  // keyboard pan is used because it is exact — 48 px a press — and because a
  // released drag is thrown.
  for (const key of ['ArrowLeft', 'ArrowLeft', 'ArrowUp', 'ArrowUp']) { await page.keyboard.press(key); await page.waitForTimeout(90); }
  await page.waitForTimeout(400);
  const dragged = await placed('.cc-marker[data-name="g"]');
  const inside = ([x, y]) => x > -600 && y > -600 && x < 1440 + 600 && y < 1000 + 600;
  let carried = 0, expected = 0;
  for (const [x, y] of gs) {
    if (!inside([x + 96, y + 96])) continue;
    expected++;
    if (near([x + 96, y + 96], dragged)) carried++;
  }
  assert.ok(expected >= 5 && carried === expected, `only ${carried} of ${expected} coins followed the pan`);
  // A sixth of a turn turns the marks with the pattern about the same point —
  // and turns nothing inside them: the clocks, the colour chips and the labels
  // stay upright, so only the crystallographic glyph carries the new angle.
  await page.goto(base); await ready(); await page.waitForTimeout(250);
  const flat = await placed('.cc-marker[data-name="g"]');
  await page.goto(`${base}?angle=60`); await ready(); await page.waitForTimeout(250);
  assert.equal(turnOf(await statsText()), 60);
  const turned60 = await placed('.cc-marker[data-name="g"]');
  const c60 = Math.cos(Math.PI / 3), s60 = Math.sin(Math.PI / 3);
  let rotated = 0;
  for (const [x, y] of flat) {
    const dx = x - 720, dy = y - 500;
    if (near([720 + c60 * dx - s60 * dy, 500 + s60 * dx + c60 * dy], turned60, 1)) rotated++;
  }
  assert.ok(rotated >= 3, `only ${rotated} of ${flat.length} coins turned with the pattern`);
  assert.equal(await page.locator('#generators .cc-marker[data-name="g"] .cc-turn').first().getAttribute('transform'), 'rotate(60.00)',
    'the order glyph is the piece that carries the turn');
  assert.equal(await page.locator('#generators .cc-marker[data-name="g"] .cc-chip').first().evaluate(n => n.closest('[transform*="rotate"]')?.classList.contains('cc-turn') ?? false), false,
    'nothing inside the chip turns with the view');
  // Zoomed out the layer thins and then goes, and the two coins never part
  // company on the way: one centre, drawn twice or not at all.
  for (const scale of [200, 150, 130, 100]) {
    await page.goto(`${base}?scale=${scale}&generators=1`); await ready(); await page.waitForTimeout(250);
    const state = await page.evaluate(() => ({
      coins: document.querySelectorAll('#generators .cc-marker[data-name="g"]').length,
      squares: document.querySelectorAll('#generators .cc-marker[data-name="gSquared"]').length,
      opacity: Number(document.querySelector('#generators').style.opacity),
    }));
    assert.equal(state.coins, state.squares, `at ${scale} px a repeat the two coins differ in number`);
    if (scale <= 100) assert.equal(state.opacity, 0, 'the layer is gone once the marks can shrink no further');
    else assert.ok(state.opacity > 0, `at ${scale} px a repeat the layer is still there`);
  }
  notes.push('the layer thins and goes by 113 px a repeat');
  await page.goto(`${base}?scale=200&generators=1`); await ready(); await page.waitForTimeout(250);
  // Off and on: the checkbox, the G key and the query, each remembered but for
  // the query, which is a share link and must not change what the viewer chose.
  await page.goto(base); await ready(); await page.waitForTimeout(200);
  assert.equal(await layerHidden(), false, 'the checkbox choice is remembered across a reload');
  await page.keyboard.press('g'); await page.waitForTimeout(250);
  assert.equal(await layerHidden(), true, 'G takes them away');
  assert.equal(await page.locator('#generators-check').isChecked(), false);
  assert.equal(await unitCount(), 0, 'and takes them out of the document');
  await page.goto(base); await ready(); await page.waitForTimeout(200);
  assert.equal(await layerHidden(), true, 'which is remembered too');
  await page.goto(`${base}?generators=1`); await ready(); await page.waitForTimeout(200);
  assert.equal(await layerHidden(), false, '?generators=1 opens a view with them');
  assert.equal(await page.locator('#generators-check').isChecked(), true);
  await page.goto(`${base}?marks=1`); await ready(); await page.waitForTimeout(200);
  assert.equal(await layerHidden(), false, 'and so does the catalog’s own ?marks=1');
  await page.goto(base); await ready(); await page.waitForTimeout(200);
  assert.equal(await layerHidden(), true, 'a shared link leaves the viewer’s own choice alone');
  // The canvas keeps every gesture through the overlay.
  await page.goto(`${base}?generators=1&play=0`); await ready(); await page.waitForTimeout(250);
  await page.mouse.move(720, 500); await page.mouse.down();
  await page.mouse.move(640, 430, {steps: 5});
  await page.waitForTimeout(250);
  await page.mouse.up();
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#reset').isVisible(), true, 'a drag straight across a mark still pans');
  await page.keyboard.press('0'); await page.waitForTimeout(350);

  // ---- the notation panel ----
  assert.equal(await page.locator('#legend').isVisible(), false);
  await page.getByRole('button', {name: 'Notation'}).click();
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#legend').isVisible(), true, 'the Notation button opens the panel');
  assert.equal(await page.locator('#notation').getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('#legend-body .symbol').innerHTML(),
    '3<sub>1</sub><sup>(021)</sup> 3<sub>2</sub><sup>(012)</sup> · τ<sub>1</sub> τ<sub>2</sub>',
    'the symbol is set with real sub/superscripts');
  assert.equal(await page.locator('#legend-body table tbody tr').count(), 4, 'one row per generator');
  assert.ok(await page.locator('#legend svg').count() >= 5, 'the panel draws the anatomy and the key');
  assert.equal(await page.locator('#legend').getAttribute('role'), 'region', 'a dialog role over a live canvas would be a lie');
  const panelText = await page.locator('#legend-body').textContent();
  for (const phrase of ['Two coins, one centre', 'fully entangled', 'g225']) {
    assert.ok(panelText.includes(phrase), `the panel never says "${phrase}"`);
  }
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  assert.equal(await page.locator('#legend').isVisible(), false, 'Escape closes it');
  await page.keyboard.press('n'); await page.waitForTimeout(250);
  assert.equal(await page.locator('#legend').isVisible(), true, 'N opens it');
  await page.mouse.click(300, 700); await page.waitForTimeout(250);
  assert.equal(await page.locator('#legend').isVisible(), false, 'a tap outside closes it');
  // On a phone the panel sits above the control bar and leaves the picture in view.
  await page.setViewportSize({width: 390, height: 844});
  await page.goto(`${base}?generators=1`); await ready(); await page.waitForTimeout(250);
  await page.keyboard.press('n'); await page.waitForTimeout(300);
  const panel = await page.locator('#legend').boundingBox();
  const bar = await page.locator('#controls').boundingBox();
  assert.ok(panel.y + panel.height <= bar.y + 1, 'the panel clears the control bar');
  assert.ok(panel.y > 100, 'and leaves the top of the picture visible');
  await page.screenshot({path: `${shots}/crosslet-${label}-mobile-marks.png`});
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.setViewportSize({width: 1440, height: 1000});

  // ---- playback, controls, recovery ----
  await page.goto(`${base}?generators=0`); await ready(); await page.waitForTimeout(200);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelector('#pause').getAttribute('aria-label') === 'Play animation');
  await page.waitForTimeout(200);
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
  try {
    await page.getByRole('button', {name: 'Enter fullscreen', exact: true}).click();
    await page.waitForFunction(() => !!document.fullscreenElement, null, {timeout: 4000});
    await page.keyboard.press('f');
    await page.waitForFunction(() => !document.fullscreenElement, null, {timeout: 4000});
    notes.push('fullscreen');
  } catch (error) {
    if (engine === 'chromium') throw error;
    notes.push('fullscreen unavailable in headless WebKit');
  }
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
  assert.ok(MAX_SCALE > 0 && SHARED_SHIFT > 0 && createView().isHome());
  console.log(`${label}: retina rendering, balanced three-colour areas (${share.map(v => v.toFixed(3)).join(' / ')}), the entangled law on rendered pixels with every part of it failing, shader against the CPU rule, fixed scale, seamless tiling, mobile layout, drag pan, wheel and key zoom, turn, shutter, generator marks off by default and on by checkbox/G/query, two coins on one centre, the notation panel, pause/play, idle controls, GPU recovery and reduced motion passed (${notes.join('; ')})`);
} finally {await browser.close();}
