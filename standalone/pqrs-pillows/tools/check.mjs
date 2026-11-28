#!/usr/bin/env node
// check.mjs — the gate of SPEC 4.2: the BUILT page in headless Chrome, at desktop 1280x900 and phone 390x844.
//
//   node tools/check.mjs [file | url] [--only desktop|phone] [--shots <dir>] [--budget <seconds>]
//       default target: site/index.html of this page; --shots keeps the pictures the checks took (to look at)
//   node tools/check.mjs --compare a.png b.png      no browser: the three pixel measures on two saved pictures
//
// Each check prints ONE line: "ok ...", "FAIL ..." or "skip ..." (its part of the page is not there: the reason
// follows). Exit code 1 if any line is FAIL (or the page cannot be opened), 0 otherwise.
//
// What is checked, per viewport (SPEC 4.2, and the layout rules of SPEC 1):
//   panes        both panes draw: a screenshot of each pane element is not blank
//   preset ...   each preset chip opens: pressed, three cards (one of them the engine's cut), the address names it, both panes draw
//   typed        four orders typed in the field open that orbifold
//   twist drag   dragging a card's Twist changes its number, BOTH other cards' numbers and the Surface's pixels
//   length drag  the same for its Length
//   grab         dragging a slider of a card that is NOT the cut makes that card the cut (SPEC 1.3), and moves its number
//   table        the pillows in numbers: six rows (two a partition), and the line that says the solid is exact
//   colours      each card wears its partition's colour, and still does after the other cards were touched
//   switch ...   TOUCHING another card's slider without moving it changes nothing: the Surface pane not by one pixel,
//                the Pattern pane's print not at all and its lines by rounding only, the cards' look not at all
//                (his ask of Fri 27 Nov 2026, 22:55; 3333 after a Twist drag; 2345, 2223 with its pair of 2s, and 2222
//                with a Twist; first the gauge)
//   journey      the journey goes through its three stops (the Surface's pixels change at each), buttons as in SPEC 1.4
//   address      opening the address again restores the orbifold, the cut, the numbers, the journey
//   tutorial     the Tutorial tab opens: its sections, formulas typeset, no raw TeX left
//   overflow     nothing is wider than the screen (Play and Tutorial)
//   layout       the two panes side by side; on the phone: tap targets at least 44 px, field text 16 px
//   errors       no console error and no page error during all of the above
// and once: the page's text holds none of the letter sequences a publish refuses.
//
// HOW PIXELS ARE READ. Never from the canvases: from PNG screenshots of the pane elements (Playwright), decoded
// here (zlib + the five PNG filters). Three measures:
//   drawn      the share of pixels that are not the picture's most frequent colour, and how many colours there are
//   changed    the share of pixels whose colour moved by more than 24 (of 255) in some channel
//   print      for "the pattern did not move". The print has two flat tones (paper and comma: the two most frequent
//              colours that are not white). A pixel is PRINT if its colour lies on the segment between the two tones
//              (within 18): its place on the segment is its tone, 0 comma .. 1 paper, so an antialiased comma edge
//              is print too. Everything else (marks, seals, the loop, labels, the page's white) is NOT print, and
//              such pixels are left out in both pictures together with a margin of 2 px round them: that is how the
//              marks and lines, which change colour and place by design when another card is activated, are
//              excluded. Of the pixels that are print in both pictures, within 0.85 of the pane's half width from
//              its middle (the rim of the disc, where tiles are smaller than pixels, is left out), a pixel counts as
//              moved if its tone changed by more than 0.25. The gate is 0.5 % of those pixels (SPEC 4.2).
//              THE GAUGE, printed with every run: the start picture against itself shifted by one device pixel
//              (half a CSS pixel at the scale used here, 2) must read at least twice the gate, or the "still" lines
//              would mean nothing. Measured on this page (27 Nov 2026): 1.7 to 6.4 % for such a shift, 1.75 % for the
//              pattern slid by hand by half a CSS pixel, 0.00 % for a real activation, 32 to 40 % on a page built
//              without the line that holds the view on a flip. (With a tone step of 0.6 the one-pixel shift read
//              0.44 % on the desktop, under the gate: that is why the step is 0.25.)

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PW = process.env.PLAYWRIGHT_MJS || `${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// ---- every selector the checks use, in one table (the shell's page.template.html and cards.js fix them) --------
const SEL = {
  tabPlay: '[data-tab="play"]', tabTutorial: '[data-tab="tutorial"]', play: '#play', tutorial: '#tutorial',
  chips: 'button.chip[data-sig]', chipAttr: 'data-sig', field: '#sig-in',
  patternBox: '#pane2', surfaceBox: '#pane',                 // the two pane cards (layout)
  patternPane: '#pat-wrap', surfacePane: '#surf-wrap',       // what is photographed
  surfaceWait: '#surf-wait',                                 // "surface loading": hidden once the surface is up
  cards: '#cards .pq-card', cardKeyAttr: 'data-key', cardActiveAttr: 'data-active', cardHead: '.pq-card-head',
  cardRange: 'input[type="range"]', cardValue: '.pq-sval',
  journeyRange: '#j-range', journeyLeft: '#j-left', journeyRight: '#j-right',
  tableRows: '#pillows-body tr', tableNote: '#pillows-note',
  cardSwatch: '.pq-swatch', cardsBox: '#cards', journeyBox: '#journey', journeyChips: '.pq-jchip',
  tapTargets: 'button.chip[data-sig], .tab2, #j-left, #j-right, .pq-jchip',
};
const PRESETS = ['2222', '3333', '2223', '2345', '4444'];
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900, phone: false },
  { name: 'phone', width: 390, height: 844, phone: true },
];
const SCALE = 2;               // device pixels per CSS pixel in every screenshot
const STILL_GATE = 0.005;      // SPEC 4.2: under 0.5 % of the samples
const TUTORIAL_SECTIONS = 6;   // the Tutorial tab's h2 count
const TONE_STEP = 0.25;        // a print pixel has moved when its tone (0 comma .. 1 paper) changed by more than this
// the three letter sequences a publish refuses (SPEC 1.8), spelt in halves so that this file does not hold them
const REFUSED = ['rec' + 'order', 'rec' + 'ording', 'trans' + 'cri'];

// ---- arguments ---------------------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const VALUED = ['--only', '--shots', '--budget', '--compare'];
const positional = argv.includes('--compare') ? [] : argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && VALUED.includes(argv[i - 1])));
const target = positional[0] || path.resolve(HERE, '../site/index.html');
const only = flag('--only', null), shotsDir = flag('--shots', null), budgetMs = 1000 * Number(flag('--budget', 240));
const isUrl = /^(https?|file):/i.test(target);
const url = isUrl ? target : pathToFileURL(path.resolve(target)).href;

const tally = { ok: 0, FAIL: 0, skip: 0 };
function say(verdict, where, name, detail) {
  tally[verdict]++;
  console.log(`${verdict} ${where} ${name}${detail ? ': ' + detail : ''}`);
}
const pct = (x, digits = 2) => `${(100 * x).toFixed(digits)} %`;
const num = (text) => parseFloat(String(text).replace(/−/g, '-').replace(/[^0-9.+\-eE]/g, ' ').trim());

if (!argv.includes('--compare') && !isUrl && !fs.existsSync(path.resolve(target))) {
  say('FAIL', 'page', 'open', `no built page at ${path.resolve(target)} (the shell owner builds it: npm run build)`);
  process.exit(1);
}

// ---- pictures ----------------------------------------------------------------------------------------------------
/** A PNG as { width, height, data: Uint8Array RGB }. 8 bits a channel, RGB or RGBA, not interlaced: what Chrome writes. */
function decodePng(buf) {
  let p = 8, width = 0, height = 0, depth = 0, type = 0, interlace = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), name = buf.toString('latin1', p + 4, p + 8), body = buf.subarray(p + 8, p + 8 + len);
    if (name === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); depth = body[8]; type = body[9]; interlace = body[12]; }
    else if (name === 'IDAT') idat.push(body);
    else if (name === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || (type !== 2 && type !== 6) || interlace) throw new Error(`a PNG this reader does not take (depth ${depth}, colour type ${type}, interlace ${interlace})`);
  const bpp = type === 6 ? 4 : 3, stride = width * bpp, raw = zlib.inflateSync(Buffer.concat(idat));
  const data = new Uint8Array(width * height * 3);
  let prev = new Uint8Array(stride), cur = new Uint8Array(stride), q = 0;
  for (let y = 0; y < height; y++) {
    const f = raw[q++];
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = raw[q++];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 255;
    }
    for (let x = 0, o = 3 * y * width; x < width; x++) { data[o++] = cur[x * bpp]; data[o++] = cur[x * bpp + 1]; data[o++] = cur[x * bpp + 2]; }
    const t = prev; prev = cur; cur = t;
  }
  return { width, height, data };
}
/** The most frequent colours: [{ share, rgb }], by bins of 16 levels a channel, each with its mean colour. */
function tones(img, count = 8) {
  const bins = new Map(), d = img.data, n = img.width * img.height;
  for (let i = 0; i < n; i++) {
    const r = d[3 * i], g = d[3 * i + 1], b = d[3 * i + 2], k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    let e = bins.get(k);
    if (!e) { e = [0, 0, 0, 0]; bins.set(k, e); }
    e[0]++; e[1] += r; e[2] += g; e[3] += b;
  }
  const top = [...bins.values()].sort((a, b) => b[0] - a[0]).slice(0, count).map((e) => ({ share: e[0] / n, rgb: [e[1] / e[0], e[2] / e[0], e[3] / e[0]] }));
  top.bins = bins.size;
  return top;
}
/** drawn: the share of pixels away from the most frequent colour, and the number of colour bins. */
function drawn(img) {
  const top = tones(img, 1), bg = top[0].rgb, d = img.data, n = img.width * img.height;
  let off = 0;
  for (let i = 0; i < n; i++) if (Math.abs(d[3 * i] - bg[0]) > 12 || Math.abs(d[3 * i + 1] - bg[1]) > 12 || Math.abs(d[3 * i + 2] - bg[2]) > 12) off++;
  return { share: off / n, colours: top.bins };
}
const isDrawn = (m) => m.share >= 0.02 && m.colours >= 12;
/** changed: the share of pixels whose colour moved by more than `tol` in some channel (1 if the sizes differ). */
function changed(a, b, tol = 24) {
  if (a.width !== b.width || a.height !== b.height) return 1;
  const n = a.width * a.height, A = a.data, B = b.data;
  let c = 0;
  for (let i = 0; i < 3 * n; i += 3) if (Math.abs(A[i] - B[i]) > tol || Math.abs(A[i + 1] - B[i + 1]) > tol || Math.abs(A[i + 2] - B[i + 2]) > tol) c++;
  return c / n;
}
/** The print's two tones in a picture of the Pattern pane: { paper, comma } (rgb), or null. */
function printTones(img) {
  const flat = tones(img, 8).filter((t) => t.share >= 0.03 && Math.min(...t.rgb) < 235 && Math.max(...t.rgb) > 70);
  if (flat.length < 2) return null;
  const [a, b] = flat, lum = (t) => t.rgb[0] + t.rgb[1] + t.rgb[2];
  const paper = lum(a) >= lum(b) ? a : b, comma = paper === a ? b : a;
  const gap = Math.max(...paper.rgb.map((v, i) => Math.abs(v - comma.rgb[i])));
  return gap < 30 ? null : { paper: paper.rgb, comma: comma.rgb, share: a.share + b.share };
}
/** Per pixel: its tone on the segment comma (0) .. paper (1), or -1 where the pixel is not print. */
function toneMap(img, T) {
  const n = img.width * img.height, d = img.data, out = new Float32Array(n);
  const dir = T.paper.map((v, i) => v - T.comma[i]), len2 = dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2];
  for (let i = 0; i < n; i++) {
    const r = d[3 * i] - T.comma[0], g = d[3 * i + 1] - T.comma[1], b = d[3 * i + 2] - T.comma[2];
    const t = Math.max(-0.15, Math.min(1.15, (r * dir[0] + g * dir[1] + b * dir[2]) / len2));
    const off = Math.max(Math.abs(r - t * dir[0]), Math.abs(g - t * dir[1]), Math.abs(b - t * dir[2]));
    out[i] = off <= 18 ? t : -1;
  }
  return out;
}
/** print: of the pixels that are print in both pictures (see the header), the share whose tone moved by more than 0.6. */
function printMoved(a, b, T, reach = 0.85, margin = 2, step = TONE_STEP) {
  if (a.width !== b.width || a.height !== b.height) return { ratio: 1, samples: 0, moved: 0, sized: false };
  const W = a.width, Hh = a.height, n = W * Hh, ta = toneMap(a, T), tb = toneMap(b, T);
  const not = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (ta[i] < -0.5 || tb[i] < -0.5) not[i] = 1;
  // widen what is not print by `margin` pixels: along the rows, then along the columns
  const rows = new Uint8Array(n), mask = new Uint8Array(n);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    let v = 0;
    for (let k = Math.max(0, x - margin); k <= Math.min(W - 1, x + margin) && !v; k++) v = not[y * W + k];
    rows[y * W + x] = v;
  }
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    let v = 0;
    for (let k = Math.max(0, y - margin); k <= Math.min(Hh - 1, y + margin) && !v; k++) v = rows[k * W + x];
    mask[y * W + x] = v;
  }
  const cx = W / 2, cy = Hh / 2, R = reach * Math.min(W, Hh) / 2, R2 = R * R;
  let samples = 0, moved = 0;
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (mask[i] || (x - cx) * (x - cx) + (y - cy) * (y - cy) > R2) continue;
    samples++;
    if (Math.abs(ta[i] - tb[i]) > step) moved++;
  }
  return { ratio: samples ? moved / samples : 1, samples, moved, sized: true, area: Math.PI * R2 };
}
/** The same picture moved by (dx, dy) device pixels (the edge repeats): the gauge of the print measure. */
function shifted(img, dx, dy) {
  const W = img.width, Hh = img.height, d = img.data, out = new Uint8Array(d.length);
  for (let y = 0; y < Hh; y++) {
    const sy = Math.min(Hh - 1, Math.max(0, y - dy));
    for (let x = 0; x < W; x++) {
      const sx = Math.min(W - 1, Math.max(0, x - dx)), o = 3 * (y * W + x), q = 3 * (sy * W + sx);
      out[o] = d[q]; out[o + 1] = d[q + 1]; out[o + 2] = d[q + 2];
    }
  }
  return { width: W, height: Hh, data: out };
}

// ---- two saved pictures, no browser:  node tools/check.mjs --compare a.png b.png -----------------------------------
if (argv.includes('--compare')) {
  const [fa, fb] = argv.slice(argv.indexOf('--compare') + 1);
  const a = decodePng(fs.readFileSync(fa)), b = decodePng(fs.readFileSync(fb)), da = drawn(a), db = drawn(b), T = printTones(a);
  console.log(`a: ${a.width} x ${a.height}, ${pct(da.share, 1)} drawn in ${da.colours} colours; b: ${b.width} x ${b.height}, ${pct(db.share, 1)} drawn in ${db.colours} colours`);
  console.log(`all pixels: ${pct(changed(a, b))} changed colour by more than 24`);
  if (!T) console.log('print: the two tones of a print were not found in a');
  else {
    const rgb = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    console.log(`print tones in a: paper ${rgb(T.paper)}, comma ${rgb(T.comma)} (${pct(T.share, 0)} of the picture)`);
    for (const step of [0.2, TONE_STEP, 0.6]) {
      const m = printMoved(a, b, T, 0.85, 2, step), g = printMoved(a, shifted(a, 1, 0), T, 0.85, 2, step), g2 = printMoved(a, shifted(a, 0, 1), T, 0.85, 2, step);
      console.log(`print, tone step ${step}: ${pct(m.ratio, 3)} of ${m.samples} print pixels moved (gate ${pct(STILL_GATE, 1)}); gauge, a against itself one pixel right: ${pct(g.ratio, 2)}, one pixel down: ${pct(g2.ratio, 2)}`);
    }
  }
  process.exit(0);
}

// ---- the browser -------------------------------------------------------------------------------------------------
const { chromium } = await import(pathToFileURL(PW).href);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--ignore-gpu-blocklist', '--enable-webgl'] });
const started = Date.now();
const watchdog = setTimeout(async () => {
  say('FAIL', 'page', 'time', `the check did not finish in ${budgetMs / 1000} s`);
  try { await browser.close(); } catch (e) { /* closing anyway */ }
  process.exit(1);
}, budgetMs);

async function runViewport(vp) {
  const where = vp.name;
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: SCALE, isMobile: vp.phone, hasTouch: vp.phone });
  const errors = [];
  let shotNo = 0;
  const watch = (pg) => {
    pg.on('pageerror', (e) => errors.push('page error: ' + String(e && e.message ? e.message : e)));
    pg.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push('console: ' + m.text()); });
  };
  /** Open an address and find the document that holds the page (the page itself, or a frame of a viewer). */
  async function open(address) {
    const pg = await ctx.newPage();
    watch(pg);
    await pg.goto(address, { waitUntil: 'load', timeout: 45000 });
    let F = pg.mainFrame();
    for (let tries = 0; tries < 20; tries++) {
      const hit = [];
      for (const f of pg.frames()) if (await f.locator(`${SEL.tabPlay}, ${SEL.cards}`).count().catch(() => 0)) hit.push(f);
      if (hit.length) { F = hit[0]; break; }
      await pg.waitForTimeout(250);
    }
    // the cards (page.js ran) and the surface (its "loading" line gone), or the time is up
    const t0 = Date.now();
    while (Date.now() - t0 < 15000) {
      const ready = await F.evaluate((S) => {
        const cards = document.querySelectorAll(S.cards).length, wait = document.querySelector(S.surfaceWait);
        return cards >= 3 && (!wait || wait.hidden || getComputedStyle(wait).display === 'none' || getComputedStyle(wait).visibility === 'hidden');
      }, SEL).catch(() => false);
      if (ready) break;
      await pg.waitForTimeout(200);
    }
    await pg.waitForTimeout(700);
    return { pg, F };
  }
  let { pg: page, F } = await open(url);
  const has = async (sel) => (await F.locator(sel).count()) > 0;
  const settle = (ms = 450) => page.waitForTimeout(ms);
  async function shot(sel, label) {
    const buf = await F.locator(sel).first().screenshot({ timeout: 15000 });
    if (shotsDir) { fs.mkdirSync(shotsDir, { recursive: true }); fs.writeFileSync(path.join(shotsDir, `${where}-${String(++shotNo).padStart(2, '0')}-${label}.png`), buf); }
    return decodePng(buf);
  }
  const readCards = () => F.evaluate((S) => [...document.querySelectorAll(S.cards)].map((c) => ({
    key: c.getAttribute(S.cardKeyAttr), active: c.getAttribute(S.cardActiveAttr) === 'true',
    values: [...c.querySelectorAll(S.cardValue)].map((o) => o.textContent.trim()),
    sliders: [...c.querySelectorAll(S.cardRange)].map((r) => ({ label: r.getAttribute('aria-label') || '', value: Number(r.value), min: Number(r.min), max: Number(r.max) })),
  })), SEL);
  const numbersOf = (card) => card.values.map(num);
  const hashNow = async () => {
    const own = await F.evaluate(() => window.location.hash);
    return own && own.length > 1 ? own : await page.evaluate(() => window.location.hash);
  };
  const activeKey = (cards) => (cards.find((c) => c.active) || {}).key || null;
  /** Which of a card's sliders is the Length (the first) or the Twist (the last), by its label when it has one. */
  const sliderOf = (card, word) => { let k = word === 'twist' ? card.sliders.length - 1 : 0; card.sliders.forEach((sl, i) => { if (new RegExp(`^\\s*${word}`, 'i').test(sl.label)) k = i; }); return k; };
  const same = (a, b) => JSON.stringify(numbersOf(a)) === JSON.stringify(numbersOf(b));
  const lineOf = (cards) => cards.map((c) => c.values.join(' / ')).join(' | ');
  /** A real drag of a range's thumb with the mouse: by `frac` of the track (towards the roomier side if 0). */
  async function dragRange(loc, frac) {
    await loc.scrollIntoViewIfNeeded();
    const box = await loc.boundingBox(), r = await loc.evaluate((e) => ({ value: Number(e.value), min: Number(e.min), max: Number(e.max) }));
    const at = (r.value - r.min) / ((r.max - r.min) || 1), thumb = Math.min(28, box.height), run = box.width - thumb;
    const by = frac || (at < 0.5 ? 0.22 : -0.22), x0 = box.x + thumb / 2 + at * run, x1 = x0 + by * run, y = box.y + box.height / 2;
    await page.mouse.move(x0, y);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) { await page.mouse.move(x0 + ((x1 - x0) * i) / 12, y); await page.waitForTimeout(25); }
    await page.mouse.up();
  }
  async function pressChip(sig) {
    const chip = F.locator(`${SEL.chips}[${SEL.chipAttr}="${sig}"]`).first();
    await chip.scrollIntoViewIfNeeded();
    await chip.click();
    await settle(900);
  }

  // ---- panes
  const gotPanes = (await has(SEL.patternPane)) && (await has(SEL.surfacePane));
  const gotCards = (await F.locator(SEL.cards).count()) >= 3;
  async function panesDraw(label) {
    const a = drawn(await shot(SEL.patternPane, `pattern-${label}`)), b = drawn(await shot(SEL.surfacePane, `surface-${label}`));
    return { ok: isDrawn(a) && isDrawn(b), text: `pattern ${pct(a.share, 0)} drawn in ${a.colours} colours, surface ${pct(b.share, 0)} in ${b.colours}`, a, b };
  }
  if (!gotPanes) say('skip', where, 'panes', `no ${SEL.patternPane} or no ${SEL.surfacePane} in the page`);
  else {
    const p = await panesDraw('first');
    say(p.ok ? 'ok' : 'FAIL', where, 'panes', p.text + (p.ok ? '' : ` (${isDrawn(p.a) ? 'the Surface' : 'the Pattern'} pane is blank)`));
  }

  // ---- presets
  const chipSigs = await F.locator(SEL.chips).evaluateAll((els, attr) => els.map((e) => e.getAttribute(attr)), SEL.chipAttr);
  if (!chipSigs.length) say('skip', where, 'presets', `no preset chip (${SEL.chips})`);
  else {
    const missing = PRESETS.filter((s) => !chipSigs.includes(s));
    if (missing.length) say('FAIL', where, 'presets', `no chip for ${missing.join(', ')} (SPEC 1: ${PRESETS.join(' ')})`);
    for (const sig of chipSigs) {
      const before = errors.length;
      await pressChip(sig);
      const pressed = await F.locator(`${SEL.chips}[${SEL.chipAttr}="${sig}"]`).first().getAttribute('aria-pressed');
      const cards = gotCards ? await readCards() : [], hash = await hashNow();
      const p = gotPanes ? await panesDraw(sig) : { ok: true, text: 'panes not there' };
      const named = new RegExp(`(^|[#&])k=${sig}(&|$)`).test(hash) || (sig === '3333' && (hash === '' || hash === '#'));
      const problems = [];
      if (pressed !== 'true') problems.push('the chip is not pressed');
      if (gotCards && (cards.length !== 3 || cards.filter((c) => c.active).length !== 1)) problems.push(`${cards.length} cards, ${cards.filter((c) => c.active).length} active`);
      if (gotCards && cards.some((c) => numbersOf(c).some((v) => !Number.isFinite(v)))) problems.push('a card shows no number');
      if (!named) problems.push(`the address does not name it (${hash || 'empty'})`);
      if (!p.ok) problems.push('a pane is blank');
      if (errors.length > before) problems.push(errors[before]);
      say(problems.length ? 'FAIL' : 'ok', where, `preset ${sig}`, problems.length ? problems.join('; ') + ` [${p.text}]` : `active ${activeKey(cards)}, ${cards.map((c) => c.values.join(' / ')).join(' | ')}, ${hash}; ${p.text}`);
    }
  }

  // ---- typed orders
  if (!(await has(SEL.field))) say('skip', where, 'typed', `no field ${SEL.field}`);
  else {
    const field = F.locator(SEL.field).first();
    await field.scrollIntoViewIfNeeded();
    await field.fill('2346');
    await field.press('Enter');
    await settle(900);
    const hash = await hashNow(), cards = gotCards ? await readCards() : [];
    const good = /(^|[#&])k=2346(&|$)/.test(hash) && (!gotCards || cards.filter((c) => c.active).length === 1);
    say(good ? 'ok' : 'FAIL', where, 'typed', good ? `2346 opens: ${hash}` : `typing 2346 did not open it: address ${hash || 'empty'}`);
    await field.fill('');
  }

  // ---- a Twist drag: the other two cards and the surface follow
  if (!gotCards) say('skip', where, 'twist drag', `no cards (${SEL.cards})`);
  else {
    if (chipSigs.includes('3333')) await pressChip('3333');
    const c0 = await readCards(), k = c0.findIndex((c) => c.active);
    const surf0 = gotPanes ? await shot(SEL.surfacePane, 'surface-before-twist') : null;
    const card = F.locator(SEL.cards).nth(Math.max(0, k)), ranges = card.locator(SEL.cardRange), count = await ranges.count();
    let tw = count - 1;
    for (let i = 0; i < count; i++) if (/^\s*twist/i.test(c0[Math.max(0, k)].sliders[i].label)) tw = i;
    let how = 'a mouse drag';
    await dragRange(ranges.nth(tw), 0);
    await settle(700);
    let c1 = await readCards();
    if (JSON.stringify(numbersOf(c1[k])) === JSON.stringify(numbersOf(c0[k]))) {          // the drag did nothing: the keys
      how = 'the arrow keys (a mouse drag moved nothing)';
      await ranges.nth(tw).focus();
      for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight');
      await settle(700);
      c1 = await readCards();
    }
    const moved = c1.map((c, i) => JSON.stringify(numbersOf(c)) !== JSON.stringify(numbersOf(c0[i])));
    const others = moved.filter((m, i) => i !== k && m).length;
    const surf = surf0 ? changed(surf0, await shot(SEL.surfacePane, 'surface-after-twist')) : null;
    const problems = [];
    if (k < 0) problems.push('no card is active');
    if (!moved[k]) problems.push('the active card\'s Twist did not move');
    if (others < 2) problems.push(`only ${others} of the other two cards changed`);
    if (surf !== null && surf < 0.005) problems.push(`the Surface pane's pixels did not change (${pct(surf)})`);
    const line = `${c0.map((c) => c.values.join(' / ')).join(' | ')}  ->  ${c1.map((c) => c.values.join(' / ')).join(' | ')}`;
    if (surf === null && !problems.length) say('skip', where, 'twist drag', `cards follow (${line}) but there is no ${SEL.surfacePane} to look at`);
    else say(problems.length ? 'FAIL' : 'ok', where, 'twist drag', (problems.length ? problems.join('; ') + ': ' : `by ${how}; Surface pixels changed ${pct(surf)}; `) + line);
  }

  // ---- a Length drag; then a grab of a card that is not active; then the table
  if (!gotCards) say('skip', where, 'length drag', `no cards (${SEL.cards})`);
  else {
    const c0 = await readCards(), k = Math.max(0, c0.findIndex((c) => c.active));
    const surf0 = gotPanes ? await shot(SEL.surfacePane, 'surface-before-length') : null;
    await dragRange(F.locator(SEL.cards).nth(k).locator(SEL.cardRange).nth(sliderOf(c0[k], 'length')), 0);
    await settle(700);
    const c1 = await readCards(), others = c1.filter((c, i) => i !== k && !same(c, c0[i])).length;
    const surf = surf0 ? changed(surf0, await shot(SEL.surfacePane, 'surface-after-length')) : null;
    const problems = [];
    if (same(c1[k], c0[k])) problems.push('the active card\'s Length did not move');
    if (others < 2) problems.push(`only ${others} of the other two cards changed`);
    if (surf !== null && surf < 0.005) problems.push(`the Surface pane's pixels did not change (${pct(surf)})`);
    say(problems.length ? 'FAIL' : 'ok', where, 'length drag', (problems.length ? problems.join('; ') + ': ' : `Surface pixels changed ${surf === null ? '(no pane)' : pct(surf)}; `) + `${lineOf(c0)}  ->  ${lineOf(c1)}`);

    const c2 = await readCards(), a = Math.max(0, c2.findIndex((c) => c.active)), g = (a + 1) % 3;
    await dragRange(F.locator(SEL.cards).nth(g).locator(SEL.cardRange).nth(sliderOf(c2[g], 'twist')), 0);
    await settle(800);
    const c3 = await readCards(), grabbed = c3[g].active && c3.filter((c) => c.active).length === 1, went = !same(c3[g], c2[g]);
    say(grabbed && went ? 'ok' : 'FAIL', where, 'grab', grabbed && went ? `the Twist of ${c2[g].key}, not active, was dragged: it is the active card now, ${c2[g].values.join(' / ')} -> ${c3[g].values.join(' / ')}` : `dragging the Twist of ${c2[g].key} (not active): ${grabbed ? 'it became active' : `the active card is ${activeKey(c3)}`}, ${went ? 'its numbers moved' : 'its numbers did not move'}`);
  }
  if (!(await has(SEL.tableNote))) say('skip', where, 'table', `no ${SEL.tableNote}`);
  else {
    const readTable = () => F.evaluate((S) => ({ rows: [...document.querySelectorAll(S.tableRows)].map((r) => r.innerText.replace(/\s+/g, ' ').trim()), note: document.querySelector(S.tableNote).textContent.replace(/\s+/g, ' ').trim() }), SEL);
    if (chipSigs.includes('3333')) await pressChip('3333');
    await settle(1200);
    const h = await readTable();
    let e = null;
    if (chipSigs.includes('2222')) { await pressChip('2222'); await settle(600); e = await readTable(); }
    const problems = [];
    if (h.rows.length !== 6) problems.push(`${h.rows.length} rows for 3333 (two pillows for each of the three partitions: six)`);
    if (h.rows.some((r) => (r.match(/\d+(\.\d+)?/g) || []).length < 4)) problems.push('a row without its numbers');
    if (!/exact/i.test(h.note)) problems.push(`3333: the line under the table does not say the solid is exact ("${h.note}")`);
    if (/stretch|relaxed/i.test(h.note)) problems.push(`3333: the line still speaks of a relaxed mesh ("${h.note}")`);
    if (e && !/exact/i.test(e.note)) problems.push(`2222: the line does not say the solid is exact ("${e.note}")`);
    say(problems.length ? 'FAIL' : 'ok', where, 'table', problems.length ? problems.join('; ') : `3333: ${h.rows.join(' || ')} :: ${h.note}${e ? ` ;; 2222: ${e.note}` : ''}`);
  }

  // ---- colours: a card keeps its partition's colour, whatever is touched
  const swatches = () => F.evaluate((S) => [...document.querySelectorAll(S.cards)].map((c) => { const sw = c.querySelector(S.cardSwatch); return sw ? getComputedStyle(sw).backgroundColor : null; }), SEL);
  /** Press and release on a slider's thumb, without moving it: what "switching to another slider" is. */
  async function touchSlider(cardIndex, word) {
    const cards = await readCards(), loc = F.locator(SEL.cards).nth(cardIndex).locator(SEL.cardRange).nth(sliderOf(cards[cardIndex], word));
    await loc.scrollIntoViewIfNeeded();
    const box = await loc.boundingBox(), r = await loc.evaluate((e) => ({ value: Number(e.value), min: Number(e.min), max: Number(e.max) }));
    const at = (r.value - r.min) / ((r.max - r.min) || 1), thumb = Math.min(22, box.height), run = box.width - thumb;
    const x = box.x + thumb / 2 + at * run, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(70);
    await page.mouse.up();
    await page.mouse.move(2, 2);                       // off the cards: no hover is left on the picture
  }
  if (!gotCards || !(await has(`${SEL.cards} ${SEL.cardSwatch}`))) say('skip', where, 'colours', `no cards or no ${SEL.cardSwatch}`);
  else {
    if (chipSigs.includes('3333')) await pressChip('3333');
    const c0 = await swatches();
    const problems = [];
    if (new Set(c0).size !== 3 || c0.some((c) => !c || /rgba\(0, 0, 0, 0\)|transparent/.test(c))) problems.push(`the three cards do not wear three colours (${c0.join(', ')})`);
    for (const i of [1, 2, 0]) {
      await F.evaluate((key) => window.__pqrs && window.__pqrs.activate(key), (await readCards())[i].key);
      await settle(250);
      const c1 = await swatches();
      if (JSON.stringify(c1) !== JSON.stringify(c0)) problems.push(`after card ${i + 1} became the cut the colours read ${c1.join(', ')}`);
    }
    say(problems.length ? 'FAIL' : 'ok', where, 'colours', problems.length ? problems.join('; ') : `the three cards wear ${c0.join(', ')}, whichever of them is the cut`);
  }

  // ---- switching between sliders changes nothing: both panes and the cards, before and after another card is touched
  async function switchOn(sig) {
    if (sig && chipSigs.includes(sig)) await pressChip(sig);
    {                                                                             // away from the symmetric opening state
      const c = await readCards(), k = Math.max(0, c.findIndex((x) => x.active));
      await dragRange(F.locator(SEL.cards).nth(k).locator(SEL.cardRange).nth(sliderOf(c[k], 'twist')), 0.17);
      await settle(700);
    }
    const first = await readCards(), start = Math.max(0, first.findIndex((c) => c.active));
    const order = [1, 2, 0].map((d) => (start + d) % 3);                           // the two others, then back
    const tag = (label) => `${label}-${sig}`;
    await page.mouse.move(2, 2);
    const base = await shot(SEL.patternPane, tag('pattern-start'));
    let prevSurf = (await has(SEL.surfacePane)) ? await shot(SEL.surfacePane, tag('surface-start')) : null;
    let prevCards = (await has(SEL.cardsBox)) ? await shot(SEL.cardsBox, tag('cards-start')) : null;
    const T = printTones(base);
    if (!T) { say('skip', where, `switch ${sig}`, 'the print\'s two tones were not found in the Pattern pane (is it drawn?)'); return; }
    // the gauge: the same picture one device pixel to the right must read well over the gate, or the lines below mean nothing
    const gauge = printMoved(base, shifted(base, 1, 0), T);
    say(gauge.ratio >= 2 * STILL_GATE ? 'ok' : 'FAIL', where, `switch ${sig} gauge`, `the start picture against itself one device pixel (half a CSS pixel) to the right: ${pct(gauge.ratio)} of ${gauge.samples} print pixels change tone` + (gauge.ratio >= 2 * STILL_GATE ? ` (the gate is ${pct(STILL_GATE, 1)})` : `: under twice the gate of ${pct(STILL_GATE, 1)}, so this measure cannot see such a shift here`));
    let prev = base, n = 0;
    for (const i of order) {
      const word = n++ % 2 ? 'length' : 'twist', before = await readCards();
      let how = `its ${word} slider pressed and let go`;
      await touchSlider(i, word);
      await settle(500);
      let cards = await readCards();
      if (JSON.stringify(cards.map(numbersOf)) !== JSON.stringify(before.map(numbersOf)) || !cards[i].active) {
        // the press moved the thumb (it fell beside it), or did not reach the page: put the numbers back and switch through the page's own hook
        how = 'made the cut through the page\'s hook (the press moved a number)';
        await F.evaluate(([key, L, tw]) => { window.__pqrs.set({ L, tw }, { key }); }, [before[i].key, num(before[i].values[0]), num(before[i].values[1])]);
        await F.evaluate((key) => window.__pqrs.activate(key), before[i].key);
        await settle(500);
        cards = await readCards();
      }
      const img = await shot(SEL.patternPane, tag(`pattern-on-${first[i].key}`.replace('|', '-')));
      const surf = prevSurf ? await shot(SEL.surfacePane, tag(`surface-on-${first[i].key}`.replace('|', '-'))) : null;
      const cardsImg = prevCards ? await shot(SEL.cardsBox, tag(`cards-on-${first[i].key}`.replace('|', '-'))) : null;
      const m = printMoved(prev, img, T), raw = changed(prev, img, 0), surfRaw = surf ? changed(prevSurf, surf, 0) : null, cardsRaw = cardsImg ? changed(prevCards, cardsImg, 0) : null;
      const problems = [];
      if (!cards[i].active || cards.filter((c) => c.active).length !== 1) problems.push(`the card ${first[i].key} did not become the cut`);
      if (!m.sized) problems.push('the pane changed size');
      else if (m.samples < 0.2 * m.area) problems.push(`too little print to compare (${m.samples} pixels)`);
      else if (m.ratio >= STILL_GATE) problems.push(`the print moved: ${pct(m.ratio)} of ${m.samples} print pixels changed tone (gate ${pct(STILL_GATE, 1)})`);
      if (raw > 0) problems.push(`the Pattern pane changed: ${pct(raw, 4)} of its pixels are not the same, lines and marks included`);
      if (surfRaw !== null && surfRaw > 0) problems.push(`the Surface pane changed: ${pct(surfRaw, 4)} of its pixels are not the same`);
      if (cardsRaw !== null && cardsRaw > 0) problems.push(`the cards changed their look: ${pct(cardsRaw, 4)} of their pixels are not the same`);
      const back = i === start ? `; back at the start, against the first picture: ${pct(printMoved(base, img, T).ratio)}` : '';
      say(problems.length ? 'FAIL' : 'ok', where, `switch ${sig} ${first[i].key}`, (problems.length ? problems.join('; ') : `${how}: not one pixel differs in the Surface pane (${surfRaw === null ? 'no pane' : pct(surfRaw, 4)}), the Pattern pane (${pct(raw, 4)}; print ${pct(m.ratio)} of ${m.samples}) or the cards (${cardsRaw === null ? 'none' : pct(cardsRaw, 4)})`) + back);
      prev = img; prevSurf = surf; prevCards = cardsImg;
    }
  }
  if (!gotCards || !(await has(SEL.patternPane))) say('skip', where, 'switch', `no cards or no ${SEL.patternPane}`);
  else for (const sig of ['3333', '2345', '2223', '2222']) await switchOn(sig);

  // ---- the journey
  const journeyShown = (await has(SEL.journeyRange)) && (await has(SEL.journeyRight)) && (await F.locator(SEL.journeyRight).first().isVisible());
  if (!journeyShown || !(await has(SEL.surfacePane))) say('skip', where, 'journey', `no journey shown (${SEL.journeyRange}, ${SEL.journeyRight}) or no ${SEL.surfacePane}`);
  else {
    if (chipSigs.includes('3333')) await pressChip('3333');
    const jr = F.locator(SEL.journeyRange).first(), left = F.locator(SEL.journeyLeft).first(), right = F.locator(SEL.journeyRight).first();
    const stop = async () => {                                 // wait until the scrubber rests
      let last = null;
      for (let i = 0; i < 40; i++) {
        const v = await jr.evaluate((e) => Number(e.value));
        if (last !== null && Math.abs(v - last) < 1e-6) return v;
        last = v;
        await page.waitForTimeout(160);
      }
      return last;
    };
    const texts = async () => [(await left.textContent()).trim(), (await right.textContent()).trim()];
    const range = await jr.evaluate((e) => ({ min: Number(e.min), max: Number(e.max) }));
    const at = [], pics = [], labels = [];
    at.push(await stop()); labels.push(await texts()); pics.push(await shot(SEL.surfacePane, 'journey-0-surface'));
    await right.scrollIntoViewIfNeeded(); await right.click(); await settle(300);
    at.push(await stop()); await settle(1800); labels.push(await texts()); pics.push(await shot(SEL.surfacePane, 'journey-1-pillows'));      // (the camera's frame eases in: 0.16 s to 1/e)
    // the loop it parts along is the journey's own choice: another card's slider, pressed, changes nothing; another chip does
    let own = null;
    if (await has(SEL.journeyChips)) {
      await touchSlider(2, 'twist');
      await settle(400);
      const afterTouch = await shot(SEL.surfacePane, 'journey-1-after-touch'), chips = F.locator(SEL.journeyChips);
      await chips.nth(2).scrollIntoViewIfNeeded(); await chips.nth(2).click(); await settle(1800);
      const otherLoop = await shot(SEL.surfacePane, 'journey-1-other-loop'), hashChip = await hashNow();
      await chips.nth(0).click(); await settle(1800);
      const backLoop = await shot(SEL.surfacePane, 'journey-1-first-loop');
      own = { touch: changed(pics[1], afterTouch, 0), chip: changed(pics[1], otherLoop), back: changed(pics[1], backLoop), hash: hashChip };
    }
    await right.click(); await settle(300);
    at.push(await stop()); await settle(500); labels.push(await texts()); pics.push(await shot(SEL.surfacePane, 'journey-2-crowns'));
    const hash2 = await hashNow();
    // back by hand: the scrubber dragged to its start
    await dragRange(jr, -1.1);
    await settle(900);
    const home = await stop(), backPic = await shot(SEL.surfacePane, 'journey-3-back'), d01 = changed(pics[0], pics[1]), d12 = changed(pics[1], pics[2]), d20 = changed(pics[2], backPic), d00 = changed(pics[0], backPic);
    const span = range.max - range.min, pos = at.map((v) => (v - range.min) / span);
    const problems = [];
    if (!(Math.abs(pos[0]) < 0.02 && Math.abs(pos[1] - 0.5) < 0.03 && Math.abs(pos[2] - 1) < 0.02)) problems.push(`the two presses did not stop at the middle and the end of the scrubber (${pos.map((v) => v.toFixed(2)).join(', ')})`);
    if (d01 < 0.01) problems.push(`surface -> two pillows changed ${pct(d01)} of the Surface's pixels`);
    if (d12 < 0.01) problems.push(`two pillows -> open crowns changed ${pct(d12)}`);
    if (Math.abs((home - range.min) / span) > 0.02) problems.push(`dragging the scrubber back left it at ${((home - range.min) / span).toFixed(2)}`);
    else if (d20 < 0.01) problems.push('dragging the scrubber back did not change the picture');
    if (!/^part$/i.test(labels[0][1]) || !/^join$/i.test(labels[1][0]) || !/^unzip$/i.test(labels[1][1]) || !/^zip$/i.test(labels[2][0])) problems.push(`button words (left / right at the three stops): ${labels.map((l) => l.join(' / ')).join(', ')}; SPEC 1.4: Join / Part, Join / Unzip, Zip / ...`);
    if (!/(^|[#&])j=/.test(hash2)) problems.push(`the address carries no j at the last stop (${hash2 || 'empty'})`);
    if (own) {
      if (own.touch > 0) problems.push(`parted, pressing another card's slider changed ${pct(own.touch, 4)} of the Surface's pixels (the journey's loop must not follow the cards)`);
      if (own.chip < 0.01) problems.push(`choosing another loop to part along changed only ${pct(own.chip)} of the Surface's pixels`);
      // (back on the first loop the solid is the same; a label may sit on another side of its cone point, by the
      // renderer's own rule that a label keeps a spot until another is clearly better: hence a share, not zero)
      if (own.back > 0.02) problems.push(`back on the first loop the picture is another one (${pct(own.back, 2)} of its pixels)`);
      if (!/(^|[#&])jp=2(&|$)/.test(own.hash)) problems.push(`the address does not name the loop chosen (${own.hash})`);
    }
    say(problems.length ? 'FAIL' : 'ok', where, 'journey', problems.length ? problems.join('; ') : `stops at ${pos.map((v) => v.toFixed(2)).join(', ')} of the scrubber; pixels changed ${pct(d01, 1)}, ${pct(d12, 1)}, back ${pct(d20, 1)} (against the first picture ${pct(d00, 1)}); buttons ${labels.map((l) => l.join(' / ')).join(', ')}; ${hash2}${own ? `; parted, another card's slider pressed: ${pct(own.touch, 4)} of pixels differ; another loop chosen: ${pct(own.chip, 1)}; back on the first: ${pct(own.back, 2)} (labels may sit elsewhere)` : ''}`);
  }

  // ---- the address restores the state
  if (!gotCards) say('skip', where, 'address', `no cards (${SEL.cards})`);
  else {
    if (chipSigs.includes('2345')) await pressChip('2345');
    await F.evaluate((key) => window.__pqrs && window.__pqrs.activate(key), (await readCards())[2].key);
    await settle(500);
    const c = await readCards(), k = Math.max(0, c.findIndex((x) => x.active));
    await dragRange(F.locator(SEL.cards).nth(k).locator(SEL.cardRange).last(), 0);
    await settle(500);
    if (journeyShown && !(await F.locator(SEL.journeyRight).first().isDisabled())) { await F.locator(SEL.journeyRight).first().click(); await settle(1600); }
    await settle(600);
    const read = async (frame) => frame.evaluate((S) => ({
      chip: (document.querySelector(`${S.chips}[aria-pressed="true"]`) || { getAttribute: () => null }).getAttribute(S.chipAttr),
      cards: [...document.querySelectorAll(S.cards)].map((x) => ({ key: x.getAttribute(S.cardKeyAttr), active: x.getAttribute(S.cardActiveAttr) === 'true', values: [...x.querySelectorAll(S.cardValue)].map((o) => o.textContent.trim()) })),
      j: document.querySelector(S.journeyRange) ? Number(document.querySelector(S.journeyRange).value) : null,
    }), SEL);
    const was = await read(F), hash = await hashNow(), top = page.url().split('#')[0];
    const again = await open(top + hash);
    const now = await read(again.F), hashAgain = await (async () => { const own = await again.F.evaluate(() => window.location.hash); return own && own.length > 1 ? own : again.pg.evaluate(() => window.location.hash); })();
    const problems = [];
    if (!hash || hash.length < 3) problems.push('the address is empty after the changes');
    if (hash && !/^#[A-Za-z0-9_.=%&/-]*$/.test(hash)) problems.push(`the address has a letter outside [A-Za-z0-9_.=%&/-]: ${hash}`);
    if (now.chip !== was.chip) problems.push(`orbifold ${was.chip} came back as ${now.chip}`);
    const wasKey = (was.cards.find((x) => x.active) || {}).key, nowKey = (now.cards.find((x) => x.active) || {}).key;
    if (wasKey !== nowKey) problems.push(`active card ${wasKey} came back as ${nowKey}`);
    let worst = 0;
    was.cards.forEach((x, i) => x.values.forEach((v, n) => { const d = Math.abs(num(v) - num(((now.cards[i] || {}).values || [])[n])); worst = Math.max(worst, Number.isFinite(d) ? d : 9); }));
    if (worst > 0.0021) problems.push(`a card's number came back off by ${worst.toFixed(4)} (the address keeps 3 and 4 decimals)`);
    if (was.j !== null && now.j !== null && Math.abs(was.j - now.j) > 0.02) problems.push(`journey ${was.j} came back as ${now.j}`);
    say(problems.length ? 'FAIL' : 'ok', where, 'address', problems.length ? problems.join('; ') + ` [${hash}]` : `${hash} opens again on ${now.chip}, active ${nowKey}, numbers within ${worst.toFixed(4)}, journey ${now.j}; its own address then reads ${hashAgain}`);
    await page.close();
    page = again.pg; F = again.F;
  }

  // ---- the Tutorial tab, and nothing wider than the screen
  const overflow = () => F.evaluate(() => ({ scroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), client: document.documentElement.clientWidth }));
  const widthPlay = await overflow();
  let widthTut = null;
  if (!(await has(SEL.tabTutorial)) || !(await has(SEL.tutorial))) say('skip', where, 'tutorial', `no ${SEL.tabTutorial} or no ${SEL.tutorial}`);
  else {
    await F.locator(SEL.tabTutorial).first().click();
    await settle(500);
    const t = await F.evaluate((S) => {
      const root = document.querySelector(S.tutorial), shown = !root.hidden && getComputedStyle(root).display !== 'none';
      const text = root.textContent;
      const wide = [...root.querySelectorAll('.mjx-d')].filter((d) => d.scrollWidth > d.clientWidth + 1).length;
      return { shown, wide, sections: root.querySelectorAll('h2').length, formulas: root.querySelectorAll('.mjx-d, .mjx-i').length, raw: /\\\(|\\\[|\\frac|\\cosh/.test(text), words: text.split(/\s+/).filter(Boolean).length, links: [...root.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')) };
    }, SEL);
    widthTut = await overflow();
    if (shotsDir) { fs.mkdirSync(shotsDir, { recursive: true }); await page.screenshot({ path: path.join(shotsDir, `${where}-tutorial.png`), fullPage: true }); }
    const hosts = t.links.filter((h) => !/^https:\/\/(spacesheep\.dev\/@yaroslavvb\/|yaroslavvb\.github\.io\/animated-groups-fable\/)/.test(h));
    const problems = [];
    if (!t.shown) problems.push('the tab did not open');
    if (t.sections !== TUTORIAL_SECTIONS) problems.push(`${t.sections} sections (h2), the Tutorial has ${TUTORIAL_SECTIONS}`);
    if (t.formulas < 20) problems.push(`only ${t.formulas} typeset formulas`);
    if (t.raw) problems.push('raw TeX is left in the text');
    if (hosts.length) problems.push(`links off the two allowed hosts: ${hosts.join(', ')}`);
    say(problems.length ? 'FAIL' : 'ok', where, 'tutorial', problems.length ? problems.join('; ') : `${t.sections} sections, ${t.formulas} formulas typeset, ${t.wide ? `${t.wide} of them wider than the screen (they scroll in their own box)` : 'none wider than the screen'}, ${t.links.length} links, about ${t.words} words and formula marks`);
    if (await has(SEL.tabPlay)) { await F.locator(SEL.tabPlay).first().click(); await settle(300); }
  }
  {
    const wide = [['Play', widthPlay], ['Tutorial', widthTut]].filter(([, w]) => w && w.scroll > w.client + 0.5);
    say(wide.length ? 'FAIL' : 'ok', where, 'overflow', wide.length ? wide.map(([n, w]) => `${n} is ${w.scroll} px wide on a ${w.client} px screen`).join('; ') : `Play ${widthPlay.scroll} of ${widthPlay.client} px${widthTut ? `, Tutorial ${widthTut.scroll} of ${widthTut.client} px` : ''}`);
  }

  // ---- layout: the panes side by side; on the phone the tap targets and the field
  if (!(await has(SEL.patternBox)) || !(await has(SEL.surfaceBox))) say('skip', where, 'layout', `no ${SEL.patternBox} or no ${SEL.surfaceBox}`);
  else {
    const L = await F.evaluate((S) => {
      const box = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
      const small = [...document.querySelectorAll(S.tapTargets)].filter((e) => e.offsetParent !== null).map((e) => ({ what: (e.textContent || e.id || e.className).trim().slice(0, 16), ...box(e) })).filter((b) => b.h < 43.5 || b.w < 43.5);
      const ranges = [...document.querySelectorAll(`${S.cards} ${S.cardRange}`)].map((e) => box(e).h);
      const field = document.querySelector(S.field);
      return { a: box(document.querySelector(S.patternBox)), b: box(document.querySelector(S.surfaceBox)), vw: document.documentElement.clientWidth, small, sliderLow: ranges.length ? Math.min(...ranges) : null, fieldPx: field ? parseFloat(getComputedStyle(field).fontSize) : null };
    }, SEL);
    const problems = [];
    if (Math.abs(L.a.y - L.b.y) > 6 || L.b.x < L.a.x + L.a.w - 2) problems.push(`the panes are not side by side (Pattern at ${Math.round(L.a.x)}, ${Math.round(L.a.y)}, Surface at ${Math.round(L.b.x)}, ${Math.round(L.b.y)})`);
    if (Math.abs(L.a.w - L.b.w) > 0.12 * Math.max(L.a.w, L.b.w)) problems.push(`the panes are not equal (${Math.round(L.a.w)} and ${Math.round(L.b.w)} px)`);
    if (vp.phone) {
      if (L.small.length) problems.push(`tap targets under 44 px: ${L.small.slice(0, 4).map((b) => `${b.what} ${Math.round(b.w)}x${Math.round(b.h)}`).join(', ')}${L.small.length > 4 ? ` and ${L.small.length - 4} more` : ''}`);
      if (L.sliderLow !== null && L.sliderLow < 43.5) problems.push(`a card's slider is ${Math.round(L.sliderLow)} px tall`);
      if (L.fieldPx !== null && L.fieldPx < 16) problems.push(`the field's text is ${L.fieldPx} px`);
    }
    say(problems.length ? 'FAIL' : 'ok', where, 'layout', problems.length ? problems.join('; ') : `panes side by side, ${Math.round(L.a.w)} + ${Math.round(L.b.w)} of ${L.vw} px${vp.phone ? `; tap targets at least 44 px, sliders ${L.sliderLow === null ? 'none' : Math.round(L.sliderLow) + ' px'}, field text ${L.fieldPx} px` : ''}`);
  }

  // ---- errors, over everything above
  const unique = [...new Set(errors)];
  say(unique.length ? 'FAIL' : 'ok', where, 'errors', unique.length ? `${errors.length} (${unique.length} different): ${unique.slice(0, 3).map((e) => e.slice(0, 200)).join(' || ')}` : 'no console error, no page error');
  await ctx.close();
}

try {
  // once: the words a publish refuses (in the file's own bytes when the target is a file)
  if (!isUrl) {
    const text = fs.readFileSync(path.resolve(target), 'utf8'), low = text.toLowerCase();
    const hits = REFUSED.filter((w) => low.includes(w)).map((w) => `"${w}" at byte ${low.indexOf(w)}: …${text.slice(Math.max(0, low.indexOf(w) - 24), low.indexOf(w) + 24).replace(/\s+/g, ' ')}…`);
    say(hits.length ? 'FAIL' : 'ok', 'file', 'words', hits.length ? `letter sequences a publish refuses: ${hits.join('; ')}` : `none of the three letter sequences a publish refuses in ${(Buffer.byteLength(text) / 1024).toFixed(0)} kB`);
  } else say('skip', 'file', 'words', 'the target is an address, not a file: run the check on the built file for this');
  for (const vp of VIEWPORTS) if (!only || only === vp.name) {
    try { await runViewport(vp); } catch (err) { say('FAIL', vp.name, 'run', `the check itself stopped: ${String(err && err.message ? err.message : err).split('\n')[0].slice(0, 300)}`); }
  }
} finally {
  clearTimeout(watchdog);
  await browser.close();
}
console.log(`check.mjs: ${tally.ok} ok, ${tally.FAIL} FAIL, ${tally.skip} skip in ${((Date.now() - started) / 1000).toFixed(0)} s on ${url}`);
process.exit(tally.FAIL ? 1 : 0);
