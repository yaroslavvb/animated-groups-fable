// Trefoil in a real browser engine: the S₃ colour symmetry on the pixels the
// page actually draws — the free 3-cycle, the entangled swap and every part of
// it that fails — the shader against an independent reconstruction of the same
// rule, the viewer's gestures and layout, the Safari trackpad pinch-and-turn,
// the shutter, and the momentum that carries a pinch or a turn on after the
// fingers lift.
//
// Usage: node tests/trefoil.browser.mjs [base-url] [label]
//        BROWSER=webkit runs the same checks in Playwright's WebKit.
import assert from 'node:assert/strict';
// The module under test also exposes the rule on the CPU, which is what the
// shader is compared against below. The field itself is fetched from whatever
// copy of the page is being tested, so a live deployment is checked against its
// own bytes.
import {colourAt, fromPlane, frameAt, halfTurn, MAX_SCALE, offsetBy, TILE_PIXELS, toPlane, uVolume, valuesAt} from '../trefoil/renderer.mjs';
import {byName, centreOf, MAX_UNITS} from '../trefoil/generators.mjs';
import {ELASTIC_GIVE, MAX_ZOOM_RATE, ZOOM_TAU} from '../trefoil/momentum.mjs';
const runtime = '/Users/yaroslavvb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? `${runtime}playwright/index.mjs`);
const engine = process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
const {PNG} = (await import(process.env.PNGJS_MODULE ?? `${runtime}pngjs/lib/png.js`)).default;
const base = (process.argv[2] ?? 'http://localhost:8934/scott-gray/trefoil/').replace(/\/?$/, '/');
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
// The colour permutations, as maps from the colour before to the colour after.
const IDENTITY = [0, 1, 2], MINUS = [2, 0, 1], PLUS = [1, 2, 0];
const SWAP12 = [0, 2, 1], SWAP01 = [1, 0, 2], SWAP02 = [2, 1, 0];
// The rows the control bar covers, in device pixels, which carry no pattern.
const BAND = 220;
// The home framing in CSS pixels per lattice length: one motif, the repeat of
// the finer lattice the eye actually reads, is 380 px of it.
const HOME = Math.round(TILE_PIXELS);
let touch = null;
/** Two fingers through a sequence of positions: real touch input through the
 * devtools protocol in Chromium, synthetic pointer events in WebKit. `settle`
 * is a pause before the fingers lift, which is what makes the gesture end at
 * rest: a pinch or a turn released while still moving is thrown, and the checks
 * here are about where the fingers put the view, not where it glides on to.
 * (The glide itself is checked further down.) */
async function fingers(frames, {settle = 200} = {}) {
  if (engine === 'chromium') {
    touch ??= await context.newCDPSession(page);
    await touch.send('Emulation.setTouchEmulationEnabled', {enabled: true});
    const points = frame => frame.map(([x, y], i) => ({x, y, id: i + 1}));
    await touch.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: points(frames[0])});
    for (const frame of frames.slice(1)) await touch.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: points(frame)});
    if (settle) await page.waitForTimeout(settle);
    await touch.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await touch.send('Emulation.setTouchEmulationEnabled', {enabled: false});
    return;
  }
  await page.evaluate(async ({frames, settle}) => {
    const canvas = document.querySelector('canvas');
    const fire = (type, [x, y], id) => canvas.dispatchEvent(new PointerEvent(type, {pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x, clientY: y, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true}));
    frames[0].forEach((point, i) => fire('pointerdown', point, i + 1));
    for (const frame of frames.slice(1)) frame.forEach((point, i) => fire('pointermove', point, i + 1));
    if (settle) await new Promise(resolve => setTimeout(resolve, settle));
    frames[frames.length - 1].forEach((point, i) => fire('pointerup', point, i + 1));
  }, {frames, settle});
}
/** Safari's trackpad gesture events. On a Mac a pinch and a turn arrive as two
 * separate streams, each event carrying only its own quantity; `steps` says
 * exactly what to send. Safari itself constructs GestureEvents; other engines
 * get a plain event with the same fields, which exercises the page's handler.
 *
 * `gap` puts that many milliseconds of real time between the events, which is
 * what a trackpad does and what the release velocity is measured from; the
 * default 0 dispatches the whole stream in one instant, so the accumulator
 * checks below see exactly where the gesture left the view and nothing is
 * thrown. */
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
/** How often `after` shows perm[colour] at the very same pixel `before` shows
 * colour — no resampling at all, so this is the sharpest form a claim can take.
 * Antialiased pixels and the strip the control bar covers are skipped. */
function sameAgreement(before, after, perm) {
  const a = classify(before), b = classify(after);
  let same = 0, total = 0;
  for (let y = 0; y < before.height - BAND; y++) for (let x = 0; x < before.width; x++) {
    const i = y * before.width + x;
    if (!a.pure[i] || !b.pure[i]) continue;
    total++; if (perm[a.colour[i]] === b.colour[i]) same++;
  }
  return same / total;
}
/** The same, with `after` turned half a turn about the screen centre. A half
 * turn of a pixel grid is exact — pixel (x, y) maps to (W−1−x, H−1−y), and the
 * shader's screen coordinate negates with it — so this resamples nothing
 * either. The control bar's rows are skipped at both ends. */
function halfTurnAgreement(before, after, perm) {
  const a = classify(before), b = classify(after);
  const W = before.width, H = before.height;
  let same = 0, total = 0;
  for (let y = BAND; y < H - BAND; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, j = (H - 1 - y) * W + (W - 1 - x);
    if (!a.pure[i] || !b.pure[j]) continue;
    total++; if (perm[a.colour[i]] === b.colour[j]) same++;
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
  // The generator marks are off by default, but they sit ON TOP of the canvas
  // and an element screenshot takes whatever is over it — so the preference a
  // viewer would use is written explicitly here, and every pixel check below is
  // held to the marks being gone whatever this browser profile remembers. The
  // overlay has its own section at the end, which clears this again.
  await page.goto(base); await ready();
  await page.evaluate(() => { try { localStorage.setItem('trefoil:generators', '0'); } catch {} });
  await page.goto(`${base}?play=0`); await ready();
  assert.equal(await page.locator('#generators').evaluate(n => n.hasAttribute('hidden')), true, 'the pixel checks run with the marks off');
  assert.deepEqual(await page.locator('canvas').evaluate(c => [c.width, c.height]), [2880, 2000], 'native retina resolution');
  assert.equal(await page.locator('#notice').isVisible(), false);
  const home = await pixels();
  assert.ok(new Set(home.data).size > 30, 'nonblank rendered image');
  await page.screenshot({path: `${shots}/trefoil-${label}-desktop.png`});
  // Three colours, each holding a third of the plane. On this page that is
  // exact on the lattice — translation by b carries each colour's region onto
  // the next at a FIXED instant — so a screenful, which is not a whole number
  // of cells, lands within a percent of it rather than the four the sibling
  // pages need.
  const share = areas(home);
  for (const value of share) assert.ok(Math.abs(value - 1 / 3) < 0.02, `colour areas ${share.map(v => v.toFixed(4))}`);
  notes.push(`colour areas ${share.map(v => v.toFixed(4)).join(' / ')}`);

  // ---- the entangled law, on the pixels the page draws ----
  // Turn the picture upside down about the screen centre, run it forward half a
  // period, and exchange teal and sand: the picture is identical, everywhere,
  // exactly. Nothing is resampled here — a half turn permutes the pixel grid.
  const half = await shot('?play=0&phase=0.5');
  assert.equal(halfTurnAgreement(home, half, SWAP12), 1, 'a half-turn with half a period and the swap returns the picture exactly');
  notes.push('turn + wait + swap: 100.0000% of the compared pixels, exactly');
  // Every proper part of that fails, and this is the point of the page.
  assert.ok(halfTurnAgreement(home, half, IDENTITY) < 0.5, 'the same turn and wait WITHOUT the recolouring is not a symmetry');
  assert.ok(halfTurnAgreement(home, half, PLUS) < 0.5, 'nor with the colours cycled instead of swapped');
  assert.ok(halfTurnAgreement(home, half, MINUS) < 0.5, 'nor the other way round');
  assert.equal(halfTurnAgreement(home, half, SWAP01), 0, 'and with either of the other two swaps it agrees nowhere at all');
  assert.equal(halfTurnAgreement(home, half, SWAP02), 0, 'nor with the third');
  for (const [name, perm] of [['identity', IDENTITY], ['+1', PLUS], ['−1', MINUS], ['(1 2)', SWAP12], ['(0 1)', SWAP01], ['(0 2)', SWAP02]]) {
    // The half-turn alone, at the one centre where it could possibly work: the
    // same frame compared with itself, turned over.
    assert.ok(halfTurnAgreement(home, home, perm) < 0.6, `the half-turn alone is not a symmetry (colours ${name})`);
    // And half a period alone, at the same pixels.
    assert.ok(sameAgreement(home, half, perm) < 0.6, `half a period alone is not a symmetry (colours ${name})`);
  }
  const turnAlone = Math.max(...[IDENTITY, PLUS, MINUS, SWAP12, SWAP01, SWAP02].map(perm => halfTurnAgreement(home, home, perm)));
  const waitAlone = Math.max(...[IDENTITY, PLUS, MINUS, SWAP12, SWAP01, SWAP02].map(perm => sameAgreement(home, half, perm)));
  notes.push(`the parts fail: turn alone ≤ ${(100 * turnAlone).toFixed(1)}%, wait alone ≤ ${(100 * waitAlone).toFixed(1)}%`);
  // Turning the VIEW says the same thing without touching the pixels at all:
  // ?angle=180 at half a period is, pixel for pixel, the home frame with teal
  // and sand exchanged.
  const turned = await shot('?play=0&angle=180&phase=0.5');
  assert.equal(sameAgreement(home, turned, SWAP12), 1, 'the view turned 180° at T/2 is the home frame with teal and sand exchanged');
  assert.equal(sameAgreement(home, turned, SWAP01), 0, 'and it is nothing else');
  assert.equal(sameAgreement(home, turned, SWAP02), 0);
  // The same half-turn with NO time shift is the negative that matters most:
  // the turn is not a symmetry of any single frame, with or without a swap.
  const turnedNow = await shot('?play=0&angle=180');
  for (const [name, perm] of [['(1 2)', SWAP12], ['identity', IDENTITY], ['+1', PLUS]]) {
    assert.ok(sameAgreement(home, turnedNow, perm) < 0.6, `a single frame has no half-turn symmetry (colours ${name})`);
  }
  assert.ok(sameAgreement(home, turnedNow, SWAP12) < 0.05, 'the turn and the swap without the wait agree almost nowhere');

  // ---- the free 3-cycle: no waiting at all ----
  // Slide the view by one motif — b = (1/3, 2/3) of a lattice cell — and the
  // shapes land on shapes with every colour stepped back one place. A non-cyclic
  // colour group forces one recolouring to be free like this; here it is the
  // 3-cycle, and you can check it in a screenshot.
  const slid = await shot(`?play=0&x=${1 / 3}&y=${2 / 3}`);
  assert.equal(sameAgreement(home, slid, MINUS), 1, 'sliding the view by b steps every colour back one, with no time shift');
  assert.equal(sameAgreement(home, slid, IDENTITY), 0, 'and the colours really do move');
  assert.equal(sameAgreement(home, slid, PLUS), 0);
  const slidTwice = await shot(`?play=0&x=${2 / 3}&y=${4 / 3}`);
  assert.equal(sameAgreement(home, slidTwice, PLUS), 1, 'twice round steps them the other way');
  notes.push('translation by b recolours with no time shift: 100.0000%');
  // The threefold and sixfold members of the family, also pixel for pixel.
  const third = await shot(`?play=0&angle=120&phase=${2 / 3}`);
  assert.equal(sameAgreement(home, third, IDENTITY), 1, 'a third of a turn with 2T/3 keeps every colour where it is');
  const sixth = await shot(`?play=0&angle=60&phase=${5 / 6}`);
  assert.equal(sameAgreement(home, sixth, SWAP12), 1, 'a sixth of a turn with 5T/6 swaps teal and sand again');
  assert.ok(sameAgreement(home, sixth, IDENTITY) < 0.5, 'and that one is a swap, not the identity');

  // ---- the centre of the half-turn ----
  // The half-turn fixes the lattice origin, which sits under the middle of the
  // screen. The three sampled points there are the wave's own three threefold
  // centres, where U sits within 2.3 × 10⁻⁴ of one value, so all three colours
  // meet within a pixel or two of the screen centre: the fixed point of the law
  // is drawn as a triple junction. (Which of teal and sand holds the exact
  // centre alternates every half period, with a margin of 10⁻⁶ — far too fine
  // to read off a screenshot, which is why the node test checks it instead.)
  {
    const {colour, pure} = classify(home);
    const seen = new Set();
    const cx = home.width / 2, cy = home.height / 2;
    for (let dy = -16; dy <= 16; dy++) for (let dx = -16; dx <= 16; dx++) {
      const i = (cy + dy) * home.width + cx + dx;
      if (pure[i]) seen.add(colour[i]);
    }
    assert.equal(seen.size, 3, `all three colours meet at the half-turn centre: saw ${[...seen]}`);
  }

  // ---- the shader against an independent reconstruction of the same rule ----
  // Every check above is self-consistent: a shader with a half-texel offset, a
  // transposed lattice basis or the wrong sense of turn could still satisfy
  // them. So map each device pixel back through the shader's own documented
  // screen → plane → lattice chain and compare the colour it painted with the
  // one the module's CPU reconstruction computes there.
  {
    const plane = frameAt(volume, 0);
    let checked = 0, wrong = 0;
    for (const [scale, phase, cx, cy] of [[HOME, 0, 0, 0], [1500, 0.41, 0.5, 0.5], [95, 0.77, 0.25, 0.75]]) {
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
    assert.equal(wrong, 0, `the shader paints argmax_k U(x + k b, t): ${wrong} of ${checked} pixels disagree with the CPU reconstruction`);
    notes.push(`shader matches the CPU reconstruction on ${checked} pixels`);
    // And the CPU reconstruction carries both laws off the nodes, which is what
    // makes the comparison above a comparison with the rule and not with itself.
    const now = frameAt(volume, 0), later = frameAt(volume, 0.5);
    for (const point of [[0.137, 0.62], [0.9, 0.04], [0.31, 0.27]]) {
      assert.equal(colourAt(now, offsetBy(point)), (colourAt(now, point) + 2) % 3, `the 3-cycle at ${point}`);
      assert.equal(colourAt(later, halfTurn(point)), (3 - colourAt(now, point)) % 3, `the swap at ${point}`);
    }
  }

  // A GPU without `OES_texture_float_linear` cannot filter a float texture, so
  // the shader falls back to sixteen point fetches per position and does the
  // cubic itself. That path ships to anyone whose driver lacks the extension and
  // is never otherwise exercised here, so it is run explicitly, with the
  // extension hidden: it must compile, cost 48 taps instead of 27, and draw the
  // same picture.
  {
    const both = await page.evaluate(async ({base}) => {
      const mod = await import(`${base}renderer.mjs`);
      const bytes = await (await fetch(`${base}field.f32`)).arrayBuffer();
      const dv = new DataView(bytes);
      const field = Float32Array.from({length: bytes.byteLength / 4}, (_, i) => dv.getFloat32(i * 4, true));
      const W = 300, H = 200;
      const draw = block => {
        const canvas = document.createElement('canvas');
        canvas.style.cssText = `position:fixed;left:0;top:0;width:${W}px;height:${H}px;opacity:0.01;pointer-events:none`;
        document.body.append(canvas);
        const proto = WebGL2RenderingContext.prototype, original = proto.getExtension;
        if (block) proto.getExtension = function (name) { return name === 'OES_texture_float_linear' ? null : original.call(this, name); };
        try {
          const renderer = mod.createRenderer(canvas, field, {pixelRatio: 1, adaptive: false, tilePixels: 400, center: [0.2, 0.3], taa: 1});
          renderer.draw(0.137, {});
          const gl = canvas.getContext('webgl2');
          const data = new Uint8Array(W * H * 4);
          gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, data);
          const taps = renderer.taps;
          renderer.dispose(); canvas.remove();
          return {taps, data: Array.from(data)};
        } finally { proto.getExtension = original; }
      };
      const linear = draw(false), point = draw(true);
      let differing = 0;
      for (let i = 0; i < linear.data.length; i += 4) {
        let worst = 0;
        for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(linear.data[i + c] - point.data[i + c]));
        if (worst > 8) differing++;
      }
      return {linearTaps: linear.taps, pointTaps: point.taps, differing, total: W * H};
    }, {base});
    assert.equal(both.linearTaps, 27, 'nine bilinear fetches per position where the float filter exists');
    assert.equal(both.pointTaps, 48, 'sixteen point fetches per position where it does not');
    assert.ok(both.differing < 0.005 * both.total, `the two reconstructions draw the same picture (${both.differing} of ${both.total} pixels differ)`);
    notes.push(`the no-float-filter fallback draws the same picture (${both.differing} of ${both.total} pixels differ)`);
  }

  await page.goto(`${base}?play=0`); await ready();

  // ---- framing, tiling and the endless pan ----
  await page.setViewportSize({width: 760, height: 760});
  const square = await pixels();
  assert.ok(averageDifference(home, square, 680, 240, 0, 0, 1520, 1300) < 1, 'center crop retains exact scale');
  // The colouring repeats exactly on the COARSE lattice: one lattice length
  // along a₁ is 660 CSS px at ?scale=660, so 1320 device px at DPR 2. (On the
  // finer lattice it repeats too, but with the colours stepped round — which is
  // the whole point of the page, and is checked above.)
  await page.goto(`${base}?play=0&scale=660`); await ready();
  await page.setViewportSize({width: 1520, height: 1000});
  await page.waitForTimeout(150);
  const repeated = await pixels();
  assert.ok(averageDifference(repeated, repeated, 0, 0, 1320, 0, 1600, 1500) < 1, 'periodic tiling has no seam or orientation change');

  await page.goto(`${base}?play=0`); await ready();
  await page.setViewportSize({width: 390, height: 844});
  await page.waitForTimeout(150);
  // Narrow screens keep two motifs across the short side: 195 CSS px a motif,
  // which is 195√3 = 338 CSS px per lattice length.
  assert.equal(scaleOf(await statsText()), 338, 'the phone framing keeps two motifs across');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth && document.documentElement.scrollHeight === innerHeight), 'mobile fills viewport without scrolling');
  const bounds = await page.locator('#controls').boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, 'mobile controls fit');
  await page.screenshot({path: `${shots}/trefoil-${label}-mobile.png`});

  // Dragging pans the endless pattern: a 95 CSS px drag (190 device px) shifts
  // the image exactly, and the reset button appears.
  await page.setViewportSize({width: 1280, height: 800});
  await page.goto(`${base}?play=0`); await ready(); await page.waitForTimeout(150);
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
  // The wheel zooms in about the pointer (Chrome scales the delta by the device
  // pixel ratio, so only the direction is checked here).
  await page.keyboard.press('0');
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(400);
  const wheelScale = scaleOf(await statsText());
  assert.ok(wheelScale > HOME && wheelScale < 2 * HOME, `wheel zoomed in to ${wheelScale} px per repeat`);
  await page.keyboard.press('0');
  // The + key zooms 1.25× about the centre.
  await page.keyboard.press('+');
  await page.waitForTimeout(300);
  assert.equal(scaleOf(await statsText()), Math.round(TILE_PIXELS * 1.25));
  await page.keyboard.press('0');
  await page.waitForTimeout(400);
  assert.equal(averageDifference(beforeDrag, await pixels()), 0, 'the 0 key restores the home view exactly');
  assert.equal(await page.locator('#reset').isVisible(), false);
  // A two-finger pinch zooms in as well.
  await fingers(Array.from({length: 6}, (_, i) => [[600 - 8 * i, 400], [680 + 8 * i, 400]]));
  await page.waitForTimeout(300);
  assert.ok(scaleOf(await statsText()) > 1.5 * HOME, 'pinching the fingers apart zoomed in');
  assert.equal(await page.locator('#reset').isVisible(), true);
  await page.locator('#reset').click();
  await page.waitForTimeout(300);
  assert.equal(averageDifference(beforeDrag, await pixels()), 0, 'the reset button restores the home view');
  // Two fingers turning about the screen centre: 58° must snap to a sixth of a
  // turn — and here a sixth really is a symmetry of the picture, since the six
  // rotations about the origin are all symmetries, three of them swapping a
  // pair of colours.
  const spin = t => { const a = t * 58 * Math.PI / 180, r = 90; return [[640 - r * Math.cos(a), 400 - r * Math.sin(a)], [640 + r * Math.cos(a), 400 + r * Math.sin(a)]]; };
  await fingers(Array.from({length: 9}, (_, i) => spin(i / 8)));
  await page.waitForTimeout(300);
  const spun = await pixels();
  assert.match(await statsText(), new RegExp(`${HOME} px per repeat · turned 60°`));
  await page.goto(`${base}?play=0&angle=60`); await ready();
  await page.waitForTimeout(150);
  assert.ok(averageDifference(spun, await pixels()) < 1.5, 'the two-finger turn snapped to the same sixth of a turn the URL asks for');
  await page.goto(`${base}?play=0`); await ready(); await page.waitForTimeout(150);

  // ---- the Mac trackpad: a pinch and a turn at the same time ----
  // macOS sends the two as separate streams of gesture events, each event
  // carrying only its own quantity. Each stream must accumulate on its own:
  // applying both fields of every event lets them cancel, which is why the two
  // only ever worked one at a time.
  const pinched = Math.round(HOME * 1.4), pinchedHalf = Math.round(HOME * 1.5);
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
    await page.waitForTimeout(250);
    const text = await statsText();
    assert.equal(scaleOf(text), pinched, `${name}: pinched to 1.4× (${HOME} → ${pinched} px per repeat), not ${scaleOf(text)}`);
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
  // in a stream that has only ever named the one quantity.
  await page.keyboard.press('0');
  await gesture([['gesturestart', 1, 0], ['gesturechange', 1.3, 0], ['gesturechange', 1, 0], ['gestureend', 1, 0]]);
  await page.waitForTimeout(250);
  assert.equal(scaleOf(await statsText()), HOME, 'a pinch back to 1× returns to the home scale');
  await page.keyboard.press('0');
  await gesture([['gesturestart', 1, 0], ['gesturechange', 1, 24], ['gesturechange', 1, 0], ['gestureend', 1, 0]]);
  await page.waitForTimeout(250);
  assert.equal(turnOf(await statsText()), 0, 'a turn back to 0° returns to no turn');
  // But once BOTH streams have spoken, an event naming neither is ambiguous, and
  // applying it to both accumulators would throw the other one away.
  await page.keyboard.press('0');
  await gesture([['gesturestart', 1, 0], ['gesturechange', 1.4, 0], ['gesturechange', 1, 20], ['gesturechange', 1, 0]]);
  await page.waitForTimeout(120);
  const throughZero = await statsText();
  assert.equal(scaleOf(throughZero), pinched, `the zoom survives a turn passing through 0°: ${throughZero}`);
  assert.equal(turnOf(throughZero), 20, 'and the turn is held at its last named value');
  assert.match(throughZero, /held 1/, `the ambiguous event is counted as held: ${throughZero}`);
  await gesture([['gesturechange', 1, -15], ['gestureend', 1, -15]]);
  await page.waitForTimeout(250);
  const resumed = await statsText();
  assert.equal(turnOf(resumed), -15, 'the next turn event lands');
  assert.equal(scaleOf(resumed), pinched, 'with the zoom still in force');
  // The mirror case: a pinch back through exactly 1× must not wipe the turn.
  await page.keyboard.press('0');
  await gesture([['gesturestart', 1, 0], ['gesturechange', 1, 20], ['gesturechange', 1.4, 0], ['gesturechange', 1, 0], ['gestureend', 1, 0]]);
  await page.waitForTimeout(250);
  const mirrored = await statsText();
  assert.equal(turnOf(mirrored), 20, `the turn survives a pinch passing through 1×: ${mirrored}`);
  assert.equal(scaleOf(mirrored), pinched, 'and the zoom is held at its last named value');
  // A gesture that names nothing at all moves nothing; and the turn still snaps.
  await page.keyboard.press('0');
  await gesture([['gesturestart', 1, 0], ['gesturechange', 1, 0], ['gestureend', 1, 0]]);
  await page.waitForTimeout(250);
  const idle = await statsText();
  assert.equal(scaleOf(idle), HOME); assert.equal(turnOf(idle), 0);
  await page.keyboard.press('0');
  await gesture([['gesturestart', 1, 0], ['gesturechange', 1.5, 0], ['gesturechange', 1, 58], ['gestureend', 1, 58]]);
  await page.waitForTimeout(300);
  const snapped = await statsText();
  assert.equal(turnOf(snapped), 60, 'the turn snapped to a sixth');
  assert.equal(scaleOf(snapped), pinchedHalf, 'and the zoom survived the snap');
  // Gesture events arriving while fingers are down are ignored: iPhone and iPad
  // keep doing pan, zoom and turn through the pointer events above.
  await page.keyboard.press('0');
  await page.waitForTimeout(150);
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
  await page.waitForTimeout(300);
  assert.equal(averageDifference(beforeTouch, await pixels()), 0, 'gesture events are ignored while fingers are down');
  // The Mac fallbacks: the turn keys repeat while held, so ] can be held down
  // through a pinch, and Option with the wheel turns about the pointer.
  await page.keyboard.press('0');
  await gesture([['gesturestart', 1, 0], ['gesturechange', 1.5, 0]]);
  await page.keyboard.press(']');
  await page.waitForTimeout(120);
  const keyDuring = await statsText();
  assert.equal(turnOf(keyDuring), 15, 'a turn key works during a trackpad pinch');
  assert.equal(scaleOf(keyDuring), pinchedHalf, 'and the pinch is still in force');
  await gesture([['gesturechange', 2, 0], ['gestureend', 2, 0]]);
  await page.waitForTimeout(250);
  const keyAfter = await statsText();
  assert.equal(turnOf(keyAfter), 15, 'the next gesture event does not undo the key turn');
  assert.equal(scaleOf(keyAfter), Math.round(HOME * 2), 'and the pinch goes on from where it was');
  await page.keyboard.press('0');
  await page.mouse.move(640, 400);
  await page.keyboard.down('Alt');
  await page.mouse.wheel(0, -120);
  await page.keyboard.up('Alt');
  await page.waitForTimeout(300);
  const optionWheel = await statsText();
  assert.ok(turnOf(optionWheel) > 0, `Option and the wheel turn the pattern (${turnOf(optionWheel)}°)`);
  assert.equal(scaleOf(optionWheel), HOME, 'and do not zoom');
  await page.keyboard.press('0');
  // The ] key turns 15° clockwise, Shift+] a sixth of a turn; [ turns back.
  await page.keyboard.press(']'); await page.waitForTimeout(200);
  assert.match(await statsText(), /turned 15°/);
  await page.keyboard.press('['); await page.keyboard.press('Shift+]'); await page.waitForTimeout(200);
  assert.match(await statsText(), /turned 60°/);
  await page.keyboard.press('0'); await page.waitForTimeout(400);
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
  // The shutter is spent only where the picture actually moves, and the gate is
  // on the SMEAR it would draw — travel × shutter — not on the travel. At the
  // home framing the pattern travels 0.6 of a pixel a frame and there is nothing
  // to integrate, so it stays off, and the taps count says so. With the full box
  // filter (?shutter=1) the gate is 0.75 px of travel, which 2400 px per lattice
  // length passes at 2.2 px a frame; with the shipped 0.3 shutter the same
  // 0.75 px of smear asks for 2.5 px of travel, so 2400 is still off and the
  // pattern engages the shutter by itself only past about 2730.
  // The stats line only says what the shutter is doing once frames are actually
  // being counted; over the network the first ones can be a moment late, so the
  // reading waits for a non-zero frame rate rather than for a fixed 600 ms.
  const playing = async () => {
    await page.waitForTimeout(600);
    await page.waitForFunction(() => /[1-9]\d* fps/.test(document.querySelector('#stats')?.textContent ?? ''), null, {timeout: 5000})
      .catch(() => {});
  };
  await page.goto(`${base}?taa=3&play=1&stats=1`); await ready();
  await playing();
  const homeStats = await page.locator('#stats').textContent();
  assert.match(homeStats, /shutter off \(of 3\)/, `the home framing does not pay for a shutter: ${homeStats}`);
  assert.match(homeStats, /(27|48) taps/, `one sampling of the field per pixel: ${homeStats}`);
  for (const [scale, on] of [[2400, false], [3000, true]]) {
    await page.goto(`${base}?taa=3&play=1&stats=1&scale=${scale}`); await ready();
    await playing();
    const text = await page.locator('#stats').textContent();
    assert.match(text, on ? /shutter 3×0\.30 frame/ : /shutter off \(of 3\)/, `the default shutter at ${scale} px per repeat: ${text}`);
  }
  await page.goto(`${base}?taa=3&play=1&stats=1&scale=2400&shutter=1`); await ready();
  await page.waitForTimeout(600);
  const zoomStats = await page.locator('#stats').textContent();
  assert.match(zoomStats, /shutter 3×1\.00 frame/, `three sub-samples over a full frame interval: ${zoomStats}`);
  assert.match(zoomStats, /(81|144) taps/, `and three samplings of the field per pixel: ${zoomStats}`);
  await page.goto(`${base}?taa=0&play=1&stats=1&scale=2400`); await ready();
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
      // Zoomed right in, so a boundary crosses many pixels in one frame: this
      // is the fast-moving edge the shutter is for.
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
  // Frame rate is never traded for motion blur: the shutter is a rung of its
  // own ABOVE the resolution ladder, so a GPU that cannot keep up loses the
  // blur first and the pixels only if that was not enough.
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
  const panned = await page.evaluate(async ({base, tile}) => {
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
    function pair(taa, panPx) {
      const view = mod.createView({tilePixels: tile, center: mod.CENTER});
      const renderer = mod.createRenderer(canvas, field, {view, pixelRatio: 1, adaptive: false, display: FRAME, taa, shutter: 1});
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
    const out = {still: pair(3, 0), off: pair(1, 12), on: pair(3, 12)};
    canvas.remove();
    return out;
  }, {base, tile: TILE_PIXELS});
  assert.equal(panned.still.layers, 1, 'a still view at the home framing uses one sub-sample');
  assert.equal(panned.off.layers, 1, '?taa=1 is no shutter at all');
  assert.equal(panned.on.layers, 3, 'a 12 px pan engages the shutter even with the phase held still');
  assert.ok(panned.off.flips > 5, `a 12 px pan without the shutter flips ${panned.off.flips.toFixed(2)}% of pixels between frames`);
  assert.ok(panned.on.flips < 0.5 * panned.off.flips, `the shutter must remove most of that (${panned.off.flips.toFixed(2)}% → ${panned.on.flips.toFixed(2)}%)`);
  notes.push(`pan judder ${panned.off.flips.toFixed(2)}% → ${panned.on.flips.toFixed(2)}% of pixels`);

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
  await page.screenshot({path: `${shots}/trefoil-${label}-elastic.png`});

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
  assert.match(await statsText(), new RegExp(`2560×1600 px · quality 1\\.00 · ${HOME} px per repeat · (27|48) taps`));
  assert.equal(await page.locator('#stats').isVisible(), false);
  const paused = await pixels();
  assert.equal(averageDifference(paused, await pixels()), 0, 'paused frame is stable');
  // The one-finger pan fling, unchanged by the company it now keeps.
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
  assert.equal(scaleOf(afterFling), HOME, 'nor zooms it');
  await page.keyboard.press('0');
  await page.waitForTimeout(300);
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

  // ---- the generator marks and the notation panel --------------------------
  // The overlay is an SVG layer over the canvas, placed through the very
  // transform the shader uses. What is checked here is that it is really glued
  // to the pattern — under a pan, a zoom and a turn — that it never takes a
  // pointer away from the canvas, that the three ways of switching it on and off
  // all work and are remembered, and that it costs the animation nothing.
  await page.setViewportSize({width: 1440, height: 1000});
  await page.goto(base); await ready();
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(base); await ready();
  await page.waitForTimeout(200);
  const layerHidden = () => page.locator('#generators').evaluate(n => n.hasAttribute('hidden'));
  const unitCount = () => page.locator('#generators .cc-unit').count();
  /** Where each mark of a kind sits on screen, from the SVG transforms alone. */
  const placed = async selector => (await page.$$eval(`#generators ${selector}`, nodes => nodes.map(node => {
    const m = node.getAttribute('transform').match(/translate\(([-\d.]+) ([-\d.]+)\)/);
    return [Number(m[1]), Number(m[2])];
  })));
  const near = (a, list, tolerance = 0.2) => list.some(b => Math.hypot(a[0] - b[0], a[1] - b[1]) < tolerance);
  /** The screen offset of a generator's centre from its unit's origin, at a
   * given scale and turn — the same arithmetic the shader does, done here
   * independently of the module under test. */
  const expectedOffset = (item, scale, degrees) => {
    const [px, py] = toPlane(centreOf(item));
    const t = degrees * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
    return [scale * (c * px - s * py), scale * (s * px + c * py)];
  };

  // A FRESH VISIT IS THE PICTURE ALONE. The annotation is an option under it,
  // never the opening state, on this page as on every other on the site.
  assert.equal(await layerHidden(), true, 'the marks are off by default — a fresh visit is the picture alone');
  assert.equal(await page.locator('#generators-check').isChecked(), false, 'and the checkbox underneath says so');
  assert.equal(await unitCount(), 0, 'nothing is in the document to draw');
  assert.match(await statsText(), /marks off/);
  // Everything that follows studies the marks, so they are switched on the way a
  // viewer does it — a remembered choice — and left on for the rest of the run.
  await page.evaluate(() => { try { localStorage.setItem('trefoil:generators', '1'); } catch {} });
  await page.goto(base); await ready(); await page.waitForTimeout(200);
  assert.equal(await layerHidden(), false, 'the remembered choice opens with them');
  const units = await unitCount();
  assert.ok(units >= 7 && units <= MAX_UNITS, `${units} repeats annotated at the home framing`);
  assert.equal(await page.locator('#generators .cc-marker').count(), 3 * units, 'three gyrations per repeat');
  assert.equal(await page.locator('#generators .cc-translation').count(), units, 'one slide per repeat');
  assert.equal(await page.locator('#generators').evaluate(n => getComputedStyle(n).pointerEvents), 'none',
    'the overlay must never take a pointer from the canvas');
  assert.match(await statsText(), new RegExp(`marks ${units}`), 'the stats overlay counts the repeats');
  // The fundamental triangle, in the CSS pixels the design was drawn against.
  const alphas = await placed('.cc-marker[data-name="alpha"]');
  for (const name of ['beta', 'gamma']) {
    const want = expectedOffset(byName(name), HOME, 0);
    for (const spot of await placed(`.cc-marker[data-name="${name}"]`)) {
      assert.ok(near([spot[0] - want[0], spot[1] - want[1]], alphas),
        `${name} at ${spot} is not ${want} from any α`);
    }
  }
  assert.ok(near([720, 500], alphas, 0.05), 'α sits at the centre of the screen at the home view');
  // THE LABELS ARE MARKUP, NOT UNICODE. In WebKit — every browser on iOS — the
  // characters ₅ ⁽ ⁰ ⁾ have no glyph in the serif stack and each is given a
  // full-width fallback box, so a Unicode label shatters into fragments strewn
  // across the picture; in Chromium it renders, but 6₅⁽¹²⁾ is indistinguishable
  // from sixty-five. Both engines must draw the same narrow box, built of
  // tspans, carrying no such character anywhere on the artwork.
  const labels = await page.$$eval('#generators text', nodes => nodes.map(node => {
    const box = node.getBBox();
    return {text: node.textContent, width: box.width, height: box.height, tspans: node.querySelectorAll('tspan').length};
  }));
  const distinct = new Map(labels.map(item => [item.text, item]));
  assert.equal(distinct.size, 4, `four distinct labels, not ${[...distinct.keys()]}`);
  for (const item of distinct.values()) {
    assert.ok(!/[⁰-₟¹²³]/.test(item.text), `the label "${item.text}" is set in Unicode sub/superscripts`);
    assert.equal(item.tspans, item.text.startsWith('τ') ? 1 : 2, `"${item.text}" is not built of tspans`);
    assert.ok(item.width > 30 && item.width < 86, `the label "${item.text}" measures ${item.width.toFixed(1)} px — a fallback box?`);
    assert.ok(item.height < 40, `the label "${item.text}" is ${item.height.toFixed(1)} px tall`);
  }
  notes.push(`labels ${[...distinct.values()].map(l => `${l.text} ${l.width.toFixed(0)}px`).join(', ')}`);
  // Glued to the pattern: a pan carries every mark with it, to the pixel. The
  // keyboard pan is used because it is exact — 48 px a press — and because a
  // released drag is thrown, and where the glide ends is not the point here.
  for (const key of ['ArrowLeft', 'ArrowLeft', 'ArrowUp', 'ArrowUp']) { await page.keyboard.press(key); await page.waitForTimeout(90); }
  await page.waitForTimeout(400);
  const dragged = await placed('.cc-marker[data-name="alpha"]');
  // The layer keeps a ring of repeats around the window — wide enough to hold
  // every arrowhead that reaches the screen — so the outermost marks are
  // replaced by their neighbours rather than moved. Every mark that is still
  // comfortably inside that ring after the pan must be exactly 96 px along.
  const inside = ([x, y]) => x > -600 && y > -600 && x < 1440 + 600 && y < 1000 + 600;
  let carried = 0, expected = 0;
  for (const [x, y] of alphas) {
    if (!inside([x + 96, y + 96])) continue;
    expected++;
    if (near([x + 96, y + 96], dragged)) carried++;
  }
  assert.ok(expected >= 7 && carried === expected, `only ${carried} of ${expected} α marks followed the pan`);
  assert.equal(await page.locator('#reset').isVisible(), true, 'the pan really moved the view');
  // A zoom about the centre of the screen scales every offset from it.
  await page.keyboard.press('0'); await page.waitForTimeout(400);
  await page.keyboard.press('+'); await page.waitForTimeout(500);
  const zoomScale = scaleOf(await statsText());
  assert.equal(zoomScale, Math.round(HOME * 1.25), 'the keyboard zoom is a quarter');
  const zoomed = await placed('.cc-marker[data-name="alpha"]');
  let scaled = 0;
  for (const [x, y] of alphas) if (near([720 + (x - 720) * 1.25, 500 + (y - 500) * 1.25], zoomed, 1)) scaled++;
  assert.ok(scaled >= 3, `only ${scaled} α marks scaled with the zoom`);
  // A sixth of a turn turns the marks with the pattern about the same point —
  // and turns nothing inside them: the clocks, the colour chips and the labels
  // stay upright, so only the crystallographic glyph carries the new angle.
  await page.goto(base); await ready(); await page.waitForTimeout(200);
  const flat = await placed('.cc-marker[data-name="alpha"]');
  await page.goto(`${base}?angle=60`); await ready(); await page.waitForTimeout(200);
  assert.equal(turnOf(await statsText()), 60);
  const turned60 = await placed('.cc-marker[data-name="alpha"]');
  const c60 = Math.cos(Math.PI / 3), s60 = Math.sin(Math.PI / 3);
  let rotated = 0;
  for (const [x, y] of flat) {
    const dx = x - 720, dy = y - 500;
    if (near([720 + c60 * dx - s60 * dy, 500 + s60 * dx + c60 * dy], turned60, 1)) rotated++;
  }
  assert.ok(rotated >= 3, `only ${rotated} of ${flat.length} α marks turned with the pattern`);
  for (const name of ['beta', 'gamma']) {
    const want = expectedOffset(byName(name), HOME, 60);
    const alphaNow = await placed('.cc-marker[data-name="alpha"]');
    for (const spot of await placed(`.cc-marker[data-name="${name}"]`)) {
      assert.ok(near([spot[0] - want[0], spot[1] - want[1]], alphaNow, 0.3),
        `turned 60°, ${name} at ${spot} is not ${want} from any α`);
    }
  }
  assert.equal(await page.locator('#generators .cc-marker[data-name="alpha"] .cc-turn').first().getAttribute('transform'), 'rotate(60.00)',
    'the order glyph is the piece that carries the turn');
  assert.equal(await page.locator('#generators .cc-marker[data-name="alpha"] .cc-chip').first().evaluate(n => n.closest('[transform*="rotate"]')?.classList.contains('cc-turn') ?? false), false,
    'nothing inside the chip turns with the view');
  // ZOOMED OUT, THE ANNOTATION COVERS THE WHOLE WINDOW OR NOTHING AT ALL. With a
  // fixed cap on the repeats it did neither: on a large window it drew a fully
  // opaque disc of marks with a third of the screen bare around it. The cap is
  // now derived from the window's own diagonal, and the fade is derived from the
  // cap, so every corner has a mark near it for as long as anything is drawn.
  for (const [scale, viewport] of [[276, [1440, 1000]], [200, [1440, 1000]], [276, [1680, 1050]]]) {
    await page.setViewportSize({width: viewport[0], height: viewport[1]});
    await page.goto(`${base}?scale=${scale}`); await ready(); await page.waitForTimeout(220);
    const spread = await page.evaluate(() => {
      const marks = [...document.querySelectorAll('#generators .cc-marker[data-name="alpha"]')]
        .map(node => node.getAttribute('transform').match(/translate\(([-\d.]+) ([-\d.]+)\)/).slice(1).map(Number));
      const corners = [[0, 0], [innerWidth, 0], [0, innerHeight], [innerWidth, innerHeight]];
      return {
        count: marks.length,
        opacity: Number(document.querySelector('#generators').style.opacity),
        worst: Math.max(...corners.map(c => Math.min(...marks.map(p => Math.hypot(p[0] - c[0], p[1] - c[1]))))),
      };
    });
    assert.ok(spread.opacity > 0.4, `${viewport} at ${scale}: the layer is at ${spread.opacity}`);
    assert.ok(spread.worst < scale * 1.2,
      `${viewport} at ${scale} px a repeat: the furthest corner is ${spread.worst.toFixed(0)} px from any mark`);
    assert.ok(spread.count <= MAX_UNITS);
  }
  await page.setViewportSize({width: 1440, height: 1000});
  // Off and on: the checkbox, the G key and the query, each remembered but for
  // the query, which is a share link and must not change what the viewer chose.
  await page.goto(base); await ready(); await page.waitForTimeout(150);
  await page.locator('#generators-check').setChecked(false);
  await page.waitForTimeout(150);
  assert.equal(await layerHidden(), true, 'the checkbox hides the marks');
  assert.equal(await unitCount(), 0, 'and takes them out of the document');
  assert.match(await statsText(), /marks off/);
  await page.goto(base); await ready(); await page.waitForTimeout(150);
  assert.equal(await layerHidden(), true, 'the choice is remembered across a reload');
  assert.equal(await page.locator('#generators-check').isChecked(), false);
  await page.goto(`${base}?generators=1`); await ready(); await page.waitForTimeout(150);
  assert.equal(await layerHidden(), false, '?generators=1 opens a view with them');
  assert.equal(await page.locator('#generators-check').isChecked(), true);
  await page.goto(base); await ready(); await page.waitForTimeout(150);
  assert.equal(await layerHidden(), true, 'and that share link left the viewer’s own choice alone');
  await page.keyboard.press('g'); await page.waitForTimeout(200);
  assert.equal(await layerHidden(), false, 'G brings them back');
  assert.equal(await page.locator('#generators-check').isChecked(), true);
  await page.goto(base); await ready(); await page.waitForTimeout(150);
  assert.equal(await layerHidden(), false, 'and that is remembered too');
  await page.goto(`${base}?generators=0`); await ready(); await page.waitForTimeout(150);
  assert.equal(await layerHidden(), true, '?generators=0 opens a view without them');
  await page.goto(base); await ready(); await page.waitForTimeout(150);
  assert.equal(await layerHidden(), false, 'a shared link leaves the viewer’s own choice alone');
  // The canvas keeps every gesture through the overlay.
  await page.mouse.move(720, 500); await page.mouse.down();
  await page.mouse.move(640, 430, {steps: 5}); await page.mouse.up();
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#reset').isVisible(), true, 'a drag straight across a mark still pans');
  await page.keyboard.press('0'); await page.waitForTimeout(350);
  // The notation panel.
  assert.equal(await page.locator('#legend').isVisible(), false);
  await page.getByRole('button', {name: 'Notation'}).click();
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#legend').isVisible(), true, 'the Notation button opens the panel');
  assert.equal(await page.locator('#notation').getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('#legend-body .symbol').innerHTML(),
    '6<sub>5</sub><sup>(12)</sup> 3<sub>2</sub><sup>(021)</sup> 2<sub>1</sub><sup>(01)</sup> · τ<sup>(021)</sup>',
    'the panel prints the page’s symbol, with real subscripts and superscripts');
  assert.ok((await page.locator('#legend-body').textContent()).includes('65(12) 32(021) 21(01) · τ(021)'));
  assert.equal(await page.locator('#legend-body table tbody tr').count(), 4, 'one row per generator');
  assert.ok(await page.locator('#legend svg').count() >= 5, 'the panel draws the anatomy and the key');
  // It is a side panel over a live picture, not a modal — so it says so, and it
  // admits when it is cut off.
  assert.equal(await page.locator('#legend').getAttribute('role'), 'region', 'a dialog role over a live canvas would be a lie');
  assert.equal(await page.locator('#legend').getAttribute('data-more'), '1', 'the panel says there is more below the fold');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  assert.equal(await page.locator('#legend').isVisible(), false, 'Escape closes it');
  await page.keyboard.press('n'); await page.waitForTimeout(200);
  assert.equal(await page.locator('#legend').isVisible(), true, 'N opens it');
  // A tap on the picture dismisses it; a drag that starts there does not, since
  // that is a pan and the panel may well be wanted while the picture moves.
  await page.mouse.move(300, 300); await page.mouse.down();
  await page.mouse.move(220, 240, {steps: 5}); await page.mouse.up();
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#legend').isVisible(), true, 'a drag across the picture leaves the panel open');
  await page.keyboard.press('0'); await page.waitForTimeout(350);
  await page.mouse.click(300, 300); await page.waitForTimeout(200);
  assert.equal(await page.locator('#legend').isVisible(), false, 'a tap outside closes it');
  await page.keyboard.press('n'); await page.waitForTimeout(200);
  await page.keyboard.press('n'); await page.waitForTimeout(200);
  assert.equal(await page.locator('#legend').isVisible(), false, 'and N closes it again');
  // A phone on its side is the panel's worst case: the bottom-docked layout
  // would leave it 190 px high. It gets the full height and two columns there.
  await page.setViewportSize({width: 844, height: 390});
  await page.goto(base); await ready(); await page.waitForTimeout(200);
  await page.keyboard.press('n'); await page.waitForTimeout(250);
  const landscape = await page.locator('#legend').boundingBox();
  const landscapeBar = await page.locator('#controls').boundingBox();
  assert.ok(landscape.height > 280, `the landscape panel is only ${landscape.height} px high`);
  assert.ok(landscape.y + landscape.height <= landscapeBar.y + 2, 'and still sits above the control bar');
  assert.equal(await page.locator('#legend-body').evaluate(n => getComputedStyle(n).display), 'grid', 'two columns in landscape');
  assert.ok(await page.locator('#legend-body table').isVisible(), 'the table is in the first screenful');
  const firstScreen = await page.locator('#legend-body table').boundingBox();
  assert.ok(firstScreen.y + 40 < landscape.y + landscape.height, 'the generator table is visible without scrolling');
  await page.keyboard.press('Escape');
  // On a phone it must leave the picture visible and never overflow the screen.
  await page.setViewportSize({width: 390, height: 844});
  await page.goto(base); await ready(); await page.waitForTimeout(250);
  assert.ok(await unitCount() >= 4, 'the marks survive a phone');
  // A PHONE IS THE DENSEST VIEW THE PAGE HAS — the marks are smaller there but
  // sit closer together — so it thins where a desktop does not: γ goes, and only
  // α and the slide keep their labels.
  const phoneMarks = await page.$$eval('#generators .cc-unit:first-child .cc-marker', nodes => nodes.map(n => n.dataset.name));
  assert.deepEqual(phoneMarks, ['alpha', 'beta'], 'a phone drops γ');
  const phoneLabels = await page.$$eval('#generators .cc-unit:first-child text', nodes => nodes.map(n => n.textContent.slice(0, 1)));
  assert.deepEqual(phoneLabels.sort(), ['α', 'τ'], 'and keeps only α’s and the slide’s labels');
  assert.equal(await page.locator('#generators .cc-marker[data-name="gamma"]').count(), 0);
  await page.keyboard.press('n'); await page.waitForTimeout(250);
  const panel = await page.locator('#legend').boundingBox();
  assert.ok(panel.x >= 0 && panel.x + panel.width <= 390, `the panel fits the screen: ${JSON.stringify(panel)}`);
  assert.ok(panel.height <= 844 * 0.62, 'the panel leaves the picture in view');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), 'the panel adds no horizontal scroll');
  const bar = await page.locator('#controls').boundingBox();
  assert.ok(panel.y + panel.height <= bar.y + 2, 'the panel sits above the control bar');
  assert.ok((await page.locator('#legend-body').evaluate(n => n.scrollHeight)) > 0);
  await page.screenshot({path: `${shots}/trefoil-${label}-notation.png`});
  await page.keyboard.press('Escape');
  await page.setViewportSize({width: 1440, height: 1000});
  // The marks cost the animation nothing: they are redrawn only when the view
  // moves, and playing the film never moves it.
  const framesIn = async ms => page.evaluate(ms => new Promise(resolve => {
    let n = 0; const start = performance.now();
    const tick = () => { n++; if (performance.now() - start < ms) requestAnimationFrame(tick); else resolve(n / ((performance.now() - start) / 1000)); };
    requestAnimationFrame(tick);
  }), ms);
  await page.goto(`${base}?generators=0`); await ready(); await page.waitForTimeout(400);
  const bare = await framesIn(1500);
  await page.goto(base); await ready(); await page.waitForTimeout(400);
  const annotated = await framesIn(1500);
  notes.push(`${Math.round(annotated)} fps with the marks, ${Math.round(bare)} without, at ${await page.locator('canvas').evaluate(c => `${c.width}×${c.height}`)}`);
  assert.ok(annotated > bare * 0.9, `the marks cost ${Math.round(bare - annotated)} fps of ${Math.round(bare)}`);
  // Zoomed out the layer carries an order of magnitude more repeats than it does
  // at home — the price of covering the window instead of capping at a disc —
  // and the frame budget has to hold there too. Units are pooled, so a zoom that
  // adds repeats adds only the new ones.
  await page.goto(`${base}?scale=150`); await ready(); await page.waitForTimeout(400);
  const crowdedCount = await unitCount();
  const crowded = await framesIn(1200);
  notes.push(`${Math.round(crowded)} fps with ${crowdedCount} repeats at 150 px a repeat`);
  assert.ok(crowdedCount > 60, `only ${crowdedCount} repeats at the deep zoom-out`);
  assert.ok(crowded > bare * 0.85, `${crowdedCount} repeats cost ${Math.round(bare - crowded)} fps of ${Math.round(bare)}`);

  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto(base); await ready();
  assert.equal(await page.locator('#pause').getAttribute('aria-label'), 'Play animation');
  await page.goto(`${base}?play=1`); await ready();
  assert.equal(await page.locator('#pause').getAttribute('aria-label'), 'Pause animation');
  assert.deepEqual(errors, [], 'no browser errors or missing assets');
  console.log(`${label}: retina rendering, three colours at a third each, the entangled swap exact on rendered pixels with every part of it failing, the free 3-cycle exact, the threefold and sixfold laws, the triple junction at the half-turn centre, shader against the CPU rule, fixed scale, seamless tiling, mobile layout, drag pan, wheel zoom, pinch zoom, two-finger turn snapped to 60°, trackpad pinch-and-turn in four event patterns, shutter, momentum on pinch/turn/wheel with the elastic limit, reset, stats, pause/play, idle controls, GPU recovery, the generator marks through a pan, a zoom and a sixth of a turn, the notation panel and reduced motion passed`);
  for (const note of notes) console.log(`  · ${note}`);
} finally {await browser.close();}
