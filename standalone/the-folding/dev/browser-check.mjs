// browser-check.mjs — open the app through tools/browser.mjs, read its state, time it, write one picture.
//   node dev/browser-check.mjs [mini|local|auto] [out.png]
import { openBrowser } from '../tools/browser.mjs';
const where = process.argv[2] || 'auto';
const out = process.argv[3] || 'qa/browser-check.png';
const t0 = Date.now();
const B = await openBrowser({ where });
const t1 = Date.now();
try {
  const page = await B.browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await page.goto(B.url('dist/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 15000 });
  const st = await page.evaluate(() => { window.__folding.setGroup('22x'); window.__folding.setT(1); return window.__folding.getState(); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: out });
  console.log(JSON.stringify({ where: B.where, openMs: t1 - t0, totalMs: Date.now() - t0, group: st.groupId, seamGap: st.seamGap, webgl: st.webgl, errors: st.errors }));
} finally { await B.close(); }
