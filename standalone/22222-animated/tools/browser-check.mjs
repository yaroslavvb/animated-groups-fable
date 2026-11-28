// browser-check.mjs — automated visual + functional Chrome verification for "22222 animated".
// Usage:
//   node tools/browser-check.mjs [--url <url>] [--shots <dir>]

import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};

const URL0 = arg('--url', pathToFileURL(path.join(here, '../site/index.html')).href);
const SHOTS_DIR = arg('--shots', '');

const PW = process.env.PLAYWRIGHT || [
  path.join(process.env.HOME || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'),
].find((p) => fs.existsSync(p));

const CHROME = process.env.CHROME || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/opt/pw-browsers/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => fs.existsSync(p));

const { chromium } = PW ? await import(pathToFileURL(PW).href) : await import('playwright');

let failed = 0;
const ok = (cond, what) => {
  if (cond) console.log('  ok   ' + what);
  else {
    failed++;
    console.log('  FAIL ' + what);
  }
};

const browser = await chromium.launch(
  CHROME && fs.statSync(CHROME).isFile()
    ? { executablePath: CHROME, headless: true }
    : { headless: true }
);

async function open(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const loc = m.location()?.url || '';
    if (loc.endsWith('/favicon.ico')) return;
    errors.push(m.text());
  });
  await page.goto(URL0, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__anim22222 && window.__anim22222.state(), null, { timeout: 20000 });
  await page.evaluate(() => {
    window.__grabDisk = () => {
      const c = document.getElementById('disk');
      return c.getContext('2d').getImageData(0, 0, c.width, c.height);
    };
    window.__diffDisk = (a, b, frac = 0.82) => {
      const w = a.width, h = a.height, cx = w / 2, cy = h / 2, R = (Math.min(w, h) * 0.468) * frac;
      let n = 0, bad = 0;
      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
          if ((x - cx) ** 2 + (y - cy) ** 2 > R * R) continue;
          n++;
          const i = 4 * (y * w + x);
          const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
          if (d > 48) bad++;
        }
      }
      return bad / Math.max(1, n);
    };
  });
  return { ctx, page, errors };
}

try {
  // 1. Desktop checks
  console.log(`Checking ${URL0}`);
  const { ctx, page, errors } = await open(1280, 860);

  const initial = await page.evaluate(() => ({
    st: window.__anim22222.state(),
    info: window.__anim22222.info(),
    chipCount: document.querySelectorAll('#groups-matrix .g-chip').length,
    nbrCount: document.querySelectorAll('#groups-matrix .g-chip.is-neighbor').length,
    flipCount: document.querySelectorAll('#flips-grid .flip-btn').length,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));

  ok(errors.length === 0, `no console/page errors (${errors.join('; ') || '0'})`);
  ok(initial.st.grouping === 'AB|E|CD', `starts at balanced AB|E|CD (got ${initial.st.grouping})`);
  ok(Math.abs(initial.st.d1 - 1.0613) < 0.01 && Math.abs(initial.st.d2 - 1.0613) < 0.01, `balanced golden lengths (${initial.st.d1.toFixed(3)}, ${initial.st.d2.toFixed(3)})`);
  ok(initial.chipCount === 15, `all 15 grouping chips rendered (got ${initial.chipCount})`);
  ok(initial.nbrCount === 4, `exactly 4 1-flip neighbors highlighted (got ${initial.nbrCount})`);
  ok(initial.flipCount === 4, `4 direct local flip buttons rendered (got ${initial.flipCount})`);
  ok(initial.info.totalCopies >= 180, `Poincaré disk populated (${initial.info.totalCopies} motif copies)`);
  ok(!initial.overflow, 'no horizontal overflow at 1280px');

  // Verify live twist motion while playing
  const motionRes = await page.evaluate(async () => {
    const t0 = window.__anim22222.state().twistTurn;
    const img0 = window.__grabDisk();
    await new Promise((r) => setTimeout(r, 420));
    const t1 = window.__anim22222.state().twistTurn;
    const img1 = window.__grabDisk();
    return { t0, t1, diff: window.__diffDisk(img0, img1, 0.85) };
  });
  ok(motionRes.t1 !== motionRes.t0 && motionRes.diff > 0.04, `live twist animates smoothly (diff=${(motionRes.diff * 100).toFixed(1)}%)`);

  // Verify all 5 motif colors are visibly present in the Poincaré disk
  const colorRes = await page.evaluate(() => {
    window.__anim22222.setPlaying(false);
    window.__anim22222.setTwist(0.18);
    const img = window.__grabDisk();
    const targets = {
      A: [0, 114, 178],
      B: [213, 94, 0],
      C: [0, 158, 115],
      D: [136, 65, 184],
      E: [201, 138, 0],
    };
    const hits = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    for (let i = 0; i < img.data.length; i += 16) {
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
      for (const [k, [tr, tg, tb]] of Object.entries(targets)) {
        if (Math.abs(r - tr) + Math.abs(g - tg) + Math.abs(b - tb) < 42) hits[k]++;
      }
    }
    return hits;
  });
  for (const k of ['A', 'B', 'C', 'D', 'E']) {
    ok(colorRes[k] > 80, `motif ${k} visibly painted (${colorRes[k]} samples)`);
  }

  if (SHOTS_DIR) {
    fs.mkdirSync(SHOTS_DIR, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS_DIR, 'desktop-balanced.png'), fullPage: false });
  }

  // Verify ZERO PIXEL JUMP on every direct local flip and multi-flip navigation across 15 groupings!
  const flipDiffRes = await page.evaluate(() => {
    window.__anim22222.setPlaying(false);
    window.__anim22222.setShowRails(false);
    window.__anim22222.setTwist(0.24);
    const baseImg = window.__grabDisk();
    const flips = window.__anim22222.availableFlips();
    let maxDirectDiff = 0;
    for (const fl of flips) {
      window.__anim22222.doFlip(fl.railIdx, fl.keepIdx);
      const afterImg = window.__grabDisk();
      maxDirectDiff = Math.max(maxDirectDiff, window.__diffDisk(baseImg, afterImg, 0.8));
      // Jump back to AB|E|CD via local flips
      window.__anim22222.goTo('AB|E|CD');
    }
    // Now jump to a 3-flip-distant grouping (diameter 3!)
    const path3 = window.__anim22222.goTo('AC|D|BE');
    const after3 = window.__grabDisk();
    const diff3 = window.__diffDisk(baseImg, after3, 0.8);
    // Test exact twist periodicity u=0 vs u=1 on balanced state
    window.__anim22222.reset();
    window.__anim22222.setPlaying(false);
    window.__anim22222.setTwist(0.0);
    const p0 = window.__grabDisk();
    window.__anim22222.setTwist(1.0);
    const p1 = window.__grabDisk();
    const periodDiff = window.__diffDisk(p0, p1, 0.82);
    return { maxDirectDiff, diff3, path3Len: path3.length - 1, periodDiff };
  });
  ok(flipDiffRes.maxDirectDiff < 0.002, `all 4 direct local flips have 0.00% pixel jump (max=${(flipDiffRes.maxDirectDiff * 100).toFixed(3)}%)`);
  ok(flipDiffRes.diff3 < 0.002, `${flipDiffRes.path3Len}-flip jump to AC|D|BE has 0.00% pixel jump (diff=${(flipDiffRes.diff3 * 100).toFixed(3)}%)`);
  ok(flipDiffRes.periodDiff < 0.002, `twist period u=0 vs u=1 is exact (diff=${(flipDiffRes.periodDiff * 100).toFixed(3)}%)`);

  // Screenshot with Show rails enabled + flipped grouping
  await page.evaluate(() => {
    window.__anim22222.goTo('AE|C|BD');
    window.__anim22222.setTwist(0.32);
    window.__anim22222.setShowRails(true);
  });
  if (SHOTS_DIR) {
    await page.screenshot({ path: path.join(SHOTS_DIR, 'desktop-rails-flipped.png'), fullPage: false });
  }
  await ctx.close();

  // 2. Mobile 390x844 checks
  const mob = await open(390, 844);
  const mobCheck = await mob.page.evaluate(() => {
    window.__anim22222.setPlaying(false);
    window.__anim22222.setTwist(0.2);
    const diskRect = document.getElementById('disk').getBoundingClientRect();
    const flipsRect = document.getElementById('flips-grid').getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      diskW: diskRect.width,
      diskH: diskRect.height,
      diskTop: diskRect.top,
      flipsW: flipsRect.width,
    };
  });
  ok(mob.errors.length === 0, `mobile 390px: no errors`);
  ok(!mobCheck.overflow, `mobile 390px: no horizontal overflow (scrollW=${mobCheck.scrollW}, innerW=${mobCheck.innerW})`);
  ok(mobCheck.diskW >= 320 && mobCheck.diskH >= 280 && mobCheck.diskTop < 220, `mobile 390px: Poincaré disk prominent above fold (${Math.round(mobCheck.diskW)}x${Math.round(mobCheck.diskH)} at y=${Math.round(mobCheck.diskTop)})`);

  if (SHOTS_DIR) {
    await mob.page.screenshot({ path: path.join(SHOTS_DIR, 'mobile-390.png'), fullPage: true });
  }
  await mob.ctx.close();
} finally {
  await browser.close();
}

if (failed) {
  console.error(`\n${failed} check(s) FAILED.`);
  process.exit(1);
}
console.log('\nAll browser checks PASSED!');
