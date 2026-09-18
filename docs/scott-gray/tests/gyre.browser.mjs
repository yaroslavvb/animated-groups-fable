// Gyre in a real browser engine: the entangled colour symmetry on the pixels
// the page actually draws, the shader against an independent reconstruction of
// the same rule, the viewer's gestures and layout, the Safari trackpad
// pinch-and-turn, and the shutter that integrates each displayed frame.
//
// Usage: node tests/gyre.browser.mjs [base-url] [label]
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
import {colourAt, fromPlane, frameAt, gTurn, MAX_SCALE, TURN_CENTRE, uVolume, valuesAt} from '../gyre/renderer.mjs';
import {ELASTIC_GIVE, MAX_ZOOM_RATE, ZOOM_TAU} from '../gyre/momentum.mjs';
const runtime = '/Users/yaroslavvb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? `${runtime}playwright/index.mjs`);
const engine = process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
const {PNG} = (await import(process.env.PNGJS_MODULE ?? `${runtime}pngjs/lib/png.js`)).default;
const base = (process.argv[2] ?? 'http://localhost:8934/scott-gray/gyre/').replace(/\/?$/, '/');
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
page.on('response', response => {if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);});
const ready = () => page.waitForSelector('canvas[data-ready="true"]');
// The three colours the page paints, in the order the colouring numbers them.
const PALETTE = [[0xc9, 0x56, 0x3e], [0x57, 0x97, 0x9a], [0xe2, 0xbe, 0x68]];
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
    // With a gap, the events carry real time between them, which is what a
    // release velocity is measured over; without one they arrive in a single
    // instant, which is how the accumulator checks want them.
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
/** Which of the three colours each pixel shows, and how sure that reading is. */
function classify(image) {
  const out = new Uint8Array(image.width * image.height), pure = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) {
    let best = 0, distance = Infinity;
    for (let k = 0; k < 3; k++) {
      const d = Math.abs(image.data[4*i] - PALETTE[k][0]) + Math.abs(image.data[4*i+1] - PALETTE[k][1]) + Math.abs(image.data[4*i+2] - PALETTE[k][2]);
      if (d < distance) { distance = d; best = k; }
    }
    out[i] = best; pure[i] = distance < 12 ? 1 : 0;
  }
  return {colour: out, pure};
}
/** How often `after` shows colour (before + step) mod 3 at the same pixel, over
 * the pattern only (skipping antialiased edges and the strip the control bar
 * covers). */
function cycleAgreement(before, after, step) {
  const a = classify(before), b = classify(after);
  let same = 0, total = 0;
  for (let y = 0; y < before.height - 220; y++) for (let x = 0; x < before.width; x++) {
    const i = y * before.width + x;
    if (!a.pure[i] || !b.pure[i]) continue;
    total++; if ((a.colour[i] + step) % 3 === b.colour[i]) same++;
  }
  return same / total;
}
/** How often `after` shows, at each point, the colour `before` shows a turn of
 * `degrees` away about the screen centre — which at the home framing is the
 * turn centre p itself. Negative degrees is the picture turned clockwise on
 * screen. A cyclic colour step is allowed; antialiased pixels and the strip the
 * control bar covers are skipped. */
function turnAgreement(before, after, degrees, step, radius = 700) {
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
    total++; if ((a.colour[i] + step) % 3 === b.colour[j]) same++;
  }
  return same / total;
}
/** The share of the picture each of the three colours holds. */
function areas(image) {
  const {colour, pure} = classify(image);
  const counts = [0, 0, 0];
  let total = 0;
  for (let y = 0; y < image.height - 220; y++) for (let x = 0; x < image.width; x++) {
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
  await page.screenshot({path: `${shots}/gyre-${label}-desktop.png`});
  // Three colours, each holding about a third of the plane: the symmetry makes
  // the three regions images of one another over the loop, and no single frame
  // is allowed to let one of them dominate either.
  const share = areas(home);
  for (const value of share) assert.ok(Math.abs(value - 1 / 3) < 0.04, `colour areas ${share.map(v => v.toFixed(4))}`);

  // ---- the entangled colour symmetry, on the pixels the page draws ----
  // Wait a third of a period and the whole picture has turned a third of a turn
  // CLOCKWISE about the screen centre — which is p, the turn centre — with every
  // region taking the colour of the one before it.
  const third = await shot(`?play=0&phase=${1 / 3}`);
  assert.ok(turnAgreement(home, third, -120, 2) > 0.99, 'a third of a period turns the picture a third of a turn clockwise and steps every colour back one');
  notes.push(`turn + wait + recolour: ${(100 * turnAgreement(home, third, -120, 2)).toFixed(2)}% of the picture`);
  // Every proper part of that fails, and this is the point of the page.
  assert.ok(turnAgreement(home, third, -120, 0) < 0.5, 'the same turn and wait WITHOUT the recolouring is not a symmetry');
  assert.ok(turnAgreement(home, third, -120, 1) < 0.5, 'nor with the colours stepped the other way');
  assert.ok(turnAgreement(home, third, 120, 2) < 0.5, 'and the picture does not turn anticlockwise');
  for (const step of [0, 1, 2]) {
    // The turn alone: the same frame compared with itself, turned.
    assert.ok(turnAgreement(home, home, -120, step) < 0.5, `the turn alone is not a symmetry (colour step ${step})`);
    assert.ok(turnAgreement(home, home, 120, step) < 0.5, `nor the other way (colour step ${step})`);
    // The wait alone: the same pixels, a third of a period later.
    assert.ok(cycleAgreement(home, third, step) < 0.5, `the wait alone is not a symmetry (colour step ${step})`);
  }
  notes.push(`the parts fail: turn alone ≤ ${(100 * Math.max(...[0, 1, 2].map(k => turnAgreement(home, home, -120, k)))).toFixed(1)}%, wait alone ≤ ${(100 * Math.max(...[0, 1, 2].map(k => cycleAgreement(home, third, k)))).toFixed(1)}%`);
  // The sharpest statement of the law needs no resampling at all: turning the
  // VIEW a third of a turn clockwise about the same point draws, pixel for
  // pixel, the frame a third of a period later with its colours stepped on one.
  const turned = await shot('?play=0&angle=120');
  assert.ok(cycleAgreement(turned, third, 2) > 0.999, 'the view turned 120° clockwise is the frame at T/3 with the colours stepped back one');
  for (const step of [0, 1]) assert.ok(cycleAgreement(turned, third, step) < 0.1, `and it is nothing else (step ${step})`);
  const twoThirds = await shot(`?play=0&phase=${2 / 3}`);
  const back = await shot('?play=0&angle=240');
  assert.ok(cycleAgreement(back, twoThirds, 1) > 0.999, 'and two thirds of a turn matches the frame at 2T/3 with the colours stepped the other way');
  // A still frame on its own has no symmetry to find: the view turned by a
  // third is a different picture however the colours are relabelled.
  for (const step of [0, 1, 2]) assert.ok(cycleAgreement(turned, home, step) < 0.5, `a single frame has no threefold symmetry (step ${step})`);

  // The turn centre is the free demonstration of the law: g fixes p, so the
  // colour of the middle pixel simply steps back one place every T/3.
  const centre = [];
  for (let k = 0; k < 12; k++) {
    const image = await shot(`?play=0&phase=${k / 12}`);
    const {colour} = classify(image);
    centre.push(colour[(image.height / 2) * image.width + image.width / 2]);
  }
  assert.deepEqual(centre, [2, 1, 1, 1, 1, 0, 0, 0, 0, 2, 2, 2], `the colour at the turn centre over twelve phases: ${centre}`);
  for (let k = 0; k < 12; k++) assert.equal((centre[k] - centre[(k + 4) % 12] + 3) % 3, 1, 'the centre steps back exactly one colour every third of a period');
  notes.push(`the fixed point steps 2,1,1,1,1,0,0,0,0,2,2,2 over the loop`);

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

  await page.goto(`${base}?play=0`); await ready();

  // ---- framing, tiling and the endless pan ----
  await page.setViewportSize({width: 760, height: 760});
  const square = await pixels();
  assert.ok(averageDifference(home, square, 680, 240, 0, 0, 1520, 1300) < 1, 'center crop retains exact scale');
  // The lattice repeats every lattice length along a1: 380 CSS px, 760 device px at DPR 2.
  await page.setViewportSize({width: 1520, height: 1000});
  const repeated = await pixels();
  assert.ok(averageDifference(repeated, repeated, 0, 0, 760, 0, 2200, 1600) < 1, 'periodic tiling has no seam or orientation change');

  await page.setViewportSize({width: 390, height: 844});
  // Narrow screens keep two repeats across: 195 CSS px = 390 device px per lattice length at DPR 2.
  const phone = await pixels();
  assert.ok(averageDifference(phone, phone, 0, 0, 390, 0, 390, 1400) < 1, 'phone view repeats every 195 CSS px');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth && document.documentElement.scrollHeight === innerHeight), 'mobile fills viewport without scrolling');
  const bounds = await page.locator('#controls').boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, 'mobile controls fit');
  await page.screenshot({path: `${shots}/gyre-${label}-mobile.png`});

  // Dragging pans the endless pattern: a 95 CSS px drag (190 device px, a
  // quarter repeat) shifts the image exactly, and the reset button appears.
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
  // And a one-finger drag is a pan and nothing else, momentum or no momentum.
  const afterFling = await statsText();
  assert.equal(turnOf(afterFling), 0, 'a one-finger drag never turns the view');
  assert.equal(scaleOf(afterFling), 380, 'nor zooms it');
  // The wheel zooms in about the pointer (Chrome scales the delta by the device pixel ratio, so only the direction is checked here).
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(300);
  const wheelScale = scaleOf(await statsText());
  assert.ok(wheelScale > 380 && wheelScale < 760, `wheel zoomed in to ${wheelScale} px per repeat`);
  await page.keyboard.press('0');
  // The + key zooms 1.25× about the centre: a repeat is then 475 CSS px, 950 device px.
  await page.keyboard.press('+');
  await page.waitForTimeout(300);
  assert.equal(scaleOf(await statsText()), 475);
  const zoomed = await pixels();
  assert.ok(averageDifference(zoomed, zoomed, 0, 0, 950, 0, 1000, 1000) < 1, 'zoomed tiling repeats every 950 device px');
  assert.ok(averageDifference(zoomed, zoomed, 0, 0, 760, 0, 1000, 1000) > 5, 'and no longer every 760');
  await page.keyboard.press('0');
  await page.waitForTimeout(300);
  assert.equal(averageDifference(beforeDrag, await pixels()), 0, 'the 0 key restores the home view exactly');
  assert.equal(await page.locator('#reset').isVisible(), false);
  // A two-finger pinch zooms in as well.
  // The glide that follows a pinch carries the zoom a little further, so the
  // check is on the scale the page reports once everything has settled rather
  // than on a fixed number of pixels — and on the tiling repeating at exactly
  // that scale, which is the thing the pinch is really being asked about.
  await fingers(Array.from({length: 6}, (_, i) => [[600 - 8 * i, 400], [680 + 8 * i, 400]]));
  await page.waitForTimeout(800);
  const pinchedScale = scaleOf(await statsText());
  assert.ok(pinchedScale >= 760, `pinching the fingers apart at least doubled the repeat: ${pinchedScale} px`);
  const pinched = await pixels();
  // One repeat is 2 × the CSS scale in device pixels; the window is whatever is
  // left of the canvas beyond that offset, since the glide decides the scale.
  const window = Math.min(700, pinched.width - 2 * pinchedScale, pinched.height);
  assert.ok(window > 200, `the pinch left room to compare a repeat: ${pinchedScale} px per repeat`);
  assert.ok(averageDifference(pinched, pinched, 0, 0, 2 * pinchedScale, 0, window, window) < 1, `and the tiling repeats every ${2 * pinchedScale} device px`);
  assert.equal(await page.locator('#reset').isVisible(), true);
  await page.locator('#reset').click();
  await page.waitForTimeout(300);
  assert.equal(averageDifference(beforeDrag, await pixels()), 0, 'the reset button restores the home view');
  // Two fingers turning about the screen centre: 58° must snap to a sixth of a
  // turn, since the lattice is triangular — even though the picture's own
  // colour symmetry is only a third of a turn.
  const spin = t => { const a = t * 58 * Math.PI / 180, r = 90; return [[640 - r * Math.cos(a), 400 - r * Math.sin(a)], [640 + r * Math.cos(a), 400 + r * Math.sin(a)]]; };
  await fingers(Array.from({length: 9}, (_, i) => spin(i / 8)));
  // Long enough for the throw the release makes to glide out and ease onto its
  // sixth: the turn decays over a quarter of a second and the ease takes 130 ms.
  await page.waitForTimeout(1200);
  const spun = await pixels();
  const spunText = await statsText();
  const spunAngle = turnOf(spunText);
  assert.equal(spunAngle % 60, 0, `the two-finger turn settled on a sixth of a turn: ${spunText}`);
  assert.ok(spunAngle >= 60, `and carried at least as far as the fingers turned: ${spunAngle}°`);
  assert.equal(scaleOf(spunText), 380, 'and a turn does not zoom');
  await page.goto(`${base}?play=0&angle=${spunAngle}`); await ready();
  await page.waitForTimeout(150);
  assert.ok(averageDifference(spun, await pixels()) < 1.5, `the two-finger turn landed on the same sixth of a turn the URL asks for (${spunAngle}°)`);
  await page.goto(`${base}?play=0`); await ready(); await page.waitForTimeout(150);

  // ---- the Mac trackpad: a pinch and a turn at the same time ----
  // macOS sends the two as separate streams of gesture events, each event
  // carrying only its own quantity. Each stream must accumulate on its own:
  // applying both fields of every event lets them cancel, which is why the two
  // only ever worked one at a time.
  const patterns = {
    // magnify, rotate, magnify, rotate — the rotate events name no zoom.
    split: [['gesturestart', 1, 0], ['gesturechange', 1.2, 0], ['gesturechange', 1, 15], ['gesturechange', 1.4, 0], ['gesturechange', 1, 30], ['gestureend', 1, 30]],
    // the same, with the platform's 0 in the scale of the rotate events.
    platform: [['gesturestart', 1, 0], ['gesturechange', 1.2, 0], ['gesturechange', 0, 15], ['gesturechange', 1.4, 0], ['gesturechange', 0, 30], ['gestureend', 0, 30]],
    // a Safari that accumulates both quantities in every event.
    both: [['gesturestart', 1, 0], ['gesturechange', 1.2, 0], ['gesturechange', 1.2, 15], ['gesturechange', 1.4, 15], ['gesturechange', 1.4, 30], ['gestureend', 1.4, 30]],
    // and the two streams interleaved the other way round.
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
  // The diagnostic readout names what Safari actually sent, so a report from a
  // real Mac says which of the patterns above that Safari uses.
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
  // A pinch back to exactly 1×, and a turn back to exactly 0°, still arrive —
  // in a stream that has only ever named the one quantity, where an event that
  // names neither can only be that quantity returning to neutral.
  await page.keyboard.press('0');
  await gesture([['gesturestart', 1, 0], ['gesturechange', 1.3, 0], ['gesturechange', 1, 0], ['gestureend', 1, 0]]);
  await page.waitForTimeout(120);
  assert.equal(scaleOf(await statsText()), 380, 'a pinch back to 1× returns to the home scale');
  await page.keyboard.press('0');
  await gesture([['gesturestart', 1, 0], ['gesturechange', 1, 24], ['gesturechange', 1, 0], ['gestureend', 1, 0]]);
  await page.waitForTimeout(120);
  assert.equal(turnOf(await statsText()), 0, 'a turn back to 0° returns to no turn');
  // But once BOTH streams have spoken, an event naming neither is ambiguous —
  // a pinch back to 1× and a turn back to 0° are indistinguishable — and
  // applying it to both accumulators would throw the other one away. It is held
  // instead: the zoom survives a turn passing back through 0°, and the turn
  // survives a pinch passing back through 1×.
  await page.keyboard.press('0');
  await gesture([['gesturestart', 1, 0], ['gesturechange', 1.4, 0], ['gesturechange', 1, 20], ['gesturechange', 1, 0]]);
  await page.waitForTimeout(120);
  const throughZero = await statsText();
  assert.equal(scaleOf(throughZero), 532, `the zoom survives a turn passing through 0°: ${throughZero}`);
  assert.equal(turnOf(throughZero), 20, 'and the turn is held at its last named value');
  assert.match(throughZero, /held 1/, `the ambiguous event is counted as held: ${throughZero}`);
  // …and the next event that does name something is obeyed at once.
  await gesture([['gesturechange', 1, -15], ['gestureend', 1, -15]]);
  await page.waitForTimeout(120);
  const resumed = await statsText();
  assert.equal(turnOf(resumed), -15, 'the next turn event lands');
  assert.equal(scaleOf(resumed), 532, 'with the zoom still in force');
  // The mirror case: a pinch back through exactly 1× must not wipe the turn.
  await page.keyboard.press('0');
  await gesture([['gesturestart', 1, 0], ['gesturechange', 1, 20], ['gesturechange', 1.4, 0], ['gesturechange', 1, 0], ['gestureend', 1, 0]]);
  await page.waitForTimeout(120);
  const mirrored = await statsText();
  assert.equal(turnOf(mirrored), 20, `the turn survives a pinch passing through 1×: ${mirrored}`);
  assert.equal(scaleOf(mirrored), 532, 'and the zoom is held at its last named value');
  // A gesture that names nothing at all moves nothing; and the turn still snaps.
  await page.keyboard.press('0');
  await gesture([['gesturestart', 1, 0], ['gesturechange', 1, 0], ['gestureend', 1, 0]]);
  await page.waitForTimeout(120);
  const idle = await statsText();
  assert.equal(scaleOf(idle), 380); assert.equal(turnOf(idle), 0);
  await page.keyboard.press('0');
  await gesture([['gesturestart', 1, 0], ['gesturechange', 1.5, 0], ['gesturechange', 1, 58], ['gestureend', 1, 58]]);
  await page.waitForTimeout(150);
  const snapped = await statsText();
  assert.equal(turnOf(snapped), 60, 'the turn snapped to a sixth');
  assert.equal(scaleOf(snapped), 570, 'and the zoom survived the snap');
  // Gesture events arriving while fingers are down are ignored: iPhone and iPad
  // keep doing pan, zoom and turn through the pointer events above.
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
  // The Mac fallbacks: the turn keys repeat while held, so ] can be held down
  // through a pinch, and Option with the wheel turns about the pointer.
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
  // The ] key turns 15° clockwise, Shift+] a sixth of a turn; [ turns back.
  await page.keyboard.press(']'); await page.waitForTimeout(150);
  assert.match(await statsText(), /turned 15°/);
  await page.keyboard.press('['); await page.keyboard.press('Shift+]'); await page.waitForTimeout(150);
  assert.match(await statsText(), /turned 60°/);
  await page.keyboard.press('0'); await page.waitForTimeout(300);
  assert.equal(averageDifference(beforeDrag, await pixels()), 0, 'reset also clears the turn');

  // ---- the shutter (temporal anti-aliasing) ----
  // A still picture is drawn exactly as it was before the shutter existed: with
  // nothing moving there is nothing to integrate, so ?taa=0 and the default
  // agree to the last bit — which is what the pixel comparisons above rely on.
  await page.goto(`${base}?play=0&taa=0`); await ready();
  const still = await pixels();
  assert.match(await statsText(), /shutter off/, 'the stats overlay names the shutter');
  await page.goto(`${base}?play=0&taa=3`); await ready();
  assert.equal(averageDifference(still, await pixels()), 0, 'a paused frame is identical with and without the shutter');
  await page.goto(`${base}?play=0&taa=5`); await ready();
  assert.equal(averageDifference(still, await pixels()), 0, 'five layers make no difference to a still picture either');
  // ?motion=0 asks for the shutter whenever anything moves at all — which is
  // not the same as asking for it when nothing does. A still view at a still
  // phase has nothing to integrate: three sub-samples would be three copies of
  // one instant, three times the texture work for a picture that must come out
  // bit-identical anyway.
  for (const query of ['play=0&motion=0', 'play=0&taa=5&shutter=2&motion=0']) {
    await page.goto(`${base}?${query}`); await ready();
    await page.waitForTimeout(400);
    assert.equal(averageDifference(still, await pixels()), 0, `?${query} draws the same bits as no shutter at all`);
    assert.match(await statsText(), /shutter off \(of [35]\)/, `?${query} pays for one sub-sample: ${await statsText()}`);
  }
  // The shutter is spent only where the picture actually moves, and the gate is
  // on the SMEAR it would draw — travel × shutter — not on the travel. At the
  // home framing the pattern travels a third of a pixel a frame and there is
  // nothing to integrate, so it stays off, and the taps count says so. With the
  // full box filter (?shutter=1) the gate is 0.75 px of travel, which 2400 px
  // per repeat passes at 2.2 px a frame; with the shipped 0.3 shutter the same
  // 0.75 px of smear asks for 2.5 px of travel, so 2400 is still off and the
  // pattern engages the shutter by itself only past about 2790.
  await page.goto(`${base}?taa=3&play=1&stats=1`); await ready();
  await page.waitForTimeout(600);
  const homeStats = await page.locator('#stats').textContent();
  assert.match(homeStats, /shutter off \(of 3\)/, `the home framing does not pay for a shutter: ${homeStats}`);
  assert.match(homeStats, /(27|48) taps/, `one sampling of the field per pixel: ${homeStats}`);
  for (const [scale, on] of [[2400, false], [3000, true]]) {
    await page.goto(`${base}?taa=3&play=1&stats=1&scale=${scale}`); await ready();
    await page.waitForTimeout(600);
    const text = await page.locator('#stats').textContent();
    assert.match(text, on ? /shutter 3×0\.30 frame/ : /shutter off \(of 3\)/, `the default shutter at ${scale} px per repeat: ${text}`);
    if (on) assert.match(text, /(81|144) taps/, `and three samplings of the field per pixel: ${text}`);
  }
  await page.goto(`${base}?taa=3&play=1&stats=1&scale=2400&shutter=1`); await ready();
  await page.waitForTimeout(600);
  const zoomStats = await page.locator('#stats').textContent();
  assert.match(zoomStats, /shutter 3×1\.00 frame/, `three sub-samples over a full frame interval: ${zoomStats}`);
  assert.match(zoomStats, /(81|144) taps/, `and three samplings of the field per pixel: ${zoomStats}`);
  await page.goto(`${base}?taa=0&play=1&stats=1&scale=3000`); await ready();
  await page.waitForTimeout(400);
  assert.match(await page.locator('#stats').textContent(), /shutter off/);
  // ?shutter=0 asks for no integration, and must cost nothing as well as show
  // nothing: a zero-width shutter collapses to a single sub-sample.
  await page.goto(`${base}?taa=3&play=1&stats=1&scale=2400&shutter=0`); await ready();
  await page.waitForTimeout(400);
  const zeroWidth = await page.locator('#stats').textContent();
  assert.match(zeroWidth, /shutter off \(of 3\)/, `a zero-width shutter draws one layer: ${zeroWidth}`);
  assert.match(zeroWidth, /(27|48) taps/, `and costs one: ${zeroWidth}`);
  // What the shutter draws, deterministically: the integrated frame must be the
  // mean of the frames at its own sub-phases, and it must paint intermediate
  // colours exactly where a boundary swept during the frame.
  await page.goto(`${base}?play=0`); await ready();
  const shutter = await page.evaluate(async ({base, palette}) => {
    const mod = await import(`${base}renderer.mjs`);
    const bytes = await (await fetch(`${base}field.f32`)).arrayBuffer();
    const dv = new DataView(bytes);
    const field = Float32Array.from({length: bytes.byteLength / 4}, (_, i) => dv.getFloat32(i * 4, true));
    const W = 480, H = 300, display = 1000 / 60, layers = 3;
    const shot = (taa, phase, moving) => {
      const canvas = document.createElement('canvas');
      canvas.style.cssText = `position:fixed;left:0;top:0;width:${W}px;height:${H}px;opacity:0.01;pointer-events:none`;
      document.body.append(canvas);
      // Zoomed right in, and away from the turn centre (where the colouring is
      // flat), so a boundary crosses many pixels in one frame: this is the
      // fast-moving edge the shutter is for. The mechanism is checked at a
      // full-frame shutter; the page's narrower default width is pinned by the
      // node test and only scales the smear.
      const renderer = mod.createRenderer(canvas, field, {pixelRatio: 1, adaptive: false, display, tilePixels: 2400, center: [0.35, 0.62], taa, shutter: 1});
      renderer.draw(phase, {continuous: true, moving});
      const gl = canvas.getContext('webgl2');
      const data = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, data);
      renderer.dispose(); canvas.remove();
      return data;
    };
    const phase = 0.137;
    const phases = mod.shutterPhases(phase, layers, display, 1);
    const off = shot(1, phase, true);
    const on = shot(layers, phase, true);
    const subs = phases.map(p => shot(1, p, false));
    const near = (data, i) => {
      let best = Infinity;
      for (const [r, g, b] of palette) best = Math.min(best, Math.abs(data[i] - r) + Math.abs(data[i + 1] - g) + Math.abs(data[i + 2] - b));
      return best;
    };
    let worst = 0, changed = 0, movedStatic = 0, blendOn = 0, blendOff = 0;
    for (let p = 0; p < W * H; p++) {
      const i = 4 * p;
      let delta = 0, spread = 0;
      for (let c = 0; c < 3; c++) {
        const mean = (subs[0][i + c] + subs[1][i + c] + subs[2][i + c]) / layers;
        delta = Math.max(delta, Math.abs(on[i + c] - mean));
        for (const sub of subs) spread = Math.max(spread, Math.abs(sub[i + c] - subs[0][i + c]));
      }
      worst = Math.max(worst, delta);
      // A pixel every sub-phase agrees on must come out exactly as it would
      // have without the shutter: the shutter may only touch what moved.
      if (spread === 0) for (let c = 0; c < 3; c++) movedStatic = Math.max(movedStatic, Math.abs(on[i + c] - off[i + c]));
      if (spread > 8) changed++;
      if (near(off, i) < 12) { if (near(on, i) > 24) blendOn++; if (near(off, i) > 24) blendOff++; }
    }
    return {worst, changed, movedStatic, blendOn, blendOff, total: W * H, phases};
  }, {base, palette: PALETTE});
  assert.ok(shutter.worst <= 2, `the integrated frame is the mean of its sub-phases (worst channel error ${shutter.worst}/255)`);
  assert.ok(shutter.movedStatic <= 1, `pixels no boundary crossed are unchanged (worst ${shutter.movedStatic}/255)`);
  assert.ok(shutter.changed > 0.002 * shutter.total, `a fast boundary sweeps pixels (${(100 * shutter.changed / shutter.total).toFixed(2)}% of the frame)`);
  assert.ok(shutter.blendOn > 20 * Math.max(1, shutter.blendOff), `the shutter paints intermediate colours where the plain frame has none (${shutter.blendOn} vs ${shutter.blendOff} pixels)`);
  notes.push(`shutter blends ${shutter.blendOn} pixels a plain frame paints pure, worst deviation from the mean of its sub-phases ${shutter.worst}/255`);
  // Frame rate is never traded for motion blur, and the two are not traded
  // together either: the shutter is a rung of its own ABOVE the resolution
  // ladder, so a GPU that cannot keep up loses the blur first and the pixels
  // only if that was not enough. Hanging the shutter on the quality factor
  // instead would put a 2.5× cost step on the very value the governor moves up
  // and down, and it would cross it for ever.
  const governed = await page.evaluate(async ({base}) => {
    const mod = await import(`${base}renderer.mjs`);
    const bytes = await (await fetch(`${base}field.f32`)).arrayBuffer();
    const dv = new DataView(bytes);
    const field = Float32Array.from({length: bytes.byteLength / 4}, (_, i) => dv.getFloat32(i * 4, true));
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;left:0;top:0;width:400px;height:300px;opacity:0.01;pointer-events:none';
    document.body.append(canvas);
    // A 60 Hz display fed frames 33 ms apart: every frame is late, whatever the
    // renderer does about it. Zoomed in with the full box filter, so the smear
    // the gate reads — travel × shutter — is wide enough that the shutter is
    // engaged to start with and the governor has something to take away.
    const renderer = mod.createRenderer(canvas, field, {adaptive: true, display: 1000 / 60, tilePixels: 2400, shutter: 1});
    const trace = [];
    for (let i = 0; i < 200; i++) {
      renderer.draw(i / 480, {continuous: true, moving: true, time: 1000 + i * 33});
      trace.push([+renderer.quality.toFixed(3), renderer.layers]);
    }
    const stillLayers = (renderer.draw(0.5, {continuous: false, moving: false}), renderer.layers);
    const out = {max: renderer.maxLayers, trace, stillLayers};
    renderer.dispose(); canvas.remove();
    return out;
  }, {base});
  assert.equal(governed.max, 3, 'three sub-samples by default');
  assert.equal(governed.trace[0][1], 3, 'the shutter starts on at a framing that needs it');
  const firstShutterDrop = governed.trace.findIndex(([, layers]) => layers === 1);
  const firstQualityDrop = governed.trace.findIndex(([quality]) => quality < 1);
  assert.ok(firstShutterDrop > 0, 'the shutter is dropped when frames read late');
  assert.ok(firstQualityDrop > firstShutterDrop, `the shutter goes first (at frame ${firstShutterDrop}) and the resolution only later (${firstQualityDrop})`);
  assert.equal(governed.trace[firstShutterDrop][0], 1, 'and the resolution is untouched at the moment the shutter goes');
  for (const [quality, layers] of governed.trace) assert.ok(quality === 1 || layers === 1, `quality ${quality} must never be paid alongside ${layers} layers`);
  assert.equal(governed.stillLayers, 1, 'a still frame uses one sub-sample');
  notes.push(`governor drops the shutter at frame ${firstShutterDrop} and the resolution at ${firstQualityDrop}`);

  // ---- what the shutter is for: the judder of a fast motion ----
  // The fastest thing this page ever shows is not the animation but a drag or a
  // glide, so the shutter integrates the view as well as the phase. Two
  // consecutive displayed frames with the view panning 12 CSS px between them,
  // with the shutter and without: the share of pixels making a full colour flip
  // from one frame to the next must fall by half at least with a full-frame
  // shutter, and must still fall with the page's narrower default.
  const panned = await page.evaluate(async ({base}) => {
    const mod = await import(`${base}renderer.mjs`);
    const bytes = await (await fetch(`${base}field.f32`)).arrayBuffer();
    const dv = new DataView(bytes);
    const field = Float32Array.from({length: bytes.byteLength / 4}, (_, i) => dv.getFloat32(i * 4, true));
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
      // The palette's closest pair differs by 104 at its furthest channel, so a
      // jump over 104 is a whole colour flip however the three are arranged.
      let flips = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > 104) flips++;
      }
      return {layers, flips: 100 * flips / (a.length / 4)};
    }
    const out = {still: pair(3, 0), off: pair(1, 12), on: pair(3, 12), full: pair(3, 12, 1)};
    canvas.remove();
    return out;
  }, {base});
  assert.equal(panned.still.layers, 1, 'a still view at the home framing uses one sub-sample');
  assert.equal(panned.off.layers, 1, '?taa=1 is no shutter at all');
  assert.equal(panned.on.layers, 3, 'a 12 px pan engages the shutter even with the phase held still');
  assert.ok(panned.off.flips > 5, `a 12 px pan without the shutter flips ${panned.off.flips.toFixed(2)}% of pixels between frames`);
  assert.ok(panned.full.flips < 0.5 * panned.off.flips, `a full-frame shutter must remove most of that (${panned.off.flips.toFixed(2)}% → ${panned.full.flips.toFixed(2)}%)`);
  // The page's default shutter is 0.3 of a frame — crisper by the user's choice —
  // so it removes a smaller share; it must still remove some.
  assert.ok(panned.on.flips < 0.92 * panned.off.flips, `the default shutter must still reduce it (${panned.off.flips.toFixed(2)}% → ${panned.on.flips.toFixed(2)}%)`);
  notes.push(`pan judder ${panned.off.flips.toFixed(2)}% → ${panned.on.flips.toFixed(2)}% of pixels at the default shutter, → ${panned.full.flips.toFixed(2)}% at a full frame`);

  // ---- momentum: what keeps moving after the fingers lift ----
  // Every gesture here is dispatched with real time between its events, from
  // inside the page, because a velocity is a thing that takes time to have. The
  // instrument is the page's own stats line: paused, it is rewritten on every
  // drawn frame, so reading it once per animation frame traces the view.
  const open = async query => { await page.goto(`${base}?play=0&stats=1&${query}`); await ready(); await page.waitForTimeout(150); };
  /** Two fingers through `frames`, one every `gap` ms of real time, then a
   * release — and a reading of the view on every animation frame for `record`
   * ms after it. `hold` waits before lifting; `interrupt` taps the screen. */
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
  const spread = (from, to, steps, at) => Array.from({length: steps}, (_, i) => pair(from + (to - from) * i / (steps - 1), 0, at));
  const twist = (from, to, steps, d = 180) => Array.from({length: steps}, (_, i) => pair(d, from + (to - from) * i / (steps - 1)));
  const settled = values => values.slice(-8).every(v => v === values[values.length - 1]);
  const rising = values => { let n = 0; while (n + 1 < values.length && values[n + 1] > values[n]) n++; return n; };
  /** How far an angle in whole degrees is from the nearest sixth of a turn — 0
   * for a turn that landed on one, which is what a thrown turn is aimed at. */
  const offSixth = angle => { const m = ((angle % 60) + 60) % 60; return Math.min(m, 60 - m); };

  await open('scale=600');
  let {release, trace} = await twoFingers({frames: spread(120, 260, 9)});
  let scales = trace.map(s => scaleOf(s.text));
  const pinchStart = scaleOf(release), pinchEnd = scales[scales.length - 1];
  assert.ok(Math.abs(pinchStart - 1300) < 80, `the pinch itself takes the repeat to about 1300 px: ${pinchStart}`);
  assert.ok(rising(scales) >= 3, `the zoom keeps growing after the fingers lift: ${scales.slice(0, 8)}`);
  assert.ok(pinchEnd > pinchStart * 1.05, `and by more than a rounding: ${pinchStart} → ${pinchEnd}`);
  assert.ok(pinchEnd < pinchStart * Math.exp(MAX_ZOOM_RATE * ZOOM_TAU) * 1.02, `and never runs away: ${pinchStart} → ${pinchEnd}`);
  assert.ok(pinchEnd <= MAX_SCALE, `and stops inside the zoom limits: ${pinchEnd}`);
  assert.ok(settled(scales), `and comes to rest within a second: ${scales.slice(-10)}`);
  notes.push(`pinch: ${pinchStart} → ${pinchEnd} px per repeat (×${(pinchEnd / pinchStart).toFixed(2)})`);

  // The same pinch dispatched in one instant throws nothing: a scale that
  // changed with no time passing is not a speed.
  await open('scale=600');
  ({release, trace} = await twoFingers({frames: spread(120, 260, 9), gap: 0, record: 600}));
  scales = trace.map(s => scaleOf(s.text));
  assert.equal(scales[scales.length - 1], scaleOf(release), `an instant burst leaves the view where it put it: ${scaleOf(release)} → ${scales[scales.length - 1]}`);
  // Nor does one that ends at rest.
  await open('scale=600');
  ({release, trace} = await twoFingers({frames: spread(120, 260, 9), hold: 250, record: 600}));
  scales = trace.map(s => scaleOf(s.text));
  assert.equal(scales[scales.length - 1], scaleOf(release), `a pause before lifting is a stop, not a throw: ${scaleOf(release)} → ${scales[scales.length - 1]}`);

  // A thrown turn keeps turning and comes to rest on an angle the page allows.
  await open('');
  ({release, trace} = await twoFingers({frames: twist(0, 40, 9)}));
  const turns = trace.map(s => turnOf(s.text));
  const turnStart = turnOf(release), turnEnd = turns[turns.length - 1];
  assert.ok(rising(turns) >= 3, `the turn keeps going after the fingers lift: ${turns.slice(0, 8)}`);
  assert.ok(turnEnd > turnStart + 8, `and by a visible amount: ${turnStart}° → ${turnEnd}°`);
  assert.ok(settled(turns), `and comes to rest: ${turns.slice(-10)}`);
  // And it comes to rest ON a sixth, not wherever the decay happened to stop:
  // the glide is aimed at the nearest sixth to where it was heading, so a thrown
  // turn lands on a symmetry of the picture exactly as a hand-made one does.
  // (A throw too small to reach the sixth it is nearest is left alone — which is
  // the node test's business, since it can dictate the velocity.)
  assert.ok(turnEnd % 60 === 0, `the turn settled at ${turnEnd}°, off a sixth by ${offSixth(turnEnd)}°`);
  assert.equal(scaleOf(trace[trace.length - 1].text), scaleOf(release), 'a turn does not zoom');
  notes.push(`turn: ${turnStart}° → ${turnEnd}° (aimed onto a sixth)`);

  // The top of the zoom range gives, and springs back to the limit exactly.
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
  await page.screenshot({path: `${shots}/gyre-${label}-elastic.png`});

  // A glide cut short *while it is outside the limits* must still land inside
  // them. The elastic excursion is the one moment the view is allowed past
  // 8000, and only because the glide is going to put it back; a finger landing
  // at the peak has to do the putting back itself, or the view stays stretched
  // for ever — nothing else re-clamps the scale.
  for (const after of [90, 140]) {
    await open('scale=7000');
    ({release, trace} = await twoFingers({frames: spread(120, 135, 9), record: 900, interrupt: {after, at: [300, 300]}}));
    scales = trace.map(s => scaleOf(s.text));
    const cut = scales[scales.length - 1];
    assert.ok(Math.max(...scales) > MAX_SCALE, `the glide did pass the limit before the tap: ${Math.max(...scales)}`);
    assert.equal(cut, MAX_SCALE, `a tap ${after} ms in, during the elastic, still rests on the limit: ${cut}`);
    assert.ok(settled(scales), `and stays there: ${scales.slice(-6)}`);
  }
  // The same at the floor, where a glide gives below the smallest scale the
  // page allows — one node of the 66-node lattice per device pixel.
  // (Starting well above the floor, so the fingers themselves never reach it:
  // a pinch that runs into a limit stops changing the scale, and a scale that
  // stopped changing is not a velocity to throw.)
  await open('scale=50');
  const floor = await page.evaluate(() => Math.max(24, 66 / (devicePixelRatio || 1)));
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
  notes.push(`a tap ${Math.round(trace[tapped].t)} ms into the glide stopped it at ${scales[tapped]} px per repeat`);

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
    const burst = stats.textContent; // still inside the rest period: the glide has not started
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
  assert.ok(wheelEnd < wheelBurst * 1.35, `but gently — a wheel adds a fifth, a finger half again: ${wheelBurst} → ${wheelEnd}`);
  assert.ok(settled(wheelScales), `and settles: ${wheelScales.slice(-10)}`);
  notes.push(`wheel burst: ${scaleOf(wheel.before)} → ${wheelBurst} px per repeat, gliding on to ${wheelEnd}`);
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

  // The Mac trackpad throws too. Safari reports a pinch and a two-finger turn as
  // gesture events, and `gestureend` hands the same velocity to the same glide —
  // but only when the events carry real time between them, which is why these
  // streams are dispatched with a 16 ms gap while the accumulator checks further
  // up dispatch theirs in one instant.
  /** A trackpad stream with `gap` ms between its events, then a reading of the
   * view on every animation frame for `record` ms after `gestureend`. */
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
  const rotate = [['gesturestart', 1, 0], ['gesturechange', 1, 12], ['gesturechange', 1, 24], ['gesturechange', 1, 36], ['gesturechange', 1, 43], ['gestureend', 1, 43]];
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
  assert.equal(padTurns[padTurns.length - 1] % 60, 0, `on a sixth: ${padTurns[padTurns.length - 1]}°`);
  assert.equal(scaleOf(pad.trace[pad.trace.length - 1].text), scaleOf(pad.release), 'and a turn-only stream does not zoom');
  notes.push(`trackpad turn: ${turnOf(pad.release)}° → ${padTurns[padTurns.length - 1]}°`);
  // Both streams interleaved, as a Mac sends them when the fingers do both.
  await open('scale=600');
  pad = await trackpadThrow({steps: [['gesturestart', 1, 0], ['gesturechange', 1.2, 0], ['gesturechange', 1, 10], ['gesturechange', 1.5, 0], ['gesturechange', 1, 22], ['gestureend', 1, 22]]});
  padScales = pad.trace.map(s => scaleOf(s.text));
  assert.ok(padScales[padScales.length - 1] > scaleOf(pad.release) * 1.03, `an interleaved stream throws the zoom: ${scaleOf(pad.release)} → ${padScales[padScales.length - 1]}`);
  assert.ok(pad.trace.map(s => turnOf(s.text)).at(-1) > turnOf(pad.release) + 3, 'and the turn with it');
  assert.ok(settled(padScales), 'and both settle');
  // A trackpad stream released after a pause throws nothing, exactly as fingers
  // held still before lifting do.
  await open('scale=600');
  await gesture(magnify.slice(0, -1), [720, 400], {gap: 16});
  await page.waitForTimeout(250);
  const stalled = await statsText();
  await gesture([magnify[magnify.length - 1]], [720, 400]);
  await page.waitForTimeout(500);
  assert.equal(scaleOf(await statsText()), scaleOf(stalled), 'a trackpad pinch that stopped before lifting throws nothing');

  // ---- the rest of the viewer ----
  await page.goto(`${base}?play=0`); await ready();
  assert.match(await statsText(), /2560×1600 px · quality 1\.00 · 380 px per repeat · (27|48) taps/);
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
  console.log(`${label}: retina rendering, balanced three-colour areas (${share.map(v => v.toFixed(3)).join(' / ')}), the entangled law on rendered pixels with every part of it failing, shader against the CPU rule, fixed scale, seamless tiling, mobile layout, drag pan, wheel zoom, pinch zoom, two-finger turn snapped to 60°, trackpad pinch-and-turn in four event patterns, shutter, momentum on pinch/turn/wheel/trackpad with the elastic limit, reset, stats, pause/play, idle controls, GPU recovery, and reduced motion passed (${notes.join('; ')})`);
} finally {await browser.close();}
