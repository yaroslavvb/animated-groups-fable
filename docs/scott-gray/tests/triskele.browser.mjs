import assert from 'node:assert/strict';
// The module under test also exposes the rule on the CPU, which is what the
// shader is compared against below. The field itself is fetched from whatever
// copy of the page is being tested, so a live deployment is checked against its
// own bytes.
import {colourAt, fromPlane, frameAt, uVolume, valuesAt} from '../triskele/renderer.mjs';
const runtime = '/Users/yaroslavvb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? `${runtime}playwright/index.mjs`);
// BROWSER=webkit runs the same checks in Playwright's WebKit (Safari's engine);
// multi-touch is then dispatched as synthetic pointer events, and Safari's
// trackpad gesture events are exercised as well.
const engine = process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
const {PNG} = (await import(process.env.PNGJS_MODULE ?? `${runtime}pngjs/lib/png.js`)).default;
const base = (process.argv[2] ?? 'http://localhost:8934/scott-gray/triskele/').replace(/\/?$/, '/');
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
async function gesture(steps, at = [640, 400]) {
  return page.evaluate(({steps, at}) => {
    const canvas = document.querySelector('canvas');
    let native = true;
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
    for (const [type, scale, rotation] of steps) fire(type, scale, rotation);
    return native;
  }, {steps, at});
}
async function pixels() { return PNG.sync.read(await page.locator('canvas').screenshot()); }
/** The stats overlay's text, shown and hidden again if it was not already up. */
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
/** The share of pixels that agree in all three channels. */
function exactShare(a, b) {
  let same = 0;
  const count = a.width * a.height;
  for (let i = 0; i < count; i++) if (a.data[4*i] === b.data[4*i] && a.data[4*i+1] === b.data[4*i+1] && a.data[4*i+2] === b.data[4*i+2]) same++;
  return same / count;
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
/** How often `after` shows colour (before + step) mod 3, over the pattern only
 * (skipping antialiased edges and the strip the control bar covers). */
function cycleAgreement(before, after, step, image) {
  const a = classify(before), b = classify(after);
  let same = 0, total = 0;
  for (let y = 0; y < image.height - 220; y++) for (let x = 0; x < image.width; x++) {
    const i = y * image.width + x;
    if (!a.pure[i] || !b.pure[i]) continue;
    total++; if ((a.colour[i] + step) % 3 === b.colour[i]) same++;
  }
  return same / total;
}
/** How often `after` shows, at each point, the colour `before` shows a turn of
 * `degrees` away about the screen centre (positive = anticlockwise on screen,
 * where y runs down), allowing a cyclic colour step. Antialiased pixels and the
 * strip the control bar covers are skipped. */
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
  const large = await pixels();
  assert.ok(new Set(large.data).size > 30, 'nonblank rendered image');
  await page.screenshot({path: `${shots}/triskele-${label}-desktop.png`});
  // Three colours, each holding about a third of the plane — the symmetry makes
  // the three regions images of one another, so none may dominate.
  const share = areas(large);
  for (const value of share) assert.ok(Math.abs(value - 1 / 3) < 0.02, `colour areas ${share.map(v => v.toFixed(4))}`);

  // ---- the three-colour spacetime symmetry, on the pixels the page draws ----
  // A third of a turn cycles the colours one place backwards.
  await page.goto(`${base}?play=0&angle=120`); await ready();
  const turnedOnly = await pixels();
  assert.ok(cycleAgreement(large, turnedOnly, 2, large) > 0.99, 'a 120° turn steps every colour back one place');
  assert.ok(cycleAgreement(large, turnedOnly, 0, large) < 0.1, 'and it is not simply the same picture');
  // So does waiting a third of a period.
  await page.goto(`${base}?play=0&phase=${1 / 3}`); await ready();
  const shiftedOnly = await pixels();
  assert.ok(cycleAgreement(large, shiftedOnly, 2, large) > 0.99, 'a T/3 shift steps every colour back one place');
  // Equivalently: a third of a period later the whole picture, colours and all,
  // is the home picture turned a third of a turn clockwise about its centre.
  assert.ok(turnAgreement(large, shiftedOnly, -120, 0) > 0.99, 'a third of a period turns the picture a third of a turn clockwise');
  assert.ok(turnAgreement(large, shiftedOnly, 120, 0) < 0.1, 'and not anticlockwise');
  // A clockwise third of a turn alone therefore steps the colours back one place.
  assert.ok(turnAgreement(large, large, -120, 1) > 0.99, 'turning the picture clockwise a third of a turn steps every colour back');
  assert.ok(turnAgreement(large, large, 120, 2) > 0.99, 'and anticlockwise steps it forward');
  // Together they are the identity. The rule is exact; the only difference the
  // screen can show comes from rounding cos and sin of the view's turn, which
  // moves a colour boundary by a fraction of a pixel.
  const identities = [];
  for (const [angle, phase, name] of [[120, 2 / 3, 'a 120° turn with a 2T/3 shift'], [240, 1 / 3, 'a 240° turn with a T/3 shift'], [180, 1 / 2, 'a half turn with a half-period shift'], [60, 5 / 6, 'a 60° turn with a 5T/6 shift']]) {
    await page.goto(`${base}?play=0&angle=${angle}&phase=${phase}`); await ready();
    const again = await pixels();
    const [identical, mean] = [exactShare(large, again), averageDifference(large, again)];
    assert.ok(identical > 0.999 && mean < 0.002, `${name} leaves the picture untouched (${(100 * identical).toFixed(4)}% of pixels identical, mean difference ${mean.toExponential(2)})`);
    identities.push(`${name}: ${(100 * identical).toFixed(4)}% identical`);
  }
  notes.push(`turn+shift identities (${identities.join('; ')})`);

  // ---- the shader against an independent reconstruction of the same rule ----
  // Every check above is self-consistent: a shader with a half-texel offset, a
  // transposed lattice basis or a reversed rotation sense would still satisfy
  // them, because such an error is itself symmetric under the turns being
  // tested. So map each device pixel back through the shader's own documented
  // screen → plane → lattice chain and compare the colour it painted with the
  // one the module's CPU reconstruction computes there.
  {
    const plane = frameAt(volume, 0);
    let checked = 0, wrong = 0;
    for (const [scale, phase, cx, cy] of [[380, 0, 0, 0], [1500, 0.41, 0.5, 0.5], [95, 0.77, 0.25, 0.75]]) {
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
    assert.equal(wrong, 0, `the shader paints argmax_k U(R^k x, t): ${wrong} of ${checked} pixels disagree with the CPU reconstruction`);
    notes.push(`shader matches the CPU reconstruction on ${checked} pixels`);
  }

  await page.goto(`${base}?play=0`); await ready();

  // Resizing must reveal/crop repeats, without stretching or zooming them.
  await page.setViewportSize({width: 760, height: 760});
  const square = await pixels();
  assert.ok(averageDifference(large, square, 680, 240, 0, 0, 1520, 1300) < 1, 'center crop retains exact scale');
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
  await page.screenshot({path: `${shots}/triskele-${label}-mobile.png`});

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
  const settled = await pixels();
  await page.waitForTimeout(200);
  assert.equal(averageDifference(settled, await pixels()), 0, 'and it comes to rest');
  // The wheel zooms in about the pointer (Chrome scales the delta by the device pixel ratio, so only the direction is checked here).
  await page.keyboard.press('s');
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(300);
  const wheelScale = Number((await page.locator('#stats').textContent()).match(/(\d+) px per repeat/)[1]);
  assert.ok(wheelScale > 380 && wheelScale < 760, `wheel zoomed in to ${wheelScale} px per repeat`);
  await page.keyboard.press('0');
  // The + key zooms 1.25× about the centre: a repeat is then 475 CSS px, 950 device px.
  await page.keyboard.press('+');
  await page.waitForTimeout(300);
  assert.match(await page.locator('#stats').textContent(), /475 px per repeat/);
  await page.keyboard.press('s');
  const zoomed = await pixels();
  assert.ok(averageDifference(zoomed, zoomed, 0, 0, 950, 0, 1000, 1000) < 1, 'zoomed tiling repeats every 950 device px');
  assert.ok(averageDifference(zoomed, zoomed, 0, 0, 760, 0, 1000, 1000) > 5, 'and no longer every 760');
  await page.keyboard.press('0');
  await page.waitForTimeout(300);
  assert.equal(averageDifference(beforeDrag, await pixels()), 0, 'the 0 key restores the home view exactly');
  assert.equal(await page.locator('#reset').isVisible(), false);
  // A two-finger pinch zooms in as well.
  await fingers(Array.from({length: 6}, (_, i) => [[600 - 8 * i, 400], [680 + 8 * i, 400]]));
  await page.waitForTimeout(300);
  const pinched = await pixels();
  assert.ok(averageDifference(pinched, pinched, 0, 0, 1520, 0, 1000, 1000) < 1, 'pinching the fingers apart doubled the repeat');
  assert.equal(await page.locator('#reset').isVisible(), true);
  await page.locator('#reset').click();
  await page.waitForTimeout(300);
  assert.equal(averageDifference(beforeDrag, await pixels()), 0, 'the reset button restores the home view');
  // Two fingers turning about the screen centre: 58° must snap to a sixth of a
  // turn, since the lattice is triangular. The home view is centred on a
  // threefold centre, so the result must equal the same view asked for by URL.
  const spin = t => { const a = t * 58 * Math.PI / 180, r = 90; return [[640 - r * Math.cos(a), 400 - r * Math.sin(a)], [640 + r * Math.cos(a), 400 + r * Math.sin(a)]]; };
  await fingers(Array.from({length: 9}, (_, i) => spin(i / 8)));
  await page.waitForTimeout(300);
  const spun = await pixels();
  await page.keyboard.press('s');
  assert.match(await page.locator('#stats').textContent(), /380 px per repeat · turned 60°/);
  await page.keyboard.press('s');
  await page.goto(`${base}?play=0&angle=60`); await ready();
  await page.waitForTimeout(150);
  assert.ok(averageDifference(spun, await pixels()) < 1.5, 'the two-finger turn snapped to the same sixth of a turn the URL asks for');
  await page.goto(`${base}?play=0`); await ready(); await page.waitForTimeout(150);
  // ---- the Mac trackpad: a pinch and a turn at the same time ----
  // macOS sends the two as separate streams of gesture events, each event
  // carrying only its own quantity. Each stream must accumulate on its own:
  // applying both fields of every event lets them cancel, which is why the two
  // only ever worked one at a time. Every pattern below must end zoomed AND
  // turned.
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
  // One event naming both quantities is not enough to conclude that this Safari
  // names both in every event. A single coalesced event in an otherwise split
  // stream must not switch the handler into a mode where the next magnify event
  // wipes the turn — the exact cancellation the two accumulators exist for.
  await page.keyboard.press('0');
  await gesture([['gesturestart', 1, 0], ['gesturechange', 1.4, 0], ['gesturechange', 1, 20], ['gesturechange', 1.45, 21], ['gesturechange', 1.6, 0], ['gestureend', 1.6, 0]]);
  await page.waitForTimeout(150);
  const coalesced = await statsText();
  assert.equal(turnOf(coalesced), 21, `one event naming both does not strand the turn: ${coalesced}`);
  assert.equal(scaleOf(coalesced), 608, 'and the pinch goes on (380 → 608 px per repeat)');
  // A stream that really does name both in every event is still believed — and
  // even there, a neutral field arriving beside a moving one is held rather
  // than allowed to cancel the other accumulator.
  await page.keyboard.press('0');
  await gesture([['gesturestart', 1, 0], ['gesturechange', 1.2, 10], ['gesturechange', 1.3, 20], ['gesturechange', 1.4, 0], ['gestureend', 1.4, 0]]);
  await page.waitForTimeout(150);
  const latched = await statsText();
  assert.equal(scaleOf(latched), 532, `a cumulative stream still zooms: ${latched}`);
  assert.equal(turnOf(latched), 20, 'and a lone 0° beside a moving scale does not wipe the turn');
  assert.match(latched, /both 2 of 4/, `two events named both: ${latched}`);
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
  await page.waitForTimeout(150);
  const withoutShutter = await pixels();
  assert.match(await statsText(), /shutter off/, 'the stats overlay names the shutter');
  await page.goto(`${base}?play=0`); await ready();
  await page.waitForTimeout(400);
  assert.equal(averageDifference(withoutShutter, await pixels()), 0, 'a still frame is bit-identical with the shutter available and with it off');
  assert.match(await statsText(), /shutter off \(of 3\)/, 'and the overlay says the shutter is not being paid for');
  // ?motion=0 asks for the shutter whenever anything moves at all — which is
  // not the same as asking for it when nothing does. A still view at a still
  // phase has nothing to integrate: three sub-samples would be three copies of
  // one instant, three times the texture work for a picture that must come out
  // bit-identical anyway.
  for (const query of ['play=0&motion=0', 'play=0&taa=5&shutter=2&motion=0']) {
    await page.goto(`${base}?${query}`); await ready();
    await page.waitForTimeout(400);
    assert.equal(averageDifference(withoutShutter, await pixels()), 0, `?${query} draws the same bits as no shutter at all`);
    assert.match(await statsText(), /shutter off \(of [35]\)/, `?${query} pays for one sub-sample: ${await statsText()}`);
  }
  // ?shutter=0 asks for no integration, and must cost nothing as well as show
  // nothing: a zero-width shutter collapses to a single sub-sample.
  await page.goto(`${base}?taa=3&play=1&stats=1&scale=2400&shutter=0`); await ready();
  await page.waitForTimeout(400);
  const zeroWidth = await page.locator('#stats').textContent();
  assert.match(zeroWidth, /shutter off \(of 3\)/, `a zero-width shutter draws one layer: ${zeroWidth}`);
  assert.match(zeroWidth, /(27|48) taps/, `and costs one: ${zeroWidth}`);
  // Zoomed in and playing, the shutter does switch itself on, and the overlay
  // names its width and the taps it costs.
  await page.goto(`${base}?taa=3&play=1&stats=1&scale=2400`); await ready();
  await page.waitForTimeout(500);
  const engaged = await page.locator('#stats').textContent();
  assert.match(engaged, /shutter 3×0\.30 frame/, `the shutter engages at a fast framing: ${engaged}`);
  assert.match(engaged, /(81|144) taps/, `and its cost is counted in the taps: ${engaged}`);
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
      // Zoomed right in, and clear of all three threefold centres (the nearest
      // is a quarter of a lattice length away, 600 px off this 480 px canvas),
      // so a boundary crosses many pixels in one frame: this is the fast-moving
      // edge the shutter is for.
      const renderer = mod.createRenderer(canvas, field, {pixelRatio: 1, adaptive: false, display, tilePixels: 2400, center: [0.25, 0.25], taa, shutter: 1});
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
  // A pixel every sub-phase agrees on should come out as it would have without
  // the shutter, and here it does to a level out of 255. That last level is a
  // property of this framing and not a guarantee: sub-sample 0 is fetched
  // through constant indices and the rest through dynamically indexed uniform
  // arrays, which a driver need not compile to the same arithmetic, and the
  // N-way average rounds. It bounds nothing the page actually draws — a picture
  // still enough for every sub-phase to agree everywhere is drawn with one
  // layer, through the one-layer shader, bit-identical by construction.
  assert.ok(shutter.movedStatic <= 1, `pixels no boundary crossed are unchanged (worst ${shutter.movedStatic}/255)`);
  assert.ok(shutter.changed > 0.002 * shutter.total, `a fast boundary sweeps pixels (${(100 * shutter.changed / shutter.total).toFixed(2)}% of the frame)`);
  assert.ok(shutter.blendOn > 20 * Math.max(1, shutter.blendOff), `the shutter paints intermediate colours where the plain frame has none (${shutter.blendOn} vs ${shutter.blendOff} pixels)`);
  notes.push(`shutter blends ${shutter.blendOn} pixels a plain frame paints pure, worst deviation from the mean of its sub-phases ${shutter.worst.toFixed(2)}/255`);
  // Frame rate is never traded for motion blur, and the two are not traded
  // together either: the shutter is a rung of its own ABOVE the resolution
  // ladder, so a GPU that cannot keep up loses the blur first and the pixels
  // only if that was not enough.
  const governed = await page.evaluate(async ({base}) => {
    const mod = await import(`${base}renderer.mjs`);
    const bytes = await (await fetch(`${base}field.f32`)).arrayBuffer();
    const dv = new DataView(bytes);
    const field = Float32Array.from({length: bytes.byteLength / 4}, (_, i) => dv.getFloat32(i * 4, true));
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;left:0;top:0;width:400px;height:300px;opacity:0.01;pointer-events:none';
    document.body.append(canvas);
    // A 60 Hz display fed frames 33 ms apart: every frame is late, whatever the
    // renderer does about it. Zoomed in, so the shutter is engaged to start with.
    const renderer = mod.createRenderer(canvas, field, {adaptive: true, display: 1000 / 60, tilePixels: 2400});
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

  // ---- the rest of the viewer ----
  await page.goto(`${base}?play=0`); await ready();
  await page.waitForTimeout(150);
  // The stats readout appears on the S key and names the render size.
  await page.keyboard.press('s');
  assert.match(await page.locator('#stats').textContent(), /2560×1600 px · quality 1\.00 · 380 px per repeat · (27|48) taps/);
  await page.keyboard.press('s');
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
  console.log(`${label}: retina rendering, balanced three-colour areas (${share.map(v => v.toFixed(3)).join(' / ')}), turn and shift colour cycles, shader against the CPU rule, fixed scale, seamless tiling, mobile layout, drag pan, wheel zoom, pinch zoom, two-finger turn snapped to 60°, trackpad pinch-and-turn in four event patterns, the shutter, reset, stats, pause/play, idle controls, GPU recovery, and reduced motion passed (${notes.join('; ')})`);
} finally {await browser.close();}
