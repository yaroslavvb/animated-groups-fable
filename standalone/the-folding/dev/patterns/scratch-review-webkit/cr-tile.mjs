// dev/patterns/scratch-review-webkit/cr-tile.mjs — tile-lib.mjs in Chrome (the mini's pool) on the staged build.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-review-webkit/cr-tile.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';
import { runTile } from './tile-lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const B = await openBrowser({ root: path.join(here, 'stage'), where: process.env.FOLDING_BROWSER || 'mini' });
try {
  const n = await runTile({ browser: B.browser, url: B.url('index.html'), out: '/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/review-webkit/chrome-tile', engine: 'chromium' });
  console.log(`chromium: ${n} states`);
} finally { await B.close(); }
