// dev/patterns/scratch-review-webkit/wk.mjs — lib.mjs's review in Playwright's WebKit (Safari's engine), on the M5,
// on the built page from a file. wk.sh copies this file, lib.mjs and the page to /tmp/folding-review-webkit there.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = path.dirname(new URL(import.meta.url).pathname);
const PW = process.env.PLAYWRIGHT_MJS || process.env.HOME + '/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const { webkit } = await import(PW);
const { runReview } = await import(pathToFileURL(path.join(dir, 'lib.mjs')).href);
const quick = process.env.QUICK === '1';
const t0 = Date.now();
let browser;
try {
  browser = await webkit.launch();
  const r = await runReview({ browser, url: pathToFileURL(path.join(dir, 'index.html')).href, out: path.join(dir, 'out'), engine: 'webkit', quick });
  console.log(`webkit ${r.version}: ${((Date.now() - t0) / 1000).toFixed(0)} s, ${r.states.length} states, ${r.agree.length} agree checks`);
} catch (e) { console.log('FAILED ' + (e && e.stack || e)); process.exitCode = 1; } finally { if (browser) await browser.close(); }
