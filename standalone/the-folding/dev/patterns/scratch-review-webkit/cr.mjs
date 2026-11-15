// dev/patterns/scratch-review-webkit/cr.mjs — lib.mjs's review in Chrome (the mini's pool), on the staged build
// (stage/index.html = dist/index.html as reviewed). Pictures and report.json to OUT/review-webkit/chrome/.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-review-webkit/cr.mjs [--quick]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';
import { runReview } from './lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const quick = process.argv.includes('--quick');
const out = '/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/review-webkit/' + (quick ? 'chrome-quick' : 'chrome');
const B = await openBrowser({ root: path.join(here, 'stage'), where: process.env.FOLDING_BROWSER || 'mini' });
const t0 = Date.now();
try {
  const r = await runReview({ browser: B.browser, url: B.url('index.html'), out, engine: 'chromium', quick });
  console.log(`chromium ${r.version} (${B.where}): ${((Date.now() - t0) / 1000).toFixed(0)} s, ${r.states.length} states, ${r.agree.length} agree checks -> ${out}`);
} catch (e) { console.log('FAILED ' + (e && e.stack || e)); process.exitCode = 1; } finally { await B.close(); }
