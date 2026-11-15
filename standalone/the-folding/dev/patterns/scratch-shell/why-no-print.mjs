// scratch (shell): which registered patterns have no print for which group, and the page's own warning saying why.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-shell/why-no-print.mjs [designs=paisley,tomoe,blobs] [keys=paisley,soft,tomoe]
import { openBrowser } from '../../../tools/browser.mjs';
const designs = process.argv[2] || 'paisley,tomoe,blobs', keys = (process.argv[3] || 'paisley,soft,tomoe').split(',');
const B = await openBrowser({ quiet: true });
try {
  const page = await (await B.browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const warn = [];
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warn.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => warn.push('pageerror: ' + e.message));
  await page.goto(B.url(`dev/patterns/app.html?designs=${designs}#g=333`), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready && window.__designs && window.__designs.ready, null, { timeout: 30000 });
  const res = await page.evaluate(async (keys) => {
    const { GROUPS } = await import('/src/groups.js');
    const out = [];
    for (const g of GROUPS) for (const k of keys) {
      window.__folding.setGroup(g.id); window.__folding.setPattern(k);
      const st = window.__folding.getState();
      if (!st.printKind) out.push(`${g.id} ${k}: no print`);
    }
    return out;
  }, keys);
  console.log(res.length ? res.join('\n') : 'every group has a print for ' + keys.join(', '));
  for (const w of [...new Set(warn)]) console.log(w.slice(0, 400));
} finally { await B.close(); }
