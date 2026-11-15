// dev/patterns/scratch-review-webkit/cr-fp.mjs — fp-lib.mjs in Chrome (the mini's pool), and the same motifs and Math
// values in node itself (V8, from the sources), to OUT/review-webkit/fp/.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-review-webkit/cr-fp.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';
import { runFp, ALL, PATS } from './fp-lib.mjs';
import { GROUPS } from '../../../src/groups.js';
import { printFor } from '../../../src/pattern.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = '/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/review-webkit/fp';
fs.mkdirSync(out, { recursive: true });
// node, from the sources
{
  const BY = Object.fromEntries(GROUPS.map((g) => [g.id, g])), motifs = {};
  for (const p of PATS) for (const id of ALL) {
    const pr = printFor(BY[id], p);
    if (!pr) { motifs[p + ' ' + id] = null; continue; }
    motifs[p + ' ' + id] = pr.kind === 'shapes' ? { kind: pr.kind, verts: pr.verts, netArea: pr.netArea, info: pr.info, polys: pr.polys.map((P) => ({ hole: !!P.hole, pts: Array.from(P.pts) })) }
      : { kind: pr.kind, name: pr.name, forms: pr.forms || null, origin: pr.origin || null, a: pr.a || null, b: pr.b || null, width: pr.width || null };
  }
  fs.writeFileSync(path.join(out, 'fp-node.json'), JSON.stringify({ engine: 'node', version: process.version, motifs: { out: motifs, ms: {} } }));
}
const B = await openBrowser({ root: path.join(here, 'stage'), where: process.env.FOLDING_BROWSER || 'mini' });
try {
  const r = await runFp({ browser: B.browser, url: B.url('index.html'), out, engine: 'chromium' });
  console.log(`chromium: ${r.n} prints; node: ${PATS.length * ALL.length}`);
} finally { await B.close(); }
