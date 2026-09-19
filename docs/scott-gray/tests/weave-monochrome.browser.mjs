// Weave Monochrome in a real browser engine: the two-colour symmetry on the
// pixels the page actually draws, the shader against an independent
// reconstruction of the same rule, the viewer's gestures and layout, the Safari
// trackpad pinch-and-turn, the shutter, and the momentum.
//
// Usage: node tests/weave-monochrome.browser.mjs [base-url] [label]
//        BROWSER=webkit runs the same checks in Playwright's WebKit.
//
// Run this suite ALONE — one browser suite at a time. Each one launches its own
// Chrome at 1440 × 1000 with deviceScaleFactor 2 and takes a full-canvas PNG on
// nearly every step; two at once exhaust the GPU and the loser's browser is
// killed mid-run, which surfaces as "Target page, context or browser has been
// closed" from whatever assertion happened to be in flight and looks exactly
// like a real regression.
import assert from 'node:assert/strict';
// The module under test also exposes the rule on the CPU, which is what the
// shader is compared against below. The field itself is fetched from whatever
// copy of the page is being tested, so a live deployment is checked against its
// own bytes.
import {bicubic, frameAt, MAX_SCALE, signedVolume} from '../weave-monochrome/renderer.mjs';
import {ELASTIC_GIVE} from '../weave-monochrome/momentum.mjs';
const runtime = '/Users/yaroslavvb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? `${runtime}playwright/index.mjs`);
const engine = process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
const {PNG} = (await import(process.env.PNGJS_MODULE ?? `${runtime}pngjs/lib/png.js`)).default;
const base = (process.argv[2] ?? 'http://localhost:8934/scott-gray/weave-monochrome/').replace(/\/?$/, '/');
const label = `${process.argv[3] ?? 'local'} (${engine})`;
const shots = process.env.SHOT_DIR ?? '/tmp';
const fieldBytes = await (await fetch(new URL('field.f32', base))).arrayBuffer();
const volume = signedVolume(new Float32Array(fieldBytes), 'u');
const browser = engine === 'webkit' ? await playwright.webkit.launch({headless: true}) : await playwright.chromium.launch({channel: 'chrome', headless: true});
const notes = [];
const errors = [];
const context = await browser.newContext({viewport: {width: 1440, height: 1000}, deviceScaleFactor: 2});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
const ready = () => page.waitForSelector('canvas[data-ready="true"]');
let touch = null;
/** Two fingers through a sequence of positions: real touch input through the
 * devtools protocol in Chromium, synthetic pointer events in WebKit. */
async function fingers(frames) {
  if (engine === 'chromium') {
    touch ??= await context.newCDPSession(page);
    await touch.send('Emulation.setTouchEmulationEnabled', {enabled: true});
    const points = frame => frame.map(([x, y], i) => ({x, y, id: i + 1}));
    await touch.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: points(frames[0])});
    for (const frame of frames.slice(1)) await touch.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: points(frame)});
    await touch.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await touch.send('Emulation.setTouchEmulationEnabled', {enabled: false});
    return;
  }
  await page.evaluate(frames => {
    const canvas = document.querySelector('canvas');
    const fire = (type, [x, y], id) => canvas.dispatchEvent(new PointerEvent(type, {pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x, clientY: y, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true}));
    frames[0].forEach((point, i) => fire('pointerdown', point, i + 1));
    for (const frame of frames.slice(1)) frame.forEach((point, i) => fire('pointermove', point, i + 1));
    frames[frames.length - 1].forEach((point, i) => fire('pointerup', point, i + 1));
  }, frames);
}
/** Safari's trackpad gesture events. On a Mac a pinch and a turn arrive as two
 * separate streams, each event carrying only its own quantity; `steps` says
 * exactly what to send. Safari itself constructs GestureEvents; other engines
 * get a plain event with the same fields, which exercises the page's handler. */
async function gesture(steps, at = [720, 400], {gap = 0} = {}) {
  return page.evaluate(async ({steps, at, gap}) => {
    const canvas = document.querySelector('canvas');
    let native = true;
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const fire = (type, scale, rotation) => {
      let event;
      try {
        event = document.createEvent('GestureEvent');
        event.initGestureEvent(type, true, true, window, 0, 0, 0, at[0], at[1], false, false, false, false, canvas, scale, rotation);
      } catch {
        native = false;
        event = new Event(type, {bubbles: true, cancelable: true});
        Object.defineProperties(event, {scale: {value: scale}, rotation: {value: rotation}, clientX: {value: at[0]}, clientY: {value: at[1]}});
      }
      canvas.dispatchEvent(event);
    };
    for (const [i, [type, scale, rotation]] of steps.entries()) {
      if (gap && i) await wait(gap);
      fire(type, scale, rotation);
    }
    return native;
  }, {steps, at, gap});
}
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
  let total = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let c = 0; c < 3; c++) {
    total += Math.abs(a.data[4*((y+y1)*a.width+x+x1)+c] - b.data[4*((y+y2)*b.width+x+x2)+c]);
  }
  return total / (width * height * 3);
}
/** Black or white at each pixel, and whether that reading is unambiguous: the
 * page draws only 0 and 255, with a band of grey one device pixel wide along
 * the contour, and only the pure pixels carry a colour to compare. */
function classify(image) {
  const out = new Uint8Array(image.width * image.height), pure = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) {
    const value = image.data[4 * i];
    out[i] = value > 127 ? 1 : 0;
    pure[i] = value < 12 || value > 243 ? 1 : 0;
  }
  return {colour: out, pure};
}
/** The share of the picture that is white, over the pure pixels alone and
 * skipping the strip the control bar covers. */
function whiteShare(image) {
  const {colour, pure} = classify(image);
  let white = 0, total = 0;
  for (let y = 0; y < image.height - 220; y++) for (let x = 0; x < image.width; x++) {
    const i = y * image.width + x;
    if (!pure[i]) continue;
    total++; white += colour[i];
  }
  return white / total;
}
/** How often `after` shows, at each point, the colour `before` shows a turn of
 * `degrees` away about the screen centre — inverted when `invert` is set.
 * Antialiased pixels and the strip the control bar covers are skipped. */
function turnAgreement(before, after, degrees, invert, radius = 700) {
  const a = classify(before), b = classify(after);
  const t = degrees * Math.PI / 180, cos = Math.cos(t), sin = Math.sin(t);
  const cx = before.width / 2, cy = before.height / 2;
  let same = 0, total = 0;
  for (let y = -radius; y <= radius; y += 2) for (let x = -radius; x <= radius; x += 2) {
    if (x * x + y * y > radius * radius) continue;
    const sx = Math.round(cx + cos * x - sin * y), sy = Math.round(cy + sin * x + cos * y);
    if (sx < 0 || sy < 0 || sx >= before.width || sy >= before.height - 220) continue;
    const dx = Math.round(cx + x), dy = Math.round(cy + y);
    if (dy >= after.height - 220) continue;
    const i = sy * before.width + sx, j = dy * after.width + dx;
    if (!a.pure[i] || !b.pure[j]) continue;
    total++; if ((a.colour[i] ^ (invert ? 1 : 0)) === b.colour[j]) same++;
  }
  return same / total;
}
/** How often `after` at (x, y) shows `before` at (x + dx, y + dy), inverted when
 * `invert` is set: the slide half of the colour law, in device pixels. */
function shiftAgreement(before, after, dx, dy, invert) {
  const a = classify(before), b = classify(after);
  let same = 0, total = 0;
  for (let y = 0; y < before.height - 220; y += 2) for (let x = 0; x < before.width; x += 2) {
    const sx = x + dx, sy = y + dy;
    if (sx < 0 || sy < 0 || sx >= before.width || sy >= before.height - 220) continue;
    const i = sy * before.width + sx, j = y * after.width + x;
    if (!a.pure[i] || !b.pure[j]) continue;
    total++; if ((a.colour[i] ^ (invert ? 1 : 0)) === b.colour[j]) same++;
  }
  return same / total;
}
try {
  await page.goto(`${base}?play=0`); await ready();
  assert.deepEqual(await page.locator('canvas').evaluate(c => [c.width, c.height]), [2880, 2000], 'native retina resolution');
  assert.equal(await page.locator('#notice').isVisible(), false);
  const home = await pixels();
  await page.screenshot({path: `${shots}/weave-${label}-desktop.png`});
  // Two colours and nothing else: every pixel is black, white, or one of the
  // greys of the antialiased contour, and the two shares are equal.
  {
    const {pure} = classify(home);
    let greys = 0;
    for (let i = 0; i < pure.length; i++) if (!pure[i]) greys++;
    assert.ok(greys / pure.length < 0.05, `${(100 * greys / pure.length).toFixed(2)} % of pixels sit on the antialiased contour`);
    assert.ok(greys > 0, 'the contour is antialiased, not hard');
    const share = whiteShare(home);
    assert.ok(Math.abs(share - 0.5) < 0.03, `black and white share the screen: ${(100 * share).toFixed(2)} % white`);
    notes.push(`${(100 * share).toFixed(2)} % white, ${(100 * greys / pure.length).toFixed(2)} % on the contour`);
  }

  // ---- the two-colour symmetry, on the pixels the page draws ----
  // The half turn about the screen centre — the lattice origin — reverses the
  // colours exactly, and so does half a period, and so does a slide of half a
  // cell along either axis. Half a cell along BOTH axes changes nothing.
  const half = await shot('?play=0&phase=0.5');
  assert.ok(turnAgreement(home, home, 180, true) > 0.99, 'a half turn about the centre swaps black and white');
  assert.ok(turnAgreement(home, home, 180, false) < 0.05, 'and emphatically does not leave them alone');
  assert.ok(shiftAgreement(home, half, 0, 0, true) > 0.99, 'half a period swaps them too');
  assert.ok(shiftAgreement(home, half, 0, 0, false) < 0.05, 'and is not the same picture');
  // One lattice length is 380 CSS px = 760 device px at DPR 2; half a cell is 380.
  assert.ok(shiftAgreement(home, home, 380, 0, true) > 0.99, 'a slide of half a cell along x swaps them');
  assert.ok(shiftAgreement(home, home, 0, 380, true) > 0.99, 'and so does half a cell along y');
  assert.ok(shiftAgreement(home, home, 380, 380, false) > 0.99, 'while half a cell along both axes changes nothing at all');
  assert.ok(shiftAgreement(home, home, 760, 0, false) > 0.99, 'and a whole cell is the plain periodicity');
  // The glide the source page marks Y: reflect in the diagonal y = x through
  // the centre and slide a quarter cell along it — the colours stay put.
  {
    const a = classify(home), q = 190; // a quarter cell in device pixels
    const cx = home.width / 2, cy = home.height / 2;
    let same = 0, total = 0, swapped = 0;
    for (let y = -600; y <= 600; y += 2) for (let x = -600; x <= 600; x += 2) {
      const sx = Math.round(cx + y + q), sy = Math.round(cy + x + q);
      const dx = Math.round(cx + x), dy = Math.round(cy + y);
      if (sx < 0 || sy < 0 || sx >= home.width || sy >= home.height - 220) continue;
      if (dy >= home.height - 220) continue;
      const i = sy * home.width + sx, j = dy * home.width + dx;
      if (!a.pure[i] || !a.pure[j]) continue;
      total++;
      if (a.colour[i] === a.colour[j]) same++; else swapped++;
    }
    assert.ok(same / total > 0.99, `the glide Y keeps the colours: ${(100 * same / total).toFixed(2)} % (${swapped} swapped)`);
    notes.push(`the marked generator Y preserves the colours on ${(100 * same / total).toFixed(2)} % of the picture`);
  }
  // A quarter turn with a quarter period reproduces the animation; with three
  // quarters of a period it reverses the colours instead.
  const quarter = await shot('?play=0&phase=0.25');
  assert.ok(turnAgreement(home, quarter, -90, false) > 0.99, 'a quarter period turns the weave a quarter turn, colours kept');
  assert.ok(turnAgreement(home, quarter, -90, true) < 0.05, 'and does not also swap them');
  assert.ok(turnAgreement(home, quarter, 90, false) < 0.3, 'and the turn goes one way, not the other');
  const threeQuarters = await shot('?play=0&phase=0.75');
  assert.ok(turnAgreement(home, threeQuarters, -90, true) > 0.99, 'three quarters of a period turns it the same way and swaps the colours');
  notes.push('half turn, half period, half-cell slide, glide Y and the quarter turn all hold on rendered pixels');

  // ---- the shader against an independent reconstruction of the same rule ----
  // Every check above is self-consistent: a shader with a half-texel offset or
  // the wrong sense of turn could still satisfy them. So map each device pixel
  // back through the shader's own documented screen → lattice chain and compare
  // the colour it painted with the one the module's CPU rule computes there.
  {
    let checked = 0, wrong = 0;
    for (const [scale, phase, cx, cy] of [[380, 0, 1, 1], [1500, 0.41, 0.5, 0.5], [95, 0.77, 0.25, 0.75]]) {
      await page.goto(`${base}?play=0&scale=${scale}&phase=${phase}&x=${cx}&y=${cy}`); await ready();
      await page.waitForTimeout(150);
      const {cssWidth, cssHeight} = await page.locator('canvas').evaluate(c => ({cssWidth: c.clientWidth, cssHeight: c.clientHeight}));
      const image = await pixels();
      const plane = frameAt(volume, phase);
      const {colour, pure} = classify(image);
      // The control bar is white-on-black and reads as pure pattern pixels, so
      // the strip it covers is left out, as it is everywhere else here.
      for (let y = 4; y < image.height - 220; y += 9) for (let x = 4; x < image.width - 4; x += 9) {
        const i = y * image.width + x;
        if (!pure[i]) continue; // antialiased pixels carry no single answer
        // gl_FragCoord counts from the bottom left; the PNG counts from the top.
        const screenX = (x + 0.5) / image.width - 0.5;
        const screenY = -((image.height - y - 0.5) / image.height - 0.5);
        const point = [cx + screenX * cssWidth / scale, cy + screenY * cssHeight / scale];
        const value = bicubic(plane, point);
        // Skip pixels too near the contour for a half-pixel of sampling slack:
        // the rule must give the same answer everywhere inside the pixel, or
        // the pixel is one the shader is entitled to have rounded either way.
        const slack = 0.5 / (scale * (image.width / cssWidth));
        const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]]
          .map(([sx, sy]) => bicubic(plane, [point[0] + sx * slack, point[1] + sy * slack]));
        if (corners.some(corner => (corner > 0) !== (value > 0))) continue;
        checked++; if ((value > 0 ? 1 : 0) !== colour[i]) wrong++;
      }
    }
    assert.ok(checked > 20000, `enough pixels compared against the CPU reconstruction (${checked})`);
    assert.equal(wrong, 0, `the shader paints sign(U(x,t) − U(−x,t)): ${wrong} of ${checked} pixels disagree`);
    notes.push(`shader matches the CPU rule on ${checked} pixels`);
  }
  // And the alternate: ?rule=v is the V channel's twill. At the same phase it
  // looks like another picture — the two sign fields agree on only a fifth of
  // the samples — but that is a phase shift seen head on. w_V(x, t) =
  // w_U(x, t − 51/128 T), so ?rule=v at phase 0 is the shipped rule at phase
  // 1 − 51/128 = 0.6015625, and on real pixels the two are the same frame.
  {
    const other = await shot('?play=0&rule=v');
    assert.ok(averageDifference(home, other) > 20, 'at the same phase the V rule looks unlike the U rule');
    assert.ok(Math.abs(whiteShare(other) - 0.5) < 0.03, 'and is balanced too');
    assert.ok(turnAgreement(other, other, 180, true) > 0.99, 'and obeys the same half-turn colour law');
    assert.match(await statsText(), /rule V/, 'and says so in the stats line');
    const shifted = await shot(`?play=0&phase=${1 - 51 / 128}`);
    const {colour: a, pure: pa} = classify(other), {colour: b, pure: pb} = classify(shifted);
    let same = 0, total = 0;
    for (let i = 0; i < a.length; i++) { if (!pa[i] || !pb[i]) continue; total++; if (a[i] === b[i]) same++; }
    assert.ok(same / total > 0.95, `the V rule is the U rule 51/128 of a period earlier: ${(100 * same / total).toFixed(2)} % of pure pixels`);
    notes.push(`?rule=v is the shipped rule at phase 0.602 on ${(100 * same / total).toFixed(2)} % of pixels, not a second picture`);
  }

  await page.goto(`${base}?play=0`); await ready();

  // ---- framing, tiling and the endless pan ----
  await page.setViewportSize({width: 760, height: 760});
  const square = await pixels();
  assert.ok(averageDifference(home, square, 680, 240, 0, 0, 1520, 1300) < 1, 'centre crop retains exact scale');
  await page.setViewportSize({width: 1520, height: 1000});
  const repeated = await pixels();
  assert.ok(averageDifference(repeated, repeated, 0, 0, 760, 0, 2200, 1600) < 1, 'periodic tiling has no seam or orientation change');

  // A resize is a relayout, not a motion. The framing follows the shorter side,
  // so a new viewport moves the picture by a lot in a single draw with nothing
  // having travelled; smearing the shutter across that step produces a blurred
  // frame with no motion behind it — which is how the social card came out six
  // times softer than the page it advertises. The frame drawn straight after a
  // resize must be as crisp as the page at rest.
  {
    const greyShare = image => {
      let grey = 0;
      for (let i = 0; i < image.width * image.height; i++) { const v = image.data[4 * i]; if (v > 32 && v < 223) grey++; }
      return grey / (image.width * image.height);
    };
    await page.setViewportSize({width: 1080, height: 1080});
    await page.waitForTimeout(150);
    await page.setViewportSize({width: 1200, height: 630});
    const justResized = await pixels(); // the very next painted frame
    assert.match(await statsText(), /shutter off \(of 3\)/, 'the frame after a resize is not integrated');
    // Redraw the same view once the resize is well behind it, and compare: the
    // frame painted on the resize must be the settled frame, bit for bit.
    await page.waitForTimeout(300);
    await page.evaluate(() => dispatchEvent(new Event('resize')));
    await page.waitForTimeout(200);
    const settled = await pixels();
    assert.equal(averageDifference(justResized, settled), 0, 'the frame painted on a resize is the settled frame exactly');
    // And it is a crisp two-tone frame, not a grey ramp: the smeared card the
    // old exporter produced ran to 11 % mid-grey at this size.
    assert.ok(greyShare(justResized) < 0.07, `${(100 * greyShare(justResized)).toFixed(2)} % of the frame after a resize is mid-grey`);
    notes.push(`a resize paints the settled frame exactly (${(100 * greyShare(justResized)).toFixed(2)} % mid-grey, no smear)`);
  }

  await page.setViewportSize({width: 390, height: 844});
  const phone = await pixels();
  // A narrow phone keeps two repeats across: 195 CSS px = 390 device px.
  assert.ok(averageDifference(phone, phone, 0, 0, 390, 0, 390, 1400) < 1, 'phone view repeats every 195 CSS px');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth && document.documentElement.scrollHeight === innerHeight), 'mobile fills viewport without scrolling');
  const bounds = await page.locator('#controls').boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, 'mobile controls fit');
  await page.screenshot({path: `${shots}/weave-${label}-mobile.png`});

  await page.setViewportSize({width: 1280, height: 800});
  const beforeDrag = await pixels();
  assert.equal(await page.locator('#reset').isVisible(), false, 'reset hidden at home');
  await page.mouse.move(640, 300); await page.mouse.down();
  await page.mouse.move(700, 300, {steps: 4}); await page.mouse.move(735, 300, {steps: 4});
  await page.waitForTimeout(200); // A pause before release means no fling.
  await page.mouse.up();
  await page.waitForTimeout(300);
  const afterDrag = await pixels();
  assert.ok(averageDifference(beforeDrag, afterDrag, 0, 0, 190, 0, 2200, 1200) < 1.5, 'the pattern moved with the pointer');
  assert.ok(averageDifference(beforeDrag, afterDrag, 0, 0, 0, 0, 2200, 1200) > 5, 'and it moved');
  assert.equal(await page.locator('#reset').isVisible(), true, 'reset shown after panning');
  // A quick release keeps the pattern gliding for a moment, then it settles.
  await page.mouse.move(640, 500); await page.mouse.down();
  await page.mouse.move(540, 500, {steps: 3}); await page.mouse.up();
  await page.waitForTimeout(120);
  const gliding = await pixels();
  await page.waitForTimeout(250);
  assert.ok(averageDifference(gliding, await pixels()) > 3, 'inertia keeps panning after release');
  await page.waitForTimeout(1600);
  const atRest = await pixels();
  await page.waitForTimeout(200);
  assert.equal(averageDifference(atRest, await pixels()), 0, 'and it comes to rest');
  const afterFling = await statsText();
  assert.equal(turnOf(afterFling), 0, 'a one-finger drag never turns the view');
  assert.equal(scaleOf(afterFling), 380, 'nor zooms it');
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(300);
  const wheelScale = scaleOf(await statsText());
  assert.ok(wheelScale > 380 && wheelScale < 900, `wheel zoomed in to ${wheelScale} px per repeat`);
  await page.keyboard.press('0');
  await page.keyboard.press('+');
  await page.waitForTimeout(300);
  assert.equal(scaleOf(await statsText()), 475, 'the + key zooms 1.25× about the centre');
  const zoomed = await pixels();
  assert.ok(averageDifference(zoomed, zoomed, 0, 0, 950, 0, 1000, 1000) < 1, 'zoomed tiling repeats every 950 device px');
  assert.ok(averageDifference(zoomed, zoomed, 0, 0, 760, 0, 1000, 1000) > 5, 'and no longer every 760');
  await page.keyboard.press('0');
  await page.waitForTimeout(300);
  assert.equal(averageDifference(beforeDrag, await pixels()), 0, 'the 0 key restores the home view exactly');
  assert.equal(await page.locator('#reset').isVisible(), false);
  // A two-finger pinch zooms in as well.
  await fingers(Array.from({length: 6}, (_, i) => [[600 - 8 * i, 400], [680 + 8 * i, 400]]));
  await page.waitForTimeout(800);
  const pinchedScale = scaleOf(await statsText());
  assert.ok(pinchedScale >= 760, `pinching the fingers apart at least doubled the repeat: ${pinchedScale} px`);
  // The tiling at an exact scale is checked at the + key's 475 px above; the
  // scale a pinch lands on is whatever the glide chose, and the stats line
  // rounds it, so a pixel comparison here would be testing the rounding. (On a
  // two-colour picture a half-pixel misalignment is a full black/white flip.)
  assert.ok(averageDifference(beforeDrag, await pixels()) > 5, 'and the picture changed');
  await page.locator('#reset').click();
  await page.waitForTimeout(300);
  assert.equal(averageDifference(beforeDrag, await pixels()), 0, 'the reset button restores the home view');
  // Two fingers turning about the screen centre: 87° must settle on a quarter
  // turn, since the lattice is square — and a quarter turn with a quarter
  // period is one of the picture's own colour-preserving operations. (87° is
  // inside the 4° snap, so the turn lands on 90° whether the release throws it
  // there or the fingers simply stop: real touch input carries time between its
  // events and synthetic pointer events do not.)
  const spin = t => { const a = t * 87 * Math.PI / 180, r = 90; return [[640 - r * Math.cos(a), 400 - r * Math.sin(a)], [640 + r * Math.cos(a), 400 + r * Math.sin(a)]]; };
  await fingers(Array.from({length: 9}, (_, i) => spin(i / 8)));
  await page.waitForTimeout(1200);
  const spun = await pixels();
  const spunText = await statsText();
  const spunAngle = turnOf(spunText);
  assert.equal(spunAngle % 90, 0, `the two-finger turn settled on a quarter turn: ${spunText}`);
  assert.ok(spunAngle >= 87, `and carried at least as far as the fingers turned: ${spunAngle}°`);
  assert.equal(scaleOf(spunText), 380, 'and a turn does not zoom');
  await page.goto(`${base}?play=0&angle=${spunAngle}`); await ready();
  await page.waitForTimeout(150);
  assert.ok(averageDifference(spun, await pixels()) < 1.5, `the two-finger turn landed on the quarter turn the URL asks for (${spunAngle}°)`);
  // A quarter turn of the VIEW is a symmetry of the lattice but not of a single
  // frame: the weave turns with it, so the picture is not the one it started at.
  await page.goto(`${base}?play=0`); await ready(); await page.waitForTimeout(150);

  // ---- the Mac trackpad: a pinch and a turn at the same time ----
  const patterns = {
    split: [['gesturestart', 1, 0], ['gesturechange', 1.2, 0], ['gesturechange', 1, 15], ['gesturechange', 1.4, 0], ['gesturechange', 1, 30], ['gestureend', 1, 30]],
    platform: [['gesturestart', 1, 0], ['gesturechange', 1.2, 0], ['gesturechange', 0, 15], ['gesturechange', 1.4, 0], ['gesturechange', 0, 30], ['gestureend', 0, 30]],
    both: [['gesturestart', 1, 0], ['gesturechange', 1.2, 0], ['gesturechange', 1.2, 15], ['gesturechange', 1.4, 15], ['gesturechange', 1.4, 30], ['gestureend', 1.4, 30]],
    turnfirst: [['gesturestart', 1, 0], ['gesturechange', 1, 10], ['gesturechange', 1.15, 0], ['gesturechange', 1, 30], ['gesturechange', 1.4, 0], ['gestureend', 1.4, 0]],
  };
  let native = null;
  for (const [name, steps] of Object.entries(patterns)) {
    await page.keyboard.press('0');
    native = await gesture(steps);
    await page.waitForTimeout(150);
    const text = await statsText();
    assert.equal(scaleOf(text), 532, `${name}: pinched to 1.4× (380 → 532 px per repeat), not ${scaleOf(text)}`);
    assert.equal(turnOf(text), 30, `${name}: turned 30° at the same time, not ${turnOf(text)}°`);
  }
  notes.push(native ? 'native Safari gesture events' : 'Safari gesture handler driven by synthetic events');
  await page.keyboard.press('0');
  await gesture(patterns.split.slice(0, -1));
  const diagnostic = await statsText();
  assert.match(diagnostic, /gesture raw 1\.000\/30\.000/, `raw fields of the last event: ${diagnostic}`);
  assert.match(diagnostic, /flat 2s 2r both 0 of 4/, `counts of events naming no scale \/ no rotation: ${diagnostic}`);
  assert.match(diagnostic, /kept 1\.400×\/30\.0°/, `the two accumulators: ${diagnostic}`);
  await gesture([['gestureend', 1, 30]]);
  await page.keyboard.press('0');
  await gesture(patterns.both.slice(0, -1));
  assert.match(await statsText(), /flat 0s 1r both 3 of 4/, 'a cumulative Safari is recognised as such');
  await gesture([['gestureend', 1.4, 30]]);
  // Once both streams have spoken, an event naming neither is ambiguous and is
  // held: the zoom survives a turn passing back through 0°, and the other way.
  await page.keyboard.press('0');
  await gesture([['gesturestart', 1, 0], ['gesturechange', 1.4, 0], ['gesturechange', 1, 20], ['gesturechange', 1, 0]]);
  await page.waitForTimeout(120);
  const throughZero = await statsText();
  assert.equal(scaleOf(throughZero), 532, `the zoom survives a turn passing through 0°: ${throughZero}`);
  assert.equal(turnOf(throughZero), 20, 'and the turn is held at its last named value');
  assert.match(throughZero, /held 1/, `the ambiguous event is counted as held: ${throughZero}`);
  await gesture([['gesturechange', 1, -15], ['gestureend', 1, -15]]);
  await page.waitForTimeout(120);
  const resumed = await statsText();
  assert.equal(turnOf(resumed), -15, 'the next turn event lands');
  assert.equal(scaleOf(resumed), 532, 'with the zoom still in force');
  await page.keyboard.press('0');
  await gesture([['gesturestart', 1, 0], ['gesturechange', 1, 20], ['gesturechange', 1.4, 0], ['gesturechange', 1, 0], ['gestureend', 1, 0]]);
  await page.waitForTimeout(120);
  const mirrored = await statsText();
  assert.equal(turnOf(mirrored), 20, `the turn survives a pinch passing through 1×: ${mirrored}`);
  assert.equal(scaleOf(mirrored), 532, 'and the zoom is held at its last named value');
  // A pinch back to exactly 1×, in a stream that has only ever pinched, arrives.
  await page.keyboard.press('0');
  await gesture([['gesturestart', 1, 0], ['gesturechange', 1.3, 0], ['gesturechange', 1, 0], ['gestureend', 1, 0]]);
  await page.waitForTimeout(120);
  assert.equal(scaleOf(await statsText()), 380, 'a pinch back to 1× returns to the home scale');
  // The turn still snaps — to a quarter turn here.
  await page.keyboard.press('0');
  await gesture([['gesturestart', 1, 0], ['gesturechange', 1.5, 0], ['gesturechange', 1, 88], ['gestureend', 1, 88]]);
  await page.waitForTimeout(150);
  const snapped = await statsText();
  assert.equal(turnOf(snapped), 90, 'the trackpad turn snapped to a quarter turn');
  assert.equal(scaleOf(snapped), 570, 'and the zoom survived the snap');
  // Gesture events arriving while fingers are down are ignored.
  await page.keyboard.press('0');
  const beforeTouch = await pixels();
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const fire = (type, id, x, y) => canvas.dispatchEvent(new PointerEvent(type, {pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x, clientY: y, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true}));
    fire('pointerdown', 1, 600, 400); fire('pointerdown', 2, 700, 400);
  });
  await gesture([['gesturestart', 1, 0], ['gesturechange', 2.5, 0], ['gesturechange', 1, 45], ['gestureend', 1, 45]]);
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    for (const id of [1, 2]) canvas.dispatchEvent(new PointerEvent('pointerup', {pointerId: id, pointerType: 'touch', clientX: 650, clientY: 400, buttons: 0, bubbles: true, cancelable: true}));
  });
  await page.waitForTimeout(150);
  assert.equal(averageDifference(beforeTouch, await pixels()), 0, 'gesture events are ignored while fingers are down');
  // The Mac fallbacks: the turn keys repeat while held, and Option with the
  // wheel turns about the pointer.
  await page.keyboard.press('0');
  await gesture([['gesturestart', 1, 0], ['gesturechange', 1.5, 0]]);
  await page.keyboard.press(']');
  await page.waitForTimeout(80);
  const keyDuring = await statsText();
  assert.equal(turnOf(keyDuring), 15, 'a turn key works during a trackpad pinch');
  assert.equal(scaleOf(keyDuring), 570, 'and the pinch is still in force');
  await gesture([['gesturechange', 2, 0], ['gestureend', 2, 0]]);
  await page.waitForTimeout(120);
  const keyAfter = await statsText();
  assert.equal(turnOf(keyAfter), 15, 'the next gesture event does not undo the key turn');
  assert.equal(scaleOf(keyAfter), 760, 'and the pinch goes on from where it was');
  await page.keyboard.press('0');
  await page.mouse.move(640, 400);
  await page.keyboard.down('Alt');
  await page.mouse.wheel(0, -120);
  await page.keyboard.up('Alt');
  await page.waitForTimeout(150);
  const optionWheel = await statsText();
  assert.ok(turnOf(optionWheel) > 0, `Option and the wheel turn the pattern (${turnOf(optionWheel)}°)`);
  assert.equal(scaleOf(optionWheel), 380, 'and do not zoom');
  await page.keyboard.press('0');
  await page.keyboard.press(']'); await page.waitForTimeout(150);
  assert.match(await statsText(), /turned 15°/);
  await page.keyboard.press('['); await page.keyboard.press('Shift+]'); await page.waitForTimeout(150);
  assert.match(await statsText(), /turned 60°/, 'Shift and ] turn 60° by hand, wherever the lattice happens to like');
  await page.keyboard.press('0'); await page.waitForTimeout(300);
  assert.equal(averageDifference(beforeDrag, await pixels()), 0, 'reset also clears the turn');

  // ---- the shutter (temporal anti-aliasing) ----
  await page.goto(`${base}?play=0&taa=0`); await ready();
  const still = await pixels();
  assert.match(await statsText(), /shutter off/, 'the stats overlay names the shutter');
  await page.goto(`${base}?play=0&taa=3`); await ready();
  assert.equal(averageDifference(still, await pixels()), 0, 'a paused frame is identical with and without the shutter');
  await page.goto(`${base}?play=0&taa=5`); await ready();
  assert.equal(averageDifference(still, await pixels()), 0, 'five layers make no difference to a still picture either');
  for (const query of ['play=0&motion=0', 'play=0&taa=5&shutter=2&motion=0']) {
    await page.goto(`${base}?${query}`); await ready();
    await page.waitForTimeout(400);
    assert.equal(averageDifference(still, await pixels()), 0, `?${query} draws the same bits as no shutter at all`);
    assert.match(await statsText(), /shutter off \(of [35]\)/, `?${query} pays for one sub-sample`);
  }
  // The gate is on the SMEAR the shutter would draw — travel × shutter — so at
  // the home framing (0.36 px a frame) it stays off, and the pattern engages it
  // by itself only past about 2670 CSS px per repeat.
  await page.goto(`${base}?taa=3&play=1&stats=1`); await ready();
  await page.waitForTimeout(600);
  const homeStats = await page.locator('#stats').textContent();
  assert.match(homeStats, /shutter off \(of 3\)/, `the home framing does not pay for a shutter: ${homeStats}`);
  assert.match(homeStats, /(9|16) taps/, `one sampling of the field per pixel: ${homeStats}`);
  for (const [scale, on] of [[2400, false], [3000, true]]) {
    await page.goto(`${base}?taa=3&play=1&stats=1&scale=${scale}`); await ready();
    await page.waitForTimeout(600);
    const text = await page.locator('#stats').textContent();
    assert.match(text, on ? /shutter 3×0\.30 frame/ : /shutter off \(of 3\)/, `the default shutter at ${scale} px per repeat: ${text}`);
    if (on) assert.match(text, /(27|48) taps/, `and three samplings of the field per pixel: ${text}`);
  }
  await page.goto(`${base}?taa=3&play=1&stats=1&scale=2400&shutter=1`); await ready();
  await page.waitForTimeout(600);
  assert.match(await page.locator('#stats').textContent(), /shutter 3×1\.00 frame/, 'a full box filter engages sooner');
  await page.goto(`${base}?taa=3&play=1&stats=1&scale=2400&shutter=0`); await ready();
  await page.waitForTimeout(400);
  const zeroWidth = await page.locator('#stats').textContent();
  assert.match(zeroWidth, /shutter off \(of 3\)/, `a zero-width shutter draws one layer: ${zeroWidth}`);
  assert.match(zeroWidth, /(9|16) taps/, `and costs one: ${zeroWidth}`);

  // ---- what the shutter is for: the judder of a fast motion ----
  // The fastest thing this page ever shows is not the animation but a drag or a
  // glide, so the shutter integrates the view as well as the phase. Two
  // consecutive displayed frames with the view panning 12 CSS px between them,
  // with the shutter and without: the share of pixels flipping from black to
  // white or back must fall.
  const panned = await page.evaluate(async ({base}) => {
    const mod = await import(`${base}renderer.mjs`);
    const bytes = await (await fetch(`${base}field.f32`)).arrayBuffer();
    const field = new Float32Array(bytes);
    const W = 480, H = 300, FRAME = 1000 / 60;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = `position:fixed;left:0;top:0;width:${W}px;height:${H}px;opacity:0.01;pointer-events:none`;
    document.body.append(canvas);
    const gl = () => canvas.getContext('webgl2');
    const read = () => { const px = new Uint8Array(canvas.width * canvas.height * 4); gl().readPixels(0, 0, canvas.width, canvas.height, gl().RGBA, gl().UNSIGNED_BYTE, px); return px; };
    function pair(taa, panPx, shutter = mod.SHUTTER) {
      const view = mod.createView({tilePixels: 380, center: mod.CENTER});
      const renderer = mod.createRenderer(canvas, field, {view, pixelRatio: 1, adaptive: false, display: FRAME, taa, shutter});
      view.panBy(-panPx, 0, W, H);
      renderer.draw(0.2, {continuous: true, moving: false, time: 1000});
      view.panBy(panPx, 0, W, H);
      renderer.draw(0.2, {continuous: true, moving: false, time: 1000 + FRAME});
      const a = read();
      view.panBy(panPx, 0, W, H);
      renderer.draw(0.2, {continuous: true, moving: false, time: 1000 + 2 * FRAME});
      const b = read();
      const layers = renderer.layers;
      renderer.dispose();
      // Black to white is a jump of 255; anything over 200 is a whole flip.
      let flips = 0;
      for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 200) flips++;
      return {layers, flips: 100 * flips / (a.length / 4)};
    }
    const out = {still: pair(3, 0), off: pair(1, 12), on: pair(3, 12), full: pair(3, 12, 1)};
    canvas.remove();
    return out;
  }, {base});
  assert.equal(panned.still.layers, 1, 'a still view at the home framing uses one sub-sample');
  assert.equal(panned.off.layers, 1, '?taa=1 is no shutter at all');
  assert.equal(panned.on.layers, 3, 'a 12 px pan engages the shutter even with the phase held still');
  assert.ok(panned.off.flips > 3, `a 12 px pan without the shutter flips ${panned.off.flips.toFixed(2)}% of pixels between frames`);
  assert.ok(panned.full.flips < 0.6 * panned.off.flips, `a full-frame shutter must remove most of that (${panned.off.flips.toFixed(2)}% → ${panned.full.flips.toFixed(2)}%)`);
  assert.ok(panned.on.flips < 0.95 * panned.off.flips, `the default shutter must still reduce it (${panned.off.flips.toFixed(2)}% → ${panned.on.flips.toFixed(2)}%)`);
  notes.push(`pan judder ${panned.off.flips.toFixed(2)}% → ${panned.on.flips.toFixed(2)}% of pixels at the default shutter, → ${panned.full.flips.toFixed(2)}% at a full frame`);

  // ---- momentum: what keeps moving after the fingers lift ----
  const open = async query => { await page.goto(`${base}?play=0&stats=1&${query}`); await ready(); await page.waitForTimeout(150); };
  const twoFingers = ({frames, gap = 16, record = 1400, hold = 0, interrupt = null}) => page.evaluate(async ({frames, gap, record, hold, interrupt}) => {
    const canvas = document.querySelector('canvas');
    const stats = document.querySelector('#stats');
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const drawn = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const fire = (type, [x, y], id) => canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x, clientY: y,
      buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true,
    }));
    frames[0].forEach((point, i) => fire('pointerdown', point, i + 1));
    for (const frame of frames.slice(1)) { if (gap) await wait(gap); frame.forEach((point, i) => fire('pointermove', point, i + 1)); }
    if (hold) await wait(hold);
    await drawn();
    const release = stats.textContent;
    frames[frames.length - 1].forEach((point, i) => fire('pointerup', point, i + 1));
    const t0 = performance.now(), trace = [];
    return new Promise(resolve => {
      let tapped = false;
      const tick = () => {
        const t = performance.now() - t0;
        trace.push({t, text: stats.textContent});
        if (interrupt && !tapped && t >= interrupt.after) {
          tapped = true;
          fire('pointerdown', interrupt.at, 9);
          fire('pointerup', interrupt.at, 9);
        }
        if (t < record) requestAnimationFrame(tick); else resolve({release, trace});
      };
      requestAnimationFrame(tick);
    });
  }, {frames, gap, record, hold, interrupt});
  /** Fingers `d` CSS px apart, turned `deg` about `at`. */
  const pair = (d, deg = 0, at = [640, 400]) => {
    const a = deg * Math.PI / 180, r = d / 2;
    return [[at[0] - r * Math.cos(a), at[1] - r * Math.sin(a)], [at[0] + r * Math.cos(a), at[1] + r * Math.sin(a)]];
  };
  const spread = (from, to, steps) => Array.from({length: steps}, (_, i) => pair(from + (to - from) * i / (steps - 1)));
  const rising = values => { let n = 0; for (let i = 1; i < values.length; i++) if (values[i] > values[i - 1]) n++; else break; return n; };
  const settled = values => values.slice(-6).every(v => v === values[values.length - 1]);

  // A pinch that is still opening when the fingers lift carries on opening.
  await open('scale=600');
  let {release, trace} = await twoFingers({frames: spread(120, 300, 9)});
  let scales = trace.map(s => scaleOf(s.text));
  assert.ok(rising(scales) >= 2, `the zoom keeps growing after the release: ${scales.slice(0, 8)}`);
  assert.ok(scales[scales.length - 1] > scaleOf(release) * 1.05, `and by more than a rounding: ${scaleOf(release)} → ${scales[scales.length - 1]}`);
  assert.ok(settled(scales), `and settles: ${scales.slice(-8)}`);
  assert.ok(scales[scales.length - 1] <= MAX_SCALE);
  notes.push(`pinch throw: ${scaleOf(release)} → ${scales[scales.length - 1]} px per repeat`);
  // A pinch held still before lifting throws nothing.
  await open('scale=600');
  ({release, trace} = await twoFingers({frames: spread(120, 300, 9), hold: 260, record: 600}));
  scales = trace.map(s => scaleOf(s.text));
  assert.equal(scales[scales.length - 1], scaleOf(release), `a pinch that stopped before lifting throws nothing: ${scaleOf(release)} → ${scales[scales.length - 1]}`);
  // A thrown turn lands on a quarter turn.
  await open('');
  ({release, trace} = await twoFingers({frames: Array.from({length: 9}, (_, i) => pair(200, 70 * i / 8))}));
  let turns = trace.map(s => turnOf(s.text));
  assert.ok(turns[turns.length - 1] > turnOf(release) + 4, `the turn keeps turning after the release: ${turnOf(release)}° → ${turns[turns.length - 1]}°`);
  assert.equal(turns[turns.length - 1] % 90, 0, `and lands on a quarter turn: ${turns[turns.length - 1]}°`);
  assert.ok(settled(turns), `and settles: ${turns.slice(-8)}`);
  notes.push(`thrown turn: ${turnOf(release)}° → ${turns[turns.length - 1]}°`);
  // The top of the zoom range gives, and springs back to the limit exactly. The
  // pinch itself must stop short of the limit: a pinch that runs into one stops
  // changing the scale, and a scale that stopped changing is not a velocity.
  await open('scale=7000');
  ({release, trace} = await twoFingers({frames: spread(120, 135, 9), record: 1200}));
  scales = trace.map(s => scaleOf(s.text));
  const peak = Math.max(...scales), rest = scales[scales.length - 1];
  assert.ok(scaleOf(release) < MAX_SCALE, `the pinch itself stops short of the limit: ${scaleOf(release)}`);
  assert.ok(peak > MAX_SCALE, `the glide passes the limit rather than hitting it: peak ${peak}`);
  assert.ok(peak <= Math.round(MAX_SCALE * Math.exp(ELASTIC_GIVE)), `by no more than the give: ${peak} of ${Math.round(MAX_SCALE * Math.exp(ELASTIC_GIVE))}`);
  assert.equal(rest, MAX_SCALE, `and returns to the limit exactly: ${rest}`);
  assert.ok(settled(scales), 'and stays there');
  notes.push(`elastic: peak ${peak} px per repeat, ${(100 * (peak / MAX_SCALE - 1)).toFixed(1)}% past the limit, resting at ${rest}`);
  // A glide cut short *while it is outside the limits* must still land inside
  // them. The elastic excursion is the one moment the view is allowed past
  // 8000, and only because the glide is going to put it back; a finger landing
  // at the peak has to do the putting back itself.
  for (const after of [90, 140]) {
    await open('scale=7000');
    ({release, trace} = await twoFingers({frames: spread(120, 135, 9), record: 900, interrupt: {after, at: [300, 300]}}));
    scales = trace.map(s => scaleOf(s.text));
    assert.ok(Math.max(...scales) > MAX_SCALE, `the glide did pass the limit before the tap: ${Math.max(...scales)}`);
    assert.equal(scales[scales.length - 1], MAX_SCALE, `a tap ${after} ms in, during the elastic, still rests on the limit: ${scales[scales.length - 1]}`);
  }
  // The same at the floor, where a glide gives below the smallest scale the
  // page allows — one texel of the 96-texel reconstruction grid per device pixel.
  await open('scale=75');
  const floor = await page.evaluate(() => Math.max(24, 96 / (devicePixelRatio || 1)));
  ({release, trace} = await twoFingers({frames: spread(220, 150, 9), record: 900, interrupt: {after: 90, at: [300, 300]}}));
  scales = trace.map(s => scaleOf(s.text));
  assert.ok(Math.min(...scales) < floor, `the glide dips under the floor: ${Math.min(...scales)} of ${floor}`);
  assert.equal(scales[scales.length - 1], floor, `and a tap in the dip leaves it on the floor: ${scales[scales.length - 1]}`);
  notes.push(`a glide cut short inside its elastic rests on the limit exactly (${MAX_SCALE} and ${floor} px per repeat)`);
  // A new finger stops the glide where it is.
  await open('scale=600');
  ({release, trace} = await twoFingers({frames: spread(120, 260, 9), record: 900, interrupt: {after: 60, at: [300, 300]}}));
  scales = trace.map(s => scaleOf(s.text));
  const tapped = trace.findIndex(s => s.t >= 60);
  assert.ok(scales[scales.length - 1] <= scales[tapped] + 3, `a tap stops the glide: ${scales[tapped]} at the tap, ${scales[scales.length - 1]} at the end`);
  assert.ok(scales[scales.length - 1] > scaleOf(release), 'though what it had already gained is kept');
  assert.ok(settled(scales), 'and nothing carries on afterwards');
  // A burst of wheel events glides on, gently; one notch does not glide at all.
  await open('scale=600');
  const wheel = await page.evaluate(async ({count, delta}) => {
    const canvas = document.querySelector('canvas'), stats = document.querySelector('#stats');
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const drawn = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const roll = () => canvas.dispatchEvent(new WheelEvent('wheel', {deltaY: delta, clientX: 640, clientY: 400, bubbles: true, cancelable: true}));
    await drawn();
    const before = stats.textContent;
    for (let i = 0; i < count; i++) { roll(); await wait(18); }
    await drawn();
    const burst = stats.textContent;
    const t0 = performance.now(), trace = [];
    return new Promise(resolve => {
      const tick = () => {
        trace.push({t: performance.now() - t0, text: stats.textContent});
        if (performance.now() - t0 < 800) requestAnimationFrame(tick); else resolve({before, burst, trace});
      };
      requestAnimationFrame(tick);
    });
  }, {count: 4, delta: -90});
  const wheelScales = wheel.trace.map(s => scaleOf(s.text));
  const wheelEnd = wheelScales[wheelScales.length - 1], wheelBurst = scaleOf(wheel.burst);
  assert.ok(wheelBurst > scaleOf(wheel.before) * 1.5, `four notches zoomed in: ${scaleOf(wheel.before)} → ${wheelBurst}`);
  assert.ok(wheelEnd > wheelBurst * 1.05, `the burst glides on: ${wheelBurst} → ${wheelEnd}`);
  assert.ok(wheelEnd < wheelBurst * 1.35, `but gently: ${wheelBurst} → ${wheelEnd}`);
  assert.ok(settled(wheelScales), `and settles: ${wheelScales.slice(-10)}`);
  await open('scale=600');
  const notch = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas'), stats = document.querySelector('#stats');
    const drawn = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    canvas.dispatchEvent(new WheelEvent('wheel', {deltaY: -90, clientX: 640, clientY: 400, bubbles: true, cancelable: true}));
    await drawn();
    const after = stats.textContent;
    await new Promise(resolve => setTimeout(resolve, 500));
    await drawn();
    return {after, rest: stats.textContent};
  });
  assert.equal(scaleOf(notch.rest), scaleOf(notch.after), `one notch of the wheel moves exactly as far as it asks: ${scaleOf(notch.after)} → ${scaleOf(notch.rest)}`);
  // Reduced motion gets no glide at all.
  await page.emulateMedia({reducedMotion: 'reduce'});
  await open('scale=600');
  ({release, trace} = await twoFingers({frames: spread(120, 260, 9), record: 600}));
  scales = trace.map(s => scaleOf(s.text));
  assert.equal(scales[scales.length - 1], scaleOf(release), `reduced motion stops where the fingers stopped: ${scaleOf(release)} → ${scales[scales.length - 1]}`);
  await page.emulateMedia({reducedMotion: 'no-preference'});
  // The Mac trackpad throws too.
  const trackpadThrow = async ({steps, gap = 16, record = 1200}) => {
    const tail = steps[steps.length - 1];
    await gesture(steps.slice(0, -1), [720, 400], {gap});
    return page.evaluate(({tail, at, record}) => {
      const canvas = document.querySelector('canvas'), stats = document.querySelector('#stats');
      const fire = (type, scale, rotation) => {
        let event;
        try {
          event = document.createEvent('GestureEvent');
          event.initGestureEvent(type, true, true, window, 0, 0, 0, at[0], at[1], false, false, false, false, canvas, scale, rotation);
        } catch {
          event = new Event(type, {bubbles: true, cancelable: true});
          Object.defineProperties(event, {scale: {value: scale}, rotation: {value: rotation}, clientX: {value: at[0]}, clientY: {value: at[1]}});
        }
        canvas.dispatchEvent(event);
      };
      const release = stats.textContent;
      fire(tail[0], tail[1], tail[2]);
      const t0 = performance.now(), trace = [];
      return new Promise(resolve => {
        const tick = () => {
          trace.push({t: performance.now() - t0, text: stats.textContent});
          if (performance.now() - t0 < record) requestAnimationFrame(tick); else resolve({release, trace});
        };
        requestAnimationFrame(tick);
      });
    }, {tail, at: [720, 400], record});
  };
  const magnify = [['gesturestart', 1, 0], ['gesturechange', 1.15, 0], ['gesturechange', 1.3, 0], ['gesturechange', 1.45, 0], ['gesturechange', 1.6, 0], ['gestureend', 1.6, 0]];
  const rotate = [['gesturestart', 1, 0], ['gesturechange', 1, 16], ['gesturechange', 1, 32], ['gesturechange', 1, 48], ['gesturechange', 1, 62], ['gestureend', 1, 62]];
  await open('scale=600');
  let pad = await trackpadThrow({steps: magnify});
  let padScales = pad.trace.map(s => scaleOf(s.text));
  assert.ok(rising(padScales) >= 2, `a trackpad pinch keeps zooming after the fingers lift: ${padScales.slice(0, 8)}`);
  assert.ok(padScales[padScales.length - 1] > scaleOf(pad.release) * 1.05, `and by more than a rounding: ${scaleOf(pad.release)} → ${padScales[padScales.length - 1]}`);
  assert.ok(padScales[padScales.length - 1] <= MAX_SCALE, 'and stops inside the limits');
  assert.ok(settled(padScales), `and settles: ${padScales.slice(-8)}`);
  notes.push(`trackpad pinch: ${scaleOf(pad.release)} → ${padScales[padScales.length - 1]} px per repeat`);
  await open('');
  pad = await trackpadThrow({steps: rotate});
  const padTurns = pad.trace.map(s => turnOf(s.text));
  assert.ok(padTurns[padTurns.length - 1] > turnOf(pad.release) + 8, `a trackpad turn keeps turning: ${turnOf(pad.release)}° → ${padTurns[padTurns.length - 1]}°`);
  assert.ok(settled(padTurns), `and settles: ${padTurns.slice(-8)}`);
  assert.equal(padTurns[padTurns.length - 1] % 90, 0, `on a quarter turn: ${padTurns[padTurns.length - 1]}°`);
  assert.equal(scaleOf(pad.trace[pad.trace.length - 1].text), scaleOf(pad.release), 'and a turn-only stream does not zoom');
  notes.push(`trackpad turn: ${turnOf(pad.release)}° → ${padTurns[padTurns.length - 1]}°`);
  await open('scale=600');
  await gesture(magnify.slice(0, -1), [720, 400], {gap: 16});
  await page.waitForTimeout(250);
  const stalled = await statsText();
  await gesture([magnify[magnify.length - 1]], [720, 400]);
  await page.waitForTimeout(500);
  assert.equal(scaleOf(await statsText()), scaleOf(stalled), 'a trackpad pinch that stopped before lifting throws nothing');

  // ---- the rest of the viewer ----
  await page.goto(`${base}?play=0`); await ready();
  assert.match(await statsText(), /2560×1600 px · quality 1\.00 · 380 px per repeat · (9|16) taps/);
  assert.equal(await page.locator('#stats').isVisible(), false);
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
    await page.waitForFunction(() => document.body.classList.contains('quiet'), null, {timeout: 6000});
    await page.keyboard.press('f');
    await page.waitForFunction(() => !document.fullscreenElement, null, {timeout: 4000});
    notes.push('fullscreen');
  } catch (error) {
    if (engine === 'chromium') throw error;
    notes.push('fullscreen unavailable in headless WebKit');
  }
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
  console.log(`${label}: retina rendering, balanced black and white, the two-colour law on rendered pixels (half turn, half period, half-cell slide, both-axis slide, glide Y, quarter turn with a quarter period), shader against the CPU rule, the V alternate, fixed scale, seamless tiling, mobile layout, drag pan, wheel zoom, pinch zoom, two-finger turn snapped to 90°, trackpad pinch-and-turn in four event patterns, the shutter and its gate, momentum on pinch/turn/wheel/trackpad with the elastic limit, reset, stats, pause/play, idle controls, GPU recovery, and reduced motion passed (${notes.join('; ')})`);
} finally {await browser.close();}
