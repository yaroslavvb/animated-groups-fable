#!/usr/bin/env node
// shots.mjs — pictures of a build for the shell owner to LOOK at.   node dev/shell/shots.mjs [file.html]
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const PW = process.env.PLAYWRIGHT_MJS || `${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const file = resolve(process.argv[2] || resolve(here, 'index.html')), url = pathToFileURL(file).href;
const tutUrl = pathToFileURL(resolve(here, 'index-tutorial.html')).href;
const { chromium } = await import(pathToFileURL(PW).href);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--ignore-gpu-blocklist', '--enable-webgl'] });
const errors = [];
const open = async (w, h, phone, u = url) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(u, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  return { ctx, page };
};
const shot = (page, name, full = false) => page.screenshot({ path: resolve(here, `shot-${name}.png`), fullPage: full });
try {
  let { ctx, page } = await open(1280, 900, false);
  await shot(page, 'desk');
  await page.click('.pq-card[data-key="02|13"] .pq-card-head');
  await page.waitForTimeout(250);
  await shot(page, 'flip-midturn');
  await page.waitForTimeout(900);
  await page.evaluate(() => window.__pqrs.set({ tw: 0.2 }));
  await page.waitForTimeout(900);
  await shot(page, 'flip-twist');
  console.log('after flip + twist:', JSON.stringify(await page.evaluate(() => ({ hash: window.__pqrs.state().hash, shown: window.__pqrs.shown().map((c) => `${c.label} ${c.LText} ${c.twText}${c.active ? '*' : ''}`), surf: window.__pqrs.surface().stats, fails: window.__pqrs.surface().fails }))));
  await page.evaluate(() => window.__pqrs.journey(1));
  await page.waitForTimeout(500);
  await shot(page, 'j1');
  await page.evaluate(() => window.__pqrs.journey(2));
  await page.waitForTimeout(500);
  await shot(page, 'j2');
  await page.evaluate(() => window.__pqrs.journey(0));
  await page.click('.chip[data-sig="2222"]');
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__pqrs.set({ tw: 0.25 }));
  await page.waitForTimeout(600);
  await shot(page, '2222-quarter');
  await page.click('.chip[data-sig="2345"]');
  await page.waitForTimeout(900);
  await shot(page, '2345');
  await ctx.close();

  ({ ctx, page } = await open(1024, 700, false));
  await shot(page, 'small');
  await ctx.close();

  ({ ctx, page } = await open(390, 844, true));
  await page.evaluate(() => window.scrollTo(0, document.getElementById('pane2').getBoundingClientRect().top + window.scrollY - 6));
  await page.waitForTimeout(200);
  await shot(page, 'phone-panes-and-cards');
  const fit = await page.evaluate(() => { const c = document.getElementById('cards').getBoundingClientRect(), p = document.getElementById('pane2').getBoundingClientRect(); return { panesTop: Math.round(p.top), cardsBottom: Math.round(c.bottom), screen: window.innerHeight }; });
  console.log('phone, scrolled to the panes:', JSON.stringify(fit));
  await ctx.close();

  for (const [name, w, h, phone] of [['tutorial-desk', 1280, 900, false], ['tutorial-phone', 390, 844, true]]) {
    ({ ctx, page } = await open(w, h, phone, tutUrl));
    await page.click('.tab2[data-tab="tutorial"]');
    await page.waitForTimeout(300);
    const t = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, h: document.documentElement.scrollHeight, wide: Array.from(document.querySelectorAll('#tutorial *')).filter((e) => e.getBoundingClientRect().right > window.innerWidth + 0.5).slice(0, 5).map((e) => `${e.tagName}.${e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className}:${Math.round(e.getBoundingClientRect().right)}`) }));
    console.log(`${name}:`, JSON.stringify(t));
    await shot(page, name);
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(errors.length ? `page errors: ${errors.slice(0, 4).join(' | ')}` : 'no console or page error');
