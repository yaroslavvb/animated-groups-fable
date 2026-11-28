#!/usr/bin/env node
// closeups.mjs — close pictures of the Surface pane (and the Pattern pane) of site/index.html, one headless Chrome.
//   node dev/integration/closeups.mjs <name> <hash> [--pre "js"] [--az -20,70,160,250] [--el 14] [--zoom 1] [--phone] [--both]
// Writes dev/integration/shots/close-<name>-az<az>.png (the Surface pane) and, with --both, close-<name>-pattern.png.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const PW = `${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : dflt; };
const has = (name) => args.includes(name);
const [name, hash = ''] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--pre', '--az', '--el', '--zoom', '--file'].includes(args[i - 1])));
if (!name) { console.error('usage: node closeups.mjs <name> <hash> [--pre js] [--az a,b,c] [--el e] [--zoom z] [--phone] [--both]'); process.exit(2); }
const azs = String(flag('--az', '-20')).split(',').map(Number), el = Number(flag('--el', 14)), zoom = flag('--zoom', null);
const file = resolve(here, flag('--file', '../../site/index.html'));
const phone = has('--phone');
const { chromium } = await import(pathToFileURL(PW).href);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 }, deviceScaleFactor: 2, isMobile: phone, hasTouch: phone });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await page.goto(pathToFileURL(file).href + hash, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(1800);
  const pre = flag('--pre', null);
  if (pre) { console.log('pre:', JSON.stringify(await page.evaluate(`(async()=>{ ${pre} })()`))); await page.waitForTimeout(1800); }
  const info = await page.evaluate(() => { const s = window.__pqrs.surface(), st = window.__pqrs.state(); return { hash: st.hash, key: st.key, stats: s.stats && { mean: +(100 * s.stats.strainMean).toFixed(2), worst: +(100 * s.stats.strainMax).toFixed(2) }, error: s.error, view: s.view && { az: s.view.az, el: s.view.el, zoom: s.view.zoom } }; });
  console.log('info:', JSON.stringify(info));
  for (const az of azs) {
    await page.evaluate(([a, e, z]) => { const p = window.__pqrs.pane(); const v = { az: a, el: e }; if (z !== null) v.zoom = Number(z); p.setView(v); p.render(); }, [az, el, zoom]);
    await page.waitForTimeout(700);
    const out = resolve(here, 'shots', `close-${name}-az${az}${phone ? '-phone' : ''}.png`);
    await page.locator('#surf-wrap').screenshot({ path: out });
    console.log('wrote', out);
  }
  if (has('--both')) {
    const out = resolve(here, 'shots', `close-${name}-pattern${phone ? '-phone' : ''}.png`);
    await page.locator('#pat-wrap').screenshot({ path: out });
    console.log('wrote', out);
  }
  if (errors.length) console.log('page errors / warnings:', errors.slice(0, 5).join(' | '));
} finally {
  await browser.close();
}
