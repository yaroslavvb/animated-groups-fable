// dev/patterns/scratch-review-webkit/wk-tile.mjs — tile-lib.mjs in Playwright's WebKit on the M5 (wk-bg.sh tile).
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = path.dirname(new URL(import.meta.url).pathname);
const PW = process.env.PLAYWRIGHT_MJS || process.env.HOME + '/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const { webkit } = await import(PW);
const { runTile } = await import(pathToFileURL(path.join(dir, 'tile-lib.mjs')).href);
let browser;
try {
  browser = await webkit.launch();
  const n = await runTile({ browser, url: pathToFileURL(path.join(dir, 'index.html')).href, out: path.join(dir, 'out'), engine: 'webkit' });
  console.log(`webkit ${browser.version()}: ${n} states`);
} catch (e) { console.log('FAILED ' + (e && e.stack || e)); process.exitCode = 1; } finally { if (browser) await browser.close(); }
