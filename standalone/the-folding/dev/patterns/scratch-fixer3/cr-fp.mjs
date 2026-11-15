// dev/patterns/scratch-fixer3/cr-fp.mjs — the fixer (15 Nov 2026), after the WebKit reviewer's cr-fp.mjs: every print's
// motif in Chrome (the mini's pool) on the BUILT page (dist/index.html as it is now), and the same motifs in node itself
// from the sources, to OUT/fixer3/fp/ (fp-chromium.json, fp-node.json); wk-fp.sh adds WebKit's, fp-compare.mjs compares.
//   FOLDING_BROWSER=mini node dev/patterns/scratch-fixer3/cr-fp.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { openBrowser } from '../../../tools/browser.mjs';
import { runFp, ALL, PATS } from './wk/fp-lib.mjs';
import { GROUPS } from '../../../src/groups.js';
import { printFor } from '../../../src/pattern.js';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const out = '/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/fixer3/fp', stage = '/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/fixer3/cr-stage';
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(stage, { recursive: true });
fs.copyFileSync(path.join(W, 'dist/index.html'), path.join(stage, 'index.html'));
fs.copyFileSync(path.join(W, 'package.json'), path.join(stage, 'package.json'));   // (tools/browser.mjs asks for it through the tunnel)
{
  const BY = Object.fromEntries(GROUPS.map((g) => [g.id, g])), motifs = {};
  for (const p of PATS) for (const id of ALL) {
    const pr = printFor(BY[id], p);
    if (!pr) { motifs[p + ' ' + id] = null; continue; }
    motifs[p + ' ' + id] = pr.kind === 'shapes' ? { kind: pr.kind, verts: pr.verts, netArea: pr.netArea, info: pr.info, polys: pr.polys.map((P) => ({ hole: !!P.hole, pts: Array.from(P.pts) })) }
      : { kind: pr.kind, name: pr.name, forms: pr.forms || null, origin: pr.origin || null, a: pr.a || null, b: pr.b || null, width: pr.width || null };
  }
  fs.writeFileSync(path.join(out, 'fp-node.json'), JSON.stringify({ engine: 'node', version: `${process.version} ${os.arch()}`, motifs: { out: motifs, ms: {} } }));
}
const B = await openBrowser({ root: stage, where: process.env.FOLDING_BROWSER || 'mini' });
try {
  const r = await runFp({ browser: B.browser, url: B.url('index.html'), out, engine: 'chromium' });
  console.log(`chromium: ${r.n} prints; node: ${PATS.length * ALL.length}`);
} finally { await B.close(); }
