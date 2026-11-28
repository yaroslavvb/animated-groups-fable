// live-hash.mjs <url with a hash>: does the page inside the spacesheep viewer open the state the address names?
import { pathToFileURL } from 'node:url';
const PW = `${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`;
const { chromium } = await import(pathToFileURL(PW).href);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto(process.argv[2], { waitUntil: 'load', timeout: 45000 });
  for (const wait of [1500, 2500, 4000]) {
    await page.waitForTimeout(wait);
    const out = [];
    for (const f of page.frames()) {
      const r = await f.evaluate(() => (window.__pqrs ? { hash: window.location.hash, state: window.__pqrs.state().hash, chip: (document.querySelector('button.chip[aria-pressed="true"]') || {}).textContent } : null)).catch(() => null);
      if (r) out.push({ frame: f.url().slice(0, 90), ...r });
    }
    console.log(`after ${wait} ms more:`, JSON.stringify(out), '| top hash', await page.evaluate(() => location.hash));
  }
  if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
} finally { await browser.close(); }
