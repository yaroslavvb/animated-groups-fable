// dev/recut/webkit-layout.mjs — the layout checks of test/shell-layout.lib.js in Playwright's WebKit, Safari's engine,
// on the BUILT page (dist/index.html, from a file). Chrome cannot see what Safari lays out differently: on 13 Nov 2026
// the invisible native select's own text counted as page width on a phone, in WebKit only.
// WebKit is on the M5, not on the mini. From the mini:
//     bash dev/recut/webkit-layout.sh        (copies the page, the checks and this file to the M5, runs it, cleans up)
// On a machine with WebKit and this folder:   node dev/recut/webkit-layout.mjs [<dir with index.html, shell-layout.lib.js, cases.json>]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = path.resolve(process.argv[2] || path.dirname(new URL(import.meta.url).pathname));
const PW = process.env.PLAYWRIGHT_MJS || process.env.HOME + '/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const { webkit } = await import(PW);
const { sweep } = await import(pathToFileURL(path.join(dir, 'shell-layout.lib.js')).href);
const cases = JSON.parse(fs.readFileSync(path.join(dir, 'cases.json'), 'utf8'));
let failed = 1, browser;
try {
  browser = await webkit.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message).slice(0, 200)));
  await page.goto(pathToFileURL(path.join(dir, 'index.html')).href + '#g=333', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__folding && window.__folding.ready, null, { timeout: 30000 });
  const t0 = Date.now();
  const { failures, foldAt375 } = await sweep(page, cases);
  console.log(`WebKit ${browser.version()}: ${cases.length} groups, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  console.log('fold pane height at 375 x 498: ' + JSON.stringify(foldAt375));
  // the same problem at many sizes and groups: once, with its count
  const kinds = new Map();
  for (const f of failures) { const k = f.replace(/^\S+ \S+( (rings|comma))?( t = [\d.]+)?: /, ''); kinds.set(k, (kinds.get(k) || []).concat(f)); }
  for (const [k, v] of kinds) console.log(`  ${String(v.length).padStart(4)} x  ${k}    e.g. ${v[0].slice(0, 60)}`);
  for (const e of errors.slice(0, 5)) console.log('  page error: ' + e);
  failed = failures.length + errors.length;
  console.log(failed ? `${failures.length} problems, ${errors.length} page errors` : 'all passed');
} catch (e) { console.log('FAILED ' + (e && e.stack || e)); } finally { if (browser) await browser.close(); }
process.exit(failed ? 1 : 0);
