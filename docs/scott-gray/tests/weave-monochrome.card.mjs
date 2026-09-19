// The social card for Weave Monochrome, straight off the page it advertises.
//
//   node docs/scott-gray/tests/weave-monochrome.card.mjs \
//     [base-url] [out-file]
//
// Defaults to the local server and docs/scott-gray/weave-monochrome/social-preview.png.
//
// Why this and not tools/export_ember_social.mjs, which still makes the mp4:
// that exporter renders the video at 1080 × 1080 and then resizes the viewport
// to 1200 × 630 for the still. The page's home framing follows the shorter side,
// so the resize moves the picture by a hundred CSS pixels in one draw, and the
// shutter — which cannot tell a relayout from a pan — integrated the still
// across it. The renderer no longer reads a resize as motion, so that card is
// sharp again, but it is still a JPEG, and a two-tone picture of hard edges is
// both smaller and exact as a PNG (about 30 KB against 180 KB, with no ringing
// along the contour).
//
// So: one viewport, set before the page loads, no resize, the shutter explicitly
// off (?taa=1), the animation held at the opening phase, and the canvas itself
// captured rather than the page around it.
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const runtime = '/Users/yaroslavvb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ?? `${runtime}playwright/index.mjs`);
const base = (process.argv[2] ?? 'http://localhost:8934/scott-gray/weave-monochrome/').replace(/\/?$/, '/');
const out = resolve(process.argv[3] ?? 'docs/scott-gray/weave-monochrome/social-preview.png');

const browser = await chromium.launch({channel: 'chrome', headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1200, height: 630}, deviceScaleFactor: 1});
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('console', message => { if (message.type() === 'error') failures.push(message.text()); });
  await page.goto(`${base}?phase=0&play=0&taa=1&dpr=1&stats=0`);
  await page.waitForSelector('canvas[data-ready="true"]');
  // The controls fade out on their own; the card is the pattern alone.
  await page.evaluate(() => { for (const id of ['controls', 'stats', 'notice']) document.querySelector(`#${id}`)?.remove(); });
  await page.waitForTimeout(200);
  const png = await page.locator('canvas').screenshot({type: 'png'});
  if (failures.length) throw new Error(`the page reported ${failures.length}: ${failures[0]}`);
  await writeFile(out, png);
  // A card of a two-tone picture should be two-tone: the only greys belong to
  // the one-pixel anti-aliased contour. A soft card — the smeared kind — runs to
  // 11 % grey and six-pixel ramps, so this is the check that would have caught it.
  const {PNG} = (await import(process.env.PNGJS_MODULE ?? `${runtime}pngjs/lib/png.js`)).default;
  const image = PNG.sync.read(png);
  let grey = 0;
  for (let i = 0; i < image.data.length; i += 4) { const l = image.data[i]; if (l > 32 && l < 223) grey++; }
  const share = grey / (image.width * image.height);
  console.log(`${out}: ${image.width} × ${image.height}, ${(png.length / 1024).toFixed(1)} KB, ${(100 * share).toFixed(2)} % mid-grey`);
  if (share > 0.04) throw new Error(`the card is soft: ${(100 * share).toFixed(2)} % of it is mid-grey`);
} finally { await browser.close(); }
